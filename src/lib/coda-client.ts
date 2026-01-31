/**
 * Coda API Client for Dashboard Data Persistence
 * Doc: Arda Customer Dashboard (0cEU3RTNX6)
 */

const CODA_DOC_ID = '0cEU3RTNX6';
const CODA_API_BASE = 'https://coda.io/apis/v1';

// Get Coda API token from environment or localStorage
const getCodaToken = () => {
  return import.meta.env.VITE_CODA_API_TOKEN || localStorage.getItem('coda_api_token') || '';
};

// Table IDs (will be created on first use)
let customerOverridesTableId: string | null = null;
let interactionsTableId: string | null = null;

// Customer Override data structure
export interface CustomerOverride {
  tenantId: string;
  displayName: string;
  csm?: string;
  tier?: 'enterprise' | 'growth' | 'starter' | 'trial';
  notes?: string;
}

// Interaction data structure
export interface CodaInteraction {
  id?: string;
  tenantId: string;
  date: string;
  type: 'call' | 'email' | 'meeting' | 'note';
  summary: string;
  nextAction?: string;
  createdBy: string;
}

// Helper for Coda API requests
async function codaFetch(endpoint: string, options: RequestInit = {}) {
  const token = getCodaToken();
  if (!token) {
    console.warn('No Coda API token configured');
    return null;
  }

  const response = await fetch(`${CODA_API_BASE}${endpoint}`, {
    ...options,
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  if (!response.ok) {
    console.error('Coda API error:', response.status, await response.text());
    return null;
  }

  return response.json();
}

// Get or create Customer Overrides table
async function getOrCreateCustomerOverridesTable(): Promise<string | null> {
  if (customerOverridesTableId) return customerOverridesTableId;

  // List existing tables
  const tables = await codaFetch(`/docs/${CODA_DOC_ID}/tables`);
  if (!tables) return null;

  // Look for existing Customer Overrides table
  const existing = tables.items?.find((t: { name: string }) => t.name === 'Customer Overrides');
  if (existing) {
    customerOverridesTableId = existing.id;
    return existing.id;
  }

  // Table doesn't exist - we'll use localStorage as fallback
  console.warn('Customer Overrides table not found in Coda. Using localStorage fallback.');
  return null;
}

// Get or create Interactions table
async function getOrCreateInteractionsTable(): Promise<string | null> {
  if (interactionsTableId) return interactionsTableId;

  const tables = await codaFetch(`/docs/${CODA_DOC_ID}/tables`);
  if (!tables) return null;

  const existing = tables.items?.find((t: { name: string }) => t.name === 'Interactions');
  if (existing) {
    interactionsTableId = existing.id;
    return existing.id;
  }

  console.warn('Interactions table not found in Coda. Using localStorage fallback.');
  return null;
}

// ============ Customer Overrides ============

const OVERRIDES_STORAGE_KEY = 'arda_customer_overrides';

// Get customer overrides (try Coda first, fall back to localStorage)
export async function getCustomerOverrides(): Promise<Record<string, CustomerOverride>> {
  const tableId = await getOrCreateCustomerOverridesTable();
  
  if (tableId) {
    const rows = await codaFetch(`/docs/${CODA_DOC_ID}/tables/${tableId}/rows`);
    if (rows?.items) {
      const overrides: Record<string, CustomerOverride> = {};
      for (const row of rows.items) {
        const tenantId = row.values['TenantId'] || row.values['c-TenantId'];
        if (tenantId) {
          overrides[tenantId] = {
            tenantId,
            displayName: row.values['DisplayName'] || row.values['c-DisplayName'] || '',
            csm: row.values['CSM'] || row.values['c-CSM'],
            tier: row.values['Tier'] || row.values['c-Tier'],
            notes: row.values['Notes'] || row.values['c-Notes'],
          };
        }
      }
      return overrides;
    }
  }

  // Fallback to localStorage
  try {
    const data = localStorage.getItem(OVERRIDES_STORAGE_KEY);
    return data ? JSON.parse(data) : {};
  } catch {
    return {};
  }
}

// Save customer override
export async function saveCustomerOverride(override: CustomerOverride): Promise<boolean> {
  const tableId = await getOrCreateCustomerOverridesTable();

  if (tableId) {
    // Upsert to Coda
    const result = await codaFetch(`/docs/${CODA_DOC_ID}/tables/${tableId}/rows`, {
      method: 'POST',
      body: JSON.stringify({
        rows: [{
          cells: [
            { column: 'TenantId', value: override.tenantId },
            { column: 'DisplayName', value: override.displayName },
            { column: 'CSM', value: override.csm || '' },
            { column: 'Tier', value: override.tier || '' },
            { column: 'Notes', value: override.notes || '' },
          ],
        }],
        keyColumns: ['TenantId'],
      }),
    });
    return !!result;
  }

  // Fallback to localStorage
  try {
    const data = localStorage.getItem(OVERRIDES_STORAGE_KEY);
    const overrides: Record<string, CustomerOverride> = data ? JSON.parse(data) : {};
    overrides[override.tenantId] = override;
    localStorage.setItem(OVERRIDES_STORAGE_KEY, JSON.stringify(overrides));
    return true;
  } catch {
    return false;
  }
}

// ============ Interactions ============

const INTERACTIONS_STORAGE_KEY = 'arda_csm_interactions';

// Get interactions for a tenant
export async function getInteractions(tenantId: string): Promise<CodaInteraction[]> {
  const tableId = await getOrCreateInteractionsTable();

  if (tableId) {
    const rows = await codaFetch(
      `/docs/${CODA_DOC_ID}/tables/${tableId}/rows?query=TenantId:"${tenantId}"`
    );
    if (rows?.items) {
      return rows.items.map((row: { id: string; values: Record<string, string> }) => ({
        id: row.id,
        tenantId: row.values['TenantId'] || row.values['c-TenantId'],
        date: row.values['Date'] || row.values['c-Date'],
        type: row.values['Type'] || row.values['c-Type'],
        summary: row.values['Summary'] || row.values['c-Summary'],
        nextAction: row.values['NextAction'] || row.values['c-NextAction'],
        createdBy: row.values['CreatedBy'] || row.values['c-CreatedBy'],
      }));
    }
  }

  // Fallback to localStorage
  try {
    const data = localStorage.getItem(INTERACTIONS_STORAGE_KEY);
    if (!data) return [];
    const allInteractions: Record<string, CodaInteraction[]> = JSON.parse(data);
    return allInteractions[tenantId] || [];
  } catch {
    return [];
  }
}

// Save interaction
export async function saveInteractionToCoda(tenantId: string, interaction: CodaInteraction): Promise<boolean> {
  const tableId = await getOrCreateInteractionsTable();

  if (tableId) {
    const result = await codaFetch(`/docs/${CODA_DOC_ID}/tables/${tableId}/rows`, {
      method: 'POST',
      body: JSON.stringify({
        rows: [{
          cells: [
            { column: 'TenantId', value: tenantId },
            { column: 'Date', value: interaction.date },
            { column: 'Type', value: interaction.type },
            { column: 'Summary', value: interaction.summary },
            { column: 'NextAction', value: interaction.nextAction || '' },
            { column: 'CreatedBy', value: interaction.createdBy },
          ],
        }],
      }),
    });
    return !!result;
  }

  // Fallback to localStorage
  try {
    const data = localStorage.getItem(INTERACTIONS_STORAGE_KEY);
    const allInteractions: Record<string, CodaInteraction[]> = data ? JSON.parse(data) : {};
    if (!allInteractions[tenantId]) {
      allInteractions[tenantId] = [];
    }
    allInteractions[tenantId].unshift(interaction);
    localStorage.setItem(INTERACTIONS_STORAGE_KEY, JSON.stringify(allInteractions));
    return true;
  } catch {
    return false;
  }
}

// Check if Coda is configured
export function isCodaConfigured(): boolean {
  return !!getCodaToken();
}
