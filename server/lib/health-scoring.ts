/**
 * Health Scoring Engine v2
 * 
 * A comprehensive, explainable health scoring system for customer accounts.
 * Designed for CS operations: transparent, configurable, and actionable.
 */

import type {
  AccountHealth,
  HealthComponent,
  HealthFactor,
  HealthGrade,
  HealthTrend,
  HealthScoringConfig,
  AccountSegment,
  DataFreshness,
} from '../../src/lib/types/account';

// ============================================================================
// Default Configuration
// ============================================================================

export const DEFAULT_HEALTH_CONFIG: HealthScoringConfig = {
  weights: {
    adoption: 0.30,      // 30% - Product usage depth
    engagement: 0.25,    // 25% - User activity breadth
    relationship: 0.15,  // 15% - CS touch recency
    support: 0.15,       // 15% - Support health
    commercial: 0.15,    // 15% - Payment/renewal health
  },
  gradeThresholds: {
    A: 80,
    B: 65,
    C: 50,
    D: 35,
  },
  segmentOverrides: {
    enterprise: {
      weights: {
        adoption: 0.25,
        engagement: 0.20,
        relationship: 0.25,  // Relationship more important for enterprise
        support: 0.15,
        commercial: 0.15,
      },
    },
    smb: {
      weights: {
        adoption: 0.35,      // Usage more important for SMB
        engagement: 0.30,
        relationship: 0.10,
        support: 0.10,
        commercial: 0.15,
      },
    },
  },
};

// ============================================================================
// Input Data Types
// ============================================================================

export interface HealthScoringInput {
  // Adoption metrics
  itemCount: number;
  kanbanCardCount: number;
  orderCount: number;
  
  // Engagement metrics
  totalUsers: number;
  activeUsersLast7Days: number;
  activeUsersLast30Days: number;
  daysSinceLastActivity: number;
  accountAgeDays: number;
  
  // Relationship metrics (optional - may not have data)
  daysSinceLastCSContact?: number;
  interactionCountLast30Days?: number;
  hasChampion?: boolean;
  
  // Support metrics (optional)
  openTickets?: number;
  criticalTickets?: number;
  avgResponseTimeHours?: number;
  csat?: number;
  
  // Commercial metrics (optional)
  paymentStatus?: 'current' | 'overdue' | 'at_risk' | 'unknown';
  daysToRenewal?: number;
  
  // Context
  segment?: AccountSegment;
  tier?: string;
  
  // Previous score for trend calculation
  previousScore?: number;
  previousScoreDate?: string;
}

// ============================================================================
// Scoring Functions
// ============================================================================

/**
 * Calculate the complete health score with all components and explainability.
 */
export function calculateHealthScore(
  input: HealthScoringInput,
  config: HealthScoringConfig = DEFAULT_HEALTH_CONFIG
): AccountHealth {
  // Get segment-specific config if available
  const segmentConfig = input.segment && config.segmentOverrides?.[input.segment]
    ? { ...config, ...config.segmentOverrides[input.segment] }
    : config;
  
  const weights = segmentConfig.weights;
  
  // Calculate each component
  const adoption = calculateAdoptionScore(input);
  const engagement = calculateEngagementScore(input);
  const relationship = calculateRelationshipScore(input);
  const support = calculateSupportScore(input);
  const commercial = calculateCommercialScore(input);
  
  // Apply weights
  adoption.weight = weights.adoption;
  adoption.weightedScore = adoption.score * weights.adoption;
  
  engagement.weight = weights.engagement;
  engagement.weightedScore = engagement.score * weights.engagement;
  
  relationship.weight = weights.relationship;
  relationship.weightedScore = relationship.score * weights.relationship;
  
  support.weight = weights.support;
  support.weightedScore = support.score * weights.support;
  
  commercial.weight = weights.commercial;
  commercial.weightedScore = commercial.score * weights.commercial;
  
  // Calculate composite score
  const compositeScore = Math.round(
    adoption.weightedScore +
    engagement.weightedScore +
    relationship.weightedScore +
    support.weightedScore +
    commercial.weightedScore
  );
  
  // Determine grade
  const grade = scoreToGrade(compositeScore, segmentConfig.gradeThresholds);
  
  // Calculate trend
  const scoreChange = input.previousScore !== undefined
    ? compositeScore - input.previousScore
    : 0;
  
  const trend = calculateTrend(scoreChange);
  
  // Generate change reason
  const changeReason = generateChangeReason(
    { adoption, engagement, relationship, support, commercial },
    scoreChange
  );
  
  // Calculate confidence based on data completeness
  const confidence = calculateConfidence(input);
  
  // Determine data freshness
  const dataFreshness = determineDataFreshness(input);
  
  return {
    score: compositeScore,
    grade,
    trend,
    components: {
      adoption,
      engagement,
      relationship,
      support,
      commercial,
    },
    previousScore: input.previousScore,
    scoreChange,
    changeReason,
    calculatedAt: new Date().toISOString(),
    dataFreshness,
    confidence,
  };
}

// ============================================================================
// Component Scoring Functions
// ============================================================================

function calculateAdoptionScore(input: HealthScoringInput): HealthComponent {
  const factors: HealthFactor[] = [];
  let score = 0;
  
  // Items created (max 25 points)
  const itemPoints = Math.min(25, Math.round((input.itemCount / 50) * 25));
  factors.push({
    name: 'Items created',
    value: input.itemCount,
    impact: input.itemCount >= 20 ? 'positive' : input.itemCount >= 5 ? 'neutral' : 'negative',
    points: itemPoints,
    explanation: input.itemCount >= 50 
      ? 'Excellent item catalog depth'
      : input.itemCount >= 20 
        ? 'Good item catalog'
        : input.itemCount >= 5
          ? 'Basic item setup'
          : 'Limited item setup - needs attention',
  });
  score += itemPoints;
  
  // Kanban cards (max 30 points)
  const kanbanPoints = Math.min(30, Math.round((input.kanbanCardCount / 100) * 30));
  factors.push({
    name: 'Kanban cards',
    value: input.kanbanCardCount,
    impact: input.kanbanCardCount >= 50 ? 'positive' : input.kanbanCardCount >= 10 ? 'neutral' : 'negative',
    points: kanbanPoints,
    explanation: input.kanbanCardCount >= 100
      ? 'Heavy kanban workflow adoption'
      : input.kanbanCardCount >= 50
        ? 'Active kanban usage'
        : input.kanbanCardCount >= 10
          ? 'Beginning to use kanban'
          : 'Minimal kanban adoption',
  });
  score += kanbanPoints;
  
  // Orders placed (max 30 points)
  const orderPoints = Math.min(30, Math.round((input.orderCount / 20) * 30));
  factors.push({
    name: 'Orders placed',
    value: input.orderCount,
    impact: input.orderCount >= 10 ? 'positive' : input.orderCount >= 1 ? 'neutral' : 'negative',
    points: orderPoints,
    explanation: input.orderCount >= 20
      ? 'Strong ordering activity - delivering value'
      : input.orderCount >= 10
        ? 'Regular ordering'
        : input.orderCount >= 1
          ? 'Started placing orders'
          : 'No orders yet - key adoption milestone missing',
  });
  score += orderPoints;
  
  // Onboarding velocity bonus (max 15 points)
  const velocityBonus = calculateVelocityBonus(input);
  if (velocityBonus > 0) {
    factors.push({
      name: 'Onboarding velocity',
      value: `${input.accountAgeDays} days`,
      impact: 'positive',
      points: velocityBonus,
      explanation: 'Fast adoption relative to account age',
    });
    score += velocityBonus;
  }
  
  return {
    score: Math.min(100, score),
    weight: 0,
    weightedScore: 0,
    trend: 'stable',
    factors,
    dataPoints: factors.length,
    lastUpdated: new Date().toISOString(),
  };
}

function calculateEngagementScore(input: HealthScoringInput): HealthComponent {
  const factors: HealthFactor[] = [];
  let score = 0;
  
  // Recency (max 35 points)
  const recencyPoints = Math.max(0, 35 - Math.min(35, input.daysSinceLastActivity * 2.5));
  factors.push({
    name: 'Days since last activity',
    value: input.daysSinceLastActivity,
    impact: input.daysSinceLastActivity <= 3 ? 'positive' : input.daysSinceLastActivity <= 14 ? 'neutral' : 'negative',
    points: Math.round(recencyPoints),
    explanation: input.daysSinceLastActivity <= 3
      ? 'Very recent activity'
      : input.daysSinceLastActivity <= 7
        ? 'Active this week'
        : input.daysSinceLastActivity <= 14
          ? 'Some recent activity'
          : `No activity for ${input.daysSinceLastActivity} days - potential churn risk`,
  });
  score += recencyPoints;
  
  // User breadth (max 30 points)
  const userBreadth = input.totalUsers > 0 
    ? (input.activeUsersLast30Days / input.totalUsers) 
    : 0;
  const breadthPoints = Math.round(userBreadth * 30);
  factors.push({
    name: 'Monthly active user ratio',
    value: `${input.activeUsersLast30Days}/${input.totalUsers}`,
    impact: userBreadth >= 0.5 ? 'positive' : userBreadth >= 0.25 ? 'neutral' : 'negative',
    points: breadthPoints,
    explanation: userBreadth >= 0.75
      ? 'Most users are active'
      : userBreadth >= 0.5
        ? 'Good user engagement'
        : userBreadth >= 0.25
          ? 'Some user engagement'
          : 'Low user adoption across the team',
  });
  score += breadthPoints;
  
  // Weekly active users (max 20 points)
  const wauPoints = Math.min(20, input.activeUsersLast7Days * 4);
  factors.push({
    name: 'Weekly active users',
    value: input.activeUsersLast7Days,
    impact: input.activeUsersLast7Days >= 3 ? 'positive' : input.activeUsersLast7Days >= 1 ? 'neutral' : 'negative',
    points: wauPoints,
    explanation: input.activeUsersLast7Days >= 5
      ? 'Strong weekly engagement'
      : input.activeUsersLast7Days >= 3
        ? 'Regular weekly usage'
        : input.activeUsersLast7Days >= 1
          ? 'At least one weekly user'
          : 'No activity this week',
  });
  score += wauPoints;
  
  // User count bonus (max 15 points)
  const userCountPoints = Math.min(15, input.totalUsers * 3);
  factors.push({
    name: 'Total users',
    value: input.totalUsers,
    impact: input.totalUsers >= 5 ? 'positive' : input.totalUsers >= 2 ? 'neutral' : 'negative',
    points: userCountPoints,
    explanation: input.totalUsers >= 5
      ? 'Good team adoption'
      : input.totalUsers >= 2
        ? 'Multiple users'
        : 'Single user - concentration risk',
  });
  score += userCountPoints;
  
  return {
    score: Math.min(100, Math.round(score)),
    weight: 0,
    weightedScore: 0,
    trend: 'stable',
    factors,
    dataPoints: factors.length,
    lastUpdated: new Date().toISOString(),
  };
}

function calculateRelationshipScore(input: HealthScoringInput): HealthComponent {
  const factors: HealthFactor[] = [];
  let score = 50; // Start at neutral if no data
  
  // CS touch recency (max 40 points)
  if (input.daysSinceLastCSContact !== undefined) {
    const touchPoints = Math.max(0, 40 - Math.min(40, input.daysSinceLastCSContact * 1.5));
    factors.push({
      name: 'Days since last CS contact',
      value: input.daysSinceLastCSContact,
      impact: input.daysSinceLastCSContact <= 14 ? 'positive' : input.daysSinceLastCSContact <= 30 ? 'neutral' : 'negative',
      points: Math.round(touchPoints),
      explanation: input.daysSinceLastCSContact <= 14
        ? 'Recent CS engagement'
        : input.daysSinceLastCSContact <= 30
          ? 'Contacted this month'
          : 'Overdue for CS touch',
    });
    score = touchPoints;
  } else {
    factors.push({
      name: 'CS contact data',
      value: 'Missing',
      impact: 'neutral',
      points: 25,
      explanation: 'No CS interaction data - using neutral score',
    });
  }
  
  // Interaction frequency (max 30 points)
  if (input.interactionCountLast30Days !== undefined) {
    const interactionPoints = Math.min(30, input.interactionCountLast30Days * 10);
    factors.push({
      name: 'Interactions last 30 days',
      value: input.interactionCountLast30Days,
      impact: input.interactionCountLast30Days >= 2 ? 'positive' : input.interactionCountLast30Days >= 1 ? 'neutral' : 'negative',
      points: interactionPoints,
      explanation: input.interactionCountLast30Days >= 3
        ? 'High-touch engagement'
        : input.interactionCountLast30Days >= 1
          ? 'Regular engagement'
          : 'No recent interactions',
    });
    score += interactionPoints;
  }
  
  // Champion presence (30 points)
  if (input.hasChampion !== undefined) {
    const championPoints = input.hasChampion ? 30 : 0;
    factors.push({
      name: 'Champion identified',
      value: input.hasChampion ? 'Yes' : 'No',
      impact: input.hasChampion ? 'positive' : 'negative',
      points: championPoints,
      explanation: input.hasChampion
        ? 'Has identified champion'
        : 'No champion - relationship risk',
    });
    score += championPoints;
  }
  
  return {
    score: Math.min(100, Math.round(score)),
    weight: 0,
    weightedScore: 0,
    trend: 'stable',
    factors,
    dataPoints: factors.length,
    lastUpdated: new Date().toISOString(),
  };
}

function calculateSupportScore(input: HealthScoringInput): HealthComponent {
  const factors: HealthFactor[] = [];
  let score = 80; // Start healthy if no support data (no tickets = good)
  
  // Open tickets penalty
  if (input.openTickets !== undefined) {
    const ticketPenalty = Math.min(40, input.openTickets * 10);
    const ticketPoints = Math.max(0, 40 - ticketPenalty);
    factors.push({
      name: 'Open support tickets',
      value: input.openTickets,
      impact: input.openTickets === 0 ? 'positive' : input.openTickets <= 2 ? 'neutral' : 'negative',
      points: ticketPoints,
      explanation: input.openTickets === 0
        ? 'No open tickets'
        : input.openTickets <= 2
          ? 'Normal ticket volume'
          : 'High ticket volume - frustration risk',
    });
    score = 60 + ticketPoints;
  }
  
  // Critical tickets severe penalty
  if (input.criticalTickets !== undefined && input.criticalTickets > 0) {
    const criticalPenalty = input.criticalTickets * 20;
    factors.push({
      name: 'Critical tickets',
      value: input.criticalTickets,
      impact: 'negative',
      points: -criticalPenalty,
      explanation: `${input.criticalTickets} critical issue(s) requiring immediate attention`,
    });
    score = Math.max(0, score - criticalPenalty);
  }
  
  // CSAT bonus/penalty
  if (input.csat !== undefined) {
    const csatPoints = Math.round((input.csat / 100) * 30);
    factors.push({
      name: 'CSAT score',
      value: `${input.csat}%`,
      impact: input.csat >= 80 ? 'positive' : input.csat >= 60 ? 'neutral' : 'negative',
      points: csatPoints,
      explanation: input.csat >= 80
        ? 'High customer satisfaction'
        : input.csat >= 60
          ? 'Adequate satisfaction'
          : 'Low satisfaction - action needed',
    });
    score = Math.round((score * 0.7) + (csatPoints * 0.3));
  }
  
  if (factors.length === 0) {
    factors.push({
      name: 'Support data',
      value: 'No data',
      impact: 'neutral',
      points: 80,
      explanation: 'No support tickets or data - assuming healthy',
    });
  }
  
  return {
    score: Math.min(100, Math.max(0, Math.round(score))),
    weight: 0,
    weightedScore: 0,
    trend: 'stable',
    factors,
    dataPoints: factors.length,
    lastUpdated: new Date().toISOString(),
  };
}

function calculateCommercialScore(input: HealthScoringInput): HealthComponent {
  const factors: HealthFactor[] = [];
  let score = 70; // Start neutral-positive if no data
  
  // Payment status (40 points)
  if (input.paymentStatus && input.paymentStatus !== 'unknown') {
    const paymentPoints = {
      current: 40,
      overdue: 10,
      at_risk: 25,
    }[input.paymentStatus] || 40;
    
    factors.push({
      name: 'Payment status',
      value: input.paymentStatus,
      impact: input.paymentStatus === 'current' ? 'positive' : 'negative',
      points: paymentPoints,
      explanation: input.paymentStatus === 'current'
        ? 'Payments current'
        : input.paymentStatus === 'overdue'
          ? 'Payment overdue - churn risk'
          : 'Payment at risk',
    });
    score = paymentPoints + 30;
  }
  
  // Renewal proximity (30 points)
  if (input.daysToRenewal !== undefined) {
    let renewalPoints = 30;
    let renewalExplanation = 'Renewal not imminent';
    let renewalImpact: 'positive' | 'neutral' | 'negative' = 'positive';
    
    if (input.daysToRenewal <= 30) {
      renewalPoints = 10;
      renewalExplanation = 'Renewal in <30 days - requires attention';
      renewalImpact = 'negative';
    } else if (input.daysToRenewal <= 60) {
      renewalPoints = 20;
      renewalExplanation = 'Renewal approaching in 30-60 days';
      renewalImpact = 'neutral';
    } else if (input.daysToRenewal <= 90) {
      renewalPoints = 25;
      renewalExplanation = 'Renewal in 60-90 days - plan ahead';
      renewalImpact = 'neutral';
    }
    
    factors.push({
      name: 'Days to renewal',
      value: input.daysToRenewal,
      impact: renewalImpact,
      points: renewalPoints,
      explanation: renewalExplanation,
    });
    score = Math.round((score * 0.6) + (renewalPoints * 0.4));
  }
  
  if (factors.length === 0) {
    factors.push({
      name: 'Commercial data',
      value: 'No data',
      impact: 'neutral',
      points: 70,
      explanation: 'No commercial data available - using neutral score',
    });
  }
  
  return {
    score: Math.min(100, Math.max(0, Math.round(score))),
    weight: 0,
    weightedScore: 0,
    trend: 'stable',
    factors,
    dataPoints: factors.length,
    lastUpdated: new Date().toISOString(),
  };
}

// ============================================================================
// Helper Functions
// ============================================================================

function calculateVelocityBonus(input: HealthScoringInput): number {
  const totalActivity = input.itemCount + input.kanbanCardCount + input.orderCount;
  const activityPerDay = totalActivity / Math.max(1, input.accountAgeDays);
  
  if (activityPerDay >= 2) return 15;
  if (activityPerDay >= 1) return 10;
  if (activityPerDay >= 0.5) return 5;
  return 0;
}

function scoreToGrade(score: number, thresholds: HealthScoringConfig['gradeThresholds']): HealthGrade {
  if (score >= thresholds.A) return 'A';
  if (score >= thresholds.B) return 'B';
  if (score >= thresholds.C) return 'C';
  if (score >= thresholds.D) return 'D';
  return 'F';
}

function calculateTrend(scoreChange: number): HealthTrend {
  if (scoreChange >= 5) return 'improving';
  if (scoreChange <= -5) return 'declining';
  return 'stable';
}

function generateChangeReason(
  components: AccountHealth['components'],
  scoreChange: number
): string {
  if (Math.abs(scoreChange) < 3) {
    return 'Score is stable';
  }
  
  // Find the component with the biggest change (simplified - would track deltas in production)
  const componentNames = Object.keys(components) as (keyof AccountHealth['components'])[];
  const lowestComponent = componentNames.reduce((a, b) => 
    components[a].score < components[b].score ? a : b
  );
  
  if (scoreChange < 0) {
    return `Score declined, primarily due to ${lowestComponent} (${components[lowestComponent].score}/100)`;
  } else {
    return `Score improved across components`;
  }
}

function calculateConfidence(input: HealthScoringInput): number {
  let dataPoints = 0;
  let possiblePoints = 0;
  
  // Core metrics (always have)
  dataPoints += 4; possiblePoints += 4;
  
  // Optional metrics
  possiblePoints += 6;
  if (input.daysSinceLastCSContact !== undefined) dataPoints++;
  if (input.interactionCountLast30Days !== undefined) dataPoints++;
  if (input.hasChampion !== undefined) dataPoints++;
  if (input.openTickets !== undefined) dataPoints++;
  if (input.paymentStatus !== undefined) dataPoints++;
  if (input.daysToRenewal !== undefined) dataPoints++;
  
  return Math.round((dataPoints / possiblePoints) * 100);
}

function determineDataFreshness(input: HealthScoringInput): DataFreshness {
  if (input.daysSinceLastActivity <= 1) return 'fresh';
  if (input.daysSinceLastActivity <= 7) return 'stale';
  if (input.daysSinceLastActivity <= 30) return 'outdated';
  return 'missing';
}
