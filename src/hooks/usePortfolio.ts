/**
 * Portfolio Hook
 * 
 * React Query hook for fetching and managing portfolio data.
 * Automatically falls back to legacy API if new API is unavailable.
 */

import { useQuery } from '@tanstack/react-query';
import { 
  fetchPortfolio, 
  queryKeys, 
  defaultQueryOptions,
  type PortfolioResponse,
} from '../lib/api/cs-api';
import { fetchCustomerMetrics, type CustomerMetrics } from '../lib/arda-client';
import type { AccountSummary } from '../lib/types/account';

// Track whether we should use the new API
let useNewApi = true;
const allowLegacyFallback = !import.meta.env.PROD;

/**
 * Transform legacy CustomerMetrics to AccountSummary format.
 */
function transformLegacyToSummary(metrics: CustomerMetrics[]): AccountSummary[] {
  return metrics.map((m): AccountSummary => ({
    id: m.tenantId,
    name: m.displayName || m.companyName,
    segment: 'smb',
    tier: m.tier || 'starter',
    ownerName: m.assignedCSM,
    healthScore: m.healthScore,
    healthGrade: m.healthScore >= 80 ? 'A' : m.healthScore >= 65 ? 'B' : m.healthScore >= 50 ? 'C' : m.healthScore >= 35 ? 'D' : 'F',
    healthTrend: 'stable',
    activeUsers: m.userCount,
    daysSinceLastActivity: m.daysInactive,
    lifecycleStage: m.lifecycleStage,
    onboardingStatus: m.stage === 'live' ? 'completed' : m.stage === 'deployed' ? 'in_progress' : 'not_started',
    alertCount: m.alerts?.length || 0,
    criticalAlertCount: m.alerts?.filter(a => a.severity === 'critical').length || 0,
    activityTrend: m.activityTimeline?.map(a => a.activity) || [],
    primaryTenantId: m.tenantId,
  }));
}

/**
 * Fetch portfolio with fallback to legacy API.
 */
async function fetchPortfolioWithFallback(): Promise<PortfolioResponse> {
  if (useNewApi) {
    try {
      const result = await fetchPortfolio();
      return result;
    } catch (error) {
      if (!allowLegacyFallback) {
        throw error;
      }
      console.warn('New portfolio API failed, falling back to legacy:', error);
      useNewApi = false;
    }
  }
  
  if (!allowLegacyFallback) {
    throw new Error('Portfolio API unavailable');
  }

  // Fallback to legacy client-side API (dev only)
  const legacyMetrics = await fetchCustomerMetrics();
  const accounts = transformLegacyToSummary(legacyMetrics);
  
  return {
    accounts,
    cached: false,
    totalAccounts: accounts.length,
  };
}

/**
 * Hook to fetch the portfolio of customer accounts.
 */
export function usePortfolio() {
  return useQuery({
    queryKey: queryKeys.portfolio,
    queryFn: fetchPortfolioWithFallback,
    ...defaultQueryOptions,
    staleTime: 1 * 60 * 1000, // 1 minute for portfolio
  });
}

/**
 * Hook to get portfolio with filtering capabilities.
 */
export function useFilteredPortfolio(filters: {
  segment?: string;
  tier?: string;
  lifecycleStage?: string;
  owner?: string;
  healthGrade?: string;
  searchQuery?: string;
}) {
  const { data, ...rest } = usePortfolio();
  
  // Apply client-side filters
  const filteredAccounts = data?.accounts.filter(account => {
    if (filters.segment && filters.segment !== 'all' && account.segment !== filters.segment) {
      return false;
    }
    if (filters.tier && filters.tier !== 'all' && account.tier !== filters.tier) {
      return false;
    }
    if (filters.lifecycleStage && filters.lifecycleStage !== 'all' && account.lifecycleStage !== filters.lifecycleStage) {
      return false;
    }
    if (filters.owner && filters.owner !== 'all' && account.ownerName !== filters.owner) {
      return false;
    }
    if (filters.healthGrade && filters.healthGrade !== 'all' && account.healthGrade !== filters.healthGrade) {
      return false;
    }
    if (filters.searchQuery) {
      const query = filters.searchQuery.toLowerCase();
      const nameMatch = account.name.toLowerCase().includes(query);
      const ownerMatch = account.ownerName?.toLowerCase().includes(query);
      if (!nameMatch && !ownerMatch) {
        return false;
      }
    }
    return true;
  });
  
  return {
    ...rest,
    data: data ? { ...data, accounts: filteredAccounts || [] } : undefined,
    allAccounts: data?.accounts || [],
  };
}

/**
 * Hook to get portfolio statistics.
 */
export function usePortfolioStats() {
  const { data, isLoading } = usePortfolio();
  
  if (isLoading || !data) {
    return {
      isLoading,
      totalAccounts: 0,
      healthyAccounts: 0,
      atRiskAccounts: 0,
      criticalAccounts: 0,
      avgHealthScore: 0,
      totalAlerts: 0,
      criticalAlerts: 0,
    };
  }
  
  const accounts = data.accounts;
  const healthyAccounts = accounts.filter(a => a.healthGrade === 'A' || a.healthGrade === 'B').length;
  const atRiskAccounts = accounts.filter(a => a.healthGrade === 'C' || a.healthGrade === 'D').length;
  const criticalAccounts = accounts.filter(a => a.healthGrade === 'F').length;
  const avgHealthScore = accounts.length > 0
    ? Math.round(accounts.reduce((sum, a) => sum + a.healthScore, 0) / accounts.length)
    : 0;
  const totalAlerts = accounts.reduce((sum, a) => sum + a.alertCount, 0);
  const criticalAlerts = accounts.reduce((sum, a) => sum + a.criticalAlertCount, 0);
  
  return {
    isLoading,
    totalAccounts: accounts.length,
    healthyAccounts,
    atRiskAccounts,
    criticalAccounts,
    avgHealthScore,
    totalAlerts,
    criticalAlerts,
  };
}

/**
 * Hook to prefetch account details on hover.
 */
// Prefetch helper removed (unused)
