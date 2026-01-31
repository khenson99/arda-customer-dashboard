/**
 * Portfolio API Endpoint
 * 
 * GET /api/cs/portfolio
 * 
 * Returns aggregated customer account summaries for the portfolio view.
 * All computation is done server-side for performance.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import type { AccountSummary, LifecycleStage, OnboardingStatus } from '../../src/lib/types/account.js';
import { 
  aggregateByTenant, 
  fetchTenants,
  extractEmailInfo,
  type ArdaTenant,
} from '../../server/lib/arda-api.js';
import { calculateHealthScore, type HealthScoringInput } from '../../server/lib/health-scoring.js';
import { buildAccountMappings, fetchCodaOverrides } from '../../server/lib/account-mappings.js';
import { generateAlerts } from '../../server/lib/alerts.js';
import { fetchCustomerByDomain, getStripeEnrichedMetrics, type StripeEnrichedMetrics } from '../../server/lib/stripe-api.js';
import { resolveTenantName, TENANT_NAMES } from '../../server/lib/tenant-names.js';
import { requireApiKey } from '../lib/auth.js';

// Cache for performance (in-memory, reset on cold start)
interface CacheEntry {
  data: AccountSummary[];
  timestamp: number;
}

let portfolioCache: CacheEntry | null = null;
const CACHE_TTL_MS = 2 * 60 * 1000; // 2 minutes

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  if (!requireApiKey(req, res)) return;
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type, X-Arda-API-Key, X-Arda-Author');
  
  // Edge caching headers for CDN optimization
  // Cache for 2 minutes at CDN, serve stale for up to 5 minutes while revalidating
  res.setHeader('Cache-Control', 's-maxage=120, stale-while-revalidate=300');
  res.setHeader('CDN-Cache-Control', 'max-age=120');
  res.setHeader('Vercel-CDN-Cache-Control', 'max-age=120');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  
  try {
    // Check for Stripe enrichment flag
    // Note: This significantly increases API response time due to Stripe calls
    // Use sparingly to avoid rate limits (Stripe allows 100 req/sec)
    const includeStripe = req.query.includeStripe === 'true';
    const stripeKey = process.env.STRIPE_SECRET_KEY || process.env.STRIPE_API_KEY;
    const stripeEnabled = includeStripe && !!stripeKey;
    
    // Check cache (skip cache if Stripe is requested - more dynamic data)
    const now = Date.now();
    if (!stripeEnabled && portfolioCache && (now - portfolioCache.timestamp) < CACHE_TTL_MS) {
      return res.status(200).json({
        accounts: portfolioCache.data,
        cached: true,
        cacheAge: now - portfolioCache.timestamp,
        stripeEnriched: false,
      });
    }
    
    // Get API credentials from headers or environment
    const apiKey = req.headers['x-arda-api-key'] as string || process.env.ARDA_API_KEY;
    const author = req.headers['x-arda-author'] as string || process.env.ARDA_AUTHOR || 'dashboard@arda.cards';
    const codaToken = process.env.CODA_API_TOKEN;
    const codaDocId = process.env.CODA_DOC_ID || '0cEU3RTNX6';
    
    if (!apiKey) {
      return res.status(401).json({ error: 'Missing API key' });
    }
    
    // Fetch all data in parallel
    const [tenantAggregation, tenants, codaOverrides] = await Promise.all([
      aggregateByTenant(apiKey, author),
      fetchTenants(apiKey, author).catch(() => []),
      fetchCodaOverrides(codaToken, codaDocId),
    ]);
    
    // Build tenant info map
    const tenantInfoMap = new Map<string, ArdaTenant>();
    for (const tenant of tenants) {
      tenantInfoMap.set(tenant.payload.eId, tenant);
    }
    
    // Build tenant data for mapping
    const tenantData = Array.from(tenantAggregation.keys()).map(tenantId => {
      const tenantInfo = tenantInfoMap.get(tenantId);
      const emailInfo = tenantInfo ? extractEmailInfo(tenantInfo.payload.tenantName) : null;
      return {
        tenantId,
        tenantName: tenantInfo?.payload.tenantName || `Org ${tenantId.slice(0, 8)}`,
        email: emailInfo?.email,
      };
    });
    
    // Build account mappings
    const accountMappings = buildAccountMappings(tenantData, codaOverrides);
    
    // Fetch Stripe data if enabled (with rate limiting consideration)
    const stripeDataByAccountId = new Map<string, StripeEnrichedMetrics>();
    
    if (stripeEnabled && stripeKey) {
      // Build list of unique accounts with Stripe lookup info
      // Priority: 1) Account mapping stripeId, 2) TENANT_NAMES stripeCustomerId,
      // 3) TENANT_NAMES stripeEmail, 4) extracted email, 5) domain
      const accountLookup = new Map<string, {
        accountId: string;
        name: string;
        email?: string;
        customerId?: string;
        domain?: string;
      }>();

      for (const tenant of tenantData) {
        const mapping = accountMappings.get(tenant.tenantId);
        const accountId = mapping?.accountId || tenant.tenantId;
        const tenantNameInfo = TENANT_NAMES[tenant.tenantId];

        const existing = accountLookup.get(accountId) || {
          accountId,
          name: mapping?.name || tenantNameInfo?.name || tenant.tenantName,
        };

        if (!existing.customerId) {
          existing.customerId = mapping?.stripeId || tenantNameInfo?.stripeCustomerId;
        }

        if (!existing.email) {
          existing.email = tenantNameInfo?.stripeEmail || tenant.email;
        }

        if (!existing.domain) {
          existing.domain = mapping?.domain || tenantNameInfo?.domain || (existing.email ? existing.email.split('@')[1] : undefined);
        }

        accountLookup.set(accountId, existing);
      }

      const accountsForStripeLookup = Array.from(accountLookup.values())
        .filter(t => t.email || t.customerId || t.domain)
        .slice(0, 50); // Limit to 50 accounts max to avoid rate limits
      
      // Batch fetch with small delays to be safe with rate limits
      const batchSize = 10;
      for (let i = 0; i < accountsForStripeLookup.length; i += batchSize) {
        const batch = accountsForStripeLookup.slice(i, i + batchSize);
        
        const batchResults = await Promise.all(
          batch.map(async (t) => {
            try {
              // First try with email/customerId
              let stripeData = await getStripeEnrichedMetrics(
                { 
                  email: t.email,
                  customerId: t.customerId,
                },
                stripeKey
              );
              
              // If not found and we have a domain, try domain search
              if (!stripeData.found && t.domain) {
                const domainCustomer = await fetchCustomerByDomain(t.domain, stripeKey, {
                  preferredName: t.name,
                  preferredEmail: t.email,
                  preferredAccountId: t.accountId,
                });
                
                if (domainCustomer) {
                  stripeData = await getStripeEnrichedMetrics(
                    { customerId: domainCustomer.id },
                    stripeKey
                  );
                }
              }
              
              return { accountId: t.accountId, stripeData };
            } catch (error) {
              console.warn(`Failed to fetch Stripe data for ${t.email || t.domain || t.accountId}:`, error);
              return { accountId: t.accountId, stripeData: null };
            }
          })
        );
        
        for (const result of batchResults) {
          if (result.stripeData?.found) {
            stripeDataByAccountId.set(result.accountId, result.stripeData);
          }
        }
        
        // Small delay between batches to respect rate limits
        if (i + batchSize < accountsForStripeLookup.length) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }
    }
    
    // Build account summaries
    const accounts: AccountSummary[] = [];
    
    for (const [tenantId, activityData] of tenantAggregation) {
      const mapping = accountMappings.get(tenantId);
      
      // Skip excluded accounts
      if (mapping?.isExcluded) {
        continue;
      }
      
      // Skip tenants with no stakeholders (users) AND no activity
      const hasStakeholders = activityData.uniqueAuthors.size > 0;
      const hasActivity = activityData.itemCount > 0 || 
                          activityData.kanbanCardCount > 0 || 
                          activityData.orderCount > 0;
      
      if (!hasStakeholders && !hasActivity) {
        continue;
      }
      
      const tenantInfo = tenantInfoMap.get(tenantId);
      const createdAt = tenantInfo?.createdAt.effective || Date.now();
      const accountAgeDays = Math.floor((Date.now() - createdAt) / (1000 * 60 * 60 * 24));
      
      // Calculate days since last activity
      const daysSinceLastActivity = activityData.lastActivityTimestamp > 0
        ? Math.floor((Date.now() - activityData.lastActivityTimestamp) / (1000 * 60 * 60 * 24))
        : accountAgeDays;
      
      // Build health scoring input
      const healthInput: HealthScoringInput = {
        itemCount: activityData.itemCount,
        kanbanCardCount: activityData.kanbanCardCount,
        orderCount: activityData.orderCount,
        totalUsers: activityData.uniqueAuthors.size,
        activeUsersLast7Days: estimateActiveUsers(activityData.activityTimestamps, 7),
        activeUsersLast30Days: estimateActiveUsers(activityData.activityTimestamps, 30),
        daysSinceLastActivity,
        accountAgeDays,
        segment: mapping?.segment,
        tier: mapping?.tier,
      };
      
      // Calculate health score
      const health = calculateHealthScore(healthInput);
      
      // Determine lifecycle stage
      const lifecycleStage = determineLifecycleStage(
        accountAgeDays,
        activityData,
        health.score
      );
      
      // Determine onboarding status
      const onboardingStatus = determineOnboardingStatus(
        accountAgeDays,
        activityData
      );
      
      // Build activity trend (last 8 weeks)
      const activityTrend = buildActivityTrend(activityData.activityTimestamps);
      
      // Get Stripe data if available (for commercial metrics)
      const accountKey = mapping?.accountId || tenantId;
      const stripeData = stripeDataByAccountId.get(accountKey);
      
      // Build commercial metrics for alert generation
      const commercial = stripeData?.found ? {
        plan: stripeData.plan || 'Unknown',
        arr: stripeData.arr,
        mrr: stripeData.mrr,
        currency: stripeData.currency || 'USD',
        daysToRenewal: stripeData.daysToRenewal,
        renewalDate: stripeData.renewalDate,
        paymentStatus: stripeData.paymentStatus,
        overdueAmount: stripeData.overdueAmount,
        expansionSignals: [],
        expansionPotential: 'none' as const,
      } : undefined;
      
      // Build activity timeline for usage_decline alert detection
      const activityTimelineForAlerts = buildActivityTimelineForAlerts(
        activityData.activityTimestamps,
        activityData
      );
      
      // Build usage metrics for alert generation
      const usage = {
        itemCount: activityData.itemCount,
        kanbanCardCount: activityData.kanbanCardCount,
        orderCount: activityData.orderCount,
        totalUsers: activityData.uniqueAuthors.size,
        activeUsersLast7Days: healthInput.activeUsersLast7Days,
        activeUsersLast30Days: healthInput.activeUsersLast30Days,
        daysActive: 0,
        daysSinceLastActivity,
        avgActionsPerDay: 0,
        featureAdoption: { items: 0, kanban: 0, ordering: 0, receiving: 0, reporting: 0 },
        outcomes: { ordersPlaced: activityData.orderCount, ordersReceived: 0 },
        activityTimeline: activityTimelineForAlerts,
      };
      
      // Generate alerts for count
      const alertInput = {
        accountId: mapping?.accountId || tenantId,
        accountName: mapping?.name || `Org ${tenantId.slice(0, 8)}`,
        health,
        usage,
        commercial, // Pass commercial metrics for renewal/payment alerts
        accountAgeDays,
        tier: mapping?.tier,
        segment: mapping?.segment,
        arr: stripeData?.arr, // Pass ARR for arrAtRisk calculation
        ownerId: mapping?.ownerId,
        ownerName: mapping?.ownerName,
      };
      
      const alerts = generateAlerts(alertInput);
      
      const alertCount = alerts.length;
      const criticalAlertCount = alerts.filter(a => a.severity === 'critical').length;
      
      accounts.push({
        id: mapping?.accountId || tenantId,
        name: mapping?.name || deriveAccountName(tenantId, tenantInfo),
        segment: mapping?.segment || 'smb',
        tier: mapping?.tier || 'starter',
        ownerName: mapping?.ownerName,
        healthScore: health.score,
        healthGrade: health.grade,
        healthTrend: health.trend,
        activeUsers: activityData.uniqueAuthors.size,
        daysSinceLastActivity,
        itemCount: activityData.itemCount,
        kanbanCardCount: activityData.kanbanCardCount,
        orderCount: activityData.orderCount,
        accountAgeDays,
        lifecycleStage,
        onboardingStatus,
        // Include ARR from Stripe if available
        arr: stripeData?.arr,
        daysToRenewal: stripeData?.daysToRenewal,
        alertCount,
        criticalAlertCount,
        activityTrend,
        primaryTenantId: tenantId,
      });
    }
    
    // Sort by priority: critical alerts first, then health score, then activity
    accounts.sort((a, b) => {
      // Critical alerts first
      if (a.criticalAlertCount !== b.criticalAlertCount) {
        return b.criticalAlertCount - a.criticalAlertCount;
      }
      // Then by total alerts
      if (a.alertCount !== b.alertCount) {
        return b.alertCount - a.alertCount;
      }
      // Then by health (lower first = needs attention)
      if (a.healthScore !== b.healthScore) {
        return a.healthScore - b.healthScore;
      }
      // Then by activity (active first)
      return a.daysSinceLastActivity - b.daysSinceLastActivity;
    });
    
    // Cache the result (only if Stripe enrichment was NOT requested)
    if (!stripeEnabled) {
      portfolioCache = {
        data: accounts,
        timestamp: now,
      };
    }
    
    return res.status(200).json({
      accounts,
      cached: false,
      totalAccounts: accounts.length,
      excludedAccounts: tenantAggregation.size - accounts.length,
      stripeEnriched: stripeEnabled,
      stripeAccountsEnriched: stripeEnabled ? stripeDataByAccountId.size : 0,
    });
    
  } catch (error) {
    console.error('Portfolio API error:', error);
    return res.status(500).json({ 
      error: 'Failed to fetch portfolio data',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

function estimateActiveUsers(timestamps: number[], days: number): number {
  const cutoff = Date.now() - (days * 24 * 60 * 60 * 1000);
  const recentTimestamps = timestamps.filter(t => t >= cutoff);
  
  // This is a rough estimate - in production, we'd track unique authors per period
  // For now, estimate based on activity volume
  if (recentTimestamps.length === 0) return 0;
  if (recentTimestamps.length < 5) return 1;
  if (recentTimestamps.length < 15) return 2;
  if (recentTimestamps.length < 30) return 3;
  return Math.min(10, Math.floor(recentTimestamps.length / 10));
}

function determineLifecycleStage(
  accountAgeDays: number,
  activityData: { itemCount: number; kanbanCardCount: number; orderCount: number; uniqueAuthors: Set<string> },
  healthScore: number
): LifecycleStage {
  const hasOrders = activityData.orderCount > 0;
  const hasKanban = activityData.kanbanCardCount > 0;
  const hasItems = activityData.itemCount > 0;
  const isActive = activityData.uniqueAuthors.size > 0;
  
  if (!isActive && accountAgeDays > 60) {
    return 'churned';
  }
  
  if (accountAgeDays <= 30) {
    return 'onboarding';
  }
  
  if (accountAgeDays <= 90 && !hasOrders) {
    return 'adoption';
  }
  
  if (hasOrders && healthScore >= 70 && activityData.orderCount >= 10) {
    return 'growth';
  }
  
  if (hasOrders && healthScore >= 50) {
    return 'mature';
  }
  
  if (accountAgeDays > 300) {
    return 'renewal';
  }
  
  return 'adoption';
}

function determineOnboardingStatus(
  accountAgeDays: number,
  activityData: { itemCount: number; kanbanCardCount: number; orderCount: number }
): OnboardingStatus {
  const hasItems = activityData.itemCount >= 5;
  const hasKanban = activityData.kanbanCardCount >= 1;
  const hasOrders = activityData.orderCount >= 1;
  
  if (hasOrders) {
    return 'completed';
  }
  
  if (activityData.itemCount === 0 && accountAgeDays >= 7) {
    return 'stalled';
  }
  
  if (hasItems && !hasKanban && accountAgeDays >= 21) {
    return 'stalled';
  }
  
  if (hasItems || hasKanban) {
    return 'in_progress';
  }
  
  return 'not_started';
}

function buildActivityTrend(timestamps: number[]): number[] {
  const weeks: number[] = [];
  const now = Date.now();
  const weekMs = 7 * 24 * 60 * 60 * 1000;
  
  for (let i = 7; i >= 0; i--) {
    const weekStart = now - ((i + 1) * weekMs);
    const weekEnd = now - (i * weekMs);
    const count = timestamps.filter(t => t >= weekStart && t < weekEnd).length;
    weeks.push(count);
  }
  
  return weeks;
}

/**
 * Build activity timeline for usage_decline alert detection
 * Returns weekly activity data points for the last 8 weeks
 */
function buildActivityTimelineForAlerts(
  timestamps: number[],
  activityData: { itemCount: number; kanbanCardCount: number; orderCount: number }
): { date: string; items: number; kanbanCards: number; orders: number; activeUsers: number }[] {
  const timeline: { date: string; items: number; kanbanCards: number; orders: number; activeUsers: number }[] = [];
  const now = Date.now();
  const weekMs = 7 * 24 * 60 * 60 * 1000;
  
  // Estimate distribution of activity across weeks based on timestamps
  // This is a rough approximation since we don't have entity-level timestamps in portfolio view
  const weekCounts: number[] = [];
  for (let i = 7; i >= 0; i--) {
    const weekStart = now - ((i + 1) * weekMs);
    const weekEnd = now - (i * weekMs);
    weekCounts.push(timestamps.filter(t => t >= weekStart && t < weekEnd).length);
  }
  
  const totalActivity = weekCounts.reduce((a, b) => a + b, 0);
  
  for (let i = 0; i < 8; i++) {
    const weekStart = now - ((8 - i) * weekMs);
    const weekLabel = new Date(weekStart).toISOString().split('T')[0];
    const ratio = totalActivity > 0 ? weekCounts[i] / totalActivity : 0;
    
    timeline.push({
      date: weekLabel,
      items: Math.round(activityData.itemCount * ratio),
      kanbanCards: Math.round(activityData.kanbanCardCount * ratio),
      orders: Math.round(activityData.orderCount * ratio),
      activeUsers: weekCounts[i] > 0 ? 1 : 0,
    });
  }
  
  return timeline;
}

function deriveAccountName(tenantId: string, tenantInfo?: ArdaTenant): string {
  return resolveTenantName(
    tenantId,
    tenantInfo?.payload.tenantName,
    tenantInfo?.payload.company?.name
  );
}
