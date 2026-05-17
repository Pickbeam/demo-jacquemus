# Look Composer — Design Spec

**Date:** 2026-05-17  
**Feature:** Panneau "Compose le look complet" sur la PDP  
**Status:** Approved

---

## Résumé

Sur chaque PDP, un panneau "Compose le look complet" permet à l'utilisateur de déclencher un agent IA qui identifie 3–5 pièces Jacquemus compatibles avec le produit courant, vérifie leur disponibilité, et propose un ajout panier en un clic.

---

## Décisions de design

| Dimension | Choix | Raison |
|---|---|---|
| Placement | Section sous le CTA, scroll horizontal | Flow naturel de la PDP, cohérent avec les MiniProductCard du chat |
| Déclenchement | On-demand au clic | Pas de coût Anthropic à chaque visite |
| Sélection agent | Claude décide librement via MCP | Montre l'intelligence de l'agent dans la démo |
| Tailles | Premier variant `availableForSale` | Frictionless ; modifiable dans le panier |

---

## UI — États du panneau

### ① Idle
Le panneau affiche un bouton "Voir les suggestions →". Aucun appel réseau.

### ② Chargement (~2s)
Trois points animés + texte "L'agent compose votre look…". Skeleton card en fond.

### ③ Look composé
- Scroll horizontal de 3–5 `LookProductCard` (image 3:4, marque, titre, prix, badge disponibilité)
- Bouton pleine largeur "Ajouter le look entier" (noir)
- Note sous le bouton : "Tailles modifiables dans le panier"

---

## Architecture

### Nouveaux fichiers

**`app/routes/api.look-composer.tsx`**  
Action serveur SSE. Reçoit `{ productTitle, tags, productType }`. Orchestre les 3 étapes (voir Flow). Retourne les événements SSE `look`, `text`, `done`, `error`.

**`app/components/LookComposer.tsx`**  
Composant React client gérant les 3 états UI. Consomme le stream SSE de `/api/look-composer`. Utilise `CartForm` (Hydrogen) pour l'ajout panier multi-lignes.

### Fichiers modifiés

**`app/routes/($locale).products.$handle.tsx`**  
Ajout de `<LookComposer product={product} />` sous `<ProductForm>`. Le composant reçoit `{ title, tags, productType }` — données déjà disponibles dans le loader existant.

### Fichiers réutilisés sans modification

- `app/lib/shopify-mcp-client.ts` — `callShopifyMCPTool`, `parseProductsFromMCPResult`, `ShopifyMCPProduct`
- Pattern SSE (`ReadableStream` + `sseChunk`) de `app/routes/api.chat.tsx`

---

## Flow de l'agent (api.look-composer.tsx)

```
POST /api/look-composer
  { productTitle: "Le Bambino", tags: ["sac","cuir"], productType: "Bag" }

ÉTAPE 1 — Claude Haiku (non-streaming, max 60 tokens)
  Prompt : "Donne-moi 2-3 catégories de vêtements/accessoires qui complètent ce produit Jacquemus.
            Retourne un JSON : { searches: ["robe", "sandales", "ceinture"] }"
  → { searches: ["robe", "sandales", "ceinture"] }

ÉTAPE 2 — Shopify MCP (appels en parallèle via Promise.all)
  Pour chaque terme : callShopifyMCPTool(search_catalog, { query: terme })
  Filtre côté client : ne garde que les variants avec availableForSale = true
  Sélectionne le 1er variant disponible par résultat

ÉTAPE 3 — Claude Haiku (non-streaming, max 80 tokens)
  Reçoit la liste de candidats (titre + prix) par catégorie
  Sélectionne la pièce la plus cohérente par catégorie
  Génère 1 phrase d'ambiance en français (style Jacquemus)
  Retourne { selected: [...ids], phrase: "..." }

SSE events émis :
  event: look   → { products: ShopifyMCPProduct[] }
  event: text   → { text: string }   (phrase complète, pas de streaming — 1 seule phrase)
  event: done   → {}
  event: error  → { message: string }
```

---

## Ajout panier

Le bouton "Ajouter le look entier" utilise `CartForm` (Hydrogen) avec l'action `LinesAdd` :

```tsx
<CartForm
  route="/cart"
  action={CartForm.ACTIONS.LinesAdd}
  inputs={{
    lines: products.map(p => ({
      merchandiseId: p.variantId,
      quantity: 1,
    }))
  }}
>
```

Même pattern que `MiniCartButton` dans `ChatBar.tsx`. Le panier s'ouvre automatiquement après ajout via `useAside().open('cart')`.

---

## Gestion des erreurs

- Si MCP ne retourne aucun produit pour une catégorie : la catégorie est ignorée silencieusement
- Si le total de pièces trouvées < 2 : afficher "Nous n'avons pas trouvé de look complet pour ce produit"
- Si `ANTHROPIC_API_KEY` manquante : masquer le panneau entier (pas d'erreur visible utilisateur)

---

## Périmètre exclu (hors scope)

- Cache des looks générés (prévu pour une itération future)
- Sélection de taille dans le panneau (modifiable dans le panier)
- Historique des looks vus
- Version mobile dédiée (le scroll horizontal est adapté mobile)
