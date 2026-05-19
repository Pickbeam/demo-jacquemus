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

  // Tags containing colons must be quoted in Shopify's query syntax
  if (f.category?.length) {
    parts.push(`(${f.category.map((c) => `tag:"category:${c}"`).join(' OR ')})`);
  }
  if (f.occasion?.length) {
    parts.push(`(${f.occasion.map((o) => `tag:"occasion:${o}"`).join(' OR ')})`);
  }
  if (f.mood?.length) {
    parts.push(`(${f.mood.map((m) => `tag:"mood:${m}"`).join(' OR ')})`);
  }
  if (f.price_max) {
    parts.push(`variants.price:<=${f.price_max}`);
  }
  if (payload.query) {
    parts.push(`title:*${payload.query}*`);
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

  const data = (await storefront.query(CATALOG_SEARCH_QUERY, {
    variables: {first: Math.min(limit, 20), query: shopifyQuery},
  })) as {
    products: {
      nodes: Array<{
        id: string;
        title: string;
        description: string;
        tags: string[];
        priceRange: {minVariantPrice: {amount: string; currencyCode: string}};
        images: {nodes: Array<{url: string; altText: string | null}>};
        variants: {
          nodes: Array<{
            id: string;
            title: string;
            price: {amount: string; currencyCode: string};
          }>;
        };
      }>;
    };
  };
  const {products} = data;

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
