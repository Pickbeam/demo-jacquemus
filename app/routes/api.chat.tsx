import type {Route} from './+types/api.chat';
import Anthropic from '@anthropic-ai/sdk';
import {callShopifyMCPTool, parseProductsFromMCPResult} from '~/lib/shopify-mcp-client';

const PARSE_PROMPT = `You are a search parameter extractor for a Jacquemus luxury fashion store.
Given the user's request, return ONLY a valid JSON object with these optional fields:
- query: short English search term (1-4 words, e.g. "red shoes", "black bag", "white dress")
- price_min: minimum price in euros as integer
- price_max: maximum price in euros as integer

Rules:
- query must be in English
- Include color, material, or style in the query if mentioned
- Only include price fields when explicitly mentioned
- Return only the JSON, no other text

Examples:
"des chaussures rouges" → {"query":"red shoes"}
"un sac à moins de 600€" → {"query":"bag","price_max":600}
"une robe blanche élégante plus de 400€" → {"query":"white dress","price_min":400}
"des chaussures à moins de 600€" → {"query":"shoes","price_max":600}
"le bambino" → {"query":"bambino bag"}
"quelque chose pour un mariage" → {"query":"dress"}`;

const RESPONSE_PROMPT = `You are a sophisticated personal shopper for Jacquemus.
Write exactly 1-2 sentences in French, warm and elegant, to present the selected pieces.
The products are displayed visually — do not name or list them, just set the mood.`;

function sseChunk(event: string, data: unknown): Uint8Array {
  return new TextEncoder().encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}

function ts() {
  return new Date().toLocaleTimeString('fr-FR', {hour: '2-digit', minute: '2-digit', second: '2-digit'});
}

interface SearchParams {
  query?: string;
  price_min?: number;
  price_max?: number;
}

export async function action({request, context}: Route.ActionArgs) {
  const {message} = (await request.json()) as {message: string};

  const env = context.env as unknown as Record<string, string | undefined>;
  const mcpUrl = `https://${env.PUBLIC_STORE_DOMAIN}/api/mcp`;
  const storefrontToken = env.PUBLIC_STOREFRONT_API_TOKEN ?? '';
  const anthropicKey = env.ANTHROPIC_API_KEY ?? '';

  if (!anthropicKey || anthropicKey.startsWith('sk-ant-REPLACE')) {
    return Response.json({error: 'ANTHROPIC_API_KEY not configured'}, {status: 500});
  }

  const client = new Anthropic({apiKey: anthropicKey});

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
        // 1. Parse user request into structured MCP params
        enq('log', {timestamp: ts(), direction: '▸', label: 'claude-haiku-4-5 → parse query', detail: `"${message}"`});

        const parseMsg = await client.messages.create({
          model: 'claude-sonnet-4-6',
          max_tokens: 80,
          system: PARSE_PROMPT,
          messages: [{role: 'user', content: message}],
        });

        const rawJson = parseMsg.content[0]?.type === 'text' ? parseMsg.content[0].text.trim() : '{}';
        let params: SearchParams = {};
        try {
          params = JSON.parse(rawJson.replace(/```(?:json)?\n?|\n?```/g, '').trim()) as SearchParams;
        } catch {
          params = {query: 'bag'};
        }

        const priceLabel = [
          params.price_max !== undefined ? `≤ ${params.price_max}€` : '',
          params.price_min !== undefined ? `≥ ${params.price_min}€` : '',
        ].filter(Boolean).join(', ');

        enq('log', {
          timestamp: ts(),
          direction: '◂',
          label: `Parsed → query: "${params.query || 'bag'}"${priceLabel ? ` · ${priceLabel}` : ''}`,
        });

        // 2. Call MCP with structured params
        enq('log', {
          timestamp: ts(),
          direction: '▸',
          label: 'tools/call → search_catalog',
          detail: [params.query || 'bag', priceLabel].filter(Boolean).join(' · '),
        });

        const catalogInput: Record<string, unknown> = {query: params.query || 'bag'};
        if (params.price_min !== undefined || params.price_max !== undefined) {
          catalogInput.filters = {
            price: {
              ...(params.price_min !== undefined && {min: params.price_min * 100}),
              ...(params.price_max !== undefined && {max: params.price_max * 100}),
            },
          };
        }

        const mcpResult = await callShopifyMCPTool(mcpUrl, storefrontToken, 'search_catalog', {
          catalog: catalogInput,
        });
        const products = parseProductsFromMCPResult(mcpResult);

        enq('log', {
          timestamp: ts(),
          direction: '◂',
          label: `MCP → ${products.length} produit(s)${priceLabel ? ` (${priceLabel})` : ''}`,
          detail: products.map((p) => p.title).join(', ') || 'Aucun résultat',
        });

        if (products.length > 0) {
          enq('products', {products});
        }

        // 3. Generate elegant French response
        enq('log', {timestamp: ts(), direction: '▸', label: 'claude-haiku-4-5 → response', detail: `"${message}"`});

        const productList = products
          .slice(0, 6)
          .map((p) => `- ${p.title}${p.price > 0 ? ` (${p.price.toLocaleString('fr-FR')} €)` : ''}`)
          .join('\n');

        const responseStream = client.messages.stream({
          model: 'claude-sonnet-4-6',
          max_tokens: 150,
          system: RESPONSE_PROMPT,
          messages: [
            {
              role: 'user',
              content: `Demande : "${message}"\nProduits sélectionnés :\n${productList || 'Aucun produit trouvé'}\n\nRéponds en 1-2 phrases en français.`,
            },
          ],
        });

        for await (const event of responseStream) {
          if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
            enq('text', {delta: event.delta.text});
          }
        }

        const finalMsg = await responseStream.finalMessage();
        enq('log', {timestamp: ts(), direction: '◂', label: `Claude → stop_reason: ${finalMsg.stop_reason}`});

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
