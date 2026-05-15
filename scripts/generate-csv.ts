import {readFileSync, writeFileSync} from 'fs';

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

const products: ScrapedProduct[] = JSON.parse(
  readFileSync('scripts/jacquemus-products.json', 'utf-8'),
);

// Shopify product CSV format
const headers = [
  'Handle',
  'Title',
  'Body (HTML)',
  'Vendor',
  'Product Category',
  'Type',
  'Tags',
  'Published',
  'Option1 Name',
  'Option1 Value',
  'Variant SKU',
  'Variant Grams',
  'Variant Inventory Tracker',
  'Variant Inventory Qty',
  'Variant Inventory Policy',
  'Variant Fulfillment Service',
  'Variant Price',
  'Variant Requires Shipping',
  'Variant Taxable',
  'Image Src',
  'Image Position',
  'Image Alt Text',
  'Status',
];

function toHandle(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function escapeCsv(val: string | number): string {
  const s = String(val);
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function row(values: (string | number)[]): string {
  return values.map(escapeCsv).join(',');
}

const rows: string[] = [headers.join(',')];

for (const p of products) {
  const handle = toHandle(p.title);
  const tagsStr = p.tags.join(', ');
  const hasSizes = p.sizes.length > 0;
  const variants = hasSizes ? p.sizes : ['Default Title'];
  const optionName = hasSizes ? 'Size' : 'Title';
  const image = p.images[0] ?? '';

  variants.forEach((variant, i) => {
    rows.push(
      row([
        handle,
        i === 0 ? p.title : '',
        i === 0 ? `<p>${p.description}</p>` : '',
        i === 0 ? 'Jacquemus' : '',
        i === 0 ? 'Apparel & Accessories' : '',
        i === 0 ? p.category : '',
        i === 0 ? tagsStr : '',
        i === 0 ? 'TRUE' : '',
        i === 0 ? optionName : '',
        variant,
        `JAC-${handle.toUpperCase().slice(0, 8)}-${variant.replace(/\s/g, '')}`,
        '0',
        'shopify',
        '10',
        'deny',
        'manual',
        p.price.toFixed(2),
        'TRUE',
        'TRUE',
        i === 0 ? image : '',
        i === 0 ? '1' : '',
        i === 0 ? p.title : '',
        'active',
      ]),
    );
  });
}

writeFileSync('scripts/jacquemus-products.csv', rows.join('\n'));
console.log(`✓ Wrote ${products.length} products (${rows.length - 1} rows) to scripts/jacquemus-products.csv`);
