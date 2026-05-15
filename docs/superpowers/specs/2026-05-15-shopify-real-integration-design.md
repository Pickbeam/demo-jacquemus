# Shopify Real Integration — Design Spec

**Date:** 2026-05-15  
**Status:** Approved  
**Goal:** Replace mock product data with real Shopify products for an end-to-end demo (personal shopper → real catalog search → real add-to-cart → real checkout).

---

## Context

The app is a Shopify Hydrogen storefront connected to `demo-jacquemus.myshopify.com`. The personal shopper (`/personal-shopper`) currently uses hard-coded mock products with fake IDs (`gid://shopify/Product/001`). The "Add to Cart" button is disabled. The mock MCP client simulates catalog search locally.

The store has no Jacquemus products yet. The user will scrape jacquemus.com (bags, dresses, shoes) and import them into the Shopify store.

---

## Architecture

```
jacquemus.com → scrape-jacquemus.ts → jacquemus-products.json
                                             ↓
                               import-to-shopify.ts (Admin API)
                                             ↓
                            Shopify store (products + tags)
                                             ↓
                         /api/catalog-search (Storefront API)
                                             ↓
                    mcp-client.ts → personal shopper → Add to Cart
```

---

## Section 1 — Scraping & Import

### Script `scripts/scrape-jacquemus.ts`

- Scrapes jacquemus.com: bags section, dresses section, shoes section
- Extracts per product: `title`, `price`, `currency`, `description`, `images[]`, `category`, `collection`
- Auto-generates inference tags from title/description keywords:
  - `category:bag` / `category:dress` / `category:shoes`
  - `mood:chic`, `mood:romantic`, `mood:minimal`, etc.
  - `occasion:evening`, `occasion:wedding`, `occasion:day`, etc.
  - `season:summer`, `season:all-season`, etc.
- Output: `scripts/jacquemus-products.json`

### Script `scripts/import-to-shopify.ts`

- Reads `jacquemus-products.json`
- Creates products via Shopify Admin API GraphQL (`productCreate` mutation)
- Creates one default variant per product (or one per size if sizes detected)
- Applies all inference tags plus Shopify-standard tags
- Requires `SHOPIFY_ADMIN_API_TOKEN` in `.env`
- Skips products already imported (idempotent by title match)

### Tag schema

```
category:bag | category:dress | category:shoes
mood:chic | mood:romantic | mood:minimal | mood:summery | mood:elegant
occasion:wedding | occasion:evening | occasion:day | occasion:cocktail
season:summer | season:spring | season:all-season | season:fall
material:leather | material:linen | material:silk
color:black | color:nude | color:white | color:yellow
```

---

## Section 2 — Catalog Search API Route

### `app/routes/api.catalog-search.tsx`

- **Method:** POST
- **Request body:**
  ```ts
  {
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
  ```
- Builds a Shopify Storefront API query string from filters:
  ```
  tag:category:bag tag:occasion:wedding price:<800
  ```
- Queries `products` via Storefront GraphQL, requests: `id`, `title`, `priceRange`, `images(first:1)`, `variants(first:1)` (for `variantId`), `tags`
- Reconstructs `inference_attributes` from product tags server-side
- Returns:
  ```ts
  {
    products: Array<{
      id: string;
      title: string;
      price: number;
      image: string;
      description: string;
      variantId: string;       // real Shopify variantId
      inference_attributes: InferenceAttributes;
    }>
  }
  ```

### `app/lib/mcp-client.ts` (replaces `mock-mcp-client.ts`)

- Same `searchShopCatalog(payload, onLog?)` interface — no changes needed in personal shopper
- Calls `fetch('/api/catalog-search', { method: 'POST', body: JSON.stringify(payload) })` instead of querying mock data
- Fake network delay removed (real latency from Storefront API)
- Log entries updated to reflect real HTTP calls

---

## Section 3 — Real Add to Cart

### `ProductRef` interface

Extended with `variantId`:
```ts
interface ProductRef {
  id: string;
  title: string;
  price: number;
  image: string;
  description: string;
  variantId: string;   // added
  contextNote?: string;
}
```

### `ProductCard` component (in personal-shopper route)

Replaces the disabled button with `AddToCartButton`:
```tsx
<AddToCartButton
  lines={[{ merchandiseId: product.variantId, quantity: 1 }]}
>
  ADD TO CART
</AddToCartButton>
```

The existing Hydrogen cart infrastructure (`/cart` route, `CartMain`, cart aside) handles the rest automatically.

### Scripts in QUICK_PROMPT

The hard-coded product references in the quick-prompt scripts (`getProduct('gid://shopify/Product/001')`) will be replaced with references to real imported products (by title lookup or real IDs once known post-import).

---

## Implementation Order

1. `scripts/scrape-jacquemus.ts` + run scrape → `jacquemus-products.json`
2. Add `SHOPIFY_ADMIN_API_TOKEN` to `.env`
3. `scripts/import-to-shopify.ts` + run import
4. `app/routes/api.catalog-search.tsx`
5. `app/lib/mcp-client.ts` (replace mock)
6. Extend `ProductRef` with `variantId`, update `ProductCard` to use `AddToCartButton`
7. Update quick-prompt scripts with real product IDs
8. End-to-end test: personal shopper → search → add to cart → cart slide-out

---

## Environment Variables

| Variable | Purpose |
|---|---|
| `PUBLIC_STORE_DOMAIN` | Already set: `demo-jacquemus.myshopify.com` |
| `PUBLIC_STOREFRONT_API_TOKEN` | Already set |
| `SHOPIFY_ADMIN_API_TOKEN` | New: needed for product import script only |

---

## Out of Scope

- AI-powered query parsing (personal shopper stays scripted for demo)
- Size/variant selection UI (one default variant per product)
- Inventory tracking / sold-out states (beyond current mock)
