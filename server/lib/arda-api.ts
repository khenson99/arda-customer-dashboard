/**
 * Arda API Client for Server-Side Use
 * 
 * This is a server-side version of the Arda client that runs in Vercel
 * serverless functions. It handles pagination, caching, and data normalization.
 */

const ARDA_BASE_URL = 'https://prod.alpha001.io.arda.cards';

interface QueryOptions {
  filter?: Record<string, unknown> | boolean;
  sort?: { entries: Array<{ field: string; direction: 'ASC' | 'DESC' }> };
  paginate?: { index: number; size: number };
}

interface QueryResult<T> {
  results: T[];
  nextPage?: string;
}

// Create headers for Arda API calls
function createHeaders(apiKey: string, author: string): Record<string, string> {
  return {
    'Authorization': `Bearer ${apiKey}`,
    'X-Author': author,
    'X-Request-ID': crypto.randomUUID(),
    'Content-Type': 'application/json',
  };
}

// Generic query function with pagination support
async function queryEntity<T>(
  service: string,
  entity: string,
  apiKey: string,
  author: string,
  options: QueryOptions = {}
): Promise<QueryResult<T>> {
  const timestamp = Date.now();
  const url = `${ARDA_BASE_URL}/v1/${service}/${entity}/query?effectiveasof=${timestamp}`;
  
  const queryBody = {
    filter: options.filter ?? true,
    sort: options.sort || { entries: [] },
    paginate: options.paginate || { index: 0, size: 500 },
  };
  
  const response = await fetch(url, {
    method: 'POST',
    headers: createHeaders(apiKey, author),
    body: JSON.stringify(queryBody),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Arda API Error: ${response.status} ${response.statusText} - ${errorText}`);
  }

  return response.json() as Promise<QueryResult<T>>;
}

// Fetch all pages of an entity (with safety limit)
async function queryAllPages<T>(
  service: string,
  entity: string,
  apiKey: string,
  author: string,
  maxPages: number = 10
): Promise<T[]> {
  const allResults: T[] = [];
  let pageIndex = 0;
  
  while (pageIndex < maxPages) {
    const result = await queryEntity<T>(service, entity, apiKey, author, {
      paginate: { index: pageIndex, size: 500 },
    });
    
    allResults.push(...result.results);
    
    // If we got fewer results than the page size, we've reached the end
    if (result.results.length < 500) {
      break;
    }
    
    pageIndex++;
  }
  
  return allResults;
}

// ============================================================================
// Arda Entity Types (Raw API Responses)
// ============================================================================

export interface ArdaTenant {
  rId: string;
  asOf: {
    effective: number;
    recorded: number;
  };
  payload: {
    eId: string;
    tenantName: string;
    company: {
      name: string;
    };
    plan: string;
    subscriptionReference?: {
      state: string;
    };
  };
  metadata: Record<string, unknown>;
  author: string;
  createdBy: string;
  createdAt: {
    effective: number;
    recorded: number;
  };
  retired: boolean;
}

export interface ArdaItem {
  rId: string;
  payload: {
    name?: string;
    sku?: string;
  };
  metadata: Record<string, unknown>;
  author?: string;
  createdBy?: string;
  createdAt: {
    effective: number;
    recorded: number;
  };
}

export interface ArdaKanbanCard {
  rId: string;
  payload: {
    title?: string;
    state?: string;
    item?: {
      eId: string;
      name?: string;
    };
  };
  metadata: Record<string, unknown>;
  author?: string;
  createdBy?: string;
  createdAt: {
    effective: number;
    recorded: number;
  };
}

export interface ArdaOrder {
  rId: string;
  payload: {
    status?: string;
    lineItems?: unknown[];
  };
  metadata: Record<string, unknown>;
  author?: string;
  createdBy?: string;
  createdAt: {
    effective: number;
    recorded: number;
  };
}

export interface ArdaUserAccount {
  rId: string;
  payload: {
    identity: {
      email: string;
      firstName?: string;
      lastName?: string;
    };
    activeAgency?: {
      tenant: string;
    };
  };
  createdAt: {
    effective: number;
    recorded: number;
  };
}

// ============================================================================
// Aggregated Data Types
// ============================================================================

export interface TenantActivityData {
  tenantId: string;
  itemCount: number;
  kanbanCardCount: number;
  orderCount: number;
  uniqueAuthors: Set<string>;
  activityTimestamps: number[];
  lastActivityTimestamp: number;
  firstActivityTimestamp: number;
}

// ============================================================================
// API Functions
// ============================================================================

export async function fetchTenants(apiKey: string, author: string): Promise<ArdaTenant[]> {
  return queryAllPages<ArdaTenant>('tenant', 'tenant', apiKey, author);
}

export async function fetchItems(apiKey: string, author: string): Promise<ArdaItem[]> {
  return queryAllPages<ArdaItem>('item', 'item', apiKey, author);
}

export async function fetchKanbanCards(apiKey: string, author: string): Promise<ArdaKanbanCard[]> {
  return queryAllPages<ArdaKanbanCard>('kanban', 'kanban-card', apiKey, author);
}

export async function fetchOrders(apiKey: string, author: string): Promise<ArdaOrder[]> {
  return queryAllPages<ArdaOrder>('order', 'order', apiKey, author);
}

export async function fetchUserAccounts(apiKey: string, author: string): Promise<ArdaUserAccount[]> {
  return queryAllPages<ArdaUserAccount>('user-account', 'user-account', apiKey, author);
}

// ============================================================================
// Data Aggregation Functions
// ============================================================================

/**
 * Aggregate all entity data by tenant ID.
 * This is the core data transformation that powers the dashboard.
 */
export async function aggregateByTenant(
  apiKey: string,
  author: string
): Promise<Map<string, TenantActivityData>> {
  // Fetch activity data in parallel (tenants fetched separately by consumers who need tenant info)
  const [items, kanbanCards, orders] = await Promise.all([
    fetchItems(apiKey, author).catch(() => []),
    fetchKanbanCards(apiKey, author).catch(() => []),
    fetchOrders(apiKey, author).catch(() => []),
  ]);
  
  const aggregation = new Map<string, TenantActivityData>();
  
  // Helper to get or create tenant data
  const getOrCreate = (tenantId: string): TenantActivityData => {
    if (!aggregation.has(tenantId)) {
      aggregation.set(tenantId, {
        tenantId,
        itemCount: 0,
        kanbanCardCount: 0,
        orderCount: 0,
        uniqueAuthors: new Set(),
        activityTimestamps: [],
        lastActivityTimestamp: 0,
        firstActivityTimestamp: Infinity,
      });
    }
    return aggregation.get(tenantId)!;
  };
  
  // Process items
  for (const item of items) {
    const tenantId = (item.metadata as Record<string, unknown>)?.tenantId as string;
    if (!tenantId) continue;
    
    const data = getOrCreate(tenantId);
    data.itemCount++;
    
    const author = item.author || item.createdBy;
    if (author) data.uniqueAuthors.add(author);
    
    const timestamp = item.createdAt?.effective;
    if (timestamp) {
      data.activityTimestamps.push(timestamp);
      data.lastActivityTimestamp = Math.max(data.lastActivityTimestamp, timestamp);
      data.firstActivityTimestamp = Math.min(data.firstActivityTimestamp, timestamp);
    }
  }
  
  // Process kanban cards
  for (const card of kanbanCards) {
    const tenantId = (card.metadata as Record<string, unknown>)?.tenantId as string;
    if (!tenantId) continue;
    
    const data = getOrCreate(tenantId);
    data.kanbanCardCount++;
    
    const author = card.author || card.createdBy;
    if (author) data.uniqueAuthors.add(author);
    
    const timestamp = card.createdAt?.effective;
    if (timestamp) {
      data.activityTimestamps.push(timestamp);
      data.lastActivityTimestamp = Math.max(data.lastActivityTimestamp, timestamp);
      data.firstActivityTimestamp = Math.min(data.firstActivityTimestamp, timestamp);
    }
  }
  
  // Process orders
  for (const order of orders) {
    const tenantId = (order.metadata as Record<string, unknown>)?.tenantId as string;
    if (!tenantId) continue;
    
    const data = getOrCreate(tenantId);
    data.orderCount++;
    
    const author = order.author || order.createdBy;
    if (author) data.uniqueAuthors.add(author);
    
    const timestamp = order.createdAt?.effective;
    if (timestamp) {
      data.activityTimestamps.push(timestamp);
      data.lastActivityTimestamp = Math.max(data.lastActivityTimestamp, timestamp);
      data.firstActivityTimestamp = Math.min(data.firstActivityTimestamp, timestamp);
    }
  }
  
  return aggregation;
}

/**
 * Extract email info from tenant name pattern "Personal tenant for email@domain.com"
 */
export function extractEmailInfo(tenantName: string): { email: string; domain: string } | null {
  const match = tenantName.match(/Personal tenant for (.+)/);
  if (!match) return null;
  const email = match[1];
  const parts = email.split('@');
  if (parts.length !== 2) return null;
  return { email, domain: parts[1].toLowerCase() };
}

/**
 * Derive a company name from an email domain
 */
export function domainToCompanyName(domain: string): string {
  const name = domain
    .replace(/\.(com|net|org|io|co|cards)$/, '')
    .replace(/[.-]/g, ' ')
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
  return name;
}

// Public email domains that should not be grouped
export const PUBLIC_DOMAINS = ['gmail.com', 'icloud.com', 'outlook.com', 'me.com', 'yahoo.com', 'hotmail.com'];
