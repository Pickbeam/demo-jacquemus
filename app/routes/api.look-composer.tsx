import type {Route} from './+types/api.look-composer';
import Anthropic from '@anthropic-ai/sdk';
import {callShopifyMCPTool, parseProductsFromMCPResult} from '~/lib/shopify-mcp-client';

const STRATEGY_PROMPT = `You are a fashion stylist for Jacquemus luxury brand.
Given a product, return ONLY a valid JSON object:
{ "searches": ["term1", "term2", "term3"] }
Rules:
- 2-3 complementary clothing/accessory categories in English
- Short search terms (1-3 words)
- Never include the same category as the input product
Examples:
bag → ["dress", "sandals", "belt"]
dress → ["bag", "heels", "jewelry"]
shoes → ["dress", "bag"]`;

const SELECTION_PROMPT = `You are a Jacquemus fashion editor.
Given a product and candidates per category, select the best match per category and write one short French sentence introducing the complete look.
Return ONLY valid JSON: { "selectedIds": ["id1", "id2"], "phrase": "..." }
Rules:
- selectedIds: exactly one product id per category
- phrase: 1 sentence max, warm, elegant, in French, do not name the products`;

function sseChunk(event: string, data: unknown): Uint8Array {
  return new TextEncoder().encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}

export async function action({request, context}: Route.ActionArgs) {
  const {productTitle, tags, productType} = (await request.json()) as {
    productTitle: string;
    tags: string[];
    productType: string;
  };

  const env = context.env as unknown as Record<string, string | undefined>;
  const mcpUrl = `https://${env.PUBLIC_STORE_DOMAIN}/api/mcp`;
  const storefrontToken = env.PUBLIC_STOREFRONT_API_TOKEN ?? '';
  const anthropicKey = env.ANTHROPIC_API_KEY ?? '';

  if (!anthropicKey || anthropicKey.startsWith('sk-ant-REPLACE')) {
    return Response.json({error: 'ANTHROPIC_API_KEY not configured'}, {status: 500});
  }

  const client = new Anthropic({apiKey: anthropicKey, maxRetries: 4});

  const stream = new ReadableStream({
    async start(controller) {
      const enq = (event: string, data: unknown) =>
        controller.enqueue(sseChunk(event, data));

      const keepalive = setInterval(() => {
        try {
          controller.enqueue(new TextEncoder().encode(': keepalive\n\n'));
        } catch {}
      }, 4000);

      try {
        // ── Étape 1 : Claude décide les catégories à chercher ──────────────
        const strategyMsg = await client.messages.create({
          model: 'claude-sonnet-4-6',
          max_tokens: 60,
          system: STRATEGY_PROMPT,
          messages: [
            {
              role: 'user',
              content: `Product: "${productTitle}" (type: ${productType || 'unknown'}, tags: ${tags.join(', ') || 'none'})`,
            },
          ],
        });

        const rawStrategy =
          strategyMsg.content[0]?.type === 'text' ? strategyMsg.content[0].text.trim() : '{}';
        let searches: string[] = [];
        try {
          const parsed = JSON.parse(
            rawStrategy.replace(/```(?:json)?\n?|\n?```/g, '').trim(),
          ) as {searches: string[]};
          searches = parsed.searches ?? [];
        } catch {
          searches = ['dress', 'shoes'];
        }

        // ── Étape 2 : Appels MCP en parallèle ──────────────────────────────
        const mcpResults = await Promise.all(
          searches.map(async (term) => {
            try {
              const result = await callShopifyMCPTool(
                mcpUrl,
                storefrontToken,
                'search_catalog',
                {catalog: {query: term}},
              );
              const products = parseProductsFromMCPResult(result).filter(
                (p) => p.variantId && p.price > 0,
              );
              return {term, products: products.slice(0, 3)};
            } catch {
              return {term, products: []};
            }
          }),
        );

        const candidates = mcpResults.filter((r) => r.products.length > 0);

        if (candidates.length < 2) {
          enq('error', {message: "Nous n'avons pas trouvé de look complet pour ce produit."});
          return;
        }

        // ── Étape 3 : Claude sélectionne + génère la phrase ────────────────
        const candidateList = candidates
          .map(
            (c) =>
              `${c.term}:\n${c.products
                .map((p) => `  - id:${p.id} "${p.title}" ${p.price}€`)
                .join('\n')}`,
          )
          .join('\n\n');

        const selectionMsg = await client.messages.create({
          model: 'claude-sonnet-4-6',
          max_tokens: 120,
          system: SELECTION_PROMPT,
          messages: [
            {
              role: 'user',
              content: `Current product: "${productTitle}"\n\nCandidates by category:\n${candidateList}`,
            },
          ],
        });

        const rawSelection =
          selectionMsg.content[0]?.type === 'text'
            ? selectionMsg.content[0].text.trim()
            : '{}';

        let selectedIds: string[] = [];
        let phrase = '';
        try {
          const parsed = JSON.parse(
            rawSelection.replace(/```(?:json)?\n?|\n?```/g, '').trim(),
          ) as {selectedIds: string[]; phrase: string};
          selectedIds = parsed.selectedIds ?? [];
          phrase = parsed.phrase ?? '';
        } catch {
          selectedIds = candidates.map((c) => c.products[0].id);
        }

        const allCandidates = candidates.flatMap((c) => c.products);
        const selectedProducts = selectedIds
          .map((id) => allCandidates.find((p) => p.id === id))
          .filter((p): p is NonNullable<typeof p> => p !== undefined);

        if (selectedProducts.length > 0) {
          enq('look', {products: selectedProducts});
        }
        if (phrase) {
          enq('text', {text: phrase});
        }
        enq('done', {});
      } catch (err) {
        enq('error', {message: String(err)});
      } finally {
        clearInterval(keepalive);
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'X-Accel-Buffering': 'no',
    },
  });
}
