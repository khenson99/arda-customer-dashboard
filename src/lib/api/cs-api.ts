/**
 * Customer Success API Client
 * 
 * Client-side API for consuming the CS dashboard endpoints.
 * Uses the new server-side API for better performance.
 */

import type { AccountSummary, AccountDetail, Alert } from '../types/account';

// API base URL - uses relative path in production, configurable in dev
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
// Portfolio API
// ============================================================================

export interface PortfolioResponse {
  accounts: AccountSummary[];
  cached: boolean;
  cacheAge?: number;
  totalAccounts: number;
  excludedAccounts?: number;
}

/**
 * Fetch the portfolio of customer accounts.
 * Returns lightweight summaries optimized for list views.
 */
export async function fetchPortfolio(): Promise<PortfolioResponse> {
  const response = await fetch(`${API_BASE}/portfolio`, {
    method: 'GET',
    headers: createHeaders(),
  });
  
  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(error.error || `API Error: ${response.status}`);
  }
  
  return response.json();
}

// ============================================================================
// Account Detail API
// ============================================================================

/**
 * Fetch full account details for the Account 360 view.
 */
export async function fetchAccountDetail(accountId: string): Promise<AccountDetail> {
  const response = await fetch(`${API_BASE}/accounts/${encodeURIComponent(accountId)}`, {
    method: 'GET',
    headers: createHeaders(),
  });
  
  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(error.error || `API Error: ${response.status}`);
  }
  
  return response.json();
}

// ============================================================================
// Alert API
// ============================================================================

export interface AlertsResponse {
  alerts: Alert[];
  totalCount: number;
  criticalCount: number;
  highCount: number;
}

/**
 * Fetch all open alerts across accounts.
 * Optionally filter by severity, status, or owner.
 */
export async function fetchAlerts(options?: {
  severity?: 'critical' | 'high' | 'medium' | 'low';
  status?: 'open' | 'acknowledged' | 'in_progress';
  ownerId?: string;
  accountId?: string;
  limit?: number;
}): Promise<AlertsResponse> {
  const params = new URLSearchParams();
  if (options?.severity) params.append('severity', options.severity);
  if (options?.status) params.append('status', options.status);
  if (options?.ownerId) params.append('ownerId', options.ownerId);
  if (options?.accountId) params.append('accountId', options.accountId);
  if (options?.limit) params.append('limit', options.limit.toString());
  
  const url = `${API_BASE}/alerts${params.toString() ? `?${params}` : ''}`;
  
  const response = await fetch(url, {
    method: 'GET',
    headers: createHeaders(),
  });
  
  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(error.error || `API Error: ${response.status}`);
  }
  
  return response.json();
}

// ============================================================================
// Fallback to Legacy API
// ============================================================================

/**
 * Check if the new API is available.
 * Falls back to legacy client-side computation if not.
 */
export async function checkApiHealth(): Promise<boolean> {
  try {
    const response = await fetch(`${API_BASE}/portfolio`, {
      method: 'HEAD',
      headers: createHeaders(),
    });
    return response.ok;
  } catch {
    return false;
  }
}

// ============================================================================
// React Query Hooks Configuration
// ============================================================================

/**
 * Query keys for React Query cache management.
 */
export const queryKeys = {
  portfolio: ['cs', 'portfolio'] as const,
  accountDetail: (id: string) => ['cs', 'account', id] as const,
  alerts: (filters?: Record<string, unknown>) => ['cs', 'alerts', filters] as const,
  alertsByAccount: (accountId: string) => ['cs', 'alerts', { accountId }] as const,
};

/**
 * Default query options for CS API calls.
 */
export const defaultQueryOptions = {
  staleTime: 2 * 60 * 1000,      // 2 minutes
  gcTime: 10 * 60 * 1000,        // 10 minutes (formerly cacheTime)
  retry: 2,
  refetchOnWindowFocus: true,
};
