/**
 * Portfolio API Endpoint
 * 
 * GET /api/cs/portfolio
 * 
 * Returns aggregated customer account summaries for the portfolio view.
 * All computation is done server-side for performance.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import type { AccountSummary, LifecycleStage, OnboardingStatus } from '../../src/lib/types/account';
import { 
  aggregateByTenant, 
  fetchTenants,
  extractEmailInfo,
  domainToCompanyName,
  PUBLIC_DOMAINS,
  type ArdaTenant,
} from '../lib/arda-api';
import { calculateHealthScore, type HealthScoringInput } from '../lib/health-scoring';
import { buildAccountMappings, fetchCodaOverrides } from '../lib/account-mappings';
import { generateAlerts } from '../lib/alerts';
import { getStripeEnrichedMetrics, type StripeEnrichedMetrics } from '../lib/stripe-api';

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
    const stripeDataMap = new Map<string, StripeEnrichedMetrics>();
    
    if (stripeEnabled && stripeKey) {
      // Fetch Stripe data for accounts with email addresses
      // Limit to 50 accounts max to avoid rate limits (Stripe allows 100 req/sec)
      const accountsWithEmail = tenantData
        .filter(t => t.email)
        .slice(0, 50);
      
      // Batch fetch with small delays to be safe with rate limits
      const batchSize = 10;
      for (let i = 0; i < accountsWithEmail.length; i += batchSize) {
        const batch = accountsWithEmail.slice(i, i + batchSize);
        
        const batchResults = await Promise.all(
          batch.map(async (t) => {
            try {
              const stripeData = await getStripeEnrichedMetrics(
                { email: t.email },
                stripeKey
              );
              return { tenantId: t.tenantId, stripeData };
            } catch (error) {
              console.warn(`Failed to fetch Stripe data for ${t.email}:`, error);
              return { tenantId: t.tenantId, stripeData: null };
            }
          })
        );
        
        for (const result of batchResults) {
          if (result.stripeData?.found) {
            stripeDataMap.set(result.tenantId, result.stripeData);
          }
        }
        
        // Small delay between batches to respect rate limits
        if (i + batchSize < accountsWithEmail.length) {
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
      
      // Generate alerts for count
      const alerts = generateAlerts({
        accountId: mapping?.accountId || tenantId,
        accountName: mapping?.name || `Org ${tenantId.slice(0, 8)}`,
        health,
        usage: {
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
          activityTimeline: [],
        },
        accountAgeDays,
        tier: mapping?.tier,
        segment: mapping?.segment,
        ownerId: mapping?.ownerId,
        ownerName: mapping?.ownerName,
      });
      
      const alertCount = alerts.length;
      const criticalAlertCount = alerts.filter(a => a.severity === 'critical').length;
      
      // Get Stripe data if available
      const stripeData = stripeDataMap.get(tenantId);
      
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
      stripeAccountsEnriched: stripeEnabled ? stripeDataMap.size : 0,
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

function deriveAccountName(tenantId: string, tenantInfo?: ArdaTenant): string {
  if (!tenantInfo) {
    return `Org ${tenantId.slice(0, 8)}`;
  }
  
  const emailInfo = extractEmailInfo(tenantInfo.payload.tenantName);
  if (emailInfo) {
    if (PUBLIC_DOMAINS.includes(emailInfo.domain)) {
      return emailInfo.email;
    }
    return domainToCompanyName(emailInfo.domain);
  }
  
  return tenantInfo.payload.company?.name || `Org ${tenantId.slice(0, 8)}`;
}
