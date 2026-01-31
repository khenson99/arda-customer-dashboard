import { describe, it, expect } from 'vitest';
import { resolveTenantName, getTenantInfo, TENANT_NAMES } from '../tenant-names';

describe('resolveTenantName', () => {
  it('returns mapped name for known tenant IDs', () => {
    // Elliott Equipment Company
    expect(resolveTenantName('279ae256-3aef-413c-b735-73bacf172b7d')).toBe('Elliott Equipment Company');
    
    // Trace Audio
    expect(resolveTenantName('75980a19-64ec-4f1a-a2ea-0446ea937b16')).toBe('Trace Audio');
  });

  it('returns email username for email-like tenant IDs', () => {
    expect(resolveTenantName('john@example.com')).toBe('john');
    expect(resolveTenantName('jane.doe@company.org')).toBe('jane.doe');
  });

  it('returns abbreviated org ID for unknown UUIDs', () => {
    const unknownId = 'abcd1234-5678-90ab-cdef-1234567890ab';
    expect(resolveTenantName(unknownId)).toBe('Org abcd1234');
  });

  it('handles empty strings gracefully', () => {
    expect(resolveTenantName('')).toBe('Org ');
  });
});

describe('getTenantInfo', () => {
  it('returns full info for known tenants', () => {
    const info = getTenantInfo('75980a19-64ec-4f1a-a2ea-0446ea937b16');
    expect(info).not.toBeNull();
    expect(info?.name).toBe('Trace Audio');
    expect(info?.csm).toBe('Kyle');
    expect(info?.tier).toBe('growth');
  });

  it('returns null for unknown tenants', () => {
    expect(getTenantInfo('unknown-tenant-id')).toBeNull();
  });
});

describe('TENANT_NAMES constant', () => {
  it('has valid structure for all entries', () => {
    Object.entries(TENANT_NAMES).forEach(([id, info]) => {
      expect(typeof id).toBe('string');
      expect(id.length).toBeGreaterThan(0);
      expect(typeof info.name).toBe('string');
      expect(info.name.length).toBeGreaterThan(0);
      
      if (info.tier) {
        expect(['enterprise', 'growth', 'starter', 'trial']).toContain(info.tier);
      }
    });
  });
});
