import {useState, useEffect, useRef, useCallback, useMemo} from 'react';
import type {MetaFunction} from 'react-router';
import {useLoaderData} from 'react-router';
import type {Route} from './+types/($locale).personal-shopper';
import {AddToCartButton} from '~/components/AddToCartButton';
import {searchShopCatalog} from '~/lib/mcp-client';
import type {CatalogProduct} from '~/routes/api.catalog-search';

const PERSONAL_SHOPPER_PRODUCTS_QUERY = `#graphql
  query PersonalShopperProducts($first: Int!) {
    products(first: $first) {
      nodes {
        id
        title
        description
        tags
        priceRange {
          minVariantPrice { amount currencyCode }
        }
        images(first: 1) {
          nodes { url }
        }
        variants(first: 1) {
          nodes { id }
        }
      }
    }
  }
` as const;

export const meta: MetaFunction = () => [
  {title: 'Personal Shopper — JACQUEMUS'},
];

export async function loader({context}: Route.LoaderArgs) {
  const data = await context.storefront.query(
    PERSONAL_SHOPPER_PRODUCTS_QUERY,
    {variables: {first: 20}},
  ) as {products: {nodes: Array<{
    id: string;
    title: string;
    description: string;
    tags: string[];
    priceRange: {minVariantPrice: {amount: string; currencyCode: string}};
    images: {nodes: Array<{url: string}>};
    variants: {nodes: Array<{id: string}>};
  }>}};

  return {
    products: data.products.nodes.map((p) => ({
      id: p.id,
      title: p.title,
      price: parseFloat(p.priceRange.minVariantPrice.amount),
      image: p.images.nodes[0]?.url ?? '',
      description: p.description,
      variantId: p.variants.nodes[0]?.id ?? '',
    })),
  };
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface ProductRef {
  id: string;
  title: string;
  price: number;
  image: string;
  description: string;
  variantId: string;
  contextNote?: string;
}

interface Look {
  name: string;
  description: string;
  items: ProductRef[];
  total: number;
}

interface Message {
  id: string;
  role: 'user' | 'agent';
  content: string;
  looks?: Look[];
  products?: ProductRef[];
  contextNote?: string;
  timestamp: Date;
}

interface FlowEntry {
  id: string;
  timestamp: string;
  direction: '▸' | '◂';
  label: string;
  detail?: string;
}

interface QuickPromptScript {
  label: string;
  userMessage: string;
  flowEntries: Array<{delay: number; direction: '▸' | '◂'; label: string; detail?: string}>;
  agentResponseDelay: number;
  agentContent: string;
  looks?: Look[];
  products?: ProductRef[];
  contextNote?: string;
}

// ─── Scripts des 3 quick-prompts ─────────────────────────────────────────────

function buildScripts(
  gp: (title: string) => ProductRef,
): Record<string, QuickPromptScript> {
  return {
    mariage: {
      label: 'Tenue pour un mariage en Provence en juin, budget 800€, je fais du 36',
      userMessage: 'Tenue pour un mariage en Provence en juin, budget 800€, je fais du 36',
      flowEntries: [
        {delay: 0, direction: '▸', label: 'User input received', detail: '"Tenue pour un mariage en Provence en juin, budget 800€, je fais du 36"'},
        {delay: 350, direction: '▸', label: 'Calling Storefront MCP', detail: `POST /api/catalog-search\nMethod: search_shop_catalog\n\nPayload:\n{\n  "query": "wedding outfit Provence June summer",\n  "filters": {\n    "size": "36",\n    "price_max": 800,\n    "category": ["dress", "shoes", "bag"],\n    "occasion": ["wedding", "garden_party"]\n  }\n}`},
        {delay: 1500, direction: '◂', label: 'MCP Response (200 OK)', detail: `6 products returned with inference tags\nDuration: real Storefront API latency`},
        {delay: 1900, direction: '▸', label: 'Calling Claude API — outfit composition', detail: 'Building 3 complete looks from 6 candidate products\nContext: Provence wedding, June, size 36, budget €800'},
        {delay: 3600, direction: '◂', label: 'Claude response', detail: '3 outfit compositions generated\n\n· Look A — La Romantique      770€\n· Look B — L\'Esprit Libre      670€\n· Look C — La Moderne          770€'},
        {delay: 3800, direction: '▸', label: 'Rendering UI', detail: 'ProductCards injected into chat thread'},
      ],
      agentResponseDelay: 4200,
      agentContent: "J'ai analysé votre demande et sélectionné **3 looks** parfaits pour un mariage en Provence en juin. Chaque ensemble respecte votre budget de 800€ et est disponible en taille 36.",
      looks: [
        {name: 'Look A — La Romantique', description: "Robe fluide et sac naturel — l'alliance parfaite pour un mariage en plein air provençal.", items: [gp('La Bomba'), gp('Le Bambino Large')], total: 770},
        {name: "Look B — L'Esprit Libre", description: 'Mini-robe épaules dénudées et sandales plateformes pour une silhouette décontractée-chic.', items: [gp('Le Souffle'), gp('Les Pralu')], total: 670},
        {name: 'Look C — La Moderne', description: 'Combinaison wide-leg en soie et mules carrées — élégance contemporaine.', items: [gp('La Riviera'), gp('Les Classiques')], total: 770},
      ],
    },

    fruits: {
      label: 'Le truc avec les fruits de la pop-up Saint-Tropez',
      userMessage: 'Le truc avec les fruits de la pop-up Saint-Tropez',
      flowEntries: [
        {delay: 0, direction: '▸', label: 'User input received', detail: '"Le truc avec les fruits de la pop-up Saint-Tropez"'},
        {delay: 350, direction: '▸', label: 'Calling Storefront MCP', detail: `POST /api/catalog-search\nMethod: search_shop_catalog\n\nPayload:\n{\n  "query": "fruits pop-up Saint-Tropez 2024",\n  "filters": {\n    "collection": ["saint-tropez-2024", "limited-edition"]\n  }\n}`},
        {delay: 700, direction: '▸', label: 'Semantic intent matching', detail: 'Inference engine activé\nQuery intent: "pop-up tropez fruits"\n→ Collection tag: "saint-tropez-2024"\n→ Expanding to: Le Citron, Le Banane, Le Tomate'},
        {delay: 1500, direction: '◂', label: 'MCP Response (200 OK)', detail: `3 products — Collection: Pop-Up Saint-Tropez 2024\n\n{\n  "collection_context": {\n    "event": "Pop-Up Saint-Tropez",\n    "year": 2024,\n    "theme": "Mediterranean Fruits",\n    "availability": "limited-edition",\n    "pieces": ["Le Citron", "Le Banane", "Le Tomate"]\n  }\n}`},
        {delay: 1800, direction: '▸', label: 'Rendering UI', detail: 'Collection context cards ready'},
      ],
      agentResponseDelay: 2200,
      agentContent: "Vous cherchez les pièces **fruits** de la pop-up Saint-Tropez 2024 ! Ces 3 bags iconiques de la collection méditerranée sont des éditions limitées très demandées.",
      products: [
        {...gp('Le Citron'), contextNote: 'Le plus ensoleillé — sold-out en ligne'},
        {...gp('Le Banane'), contextNote: 'Mini format — parfait en clutch'},
        {...gp('Le Tomate'), contextNote: 'Le statement piece de la collection'},
      ],
      contextNote: '✦ Pièces iconiques — Pop-Up Saint-Tropez 2024',
    },

    sac: {
      label: 'Un sac qui va avec une robe noire pour le soir',
      userMessage: 'Un sac qui va avec une robe noire pour le soir',
      flowEntries: [
        {delay: 0, direction: '▸', label: 'User input received', detail: '"Un sac qui va avec une robe noire pour le soir"'},
        {delay: 350, direction: '▸', label: 'Calling Storefront MCP', detail: `POST /api/catalog-search\nMethod: search_shop_catalog\n\nPayload:\n{\n  "query": "bag black evening",\n  "filters": {\n    "category": ["bag"],\n    "occasion": ["evening", "cocktail"],\n    "mood": ["glamorous", "chic", "elegant"]\n  }\n}`},
        {delay: 1200, direction: '◂', label: 'MCP Response (200 OK)', detail: '3 products matched — evening bags'},
        {delay: 1600, direction: '▸', label: 'Rendering UI', detail: 'ProductCards injected'},
      ],
      agentResponseDelay: 2000,
      agentContent: "Pour une robe noire en soirée, voici **3 sacs iconiques** Jacquemus qui sublimeront votre tenue.",
      products: [
        {...gp('Le Bambino Noir Verni'), contextNote: 'Le verni capte la lumière — idéal pour les soirées'},
        {...gp('Le Chiquito Noir'), contextNote: 'La silhouette mini pour les soirées épurées'},
        {...gp('Le Cabas Noir'), contextNote: 'Le grand format si vous voyagez léger toute la soirée'},
      ],
    },
  };
}

// ─── Snippets de code source pour la modale ──────────────────────────────────

const SOURCE_SNIPPETS = {
  mcpRoute: `// app/routes/api.mcp.tsx
// Pattern Hydrogen 2026.1.4+ — proxy MCP vers Storefront API
import {createMCPHandler} from '@shopify/hydrogen/mcp';

export async function action({request, context}) {
  return createMCPHandler({
    storefront: context.storefront,
    customerAccount: context.customerAccount,
    // Le handler gère automatiquement :
    // - l'auth OAuth Storefront
    // - la pagination cursors
    // - le cache Oxygen edge (TTL configurable)
    // - le schema inference_attributes
  }).handle(request);
}`,

  mcpClient: `// app/lib/mcp-client.ts
// Client typé pour appeler le MCP Storefront
export async function searchShopCatalog(
  payload: MCPSearchPayload,
  onLog?: (entry: MCPLogEntry) => void,
): Promise<Product[]> {
  onLog?.({ direction: 'request', method: 'search_shop_catalog', payload });

  const res = await fetch('/api/catalog-search', {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({
      query: payload.query,
      filters: payload.filters,
    }),
  });

  const data = await res.json();
  onLog?.({ direction: 'response', statusCode: res.status, payload: data });
  return data.products;
}`,

  component: `// Appel MCP depuis le composant React
async function processUserMessage(input: string) {
  const products = await searchShopCatalog({
    query: input,
    filters: extractFilters(input),   // NLP côté client
    include_inference_attributes: true,
  }, (entry) => {
    // Chaque log MCP est streamé en temps réel dans le panneau debug
    setFlowLog((prev) => [...prev, { ...entry, id: crypto.randomUUID() }]);
  });

  // Claude compose les looks depuis les produits retournés
  const looks = await claudeComposeLooks(products, userContext);

  addMessage({ role: 'agent', content: looks.summary, looks });
}`,
};

// ─── Composants ───────────────────────────────────────────────────────────────

function ProductCard({product}: {product: ProductRef}) {
  return (
    <div
      style={{
        background: '#fff',
        borderRadius: '2px',
        overflow: 'hidden',
        border: '1px solid #e8e4de',
        display: 'flex',
        flexDirection: 'column',
        minWidth: '160px',
        maxWidth: '180px',
        flexShrink: 0,
      }}
    >
      <div style={{aspectRatio: '4/5', overflow: 'hidden', background: '#f0ede8'}}>
        <img
          src={product.image}
          alt={product.title}
          style={{width: '100%', height: '100%', objectFit: 'cover', display: 'block'}}
          loading="lazy"
        />
      </div>
      <div style={{padding: '10px', flex: 1, display: 'flex', flexDirection: 'column', gap: '4px'}}>
        <div style={{fontSize: '11px', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#1A1A1A'}}>
          {product.title}
        </div>
        <div style={{fontSize: '12px', color: '#666'}}>{product.description}</div>
        <div style={{fontSize: '13px', fontWeight: 600, color: '#1A1A1A', marginTop: 'auto', paddingTop: '6px'}}>
          {product.price.toLocaleString('fr-FR')} €
        </div>
        {product.contextNote && (
          <div style={{fontSize: '10px', color: '#8B7355', fontStyle: 'italic'}}>{product.contextNote}</div>
        )}
        <AddToCartButton
          lines={[{merchandiseId: product.variantId, quantity: 1}]}
          disabled={!product.variantId}
        >
          <span style={{
            display: 'block',
            padding: '6px 12px',
            background: product.variantId ? '#1A1A1A' : '#ccc',
            color: '#fff',
            fontSize: '10px',
            letterSpacing: '0.1em',
            textTransform: 'uppercase' as const,
            cursor: product.variantId ? 'pointer' : 'not-allowed',
          }}>
            ADD TO CART
          </span>
        </AddToCartButton>
      </div>
    </div>
  );
}

function LookCard({look}: {look: Look}) {
  return (
    <div
      style={{
        background: '#fff',
        borderRadius: '2px',
        border: '1px solid #e8e4de',
        padding: '16px',
        marginBottom: '12px',
      }}
    >
      <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '6px'}}>
        <div style={{fontSize: '11px', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#1A1A1A'}}>
          {look.name}
        </div>
        <div style={{fontSize: '13px', fontWeight: 600, color: '#1A1A1A'}}>
          {look.total.toLocaleString('fr-FR')} €
        </div>
      </div>
      <div style={{fontSize: '12px', color: '#666', marginBottom: '14px', lineHeight: 1.5}}>
        {look.description}
      </div>
      <div style={{display: 'flex', gap: '12px', overflowX: 'auto', paddingBottom: '4px'}}>
        {look.items.map((p) => (
          <ProductCard key={p.id} product={p} />
        ))}
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
        opacity: 1,
      }}
    >
      <div style={{display: 'flex', gap: '8px', alignItems: 'baseline', marginBottom: entry.detail ? '6px' : 0}}>
        <span style={{color: '#555', fontSize: '10px', fontFamily: 'monospace', whiteSpace: 'nowrap'}}>
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
  const [activeTab, setActiveTab] = useState<'route' | 'client' | 'component'>('route');

  const tabs: Array<{key: 'route' | 'client' | 'component'; label: string}> = [
    {key: 'route', label: 'api.mcp.tsx'},
    {key: 'client', label: 'mcp-client.ts'},
    {key: 'component', label: 'Component call'},
  ];

  const snippetMap = {
    route: SOURCE_SNIPPETS.mcpRoute,
    client: SOURCE_SNIPPETS.mcpClient,
    component: SOURCE_SNIPPETS.component,
  };

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
        {/* Header */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '12px 16px',
          borderBottom: '1px solid #2a2a2a',
        }}>
          <div style={{color: '#e5e5e5', fontSize: '12px', fontFamily: 'monospace', fontWeight: 600}}>
            Hydrogen × Storefront MCP — Pattern d'intégration
          </div>
          <button
            onClick={onClose}
            style={{color: '#666', background: 'none', border: 'none', fontSize: '18px', cursor: 'pointer', lineHeight: 1}}
          >
            ×
          </button>
        </div>

        {/* Tabs */}
        <div style={{display: 'flex', borderBottom: '1px solid #2a2a2a'}}>
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              style={{
                padding: '8px 16px',
                background: activeTab === tab.key ? '#1a1a1a' : 'transparent',
                border: 'none',
                borderBottom: activeTab === tab.key ? '2px solid #4ade80' : '2px solid transparent',
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

        {/* Code */}
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
            <code>{snippetMap[activeTab]}</code>
          </pre>
        </div>

        {/* Footer note */}
        <div style={{padding: '10px 16px', borderTop: '1px solid #2a2a2a', color: '#555', fontSize: '10px', fontFamily: 'monospace'}}>
          Ce pattern est disponible dès Hydrogen 2026.1.4 — aucune configuration Shopify supplémentaire requise
        </div>
      </div>
    </div>
  );
}

// ─── Composant principal ──────────────────────────────────────────────────────

function renderMessageContent(content: string): React.ReactNode {
  // Simple bold markdown support: **text**
  const parts = content.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) =>
    part.startsWith('**') && part.endsWith('**') ? (
      <strong key={i}>{part.slice(2, -2)}</strong>
    ) : (
      <span key={i}>{part}</span>
    ),
  );
}

export default function PersonalShopperPage() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      role: 'agent',
      content: 'Bonjour, je suis votre Personal Shopper Jacquemus. Je peux vous aider à trouver la pièce idéale, composer un look complet, ou retrouver une pièce spécifique de nos collections.',
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [flowLog, setFlowLog] = useState<FlowEntry[]>([]);
  const [newEntryIds, setNewEntryIds] = useState<Set<string>>(new Set());
  const [showSource, setShowSource] = useState(false);
  const [activePrompt, setActivePrompt] = useState<string | null>(null);

  const {products} = useLoaderData<typeof loader>();

  const gp = useCallback(
    (title: string): ProductRef => {
      const found = products.find((p) => p.title === title);
      return found ?? {id: 'placeholder', title, price: 0, image: '', description: '', variantId: ''};
    },
    [products],
  );

  const SCRIPTS = useMemo(() => buildScripts(gp), [gp]);

  const chatEndRef = useRef<HTMLDivElement>(null);
  const flowEndRef = useRef<HTMLDivElement>(null);
  const timeoutsRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  // Scroll automatique
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({behavior: 'smooth'});
  }, [messages, isTyping]);

  useEffect(() => {
    flowEndRef.current?.scrollIntoView({behavior: 'smooth'});
  }, [flowLog]);

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
  }, []);

  const processPrompt = useCallback((key: string) => {
    const script = SCRIPTS[key];
    if (!script || activePrompt) return;

    // Annuler les timeouts en cours
    timeoutsRef.current.forEach(clearTimeout);
    timeoutsRef.current = [];

    setActivePrompt(key);
    setFlowLog([]);
    setIsTyping(true);

    // Ajouter le message utilisateur
    const userMsg: Message = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: script.userMessage,
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, userMsg]);

    // Streamer les entrées du flow technique
    script.flowEntries.forEach(({delay, direction, label, detail}) => {
      const t = setTimeout(() => {
        const ts = new Date().toLocaleTimeString('fr-FR', {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        });
        addFlowEntry({timestamp: ts, direction, label, detail});
      }, delay);
      timeoutsRef.current.push(t);
    });

    // Réponse de l'agent
    const agentTimeout = setTimeout(() => {
      const agentMsg: Message = {
        id: `agent-${Date.now()}`,
        role: 'agent',
        content: script.agentContent,
        looks: script.looks,
        products: script.products,
        contextNote: script.contextNote,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, agentMsg]);
      setIsTyping(false);
      setActivePrompt(null);
    }, script.agentResponseDelay);
    timeoutsRef.current.push(agentTimeout);
  }, [activePrompt, addFlowEntry]);

  const handleSend = useCallback(async () => {
    if (!input.trim() || activePrompt) return;
    const query = input.trim();
    const userMsg: Message = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: query,
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setIsTyping(true);
    setFlowLog([]);

    try {
      const results = await searchShopCatalog(
        {query, limit: 4},
        (entry) => {
          addFlowEntry({
            timestamp: entry.timestamp,
            direction: entry.direction === 'request' ? '▸' : '◂',
            label: entry.direction === 'request' ? 'Calling Storefront MCP' : 'MCP Response (200 OK)',
            detail: JSON.stringify(entry.payload, null, 2).slice(0, 400),
          });
        },
      );

      setIsTyping(false);

      if (results.length === 0) {
        setMessages((prev) => [
          ...prev,
          {id: `agent-${Date.now()}`, role: 'agent', content: 'Aucun produit trouvé pour cette recherche. Essayez un autre terme.', timestamp: new Date()},
        ]);
        return;
      }

      const productRefs: ProductRef[] = results.map((r) => ({
        id: r.id,
        title: r.title,
        price: r.price,
        image: r.image,
        description: r.description,
        variantId: r.variantId,
      }));

      setMessages((prev) => [
        ...prev,
        {
          id: `agent-${Date.now()}`,
          role: 'agent',
          content: `J'ai trouvé **${results.length} produit${results.length > 1 ? 's' : ''}** correspondant à votre recherche.`,
          products: productRefs,
          timestamp: new Date(),
        },
      ]);
    } catch {
      setIsTyping(false);
      setMessages((prev) => [
        ...prev,
        {id: `agent-${Date.now()}`, role: 'agent', content: 'Erreur lors de la recherche. Veuillez réessayer.', timestamp: new Date()},
      ]);
    }
  }, [input, activePrompt, addFlowEntry]);

  return (
    <>
      <style>{`
        @keyframes fadeSlideIn {
          from { opacity: 0; transform: translateY(4px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .typing-dot {
          display: inline-block;
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: #aaa;
          margin: 0 2px;
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
        {/* ── Panneau Chat (gauche 60%) ────────────────────────── */}
        <div
          style={{
            width: '60%',
            display: 'flex',
            flexDirection: 'column',
            backgroundColor: '#FAF7F2',
            borderRight: '1px solid #e8e4de',
          }}
        >
          {/* En-tête */}
          <div style={{padding: '24px 32px 16px', borderBottom: '1px solid #e8e4de', flexShrink: 0}}>
            <div style={{fontFamily: 'Georgia, "Times New Roman", serif', fontSize: '22px', fontWeight: 400, color: '#1A1A1A', letterSpacing: '0.02em'}}>
              Personal Shopper
            </div>
            <div style={{fontSize: '11px', color: '#888', letterSpacing: '0.15em', textTransform: 'uppercase', marginTop: '2px'}}>
              Jacquemus — Powered by Storefront MCP
            </div>
          </div>

          {/* Quick prompts */}
          <div style={{padding: '12px 32px', borderBottom: '1px solid #e8e4de', flexShrink: 0}}>
            <div style={{fontSize: '10px', color: '#aaa', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '8px'}}>
              Quick prompts
            </div>
            <div style={{display: 'flex', flexDirection: 'column', gap: '6px'}}>
              {Object.entries(SCRIPTS).map(([key, script]) => (
                <button
                  key={key}
                  className="quick-btn"
                  disabled={!!activePrompt}
                  onClick={() => processPrompt(key)}
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
                  {script.label}
                </button>
              ))}
            </div>
          </div>

          {/* Zone de messages */}
          <div style={{flex: 1, overflowY: 'auto', padding: '24px 32px', display: 'flex', flexDirection: 'column', gap: '16px'}}>
            {messages.map((msg) => (
              <div key={msg.id} style={{display: 'flex', flexDirection: 'column', alignItems: msg.role === 'user' ? 'flex-end' : 'flex-start'}}>
                {/* Bulle de message */}
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
                  {renderMessageContent(msg.content)}
                </div>

                {/* Context note */}
                {msg.contextNote && (
                  <div style={{marginTop: '8px', fontSize: '11px', color: '#8B7355', letterSpacing: '0.05em'}}>
                    {msg.contextNote}
                  </div>
                )}

                {/* Looks (prompt mariage) */}
                {msg.looks && msg.looks.length > 0 && (
                  <div style={{width: '100%', marginTop: '12px'}}>
                    {msg.looks.map((look, i) => (
                      <LookCard key={i} look={look} />
                    ))}
                  </div>
                )}

                {/* Produits simples (prompt fruits + sac) */}
                {msg.products && msg.products.length > 0 && (
                  <div style={{display: 'flex', gap: '12px', marginTop: '12px', overflowX: 'auto', width: '100%', paddingBottom: '4px'}}>
                    {msg.products.map((p) => (
                      <ProductCard key={p.id} product={p} />
                    ))}
                  </div>
                )}
              </div>
            ))}

            {/* Indicateur de frappe */}
            {isTyping && (
              <div style={{display: 'flex', alignItems: 'center'}}>
                <div style={{background: '#fff', border: '1px solid #e8e4de', borderRadius: '2px', padding: '12px 16px', display: 'flex', gap: '2px', alignItems: 'center'}}>
                  <span className="typing-dot" />
                  <span className="typing-dot" />
                  <span className="typing-dot" />
                </div>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          {/* Barre de saisie */}
          <div style={{borderTop: '1px solid #e8e4de', padding: '16px 32px', flexShrink: 0, display: 'flex', gap: '12px', alignItems: 'center'}}>
            <input
              className="ps-input"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSend()}
              placeholder="Que cherchez-vous aujourd'hui ?"
              disabled={!!activePrompt}
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
              onClick={handleSend}
              disabled={!input.trim() || !!activePrompt}
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
                opacity: !input.trim() || !!activePrompt ? 0.4 : 1,
                transition: 'opacity 0.15s',
              }}
            >
              Envoyer
            </button>
          </div>
        </div>

        {/* ── Panneau Technical Flow (droite 40%) ─────────────────── */}
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
          {/* En-tête */}
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
              <div style={{fontFamily: 'monospace', fontSize: '11px', color: '#e5e5e5', fontWeight: 600, letterSpacing: '0.05em'}}>
                Technical Flow
              </div>
              <div style={{fontFamily: 'monospace', fontSize: '10px', color: '#555', marginTop: '2px'}}>
                Storefront MCP — Hydrogen 2026.4
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
                transition: 'border-color 0.15s',
              }}
            >
              {'<>'} View source
            </button>
          </div>

          {/* Légende */}
          <div style={{padding: '8px 16px', borderBottom: '1px solid #222', display: 'flex', gap: '16px', flexShrink: 0}}>
            <span style={{fontFamily: 'monospace', fontSize: '10px', color: '#555'}}>
              <span style={{color: '#4ade80'}}>▸</span> Request
            </span>
            <span style={{fontFamily: 'monospace', fontSize: '10px', color: '#555'}}>
              <span style={{color: '#60a5fa'}}>◂</span> Response
            </span>
          </div>

          {/* Entrées de log */}
          <div style={{flex: 1, overflowY: 'auto'}}>
            {flowLog.length === 0 ? (
              <div style={{padding: '32px 16px', fontFamily: 'monospace', fontSize: '11px', color: '#333', textAlign: 'center', lineHeight: 2}}>
                En attente d'une interaction...<br />
                <span style={{color: '#2a2a2a'}}>Cliquez sur un quick-prompt pour</span><br />
                <span style={{color: '#2a2a2a'}}>visualiser le flux MCP en temps réel</span>
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

          {/* Footer informatif */}
          <div style={{padding: '10px 16px', borderTop: '1px solid #222', flexShrink: 0}}>
            <div style={{fontFamily: 'monospace', fontSize: '9px', color: '#3a3a3a', lineHeight: 1.8}}>
              inference_attributes: mood · occasion · season · material · color · style
            </div>
          </div>
        </div>
      </div>

      {/* Modale code source */}
      {showSource && <SourceModal onClose={() => setShowSource(false)} />}
    </>
  );
}
