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
