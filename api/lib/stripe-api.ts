/**
 * Stripe API Client for Server-Side Use
 * 
 * Provides functions to fetch customer data, subscription details, and
 * calculate ARR/MRR from Stripe subscription data.
 * 
 * Uses STRIPE_API_KEY environment variable for authentication.
 */

const STRIPE_BASE_URL = 'https://api.stripe.com/v1';

// ============================================================================
// Types
// ============================================================================

export interface StripeCustomer {
  id: string;
  email: string | null;
  name: string | null;
  created: number;
  currency: string | null;
  delinquent: boolean;
  metadata: Record<string, string>;
}

export interface StripeSubscription {
  id: string;
  customer: string;
  status: StripeSubscriptionStatus;
  current_period_start: number;
  current_period_end: number;
  cancel_at_period_end: boolean;
  canceled_at: number | null;
  ended_at: number | null;
  trial_start: number | null;
  trial_end: number | null;
  items: {
    data: StripeSubscriptionItem[];
  };
  plan?: StripePlan;
  default_payment_method: string | null;
  latest_invoice: string | null;
  metadata: Record<string, string>;
}

export type StripeSubscriptionStatus = 
  | 'active'
  | 'past_due'
  | 'unpaid'
  | 'canceled'
  | 'incomplete'
  | 'incomplete_expired'
  | 'trialing'
  | 'paused';

export interface StripeSubscriptionItem {
  id: string;
  price: StripePrice;
  quantity: number;
}

export interface StripePrice {
  id: string;
  product: string;
  unit_amount: number | null;
  currency: string;
  recurring: {
    interval: 'day' | 'week' | 'month' | 'year';
    interval_count: number;
  } | null;
  nickname: string | null;
  type: 'one_time' | 'recurring';
}

export interface StripePlan {
  id: string;
  amount: number | null;
  currency: string;
  interval: 'day' | 'week' | 'month' | 'year';
  interval_count: number;
  product: string;
  nickname: string | null;
}

export interface StripeInvoice {
  id: string;
  customer: string;
  status: 'draft' | 'open' | 'paid' | 'uncollectible' | 'void';
  amount_due: number;
  amount_paid: number;
  amount_remaining: number;
  currency: string;
  created: number;
  due_date: number | null;
  paid: boolean;
  period_start: number;
  period_end: number;
}

export interface StripeListResponse<T> {
  object: 'list';
  data: T[];
  has_more: boolean;
  url: string;
}

// ============================================================================
// Enriched Types for Commercial Metrics
// ============================================================================

export interface StripeCustomerData {
  customer: StripeCustomer | null;
  subscriptions: StripeSubscription[];
  latestInvoice: StripeInvoice | null;
}

export interface StripeEnrichedMetrics {
  found: boolean;
  customerId?: string;
  plan?: string;
  arr?: number;
  mrr?: number;
  currency: string;
  contractEndDate?: string;
  renewalDate?: string;
  daysToRenewal?: number;
  termMonths?: number;
  autoRenew?: boolean;
  paymentStatus: 'current' | 'overdue' | 'at_risk' | 'churned' | 'unknown';
  subscriptionStatus?: StripeSubscriptionStatus;
  lastPaymentDate?: string;
  overdueAmount?: number;
}

// ============================================================================
// API Functions
// ============================================================================

/**
 * Create headers for Stripe API calls
 */
function createHeaders(apiKey: string): HeadersInit {
  return {
    'Authorization': `Bearer ${apiKey}`,
    'Content-Type': 'application/x-www-form-urlencoded',
  };
}

/**
 * Make a GET request to the Stripe API
 */
async function stripeGet<T>(
  endpoint: string,
  apiKey: string,
  params?: Record<string, string>
): Promise<T> {
  const url = new URL(`${STRIPE_BASE_URL}${endpoint}`);
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      url.searchParams.append(key, value);
    });
  }

  const response = await fetch(url.toString(), {
    method: 'GET',
    headers: createHeaders(apiKey),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Stripe API Error: ${response.status} ${response.statusText} - ${errorBody}`);
  }

  return response.json();
}

/**
 * Fetch a Stripe customer by email
 */
export async function fetchCustomerByEmail(
  email: string,
  apiKey: string
): Promise<StripeCustomer | null> {
  try {
    console.log('[Stripe API] Searching for customer by email:', email);
    const result = await stripeGet<StripeListResponse<StripeCustomer>>(
      '/customers',
      apiKey,
      { email, limit: '1' }
    );
    console.log('[Stripe API] Email search result:', {
      email,
      found: result.data.length > 0,
      customerId: result.data[0]?.id,
      customerName: result.data[0]?.name,
    });
    return result.data.length > 0 ? result.data[0] : null;
  } catch (error) {
    console.error('[Stripe API] Failed to fetch Stripe customer by email:', error);
    return null;
  }
}

/**
 * Fetch a Stripe customer by ID
 */
export async function fetchCustomerById(
  customerId: string,
  apiKey: string
): Promise<StripeCustomer | null> {
  try {
    const customer = await stripeGet<StripeCustomer>(
      `/customers/${customerId}`,
      apiKey
    );
    return customer;
  } catch (error) {
    console.error('Failed to fetch Stripe customer by ID:', error);
    return null;
  }
}

/**
 * Fetch subscriptions for a customer
 */
export async function fetchSubscriptions(
  customerId: string,
  apiKey: string
): Promise<StripeSubscription[]> {
  try {
    const result = await stripeGet<StripeListResponse<StripeSubscription>>(
      '/subscriptions',
      apiKey,
      { customer: customerId, limit: '10', status: 'all' }
    );
    return result.data;
  } catch (error) {
    console.error('Failed to fetch Stripe subscriptions:', error);
    return [];
  }
}

/**
 * Fetch recent invoices for a customer
 */
export async function fetchInvoices(
  customerId: string,
  apiKey: string,
  limit: number = 5
): Promise<StripeInvoice[]> {
  try {
    const result = await stripeGet<StripeListResponse<StripeInvoice>>(
      '/invoices',
      apiKey,
      { customer: customerId, limit: limit.toString() }
    );
    return result.data;
  } catch (error) {
    console.error('Failed to fetch Stripe invoices:', error);
    return [];
  }
}

/**
 * Fetch full Stripe customer data including subscriptions and latest invoice
 */
export async function fetchStripeCustomerData(
  identifier: { email?: string; customerId?: string },
  apiKey: string
): Promise<StripeCustomerData> {
  // First, find the customer
  let customer: StripeCustomer | null = null;
  
  if (identifier.customerId) {
    customer = await fetchCustomerById(identifier.customerId, apiKey);
  }
  
  if (!customer && identifier.email) {
    customer = await fetchCustomerByEmail(identifier.email, apiKey);
  }
  
  if (!customer) {
    return {
      customer: null,
      subscriptions: [],
      latestInvoice: null,
    };
  }
  
  // Fetch subscriptions and invoices in parallel
  const [subscriptions, invoices] = await Promise.all([
    fetchSubscriptions(customer.id, apiKey),
    fetchInvoices(customer.id, apiKey, 1),
  ]);
  
  return {
    customer,
    subscriptions,
    latestInvoice: invoices.length > 0 ? invoices[0] : null,
  };
}

// ============================================================================
// ARR/MRR Calculation
// ============================================================================

/**
 * Calculate monthly amount from a subscription item
 */
function calculateMonthlyAmount(item: StripeSubscriptionItem): number {
  const price = item.price;
  if (!price.recurring || !price.unit_amount) return 0;
  
  const quantity = item.quantity || 1;
  const baseAmount = (price.unit_amount / 100) * quantity;
  
  // Convert to monthly based on interval
  switch (price.recurring.interval) {
    case 'day':
      return baseAmount * 30 / price.recurring.interval_count;
    case 'week':
      return baseAmount * (52 / 12) / price.recurring.interval_count;
    case 'month':
      return baseAmount / price.recurring.interval_count;
    case 'year':
      return baseAmount / (12 * price.recurring.interval_count);
    default:
      return 0;
  }
}

/**
 * Calculate term in months from a subscription interval
 */
function calculateTermMonths(subscription: StripeSubscription): number {
  // Use plan interval if available
  if (subscription.plan) {
    const multiplier = subscription.plan.interval_count || 1;
    switch (subscription.plan.interval) {
      case 'day': return 1;
      case 'week': return 1;
      case 'month': return multiplier;
      case 'year': return multiplier * 12;
      default: return 1;
    }
  }
  
  // Fallback to first subscription item
  if (subscription.items.data.length > 0) {
    const price = subscription.items.data[0].price;
    if (price.recurring) {
      const multiplier = price.recurring.interval_count || 1;
      switch (price.recurring.interval) {
        case 'day': return 1;
        case 'week': return 1;
        case 'month': return multiplier;
        case 'year': return multiplier * 12;
        default: return 1;
      }
    }
  }
  
  return 1;
}

/**
 * Calculate ARR and MRR from subscriptions
 * Returns amounts in the subscription's currency (cents converted to dollars)
 */
export function calculateArrMrr(subscriptions: StripeSubscription[]): {
  mrr: number;
  arr: number;
  currency: string;
} {
  // Filter to active subscriptions only
  const activeSubscriptions = subscriptions.filter(
    sub => sub.status === 'active' || sub.status === 'trialing'
  );
  
  if (activeSubscriptions.length === 0) {
    return { mrr: 0, arr: 0, currency: 'usd' };
  }
  
  let totalMrr = 0;
  let currency = 'usd';
  
  for (const subscription of activeSubscriptions) {
    for (const item of subscription.items.data) {
      totalMrr += calculateMonthlyAmount(item);
      currency = item.price.currency;
    }
  }
  
  return {
    mrr: Math.round(totalMrr * 100) / 100,
    arr: Math.round(totalMrr * 12 * 100) / 100,
    currency: currency.toUpperCase(),
  };
}

// ============================================================================
// Payment Status Mapping
// ============================================================================

/**
 * Map Stripe subscription status to our PaymentStatus type
 */
export function mapPaymentStatus(
  subscriptions: StripeSubscription[],
  customer: StripeCustomer | null
): 'current' | 'overdue' | 'at_risk' | 'churned' | 'unknown' {
  if (!customer || subscriptions.length === 0) {
    return 'unknown';
  }
  
  // Check if customer is delinquent
  if (customer.delinquent) {
    return 'overdue';
  }
  
  // Get the most recent active subscription
  const activeSubscription = subscriptions.find(
    sub => sub.status === 'active' || sub.status === 'trialing'
  );
  
  if (!activeSubscription) {
    // Check for canceled subscriptions
    const canceledSubscription = subscriptions.find(sub => sub.status === 'canceled');
    if (canceledSubscription) {
      return 'churned';
    }
    
    // Check for past_due or unpaid
    const problemSubscription = subscriptions.find(
      sub => sub.status === 'past_due' || sub.status === 'unpaid'
    );
    if (problemSubscription) {
      return problemSubscription.status === 'past_due' ? 'overdue' : 'at_risk';
    }
    
    return 'unknown';
  }
  
  // Check if subscription is about to cancel
  if (activeSubscription.cancel_at_period_end) {
    return 'at_risk';
  }
  
  return 'current';
}

// ============================================================================
// Main Enrichment Function
// ============================================================================

/**
 * Fetch Stripe data and calculate enriched commercial metrics
 * 
 * @param identifier - Either an email or a Stripe customer ID to look up
 * @param apiKey - Stripe API key (defaults to STRIPE_API_KEY env var)
 * @returns Enriched metrics ready to merge into CommercialMetrics
 */
export async function getStripeEnrichedMetrics(
  identifier: { email?: string; customerId?: string },
  apiKey?: string
): Promise<StripeEnrichedMetrics> {
  const key = apiKey || process.env.STRIPE_API_KEY;
  
  if (!key) {
    console.warn('Stripe API key not configured');
    return {
      found: false,
      currency: 'USD',
      paymentStatus: 'unknown',
    };
  }
  
  if (!identifier.email && !identifier.customerId) {
    return {
      found: false,
      currency: 'USD',
      paymentStatus: 'unknown',
    };
  }
  
  try {
    const customerData = await fetchStripeCustomerData(identifier, key);
    
    if (!customerData.customer) {
      return {
        found: false,
        currency: 'USD',
        paymentStatus: 'unknown',
      };
    }
    
    const { customer, subscriptions, latestInvoice } = customerData;
    
    // Calculate ARR/MRR
    const { mrr, arr, currency } = calculateArrMrr(subscriptions);
    
    // Get active subscription for dates
    const activeSubscription = subscriptions.find(
      sub => sub.status === 'active' || sub.status === 'trialing'
    );
    
    // Calculate renewal info
    let renewalDate: string | undefined;
    let contractEndDate: string | undefined;
    let daysToRenewal: number | undefined;
    let termMonths: number | undefined;
    let autoRenew: boolean | undefined;
    let plan: string | undefined;
    
    if (activeSubscription) {
      const periodEnd = activeSubscription.current_period_end * 1000;
      renewalDate = new Date(periodEnd).toISOString();
      contractEndDate = renewalDate;
      
      const now = Date.now();
      daysToRenewal = Math.max(0, Math.ceil((periodEnd - now) / (1000 * 60 * 60 * 24)));
      
      termMonths = calculateTermMonths(activeSubscription);
      autoRenew = !activeSubscription.cancel_at_period_end;
      
      // Get plan name
      plan = activeSubscription.plan?.nickname || 
             activeSubscription.items.data[0]?.price.nickname ||
             'Subscription';
    }
    
    // Calculate payment status
    const paymentStatus = mapPaymentStatus(subscriptions, customer);
    
    // Get last payment date from invoice
    let lastPaymentDate: string | undefined;
    let overdueAmount: number | undefined;
    
    if (latestInvoice) {
      if (latestInvoice.paid) {
        lastPaymentDate = new Date(latestInvoice.created * 1000).toISOString();
      }
      if (latestInvoice.amount_remaining > 0 && latestInvoice.status === 'open') {
        overdueAmount = latestInvoice.amount_remaining / 100;
      }
    }
    
    return {
      found: true,
      customerId: customer.id,
      plan,
      arr: arr > 0 ? arr : undefined,
      mrr: mrr > 0 ? mrr : undefined,
      currency,
      contractEndDate,
      renewalDate,
      daysToRenewal,
      termMonths,
      autoRenew,
      paymentStatus,
      subscriptionStatus: activeSubscription?.status,
      lastPaymentDate,
      overdueAmount,
    };
  } catch (error) {
    console.error('Failed to fetch Stripe enriched metrics:', error);
    return {
      found: false,
      currency: 'USD',
      paymentStatus: 'unknown',
    };
  }
}
