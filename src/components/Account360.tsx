/**
 * Account 360 Component
 * 
 * The comprehensive account view - a single screen to understand and act on
 * any customer account. Replaces the basic CustomerDetail component.
 */

import { useState } from 'react';
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
import type { 
  Alert, 
  TimelineEvent,
  Stakeholder,
  HealthGrade,
} from '../lib/types/account';

// ============================================================================
// Main Component
// ============================================================================

export function Account360() {
  const { tenantId } = useParams<{ tenantId: string }>();
  const [activeTab, setActiveTab] = useState<'overview' | 'health' | 'timeline' | 'stakeholders' | 'tasks'>('overview');
  
  const { data: account, isLoading, error } = useAccountDetail(tenantId);
  const { alerts, criticalAlerts, hasCriticalAlerts } = useAccountAlerts(tenantId);
  
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
        </div>
        
        {/* Tab Content */}
        <div className="account-tab-content">
          {activeTab === 'overview' && (
            <OverviewTab account={account} alerts={alerts} />
          )}
          {activeTab === 'health' && (
            <HealthTab health={account.health} />
          )}
          {activeTab === 'timeline' && (
            <TimelineTab timeline={account.timeline} />
          )}
          {activeTab === 'stakeholders' && (
            <StakeholdersTab stakeholders={account.stakeholders} />
          )}
          {activeTab === 'tasks' && (
            <TasksTab />
          )}
        </div>
      </div>
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

function OverviewTab({ account, alerts }: { account: any; alerts: Alert[] }) {
  const usage = account.usage;
  
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
      {/* Alerts Section */}
      {alerts.length > 0 && (
        <div className="glass-card alerts-section">
          <h3>⚠️ Active Alerts ({alerts.length})</h3>
          <div className="alerts-list">
            {alerts.slice(0, 5).map((alert) => (
              <AlertCard key={alert.id} alert={alert} />
            ))}
          </div>
        </div>
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

function TasksTab() {
  // TODO: Implement tasks management
  return (
    <div className="tasks-tab">
      <div className="glass-card">
        <h3>📋 Open Tasks</h3>
        <p className="empty-state">No open tasks. Tasks feature coming soon.</p>
        
        <button className="add-task-btn" disabled>
          + Add Task
        </button>
      </div>
    </div>
  );
}

function AlertCard({ alert }: { alert: Alert }) {
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
