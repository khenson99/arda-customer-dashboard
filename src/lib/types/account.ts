/**
 * Canonical Customer Success Data Model
 * 
 * This is the foundation for all CS operations - a clean separation between
 * raw tenant data (from Arda) and the business concept of a "Customer Account".
 */

// ============================================================================
// CORE ACCOUNT MODEL
// ============================================================================

/**
 * A Customer Account represents a business relationship, not a technical tenant.
 * One account may have multiple tenants (sandbox, production, subsidiaries).
 */
export interface Account {
  id: string;                          // Internal account ID
  name: string;                        // Display name (company name)
  domain?: string;                     // Primary email domain
  
  // Segmentation
  segment: AccountSegment;
  tier: AccountTier;
  industry?: string;
  region?: string;
  
  // Ownership
  ownerId?: string;                    // CSM user ID
  ownerName?: string;                  // CSM display name
  ownerEmail?: string;
  
  // Tenant Mapping
  tenantIds: string[];                 // All Arda tenant IDs for this account
  primaryTenantId?: string;            // Main production tenant
  
  // External System IDs
  externalIds: {
    coda?: string;                     // Coda row ID
    hubspot?: string;                  // HubSpot company ID
    stripe?: string;                   // Stripe customer ID
    salesforce?: string;               // Salesforce account ID
  };
  
  // Timestamps
  createdAt: string;                   // ISO date
  updatedAt: string;
  firstActivityAt?: string;
  lastActivityAt?: string;
  
  // Lifecycle
  lifecycleStage: LifecycleStage;
  onboardingStatus: OnboardingStatus;
  
  // Computed (populated by metrics engine)
  health?: AccountHealth;
  usage?: UsageMetrics;
  commercial?: CommercialMetrics;
  support?: SupportMetrics;
  alerts?: Alert[];
  
  // Metadata
  tags?: string[];
  notes?: string;
}

export type AccountSegment = 'enterprise' | 'mid-market' | 'smb' | 'startup';
export type AccountTier = 'enterprise' | 'growth' | 'starter' | 'trial' | 'free';

export type LifecycleStage = 
  | 'prospect'      // Not yet signed
  | 'onboarding'    // First 30 days, setting up
  | 'adoption'      // Learning and growing usage
  | 'growth'        // Actively expanding
  | 'mature'        // Stable, consistent usage
  | 'renewal'       // Approaching renewal period
  | 'churned';      // No longer active

export type OnboardingStatus = 
  | 'not_started'
  | 'in_progress'
  | 'stalled'
  | 'completed';

// ============================================================================
// HEALTH SCORING
// ============================================================================

/**
 * Composite health score with full explainability.
 * Each component is 0-100, with configurable weights.
 */
export interface AccountHealth {
  // Composite score (weighted average of components)
  score: number;                       // 0-100
  grade: HealthGrade;                  // A/B/C/D/F for quick visual
  trend: HealthTrend;                  // Direction of change
  
  // Component scores with explainability
  components: {
    adoption: HealthComponent;         // Product usage health
    engagement: HealthComponent;       // User activity health
    relationship: HealthComponent;     // CS touch health
    support: HealthComponent;          // Support health
    commercial: HealthComponent;       // Payment/renewal health
  };
  
  // Change tracking
  previousScore?: number;
  scoreChange: number;                 // Delta from previous period
  changeReason?: string;               // Human-readable explanation
  
  // Metadata
  calculatedAt: string;                // ISO date
  dataFreshness: DataFreshness;        // How current is the underlying data
  confidence: number;                  // 0-100, based on data completeness
}

export type HealthGrade = 'A' | 'B' | 'C' | 'D' | 'F';
export type HealthTrend = 'improving' | 'stable' | 'declining' | 'unknown';
export type DataFreshness = 'fresh' | 'stale' | 'outdated' | 'missing';

export interface HealthComponent {
  score: number;                       // 0-100
  weight: number;                      // Weight in composite (0-1)
  weightedScore: number;               // score * weight
  trend: HealthTrend;
  
  // Explainability
  factors: HealthFactor[];             // What contributed to this score
  dataPoints: number;                  // How many signals went into calculation
  lastUpdated: string;                 // When underlying data was last refreshed
}

export interface HealthFactor {
  name: string;                        // e.g., "Days since last activity"
  value: string | number;              // e.g., 14
  impact: 'positive' | 'neutral' | 'negative';
  points: number;                      // Contribution to component score
  explanation: string;                 // Human-readable
}

// ============================================================================
// USAGE METRICS (Product Adoption)
// ============================================================================

export interface UsageMetrics {
  // Activity counts
  itemCount: number;
  kanbanCardCount: number;
  orderCount: number;
  
  // User metrics
  totalUsers: number;
  activeUsersLast7Days: number;
  activeUsersLast30Days: number;
  
  // Engagement
  daysActive: number;                  // Days with any activity
  daysSinceLastActivity: number;
  avgActionsPerDay: number;
  
  // Feature adoption (0-100 for each)
  featureAdoption: {
    items: number;                     // Item management adoption
    kanban: number;                    // Kanban workflow adoption
    ordering: number;                  // Order placement adoption
    receiving: number;                 // Receiving/inventory adoption
    reporting: number;                 // Analytics/reporting adoption
  };
  
  // Outcomes (business value delivered)
  outcomes: {
    ordersPlaced: number;
    ordersReceived: number;
    stockoutsPrevented?: number;
    reorderCadenceDays?: number;
  };
  
  // Time-series for trending
  activityTimeline: ActivityDataPoint[];
  
  // Onboarding velocity
  timeToFirstItem?: number;            // Days from signup
  timeToFirstKanban?: number;
  timeToFirstOrder?: number;
  timeToLive?: number;                 // Days to reach "live" stage
}

export interface ActivityDataPoint {
  date: string;                        // ISO date (day or week)
  items: number;
  kanbanCards: number;
  orders: number;
  activeUsers: number;
}

// ============================================================================
// COMMERCIAL METRICS
// ============================================================================

export interface CommercialMetrics {
  // Revenue
  plan: string;
  arr?: number;                        // Annual Recurring Revenue
  mrr?: number;                        // Monthly Recurring Revenue
  currency: string;
  source?: 'stripe' | 'hubspot' | 'account';
  
  // Contract
  contractStartDate?: string;
  contractEndDate?: string;
  renewalDate?: string;
  daysToRenewal?: number;
  termMonths?: number;
  autoRenew?: boolean;
  
  // Usage limits
  seatLimit?: number;
  seatUsage?: number;
  seatUtilization?: number;            // 0-100
  
  // Payment health
  paymentStatus: PaymentStatus;
  lastPaymentDate?: string;
  overdueAmount?: number;
  
  // Expansion signals
  expansionSignals: ExpansionSignal[];
  expansionPotential: 'high' | 'medium' | 'low' | 'none';
  
  // Pipeline (from CRM)
  openOpportunities?: Opportunity[];
}

export type PaymentStatus = 'current' | 'overdue' | 'at_risk' | 'churned' | 'unknown';

export interface ExpansionSignal {
  type: 'seat_pressure' | 'feature_limit' | 'multi_site' | 'high_usage' | 'new_department';
  strength: 'strong' | 'moderate' | 'weak';
  description: string;
  detectedAt: string;
}

export interface Opportunity {
  id: string;
  name: string;
  type: 'expansion' | 'renewal' | 'upsell' | 'cross-sell';
  stage: string;
  value: number;
  closeDate?: string;
  probability?: number;
}

// ============================================================================
// HUBSPOT CRM DATA
// ============================================================================

export interface HubSpotCompanySummary {
  id: string;
  name: string;
  domain?: string;
  industry?: string;
  companySize?: string;
  annualRevenue?: number;
  location?: {
    city?: string;
    state?: string;
    country?: string;
  };
  website?: string;
  description?: string;
  hubspotUrl?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface HubSpotContactSummary {
  id: string;
  firstName?: string;
  lastName?: string;
  email: string;
  phone?: string;
  jobTitle?: string;
  lifecycleStage?: string;
  leadStatus?: string;
  lastActivityDate?: string;
  hubspotUrl?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface HubSpotDealSummary {
  id: string;
  name: string;
  stage: string;
  pipeline?: string;
  amount?: number;
  currency?: string;
  closeDate?: string;
  probability?: number;
  dealType?: 'new_business' | 'expansion' | 'renewal' | 'other';
  hubspotUrl?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface HubSpotOwnerSummary {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  fullName: string;
  avatarUrl?: string;
  teamId?: string;
  userId?: string;
}

export interface HubSpotAccountData {
  company: HubSpotCompanySummary | null;
  contacts: HubSpotContactSummary[];
  deals: HubSpotDealSummary[];
  owner: HubSpotOwnerSummary | null;
  source: 'hubspot' | 'mock' | 'account';
  fetchedAt: string;
  lastSyncedAt?: string;
}

// ============================================================================
// SUPPORT METRICS
// ============================================================================

export interface SupportMetrics {
  // Ticket counts
  openTickets: number;
  ticketsLast30Days: number;
  ticketsLast90Days: number;
  
  // Severity breakdown
  criticalTickets: number;
  highTickets: number;
  normalTickets: number;
  
  // Response metrics
  avgFirstResponseHours?: number;
  avgResolutionHours?: number;
  
  // Quality
  reopenRate?: number;                 // 0-100
  escalationCount: number;
  
  // Sentiment
  csat?: number;                       // 0-100
  nps?: number;                        // -100 to 100
  lastSurveyDate?: string;
}

// ============================================================================
// ALERTS & WORKFLOWS
// ============================================================================

export interface Alert {
  id: string;
  accountId: string;
  
  // Classification
  type: AlertType;
  category: AlertCategory;
  severity: AlertSeverity;
  
  // Content
  title: string;
  description: string;
  evidence: string[];                  // Data points that triggered this
  
  // Recommended action
  suggestedAction: string;
  playbook?: string;                   // Playbook ID to apply
  
  // Ownership
  ownerId?: string;
  ownerName?: string;
  acknowledgedBy?: string;
  resolvedBy?: string;
  snoozedUntil?: string;
  snoozeReason?: string;
  playbookId?: string;
  playbookProgress?: number;
  
  // SLA
  slaDeadline?: string;                // ISO date
  slaStatus: SLAStatus;
  
  // Lifecycle
  status: AlertStatus;
  createdAt: string;
  acknowledgedAt?: string;
  resolvedAt?: string;
  outcome?: AlertOutcome;
  notes?: AlertNote[];
  actionLog?: AlertActionLog[];
  
  // Impact
  arrAtRisk?: number;
}

export type AlertType = 
  | 'churn_risk'
  | 'expansion_opportunity'
  | 'onboarding_stalled'
  | 'usage_decline'
  | 'champion_left'
  | 'support_escalation'
  | 'payment_overdue'
  | 'renewal_approaching'
  | 'low_engagement'
  | 'health_drop';

export type AlertCategory = 'risk' | 'opportunity' | 'action_required' | 'informational';
export type AlertSeverity = 'critical' | 'high' | 'medium' | 'low';
export type AlertStatus = 'open' | 'acknowledged' | 'in_progress' | 'resolved' | 'snoozed';
export type SLAStatus = 'on_track' | 'at_risk' | 'breached' | 'none';

export interface AlertOutcome {
  result: 'success' | 'partial' | 'failed' | 'not_applicable';
  notes?: string;
  resolvedBy?: string;
}

export interface AlertNote {
  id: string;
  alertId: string;
  content: string;
  createdBy: string;
  createdAt: string;
}

export interface AlertActionLog {
  id: string;
  alertId: string;
  action: 'acknowledged' | 'snoozed' | 'resolved' | 'assigned' | 'note_added' | 'playbook_started' | 'playbook_completed' | 'reopened';
  actor: string;
  actorName?: string;
  timestamp: string;
  details?: Record<string, unknown>;
}

// ============================================================================
// STAKEHOLDERS & CONTACTS
// ============================================================================

export interface Stakeholder {
  id: string;
  accountId: string;
  
  // Identity
  name: string;
  email: string;
  title?: string;
  phone?: string;
  
  // Role
  role: StakeholderRole;
  isPrimary: boolean;
  influence: 'high' | 'medium' | 'low';
  
  // Relationship
  sentiment?: 'positive' | 'neutral' | 'negative' | 'unknown';
  lastContactedAt?: string;
  preferredChannel?: 'email' | 'phone' | 'slack' | 'other';
  
  // External IDs
  externalIds?: {
    hubspot?: string;
    salesforce?: string;
  };
  
  // Notes
  notes?: string;
}

export type StakeholderRole = 
  | 'champion'           // Internal advocate
  | 'economic_buyer'     // Budget holder
  | 'decision_maker'     // Final approver
  | 'admin'              // Technical admin
  | 'power_user'         // Heavy daily user
  | 'end_user'           // Regular user
  | 'executive_sponsor'  // C-level sponsor
  | 'influencer'         // Influences decisions
  | 'other';

// ============================================================================
// INTERACTIONS (CS Activity Log)
// ============================================================================

export interface Interaction {
  id: string;
  accountId: string;
  
  // Type
  type: InteractionType;
  channel: InteractionChannel;
  
  // Content
  subject?: string;
  summary: string;
  sentiment?: 'positive' | 'neutral' | 'negative';
  
  // Participants
  stakeholderIds?: string[];
  createdById: string;
  createdByName: string;
  
  // Follow-up
  nextAction?: string;
  nextActionDate?: string;
  nextActionOwnerId?: string;
  
  // Timestamps
  occurredAt: string;                  // When the interaction happened
  createdAt: string;                   // When logged
  
  // Related entities
  alertId?: string;                    // If this interaction addresses an alert
  taskId?: string;                     // If from a task
}

export type InteractionType = 
  | 'call'
  | 'email'
  | 'meeting'
  | 'note'
  | 'chat'
  | 'qbr'                              // Quarterly Business Review
  | 'onboarding_session'
  | 'training'
  | 'escalation'
  | 'renewal_discussion';

export type InteractionChannel = 'phone' | 'email' | 'video' | 'in_person' | 'slack' | 'other';

// ============================================================================
// TASKS & PLAYBOOKS
// ============================================================================

export interface Task {
  id: string;
  accountId: string;
  
  // Content
  title: string;
  description?: string;
  
  // Classification
  type: TaskType;
  priority: 'urgent' | 'high' | 'normal' | 'low';
  
  // Ownership
  assigneeId?: string;
  assigneeName?: string;
  
  // Dates
  dueDate?: string;
  completedAt?: string;
  
  // Status
  status: TaskStatus;
  
  // Source
  source: TaskSource;
  playbookId?: string;
  alertId?: string;
  
  // Recurrence
  isRecurring?: boolean;
  recurrenceRule?: string;
  
  createdAt: string;
  updatedAt: string;
}

export type TaskType = 
  | 'follow_up'
  | 'check_in'
  | 'onboarding'
  | 'training'
  | 'review'
  | 'escalation'
  | 'renewal'
  | 'expansion'
  | 'custom';

export type TaskStatus = 'pending' | 'in_progress' | 'completed' | 'cancelled' | 'overdue';
export type TaskSource = 'manual' | 'playbook' | 'alert' | 'recurring' | 'system';

export interface Playbook {
  id: string;
  name: string;
  description: string;
  
  // Trigger
  triggerType: AlertType | 'manual';
  
  // Tasks to generate
  taskTemplates: TaskTemplate[];
  
  // Suggested content
  emailTemplates?: string[];
  callAgenda?: string;
  
  // Metrics
  successCriteria?: string;
  expectedDuration?: number;           // Days
  
  isActive: boolean;
}

export interface TaskTemplate {
  title: string;
  description?: string;
  type: TaskType;
  relativeDueDate: number;             // Days from playbook start
  assignTo: 'csm' | 'manager' | 'specific';
  specificAssignee?: string;
}

// ============================================================================
// SUCCESS PLANS & MILESTONES
// ============================================================================

export interface SuccessPlan {
  id: string;
  accountId: string;
  
  // Goals
  goals: SuccessGoal[];
  
  // Milestones
  milestones: Milestone[];
  
  // Status
  status: 'active' | 'completed' | 'paused' | 'cancelled';
  progress: number;                    // 0-100
  
  // Dates
  startDate: string;
  targetEndDate?: string;
  actualEndDate?: string;
  
  // Value tracking
  valueDelivered?: string;             // Description of value achieved
  
  createdAt: string;
  updatedAt: string;
}

export interface SuccessGoal {
  id: string;
  description: string;
  targetMetric?: string;
  targetValue?: number;
  currentValue?: number;
  status: 'not_started' | 'in_progress' | 'achieved' | 'at_risk' | 'missed';
}

export interface Milestone {
  id: string;
  name: string;
  description?: string;
  
  // Type
  type: MilestoneType;
  
  // Status
  status: MilestoneStatus;
  
  // Dates
  targetDate?: string;
  completedDate?: string;
  
  // Ownership
  ownerId?: string;
  ownerName?: string;
  
  // Blockers
  blockers?: string[];
  
  order: number;                       // Display order
}

export type MilestoneType = 
  | 'kickoff'
  | 'technical_setup'
  | 'data_migration'
  | 'user_training'
  | 'pilot'
  | 'go_live'
  | 'first_value'
  | 'adoption_target'
  | 'expansion'
  | 'renewal'
  | 'custom';

export type MilestoneStatus = 'pending' | 'in_progress' | 'completed' | 'blocked' | 'skipped';

// ============================================================================
// API RESPONSE TYPES
// ============================================================================

/**
 * Lightweight account summary for portfolio views.
 * Fast to load, contains just enough for sorting/filtering.
 */
export interface AccountSummary {
  id: string;
  name: string;
  segment: AccountSegment;
  tier: AccountTier;
  
  // Owner
  ownerName?: string;
  
  // Key metrics
  healthScore: number;
  healthGrade: HealthGrade;
  healthTrend: HealthTrend;
  
  // Usage snapshot
  activeUsers: number;
  daysSinceLastActivity: number;
  itemCount?: number;
  kanbanCardCount?: number;
  orderCount?: number;
  accountAgeDays?: number;
  
  // Stage
  lifecycleStage: LifecycleStage;
  onboardingStatus: OnboardingStatus;
  
  // Commercial
  arr?: number;
  daysToRenewal?: number;
  
  // Alerts
  alertCount: number;
  criticalAlertCount: number;
  
  // Activity sparkline (last 8 weeks)
  activityTrend: number[];
  
  // Quick access
  primaryTenantId?: string;
}

/**
 * Full account detail for the Account 360 view.
 */
export interface AccountDetail extends Account {
  // All computed metrics fully populated
  health: AccountHealth;
  usage: UsageMetrics;
  commercial: CommercialMetrics;
  support: SupportMetrics;
  alerts: Alert[];
  
  // Related entities
  stakeholders: Stakeholder[];
  recentInteractions: Interaction[];
  openTasks: Task[];
  successPlan?: SuccessPlan;
  hubspot?: HubSpotAccountData;
  
  // Timeline (unified activity feed)
  timeline: TimelineEvent[];
}

export interface TimelineEvent {
  id: string;
  type: 'product_activity' | 'interaction' | 'alert' | 'milestone' | 'commercial';
  timestamp: string;
  title: string;
  description?: string;
  actor?: string;
  metadata?: Record<string, unknown>;
}

// ============================================================================
// CONFIGURATION TYPES
// ============================================================================

export interface HealthScoringConfig {
  // Component weights (must sum to 1)
  weights: {
    adoption: number;
    engagement: number;
    relationship: number;
    support: number;
    commercial: number;
  };
  
  // Thresholds for grades
  gradeThresholds: {
    A: number;                         // Score >= this = A
    B: number;
    C: number;
    D: number;
    // Below D threshold = F
  };
  
  // Segment-specific overrides
  segmentOverrides?: Partial<Record<AccountSegment, Partial<HealthScoringConfig>>>;
}

export interface AlertConfig {
  type: AlertType;
  enabled: boolean;
  
  // Trigger conditions
  conditions: AlertCondition[];
  
  // Severity rules
  severityRules: {
    critical: string;                  // Expression or threshold
    high: string;
    medium: string;
    // Below medium = low
  };
  
  // SLA
  slaHours?: number;
  
  // Auto-actions
  autoAssign?: 'csm' | 'manager' | 'pool';
  autoPlaybook?: string;
}

export interface AlertCondition {
  field: string;
  operator: 'eq' | 'ne' | 'gt' | 'gte' | 'lt' | 'lte' | 'contains' | 'not_contains';
  value: string | number | boolean;
}
