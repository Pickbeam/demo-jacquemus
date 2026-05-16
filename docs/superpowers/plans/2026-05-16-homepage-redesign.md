# Homepage Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Retravailler la home page pour adopter les codes visuels Jacquemus — hero split 50/50, 4 grilles alternées ×4/×2, header transparent au scroll, footer 4 bandes.

**Architecture:** Le header passe en `position: fixed` avec transparence au scroll via `useLocation` + `useEffect`. La route homepage reçoit de nouveaux loaders GraphQL (hero collection + 4 sections produits) et des composants React dédiés. `Footer.tsx` est entièrement remplacé. Tous les styles sont dans `app.css`.

**Tech Stack:** React Router v7, Shopify Hydrogen, Shopify Storefront GraphQL API, CSS vanilla (`app.css`)

---

## Fichiers touchés

| Fichier | Action |
|---|---|
| `app/styles/app.css` | Modifier — header fixed + transparent, hero, grilles, footer |
| `app/components/Header.tsx` | Modifier — fixed + scroll transparent→blanc via useLocation |
| `app/routes/($locale)._index.tsx` | Réécriture — loaders, HeroSection, ProductGrid, 4 sections |
| `app/components/Footer.tsx` | Réécriture — footer 4 bandes Jacquemus |

---

### Task 1: CSS — header fixed + styles home page + footer

**Files:**
- Modify: `app/styles/app.css`

- [ ] **Step 1: Mettre à jour les variables et le bloc `.header`**

Remplacer `:root` (ligne 1) :
```css
:root {
  --aside-width: 400px;
  --cart-aside-summary-height-with-discount: 300px;
  --cart-aside-summary-height: 250px;
  --grid-item-width: 355px;
  --header-height: 56px;
  --color-dark: #000;
  --color-light: #fff;
}
```

Remplacer le bloc `.header { ... }` (actuellement lignes 228-238) par :
```css
.header {
  align-items: center;
  background: #fff;
  border-bottom: 1px solid #ebebeb;
  display: flex;
  height: var(--header-height);
  justify-content: space-between;
  padding: 0 40px;
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: 100;
  transition: background 0.3s ease, border-color 0.3s ease;
}

.header--transparent {
  background: transparent;
  border-color: transparent;
}

.header-menu-desktop {
  display: none;
  gap: 2rem;
  @media (min-width: 45em) {
    display: flex;
    position: absolute;
    left: 50%;
    transform: translateX(-50%);
  }
}

.header-menu-item {
  cursor: pointer;
  font-size: 9px;
  font-weight: 300;
  letter-spacing: 0.2em;
  text-transform: uppercase;
  text-decoration: none;
  color: #444;
  transition: color 0.3s ease;
}

.header--transparent .header-menu-item {
  color: rgba(255, 255, 255, 0.75);
}

.header-ctas {
  align-items: center;
  display: flex;
  gap: 24px;
  margin-left: auto;
}

.header-ctas > * {
  min-width: fit-content;
}
```

- [ ] **Step 2: Ajouter `padding-top` à `main` + compensation homepage**

Remplacer le bloc `main { padding-bottom: 52px; }` (ligne 284) par :
```css
main {
  padding-top: var(--header-height);
  padding-bottom: 52px;
}

.home {
  margin-top: calc(-1 * var(--header-height));
}
```

- [ ] **Step 3: Remplacer les anciens styles home page**

Trouver et supprimer le bloc `/* routes/__index */` avec `.featured-collection`, `.featured-collection-image`, `.featured-collection img`, `.recommended-products-grid`, `.recommended-product img`.

Les remplacer par :
```css
/*
* --------------------------------------------------
* routes/($locale)._index — Hero
* --------------------------------------------------
*/
.hero {
  display: grid;
  grid-template-columns: 1fr 1fr;
  height: 100vh;
  min-height: 600px;
}

.hero-left {
  overflow: hidden;
  position: relative;
  background: #1a1a1a;
}

.hero-left img {
  display: block;
  height: 100%;
  object-fit: cover;
  width: 100%;
}

.hero-left-label {
  color: rgba(255, 255, 255, 0.4);
  font-size: 9px;
  font-weight: 300;
  left: 32px;
  letter-spacing: 0.25em;
  position: absolute;
  text-transform: uppercase;
  top: 72px;
}

.hero-left-content {
  bottom: 40px;
  left: 32px;
  position: absolute;
  right: 32px;
}

.hero-left-title {
  color: #fff;
  font-size: clamp(36px, 4.5vw, 64px);
  font-weight: 200;
  letter-spacing: -0.01em;
  line-height: 1.05;
  margin-bottom: 20px;
}

.hero-left-cta {
  border-bottom: 1px solid rgba(255, 255, 255, 0.25);
  color: rgba(255, 255, 255, 0.5);
  font-size: 9px;
  font-weight: 300;
  letter-spacing: 0.25em;
  padding-bottom: 4px;
  text-decoration: none;
  text-transform: uppercase;
  transition: color 0.2s, border-color 0.2s;
}

.hero-left-cta:hover {
  border-color: rgba(255, 255, 255, 0.6);
  color: rgba(255, 255, 255, 0.8);
}

.hero-right {
  background: #f0ede8;
  overflow: hidden;
  position: relative;
}

.hero-right img {
  display: block;
  height: 100%;
  object-fit: cover;
  object-position: center top;
  width: 100%;
}

.hero-right-content {
  align-items: flex-end;
  bottom: 40px;
  display: flex;
  justify-content: space-between;
  left: 32px;
  position: absolute;
  right: 32px;
}

.hero-right-name {
  color: #000;
  font-size: 11px;
  font-weight: 300;
  letter-spacing: 0.15em;
  margin-bottom: 4px;
  text-transform: uppercase;
}

.hero-right-price {
  color: #aaa;
  font-size: 11px;
  font-weight: 300;
}

.hero-right-add {
  background: none;
  border: none;
  border-bottom: 1px solid #000;
  color: #000;
  cursor: pointer;
  font-size: 9px;
  font-weight: 300;
  letter-spacing: 0.2em;
  padding: 0 0 3px;
  text-transform: uppercase;
  transition: opacity 0.2s;
}

.hero-right-add:hover { opacity: 0.5; }

/*
* --------------------------------------------------
* routes/($locale)._index — Product grids
* --------------------------------------------------
*/
.products-section {
  padding: 72px 40px 0;
}

.products-section:last-of-type {
  padding-bottom: 72px;
}

.products-section-header {
  align-items: baseline;
  display: flex;
  justify-content: space-between;
  margin-bottom: 40px;
}

.products-section-label {
  color: #000;
  font-size: 9px;
  font-weight: 300;
  letter-spacing: 0.3em;
  text-transform: uppercase;
}

.products-section-link {
  border-bottom: 1px solid #e0e0e0;
  color: #aaa;
  font-size: 9px;
  font-weight: 300;
  letter-spacing: 0.2em;
  padding-bottom: 2px;
  text-decoration: none;
  text-transform: uppercase;
}

.grid-4 {
  display: grid;
  gap: 2px;
  grid-template-columns: repeat(4, 1fr);
}

.grid-2 {
  display: grid;
  gap: 2px;
  grid-template-columns: repeat(2, 1fr);
}

.product-card {
  cursor: pointer;
  overflow: hidden;
  text-decoration: none;
  display: block;
}

.product-card-image-wrap {
  overflow: hidden;
}

.grid-4 .product-card-image-wrap { aspect-ratio: 3 / 4; }
.grid-2 .product-card-image-wrap { aspect-ratio: 4 / 5; }

.product-card-image-wrap img {
  display: block;
  height: 100%;
  object-fit: cover;
  transition: transform 0.5s ease;
  width: 100%;
}

.product-card:hover .product-card-image-wrap img {
  transform: scale(1.03);
}

.product-card-placeholder {
  align-items: center;
  background: linear-gradient(160deg, #eceae6 0%, #e0ddd8 100%);
  display: flex;
  height: 100%;
  justify-content: center;
  width: 100%;
}

.product-card-body {
  padding: 14px 0 0;
}

.product-card-name {
  color: #000;
  font-size: 10px;
  font-weight: 300;
  letter-spacing: 0.12em;
  margin-bottom: 4px;
  text-transform: uppercase;
}

.product-card-price {
  color: #aaa;
  font-size: 10px;
  font-weight: 300;
}

/*
* --------------------------------------------------
* components/Footer — 4 bandes Jacquemus
* --------------------------------------------------
*/
.footer-services {
  border-top: 1px solid #e8e8e8;
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  padding: 60px 40px;
  text-align: center;
}

.footer-service + .footer-service {
  border-left: 1px solid #e8e8e8;
}

.footer-service-title {
  color: #000;
  font-size: 13px;
  font-weight: 300;
  margin-bottom: 12px;
}

.footer-service-desc {
  color: #aaa;
  font-size: 12px;
  font-weight: 300;
  line-height: 1.6;
}

.footer-mid {
  border-top: 1px solid #e8e8e8;
  display: grid;
  grid-template-columns: 1fr 1fr;
}

.footer-newsletter {
  border-right: 1px solid #e8e8e8;
  padding: 48px 40px;
}

.footer-newsletter-toggle {
  align-items: center;
  cursor: pointer;
  display: flex;
  gap: 10px;
  margin-bottom: 20px;
}

.footer-newsletter-title {
  color: #000;
  font-size: 15px;
  font-weight: 300;
}

.footer-newsletter-desc {
  color: #aaa;
  font-size: 12px;
  font-weight: 300;
  line-height: 1.7;
  margin-bottom: 28px;
  max-width: 400px;
}

.footer-newsletter-btn {
  background: #000;
  border: none;
  color: #fff;
  cursor: pointer;
  display: block;
  font-size: 9px;
  font-weight: 400;
  letter-spacing: 0.25em;
  max-width: 580px;
  padding: 18px;
  text-align: center;
  text-transform: uppercase;
  width: 100%;
  transition: opacity 0.2s;
}

.footer-newsletter-btn:hover { opacity: 0.75; }

.footer-contact {
  padding: 48px 40px;
}

.footer-contact-title {
  color: #000;
  font-size: 15px;
  font-weight: 300;
  margin-bottom: 16px;
}

.footer-contact-hours {
  color: #aaa;
  font-size: 12px;
  font-weight: 300;
  line-height: 1.7;
  margin-bottom: 28px;
}

.footer-contact-links {
  display: flex;
  flex-wrap: wrap;
  gap: 20px;
}

.footer-contact-links a {
  color: #000;
  font-size: 12px;
  font-weight: 300;
  text-decoration: underline;
  text-underline-offset: 3px;
}

.footer-nav {
  align-items: start;
  border-top: 1px solid #e8e8e8;
  display: grid;
  gap: 20px;
  grid-template-columns: 1fr 1fr 1fr 1fr;
  padding: 32px 40px;
}

.footer-nav-group-title {
  align-items: center;
  color: #000;
  cursor: pointer;
  display: flex;
  font-size: 12px;
  font-weight: 300;
  gap: 8px;
}

.footer-social-title {
  color: #000;
  font-size: 12px;
  font-weight: 300;
  margin-bottom: 10px;
}

.footer-social-links {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.footer-social-links a {
  color: #000;
  font-size: 11px;
  font-weight: 300;
  text-decoration: underline;
  text-underline-offset: 3px;
}

.footer-bottom {
  align-items: center;
  border-top: 1px solid #e8e8e8;
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  padding: 24px 40px;
}

.footer-bottom-copy {
  color: #aaa;
  font-size: 10px;
  font-weight: 300;
}

.footer-bottom-logo {
  color: #000;
  font-size: 14px;
  font-weight: 700;
  letter-spacing: 0.2em;
  text-align: center;
  text-decoration: none;
  text-transform: uppercase;
}

.footer-bottom-right {
  align-items: flex-end;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.footer-bottom-right a {
  color: #000;
  font-size: 10px;
  font-weight: 300;
  text-decoration: underline;
  text-underline-offset: 3px;
}
```

- [ ] **Step 4: Commit**

```bash
git add app/styles/app.css
git commit -m "style: CSS header fixed transparent, hero, grilles, footer Jacquemus"
```

---

### Task 2: Header — fixed + transparent au scroll

**Files:**
- Modify: `app/components/Header.tsx`

- [ ] **Step 1: Ajouter les imports `useState`, `useEffect`, `useLocation`**

En haut du fichier, remplacer la ligne d'import React existante :
```tsx
import {Suspense, useState, useEffect} from 'react';
import {Await, NavLink, useAsyncValue, useLocation} from 'react-router';
```

- [ ] **Step 2: Remplacer la fonction `Header`**

```tsx
export function Header({
  header,
  isLoggedIn,
  cart,
  publicStoreDomain,
}: HeaderProps) {
  const {shop, menu} = header;
  const location = useLocation();
  const isHome = location.pathname === '/' || /^\/[a-z]{2}(-[A-Z]{2})?$/.test(location.pathname);
  const [scrolled, setScrolled] = useState(!isHome);

  useEffect(() => {
    if (!isHome) {
      setScrolled(true);
      return;
    }
    const onScroll = () => setScrolled(window.scrollY > 20);
    setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', onScroll, {passive: true});
    return () => window.removeEventListener('scroll', onScroll);
  }, [isHome]);

  return (
    <header className={`header${!scrolled ? ' header--transparent' : ''}`}>
      <NavLink prefetch="intent" to="/" end style={{lineHeight: 0}}>
        <img
          src="/jacquemus-logo.png"
          alt="Jacquemus"
          style={{
            height: '18px',
            display: 'block',
            filter: scrolled ? 'none' : 'invert(1)',
            transition: 'filter 0.3s ease',
          }}
        />
      </NavLink>
      <HeaderMenu
        menu={menu}
        viewport="desktop"
        primaryDomainUrl={header.shop.primaryDomain.url}
        publicStoreDomain={publicStoreDomain}
      />
      <HeaderCtas isLoggedIn={isLoggedIn} cart={cart} scrolled={scrolled} />
    </header>
  );
}
```

- [ ] **Step 3: Mettre à jour `HeaderCtas` pour transmettre `scrolled`**

```tsx
function HeaderCtas({
  isLoggedIn,
  cart,
  scrolled,
}: Pick<HeaderProps, 'isLoggedIn' | 'cart'> & {scrolled: boolean}) {
  const linkColor = scrolled ? '#444' : 'rgba(255,255,255,0.75)';
  return (
    <nav className="header-ctas" role="navigation">
      <HeaderMenuMobileToggle />
      <NavLink
        prefetch="intent"
        to="/account"
        style={{
          fontSize: '9px',
          letterSpacing: '0.2em',
          textTransform: 'uppercase' as const,
          color: linkColor,
          textDecoration: 'none',
          fontWeight: 300,
          transition: 'color 0.3s',
        }}
      >
        <Suspense fallback="Sign in">
          <Await resolve={isLoggedIn} errorElement="Sign in">
            {(isLoggedIn) => (isLoggedIn ? 'Account' : 'Sign in')}
          </Await>
        </Suspense>
      </NavLink>
      <SearchToggle scrolled={scrolled} />
      <CartToggle cart={cart} scrolled={scrolled} />
    </nav>
  );
}
```

- [ ] **Step 4: Mettre à jour `SearchToggle`, `CartToggle`, `CartBanner`, `CartBadge`**

```tsx
function SearchToggle({scrolled}: {scrolled: boolean}) {
  const {open} = useAside();
  const linkColor = scrolled ? '#444' : 'rgba(255,255,255,0.75)';
  return (
    <button
      className="reset"
      onClick={() => open('search')}
      style={{
        fontSize: '9px',
        letterSpacing: '0.2em',
        textTransform: 'uppercase',
        color: linkColor,
        background: 'none',
        border: 'none',
        cursor: 'pointer',
        fontWeight: 300,
        transition: 'color 0.3s',
      }}
    >
      Search
    </button>
  );
}

function CartBadge({count, scrolled}: {count: number; scrolled: boolean}) {
  const {open} = useAside();
  const {publish, shop, cart, prevCart} = useAnalytics();
  const linkColor = scrolled ? '#444' : 'rgba(255,255,255,0.75)';

  return (
    <a
      href="/cart"
      style={{
        fontSize: '9px',
        letterSpacing: '0.2em',
        textTransform: 'uppercase',
        color: linkColor,
        textDecoration: 'none',
        display: 'flex',
        alignItems: 'center',
        gap: '4px',
        fontWeight: 300,
        transition: 'color 0.3s',
      }}
      onClick={(e) => {
        e.preventDefault();
        open('cart');
        publish('cart_viewed', {
          cart,
          prevCart,
          shop,
          url: window.location.href || '',
        } as CartViewPayload);
      }}
    >
      Cart
      {count > 0 && (
        <span
          aria-label={`(items: ${count})`}
          style={{
            background: scrolled ? '#1a1a1a' : 'rgba(255,255,255,0.9)',
            color: scrolled ? 'white' : '#1a1a1a',
            width: '17px',
            height: '17px',
            borderRadius: '50%',
            fontSize: '9px',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'background 0.3s, color 0.3s',
          }}
        >
          {count}
        </span>
      )}
    </a>
  );
}

function CartToggle({cart, scrolled}: Pick<HeaderProps, 'cart'> & {scrolled: boolean}) {
  return (
    <Suspense fallback={<CartBadge count={0} scrolled={scrolled} />}>
      <Await resolve={cart}>
        <CartBanner scrolled={scrolled} />
      </Await>
    </Suspense>
  );
}

function CartBanner({scrolled}: {scrolled: boolean}) {
  const originalCart = useAsyncValue() as CartApiQueryFragment | null;
  const cart = useOptimisticCart(originalCart);
  return <CartBadge count={cart?.totalQuantity ?? 0} scrolled={scrolled} />;
}
```

- [ ] **Step 5: Supprimer `activeLinkStyle` (plus utilisé)**

Supprimer la fonction `activeLinkStyle` en bas du fichier.

- [ ] **Step 6: Lancer le dev server et vérifier**

```bash
npm run dev
```

- Sur la home (`/`) : header transparent (logo blanc, liens blancs) au top → devient blanc au scroll
- Sur toute autre page (`/collections`, `/products/...`) : header blanc dès le chargement
- Le hero doit être plein écran (100vh) avec le header qui s'y superpose

- [ ] **Step 7: Commit**

```bash
git add app/components/Header.tsx
git commit -m "feat: header fixed transparent→blanc au scroll (homepage uniquement)"
```

---

### Task 3: GraphQL — nouveaux loaders pour la homepage

**Files:**
- Modify: `app/routes/($locale)._index.tsx`

- [ ] **Step 1: Remplacer les imports en haut du fichier**

```tsx
import {Await, useLoaderData, Link} from 'react-router';
import type {Route} from './+types/_index';
import {Suspense} from 'react';
import {Image, Money} from '@shopify/hydrogen';
import {AddToCartButton} from '~/components/AddToCartButton';
import {MockShopNotice} from '~/components/MockShopNotice';
```

- [ ] **Step 2: Ajouter les types TypeScript après les imports**

```tsx
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
  priceRange: {minVariantPrice: {amount: string; currencyCode: string}};
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
```

- [ ] **Step 3: Remplacer `loadCriticalData` et `loadDeferredData`**

```tsx
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
```

- [ ] **Step 4: Remplacer les requêtes GraphQL à la fin du fichier**

Supprimer `FEATURED_COLLECTION_QUERY` et `RECOMMENDED_PRODUCTS_QUERY`. Ajouter :

```ts
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
```

> **Note :** Les handles `"sacs"`, `"pret-a-porter"`, `"accessoires"` doivent correspondre aux handles réels dans Shopify. Si une collection n'existe pas, son champ retourne `null` et la section est simplement omise (voir Task 5).

- [ ] **Step 5: Commit**

```bash
git add 'app/routes/($locale)._index.tsx'
git commit -m "feat: nouvelles requêtes GraphQL hero + 4 sections produits"
```

---

### Task 4: Hero component — split 50/50

**Files:**
- Modify: `app/routes/($locale)._index.tsx`

- [ ] **Step 1: Remplacer le composant `Homepage`**

```tsx
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
```

- [ ] **Step 2: Remplacer `FeaturedCollection` par `HeroSection`**

Supprimer les anciens composants `FeaturedCollection` et `RecommendedProducts`. Ajouter :

```tsx
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
```

- [ ] **Step 3: Vérifier visuellement**

```bash
npm run dev
```

- La homepage doit afficher un hero plein écran, coupé en 2 colonnes égales
- Gauche : image de la collection avec titre "La Maison Jacquemus" en grand
- Droite : image du premier produit avec nom + prix + bouton Add to cart

- [ ] **Step 4: Commit**

```bash
git add 'app/routes/($locale)._index.tsx'
git commit -m "feat: HeroSection split 50/50 avec collection + produit star"
```

---

### Task 5: Product grid sections — 4 sections alternées

**Files:**
- Modify: `app/routes/($locale)._index.tsx`

- [ ] **Step 1: Ajouter le composant `ProductCard`**

```tsx
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
```

- [ ] **Step 2: Ajouter le composant `ProductGridSection`**

```tsx
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
```

- [ ] **Step 3: Ajouter le composant `ProductSections`**

```tsx
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
```

- [ ] **Step 4: Vérifier les 4 sections**

```bash
npm run dev
```

- Scroller sous le hero : 4 sections s'affichent (×4, ×2, ×4, ×2)
- Si une collection Shopify n'existe pas (handle incorrect), la section est omise silencieusement
- Hover sur une image : scale 1.03 en 0.5s
- Si les sections Sacs/PAP/Accessoires sont vides, ajuster les handles dans `HOMEPAGE_PRODUCTS_QUERY` pour correspondre aux vrais handles dans Shopify

- [ ] **Step 5: Commit**

```bash
git add 'app/routes/($locale)._index.tsx'
git commit -m "feat: 4 grilles produits alternées x4/x2 sur la homepage"
```

---

### Task 6: Footer — 4 bandes Jacquemus

**Files:**
- Modify: `app/components/Footer.tsx`

- [ ] **Step 1: Réécrire entièrement `Footer.tsx`**

```tsx
import {Suspense} from 'react';
import {Await, NavLink} from 'react-router';
import type {FooterQuery, HeaderQuery} from 'storefrontapi.generated';

interface FooterProps {
  footer: Promise<FooterQuery | null>;
  header: HeaderQuery;
  publicStoreDomain: string;
}

export function Footer({footer: footerPromise, header, publicStoreDomain}: FooterProps) {
  return (
    <Suspense>
      <Await resolve={footerPromise}>
        {() => (
          <footer>
            <FooterServices />
            <FooterMid />
            <FooterNav />
            <FooterBottom />
          </footer>
        )}
      </Await>
    </Suspense>
  );
}

function FooterServices() {
  return (
    <div className="footer-services">
      <div className="footer-service">
        <p className="footer-service-title">Prendre un rendez-vous en boutique</p>
        <p className="footer-service-desc">Paris, Londres, New York, Los Angeles...</p>
      </div>
      <div className="footer-service">
        <p className="footer-service-title">Livraison et retours gratuits</p>
        <p className="footer-service-desc">
          Livraison offerte<br />et retours simplifiés sous 14 jours.
        </p>
      </div>
      <div className="footer-service">
        <p className="footer-service-title">Paiement sécurisé</p>
        <p className="footer-service-desc">
          Visa, Mastercard, Paypal, Apple pay,<br />American express, Klarna
        </p>
      </div>
    </div>
  );
}

function FooterMid() {
  return (
    <div className="footer-mid">
      <div className="footer-newsletter">
        <div className="footer-newsletter-toggle">
          <span className="footer-newsletter-title">S&apos;abonner à la newsletter</span>
          <span>∨</span>
        </div>
        <p className="footer-newsletter-desc">
          Inscrivez-vous pour recevoir par e-mail toutes les informations sur nos
          dernières collections, nos produits, nos défilés de mode et nos projets.
        </p>
        <button className="footer-newsletter-btn" type="button">
          S&apos;enregistrer
        </button>
      </div>
      <div className="footer-contact">
        <p className="footer-contact-title">Besoin d&apos;aide ? Contactez-nous</p>
        <p className="footer-contact-hours">
          Du Lundi au Vendredi de 10:00 à 13:00 et de 14:00 à 21:00,<br />
          les samedis de 10:00 à 13:00 et de 14:00 à 18:00 CET.
        </p>
        <div className="footer-contact-links">
          <a href="/pages/contact">Formulaire de contact</a>
          <a href="/pages/order-tracking">Suivre une commande</a>
          <a href="/pages/returns">Enregistrer un retour</a>
        </div>
      </div>
    </div>
  );
}

function FooterNav() {
  return (
    <div className="footer-nav">
      <div className="footer-nav-group-title">Mentions légales et cookies <span>∨</span></div>
      <div className="footer-nav-group-title">FAQ <span>∨</span></div>
      <div className="footer-nav-group-title">Entreprise <span>∨</span></div>
      <div>
        <p className="footer-social-title">Suivez nous</p>
        <div className="footer-social-links">
          <a href="https://www.instagram.com/jacquemus" target="_blank" rel="noopener noreferrer">Instagram</a>
          <a href="https://www.facebook.com/jacquemus" target="_blank" rel="noopener noreferrer">Facebook</a>
          <a href="https://www.tiktok.com/@jacquemus" target="_blank" rel="noopener noreferrer">Tiktok</a>
          <a href="https://x.com/jacquemus" target="_blank" rel="noopener noreferrer">X</a>
          <a href="https://www.pinterest.fr/jacquemus" target="_blank" rel="noopener noreferrer">Pinterest</a>
        </div>
      </div>
    </div>
  );
}

function FooterBottom() {
  return (
    <div className="footer-bottom">
      <span className="footer-bottom-copy">© JACQUEMUS {new Date().getFullYear()}</span>
      <NavLink to="/" className="footer-bottom-logo" prefetch="intent">
        Jacquemus
      </NavLink>
      <div className="footer-bottom-right">
        <a href="#">Pays : France Métropolitaine (EUR)</a>
        <a href="#">Langage : français ∨</a>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Vérifier le footer dans le navigateur**

```bash
npm run dev
```

Scroller tout en bas de la homepage. Les 4 bandes doivent s'afficher :
1. 3 colonnes services (rendez-vous / livraison / paiement)
2. Newsletter (gauche) + Contact (droite)
3. Mentions légales / FAQ / Entreprise / Réseaux sociaux
4. Barre copyright avec logo centré

- [ ] **Step 3: Commit**

```bash
git add app/components/Footer.tsx
git commit -m "feat: footer 4 bandes style Jacquemus"
```

---

## Self-review

### Spec coverage
- ✅ Header transparent → blanc au scroll sur homepage uniquement (Task 2)
- ✅ Hero split 50/50 plein écran avec image campagne + produit star (Task 4)
- ✅ 4 grilles alternées ×4/×2 (Nouveautés, Sacs, PAP, Accessoires) (Task 5)
- ✅ Footer 4 bandes : services, newsletter/contact, nav légale, copyright (Task 6)
- ✅ Palette blanc minimaliste + typo sans-serif 200–300 + lettre-spacing (Task 1)
- ✅ Hover scale 1.03 sur images produit (Task 1 CSS)
- ✅ Add to cart directement depuis le hero (Task 4)
- ⚠️ Les handles Shopify pour les collections Sacs/PAP/Accessoires peuvent différer — les sections sont omises proprement si null

### Type consistency
- `GridProduct` → défini Task 3, utilisé dans `ProductCard` et `ProductGridSection` Task 5 ✅
- `HeroCollection` → défini Task 3, utilisé dans `HeroSection` Task 4 ✅
- `HomepageProductsData` → défini Task 3, utilisé dans `ProductSections` Task 5 ✅
- `cols: 2 | 4` → défini et utilisé de façon cohérente dans Task 5 ✅

### Placeholders
Aucun TBD, TODO, ou "fill in later" dans le plan.
