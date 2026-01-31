/**
 * Coda Sync Library
 * 
 * Server-side functions for reading and writing data to Coda.
 * Handles CS Interactions and Account Overrides tables.
 */

import type { 
  Interaction, 
  InteractionType, 
  InteractionChannel,
  AccountTier,
  AccountSegment,
} from '../../src/lib/types/account';

// ============================================================================
// Configuration
// ============================================================================

const CODA_API_BASE = 'https://coda.io/apis/v1';

// Table name mappings
const TABLE_NAMES = {
  interactions: ['CS Interactions', 'Interactions', 'CSM Interactions', 'Customer Interactions'],
  overrides: ['Customer Overrides', 'Account Overrides', 'Customers'],
};

// Column name aliases for flexible schema matching
const COLUMN_ALIASES = {
  // Interactions table columns
  tenantId: ['TenantId', 'c-TenantId', 'Tenant ID', 'AccountId', 'Account ID'],
  date: ['Date', 'c-Date', 'OccurredAt', 'Occurred At', 'Timestamp'],
  type: ['Type', 'c-Type', 'Interaction Type', 'InteractionType'],
  channel: ['Channel', 'c-Channel', 'Communication Channel'],
  subject: ['Subject', 'c-Subject', 'Title'],
  summary: ['Summary', 'c-Summary', 'Notes', 'Description', 'Content'],
  sentiment: ['Sentiment', 'c-Sentiment', 'Tone'],
  nextAction: ['NextAction', 'c-NextAction', 'Next Action', 'Follow Up', 'FollowUp'],
  nextActionDate: ['NextActionDate', 'c-NextActionDate', 'Next Action Date', 'Follow Up Date'],
  createdBy: ['CreatedBy', 'c-CreatedBy', 'Created By', 'Author', 'CSM'],
  createdAt: ['CreatedAt', 'c-CreatedAt', 'Created At', 'LoggedAt'],
  
  // Overrides table columns
  displayName: ['DisplayName', 'c-DisplayName', 'Display Name', 'Name', 'Company Name'],
  csm: ['CSM', 'c-CSM', 'Owner', 'Account Owner', 'Customer Success Manager'],
  tier: ['Tier', 'c-Tier', 'Account Tier', 'Plan Tier'],
  segment: ['Segment', 'c-Segment', 'Account Segment', 'Customer Segment'],
  notes: ['Notes', 'c-Notes', 'Account Notes', 'Comments'],
  hubspotId: ['HubSpotId', 'c-HubSpotId', 'HubSpot ID'],
  stripeId: ['StripeId', 'c-StripeId', 'Stripe ID'],
  domain: ['Domain', 'c-Domain', 'Company Domain'],
  industry: ['Industry', 'c-Industry', 'Vertical'],
  region: ['Region', 'c-Region', 'Territory', 'Geo'],
  tags: ['Tags', 'c-Tags', 'Labels'],
  isExcluded: ['Excluded', 'c-Excluded', 'Is Excluded', 'Exclude'],
};

// ============================================================================
// Types
// ============================================================================

export interface CodaInteraction {
  id?: string;
  rowId?: string;
  tenantId: string;
  date: string;
  type: InteractionType;
  channel?: InteractionChannel;
  subject?: string;
  summary: string;
  sentiment?: 'positive' | 'neutral' | 'negative';
  nextAction?: string;
  nextActionDate?: string;
  createdBy: string;
  createdAt?: string;
}

export interface AccountOverride {
  tenantId: string;
  displayName?: string;
  csm?: string;
  tier?: AccountTier;
  segment?: AccountSegment;
  notes?: string;
  hubspotId?: string;
  stripeId?: string;
  domain?: string;
  industry?: string;
  region?: string;
  tags?: string[];
  isExcluded?: boolean;
  rowId?: string;
}

interface CodaTable {
  id: string;
  name: string;
}

interface CodaRow {
  id: string;
  values: Record<string, unknown>;
}

interface CodaColumn {
  id: string;
  name: string;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Make a request to the Coda API.
 */
async function codaFetch<T>(
  endpoint: string,
  token: string,
  options: RequestInit = {}
): Promise<T | null> {
  if (!token) {
    console.warn('No Coda API token provided');
    return null;
  }

  try {
    const response = await fetch(`${CODA_API_BASE}${endpoint}`, {
      ...options,
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Coda API error (${response.status}):`, errorText);
      return null;
    }

    return response.json();
  } catch (error) {
    console.error('Coda API request failed:', error);
    return null;
  }
}

/**
 * Find a table by name from a list of possible names.
 */
async function findTable(
  docId: string,
  token: string,
  tableNames: string[]
): Promise<CodaTable | null> {
  const tables = await codaFetch<{ items: CodaTable[] }>(
    `/docs/${docId}/tables`,
    token
  );

  if (!tables?.items) return null;

  for (const name of tableNames) {
    const table = tables.items.find(
      t => t.name.toLowerCase() === name.toLowerCase()
    );
    if (table) return table;
  }

  return null;
}

/**
 * Get column IDs for a table, mapping aliases to actual column IDs.
 */
async function getColumnMapping(
  docId: string,
  tableId: string,
  token: string
): Promise<Map<string, string>> {
  const columns = await codaFetch<{ items: CodaColumn[] }>(
    `/docs/${docId}/tables/${tableId}/columns`,
    token
  );

  const mapping = new Map<string, string>();
  if (!columns?.items) return mapping;

  // For each alias set, find the matching column
  for (const [fieldName, aliases] of Object.entries(COLUMN_ALIASES)) {
    for (const alias of aliases) {
      const column = columns.items.find(
        c => c.name.toLowerCase() === alias.toLowerCase() || c.id === alias
      );
      if (column) {
        mapping.set(fieldName, column.id);
        break;
      }
    }
  }

  return mapping;
}

/**
 * Get a value from Coda row values, checking multiple possible column names.
 */
function getCodaValue(
  values: Record<string, unknown>,
  field: keyof typeof COLUMN_ALIASES
): unknown {
  const aliases = COLUMN_ALIASES[field];
  for (const alias of aliases) {
    if (values[alias] !== undefined && values[alias] !== null && values[alias] !== '') {
      return values[alias];
    }
  }
  return undefined;
}

// ============================================================================
// Interactions CRUD
// ============================================================================

/**
 * Fetch all interactions for a specific account from Coda.
 */
export async function fetchInteractions(
  tenantId: string,
  codaToken: string,
  codaDocId: string
): Promise<CodaInteraction[]> {
  if (!codaToken || !codaDocId) {
    return [];
  }

  // Find the interactions table
  const table = await findTable(codaDocId, codaToken, TABLE_NAMES.interactions);
  if (!table) {
    console.warn('CS Interactions table not found in Coda doc');
    return [];
  }

  // Fetch rows with query filter
  const url = `/docs/${codaDocId}/tables/${table.id}/rows?valueFormat=simpleWithArrays&query=TenantId:"${tenantId}"`;
  const rows = await codaFetch<{ items: CodaRow[] }>(url, codaToken);

  if (!rows?.items) {
    return [];
  }

  // Transform rows to interactions
  return rows.items.map((row): CodaInteraction => ({
    id: row.id,
    rowId: row.id,
    tenantId: (getCodaValue(row.values, 'tenantId') as string) || tenantId,
    date: (getCodaValue(row.values, 'date') as string) || new Date().toISOString(),
    type: (getCodaValue(row.values, 'type') as InteractionType) || 'note',
    channel: getCodaValue(row.values, 'channel') as InteractionChannel | undefined,
    subject: getCodaValue(row.values, 'subject') as string | undefined,
    summary: (getCodaValue(row.values, 'summary') as string) || '',
    sentiment: getCodaValue(row.values, 'sentiment') as 'positive' | 'neutral' | 'negative' | undefined,
    nextAction: getCodaValue(row.values, 'nextAction') as string | undefined,
    nextActionDate: getCodaValue(row.values, 'nextActionDate') as string | undefined,
    createdBy: (getCodaValue(row.values, 'createdBy') as string) || 'Unknown',
    createdAt: getCodaValue(row.values, 'createdAt') as string | undefined,
  })).sort((a, b) => 
    new Date(b.date).getTime() - new Date(a.date).getTime()
  );
}

/**
 * Create a new interaction in Coda.
 */
export async function createInteraction(
  interaction: Omit<CodaInteraction, 'id' | 'rowId'>,
  codaToken: string,
  codaDocId: string
): Promise<CodaInteraction | null> {
  if (!codaToken || !codaDocId) {
    console.error('Coda credentials not configured');
    return null;
  }

  // Find the interactions table
  const table = await findTable(codaDocId, codaToken, TABLE_NAMES.interactions);
  if (!table) {
    console.error('CS Interactions table not found in Coda doc');
    return null;
  }

  // Get column mapping
  const columnMapping = await getColumnMapping(codaDocId, table.id, codaToken);

  // Build cells array
  const cells = [];
  
  const tenantIdCol = columnMapping.get('tenantId');
  if (tenantIdCol) cells.push({ column: tenantIdCol, value: interaction.tenantId });
  
  const dateCol = columnMapping.get('date');
  if (dateCol) cells.push({ column: dateCol, value: interaction.date });
  
  const typeCol = columnMapping.get('type');
  if (typeCol) cells.push({ column: typeCol, value: interaction.type });
  
  const channelCol = columnMapping.get('channel');
  if (channelCol && interaction.channel) cells.push({ column: channelCol, value: interaction.channel });
  
  const subjectCol = columnMapping.get('subject');
  if (subjectCol && interaction.subject) cells.push({ column: subjectCol, value: interaction.subject });
  
  const summaryCol = columnMapping.get('summary');
  if (summaryCol) cells.push({ column: summaryCol, value: interaction.summary });
  
  const sentimentCol = columnMapping.get('sentiment');
  if (sentimentCol && interaction.sentiment) cells.push({ column: sentimentCol, value: interaction.sentiment });
  
  const nextActionCol = columnMapping.get('nextAction');
  if (nextActionCol && interaction.nextAction) cells.push({ column: nextActionCol, value: interaction.nextAction });
  
  const nextActionDateCol = columnMapping.get('nextActionDate');
  if (nextActionDateCol && interaction.nextActionDate) cells.push({ column: nextActionDateCol, value: interaction.nextActionDate });
  
  const createdByCol = columnMapping.get('createdBy');
  if (createdByCol) cells.push({ column: createdByCol, value: interaction.createdBy });
  
  const createdAtCol = columnMapping.get('createdAt');
  if (createdAtCol) cells.push({ column: createdAtCol, value: interaction.createdAt || new Date().toISOString() });

  // If no column mapping was found, try with default column names
  if (cells.length === 0) {
    cells.push(
      { column: 'TenantId', value: interaction.tenantId },
      { column: 'Date', value: interaction.date },
      { column: 'Type', value: interaction.type },
      { column: 'Summary', value: interaction.summary },
      { column: 'CreatedBy', value: interaction.createdBy },
      { column: 'CreatedAt', value: interaction.createdAt || new Date().toISOString() }
    );
    
    if (interaction.channel) cells.push({ column: 'Channel', value: interaction.channel });
    if (interaction.subject) cells.push({ column: 'Subject', value: interaction.subject });
    if (interaction.sentiment) cells.push({ column: 'Sentiment', value: interaction.sentiment });
    if (interaction.nextAction) cells.push({ column: 'NextAction', value: interaction.nextAction });
    if (interaction.nextActionDate) cells.push({ column: 'NextActionDate', value: interaction.nextActionDate });
  }

  // Insert the row
  const result = await codaFetch<{ addedRowIds: string[] }>(
    `/docs/${codaDocId}/tables/${table.id}/rows`,
    codaToken,
    {
      method: 'POST',
      body: JSON.stringify({
        rows: [{ cells }],
      }),
    }
  );

  if (!result?.addedRowIds?.[0]) {
    console.error('Failed to create interaction in Coda');
    return null;
  }

  return {
    ...interaction,
    id: result.addedRowIds[0],
    rowId: result.addedRowIds[0],
    createdAt: interaction.createdAt || new Date().toISOString(),
  };
}

// ============================================================================
// Account Overrides CRUD
// ============================================================================

/**
 * Fetch account override for a specific tenant from Coda.
 */
export async function fetchAccountOverride(
  tenantId: string,
  codaToken: string,
  codaDocId: string
): Promise<AccountOverride | null> {
  if (!codaToken || !codaDocId) {
    return null;
  }

  // Find the overrides table
  const table = await findTable(codaDocId, codaToken, TABLE_NAMES.overrides);
  if (!table) {
    console.warn('Customer Overrides table not found in Coda doc');
    return null;
  }

  // Fetch row with query filter
  const url = `/docs/${codaDocId}/tables/${table.id}/rows?valueFormat=simpleWithArrays&query=TenantId:"${tenantId}"`;
  const rows = await codaFetch<{ items: CodaRow[] }>(url, codaToken);

  if (!rows?.items?.length) {
    return null;
  }

  const row = rows.items[0];
  const values = row.values;

  const override: AccountOverride = {
    tenantId,
    rowId: row.id,
  };

  const displayName = getCodaValue(values, 'displayName') as string | undefined;
  if (displayName) override.displayName = displayName;

  const csm = getCodaValue(values, 'csm') as string | undefined;
  if (csm) override.csm = csm;

  const tier = getCodaValue(values, 'tier') as string | undefined;
  if (tier) override.tier = tier.toLowerCase() as AccountTier;

  const segment = getCodaValue(values, 'segment') as string | undefined;
  if (segment) override.segment = segment.toLowerCase() as AccountSegment;

  const notes = getCodaValue(values, 'notes') as string | undefined;
  if (notes) override.notes = notes;

  const hubspotId = getCodaValue(values, 'hubspotId') as string | undefined;
  if (hubspotId) override.hubspotId = hubspotId;

  const stripeId = getCodaValue(values, 'stripeId') as string | undefined;
  if (stripeId) override.stripeId = stripeId;

  const domain = getCodaValue(values, 'domain') as string | undefined;
  if (domain) override.domain = domain;

  const industry = getCodaValue(values, 'industry') as string | undefined;
  if (industry) override.industry = industry;

  const region = getCodaValue(values, 'region') as string | undefined;
  if (region) override.region = region;

  const tags = getCodaValue(values, 'tags') as string[] | string | undefined;
  if (tags) {
    override.tags = Array.isArray(tags) ? tags : tags.split(',').map(t => t.trim());
  }

  const isExcluded = getCodaValue(values, 'isExcluded');
  if (isExcluded === true || isExcluded === 'true' || isExcluded === 'Yes') {
    override.isExcluded = true;
  }

  return override;
}

/**
 * Update or create an account override in Coda.
 * Uses upsert pattern with TenantId as the key column.
 */
export async function upsertAccountOverride(
  override: AccountOverride,
  codaToken: string,
  codaDocId: string
): Promise<boolean> {
  if (!codaToken || !codaDocId) {
    console.error('Coda credentials not configured');
    return false;
  }

  // Find the overrides table
  const table = await findTable(codaDocId, codaToken, TABLE_NAMES.overrides);
  if (!table) {
    console.error('Customer Overrides table not found in Coda doc');
    return false;
  }

  // Build cells array with only defined values
  const cells = [
    { column: 'TenantId', value: override.tenantId },
  ];

  if (override.displayName !== undefined) {
    cells.push({ column: 'DisplayName', value: override.displayName });
  }
  if (override.csm !== undefined) {
    cells.push({ column: 'CSM', value: override.csm });
  }
  if (override.tier !== undefined) {
    cells.push({ column: 'Tier', value: override.tier.charAt(0).toUpperCase() + override.tier.slice(1) });
  }
  if (override.segment !== undefined) {
    cells.push({ column: 'Segment', value: override.segment.charAt(0).toUpperCase() + override.segment.slice(1) });
  }
  if (override.notes !== undefined) {
    cells.push({ column: 'Notes', value: override.notes });
  }
  if (override.hubspotId !== undefined) {
    cells.push({ column: 'HubSpotId', value: override.hubspotId });
  }
  if (override.stripeId !== undefined) {
    cells.push({ column: 'StripeId', value: override.stripeId });
  }
  if (override.domain !== undefined) {
    cells.push({ column: 'Domain', value: override.domain });
  }
  if (override.industry !== undefined) {
    cells.push({ column: 'Industry', value: override.industry });
  }
  if (override.region !== undefined) {
    cells.push({ column: 'Region', value: override.region });
  }
  if (override.tags !== undefined) {
    cells.push({ column: 'Tags', value: override.tags.join(', ') });
  }
  if (override.isExcluded !== undefined) {
    cells.push({ column: 'Excluded', value: override.isExcluded });
  }

  // Upsert the row
  const result = await codaFetch(
    `/docs/${codaDocId}/tables/${table.id}/rows`,
    codaToken,
    {
      method: 'POST',
      body: JSON.stringify({
        rows: [{ cells }],
        keyColumns: ['TenantId'],
      }),
    }
  );

  return !!result;
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Convert CodaInteraction to the canonical Interaction type.
 */
export function codaInteractionToInteraction(
  codaInteraction: CodaInteraction,
  accountId: string
): Interaction {
  return {
    id: codaInteraction.id || codaInteraction.rowId || crypto.randomUUID(),
    accountId,
    type: codaInteraction.type,
    channel: codaInteraction.channel || 'other',
    subject: codaInteraction.subject,
    summary: codaInteraction.summary,
    sentiment: codaInteraction.sentiment,
    createdById: codaInteraction.createdBy,
    createdByName: codaInteraction.createdBy,
    nextAction: codaInteraction.nextAction,
    nextActionDate: codaInteraction.nextActionDate,
    occurredAt: codaInteraction.date,
    createdAt: codaInteraction.createdAt || codaInteraction.date,
  };
}

/**
 * Check if Coda is properly configured.
 */
export function isCodaConfigured(token?: string, docId?: string): boolean {
  return !!(token && docId);
}
