import type {Route} from './+types/api.semantic-search';
import Anthropic from '@anthropic-ai/sdk';

const PARSE_PROMPT = `You are a luxury fashion search engine for Jacquemus.
Given a natural language query in French or English, extract:
1. A short English keyword query for Shopify (1-4 words, e.g. "bambino bag", "white dress", "heeled sandals")
2. A one-sentence interpretation in French of what the customer is looking for
3. Optional price_max in euros (integer) if mentioned

Return ONLY valid JSON:
{"keywords": "summer dress", "interpretation": "Une robe légère d'été pour une occasion chic."}

Examples:
"je cherche une robe pour un dîner en Corse en juillet" → {"keywords":"summer dress","interpretation":"Une robe légère pour un dîner estival en vacances."}
"un sac à offrir pour ma mère, budget 400€" → {"keywords":"bag","price_max":400,"interpretation":"Un sac cadeau élégant dans un budget de 400 €."}
"quelque chose de chic pour un mariage" → {"keywords":"elegant dress","interpretation":"Une tenue habillée pour célébrer un mariage."}
"le bambino" → {"keywords":"bambino bag","interpretation":"Le Bambino, sac iconique de la maison."}`;

const PRODUCTS_QUERY = `#graphql
  query SemanticSearch($first: Int!, $query: String!) {
    products(first: $first, query: $query) {
      nodes {
        id
        title
        description
        handle
        priceRange {
          minVariantPrice { amount currencyCode }
        }
        images(first: 1) {
          nodes { url altText }
        }
        variants(first: 1) {
          nodes { id }
        }
      }
    }
  }
` as const;

function sseChunk(event: string, data: unknown): Uint8Array {
  return new TextEncoder().encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}

interface ParseResult {
  keywords?: string;
  interpretation?: string;
  price_max?: number;
}

export async function action({request, context}: Route.ActionArgs) {
  let query: string;
  try {
    ({query} = (await request.json()) as {query: string});
  } catch {
    return Response.json({error: 'Invalid JSON body'}, {status: 400});
  }
  if (!query || typeof query !== 'string') {
    return Response.json({error: 'query is required'}, {status: 400});
  }

  const {storefront} = context;
  const env = context.env as unknown as Record<string, string | undefined>;
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
        const parseMsg = await client.messages.create({
          model: 'claude-sonnet-4-6',
          max_tokens: 200,
          system: PARSE_PROMPT,
          messages: [{role: 'user', content: query}],
        });

        const rawJson =
          parseMsg.content[0]?.type === 'text'
            ? parseMsg.content[0].text.trim()
            : '{}';

        let parsed: ParseResult = {};
        try {
          parsed = JSON.parse(rawJson.replace(/```(?:json)?\n?|\n?```/g, '').trim()) as ParseResult;
        } catch {
          parsed = {};
        }

        const interpretation = parsed.interpretation ?? '';
        const keywords = parsed.keywords ?? query;

        enq('interpretation', {text: interpretation});

        let shopifyQuery = keywords;
        if (parsed.price_max) shopifyQuery += ` variants.price:<=${parsed.price_max}`;

        const data = (await storefront.query(PRODUCTS_QUERY, {
          variables: {first: 8, query: shopifyQuery},
        })) as {
          products: {
            nodes: Array<{
              id: string;
              title: string;
              description: string;
              handle: string;
              priceRange: {minVariantPrice: {amount: string; currencyCode: string}};
              images: {nodes: Array<{url: string; altText: string | null}>};
              variants: {nodes: Array<{id: string}>};
            }>;
          };
        };

        const products = data.products.nodes.map((p) => ({
          id: p.id,
          title: p.title,
          description: p.description,
          handle: p.handle,
          price: parseFloat(p.priceRange.minVariantPrice.amount),
          image: p.images.nodes[0]?.url ?? '',
          variantId: p.variants.nodes[0]?.id ?? '',
        }));

        enq('products', {products});
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
