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
  // Trace Audio
  '75980a19-64ec-4f1a-a2ea-0446ea937b16': {
    name: 'Trace Audio',
    csm: 'Kyle',
    tier: 'growth',
  },
  // US Offsite (primary tenant)
  'c35bb200-ce7f-4280-9108-f61227127a98': {
    name: 'US Offsite',
    tier: 'enterprise',
  },
  // US Offsite (secondary tenant)
  'fbc86cb5-afdd-4abf-a225-49cd2a42eb20': {
    name: 'US Offsite',
    tier: 'enterprise',
  },
  // Shoptool Co
  '73951365-1cbe-46ac-9b80-6ac44982983b': {
    name: 'Shoptool Co',
  },
  // SmartCon Solutions
  'e24408eb-69b3-477d-9090-97e314113996': {
    name: 'SmartCon Solutions',
  },
  // NexGen MFG
  '724ffc0f-ff6b-4e63-9e33-f6de613cc885': {
    name: 'NexGen MFG',
  },
  // Wilson Manifolds
  '77b6d789-a446-4c10-8fd0-9ba32595a8bc': {
    name: 'Wilson Manifolds',
  },
  // C4 MFG
  '6844ee44-149c-41fe-a9fa-b1b9d2411d62': {
    name: 'C4 MFG',
  },
  // Studio RRD
  'bdf57d6c-aad3-40dc-a553-9eb09dbf108e': {
    name: 'Studio RRD',
  },
  // Titan AP
  '9bd4adb9-e173-4a5b-8b5a-678c4502e673': {
    name: 'Titan AP',
  },
  // Zook Built
  '837f8410-b9f3-4250-9e7e-b090c54826f9': {
    name: 'Zook Built',
  },
  // Forager Cycles
  'dc517d59-0ba1-421f-9e0d-5aa5641862d0': {
    name: 'Forager Cycles',
  },
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
