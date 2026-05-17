import {useState, useCallback, useRef} from 'react';
import {CartForm} from '@shopify/hydrogen';
import {useAside} from '~/components/Aside';
import type {FetcherWithComponents} from 'react-router';
import type {ShopifyMCPProduct} from '~/lib/shopify-mcp-client';

interface LookComposerProps {
  productTitle: string;
  tags: string[];
  productType: string;
}

type State = 'idle' | 'loading' | 'loaded' | 'error';

function AddLookButton({products}: {products: ShopifyMCPProduct[]}) {
  const {open} = useAside();
  const prev = useRef('idle');

  return (
    <CartForm
      route="/cart"
      action={CartForm.ACTIONS.LinesAdd}
      inputs={{
        lines: products.map((p) => ({merchandiseId: p.variantId, quantity: 1})),
      }}
    >
      {(fetcher: FetcherWithComponents<unknown>) => {
        if (prev.current !== 'idle' && fetcher.state === 'idle' && fetcher.data) {
          const d = fetcher.data as {errors?: unknown[]};
          if (!d.errors?.length) open('cart');
        }
        prev.current = fetcher.state;
        const loading = fetcher.state !== 'idle';
        return (
          <button
            type="submit"
            disabled={loading}
            style={{
              display: 'block',
              width: '100%',
              background: loading ? '#e8e2db' : '#1a1a1a',
              color: loading ? '#C4BAB0' : '#FDFAF6',
              border: 'none',
              padding: '10px 0',
              fontSize: '8px',
              letterSpacing: '0.2em',
              textTransform: 'uppercase',
              cursor: loading ? 'wait' : 'pointer',
              marginTop: '12px',
              borderRadius: '2px',
              transition: 'background 0.2s, color 0.2s',
            }}
          >
            {loading ? '···' : 'Ajouter le look entier'}
          </button>
        );
      }}
    </CartForm>
  );
}

function LookProductCard({product}: {product: ShopifyMCPProduct}) {
  return (
    <div
      style={{
        background: '#fff',
        border: '1px solid #E8E3DC',
        width: '100px',
        flexShrink: 0,
        borderRadius: '2px',
        overflow: 'hidden',
      }}
    >
      <div style={{aspectRatio: '3/4', overflow: 'hidden', background: '#EDE8E1'}}>
        {product.image && (
          <img
            src={product.image}
            alt={product.title}
            style={{width: '100%', height: '100%', objectFit: 'cover', display: 'block'}}
            loading="lazy"
          />
        )}
      </div>
      <div style={{padding: '6px 8px 8px'}}>
        <div
          style={{
            fontSize: '6px',
            letterSpacing: '0.2em',
            textTransform: 'uppercase',
            color: '#C9BFB2',
            marginBottom: '3px',
          }}
        >
          Jacquemus
        </div>
        <div
          style={{
            fontSize: '8px',
            fontWeight: 500,
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
            color: '#1a1a1a',
            lineHeight: 1.3,
            marginBottom: '4px',
          }}
        >
          {product.title.replace('Jacquemus ', '')}
        </div>
        {product.price > 0 && (
          <div style={{fontSize: '9px', color: '#555'}}>
            {product.price.toLocaleString('fr-FR')} €
          </div>
        )}
      </div>
    </div>
  );
}

export function LookComposer({productTitle, tags, productType}: LookComposerProps) {
  const [state, setState] = useState<State>('idle');
  const [products, setProducts] = useState<ShopifyMCPProduct[]>([]);
  const [phrase, setPhrase] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const compose = useCallback(async () => {
    if (state === 'loading') return;
    setState('loading');
    setProducts([]);
    setPhrase('');
    setErrorMsg('');

    try {
      const res = await fetch('/api/look-composer', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({productTitle, tags, productType}),
      });

      if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`);

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let currentEvent = '';

      while (true) {
        const {done, value} = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, {stream: true});
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          if (line.startsWith('event: ')) {
            currentEvent = line.slice(7).trim();
          } else if (line.startsWith('data: ')) {
            let data: Record<string, unknown>;
            try {
              data = JSON.parse(line.slice(6)) as Record<string, unknown>;
            } catch {
              continue;
            }
            if (currentEvent === 'look') {
              setProducts((data.products as ShopifyMCPProduct[]) ?? []);
              setState('loaded');
            } else if (currentEvent === 'text') {
              setPhrase(String(data.text ?? ''));
            } else if (currentEvent === 'error') {
              setErrorMsg(String(data.message ?? 'Une erreur est survenue.'));
              setState('error');
            }
          }
        }
      }
    } catch (err) {
      setErrorMsg(String(err));
      setState('error');
    }
  }, [productTitle, tags, productType, state]);

  return (
    <div
      style={{
        borderTop: '1px solid #E8E3DC',
        background: '#F5F1EB',
        padding: '14px 0 16px',
        marginTop: '24px',
      }}
    >
      <div
        style={{
          fontSize: '7px',
          letterSpacing: '0.22em',
          textTransform: 'uppercase',
          color: '#8a7d6e',
          marginBottom: '12px',
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
        }}
      >
        <span style={{color: '#c8a96e', fontSize: '10px'}}>✦</span>
        Compose le look complet
      </div>

      {state === 'idle' && (
        <button
          onClick={compose}
          style={{
            background: 'transparent',
            border: '1px solid #8a7d6e',
            color: '#8a7d6e',
            width: '100%',
            padding: '9px 0',
            fontSize: '7px',
            letterSpacing: '0.18em',
            textTransform: 'uppercase',
            cursor: 'pointer',
            borderRadius: '2px',
            transition: 'border-color 0.2s, color 0.2s',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = '#1a1a1a';
            e.currentTarget.style.color = '#1a1a1a';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = '#8a7d6e';
            e.currentTarget.style.color = '#8a7d6e';
          }}
        >
          Voir les suggestions →
        </button>
      )}

      {state === 'loading' && (
        <div style={{display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 0'}}>
          <span
            style={{
              width: '5px',
              height: '5px',
              borderRadius: '50%',
              background: '#C9BFB2',
              animation: 'lcPulse 1.2s infinite',
            }}
          />
          <span
            style={{
              width: '5px',
              height: '5px',
              borderRadius: '50%',
              background: '#C9BFB2',
              animation: 'lcPulse 1.2s infinite',
              animationDelay: '0.2s',
            }}
          />
          <span
            style={{
              width: '5px',
              height: '5px',
              borderRadius: '50%',
              background: '#C9BFB2',
              animation: 'lcPulse 1.2s infinite',
              animationDelay: '0.4s',
            }}
          />
          <span
            style={{
              fontSize: '8px',
              color: '#8a7d6e',
              letterSpacing: '0.12em',
              marginLeft: '4px',
            }}
          >
            L&apos;agent compose votre look…
          </span>
        </div>
      )}

      {state === 'loaded' && products.length > 0 && (
        <>
          {phrase && (
            <p
              style={{
                fontSize: '10px',
                color: '#555',
                lineHeight: 1.6,
                letterSpacing: '0.02em',
                marginBottom: '14px',
                fontStyle: 'italic',
              }}
            >
              {phrase}
            </p>
          )}
          <div style={{display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '4px'}}>
            {products.map((p) => (
              <LookProductCard key={p.id} product={p} />
            ))}
          </div>
          <AddLookButton products={products} />
          <p
            style={{
              fontSize: '6px',
              color: '#aaa',
              letterSpacing: '0.08em',
              textAlign: 'center',
              marginTop: '6px',
            }}
          >
            Tailles modifiables dans le panier
          </p>
        </>
      )}

      {state === 'error' && (
        <div>
          <p style={{fontSize: '9px', color: '#888', letterSpacing: '0.06em', marginBottom: '8px'}}>
            {errorMsg}
          </p>
          <button
            onClick={() => setState('idle')}
            style={{
              background: 'transparent',
              border: '1px solid #C9BFB2',
              color: '#8a7d6e',
              padding: '6px 14px',
              fontSize: '7px',
              letterSpacing: '0.14em',
              textTransform: 'uppercase',
              cursor: 'pointer',
              borderRadius: '2px',
            }}
          >
            Réessayer
          </button>
        </div>
      )}

      <style>{`
        @keyframes lcPulse {
          0%, 60%, 100% { opacity: 0.3; transform: scale(0.85); }
          30% { opacity: 1; transform: scale(1); }
        }
      `}</style>
    </div>
  );
}
