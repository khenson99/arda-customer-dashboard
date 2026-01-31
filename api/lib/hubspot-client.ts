/**
 * HubSpot API Client for CRM Data Enrichment
 * 
 * Uses HubSpot REST API to fetch company, contacts, and deals data.
 * Provides enrichment functions for customer success dashboards.
 * 
 * Uses HUBSPOT_ACCESS_TOKEN environment variable for authentication.
 */

import type { Stakeholder, StakeholderRole, Opportunity } from '../../src/lib/types/account';

const HUBSPOT_BASE_URL = 'https://api.hubapi.com';

// ============================================================================
// Types - HubSpot API Responses
// ============================================================================

export interface HubSpotCompany {
  id: string;
  properties: {
    name?: string;
    domain?: string;
    industry?: string;
    phone?: string;
    city?: string;
    state?: string;
    country?: string;
    numberofemployees?: string;
    annualrevenue?: string;
    lifecyclestage?: string;
    hubspot_owner_id?: string;
    createdate?: string;
    hs_lastmodifieddate?: string;
  };
  createdAt: string;
  updatedAt: string;
}

export interface HubSpotContact {
  id: string;
  properties: {
    email?: string;
    firstname?: string;
    lastname?: string;
    phone?: string;
    jobtitle?: string;
    company?: string;
    lifecyclestage?: string;
    hubspot_owner_id?: string;
    hs_lead_status?: string;
    lastmodifieddate?: string;
    createdate?: string;
  };
  createdAt: string;
  updatedAt: string;
}

export interface HubSpotDeal {
  id: string;
  properties: {
    dealname?: string;
    amount?: string;
    dealstage?: string;
    pipeline?: string;
    closedate?: string;
    createdate?: string;
    hubspot_owner_id?: string;
    hs_lastmodifieddate?: string;
    dealtype?: string;
  };
  createdAt: string;
  updatedAt: string;
}

export interface HubSpotOwner {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
}

export interface HubSpotSearchResponse<T> {
  total: number;
  results: T[];
  paging?: {
    next?: {
      after: string;
    };
  };
}

export interface HubSpotAssociationsResponse {
  results: Array<{
    id: string;
    type: string;
  }>;
}

// ============================================================================
// Enriched Types for Account Integration
// ============================================================================

export interface HubSpotEnrichedData {
  found: boolean;
  company?: {
    id: string;
    name?: string;
    domain?: string;
    industry?: string;
    phone?: string;
    location?: string;
    employeeCount?: number;
    annualRevenue?: number;
    lifecycleStage?: string;
    ownerId?: string;
    ownerName?: string;
    ownerEmail?: string;
  };
  contacts: HubSpotContactEnriched[];
  deals: HubSpotDealEnriched[];
  openDeals: HubSpotDealEnriched[];
}

export interface HubSpotContactEnriched {
  id: string;
  email?: string;
  firstName?: string;
  lastName?: string;
  fullName: string;
  phone?: string;
  jobTitle?: string;
  company?: string;
  lifecycleStage?: string;
  ownerId?: string;
  ownerName?: string;
  ownerEmail?: string;
}

export interface HubSpotDealEnriched {
  id: string;
  name?: string;
  amount?: number;
  stage?: string;
  pipeline?: string;
  closeDate?: string;
  type?: string;
  ownerId?: string;
  ownerName?: string;
  isOpen: boolean;
}

// ============================================================================
// API Helpers
// ============================================================================

/**
 * Get HubSpot access token from environment
 */
export function getHubSpotAccessToken(): string {
  return process.env.HUBSPOT_ACCESS_TOKEN || '';
}

/**
 * Check if HubSpot API is configured
 */
export function isHubSpotConfigured(): boolean {
  return getHubSpotAccessToken().length > 0;
}

/**
 * Create headers for HubSpot API requests
 */
function createHeaders(accessToken: string): HeadersInit {
  return {
    'Authorization': `Bearer ${accessToken}`,
    'Content-Type': 'application/json',
  };
}

/**
 * Make a GET request to HubSpot API
 */
async function hubspotGet<T>(
  endpoint: string,
  accessToken: string,
  params?: Record<string, string>
): Promise<T> {
  const url = new URL(`${HUBSPOT_BASE_URL}${endpoint}`);
  
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      url.searchParams.append(key, value);
    });
  }

  const response = await fetch(url.toString(), {
    method: 'GET',
    headers: createHeaders(accessToken),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`HubSpot API Error: ${response.status} ${response.statusText} - ${errorBody}`);
  }

  return response.json();
}

/**
 * Make a POST request to HubSpot API (for search endpoints)
 */
async function hubspotPost<T>(
  endpoint: string,
  accessToken: string,
  body: unknown
): Promise<T> {
  const url = `${HUBSPOT_BASE_URL}${endpoint}`;

  const response = await fetch(url, {
    method: 'POST',
    headers: createHeaders(accessToken),
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`HubSpot API Error: ${response.status} ${response.statusText} - ${errorBody}`);
  }

  return response.json();
}

// ============================================================================
// Company Functions
// ============================================================================

/**
 * Search for a company by domain
 */
export async function searchCompanyByDomain(
  domain: string,
  accessToken?: string
): Promise<HubSpotCompany | null> {
  const token = accessToken || getHubSpotAccessToken();
  
  if (!token) {
    console.warn('HubSpot access token not configured');
    return null;
  }

  try {
    const result = await hubspotPost<HubSpotSearchResponse<HubSpotCompany>>(
      '/crm/v3/objects/companies/search',
      token,
      {
        filterGroups: [
          {
            filters: [
              {
                propertyName: 'domain',
                operator: 'EQ',
                value: domain.toLowerCase(),
              },
            ],
          },
        ],
        properties: [
          'name',
          'domain',
          'industry',
          'phone',
          'city',
          'state',
          'country',
          'numberofemployees',
          'annualrevenue',
          'lifecyclestage',
          'hubspot_owner_id',
          'createdate',
          'hs_lastmodifieddate',
        ],
        limit: 1,
      }
    );

    return result.results.length > 0 ? result.results[0] : null;
  } catch (error) {
    console.error('Failed to search HubSpot company by domain:', error);
    return null;
  }
}

/**
 * Search for a company by name (fallback when domain search fails)
 */
export async function searchCompanyByName(
  companyName: string,
  accessToken?: string
): Promise<HubSpotCompany | null> {
  const token = accessToken || getHubSpotAccessToken();
  
  if (!token) {
    console.warn('HubSpot access token not configured');
    return null;
  }

  try {
    const result = await hubspotPost<HubSpotSearchResponse<HubSpotCompany>>(
      '/crm/v3/objects/companies/search',
      token,
      {
        filterGroups: [
          {
            filters: [
              {
                propertyName: 'name',
                operator: 'CONTAINS_TOKEN',
                value: companyName,
              },
            ],
          },
        ],
        properties: [
          'name',
          'domain',
          'industry',
          'phone',
          'city',
          'state',
          'country',
          'numberofemployees',
          'annualrevenue',
          'lifecyclestage',
          'hubspot_owner_id',
          'createdate',
          'hs_lastmodifieddate',
        ],
        limit: 5,
      }
    );

    // Return the best match (first result)
    return result.results.length > 0 ? result.results[0] : null;
  } catch (error) {
    console.error('Failed to search HubSpot company by name:', error);
    return null;
  }
}

// ============================================================================
// Contact Functions
// ============================================================================

/**
 * Get contacts associated with a company
 */
export async function getContactsForCompany(
  companyId: string,
  accessToken?: string
): Promise<HubSpotContact[]> {
  const token = accessToken || getHubSpotAccessToken();
  
  if (!token) {
    console.warn('HubSpot access token not configured');
    return [];
  }

  try {
    // First get associated contact IDs
    const associations = await hubspotGet<HubSpotAssociationsResponse>(
      `/crm/v3/objects/companies/${companyId}/associations/contacts`,
      token
    );

    if (associations.results.length === 0) {
      return [];
    }

    // Batch fetch contact details
    const contactIds = associations.results.map(r => r.id);
    const contacts: HubSpotContact[] = [];

    // Fetch contacts in batches of 10
    for (let i = 0; i < contactIds.length; i += 10) {
      const batchIds = contactIds.slice(i, i + 10);
      
      const batchResult = await hubspotPost<{ results: HubSpotContact[] }>(
        '/crm/v3/objects/contacts/batch/read',
        token,
        {
          properties: [
            'email',
            'firstname',
            'lastname',
            'phone',
            'jobtitle',
            'company',
            'lifecyclestage',
            'hubspot_owner_id',
            'hs_lead_status',
            'lastmodifieddate',
            'createdate',
          ],
          inputs: batchIds.map(id => ({ id })),
        }
      );

      contacts.push(...batchResult.results);
    }

    return contacts;
  } catch (error) {
    console.error('Failed to fetch HubSpot contacts for company:', error);
    return [];
  }
}

/**
 * Search for contacts by email domain
 */
export async function searchContactsByDomain(
  domain: string,
  accessToken?: string,
  limit: number = 100
): Promise<HubSpotContact[]> {
  const token = accessToken || getHubSpotAccessToken();
  
  if (!token) {
    console.warn('HubSpot access token not configured');
    return [];
  }

  try {
    const result = await hubspotPost<HubSpotSearchResponse<HubSpotContact>>(
      '/crm/v3/objects/contacts/search',
      token,
      {
        filterGroups: [
          {
            filters: [
              {
                propertyName: 'email',
                operator: 'CONTAINS_TOKEN',
                value: `@${domain.toLowerCase()}`,
              },
            ],
          },
        ],
        properties: [
          'email',
          'firstname',
          'lastname',
          'phone',
          'jobtitle',
          'company',
          'lifecyclestage',
          'hubspot_owner_id',
          'hs_lead_status',
          'lastmodifieddate',
          'createdate',
        ],
        limit,
      }
    );

    return result.results;
  } catch (error) {
    console.error('Failed to search HubSpot contacts by domain:', error);
    return [];
  }
}

// ============================================================================
// Deal Functions
// ============================================================================

/**
 * Get deals associated with a company
 */
export async function getDealsForCompany(
  companyId: string,
  accessToken?: string
): Promise<HubSpotDeal[]> {
  const token = accessToken || getHubSpotAccessToken();
  
  if (!token) {
    console.warn('HubSpot access token not configured');
    return [];
  }

  try {
    // First get associated deal IDs
    const associations = await hubspotGet<HubSpotAssociationsResponse>(
      `/crm/v3/objects/companies/${companyId}/associations/deals`,
      token
    );

    if (associations.results.length === 0) {
      return [];
    }

    // Batch fetch deal details
    const dealIds = associations.results.map(r => r.id);
    const deals: HubSpotDeal[] = [];

    // Fetch deals in batches of 10
    for (let i = 0; i < dealIds.length; i += 10) {
      const batchIds = dealIds.slice(i, i + 10);
      
      const batchResult = await hubspotPost<{ results: HubSpotDeal[] }>(
        '/crm/v3/objects/deals/batch/read',
        token,
        {
          properties: [
            'dealname',
            'amount',
            'dealstage',
            'pipeline',
            'closedate',
            'createdate',
            'hubspot_owner_id',
            'hs_lastmodifieddate',
            'dealtype',
          ],
          inputs: batchIds.map(id => ({ id })),
        }
      );

      deals.push(...batchResult.results);
    }

    return deals;
  } catch (error) {
    console.error('Failed to fetch HubSpot deals for company:', error);
    return [];
  }
}

// ============================================================================
// Owner Functions
// ============================================================================

/**
 * Get owner details by ID
 */
export async function getOwner(
  ownerId: string,
  accessToken?: string
): Promise<HubSpotOwner | null> {
  const token = accessToken || getHubSpotAccessToken();
  
  if (!token || !ownerId) {
    return null;
  }

  try {
    const owner = await hubspotGet<HubSpotOwner>(
      `/crm/v3/owners/${ownerId}`,
      token
    );
    return owner;
  } catch (error) {
    console.error('Failed to fetch HubSpot owner:', error);
    return null;
  }
}

// Cache for owner lookups to avoid repeated API calls
const ownerCache = new Map<string, HubSpotOwner | null>();

/**
 * Get owner details with caching
 */
async function getOwnerCached(
  ownerId: string | undefined,
  accessToken: string
): Promise<HubSpotOwner | null> {
  if (!ownerId) return null;
  
  if (ownerCache.has(ownerId)) {
    return ownerCache.get(ownerId)!;
  }
  
  const owner = await getOwner(ownerId, accessToken);
  ownerCache.set(ownerId, owner);
  return owner;
}

// ============================================================================
// Role Mapping
// ============================================================================

/**
 * Map HubSpot job title to StakeholderRole
 * Uses keyword matching to infer the role from job title
 */
export function mapJobTitleToRole(jobTitle?: string): StakeholderRole {
  if (!jobTitle) return 'end_user';
  
  const title = jobTitle.toLowerCase();
  
  // Executive/C-level patterns
  if (
    title.includes('ceo') ||
    title.includes('cfo') ||
    title.includes('cto') ||
    title.includes('coo') ||
    title.includes('chief') ||
    title.includes('president') ||
    title.includes('founder') ||
    title.includes('owner')
  ) {
    return 'executive_sponsor';
  }
  
  // Decision maker patterns (VP, Director level)
  if (
    title.includes('vp ') ||
    title.includes('vice president') ||
    title.includes('director') ||
    title.includes('head of')
  ) {
    return 'decision_maker';
  }
  
  // Champion patterns (Manager level)
  if (
    title.includes('manager') ||
    title.includes('lead') ||
    title.includes('supervisor') ||
    title.includes('team lead')
  ) {
    return 'champion';
  }
  
  // Admin patterns
  if (
    title.includes('admin') ||
    title.includes('administrator') ||
    title.includes('it ') ||
    title.includes('system') ||
    title.includes('operations')
  ) {
    return 'admin';
  }
  
  // Power user patterns (Analyst, Specialist level)
  if (
    title.includes('analyst') ||
    title.includes('specialist') ||
    title.includes('coordinator') ||
    title.includes('senior')
  ) {
    return 'power_user';
  }
  
  // Default to end_user
  return 'end_user';
}

/**
 * Infer influence level from job title
 */
export function inferInfluence(jobTitle?: string): 'high' | 'medium' | 'low' {
  const role = mapJobTitleToRole(jobTitle);
  
  switch (role) {
    case 'executive_sponsor':
    case 'decision_maker':
      return 'high';
    case 'champion':
    case 'admin':
      return 'medium';
    default:
      return 'low';
  }
}

// ============================================================================
// Transformation Functions
// ============================================================================

/**
 * Transform HubSpot contact to enriched format
 */
function transformContact(
  contact: HubSpotContact,
  owner?: HubSpotOwner | null
): HubSpotContactEnriched {
  const firstName = contact.properties.firstname || '';
  const lastName = contact.properties.lastname || '';
  const fullName = [firstName, lastName].filter(Boolean).join(' ') || 
                   contact.properties.email || 
                   `Contact ${contact.id}`;

  return {
    id: contact.id,
    email: contact.properties.email,
    firstName: contact.properties.firstname,
    lastName: contact.properties.lastname,
    fullName,
    phone: contact.properties.phone,
    jobTitle: contact.properties.jobtitle,
    company: contact.properties.company,
    lifecycleStage: contact.properties.lifecyclestage,
    ownerId: contact.properties.hubspot_owner_id,
    ownerName: owner ? `${owner.firstName} ${owner.lastName}` : undefined,
    ownerEmail: owner?.email,
  };
}

/**
 * Transform HubSpot deal to enriched format
 */
function transformDeal(
  deal: HubSpotDeal,
  owner?: HubSpotOwner | null
): HubSpotDealEnriched {
  // Determine if deal is open based on stage
  // Common closed stages: closedwon, closedlost, closed_won, closed_lost
  const stage = deal.properties.dealstage?.toLowerCase() || '';
  const isOpen = !stage.includes('closed') && 
                 !stage.includes('won') && 
                 !stage.includes('lost');

  return {
    id: deal.id,
    name: deal.properties.dealname,
    amount: deal.properties.amount ? parseFloat(deal.properties.amount) : undefined,
    stage: deal.properties.dealstage,
    pipeline: deal.properties.pipeline,
    closeDate: deal.properties.closedate,
    type: deal.properties.dealtype,
    ownerId: deal.properties.hubspot_owner_id,
    ownerName: owner ? `${owner.firstName} ${owner.lastName}` : undefined,
    isOpen,
  };
}

// ============================================================================
// Main Enrichment Function
// ============================================================================

/**
 * Enrich account data from HubSpot by domain
 * 
 * @param domain - Company domain to search for
 * @param companyName - Optional company name for fallback search
 * @returns Enriched HubSpot data including company, contacts, and deals
 */
export async function enrichAccountFromHubSpot(
  domain: string,
  companyName?: string
): Promise<HubSpotEnrichedData> {
  const token = getHubSpotAccessToken();
  
  if (!token) {
    console.warn('HubSpot access token not configured');
    return {
      found: false,
      contacts: [],
      deals: [],
      openDeals: [],
    };
  }

  if (!domain && !companyName) {
    return {
      found: false,
      contacts: [],
      deals: [],
      openDeals: [],
    };
  }

  try {
    // Search for company by domain first, then fallback to name
    let company: HubSpotCompany | null = null;
    
    if (domain) {
      company = await searchCompanyByDomain(domain, token);
    }
    
    if (!company && companyName) {
      company = await searchCompanyByName(companyName, token);
    }

    if (!company) {
      // Even without a company, try to find contacts by domain
      const contacts = domain ? await searchContactsByDomain(domain, token, 50) : [];
      
      if (contacts.length === 0) {
        return {
          found: false,
          contacts: [],
          deals: [],
          openDeals: [],
        };
      }

      // Transform contacts without company context
      const enrichedContacts = await Promise.all(
        contacts.map(async (contact) => {
          const owner = await getOwnerCached(contact.properties.hubspot_owner_id, token);
          return transformContact(contact, owner);
        })
      );

      return {
        found: true,
        contacts: enrichedContacts,
        deals: [],
        openDeals: [],
      };
    }

    // Fetch company owner, contacts, and deals in parallel
    const [companyOwner, contacts, deals] = await Promise.all([
      getOwnerCached(company.properties.hubspot_owner_id, token),
      getContactsForCompany(company.id, token),
      getDealsForCompany(company.id, token),
    ]);

    // Transform contacts with owner info
    const enrichedContacts = await Promise.all(
      contacts.map(async (contact) => {
        const owner = await getOwnerCached(contact.properties.hubspot_owner_id, token);
        return transformContact(contact, owner);
      })
    );

    // Transform deals with owner info
    const enrichedDeals = await Promise.all(
      deals.map(async (deal) => {
        const owner = await getOwnerCached(deal.properties.hubspot_owner_id, token);
        return transformDeal(deal, owner);
      })
    );

    // Filter to open deals only
    const openDeals = enrichedDeals.filter(deal => deal.isOpen);

    // Build location string
    const locationParts = [
      company.properties.city,
      company.properties.state,
      company.properties.country,
    ].filter(Boolean);
    const location = locationParts.length > 0 ? locationParts.join(', ') : undefined;

    return {
      found: true,
      company: {
        id: company.id,
        name: company.properties.name,
        domain: company.properties.domain,
        industry: company.properties.industry,
        phone: company.properties.phone,
        location,
        employeeCount: company.properties.numberofemployees 
          ? parseInt(company.properties.numberofemployees, 10) 
          : undefined,
        annualRevenue: company.properties.annualrevenue 
          ? parseFloat(company.properties.annualrevenue) 
          : undefined,
        lifecycleStage: company.properties.lifecyclestage,
        ownerId: company.properties.hubspot_owner_id,
        ownerName: companyOwner 
          ? `${companyOwner.firstName} ${companyOwner.lastName}` 
          : undefined,
        ownerEmail: companyOwner?.email,
      },
      contacts: enrichedContacts,
      deals: enrichedDeals,
      openDeals,
    };
  } catch (error) {
    console.error('Failed to enrich account from HubSpot:', error);
    return {
      found: false,
      contacts: [],
      deals: [],
      openDeals: [],
    };
  }
}

// ============================================================================
// Stakeholder Mapping
// ============================================================================

/**
 * Transform HubSpot contacts to Stakeholder type
 * Maps job titles to roles and preserves HubSpot contact IDs
 */
export function mapContactsToStakeholders(
  contacts: HubSpotContactEnriched[],
  accountId: string
): Stakeholder[] {
  // Sort contacts by influence (executive_sponsor first, etc.)
  const roleOrder: Record<StakeholderRole, number> = {
    executive_sponsor: 1,
    decision_maker: 2,
    economic_buyer: 3,
    champion: 4,
    influencer: 5,
    admin: 6,
    power_user: 7,
    end_user: 8,
    other: 9,
  };

  const mappedContacts = contacts.map(contact => ({
    contact,
    role: mapJobTitleToRole(contact.jobTitle),
  }));

  // Sort by role priority
  mappedContacts.sort((a, b) => roleOrder[a.role] - roleOrder[b.role]);

  // Build stakeholders, marking first as primary
  return mappedContacts.map((item, index) => {
    const { contact, role } = item;
    const isPrimary = index === 0;

    const stakeholder: Stakeholder = {
      id: `hs-${contact.id}`,
      accountId,
      name: contact.fullName,
      email: contact.email || '',
      title: contact.jobTitle,
      phone: contact.phone,
      role,
      isPrimary,
      influence: inferInfluence(contact.jobTitle),
      externalIds: {
        hubspot: contact.id,
      },
    };

    return stakeholder;
  });
}

/**
 * Transform HubSpot deals to Opportunity type
 */
export function mapDealsToOpportunities(
  deals: HubSpotDealEnriched[]
): Opportunity[] {
  return deals.map(deal => {
    // Infer opportunity type from deal type or stage
    let opportunityType: Opportunity['type'] = 'expansion';
    
    const dealType = deal.type?.toLowerCase() || '';
    const stage = deal.stage?.toLowerCase() || '';
    
    if (dealType.includes('renewal') || stage.includes('renewal')) {
      opportunityType = 'renewal';
    } else if (dealType.includes('upsell') || stage.includes('upsell')) {
      opportunityType = 'upsell';
    } else if (dealType.includes('cross') || stage.includes('cross')) {
      opportunityType = 'cross-sell';
    }

    return {
      id: `hs-deal-${deal.id}`,
      name: deal.name || `Deal ${deal.id}`,
      type: opportunityType,
      stage: deal.stage || 'Unknown',
      value: deal.amount || 0,
      closeDate: deal.closeDate,
    };
  });
}
