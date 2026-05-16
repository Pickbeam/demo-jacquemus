import {Await, useLoaderData, Link} from 'react-router';
import type {Route} from './+types/_index';
import {Suspense} from 'react';
import {Image, Money} from '@shopify/hydrogen';
import type {CurrencyCode} from '@shopify/hydrogen/storefront-api-types';
import {AddToCartButton} from '~/components/AddToCartButton';
import {MockShopNotice} from '~/components/MockShopNotice';

type GridProduct = {
  id: string;
  title: string;
  handle: string;
  featuredImage: {
    id: string;
    url: string;
    altText: string | null;
    width: number;
    height: number;
  } | null;
  priceRange: {minVariantPrice: {amount: string; currencyCode: CurrencyCode}};
};

type HeroProduct = GridProduct & {
  variants: {nodes: Array<{id: string; availableForSale: boolean}>};
};

type HeroCollection = {
  id: string;
  title: string;
  handle: string;
  image: {
    id: string;
    url: string;
    altText: string | null;
    width: number;
    height: number;
  } | null;
  products: {nodes: Array<HeroProduct>};
};

type HomepageProductsData = {
  nouveautes: {nodes: Array<GridProduct>};
  sacs: {products: {nodes: Array<GridProduct>}} | null;
  pretAPorter: {products: {nodes: Array<GridProduct>}} | null;
  accessoires: {products: {nodes: Array<GridProduct>}} | null;
};

export const meta: Route.MetaFunction = () => {
  return [{title: 'Hydrogen | Home'}];
};

export async function loader(args: Route.LoaderArgs) {
  // Start fetching non-critical data without blocking time to first byte
  const deferredData = loadDeferredData(args);

  // Await the critical data required to render initial state of the page
  const criticalData = await loadCriticalData(args);

  return {...deferredData, ...criticalData};
}

async function loadCriticalData({context}: Route.LoaderArgs) {
  const [{collections}] = await Promise.all([
    context.storefront.query(HERO_QUERY),
  ]);
  return {
    isShopLinked: Boolean(context.env.PUBLIC_STORE_DOMAIN),
    heroCollection: (collections.nodes[0] ?? null) as HeroCollection | null,
  };
}

function loadDeferredData({context}: Route.LoaderArgs) {
  const productsData = context.storefront
    .query(HOMEPAGE_PRODUCTS_QUERY)
    .catch((error: Error) => {
      console.error(error);
      return null;
    }) as Promise<HomepageProductsData | null>;

  return {productsData};
}

export default function Homepage() {
  const data = useLoaderData<typeof loader>();
  return (
    <div className="home">
      {data.isShopLinked ? null : <MockShopNotice />}
      <HeroSection collection={data.heroCollection} />
      <Suspense fallback={<div style={{height: '400px'}} />}>
        <Await resolve={data.productsData}>
          {(products) => <ProductSections products={products} />}
        </Await>
      </Suspense>
    </div>
  );
}

function HeroSection({collection}: {collection: HeroCollection | null}) {
  if (!collection) return null;
  const heroProduct = collection.products.nodes[0] ?? null;

  return (
    <section className="hero">
      {/* Colonne gauche : image de campagne */}
      <Link className="hero-left" to={`/collections/${collection.handle}`}>
        {collection.image ? (
          <Image
            data={collection.image}
            sizes="50vw"
            alt={collection.image.altText ?? collection.title}
          />
        ) : (
          <div style={{width: '100%', height: '100%', background: '#1a1a1a'}} />
        )}
        <span className="hero-left-label">SS 26 — {collection.title}</span>
        <div className="hero-left-content">
          <h1 className="hero-left-title">
            La Maison<br />Jacquemus
          </h1>
          <span className="hero-left-cta">Découvrir la collection</span>
        </div>
      </Link>

      {/* Colonne droite : produit star */}
      {heroProduct && (
        <div className="hero-right">
          {heroProduct.featuredImage ? (
            <Image
              data={heroProduct.featuredImage}
              sizes="50vw"
              alt={heroProduct.featuredImage.altText ?? heroProduct.title}
            />
          ) : (
            <div style={{width: '100%', height: '100%', background: '#f0ede8'}} />
          )}
          <div className="hero-right-content">
            <div>
              <p className="hero-right-name">{heroProduct.title}</p>
              <p className="hero-right-price">
                <Money data={heroProduct.priceRange.minVariantPrice} />
              </p>
            </div>
            {heroProduct.variants.nodes[0] && (
              <AddToCartButton
                lines={[
                  {
                    merchandiseId: heroProduct.variants.nodes[0].id,
                    quantity: 1,
                  },
                ]}
                disabled={!heroProduct.variants.nodes[0].availableForSale}
              >
                <span className="hero-right-add">Add to cart</span>
              </AddToCartButton>
            )}
          </div>
        </div>
      )}
    </section>
  );
}

function ProductCard({product, cols}: {product: GridProduct; cols: 2 | 4}) {
  return (
    <Link
      className="product-card"
      to={`/products/${product.handle}`}
      prefetch="intent"
    >
      <div className="product-card-image-wrap">
        {product.featuredImage ? (
          <Image
            data={product.featuredImage}
            sizes={cols === 4 ? '25vw' : '50vw'}
            alt={product.featuredImage.altText ?? product.title}
          />
        ) : (
          <div className="product-card-placeholder" />
        )}
      </div>
      <div className="product-card-body">
        <p className="product-card-name">{product.title}</p>
        <p className="product-card-price">
          <Money data={product.priceRange.minVariantPrice} />
        </p>
      </div>
    </Link>
  );
}

function ProductGridSection({
  label,
  products,
  cols,
  collectionHandle,
}: {
  label: string;
  products: Array<GridProduct>;
  cols: 2 | 4;
  collectionHandle?: string;
}) {
  if (!products.length) return null;

  return (
    <section className="products-section">
      <div className="products-section-header">
        <span className="products-section-label">{label}</span>
        {collectionHandle && (
          <Link
            className="products-section-link"
            to={`/collections/${collectionHandle}`}
          >
            Voir tout
          </Link>
        )}
      </div>
      <div className={cols === 4 ? 'grid-4' : 'grid-2'}>
        {products.map((product) => (
          <ProductCard key={product.id} product={product} cols={cols} />
        ))}
      </div>
    </section>
  );
}

function ProductSections({products}: {products: HomepageProductsData | null}) {
  if (!products) return null;

  return (
    <>
      <ProductGridSection
        label="Nouveautés"
        products={products.nouveautes.nodes}
        cols={4}
      />
      <ProductGridSection
        label="Sacs iconiques"
        products={products.sacs?.products.nodes ?? []}
        cols={2}
        collectionHandle="sacs"
      />
      <ProductGridSection
        label="Prêt-à-porter"
        products={products.pretAPorter?.products.nodes ?? []}
        cols={4}
        collectionHandle="pret-a-porter"
      />
      <ProductGridSection
        label="Accessoires"
        products={products.accessoires?.products.nodes ?? []}
        cols={2}
        collectionHandle="accessoires"
      />
    </>
  );
}

const HERO_QUERY = `#graphql
  fragment HeroProduct on Product {
    id
    title
    handle
    featuredImage { id url altText width height }
    priceRange { minVariantPrice { amount currencyCode } }
    variants(first: 1) { nodes { id availableForSale } }
  }
  fragment HeroCollection on Collection {
    id
    title
    handle
    image { id url altText width height }
    products(first: 1) { nodes { ...HeroProduct } }
  }
  query HeroQuery($country: CountryCode, $language: LanguageCode)
    @inContext(country: $country, language: $language) {
    collections(first: 1, sortKey: UPDATED_AT, reverse: true) {
      nodes { ...HeroCollection }
    }
  }
` as const;

const HOMEPAGE_PRODUCTS_QUERY = `#graphql
  fragment GridProduct on Product {
    id
    title
    handle
    featuredImage { id url altText width height }
    priceRange { minVariantPrice { amount currencyCode } }
  }
  query HomepageProducts($country: CountryCode, $language: LanguageCode)
    @inContext(country: $country, language: $language) {
    nouveautes: products(first: 4, sortKey: UPDATED_AT, reverse: true) {
      nodes { ...GridProduct }
    }
    sacs: collection(handle: "sacs") {
      products(first: 2) { nodes { ...GridProduct } }
    }
    pretAPorter: collection(handle: "pret-a-porter") {
      products(first: 4) { nodes { ...GridProduct } }
    }
    accessoires: collection(handle: "accessoires") {
      products(first: 2) { nodes { ...GridProduct } }
    }
  }
` as const;
