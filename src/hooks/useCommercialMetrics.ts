/**
 * Commercial Metrics Hook
 * 
 * Fetches billing/commercial data from Stripe via the CS API.
 * Falls back to account.commercial if API fails.
 */

import { useQuery } from '@tanstack/react-query';
import { defaultQueryOptions } from '../lib/api/cs-api';
import type { CommercialMetrics } from '../lib/types/account';

// ============================================================================
// Stripe Commercial Data Types
// ============================================================================

export interface StripeInvoice {
  id: string;
  number: string;
  status: 'draft' | 'open' | 'paid' | 'uncollectible' | 'void';
  amountDue: number;
  amountPaid: number;
  currency: string;
  dueDate?: string;
  createdAt: string;
  paidAt?: string;
  hostedInvoiceUrl?: string;
  isOverdue: boolean;
}

export interface StripeSubscription {
  id: string;
  status: 'active' | 'past_due' | 'canceled' | 'unpaid' | 'trialing' | 'incomplete' | 'incomplete_expired' | 'paused';
  planName: string;
  billingInterval: 'month' | 'year' | 'week' | 'day';
  currentPeriodStart: string;
  currentPeriodEnd: string;
  cancelAtPeriodEnd: boolean;
  cancelAt?: string;
  trialEnd?: string;
}

export interface CommercialData extends CommercialMetrics {
  // Enhanced Stripe data
  subscription?: StripeSubscription;
  recentInvoices: StripeInvoice[];
  
  // Computed fields
  isOverdue: boolean;
  overdueCount: number;
  totalOverdueAmount: number;
  daysToCurrentPeriodEnd: number;
  
  // Data source info
  source: 'stripe' | 'hubspot' | 'account' | 'mock';
  fetchedAt: string;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Generate mock commercial data for development/fallback.
 */
function generateMockCommercialData(accountCommercial?: CommercialMetrics): CommercialData {
  const now = new Date();
  const periodEnd = new Date(now);
  periodEnd.setMonth(periodEnd.getMonth() + 1);
  
  const daysToEnd = Math.ceil((periodEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  
  // Generate mock invoices
  const mockInvoices: StripeInvoice[] = [];
  for (let i = 0; i < 5; i++) {
    const invoiceDate = new Date(now);
    invoiceDate.setMonth(invoiceDate.getMonth() - i);
    
    mockInvoices.push({
      id: `inv_mock_${i}`,
      number: `INV-${2026 - Math.floor(i / 12)}-${String(12 - (i % 12)).padStart(2, '0')}-${String(1000 + i).slice(1)}`,
      status: i === 0 ? 'open' : 'paid',
      amountDue: accountCommercial?.mrr || 500,
      amountPaid: i === 0 ? 0 : (accountCommercial?.mrr || 500),
      currency: accountCommercial?.currency || 'USD',
      dueDate: invoiceDate.toISOString(),
      createdAt: invoiceDate.toISOString(),
      paidAt: i === 0 ? undefined : invoiceDate.toISOString(),
      isOverdue: false,
    });
  }
  
  return {
    // Base commercial metrics
    plan: accountCommercial?.plan || 'Growth',
    arr: accountCommercial?.arr || 6000,
    mrr: accountCommercial?.mrr || 500,
    currency: accountCommercial?.currency || 'USD',
    
    // Contract info
    contractStartDate: accountCommercial?.contractStartDate,
    contractEndDate: accountCommercial?.contractEndDate || periodEnd.toISOString(),
    renewalDate: accountCommercial?.renewalDate || periodEnd.toISOString(),
    daysToRenewal: accountCommercial?.daysToRenewal ?? daysToEnd,
    termMonths: accountCommercial?.termMonths || 12,
    autoRenew: accountCommercial?.autoRenew ?? true,
    
    // Seat usage
    seatLimit: accountCommercial?.seatLimit || 10,
    seatUsage: accountCommercial?.seatUsage || 7,
    seatUtilization: accountCommercial?.seatUtilization || 70,
    
    // Payment status
    paymentStatus: accountCommercial?.paymentStatus || 'current',
    lastPaymentDate: accountCommercial?.lastPaymentDate,
    overdueAmount: accountCommercial?.overdueAmount || 0,
    
    // Expansion
    expansionSignals: accountCommercial?.expansionSignals || [],
    expansionPotential: accountCommercial?.expansionPotential || 'medium',
    openOpportunities: accountCommercial?.openOpportunities,
    
    // Enhanced Stripe data
    subscription: {
      id: 'sub_mock',
      status: 'active',
      planName: accountCommercial?.plan || 'Growth',
      billingInterval: 'month',
      currentPeriodStart: now.toISOString(),
      currentPeriodEnd: periodEnd.toISOString(),
      cancelAtPeriodEnd: false,
    },
    recentInvoices: mockInvoices,
    
    // Computed
    isOverdue: false,
    overdueCount: 0,
    totalOverdueAmount: 0,
    daysToCurrentPeriodEnd: daysToEnd,
    
    // Source info
    source: 'mock',
    fetchedAt: now.toISOString(),
  };
}

// ============================================================================
// React Query Hook
// ============================================================================

/**
 * Query key for commercial metrics.
 */
export const commercialQueryKey = (accountId: string) => ['cs', 'commercial', accountId] as const;

/**
 * Hook to fetch commercial/billing metrics for an account.
 * 
 * Uses the commercial data already fetched by the account detail API.
 * The account detail endpoint enriches with Stripe data server-side.
 * 
 * @param accountId - The account ID
 * @param email - Primary contact email (not used directly, kept for API compatibility)
 * @param accountCommercial - Commercial data from the account detail response
 */
export function useCommercialMetrics(
  accountId: string | undefined,
  email: string | undefined,
  accountCommercial?: CommercialMetrics
) {
  return useQuery({
    queryKey: commercialQueryKey(accountId || ''),
    queryFn: async (): Promise<CommercialData> => {
      // Use the commercial data from the account detail API
      // This data is already enriched with Stripe data server-side
      if (accountCommercial) {
        return transformToCommercialData(accountCommercial);
      }
      
      // Fallback to minimal data if no commercial data available
      return generateMockCommercialData(undefined);
    },
    ...defaultQueryOptions,
    enabled: !!accountId,
    staleTime: 5 * 60 * 1000, // 5 minutes for billing data
  });
}

/**
 * Transform CommercialMetrics from the account API to CommercialData format.
 */
function transformToCommercialData(commercial: CommercialMetrics): CommercialData {
  const now = new Date();
  
  // Calculate days to period end from renewal date
  const daysToEnd = commercial.renewalDate
    ? Math.ceil((new Date(commercial.renewalDate).getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
    : 30;
  
  return {
    // Base commercial metrics (pass through)
    plan: commercial.plan,
    arr: commercial.arr,
    mrr: commercial.mrr,
    currency: commercial.currency,
    contractStartDate: commercial.contractStartDate,
    contractEndDate: commercial.contractEndDate,
    renewalDate: commercial.renewalDate,
    daysToRenewal: commercial.daysToRenewal,
    termMonths: commercial.termMonths,
    autoRenew: commercial.autoRenew,
    seatLimit: commercial.seatLimit,
    seatUsage: commercial.seatUsage,
    seatUtilization: commercial.seatUtilization,
    paymentStatus: commercial.paymentStatus,
    lastPaymentDate: commercial.lastPaymentDate,
    overdueAmount: commercial.overdueAmount,
    expansionSignals: commercial.expansionSignals || [],
    expansionPotential: commercial.expansionPotential,
    openOpportunities: commercial.openOpportunities,
    
    // Build subscription info from available data
    subscription: commercial.plan ? {
      id: 'sub_from_account',
      status: mapPaymentStatusToSubscriptionStatus(commercial.paymentStatus),
      planName: commercial.plan,
      billingInterval: commercial.termMonths && commercial.termMonths >= 12 ? 'year' : 'month',
      currentPeriodStart: commercial.contractStartDate || now.toISOString(),
      currentPeriodEnd: commercial.renewalDate || commercial.contractEndDate || now.toISOString(),
      cancelAtPeriodEnd: commercial.autoRenew === false,
    } : undefined,
    
    // Invoice data not available from account API
    recentInvoices: [],
    
    // Computed fields
    isOverdue: commercial.paymentStatus === 'overdue',
    overdueCount: commercial.overdueAmount && commercial.overdueAmount > 0 ? 1 : 0,
    totalOverdueAmount: commercial.overdueAmount || 0,
    daysToCurrentPeriodEnd: daysToEnd,
    
    // Source info
    source: commercial.source || (commercial.arr || commercial.mrr ? 'stripe' : 'account'),
    fetchedAt: now.toISOString(),
  };
}

/**
 * Map payment status to Stripe subscription status.
 */
function mapPaymentStatusToSubscriptionStatus(
  paymentStatus?: 'current' | 'overdue' | 'at_risk' | 'churned' | 'unknown'
): StripeSubscription['status'] {
  switch (paymentStatus) {
    case 'current':
      return 'active';
    case 'overdue':
      return 'past_due';
    case 'at_risk':
      return 'past_due';
    case 'churned':
      return 'canceled';
    default:
      return 'active';
  }
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Format currency amount with proper symbol and formatting.
 */
export function formatCurrency(amount: number, currency: string = 'USD'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency.toUpperCase(),
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

/**
 * Format currency with decimals for invoice amounts.
 */
export function formatCurrencyPrecise(amount: number, currency: string = 'USD'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency.toUpperCase(),
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

/**
 * Get subscription status display info.
 */
export function getSubscriptionStatusInfo(status: StripeSubscription['status']): {
  label: string;
  color: 'success' | 'warning' | 'danger' | 'info' | 'muted';
  icon: string;
} {
  const statusMap: Record<StripeSubscription['status'], { label: string; color: 'success' | 'warning' | 'danger' | 'info' | 'muted'; icon: string }> = {
    active: { label: 'Active', color: 'success', icon: '✓' },
    trialing: { label: 'Trialing', color: 'info', icon: '🧪' },
    past_due: { label: 'Past Due', color: 'danger', icon: '⚠️' },
    canceled: { label: 'Canceled', color: 'muted', icon: '✕' },
    unpaid: { label: 'Unpaid', color: 'danger', icon: '💰' },
    incomplete: { label: 'Incomplete', color: 'warning', icon: '⏳' },
    incomplete_expired: { label: 'Expired', color: 'danger', icon: '⌛' },
    paused: { label: 'Paused', color: 'muted', icon: '⏸️' },
  };
  
  return statusMap[status] || { label: status, color: 'muted', icon: '?' };
}

/**
 * Get invoice status display info.
 */
export function getInvoiceStatusInfo(status: StripeInvoice['status'], isOverdue: boolean): {
  label: string;
  color: 'success' | 'warning' | 'danger' | 'info' | 'muted';
} {
  if (isOverdue && status === 'open') {
    return { label: 'Overdue', color: 'danger' };
  }
  
  const statusMap: Record<StripeInvoice['status'], { label: string; color: 'success' | 'warning' | 'danger' | 'info' | 'muted' }> = {
    paid: { label: 'Paid', color: 'success' },
    open: { label: 'Open', color: 'warning' },
    draft: { label: 'Draft', color: 'muted' },
    uncollectible: { label: 'Uncollectible', color: 'danger' },
    void: { label: 'Void', color: 'muted' },
  };
  
  return statusMap[status] || { label: status, color: 'muted' };
}

/**
 * Calculate days until a date.
 */
export function daysUntil(dateString: string): number {
  const target = new Date(dateString);
  const now = new Date();
  return Math.ceil((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}
