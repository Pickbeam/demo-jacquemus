import {useState, useRef, useCallback, useEffect} from 'react';
import {CartForm} from '@shopify/hydrogen';
import {useAside} from '~/components/Aside';
import type {FetcherWithComponents} from 'react-router';
import type {ShopifyMCPProduct} from '~/lib/shopify-mcp-client';

interface ChatMessage {
  id: string;
  role: 'user' | 'agent';
  content: string;
  products?: ShopifyMCPProduct[];
}

function MiniCartButton({variantId}: {variantId: string}) {
  const {open} = useAside();
  const prev = useRef('idle');
  if (!variantId) return null;
  return (
    <CartForm route="/cart" inputs={{lines: [{merchandiseId: variantId, quantity: 1}]}} action={CartForm.ACTIONS.LinesAdd}>
      {(fetcher: FetcherWithComponents<unknown>) => {
        if (prev.current !== 'idle' && fetcher.state === 'idle' && fetcher.data) {
          const d = fetcher.data as {errors?: unknown[]};
          if (!d.errors?.length) open('cart');
        }
        prev.current = fetcher.state;
        const loading = fetcher.state !== 'idle';
        return (
          <button type="submit" disabled={loading} style={{display: 'block', width: '100%', background: 'transparent', color: loading ? '#C9BFB2' : '#1a1a1a', border: `1px solid ${loading ? '#ddd6cc' : '#1a1a1a'}`, padding: '6px 0', fontSize: '7px', letterSpacing: '0.16em', textTransform: 'uppercase', cursor: loading ? 'wait' : 'pointer', marginTop: '8px', transition: 'border-color 0.2s, color 0.2s'}}>
            {loading ? '···' : 'Ajouter'}
          </button>
        );
      }}
    </CartForm>
  );
}

function MiniProductCard({product}: {product: ShopifyMCPProduct}) {
  return (
    <div style={{background: '#fff', border: '1px solid #E8E3DC', width: '130px', flexShrink: 0, overflow: 'hidden'}}>
      <div style={{aspectRatio: '3/4', overflow: 'hidden', background: '#F0ECE5'}}>
        {product.image && (
          <img src={product.image} alt={product.title} style={{width: '100%', height: '100%', objectFit: 'cover', display: 'block'}} loading="lazy" />
        )}
      </div>
      <div style={{padding: '9px 10px 12px', display: 'flex', flexDirection: 'column', flex: 1}}>
        <div style={{fontSize: '7px', letterSpacing: '0.2em', textTransform: 'uppercase', color: '#C9BFB2', marginBottom: '4px'}}>Jacquemus</div>
        <div style={{fontSize: '9px', fontWeight: 500, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#1a1a1a', lineHeight: 1.35, marginBottom: '5px'}}>{product.title.replace('Jacquemus ', '')}</div>
        {product.price > 0 && <div style={{fontSize: '10px', color: '#1a1a1a', letterSpacing: '0.02em', flex: 1}}>{product.price.toLocaleString('fr-FR')} €</div>}
        <MiniCartButton variantId={product.variantId} />
      </div>
    </div>
  );
}

export function ChatBar() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const agentIdRef = useRef('');

  useEffect(() => {
    if (isOpen) messagesEndRef.current?.scrollIntoView({behavior: 'smooth'});
  }, [messages, isOpen]);

  const send = useCallback(async (text: string) => {
    if (!text.trim() || isLoading) return;
    setIsLoading(true);
    setIsOpen(true);
    setInput('');

    const userMsg: ChatMessage = {id: `u-${Date.now()}`, role: 'user', content: text};
    const agentId = `a-${Date.now()}`;
    agentIdRef.current = agentId;
    const agentMsg: ChatMessage = {id: agentId, role: 'agent', content: ''};

    setMessages((prev) => [...prev, userMsg, agentMsg]);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({message: text}),
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
            try { data = JSON.parse(line.slice(6)) as Record<string, unknown>; } catch { continue; }

            if (currentEvent === 'text') {
              const delta = String(data.delta ?? '');
              setMessages((prev) => prev.map((m) => m.id === agentId ? {...m, content: m.content + delta} : m));
            } else if (currentEvent === 'products') {
              const products = (data.products as ShopifyMCPProduct[]) ?? [];
              setMessages((prev) => prev.map((m) => m.id === agentId ? {...m, products} : m));
            } else if (currentEvent === 'error') {
              setMessages((prev) => prev.map((m) => m.id === agentId ? {...m, content: `Erreur : ${String(data.message ?? '')}`} : m));
            }
          }
        }
      }
    } catch (err) {
      setMessages((prev) => prev.map((m) => m.id === agentIdRef.current ? {...m, content: `Erreur : ${String(err)}`} : m));
    } finally {
      setIsLoading(false);
    }
  }, [isLoading]);

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !isLoading) send(input.trim());
  };

  const BAR_H = 60;
  const BAR_BOTTOM = 20;
  const SIDE = 32;

  return (
    <>
      {/* Chat history panel */}
      {isOpen && (
        <div style={{
          position: 'fixed',
          bottom: BAR_BOTTOM + BAR_H + 10,
          left: SIDE,
          right: SIDE,
          background: '#fff',
          borderRadius: '14px',
          maxHeight: '420px',
          display: 'flex',
          flexDirection: 'column',
          zIndex: 8,
          boxShadow: '0 8px 48px rgba(0,0,0,0.14), 0 2px 12px rgba(0,0,0,0.08)',
          border: '1px solid #ece9e4',
          overflow: 'hidden',
        }}>
          {/* Panel header */}
          <div style={{
            padding: '14px 22px',
            borderBottom: '1px solid #f0ede8',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexShrink: 0,
            background: '#faf9f7',
          }}>
            <span style={{fontSize: '9px', fontWeight: 400, letterSpacing: '0.22em', textTransform: 'uppercase', color: '#1a1a1a'}}>
              Personal Shopper <span style={{color: '#c8a96e', fontSize: '10px'}}>✦</span>
            </span>
            <button
              onClick={() => setIsOpen(false)}
              style={{background: 'none', border: 'none', fontSize: '20px', color: '#ccc', cursor: 'pointer', lineHeight: 1, padding: '0 2px', transition: 'color 0.15s'}}
              onMouseEnter={e => (e.currentTarget.style.color = '#888')}
              onMouseLeave={e => (e.currentTarget.style.color = '#ccc')}
            >
              ×
            </button>
          </div>

          {/* Messages */}
          <div style={{flex: 1, overflowY: 'auto', padding: '18px 22px', display: 'flex', flexDirection: 'column', gap: '14px'}}>
            {messages.map((msg) => (
              <div key={msg.id} style={{display: 'flex', flexDirection: 'column', alignItems: msg.role === 'user' ? 'flex-end' : 'flex-start'}}>
                {(msg.content || msg.role === 'agent') && (
                  <div style={{
                    maxWidth: '78%',
                    padding: '10px 15px',
                    borderRadius: msg.role === 'user' ? '12px 12px 2px 12px' : '12px 12px 12px 2px',
                    fontSize: '12px',
                    lineHeight: 1.65,
                    letterSpacing: '0.01em',
                    ...(msg.role === 'user'
                      ? {background: '#1a1a1a', color: 'rgba(255,255,255,0.88)'}
                      : {background: '#f5f2ed', color: '#2a2a2a', border: '1px solid #ece8e2'}),
                  }}>
                    {msg.content || (msg.role === 'agent' && isLoading ? (
                      <span style={{display: 'flex', gap: '4px', alignItems: 'center', padding: '2px 0'}}>
                        <span style={{width: '5px', height: '5px', borderRadius: '50%', background: '#C9BFB2', animation: 'chatPulse 1.2s infinite'}} />
                        <span style={{width: '5px', height: '5px', borderRadius: '50%', background: '#C9BFB2', animation: 'chatPulse 1.2s infinite', animationDelay: '0.2s'}} />
                        <span style={{width: '5px', height: '5px', borderRadius: '50%', background: '#C9BFB2', animation: 'chatPulse 1.2s infinite', animationDelay: '0.4s'}} />
                      </span>
                    ) : null)}
                  </div>
                )}
                {msg.products && msg.products.length > 0 && (
                  <div style={{display: 'flex', gap: '10px', marginTop: '12px', overflowX: 'auto', paddingBottom: '4px', maxWidth: '100%'}}>
                    {msg.products.map((p) => <MiniProductCard key={p.id} product={p} />)}
                  </div>
                )}
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>
        </div>
      )}

      {/* Floating bar */}
      <div style={{
        position: 'fixed',
        bottom: BAR_BOTTOM,
        left: SIDE,
        right: SIDE,
        height: BAR_H,
        background: '#FDFAF6',
        borderRadius: '14px',
        border: '1.5px solid #C9BFB2',
        display: 'flex',
        alignItems: 'center',
        padding: '0 20px',
        gap: '16px',
        zIndex: 9,
        boxShadow: '0 8px 32px rgba(0,0,0,0.09), 0 2px 8px rgba(0,0,0,0.05)',
      }}>
        {/* Label */}
        <span style={{fontSize: '8px', fontWeight: 400, letterSpacing: '0.22em', textTransform: 'uppercase', color: '#8a7d6e', whiteSpace: 'nowrap', flexShrink: 0}}>
          Personal Shopper
        </span>

        {/* Separator */}
        <div style={{width: '1px', height: '20px', background: '#D8D0C5', flexShrink: 0}} />

        {/* Input */}
        <input
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="Que cherchez-vous aujourd'hui ?"
          disabled={isLoading}
          style={{
            flex: 1,
            background: 'rgba(255,255,255,0.7)',
            border: '1px solid #ddd6cc',
            borderRadius: '8px',
            height: '36px',
            padding: '0 14px',
            fontSize: '11px',
            color: '#1a1a1a',
            letterSpacing: '0.02em',
            outline: 'none',
            transition: 'border-color 0.2s',
          }}
          onFocus={e => { e.currentTarget.style.borderColor = '#C9BFB2'; }}
          onBlur={e => { e.currentTarget.style.borderColor = '#ddd6cc'; }}
        />

        {/* Send button */}
        <button
          onClick={() => send(input.trim())}
          disabled={!input.trim() || isLoading}
          style={{
            background: input.trim() && !isLoading ? '#1a1a1a' : '#e8e2db',
            color: input.trim() && !isLoading ? '#FDFAF6' : '#C4BAB0',
            border: 'none',
            padding: '0 20px',
            height: '36px',
            fontSize: '8px',
            letterSpacing: '0.18em',
            textTransform: 'uppercase',
            borderRadius: '8px',
            cursor: input.trim() && !isLoading ? 'pointer' : 'default',
            transition: 'background 0.2s, color 0.2s',
            whiteSpace: 'nowrap',
            flexShrink: 0,
          }}
        >
          {isLoading ? '···' : 'Envoyer'}
        </button>

        {/* Toggle history */}
        {messages.length > 0 && (
          <button
            onClick={() => setIsOpen((v) => !v)}
            style={{
              background: isOpen ? '#f0ebe3' : 'transparent',
              border: '1px solid #C9BFB2',
              borderRadius: '8px',
              color: '#8a7d6e',
              fontSize: '8px',
              letterSpacing: '0.15em',
              textTransform: 'uppercase',
              padding: '0 14px',
              height: '36px',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              flexShrink: 0,
              transition: 'all 0.2s',
            }}
          >
            {isOpen ? 'Réduire' : 'Historique'}
          </button>
        )}
      </div>

      <style>{`
        @keyframes chatPulse {
          0%, 60%, 100% { opacity: 0.3; transform: scale(0.85); }
          30% { opacity: 1; transform: scale(1); }
        }
      `}</style>
    </>
  );
}
