# PDP Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refondre la PDP avec le layout Jacquemus : grande galerie verticale à gauche (62%), panneau sticky à droite (38%), description pleine largeur dessous.

**Architecture:** Deux changements indépendants — (1) CSS dans `app.css` pour les nouvelles classes et les modifications des existantes, (2) JSX dans `products.$handle.tsx` pour la galerie d'images, la restructuration du panneau et la zone description. Aucune nouvelle dépendance.

**Tech Stack:** Remix / React Router v7, Hydrogen, CSS natif (pas de CSS-in-JS)

---

## Fichiers

| Action | Chemin |
|---|---|
| Modifier | `app/styles/app.css` (lignes 911–965, section produit) |
| Modifier | `app/routes/($locale).products.$handle.tsx` |

---

## Task 1 : CSS — Layout et styles PDP

**Files:**
- Modify: `app/styles/app.css:911-965`

- [ ] **Step 1 : Remplacer le bloc `.product` et ses sous-classes**

Remplacer tout le bloc entre les commentaires `routes/products.$handle.tsx` et `routes/blog._index.tsx` (lignes 906–966) par :

```css
/*
* --------------------------------------------------
* routes/products.$handle.tsx
* --------------------------------------------------
*/
.product {
  display: grid;
  grid-template-columns: 1.6fr 1fr;
  align-items: start;
  min-height: 100vh;
}

@media (max-width: 45em) {
  .product {
    grid-template-columns: 1fr;
  }
}

/* Galerie verticale scrollable */
.product-gallery {
  display: flex;
  flex-direction: column;
  gap: 3px;
  background: #EDE8E1;
}

.product-gallery img {
  width: 100%;
  height: auto;
  display: block;
  object-fit: cover;
}

/* Panneau info sticky */
.product-main {
  position: sticky;
  top: var(--header-height);
  max-height: calc(100vh - var(--header-height));
  overflow-y: auto;
  padding: 28px 24px 32px;
  border-left: 1px solid #E8E3DC;
  background: #FDFAF6;
  align-self: start;
}

/* Vendor label */
.product-vendor {
  font-size: 6px;
  letter-spacing: 0.28em;
  text-transform: uppercase;
  color: #C9BFB2;
  margin: 0 0 8px;
}

/* Titre produit */
.product h1 {
  font-size: clamp(22px, 3vw, 32px);
  font-weight: 300;
  letter-spacing: 0.04em;
  line-height: 1.15;
  color: #1a1a1a;
  margin: 0 0 4px;
}

/* Séparateur graphique */
.product-sep {
  width: 28px;
  height: 1px;
  background: #C9BFB2;
  margin: 14px 0;
}

/* Prix */
.product-price-on-sale {
  display: flex;
  grid-gap: 0.5rem;
}

.product-price-on-sale s {
  opacity: 0.5;
}

/* Options (variants) */
.product-options-grid {
  display: flex;
  flex-wrap: wrap;
  grid-gap: 0.75rem;
}

.product-options-item,
.product-options-item:disabled {
  padding: 0.25rem 0.5rem;
  background-color: transparent;
  font-size: 1rem;
  font-family: inherit;
}

.product-option-label-swatch {
  width: 1.25rem;
  height: 1.25rem;
  margin: 0.25rem 0;
}

.product-option-label-swatch img {
  width: 100%;
}

/* Zone description pleine largeur (sous la grille) */
.product-description {
  grid-column: 1 / -1;
  border-top: 1px solid #E8E3DC;
  padding: 32px 0 48px;
}

.product-description-label {
  font-size: 7px;
  letter-spacing: 0.22em;
  text-transform: uppercase;
  color: #8a7d6e;
  margin: 0 0 12px;
}

.product-description-text {
  font-size: 11px;
  color: #555;
  line-height: 1.8;
  letter-spacing: 0.02em;
}

.product-description-text p {
  margin: 0 0 0.75em;
}
```

- [ ] **Step 2 : Vérifier qu'il n'y a pas d'erreur de syntaxe CSS**

```bash
npx tsc --noEmit 2>&1 | grep "app.css" | head -5
```

Attendu : aucune sortie (TypeScript n'analyse pas le CSS directement — cette commande confirme que le build TS tourne toujours).

- [ ] **Step 3 : Commit**

```bash
git add app/styles/app.css
git commit -m "style: PDP redesign — layout galerie + panneau sticky"
```

---

## Task 2 : JSX — Galerie, panneau restructuré, description

**Files:**
- Modify: `app/routes/($locale).products.$handle.tsx`

- [ ] **Step 1 : Ajouter `images` au fragment GraphQL `PRODUCT_FRAGMENT`**

Dans `PRODUCT_FRAGMENT` (après `productType`), ajouter :

```graphql
const PRODUCT_FRAGMENT = `#graphql
  fragment Product on Product {
    id
    title
    vendor
    handle
    descriptionHtml
    description
    tags
    productType
    images(first: 8) {
      nodes {
        url
        altText
        width
        height
      }
    }
    encodedVariantExistence
    ...
```

- [ ] **Step 2 : Régénérer les types Storefront**

```bash
cd /Users/belamrani/Projets/demo-jacquemus && npx shopify hydrogen codegen 2>&1 | tail -5
```

Attendu : `Generated X types` sans erreur. Cela met à jour `storefrontapi.generated.d.ts` avec le champ `images`.

- [ ] **Step 3 : Supprimer l'import `ProductImage` et mettre à jour les imports**

Remplacer :

```typescript
import {ProductPrice} from '~/components/ProductPrice';
import {ProductImage} from '~/components/ProductImage';
import {ProductForm} from '~/components/ProductForm';
import {LookComposer} from '~/components/LookComposer';
```

Par :

```typescript
import {ProductPrice} from '~/components/ProductPrice';
import {ProductForm} from '~/components/ProductForm';
import {LookComposer} from '~/components/LookComposer';
```

- [ ] **Step 4 : Extraire `images` dans le composant `Product`**

Modifier la ligne de destructuration (actuellement `const {title, descriptionHtml, tags, productType} = product;`) :

```typescript
const {title, descriptionHtml, tags, productType, images, vendor} = product;
```

- [ ] **Step 5 : Remplacer le JSX du composant `Product`**

Remplacer le `return (...)` entier par :

```tsx
return (
  <>
  <div className="product">
    {/* Galerie verticale */}
    <div className="product-gallery">
      {images.nodes.map((img, i) => (
        <img
          key={img.url}
          src={img.url}
          alt={img.altText ?? title}
          width={img.width ?? undefined}
          height={img.height ?? undefined}
          loading={i === 0 ? 'eager' : 'lazy'}
        />
      ))}
    </div>

    {/* Panneau sticky */}
    <div className="product-main">
      <p className="product-vendor">{vendor}</p>
      <h1>{title}</h1>
      <ProductPrice
        price={selectedVariant?.price}
        compareAtPrice={selectedVariant?.compareAtPrice}
      />
      <div className="product-sep" />
      <ProductForm
        productOptions={productOptions}
        selectedVariant={selectedVariant}
      />
      <LookComposer
        productTitle={title}
        tags={tags ?? []}
        productType={productType ?? ''}
      />
    </div>

    {/* Description pleine largeur */}
    <div className="product-description">
      <p className="product-description-label">Description</p>
      <div
        className="product-description-text"
        dangerouslySetInnerHTML={{__html: descriptionHtml}}
      />
    </div>

  </div>
  <Analytics.ProductView
    data={{
      products: [
        {
          id: product.id,
          title: product.title,
          price: selectedVariant?.price.amount || '0',
          vendor: product.vendor,
          variantId: selectedVariant?.id || '',
          variantTitle: selectedVariant?.title || '',
          quantity: 1,
        },
      ],
    }}
  />
  </>
);
```

- [ ] **Step 6 : Vérifier la compilation TypeScript**

```bash
cd /Users/belamrani/Projets/demo-jacquemus && npx tsc --noEmit 2>&1 | grep "products.\$handle" | head -10
```

Attendu : aucune erreur sur ce fichier.

- [ ] **Step 7 : Lancer le dev server et vérifier manuellement**

```bash
cd /Users/belamrani/Projets/demo-jacquemus && npm run dev
```

Ouvrir une PDP (ex: `/products/le-bambino`). Vérifier :
1. Galerie verticale à gauche — toutes les images du produit s'empilent
2. Panneau droit sticky — reste visible en scrollant la galerie
3. Vendor + titre grand (font-weight 300) + séparateur + options + CTA
4. LookComposer présent sous le CTA
5. Description pleine largeur sous la grille
6. Sur mobile (< 720px) : layout en colonne unique

- [ ] **Step 8 : Commit**

```bash
git add app/routes/\(\$locale\).products.\$handle.tsx
git commit -m "feat: PDP redesign — galerie verticale, panneau sticky, description pleine largeur"
```
