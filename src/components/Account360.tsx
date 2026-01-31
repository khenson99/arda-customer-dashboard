// @ts-nocheck
/**
 * Account 360 Component
 * 
 * The comprehensive account view - a single screen to understand and act on
 * any customer account. Replaces the basic CustomerDetail component.
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import { useAccountDetail, useAccountAlerts } from '../hooks/useAccountDetail';
import { TabNavigation } from './TabNavigation';
import { EmailTemplateModal } from './EmailTemplateModal';
import { type TemplateCategory } from '../lib/email-templates';
import type { 
  Alert, 
  AlertType,
  TimelineEvent,
  Stakeholder,
  HealthGrade,
  Task,
  SuccessPlan,
  Milestone,
  MilestoneStatus,
} from '../lib/types/account';
import { SuccessPlanSummaryWidget } from './SuccessPlan';
import {
  SUCCESS_PLAN_TEMPLATES,
  type SuccessPlanTemplate,
  createPlanFromTemplate,
  getNextMilestone,
  getOverdueMilestones,
  getDaysRemaining,
} from '../lib/success-plans';
import {
  useCommercialMetrics,
  formatCurrency,
  formatCurrencyPrecise,
  getSubscriptionStatusInfo,
  getInvoiceStatusInfo,
  daysUntil,
  type CommercialData,
  type StripeInvoice,
  type StripeSubscription,
} from '../hooks/useCommercialMetrics';

// ============================================================================
// EMAIL INTEGRATION TYPES & HELPERS
// ============================================================================

interface SentEmail {
  id: string;
  accountId: string;
  templateId: string;
  templateName: string;
  recipientEmail: string;
  subject: string;
  sentAt: string;
  category: TemplateCategory;
}

interface DraftEmail {
  id: string;
  accountId: string;
  templateId?: string;
  templateName?: string;
  category?: TemplateCategory;
  recipientEmail: string;
  subject: string;
  body: string;
  savedAt: string;
}

/**
 * Maps alert types to suggested email template categories.
 * This helps CSMs quickly find relevant templates when addressing alerts.
 */
function getTemplateCategoriesForAlertType(alertType: AlertType): TemplateCategory[] {
  const mapping: Record<AlertType, TemplateCategory[]> = {
    churn_risk: ['at_risk'],
    low_engagement: ['at_risk', 'reactivation'],
    onboarding_stalled: ['onboarding'],
    expansion_opportunity: ['expansion'],
    renewal_approaching: ['renewal'],
    health_drop: ['at_risk'],
    usage_decline: ['at_risk', 'reactivation'],
    champion_left: ['at_risk'],
    support_escalation: ['at_risk'],
    payment_overdue: ['at_risk', 'renewal'],
  };
  return mapping[alertType] || [];
}

// ============================================================================
// Main Component
// ============================================================================

export function Account360() {
  const { tenantId } = useParams<{ tenantId: string }>();
  const [activeTab, setActiveTab] = useState<'overview' | 'health' | 'commercial' | 'timeline' | 'stakeholders' | 'tasks' | 'success_plan' | 'outreach'>('overview');
  
  // Email modal state
  const [isEmailModalOpen, setIsEmailModalOpen] = useState(false);
  const [emailModalCategory, setEmailModalCategory] = useState<TemplateCategory | undefined>(undefined);
  
  const { data: account, isLoading, error } = useAccountDetail(tenantId);
  const { alerts, criticalAlerts, hasCriticalAlerts } = useAccountAlerts(tenantId);
  
  // Build account data for email templates
  const emailAccountData = useMemo(() => {
    if (!account) return undefined;
    const primaryContact = account.stakeholders?.find(s => s.isPrimary);
    return {
      name: account.name,
      primaryContactEmail: primaryContact?.email,
      primaryContactName: primaryContact?.name,
      csmName: account.ownerName,
      csmEmail: account.ownerEmail,
      activeUsers: account.usage?.activeUsersLast30Days,
      totalUsers: account.usage?.totalUsers,
      daysSinceLastActivity: account.usage?.daysSinceLastActivity,
      healthScore: account.health?.score,
      daysToRenewal: account.commercial?.daysToRenewal,
      arr: account.commercial?.arr,
      itemCount: account.usage?.itemCount,
      kanbanCardCount: account.usage?.kanbanCardCount,
      orderCount: account.usage?.orderCount,
    };
  }, [account]);
  
  // Open email modal with optional category filter
  const openEmailModal = useCallback((category?: TemplateCategory) => {
    setEmailModalCategory(category);
    setIsEmailModalOpen(true);
  }, []);
  
  const closeEmailModal = useCallback(() => {
    setIsEmailModalOpen(false);
    setEmailModalCategory(undefined);
  }, []);
  
  if (isLoading) {
    return (
      <div className="dashboard">
        <TabNavigation />
        <div className="dashboard-content">
          <div className="loading-state">
            <div className="loading-spinner" />
            <p>Loading account details...</p>
          </div>
        </div>
      </div>
    );
  }
  
  if (error || !account) {
    return (
      <div className="dashboard">
        <TabNavigation />
        <div className="dashboard-content">
          <div className="error-message">
            <div className="error-icon">⚠️</div>
            <p>Failed to load account details</p>
            <Link to="/" className="back-link">← Back to Portfolio</Link>
          </div>
        </div>
      </div>
    );
  }
  
  return (
    <div className="dashboard account-360">
      <TabNavigation />
      
      <div className="dashboard-content">
        {/* Account Header */}
        <header className="account-header">
          <Link to="/" className="back-link">← Back to Portfolio</Link>
          
          <div className="account-header-main">
            <div className="account-identity">
              <h1>{account.name}</h1>
              <div className="account-badges">
                <span className={`tier-badge ${account.tier}`}>{account.tier}</span>
                <span className={`lifecycle-badge ${account.lifecycleStage}`}>{account.lifecycleStage}</span>
                {account.ownerName && (
                  <span className="owner-badge">CSM: {account.ownerName}</span>
                )}
              </div>
            </div>
            
            <div className="account-quick-stats">
              <div className="quick-stat">
                <HealthBadge score={account.health.score} grade={account.health.grade} trend={account.health.trend} />
              </div>
              <div className="quick-stat">
                <span className="stat-label">Active Users</span>
                <span className="stat-value">{account.usage.activeUsersLast30Days}</span>
              </div>
              <div className="quick-stat">
                <span className="stat-label">Days Since Activity</span>
                <span className="stat-value" data-warning={account.usage.daysSinceLastActivity > 7}>
                  {account.usage.daysSinceLastActivity}
                </span>
              </div>
              {account.commercial.arr && (
                <div className="quick-stat">
                  <span className="stat-label">ARR</span>
                  <span className="stat-value">${account.commercial.arr.toLocaleString()}</span>
                </div>
              )}
              <button 
                className="btn-primary email-action-btn header-email-btn"
                onClick={() => openEmailModal()}
                title="Send email to this account"
              >
                📧 Email
              </button>
            </div>
          </div>
        </header>
        
        {/* Critical Alerts Banner */}
        {hasCriticalAlerts && (
          <div className="critical-alerts-banner">
            <span className="alert-icon">🚨</span>
            <span className="alert-text">
              {criticalAlerts.length} critical alert{criticalAlerts.length > 1 ? 's' : ''} requiring immediate attention
            </span>
            <button onClick={() => setActiveTab('overview')}>View Alerts</button>
          </div>
        )}
        
        {/* Tab Navigation */}
        <div className="account-tabs">
          <button 
            className={`tab-button ${activeTab === 'overview' ? 'active' : ''}`}
            onClick={() => setActiveTab('overview')}
          >
            Overview
          </button>
          <button 
            className={`tab-button ${activeTab === 'health' ? 'active' : ''}`}
            onClick={() => setActiveTab('health')}
          >
            Health Details
          </button>
          <button 
            className={`tab-button ${activeTab === 'commercial' ? 'active' : ''}`}
            onClick={() => setActiveTab('commercial')}
          >
            💰 Commercial
          </button>
          <button 
            className={`tab-button ${activeTab === 'timeline' ? 'active' : ''}`}
            onClick={() => setActiveTab('timeline')}
          >
            Timeline
          </button>
          <button 
            className={`tab-button ${activeTab === 'stakeholders' ? 'active' : ''}`}
            onClick={() => setActiveTab('stakeholders')}
          >
            Stakeholders
          </button>
          <button 
            className={`tab-button ${activeTab === 'tasks' ? 'active' : ''}`}
            onClick={() => setActiveTab('tasks')}
          >
            Tasks
          </button>
          <button 
            className={`tab-button ${activeTab === 'success_plan' ? 'active' : ''}`}
            onClick={() => setActiveTab('success_plan')}
          >
            Success Plan
          </button>
          <button 
            className={`tab-button ${activeTab === 'outreach' ? 'active' : ''}`}
            onClick={() => setActiveTab('outreach')}
          >
            📧 Outreach
          </button>
        </div>
        
        {/* Tab Content */}
        <div className="account-tab-content">
          {activeTab === 'overview' && (
            <OverviewTab 
              account={account} 
              alerts={alerts} 
              onOpenEmailModal={openEmailModal}
              onSwitchToSuccessPlan={() => setActiveTab('success_plan')}
              onSwitchToCommercial={() => setActiveTab('commercial')}
            />
          )}
          {activeTab === 'health' && (
            <HealthTab health={account.health} />
          )}
          {activeTab === 'commercial' && (
            <CommercialTab 
              account={account}
              onOpenEmailModal={openEmailModal}
            />
          )}
          {activeTab === 'timeline' && (
            <TimelineTab timeline={account.timeline} />
          )}
          {activeTab === 'stakeholders' && (
            <StakeholdersTab stakeholders={account.stakeholders} />
          )}
          {activeTab === 'tasks' && tenantId && (
            <TasksTab tenantId={tenantId} />
          )}
          {activeTab === 'success_plan' && tenantId && (
            <SuccessPlanTab tenantId={tenantId} />
          )}
          {activeTab === 'outreach' && tenantId && (
            <OutreachTab 
              tenantId={tenantId} 
              onOpenEmailModal={openEmailModal}
            />
          )}
        </div>
      </div>
      
      {/* Email Template Modal */}
      <EmailTemplateModal
        isOpen={isEmailModalOpen}
        onClose={closeEmailModal}
        defaultCategory={emailModalCategory}
        accountData={emailAccountData}
      />
    </div>
  );
}

// ============================================================================
// Sub-Components
// ============================================================================

function HealthBadge({ score, grade, trend }: { score: number; grade: HealthGrade; trend: string }) {
  const trendIcon = trend === 'improving' ? '↑' : trend === 'declining' ? '↓' : '→';
  const trendClass = trend === 'improving' ? 'up' : trend === 'declining' ? 'down' : 'stable';
  
  return (
    <div className={`health-badge grade-${grade.toLowerCase()}`}>
      <span className="health-score">{score}</span>
      <span className="health-grade">{grade}</span>
      <span className={`health-trend ${trendClass}`}>{trendIcon}</span>
    </div>
  );
}

function OverviewTab({ account, alerts, onOpenEmailModal, onSwitchToSuccessPlan, onSwitchToCommercial }: { 
  account: any; 
  alerts: Alert[];
  onOpenEmailModal: (category?: TemplateCategory) => void;
  onSwitchToSuccessPlan?: () => void;
  onSwitchToCommercial?: () => void;
}) {
  const usage = account.usage;
  const commercial = account.commercial;
  const tenantId = account.tenantIds?.[0] || account.primaryTenantId || account.id;
  
  // Check for payment status issues
  const hasPaymentIssue = commercial?.paymentStatus === 'overdue' || 
                          commercial?.paymentStatus === 'at_risk' ||
                          (commercial?.overdueAmount && commercial.overdueAmount > 0);
  
  // Load success plan from localStorage
  const STORAGE_KEY = `arda_success_plan_${tenantId}`;
  const storedPlan = localStorage.getItem(STORAGE_KEY);
  const successPlan: SuccessPlan | null = storedPlan ? JSON.parse(storedPlan) : null;
  
  // Get overdue milestones for alerts
  const overdueMilestones = successPlan ? getOverdueMilestones(successPlan) : [];
  
  // Prepare activity timeline data
  const activityData = usage.activityTimeline?.slice(-8) || [];
  
  // Prepare feature adoption data for pie chart
  const adoptionData = [
    { name: 'Items', value: usage.featureAdoption.items, color: '#6366f1' },
    { name: 'Kanban', value: usage.featureAdoption.kanban, color: '#8b5cf6' },
    { name: 'Ordering', value: usage.featureAdoption.ordering, color: '#10b981' },
  ].filter(d => d.value > 0);
  
  return (
    <div className="overview-tab">
      {/* Payment Status Warning */}
      {hasPaymentIssue && (
        <div className="payment-warning-banner glass-card">
          <div className="payment-warning-content">
            <span className="payment-warning-icon">💰</span>
            <div className="payment-warning-text">
              <strong>Payment Attention Required</strong>
              <span>
                {commercial?.paymentStatus === 'overdue' 
                  ? `Account has overdue payments${commercial?.overdueAmount ? ` (${formatCurrency(commercial.overdueAmount, commercial.currency)})` : ''}`
                  : 'Payment status requires attention'
                }
              </span>
            </div>
            {onSwitchToCommercial && (
              <button className="btn-secondary" onClick={onSwitchToCommercial}>
                View Commercial
              </button>
            )}
          </div>
        </div>
      )}

      {/* Success Plan Milestone Overdue Alerts */}
      {overdueMilestones.length > 0 && (
        <div className="glass-card milestone-alerts-section">
          <h3>🎯 Success Plan Alerts</h3>
          <div className="milestone-alerts-list">
            {overdueMilestones.map((milestone) => (
              <div key={milestone.id} className="alert-card severity-high milestone-overdue-alert">
                <div className="alert-header">
                  <span className="alert-severity">🟠 overdue</span>
                  <span className="alert-type">milestone</span>
                </div>
                <h4 className="alert-title">Milestone Overdue: {milestone.name}</h4>
                <p className="alert-description">
                  {milestone.description || 'This milestone has passed its target date.'}
                </p>
                {milestone.targetDate && (
                  <div className="alert-action">
                    <span className="action-label">Due:</span>
                    <span className="action-text">{new Date(milestone.targetDate).toLocaleDateString()}</span>
                  </div>
                )}
                {onSwitchToSuccessPlan && (
                  <button 
                    className="btn-secondary"
                    onClick={onSwitchToSuccessPlan}
                  >
                    View Success Plan
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Alerts Section */}
      {alerts.length > 0 && (
        <div className="glass-card alerts-section">
          <h3>⚠️ Active Alerts ({alerts.length})</h3>
          <div className="alerts-list">
            {alerts.slice(0, 5).map((alert) => (
              <AlertCard key={alert.id} alert={alert} onSendEmail={onOpenEmailModal} />
            ))}
          </div>
        </div>
      )}
      
      {/* Success Plan Summary Widget + Key Metrics Grid */}
      <div className="overview-top-section">
        {/* Success Plan Summary Widget - only shows if plan exists */}
        {successPlan && onSwitchToSuccessPlan && (
          <SuccessPlanSummaryWidget
            plan={successPlan}
            onViewPlan={onSwitchToSuccessPlan}
          />
        )}
        
        {/* Key Metrics Grid */}
        <div className="metrics-grid">
          <div className="glass-card metric-card">
            <div className="label">Items</div>
            <div className="value">{usage.itemCount}</div>
            <div className="sub-label">
              {usage.featureAdoption.items}% adoption
            </div>
          </div>
          <div className="glass-card metric-card">
            <div className="label">Kanban Cards</div>
            <div className="value">{usage.kanbanCardCount}</div>
            <div className="sub-label">
              {usage.featureAdoption.kanban}% adoption
            </div>
          </div>
          <div className="glass-card metric-card">
            <div className="label">Orders</div>
            <div className="value">{usage.orderCount}</div>
            <div className="sub-label">
              {usage.outcomes.ordersPlaced} placed
            </div>
          </div>
          <div className="glass-card metric-card">
            <div className="label">Users</div>
            <div className="value">{usage.totalUsers}</div>
            <div className="sub-label">
              {usage.activeUsersLast30Days} active (30d)
            </div>
          </div>
        </div>
      </div>
      
      {/* Charts Row */}
      <div className="charts-grid">
        {/* Activity Timeline */}
        <div className="glass-card chart-card">
          <h3>📈 Activity Timeline</h3>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={activityData}>
              <defs>
                <linearGradient id="activityGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#FC5928" stopOpacity={0.8} />
                  <stop offset="100%" stopColor="#FC5928" stopOpacity={0.1} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
              <XAxis 
                dataKey="date" 
                tick={{ fill: 'rgba(255,255,255,0.5)', fontSize: 10 }}
                tickFormatter={(date) => new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
              />
              <YAxis tick={{ fill: 'rgba(255,255,255,0.5)', fontSize: 10 }} />
              <Tooltip 
                contentStyle={{ 
                  background: 'rgba(18, 18, 26, 0.95)', 
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: '8px',
                }}
              />
              <Area
                type="monotone"
                dataKey="items"
                stackId="1"
                stroke="#6366f1"
                fill="#6366f1"
                fillOpacity={0.3}
                name="Items"
              />
              <Area
                type="monotone"
                dataKey="kanbanCards"
                stackId="1"
                stroke="#8b5cf6"
                fill="#8b5cf6"
                fillOpacity={0.3}
                name="Kanban"
              />
              <Area
                type="monotone"
                dataKey="orders"
                stackId="1"
                stroke="#10b981"
                fill="#10b981"
                fillOpacity={0.3}
                name="Orders"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
        
        {/* Feature Adoption */}
        {adoptionData.length > 0 && (
          <div className="glass-card chart-card">
            <h3>🎯 Feature Adoption</h3>
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie
                  data={adoptionData}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={80}
                  paddingAngle={2}
                  dataKey="value"
                  label={({ name, value }) => `${name}: ${value}%`}
                >
                  {adoptionData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
      
      {/* Recent Activity */}
      <div className="glass-card">
        <h3>📋 Recent Activity</h3>
        <div className="recent-activity-list">
          {account.timeline?.slice(0, 10).map((event: TimelineEvent) => (
            <div key={event.id} className="activity-item">
              <span className="activity-icon">
                {event.type === 'product_activity' ? '📦' : 
                 event.type === 'interaction' ? '💬' :
                 event.type === 'alert' ? '⚠️' : '📌'}
              </span>
              <div className="activity-content">
                <span className="activity-title">{event.title}</span>
                {event.description && (
                  <span className="activity-description">{event.description}</span>
                )}
              </div>
              <span className="activity-time">
                {formatRelativeTime(event.timestamp)}
              </span>
            </div>
          ))}
          {(!account.timeline || account.timeline.length === 0) && (
            <p className="empty-state">No recent activity</p>
          )}
        </div>
      </div>
    </div>
  );
}

function HealthTab({ health }: { health: any }) {
  const componentData = Object.entries(health.components).map(([name, component]: [string, any]) => ({
    name: name.charAt(0).toUpperCase() + name.slice(1),
    score: component.score,
    weight: Math.round(component.weight * 100),
    weightedScore: Math.round(component.weightedScore),
    trend: component.trend,
  }));
  
  return (
    <div className="health-tab">
      {/* Overall Health Card */}
      <div className="glass-card health-overview-card">
        <div className="health-score-large">
          <div className={`score-circle grade-${health.grade.toLowerCase()}`}>
            <span className="score-value">{health.score}</span>
            <span className="score-grade">{health.grade}</span>
          </div>
          <div className="health-meta">
            <div className="health-trend">
              {health.trend === 'improving' ? '📈 Improving' :
               health.trend === 'declining' ? '📉 Declining' : '➡️ Stable'}
            </div>
            <div className="health-change">
              {health.scoreChange > 0 ? '+' : ''}{health.scoreChange} points
            </div>
            {health.changeReason && (
              <div className="health-reason">{health.changeReason}</div>
            )}
          </div>
        </div>
        
        <div className="health-confidence">
          <span className="confidence-label">Data Confidence:</span>
          <div className="confidence-bar">
            <div className="confidence-fill" style={{ width: `${health.confidence}%` }} />
          </div>
          <span className="confidence-value">{health.confidence}%</span>
        </div>
      </div>
      
      {/* Component Breakdown */}
      <div className="glass-card">
        <h3>Health Components</h3>
        <div className="health-components">
          {componentData.map((component) => (
            <HealthComponentCard key={component.name} component={component} />
          ))}
        </div>
      </div>
      
      {/* Component Bar Chart */}
      <div className="glass-card chart-card">
        <h3>Component Scores</h3>
        <ResponsiveContainer width="100%" height={250}>
          <BarChart data={componentData} layout="vertical">
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
            <XAxis type="number" domain={[0, 100]} tick={{ fill: 'rgba(255,255,255,0.5)' }} />
            <YAxis type="category" dataKey="name" tick={{ fill: 'rgba(255,255,255,0.5)' }} width={100} />
            <Tooltip 
              contentStyle={{ 
                background: 'rgba(18, 18, 26, 0.95)', 
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: '8px',
              }}
            />
            <Bar dataKey="score" fill="#6366f1" name="Score" radius={[0, 4, 4, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function HealthComponentCard({ component }: { component: any }) {
  const getScoreColor = (score: number) => {
    if (score >= 70) return 'healthy';
    if (score >= 40) return 'at-risk';
    return 'critical';
  };
  
  return (
    <div className="health-component-card">
      <div className="component-header">
        <span className="component-name">{component.name}</span>
        <span className="component-weight">({component.weight}% weight)</span>
      </div>
      <div className="component-score-bar">
        <div 
          className={`component-score-fill ${getScoreColor(component.score)}`}
          style={{ width: `${component.score}%` }}
        />
      </div>
      <div className="component-footer">
        <span className="component-score">{component.score}/100</span>
        <span className="component-weighted">→ {component.weightedScore} pts</span>
      </div>
    </div>
  );
}

// ============================================================================
// Commercial Tab Component
// ============================================================================

function CommercialTab({ account, onOpenEmailModal }: { 
  account: any;
  onOpenEmailModal: (category?: TemplateCategory) => void;
}) {
  const primaryContact = account.stakeholders?.find((s: Stakeholder) => s.isPrimary);
  const { data: commercialData, isLoading } = useCommercialMetrics(
    account.id,
    primaryContact?.email,
    account.commercial
  );
  
  if (isLoading) {
    return (
      <div className="commercial-tab">
        <div className="loading-state">
          <div className="loading-spinner" />
          <p>Loading billing information...</p>
        </div>
      </div>
    );
  }
  
  const data = commercialData || account.commercial;
  const subscription = data?.subscription;
  const invoices = data?.recentInvoices || [];
  const expansionSignals = data?.expansionSignals || [];
  
  // Calculate subscription status info
  const subscriptionStatus = subscription ? getSubscriptionStatusInfo(subscription.status) : null;
  
  // Calculate days to renewal
  const daysToRenewal = data?.daysToRenewal ?? (data?.renewalDate ? daysUntil(data.renewalDate) : null);
  
  // Calculate seat utilization
  const seatUtilization = data?.seatUtilization ?? (
    data?.seatLimit && data?.seatUsage 
      ? Math.round((data.seatUsage / data.seatLimit) * 100)
      : null
  );
  
  // Open renewal email template
  const handleScheduleRenewalCall = () => {
    onOpenEmailModal('renewal');
  };
  
  return (
    <div className="commercial-tab">
      {/* Billing Overview Card */}
      <div className="glass-card billing-overview-card">
        <h3>📊 Billing Overview</h3>
        <div className="billing-overview-grid">
          {/* ARR/MRR Display */}
          <div className="billing-stat-large">
            <span className="billing-stat-label">Annual Recurring Revenue</span>
            <span className="billing-stat-value arr-value">
              {data?.arr ? formatCurrency(data.arr, data.currency) : '—'}
            </span>
            {data?.mrr && (
              <span className="billing-stat-sub">
                {formatCurrency(data.mrr, data.currency)}/month
              </span>
            )}
          </div>
          
          {/* Plan & Billing */}
          <div className="billing-details">
            <div className="billing-detail-row">
              <span className="billing-detail-label">Plan</span>
              <span className="billing-detail-value plan-name">{data?.plan || 'Unknown'}</span>
            </div>
            <div className="billing-detail-row">
              <span className="billing-detail-label">Billing Interval</span>
              <span className="billing-detail-value">
                {subscription?.billingInterval ? 
                  subscription.billingInterval.charAt(0).toUpperCase() + subscription.billingInterval.slice(1) + 'ly' 
                  : '—'}
              </span>
            </div>
            <div className="billing-detail-row">
              <span className="billing-detail-label">Subscription Status</span>
              {subscriptionStatus ? (
                <span className={`subscription-status-badge status-${subscriptionStatus.color}`}>
                  {subscriptionStatus.icon} {subscriptionStatus.label}
                </span>
              ) : (
                <span className="billing-detail-value">—</span>
              )}
            </div>
            <div className="billing-detail-row">
              <span className="billing-detail-label">Payment Status</span>
              <span className={`payment-status-indicator status-${data?.paymentStatus || 'unknown'}`}>
                {data?.paymentStatus === 'current' && '✓ Current'}
                {data?.paymentStatus === 'overdue' && '⚠️ Overdue'}
                {data?.paymentStatus === 'at_risk' && '⚠️ At Risk'}
                {data?.paymentStatus === 'churned' && '✕ Churned'}
                {(!data?.paymentStatus || data?.paymentStatus === 'unknown') && '? Unknown'}
              </span>
            </div>
          </div>
        </div>
      </div>
      
      {/* Renewal Section */}
      <div className="glass-card renewal-section">
        <h3>🔄 Renewal</h3>
        <div className="renewal-content">
          <div className="renewal-countdown">
            {daysToRenewal !== null ? (
              <>
                <span className={`days-to-renewal ${daysToRenewal <= 30 ? 'urgent' : daysToRenewal <= 60 ? 'warning' : ''}`}>
                  {daysToRenewal}
                </span>
                <span className="days-label">days to renewal</span>
              </>
            ) : (
              <span className="no-renewal-date">No renewal date set</span>
            )}
          </div>
          
          <div className="renewal-details">
            <div className="renewal-detail-row">
              <span className="renewal-detail-label">Current Period End</span>
              <span className="renewal-detail-value">
                {subscription?.currentPeriodEnd 
                  ? new Date(subscription.currentPeriodEnd).toLocaleDateString('en-US', { 
                      year: 'numeric', month: 'short', day: 'numeric' 
                    })
                  : data?.renewalDate 
                    ? new Date(data.renewalDate).toLocaleDateString('en-US', { 
                        year: 'numeric', month: 'short', day: 'numeric' 
                      })
                    : '—'
                }
              </span>
            </div>
            <div className="renewal-detail-row">
              <span className="renewal-detail-label">Auto-Renew</span>
              <span className={`renewal-detail-value ${data?.autoRenew ? 'auto-renew-on' : 'auto-renew-off'}`}>
                {data?.autoRenew === true && '✓ Enabled'}
                {data?.autoRenew === false && '✕ Disabled'}
                {data?.autoRenew === undefined && '—'}
                {subscription?.cancelAtPeriodEnd && ' (Cancels at period end)'}
              </span>
            </div>
            <div className="renewal-detail-row">
              <span className="renewal-detail-label">Contract Term</span>
              <span className="renewal-detail-value">
                {data?.termMonths ? `${data.termMonths} months` : '—'}
              </span>
            </div>
          </div>
          
          <button 
            className="btn-primary schedule-renewal-btn"
            onClick={handleScheduleRenewalCall}
          >
            📅 Schedule Renewal Call
          </button>
        </div>
      </div>
      
      {/* Two Column Layout for Payment History and Expansion */}
      <div className="commercial-two-column">
        {/* Payment History */}
        <div className="glass-card payment-history-section">
          <h3>📄 Payment History</h3>
          {invoices.length > 0 ? (
            <div className="invoices-list">
              {invoices.slice(0, 5).map((invoice: StripeInvoice) => {
                const statusInfo = getInvoiceStatusInfo(invoice.status, invoice.isOverdue);
                return (
                  <div key={invoice.id} className={`invoice-item status-${statusInfo.color}`}>
                    <div className="invoice-info">
                      <span className="invoice-number">{invoice.number}</span>
                      <span className="invoice-date">
                        {new Date(invoice.createdAt).toLocaleDateString('en-US', {
                          year: 'numeric', month: 'short', day: 'numeric'
                        })}
                      </span>
                    </div>
                    <div className="invoice-amount">
                      <span className="amount-due">
                        {formatCurrencyPrecise(invoice.amountDue / 100, invoice.currency)}
                      </span>
                      {invoice.amountPaid > 0 && invoice.amountPaid < invoice.amountDue && (
                        <span className="amount-paid">
                          Paid: {formatCurrencyPrecise(invoice.amountPaid / 100, invoice.currency)}
                        </span>
                      )}
                    </div>
                    <span className={`invoice-status-badge status-${statusInfo.color}`}>
                      {statusInfo.label}
                    </span>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="empty-state-small">No invoice history available</p>
          )}
          
          {data?.isOverdue && data?.totalOverdueAmount > 0 && (
            <div className="overdue-summary">
              <span className="overdue-icon">⚠️</span>
              <span className="overdue-text">
                {data.overdueCount} overdue invoice{data.overdueCount > 1 ? 's' : ''} totaling{' '}
                <strong>{formatCurrency(data.totalOverdueAmount, data.currency)}</strong>
              </span>
            </div>
          )}
        </div>
        
        {/* Expansion Signals */}
        <div className="glass-card expansion-section">
          <h3>📈 Expansion Signals</h3>
          
          {/* Seat Utilization */}
          {seatUtilization !== null && (
            <div className="seat-utilization">
              <div className="seat-info">
                <span className="seat-label">Seat Utilization</span>
                <span className="seat-count">
                  {data?.seatUsage || 0} / {data?.seatLimit || '∞'} seats
                </span>
              </div>
              <div className="seat-progress-bar">
                <div 
                  className={`seat-progress-fill ${seatUtilization >= 90 ? 'critical' : seatUtilization >= 70 ? 'warning' : ''}`}
                  style={{ width: `${Math.min(100, seatUtilization)}%` }}
                />
              </div>
              {seatUtilization >= 80 && (
                <span className="seat-alert">
                  🔥 {seatUtilization >= 90 ? 'Approaching seat limit!' : 'High seat usage'}
                </span>
              )}
            </div>
          )}
          
          {/* Expansion Potential */}
          <div className="expansion-potential">
            <span className="expansion-label">Expansion Potential</span>
            <span className={`expansion-badge potential-${data?.expansionPotential || 'none'}`}>
              {data?.expansionPotential === 'high' && '🚀 High'}
              {data?.expansionPotential === 'medium' && '📊 Medium'}
              {data?.expansionPotential === 'low' && '📉 Low'}
              {(!data?.expansionPotential || data?.expansionPotential === 'none') && '—'}
            </span>
          </div>
          
          {/* Expansion Signals List */}
          {expansionSignals.length > 0 ? (
            <div className="expansion-signals-list">
              {expansionSignals.map((signal, index) => (
                <div key={index} className={`expansion-signal strength-${signal.strength}`}>
                  <span className="signal-icon">
                    {signal.type === 'seat_pressure' && '👥'}
                    {signal.type === 'feature_limit' && '🔒'}
                    {signal.type === 'multi_site' && '🏢'}
                    {signal.type === 'high_usage' && '📈'}
                    {signal.type === 'new_department' && '🆕'}
                  </span>
                  <div className="signal-content">
                    <span className="signal-description">{signal.description}</span>
                    <span className="signal-meta">
                      <span className={`signal-strength strength-${signal.strength}`}>
                        {signal.strength} signal
                      </span>
                      <span className="signal-date">
                        {formatRelativeTime(signal.detectedAt)}
                      </span>
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="empty-state-small">No expansion signals detected</p>
          )}
          
          {/* Upsell CTA */}
          {(data?.expansionPotential === 'high' || data?.expansionPotential === 'medium' || seatUtilization && seatUtilization >= 80) && (
            <button 
              className="btn-secondary expansion-cta"
              onClick={() => onOpenEmailModal('expansion')}
            >
              💼 Send Expansion Email
            </button>
          )}
        </div>
      </div>
      
      {/* Data Source Indicator */}
      {data?.source && (
        <div className="data-source-indicator">
          <span className="source-label">Data source:</span>
          <span className={`source-badge source-${data.source}`}>
            {data.source === 'stripe' && '💳 Stripe'}
            {data.source === 'account' && '📋 Account Data'}
            {data.source === 'mock' && '🧪 Demo Data'}
          </span>
          {data.fetchedAt && (
            <span className="fetched-at">
              Updated {formatRelativeTime(data.fetchedAt)}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

function TimelineTab({ timeline }: { timeline: TimelineEvent[] }) {
  const [filter, setFilter] = useState<string>('all');
  
  const filteredTimeline = filter === 'all' 
    ? timeline 
    : timeline.filter(e => e.type === filter);
  
  return (
    <div className="timeline-tab">
      <div className="timeline-filters">
        <button 
          className={`filter-btn ${filter === 'all' ? 'active' : ''}`}
          onClick={() => setFilter('all')}
        >
          All
        </button>
        <button 
          className={`filter-btn ${filter === 'product_activity' ? 'active' : ''}`}
          onClick={() => setFilter('product_activity')}
        >
          Product
        </button>
        <button 
          className={`filter-btn ${filter === 'interaction' ? 'active' : ''}`}
          onClick={() => setFilter('interaction')}
        >
          Interactions
        </button>
        <button 
          className={`filter-btn ${filter === 'alert' ? 'active' : ''}`}
          onClick={() => setFilter('alert')}
        >
          Alerts
        </button>
      </div>
      
      <div className="glass-card timeline-container">
        <div className="timeline-list">
          {filteredTimeline.map((event) => (
            <div key={event.id} className={`timeline-item ${event.type}`}>
              <div className="timeline-marker" />
              <div className="timeline-content">
                <div className="timeline-header">
                  <span className="timeline-title">{event.title}</span>
                  <span className="timeline-time">
                    {new Date(event.timestamp).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                </div>
                {event.description && (
                  <p className="timeline-description">{event.description}</p>
                )}
                {event.actor && (
                  <span className="timeline-actor">by {event.actor}</span>
                )}
              </div>
            </div>
          ))}
          {filteredTimeline.length === 0 && (
            <p className="empty-state">No timeline events</p>
          )}
        </div>
      </div>
    </div>
  );
}

function StakeholdersTab({ stakeholders }: { stakeholders: Stakeholder[] }) {
  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'champion': return '🌟';
      case 'economic_buyer': return '💰';
      case 'decision_maker': return '👔';
      case 'admin': return '⚙️';
      case 'power_user': return '💪';
      case 'executive_sponsor': return '👑';
      default: return '👤';
    }
  };
  
  return (
    <div className="stakeholders-tab">
      <div className="glass-card">
        <h3>👥 Stakeholders ({stakeholders.length})</h3>
        <div className="stakeholders-list">
          {stakeholders.map((stakeholder) => (
            <div key={stakeholder.id} className={`stakeholder-card ${stakeholder.isPrimary ? 'primary' : ''}`}>
              <div className="stakeholder-avatar">
                {getRoleIcon(stakeholder.role)}
              </div>
              <div className="stakeholder-info">
                <span className="stakeholder-name">{stakeholder.name}</span>
                <span className="stakeholder-email">{stakeholder.email}</span>
                <div className="stakeholder-badges">
                  <span className="role-badge">{stakeholder.role.replace('_', ' ')}</span>
                  <span className={`influence-badge ${stakeholder.influence}`}>
                    {stakeholder.influence} influence
                  </span>
                </div>
              </div>
              {stakeholder.lastContactedAt && (
                <div className="stakeholder-last-contact">
                  Last contact: {formatRelativeTime(stakeholder.lastContactedAt)}
                </div>
              )}
            </div>
          ))}
          {stakeholders.length === 0 && (
            <p className="empty-state">No stakeholders identified yet</p>
          )}
        </div>
      </div>
      
      {/* Stakeholder Coverage Analysis */}
      <div className="glass-card">
        <h3>Coverage Analysis</h3>
        <div className="coverage-grid">
          <div className={`coverage-item ${stakeholders.some(s => s.role === 'champion') ? 'covered' : 'missing'}`}>
            <span className="coverage-icon">🌟</span>
            <span className="coverage-label">Champion</span>
            <span className="coverage-status">
              {stakeholders.some(s => s.role === 'champion') ? '✓' : '⚠️ Missing'}
            </span>
          </div>
          <div className={`coverage-item ${stakeholders.some(s => s.role === 'economic_buyer') ? 'covered' : 'missing'}`}>
            <span className="coverage-icon">💰</span>
            <span className="coverage-label">Economic Buyer</span>
            <span className="coverage-status">
              {stakeholders.some(s => s.role === 'economic_buyer') ? '✓' : '⚠️ Unknown'}
            </span>
          </div>
          <div className={`coverage-item ${stakeholders.some(s => s.role === 'admin') ? 'covered' : 'missing'}`}>
            <span className="coverage-icon">⚙️</span>
            <span className="coverage-label">Admin</span>
            <span className="coverage-status">
              {stakeholders.some(s => s.role === 'admin') ? '✓' : '⚠️ Unknown'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

function TasksTab({ tenantId }: { tenantId: string }) {
  const STORAGE_KEY = `arda_account_tasks_${tenantId}`;
  
  const [tasks, setTasks] = useState<Task[]>(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  });
  
  const [showAddForm, setShowAddForm] = useState(false);
  const [newTask, setNewTask] = useState({
    title: '',
    description: '',
    priority: 'normal' as Task['priority'],
    dueDate: '',
  });
  
  // Persist to localStorage whenever tasks change
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
  }, [tasks, STORAGE_KEY]);
  
  // Sort tasks by priority (urgent > high > normal > low), then by due date
  const priorityOrder = { urgent: 0, high: 1, normal: 2, low: 3 };
  
  const sortTasks = useCallback((taskList: Task[]) => {
    return [...taskList].sort((a, b) => {
      // First sort by priority
      const priorityDiff = priorityOrder[a.priority] - priorityOrder[b.priority];
      if (priorityDiff !== 0) return priorityDiff;
      
      // Then by due date (tasks with due dates first, earlier dates first)
      if (a.dueDate && b.dueDate) {
        return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
      }
      if (a.dueDate && !b.dueDate) return -1;
      if (!a.dueDate && b.dueDate) return 1;
      
      // Finally by creation date
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  }, []);
  
  const pendingTasks = sortTasks(tasks.filter(t => t.status !== 'completed'));
  const completedTasks = sortTasks(tasks.filter(t => t.status === 'completed'));
  
  const handleAddTask = () => {
    if (!newTask.title.trim()) return;
    
    const now = new Date().toISOString();
    const task: Task = {
      id: `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      accountId: tenantId,
      title: newTask.title.trim(),
      description: newTask.description.trim() || undefined,
      type: 'custom',
      priority: newTask.priority,
      dueDate: newTask.dueDate || undefined,
      status: 'pending',
      source: 'manual',
      createdAt: now,
      updatedAt: now,
    };
    
    setTasks(prev => [...prev, task]);
    setNewTask({ title: '', description: '', priority: 'normal', dueDate: '' });
    setShowAddForm(false);
  };
  
  const handleCompleteTask = (taskId: string) => {
    setTasks(prev => prev.map(t => 
      t.id === taskId 
        ? { ...t, status: 'completed' as const, completedAt: new Date().toISOString(), updatedAt: new Date().toISOString() }
        : t
    ));
  };
  
  const handleUncompleteTask = (taskId: string) => {
    setTasks(prev => prev.map(t => 
      t.id === taskId 
        ? { ...t, status: 'pending' as const, completedAt: undefined, updatedAt: new Date().toISOString() }
        : t
    ));
  };
  
  const handleDeleteTask = (taskId: string) => {
    setTasks(prev => prev.filter(t => t.id !== taskId));
  };
  
  const getPriorityColor = (priority: Task['priority']) => {
    switch (priority) {
      case 'urgent': return 'var(--danger)';
      case 'high': return '#f97316';
      case 'normal': return 'var(--info)';
      case 'low': return 'var(--text-muted)';
    }
  };
  
  const formatDueDate = (date: string) => {
    const d = new Date(date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const dueDay = new Date(d);
    dueDay.setHours(0, 0, 0, 0);
    
    const diffDays = Math.ceil((dueDay.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    
    if (diffDays < 0) return { text: `${Math.abs(diffDays)}d overdue`, isOverdue: true };
    if (diffDays === 0) return { text: 'Due today', isOverdue: false };
    if (diffDays === 1) return { text: 'Due tomorrow', isOverdue: false };
    if (diffDays <= 7) return { text: `Due in ${diffDays}d`, isOverdue: false };
    return { text: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }), isOverdue: false };
  };
  
  return (
    <div className="tasks-tab">
      {/* Task Stats */}
      <div className="task-stats-bar glass-card">
        <div className="task-stat">
          <span className="task-stat-value">{pendingTasks.length}</span>
          <span className="task-stat-label">Pending</span>
        </div>
        <div className="task-stat-divider" />
        <div className="task-stat">
          <span className="task-stat-value completed">{completedTasks.length}</span>
          <span className="task-stat-label">Completed</span>
        </div>
        <div className="task-stat-divider" />
        <div className="task-stat">
          <span className="task-stat-value urgent">{pendingTasks.filter(t => t.priority === 'urgent').length}</span>
          <span className="task-stat-label">Urgent</span>
        </div>
      </div>
      
      {/* Add Task Form */}
      <div className="glass-card task-section">
        <div className="task-section-header">
          <h3>📋 Open Tasks ({pendingTasks.length})</h3>
          <button 
            className="add-task-toggle-btn"
            onClick={() => setShowAddForm(!showAddForm)}
          >
            {showAddForm ? '✕ Cancel' : '+ Add Task'}
          </button>
        </div>
        
        {showAddForm && (
          <div className="add-task-form">
            <div className="form-row">
              <input
                type="text"
                placeholder="Task title *"
                value={newTask.title}
                onChange={(e) => setNewTask(prev => ({ ...prev, title: e.target.value }))}
                className="task-input task-title-input"
                autoFocus
              />
            </div>
            <div className="form-row">
              <textarea
                placeholder="Description (optional)"
                value={newTask.description}
                onChange={(e) => setNewTask(prev => ({ ...prev, description: e.target.value }))}
                className="task-input task-description-input"
                rows={2}
              />
            </div>
            <div className="form-row form-row-inline">
              <div className="form-field">
                <label htmlFor="task-priority">Priority</label>
                <select
                  id="task-priority"
                  value={newTask.priority}
                  onChange={(e) => setNewTask(prev => ({ ...prev, priority: e.target.value as Task['priority'] }))}
                  className="task-select"
                  aria-label="Task priority"
                >
                  <option value="urgent">🔴 Urgent</option>
                  <option value="high">🟠 High</option>
                  <option value="normal">🔵 Normal</option>
                  <option value="low">⚪ Low</option>
                </select>
              </div>
              <div className="form-field">
                <label htmlFor="task-due-date">Due Date</label>
                <input
                  id="task-due-date"
                  type="date"
                  value={newTask.dueDate}
                  onChange={(e) => setNewTask(prev => ({ ...prev, dueDate: e.target.value }))}
                  className="task-input task-date-input"
                  min={new Date().toISOString().split('T')[0]}
                  aria-label="Task due date"
                />
              </div>
              <button 
                className="btn-primary add-task-submit"
                onClick={handleAddTask}
                disabled={!newTask.title.trim()}
              >
                Add Task
              </button>
            </div>
          </div>
        )}
        
        {/* Pending Tasks List */}
        <div className="tasks-list">
          {pendingTasks.length === 0 ? (
            <p className="empty-state">No pending tasks. Click "+ Add Task" to create one.</p>
          ) : (
            pendingTasks.map(task => (
              <div key={task.id} className="task-item">
                <button 
                  className="task-checkbox"
                  onClick={() => handleCompleteTask(task.id)}
                  title="Mark as complete"
                >
                  <span className="checkbox-inner" />
                </button>
                <div className="task-content">
                  <div className="task-header">
                    <span className="task-title">{task.title}</span>
                    <span 
                      className="task-priority-badge"
                      style={{ background: `${getPriorityColor(task.priority)}20`, color: getPriorityColor(task.priority) }}
                    >
                      {task.priority}
                    </span>
                  </div>
                  {task.description && (
                    <p className="task-description">{task.description}</p>
                  )}
                  <div className="task-meta">
                    {task.dueDate && (
                      <span className={`task-due-date ${formatDueDate(task.dueDate).isOverdue ? 'overdue' : ''}`}>
                        📅 {formatDueDate(task.dueDate).text}
                      </span>
                    )}
                    <span className="task-created">
                      Created {formatRelativeTime(task.createdAt)}
                    </span>
                  </div>
                </div>
                <button 
                  className="task-delete-btn"
                  onClick={() => handleDeleteTask(task.id)}
                  title="Delete task"
                >
                  🗑️
                </button>
              </div>
            ))
          )}
        </div>
      </div>
      
      {/* Completed Tasks */}
      {completedTasks.length > 0 && (
        <div className="glass-card task-section completed-section">
          <h3>✓ Completed ({completedTasks.length})</h3>
          <div className="tasks-list">
            {completedTasks.map(task => (
              <div key={task.id} className="task-item completed">
                <button 
                  className="task-checkbox checked"
                  onClick={() => handleUncompleteTask(task.id)}
                  title="Mark as incomplete"
                >
                  <span className="checkbox-inner">✓</span>
                </button>
                <div className="task-content">
                  <span className="task-title">{task.title}</span>
                  {task.completedAt && (
                    <span className="task-completed-at">
                      Completed {formatRelativeTime(task.completedAt)}
                    </span>
                  )}
                </div>
                <button 
                  className="task-delete-btn"
                  onClick={() => handleDeleteTask(task.id)}
                  title="Delete task"
                >
                  🗑️
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function SuccessPlanTab({ tenantId }: { tenantId: string }) {
  const STORAGE_KEY = `arda_success_plan_${tenantId}`;
  
  const [successPlan, setSuccessPlan] = useState<SuccessPlan | null>(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
    return null; // No plan by default - user must create one
  });
  
  const [selectedMilestone, setSelectedMilestone] = useState<string | null>(null);
  const [showTemplateSelector, setShowTemplateSelector] = useState(false);
  
  // Persist to localStorage whenever successPlan changes
  useEffect(() => {
    if (successPlan) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(successPlan));
    }
  }, [successPlan, STORAGE_KEY]);
  
  // Handle creating a plan from a template
  const handleCreateFromTemplate = (templateId: string) => {
    const newPlan = createPlanFromTemplate(templateId, tenantId);
    if (newPlan) {
      setSuccessPlan(newPlan);
      setShowTemplateSelector(false);
    }
  };
  
  // Handle deleting the plan
  const handleDeletePlan = () => {
    if (confirm('Are you sure you want to delete this success plan? This cannot be undone.')) {
      localStorage.removeItem(STORAGE_KEY);
      setSuccessPlan(null);
    }
  };
  
  // If no plan exists, show the create plan UI
  if (!successPlan) {
    return (
      <div className="success-plan-tab no-plan">
        <div className="glass-card create-plan-section">
          <div className="create-plan-header">
            <h3>🎯 No Success Plan Yet</h3>
            <p>Create a success plan to track onboarding milestones, goals, and progress for this account.</p>
          </div>
          
          {!showTemplateSelector ? (
            <button 
              className="btn-primary create-plan-btn"
              onClick={() => setShowTemplateSelector(true)}
            >
              + Create Success Plan
            </button>
          ) : (
            <div className="template-selector">
              <h4>Choose a Template</h4>
              <div className="template-grid">
                {SUCCESS_PLAN_TEMPLATES.map(template => (
                  <div 
                    key={template.id}
                    className="template-card"
                    onClick={() => handleCreateFromTemplate(template.id)}
                  >
                    <div className="template-header">
                      <span className="template-category">
                        {template.suggestedFor[0]}
                      </span>
                      <span className="template-duration">
                        {template.expectedDurationDays} days
                      </span>
                    </div>
                    <h5 className="template-name">{template.name}</h5>
                    <p className="template-description">{template.description}</p>
                    <div className="template-stats">
                      <span>{template.defaultMilestones.length} milestones</span>
                      <span>{template.defaultGoals.length} goals</span>
                    </div>
                  </div>
                ))}
              </div>
              <button 
                className="btn-secondary cancel-btn"
                onClick={() => setShowTemplateSelector(false)}
              >
                Cancel
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }
  
  // Calculate progress
  const completedCount = successPlan.milestones.filter(m => m.status === 'completed').length;
  const totalCount = successPlan.milestones.length;
  const progressPercent = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;
  
  // Sort milestones by order
  const sortedMilestones = [...successPlan.milestones].sort((a, b) => a.order - b.order);
  
  // Get plan health info
  const overdueMilestones = getOverdueMilestones(successPlan);
  const nextMilestone = getNextMilestone(successPlan);
  const daysRemaining = getDaysRemaining(successPlan);
  
  const updateMilestoneStatus = (milestoneId: string, newStatus: MilestoneStatus) => {
    const now = new Date().toISOString();
    setSuccessPlan(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        updatedAt: now,
        milestones: prev.milestones.map(m => 
          m.id === milestoneId 
            ? { 
                ...m, 
                status: newStatus,
                completedDate: newStatus === 'completed' ? now : undefined,
              }
            : m
        ),
      };
    });
    setSelectedMilestone(null);
  };
  
  const updateMilestone = (milestoneId: string, updates: Partial<Milestone>) => {
    const now = new Date().toISOString();
    setSuccessPlan(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        updatedAt: now,
        milestones: prev.milestones.map(m => 
          m.id === milestoneId ? { ...m, ...updates } : m
        ),
      };
    });
  };
  
  const addBlocker = (milestoneId: string, blocker: string) => {
    if (!blocker.trim()) return;
    const now = new Date().toISOString();
    setSuccessPlan(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        updatedAt: now,
        milestones: prev.milestones.map(m => 
          m.id === milestoneId 
            ? { ...m, blockers: [...(m.blockers || []), blocker.trim()], status: 'blocked' as MilestoneStatus }
            : m
        ),
      };
    });
  };
  
  const removeBlocker = (milestoneId: string, blockerIndex: number) => {
    const now = new Date().toISOString();
    setSuccessPlan(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        updatedAt: now,
        milestones: prev.milestones.map(m => {
          if (m.id !== milestoneId) return m;
          const newBlockers = [...(m.blockers || [])];
          newBlockers.splice(blockerIndex, 1);
          return { 
            ...m, 
            blockers: newBlockers,
            // If no more blockers and was blocked, set to in_progress
            status: newBlockers.length === 0 && m.status === 'blocked' ? 'in_progress' : m.status,
          };
        }),
      };
    });
  };
  
  const getStatusIcon = (status: MilestoneStatus) => {
    switch (status) {
      case 'completed': return '✅';
      case 'in_progress': return '🔄';
      case 'blocked': return '🚫';
      case 'skipped': return '⏭️';
      default: return '⏳';
    }
  };
  
  const getStatusColor = (status: MilestoneStatus) => {
    switch (status) {
      case 'completed': return 'var(--success)';
      case 'in_progress': return 'var(--info)';
      case 'blocked': return 'var(--danger)';
      case 'skipped': return 'var(--text-muted)';
      default: return 'var(--text-muted)';
    }
  };
  
  return (
    <div className="success-plan-tab">
      {/* Progress Overview */}
      <div className="glass-card success-plan-header">
        <div className="success-plan-top-row">
          <div className="success-plan-progress">
            <div className="progress-info">
              <h3>🎯 Success Plan Progress</h3>
              <span className="progress-text">{completedCount} of {totalCount} milestones completed</span>
            </div>
            <div className="progress-bar-container">
              <div className="progress-bar">
                <div 
                  className="progress-fill" 
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
              <span className="progress-percent">{progressPercent}%</span>
            </div>
          </div>
          
          <div className="success-plan-actions">
            <button 
              className="btn-secondary btn-small delete-plan-btn"
              onClick={handleDeletePlan}
              title="Delete this success plan"
            >
              🗑️ Delete Plan
            </button>
          </div>
        </div>
        
        {/* Plan Info Row */}
        <div className="success-plan-info-row">
          {daysRemaining !== null && (
            <div className={`plan-info-item ${daysRemaining < 0 ? 'overdue' : daysRemaining < 14 ? 'urgent' : ''}`}>
              <span className="info-label">
                {daysRemaining < 0 ? 'Overdue by' : 'Days Remaining'}
              </span>
              <span className="info-value">{Math.abs(daysRemaining)}</span>
            </div>
          )}
          {nextMilestone && (
            <div className="plan-info-item next-milestone-info">
              <span className="info-label">Next Milestone</span>
              <span className="info-value">{nextMilestone.name}</span>
            </div>
          )}
          {overdueMilestones.length > 0 && (
            <div className="plan-info-item overdue-warning">
              <span className="info-label">Overdue</span>
              <span className="info-value">{overdueMilestones.length} milestone{overdueMilestones.length > 1 ? 's' : ''}</span>
            </div>
          )}
        </div>
        
        <div className="success-plan-status-summary">
          <div className="status-count">
            <span className="count-value completed">{successPlan.milestones.filter(m => m.status === 'completed').length}</span>
            <span className="count-label">Completed</span>
          </div>
          <div className="status-count">
            <span className="count-value in-progress">{successPlan.milestones.filter(m => m.status === 'in_progress').length}</span>
            <span className="count-label">In Progress</span>
          </div>
          <div className="status-count">
            <span className="count-value blocked">{successPlan.milestones.filter(m => m.status === 'blocked').length}</span>
            <span className="count-label">Blocked</span>
          </div>
          <div className="status-count">
            <span className="count-value pending">{successPlan.milestones.filter(m => m.status === 'pending').length}</span>
            <span className="count-label">Pending</span>
          </div>
        </div>
      </div>
      
      {/* Goals Section */}
      {successPlan.goals.length > 0 && (
        <div className="glass-card goals-section">
          <h3>🎯 Success Goals</h3>
          <div className="goals-list">
            {successPlan.goals.map(goal => (
              <div key={goal.id} className={`goal-item status-${goal.status}`}>
                <span className="goal-status-icon">
                  {goal.status === 'achieved' ? '✅' :
                   goal.status === 'in_progress' ? '🔄' :
                   goal.status === 'at_risk' ? '⚠️' :
                   goal.status === 'missed' ? '❌' : '⏳'}
                </span>
                <span className="goal-description">{goal.description}</span>
                <span className={`goal-status-badge ${goal.status}`}>
                  {goal.status.replace('_', ' ')}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
      
      {/* Milestones List */}
      <div className="glass-card milestones-section">
        <h3>📋 Milestones</h3>
        <div className="milestones-list">
          {sortedMilestones.map((milestone, index) => (
            <div 
              key={milestone.id} 
              className={`milestone-item status-${milestone.status} ${selectedMilestone === milestone.id ? 'expanded' : ''}`}
            >
              <div 
                className="milestone-header"
                onClick={() => setSelectedMilestone(selectedMilestone === milestone.id ? null : milestone.id)}
              >
                <div className="milestone-order">{index + 1}</div>
                <div className="milestone-status-indicator" style={{ background: getStatusColor(milestone.status) }}>
                  {getStatusIcon(milestone.status)}
                </div>
                <div className="milestone-main">
                  <div className="milestone-title-row">
                    <span className="milestone-name">{milestone.name}</span>
                    <span className={`milestone-status-badge ${milestone.status}`}>
                      {milestone.status.replace('_', ' ')}
                    </span>
                  </div>
                  <div className="milestone-meta">
                    {milestone.targetDate && (
                      <span className="milestone-target-date">
                        📅 Target: {new Date(milestone.targetDate).toLocaleDateString()}
                      </span>
                    )}
                    {milestone.ownerName && (
                      <span className="milestone-owner">
                        👤 {milestone.ownerName}
                      </span>
                    )}
                    {milestone.completedDate && (
                      <span className="milestone-completed-date">
                        ✓ Completed: {new Date(milestone.completedDate).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                </div>
                <button className="milestone-expand-btn">
                  {selectedMilestone === milestone.id ? '▼' : '▶'}
                </button>
              </div>
              
              {selectedMilestone === milestone.id && (
                <div className="milestone-expanded">
                  {milestone.description && (
                    <p className="milestone-description">{milestone.description}</p>
                  )}
                  
                  {/* Status Actions */}
                  <div className="milestone-actions">
                    <span className="actions-label">Update Status:</span>
                    <div className="status-buttons">
                      {(['pending', 'in_progress', 'completed', 'blocked', 'skipped'] as MilestoneStatus[]).map(status => (
                        <button
                          key={status}
                          className={`status-btn ${milestone.status === status ? 'active' : ''}`}
                          onClick={() => updateMilestoneStatus(milestone.id, status)}
                          style={{ 
                            borderColor: milestone.status === status ? getStatusColor(status) : 'transparent',
                            background: milestone.status === status ? `${getStatusColor(status)}15` : undefined,
                          }}
                        >
                          {getStatusIcon(status)} {status.replace('_', ' ')}
                        </button>
                      ))}
                    </div>
                  </div>
                  
                  {/* Blockers Section */}
                  {(milestone.blockers && milestone.blockers.length > 0) && (
                    <div className="milestone-blockers">
                      <span className="blockers-label">🚫 Blockers:</span>
                      <ul className="blockers-list">
                        {milestone.blockers.map((blocker, idx) => (
                          <li key={idx} className="blocker-item">
                            <span>{blocker}</span>
                            <button 
                              className="remove-blocker-btn"
                              onClick={() => removeBlocker(milestone.id, idx)}
                              title="Remove blocker"
                            >
                              ✕
                            </button>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  
                  {/* Add Blocker Form */}
                  <div className="add-blocker-form">
                    <input
                      type="text"
                      placeholder="Add a blocker..."
                      className="blocker-input"
                      aria-label="Add a blocker to this milestone"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          addBlocker(milestone.id, (e.target as HTMLInputElement).value);
                          (e.target as HTMLInputElement).value = '';
                        }
                      }}
                    />
                  </div>
                  
                  {/* Edit Details Form */}
                  <div className="milestone-edit-section">
                    <div className="edit-row">
                      <div className="edit-field">
                        <label htmlFor={`target-date-${milestone.id}`}>Target Date</label>
                        <input
                          id={`target-date-${milestone.id}`}
                          type="date"
                          value={milestone.targetDate?.split('T')[0] || ''}
                          onChange={(e) => updateMilestone(milestone.id, { targetDate: e.target.value ? new Date(e.target.value).toISOString() : undefined })}
                          className="edit-input"
                          aria-label="Target date for milestone"
                        />
                      </div>
                      <div className="edit-field">
                        <label htmlFor={`owner-${milestone.id}`}>Owner</label>
                        <input
                          id={`owner-${milestone.id}`}
                          type="text"
                          placeholder="Assign owner..."
                          value={milestone.ownerName || ''}
                          onChange={(e) => updateMilestone(milestone.id, { ownerName: e.target.value })}
                          className="edit-input"
                          aria-label="Owner name for milestone"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function AlertCard({ alert, onSendEmail }: { 
  alert: Alert;
  onSendEmail?: (category?: TemplateCategory) => void;
}) {
  // Get suggested email categories for this alert type
  const suggestedCategories = getTemplateCategoriesForAlertType(alert.type);
  const primaryCategory = suggestedCategories[0];
  
  const handleSendEmail = () => {
    if (onSendEmail) {
      onSendEmail(primaryCategory);
    }
  };
  
  return (
    <div className={`alert-card severity-${alert.severity}`}>
      <div className="alert-header">
        <span className="alert-severity">
          {alert.severity === 'critical' ? '🔴' : 
           alert.severity === 'high' ? '🟠' : 
           alert.severity === 'medium' ? '🟡' : '🟢'}
          {alert.severity}
        </span>
        <span className="alert-type">{alert.type.replace('_', ' ')}</span>
      </div>
      <h4 className="alert-title">{alert.title}</h4>
      <p className="alert-description">{alert.description}</p>
      <div className="alert-action">
        <span className="action-label">Suggested:</span>
        <span className="action-text">{alert.suggestedAction}</span>
      </div>
      {alert.slaDeadline && (
        <div className="alert-sla">
          <span className={`sla-status ${alert.slaStatus}`}>
            SLA: {new Date(alert.slaDeadline).toLocaleDateString()}
          </span>
        </div>
      )}
      {onSendEmail && suggestedCategories.length > 0 && (
        <div className="alert-email-action">
          <button 
            className="btn-secondary alert-email-btn"
            onClick={handleSendEmail}
            title={`Open ${primaryCategory} email templates`}
          >
            📧 Send Email
          </button>
        </div>
      )}
    </div>
  );
}

function OutreachTab({ tenantId, onOpenEmailModal }: { 
  tenantId: string;
  onOpenEmailModal: (category?: TemplateCategory) => void;
}) {
  const SENT_EMAILS_KEY = `arda_sent_emails_${tenantId}`;
  const DRAFT_EMAILS_KEY = `arda_draft_emails_${tenantId}`;
  
  // Load sent emails from localStorage
  const [sentEmails, setSentEmails] = useState<SentEmail[]>(() => {
    const stored = localStorage.getItem(SENT_EMAILS_KEY);
    return stored ? JSON.parse(stored) : [];
  });
  
  // Load draft emails from localStorage
  const [draftEmails, setDraftEmails] = useState<DraftEmail[]>(() => {
    const stored = localStorage.getItem(DRAFT_EMAILS_KEY);
    return stored ? JSON.parse(stored) : [];
  });
  
  // Persist to localStorage whenever emails change
  useEffect(() => {
    localStorage.setItem(SENT_EMAILS_KEY, JSON.stringify(sentEmails));
  }, [sentEmails, SENT_EMAILS_KEY]);
  
  useEffect(() => {
    localStorage.setItem(DRAFT_EMAILS_KEY, JSON.stringify(draftEmails));
  }, [draftEmails, DRAFT_EMAILS_KEY]);
  
  // Delete a draft
  const handleDeleteDraft = (draftId: string) => {
    setDraftEmails(prev => prev.filter(d => d.id !== draftId));
  };
  
  // Log a sent email (from draft or manual entry)
  const handleLogSentEmail = (draft: DraftEmail) => {
    const sentEmail: SentEmail = {
      id: `sent_${Date.now()}`,
      accountId: tenantId || '',
      templateId: draft.templateId || 'manual',
      templateName: draft.templateName || 'Manual Email',
      category: draft.category || 'check_in',
      subject: draft.subject,
      recipientEmail: draft.recipientEmail,
      sentAt: new Date().toISOString(),
    };
    setSentEmails(prev => [sentEmail, ...prev]);
    setDraftEmails(prev => prev.filter(d => d.id !== draft.id));
  };
  
  // Template category quick access buttons
  const templateQuickActions: { category: TemplateCategory; label: string; icon: string }[] = [
    { category: 'onboarding', label: 'Onboarding', icon: '🚀' },
    { category: 'check_in', label: 'Check-in', icon: '👋' },
    { category: 'at_risk', label: 'At-Risk', icon: '⚠️' },
    { category: 'expansion', label: 'Expansion', icon: '📈' },
    { category: 'renewal', label: 'Renewal', icon: '🔄' },
    { category: 'reactivation', label: 'Reactivation', icon: '💡' },
  ];
  
  return (
    <div className="outreach-tab">
      {/* Quick Access Templates */}
      <div className="glass-card outreach-section">
        <div className="outreach-section-header">
          <h3>📧 Email Templates</h3>
          <button 
            className="btn-primary"
            onClick={() => onOpenEmailModal()}
          >
            View All Templates
          </button>
        </div>
        <div className="template-quick-access">
          {templateQuickActions.map(({ category, label, icon }) => (
            <button
              key={category}
              className="template-category-btn"
              onClick={() => onOpenEmailModal(category)}
            >
              <span className="category-icon">{icon}</span>
              <span className="category-label">{label}</span>
            </button>
          ))}
        </div>
      </div>
      
      {/* Recent Emails Sent */}
      <div className="glass-card outreach-section">
        <h3>📤 Recent Emails Sent ({sentEmails.length})</h3>
        {sentEmails.length > 0 ? (
          <div className="sent-emails-list">
            {sentEmails.slice(0, 10).map(email => (
              <div key={email.id} className="sent-email-item">
                <div className="sent-email-header">
                  <span className="sent-email-subject">{email.subject}</span>
                  <span className={`sent-email-category category-${email.category}`}>
                    {email.category}
                  </span>
                </div>
                <div className="sent-email-meta">
                  <span className="sent-email-recipient">To: {email.recipientEmail}</span>
                  <span className="sent-email-time">
                    {formatRelativeTime(email.sentAt)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="empty-state-small">
            <p>No emails sent yet. Use the templates above to get started!</p>
          </div>
        )}
      </div>
      
      {/* Saved Drafts */}
      <div className="glass-card outreach-section">
        <h3>📝 Saved Drafts ({draftEmails.length})</h3>
        {draftEmails.length > 0 ? (
          <div className="draft-emails-list">
            {draftEmails.map(draft => (
              <div key={draft.id} className="draft-email-item">
                <div className="draft-email-content">
                  <div className="draft-email-header">
                    <span className="draft-email-subject">
                      {draft.subject || '(No subject)'}
                    </span>
                  </div>
                  <div className="draft-email-meta">
                    <span className="draft-email-recipient">
                      To: {draft.recipientEmail || '(No recipient)'}
                    </span>
                    <span className="draft-email-time">
                      Saved {formatRelativeTime(draft.savedAt)}
                    </span>
                  </div>
                  <div className="draft-email-preview">
                    {draft.body.substring(0, 100)}
                    {draft.body.length > 100 ? '...' : ''}
                  </div>
                </div>
                <div className="draft-email-actions">
                  <button 
                    className="btn-secondary draft-edit-btn"
                    onClick={() => onOpenEmailModal()}
                    title="Edit this draft"
                  >
                    Edit
                  </button>
                  <button 
                    className="btn-primary draft-sent-btn"
                    onClick={() => handleLogSentEmail(draft)}
                    title="Mark as sent and log it"
                  >
                    ✓ Sent
                  </button>
                  <button 
                    className="draft-delete-btn"
                    onClick={() => handleDeleteDraft(draft.id)}
                    title="Delete this draft"
                  >
                    🗑️
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="empty-state-small">
            <p>No saved drafts. Drafts will appear here when you save them.</p>
          </div>
        )}
      </div>
      
      {/* Outreach Tips */}
      <div className="glass-card outreach-section outreach-tips">
        <h3>💡 Outreach Best Practices</h3>
        <ul className="tips-list">
          <li>
            <strong>At-Risk Accounts:</strong> Reach out within 24 hours of detecting risk signals
          </li>
          <li>
            <strong>Renewal:</strong> Start renewal conversations 60-90 days before contract end
          </li>
          <li>
            <strong>Expansion:</strong> Look for high usage accounts approaching seat limits
          </li>
          <li>
            <strong>Onboarding:</strong> Check in at Day 7, 14, and 30 milestones
          </li>
        </ul>
      </div>
    </div>
  );
}

// ============================================================================
// Utility Functions
// ============================================================================

function formatRelativeTime(timestamp: string): string {
  const now = Date.now();
  const time = new Date(timestamp).getTime();
  const diff = now - time;
  
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  
  if (days > 0) return `${days}d ago`;
  if (hours > 0) return `${hours}h ago`;
  if (minutes > 0) return `${minutes}m ago`;
  return 'just now';
}

export default Account360;
// @ts-nocheck