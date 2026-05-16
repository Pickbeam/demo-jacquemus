# Homepage Redesign — Design Spec
**Date:** 2026-05-16
**Status:** Approved

---

## Objectif

Retravailler la home page du site Jacquemus Hydrogen pour qu'elle adopte les codes visuels du luxe : espace blanc, typographie aérienne, grilles de produits éditoriales, footer riche. La page doit être immersive et minimaliste comme le vrai site Jacquemus.

---

## 1. Design System

### Palette
- **Fond** : blanc pur `#ffffff`
- **Texte principal** : noir `#000000`
- **Texte secondaire** : gris clair `#aaaaaa` / `#999999`
- **Fond produit** : écru chaud `#f0ede8` → `#e8e3dc` (dégradé)
- **Hero gauche** : noir profond `#1a1a1a` → `#0a0a0a`
- **Accent Personal Shopper** : or `#c8a96e`

### Typographie
- **Police** : `'Helvetica Neue', Arial, sans-serif` — aucune Google Font externe requise
- **Poids** : 200 (titres héro), 300 (corps, labels), 400 (bouton newsletter)
- **Labels / navigation** : `font-size: 9px`, `letter-spacing: 0.2–0.3em`, `text-transform: uppercase`
- **Titres hero** : `font-size: clamp(36px, 4.5vw, 64px)`, `font-weight: 200`, `line-height: 1.05`
- **Noms produits** : `font-size: 10px`, `letter-spacing: 0.12em`, uppercase
- **Prix** : `font-size: 10px`, `color: #aaa`, weight 300

---

## 2. Header

- Position `fixed`, hauteur `56px`
- **État transparent** sur le hero (texte blanc) → **état blanc** au scroll (`scrollY > 20`)
- Transition `background 0.3s ease`
- Structure : Logo (left) | Nav links (center) | CTAs (right)
- Nav : Collections, Sacs, Prêt-à-porter, Personal Shopper ✦ (accent or `#c8a96e`)
- CTAs : Search, Account, Cart (avec badge count)
- Implémentation : modifier `Header.tsx` — ajouter classe `scrolled` via `useEffect` + `window.addEventListener('scroll', ...)`

---

## 3. Hero — Split 50/50

Structure : `display: grid; grid-template-columns: 1fr 1fr; height: 100vh`

### Colonne gauche (image campagne)
- Image de la **featured collection** Shopify, `object-fit: cover`, pleine hauteur
- Label en haut à gauche : saison (ex. "SS 26 — La Collection"), `9px uppercase`
- En bas à gauche : grand titre `clamp(36px, 4.5vw, 64px)` weight 200, + CTA "Découvrir la collection" avec `border-bottom`
- Fond fallback : `#1a1a1a`

### Colonne droite (produit star)
- Image du **premier produit** de la featured collection, `object-fit: cover`, pleine hauteur
- Fond fallback : `#f0ede8`
- En bas : nom produit (uppercase 11px) + prix à gauche, lien "Add to cart" à droite
- Le lien "Add to cart" déclenche l'ajout au panier Shopify (réutiliser `AddToCartButton`)

---

## 4. Grilles de produits — Alternance ×4 / ×2

4 sections enchaînées sous le hero, avec header (label + lien "Voir tout") :

| Ordre | Label | Format | Produits |
|---|---|---|---|
| 1 | Nouveautés | ×4 | 4 derniers produits (tri UPDATED_AT) |
| 2 | Sacs iconiques | ×2 | 2 produits collection Sacs |
| 3 | Prêt-à-porter | ×4 | 4 produits collection PAP |
| 4 | Accessoires | ×2 | 2 produits collection Accessoires |

### Styles communs
- `gap: 2px` entre les cartes (joints quasi invisibles)
- Padding section : `72px 40px` (le premier commence à `72px`, les suivants à `0 + 72px`)
- **Ratio image** : ×4 → `aspect-ratio: 3/4` ; ×2 → `aspect-ratio: 4/5`
- Hover : `transform: scale(1.03)` sur l'image, `transition: 0.5s ease`
- Sous l'image : nom produit uppercase + prix gris, pas de fond de carte (blanc direct)
- Aucune bordure, aucune ombre

### Données Shopify
- Les 4 sections nécessitent 4 requêtes GraphQL séparées (ou une requête multi-collection)
- Réutiliser le pattern `loadDeferredData` existant dans `($locale)._index.tsx`
- Les collections "Sacs", "Prêt-à-porter", "Accessoires" sont identifiées par leur handle Shopify — les handles exacts doivent être vérifiés dans l'admin Shopify avant l'implémentation (ex. `bags`, `ready-to-wear`, `accessories`). En cas d'absence, fallback sur les 4 derniers produits mis à jour.

---

## 5. Footer — 4 bandes

### Bande 1 — Services (3 colonnes)
- Séparateurs verticaux `1px solid #e8e8e8`
- Centré, padding `60px 40px`
- 3 blocs : "Rendez-vous en boutique" / "Livraison et retours gratuits" / "Paiement sécurisé"
- Titre `13px weight 300` + description `12px color #aaa`

### Bande 2 — Newsletter + Contact (50/50)
- Séparateur vertical central `1px solid #e8e8e8`
- **Gauche — Newsletter** :
  - Titre "S'abonner à la newsletter ∨" (toggle expandable, `15px weight 300`)
  - Description gris + bouton noir pleine largeur "S'ENREGISTRER" (`9px uppercase`)
- **Droite — Contact** :
  - Titre "Besoin d'aide ? Contactez-nous" (`15px weight 300`)
  - Horaires en gris + 3 liens soulignés (Formulaire de contact, Suivre une commande, Enregistrer un retour)

### Bande 3 — Nav légale + Réseaux (4 colonnes)
- "Mentions légales et cookies ∨" / "FAQ ∨" / "Entreprise ∨" / "Suivez nous" avec liens sociaux inline
- Réseaux : Instagram, Facebook, Tiktok, X, Pinterest
- Tout en `12px weight 300`

### Bande 4 — Copyright bar
- Grille 3 colonnes : `1fr auto 1fr`
- Gauche : "© JACQUEMUS 2025" (10px gris)
- Centre : "JACQUEMUS" bold uppercase `14px` (logo textuel)
- Droite : "Pays : France Métropolitaine (EUR)" + "Langage : français ∨" (liens soulignés)

---

## 6. Fichiers à modifier

| Fichier | Changement |
|---|---|
| `app/routes/($locale)._index.tsx` | Refonte complète du composant Homepage + nouvelles requêtes GraphQL |
| `app/styles/app.css` | Remplacer les styles `.featured-collection`, `.recommended-products`, ajouter styles hero/grilles/footer |
| `app/components/Footer.tsx` | Remplacer entièrement par le nouveau footer 4 bandes |
| `app/components/Header.tsx` | Ajouter logique scroll transparent → blanc |

---

## 7. Contraintes

- Pas de dépendances CSS externes (pas de Tailwind pour ces composants, CSS pur dans `app.css`)
- Compatibilité avec le système de données Shopify existant (Hydrogen, `@shopify/hydrogen`)
- Conserver le `ChatBar` et l'`Aside` (panier, recherche, menu mobile) — non touchés
- Le Personal Shopper reste accessible via le header nav (lien existant)
- Responsive mobile : hors scope de cette spec (desktop first)
