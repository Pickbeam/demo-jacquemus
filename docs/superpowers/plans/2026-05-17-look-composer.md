# Look Composer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ajouter un panneau "Compose le look complet" sur la PDP qui déclenche un agent IA pour proposer 3–5 pièces complémentaires disponibles, avec ajout panier en un clic.

**Architecture:** Une nouvelle action SSE `/api/look-composer` orchestre 3 étapes (Claude stratégie → MCP parallèle → Claude sélection+phrase). Un composant `LookComposer` gère les 3 états UI (idle / loading / loaded) et consomme le stream. La PDP est modifiée minimalement pour fournir les données produit et intégrer le composant.

**Tech Stack:** Remix (React Router v7), Hydrogen, Anthropic SDK (`@anthropic-ai/sdk`), Shopify MCP (JSON-RPC 2.0), CartForm (Hydrogen)

---

## Fichiers

| Action | Chemin |
|---|---|
| Créer | `app/routes/api.look-composer.tsx` |
| Créer | `app/components/LookComposer.tsx` |
| Modifier | `app/routes/($locale).products.$handle.tsx` |

---

## Task 1: Action SSE `/api/look-composer`

**Files:**
- Create: `app/routes/api.look-composer.tsx`

- [ ] **Step 1: Créer le fichier avec les prompts et le helper SSE**

```typescript
// app/routes/api.look-composer.tsx
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
```

- [ ] **Step 2: Écrire l'action principale**

Ajouter sous les constantes :

```typescript
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

  const client = new Anthropic({apiKey: anthropicKey});

  const stream = new ReadableStream({
    async start(controller) {
      const enq = (event: string, data: unknown) =>
        controller.enqueue(sseChunk(event, data));

      const keepalive = setInterval(() => {
        try { controller.enqueue(new TextEncoder().encode(': keepalive\n\n')); } catch {}
      }, 4000);

      try {
        // ── Étape 1 : Claude décide les catégories à chercher ──────────────
        const strategyMsg = await client.messages.create({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 60,
          system: STRATEGY_PROMPT,
          messages: [{
            role: 'user',
            content: `Product: "${productTitle}" (type: ${productType || 'unknown'}, tags: ${tags.join(', ') || 'none'})`,
          }],
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
                mcpUrl, storefrontToken, 'search_catalog',
                {catalog: {query: term}},
              );
              const products = parseProductsFromMCPResult(result)
                .filter((p) => p.variantId && p.price > 0);
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
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 120,
          system: SELECTION_PROMPT,
          messages: [{
            role: 'user',
            content: `Current product: "${productTitle}"\n\nCandidates by category:\n${candidateList}`,
          }],
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
```

- [ ] **Step 3: Vérifier que le fichier compile**

```bash
cd /Users/belamrani/Projets/demo-jacquemus && npx tsc --noEmit 2>&1 | head -20
```

Attendu : aucune erreur sur `api.look-composer.tsx` (des erreurs sur d'autres fichiers sont acceptables si elles préexistaient).

- [ ] **Step 4: Commit**

```bash
git add app/routes/api.look-composer.tsx
git commit -m "feat: add /api/look-composer SSE action"
```

---

## Task 2: Composant `LookComposer`

**Files:**
- Create: `app/components/LookComposer.tsx`

- [ ] **Step 1: Créer le squelette du composant avec les types et états**

```typescript
// app/components/LookComposer.tsx
import {useState, useCallback, useRef} from 'react';
import {CartForm} from '@shopify/hydrogen';
import {useAside} from '~/components/Aside';
import type {FetcherWithComponents} from 'react-router';
import type {ShopifyMCPProduct} from '~/lib/shopify-mcp-client';

interface LookComposerProps {
  productTitle: string;
  tags: string[];
  productType: string;
}

type State = 'idle' | 'loading' | 'loaded' | 'error';
```

- [ ] **Step 2: Ajouter le bouton d'ajout panier multi-lignes (réutilise le pattern de ChatBar)**

Ajouter sous les types :

```typescript
function AddLookButton({products}: {products: ShopifyMCPProduct[]}) {
  const {open} = useAside();
  const prev = useRef('idle');

  return (
    <CartForm
      route="/cart"
      action={CartForm.ACTIONS.LinesAdd}
      inputs={{
        lines: products.map((p) => ({merchandiseId: p.variantId, quantity: 1})),
      }}
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
              display: 'block',
              width: '100%',
              background: loading ? '#e8e2db' : '#1a1a1a',
              color: loading ? '#C4BAB0' : '#FDFAF6',
              border: 'none',
              padding: '10px 0',
              fontSize: '8px',
              letterSpacing: '0.2em',
              textTransform: 'uppercase',
              cursor: loading ? 'wait' : 'pointer',
              marginTop: '12px',
              borderRadius: '2px',
              transition: 'background 0.2s, color 0.2s',
            }}
          >
            {loading ? '···' : 'Ajouter le look entier'}
          </button>
        );
      }}
    </CartForm>
  );
}
```

- [ ] **Step 3: Ajouter la carte produit du look**

Ajouter sous `AddLookButton` :

```typescript
function LookProductCard({product}: {product: ShopifyMCPProduct}) {
  return (
    <div
      style={{
        background: '#fff',
        border: '1px solid #E8E3DC',
        width: '100px',
        flexShrink: 0,
        borderRadius: '2px',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          aspectRatio: '3/4',
          overflow: 'hidden',
          background: '#EDE8E1',
        }}
      >
        {product.image && (
          <img
            src={product.image}
            alt={product.title}
            style={{width: '100%', height: '100%', objectFit: 'cover', display: 'block'}}
            loading="lazy"
          />
        )}
      </div>
      <div style={{padding: '6px 8px 8px'}}>
        <div
          style={{
            fontSize: '6px',
            letterSpacing: '0.2em',
            textTransform: 'uppercase',
            color: '#C9BFB2',
            marginBottom: '3px',
          }}
        >
          Jacquemus
        </div>
        <div
          style={{
            fontSize: '8px',
            fontWeight: 500,
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
            color: '#1a1a1a',
            lineHeight: 1.3,
            marginBottom: '4px',
          }}
        >
          {product.title.replace('Jacquemus ', '')}
        </div>
        {product.price > 0 && (
          <div style={{fontSize: '9px', color: '#555'}}>
            {product.price.toLocaleString('fr-FR')} €
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Écrire le composant principal `LookComposer`**

Ajouter sous `LookProductCard` :

```typescript
export function LookComposer({productTitle, tags, productType}: LookComposerProps) {
  const [state, setState] = useState<State>('idle');
  const [products, setProducts] = useState<ShopifyMCPProduct[]>([]);
  const [phrase, setPhrase] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const compose = useCallback(async () => {
    if (state === 'loading') return;
    setState('loading');
    setProducts([]);
    setPhrase('');
    setErrorMsg('');

    try {
      const res = await fetch('/api/look-composer', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({productTitle, tags, productType}),
      });

      if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`);

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
            if (currentEvent === 'look') {
              setProducts((data.products as ShopifyMCPProduct[]) ?? []);
              setState('loaded');
            } else if (currentEvent === 'text') {
              setPhrase(String(data.text ?? ''));
            } else if (currentEvent === 'error') {
              setErrorMsg(String(data.message ?? 'Une erreur est survenue.'));
              setState('error');
            }
          }
        }
      }
    } catch (err) {
      setErrorMsg(String(err));
      setState('error');
    }
  }, [productTitle, tags, productType, state]);

  return (
    <div
      style={{
        borderTop: '1px solid #E8E3DC',
        background: '#F5F1EB',
        padding: '14px 0 16px',
        marginTop: '24px',
      }}
    >
      {/* Header */}
      <div
        style={{
          fontSize: '7px',
          letterSpacing: '0.22em',
          textTransform: 'uppercase',
          color: '#8a7d6e',
          marginBottom: '12px',
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
        }}
      >
        <span style={{color: '#c8a96e', fontSize: '10px'}}>✦</span>
        Compose le look complet
      </div>

      {/* Idle */}
      {state === 'idle' && (
        <button
          onClick={compose}
          style={{
            background: 'transparent',
            border: '1px solid #8a7d6e',
            color: '#8a7d6e',
            width: '100%',
            padding: '9px 0',
            fontSize: '7px',
            letterSpacing: '0.18em',
            textTransform: 'uppercase',
            cursor: 'pointer',
            borderRadius: '2px',
            transition: 'border-color 0.2s, color 0.2s',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = '#1a1a1a';
            e.currentTarget.style.color = '#1a1a1a';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = '#8a7d6e';
            e.currentTarget.style.color = '#8a7d6e';
          }}
        >
          Voir les suggestions →
        </button>
      )}

      {/* Loading */}
      {state === 'loading' && (
        <div style={{display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 0'}}>
          <span
            style={{
              width: '5px',
              height: '5px',
              borderRadius: '50%',
              background: '#C9BFB2',
              animation: 'lcPulse 1.2s infinite',
            }}
          />
          <span
            style={{
              width: '5px',
              height: '5px',
              borderRadius: '50%',
              background: '#C9BFB2',
              animation: 'lcPulse 1.2s infinite',
              animationDelay: '0.2s',
            }}
          />
          <span
            style={{
              width: '5px',
              height: '5px',
              borderRadius: '50%',
              background: '#C9BFB2',
              animation: 'lcPulse 1.2s infinite',
              animationDelay: '0.4s',
            }}
          />
          <span
            style={{
              fontSize: '8px',
              color: '#8a7d6e',
              letterSpacing: '0.12em',
              marginLeft: '4px',
            }}
          >
            L&apos;agent compose votre look…
          </span>
        </div>
      )}

      {/* Loaded */}
      {state === 'loaded' && products.length > 0 && (
        <>
          {phrase && (
            <p
              style={{
                fontSize: '10px',
                color: '#555',
                lineHeight: 1.6,
                letterSpacing: '0.02em',
                marginBottom: '14px',
                fontStyle: 'italic',
              }}
            >
              {phrase}
            </p>
          )}
          <div
            style={{
              display: 'flex',
              gap: '8px',
              overflowX: 'auto',
              paddingBottom: '4px',
            }}
          >
            {products.map((p) => (
              <LookProductCard key={p.id} product={p} />
            ))}
          </div>
          <AddLookButton products={products} />
          <p
            style={{
              fontSize: '6px',
              color: '#aaa',
              letterSpacing: '0.08em',
              textAlign: 'center',
              marginTop: '6px',
            }}
          >
            Tailles modifiables dans le panier
          </p>
        </>
      )}

      {/* Error */}
      {state === 'error' && (
        <div>
          <p
            style={{
              fontSize: '9px',
              color: '#888',
              letterSpacing: '0.06em',
              marginBottom: '8px',
            }}
          >
            {errorMsg}
          </p>
          <button
            onClick={() => setState('idle')}
            style={{
              background: 'transparent',
              border: '1px solid #C9BFB2',
              color: '#8a7d6e',
              padding: '6px 14px',
              fontSize: '7px',
              letterSpacing: '0.14em',
              textTransform: 'uppercase',
              cursor: 'pointer',
              borderRadius: '2px',
            }}
          >
            Réessayer
          </button>
        </div>
      )}

      <style>{`
        @keyframes lcPulse {
          0%, 60%, 100% { opacity: 0.3; transform: scale(0.85); }
          30% { opacity: 1; transform: scale(1); }
        }
      `}</style>
    </div>
  );
}
```

- [ ] **Step 5: Vérifier que le fichier compile**

```bash
cd /Users/belamrani/Projets/demo-jacquemus && npx tsc --noEmit 2>&1 | head -20
```

Attendu : aucune nouvelle erreur.

- [ ] **Step 6: Commit**

```bash
git add app/components/LookComposer.tsx
git commit -m "feat: add LookComposer component with 3 UI states"
```

---

## Task 3: Intégration dans la PDP

**Files:**
- Modify: `app/routes/($locale).products.$handle.tsx`

- [ ] **Step 1: Ajouter `tags` et `productType` au fragment GraphQL**

Dans `PRODUCT_FRAGMENT`, ajouter les deux champs après `description` (ligne ~185) :

```graphql
const PRODUCT_FRAGMENT = `#graphql
  fragment Product on Product {
    id
    title
    vendor
    handle
    descriptionHtml
    description
    tags
    productType
    encodedVariantExistence
    ...
```

Les deux champs `tags` (String[]) et `productType` (String) sont des champs natifs Shopify, toujours disponibles sans modification du loader.

- [ ] **Step 2: Importer et intégrer `LookComposer` dans le composant `Product`**

En haut du fichier, ajouter l'import :

```typescript
import {LookComposer} from '~/components/LookComposer';
```

Dans la fonction `Product`, extraire `tags` et `productType` et ajouter `<LookComposer>` après `<ProductForm>` :

```typescript
export default function Product() {
  const {product} = useLoaderData<typeof loader>();
  const selectedVariant = useOptimisticVariant(
    product.selectedOrFirstAvailableVariant,
    getAdjacentAndFirstAvailableVariants(product),
  );
  useSelectedOptionInUrlParam(selectedVariant.selectedOptions);
  const productOptions = getProductOptions({
    ...product,
    selectedOrFirstAvailableVariant: selectedVariant,
  });

  const {title, descriptionHtml, tags, productType} = product;

  return (
    <div className="product">
      <ProductImage image={selectedVariant?.image} />
      <div className="product-main">
        <h1>{title}</h1>
        <ProductPrice
          price={selectedVariant?.price}
          compareAtPrice={selectedVariant?.compareAtPrice}
        />
        <br />
        <ProductForm
          productOptions={productOptions}
          selectedVariant={selectedVariant}
        />
        <LookComposer
          productTitle={title}
          tags={tags ?? []}
          productType={productType ?? ''}
        />
        <br />
        <p>
          <strong>Description</strong>
        </p>
        <br />
        <div dangerouslySetInnerHTML={{__html: descriptionHtml}} />
        <br />
      </div>
      <Analytics.ProductView
        data={{
          products: [
            {
              id: product.id,
              title: product.title,
              price: selectedVariant?.price.amount || '0',
              vendor: product.vendor,
              variantId: selectedVariant?.id || '',
              variantTitle: selectedVariant?.title || '',
              quantity: 1,
            },
          ],
        }}
      />
    </div>
  );
}
```

- [ ] **Step 3: Régénérer les types Storefront**

```bash
cd /Users/belamrani/Projets/demo-jacquemus && npx shopify hydrogen codegen 2>&1 | tail -5
```

Attendu : `Generated X types` sans erreur.

- [ ] **Step 4: Vérifier que tout compile**

```bash
cd /Users/belamrani/Projets/demo-jacquemus && npx tsc --noEmit 2>&1 | head -30
```

Attendu : aucune erreur.

- [ ] **Step 5: Lancer le dev server et tester manuellement**

```bash
cd /Users/belamrani/Projets/demo-jacquemus && npm run dev
```

Ouvrir une PDP (ex: `/products/le-bambino`). Vérifier :
1. Le panneau "Compose le look complet" apparaît sous le bouton "Ajouter au panier"
2. Clic sur "Voir les suggestions →" → état loading avec les 3 points animés
3. Après ~2s → cartes produits + phrase en italique
4. Clic "Ajouter le look entier" → le panier s'ouvre avec les pièces ajoutées
5. Si MCP ne retourne pas assez de résultats → message d'erreur + bouton "Réessayer"

- [ ] **Step 6: Commit final**

```bash
git add app/routes/\(\$locale\).products.\$handle.tsx
git commit -m "feat: wire LookComposer into PDP with tags and productType"
```
