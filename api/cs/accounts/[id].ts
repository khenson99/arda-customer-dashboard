/**
 * Account Detail API Endpoint
 * 
 * GET /api/cs/accounts/:id
 * 
 * Returns full account details for the Account 360 view.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import type { 
  AccountDetail,
  UsageMetrics,
  CommercialMetrics,
  SupportMetrics,
  ActivityDataPoint,
  TimelineEvent,
  Interaction,
  Stakeholder,
  Task,
  HubSpotAccountData,
} from '../../../src/lib/types/account.js';
import { 
  aggregateByTenant, 
  fetchTenants,
  fetchItems,
  fetchKanbanCards,
  fetchOrders,
  extractEmailInfo,
  type ArdaTenant,
  type ArdaItem,
  type ArdaKanbanCard,
  type ArdaOrder,
} from '../../../server/lib/arda-api.js';
import { resolveTenantName } from '../../../server/lib/tenant-names.js';
import { calculateHealthScore, type HealthScoringInput } from '../../../server/lib/health-scoring.js';
import { buildAccountMappings, fetchCodaOverrides } from '../../../server/lib/account-mappings.js';
import { generateAlerts } from '../../../server/lib/alerts.js';
import { getStripeEnrichedMetrics, type StripeEnrichedMetrics } from '../../../server/lib/stripe-api.js';
import {
  buildHubSpotUrl,
  enrichAccountFromHubSpot,
  getHubSpotPortalId,
  mapContactsToStakeholders,
  mapDealsToOpportunities,
  isHubSpotConfigured,
  type HubSpotEnrichedData,
} from '../../lib/hubspot-client.js';
import { requireApiKey } from '../../lib/auth.js';

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  if (!requireApiKey(req, res)) return;
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type, X-Arda-API-Key, X-Arda-Author');
  
  // Edge caching headers - shorter TTL for detail views (more dynamic)
  // Cache for 1 minute at CDN, serve stale for up to 3 minutes while revalidating
  res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=180');
  res.setHeader('CDN-Cache-Control', 'max-age=60');
  res.setHeader('Vercel-CDN-Cache-Control', 'max-age=60');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  
  const { id } = req.query;
  const accountId = Array.isArray(id) ? id[0] : id;
  
  if (!accountId) {
    return res.status(400).json({ error: 'Account ID is required' });
  }
  
  try {
    // Get API credentials
    const apiKey = req.headers['x-arda-api-key'] as string || process.env.ARDA_API_KEY;
    const author = req.headers['x-arda-author'] as string || process.env.ARDA_AUTHOR || 'dashboard@arda.cards';
    const codaToken = process.env.CODA_API_TOKEN;
    const codaDocId = process.env.CODA_DOC_ID || '0cEU3RTNX6';
    
    if (!apiKey) {
      return res.status(401).json({ error: 'Missing API key' });
    }
    
    // Fetch all data
    const [tenants, items, kanbanCards, orders, codaOverrides] = await Promise.all([
      fetchTenants(apiKey, author).catch(() => []),
      fetchItems(apiKey, author).catch(() => []),
      fetchKanbanCards(apiKey, author).catch(() => []),
      fetchOrders(apiKey, author).catch(() => []),
      fetchCodaOverrides(codaToken, codaDocId),
    ]);
    
    // Find the tenant - could be by tenant ID or account ID
    let tenantId = accountId;
    let tenantInfo: ArdaTenant | undefined;
    
    // First try direct tenant ID match
    tenantInfo = tenants.find(t => t.payload.eId === accountId);
    
    if (!tenantInfo) {
      // Try to find by account mapping
      const tenantData = tenants.map(t => {
        const emailInfo = extractEmailInfo(t.payload.tenantName);
        return {
          tenantId: t.payload.eId,
          tenantName: t.payload.tenantName,
          email: emailInfo?.email,
        };
      });
      
      const mappings = buildAccountMappings(tenantData, codaOverrides);
      
      // Find mapping where accountId matches
      for (const [tid, mapping] of mappings) {
        if (mapping.accountId === accountId) {
          tenantId = tid;
          tenantInfo = tenants.find(t => t.payload.eId === tid);
          break;
        }
      }
    }
    
    if (!tenantInfo) {
      return res.status(404).json({ error: 'Account not found' });
    }
    
    // Filter entities for this tenant
    const tenantItems = items.filter(item => 
      (item.metadata as Record<string, unknown>)?.tenantId === tenantId
    );
    
    const tenantKanbanCards = kanbanCards.filter(card => 
      (card.metadata as Record<string, unknown>)?.tenantId === tenantId
    );
    
    const tenantOrders = orders.filter(order => 
      (order.metadata as Record<string, unknown>)?.tenantId === tenantId
    );
    
    // Collect unique authors
    const uniqueAuthors = new Set<string>();
    const activityTimestamps: number[] = [];
    
    for (const item of tenantItems) {
      const author = item.author || item.createdBy;
      if (author) uniqueAuthors.add(author);
      if (item.createdAt?.effective) activityTimestamps.push(item.createdAt.effective);
    }
    
    for (const card of tenantKanbanCards) {
      const author = card.author || card.createdBy;
      if (author) uniqueAuthors.add(author);
      if (card.createdAt?.effective) activityTimestamps.push(card.createdAt.effective);
    }
    
    for (const order of tenantOrders) {
      const author = order.author || order.createdBy;
      if (author) uniqueAuthors.add(author);
      if (order.createdAt?.effective) activityTimestamps.push(order.createdAt.effective);
    }
    
    // Calculate metrics
    const createdAt = tenantInfo.createdAt.effective;
    const accountAgeDays = Math.floor((Date.now() - createdAt) / (1000 * 60 * 60 * 24));
    
    const lastActivityTimestamp = activityTimestamps.length > 0 
      ? Math.max(...activityTimestamps) 
      : createdAt;
    const daysSinceLastActivity = Math.floor(
      (Date.now() - lastActivityTimestamp) / (1000 * 60 * 60 * 24)
    );
    
    // Build account mapping
    const emailInfo = extractEmailInfo(tenantInfo.payload.tenantName);
    const tenantData = [{
      tenantId,
      tenantName: tenantInfo.payload.tenantName,
      email: emailInfo?.email,
    }];
    const mappings = buildAccountMappings(tenantData, codaOverrides);
    const mapping = mappings.get(tenantId);
    
    // Build health scoring input
    const healthInput: HealthScoringInput = {
      itemCount: tenantItems.length,
      kanbanCardCount: tenantKanbanCards.length,
      orderCount: tenantOrders.length,
      totalUsers: uniqueAuthors.size,
      activeUsersLast7Days: estimateActiveUsersFromTimestamps(activityTimestamps, 7, uniqueAuthors.size),
      activeUsersLast30Days: estimateActiveUsersFromTimestamps(activityTimestamps, 30, uniqueAuthors.size),
      daysSinceLastActivity,
      accountAgeDays,
      segment: mapping?.segment,
      tier: mapping?.tier,
    };
    
    // Calculate health score
    const health = calculateHealthScore(healthInput);
    
    // Build usage metrics
    const usage = buildUsageMetrics(
      tenantItems,
      tenantKanbanCards,
      tenantOrders,
      uniqueAuthors,
      activityTimestamps,
      accountAgeDays
    );
    
    // Fetch Stripe data for commercial metrics enrichment
    // Try to match by Stripe customer ID first, then by email domain
    const emailInfo2 = extractEmailInfo(tenantInfo.payload.tenantName);
    
    // Get tenant-specific Stripe info from TENANT_NAMES
    const { TENANT_NAMES } = await import('../../../server/lib/tenant-names.js');
    const tenantNameInfo = TENANT_NAMES[tenantId];
    
    // Priority: 1) TENANT_NAMES stripeEmail, 2) extracted email from tenant name
    const stripeEmail = tenantNameInfo?.stripeEmail || emailInfo2?.email;
    const stripeCustomerId = mapping?.stripeId || tenantNameInfo?.stripeCustomerId;
    // Domain for fallback search: from TENANT_NAMES, mapping, or extracted from email
    const stripeDomain = tenantNameInfo?.domain || mapping?.domain || emailInfo2?.domain;
    
    console.log('[Stripe Debug] Tenant Stripe lookup:', {
      tenantId,
      tenantName: tenantInfo.payload.tenantName,
      stripeEmail,
      stripeCustomerId,
      stripeDomain,
      tenantNameInfo: tenantNameInfo ? { name: tenantNameInfo.name, domain: tenantNameInfo.domain } : null,
    });
    
    const stripeData = await fetchStripeDataForAccount(
      stripeEmail,
      stripeCustomerId,
      stripeDomain,
      mapping?.name || tenantInfo.payload.tenantName,
      mapping?.accountId || tenantId
    );
    
    // Fetch HubSpot data for stakeholder enrichment
    // Try to match by domain, with company name as fallback
    const hubspotData = await fetchHubSpotDataForAccount(
      mapping?.domain || emailInfo2?.domain,
      mapping?.name
    );

    const hubspotPortalId = hubspotData?.found ? await getHubSpotPortalId() : null;
    const hubspotSummary = buildHubSpotSummary(hubspotData, hubspotPortalId);
    
    // Build commercial metrics with optional Stripe enrichment
    const commercial = buildCommercialMetrics(tenantInfo, mapping, stripeData, hubspotData);
    
    // Build support metrics (placeholder - would come from Zendesk/etc)
    const support = buildSupportMetrics();
    
    // Generate alerts
    const alertInput = {
      accountId: mapping?.accountId || tenantId,
      accountName: mapping?.name || deriveAccountName(tenantId, tenantInfo),
      health,
      usage,
      commercial,
      support,
      accountAgeDays,
      tier: mapping?.tier,
      segment: mapping?.segment,
      arr: commercial.arr, // Pass ARR for arrAtRisk calculation
      ownerId: mapping?.ownerId,
      ownerName: mapping?.ownerName,
    };
    
    console.log('[Alert Generation] Account detail input:', {
      accountId: alertInput.accountId,
      accountName: alertInput.accountName,
      healthScore: health?.score,
      daysSinceLastActivity: usage?.daysSinceLastActivity,
      daysToRenewal: commercial?.daysToRenewal,
      arr: commercial?.arr,
      accountAgeDays,
    });
    
    const alerts = generateAlerts(alertInput);
    
    console.log('[Alert Generation] Generated', alerts.length, 'alerts:', 
      alerts.map(a => ({ type: a.type, severity: a.severity, title: a.title })));
    
    // Build timeline
    const timeline = buildTimeline(tenantItems, tenantKanbanCards, tenantOrders);
    
    // Build stakeholders - enrich with HubSpot contact data if available
    const stakeholders = buildStakeholders(
      uniqueAuthors,
      hubspotData,
      mapping?.accountId || tenantId
    );
    
    // Determine lifecycle stage
    const lifecycleStage = health.score >= 70 && tenantOrders.length > 0
      ? 'mature'
      : tenantOrders.length > 0
        ? 'growth'
        : tenantKanbanCards.length > 0
          ? 'adoption'
          : accountAgeDays <= 30
            ? 'onboarding'
            : 'adoption';
    
    // Determine onboarding status
    const onboardingStatus = tenantOrders.length > 0
      ? 'completed'
      : tenantItems.length >= 5
        ? 'in_progress'
        : tenantItems.length === 0 && accountAgeDays > 7
          ? 'stalled'
          : 'not_started';
    
    // Build account detail response
    const accountDetail: AccountDetail = {
      id: mapping?.accountId || tenantId,
      name: mapping?.name || deriveAccountName(tenantId, tenantInfo),
      domain: mapping?.domain || emailInfo?.domain,
      segment: mapping?.segment || 'smb',
      tier: mapping?.tier || 'starter',
      tenantIds: [tenantId],
      primaryTenantId: tenantId,
      ownerId: mapping?.ownerId,
      ownerName: mapping?.ownerName,
      ownerEmail: mapping?.ownerEmail,
      externalIds: {
        coda: mapping?.codaRowId,
        hubspot: hubspotData?.company?.id || mapping?.hubspotId,
        stripe: stripeData?.customerId || mapping?.stripeId,
      },
      createdAt: new Date(createdAt).toISOString(),
      updatedAt: new Date().toISOString(),
      firstActivityAt: activityTimestamps.length > 0
        ? new Date(Math.min(...activityTimestamps)).toISOString()
        : undefined,
      lastActivityAt: activityTimestamps.length > 0
        ? new Date(Math.max(...activityTimestamps)).toISOString()
        : undefined,
      lifecycleStage,
      onboardingStatus,
      health,
      usage,
      commercial,
      support,
      alerts,
      tags: mapping?.tags,
      notes: mapping?.notes,
      stakeholders,
      recentInteractions: [], // Would come from persistence layer
      openTasks: [], // Would come from persistence layer
      hubspot: hubspotSummary,
      timeline,
    };
    
    return res.status(200).json(accountDetail);
    
  } catch (error) {
    console.error('Account detail API error:', error);
    return res.status(500).json({ 
      error: 'Failed to fetch account details',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

function estimateActiveUsersFromTimestamps(
  timestamps: number[], 
  days: number,
  totalUsers: number
): number {
  const cutoff = Date.now() - (days * 24 * 60 * 60 * 1000);
  const recentTimestamps = timestamps.filter(t => t >= cutoff);
  
  if (recentTimestamps.length === 0) return 0;
  
  // Rough estimate based on activity volume
  const activityPerUser = recentTimestamps.length / Math.max(1, totalUsers);
  if (activityPerUser < 1) return Math.min(totalUsers, 1);
  
  return Math.min(totalUsers, Math.ceil(recentTimestamps.length / 5));
}

function buildUsageMetrics(
  items: ArdaItem[],
  kanbanCards: ArdaKanbanCard[],
  orders: ArdaOrder[],
  uniqueAuthors: Set<string>,
  timestamps: number[],
  accountAgeDays: number
): UsageMetrics {
  // Build activity timeline (last 12 weeks)
  const activityTimeline: ActivityDataPoint[] = [];
  const now = Date.now();
  const weekMs = 7 * 24 * 60 * 60 * 1000;
  
  for (let i = 11; i >= 0; i--) {
    const weekStart = now - ((i + 1) * weekMs);
    const weekEnd = now - (i * weekMs);
    const weekLabel = new Date(weekStart).toISOString().split('T')[0];
    
    const weekItems = items.filter(item => {
      const ts = item.createdAt?.effective;
      return ts && ts >= weekStart && ts < weekEnd;
    }).length;
    
    const weekCards = kanbanCards.filter(card => {
      const ts = card.createdAt?.effective;
      return ts && ts >= weekStart && ts < weekEnd;
    }).length;
    
    const weekOrders = orders.filter(order => {
      const ts = order.createdAt?.effective;
      return ts && ts >= weekStart && ts < weekEnd;
    }).length;
    
    activityTimeline.push({
      date: weekLabel,
      items: weekItems,
      kanbanCards: weekCards,
      orders: weekOrders,
      activeUsers: Math.min(uniqueAuthors.size, weekItems + weekCards + weekOrders > 0 ? 1 : 0),
    });
  }
  
  // Calculate days with activity
  const uniqueDays = new Set(
    timestamps.map(t => new Date(t).toISOString().split('T')[0])
  );
  
  // Find first item/kanban/order timestamps
  const itemTimestamps = items
    .map(i => i.createdAt?.effective)
    .filter((t): t is number => t !== undefined);
  const kanbanTimestamps = kanbanCards
    .map(c => c.createdAt?.effective)
    .filter((t): t is number => t !== undefined);
  const orderTimestamps = orders
    .map(o => o.createdAt?.effective)
    .filter((t): t is number => t !== undefined);
  
  const firstItemTime = itemTimestamps.length > 0 ? Math.min(...itemTimestamps) : undefined;
  const firstKanbanTime = kanbanTimestamps.length > 0 ? Math.min(...kanbanTimestamps) : undefined;
  const firstOrderTime = orderTimestamps.length > 0 ? Math.min(...orderTimestamps) : undefined;
  
  const daysSinceLastActivity = timestamps.length > 0
    ? Math.floor((now - Math.max(...timestamps)) / (1000 * 60 * 60 * 24))
    : accountAgeDays;
  
  return {
    itemCount: items.length,
    kanbanCardCount: kanbanCards.length,
    orderCount: orders.length,
    totalUsers: uniqueAuthors.size,
    activeUsersLast7Days: estimateActiveUsersFromTimestamps(timestamps, 7, uniqueAuthors.size),
    activeUsersLast30Days: estimateActiveUsersFromTimestamps(timestamps, 30, uniqueAuthors.size),
    daysActive: uniqueDays.size,
    daysSinceLastActivity,
    avgActionsPerDay: accountAgeDays > 0 ? (items.length + kanbanCards.length + orders.length) / accountAgeDays : 0,
    featureAdoption: {
      items: Math.min(100, Math.round((items.length / 50) * 100)),
      kanban: Math.min(100, Math.round((kanbanCards.length / 50) * 100)),
      ordering: Math.min(100, Math.round((orders.length / 10) * 100)),
      receiving: 0, // Would need receiving data
      reporting: 0, // Would need analytics usage data
    },
    outcomes: {
      ordersPlaced: orders.length,
      ordersReceived: 0, // Would need receiving data
    },
    activityTimeline,
    timeToFirstItem: firstItemTime
      ? Math.floor((firstItemTime - (now - accountAgeDays * 24 * 60 * 60 * 1000)) / (1000 * 60 * 60 * 24))
      : undefined,
    timeToFirstKanban: firstKanbanTime
      ? Math.floor((firstKanbanTime - (now - accountAgeDays * 24 * 60 * 60 * 1000)) / (1000 * 60 * 60 * 24))
      : undefined,
    timeToFirstOrder: firstOrderTime
      ? Math.floor((firstOrderTime - (now - accountAgeDays * 24 * 60 * 60 * 1000)) / (1000 * 60 * 60 * 24))
      : undefined,
  };
}

function buildCommercialMetrics(
  tenant: ArdaTenant,
  mapping?: { tier?: string },
  stripeData?: StripeEnrichedMetrics,
  hubspotData?: HubSpotEnrichedData
): CommercialMetrics {
  // Base commercial metrics from tenant data
  const baseMetrics: CommercialMetrics = {
    plan: tenant.payload.plan || 'Unknown',
    currency: 'USD',
    paymentStatus: tenant.payload.subscriptionReference?.state === 'ACTIVE' ? 'current' : 'unknown',
    expansionSignals: [],
    expansionPotential: 'none',
    source: 'account',
  };
  
  // Add open opportunities from HubSpot if available
  let openOpportunities: CommercialMetrics['openOpportunities'];
  if (hubspotData?.found && hubspotData.openDeals.length > 0) {
    openOpportunities = mapDealsToOpportunities(hubspotData.openDeals);
  }
  
  const hubspotBilling = hubspotData?.billing;
  const applyHubSpotBilling = (metrics: CommercialMetrics): CommercialMetrics => {
    if (!hubspotBilling) return metrics;

    const renewalDate = metrics.renewalDate || hubspotBilling.renewalDate;
    const daysToRenewal = metrics.daysToRenewal ?? hubspotBilling.daysToRenewal ?? (
      renewalDate ? Math.ceil((new Date(renewalDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24)) : undefined
    );

    return {
      ...metrics,
      plan: metrics.plan && metrics.plan !== 'Unknown'
        ? metrics.plan
        : (hubspotBilling.plan || metrics.plan),
      arr: metrics.arr ?? hubspotBilling.arr,
      mrr: metrics.mrr ?? hubspotBilling.mrr,
      currency: metrics.currency && metrics.currency !== 'USD'
        ? metrics.currency
        : (hubspotBilling.currency || metrics.currency || 'USD'),
      contractStartDate: metrics.contractStartDate ?? hubspotBilling.contractStartDate,
      contractEndDate: metrics.contractEndDate ?? hubspotBilling.contractEndDate,
      renewalDate,
      daysToRenewal,
      termMonths: metrics.termMonths ?? hubspotBilling.termMonths,
      autoRenew: metrics.autoRenew ?? hubspotBilling.autoRenew,
      paymentStatus: metrics.paymentStatus !== 'unknown' ? metrics.paymentStatus : (hubspotBilling.paymentStatus || metrics.paymentStatus),
      lastPaymentDate: metrics.lastPaymentDate ?? hubspotBilling.lastPaymentDate,
      overdueAmount: metrics.overdueAmount ?? hubspotBilling.overdueAmount,
      source: metrics.source === 'stripe' ? metrics.source : 'hubspot',
    };
  };

  // Enrich with Stripe data if available
  if (stripeData?.found) {
    const stripeMetrics: CommercialMetrics = {
      ...baseMetrics,
      plan: stripeData.plan || baseMetrics.plan,
      arr: stripeData.arr,
      mrr: stripeData.mrr,
      currency: stripeData.currency || baseMetrics.currency,
      contractEndDate: stripeData.contractEndDate,
      renewalDate: stripeData.renewalDate,
      daysToRenewal: stripeData.daysToRenewal,
      termMonths: stripeData.termMonths,
      autoRenew: stripeData.autoRenew,
      paymentStatus: stripeData.paymentStatus,
      lastPaymentDate: stripeData.lastPaymentDate,
      overdueAmount: stripeData.overdueAmount,
      expansionSignals: baseMetrics.expansionSignals,
      expansionPotential: calculateExpansionPotential(stripeData),
      openOpportunities,
      source: 'stripe',
    };

    return applyHubSpotBilling(stripeMetrics);
  }

  return applyHubSpotBilling({
    ...baseMetrics,
    openOpportunities,
  });
}

/**
 * Calculate expansion potential based on Stripe data
 */
function calculateExpansionPotential(
  stripeData: StripeEnrichedMetrics
): 'high' | 'medium' | 'low' | 'none' {
  if (!stripeData.found || stripeData.paymentStatus === 'churned') {
    return 'none';
  }
  
  if (stripeData.paymentStatus === 'current' && stripeData.subscriptionStatus === 'active') {
    if (stripeData.arr && stripeData.arr >= 10000) {
      return 'high';
    }
    if (stripeData.arr && stripeData.arr >= 5000) {
      return 'medium';
    }
    return 'low';
  }
  
  if (stripeData.paymentStatus === 'overdue' || stripeData.paymentStatus === 'at_risk') {
    return 'none';
  }
  
  return 'low';
}

/**
 * Attempt to fetch Stripe data for an account
 * Returns undefined if Stripe is not configured or customer not found
 * 
 * Search priority:
 * 1. Direct Stripe customer ID (if provided)
 * 2. Exact email match
 * 3. Domain-based search (find any customer with matching email domain)
 */
async function fetchStripeDataForAccount(
  email?: string,
  stripeCustomerId?: string,
  domain?: string,
  preferredName?: string,
  preferredAccountId?: string
): Promise<StripeEnrichedMetrics | undefined> {
  const stripeKey = process.env.STRIPE_SECRET_KEY || process.env.STRIPE_API_KEY;
  
  console.log('[Stripe Debug] Attempting Stripe lookup:', {
    email,
    stripeCustomerId,
    domain,
    hasStripeKey: !!stripeKey,
    keyPrefix: stripeKey ? stripeKey.slice(0, 10) + '...' : 'none',
  });
  
  if (!stripeKey) {
    console.log('[Stripe Debug] No Stripe API key configured');
    return undefined;
  }
  
  if (!email && !stripeCustomerId && !domain) {
    console.log('[Stripe Debug] No email, customer ID, or domain provided');
    return undefined;
  }
  
  try {
    // First try direct lookup by customer ID or email
    let stripeData = await getStripeEnrichedMetrics(
      { 
        email: email,
        customerId: stripeCustomerId,
      },
      stripeKey
    );
    
    console.log('[Stripe Debug] Initial Stripe lookup result:', {
      found: stripeData.found,
      customerId: stripeData.customerId,
      plan: stripeData.plan,
    });
    
    // If not found and we have a domain, try domain-based search
    if (!stripeData.found && domain) {
      console.log('[Stripe Debug] Trying domain-based search for:', domain);
      
      const { fetchCustomerByDomain } = await import('../../../server/lib/stripe-api.js');
      const domainCustomer = await fetchCustomerByDomain(domain, stripeKey, {
        preferredName,
        preferredEmail: email,
        preferredAccountId,
      });
      
      if (domainCustomer) {
        console.log('[Stripe Debug] Found customer via domain search:', {
          id: domainCustomer.id,
          email: domainCustomer.email,
          name: domainCustomer.name,
        });
        
        // Re-fetch with the found customer ID
        stripeData = await getStripeEnrichedMetrics(
          { customerId: domainCustomer.id },
          stripeKey
        );
      }
    }
    
    console.log('[Stripe Debug] Final Stripe lookup result:', {
      found: stripeData.found,
      customerId: stripeData.customerId,
      plan: stripeData.plan,
      arr: stripeData.arr,
      mrr: stripeData.mrr,
      paymentStatus: stripeData.paymentStatus,
    });
    
    return stripeData.found ? stripeData : undefined;
  } catch (error) {
    console.error('[Stripe Debug] Failed to fetch Stripe data:', error);
    return undefined;
  }
}

/**
 * Attempt to fetch HubSpot data for an account
 * Returns undefined if HubSpot is not configured or company not found
 */
async function fetchHubSpotDataForAccount(
  domain?: string,
  companyName?: string
): Promise<HubSpotEnrichedData | undefined> {
  if (!isHubSpotConfigured()) {
    // HubSpot not configured - fail gracefully
    return undefined;
  }
  
  if (!domain && !companyName) {
    return undefined;
  }
  
  try {
    const hubspotData = await enrichAccountFromHubSpot(
      domain || '',
      companyName
    );
    
    return hubspotData.found ? hubspotData : undefined;
  } catch (error) {
    // Log but don't fail the request
    console.warn('Failed to fetch HubSpot data:', error);
    return undefined;
  }
}

function buildSupportMetrics(): SupportMetrics {
  // This would be enriched with Zendesk/Intercom data in production
  return {
    openTickets: 0,
    ticketsLast30Days: 0,
    ticketsLast90Days: 0,
    criticalTickets: 0,
    highTickets: 0,
    normalTickets: 0,
    escalationCount: 0,
  };
}

function buildTimeline(
  items: ArdaItem[],
  kanbanCards: ArdaKanbanCard[],
  orders: ArdaOrder[]
): TimelineEvent[] {
  const events: TimelineEvent[] = [];
  
  // Add item events
  for (const item of items.slice(-50)) { // Last 50 items
    events.push({
      id: `item-${item.rId}`,
      type: 'product_activity',
      timestamp: new Date(item.createdAt.effective).toISOString(),
      title: 'Item created',
      description: item.payload.name || item.payload.sku || 'Unnamed item',
      actor: item.author || item.createdBy,
      metadata: { entityType: 'item', entityId: item.rId },
    });
  }
  
  // Add kanban events
  for (const card of kanbanCards.slice(-50)) {
    events.push({
      id: `card-${card.rId}`,
      type: 'product_activity',
      timestamp: new Date(card.createdAt.effective).toISOString(),
      title: 'Kanban card created',
      description: card.payload.item?.name || card.payload.title || 'Unnamed card',
      actor: card.author || card.createdBy,
      metadata: { entityType: 'kanban', entityId: card.rId, state: card.payload.state },
    });
  }
  
  // Add order events
  for (const order of orders.slice(-50)) {
    events.push({
      id: `order-${order.rId}`,
      type: 'product_activity',
      timestamp: new Date(order.createdAt.effective).toISOString(),
      title: 'Order placed',
      description: `Order #${order.rId.slice(0, 8)}`,
      actor: order.author || order.createdBy,
      metadata: { entityType: 'order', entityId: order.rId, status: order.payload.status },
    });
  }
  
  // Sort by timestamp descending
  events.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  
  return events.slice(0, 100); // Return last 100 events
}

function buildStakeholders(
  uniqueAuthors: Set<string>,
  hubspotData?: HubSpotEnrichedData,
  accountId?: string
): Stakeholder[] {
  // If HubSpot data is available, use enriched contacts as stakeholders
  if (hubspotData?.found && hubspotData.contacts.length > 0) {
    const hubspotStakeholders = mapContactsToStakeholders(
      hubspotData.contacts,
      accountId || ''
    );
    
    // Merge with Arda authors - add any authors not already in HubSpot
    const hubspotEmails = new Set(
      hubspotStakeholders.map(s => s.email?.toLowerCase()).filter(Boolean)
    );
    
    const additionalStakeholders: Stakeholder[] = [];
    for (const author of uniqueAuthors) {
      const authorEmail = author.includes('@') ? author.toLowerCase() : null;
      if (authorEmail && !hubspotEmails.has(authorEmail)) {
        additionalStakeholders.push({
          id: `arda-${author.slice(0, 8)}`,
          accountId: accountId || '',
          name: author.split('@')[0] || author.slice(0, 8),
          email: author,
          role: 'end_user',
          isPrimary: false,
          influence: 'low',
        });
      }
    }
    
    return [...hubspotStakeholders, ...additionalStakeholders];
  }
  
  // Fallback: build stakeholders from Arda authors only
  const stakeholders: Stakeholder[] = [];
  let isPrimary = true;
  
  for (const author of uniqueAuthors) {
    stakeholders.push({
      id: `stakeholder-${author.slice(0, 8)}`,
      accountId: accountId || '',
      name: author.split('@')[0] || author.slice(0, 8),
      email: author.includes('@') ? author : `${author}@unknown.com`,
      role: isPrimary ? 'power_user' : 'end_user',
      isPrimary,
      influence: isPrimary ? 'high' : 'medium',
    });
    isPrimary = false;
  }
  
  return stakeholders;
}

function mapEmployeeCountToSize(employeeCount?: number): string | undefined {
  if (!employeeCount) return undefined;
  if (employeeCount <= 10) return '1-10';
  if (employeeCount <= 50) return '11-50';
  if (employeeCount <= 200) return '51-200';
  if (employeeCount <= 500) return '201-500';
  if (employeeCount <= 1000) return '501-1000';
  if (employeeCount <= 5000) return '1001-5000';
  if (employeeCount <= 10000) return '5001-10000';
  return '10001+';
}

function splitName(fullName?: string): { firstName?: string; lastName?: string } {
  if (!fullName) return {};
  const parts = fullName.split(' ');
  if (parts.length === 1) return { firstName: parts[0] };
  return { firstName: parts.slice(0, -1).join(' '), lastName: parts[parts.length - 1] };
}

function parseLocation(location?: string): { city?: string; state?: string; country?: string } | undefined {
  if (!location) return undefined;
  const parts = location.split(',').map(part => part.trim());
  return {
    city: parts[0],
    state: parts[1],
    country: parts[2],
  };
}

function mapHubSpotDealType(type?: string): 'new_business' | 'expansion' | 'renewal' | 'other' {
  if (!type) return 'other';
  const normalized = type.toLowerCase();
  if (normalized.includes('renewal')) return 'renewal';
  if (normalized.includes('expansion') || normalized.includes('upsell') || normalized.includes('cross')) {
    return 'expansion';
  }
  if (normalized.includes('new')) return 'new_business';
  return 'other';
}

function buildHubSpotSummary(
  hubspotData?: HubSpotEnrichedData,
  portalId?: string | null
): HubSpotAccountData | undefined {
  if (!hubspotData?.found) {
    return undefined;
  }

  const fetchedAt = new Date().toISOString();

  const company = hubspotData.company
    ? {
        id: hubspotData.company.id,
        name: hubspotData.company.name || 'Unknown',
        domain: hubspotData.company.domain,
        industry: hubspotData.company.industry,
        companySize: mapEmployeeCountToSize(hubspotData.company.employeeCount),
        annualRevenue: hubspotData.company.annualRevenue,
        location: parseLocation(hubspotData.company.location),
        website: hubspotData.company.domain ? `https://${hubspotData.company.domain}` : undefined,
        description: undefined,
        hubspotUrl: buildHubSpotUrl('company', hubspotData.company.id, portalId),
        createdAt: hubspotData.company.createdAt,
        updatedAt: hubspotData.company.updatedAt,
      }
    : null;

  const contacts = hubspotData.contacts.map(contact => ({
    id: contact.id,
    firstName: contact.firstName,
    lastName: contact.lastName,
    email: contact.email || '',
    phone: contact.phone,
    jobTitle: contact.jobTitle,
    lifecycleStage: contact.lifecycleStage,
    leadStatus: contact.leadStatus,
    lastActivityDate: contact.lastActivityDate,
    hubspotUrl: buildHubSpotUrl('contact', contact.id, portalId),
    createdAt: contact.createdAt,
    updatedAt: contact.updatedAt,
  }));

  const deals = hubspotData.deals.map(deal => ({
    id: deal.id,
    name: deal.name || `Deal ${deal.id}`,
    stage: deal.stage || 'Unknown',
    pipeline: deal.pipeline,
    amount: deal.amount,
    currency: undefined,
    closeDate: deal.closeDate,
    probability: deal.probability,
    dealType: mapHubSpotDealType(deal.type),
    hubspotUrl: buildHubSpotUrl('deal', deal.id, portalId),
    createdAt: deal.createdAt,
    updatedAt: deal.updatedAt,
  }));

  const owner = hubspotData.company?.ownerName || hubspotData.company?.ownerEmail
    ? {
        id: hubspotData.company?.ownerId || 'hubspot-owner',
        email: hubspotData.company?.ownerEmail || '',
        ...splitName(hubspotData.company?.ownerName),
        fullName: hubspotData.company?.ownerName || hubspotData.company?.ownerEmail || 'HubSpot Owner',
        avatarUrl: undefined,
        teamId: undefined,
        userId: undefined,
      }
    : null;

  return {
    company,
    contacts,
    deals,
    owner,
    source: 'hubspot',
    fetchedAt,
    lastSyncedAt: fetchedAt,
  };
}

function deriveAccountName(tenantId: string, tenantInfo?: ArdaTenant): string {
  return resolveTenantName(
    tenantId,
    tenantInfo?.payload.tenantName,
    tenantInfo?.payload.company?.name
  );
}
