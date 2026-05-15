import type {CatalogProduct, CatalogSearchPayload} from '~/routes/api.catalog-search';

export interface MCPLogEntry {
  timestamp: string;
  direction: 'request' | 'response';
  method: string;
  payload: unknown;
  statusCode?: number;
  durationMs?: number;
}

export type {CatalogProduct as MCPProduct};

function getTimestamp(): string {
  return new Date().toLocaleTimeString('fr-FR', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

export async function searchShopCatalog(
  payload: CatalogSearchPayload,
  onLog?: (entry: MCPLogEntry) => void,
): Promise<CatalogProduct[]> {
  const startTime = Date.now();

  onLog?.({
    timestamp: getTimestamp(),
    direction: 'request',
    method: 'search_shop_catalog',
    payload,
  });

  const res = await fetch('/api/catalog-search', {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify(payload),
  });

  const data = (await res.json()) as {products: CatalogProduct[]};

  onLog?.({
    timestamp: getTimestamp(),
    direction: 'response',
    method: 'search_shop_catalog',
    payload: {count: data.products.length, products: data.products},
    statusCode: res.status,
    durationMs: Date.now() - startTime,
  });

  return data.products;
}
