/**
 * Forecasting Engine
 * 
 * Provides churn prediction and revenue forecasting capabilities
 * for customer success operations.
 */

import type {
  AccountDetail,
  AccountSummary,
} from './types/account';

// ============================================================================
// TYPES
// ============================================================================

export interface ChurnPrediction {
  accountId: string;
  accountName: string;
  probability: number;  // 0-100
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  factors: ChurnFactor[];
  recommendedActions: string[];
  calculatedAt: string;
  arrAtRisk?: number;
}

export interface ChurnFactor {
  name: string;
  impact: 'positive' | 'negative' | 'neutral';
  weight: number;  // 0-1 contribution to churn probability
  description: string;
  value?: string | number;
}

export interface RevenueForecast {
  month: string;
  predictedARR: number;
  atRiskARR: number;
  expansionARR: number;
  confidence: number;  // 0-100
  renewalARR: number;
  churnedARR: number;
  netChange: number;
}

export interface PortfolioForecast {
  currentARR: number;
  forecasts: RevenueForecast[];
  totalAtRisk: number;
  totalExpansionOpportunity: number;
  projectedNetChange: number;
  confidence: number;
}

// ============================================================================
// CHURN PREDICTION
// ============================================================================

/**
 * Predict churn risk for an individual account.
 * Uses multiple signals to calculate a probability score.
 */
export function predictChurnRisk(account: AccountDetail): ChurnPrediction {
  const factors: ChurnFactor[] = [];
  let riskScore = 0;
  const maxScore = 100;
  
  // Factor 1: Health Score (weight: 25%)
  const healthScore = account.health?.score || 50;
  const healthWeight = 0.25;
  if (healthScore < 40) {
    riskScore += healthWeight * maxScore;
    factors.push({
      name: 'Low Health Score',
      impact: 'negative',
      weight: healthWeight,
      description: 'Account health is below critical threshold',
      value: healthScore,
    });
  } else if (healthScore < 60) {
    riskScore += healthWeight * maxScore * 0.5;
    factors.push({
      name: 'Moderate Health Score',
      impact: 'negative',
      weight: healthWeight * 0.5,
      description: 'Account health is moderate but needs attention',
      value: healthScore,
    });
  } else {
    factors.push({
      name: 'Good Health Score',
      impact: 'positive',
      weight: 0,
      description: 'Account health is in good standing',
      value: healthScore,
    });
  }
  
  // Factor 2: Health Trend (weight: 15%)
  const trendWeight = 0.15;
  if (account.health?.trend === 'declining') {
    riskScore += trendWeight * maxScore;
    factors.push({
      name: 'Declining Trend',
      impact: 'negative',
      weight: trendWeight,
      description: 'Health score has been declining over recent period',
      value: account.health?.scoreChange || 0,
    });
  } else if (account.health?.trend === 'improving') {
    factors.push({
      name: 'Improving Trend',
      impact: 'positive',
      weight: 0,
      description: 'Health score is trending upward',
      value: account.health?.scoreChange || 0,
    });
  }
  
  // Factor 3: Days Since Last Activity (weight: 20%)
  const activityWeight = 0.20;
  const daysSinceActivity = account.usage?.daysSinceLastActivity || 0;
  if (daysSinceActivity > 14) {
    riskScore += activityWeight * maxScore;
    factors.push({
      name: 'Inactive Account',
      impact: 'negative',
      weight: activityWeight,
      description: 'No activity in over 14 days',
      value: `${daysSinceActivity} days`,
    });
  } else if (daysSinceActivity > 7) {
    riskScore += activityWeight * maxScore * 0.5;
    factors.push({
      name: 'Low Recent Activity',
      impact: 'negative',
      weight: activityWeight * 0.5,
      description: 'Limited activity in past week',
      value: `${daysSinceActivity} days`,
    });
  } else {
    factors.push({
      name: 'Active Engagement',
      impact: 'positive',
      weight: 0,
      description: 'Account is actively engaged',
      value: `${daysSinceActivity} days`,
    });
  }
  
  // Factor 4: Support Issues (weight: 15%)
  const supportWeight = 0.15;
  const criticalTickets = account.support?.criticalTickets || 0;
  const escalations = account.support?.escalationCount || 0;
  if (criticalTickets > 0 || escalations > 2) {
    riskScore += supportWeight * maxScore;
    factors.push({
      name: 'Support Escalations',
      impact: 'negative',
      weight: supportWeight,
      description: 'Account has unresolved critical issues or multiple escalations',
      value: `${criticalTickets} critical, ${escalations} escalations`,
    });
  } else if (account.support?.openTickets && account.support.openTickets > 3) {
    riskScore += supportWeight * maxScore * 0.5;
    factors.push({
      name: 'Multiple Open Tickets',
      impact: 'negative',
      weight: supportWeight * 0.5,
      description: 'Several support tickets remain open',
      value: `${account.support.openTickets} open tickets`,
    });
  }
  
  // Factor 5: Payment Status (weight: 15%)
  const paymentWeight = 0.15;
  if (account.commercial?.paymentStatus === 'overdue') {
    riskScore += paymentWeight * maxScore;
    factors.push({
      name: 'Payment Overdue',
      impact: 'negative',
      weight: paymentWeight,
      description: 'Account has overdue payments',
      value: account.commercial?.overdueAmount 
        ? `$${account.commercial.overdueAmount.toLocaleString()}`
        : 'Overdue',
    });
  } else if (account.commercial?.paymentStatus === 'at_risk') {
    riskScore += paymentWeight * maxScore * 0.6;
    factors.push({
      name: 'Payment At Risk',
      impact: 'negative',
      weight: paymentWeight * 0.6,
      description: 'Payment status shows risk signals',
    });
  }
  
  // Factor 6: Feature Adoption (weight: 10%)
  const adoptionWeight = 0.10;
  if (account.usage?.featureAdoption) {
    const avgAdoption = Object.values(account.usage.featureAdoption)
      .reduce((a, b) => a + b, 0) / Object.values(account.usage.featureAdoption).length;
    
    if (avgAdoption < 20) {
      riskScore += adoptionWeight * maxScore;
      factors.push({
        name: 'Very Low Adoption',
        impact: 'negative',
        weight: adoptionWeight,
        description: 'Account is using very few features',
        value: `${Math.round(avgAdoption)}% average`,
      });
    } else if (avgAdoption < 40) {
      riskScore += adoptionWeight * maxScore * 0.5;
      factors.push({
        name: 'Low Adoption',
        impact: 'negative',
        weight: adoptionWeight * 0.5,
        description: 'Account has limited feature adoption',
        value: `${Math.round(avgAdoption)}% average`,
      });
    }
  }
  
  // Cap risk score at 95% (never 100% certain)
  const probability = Math.min(Math.round(riskScore), 95);
  
  // Determine risk level
  let riskLevel: ChurnPrediction['riskLevel'] = 'low';
  if (probability >= 70) riskLevel = 'critical';
  else if (probability >= 50) riskLevel = 'high';
  else if (probability >= 30) riskLevel = 'medium';
  
  // Generate recommended actions based on factors
  const recommendedActions: string[] = [];
  
  if (probability >= 50) {
    recommendedActions.push('Schedule urgent health check call with account champion');
  }
  
  if (factors.some(f => f.name === 'Inactive Account' || f.name === 'Low Recent Activity')) {
    recommendedActions.push('Send re-engagement email with value proposition');
  }
  
  if (factors.some(f => f.name === 'Support Escalations' || f.name === 'Multiple Open Tickets')) {
    recommendedActions.push('Expedite resolution of open support issues');
  }
  
  if (factors.some(f => f.name === 'Payment Overdue' || f.name === 'Payment At Risk')) {
    recommendedActions.push('Coordinate with finance team on payment issues');
  }
  
  if (factors.some(f => f.name === 'Very Low Adoption' || f.name === 'Low Adoption')) {
    recommendedActions.push('Schedule training session to improve feature adoption');
  }
  
  if (factors.some(f => f.name === 'Declining Trend')) {
    recommendedActions.push('Identify root cause of declining health and create action plan');
  }
  
  if (recommendedActions.length === 0) {
    recommendedActions.push('Continue regular check-ins to maintain relationship');
  }
  
  return {
    accountId: account.id,
    accountName: account.name,
    probability,
    riskLevel,
    factors: factors.filter(f => f.impact !== 'positive' || f.weight === 0),
    recommendedActions,
    calculatedAt: new Date().toISOString(),
    arrAtRisk: probability >= 30 ? account.commercial?.arr : 0,
  };
}

// ============================================================================
// REVENUE FORECASTING
// ============================================================================

/**
 * Generate 6-month revenue forecast based on portfolio data.
 */
export function forecastRevenue(accounts: AccountSummary[]): RevenueForecast[] {
  const forecasts: RevenueForecast[] = [];
  const now = new Date();
  
  if (!accounts || accounts.length === 0) {
    return forecasts;
  }
  
  // Calculate current portfolio metrics
  const totalARR = accounts.reduce((sum, a) => sum + (a.arr || 0), 0);
  
  // Categorize accounts by risk
  const atRiskAccounts = accounts.filter(a => 
    a.healthScore < 50 || a.criticalAlertCount > 0 || a.healthTrend === 'declining'
  );
  const healthyAccounts = accounts.filter(a => 
    a.healthScore >= 70 && a.healthTrend !== 'declining'
  );
  const moderateAccounts = accounts.filter(a => 
    a.healthScore >= 50 && a.healthScore < 70
  );
  
  // Calculate base metrics
  const atRiskARR = atRiskAccounts.reduce((sum, a) => sum + (a.arr || 0), 0);
  const healthyARR = healthyAccounts.reduce((sum, a) => sum + (a.arr || 0), 0);
  const moderateARR = moderateAccounts.reduce((sum, a) => sum + (a.arr || 0), 0);
  
  // Churn probability estimates by category
  const atRiskChurnRate = 0.25;  // 25% of at-risk ARR likely to churn
  const moderateChurnRate = 0.05;  // 5% of moderate ARR
  const healthyChurnRate = 0.02;  // 2% of healthy ARR
  
  // Expansion estimates
  const expansionRate = 0.15;  // 15% of healthy accounts may expand
  
  // Generate 6-month forecast
  for (let month = 0; month < 6; month++) {
    const forecastDate = new Date(now);
    forecastDate.setMonth(forecastDate.getMonth() + month + 1);
    const monthLabel = forecastDate.toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'short' 
    });
    
    // Monthly decay factor (risk compounds over time)
    const monthFactor = Math.pow(0.95, month);  // Confidence decreases over time
    
    // Calculate expected churn for this month
    const expectedChurn = Math.round(
      (atRiskARR * atRiskChurnRate / 6) +
      (moderateARR * moderateChurnRate / 6) +
      (healthyARR * healthyChurnRate / 6)
    );
    
    // Calculate expected expansion
    const expectedExpansion = Math.round(
      (healthyARR * expansionRate / 6) * monthFactor
    );
    
    // Get accounts renewing this month
    const renewingThisMonth = accounts.filter(a => {
      if (!a.daysToRenewal) return false;
      const daysToMonth = (month + 1) * 30;
      return a.daysToRenewal <= daysToMonth && a.daysToRenewal > month * 30;
    });
    const renewalARR = renewingThisMonth.reduce((sum, a) => sum + (a.arr || 0), 0);
    
    // At-risk ARR for the month
    const monthAtRisk = Math.round(atRiskARR * monthFactor);
    
    // Calculate net change
    const netChange = expectedExpansion - expectedChurn;
    
    // Predicted ARR
    const previousARR = month === 0 ? totalARR : forecasts[month - 1].predictedARR;
    const predictedARR = previousARR + netChange;
    
    // Confidence decreases over time
    const confidence = Math.round(90 * Math.pow(0.92, month));
    
    forecasts.push({
      month: monthLabel,
      predictedARR,
      atRiskARR: monthAtRisk,
      expansionARR: expectedExpansion,
      confidence,
      renewalARR,
      churnedARR: expectedChurn,
      netChange,
    });
  }
  
  return forecasts;
}

/**
 * Get portfolio forecast summary
 */
export function getPortfolioForecast(accounts: AccountSummary[]): PortfolioForecast {
  const forecasts = forecastRevenue(accounts);
  const currentARR = accounts.reduce((sum, a) => sum + (a.arr || 0), 0);
  
  // Calculate totals
  const totalAtRisk = accounts
    .filter(a => a.healthScore < 50 || a.criticalAlertCount > 0)
    .reduce((sum, a) => sum + (a.arr || 0), 0);
  
  const totalExpansionOpportunity = accounts
    .filter(a => a.healthScore >= 70 && a.healthTrend !== 'declining')
    .reduce((sum, a) => sum + Math.round((a.arr || 0) * 0.2), 0);  // 20% expansion estimate
  
  const projectedNetChange = forecasts.length > 0
    ? forecasts[forecasts.length - 1].predictedARR - currentARR
    : 0;
  
  const avgConfidence = forecasts.length > 0
    ? Math.round(forecasts.reduce((sum, f) => sum + f.confidence, 0) / forecasts.length)
    : 0;
  
  return {
    currentARR,
    forecasts,
    totalAtRisk,
    totalExpansionOpportunity,
    projectedNetChange,
    confidence: avgConfidence,
  };
}

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Get top accounts by churn risk
 */
export function getTopChurnRisks(
  accounts: AccountDetail[], 
  limit: number = 5
): ChurnPrediction[] {
  return accounts
    .map(account => predictChurnRisk(account))
    .sort((a, b) => b.probability - a.probability)
    .slice(0, limit);
}

/**
 * Calculate aggregate churn metrics
 */
export function getChurnMetrics(predictions: ChurnPrediction[]): {
  criticalCount: number;
  highCount: number;
  mediumCount: number;
  lowCount: number;
  totalARRAtRisk: number;
  avgProbability: number;
} {
  const criticalCount = predictions.filter(p => p.riskLevel === 'critical').length;
  const highCount = predictions.filter(p => p.riskLevel === 'high').length;
  const mediumCount = predictions.filter(p => p.riskLevel === 'medium').length;
  const lowCount = predictions.filter(p => p.riskLevel === 'low').length;
  const totalARRAtRisk = predictions.reduce((sum, p) => sum + (p.arrAtRisk || 0), 0);
  const avgProbability = predictions.length > 0
    ? Math.round(predictions.reduce((sum, p) => sum + p.probability, 0) / predictions.length)
    : 0;
  
  return {
    criticalCount,
    highCount,
    mediumCount,
    lowCount,
    totalARRAtRisk,
    avgProbability,
  };
}
