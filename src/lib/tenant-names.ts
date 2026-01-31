/**
 * Tenant name mapping for org tenants that don't have a personal tenant profile.
 * This provides human-friendly names for Customer Success workflows.
 */

export interface TenantInfo {
  name: string;
  csm?: string;
  tier?: 'enterprise' | 'growth' | 'starter' | 'trial';
  notes?: string;
}

export const TENANT_NAMES: Record<string, TenantInfo> = {
  // Elliott Equipment Company
  '279ae256-3aef-413c-b735-73bacf172b7d': {
    name: 'Elliott Equipment Company',
    csm: 'Customer Success',
    tier: 'growth',
  },
  // Trace Audio (ben@traceaudio.com tenant)
  '75980a19-64ec-4f1a-a2ea-0446ea937b16': {
    name: 'Trace Audio',
    csm: 'Kyle',
    tier: 'growth',
  },
  // US Offsite
  'c35bb200-ce7f-4280-9108-f61227127a98': {
    name: 'US Offsite',
    tier: 'enterprise',
  },
  // Add more tenant mappings as discovered...
};

/**
 * Resolve a tenant ID to a human-friendly name.
 * Falls back to abbreviated UUID if no mapping exists.
 */
export function resolveTenantName(tenantId: string): string {
  const info = TENANT_NAMES[tenantId];
  if (info) return info.name;
  
  // Check if it looks like a personal tenant email
  if (tenantId.includes('@')) {
    return tenantId.split('@')[0];
  }
  
  // Fallback to "Org [short-id]"
  return `Org ${tenantId.slice(0, 8)}`;
}

/**
 * Get full tenant info including CSM and tier.
 */
export function getTenantInfo(tenantId: string): TenantInfo | null {
  return TENANT_NAMES[tenantId] || null;
}
