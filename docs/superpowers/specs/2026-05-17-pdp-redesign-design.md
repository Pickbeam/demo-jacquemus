# PDP Redesign — Design Spec

**Date:** 2026-05-17  
**Feature:** Redesign de la Product Detail Page (PDP)  
**Status:** Approved

---

## Résumé

Refonte visuelle de la PDP pour lui donner l'ADN Jacquemus : grande image à gauche en galerie verticale scrollable, panneau info sticky à droite (38%), description en 2 colonnes sous la grille. Aucune nouvelle dépendance — uniquement CSS + restructuration JSX.

---

## Décisions de design

| Dimension | Choix | Raison |
|---|---|---|
| Layout | C — grande image (62%) + panneau slim (38%) | Plus proche du site Jacquemus officiel, très premium |
| Images | Galerie verticale scrollable | Montre tous les angles, driver de conversion, pattern site officiel |
| Panneau | Sticky, overflow-y auto | Reste accessible pendant le scroll de la galerie |
| Description | 2 colonnes sous la grille (texte + détails) | Aérée, lisible, cohérente avec l'esthétique éditoriale |

---

## Layout général

```
┌─────────────────────────┬──────────────┐
│                         │  Vendor      │
│   Galerie verticale     │  Titre       │
│   (images empilées,     │  Prix        │
│   scroll)               │  ────        │
│                         │  Swatches    │
│   62% de largeur        │  Tailles     │
│                         │  [Ajouter]   │
│                         │  [Wishlist]  │
│                         │  LookComposer│
└─────────────────────────┴──────────────┘
┌──────────────────────────────────────────┐
│  Description (texte) │ Détails (liste)   │
└──────────────────────────────────────────┘
```

Sur mobile (< 720px) : colonne unique — image pleine largeur → panneau info → LookComposer → description.

---

## CSS — Classes à créer/modifier dans `app.css`

### `.product` (modifier)
```css
.product {
  display: grid;
  grid-template-columns: 1.6fr 1fr;
  min-height: 100vh;
  align-items: start;
}
@media (max-width: 45em) {
  .product { grid-template-columns: 1fr; }
}
```

### `.product-gallery` (nouveau)
```css
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
```

### `.product-main` (modifier)
```css
.product-main {
  padding: 28px 24px 32px;
  position: sticky;
  top: var(--header-height);
  max-height: calc(100vh - var(--header-height));
  overflow-y: auto;
  border-left: 1px solid #E8E3DC;
  background: #FDFAF6;
  align-self: start;
}
```

### `.product-vendor` (nouveau)
```css
.product-vendor {
  font-size: 6px;
  letter-spacing: 0.28em;
  text-transform: uppercase;
  color: #C9BFB2;
  margin-bottom: 8px;
}
```

### `.product h1` (modifier)
```css
.product h1 {
  font-size: clamp(22px, 3vw, 32px);
  font-weight: 300;
  letter-spacing: 0.04em;
  line-height: 1.15;
  color: #1a1a1a;
  margin: 0 0 4px;
}
```

### `.product-sep` (nouveau)
```css
.product-sep {
  width: 28px;
  height: 1px;
  background: #C9BFB2;
  margin: 14px 0;
}
```

### `.product-description` (nouveau — zone sous la grille)
```css
.product-description {
  grid-column: 1 / -1;
  border-top: 1px solid #E8E3DC;
  padding: 32px 0 40px;
  display: grid;
  grid-template-columns: 1.6fr 1fr;
  gap: 40px;
  align-items: start;
}
@media (max-width: 45em) {
  .product-description {
    grid-template-columns: 1fr;
    gap: 24px;
  }
}
.product-description-label {
  font-size: 7px;
  letter-spacing: 0.22em;
  text-transform: uppercase;
  color: #8a7d6e;
  margin-bottom: 12px;
}
.product-description-text {
  font-size: 11px;
  color: #555;
  line-height: 1.8;
  letter-spacing: 0.02em;
}
.product-description-details {
  font-size: 10px;
  color: #888;
  line-height: 2;
  list-style: none;
}
.product-description-details li::before {
  content: '— ';
  color: #C9BFB2;
}
```

---

## JSX — Restructuration de `products.$handle.tsx`

### Fragment GraphQL — ajouter `images`
```graphql
fragment Product on Product {
  ...
  images(first: 8) {
    nodes {
      url
      altText
      width
      height
    }
  }
}
```

### Nouveau JSX du composant `Product`
```tsx
<div className="product">
  {/* Galerie verticale */}
  <div className="product-gallery">
    {product.images.nodes.map((img, i) => (
      <img key={img.url} src={img.url} alt={img.altText ?? title} width={img.width ?? undefined} height={img.height ?? undefined} loading={i === 0 ? 'eager' : 'lazy'} />
    ))}
  </div>

  {/* Panneau sticky */}
  <div className="product-main">
    <p className="product-vendor">{product.vendor}</p>
    <h1>{title}</h1>
    <ProductPrice price={selectedVariant?.price} compareAtPrice={selectedVariant?.compareAtPrice} />
    <div className="product-sep" />
    <ProductForm productOptions={productOptions} selectedVariant={selectedVariant} />
    <LookComposer productTitle={title} tags={tags ?? []} productType={productType ?? ''} />
  </div>

  {/* Description pleine largeur — colonne gauche uniquement (aligne avec la galerie) */}
  <div className="product-description">
    <div>
      <p className="product-description-label">Description</p>
      <div className="product-description-text" dangerouslySetInnerHTML={{__html: descriptionHtml}} />
    </div>
  </div>
</div>
```

---

## Notes d'implémentation

- Supprimer l'import `ProductImage` et son usage — remplacé par la galerie inline
- Le `<br />` entre les sections est supprimé partout (l'espacement vient du CSS)
- `.product-description` utilise `grid-column: 1 / -1` pour s'étendre sur les 2 colonnes

## Périmètre exclu (hors scope)

- Zoom image au survol
- Lightbox / visionneuse plein écran
- Bouton wishlist (pas de compte client dans cette démo)
- Vidéo produit
- Avis clients
