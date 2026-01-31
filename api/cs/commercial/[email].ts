/**
 * Commercial Metrics API Endpoint
 * 
 * GET /api/cs/commercial/:email
 * 
 * Returns Stripe commercial data for a customer by email address.
 * Provides ARR, MRR, payment status, renewal date, and other billing metrics.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import type { CommercialMetrics } from '../../../src/lib/types/account';
import { getStripeEnrichedMetrics, type StripeEnrichedMetrics } from '../../lib/stripe-api';

/**
 * Convert Stripe enriched metrics to CommercialMetrics format
 */
function toCommercialMetrics(stripeData: StripeEnrichedMetrics): CommercialMetrics {
  // Calculate expansion signals based on Stripe data
  const expansionSignals: CommercialMetrics['expansionSignals'] = [];
  
  // If near seat limit, add expansion signal
  // (This would require additional seat usage data from the product)
  
  return {
    plan: stripeData.plan || 'Unknown',
    arr: stripeData.arr,
    mrr: stripeData.mrr,
    currency: stripeData.currency,
    contractStartDate: undefined, // Not available from Stripe directly
    contractEndDate: stripeData.contractEndDate,
    renewalDate: stripeData.renewalDate,
    daysToRenewal: stripeData.daysToRenewal,
    termMonths: stripeData.termMonths,
    autoRenew: stripeData.autoRenew,
    paymentStatus: stripeData.paymentStatus,
    lastPaymentDate: stripeData.lastPaymentDate,
    overdueAmount: stripeData.overdueAmount,
    expansionSignals,
    expansionPotential: calculateExpansionPotential(stripeData),
  };
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
  
  // Good payment status and active subscription = potential for expansion
  if (stripeData.paymentStatus === 'current' && stripeData.subscriptionStatus === 'active') {
    // Higher ARR customers have more expansion potential
    if (stripeData.arr && stripeData.arr >= 10000) {
      return 'high';
    }
    if (stripeData.arr && stripeData.arr >= 5000) {
      return 'medium';
    }
    return 'low';
  }
  
  // Payment issues = lower expansion potential
  if (stripeData.paymentStatus === 'overdue' || stripeData.paymentStatus === 'at_risk') {
    return 'none';
  }
  
  return 'low';
}

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
  
  // Cache for 5 minutes to reduce Stripe API calls
  res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600');
  res.setHeader('CDN-Cache-Control', 'max-age=300');
  res.setHeader('Vercel-CDN-Cache-Control', 'max-age=300');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  
  // Get email from path parameter
  const { email } = req.query;
  const emailParam = Array.isArray(email) ? email[0] : email;
  
  if (!emailParam) {
    return res.status(400).json({ error: 'Email parameter is required' });
  }
  
  // Basic email validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(emailParam)) {
    return res.status(400).json({ error: 'Invalid email format' });
  }
  
  // Get Stripe API key - use STRIPE_SECRET_KEY as primary, fall back to STRIPE_API_KEY
  const stripeKey = process.env.STRIPE_SECRET_KEY || process.env.STRIPE_API_KEY;
  
  if (!stripeKey) {
    return res.status(503).json({ 
      error: 'Stripe not configured',
      message: 'STRIPE_SECRET_KEY environment variable is not set',
    });
  }
  
  try {
    // Fetch Stripe data
    const stripeData = await getStripeEnrichedMetrics(
      { email: emailParam },
      stripeKey
    );
    
    if (!stripeData.found) {
      return res.status(404).json({ 
        error: 'Customer not found',
        message: `No Stripe customer found with email: ${emailParam}`,
      });
    }
    
    // Convert to CommercialMetrics format
    const commercialMetrics = toCommercialMetrics(stripeData);
    
    return res.status(200).json({
      email: emailParam,
      stripeCustomerId: stripeData.customerId,
      metrics: commercialMetrics,
      subscriptionStatus: stripeData.subscriptionStatus,
      fetchedAt: new Date().toISOString(),
    });
    
  } catch (error) {
    console.error('Commercial metrics API error:', error);
    
    // Handle rate limiting specifically
    if (error instanceof Error && error.message.includes('429')) {
      return res.status(429).json({
        error: 'Rate limited',
        message: 'Too many requests to Stripe API. Please try again later.',
        retryAfter: 60,
      });
    }
    
    return res.status(500).json({ 
      error: 'Failed to fetch commercial metrics',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
