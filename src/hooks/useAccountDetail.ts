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
} from '../lib/types/account';

// Track whether we should use the new API
let useNewApi = true;

/**
 * Transform legacy CustomerDetails to AccountDetail format.
 */
function transformLegacyToDetail(details: CustomerDetails, tenantId: string): AccountDetail {
  const now = new Date().toISOString();
  
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
  
  // Build usage metrics
  const usage: UsageMetrics = {
    itemCount: details.items.length,
    kanbanCardCount: details.kanbanCards.length,
    orderCount: 0,
    totalUsers: details.users.length,
    activeUsersLast7Days: Math.min(details.users.length, 1),
    activeUsersLast30Days: details.users.length,
    daysActive: 0,
    daysSinceLastActivity: 0,
    avgActionsPerDay: 0,
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
    alerts: [],
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
      console.warn('New account detail API failed, falling back to legacy:', error);
      useNewApi = false;
    }
  }
  
  // Fallback to legacy client-side API
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
 * Hook to get account timeline.
 */
export function useAccountTimeline(accountId: string | undefined) {
  const { data, isLoading, error } = useAccountDetail(accountId);
  
  return {
    timeline: data?.timeline || [],
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
