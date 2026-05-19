const AGENT_PROFILE =
  'https://shopify.dev/ucp/agent-profiles/examples/2026-04-08/valid-with-capabilities.json';

let _reqId = 0;

export interface ShopifyMCPTool {
  name: string;
  description: string;
  inputSchema: {
    type: string;
    properties: Record<string, unknown>;
    required?: string[];
  };
}

export interface ShopifyMCPProduct {
  id: string;
  title: string;
  price: number;
  image: string;
  description: string;
  variantId: string;
  tags: string[];
}

async function mcpCall(
  mcpUrl: string,
  token: string,
  method: string,
  params: Record<string, unknown>,
): Promise<unknown> {
  const res = await fetch(mcpUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Shopify-Storefront-Access-Token': token,
    },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: ++_reqId,
      method,
      params,
    }),
  });

  if (!res.ok) {
    throw new Error(`MCP HTTP ${res.status}: ${await res.text()}`);
  }

  const data = (await res.json()) as {result?: unknown; error?: {message: string}};
  if (data.error) throw new Error(`MCP error: ${data.error.message}`);
  return data.result;
}

export async function listShopifyMCPTools(
  mcpUrl: string,
  token: string,
): Promise<ShopifyMCPTool[]> {
  const result = (await mcpCall(mcpUrl, token, 'tools/list', {})) as {
    tools: ShopifyMCPTool[];
  };
  return result.tools ?? [];
}

export async function callShopifyMCPTool(
  mcpUrl: string,
  token: string,
  toolName: string,
  toolInput: Record<string, unknown>,
): Promise<unknown> {
  return mcpCall(mcpUrl, token, 'tools/call', {
    name: toolName,
    arguments: {
      'catalog.context': {language: 'fr', currency: 'EUR', intent: 'buy'},
      ...toolInput,
      'meta.ucp-agent.profile': AGENT_PROFILE,
    },
  });
}

function findProductArray(obj: Record<string, unknown>): unknown[] {
  for (const key of ['results', 'searchResults', 'products', 'items', 'nodes']) {
    const val = obj[key];
    if (Array.isArray(val) && val.length > 0) {
      const first = val[0] as Record<string, unknown>;
      if (first.id && first.title) return val;
    }
  }
  return [];
}

function mapItem(item: Record<string, unknown>): ShopifyMCPProduct | null {
  if (!item.id || !item.title) return null;

  // MCP format: price_range.min.amount in cents
  const priceRange = item.price_range as {min?: {amount?: number}} | undefined;
  const price = (priceRange?.min?.amount ?? 0) / 100;

  // MCP format: media[].{type, url}
  const media = item.media as Array<{type: string; url: string}> | undefined;
  const image = media?.find((m) => m.type === 'image')?.url ?? '';

  // MCP format: variants[].id
  const variants = item.variants as Array<{id: string}> | undefined;
  const variantId = variants?.[0]?.id ?? '';

  // MCP format: description.html
  const desc = item.description as {html?: string} | string | undefined;
  const description = (
    typeof desc === 'string' ? desc : (desc?.html ?? '')
  ).replace(/<[^>]+>/g, '').slice(0, 200);

  return {
    id: String(item.id),
    title: String(item.title),
    price,
    image,
    description,
    variantId,
    tags: Array.isArray(item.tags) ? (item.tags as string[]) : [],
  };
}

export function parseProductsFromMCPResult(result: unknown): ShopifyMCPProduct[] {
  if (!result) return [];

  const r = result as Record<string, unknown>;
  let items: unknown[] = [];

  // Standard MCP content array
  if (Array.isArray(r.content)) {
    for (const block of r.content as Array<Record<string, unknown>>) {
      if (block.type === 'text' && typeof block.text === 'string') {
        try {
          const parsed = JSON.parse(block.text) as Record<string, unknown>;
          items = findProductArray(parsed);
          if (items.length > 0) break;
        } catch {
          // not JSON
        }
      }
    }
  }

  // Fallback: result itself contains the data
  if (items.length === 0) {
    items = findProductArray(r);
  }

  return (items as Array<Record<string, unknown>>)
    .map(mapItem)
    .filter((p): p is ShopifyMCPProduct => p !== null);
}
