# Cart Intelligence Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Afficher dans le drawer panier une suggestion de "la pièce manquante" — Claude analyse les articles du panier et recommande le produit Jacquemus qui compléterait le look.

**Architecture:** Trois changements — (1) `api.cart-suggestion.tsx` SSE action : Claude détermine la catégorie manquante depuis les titres des articles panier, puis interroge le Storefront API pour trouver le produit; (2) `CartSuggestion.tsx` composant React qui auto-déclenche la suggestion quand le panier change; (3) modification de `CartMain.tsx` pour insérer le composant dans le drawer.

**Tech Stack:** React Router v7, Hydrogen Storefront API, Anthropic SDK (claude-haiku-4-5-20251001), SSE streaming, CartForm de @shopify/hydrogen

---

## Fichiers

| Action | Chemin |
|---|---|
| Créer | `app/routes/api.cart-suggestion.tsx` |
| Créer | `app/components/CartSuggestion.tsx` |
| Modifier | `app/components/CartMain.tsx` |

---

## Task 1 : API SSE — cart suggestion endpoint

**Files:**
- Create: `app/routes/api.cart-suggestion.tsx`

- [ ] **Step 1 : Créer le fichier `app/routes/api.cart-suggestion.tsx`**

```typescript
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
        description
        priceRange {
          minVariantPrice { amount currencyCode }
        }
        images(first: 1) {
          nodes { url altText }
        }
        variants(first: 1) {
          nodes { id }
        }
        tags
      }
    }
  }
` as const;

function sseChunk(event: string, data: unknown): Uint8Array {
  return new TextEncoder().encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}

export async function action({request, context}: Route.ActionArgs) {
  const {cartTitles} = (await request.json()) as {cartTitles: string[]};
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

      try {
        const itemsList = cartTitles.map((t) => `- ${t}`).join('\n');
        const userPrompt = SUGGEST_PROMPT.replace('{CART_ITEMS}', itemsList);

        // 1. Claude identifies missing category
        const msg = await client.messages.create({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 150,
          messages: [{role: 'user', content: userPrompt}],
        });

        const rawJson =
          msg.content[0]?.type === 'text' ? msg.content[0].text.trim() : '{}';

        let parsed: {searchQuery?: string; phrase?: string} = {};
        try {
          parsed = JSON.parse(rawJson) as typeof parsed;
        } catch {
          parsed = {};
        }

        const searchQuery = parsed.searchQuery ?? '';
        const phrase = parsed.phrase ?? '';

        if (!searchQuery) {
          enq('done', {});
          controller.close();
          return;
        }

        // 2. Send editorial phrase immediately
        enq('text', {text: phrase});

        // 3. Query Storefront for that category
        const data = (await storefront.query(PRODUCTS_QUERY, {
          variables: {first: 4, query: searchQuery},
        })) as {
          products: {
            nodes: Array<{
              id: string;
              title: string;
              description: string;
              priceRange: {minVariantPrice: {amount: string; currencyCode: string}};
              images: {nodes: Array<{url: string; altText: string | null}>};
              variants: {nodes: Array<{id: string}>};
              tags: string[];
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
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  });
}
```

- [ ] **Step 2 : Générer les types React Router**

```bash
cd /Users/belamrani/Projets/demo-jacquemus && npm run typecheck 2>&1 | tail -6
```

Attendu : `react-router typegen` génère `.react-router/types/app/routes/+types/api.cart-suggestion.ts`.

- [ ] **Step 3 : Vérifier le fichier de types**

```bash
ls /Users/belamrani/Projets/demo-jacquemus/.react-router/types/app/routes/+types/api.cart-suggestion.ts
```

Attendu : le fichier existe.

---

## Task 2 : Composant CartSuggestion

**Files:**
- Create: `app/components/CartSuggestion.tsx`

- [ ] **Step 1 : Créer le fichier `app/components/CartSuggestion.tsx`**

```typescript
import {useEffect, useRef, useState, useCallback} from 'react';
import {CartForm} from '@shopify/hydrogen';
import {useAside} from '~/components/Aside';
import type {FetcherWithComponents} from 'react-router';

interface SuggestionProduct {
  id: string;
  title: string;
  price: number;
  image: string;
  variantId: string;
}

interface CartSuggestionProps {
  cartTitles: string[];
}

function AddSuggestionButton({variantId}: {variantId: string}) {
  const {open} = useAside();
  const prev = useRef('idle');

  return (
    <CartForm
      route="/cart"
      action={CartForm.ACTIONS.LinesAdd}
      inputs={{lines: [{merchandiseId: variantId, quantity: 1}]}}
    >
      {(fetcher: FetcherWithComponents<unknown>) => {
        if (prev.current !== 'idle' && fetcher.state === 'idle' && fetcher.data) {
          const d = fetcher.data as {errors?: unknown[]};
          if (!d.errors?.length) open('cart');
        }
        prev.current = fetcher.state;
        const loading = fetcher.state !== 'idle';
        return (
          <button
            type="submit"
            disabled={loading}
            style={{
              background: 'transparent',
              border: 'none',
              borderBottom: `1px solid ${loading ? '#ccc' : '#1a1a1a'}`,
              color: loading ? '#ccc' : '#1a1a1a',
              padding: '0 0 2px',
              fontSize: '7px',
              letterSpacing: '0.14em',
              textTransform: 'uppercase',
              cursor: loading ? 'wait' : 'pointer',
              marginTop: '10px',
              transition: 'opacity 0.2s',
              fontFamily: 'inherit',
            }}
          >
            {loading ? '···' : 'Ajouter →'}
          </button>
        );
      }}
    </CartForm>
  );
}

export function CartSuggestion({cartTitles}: CartSuggestionProps) {
  const [phrase, setPhrase] = useState('');
  const [product, setProduct] = useState<SuggestionProduct | null>(null);
  const [loading, setLoading] = useState(false);
  const keyRef = useRef('');

  const fetchSuggestion = useCallback(async (titles: string[]) => {
    setLoading(true);
    setPhrase('');
    setProduct(null);

    try {
      const res = await fetch('/api/cart-suggestion', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({cartTitles: titles}),
      });
      if (!res.ok || !res.body) return;

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let currentEvent = '';

      while (true) {
        const {done, value} = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, {stream: true});
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          if (line.startsWith('event: ')) {
            currentEvent = line.slice(7).trim();
          } else if (line.startsWith('data: ')) {
            let data: Record<string, unknown>;
            try {
              data = JSON.parse(line.slice(6)) as Record<string, unknown>;
            } catch {
              continue;
            }
            if (currentEvent === 'text') setPhrase(String(data.text ?? ''));
            if (currentEvent === 'product')
              setProduct(data.product as SuggestionProduct);
          }
        }
      }
    } catch {
      // silent — suggestion is optional
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!cartTitles.length) {
      setProduct(null);
      setPhrase('');
      return;
    }
    // Only re-fetch when the cart composition changes
    const key = [...cartTitles].sort().join('|');
    if (key === keyRef.current) return;
    keyRef.current = key;
    void fetchSuggestion(cartTitles);
  }, [cartTitles, fetchSuggestion]);

  if (!cartTitles.length && !loading) return null;

  return (
    <div
      style={{
        borderTop: '1px solid #f0ede8',
        padding: '18px 20px 20px',
        marginTop: '4px',
      }}
    >
      <p
        style={{
          fontSize: '7px',
          letterSpacing: '0.24em',
          textTransform: 'uppercase',
          color: '#aaa',
          margin: '0 0 12px',
        }}
      >
        La pièce manquante
      </p>

      {loading && (
        <div style={{display: 'flex', gap: '4px', alignItems: 'center', padding: '4px 0'}}>
          {[0, 0.2, 0.4].map((delay, i) => (
            <span
              key={i}
              style={{
                width: '4px',
                height: '4px',
                borderRadius: '50%',
                background: '#ccc',
                animation: `lcPulse 1.2s ${delay}s infinite`,
              }}
            />
          ))}
        </div>
      )}

      {!loading && product && (
        <div style={{display: 'flex', gap: '14px', alignItems: 'flex-start'}}>
          <div
            style={{
              width: '72px',
              flexShrink: 0,
              aspectRatio: '3/4',
              overflow: 'hidden',
              background: '#f0ede8',
            }}
          >
            {product.image && (
              <img
                src={product.image}
                alt={product.title}
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover',
                  display: 'block',
                }}
                loading="lazy"
              />
            )}
          </div>
          <div style={{flex: 1, minWidth: 0}}>
            {phrase && (
              <p
                style={{
                  fontSize: '9px',
                  color: '#888',
                  lineHeight: 1.6,
                  fontStyle: 'italic',
                  margin: '0 0 8px',
                  letterSpacing: '0.02em',
                }}
              >
                {phrase}
              </p>
            )}
            <p
              style={{
                fontSize: '8px',
                fontWeight: 500,
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
                color: '#1a1a1a',
                margin: '0 0 2px',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {product.title.replace('Jacquemus ', '')}
            </p>
            {product.price > 0 && (
              <p
                style={{
                  fontSize: '8px',
                  color: '#999',
                  margin: '0',
                  letterSpacing: '0.02em',
                }}
              >
                {product.price.toLocaleString('fr-FR')} €
              </p>
            )}
            <AddSuggestionButton variantId={product.variantId} />
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2 : Vérifier la compilation**

```bash
cd /Users/belamrani/Projets/demo-jacquemus && npx tsc --noEmit 2>&1 | grep "CartSuggestion" | head -5
```

Attendu : aucune erreur.

---

## Task 3 : Intégrer CartSuggestion dans CartMain

**Files:**
- Modify: `app/components/CartMain.tsx`

- [ ] **Step 1 : Ajouter l'import CartSuggestion**

En haut de `app/components/CartMain.tsx`, ajouter après les imports existants :

```typescript
import {CartSuggestion} from '~/components/CartSuggestion';
```

- [ ] **Step 2 : Insérer CartSuggestion dans le JSX**

Dans la fonction `CartMain`, après la `<div>` qui contient le `<ul>` des line items et avant `{cartHasItems && <CartSummary .../>}`, ajouter :

Remplacer le bloc :
```tsx
        {cartHasItems && <CartSummary cart={cart} layout={layout} />}
```

Par :
```tsx
        {cartHasItems && layout === 'aside' && (
          <CartSuggestion
            cartTitles={(cart?.lines?.nodes ?? []).map(
              (line) => line.merchandise.product.title,
            )}
          />
        )}
        {cartHasItems && <CartSummary cart={cart} layout={layout} />}
```

- [ ] **Step 3 : Vérifier la compilation complète**

```bash
cd /Users/belamrani/Projets/demo-jacquemus && npx tsc --noEmit 2>&1 | grep -E "error TS" | head -10
```

Attendu : aucune erreur TS.

- [ ] **Step 4 : Commit**

```bash
cd /Users/belamrani/Projets/demo-jacquemus && git add app/routes/api.cart-suggestion.tsx app/components/CartSuggestion.tsx app/components/CartMain.tsx && git commit -m "feat: cart intelligence — Claude suggests la pièce manquante in cart drawer"
```
