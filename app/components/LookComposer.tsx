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
    <div style={{width: '88px', flexShrink: 0}}>
      <div style={{aspectRatio: '3/4', overflow: 'hidden', background: '#f0ede8', marginBottom: '6px'}}>
        {product.image && (
          <img
            src={product.image}
            alt={product.title}
            style={{width: '100%', height: '100%', objectFit: 'cover', display: 'block'}}
            loading="lazy"
          />
        )}
      </div>
      <div
        style={{
          fontSize: '8px',
          letterSpacing: '0.04em',
          color: '#1a1a1a',
          lineHeight: 1.3,
          marginBottom: '2px',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}
      >
        {product.title.replace('Jacquemus ', '')}
      </div>
      {product.price > 0 && (
        <div style={{fontSize: '8px', color: '#999', letterSpacing: '0.02em'}}>
          {product.price.toLocaleString('fr-FR')} €
        </div>
      )}
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
    <div style={{borderTop: '1px solid #e8e8e8', marginTop: '28px', paddingTop: '20px'}}>
      <div
        style={{
          fontSize: '7px',
          letterSpacing: '0.24em',
          textTransform: 'uppercase',
          color: '#aaa',
          marginBottom: '14px',
        }}
      >
        Le look complet
      </div>

      {state === 'idle' && (
        <button
          onClick={compose}
          style={{
            background: 'transparent',
            border: 'none',
            borderBottom: '1px solid #1a1a1a',
            color: '#1a1a1a',
            padding: '0 0 3px',
            fontSize: '8px',
            letterSpacing: '0.14em',
            textTransform: 'uppercase',
            cursor: 'pointer',
            transition: 'opacity 0.2s',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.opacity = '0.5')}
          onMouseLeave={(e) => (e.currentTarget.style.opacity = '1')}
        >
          Composer mon look →
        </button>
      )}

      {state === 'loading' && (
        <div style={{display: 'flex', alignItems: 'center', gap: '5px', padding: '2px 0'}}>
          {[0, 0.25, 0.5].map((delay, i) => (
            <span
              key={i}
              style={{
                width: '4px',
                height: '4px',
                borderRadius: '50%',
                background: '#bbb',
                animation: 'lcPulse 1.2s infinite',
                animationDelay: `${delay}s`,
              }}
            />
          ))}
          <span style={{fontSize: '8px', color: '#aaa', letterSpacing: '0.1em', marginLeft: '6px'}}>
            Composition en cours…
          </span>
        </div>
      )}

      {state === 'loaded' && products.length > 0 && (
        <>
          {phrase && (
            <p
              style={{
                fontSize: '9px',
                color: '#888',
                lineHeight: 1.7,
                letterSpacing: '0.02em',
                marginBottom: '16px',
                fontStyle: 'italic',
              }}
            >
              {phrase}
            </p>
          )}
          <div style={{display: 'flex', gap: '10px', overflowX: 'auto', paddingBottom: '2px', marginBottom: '2px'}}>
            {products.map((p) => (
              <LookProductCard key={p.id} product={p} />
            ))}
          </div>
          <AddLookButton products={products} />
          <p style={{fontSize: '7px', color: '#bbb', letterSpacing: '0.06em', textAlign: 'center', marginTop: '8px'}}>
            Tailles modifiables dans le panier
          </p>
        </>
      )}

      {state === 'error' && (
        <div>
          <p style={{fontSize: '9px', color: '#999', letterSpacing: '0.04em', marginBottom: '10px'}}>
            {errorMsg}
          </p>
          <button
            onClick={() => setState('idle')}
            style={{
              background: 'transparent',
              border: 'none',
              borderBottom: '1px solid #aaa',
              color: '#aaa',
              padding: '0 0 2px',
              fontSize: '7px',
              letterSpacing: '0.14em',
              textTransform: 'uppercase',
              cursor: 'pointer',
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
