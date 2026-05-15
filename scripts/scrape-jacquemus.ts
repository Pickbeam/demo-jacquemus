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
