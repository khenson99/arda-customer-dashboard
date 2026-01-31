/**
 * Stripe API Client for Commercial Metrics
 * 
 * Uses Stripe REST API directly (not SDK) for serverless compatibility.
 * Fetches customer data, subscriptions, and invoices to calculate ARR/MRR
 * and payment status for customer success dashboards.
 */

const STRIPE_BASE_URL = 'https://api.stripe.com/v1';

// ============================================================================
// Types
// ============================================================================

export interface StripeCustomerData {
  customerId: string;
  email: string;
  name?: string;
  currency: string;
  balance: number;  // In cents
  delinquent: boolean;
  created: number;  // Unix timestamp
}

export interface StripeSubscription {
  id: string;
  customerId: string;
  status: 'active' | 'past_due' | 'canceled' | 'unpaid' | 'trialing' | 'incomplete';
  plan: {
    id: string;
    name: string;
    amount: number;  // In cents
    interval: 'month' | 'year';
    currency: string;
  };
  currentPeriodStart: number;
  currentPeriodEnd: number;
  cancelAtPeriodEnd: boolean;
  created: number;
}

export interface StripeInvoice {
  id: string;
  customerId: string;
  status: 'draft' | 'open' | 'paid' | 'void' | 'uncollectible';
  amountDue: number;
  amountPaid: number;
  currency: string;
  dueDate: number | null;
  created: number;
}

export type PaymentStatus = 'current' | 'overdue' | 'at_risk' | 'churned' | 'unknown';

export interface CommercialMetricsFromStripe {
  customerId?: string;
  arr?: number;  // Annual Recurring Revenue
  mrr?: number;  // Monthly Recurring Revenue
  plan?: string;
  paymentStatus: PaymentStatus;
  subscriptionStatus?: string;
  currentPeriodEnd?: number;  // Renewal date
  daysToRenewal?: number;
  lastPaymentDate?: number;
  overdueAmount?: number;
  currency: string;
}

// ============================================================================
// Raw Stripe API Response Types
// ============================================================================

interface RawStripeCustomer {
  id: string;
  email: string | null;
  name: string | null;
  currency: string | null;
  balance: number;
  delinquent: boolean;
  created: number;
}

interface RawStripeSubscription {
  id: string;
  customer: string;
  status: string;
  current_period_start: number;
  current_period_end: number;
  cancel_at_period_end: boolean;
  created: number;
  items: {
    data: Array<{
      id: string;
      price: {
        id: string;
        nickname: string | null;
        unit_amount: number | null;
        currency: string;
        recurring: {
          interval: string;
          interval_count: number;
        } | null;
      };
      quantity: number;
    }>;
  };
  plan?: {
    id: string;
    nickname: string | null;
    amount: number | null;
    currency: string;
    interval: string;
    interval_count: number;
  };
}

interface RawStripeInvoice {
  id: string;
  customer: string;
  status: string;
  amount_due: number;
  amount_paid: number;
  currency: string;
  due_date: number | null;
  created: number;
}

interface StripeListResponse<T> {
  object: 'list';
  data: T[];
  has_more: boolean;
}

// ============================================================================
// API Key Management
// ============================================================================

/**
 * Get Stripe API key from environment.
 * Returns empty string if not configured.
 */
export function getStripeApiKey(): string {
  return process.env.STRIPE_API_KEY || process.env.STRIPE_SECRET_KEY || '';
}

/**
 * Check if Stripe API is configured
 */
function isStripeConfigured(): boolean {
  return getStripeApiKey().length > 0;
}

// ============================================================================
// HTTP Helpers
// ============================================================================

/**
 * Create headers for Stripe API requests
 */
function createHeaders(apiKey: string): Record<string, string> {
  return {
    'Authorization': `Bearer ${apiKey}`,
    'Content-Type': 'application/x-www-form-urlencoded',
  };
}

/**
 * Make a GET request to Stripe API
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

  return response.json() as Promise<T>;
}

// ============================================================================
// Data Transformation
// ============================================================================

/**
 * Transform raw Stripe customer to our type
 */
function transformCustomer(raw: RawStripeCustomer): StripeCustomerData {
  return {
    customerId: raw.id,
    email: raw.email || '',
    name: raw.name || undefined,
    currency: (raw.currency || 'usd').toUpperCase(),
    balance: raw.balance,
    delinquent: raw.delinquent,
    created: raw.created,
  };
}

/**
 * Transform raw Stripe subscription to our type
 */
function transformSubscription(raw: RawStripeSubscription): StripeSubscription {
  // Get plan info from either the plan field or the first price item
  const planInfo = raw.plan || (raw.items.data[0]?.price ? {
    id: raw.items.data[0].price.id,
    nickname: raw.items.data[0].price.nickname,
    amount: (raw.items.data[0].price.unit_amount || 0) * (raw.items.data[0].quantity || 1),
    currency: raw.items.data[0].price.currency,
    interval: raw.items.data[0].price.recurring?.interval || 'month',
    interval_count: raw.items.data[0].price.recurring?.interval_count || 1,
  } : null);

  const interval = planInfo?.interval || 'month';
  const validInterval: 'month' | 'year' = interval === 'year' ? 'year' : 'month';

  // Normalize amount to monthly/yearly based on interval_count
  let amount = planInfo?.amount || 0;
  const intervalCount = planInfo?.interval_count || 1;
  if (intervalCount > 1 && validInterval === 'month') {
    // Convert to monthly amount
    amount = Math.round(amount / intervalCount);
  }

  // Validate subscription status
  const validStatuses = ['active', 'past_due', 'canceled', 'unpaid', 'trialing', 'incomplete'];
  const status = validStatuses.includes(raw.status) 
    ? raw.status as StripeSubscription['status']
    : 'incomplete';

  return {
    id: raw.id,
    customerId: typeof raw.customer === 'string' ? raw.customer : raw.customer,
    status,
    plan: {
      id: planInfo?.id || '',
      name: planInfo?.nickname || 'Subscription',
      amount,
      interval: validInterval,
      currency: (planInfo?.currency || 'usd').toUpperCase(),
    },
    currentPeriodStart: raw.current_period_start,
    currentPeriodEnd: raw.current_period_end,
    cancelAtPeriodEnd: raw.cancel_at_period_end,
    created: raw.created,
  };
}

/**
 * Transform raw Stripe invoice to our type
 */
function transformInvoice(raw: RawStripeInvoice): StripeInvoice {
  const validStatuses = ['draft', 'open', 'paid', 'void', 'uncollectible'];
  const status = validStatuses.includes(raw.status)
    ? raw.status as StripeInvoice['status']
    : 'draft';

  return {
    id: raw.id,
    customerId: typeof raw.customer === 'string' ? raw.customer : raw.customer,
    status,
    amountDue: raw.amount_due,
    amountPaid: raw.amount_paid,
    currency: (raw.currency || 'usd').toUpperCase(),
    dueDate: raw.due_date,
    created: raw.created,
  };
}

// ============================================================================
// API Functions
// ============================================================================

/**
 * Fetch Stripe customer by email (for matching with Arda tenants)
 */
export async function fetchStripeCustomerByEmail(email: string): Promise<StripeCustomerData | null> {
  const apiKey = getStripeApiKey();
  
  if (!apiKey) {
    console.warn('Stripe API key not configured');
    return null;
  }

  try {
    const result = await stripeGet<StripeListResponse<RawStripeCustomer>>(
      '/customers',
      apiKey,
      { email, limit: '1' }
    );

    if (result.data.length === 0) {
      return null;
    }

    return transformCustomer(result.data[0]);
  } catch (error) {
    console.error('Failed to fetch Stripe customer by email:', error);
    return null;
  }
}

/**
 * Fetch subscriptions for a customer
 */
export async function fetchStripeSubscriptions(customerId: string): Promise<StripeSubscription[]> {
  const apiKey = getStripeApiKey();
  
  if (!apiKey) {
    console.warn('Stripe API key not configured');
    return [];
  }

  try {
    const result = await stripeGet<StripeListResponse<RawStripeSubscription>>(
      '/subscriptions',
      apiKey,
      { 
        customer: customerId, 
        limit: '10',
        status: 'all',
        'expand[]': 'data.plan',
      }
    );

    return result.data.map(transformSubscription);
  } catch (error) {
    console.error('Failed to fetch Stripe subscriptions:', error);
    return [];
  }
}

/**
 * Fetch recent invoices for a customer
 */
export async function fetchStripeInvoices(
  customerId: string, 
  limit: number = 10
): Promise<StripeInvoice[]> {
  const apiKey = getStripeApiKey();
  
  if (!apiKey) {
    console.warn('Stripe API key not configured');
    return [];
  }

  try {
    const result = await stripeGet<StripeListResponse<RawStripeInvoice>>(
      '/invoices',
      apiKey,
      { 
        customer: customerId, 
        limit: limit.toString() 
      }
    );

    return result.data.map(transformInvoice);
  } catch (error) {
    console.error('Failed to fetch Stripe invoices:', error);
    return [];
  }
}

// ============================================================================
// Calculation Functions
// ============================================================================

/**
 * Calculate ARR (Annual Recurring Revenue) from subscriptions
 * Returns value in dollars (not cents)
 */
export function calculateARR(subscriptions: StripeSubscription[]): number {
  // Filter to active/trialing subscriptions only
  const activeSubscriptions = subscriptions.filter(
    sub => sub.status === 'active' || sub.status === 'trialing'
  );

  if (activeSubscriptions.length === 0) {
    return 0;
  }

  let totalARR = 0;

  for (const subscription of activeSubscriptions) {
    const { amount, interval } = subscription.plan;
    
    // Convert to annual amount (amount is in cents)
    const amountInDollars = amount / 100;
    
    if (interval === 'month') {
      totalARR += amountInDollars * 12;
    } else if (interval === 'year') {
      totalARR += amountInDollars;
    }
  }

  return Math.round(totalARR * 100) / 100;
}

/**
 * Calculate MRR (Monthly Recurring Revenue) from subscriptions
 * Returns value in dollars (not cents)
 */
export function calculateMRR(subscriptions: StripeSubscription[]): number {
  const arr = calculateARR(subscriptions);
  return Math.round((arr / 12) * 100) / 100;
}

/**
 * Determine payment status from customer and invoices
 */
export function determinePaymentStatus(
  customer: StripeCustomerData | null,
  invoices: StripeInvoice[],
  subscriptions?: StripeSubscription[]
): PaymentStatus {
  // No customer found
  if (!customer) {
    return 'unknown';
  }

  // Customer is marked as delinquent
  if (customer.delinquent) {
    return 'overdue';
  }

  // Check subscription statuses
  if (subscriptions && subscriptions.length > 0) {
    // Check for canceled subscriptions with no active ones
    const hasActive = subscriptions.some(
      sub => sub.status === 'active' || sub.status === 'trialing'
    );
    const hasCanceled = subscriptions.some(sub => sub.status === 'canceled');
    
    if (!hasActive && hasCanceled) {
      return 'churned';
    }

    // Check for past_due subscriptions
    const hasPastDue = subscriptions.some(sub => sub.status === 'past_due');
    if (hasPastDue) {
      return 'overdue';
    }

    // Check for unpaid subscriptions
    const hasUnpaid = subscriptions.some(sub => sub.status === 'unpaid');
    if (hasUnpaid) {
      return 'at_risk';
    }

    // Check if any subscription is set to cancel at period end
    const willCancel = subscriptions.some(
      sub => sub.cancelAtPeriodEnd && (sub.status === 'active' || sub.status === 'trialing')
    );
    if (willCancel) {
      return 'at_risk';
    }
  }

  // Check for open/overdue invoices
  if (invoices.length > 0) {
    const now = Math.floor(Date.now() / 1000);
    
    // Check for overdue invoices
    const overdueInvoice = invoices.find(
      inv => inv.status === 'open' && inv.dueDate && inv.dueDate < now
    );
    if (overdueInvoice) {
      return 'overdue';
    }

    // Check for open but not yet due invoices
    const openInvoice = invoices.find(inv => inv.status === 'open');
    if (openInvoice && openInvoice.amountDue > 0) {
      // If it's been open for more than 30 days, consider at risk
      const thirtyDaysAgo = now - (30 * 24 * 60 * 60);
      if (openInvoice.created < thirtyDaysAgo) {
        return 'at_risk';
      }
    }
  }

  // If we have active subscriptions and no issues, status is current
  if (subscriptions && subscriptions.some(sub => sub.status === 'active' || sub.status === 'trialing')) {
    return 'current';
  }

  return 'unknown';
}

// ============================================================================
// Main Aggregation Function
// ============================================================================

/**
 * Get commercial metrics for a customer email
 * Combines customer, subscription, and invoice data into a single metrics object
 */
export async function getCommercialMetrics(email: string): Promise<CommercialMetricsFromStripe> {
  // Default response for unconfigured or error cases
  const defaultMetrics: CommercialMetricsFromStripe = {
    paymentStatus: 'unknown',
    currency: 'USD',
  };

  if (!isStripeConfigured()) {
    console.warn('Stripe API key not configured, returning default metrics');
    return defaultMetrics;
  }

  if (!email) {
    return defaultMetrics;
  }

  try {
    // Fetch customer by email
    const customer = await fetchStripeCustomerByEmail(email);
    
    if (!customer) {
      return defaultMetrics;
    }

    // Fetch subscriptions and invoices in parallel
    const [subscriptions, invoices] = await Promise.all([
      fetchStripeSubscriptions(customer.customerId),
      fetchStripeInvoices(customer.customerId, 10),
    ]);

    // Calculate financial metrics
    const arr = calculateARR(subscriptions);
    const mrr = calculateMRR(subscriptions);

    // Get active subscription for plan and renewal info
    const activeSubscription = subscriptions.find(
      sub => sub.status === 'active' || sub.status === 'trialing'
    );

    // Calculate days to renewal
    let daysToRenewal: number | undefined;
    let currentPeriodEnd: number | undefined;
    
    if (activeSubscription) {
      currentPeriodEnd = activeSubscription.currentPeriodEnd;
      const now = Math.floor(Date.now() / 1000);
      daysToRenewal = Math.max(0, Math.ceil((currentPeriodEnd - now) / (24 * 60 * 60)));
    }

    // Get last payment date from paid invoices
    const paidInvoices = invoices.filter(inv => inv.status === 'paid');
    const lastPaymentDate = paidInvoices.length > 0 
      ? Math.max(...paidInvoices.map(inv => inv.created))
      : undefined;

    // Calculate overdue amount
    const openInvoices = invoices.filter(inv => inv.status === 'open');
    const overdueAmount = openInvoices.reduce(
      (sum, inv) => sum + (inv.amountDue - inv.amountPaid), 
      0
    ) / 100; // Convert from cents to dollars

    // Determine payment status
    const paymentStatus = determinePaymentStatus(customer, invoices, subscriptions);

    return {
      customerId: customer.customerId,
      arr: arr > 0 ? arr : undefined,
      mrr: mrr > 0 ? mrr : undefined,
      plan: activeSubscription?.plan.name,
      paymentStatus,
      subscriptionStatus: activeSubscription?.status,
      currentPeriodEnd,
      daysToRenewal,
      lastPaymentDate,
      overdueAmount: overdueAmount > 0 ? overdueAmount : undefined,
      currency: customer.currency || 'USD',
    };
  } catch (error) {
    console.error('Failed to get commercial metrics:', error);
    return defaultMetrics;
  }
}
