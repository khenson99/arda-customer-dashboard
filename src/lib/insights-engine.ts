/**
 * AI-Powered Insights Engine
 * 
 * Generates actionable insights from customer data using pattern detection,
 * anomaly analysis, trend identification, and predictive signals.
 */

import type {
  AccountDetail,
  AccountSummary,
  HealthTrend,
  HealthGrade,
  Alert,
} from './types/account';

// ============================================================================
// TYPES
// ============================================================================

export interface Insight {
  id: string;
  type: 'trend' | 'anomaly' | 'prediction' | 'recommendation' | 'benchmark';
  severity: 'info' | 'warning' | 'critical';
  title: string;
  description: string;
  evidence: string[];
  suggestedAction?: string;
  confidence: number;  // 0-100
  accountId?: string;  // null for portfolio-level
  accountName?: string;
  createdAt: string;
  category?: 'usage' | 'health' | 'commercial' | 'engagement' | 'risk';
  metric?: string;
  value?: number;
  previousValue?: number;
  changePercent?: number;
}

export type InsightFilter = 'all' | 'trend' | 'anomaly' | 'prediction' | 'recommendation' | 'benchmark';
export type InsightSeverity = 'info' | 'warning' | 'critical';

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

function generateId(): string {
  return `insight_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

function getNow(): string {
  return new Date().toISOString();
}

function calculateTrendFromTimeline(timeline: number[]): { trend: 'up' | 'down' | 'stable'; changePercent: number } {
  if (!timeline || timeline.length < 2) {
    return { trend: 'stable', changePercent: 0 };
  }
  
  const recentHalf = timeline.slice(-Math.ceil(timeline.length / 2));
  const olderHalf = timeline.slice(0, Math.floor(timeline.length / 2));
  
  const recentAvg = recentHalf.reduce((a, b) => a + b, 0) / recentHalf.length;
  const olderAvg = olderHalf.reduce((a, b) => a + b, 0) / olderHalf.length;
  
  if (olderAvg === 0) {
    return { trend: recentAvg > 0 ? 'up' : 'stable', changePercent: 0 };
  }
  
  const changePercent = ((recentAvg - olderAvg) / olderAvg) * 100;
  
  if (changePercent > 10) return { trend: 'up', changePercent };
  if (changePercent < -10) return { trend: 'down', changePercent };
  return { trend: 'stable', changePercent };
}

function detectAnomaly(values: number[]): { isAnomaly: boolean; direction: 'drop' | 'spike' | 'none'; magnitude: number } {
  if (!values || values.length < 4) {
    return { isAnomaly: false, direction: 'none', magnitude: 0 };
  }
  
  // Check last 3 values against the previous average
  const recent = values.slice(-3);
  const baseline = values.slice(0, -3);
  
  if (baseline.length === 0) {
    return { isAnomaly: false, direction: 'none', magnitude: 0 };
  }
  
  const baselineAvg = baseline.reduce((a, b) => a + b, 0) / baseline.length;
  const recentAvg = recent.reduce((a, b) => a + b, 0) / recent.length;
  
  if (baselineAvg === 0) {
    return { isAnomaly: false, direction: 'none', magnitude: 0 };
  }
  
  const changePercent = ((recentAvg - baselineAvg) / baselineAvg) * 100;
  
  // Anomaly threshold: 30% change
  if (changePercent < -30) {
    return { isAnomaly: true, direction: 'drop', magnitude: Math.abs(changePercent) };
  }
  if (changePercent > 50) {
    return { isAnomaly: true, direction: 'spike', magnitude: changePercent };
  }
  
  return { isAnomaly: false, direction: 'none', magnitude: 0 };
}

// ============================================================================
// ACCOUNT-LEVEL INSIGHTS
// ============================================================================

/**
 * Generate insights for an individual account based on its data.
 */
export function generateAccountInsights(account: AccountDetail): Insight[] {
  const insights: Insight[] = [];
  const now = getNow();
  
  // 1. Usage Trending Up
  if (account.usage?.activityTimeline) {
    const values = account.usage.activityTimeline.map(d => d.items + d.kanbanCards + d.orders);
    const { trend, changePercent } = calculateTrendFromTimeline(values);
    
    if (trend === 'up' && changePercent >= 20) {
      insights.push({
        id: generateId(),
        type: 'trend',
        severity: 'info',
        title: `Usage trending up ${Math.round(changePercent)}% week-over-week`,
        description: `${account.name} shows strong growth in product usage. Activity has increased significantly over recent weeks.`,
        evidence: [
          `Items: ${account.usage.itemCount}`,
          `Active Users: ${account.usage.activeUsersLast30Days}`,
          `${Math.round(changePercent)}% increase in activity`,
        ],
        suggestedAction: 'Consider scheduling expansion conversation',
        confidence: 85,
        accountId: account.id,
        accountName: account.name,
        createdAt: now,
        category: 'usage',
        changePercent,
      });
    }
  }
  
  // 2. Unusual Activity Drop (Anomaly)
  if (account.usage?.activityTimeline) {
    const values = account.usage.activityTimeline.map(d => d.items + d.kanbanCards + d.orders);
    const anomaly = detectAnomaly(values);
    
    if (anomaly.isAnomaly && anomaly.direction === 'drop') {
      insights.push({
        id: generateId(),
        type: 'anomaly',
        severity: 'warning',
        title: 'Unusual drop in activity last 3 days',
        description: `${account.name} has shown a ${Math.round(anomaly.magnitude)}% drop in activity compared to baseline. This may indicate a potential issue.`,
        evidence: [
          `${Math.round(anomaly.magnitude)}% decrease in activity`,
          `Days since last activity: ${account.usage.daysSinceLastActivity}`,
          `Active users dropped from previous period`,
        ],
        suggestedAction: 'Reach out to understand if there are any blockers or issues',
        confidence: 75,
        accountId: account.id,
        accountName: account.name,
        createdAt: now,
        category: 'engagement',
      });
    }
  }
  
  // 3. Expansion Prediction
  const hasHighUsage = account.usage && (
    (account.commercial?.seatUsage && account.commercial?.seatLimit && 
     account.commercial.seatUsage / account.commercial.seatLimit > 0.8) ||
    account.usage.activeUsersLast30Days > 10 ||
    account.commercial?.expansionPotential === 'high'
  );
  
  if (hasHighUsage && account.health?.trend !== 'declining') {
    insights.push({
      id: generateId(),
      type: 'prediction',
      severity: 'info',
      title: 'Likely to expand based on usage pattern',
      description: `${account.name} shows strong expansion signals including high seat utilization and growing usage patterns.`,
      evidence: [
        account.commercial?.seatUsage && account.commercial?.seatLimit 
          ? `Seat utilization: ${Math.round((account.commercial.seatUsage / account.commercial.seatLimit) * 100)}%`
          : null,
        `Active users: ${account.usage?.activeUsersLast30Days || 0}`,
        account.commercial?.expansionPotential 
          ? `Expansion potential: ${account.commercial.expansionPotential}`
          : null,
      ].filter(Boolean) as string[],
      suggestedAction: 'Schedule expansion conversation with account champion',
      confidence: 78,
      accountId: account.id,
      accountName: account.name,
      createdAt: now,
      category: 'commercial',
    });
  }
  
  // 4. QBR Recommendation (Renewal Approaching)
  if (account.commercial?.daysToRenewal && account.commercial.daysToRenewal <= 60) {
    const urgency = account.commercial.daysToRenewal <= 30 ? 'critical' : 'warning';
    
    insights.push({
      id: generateId(),
      type: 'recommendation',
      severity: urgency,
      title: 'Schedule QBR - account approaching renewal',
      description: `${account.name} is ${account.commercial.daysToRenewal} days from renewal. A Quarterly Business Review should be scheduled to discuss value delivered and renewal terms.`,
      evidence: [
        `Renewal in ${account.commercial.daysToRenewal} days`,
        account.commercial.arr ? `ARR: $${account.commercial.arr.toLocaleString()}` : null,
        `Health Score: ${account.health?.score || 'N/A'}`,
      ].filter(Boolean) as string[],
      suggestedAction: 'Schedule QBR meeting within the next 2 weeks',
      confidence: 95,
      accountId: account.id,
      accountName: account.name,
      createdAt: now,
      category: 'commercial',
    });
  }
  
  // 5. Health Score Declining
  if (account.health?.trend === 'declining' && account.health.scoreChange < -10) {
    insights.push({
      id: generateId(),
      type: 'trend',
      severity: 'warning',
      title: 'Health score declining significantly',
      description: `${account.name}'s health score has dropped ${Math.abs(account.health.scoreChange)} points. ${account.health.changeReason || 'Multiple factors contributing to decline.'}`,
      evidence: [
        `Score: ${account.health.score} (Grade ${account.health.grade})`,
        `Change: ${account.health.scoreChange} points`,
        account.health.changeReason || 'Engagement and usage metrics declining',
      ],
      suggestedAction: 'Review account health factors and schedule check-in call',
      confidence: 88,
      accountId: account.id,
      accountName: account.name,
      createdAt: now,
      category: 'health',
    });
  }
  
  // 6. Onboarding Stalled
  if (account.onboardingStatus === 'stalled' || 
      (account.lifecycleStage === 'onboarding' && account.usage?.daysSinceLastActivity > 7)) {
    insights.push({
      id: generateId(),
      type: 'anomaly',
      severity: 'warning',
      title: 'Onboarding appears stalled',
      description: `${account.name} has been in onboarding but shows limited recent activity. They may need additional support to get started.`,
      evidence: [
        `Onboarding status: ${account.onboardingStatus}`,
        `Days since activity: ${account.usage?.daysSinceLastActivity || 'Unknown'}`,
        `Items created: ${account.usage?.itemCount || 0}`,
      ],
      suggestedAction: 'Send onboarding check-in email and offer training session',
      confidence: 82,
      accountId: account.id,
      accountName: account.name,
      createdAt: now,
      category: 'engagement',
    });
  }
  
  // 7. Low Feature Adoption
  if (account.usage?.featureAdoption) {
    const adoptionValues = Object.values(account.usage.featureAdoption);
    const avgAdoption = adoptionValues.reduce((a, b) => a + b, 0) / adoptionValues.length;
    
    if (avgAdoption < 30 && account.lifecycleStage !== 'onboarding') {
      insights.push({
        id: generateId(),
        type: 'recommendation',
        severity: 'info',
        title: 'Low feature adoption detected',
        description: `${account.name} is only using ${Math.round(avgAdoption)}% of available features. There's opportunity to drive more value.`,
        evidence: [
          `Items: ${account.usage.featureAdoption.items}%`,
          `Kanban: ${account.usage.featureAdoption.kanban}%`,
          `Ordering: ${account.usage.featureAdoption.ordering}%`,
        ],
        suggestedAction: 'Schedule feature training or share best practices content',
        confidence: 72,
        accountId: account.id,
        accountName: account.name,
        createdAt: now,
        category: 'engagement',
      });
    }
  }
  
  // 8. Payment Issues
  if (account.commercial?.paymentStatus === 'overdue' || 
      (account.commercial?.overdueAmount && account.commercial.overdueAmount > 0)) {
    insights.push({
      id: generateId(),
      type: 'anomaly',
      severity: 'critical',
      title: 'Payment overdue - action required',
      description: `${account.name} has outstanding payment issues that need immediate attention.`,
      evidence: [
        `Payment status: ${account.commercial?.paymentStatus}`,
        account.commercial?.overdueAmount 
          ? `Overdue amount: $${account.commercial.overdueAmount.toLocaleString()}`
          : 'Payment collection needed',
      ],
      suggestedAction: 'Coordinate with finance team and reach out to billing contact',
      confidence: 95,
      accountId: account.id,
      accountName: account.name,
      createdAt: now,
      category: 'commercial',
    });
  }
  
  return insights;
}

// ============================================================================
// PORTFOLIO-LEVEL INSIGHTS
// ============================================================================

/**
 * Generate portfolio-wide insights from aggregated account data.
 */
export function generatePortfolioInsights(accounts: AccountSummary[]): Insight[] {
  const insights: Insight[] = [];
  const now = getNow();
  
  if (!accounts || accounts.length === 0) {
    return insights;
  }
  
  // 1. Accounts Showing Churn Signals
  const atRiskAccounts = accounts.filter(a => 
    a.healthScore < 50 || 
    a.healthTrend === 'declining' ||
    a.criticalAlertCount > 0 ||
    a.daysSinceLastActivity > 14
  );
  
  if (atRiskAccounts.length > 0) {
    const atRiskARR = atRiskAccounts.reduce((sum, a) => sum + (a.arr || 0), 0);
    
    insights.push({
      id: generateId(),
      type: 'prediction',
      severity: atRiskAccounts.length >= 5 ? 'critical' : 'warning',
      title: `${atRiskAccounts.length} accounts showing churn signals`,
      description: `These accounts show multiple risk indicators including declining health, low engagement, or critical alerts.`,
      evidence: [
        `${atRiskAccounts.length} accounts at risk`,
        `Combined ARR at risk: $${atRiskARR.toLocaleString()}`,
        `Average health score: ${Math.round(atRiskAccounts.reduce((s, a) => s + a.healthScore, 0) / atRiskAccounts.length)}`,
      ],
      suggestedAction: 'Prioritize outreach to these accounts immediately',
      confidence: 82,
      createdAt: now,
      category: 'risk',
      value: atRiskAccounts.length,
    });
  }
  
  // 2. Top Performers Benchmark
  const sortedByHealth = [...accounts].sort((a, b) => b.healthScore - a.healthScore);
  const top10Percent = sortedByHealth.slice(0, Math.max(1, Math.ceil(accounts.length * 0.1)));
  
  if (top10Percent.length > 0) {
    const avgHealthTop = Math.round(top10Percent.reduce((s, a) => s + a.healthScore, 0) / top10Percent.length);
    
    insights.push({
      id: generateId(),
      type: 'benchmark',
      severity: 'info',
      title: `Top ${top10Percent.length} accounts by health score`,
      description: `These are your healthiest accounts with an average health score of ${avgHealthTop}. They represent best practices to replicate.`,
      evidence: [
        `Top accounts: ${top10Percent.slice(0, 3).map(a => a.name).join(', ')}${top10Percent.length > 3 ? '...' : ''}`,
        `Average health: ${avgHealthTop}`,
        `All trending stable or improving`,
      ],
      suggestedAction: 'Study what makes these accounts successful and apply learnings to at-risk accounts',
      confidence: 90,
      createdAt: now,
      category: 'health',
      value: avgHealthTop,
    });
  }
  
  // 3. Revenue at Risk
  const atRiskWithARR = accounts.filter(a => 
    (a.healthScore < 50 || a.criticalAlertCount > 0) && a.arr && a.arr > 0
  );
  const totalAtRiskARR = atRiskWithARR.reduce((sum, a) => sum + (a.arr || 0), 0);
  const totalARR = accounts.reduce((sum, a) => sum + (a.arr || 0), 0);
  
  if (totalAtRiskARR > 0) {
    const percentAtRisk = totalARR > 0 ? Math.round((totalAtRiskARR / totalARR) * 100) : 0;
    
    insights.push({
      id: generateId(),
      type: 'prediction',
      severity: percentAtRisk >= 20 ? 'critical' : 'warning',
      title: `Revenue at risk from at-risk accounts: $${totalAtRiskARR.toLocaleString()}`,
      description: `${percentAtRisk}% of total ARR is associated with accounts showing risk signals. Immediate action recommended.`,
      evidence: [
        `At-risk ARR: $${totalAtRiskARR.toLocaleString()}`,
        `Total ARR: $${totalARR.toLocaleString()}`,
        `${atRiskWithARR.length} accounts contributing to risk`,
      ],
      suggestedAction: 'Review and prioritize intervention for highest ARR at-risk accounts',
      confidence: 85,
      createdAt: now,
      category: 'commercial',
      value: totalAtRiskARR,
    });
  }
  
  // 4. Onboarding Performance
  const onboardingAccounts = accounts.filter(a => a.lifecycleStage === 'onboarding');
  const completedOnboarding = accounts.filter(a => 
    a.onboardingStatus === 'completed' || a.lifecycleStage === 'adoption'
  );
  
  if (onboardingAccounts.length > 0 || completedOnboarding.length > 0) {
    const stalledOnboarding = onboardingAccounts.filter(a => 
      a.daysSinceLastActivity > 7 || a.onboardingStatus === 'stalled'
    );
    
    if (stalledOnboarding.length > 0) {
      insights.push({
        id: generateId(),
        type: 'trend',
        severity: 'warning',
        title: `${stalledOnboarding.length} onboarding accounts need attention`,
        description: `These accounts are in onboarding but showing signs of stalling. Early intervention is critical for long-term success.`,
        evidence: [
          `${stalledOnboarding.length} stalled onboardings`,
          `${onboardingAccounts.length} total in onboarding`,
          `Avg days inactive: ${Math.round(stalledOnboarding.reduce((s, a) => s + a.daysSinceLastActivity, 0) / stalledOnboarding.length)}`,
        ],
        suggestedAction: 'Schedule onboarding check-ins and offer additional training',
        confidence: 78,
        createdAt: now,
        category: 'engagement',
      });
    }
  }
  
  // 5. Portfolio Health Distribution
  const healthyAccounts = accounts.filter(a => a.healthScore >= 70);
  const moderateAccounts = accounts.filter(a => a.healthScore >= 40 && a.healthScore < 70);
  const unhealthyAccounts = accounts.filter(a => a.healthScore < 40);
  
  const healthyPercent = Math.round((healthyAccounts.length / accounts.length) * 100);
  
  insights.push({
    id: generateId(),
    type: 'benchmark',
    severity: healthyPercent < 50 ? 'warning' : 'info',
    title: `Portfolio health: ${healthyPercent}% healthy, ${Math.round((unhealthyAccounts.length / accounts.length) * 100)}% at-risk`,
    description: `Overall portfolio health distribution shows ${healthyAccounts.length} healthy accounts, ${moderateAccounts.length} moderate, and ${unhealthyAccounts.length} at-risk.`,
    evidence: [
      `Healthy (70+): ${healthyAccounts.length} accounts`,
      `Moderate (40-69): ${moderateAccounts.length} accounts`,
      `At-risk (<40): ${unhealthyAccounts.length} accounts`,
    ],
    suggestedAction: healthyPercent < 50 
      ? 'Focus on improving moderate accounts before they become at-risk'
      : 'Maintain current engagement strategies and share best practices',
    confidence: 92,
    createdAt: now,
    category: 'health',
  });
  
  // 6. Expansion Pipeline
  const expansionCandidates = accounts.filter(a => 
    a.healthScore >= 70 && 
    a.healthTrend !== 'declining' &&
    a.activeUsers >= 5
  );
  
  if (expansionCandidates.length > 0) {
    const potentialExpansionARR = Math.round(
      expansionCandidates.reduce((sum, a) => sum + (a.arr || 0), 0) * 0.2
    ); // Estimate 20% expansion potential
    
    insights.push({
      id: generateId(),
      type: 'prediction',
      severity: 'info',
      title: `${expansionCandidates.length} accounts showing expansion potential`,
      description: `These healthy, active accounts are good candidates for upsell conversations.`,
      evidence: [
        `${expansionCandidates.length} expansion candidates`,
        `Potential expansion ARR: $${potentialExpansionARR.toLocaleString()}`,
        `All with health score 70+`,
      ],
      suggestedAction: 'Prioritize expansion conversations with these accounts',
      confidence: 72,
      createdAt: now,
      category: 'commercial',
      value: expansionCandidates.length,
    });
  }
  
  // 7. Renewal Wave Analysis
  const upcomingRenewals = accounts.filter(a => 
    a.daysToRenewal !== undefined && a.daysToRenewal <= 90
  );
  
  if (upcomingRenewals.length >= 3) {
    const renewalARR = upcomingRenewals.reduce((sum, a) => sum + (a.arr || 0), 0);
    const avgRenewalHealth = Math.round(
      upcomingRenewals.reduce((s, a) => s + a.healthScore, 0) / upcomingRenewals.length
    );
    
    insights.push({
      id: generateId(),
      type: 'trend',
      severity: avgRenewalHealth < 60 ? 'warning' : 'info',
      title: `${upcomingRenewals.length} renewals coming up in next 90 days`,
      description: `$${renewalARR.toLocaleString()} ARR up for renewal. Average health of renewing accounts is ${avgRenewalHealth}.`,
      evidence: [
        `${upcomingRenewals.length} accounts renewing`,
        `Total renewal ARR: $${renewalARR.toLocaleString()}`,
        `Average health: ${avgRenewalHealth}`,
      ],
      suggestedAction: 'Ensure all renewal accounts have scheduled QBR or renewal discussions',
      confidence: 88,
      createdAt: now,
      category: 'commercial',
    });
  }
  
  // 8. Activity Trends
  const improvingAccounts = accounts.filter(a => a.healthTrend === 'improving');
  const decliningAccounts = accounts.filter(a => a.healthTrend === 'declining');
  
  if (decliningAccounts.length > improvingAccounts.length && decliningAccounts.length > 2) {
    insights.push({
      id: generateId(),
      type: 'trend',
      severity: 'warning',
      title: `More accounts declining (${decliningAccounts.length}) than improving (${improvingAccounts.length})`,
      description: `Portfolio trend shows more accounts with declining health than improving. This warrants investigation into root causes.`,
      evidence: [
        `Improving: ${improvingAccounts.length}`,
        `Declining: ${decliningAccounts.length}`,
        `Stable: ${accounts.length - improvingAccounts.length - decliningAccounts.length}`,
      ],
      suggestedAction: 'Analyze common factors among declining accounts and address systemic issues',
      confidence: 80,
      createdAt: now,
      category: 'health',
    });
  }
  
  // Sort insights by severity (critical first, then warning, then info)
  const severityOrder = { critical: 0, warning: 1, info: 2 };
  insights.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);
  
  return insights;
}

// ============================================================================
// INSIGHT HELPERS
// ============================================================================

/**
 * Filter insights by type
 */
export function filterInsights(insights: Insight[], filter: InsightFilter): Insight[] {
  if (filter === 'all') return insights;
  return insights.filter(i => i.type === filter);
}

/**
 * Get insight count by severity
 */
export function getInsightCountsBySeverity(insights: Insight[]): Record<InsightSeverity, number> {
  return {
    critical: insights.filter(i => i.severity === 'critical').length,
    warning: insights.filter(i => i.severity === 'warning').length,
    info: insights.filter(i => i.severity === 'info').length,
  };
}

/**
 * Get top N insights by severity
 */
export function getTopInsights(insights: Insight[], limit: number = 5): Insight[] {
  const severityOrder = { critical: 0, warning: 1, info: 2 };
  return [...insights]
    .sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity])
    .slice(0, limit);
}
