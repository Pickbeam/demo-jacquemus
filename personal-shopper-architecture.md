# Personal Shopper — Architecture

## Résumé

Le Personal Shopper est un **pipeline à 3 étapes** déclenché par chaque message utilisateur :

1. **Claude Haiku** lit le message en français et extrait des paramètres de recherche structurés (query en anglais, prix min/max)
2. **Shopify MCP** reçoit ces paramètres via JSON-RPC et retourne des produits du catalogue
3. **Claude Haiku** (à nouveau) génère une réponse élégante en français, streamée mot par mot

La réponse arrive en **SSE (Server-Sent Events)** : les logs de débogage, les produits et le texte sont envoyés progressivement au navigateur.

---

## Schéma d'architecture

```
┌─────────────────────────────────────────────────────────────────┐
│  NAVIGATEUR                                                      │
│                                                                  │
│  ChatBar.tsx / personal-shopper.tsx                             │
│  ┌─────────────────────────────────────────┐                    │
│  │  Input utilisateur (fr)                 │                    │
│  │  "un sac rouge à moins de 600€"         │                    │
│  └───────────────────┬─────────────────────┘                    │
│                      │ POST /api/chat  {message}                │
└──────────────────────┼──────────────────────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────────────────────┐
│  SERVEUR  (Remix / React Router)                                 │
│                                                                  │
│  app/routes/api.chat.tsx                                        │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ ÉTAPE 1 — Extraction des paramètres                      │   │
│  │                                                          │   │
│  │  Anthropic SDK                                           │   │
│  │  model: claude-haiku-4-5  (non-streaming, max 80 tokens) │   │
│  │  system: PARSE_PROMPT                                    │   │
│  │                                                          │   │
│  │  "un sac rouge à moins de 600€"                          │   │
│  │     → {"query":"red bag","price_max":600}                │   │
│  └──────────────────────┬───────────────────────────────────┘   │
│                         │                                        │
│  ┌──────────────────────▼───────────────────────────────────┐   │
│  │ ÉTAPE 2 — Recherche produits via Shopify MCP             │   │
│  │                                                          │   │
│  │  shopify-mcp-client.ts                                   │   │
│  │                                                          │   │
│  │  POST https://{store}/api/mcp                            │   │
│  │  Header: X-Shopify-Storefront-Access-Token               │   │
│  │  Body: JSON-RPC 2.0                                      │   │
│  │   { method: "tools/call",                                │   │
│  │     params: { name: "search_catalog",                    │   │
│  │               arguments: { catalog: {query, filters} }}} │   │
│  │                                                          │   │
│  │     → []{id, title, price, image, variantId, ...}        │   │
│  └──────────────────────┬───────────────────────────────────┘   │
│                         │                                        │
│  ┌──────────────────────▼───────────────────────────────────┐   │
│  │ ÉTAPE 3 — Génération de la réponse                       │   │
│  │                                                          │   │
│  │  Anthropic SDK  (streaming)                              │   │
│  │  model: claude-haiku-4-5  (max 150 tokens)               │   │
│  │  system: RESPONSE_PROMPT                                 │   │
│  │                                                          │   │
│  │  → stream de tokens (1-2 phrases en français élégant)    │   │
│  └──────────────────────┬───────────────────────────────────┘   │
│                         │                                        │
│  SSE (ReadableStream) ──┘  events: log | products | text | done │
└──────────────────────────────────────────────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────────────────────┐
│  NAVIGATEUR — SSE reader (ChatBar.tsx)                          │
│                                                                  │
│  event: log      → panneau de débogage (timeline)              │
│  event: products → affichage des MiniProductCard               │
│  event: text     → texte streamé mot par mot dans le chat      │
│  event: done     → fin du chargement                           │
└─────────────────────────────────────────────────────────────────┘
```

---

## Points clés

| Aspect | Détail |
|---|---|
| **Modèle** | `claude-haiku-4-5` — rapide et économique pour les 2 appels |
| **Appel 1** | Non-streaming, extraction JSON pure (80 tokens max) |
| **Appel 2** | Streaming `messages.stream()`, tokens envoyés en SSE au fur et à mesure |
| **MCP** | JSON-RPC 2.0 sur l'endpoint natif Shopify `/api/mcp` |
| **Auth MCP** | Header `X-Shopify-Storefront-Access-Token` (côté serveur uniquement) |
| **SSE keepalive** | Ping toutes les 4s pour éviter les timeouts proxy |

---

## Fichiers concernés

| Fichier | Rôle |
|---|---|
| `app/components/ChatBar.tsx` | UI flottante, lecteur SSE, affichage des produits |
| `app/routes/($locale).personal-shopper.tsx` | Page dédiée avec panneau de débogage |
| `app/routes/api.chat.tsx` | Action serveur — orchestre les 3 étapes |
| `app/lib/shopify-mcp-client.ts` | Client JSON-RPC pour l'endpoint MCP Shopify |
