# Real Shopify Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace all mock product data with real Shopify products and enable working Add-to-Cart in the personal shopper for an end-to-end demo.

**Architecture:** Scrape jacquemus.com Shopify JSON endpoints → import products with inference tags via Admin API → Storefront API catalog search route → real variant IDs in personal shopper → real CartForm Add-to-Cart.

**Tech Stack:** Hydrogen 2026.4.2, React Router 7, Shopify Storefront API 2025-01, Shopify Admin REST API 2025-01, tsx (script runner), Node 22 native fetch.

---

## File Map

| Action | Path | Responsibility |
|--------|------|----------------|
| Create | `scripts/scrape-jacquemus.ts` | Fetch product JSON from jacquemus.com, output structured JSON |
| Create | `scripts/jacquemus-products.json` | Generated scrape output |
| Create | `scripts/import-to-shopify.ts` | Read JSON, create products via Admin REST API with inference tags |
| Create | `app/routes/api.catalog-search.tsx` | POST endpoint: query Storefront API with tag filters, return real products |
| Create | `app/lib/mcp-client.ts` | Real MCP client: calls `/api/catalog-search` instead of mock data |
| Modify | `app/routes/($locale).personal-shopper.tsx` | Loader fetches real products; ProductRef+variantId; real AddToCartButton; handleSend calls real search |
| Modify | `package.json` | Add `tsx` devDep + `scrape`/`import-products` scripts |
| Modify | `.env` | Add `SHOPIFY_ADMIN_API_TOKEN` |
| Delete | `app/lib/mock-jacquemus-data.ts` | Replaced by real Shopify data |
| Delete | `app/lib/mock-mcp-client.ts` | Replaced by `mcp-client.ts` |

---

## Task 1: Add `tsx` and npm scripts

**Files:**
- Modify: `package.json`
- Modify: `.env`

- [ ] **Step 1: Install tsx**

```bash
npm install --save-dev tsx
```

Expected: `tsx` added to `devDependencies` in `package.json`.

- [ ] **Step 2: Add npm scripts to `package.json`**

In the `"scripts"` object, add after `"codegen"`:

```json
"scrape": "tsx scripts/scrape-jacquemus.ts",
"import-products": "tsx scripts/import-to-shopify.ts"
```

- [ ] **Step 3: Add Admin API token placeholder to `.env`**

Append to `.env`:
```
SHOPIFY_ADMIN_API_TOKEN="shpat_REPLACE_WITH_REAL_TOKEN"
```

To get a real token: Shopify Admin → Settings → Apps and sales channels → Develop apps → Create app → Configure Admin API scopes: `write_products, read_products` → Install → copy Admin API access token.

- [ ] **Step 4: Create scripts directory**

```bash
mkdir -p scripts
```

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json .env
git commit -m "chore: add tsx runner and Admin API token placeholder"
```

---

## Task 2: Scraping script

Jacquemus.com runs on Shopify, which exposes a public JSON endpoint at `/collections/<handle>/products.json`. No HTML parsing needed.

**Files:**
- Create: `scripts/scrape-jacquemus.ts`

- [ ] **Step 1: Create `scripts/scrape-jacquemus.ts`**

```typescript
import {writeFileSync} from 'fs';

interface ShopifyVariant {
  id: number;
  price: string;
  option1: string | null; // size
}

interface ShopifyImage {
  src: string;
}

interface ShopifyProduct {
  id: number;
  title: string;
  body_html: string;
  product_type: string;
  tags: string;
  images: ShopifyImage[];
  variants: ShopifyVariant[];
}

interface ShopifyProductsResponse {
  products: ShopifyProduct[];
}

interface ScrapedProduct {
  title: string;
  description: string;
  price: number;
  currency: string;
  category: 'bag' | 'dress' | 'shoes';
  images: string[];
  sizes: string[];
  tags: string[];
}

const BASE = 'https://www.jacquemus.com';

const COLLECTIONS: Array<{handle: string; category: ScrapedProduct['category']}> = [
  {handle: 'bags', category: 'bag'},
  {handle: 'dresses', category: 'dress'},
  {handle: 'shoes', category: 'shoes'},
];

const INFERENCE_TAGS: Record<string, string[]> = {
  // Bags
  chiquito:  ['mood:chic', 'mood:minimalist', 'occasion:evening', 'occasion:day', 'season:all-season', 'style:mini'],
  bambino:   ['mood:chic', 'mood:romantic', 'occasion:wedding', 'occasion:day', 'season:spring', 'season:summer'],
  citron:    ['mood:playful', 'mood:summery', 'occasion:beach', 'occasion:vacation', 'season:summer', 'collection:saint-tropez-2024', 'collection:limited-edition'],
  banane:    ['mood:playful', 'mood:summery', 'occasion:beach', 'occasion:vacation', 'season:summer', 'collection:saint-tropez-2024', 'collection:limited-edition'],
  tomate:    ['mood:playful', 'mood:bold', 'occasion:cocktail', 'occasion:vacation', 'season:summer', 'collection:saint-tropez-2024', 'collection:limited-edition'],
  grand:     ['mood:minimalist', 'mood:versatile', 'occasion:everyday', 'occasion:office', 'season:all-season'],
  cabas:     ['mood:minimalist', 'occasion:everyday', 'season:all-season'],
  // Dresses
  bomba:     ['mood:romantic', 'mood:summery', 'occasion:wedding', 'occasion:garden_party', 'season:summer', 'material:linen', 'fit:loose'],
  souffle:   ['mood:sensual', 'mood:romantic', 'occasion:wedding', 'occasion:cocktail', 'season:summer', 'material:cotton'],
  riviera:   ['mood:sophisticated', 'mood:elegant', 'occasion:wedding', 'occasion:cocktail', 'season:summer', 'material:silk'],
  // Shoes
  pralu:     ['mood:playful', 'mood:summery', 'occasion:wedding', 'occasion:vacation', 'season:summer', 'style:platform'],
  classique: ['mood:minimalist', 'mood:chic', 'occasion:wedding', 'occasion:everyday', 'season:all-season', 'style:mule'],
  espadrille:['mood:summery', 'mood:casual', 'occasion:vacation', 'occasion:day', 'season:summer'],
};

function inferTags(title: string, category: ScrapedProduct['category']): string[] {
  const lower = title.toLowerCase().replace(/[^a-z0-9]/g, '');
  const tags: string[] = [`category:${category}`];

  for (const [key, keyTags] of Object.entries(INFERENCE_TAGS)) {
    if (lower.includes(key)) {
      tags.push(...keyTags);
      break;
    }
  }

  // Default tags if no specific match
  if (tags.length === 1) {
    if (category === 'bag') tags.push('mood:chic', 'occasion:day', 'season:all-season');
    if (category === 'dress') tags.push('mood:elegant', 'occasion:day', 'season:summer');
    if (category === 'shoes') tags.push('mood:chic', 'occasion:day', 'season:all-season');
  }

  return [...new Set(tags)];
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

async function fetchCollection(handle: string): Promise<ShopifyProduct[]> {
  const url = `${BASE}/collections/${handle}/products.json?limit=50`;
  console.log(`Fetching ${url}...`);

  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
      Accept: 'application/json',
    },
  });

  if (!res.ok) {
    console.warn(`  ⚠ ${handle}: HTTP ${res.status} — skipping`);
    return [];
  }

  const data = (await res.json()) as ShopifyProductsResponse;
  console.log(`  ✓ ${data.products.length} products`);
  return data.products;
}

async function main() {
  const allProducts: ScrapedProduct[] = [];

  for (const {handle, category} of COLLECTIONS) {
    const products = await fetchCollection(handle);

    for (const p of products) {
      const price = parseFloat(p.variants[0]?.price ?? '0');
      const sizes = p.variants
        .map((v) => v.option1)
        .filter((s): s is string => s !== null && s !== 'Default Title');

      allProducts.push({
        title: p.title,
        description: stripHtml(p.body_html).slice(0, 200),
        price,
        currency: 'EUR',
        category,
        images: p.images.map((i) => i.src).slice(0, 3),
        sizes,
        tags: inferTags(p.title, category),
      });
    }
  }

  writeFileSync('scripts/jacquemus-products.json', JSON.stringify(allProducts, null, 2));
  console.log(`\n✓ Wrote ${allProducts.length} products to scripts/jacquemus-products.json`);
}

main().catch(console.error);
```

- [ ] **Step 2: Run the scraper**

```bash
npm run scrape
```

Expected output:
```
Fetching https://www.jacquemus.com/collections/bags/products.json?limit=50...
  ✓ N products
Fetching https://www.jacquemus.com/collections/dresses/products.json?limit=50...
  ✓ N products
Fetching https://www.jacquemus.com/collections/shoes/products.json?limit=50...
  ✓ N products

✓ Wrote N products to scripts/jacquemus-products.json
```

If you get HTTP 403 or 404 (Jacquemus may use custom collection handles), try these alternative handles:
```
/collections/sacs → bags
/collections/robes → dresses
/collections/chaussures → shoes
/collections/all → everything
```
Update `COLLECTIONS` in the script accordingly.

- [ ] **Step 3: Verify the JSON**

```bash
node -e "const p = require('./scripts/jacquemus-products.json'); console.log(p.length, 'products'); console.log(JSON.stringify(p[0], null, 2))"
```

Expected: 10+ products, each with `title`, `price`, `images[0]`, `tags` containing `category:bag` etc.

- [ ] **Step 4: Commit**

```bash
git add scripts/scrape-jacquemus.ts scripts/jacquemus-products.json
git commit -m "feat: add Jacquemus scraping script + product JSON"
```

---

## Task 3: Import script

**Files:**
- Create: `scripts/import-to-shopify.ts`

- [ ] **Step 1: Create `scripts/import-to-shopify.ts`**

```typescript
import {readFileSync} from 'fs';

const STORE_DOMAIN = 'demo-jacquemus.myshopify.com';
const ADMIN_TOKEN = process.env.SHOPIFY_ADMIN_API_TOKEN!;
const API_VERSION = '2025-01';
const BASE_URL = `https://${STORE_DOMAIN}/admin/api/${API_VERSION}`;

if (!ADMIN_TOKEN || ADMIN_TOKEN.startsWith('shpat_REPLACE')) {
  console.error('Error: set SHOPIFY_ADMIN_API_TOKEN in .env');
  process.exit(1);
}

interface ScrapedProduct {
  title: string;
  description: string;
  price: number;
  currency: string;
  category: string;
  images: string[];
  sizes: string[];
  tags: string[];
}

interface ShopifyProductPayload {
  product: {
    title: string;
    body_html: string;
    vendor: string;
    product_type: string;
    tags: string;
    images: Array<{src: string}>;
    variants: Array<{price: string; option1?: string; requires_shipping: boolean}>;
    options?: Array<{name: string; values: string[]}>;
  };
}

async function getExistingTitles(): Promise<Set<string>> {
  const res = await fetch(`${BASE_URL}/products.json?limit=250&fields=title`, {
    headers: {'X-Shopify-Access-Token': ADMIN_TOKEN},
  });
  const data = (await res.json()) as {products: Array<{title: string}>};
  return new Set(data.products.map((p) => p.title));
}

async function createProduct(product: ScrapedProduct): Promise<string> {
  const hasSizes = product.sizes.length > 0;

  const payload: ShopifyProductPayload = {
    product: {
      title: product.title,
      body_html: `<p>${product.description}</p>`,
      vendor: 'Jacquemus',
      product_type: product.category,
      tags: product.tags.join(', '),
      images: product.images.slice(0, 1).map((src) => ({src})),
      variants: hasSizes
        ? product.sizes.map((size) => ({
            price: product.price.toFixed(2),
            option1: size,
            requires_shipping: true,
          }))
        : [{price: product.price.toFixed(2), requires_shipping: true}],
      options: hasSizes ? [{name: 'Size', values: product.sizes}] : undefined,
    },
  };

  const res = await fetch(`${BASE_URL}/products.json`, {
    method: 'POST',
    headers: {
      'X-Shopify-Access-Token': ADMIN_TOKEN,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`HTTP ${res.status}: ${err}`);
  }

  const data = (await res.json()) as {product: {id: number; title: string}};
  return `gid://shopify/Product/${data.product.id}`;
}

async function main() {
  const products: ScrapedProduct[] = JSON.parse(
    readFileSync('scripts/jacquemus-products.json', 'utf-8'),
  );

  console.log(`Checking existing products in ${STORE_DOMAIN}...`);
  const existingTitles = await getExistingTitles();
  console.log(`  ${existingTitles.size} products already in store`);

  let created = 0;
  let skipped = 0;

  for (const product of products) {
    if (existingTitles.has(product.title)) {
      console.log(`  ⟳ skip "${product.title}" (already exists)`);
      skipped++;
      continue;
    }

    try {
      const gid = await createProduct(product);
      console.log(`  ✓ "${product.title}" → ${gid}`);
      created++;
      // Shopify rate limit: 2 req/s on Basic
      await new Promise((r) => setTimeout(r, 600));
    } catch (e) {
      console.error(`  ✗ "${product.title}": ${e}`);
    }
  }

  console.log(`\nDone: ${created} created, ${skipped} skipped`);
}

main().catch(console.error);
```

- [ ] **Step 2: Set real Admin API token in `.env`**

Replace `shpat_REPLACE_WITH_REAL_TOKEN` with your actual token:
```
SHOPIFY_ADMIN_API_TOKEN="shpat_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
```

- [ ] **Step 3: Run the import**

```bash
npm run import-products
```

Expected:
```
Checking existing products in demo-jacquemus.myshopify.com...
  0 products already in store
  ✓ "Le Chiquito" → gid://shopify/Product/123456789
  ✓ "Le Citron" → gid://shopify/Product/123456790
  ...
Done: N created, 0 skipped
```

- [ ] **Step 4: Verify in Shopify Admin**

Open `https://demo-jacquemus.myshopify.com/admin/products` — confirm products appear with images, prices, and tags like `category:bag`.

- [ ] **Step 5: Commit script (not the token)**

```bash
git add scripts/import-to-shopify.ts
git commit -m "feat: add Shopify product import script"
```

---

## Task 4: Catalog search API route

**Files:**
- Create: `app/routes/api.catalog-search.tsx`

The route accepts POST requests and queries the Shopify Storefront API with tag-based filters. No UI — pure JSON endpoint.

- [ ] **Step 1: Create `app/routes/api.catalog-search.tsx`**

```typescript
import type {Route} from './+types/api.catalog-search';

export interface CatalogSearchPayload {
  query: string;
  filters?: {
    category?: string[];
    occasion?: string[];
    mood?: string[];
    price_max?: number;
    size?: string;
  };
  limit?: number;
}

export interface CatalogProduct {
  id: string;
  title: string;
  price: number;
  image: string;
  description: string;
  variantId: string;
  tags: string[];
}

function buildShopifyQuery(payload: CatalogSearchPayload): string {
  const parts: string[] = [];
  const f = payload.filters ?? {};

  if (f.category?.length) {
    parts.push(f.category.map((c) => `tag:category:${c}`).join(' OR '));
  }
  if (f.occasion?.length) {
    parts.push(`(${f.occasion.map((o) => `tag:occasion:${o}`).join(' OR ')})`);
  }
  if (f.mood?.length) {
    parts.push(`(${f.mood.map((m) => `tag:mood:${m}`).join(' OR ')})`);
  }
  if (f.price_max) {
    parts.push(`variants.price:<=${f.price_max}`);
  }
  // Free-text search
  if (payload.query) {
    parts.push(`title:*${payload.query}* OR tag:*${payload.query.split(' ')[0]}*`);
  }

  return parts.join(' AND ') || 'available_for_sale:true';
}

const CATALOG_SEARCH_QUERY = `#graphql
  query CatalogSearch($first: Int!, $query: String!) {
    products(first: $first, query: $query) {
      nodes {
        id
        title
        description
        tags
        priceRange {
          minVariantPrice {
            amount
            currencyCode
          }
        }
        images(first: 1) {
          nodes {
            url
            altText
          }
        }
        variants(first: 5) {
          nodes {
            id
            title
            price {
              amount
              currencyCode
            }
          }
        }
      }
    }
  }
` as const;

export async function action({request, context}: Route.ActionArgs) {
  const payload = (await request.json()) as CatalogSearchPayload;
  const {storefront} = context;

  const shopifyQuery = buildShopifyQuery(payload);
  const limit = payload.limit ?? 6;

  const {products} = await storefront.query(CATALOG_SEARCH_QUERY, {
    variables: {first: Math.min(limit, 20), query: shopifyQuery},
  });

  const result: CatalogProduct[] = products.nodes.map((p) => ({
    id: p.id,
    title: p.title,
    description: p.description,
    price: parseFloat(p.priceRange.minVariantPrice.amount),
    image: p.images.nodes[0]?.url ?? '',
    variantId: p.variants.nodes[0]?.id ?? '',
    tags: p.tags,
  }));

  return Response.json({products: result});
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npm run typecheck 2>&1 | head -30
```

Expected: no errors in `api.catalog-search.tsx`. (There may be pre-existing errors in other files — ignore those.)

- [ ] **Step 3: Test the route manually**

Start the dev server in one terminal:
```bash
npm run dev
```

In another terminal:
```bash
curl -s -X POST http://localhost:3000/api/catalog-search \
  -H "Content-Type: application/json" \
  -d '{"query":"sac","filters":{"category":["bag"]},"limit":3}' | node -e "const d=require('fs').readFileSync('/dev/stdin','utf-8'); const p=JSON.parse(d); console.log(p.products?.length, 'products'); console.log(p.products?.[0])"
```

Expected: 1-3 products with `id`, `title`, `price`, `variantId` fields populated.

- [ ] **Step 4: Commit**

```bash
git add app/routes/api.catalog-search.tsx
git commit -m "feat: add catalog search API route backed by Storefront API"
```

---

## Task 5: Real MCP client

**Files:**
- Create: `app/lib/mcp-client.ts`

Same interface as `mock-mcp-client.ts` so the personal-shopper import change is minimal.

- [ ] **Step 1: Create `app/lib/mcp-client.ts`**

```typescript
import type {CatalogProduct, CatalogSearchPayload} from '~/routes/api.catalog-search';

export interface MCPLogEntry {
  timestamp: string;
  direction: 'request' | 'response';
  method: string;
  payload: unknown;
  statusCode?: number;
  durationMs?: number;
}

export type {CatalogProduct as MCPProduct};

function getTimestamp(): string {
  return new Date().toLocaleTimeString('fr-FR', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

export async function searchShopCatalog(
  payload: CatalogSearchPayload,
  onLog?: (entry: MCPLogEntry) => void,
): Promise<CatalogProduct[]> {
  const startTime = Date.now();

  onLog?.({
    timestamp: getTimestamp(),
    direction: 'request',
    method: 'search_shop_catalog',
    payload,
  });

  const res = await fetch('/api/catalog-search', {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify(payload),
  });

  const data = (await res.json()) as {products: CatalogProduct[]};

  onLog?.({
    timestamp: getTimestamp(),
    direction: 'response',
    method: 'search_shop_catalog',
    payload: {count: data.products.length, products: data.products},
    statusCode: res.status,
    durationMs: Date.now() - startTime,
  });

  return data.products;
}
```

- [ ] **Step 2: Commit**

```bash
git add app/lib/mcp-client.ts
git commit -m "feat: add real MCP client backed by /api/catalog-search"
```

---

## Task 6: Update personal-shopper — loader, ProductRef, ProductCard, real search

This is the largest change. Four sub-parts:
1. Loader fetches real products from Storefront API
2. `ProductRef` interface gets `variantId`
3. `getProduct` looks up by title from loaded products
4. `handleSend` calls real `/api/catalog-search`
5. `ProductCard` uses `AddToCartButton`

**Files:**
- Modify: `app/routes/($locale).personal-shopper.tsx`

- [ ] **Step 1: Add imports at top of personal-shopper.tsx**

Replace the current top of the file (lines 1-11):

```typescript
import {useState, useEffect, useRef, useCallback, useMemo} from 'react';
import type {MetaFunction} from 'react-router';
import {useLoaderData} from 'react-router';
import type {Route} from './+types/($locale).personal-shopper';
import {AddToCartButton} from '~/components/AddToCartButton';
import {searchShopCatalog} from '~/lib/mcp-client';
import type {CatalogProduct} from '~/routes/api.catalog-search';
```

- [ ] **Step 2: Add Storefront query constant (paste after the imports)**

```typescript
const PERSONAL_SHOPPER_PRODUCTS_QUERY = `#graphql
  query PersonalShopperProducts($first: Int!) {
    products(first: $first) {
      nodes {
        id
        title
        description
        tags
        priceRange {
          minVariantPrice { amount currencyCode }
        }
        images(first: 1) {
          nodes { url }
        }
        variants(first: 1) {
          nodes { id }
        }
      }
    }
  }
` as const;
```

- [ ] **Step 3: Replace the `loader` function**

Replace the existing `loader` (currently lines 9-11):

```typescript
export async function loader({context}: Route.LoaderArgs) {
  const {products} = await context.storefront.query(
    PERSONAL_SHOPPER_PRODUCTS_QUERY,
    {variables: {first: 20}},
  );

  return {
    products: products.nodes.map((p) => ({
      id: p.id,
      title: p.title,
      price: parseFloat(p.priceRange.minVariantPrice.amount),
      image: p.images.nodes[0]?.url ?? '',
      description: p.description,
      variantId: p.variants.nodes[0]?.id ?? '',
    })),
  };
}
```

- [ ] **Step 4: Update `ProductRef` interface — add `variantId`**

Find the `interface ProductRef` block (around line 14) and add `variantId`:

```typescript
interface ProductRef {
  id: string;
  title: string;
  price: number;
  image: string;
  description: string;
  variantId: string;
  contextNote?: string;
}
```

- [ ] **Step 5: Replace module-level `getProduct` with a factory inside the component**

Remove the current module-level `getProduct` function (currently lines 62-65) — it will be replaced by a closure inside the component.

Also remove the `import {MOCK_PRODUCTS} from '~/lib/mock-jacquemus-data'` line.

- [ ] **Step 6: Convert SCRIPTS to a `buildScripts` function**

After the SCRIPTS constant declaration, replace it entirely with a function. The product title references replace the fake GIDs. Full replacement:

```typescript
function buildScripts(
  gp: (title: string) => ProductRef,
): Record<string, QuickPromptScript> {
  return {
    mariage: {
      label: 'Tenue pour un mariage en Provence en juin, budget 800€, je fais du 36',
      userMessage: 'Tenue pour un mariage en Provence en juin, budget 800€, je fais du 36',
      flowEntries: [
        {delay: 0, direction: '▸', label: 'User input received', detail: '"Tenue pour un mariage en Provence en juin, budget 800€, je fais du 36"'},
        {delay: 350, direction: '▸', label: 'Calling Storefront MCP', detail: `POST /api/catalog-search\nMethod: search_shop_catalog\n\nPayload:\n{\n  "query": "wedding outfit Provence June summer",\n  "filters": {\n    "size": "36",\n    "price_max": 800,\n    "category": ["dress", "shoes", "bag"],\n    "occasion": ["wedding", "garden_party"]\n  }\n}`},
        {delay: 1500, direction: '◂', label: 'MCP Response (200 OK)', detail: `6 products returned with inference tags\nDuration: real Storefront API latency`},
        {delay: 1900, direction: '▸', label: 'Calling Claude API — outfit composition', detail: 'Building 3 complete looks from 6 candidate products\nContext: Provence wedding, June, size 36, budget €800'},
        {delay: 3600, direction: '◂', label: 'Claude response', detail: '3 outfit compositions generated\n\n· Look A — La Romantique      770€\n· Look B — L\'Esprit Libre      670€\n· Look C — La Moderne          770€'},
        {delay: 3800, direction: '▸', label: 'Rendering UI', detail: 'ProductCards injected into chat thread'},
      ],
      agentResponseDelay: 4200,
      agentContent: "J'ai analysé votre demande et sélectionné **3 looks** parfaits pour un mariage en Provence en juin. Chaque ensemble respecte votre budget de 800€ et est disponible en taille 36.",
      looks: [
        {name: 'Look A — La Romantique', description: "Robe fluide et sac naturel — l'alliance parfaite pour un mariage en plein air provençal.", items: [gp('La Bomba'), gp('Le Bambino Large')], total: 770},
        {name: "Look B — L'Esprit Libre", description: 'Mini-robe épaules dénudées et sandales plateformes pour une silhouette décontractée-chic.', items: [gp('Le Souffle'), gp('Les Pralu')], total: 670},
        {name: 'Look C — La Moderne', description: 'Combinaison wide-leg en soie et mules carrées — élégance contemporaine.', items: [gp('La Riviera'), gp('Les Classiques')], total: 770},
      ],
    },

    fruits: {
      label: 'Le truc avec les fruits de la pop-up Saint-Tropez',
      userMessage: 'Le truc avec les fruits de la pop-up Saint-Tropez',
      flowEntries: [
        {delay: 0, direction: '▸', label: 'User input received', detail: '"Le truc avec les fruits de la pop-up Saint-Tropez"'},
        {delay: 350, direction: '▸', label: 'Calling Storefront MCP', detail: `POST /api/catalog-search\nMethod: search_shop_catalog\n\nPayload:\n{\n  "query": "fruits pop-up Saint-Tropez 2024",\n  "filters": {\n    "collection": ["saint-tropez-2024", "limited-edition"]\n  }\n}`},
        {delay: 700, direction: '▸', label: 'Semantic intent matching', detail: 'Inference engine activé\nQuery intent: "pop-up tropez fruits"\n→ Collection tag: "saint-tropez-2024"\n→ Expanding to: Le Citron, Le Banane, Le Tomate'},
        {delay: 1500, direction: '◂', label: 'MCP Response (200 OK)', detail: `3 products — Collection: Pop-Up Saint-Tropez 2024\n\n{\n  "collection_context": {\n    "event": "Pop-Up Saint-Tropez",\n    "year": 2024,\n    "theme": "Mediterranean Fruits",\n    "availability": "limited-edition",\n    "pieces": ["Le Citron", "Le Banane", "Le Tomate"]\n  }\n}`},
        {delay: 1800, direction: '▸', label: 'Rendering UI', detail: 'Collection context cards ready'},
      ],
      agentResponseDelay: 2200,
      agentContent: "Vous cherchez les pièces **fruits** de la pop-up Saint-Tropez 2024 ! Ces 3 bags iconiques de la collection méditerranée sont des éditions limitées très demandées.",
      products: [
        {...gp('Le Citron'), contextNote: 'Le plus ensoleillé — sold-out en ligne'},
        {...gp('Le Banane'), contextNote: 'Mini format — parfait en clutch'},
        {...gp('Le Tomate'), contextNote: 'Le statement piece de la collection'},
      ],
      contextNote: '✦ Pièces iconiques — Pop-Up Saint-Tropez 2024',
    },

    sac: {
      label: 'Un sac qui va avec une robe noire pour le soir',
      userMessage: 'Un sac qui va avec une robe noire pour le soir',
      flowEntries: [
        {delay: 0, direction: '▸', label: 'User input received', detail: '"Un sac qui va avec une robe noire pour le soir"'},
        {delay: 350, direction: '▸', label: 'Calling Storefront MCP', detail: `POST /api/catalog-search\nMethod: search_shop_catalog\n\nPayload:\n{\n  "query": "bag black evening",\n  "filters": {\n    "category": ["bag"],\n    "occasion": ["evening", "cocktail"],\n    "mood": ["glamorous", "chic", "elegant"]\n  }\n}`},
        {delay: 1200, direction: '◂', label: 'MCP Response (200 OK)', detail: '3 products matched — evening bags'},
        {delay: 1600, direction: '▸', label: 'Rendering UI', detail: 'ProductCards injected'},
      ],
      agentResponseDelay: 2000,
      agentContent: "Pour une robe noire en soirée, voici **3 sacs iconiques** Jacquemus qui sublimeront votre tenue.",
      products: [
        {...gp('Le Bambino Noir Verni'), contextNote: 'Le verni capte la lumière — idéal pour les soirées'},
        {...gp('Le Chiquito Noir'), contextNote: 'La silhouette mini pour les soirées épurées'},
        {...gp('Le Cabas Noir'), contextNote: 'Le grand format si vous voyagez léger toute la soirée'},
      ],
    },
  };
}
```

- [ ] **Step 7: Add `useLoaderData` and `buildScripts` usage inside `PersonalShopperPage`**

In `export default function PersonalShopperPage()` (around line 610), add after the `useState` declarations and before the `useRef` calls:

```typescript
const {products} = useLoaderData<typeof loader>();

const gp = useCallback(
  (title: string): ProductRef => {
    const found = products.find((p) => p.title === title);
    return found ?? {id: 'placeholder', title, price: 0, image: '', description: '', variantId: ''};
  },
  [products],
);

const SCRIPTS = useMemo(() => buildScripts(gp), [gp]);
```

- [ ] **Step 8: Update `handleSend` to call real search**

Replace the current `handleSend` implementation (lines 704-739) with a version that calls the real search API:

```typescript
const handleSend = useCallback(async () => {
  if (!input.trim() || activePrompt) return;
  const query = input.trim();
  const userMsg: Message = {
    id: `user-${Date.now()}`,
    role: 'user',
    content: query,
    timestamp: new Date(),
  };
  setMessages((prev) => [...prev, userMsg]);
  setInput('');
  setIsTyping(true);
  setFlowLog([]);

  try {
    const results = await searchShopCatalog(
      {query, limit: 4},
      (entry) => {
        // addFlowEntry adds id internally — do not pass id here
        addFlowEntry({
          timestamp: entry.timestamp,
          direction: entry.direction === 'request' ? '▸' : '◂',
          label: entry.direction === 'request' ? 'Calling Storefront MCP' : 'MCP Response (200 OK)',
          detail: JSON.stringify(entry.payload, null, 2).slice(0, 400),
        });
      },
    );

    setIsTyping(false);

    if (results.length === 0) {
      setMessages((prev) => [
        ...prev,
        {id: `agent-${Date.now()}`, role: 'agent', content: 'Aucun produit trouvé pour cette recherche. Essayez un autre terme.', timestamp: new Date()},
      ]);
      return;
    }

    const productRefs: ProductRef[] = results.map((r) => ({
      id: r.id,
      title: r.title,
      price: r.price,
      image: r.image,
      description: r.description,
      variantId: r.variantId,
    }));

    setMessages((prev) => [
      ...prev,
      {
        id: `agent-${Date.now()}`,
        role: 'agent',
        content: `J'ai trouvé **${results.length} produit${results.length > 1 ? 's' : ''}** correspondant à votre recherche.`,
        products: productRefs,
        timestamp: new Date(),
      },
    ]);
  } catch {
    setIsTyping(false);
    setMessages((prev) => [
      ...prev,
      {id: `agent-${Date.now()}`, role: 'agent', content: 'Erreur lors de la recherche. Veuillez réessayer.', timestamp: new Date()},
    ]);
  }
}, [input, activePrompt, addFlowEntry]);
```

- [ ] **Step 9: Replace disabled Add to Cart button in `ProductCard`**

Find the `<button disabled ...>Add to Cart</button>` block in `ProductCard` (around lines 394-411) and replace with:

```tsx
<AddToCartButton
  lines={[{merchandiseId: product.variantId, quantity: 1}]}
  disabled={!product.variantId}
>
  <span style={{
    display: 'block',
    padding: '6px 12px',
    background: product.variantId ? '#1A1A1A' : '#ccc',
    color: '#fff',
    fontSize: '10px',
    letterSpacing: '0.1em',
    textTransform: 'uppercase' as const,
    cursor: product.variantId ? 'pointer' : 'not-allowed',
  }}>
    ADD TO CART
  </span>
</AddToCartButton>
```

- [ ] **Step 10: Verify TypeScript**

```bash
npm run typecheck 2>&1 | grep "personal-shopper\|mcp-client\|catalog-search"
```

Expected: no errors in those three files.

- [ ] **Step 11: Commit**

```bash
git add app/routes/\(\$locale\).personal-shopper.tsx app/lib/mcp-client.ts
git commit -m "feat: connect personal shopper to real Shopify catalog with working Add to Cart"
```

---

## Task 7: Cleanup and end-to-end test

**Files:**
- Delete: `app/lib/mock-jacquemus-data.ts`
- Delete: `app/lib/mock-mcp-client.ts`

- [ ] **Step 1: Delete mock files**

```bash
rm app/lib/mock-jacquemus-data.ts app/lib/mock-mcp-client.ts
```

- [ ] **Step 2: Verify no remaining imports**

```bash
grep -r "mock-jacquemus-data\|mock-mcp-client" app/
```

Expected: no output.

- [ ] **Step 3: Full typecheck**

```bash
npm run typecheck 2>&1 | head -30
```

Expected: no errors.

- [ ] **Step 4: End-to-end test in browser**

With `npm run dev` running, open `http://localhost:3000/personal-shopper`.

Test the golden path:
1. Click "Le truc avec les fruits de la pop-up Saint-Tropez" quick-prompt → verify 3 real product cards appear with real images
2. Click "ADD TO CART" on "Le Citron" → verify cart slide-out appears with the product
3. Click "Tenue pour un mariage en Provence" quick-prompt → verify 3 look cards appear with real products
4. Click "ADD TO CART" on a look item → verify cart updates
5. Type a free-form query (e.g. "sac noir") → verify real search results appear with working Add to Cart

- [ ] **Step 5: Verify cart checkout flow**

From the cart slide-out, click "Checkout" → verify redirect to Shopify checkout with real product.

- [ ] **Step 6: Commit cleanup**

```bash
git add -A
git commit -m "chore: remove mock data files, real Shopify integration complete"
```

---

## Environment Variables Summary

| Variable | Value | Where |
|---|---|---|
| `SESSION_SECRET` | `foobar` | `.env` (already set) |
| `PUBLIC_STORE_DOMAIN` | `demo-jacquemus.myshopify.com` | `.env` (already set) |
| `PUBLIC_STOREFRONT_API_TOKEN` | `ebb8548a...` | `.env` (already set) |
| `PUBLIC_STOREFRONT_API_VERSION` | `2025-01` | `.env` (already set) |
| `SHOPIFY_ADMIN_API_TOKEN` | `shpat_xxx` | `.env` (add in Task 1) |

> **Security note:** `.env` is gitignored by Hydrogen by default. Never commit the Admin API token.
