/**
 * Alert Generation Engine
 * 
 * Generates actionable alerts from account metrics.
 * Each alert includes evidence, suggested actions, and SLA information.
 */

import type {
  Alert,
  AlertType,
  AlertCategory,
  AlertSeverity,
  AccountHealth,
  UsageMetrics,
  CommercialMetrics,
  SupportMetrics,
} from '../../src/lib/types/account';

// ============================================================================
// Alert Generation Input
// ============================================================================

export interface AlertGenerationInput {
  accountId: string;
  accountName: string;
  
  // Health data
  health?: AccountHealth;
  previousHealth?: AccountHealth;
  
  // Usage data
  usage?: UsageMetrics;
  
  // Commercial data
  commercial?: CommercialMetrics;
  
  // Support data
  support?: SupportMetrics;
  
  // Context
  accountAgeDays: number;
  tier?: string;
  segment?: string;
  arr?: number;
  ownerId?: string;
  ownerName?: string;
}

// ============================================================================
// Alert Definitions
// ============================================================================

interface AlertDefinition {
  type: AlertType;
  category: AlertCategory;
  check: (input: AlertGenerationInput) => AlertCheckResult | null;
}

interface AlertCheckResult {
  severity: AlertSeverity;
  title: string;
  description: string;
  evidence: string[];
  suggestedAction: string;
  playbook?: string;
  slaHours?: number;
}

const ALERT_DEFINITIONS: AlertDefinition[] = [
  // ============================================================================
  // CHURN RISK ALERTS
  // ============================================================================
  {
    type: 'churn_risk',
    category: 'risk',
    check: (input) => {
      const daysInactive = input.usage?.daysSinceLastActivity ?? 0;
      
      if (daysInactive >= 30) {
        return {
          severity: 'critical',
          title: 'High churn risk - No activity for 30+ days',
          description: `${input.accountName} has had no product activity for ${daysInactive} days. This is a strong indicator of potential churn.`,
          evidence: [
            `${daysInactive} days since last activity`,
            `Last active users: ${input.usage?.activeUsersLast30Days ?? 0}`,
            input.health ? `Health score: ${input.health.score}` : 'No health data',
          ],
          suggestedAction: 'Immediately reach out to understand blockers and re-engage the customer',
          playbook: 'churn-intervention',
          slaHours: 24,
        };
      }
      
      if (daysInactive >= 14) {
        return {
          severity: 'high',
          title: 'Churn risk - No activity for 14+ days',
          description: `${input.accountName} has had no product activity for ${daysInactive} days.`,
          evidence: [
            `${daysInactive} days since last activity`,
            `Weekly active users: ${input.usage?.activeUsersLast7Days ?? 0}`,
          ],
          suggestedAction: 'Schedule a check-in call to understand if there are any issues',
          playbook: 'reengagement',
          slaHours: 48,
        };
      }
      
      return null;
    },
  },
  
  // ============================================================================
  // HEALTH DROP ALERTS
  // ============================================================================
  {
    type: 'health_drop',
    category: 'risk',
    check: (input) => {
      if (!input.health || !input.previousHealth) return null;
      
      const drop = input.previousHealth.score - input.health.score;
      
      if (drop >= 20) {
        return {
          severity: 'critical',
          title: 'Significant health score drop',
          description: `${input.accountName}'s health score dropped ${drop} points from ${input.previousHealth.score} to ${input.health.score}.`,
          evidence: [
            `Score change: ${input.previousHealth.score} → ${input.health.score}`,
            input.health.changeReason || 'Multiple factors contributing',
            ...Object.entries(input.health.components)
              .filter(([, component]) => component.score < 50)
              .map(([name, component]) => `${name}: ${component.score}/100`),
          ],
          suggestedAction: 'Review account activity and reach out to understand what changed',
          playbook: 'health-recovery',
          slaHours: 24,
        };
      }
      
      if (drop >= 10) {
        return {
          severity: 'high',
          title: 'Health score declining',
          description: `${input.accountName}'s health score dropped ${drop} points.`,
          evidence: [
            `Score change: ${input.previousHealth.score} → ${input.health.score}`,
            input.health.changeReason || 'Score declining',
          ],
          suggestedAction: 'Monitor closely and prepare intervention if decline continues',
          slaHours: 72,
        };
      }
      
      return null;
    },
  },
  
  // ============================================================================
  // LOW ENGAGEMENT ALERTS
  // ============================================================================
  {
    type: 'low_engagement',
    category: 'risk',
    check: (input) => {
      if (!input.usage) return null;
      
      const { totalUsers, activeUsersLast30Days } = input.usage;
      
      if (totalUsers > 0 && activeUsersLast30Days === 0) {
        return {
          severity: 'high',
          title: 'No active users in 30 days',
          description: `${input.accountName} has ${totalUsers} users but none have been active in the last 30 days.`,
          evidence: [
            `Total users: ${totalUsers}`,
            `Monthly active: 0`,
            `Days since activity: ${input.usage.daysSinceLastActivity}`,
          ],
          suggestedAction: 'Reach out to understand if there are adoption blockers or training needs',
          playbook: 'adoption-boost',
          slaHours: 48,
        };
      }
      
      const engagementRate = totalUsers > 0 ? activeUsersLast30Days / totalUsers : 0;
      
      if (totalUsers >= 3 && engagementRate < 0.2) {
        return {
          severity: 'medium',
          title: 'Low user engagement',
          description: `Only ${Math.round(engagementRate * 100)}% of users at ${input.accountName} are active.`,
          evidence: [
            `Total users: ${totalUsers}`,
            `Monthly active: ${activeUsersLast30Days}`,
            `Engagement rate: ${Math.round(engagementRate * 100)}%`,
          ],
          suggestedAction: 'Consider offering training or identifying champions to drive adoption',
          playbook: 'user-activation',
          slaHours: 168,
        };
      }
      
      return null;
    },
  },
  
  // ============================================================================
  // ONBOARDING STALLED ALERTS
  // ============================================================================
  {
    type: 'onboarding_stalled',
    category: 'action_required',
    check: (input) => {
      // Only for accounts in early lifecycle
      if (input.accountAgeDays > 60) return null;
      if (!input.usage) return null;
      
      const { itemCount, kanbanCardCount, orderCount } = input.usage;
      const hasBasicSetup = itemCount >= 5;
      const hasWorkflow = kanbanCardCount >= 1;
      const hasValue = orderCount >= 1;
      
      // Check for stalled at different stages
      if (input.accountAgeDays >= 14 && !hasBasicSetup) {
        return {
          severity: 'high',
          title: 'Onboarding stalled - No item setup',
          description: `${input.accountName} signed up ${input.accountAgeDays} days ago but has only ${itemCount} items.`,
          evidence: [
            `Account age: ${input.accountAgeDays} days`,
            `Items created: ${itemCount}`,
            'Expected: 5+ items by day 14',
          ],
          suggestedAction: 'Offer hands-on onboarding assistance or data import help',
          playbook: 'onboarding-assist',
          slaHours: 24,
        };
      }
      
      if (input.accountAgeDays >= 21 && hasBasicSetup && !hasWorkflow) {
        return {
          severity: 'medium',
          title: 'Onboarding stalled - No kanban adoption',
          description: `${input.accountName} has items but hasn't started using kanban workflows yet.`,
          evidence: [
            `Account age: ${input.accountAgeDays} days`,
            `Items: ${itemCount}`,
            `Kanban cards: ${kanbanCardCount}`,
          ],
          suggestedAction: 'Schedule a kanban workflow training session',
          playbook: 'kanban-onboarding',
          slaHours: 72,
        };
      }
      
      if (input.accountAgeDays >= 30 && hasWorkflow && !hasValue) {
        return {
          severity: 'medium',
          title: 'Onboarding stalled - No orders placed',
          description: `${input.accountName} is using kanban but hasn't placed any orders yet.`,
          evidence: [
            `Account age: ${input.accountAgeDays} days`,
            `Kanban cards: ${kanbanCardCount}`,
            `Orders: ${orderCount}`,
          ],
          suggestedAction: 'Guide customer through placing their first order',
          playbook: 'first-order',
          slaHours: 72,
        };
      }
      
      return null;
    },
  },
  
  // ============================================================================
  // RENEWAL APPROACHING ALERTS
  // ============================================================================
  {
    type: 'renewal_approaching',
    category: 'action_required',
    check: (input) => {
      if (!input.commercial?.daysToRenewal) return null;
      
      const daysToRenewal = input.commercial.daysToRenewal;
      
      if (daysToRenewal <= 30) {
        const healthRisk = input.health && input.health.score < 60;
        return {
          severity: healthRisk ? 'critical' : 'high',
          title: `Renewal in ${daysToRenewal} days${healthRisk ? ' - At risk' : ''}`,
          description: `${input.accountName}'s contract renews in ${daysToRenewal} days.${
            healthRisk ? ' Health score is low, indicating potential churn risk.' : ''
          }`,
          evidence: [
            `Renewal date: ${input.commercial.renewalDate}`,
            `Days remaining: ${daysToRenewal}`,
            input.health ? `Health score: ${input.health.score}` : 'No health data',
            input.commercial.arr ? `ARR: $${input.commercial.arr.toLocaleString()}` : '',
          ].filter(Boolean),
          suggestedAction: healthRisk
            ? 'Urgent: Begin renewal conversation and address health concerns'
            : 'Initiate renewal discussion and confirm expansion opportunities',
          playbook: 'renewal',
          slaHours: 24,
        };
      }
      
      if (daysToRenewal <= 60) {
        return {
          severity: 'medium',
          title: `Renewal in ${daysToRenewal} days`,
          description: `${input.accountName}'s contract renews in ${daysToRenewal} days. Start planning renewal conversation.`,
          evidence: [
            `Renewal date: ${input.commercial.renewalDate}`,
            `Days remaining: ${daysToRenewal}`,
          ],
          suggestedAction: 'Schedule renewal planning call and gather success metrics',
          playbook: 'renewal-prep',
          slaHours: 168,
        };
      }
      
      if (daysToRenewal <= 90) {
        return {
          severity: 'low',
          title: `Renewal in ${daysToRenewal} days`,
          description: `${input.accountName}'s contract renews in ${daysToRenewal} days.`,
          evidence: [
            `Renewal date: ${input.commercial.renewalDate}`,
          ],
          suggestedAction: 'Add to upcoming renewals list and begin value documentation',
        };
      }
      
      return null;
    },
  },
  
  // ============================================================================
  // EXPANSION OPPORTUNITY ALERTS
  // ============================================================================
  {
    type: 'expansion_opportunity',
    category: 'opportunity',
    check: (input) => {
      if (!input.usage) return null;
      
      const signals: string[] = [];
      let strength = 0;
      
      // High usage signal
      const totalActivity = input.usage.itemCount + input.usage.kanbanCardCount + input.usage.orderCount;
      if (totalActivity >= 100) {
        signals.push(`High activity: ${totalActivity} total actions`);
        strength += 2;
      }
      
      // Multiple active users
      if (input.usage.activeUsersLast30Days >= 5) {
        signals.push(`${input.usage.activeUsersLast30Days} monthly active users`);
        strength += 1;
      }
      
      // Regular ordering
      if (input.usage.orderCount >= 10) {
        signals.push(`${input.usage.orderCount} orders placed - strong value realization`);
        strength += 2;
      }
      
      // Healthy account
      if (input.health && input.health.score >= 80) {
        signals.push(`Health score: ${input.health.score} (A grade)`);
        strength += 1;
      }
      
      if (strength >= 4) {
        return {
          severity: 'medium',
          title: 'Strong expansion opportunity',
          description: `${input.accountName} is showing strong adoption signals that indicate expansion potential.`,
          evidence: signals,
          suggestedAction: 'Schedule success review and explore expansion opportunities (additional seats, features, or sites)',
          playbook: 'expansion',
          slaHours: 168,
        };
      }
      
      if (strength >= 2) {
        return {
          severity: 'low',
          title: 'Potential expansion opportunity',
          description: `${input.accountName} is showing good adoption that may indicate expansion readiness.`,
          evidence: signals,
          suggestedAction: 'Monitor for continued growth and prepare expansion discussion',
        };
      }
      
      return null;
    },
  },
  
  // ============================================================================
  // SUPPORT ESCALATION ALERTS
  // ============================================================================
  {
    type: 'support_escalation',
    category: 'action_required',
    check: (input) => {
      if (!input.support) return null;
      
      if (input.support.criticalTickets > 0) {
        return {
          severity: 'critical',
          title: `${input.support.criticalTickets} critical support ticket(s)`,
          description: `${input.accountName} has ${input.support.criticalTickets} critical support issue(s) that require immediate attention.`,
          evidence: [
            `Critical tickets: ${input.support.criticalTickets}`,
            `Total open tickets: ${input.support.openTickets}`,
            input.support.escalationCount > 0 ? `Escalations: ${input.support.escalationCount}` : '',
          ].filter(Boolean),
          suggestedAction: 'Coordinate with support team and proactively reach out to customer',
          playbook: 'support-escalation',
          slaHours: 4,
        };
      }
      
      if (input.support.openTickets >= 5) {
        return {
          severity: 'high',
          title: 'High support ticket volume',
          description: `${input.accountName} has ${input.support.openTickets} open support tickets.`,
          evidence: [
            `Open tickets: ${input.support.openTickets}`,
            `Tickets last 30 days: ${input.support.ticketsLast30Days}`,
          ],
          suggestedAction: 'Review ticket patterns and reach out to understand systematic issues',
          playbook: 'support-review',
          slaHours: 24,
        };
      }
      
      return null;
    },
  },
  
  // ============================================================================
  // USAGE DECLINE ALERTS
  // ============================================================================
  {
    type: 'usage_decline',
    category: 'risk',
    check: (input) => {
      if (!input.usage?.activityTimeline || input.usage.activityTimeline.length < 4) {
        return null;
      }
      
      const timeline = input.usage.activityTimeline;
      const recentWeeks = timeline.slice(-4);
      const olderWeeks = timeline.slice(-8, -4);
      
      if (olderWeeks.length === 0) return null;
      
      const recentAvg = recentWeeks.reduce((sum, d) => 
        sum + d.items + d.kanbanCards + d.orders, 0) / recentWeeks.length;
      const olderAvg = olderWeeks.reduce((sum, d) => 
        sum + d.items + d.kanbanCards + d.orders, 0) / olderWeeks.length;
      
      if (olderAvg > 10 && recentAvg < olderAvg * 0.5) {
        const declinePercent = Math.round((1 - recentAvg / olderAvg) * 100);
        return {
          severity: 'high',
          title: `Usage declined ${declinePercent}%`,
          description: `${input.accountName}'s activity has dropped significantly over the past month.`,
          evidence: [
            `Recent weekly average: ${recentAvg.toFixed(1)} actions`,
            `Previous weekly average: ${olderAvg.toFixed(1)} actions`,
            `Decline: ${declinePercent}%`,
          ],
          suggestedAction: 'Investigate cause of decline and reach out to re-engage',
          playbook: 'usage-recovery',
          slaHours: 48,
        };
      }
      
      return null;
    },
  },
  
  // ============================================================================
  // PAYMENT OVERDUE ALERTS
  // ============================================================================
  {
    type: 'payment_overdue',
    category: 'action_required',
    check: (input) => {
      if (!input.commercial) return null;
      
      const { paymentStatus, overdueAmount } = input.commercial;
      
      if (paymentStatus === 'overdue' && overdueAmount && overdueAmount > 0) {
        const isHighValue = input.arr && input.arr >= 10000;
        return {
          severity: isHighValue ? 'critical' : 'high',
          title: `Payment overdue - $${overdueAmount.toLocaleString()}`,
          description: `${input.accountName} has an overdue balance of $${overdueAmount.toLocaleString()}.${
            isHighValue ? ' This is a high-value account requiring immediate attention.' : ''
          }`,
          evidence: [
            `Overdue amount: $${overdueAmount.toLocaleString()}`,
            `Payment status: ${paymentStatus}`,
            input.arr ? `ARR: $${input.arr.toLocaleString()}` : '',
            input.commercial.lastPaymentDate ? `Last payment: ${input.commercial.lastPaymentDate}` : '',
          ].filter(Boolean),
          suggestedAction: 'Coordinate with finance team and reach out to understand payment situation',
          playbook: 'payment-recovery',
          slaHours: isHighValue ? 24 : 48,
        };
      }
      
      if (paymentStatus === 'at_risk') {
        return {
          severity: 'medium',
          title: 'Payment at risk',
          description: `${input.accountName}'s payment status indicates potential issues.`,
          evidence: [
            `Payment status: ${paymentStatus}`,
            input.commercial.lastPaymentDate ? `Last payment: ${input.commercial.lastPaymentDate}` : 'No recent payment on file',
          ].filter(Boolean),
          suggestedAction: 'Monitor payment status and prepare to engage if payment fails',
          slaHours: 72,
        };
      }
      
      return null;
    },
  },
  
  // ============================================================================
  // CHAMPION LEFT ALERTS
  // ============================================================================
  {
    type: 'champion_left',
    category: 'risk',
    check: (input) => {
      // This alert requires stakeholder tracking data
      // For now, we detect this through sudden activity drops from key users
      // In production, this would integrate with CRM contact change events
      
      if (!input.usage) return null;
      
      // If we have stakeholder data indicating a champion departure
      // This is a placeholder for when stakeholder tracking is implemented
      // The actual detection would come from CRM webhooks or manual input
      
      // Heuristic: If a highly active account suddenly has no activity
      // and it's not a new account, this might indicate key person left
      const wasActive = input.usage.activeUsersLast30Days === 0 && 
                       input.usage.totalUsers > 3 &&
                       input.accountAgeDays > 90;
      
      if (wasActive && input.usage.daysSinceLastActivity >= 21) {
        return {
          severity: 'high',
          title: 'Potential champion departure',
          description: `${input.accountName} was previously active but has gone silent. A key stakeholder may have left.`,
          evidence: [
            `No active users in last 30 days (previously had ${input.usage.totalUsers} users)`,
            `Days since last activity: ${input.usage.daysSinceLastActivity}`,
            'Recommend verifying stakeholder contacts',
          ],
          suggestedAction: 'Verify key contacts are still at the company and identify new champion if needed',
          playbook: 'champion-recovery',
          slaHours: 48,
        };
      }
      
      return null;
    },
  },
];

// ============================================================================
// Alert Generation
// ============================================================================

/**
 * Generate all applicable alerts for an account.
 */
export function generateAlerts(input: AlertGenerationInput): Alert[] {
  const alerts: Alert[] = [];
  const now = new Date().toISOString();
  
  for (const definition of ALERT_DEFINITIONS) {
    try {
      const result = definition.check(input);
      
      if (result) {
        alerts.push({
          id: `${definition.type}-${input.accountId}-${Date.now()}`,
          accountId: input.accountId,
          type: definition.type,
          category: definition.category,
          severity: result.severity,
          title: result.title,
          description: result.description,
          evidence: result.evidence,
          suggestedAction: result.suggestedAction,
          playbook: result.playbook,
          ownerId: input.ownerId,
          ownerName: input.ownerName,
          slaDeadline: result.slaHours 
            ? new Date(Date.now() + result.slaHours * 60 * 60 * 1000).toISOString()
            : undefined,
          slaStatus: result.slaHours ? 'on_track' : 'none',
          status: 'open',
          createdAt: now,
          arrAtRisk: definition.category === 'risk' ? input.arr : undefined,
        });
      }
    } catch (error) {
      console.error(`Error checking alert ${definition.type}:`, error);
    }
  }
  
  // Sort by severity (critical first) then by ARR at risk
  alerts.sort((a, b) => {
    const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
    const severityDiff = severityOrder[a.severity] - severityOrder[b.severity];
    if (severityDiff !== 0) return severityDiff;
    
    return (b.arrAtRisk || 0) - (a.arrAtRisk || 0);
  });
  
  return alerts;
}
