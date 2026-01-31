/**
 * Account Mappings & Overrides
 * 
 * Maps Arda tenant IDs to business accounts with additional metadata.
 * Currently uses a static mapping + Coda integration for overrides.
 */

import type { AccountSegment, AccountTier } from '../../src/lib/types/account';

// ============================================================================
// Account Mapping Types
// ============================================================================

export interface AccountMapping {
  accountId: string;           // Internal account ID (generated if not provided)
  tenantIds: string[];         // Arda tenant IDs that belong to this account
  
  // Identity
  name: string;                // Display name
  domain?: string;             // Primary email domain
  
  // Segmentation
  segment?: AccountSegment;
  tier?: AccountTier;
  industry?: string;
  region?: string;
  
  // Ownership
  ownerId?: string;
  ownerName?: string;
  ownerEmail?: string;
  
  // External IDs
  codaRowId?: string;
  hubspotId?: string;
  stripeId?: string;
  
  // Metadata
  notes?: string;
  tags?: string[];
  
  // Flags
  isInternal?: boolean;        // Internal/test account
  isExcluded?: boolean;        // Excluded from metrics
}

// ============================================================================
// Static Account Mappings
// Known accounts with their tenant IDs and metadata
// ============================================================================

export const STATIC_ACCOUNT_MAPPINGS: AccountMapping[] = [
  {
    accountId: 'elliott-equipment',
    tenantIds: ['279ae256-3aef-413c-b735-73bacf172b7d'],
    name: 'Elliott Equipment Company',
    domain: 'elliottequipment.com',
    segment: 'mid-market',
    tier: 'growth',
    ownerName: 'Customer Success',
  },
  {
    accountId: 'trace-audio',
    tenantIds: ['75980a19-64ec-4f1a-a2ea-0446ea937b16'],
    name: 'Trace Audio',
    domain: 'traceaudio.com',
    segment: 'smb',
    tier: 'growth',
    ownerName: 'Kyle',
  },
  {
    accountId: 'us-offsite',
    tenantIds: ['c35bb200-ce7f-4280-9108-f61227127a98'],
    name: 'US Offsite',
    domain: 'usoffsite.com',
    segment: 'enterprise',
    tier: 'enterprise',
  },
  // Internal/test accounts to exclude from metrics
  {
    accountId: 'arda-internal',
    tenantIds: [], // Will be populated dynamically
    name: 'Arda Internal',
    domain: 'arda.cards',
    isInternal: true,
    isExcluded: true,
  },
];

// Domains that indicate internal/test accounts
const INTERNAL_DOMAINS = ['arda.cards', 'arda.io', 'antigravity.io'];

// Public email domains that should create individual accounts
const PUBLIC_EMAIL_DOMAINS = [
  'gmail.com',
  'icloud.com',
  'outlook.com',
  'me.com',
  'yahoo.com',
  'hotmail.com',
  'aol.com',
  'protonmail.com',
];

// ============================================================================
// Mapping Functions
// ============================================================================

/**
 * Build a complete mapping from tenant IDs to account info.
 * Combines static mappings, Coda overrides, and auto-generated mappings.
 */
export function buildAccountMappings(
  tenantData: Array<{ tenantId: string; tenantName: string; email?: string }>,
  codaOverrides?: Map<string, Partial<AccountMapping>>
): Map<string, AccountMapping> {
  const mappings = new Map<string, AccountMapping>();
  
  // First, index static mappings by tenant ID for quick lookup
  const staticByTenant = new Map<string, AccountMapping>();
  for (const mapping of STATIC_ACCOUNT_MAPPINGS) {
    for (const tenantId of mapping.tenantIds) {
      staticByTenant.set(tenantId, mapping);
    }
  }
  
  // Process each tenant
  for (const tenant of tenantData) {
    // Check if there's a static mapping
    const staticMapping = staticByTenant.get(tenant.tenantId);
    if (staticMapping) {
      // Use static mapping, potentially with Coda overrides
      const codaOverride = codaOverrides?.get(tenant.tenantId);
      const merged = codaOverride 
        ? { ...staticMapping, ...codaOverride }
        : staticMapping;
      mappings.set(tenant.tenantId, merged);
      continue;
    }
    
    // Check for Coda override without static mapping
    const codaOverride = codaOverrides?.get(tenant.tenantId);
    if (codaOverride?.name) {
      mappings.set(tenant.tenantId, {
        accountId: generateAccountId(codaOverride.name),
        tenantIds: [tenant.tenantId],
        name: codaOverride.name,
        ...codaOverride,
      });
      continue;
    }
    
    // Auto-generate mapping from tenant data
    const autoMapping = generateMappingFromTenant(tenant);
    mappings.set(tenant.tenantId, autoMapping);
  }
  
  return mappings;
}

/**
 * Generate an account mapping from tenant information.
 */
function generateMappingFromTenant(
  tenant: { tenantId: string; tenantName: string; email?: string }
): AccountMapping {
  const emailInfo = extractEmailInfo(tenant.tenantName);
  
  if (emailInfo) {
    const { email, domain } = emailInfo;
    
    // Check if internal domain
    if (INTERNAL_DOMAINS.some(d => domain.endsWith(d))) {
      return {
        accountId: `internal-${tenant.tenantId.slice(0, 8)}`,
        tenantIds: [tenant.tenantId],
        name: email,
        domain,
        isInternal: true,
        isExcluded: true,
      };
    }
    
    // Check if public email domain
    if (PUBLIC_EMAIL_DOMAINS.includes(domain)) {
      return {
        accountId: `individual-${tenant.tenantId.slice(0, 8)}`,
        tenantIds: [tenant.tenantId],
        name: email,
        domain,
        segment: 'startup',
        tier: 'trial',
      };
    }
    
    // Business domain - derive company name
    return {
      accountId: `company-${domain.replace(/\./g, '-')}`,
      tenantIds: [tenant.tenantId],
      name: domainToCompanyName(domain),
      domain,
      segment: 'smb',
      tier: 'starter',
    };
  }
  
  // Organization tenant without personal email pattern
  return {
    accountId: `org-${tenant.tenantId.slice(0, 8)}`,
    tenantIds: [tenant.tenantId],
    name: tenant.tenantName || `Org ${tenant.tenantId.slice(0, 8)}`,
    segment: 'smb',
    tier: 'starter',
  };
}

/**
 * Extract email info from tenant name pattern "Personal tenant for email@domain.com"
 */
function extractEmailInfo(tenantName: string): { email: string; domain: string } | null {
  const match = tenantName.match(/Personal tenant for (.+)/);
  if (!match) return null;
  
  const email = match[1];
  const atIndex = email.lastIndexOf('@');
  if (atIndex === -1) return null;
  
  return {
    email,
    domain: email.substring(atIndex + 1).toLowerCase(),
  };
}

/**
 * Convert a domain to a human-readable company name.
 */
function domainToCompanyName(domain: string): string {
  return domain
    .replace(/\.(com|net|org|io|co|cards|ai|app)$/i, '')
    .replace(/[.-]/g, ' ')
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

/**
 * Generate a stable account ID from a name.
 */
function generateAccountId(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 50);
}

// ============================================================================
// Coda Integration (Optional)
// ============================================================================

/**
 * Fetch account overrides from Coda.
 * Falls back gracefully if Coda is not configured or fails.
 */
export async function fetchCodaOverrides(
  codaToken?: string,
  docId?: string
): Promise<Map<string, Partial<AccountMapping>>> {
  const overrides = new Map<string, Partial<AccountMapping>>();
  
  if (!codaToken || !docId) {
    return overrides;
  }
  
  try {
    // First, find the Customer Overrides table
    const tablesResponse = await fetch(
      `https://coda.io/apis/v1/docs/${docId}/tables`,
      {
        headers: {
          'Authorization': `Bearer ${codaToken}`,
          'Content-Type': 'application/json',
        },
      }
    );
    
    if (!tablesResponse.ok) {
      console.error('Failed to fetch Coda tables:', tablesResponse.status);
      return overrides;
    }
    
    const tables = await tablesResponse.json();
    const overridesTable = tables.items?.find(
      (t: { name: string }) => t.name === 'Customer Overrides'
    );
    
    if (!overridesTable) {
      console.warn('Customer Overrides table not found in Coda doc');
      return overrides;
    }
    
    // Fetch rows from the table
    const rowsResponse = await fetch(
      `https://coda.io/apis/v1/docs/${docId}/tables/${overridesTable.id}/rows`,
      {
        headers: {
          'Authorization': `Bearer ${codaToken}`,
          'Content-Type': 'application/json',
        },
      }
    );
    
    if (!rowsResponse.ok) {
      console.error('Failed to fetch Coda rows:', rowsResponse.status);
      return overrides;
    }
    
    const rows = await rowsResponse.json();
    
    for (const row of rows.items || []) {
      const values = row.values;
      const tenantId = values['TenantId'] || values['c-TenantId'];
      
      if (!tenantId) continue;
      
      const override: Partial<AccountMapping> = {};
      
      // Map Coda columns to AccountMapping fields
      const displayName = values['DisplayName'] || values['c-DisplayName'];
      if (displayName) override.name = displayName;
      
      const csm = values['CSM'] || values['c-CSM'];
      if (csm) override.ownerName = csm;
      
      const tier = values['Tier'] || values['c-Tier'];
      if (tier) override.tier = tier.toLowerCase() as AccountTier;
      
      const notes = values['Notes'] || values['c-Notes'];
      if (notes) override.notes = notes;
      
      const segment = values['Segment'] || values['c-Segment'];
      if (segment) override.segment = segment.toLowerCase() as AccountSegment;
      
      overrides.set(tenantId, override);
    }
    
    return overrides;
  } catch (error) {
    console.error('Error fetching Coda overrides:', error);
    return overrides;
  }
}
