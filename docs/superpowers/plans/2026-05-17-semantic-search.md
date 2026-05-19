# Semantic Search Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the /search page with an AI-powered semantic search that understands natural language queries in French/English, interprets user intent, and streams back relevant products.

**Architecture:** Two-part change — (1) `api.semantic-search.tsx` SSE action: Claude extracts keywords + interpretation from natural language, then queries Storefront API; (2) `($locale).search.tsx` gets a new client-side UI that calls this API and streams results in real time. The existing loader stays intact for backward compatibility.

**Tech Stack:** React Router v7, Hydrogen Storefront API, Anthropic SDK (claude-haiku-4-5-20251001), SSE streaming, CSS natif

---

## Fichiers

| Action | Chemin |
|---|---|
| Créer | `app/routes/api.semantic-search.tsx` |
| Modifier | `app/routes/($locale).search.tsx` |
| Modifier | `app/styles/app.css` |

---

## Task 1 : API SSE — semantic search endpoint

**Files:**
- Create: `app/routes/api.semantic-search.tsx`

- [ ] **Step 1 : Créer le fichier `app/routes/api.semantic-search.tsx`**

```typescript
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
  const {query} = (await request.json()) as {query: string};
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
        // 1. Claude parses natural language → structured params
        const parseMsg = await client.messages.create({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 120,
          system: PARSE_PROMPT,
          messages: [{role: 'user', content: query}],
        });

        const rawJson =
          parseMsg.content[0]?.type === 'text'
            ? parseMsg.content[0].text.trim()
            : '{}';

        let parsed: ParseResult = {};
        try {
          parsed = JSON.parse(rawJson) as ParseResult;
        } catch {
          parsed = {};
        }

        const interpretation = parsed.interpretation ?? '';
        const keywords = parsed.keywords ?? query;

        // 2. Send interpretation immediately so UI can show it before products arrive
        enq('interpretation', {text: interpretation});

        // 3. Build Shopify query string
        let shopifyQuery = keywords;
        if (parsed.price_max) shopifyQuery += ` variants.price:<=${parsed.price_max}`;

        // 4. Query Storefront API
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
cd /Users/belamrani/Projets/demo-jacquemus && npm run typecheck 2>&1 | tail -8
```

Attendu : `react-router typegen` tourne et crée `.react-router/types/app/routes/+types/api.semantic-search.ts`. Des erreurs TS sont normales à ce stade puisque la route utilise `Route.ActionArgs` avant que le fichier search soit mis à jour.

- [ ] **Step 3 : Vérifier que le fichier de types a été créé**

```bash
ls /Users/belamrani/Projets/demo-jacquemus/.react-router/types/app/routes/+types/api.semantic-search.ts
```

Attendu : le fichier existe.

---

## Task 2 : Page /search — nouvelle UI éditoriale

**Files:**
- Modify: `app/routes/($locale).search.tsx`

- [ ] **Step 1 : Remplacer le composant `SearchPage` par défaut**

Garder tout le fichier existant (loader, fragments GraphQL, fonctions regularSearch et predictiveSearch) mais remplacer uniquement le `export default function SearchPage()` et les imports qui s'y rapportent.

Ajouter en haut du fichier, après les imports existants :

```typescript
import {useState, useCallback} from 'react';
import {Link} from 'react-router';
```

Puis remplacer le bloc `export default function SearchPage()` par :

```tsx
interface SemanticProduct {
  id: string;
  title: string;
  handle: string;
  price: number;
  image: string;
}

export default function SearchPage() {
  const [query, setQuery] = useState('');
  const [state, setState] = useState<'idle' | 'loading' | 'loaded'>('idle');
  const [interpretation, setInterpretation] = useState('');
  const [products, setProducts] = useState<SemanticProduct[]>([]);

  const search = useCallback(async (q: string) => {
    if (!q.trim() || state === 'loading') return;
    setState('loading');
    setInterpretation('');
    setProducts([]);

    try {
      const res = await fetch('/api/semantic-search', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({query: q}),
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
            if (currentEvent === 'interpretation') {
              setInterpretation(String(data.text ?? ''));
            } else if (currentEvent === 'products') {
              setProducts((data.products as SemanticProduct[]) ?? []);
              setState('loaded');
            } else if (currentEvent === 'done') {
              setState((s) => (s === 'loading' ? 'loaded' : s));
            }
          }
        }
      }
    } catch {
      setState('loaded');
    }
  }, [state]);

  const hints = [
    'une robe pour un dîner au soleil',
    'un sac à offrir',
    'quelque chose de casual chic',
  ];

  return (
    <div className="search-ai">
      <div className="search-ai-hero">
        <p className="search-ai-label">Recherche</p>
        <div className="search-ai-input-row">
          <input
            className="search-ai-input"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') search(query);
            }}
            placeholder="Décrivez ce que vous recherchez…"
            autoFocus
          />
          <button
            className="search-ai-btn"
            onClick={() => search(query)}
            disabled={!query.trim() || state === 'loading'}
          >
            {state === 'loading' ? '···' : '→'}
          </button>
        </div>
        <div className="search-ai-hints">
          {hints.map((hint) => (
            <button
              key={hint}
              className="search-ai-hint"
              onClick={() => {
                setQuery(hint);
                search(hint);
              }}
            >
              « {hint} »
            </button>
          ))}
        </div>
      </div>

      {interpretation && (
        <p className="search-ai-interpretation">{interpretation}</p>
      )}

      {products.length > 0 && (
        <div className="search-ai-grid">
          {products.map((p) => (
            <Link
              key={p.id}
              to={`/products/${p.handle}`}
              className="search-ai-card"
              prefetch="intent"
            >
              <div className="search-ai-card-img">
                {p.image && <img src={p.image} alt={p.title} loading="lazy" />}
              </div>
              <p className="search-ai-card-title">
                {p.title.replace('Jacquemus ', '')}
              </p>
              {p.price > 0 && (
                <p className="search-ai-card-price">
                  {p.price.toLocaleString('fr-FR')} €
                </p>
              )}
            </Link>
          ))}
        </div>
      )}

      {state === 'loaded' && products.length === 0 && (
        <p className="search-ai-empty">Aucun résultat pour cette recherche.</p>
      )}
    </div>
  );
}
```

- [ ] **Step 2 : Vérifier la compilation TypeScript**

```bash
cd /Users/belamrani/Projets/demo-jacquemus && npx tsc --noEmit 2>&1 | grep "search" | head -10
```

Attendu : aucune erreur sur les fichiers search.

---

## Task 3 : CSS — styles de la page de recherche sémantique

**Files:**
- Modify: `app/styles/app.css`

- [ ] **Step 1 : Trouver la section `routes/search.tsx` dans app.css**

```bash
grep -n "search" /Users/belamrani/Projets/demo-jacquemus/app/styles/app.css | head -20
```

Identifier la ligne de début et de fin du bloc actuel de la section search.

- [ ] **Step 2 : Remplacer le bloc search existant**

Remplacer tout le contenu de la section `routes/search.tsx` (entre les commentaires de section) par :

```css
/*
* --------------------------------------------------
* routes/search.tsx
* --------------------------------------------------
*/
.search-ai {
  min-height: 100vh;
  background: #FDFAF6;
  padding: 80px 48px 120px;
}

@media (max-width: 45em) {
  .search-ai {
    padding: 60px 20px 80px;
  }
}

.search-ai-hero {
  max-width: 680px;
  margin: 0 auto 56px;
}

.search-ai-label {
  font-size: 7px;
  letter-spacing: 0.28em;
  text-transform: uppercase;
  color: #aaa;
  margin: 0 0 28px;
}

.search-ai-input-row {
  display: flex;
  gap: 12px;
  align-items: flex-end;
  margin-bottom: 18px;
  border-bottom: 1px solid #1a1a1a;
  padding-bottom: 8px;
}

.search-ai-input {
  flex: 1;
  background: transparent;
  border: none;
  padding: 0;
  font-size: clamp(22px, 3vw, 34px);
  font-weight: 300;
  color: #1a1a1a;
  letter-spacing: 0.02em;
  outline: none;
  font-family: inherit;
}

.search-ai-input::placeholder {
  color: #ddd;
}

.search-ai-btn {
  background: transparent;
  border: none;
  font-size: 28px;
  color: #1a1a1a;
  cursor: pointer;
  padding: 0 0 2px;
  line-height: 1;
  transition: opacity 0.2s;
  flex-shrink: 0;
}

.search-ai-btn:disabled {
  opacity: 0.25;
  cursor: default;
}

.search-ai-hints {
  display: flex;
  flex-wrap: wrap;
  gap: 6px 16px;
}

.search-ai-hint {
  background: transparent;
  border: none;
  font-size: 9px;
  color: #bbb;
  letter-spacing: 0.06em;
  cursor: pointer;
  padding: 0;
  transition: color 0.2s;
  font-style: italic;
  font-family: inherit;
}

.search-ai-hint:hover {
  color: #1a1a1a;
}

.search-ai-interpretation {
  max-width: 680px;
  margin: 0 auto 48px;
  font-size: 11px;
  color: #888;
  letter-spacing: 0.04em;
  font-style: italic;
  line-height: 1.7;
  padding-left: 18px;
  border-left: 2px solid #E8E3DC;
}

.search-ai-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 2px;
  max-width: 1400px;
  margin: 0 auto;
}

@media (max-width: 60em) {
  .search-ai-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}

.search-ai-card {
  display: block;
  text-decoration: none;
  color: inherit;
}

.search-ai-card-img {
  aspect-ratio: 3/4;
  overflow: hidden;
  background: #f0ede8;
  margin-bottom: 10px;
}

.search-ai-card-img img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
  transition: transform 0.4s ease;
}

.search-ai-card:hover .search-ai-card-img img {
  transform: scale(1.03);
}

.search-ai-card-title {
  font-size: 9px;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: #1a1a1a;
  margin: 0 0 3px;
}

.search-ai-card-price {
  font-size: 9px;
  color: #999;
  margin: 0;
}

.search-ai-empty {
  max-width: 680px;
  margin: 0 auto;
  font-size: 10px;
  color: #bbb;
  letter-spacing: 0.08em;
}
```

- [ ] **Step 3 : Vérifier la compilation TypeScript**

```bash
cd /Users/belamrani/Projets/demo-jacquemus && npx tsc --noEmit 2>&1 | grep -E "error|Error" | head -10
```

Attendu : aucune erreur.

- [ ] **Step 4 : Commit**

```bash
cd /Users/belamrani/Projets/demo-jacquemus && git add app/routes/api.semantic-search.tsx app/routes/\(\$locale\).search.tsx app/styles/app.css && git commit -m "feat: semantic search — Claude interprets natural language queries + streaming results"
```
