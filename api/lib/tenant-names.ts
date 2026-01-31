/**
 * Tenant name mapping for org tenants.
 * Maps tenant IDs to human-friendly names for Customer Success workflows.
 * 
 * This is the server-side equivalent of src/lib/tenant-names.ts
 */

export interface TenantInfo {
  name: string;
  csm?: string;
  tier?: 'enterprise' | 'growth' | 'starter' | 'trial';
  segment?: 'enterprise' | 'mid_market' | 'smb';
  notes?: string;
}

/**
 * Known tenant ID to name mappings.
 * Add new entries as tenants are identified.
 */
export const TENANT_NAMES: Record<string, TenantInfo> = {
  // Elliott Equipment Company
  '279ae256-3aef-413c-b735-73bacf172b7d': {
    name: 'Elliott Equipment Company',
    csm: 'Customer Success',
    tier: 'growth',
    segment: 'mid_market',
  },
  // Trace Audio (ben@traceaudio.com tenant)
  '75980a19-64ec-4f1a-a2ea-0446ea937b16': {
    name: 'Trace Audio',
    csm: 'Kyle',
    tier: 'growth',
    segment: 'smb',
  },
  // US Offsite
  'c35bb200-ce7f-4280-9108-f61227127a98': {
    name: 'US Offsite',
    tier: 'enterprise',
    segment: 'enterprise',
  },
  // Add more tenant mappings as discovered...
};

/**
 * Common public email domains that shouldn't be used for company name derivation.
 */
export const PUBLIC_EMAIL_DOMAINS = [
  'gmail.com',
  'icloud.com',
  'outlook.com',
  'me.com',
  'yahoo.com',
  'hotmail.com',
  'live.com',
  'aol.com',
  'protonmail.com',
  'mail.com',
];

/**
 * Extract email info from tenant name pattern "Personal tenant for email@domain.com"
 */
export function extractEmailFromTenantName(tenantName: string): { email: string; domain: string } | null {
  const match = tenantName.match(/Personal tenant for (.+)/);
  if (!match) return null;
  
  const email = match[1].toLowerCase().trim();
  const atIndex = email.indexOf('@');
  if (atIndex === -1) return null;
  
  const domain = email.slice(atIndex + 1);
  return { email, domain };
}

/**
 * Convert a domain to a company name.
 * e.g., "acme-corp.com" -> "Acme Corp"
 */
export function domainToCompanyName(domain: string): string {
  return domain
    .replace(/\.(com|net|org|io|co|cards|ai|app|dev|tech|cloud)$/i, '')
    .replace(/[.-]/g, ' ')
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

/**
 * Resolve a tenant to a human-friendly name.
 * Uses multiple strategies in order of preference:
 * 1. Explicit mapping in TENANT_NAMES
 * 2. Company name from tenant payload
 * 3. Derived from email domain (if not public domain)
 * 4. Email address (if public domain)
 * 5. Fallback to "Org [short-id]"
 */
export function resolveTenantName(
  tenantId: string,
  tenantName?: string,
  companyName?: string
): string {
  // 1. Check explicit mapping
  const mapping = TENANT_NAMES[tenantId];
  if (mapping) {
    return mapping.name;
  }
  
  // 2. Use company name if available and not empty
  if (companyName && companyName.trim() && companyName !== 'Unknown') {
    return companyName.trim();
  }
  
  // 3. Try to extract from tenant name pattern
  if (tenantName) {
    const emailInfo = extractEmailFromTenantName(tenantName);
    if (emailInfo) {
      // If public domain, use the email username as display
      if (PUBLIC_EMAIL_DOMAINS.includes(emailInfo.domain.toLowerCase())) {
        // Just use the part before @ but capitalize it nicely
        const username = emailInfo.email.split('@')[0];
        return username
          .replace(/[._-]/g, ' ')
          .split(' ')
          .map(word => word.charAt(0).toUpperCase() + word.slice(1))
          .join(' ');
      }
      // Otherwise derive company name from domain
      return domainToCompanyName(emailInfo.domain);
    }
    
    // If tenant name doesn't match pattern, use it directly if it looks like a name
    if (!tenantName.startsWith('Personal tenant') && tenantName.length < 100) {
      return tenantName;
    }
  }
  
  // 4. Fallback to abbreviated ID
  return `Org ${tenantId.slice(0, 8)}`;
}

/**
 * Get full tenant info including CSM and tier.
 */
export function getTenantInfo(tenantId: string): TenantInfo | null {
  return TENANT_NAMES[tenantId] || null;
}
