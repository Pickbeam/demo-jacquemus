import type {Route} from './+types/api.cart-suggestion';
import Anthropic from '@anthropic-ai/sdk';

const SUGGEST_PROMPT = `Tu es un styliste personnel pour Jacquemus.
Le client a ces articles dans son panier :
{CART_ITEMS}

Identifie UNE catégorie de pièce manquante pour compléter le look.
Exemples de catégories : chaussures (shoes/sandals/heels/boots/mules), sac (bag), ceinture (belt), chapeau (hat), lunettes (sunglasses), veste (jacket/blazer).
Ne propose JAMAIS une catégorie déjà présente dans le panier.
Choisis la pièce la plus naturellement complémentaire.

Retourne UNIQUEMENT du JSON valide :
{"searchQuery": "1-4 mots en anglais pour Shopify", "phrase": "1 phrase élégante en français sur la pièce manquante"}
Exemples :
{"searchQuery":"heeled mules","phrase":"Une paire de mules compléterait parfaitement cette silhouette."}
{"searchQuery":"bambino bag","phrase":"Un sac vient naturellement finir ce look."}`;

const PRODUCTS_QUERY = `#graphql
  query CartSuggestion($first: Int!, $query: String!) {
    products(first: $first, query: $query) {
      nodes {
        id
        title
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

export async function action({request, context}: Route.ActionArgs) {
  let cartTitles: string[];
  try {
    ({cartTitles} = (await request.json()) as {cartTitles: string[]});
  } catch {
    return Response.json({error: 'Invalid JSON body'}, {status: 400});
  }
  const {storefront} = context;
  const env = context.env as unknown as Record<string, string | undefined>;
  const anthropicKey = env.ANTHROPIC_API_KEY ?? '';

  if (!anthropicKey || anthropicKey.startsWith('sk-ant-REPLACE')) {
    return Response.json({error: 'ANTHROPIC_API_KEY not configured'}, {status: 500});
  }

  if (!Array.isArray(cartTitles) || !cartTitles.length) {
    return Response.json({error: 'cartTitles must be a non-empty array'}, {status: 400});
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
        const itemsList = cartTitles.map((t) => `- ${t}`).join('\n');
        const userPrompt = SUGGEST_PROMPT.replace('{CART_ITEMS}', itemsList);

        const msg = await client.messages.create({
          model: 'claude-sonnet-4-6',
          max_tokens: 200,
          messages: [{role: 'user', content: userPrompt}],
        });

        const rawJson =
          msg.content[0]?.type === 'text' ? msg.content[0].text.trim() : '{}';

        let parsed: {searchQuery?: string; phrase?: string} = {};
        try {
          parsed = JSON.parse(rawJson.replace(/```(?:json)?\n?|\n?```/g, '').trim()) as typeof parsed;
        } catch {
          parsed = {};
        }

        const searchQuery = parsed.searchQuery ?? '';
        const phrase = parsed.phrase ?? '';

        if (!searchQuery) {
          enq('done', {});
          return;
        }

        enq('text', {text: phrase});

        const data = (await storefront.query(PRODUCTS_QUERY, {
          variables: {first: 1, query: searchQuery},
        })) as {
          products: {
            nodes: Array<{
              id: string;
              title: string;
              priceRange: {minVariantPrice: {amount: string; currencyCode: string}};
              images: {nodes: Array<{url: string; altText: string | null}>};
              variants: {nodes: Array<{id: string}>};
            }>;
          };
        };

        const first = data.products.nodes[0];
        if (first) {
          enq('product', {
            product: {
              id: first.id,
              title: first.title,
              price: parseFloat(first.priceRange.minVariantPrice.amount),
              image: first.images.nodes[0]?.url ?? '',
              variantId: first.variants.nodes[0]?.id ?? '',
            },
          });
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
