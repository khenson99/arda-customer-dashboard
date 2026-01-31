/**
 * HubSpot Data API Endpoint
 * 
 * GET /api/cs/hubspot/:domain
 * 
 * Returns HubSpot company, contacts, and deals data for a given domain.
 * Provides CRM enrichment for customer success dashboards.
 * 
 * Query Parameters:
 *   - companyName: Optional fallback company name if domain search fails
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import {
  enrichAccountFromHubSpot,
  mapContactsToStakeholders,
  mapDealsToOpportunities,
  isHubSpotConfigured,
} from '../../lib/hubspot-client';

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
  
  // Cache for 5 minutes to reduce HubSpot API calls
  res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600');
  res.setHeader('CDN-Cache-Control', 'max-age=300');
  res.setHeader('Vercel-CDN-Cache-Control', 'max-age=300');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  
  // Get domain from path parameter
  const { domain, companyName } = req.query;
  const domainParam = Array.isArray(domain) ? domain[0] : domain;
  const companyNameParam = Array.isArray(companyName) ? companyName[0] : companyName;
  
  if (!domainParam) {
    return res.status(400).json({ error: 'Domain parameter is required' });
  }
  
  // Basic domain validation (allow subdomains)
  const domainRegex = /^[a-zA-Z0-9][a-zA-Z0-9-]*[a-zA-Z0-9]?\.[a-zA-Z]{2,}(\.[a-zA-Z]{2,})?$/;
  if (!domainRegex.test(domainParam)) {
    return res.status(400).json({ error: 'Invalid domain format' });
  }
  
  // Check if HubSpot is configured
  if (!isHubSpotConfigured()) {
    return res.status(503).json({ 
      error: 'HubSpot not configured',
      message: 'HUBSPOT_ACCESS_TOKEN environment variable is not set',
    });
  }
  
  try {
    // Fetch HubSpot data
    const hubspotData = await enrichAccountFromHubSpot(domainParam, companyNameParam);
    
    if (!hubspotData.found) {
      return res.status(404).json({ 
        error: 'Company not found',
        message: `No HubSpot company found for domain: ${domainParam}`,
        searchedDomain: domainParam,
        searchedCompanyName: companyNameParam,
      });
    }
    
    // Transform contacts to stakeholders (using a placeholder account ID)
    const stakeholders = mapContactsToStakeholders(hubspotData.contacts, 'hubspot-lookup');
    
    // Transform deals to opportunities
    const opportunities = mapDealsToOpportunities(hubspotData.deals);
    const openOpportunities = mapDealsToOpportunities(hubspotData.openDeals);
    
    return res.status(200).json({
      domain: domainParam,
      found: true,
      company: hubspotData.company,
      contacts: hubspotData.contacts,
      deals: hubspotData.deals,
      openDeals: hubspotData.openDeals,
      
      // Transformed data ready for account integration
      stakeholders,
      opportunities,
      openOpportunities,
      
      // Summary stats
      stats: {
        contactCount: hubspotData.contacts.length,
        dealCount: hubspotData.deals.length,
        openDealCount: hubspotData.openDeals.length,
        totalDealValue: hubspotData.deals.reduce(
          (sum, deal) => sum + (deal.amount || 0),
          0
        ),
        openDealValue: hubspotData.openDeals.reduce(
          (sum, deal) => sum + (deal.amount || 0),
          0
        ),
      },
      
      fetchedAt: new Date().toISOString(),
    });
    
  } catch (error) {
    console.error('HubSpot API error:', error);
    
    // Handle rate limiting specifically
    if (error instanceof Error && error.message.includes('429')) {
      return res.status(429).json({
        error: 'Rate limited',
        message: 'Too many requests to HubSpot API. Please try again later.',
        retryAfter: 60,
      });
    }
    
    return res.status(500).json({ 
      error: 'Failed to fetch HubSpot data',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
