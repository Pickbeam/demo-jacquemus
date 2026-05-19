# Size Guide Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ajouter sur la PDP un guide des tailles cross-marques : l'utilisateur renseigne sa marque habituelle et sa taille, Claude retourne la taille Jacquemus recommandée avec une explication.

**Architecture:** Deux changements — (1) `api.size-guide.tsx` endpoint JSON (pas de SSE, réponse rapide) : Claude connaît les équivalences de sizing et retourne la taille recommandée; (2) `SizeGuide.tsx` composant inline sur la PDP qui s'expand au clic et affiche le résultat. Ajout du composant dans `products.$handle.tsx` entre ProductForm et LookComposer.

**Tech Stack:** React Router v7, Anthropic SDK (claude-haiku-4-5-20251001), JSON response, CSS inline

---

## Fichiers

| Action | Chemin |
|---|---|
| Créer | `app/routes/api.size-guide.tsx` |
| Créer | `app/components/SizeGuide.tsx` |
| Modifier | `app/routes/($locale).products.$handle.tsx` |

---

## Task 1 : API JSON — size guide endpoint

**Files:**
- Create: `app/routes/api.size-guide.tsx`

- [ ] **Step 1 : Créer le fichier `app/routes/api.size-guide.tsx`**

```typescript
import type {Route} from './+types/api.size-guide';
import Anthropic from '@anthropic-ai/sdk';

const SIZING_PROMPT = `Tu es un expert du sizing pour les marques de mode françaises et internationales.

À propos de Jacquemus :
- Jacquemus taille petit : généralement 1 taille en-dessous par rapport aux marques standard françaises/européennes
- Les pièces structurées (robes ajustées, bodysuits, pantalons) taillent le plus petit
- Les pièces fluides et oversized taillent plus normalement

Correspondances par marque :
- Taillent PETIT comme Jacquemus → garder la même taille Jacquemus :
  Sandro, Maje, AMI Paris, A.P.C., Rouje (pour leurs pièces ajustées)
- Taillent NORMALEMENT → prendre 1 taille au-dessus chez Jacquemus :
  Isabel Marant, Arket, COS, & Other Stories, Toteme, Uniqlo, Rouje (fluide)
- Taillent GRAND → garder la même taille chez Jacquemus (ou 1 en-dessous) :
  Zara, H&M, Mango, Bershka, ASOS

Tailles Jacquemus : 34 (XS), 36 (S), 38 (M), 40 (L), 42 (XL), 44 (XXL)

Retourne UNIQUEMENT du JSON valide :
{"jacquemusSize": "38", "note": "1 phrase courte et rassurante en français."}
La note doit mentionner la marque de référence. Maximum 15 mots.`;

export async function action({request, context}: Route.ActionArgs) {
  const {brand, size} = (await request.json()) as {brand: string; size: string};
  const env = context.env as unknown as Record<string, string | undefined>;
  const anthropicKey = env.ANTHROPIC_API_KEY ?? '';

  if (!anthropicKey || anthropicKey.startsWith('sk-ant-REPLACE')) {
    return Response.json({error: 'ANTHROPIC_API_KEY not configured'}, {status: 500});
  }

  const client = new Anthropic({apiKey: anthropicKey});

  const msg = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 100,
    system: SIZING_PROMPT,
    messages: [
      {role: 'user', content: `Marque habituelle : ${brand}, Taille habituelle : ${size}`},
    ],
  });

  const rawJson =
    msg.content[0]?.type === 'text' ? msg.content[0].text.trim() : '{}';

  let parsed: {jacquemusSize?: string; note?: string} = {};
  try {
    parsed = JSON.parse(rawJson) as typeof parsed;
  } catch {
    parsed = {};
  }

  return Response.json({
    jacquemusSize: parsed.jacquemusSize ?? size,
    note: parsed.note ?? '',
  });
}
```

- [ ] **Step 2 : Générer les types React Router**

```bash
cd /Users/belamrani/Projets/demo-jacquemus && npm run typecheck 2>&1 | tail -6
```

Attendu : `react-router typegen` génère `.react-router/types/app/routes/+types/api.size-guide.ts`.

- [ ] **Step 3 : Vérifier le fichier de types**

```bash
ls /Users/belamrani/Projets/demo-jacquemus/.react-router/types/app/routes/+types/api.size-guide.ts
```

Attendu : le fichier existe.

---

## Task 2 : Composant SizeGuide

**Files:**
- Create: `app/components/SizeGuide.tsx`

- [ ] **Step 1 : Créer le fichier `app/components/SizeGuide.tsx`**

```tsx
import {useState} from 'react';

const BRANDS = [
  'Sandro',
  'Maje',
  'Isabel Marant',
  'Rouje',
  'Arket',
  'COS',
  '& Other Stories',
  'Toteme',
  'Zara',
  'H&M',
  'Mango',
  'Uniqlo',
  'ASOS',
  'AMI Paris',
  'A.P.C.',
];

const SIZES = ['XS', 'S', 'M', 'L', 'XL', '34', '36', '38', '40', '42', '44'];

interface SizeGuideResult {
  jacquemusSize: string;
  note: string;
}

export function SizeGuide() {
  const [expanded, setExpanded] = useState(false);
  const [brand, setBrand] = useState('');
  const [size, setSize] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<SizeGuideResult | null>(null);

  const submit = async () => {
    if (!brand || !size || loading) return;
    setLoading(true);
    setResult(null);

    try {
      const res = await fetch('/api/size-guide', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({brand, size}),
      });
      const data = (await res.json()) as SizeGuideResult;
      setResult(data);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  };

  const toggle = () => {
    setExpanded((v) => !v);
    setResult(null);
    setBrand('');
    setSize('');
  };

  const selectStyle: React.CSSProperties = {
    background: '#fff',
    border: '1px solid #e8e8e8',
    padding: '8px 10px',
    fontSize: '10px',
    color: '#1a1a1a',
    outline: 'none',
    cursor: 'pointer',
    borderRadius: '2px',
    fontFamily: 'inherit',
    appearance: 'none',
    WebkitAppearance: 'none',
  };

  return (
    <div style={{marginTop: '10px', marginBottom: '2px'}}>
      <button
        onClick={toggle}
        style={{
          background: 'transparent',
          border: 'none',
          padding: 0,
          fontSize: '8px',
          color: '#aaa',
          letterSpacing: '0.12em',
          textTransform: 'uppercase',
          cursor: 'pointer',
          textDecoration: 'underline',
          textUnderlineOffset: '3px',
          transition: 'color 0.2s',
          fontFamily: 'inherit',
        }}
        onMouseEnter={(e) => (e.currentTarget.style.color = '#1a1a1a')}
        onMouseLeave={(e) => (e.currentTarget.style.color = '#aaa')}
      >
        {expanded ? 'Fermer le guide' : 'Guide des tailles →'}
      </button>

      {expanded && (
        <div
          style={{
            marginTop: '12px',
            padding: '16px',
            background: '#f8f6f2',
            borderRadius: '2px',
          }}
        >
          <p
            style={{
              fontSize: '7px',
              letterSpacing: '0.22em',
              textTransform: 'uppercase',
              color: '#aaa',
              margin: '0 0 12px',
            }}
          >
            Votre taille habituelle
          </p>

          <div style={{display: 'flex', gap: '8px', marginBottom: '10px', alignItems: 'stretch'}}>
            <select
              value={brand}
              onChange={(e) => {
                setBrand(e.target.value);
                setResult(null);
              }}
              style={{...selectStyle, flex: 1}}
            >
              <option value="">Marque</option>
              {BRANDS.map((b) => (
                <option key={b} value={b}>
                  {b}
                </option>
              ))}
            </select>

            <select
              value={size}
              onChange={(e) => {
                setSize(e.target.value);
                setResult(null);
              }}
              style={{...selectStyle, width: '72px'}}
            >
              <option value="">Taille</option>
              {SIZES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>

            <button
              onClick={() => void submit()}
              disabled={!brand || !size || loading}
              style={{
                background: brand && size && !loading ? '#1a1a1a' : '#e8e8e8',
                color: brand && size && !loading ? '#fff' : '#bbb',
                border: 'none',
                padding: '0 16px',
                fontSize: '8px',
                letterSpacing: '0.12em',
                cursor: brand && size && !loading ? 'pointer' : 'default',
                transition: 'background 0.2s, color 0.2s',
                borderRadius: '2px',
                fontFamily: 'inherit',
                whiteSpace: 'nowrap',
              }}
            >
              {loading ? '···' : '→'}
            </button>
          </div>

          {result && (
            <div
              style={{
                borderTop: '1px solid #e8e8e8',
                paddingTop: '12px',
              }}
            >
              <p
                style={{
                  fontSize: '14px',
                  fontWeight: 300,
                  color: '#1a1a1a',
                  margin: '0 0 5px',
                  letterSpacing: '0.02em',
                  lineHeight: 1.2,
                }}
              >
                Prenez un(e){' '}
                <strong style={{fontWeight: 500}}>{result.jacquemusSize}</strong>{' '}
                Jacquemus
              </p>
              {result.note && (
                <p
                  style={{
                    fontSize: '9px',
                    color: '#888',
                    lineHeight: 1.6,
                    margin: 0,
                    fontStyle: 'italic',
                    letterSpacing: '0.02em',
                  }}
                >
                  {result.note}
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2 : Vérifier la compilation**

```bash
cd /Users/belamrani/Projets/demo-jacquemus && npx tsc --noEmit 2>&1 | grep "SizeGuide" | head -5
```

Attendu : aucune erreur.

---

## Task 3 : Intégrer SizeGuide dans la PDP

**Files:**
- Modify: `app/routes/($locale).products.$handle.tsx`

- [ ] **Step 1 : Ajouter l'import SizeGuide**

En haut de `app/routes/($locale).products.$handle.tsx`, ajouter après les imports existants :

```typescript
import {SizeGuide} from '~/components/SizeGuide';
```

- [ ] **Step 2 : Insérer SizeGuide dans le panneau produit**

Dans le composant `Product`, dans le panneau sticky `.product-main`, insérer `<SizeGuide />` après `<ProductForm>` et avant `<LookComposer>`.

Remplacer :
```tsx
          <ProductForm
            productOptions={productOptions}
            selectedVariant={selectedVariant}
          />
          <LookComposer
```

Par :
```tsx
          <ProductForm
            productOptions={productOptions}
            selectedVariant={selectedVariant}
          />
          <SizeGuide />
          <LookComposer
```

- [ ] **Step 3 : Vérifier la compilation complète**

```bash
cd /Users/belamrani/Projets/demo-jacquemus && npx tsc --noEmit 2>&1 | grep -E "error TS" | head -10
```

Attendu : aucune erreur TS.

- [ ] **Step 4 : Commit**

```bash
cd /Users/belamrani/Projets/demo-jacquemus && git add app/routes/api.size-guide.tsx app/components/SizeGuide.tsx app/routes/\(\$locale\).products.\$handle.tsx && git commit -m "feat: size guide — Claude recommande la taille Jacquemus depuis la marque habituelle"
```
