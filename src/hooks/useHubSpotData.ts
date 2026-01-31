/**
 * HubSpot Data Hook
 * 
 * Fetches CRM data from HubSpot via the CS API.
 * Returns company, contacts, deals, and owner information.
 */

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { defaultQueryOptions } from '../lib/api/cs-api';

// API base URL
const API_BASE = '/api/cs';

// Get API key from environment or localStorage
const getApiKey = (): string => {
  return import.meta.env.VITE_ARDA_API_KEY || localStorage.getItem('arda_api_key') || '';
};

const getAuthor = (): string => {
  return import.meta.env.VITE_ARDA_AUTHOR || localStorage.getItem('arda_author') || 'dashboard@arda.cards';
};

// Common headers for API requests
const createHeaders = (): HeadersInit => ({
  'Content-Type': 'application/json',
  'X-Arda-API-Key': getApiKey(),
  'X-Arda-Author': getAuthor(),
});

// ============================================================================
// HubSpot Data Types
// ============================================================================

export interface HubSpotCompany {
  id: string;
  name: string;
  domain?: string;
  industry?: string;
  companySize?: string;
  annualRevenue?: number;
  location?: {
    city?: string;
    state?: string;
    country?: string;
  };
  website?: string;
  description?: string;
  hubspotUrl: string;
  createdAt: string;
  updatedAt: string;
}

export interface HubSpotContact {
  id: string;
  firstName?: string;
  lastName?: string;
  email: string;
  phone?: string;
  jobTitle?: string;
  lifecycleStage?: string;
  leadStatus?: string;
  lastActivityDate?: string;
  hubspotUrl: string;
  createdAt: string;
  updatedAt: string;
}

export interface HubSpotDeal {
  id: string;
  name: string;
  stage: string;
  pipeline?: string;
  amount?: number;
  currency?: string;
  closeDate?: string;
  probability?: number;
  dealType?: 'new_business' | 'expansion' | 'renewal' | 'other';
  hubspotUrl: string;
  createdAt: string;
  updatedAt: string;
}

export interface HubSpotOwner {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  fullName: string;
  avatarUrl?: string;
  teamId?: string;
  userId?: string;
}

export interface HubSpotData {
  company: HubSpotCompany | null;
  contacts: HubSpotContact[];
  deals: HubSpotDeal[];
  owner: HubSpotOwner | null;
  
  // Metadata
  source: 'hubspot' | 'mock';
  fetchedAt: string;
  lastSyncedAt?: string;
}

// ============================================================================
// API Functions
// ============================================================================

/**
 * Fetch HubSpot data from the CS API.
 */
async function fetchHubSpotData(domain: string): Promise<HubSpotData> {
  const response = await fetch(`${API_BASE}/hubspot/${encodeURIComponent(domain)}`, {
    method: 'GET',
    headers: createHeaders(),
  });
  
  if (!response.ok) {
    throw new Error(`HubSpot API Error: ${response.status}`);
  }
  
  return response.json();
}

/**
 * Trigger a sync from HubSpot for the given domain.
 */
async function syncHubSpotData(domain: string): Promise<HubSpotData> {
  const response = await fetch(`${API_BASE}/hubspot/${encodeURIComponent(domain)}/sync`, {
    method: 'POST',
    headers: createHeaders(),
  });
  
  if (!response.ok) {
    throw new Error(`HubSpot Sync Error: ${response.status}`);
  }
  
  return response.json();
}

/**
 * Generate mock HubSpot data for development/fallback.
 */
function generateMockHubSpotData(domain: string): HubSpotData {
  const now = new Date().toISOString();
  const companyName = domain.split('.')[0].charAt(0).toUpperCase() + domain.split('.')[0].slice(1);
  
  return {
    company: {
      id: `mock_company_${domain}`,
      name: `${companyName} Inc.`,
      domain,
      industry: 'Technology',
      companySize: '51-200',
      annualRevenue: 5000000,
      location: {
        city: 'San Francisco',
        state: 'CA',
        country: 'United States',
      },
      website: `https://${domain}`,
      description: `${companyName} is a technology company.`,
      hubspotUrl: `https://app.hubspot.com/contacts/mock/company/mock_company_${domain}`,
      createdAt: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString(),
      updatedAt: now,
    },
    contacts: [
      {
        id: 'mock_contact_1',
        firstName: 'John',
        lastName: 'Doe',
        email: `john.doe@${domain}`,
        phone: '+1 (555) 123-4567',
        jobTitle: 'CEO',
        lifecycleStage: 'customer',
        lastActivityDate: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
        hubspotUrl: 'https://app.hubspot.com/contacts/mock/contact/mock_contact_1',
        createdAt: new Date(Date.now() - 300 * 24 * 60 * 60 * 1000).toISOString(),
        updatedAt: now,
      },
      {
        id: 'mock_contact_2',
        firstName: 'Jane',
        lastName: 'Smith',
        email: `jane.smith@${domain}`,
        phone: '+1 (555) 987-6543',
        jobTitle: 'VP of Operations',
        lifecycleStage: 'customer',
        lastActivityDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
        hubspotUrl: 'https://app.hubspot.com/contacts/mock/contact/mock_contact_2',
        createdAt: new Date(Date.now() - 200 * 24 * 60 * 60 * 1000).toISOString(),
        updatedAt: now,
      },
      {
        id: 'mock_contact_3',
        firstName: 'Bob',
        lastName: 'Johnson',
        email: `bob.johnson@${domain}`,
        jobTitle: 'IT Manager',
        lifecycleStage: 'customer',
        lastActivityDate: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString(),
        hubspotUrl: 'https://app.hubspot.com/contacts/mock/contact/mock_contact_3',
        createdAt: new Date(Date.now() - 150 * 24 * 60 * 60 * 1000).toISOString(),
        updatedAt: now,
      },
    ],
    deals: [
      {
        id: 'mock_deal_1',
        name: `${companyName} Expansion Q1`,
        stage: 'Qualified',
        pipeline: 'Sales Pipeline',
        amount: 15000,
        currency: 'USD',
        closeDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        probability: 60,
        dealType: 'expansion',
        hubspotUrl: 'https://app.hubspot.com/contacts/mock/deal/mock_deal_1',
        createdAt: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString(),
        updatedAt: now,
      },
      {
        id: 'mock_deal_2',
        name: `${companyName} Annual Renewal`,
        stage: 'Negotiation',
        pipeline: 'Sales Pipeline',
        amount: 24000,
        currency: 'USD',
        closeDate: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString(),
        probability: 80,
        dealType: 'renewal',
        hubspotUrl: 'https://app.hubspot.com/contacts/mock/deal/mock_deal_2',
        createdAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
        updatedAt: now,
      },
    ],
    owner: {
      id: 'mock_owner_1',
      email: 'sarah.jones@arda.cards',
      firstName: 'Sarah',
      lastName: 'Jones',
      fullName: 'Sarah Jones',
      avatarUrl: undefined,
    },
    source: 'mock',
    fetchedAt: now,
    lastSyncedAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
  };
}

// ============================================================================
// React Query Hook
// ============================================================================

/**
 * Query key for HubSpot data.
 */
export const hubspotQueryKey = (domain: string) => ['cs', 'hubspot', domain] as const;

/**
 * Hook to fetch HubSpot CRM data for an account.
 * 
 * @param domain - The primary email domain for the account
 * @returns HubSpot company, contacts, deals, and owner data
 */
export function useHubSpotData(domain: string | undefined) {
  const queryClient = useQueryClient();
  
  const query = useQuery({
    queryKey: hubspotQueryKey(domain || ''),
    queryFn: async (): Promise<HubSpotData> => {
      if (!domain) {
        throw new Error('No domain provided');
      }
      
      try {
        const data = await fetchHubSpotData(domain);
        return {
          ...data,
          source: 'hubspot',
          fetchedAt: new Date().toISOString(),
        };
      } catch (error) {
        console.warn('HubSpot API failed, using mock data:', error);
        return generateMockHubSpotData(domain);
      }
    },
    ...defaultQueryOptions,
    enabled: !!domain,
    staleTime: 5 * 60 * 1000, // 5 minutes for CRM data
  });
  
  // Sync function to manually refresh data from HubSpot
  const syncFromHubSpot = async () => {
    if (!domain) return;
    
    try {
      const data = await syncHubSpotData(domain);
      queryClient.setQueryData(hubspotQueryKey(domain), {
        ...data,
        source: 'hubspot',
        fetchedAt: new Date().toISOString(),
        lastSyncedAt: new Date().toISOString(),
      });
    } catch (error) {
      console.error('Failed to sync from HubSpot:', error);
      // Refetch from cache or API
      queryClient.invalidateQueries({ queryKey: hubspotQueryKey(domain) });
    }
  };
  
  return {
    company: query.data?.company ?? null,
    contacts: query.data?.contacts ?? [],
    deals: query.data?.deals ?? [],
    owner: query.data?.owner ?? null,
    isLoading: query.isLoading,
    error: query.error,
    source: query.data?.source,
    fetchedAt: query.data?.fetchedAt,
    lastSyncedAt: query.data?.lastSyncedAt,
    syncFromHubSpot,
    refetch: query.refetch,
  };
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Format company size for display.
 */
export function formatCompanySize(size?: string): string {
  if (!size) return 'Unknown';
  
  const sizeMap: Record<string, string> = {
    '1-10': '1-10 employees',
    '11-50': '11-50 employees',
    '51-200': '51-200 employees',
    '201-500': '201-500 employees',
    '501-1000': '501-1000 employees',
    '1001-5000': '1K-5K employees',
    '5001-10000': '5K-10K employees',
    '10001+': '10K+ employees',
  };
  
  return sizeMap[size] || size;
}

/**
 * Format lifecycle stage for display.
 */
export function formatLifecycleStage(stage?: string): string {
  if (!stage) return 'Unknown';
  
  const stageMap: Record<string, string> = {
    subscriber: 'Subscriber',
    lead: 'Lead',
    marketingqualifiedlead: 'MQL',
    salesqualifiedlead: 'SQL',
    opportunity: 'Opportunity',
    customer: 'Customer',
    evangelist: 'Evangelist',
    other: 'Other',
  };
  
  return stageMap[stage.toLowerCase()] || stage;
}

/**
 * Get deal stage color for styling.
 */
export function getDealStageColor(stage: string): 'success' | 'warning' | 'info' | 'muted' {
  const stageLower = stage.toLowerCase();
  
  if (stageLower.includes('closed') && stageLower.includes('won')) {
    return 'success';
  }
  if (stageLower.includes('closed') && stageLower.includes('lost')) {
    return 'muted';
  }
  if (stageLower.includes('negotiation') || stageLower.includes('contract')) {
    return 'warning';
  }
  
  return 'info';
}

/**
 * Get HubSpot contact full name.
 */
export function getContactFullName(contact: HubSpotContact): string {
  const parts = [contact.firstName, contact.lastName].filter(Boolean);
  return parts.length > 0 ? parts.join(' ') : contact.email;
}
