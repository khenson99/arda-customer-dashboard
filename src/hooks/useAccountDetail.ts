/**
 * Account Detail Hook
 * 
 * React Query hook for fetching full account details.
 * Falls back to legacy API if new API is unavailable.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  fetchAccountDetail, 
  queryKeys, 
  defaultQueryOptions,
} from '../lib/api/cs-api';
import { fetchCustomerDetails, type CustomerDetails } from '../lib/arda-client';
import type { 
  AccountDetail, 
  AccountHealth, 
  UsageMetrics, 
  TimelineEvent,
  Stakeholder,
  Interaction,
  Task,
  Alert,
  AlertType,
} from '../lib/types/account';

// Track whether we should use the new API
let useNewApi = true;
const allowLegacyFallback = !import.meta.env.PROD;

/**
 * Generate alerts based on account data.
 * Mirrors the alert generation logic in arda-client.ts fetchCustomerMetrics.
 */
function generateAlertsFromDetails(
  details: CustomerDetails,
  tenantId: string,
  healthScore: number,
  daysInactive: number,
  accountAgeDays: number
): Alert[] {
  const alerts: Alert[] = [];
  const now = new Date().toISOString();
  const itemCount = details.items.length;
  const kanbanCount = details.kanbanCards.length;
  const totalActivity = itemCount + kanbanCount;
  const stage = details.stage;

  // Churn Risk: No activity for 14+ days
  if (daysInactive >= 14) {
    alerts.push({
      id: `alert-churn-inactive-${tenantId}`,
      accountId: tenantId,
      type: 'churn_risk' as AlertType,
      category: 'risk',
      severity: daysInactive >= 30 ? 'critical' : 'high',
      title: `No activity for ${daysInactive} days`,
      description: 'Customer has not shown any product activity recently, which may indicate disengagement.',
      evidence: [`Last activity: ${daysInactive} days ago`, `Health score: ${healthScore}`],
      suggestedAction: 'Schedule a check-in call to re-engage the customer',
      slaStatus: daysInactive >= 30 ? 'at_risk' : 'on_track',
      status: 'open',
      createdAt: now,
    });
  }

  // Churn Risk: Low health score
  if (healthScore < 40) {
    alerts.push({
      id: `alert-churn-health-${tenantId}`,
      accountId: tenantId,
      type: 'health_drop' as AlertType,
      category: 'risk',
      severity: healthScore < 25 ? 'critical' : 'high',
      title: `Health score critically low (${healthScore})`,
      description: 'Account health has dropped to a concerning level requiring immediate attention.',
      evidence: [`Current health score: ${healthScore}`, `Stage: ${stage}`],
      suggestedAction: 'Review account activity and schedule intervention',
      slaStatus: healthScore < 25 ? 'at_risk' : 'on_track',
      status: 'open',
      createdAt: now,
    });
  }

  // Onboarding Stalled: Few items after account creation
  if (accountAgeDays > 7 && itemCount < 5 && stage !== 'live') {
    alerts.push({
      id: `alert-onboarding-${tenantId}`,
      accountId: tenantId,
      type: 'onboarding_stalled' as AlertType,
      category: 'action_required',
      severity: accountAgeDays > 14 ? 'high' : 'medium',
      title: `Onboarding stalled - only ${itemCount} items after ${accountAgeDays} days`,
      description: 'Customer appears to be stuck in onboarding with minimal product adoption.',
      evidence: [`Items created: ${itemCount}`, `Account age: ${accountAgeDays} days`, `Stage: ${stage}`],
      suggestedAction: 'Offer onboarding assistance or training session',
      slaStatus: 'on_track',
      status: 'open',
      createdAt: now,
    });
  }

  // Low Engagement: Account exists but minimal usage
  if (accountAgeDays > 30 && totalActivity < 10 && daysInactive >= 7) {
    alerts.push({
      id: `alert-low-engagement-${tenantId}`,
      accountId: tenantId,
      type: 'low_engagement' as AlertType,
      category: 'risk',
      severity: 'medium',
      title: 'Low product engagement detected',
      description: 'Customer shows minimal product usage compared to expected benchmarks.',
      evidence: [`Total activity: ${totalActivity}`, `Days inactive: ${daysInactive}`],
      suggestedAction: 'Reach out to understand blockers and offer training',
      slaStatus: 'on_track',
      status: 'open',
      createdAt: now,
    });
  }

  // Expansion Opportunity: High activity and engagement
  if (totalActivity > 50 && details.users.length >= 3 && daysInactive < 7) {
    alerts.push({
      id: `alert-expansion-${tenantId}`,
      accountId: tenantId,
      type: 'expansion_opportunity' as AlertType,
      category: 'opportunity',
      severity: 'low',
      title: 'High engagement - expansion opportunity',
      description: 'Customer shows strong product adoption and may be ready for additional features.',
      evidence: [`Active users: ${details.users.length}`, `Total activity: ${totalActivity}`],
      suggestedAction: 'Consider upsell conversation for additional features',
      slaStatus: 'none',
      status: 'open',
      createdAt: now,
    });
  }

  return alerts;
}

/**
 * Transform legacy CustomerDetails to AccountDetail format.
 */
function transformLegacyToDetail(details: CustomerDetails, tenantId: string): AccountDetail {
  const now = new Date().toISOString();
  
  // Calculate days inactive and account age for alert generation
  const createdAtDate = new Date(details.createdAt);
  const accountAgeDays = Math.floor((Date.now() - createdAtDate.getTime()) / (1000 * 60 * 60 * 24));
  
  // Estimate days since last activity from item/kanban timestamps
  let lastActivityTime = createdAtDate.getTime();
  for (const item of details.items) {
    const itemTime = new Date(item.createdAt).getTime();
    if (itemTime > lastActivityTime) lastActivityTime = itemTime;
  }
  for (const card of details.kanbanCards) {
    const cardTime = new Date(card.createdAt).getTime();
    if (cardTime > lastActivityTime) lastActivityTime = cardTime;
  }
  const daysInactive = Math.floor((Date.now() - lastActivityTime) / (1000 * 60 * 60 * 24));
  
  // Build a basic health object
  const health: AccountHealth = {
    score: details.healthScore,
    grade: details.healthScore >= 80 ? 'A' : details.healthScore >= 65 ? 'B' : details.healthScore >= 50 ? 'C' : details.healthScore >= 35 ? 'D' : 'F',
    trend: 'stable',
    components: {
      adoption: { score: 50, weight: 0.3, weightedScore: 15, trend: 'stable', factors: [], dataPoints: 0, lastUpdated: now },
      engagement: { score: 50, weight: 0.25, weightedScore: 12.5, trend: 'stable', factors: [], dataPoints: 0, lastUpdated: now },
      relationship: { score: 50, weight: 0.15, weightedScore: 7.5, trend: 'stable', factors: [], dataPoints: 0, lastUpdated: now },
      support: { score: 80, weight: 0.15, weightedScore: 12, trend: 'stable', factors: [], dataPoints: 0, lastUpdated: now },
      commercial: { score: 70, weight: 0.15, weightedScore: 10.5, trend: 'stable', factors: [], dataPoints: 0, lastUpdated: now },
    },
    scoreChange: 0,
    calculatedAt: now,
    dataFreshness: 'stale',
    confidence: 50,
  };
  
  // Generate alerts based on account data
  const alerts = generateAlertsFromDetails(details, tenantId, details.healthScore, daysInactive, accountAgeDays);
  
  // Build usage metrics
  const usage: UsageMetrics = {
    itemCount: details.items.length,
    kanbanCardCount: details.kanbanCards.length,
    orderCount: 0,
    totalUsers: details.users.length,
    activeUsersLast7Days: Math.min(details.users.length, 1),
    activeUsersLast30Days: details.users.length,
    daysActive: accountAgeDays - daysInactive,
    daysSinceLastActivity: daysInactive,
    avgActionsPerDay: accountAgeDays > 0 ? (details.items.length + details.kanbanCards.length) / accountAgeDays : 0,
    featureAdoption: {
      items: Math.min(100, details.items.length * 2),
      kanban: Math.min(100, details.kanbanCards.length * 2),
      ordering: 0,
      receiving: 0,
      reporting: 0,
    },
    outcomes: {
      ordersPlaced: 0,
      ordersReceived: 0,
    },
    activityTimeline: [],
  };
  
  // Build timeline from items and kanban cards
  const timeline: TimelineEvent[] = [
    ...details.items.slice(-20).map((item): TimelineEvent => ({
      id: `item-${item.id}`,
      type: 'product_activity',
      timestamp: item.createdAt,
      title: 'Item created',
      description: item.name,
    })),
    ...details.kanbanCards.slice(-20).map((card): TimelineEvent => ({
      id: `card-${card.id}`,
      type: 'product_activity',
      timestamp: card.createdAt,
      title: 'Kanban card created',
      description: card.title,
      metadata: { state: card.status },
    })),
  ].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  
  // Build stakeholders from users
  const stakeholders: Stakeholder[] = details.users.map((user, index): Stakeholder => ({
    id: user.id,
    accountId: tenantId,
    name: user.name,
    email: user.email,
    role: index === 0 ? 'power_user' : 'end_user',
    isPrimary: index === 0,
    influence: index === 0 ? 'high' : 'medium',
  }));
  
  return {
    id: tenantId,
    name: details.companyName,
    segment: 'smb',
    tier: 'starter',
    tenantIds: [tenantId],
    primaryTenantId: tenantId,
    externalIds: {},
    createdAt: details.createdAt,
    updatedAt: now,
    lifecycleStage: details.stage === 'live' ? 'mature' : 'adoption',
    onboardingStatus: details.stage === 'live' ? 'completed' : 'in_progress',
    health,
    usage,
    commercial: {
      plan: details.plan,
      currency: 'USD',
      paymentStatus: details.status === 'ACTIVE' ? 'current' : 'unknown',
      expansionSignals: [],
      expansionPotential: 'none',
    },
    support: {
      openTickets: 0,
      ticketsLast30Days: 0,
      ticketsLast90Days: 0,
      criticalTickets: 0,
      highTickets: 0,
      normalTickets: 0,
      escalationCount: 0,
    },
    alerts,
    stakeholders,
    recentInteractions: [],
    openTasks: [],
    timeline,
  };
}

/**
 * Fetch account detail with fallback to legacy API.
 */
async function fetchAccountDetailWithFallback(accountId: string): Promise<AccountDetail> {
  if (useNewApi) {
    try {
      const result = await fetchAccountDetail(accountId);
      return result;
    } catch (error) {
      if (!allowLegacyFallback) {
        throw error;
      }
      console.warn('New account detail API failed, falling back to legacy:', error);
      useNewApi = false;
    }
  }
  
  if (!allowLegacyFallback) {
    throw new Error('Account detail API unavailable');
  }

  // Fallback to legacy client-side API (dev only)
  const legacyDetails = await fetchCustomerDetails(accountId);
  return transformLegacyToDetail(legacyDetails, accountId);
}

/**
 * Hook to fetch full account details.
 */
export function useAccountDetail(accountId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.accountDetail(accountId || ''),
    queryFn: () => fetchAccountDetailWithFallback(accountId!),
    ...defaultQueryOptions,
    enabled: !!accountId,
  });
}

/**
 * Hook to get account health with breakdown.
 */
export function useAccountHealth(accountId: string | undefined) {
  const { data, isLoading, error } = useAccountDetail(accountId);
  
  return {
    health: data?.health,
    isLoading,
    error,
  };
}

/**
 * Hook to get account alerts.
 */
export function useAccountAlerts(accountId: string | undefined) {
  const { data, isLoading, error } = useAccountDetail(accountId);
  
  const alerts = data?.alerts || [];
  const criticalAlerts = alerts.filter(a => a.severity === 'critical');
  const highAlerts = alerts.filter(a => a.severity === 'high');
  const otherAlerts = alerts.filter(a => a.severity !== 'critical' && a.severity !== 'high');
  
  return {
    alerts,
    criticalAlerts,
    highAlerts,
    otherAlerts,
    hasAlerts: alerts.length > 0,
    hasCriticalAlerts: criticalAlerts.length > 0,
    isLoading,
    error,
  };
}

/**
 * Hook to manage account interactions.
 */
export function useAccountInteractions(accountId: string | undefined) {
  const queryClient = useQueryClient();
  const { data } = useAccountDetail(accountId);
  
  // In production, this would call an API to save interactions
  const addInteraction = useMutation({
    mutationFn: async (interaction: Omit<Interaction, 'id' | 'createdAt'>) => {
      // For now, just return a mock - would call API in production
      const newInteraction: Interaction = {
        ...interaction,
        id: crypto.randomUUID(),
        createdAt: new Date().toISOString(),
      };
      return newInteraction;
    },
    onSuccess: () => {
      // Invalidate account detail to refetch
      if (accountId) {
        queryClient.invalidateQueries({ queryKey: queryKeys.accountDetail(accountId) });
      }
    },
  });
  
  return {
    interactions: data?.recentInteractions || [],
    addInteraction,
  };
}

/**
 * Hook to manage account tasks.
 */
export function useAccountTasks(accountId: string | undefined) {
  const queryClient = useQueryClient();
  const { data } = useAccountDetail(accountId);
  
  // In production, this would call an API to manage tasks
  const addTask = useMutation({
    mutationFn: async (task: Omit<Task, 'id' | 'createdAt' | 'updatedAt'>) => {
      const newTask: Task = {
        ...task,
        id: crypto.randomUUID(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      return newTask;
    },
    onSuccess: () => {
      if (accountId) {
        queryClient.invalidateQueries({ queryKey: queryKeys.accountDetail(accountId) });
      }
    },
  });
  
  const completeTask = useMutation({
    mutationFn: async (taskId: string) => {
      // Would call API in production
      return { taskId, completedAt: new Date().toISOString() };
    },
    onSuccess: () => {
      if (accountId) {
        queryClient.invalidateQueries({ queryKey: queryKeys.accountDetail(accountId) });
      }
    },
  });
  
  return {
    tasks: data?.openTasks || [],
    addTask,
    completeTask,
  };
}
