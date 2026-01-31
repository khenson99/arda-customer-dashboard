/**
 * Success Plan Templates & Utilities
 * 
 * Pre-built success plan templates for common customer scenarios,
 * plus utility functions for creating and tracking milestone progress.
 */

import type {
  SuccessPlan,
  SuccessGoal,
  Milestone,
  MilestoneType,
  MilestoneStatus,
  LifecycleStage,
} from './types/account';

// ============================================================================
// TEMPLATE INTERFACES
// ============================================================================

/**
 * A reusable success plan template that can be applied to any account.
 */
export interface SuccessPlanTemplate {
  id: string;
  name: string;
  description: string;
  suggestedFor: ('onboarding' | 'adoption' | 'growth' | 'renewal' | 'at_risk')[];
  defaultGoals: GoalTemplate[];
  defaultMilestones: MilestoneTemplate[];
  expectedDurationDays: number;
}

/**
 * Template for creating success goals.
 */
export interface GoalTemplate {
  description: string;
  targetMetric?: string;
  category: 'adoption' | 'engagement' | 'value' | 'expansion';
}

/**
 * Template for creating milestones with relative due dates.
 */
export interface MilestoneTemplate {
  name: string;
  description: string;
  type: MilestoneType;
  relativeDueDays: number; // Days from plan start
  order: number;
}

// ============================================================================
// SUCCESS PLAN TEMPLATES
// ============================================================================

/**
 * Standard Onboarding Plan (30 days)
 * For typical SMB/mid-market customers getting started with Arda.
 */
const standardOnboardingPlan: SuccessPlanTemplate = {
  id: 'standard-onboarding',
  name: 'Standard Onboarding Plan',
  description: 'A 30-day onboarding journey for new customers to achieve first value with Arda. Covers initial setup, data import, training, and go-live.',
  suggestedFor: ['onboarding'],
  expectedDurationDays: 30,
  defaultGoals: [
    {
      description: 'Create first inventory item in the system',
      targetMetric: 'items_created',
      category: 'adoption',
    },
    {
      description: 'Set up first kanban board for workflow management',
      targetMetric: 'kanban_boards_created',
      category: 'adoption',
    },
    {
      description: 'Place first order through the platform',
      targetMetric: 'orders_placed',
      category: 'value',
    },
  ],
  defaultMilestones: [
    {
      name: 'Kickoff Call',
      description: 'Initial kickoff meeting to align on goals, timeline, and success criteria',
      type: 'kickoff',
      relativeDueDays: 3,
      order: 1,
    },
    {
      name: 'Technical Setup',
      description: 'Complete account configuration, user provisioning, and integrations setup',
      type: 'technical_setup',
      relativeDueDays: 7,
      order: 2,
    },
    {
      name: 'Data Import',
      description: 'Import existing inventory data, item catalog, and supplier information',
      type: 'data_migration',
      relativeDueDays: 14,
      order: 3,
    },
    {
      name: 'User Training',
      description: 'Training sessions for all end users on core workflows',
      type: 'user_training',
      relativeDueDays: 21,
      order: 4,
    },
    {
      name: 'Go-Live',
      description: 'Customer is live and using Arda for daily operations',
      type: 'go_live',
      relativeDueDays: 30,
      order: 5,
    },
  ],
};

/**
 * Enterprise Onboarding Plan (60 days)
 * For enterprise customers with complex requirements, multiple departments, and integrations.
 */
const enterpriseOnboardingPlan: SuccessPlanTemplate = {
  id: 'enterprise-onboarding',
  name: 'Enterprise Onboarding Plan',
  description: 'A 60-day comprehensive onboarding program for enterprise customers with multi-department rollout, custom integrations, and phased deployment.',
  suggestedFor: ['onboarding'],
  expectedDurationDays: 60,
  defaultGoals: [
    {
      description: 'Complete multi-department rollout across all target teams',
      targetMetric: 'departments_onboarded',
      category: 'adoption',
    },
    {
      description: 'All required integrations configured and operational',
      targetMetric: 'integrations_active',
      category: 'adoption',
    },
    {
      description: 'Achieve 80% user adoption rate across licensed seats',
      targetMetric: 'user_adoption_rate',
      category: 'engagement',
    },
    {
      description: 'Deliver measurable value in first 60 days',
      targetMetric: 'value_delivered',
      category: 'value',
    },
  ],
  defaultMilestones: [
    {
      name: 'Executive Kickoff',
      description: 'Kickoff with executive sponsors to align on strategic objectives and success metrics',
      type: 'kickoff',
      relativeDueDays: 5,
      order: 1,
    },
    {
      name: 'Requirements Discovery',
      description: 'Deep dive into business requirements, workflows, and integration needs',
      type: 'custom',
      relativeDueDays: 10,
      order: 2,
    },
    {
      name: 'Technical Setup & Integration',
      description: 'Configure account, SSO, API integrations, and custom workflows',
      type: 'technical_setup',
      relativeDueDays: 20,
      order: 3,
    },
    {
      name: 'Pilot Deployment',
      description: 'Launch pilot with select team/department to validate configuration',
      type: 'pilot',
      relativeDueDays: 30,
      order: 4,
    },
    {
      name: 'User Training Program',
      description: 'Comprehensive training program including admin, power users, and end users',
      type: 'user_training',
      relativeDueDays: 40,
      order: 5,
    },
    {
      name: 'Full Rollout',
      description: 'Expand deployment to all departments and user groups',
      type: 'custom',
      relativeDueDays: 50,
      order: 6,
    },
    {
      name: 'Go-Live & Handoff',
      description: 'Complete go-live with all users, transition to steady-state support',
      type: 'go_live',
      relativeDueDays: 60,
      order: 7,
    },
  ],
};

/**
 * Adoption Acceleration Plan (45 days)
 * For existing customers who need help increasing usage and adoption.
 */
const adoptionAccelerationPlan: SuccessPlanTemplate = {
  id: 'adoption-acceleration',
  name: 'Adoption Acceleration Plan',
  description: 'A 45-day program to boost user adoption, increase feature utilization, and demonstrate value for customers with low engagement.',
  suggestedFor: ['adoption', 'at_risk'],
  expectedDurationDays: 45,
  defaultGoals: [
    {
      description: 'Increase weekly active users by 50%',
      targetMetric: 'weekly_active_users',
      category: 'engagement',
    },
    {
      description: 'Improve feature adoption score to 70%+',
      targetMetric: 'feature_adoption_score',
      category: 'adoption',
    },
    {
      description: 'Document and communicate 3 value wins to stakeholders',
      targetMetric: 'value_wins_documented',
      category: 'value',
    },
    {
      description: 'Identify and develop 2 internal champions',
      targetMetric: 'champions_identified',
      category: 'engagement',
    },
  ],
  defaultMilestones: [
    {
      name: 'Usage Review & Gap Analysis',
      description: 'Review current usage patterns, identify adoption gaps and blockers',
      type: 'custom',
      relativeDueDays: 5,
      order: 1,
    },
    {
      name: 'Training Sessions',
      description: 'Targeted training on underutilized features and workflows',
      type: 'user_training',
      relativeDueDays: 15,
      order: 2,
    },
    {
      name: 'Champion Development',
      description: 'Identify and enable internal champions with advanced training',
      type: 'custom',
      relativeDueDays: 30,
      order: 3,
    },
    {
      name: 'Adoption Check & Value Review',
      description: 'Measure adoption improvements and document value delivered',
      type: 'adoption_target',
      relativeDueDays: 45,
      order: 4,
    },
  ],
};

/**
 * Renewal Success Plan (90 days before renewal)
 * For accounts approaching renewal to demonstrate value and secure the renewal.
 */
const renewalSuccessPlan: SuccessPlanTemplate = {
  id: 'renewal-success',
  name: 'Renewal Success Plan',
  description: 'A 90-day plan starting 90 days before renewal to demonstrate ROI, address any concerns, and secure successful renewal.',
  suggestedFor: ['renewal'],
  expectedDurationDays: 90,
  defaultGoals: [
    {
      description: 'Create comprehensive value/ROI summary for stakeholders',
      targetMetric: 'value_summary_delivered',
      category: 'value',
    },
    {
      description: 'Address all open concerns and blockers before renewal',
      targetMetric: 'concerns_resolved',
      category: 'engagement',
    },
    {
      description: 'Secure renewal commitment at or above current contract value',
      targetMetric: 'renewal_secured',
      category: 'expansion',
    },
    {
      description: 'Identify expansion opportunities for next term',
      targetMetric: 'expansion_opportunities',
      category: 'expansion',
    },
  ],
  defaultMilestones: [
    {
      name: 'Value Review & ROI Analysis',
      description: 'Prepare comprehensive review of value delivered and ROI metrics',
      type: 'first_value',
      relativeDueDays: 14,
      order: 1,
    },
    {
      name: 'Executive Sponsor Meeting',
      description: 'Present value summary to executive sponsor, discuss future roadmap',
      type: 'custom',
      relativeDueDays: 30,
      order: 2,
    },
    {
      name: 'Renewal Discussion',
      description: 'Formal renewal discussion with decision makers, address any concerns',
      type: 'renewal',
      relativeDueDays: 60,
      order: 3,
    },
    {
      name: 'Contract Renewal',
      description: 'Contract signed and renewal completed',
      type: 'renewal',
      relativeDueDays: 85,
      order: 4,
    },
  ],
};

/**
 * At-Risk Recovery Plan (30 days)
 * Emergency intervention plan for accounts showing churn risk signals.
 */
const atRiskRecoveryPlan: SuccessPlanTemplate = {
  id: 'at-risk-recovery',
  name: 'At-Risk Recovery Plan',
  description: 'A 30-day intervention plan to re-engage at-risk accounts, resolve critical issues, and restore account health.',
  suggestedFor: ['at_risk'],
  expectedDurationDays: 30,
  defaultGoals: [
    {
      description: 'Re-engage key stakeholders with weekly touchpoints',
      targetMetric: 'stakeholder_meetings',
      category: 'engagement',
    },
    {
      description: 'Resolve all critical blockers and issues',
      targetMetric: 'blockers_resolved',
      category: 'value',
    },
    {
      description: 'Restore health score to 60+ (yellow or better)',
      targetMetric: 'health_score',
      category: 'engagement',
    },
    {
      description: 'Increase weekly active usage by 25%',
      targetMetric: 'weekly_active_users',
      category: 'adoption',
    },
  ],
  defaultMilestones: [
    {
      name: 'Emergency Stakeholder Call',
      description: 'Immediate call with key stakeholders to understand issues and concerns',
      type: 'kickoff',
      relativeDueDays: 2,
      order: 1,
    },
    {
      name: 'Issue Resolution',
      description: 'Address and resolve all identified blockers and critical issues',
      type: 'custom',
      relativeDueDays: 10,
      order: 2,
    },
    {
      name: 'Re-Training & Enablement',
      description: 'Provide refresher training and additional enablement as needed',
      type: 'user_training',
      relativeDueDays: 20,
      order: 3,
    },
    {
      name: 'Health Monitoring & Review',
      description: 'Monitor progress, review health metrics, confirm recovery trajectory',
      type: 'adoption_target',
      relativeDueDays: 30,
      order: 4,
    },
  ],
};

// ============================================================================
// TEMPLATE REGISTRY
// ============================================================================

/**
 * All available success plan templates.
 */
export const SUCCESS_PLAN_TEMPLATES: SuccessPlanTemplate[] = [
  standardOnboardingPlan,
  enterpriseOnboardingPlan,
  adoptionAccelerationPlan,
  renewalSuccessPlan,
  atRiskRecoveryPlan,
];

/**
 * Mapping from lifecycle stages to suggested template categories.
 */
const LIFECYCLE_TO_TEMPLATE_CATEGORY: Record<LifecycleStage, ('onboarding' | 'adoption' | 'growth' | 'renewal' | 'at_risk')[]> = {
  prospect: [],
  onboarding: ['onboarding'],
  adoption: ['adoption'],
  growth: ['growth', 'adoption'],
  mature: ['renewal'],
  renewal: ['renewal'],
  churned: ['at_risk'],
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Get a success plan template by ID.
 * 
 * @param id - The template ID
 * @returns The template or undefined if not found
 */
export function getTemplateById(id: string): SuccessPlanTemplate | undefined {
  return SUCCESS_PLAN_TEMPLATES.find((template) => template.id === id);
}

/**
 * Get recommended templates for a given lifecycle stage.
 * 
 * @param stage - The account's lifecycle stage
 * @returns Array of recommended templates
 */
export function getTemplatesForLifecycle(stage: LifecycleStage): SuccessPlanTemplate[] {
  const categories = LIFECYCLE_TO_TEMPLATE_CATEGORY[stage];
  
  if (!categories || categories.length === 0) {
    return [];
  }
  
  return SUCCESS_PLAN_TEMPLATES.filter((template) =>
    template.suggestedFor.some((suggested) => categories.includes(suggested))
  );
}

/**
 * Generate a unique ID for plan components.
 */
function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Add days to a date and return ISO string.
 */
function addDays(date: Date, days: number): string {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result.toISOString().split('T')[0];
}

/**
 * Create a SuccessPlan from a template.
 * 
 * @param template - The template to use
 * @param accountId - The account to create the plan for
 * @param startDate - When the plan starts (defaults to today)
 * @returns A new SuccessPlan ready to be saved
 */
export function createPlanFromTemplate(
  template: SuccessPlanTemplate,
  accountId: string,
  startDate: Date = new Date()
): SuccessPlan {
  const now = new Date().toISOString();
  
  // Create goals from template
  const goals: SuccessGoal[] = template.defaultGoals.map((goalTemplate) => ({
    id: generateId(),
    description: goalTemplate.description,
    targetMetric: goalTemplate.targetMetric,
    targetValue: undefined,
    currentValue: undefined,
    status: 'not_started',
  }));
  
  // Create milestones from template
  const milestones: Milestone[] = template.defaultMilestones.map((milestoneTemplate) => ({
    id: generateId(),
    name: milestoneTemplate.name,
    description: milestoneTemplate.description,
    type: milestoneTemplate.type,
    status: 'pending' as MilestoneStatus,
    targetDate: addDays(startDate, milestoneTemplate.relativeDueDays),
    completedDate: undefined,
    ownerId: undefined,
    ownerName: undefined,
    blockers: undefined,
    order: milestoneTemplate.order,
  }));
  
  // Calculate target end date
  const targetEndDate = addDays(startDate, template.expectedDurationDays);
  
  return {
    id: generateId(),
    accountId,
    goals,
    milestones,
    status: 'active',
    progress: 0,
    startDate: startDate.toISOString().split('T')[0],
    targetEndDate,
    actualEndDate: undefined,
    valueDelivered: undefined,
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * Calculate the overall progress percentage of a success plan.
 * Progress is based on completed milestones.
 * 
 * @param plan - The success plan to calculate progress for
 * @returns Progress as a percentage (0-100)
 */
export function calculateMilestoneProgress(plan: SuccessPlan): number {
  const { milestones } = plan;
  
  if (!milestones || milestones.length === 0) {
    return 0;
  }
  
  const completedCount = milestones.filter(
    (m) => m.status === 'completed' || m.status === 'skipped'
  ).length;
  
  return Math.round((completedCount / milestones.length) * 100);
}

/**
 * Get the next incomplete milestone from a plan.
 * Returns the first milestone that is not completed or skipped, ordered by their order field.
 * 
 * @param plan - The success plan
 * @returns The next milestone or undefined if all are complete
 */
export function getNextMilestone(plan: SuccessPlan): Milestone | undefined {
  const { milestones } = plan;
  
  if (!milestones || milestones.length === 0) {
    return undefined;
  }
  
  // Sort by order and find first incomplete
  const sorted = [...milestones].sort((a, b) => a.order - b.order);
  
  return sorted.find(
    (m) => m.status !== 'completed' && m.status !== 'skipped'
  );
}

/**
 * Get all milestones that are past their due date and not completed.
 * 
 * @param plan - The success plan
 * @returns Array of overdue milestones
 */
export function getOverdueMilestones(plan: SuccessPlan): Milestone[] {
  const { milestones } = plan;
  
  if (!milestones || milestones.length === 0) {
    return [];
  }
  
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  return milestones.filter((milestone) => {
    // Only check milestones that are not completed or skipped
    if (milestone.status === 'completed' || milestone.status === 'skipped') {
      return false;
    }
    
    // Check if target date has passed
    if (!milestone.targetDate) {
      return false;
    }
    
    const targetDate = new Date(milestone.targetDate);
    targetDate.setHours(0, 0, 0, 0);
    
    return targetDate < today;
  });
}

/**
 * Get all milestones that are blocked.
 * 
 * @param plan - The success plan
 * @returns Array of blocked milestones
 */
export function getBlockedMilestones(plan: SuccessPlan): Milestone[] {
  const { milestones } = plan;
  
  if (!milestones || milestones.length === 0) {
    return [];
  }
  
  return milestones.filter((milestone) => milestone.status === 'blocked');
}

/**
 * Alias for calculateMilestoneProgress for backwards compatibility.
 */
export function calculatePlanProgress(plan: SuccessPlan): number {
  return calculateMilestoneProgress(plan);
}

/**
 * Get an icon for a milestone status.
 * 
 * @param status - The milestone status
 * @returns An emoji icon representing the status
 */
export function getMilestoneStatusIcon(status: MilestoneStatus): string {
  const icons: Record<MilestoneStatus, string> = {
    pending: '⏳',
    in_progress: '🔄',
    completed: '✅',
    blocked: '🚫',
    skipped: '⏭️',
  };
  return icons[status] || '⏳';
}

/**
 * Get a color for a milestone status.
 * 
 * @param status - The milestone status
 * @returns A CSS color string
 */
export function getMilestoneStatusColor(status: MilestoneStatus): string {
  const colors: Record<MilestoneStatus, string> = {
    pending: '#6b7280',     // gray
    in_progress: '#f59e0b', // amber
    completed: '#10b981',   // green
    blocked: '#ef4444',     // red
    skipped: '#9ca3af',     // light gray
  };
  return colors[status] || '#6b7280';
}

/**
 * Get milestones grouped by status for display.
 * 
 * @param plan - The success plan
 * @returns Object with milestones grouped by status
 */
export function getMilestonesByStatus(plan: SuccessPlan): Record<MilestoneStatus, Milestone[]> {
  const result: Record<MilestoneStatus, Milestone[]> = {
    pending: [],
    in_progress: [],
    completed: [],
    blocked: [],
    skipped: [],
  };
  
  for (const milestone of plan.milestones) {
    result[milestone.status].push(milestone);
  }
  
  return result;
}

/**
 * Get the number of days remaining until the plan's target end date.
 * Returns negative number if overdue.
 * 
 * @param plan - The success plan
 * @returns Days remaining (negative if overdue), or null if no target end date
 */
export function getDaysRemaining(plan: SuccessPlan): number | null {
  if (!plan.targetEndDate) {
    return null;
  }
  
  const today = new Date();
  const targetDate = new Date(plan.targetEndDate);
  const diffTime = targetDate.getTime() - today.getTime();
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

/**
 * Get the health status of a plan as a simple string.
 * 
 * @param plan - The success plan
 * @returns 'healthy' | 'at_risk' | 'critical'
 */
export function getPlanHealthStatus(plan: SuccessPlan): 'healthy' | 'at_risk' | 'critical' {
  const overdueMilestones = getOverdueMilestones(plan);
  const blockedMilestones = plan.milestones.filter((m) => m.status === 'blocked');
  
  // Critical: Multiple overdue or blocked milestones
  if (overdueMilestones.length >= 2 || blockedMilestones.length >= 2) {
    return 'critical';
  }
  
  // At Risk: Any overdue or blocked milestones
  if (overdueMilestones.length > 0 || blockedMilestones.length > 0) {
    return 'at_risk';
  }
  
  // Healthy: No issues
  return 'healthy';
}

/**
 * Get detailed plan health information.
 * 
 * @param plan - The success plan
 * @returns Object with on-track status and details
 */
export function getPlanHealthDetails(plan: SuccessPlan): {
  isOnTrack: boolean;
  overdueCount: number;
  blockedCount: number;
  nextMilestone: Milestone | undefined;
  daysUntilNext: number | undefined;
} {
  const overdueMilestones = getOverdueMilestones(plan);
  const blockedMilestones = plan.milestones.filter((m) => m.status === 'blocked');
  const nextMilestone = getNextMilestone(plan);
  
  let daysUntilNext: number | undefined;
  if (nextMilestone?.targetDate) {
    const today = new Date();
    const targetDate = new Date(nextMilestone.targetDate);
    daysUntilNext = Math.ceil((targetDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  }
  
  return {
    isOnTrack: overdueMilestones.length === 0 && blockedMilestones.length === 0,
    overdueCount: overdueMilestones.length,
    blockedCount: blockedMilestones.length,
    nextMilestone,
    daysUntilNext,
  };
}

/**
 * Update a milestone status in a plan (returns a new plan object).
 * 
 * @param plan - The success plan
 * @param milestoneId - The milestone to update
 * @param status - The new status
 * @returns Updated success plan
 */
export function updateMilestoneStatus(
  plan: SuccessPlan,
  milestoneId: string,
  status: MilestoneStatus
): SuccessPlan {
  const updatedMilestones = plan.milestones.map((milestone) => {
    if (milestone.id !== milestoneId) {
      return milestone;
    }
    
    return {
      ...milestone,
      status,
      completedDate: status === 'completed' ? new Date().toISOString().split('T')[0] : milestone.completedDate,
    };
  });
  
  const updatedPlan: SuccessPlan = {
    ...plan,
    milestones: updatedMilestones,
    updatedAt: new Date().toISOString(),
  };
  
  // Recalculate progress
  updatedPlan.progress = calculateMilestoneProgress(updatedPlan);
  
  // Check if all milestones are complete
  const allComplete = updatedMilestones.every(
    (m) => m.status === 'completed' || m.status === 'skipped'
  );
  
  if (allComplete && updatedPlan.status === 'active') {
    updatedPlan.status = 'completed';
    updatedPlan.actualEndDate = new Date().toISOString().split('T')[0];
  }
  
  return updatedPlan;
}

