import {useState, useRef, useCallback} from 'react';
import type {MetaFunction} from 'react-router';
import type {FetcherWithComponents} from 'react-router';
import type {Route} from './+types/($locale).personal-shopper';
import {CartForm} from '@shopify/hydrogen';
import {useAside} from '~/components/Aside';
import type {ShopifyMCPProduct} from '~/lib/shopify-mcp-client';

export const meta: MetaFunction = () => [
  {title: 'Personal Shopper — JACQUEMUS'},
];

// Loader kept for potential future use (e.g. prefetch featured products)
export async function loader(_: Route.LoaderArgs) {
  return {};
}

// ─── Types ────────────────────────────────────────────────────────────────────

type ProductRef = ShopifyMCPProduct;

interface Message {
  id: string;
  role: 'user' | 'agent';
  content: string;
  products?: ProductRef[];
  timestamp: Date;
}

interface FlowEntry {
  id: string;
  timestamp: string;
  direction: '▸' | '◂';
  label: string;
  detail?: string;
}

// ─── Quick prompts ────────────────────────────────────────────────────────────

const QUICK_PROMPTS = [
  'Un sac iconique pour le quotidien ou le soir',
  'Une robe élégante pour un mariage ou une soirée',
  'Des chaussures pour un événement chic',
];

// ─── Source snippets for the modal ───────────────────────────────────────────

const SOURCE_SNIPPETS = {
  mcpClient: `// app/lib/shopify-mcp-client.ts
export async function callShopifyMCPTool(
  mcpUrl: string, token: string,
  toolName: string, input: Record<string, unknown>,
): Promise<unknown> {
  const res = await fetch(mcpUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Shopify-Storefront-Access-Token': token,
    },
    body: JSON.stringify({
      jsonrpc: '2.0', id: 1,
      method: 'tools/call',
      params: { name: toolName, arguments: {
        'meta.ucp-agent.profile': AGENT_PROFILE,
        'catalog.context': { language: 'fr', currency: 'EUR' },
        ...input,
      }},
    }),
  });
  const data = await res.json();
  return data.result; // { content: [{ type: 'text', text: '...' }] }
}`,

  chatRoute: `// app/routes/api.chat.tsx
// SSE endpoint: Claude + Shopify MCP agentic loop
export async function action({ request }) {
  const { message } = await request.json();
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  return new Response(new ReadableStream({
    async start(controller) {
      const tools = await listShopifyMCPTools(MCP_URL, TOKEN);
      const messages = [{ role: 'user', content: message }];

      while (true) {
        const stream = client.messages.stream({
          model: 'claude-sonnet-4-6',
          tools, messages,
        });

        // Stream text chunks to client
        for await (const event of stream) {
          if (event.type === 'content_block_delta' &&
              event.delta.type === 'text_delta') {
            controller.enqueue(sse('text', { delta: event.delta.text }));
          }
        }

        const msg = await stream.finalMessage();
        if (msg.stop_reason !== 'tool_use') break;

        // Execute tool calls via Shopify MCP
        for (const t of msg.content.filter(b => b.type === 'tool_use')) {
          const result = await callShopifyMCPTool(t.name, t.input);
          const products = parseProductsFromMCPResult(result);
          if (products.length) controller.enqueue(sse('products', { products }));
        }
      }

      controller.close();
    }
  }), { headers: { 'Content-Type': 'text/event-stream' } });
}`,

  component: `// app/routes/($locale).personal-shopper.tsx
async function sendMessage(text: string) {
  const res = await fetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message: text }),
  });

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '', currentEvent = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    for (const line of buffer.split('\\n')) {
      if (line.startsWith('event: ')) currentEvent = line.slice(7).trim();
      if (line.startsWith('data: ')) {
        const data = JSON.parse(line.slice(6));
        if (currentEvent === 'text')     appendToAgentMessage(data.delta);
        if (currentEvent === 'products') setAgentProducts(data.products);
        if (currentEvent === 'log')      addFlowEntry(data);
      }
    }
    buffer = '';
  }
}`,
};

// ─── Components ───────────────────────────────────────────────────────────────

function CartButton({variantId}: {variantId: string}) {
  const {open} = useAside();
  const prevState = useRef<string>('idle');

  if (!variantId) {
    return (
      <span
        style={{
          display: 'block',
          padding: '8px 0',
          background: 'transparent',
          color: '#C9BFB2',
          fontSize: '8px',
          letterSpacing: '0.16em',
          textTransform: 'uppercase',
          border: '1px solid #ddd6cc',
          cursor: 'not-allowed',
          marginTop: '8px',
          textAlign: 'center',
        }}
      >
        Indisponible
      </span>
    );
  }

  return (
    <CartForm
      route="/cart"
      inputs={{lines: [{merchandiseId: variantId, quantity: 1}]}}
      action={CartForm.ACTIONS.LinesAdd}
    >
      {(fetcher: FetcherWithComponents<unknown>) => {
        if (prevState.current !== 'idle' && fetcher.state === 'idle' && fetcher.data) {
          const d = fetcher.data as {errors?: unknown[]};
          if (!d.errors?.length) open('cart');
        }
        prevState.current = fetcher.state;
        const loading = fetcher.state !== 'idle';
        return (
          <button
            type="submit"
            disabled={loading}
            style={{
              display: 'block',
              width: '100%',
              padding: '8px 0',
              background: 'transparent',
              color: loading ? '#C9BFB2' : '#1A1A1A',
              fontSize: '8px',
              letterSpacing: '0.16em',
              textTransform: 'uppercase',
              border: `1px solid ${loading ? '#ddd6cc' : '#1A1A1A'}`,
              cursor: loading ? 'wait' : 'pointer',
              marginTop: '8px',
              transition: 'border-color 0.2s, color 0.2s',
            }}
          >
            {loading ? '···' : 'Ajouter au panier'}
          </button>
        );
      }}
    </CartForm>
  );
}

function ProductCard({product}: {product: ProductRef}) {
  return (
    <div
      style={{
        background: '#fff',
        border: '1px solid #E8E3DC',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        minWidth: '170px',
        maxWidth: '190px',
        flexShrink: 0,
      }}
    >
      <div style={{aspectRatio: '3/4', overflow: 'hidden', background: '#F0ECE5'}}>
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
          padding: '12px 14px 16px',
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          gap: '4px',
        }}
      >
        <div
          style={{
            fontSize: '8px',
            letterSpacing: '0.2em',
            textTransform: 'uppercase',
            color: '#C9BFB2',
            marginBottom: '2px',
          }}
        >
          {product.productType || 'Jacquemus'}
        </div>
        <div
          style={{
            fontSize: '11px',
            fontWeight: 500,
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
            color: '#1A1A1A',
            lineHeight: 1.35,
          }}
        >
          {product.title.replace('Jacquemus ', '')}
        </div>
        <div
          style={{
            fontSize: '12px',
            color: '#1A1A1A',
            letterSpacing: '0.03em',
            marginTop: '6px',
            flex: 1,
          }}
        >
          {product.price > 0 ? `${product.price.toLocaleString('fr-FR')} €` : ''}
        </div>
        <CartButton variantId={product.variantId} />
      </div>
    </div>
  );
}

function FlowEntryDisplay({entry, isNew}: {entry: FlowEntry; isNew: boolean}) {
  const isRequest = entry.direction === '▸';
  return (
    <div
      style={{
        padding: '10px 16px',
        borderBottom: '1px solid #2a2a2a',
        animation: isNew ? 'fadeSlideIn 0.3s ease-out' : 'none',
      }}
    >
      <div
        style={{
          display: 'flex',
          gap: '8px',
          alignItems: 'baseline',
          marginBottom: entry.detail ? '6px' : 0,
        }}
      >
        <span
          style={{color: '#555', fontSize: '10px', fontFamily: 'monospace', whiteSpace: 'nowrap'}}
        >
          [{entry.timestamp}]
        </span>
        <span style={{color: isRequest ? '#4ade80' : '#60a5fa', fontSize: '11px'}}>
          {entry.direction}
        </span>
        <span style={{color: '#e5e5e5', fontSize: '11px', fontWeight: 500}}>
          {entry.label}
        </span>
      </div>
      {entry.detail && (
        <div
          style={{
            marginLeft: '100px',
            color: '#8a8a8a',
            fontSize: '10px',
            fontFamily: 'monospace',
            lineHeight: 1.6,
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
          }}
        >
          {entry.detail}
        </div>
      )}
    </div>
  );
}

function SourceModal({onClose}: {onClose: () => void}) {
  const [activeTab, setActiveTab] = useState<'mcpClient' | 'chatRoute' | 'component'>('chatRoute');

  const tabs: Array<{key: 'mcpClient' | 'chatRoute' | 'component'; label: string}> = [
    {key: 'chatRoute', label: 'api.chat.tsx'},
    {key: 'mcpClient', label: 'shopify-mcp-client.ts'},
    {key: 'component', label: 'Component stream'},
  ];

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.7)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: '#111',
          borderRadius: '4px',
          width: '680px',
          maxWidth: '95vw',
          maxHeight: '80vh',
          display: 'flex',
          flexDirection: 'column',
          border: '1px solid #333',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '12px 16px',
            borderBottom: '1px solid #2a2a2a',
          }}
        >
          <div
            style={{
              color: '#e5e5e5',
              fontSize: '12px',
              fontFamily: 'monospace',
              fontWeight: 600,
            }}
          >
            Claude × Shopify Storefront MCP — Pattern d'intégration
          </div>
          <button
            onClick={onClose}
            style={{
              color: '#666',
              background: 'none',
              border: 'none',
              fontSize: '18px',
              cursor: 'pointer',
              lineHeight: 1,
            }}
          >
            ×
          </button>
        </div>

        <div style={{display: 'flex', borderBottom: '1px solid #2a2a2a'}}>
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              style={{
                padding: '8px 16px',
                background: activeTab === tab.key ? '#1a1a1a' : 'transparent',
                border: 'none',
                borderBottom:
                  activeTab === tab.key ? '2px solid #4ade80' : '2px solid transparent',
                color: activeTab === tab.key ? '#e5e5e5' : '#666',
                fontSize: '11px',
                fontFamily: 'monospace',
                cursor: 'pointer',
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div style={{flex: 1, overflow: 'auto', padding: '16px'}}>
          <pre
            style={{
              margin: 0,
              color: '#c9d1d9',
              fontSize: '11px',
              fontFamily: 'monospace',
              lineHeight: 1.7,
              whiteSpace: 'pre-wrap',
            }}
          >
            <code>{SOURCE_SNIPPETS[activeTab]}</code>
          </pre>
        </div>

        <div
          style={{
            padding: '10px 16px',
            borderTop: '1px solid #2a2a2a',
            color: '#555',
            fontSize: '10px',
            fontFamily: 'monospace',
          }}
        >
          Claude appelle search_catalog via JSON-RPC 2.0 sur le Storefront MCP de Shopify
        </div>
      </div>
    </div>
  );
}

function renderMessageContent(content: string): React.ReactNode {
  const parts = content.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) =>
    part.startsWith('**') && part.endsWith('**') ? (
      <strong key={i}>{part.slice(2, -2)}</strong>
    ) : (
      <span key={i}>{part}</span>
    ),
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function PersonalShopperPage() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      role: 'agent',
      content:
        'Bonjour, je suis votre Personal Shopper Jacquemus. Je peux vous aider à trouver la pièce idéale de la collection — sacs, robes, chaussures.',
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [flowLog, setFlowLog] = useState<FlowEntry[]>([]);
  const [newEntryIds, setNewEntryIds] = useState<Set<string>>(new Set());
  const [showSource, setShowSource] = useState(false);

  const chatEndRef = useRef<HTMLDivElement>(null);
  const flowEndRef = useRef<HTMLDivElement>(null);
  const agentMessageCreatedRef = useRef(false);
  const pendingProductsRef = useRef<ProductRef[] | undefined>(undefined);

  const addFlowEntry = useCallback((entry: Omit<FlowEntry, 'id'>) => {
    const id = `${Date.now()}-${Math.random()}`;
    setFlowLog((prev) => [...prev, {...entry, id}]);
    setNewEntryIds((prev) => new Set(prev).add(id));
    setTimeout(() => {
      setNewEntryIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }, 600);
    flowEndRef.current?.scrollIntoView({behavior: 'smooth'});
  }, []);

  const sendMessage = useCallback(
    async (message: string) => {
      if (isLoading) return;

      setIsLoading(true);
      setIsTyping(true);
      setInput('');
      setFlowLog([]);
      agentMessageCreatedRef.current = false;
      pendingProductsRef.current = undefined;

      const agentId = `agent-${Date.now()}`;

      setMessages((prev) => [
        ...prev,
        {id: `user-${Date.now()}`, role: 'user', content: message, timestamp: new Date()},
        {id: agentId, role: 'agent', content: '', timestamp: new Date()},
      ]);

      try {
        const res = await fetch('/api/chat', {
          method: 'POST',
          headers: {'Content-Type': 'application/json'},
          body: JSON.stringify({message}),
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

              if (currentEvent === 'text') {
                const delta = String(data.delta ?? '');
                if (!agentMessageCreatedRef.current) {
                  agentMessageCreatedRef.current = true;
                  setIsTyping(false);
                }
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === agentId ? {...m, content: m.content + delta} : m,
                  ),
                );
                chatEndRef.current?.scrollIntoView({behavior: 'smooth'});
              } else if (currentEvent === 'products') {
                const products = (data.products as ProductRef[]) ?? [];
                setMessages((prev) =>
                  prev.map((m) => (m.id === agentId ? {...m, products} : m)),
                );
              } else if (currentEvent === 'log') {
                addFlowEntry({
                  timestamp: String(data.timestamp ?? ''),
                  direction: (data.direction as '▸' | '◂') ?? '▸',
                  label: String(data.label ?? ''),
                  detail: data.detail ? String(data.detail) : undefined,
                });
              } else if (currentEvent === 'error') {
                throw new Error(String(data.message ?? 'Erreur inconnue'));
              }
            }
          }
        }
      } catch (err) {
        setIsTyping(false);
        setMessages((prev) =>
          prev.map((m) =>
            m.id === agentId
              ? {...m, content: `Erreur : ${String(err)}. Veuillez réessayer.`, products: undefined}
              : m,
          ),
        );
      } finally {
        setIsLoading(false);
        setIsTyping(false);
      }
    },
    [isLoading, addFlowEntry],
  );

  return (
    <>
      <style>{`
        @keyframes fadeSlideIn {
          from { opacity: 0; transform: translateY(4px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .typing-dot {
          display: inline-block; width: 6px; height: 6px;
          border-radius: 50%; background: #aaa; margin: 0 2px;
          animation: typingPulse 1.2s infinite;
        }
        .typing-dot:nth-child(2) { animation-delay: 0.2s; }
        .typing-dot:nth-child(3) { animation-delay: 0.4s; }
        @keyframes typingPulse {
          0%, 60%, 100% { opacity: 0.3; transform: scale(0.85); }
          30% { opacity: 1; transform: scale(1); }
        }
        .ps-input:focus { outline: none; }
        .quick-btn:hover:not(:disabled) { background: #1A1A1A !important; color: #FAF7F2 !important; }
        .quick-btn:disabled { opacity: 0.45; cursor: not-allowed; }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: #ccc; border-radius: 2px; }
        .flow-panel ::-webkit-scrollbar-thumb { background: #333; }
      `}</style>

      <div
        style={{
          display: 'flex',
          height: 'calc(100vh - var(--header-height, 64px))',
          fontFamily: 'system-ui, -apple-system, sans-serif',
          overflow: 'hidden',
        }}
      >
        {/* ── Chat panel (left 60%) ─────────────────────────────────── */}
        <div
          style={{
            width: '60%',
            display: 'flex',
            flexDirection: 'column',
            backgroundColor: '#FAF7F2',
            borderRight: '1px solid #e8e4de',
          }}
        >
          {/* Header */}
          <div
            style={{
              padding: '24px 32px 16px',
              borderBottom: '1px solid #e8e4de',
              flexShrink: 0,
            }}
          >
            <div
              style={{
                fontFamily: 'Georgia, "Times New Roman", serif',
                fontSize: '22px',
                fontWeight: 400,
                color: '#1A1A1A',
                letterSpacing: '0.02em',
              }}
            >
              Personal Shopper
            </div>
            <div
              style={{
                fontSize: '11px',
                color: '#888',
                letterSpacing: '0.15em',
                textTransform: 'uppercase',
                marginTop: '2px',
              }}
            >
              Jacquemus — Claude × Storefront MCP
            </div>
          </div>

          {/* Quick prompts */}
          <div
            style={{
              padding: '12px 32px',
              borderBottom: '1px solid #e8e4de',
              flexShrink: 0,
            }}
          >
            <div
              style={{
                fontSize: '10px',
                color: '#aaa',
                letterSpacing: '0.1em',
                textTransform: 'uppercase',
                marginBottom: '8px',
              }}
            >
              Quick prompts
            </div>
            <div style={{display: 'flex', flexDirection: 'column', gap: '6px'}}>
              {QUICK_PROMPTS.map((prompt) => (
                <button
                  key={prompt}
                  className="quick-btn"
                  disabled={isLoading}
                  onClick={() => sendMessage(prompt)}
                  style={{
                    textAlign: 'left',
                    padding: '8px 14px',
                    background: '#fff',
                    border: '1px solid #e8e4de',
                    borderRadius: '2px',
                    fontSize: '12px',
                    color: '#1A1A1A',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                    letterSpacing: '0.01em',
                  }}
                >
                  <span style={{color: '#bbb', marginRight: '8px'}}>→</span>
                  {prompt}
                </button>
              ))}
            </div>
          </div>

          {/* Messages */}
          <div
            style={{
              flex: 1,
              overflowY: 'auto',
              padding: '24px 32px',
              display: 'flex',
              flexDirection: 'column',
              gap: '16px',
            }}
          >
            {messages.map((msg) => {
              const isEmpty = msg.role === 'agent' && msg.content === '' && !msg.products?.length;
              return (
                <div
                  key={msg.id}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: msg.role === 'user' ? 'flex-end' : 'flex-start',
                  }}
                >
                  {(isEmpty || msg.content) && (
                    <div
                      style={{
                        maxWidth: '80%',
                        padding: '12px 16px',
                        borderRadius: '2px',
                        fontSize: '13px',
                        lineHeight: 1.6,
                        ...(msg.role === 'user'
                          ? {background: '#1A1A1A', color: '#FAF7F2'}
                          : {background: '#fff', color: '#1A1A1A', border: '1px solid #e8e4de'}),
                      }}
                    >
                      {isEmpty ? (
                        <span style={{display: 'flex', gap: '2px', alignItems: 'center'}}>
                          <span className="typing-dot" />
                          <span className="typing-dot" />
                          <span className="typing-dot" />
                        </span>
                      ) : (
                        renderMessageContent(msg.content)
                      )}
                    </div>
                  )}

                  {msg.products && msg.products.length > 0 && (
                    <div
                      style={{
                        display: 'flex',
                        gap: '12px',
                        marginTop: '12px',
                        overflowX: 'auto',
                        width: '100%',
                        paddingBottom: '4px',
                      }}
                    >
                      {msg.products.map((p) => (
                        <ProductCard key={p.id} product={p} />
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
            <div ref={chatEndRef} />
          </div>

          {/* Input bar */}
          <div
            style={{
              borderTop: '1px solid #e8e4de',
              padding: '16px 32px',
              flexShrink: 0,
              display: 'flex',
              gap: '12px',
              alignItems: 'center',
            }}
          >
            <input
              className="ps-input"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && !isLoading && sendMessage(input.trim())}
              placeholder="Que cherchez-vous aujourd'hui ?"
              disabled={isLoading}
              style={{
                flex: 1,
                padding: '10px 0',
                background: 'transparent',
                border: 'none',
                borderBottom: '1px solid #e8e4de',
                fontSize: '13px',
                color: '#1A1A1A',
                fontFamily: 'inherit',
              }}
            />
            <button
              onClick={() => sendMessage(input.trim())}
              disabled={!input.trim() || isLoading}
              style={{
                padding: '10px 20px',
                background: '#1A1A1A',
                color: '#FAF7F2',
                border: 'none',
                borderRadius: '1px',
                fontSize: '11px',
                letterSpacing: '0.1em',
                textTransform: 'uppercase',
                cursor: 'pointer',
                opacity: !input.trim() || isLoading ? 0.4 : 1,
                transition: 'opacity 0.15s',
              }}
            >
              Envoyer
            </button>
          </div>
        </div>

        {/* ── Technical Flow panel (right 40%) ─────────────────────── */}
        <div
          className="flow-panel"
          style={{
            width: '40%',
            display: 'flex',
            flexDirection: 'column',
            backgroundColor: '#1A1A1A',
            color: '#c0c0c0',
          }}
        >
          <div
            style={{
              padding: '18px 16px',
              borderBottom: '1px solid #2a2a2a',
              flexShrink: 0,
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <div>
              <div
                style={{
                  fontFamily: 'monospace',
                  fontSize: '11px',
                  color: '#e5e5e5',
                  fontWeight: 600,
                  letterSpacing: '0.05em',
                }}
              >
                Technical Flow
              </div>
              <div
                style={{fontFamily: 'monospace', fontSize: '10px', color: '#555', marginTop: '2px'}}
              >
                Claude × Shopify Storefront MCP
              </div>
            </div>
            <button
              onClick={() => setShowSource(true)}
              style={{
                padding: '6px 12px',
                background: 'transparent',
                border: '1px solid #3a3a3a',
                borderRadius: '2px',
                color: '#4ade80',
                fontFamily: 'monospace',
                fontSize: '10px',
                cursor: 'pointer',
                letterSpacing: '0.05em',
              }}
            >
              {'<>'} View source
            </button>
          </div>

          <div
            style={{
              padding: '8px 16px',
              borderBottom: '1px solid #222',
              display: 'flex',
              gap: '16px',
              flexShrink: 0,
            }}
          >
            <span style={{fontFamily: 'monospace', fontSize: '10px', color: '#555'}}>
              <span style={{color: '#4ade80'}}>▸</span> Request
            </span>
            <span style={{fontFamily: 'monospace', fontSize: '10px', color: '#555'}}>
              <span style={{color: '#60a5fa'}}>◂</span> Response
            </span>
          </div>

          <div style={{flex: 1, overflowY: 'auto'}}>
            {flowLog.length === 0 ? (
              <div
                style={{
                  padding: '32px 16px',
                  fontFamily: 'monospace',
                  fontSize: '11px',
                  color: '#333',
                  textAlign: 'center',
                  lineHeight: 2,
                }}
              >
                En attente d'une interaction...<br />
                <span style={{color: '#2a2a2a'}}>Cliquez sur un quick-prompt pour</span>
                <br />
                <span style={{color: '#2a2a2a'}}>
                  visualiser le flux Claude × MCP en temps réel
                </span>
              </div>
            ) : (
              flowLog.map((entry) => (
                <FlowEntryDisplay
                  key={entry.id}
                  entry={entry}
                  isNew={newEntryIds.has(entry.id)}
                />
              ))
            )}
            <div ref={flowEndRef} />
          </div>

          <div
            style={{
              padding: '10px 16px',
              borderTop: '1px solid #222',
              flexShrink: 0,
            }}
          >
            <div
              style={{
                fontFamily: 'monospace',
                fontSize: '9px',
                color: '#3a3a3a',
                lineHeight: 1.8,
              }}
            >
              JSON-RPC 2.0 · search_catalog · claude-haiku-4-5 · SSE streaming
            </div>
          </div>
        </div>
      </div>

      {showSource && <SourceModal onClose={() => setShowSource(false)} />}
    </>
  );
}
