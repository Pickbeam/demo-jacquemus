import {useEffect, useRef, useState, useCallback} from 'react';
import {CartForm} from '@shopify/hydrogen';
import {useAside} from '~/components/Aside';
import type {FetcherWithComponents} from 'react-router';

interface SuggestionProduct {
  id: string;
  title: string;
  price: number;
  image: string;
  variantId: string;
}

interface CartSuggestionProps {
  cartTitles: string[];
}

function AddSuggestionButton({variantId}: {variantId: string}) {
  const {open} = useAside();
  const prev = useRef('idle');

  return (
    <CartForm
      route="/cart"
      action={CartForm.ACTIONS.LinesAdd}
      inputs={{lines: [{merchandiseId: variantId, quantity: 1}]}}
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
              background: 'transparent',
              border: 'none',
              borderBottom: `1px solid ${loading ? '#ccc' : '#1a1a1a'}`,
              color: loading ? '#ccc' : '#1a1a1a',
              padding: '0 0 2px',
              fontSize: '7px',
              letterSpacing: '0.14em',
              textTransform: 'uppercase',
              cursor: loading ? 'wait' : 'pointer',
              marginTop: '10px',
              transition: 'opacity 0.2s',
              fontFamily: 'inherit',
            }}
          >
            {loading ? '···' : 'Ajouter →'}
          </button>
        );
      }}
    </CartForm>
  );
}

export function CartSuggestion({cartTitles}: CartSuggestionProps) {
  const [phrase, setPhrase] = useState('');
  const [product, setProduct] = useState<SuggestionProduct | null>(null);
  const [loading, setLoading] = useState(false);
  const keyRef = useRef('');

  const fetchSuggestion = useCallback(async (titles: string[]) => {
    setLoading(true);
    setPhrase('');
    setProduct(null);

    try {
      const res = await fetch('/api/cart-suggestion', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({cartTitles: titles}),
      });
      if (!res.ok || !res.body) return;

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
            if (currentEvent === 'text') setPhrase(String(data.text ?? ''));
            if (currentEvent === 'product')
              setProduct(data.product as SuggestionProduct);
          }
        }
      }
    } catch {
      // silent — suggestion is optional UX enhancement
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!cartTitles.length) {
      setProduct(null);
      setPhrase('');
      return;
    }
    const key = [...cartTitles].sort().join('|');
    if (key === keyRef.current) return;
    keyRef.current = key;
    void fetchSuggestion(cartTitles);
  }, [cartTitles, fetchSuggestion]);

  if (!cartTitles.length && !loading) return null;

  return (
    <div
      style={{
        borderTop: '1px solid #f0ede8',
        padding: '18px 20px 20px',
        marginTop: '4px',
      }}
    >
      <p
        style={{
          fontSize: '7px',
          letterSpacing: '0.24em',
          textTransform: 'uppercase',
          color: '#aaa',
          margin: '0 0 12px',
        }}
      >
        La pièce manquante
      </p>

      {loading && (
        <div style={{display: 'flex', gap: '4px', alignItems: 'center', padding: '4px 0'}}>
          {[0, 0.2, 0.4].map((delay, i) => (
            <span
              key={i}
              style={{
                width: '4px',
                height: '4px',
                borderRadius: '50%',
                background: '#ccc',
                animation: `lcPulse 1.2s ${delay}s infinite`,
              }}
            />
          ))}
        </div>
      )}

      {!loading && product && (
        <div style={{display: 'flex', gap: '14px', alignItems: 'flex-start'}}>
          <div
            style={{
              width: '72px',
              flexShrink: 0,
              aspectRatio: '3/4',
              overflow: 'hidden',
              background: '#f0ede8',
            }}
          >
            {product.image && (
              <img
                src={product.image}
                alt={product.title}
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover',
                  display: 'block',
                }}
                loading="lazy"
              />
            )}
          </div>
          <div style={{flex: 1, minWidth: 0}}>
            {phrase && (
              <p
                style={{
                  fontSize: '9px',
                  color: '#888',
                  lineHeight: 1.6,
                  fontStyle: 'italic',
                  margin: '0 0 8px',
                  letterSpacing: '0.02em',
                }}
              >
                {phrase}
              </p>
            )}
            <p
              style={{
                fontSize: '8px',
                fontWeight: 500,
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
                color: '#1a1a1a',
                margin: '0 0 2px',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {product.title.replace('Jacquemus ', '')}
            </p>
            {product.price > 0 && (
              <p
                style={{
                  fontSize: '8px',
                  color: '#999',
                  margin: '0',
                  letterSpacing: '0.02em',
                }}
              >
                {product.price.toLocaleString('fr-FR')} €
              </p>
            )}
            <AddSuggestionButton variantId={product.variantId} />
          </div>
        </div>
      )}
    </div>
  );
}
