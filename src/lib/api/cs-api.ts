/**
 * Customer Success API Client
 * 
 * Client-side API for consuming the CS dashboard endpoints.
 * Uses the new server-side API for better performance.
 */

import type { AccountSummary, AccountDetail, Alert, Interaction, InteractionType, InteractionChannel } from '../types/account';

// API base URL - uses relative path in production, configurable in dev
const API_BASE = '/api/cs';

// Get API key from environment or localStorage
const getApiKey = () => {
  return import.meta.env.VITE_ARDA_API_KEY || localStorage.getItem('arda_api_key') || '';
};

// Common headers for API requests
const createHeaders = (): HeadersInit => ({
  'Content-Type': 'application/json',
  'x-arda-api-key': getApiKey(),
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
  stripeEnriched?: boolean;
  stripeAccountsEnriched?: number;
}

/**
 * Fetch the portfolio of customer accounts.
 * Returns lightweight summaries optimized for list views.
 * 
 * @param includeStripe - Whether to enrich with Stripe commercial data (default: true)
 */
export async function fetchPortfolio(includeStripe: boolean = true): Promise<PortfolioResponse> {
  const params = new URLSearchParams();
  if (includeStripe) {
    params.append('includeStripe', 'true');
  }
  
  const url = `${API_BASE}/portfolio${params.toString() ? `?${params}` : ''}`;
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

export interface AlertWithAccount extends Alert {
  accountName: string;
}

export interface AlertsResponse {
  alerts: AlertWithAccount[];
  totalCount: number;
  criticalCount: number;
  highCount: number;
  mediumCount?: number;
  lowCount?: number;
}

export interface AlertNotePayload {
  content: string;
  createdBy: string;
}

/**
 * Update a single alert (status, notes, ownership, etc.).
 */
export interface AlertUpdatePayload extends Partial<Alert> {
  actionLogEntry?: any; // server validates
}

export async function updateAlert(alertId: string, update: AlertUpdatePayload): Promise<void> {
  const response = await fetch(`${API_BASE}/alerts?alertId=${encodeURIComponent(alertId)}`, {
    method: 'PATCH',
    headers: createHeaders(),
    body: JSON.stringify(update),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(error.error || `API Error: ${response.status}`);
  }
}

export async function addAlertNote(alertId: string, note: AlertNotePayload): Promise<void> {
  const response = await fetch(`${API_BASE}/alerts?alertId=${encodeURIComponent(alertId)}`, {
    method: 'PATCH',
    headers: createHeaders(),
    body: JSON.stringify({ note }),
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(error.error || `API Error: ${response.status}`);
  }
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
// Interactions API
// ============================================================================

export interface InteractionsResponse {
  interactions: Interaction[];
  total: number;
  synced: boolean;
}

export interface CreateInteractionRequest {
  type: InteractionType;
  channel?: InteractionChannel;
  subject?: string;
  summary: string;
  sentiment?: 'positive' | 'neutral' | 'negative';
  nextAction?: string;
  nextActionDate?: string;
  occurredAt?: string;
  createdByName?: string;
}

export interface CreateInteractionResponse {
  interaction: Interaction;
  synced: boolean;
}

/**
 * Fetch all interactions/notes for an account.
 * Reads from Coda CS Interactions table.
 */
export async function fetchAccountInteractions(accountId: string): Promise<InteractionsResponse> {
  const response = await fetch(`${API_BASE}/accounts/${encodeURIComponent(accountId)}/notes`, {
    method: 'GET',
    headers: createHeaders(),
  });
  
  if (!response.ok) {
    // Return empty array on error for graceful degradation
    console.error('Failed to fetch interactions:', response.status);
    return {
      interactions: [],
      total: 0,
      synced: false,
    };
  }
  
  return response.json();
}

/**
 * Create a new interaction/note for an account.
 * Persists to Coda CS Interactions table.
 */
export async function createAccountInteraction(
  accountId: string,
  interaction: CreateInteractionRequest
): Promise<CreateInteractionResponse> {
  const response = await fetch(`${API_BASE}/accounts/${encodeURIComponent(accountId)}/notes`, {
    method: 'POST',
    headers: createHeaders(),
    body: JSON.stringify(interaction),
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

function extractStatus(error: unknown): number | undefined {
  if (typeof (error as { status?: number })?.status === 'number') {
    return (error as { status: number }).status;
  }
  if (error instanceof Error) {
    const match = error.message.match(/API Error:\s*(\d+)/);
    if (match) return Number(match[1]);
  }
  return undefined;
}

/**
 * Default query options for CS API calls.
 */
export const defaultQueryOptions = {
  staleTime: 2 * 60 * 1000,      // 2 minutes
  gcTime: 10 * 60 * 1000,        // 10 minutes (formerly cacheTime)
  retry: (failureCount: number, error: unknown) => {
    const status = extractStatus(error);
    if (status && status >= 400 && status < 500) return false;
    return failureCount < 3;
  },
  retryDelay: (attemptIndex: number) => Math.min(1000 * 2 ** attemptIndex, 30000),
  refetchOnWindowFocus: true,
};
