/**
 * Alerts API Endpoint
 * 
 * GET /api/cs/alerts
 * 
 * Returns aggregated alerts from all accounts in the portfolio.
 * Supports filtering by severity, status, accountId, and ownerId.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import type { Alert, AlertSeverity, AlertStatus } from '../../src/lib/types/account';
import { 
  aggregateByTenant, 
  fetchTenants,
  extractEmailInfo,
  type ArdaTenant,
} from '../lib/arda-api';
import { calculateHealthScore, type HealthScoringInput } from '../lib/health-scoring';
import { buildAccountMappings, fetchCodaOverrides } from '../lib/account-mappings';
import { generateAlerts } from '../lib/alerts';
import { resolveTenantName } from '../lib/tenant-names';

// ============================================================================
// Types
// ============================================================================

interface AlertWithAccount extends Alert {
  accountName: string;
}

interface AlertsResponse {
  alerts: AlertWithAccount[];
  totalCount: number;
  criticalCount: number;
  highCount: number;
  mediumCount: number;
  lowCount: number;
}

// Cache for performance (in-memory, reset on cold start)
interface CacheEntry {
  data: AlertsResponse;
  timestamp: number;
}

let alertsCache: CacheEntry | null = null;
const CACHE_TTL_MS = 60 * 1000; // 1 minute (shorter than portfolio since alerts are more dynamic)

// ============================================================================
// Handler
// ============================================================================

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type, X-Arda-API-Key, X-Arda-Author');
  
  // Edge caching headers
  res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=120');
  res.setHeader('CDN-Cache-Control', 'max-age=60');
  res.setHeader('Vercel-CDN-Cache-Control', 'max-age=60');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  
  // Parse query parameters for filtering
  const { 
    severity, 
    status, 
    accountId: filterAccountId, 
    ownerId: filterOwnerId,
    limit: limitParam,
  } = req.query;
  
  const limit = limitParam ? parseInt(String(limitParam), 10) : undefined;
  
  try {
    // Get API credentials
    const apiKey = req.headers['x-arda-api-key'] as string || process.env.ARDA_API_KEY;
    const author = req.headers['x-arda-author'] as string || process.env.ARDA_AUTHOR || 'dashboard@arda.cards';
    const codaToken = process.env.CODA_API_TOKEN;
    const codaDocId = process.env.CODA_DOC_ID || '0cEU3RTNX6';
    
    if (!apiKey) {
      return res.status(401).json({ error: 'Missing API key' });
    }
    
    // Check cache for base alerts (before filtering)
    const now = Date.now();
    let baseResponse: AlertsResponse;
    
    if (alertsCache && (now - alertsCache.timestamp) < CACHE_TTL_MS) {
      baseResponse = alertsCache.data;
    } else {
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
      
      // Generate alerts for all accounts
      const allAlerts: AlertWithAccount[] = [];
      
      for (const [tenantId, activityData] of tenantAggregation) {
        const mapping = accountMappings.get(tenantId);
        
        // Skip excluded accounts
        if (mapping?.isExcluded) {
          continue;
        }
        
        // Skip tenants with no stakeholders AND no activity
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
        
        // Derive account name
        const accountName = mapping?.name || resolveTenantName(
          tenantId,
          tenantInfo?.payload.tenantName,
          tenantInfo?.payload.company?.name
        );
        
        // Generate alerts for this account
        const accountAlerts = generateAlerts({
          accountId: mapping?.accountId || tenantId,
          accountName,
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
        
        // Add account name to each alert
        for (const alert of accountAlerts) {
          allAlerts.push({
            ...alert,
            accountName,
          });
        }
      }
      
      // Sort alerts by severity then by creation time
      allAlerts.sort((a, b) => {
        const severityOrder: Record<AlertSeverity, number> = { 
          critical: 0, 
          high: 1, 
          medium: 2, 
          low: 3 
        };
        const severityDiff = severityOrder[a.severity] - severityOrder[b.severity];
        if (severityDiff !== 0) return severityDiff;
        
        // Then by ARR at risk (higher first)
        const arrDiff = (b.arrAtRisk || 0) - (a.arrAtRisk || 0);
        if (arrDiff !== 0) return arrDiff;
        
        // Then by creation time (newest first)
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });
      
      // Build response
      baseResponse = {
        alerts: allAlerts,
        totalCount: allAlerts.length,
        criticalCount: allAlerts.filter(a => a.severity === 'critical').length,
        highCount: allAlerts.filter(a => a.severity === 'high').length,
        mediumCount: allAlerts.filter(a => a.severity === 'medium').length,
        lowCount: allAlerts.filter(a => a.severity === 'low').length,
      };
      
      // Update cache
      alertsCache = {
        data: baseResponse,
        timestamp: now,
      };
    }
    
    // Apply filters
    let filteredAlerts = [...baseResponse.alerts];
    
    if (severity) {
      const severityFilter = String(severity) as AlertSeverity;
      filteredAlerts = filteredAlerts.filter(a => a.severity === severityFilter);
    }
    
    if (status) {
      const statusFilter = String(status) as AlertStatus;
      filteredAlerts = filteredAlerts.filter(a => a.status === statusFilter);
    }
    
    if (filterAccountId) {
      const accountIdFilter = String(filterAccountId);
      filteredAlerts = filteredAlerts.filter(a => a.accountId === accountIdFilter);
    }
    
    if (filterOwnerId) {
      const ownerIdFilter = String(filterOwnerId);
      filteredAlerts = filteredAlerts.filter(a => a.ownerId === ownerIdFilter);
    }
    
    // Apply limit
    if (limit && limit > 0) {
      filteredAlerts = filteredAlerts.slice(0, limit);
    }
    
    // Build filtered response
    const response: AlertsResponse = {
      alerts: filteredAlerts,
      totalCount: filteredAlerts.length,
      criticalCount: filteredAlerts.filter(a => a.severity === 'critical').length,
      highCount: filteredAlerts.filter(a => a.severity === 'high').length,
      mediumCount: filteredAlerts.filter(a => a.severity === 'medium').length,
      lowCount: filteredAlerts.filter(a => a.severity === 'low').length,
    };
    
    return res.status(200).json(response);
    
  } catch (error) {
    console.error('Alerts API error:', error);
    return res.status(500).json({ 
      error: 'Failed to fetch alerts',
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
  
  if (recentTimestamps.length === 0) return 0;
  if (recentTimestamps.length < 5) return 1;
  if (recentTimestamps.length < 15) return 2;
  if (recentTimestamps.length < 30) return 3;
  return Math.min(10, Math.floor(recentTimestamps.length / 10));
}
