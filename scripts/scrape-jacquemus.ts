import {writeFileSync} from 'fs';

const FIRECRAWL_API_KEY = process.env.FIRECRAWL_API_KEY ?? '';
const USD_TO_EUR = 0.93;

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

// Seed URLs discovered from search — one per product style
const SEED_URLS: Array<{url: string; category: ScrapedProduct['category']}> = [
  // Bags
  {url: 'https://www.farfetch.com/shopping/women/jacquemus-le-chiquito-moyen-tote-bag-item-18697074.aspx', category: 'bag'},
  {url: 'https://www.farfetch.com/shopping/women/jacquemus-le-chiquito-noeud-bag-item-31557068.aspx', category: 'bag'},
  {url: 'https://www.farfetch.com/shopping/women/jacquemus-large-bambino-tote-bag-item-29884590.aspx', category: 'bag'},
  {url: 'https://www.farfetch.com/shopping/women/jacquemus-le-bambino-woven-mini-tote-bag-item-33418062.aspx', category: 'bag'},
  // Dresses
  {url: 'https://www.farfetch.com/shopping/women/jacquemus-la-robe-saudade-draped-mini-dress-item-19571106.aspx', category: 'dress'},
  {url: 'https://www.farfetch.com/shopping/women/jacquemus-la-robe-peplo-maxi-dress-item-23760628.aspx', category: 'dress'},
  // Shoes
  {url: 'https://www.farfetch.com/shopping/women/jacquemus-cubisto-heeled-sandals-item-32426176.aspx', category: 'shoes'},
];

// Additional search queries to discover more products
const EXTRA_SEARCHES: Array<{query: string; category: ScrapedProduct['category']}> = [
  {query: 'jacquemus bambino mini bag farfetch shopping women item', category: 'bag'},
  {query: 'jacquemus mikado grand bambino bag farfetch shopping women item', category: 'bag'},
  {query: 'jacquemus turismo rond carre bag farfetch shopping women item', category: 'bag'},
  {query: 'jacquemus la robe riviera dress farfetch shopping women item', category: 'dress'},
  {query: 'jacquemus la robe drapeado notte dress farfetch shopping women item', category: 'dress'},
  {query: 'jacquemus mules bisou sandales farfetch shopping women item', category: 'shoes'},
  {query: 'jacquemus ballerines slingbacks duelo farfetch shopping women item', category: 'shoes'},
];

const CATEGORY_LIMITS: Record<ScrapedProduct['category'], number> = {bag: 8, dress: 6, shoes: 5};

const INFERENCE_TAGS: Record<string, string[]> = {
  chiquito:    ['mood:chic', 'mood:minimalist', 'occasion:evening', 'occasion:day', 'season:all-season', 'style:mini'],
  bambino:     ['mood:chic', 'mood:romantic', 'occasion:wedding', 'occasion:day', 'season:spring', 'season:summer'],
  bambimou:    ['mood:chic', 'mood:romantic', 'occasion:evening', 'occasion:day', 'season:all-season', 'style:mini'],
  mikado:      ['mood:minimalist', 'mood:chic', 'occasion:everyday', 'season:all-season'],
  turismo:     ['mood:casual', 'mood:versatile', 'occasion:everyday', 'occasion:travel', 'season:all-season'],
  'rond':      ['mood:playful', 'mood:chic', 'occasion:evening', 'occasion:day', 'season:all-season', 'style:mini'],
  bisou:       ['mood:romantic', 'mood:feminine', 'occasion:evening', 'occasion:cocktail', 'season:spring', 'season:summer'],
  riviera:     ['mood:sophisticated', 'mood:elegant', 'occasion:wedding', 'occasion:cocktail', 'season:summer', 'material:silk'],
  drapeado:    ['mood:sensual', 'mood:elegant', 'occasion:cocktail', 'occasion:evening', 'season:spring', 'season:summer'],
  saudade:     ['mood:romantic', 'mood:bohemian', 'occasion:wedding', 'occasion:day', 'season:spring', 'season:summer'],
  peplo:       ['mood:feminine', 'mood:elegant', 'occasion:cocktail', 'occasion:evening', 'season:spring', 'season:summer'],
  notte:       ['mood:sophisticated', 'mood:elegant', 'occasion:evening', 'occasion:cocktail', 'season:all-season'],
  mules:       ['mood:chic', 'mood:minimalist', 'occasion:everyday', 'occasion:day', 'season:all-season', 'style:mule'],
  sandal:      ['mood:summery', 'mood:chic', 'occasion:vacation', 'occasion:day', 'season:summer', 'style:sandal'],
  ballerine:   ['mood:feminine', 'mood:chic', 'occasion:everyday', 'occasion:cocktail', 'season:all-season', 'style:flat'],
  cubisto:     ['mood:bold', 'mood:playful', 'occasion:cocktail', 'occasion:evening', 'season:spring', 'season:summer'],
  slingback:   ['mood:sophisticated', 'mood:elegant', 'occasion:wedding', 'occasion:cocktail', 'season:spring', 'season:summer'],
};

function inferTags(title: string, category: ScrapedProduct['category']): string[] {
  const lower = title.toLowerCase();
  const tags: string[] = [`category:${category}`];
  for (const [key, keyTags] of Object.entries(INFERENCE_TAGS)) {
    if (lower.includes(key)) { tags.push(...keyTags); break; }
  }
  if (tags.length === 1) {
    if (category === 'bag') tags.push('mood:chic', 'occasion:day', 'season:all-season');
    if (category === 'dress') tags.push('mood:elegant', 'occasion:day', 'season:summer');
    if (category === 'shoes') tags.push('mood:chic', 'occasion:day', 'season:all-season');
  }
  return [...new Set(tags)];
}

async function searchForUrls(
  query: string,
  category: ScrapedProduct['category'],
): Promise<Array<{url: string; category: ScrapedProduct['category']}>> {
  const res = await fetch('https://api.firecrawl.dev/v1/search', {
    method: 'POST',
    headers: {Authorization: `Bearer ${FIRECRAWL_API_KEY}`, 'Content-Type': 'application/json'},
    body: JSON.stringify({query, limit: 10}),
  });
  const data = (await res.json()) as {data?: Array<{url: string}>};
  return (data.data ?? [])
    .filter((r) => /-item-\d+\.aspx$/.test(r.url) && r.url.includes('farfetch.com'))
    .slice(0, 3)
    .map((r) => ({url: r.url, category}));
}

async function scrapeProduct(
  url: string,
  category: ScrapedProduct['category'],
): Promise<ScrapedProduct | null> {
  const res = await fetch('https://api.firecrawl.dev/v1/scrape', {
    method: 'POST',
    headers: {Authorization: `Bearer ${FIRECRAWL_API_KEY}`, 'Content-Type': 'application/json'},
    body: JSON.stringify({
      url,
      formats: ['extract'],
      extract: {
        schema: {
          type: 'object',
          properties: {
            title: {type: 'string', description: 'Product name'},
            price: {type: 'number', description: 'Price as number e.g. 590'},
            currency: {type: 'string', description: 'Currency code e.g. USD'},
            description: {type: 'string', description: 'Product description'},
            images: {type: 'array', items: {type: 'string'}, description: 'Product image URLs'},
            sizes: {type: 'array', items: {type: 'string'}, description: 'Available sizes'},
          },
          required: ['title', 'price'],
        },
      },
    }),
  });

  if (!res.ok) return null;
  const data = (await res.json()) as {data?: {extract?: Record<string, unknown>}};
  const ext = data.data?.extract;
  if (!ext?.title || !ext.price || Number(ext.price) === 0) return null;

  const currency = String(ext.currency ?? 'USD');
  const rawPrice = Number(ext.price);
  const priceEur =
    currency === 'EUR' ? rawPrice
    : currency === 'GBP' ? Math.round(rawPrice * 1.18)
    : Math.round(rawPrice * USD_TO_EUR);

  const images = (ext.images as string[] ?? [])
    .filter((img) => img.startsWith('https://cdn-images.farfetch-contents.com'))
    .slice(0, 3);

  const title = String(ext.title).replace(/\s+\|.*$/, '').trim();

  return {
    title,
    description: String(ext.description ?? '').slice(0, 300),
    price: priceEur,
    currency: 'EUR',
    category,
    images,
    sizes: (ext.sizes as string[] ?? []).filter((s) => s !== 'OS'),
    tags: inferTags(title, category),
  };
}

function sleep(ms: number) { return new Promise((r) => setTimeout(r, ms)); }

async function main() {
  if (!FIRECRAWL_API_KEY) { console.error('FIRECRAWL_API_KEY is not set'); process.exit(1); }

  const counts: Record<ScrapedProduct['category'], number> = {bag: 0, dress: 0, shoes: 0};
  const seenUrls = new Set<string>();
  const products: ScrapedProduct[] = [];

  // Collect all candidate URLs
  const allCandidates: Array<{url: string; category: ScrapedProduct['category']}> = [...SEED_URLS];

  console.log('Searching for additional product URLs...');
  for (const {query, category} of EXTRA_SEARCHES) {
    if (counts[category] >= CATEGORY_LIMITS[category]) continue;
    const found = await searchForUrls(query, category);
    console.log(`  "${query.slice(0, 50)}" → ${found.length} URLs`);
    allCandidates.push(...found);
    await sleep(300);
  }

  console.log(`\nScraping ${allCandidates.length} candidates...`);
  for (const {url, category} of allCandidates) {
    if (counts[category] >= CATEGORY_LIMITS[category]) continue;
    if (seenUrls.has(url)) continue;
    seenUrls.add(url);

    console.log(`[${category}] ${url.split('/').pop()}`);
    const product = await scrapeProduct(url, category);
    if (product) {
      products.push(product);
      counts[category]++;
      console.log(`  ✓ ${product.title} — €${product.price}`);
    } else {
      console.log(`  ✗ skipped`);
    }
    await sleep(400);
  }

  if (products.length === 0) { console.error('No products scraped'); process.exit(1); }

  writeFileSync('scripts/jacquemus-products.json', JSON.stringify(products, null, 2));
  console.log(`\n✓ ${products.length} products (${counts.bag} bags, ${counts.dress} dresses, ${counts.shoes} shoes)`);
}

main().catch(console.error);
