import { describe, it, expect } from 'vitest';
import { domainToCompanyName } from '../arda-client';

describe('domainToCompanyName', () => {
  it('capitalizes simple domain names', () => {
    expect(domainToCompanyName('acme.com')).toBe('Acme');
    expect(domainToCompanyName('tesla.com')).toBe('Tesla');
  });

  it('handles multi-word domains with hyphens', () => {
    expect(domainToCompanyName('red-bull.com')).toBe('Red Bull');
    expect(domainToCompanyName('user-generated.io')).toBe('User Generated');
  });

  it('handles subdomains', () => {
    expect(domainToCompanyName('mail.google.com')).toBe('Mail Google');
  });

  it('capitalizes each word', () => {
    expect(domainToCompanyName('big-company-name.com')).toBe('Big Company Name');
  });
});

