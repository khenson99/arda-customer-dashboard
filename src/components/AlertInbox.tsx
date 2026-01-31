/**
 * Alert Inbox Component
 * 
 * Central hub for managing all customer alerts across the portfolio.
 * Enables CSMs to prioritize work and track alert resolution.
 */

import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { TabNavigation } from './TabNavigation';
import { fetchCustomerMetrics } from '../lib/arda-client';
import type { Alert, AlertSeverity, AlertCategory, AlertStatus } from '../lib/types/account';

// ============================================================================
// Types
// ============================================================================

interface AlertWithAccount extends Alert {
  accountName?: string;
}

type FilterSeverity = AlertSeverity | 'all';
type FilterCategory = AlertCategory | 'all';
type FilterStatus = AlertStatus | 'all';
type SortOption = 'severity' | 'newest' | 'oldest' | 'sla' | 'arr';

// ============================================================================
// Main Component
// ============================================================================

export function AlertInbox() {
  // Filters
  const [severityFilter, setSeverityFilter] = useState<FilterSeverity>('all');
  const [categoryFilter, setCategoryFilter] = useState<FilterCategory>('all');
  const [statusFilter] = useState<FilterStatus>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<SortOption>('severity');
  
  // Fetch real alerts from customer metrics
  const { data: metrics, isLoading, error } = useQuery({
    queryKey: ['alerts', 'customerMetrics'],
    queryFn: fetchCustomerMetrics,
    staleTime: 60_000,
  });
  
  if (error) {
    return (
      <div className="dashboard">
        <TabNavigation />
        <div className="dashboard-content">
          <div className="error-message">
            Failed to load alerts. Please check your Arda API key.
          </div>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="dashboard">
        <TabNavigation />
        <div className="dashboard-content">
          <div className="loading-state">
            <div className="loading-spinner" />
            <p>Loading alerts...</p>
          </div>
        </div>
      </div>
    );
  }

  // Extract and enrich alerts from metrics
  const allAlerts = useMemo(() => {
    if (!metrics) return [];
    const alerts: AlertWithAccount[] = [];

    metrics.forEach((m) => {
      m.alerts.forEach((a, idx) => {
        const severityMap: Record<string, AlertSeverity> = {
          critical: 'critical',
          warning: 'high',
          info: 'low',
        };
        const category: AlertCategory =
          a.type === 'expansion_opportunity' ? 'opportunity' :
          a.type === 'onboarding_stalled' ? 'action_required' : 'risk';

        alerts.push({
          id: `${a.type}-${m.tenantId}-${idx}`,
          accountId: m.tenantId,
          accountName: m.displayName || m.companyName,
          type: a.type as any,
          category,
          severity: severityMap[a.severity] || 'medium',
          title: a.message,
          description: a.suggestedAction,
          evidence: [`Health: ${m.healthScore}`, `Stage: ${m.stage}`, `Inactive days: ${m.daysInactive}`],
          suggestedAction: a.suggestedAction,
          slaStatus: 'none',
          status: 'open',
          createdAt: m.lastActivityDate,
        });
      });
    });

    return alerts;
  }, [metrics]);
  
  // Apply filters
  const filteredAlerts = useMemo(() => {
    return allAlerts.filter(alert => {
      if (severityFilter !== 'all' && alert.severity !== severityFilter) return false;
      if (categoryFilter !== 'all' && alert.category !== categoryFilter) return false;
      if (statusFilter !== 'all' && alert.status !== statusFilter) return false;
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const matchesTitle = alert.title.toLowerCase().includes(query);
        const matchesAccount = alert.accountName?.toLowerCase().includes(query);
        const matchesType = alert.type.toLowerCase().includes(query);
        if (!matchesTitle && !matchesAccount && !matchesType) return false;
      }
      return true;
    });
  }, [allAlerts, severityFilter, categoryFilter, statusFilter, searchQuery]);
  
  // Apply sorting
  const sortedAlerts = useMemo(() => {
    return [...filteredAlerts].sort((a, b) => {
      switch (sortBy) {
        case 'severity':
          const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
          return (severityOrder[a.severity] || 4) - (severityOrder[b.severity] || 4);
        case 'newest':
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        case 'oldest':
          return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
        case 'sla':
          if (!a.slaDeadline && !b.slaDeadline) return 0;
          if (!a.slaDeadline) return 1;
          if (!b.slaDeadline) return -1;
          return new Date(a.slaDeadline).getTime() - new Date(b.slaDeadline).getTime();
        case 'arr':
          return (b.arrAtRisk || 0) - (a.arrAtRisk || 0);
        default:
          return 0;
      }
    });
  }, [filteredAlerts, sortBy]);
  
  // Stats
  const stats = useMemo(() => ({
    total: allAlerts.length,
    critical: allAlerts.filter(a => a.severity === 'critical').length,
    high: allAlerts.filter(a => a.severity === 'high').length,
    medium: allAlerts.filter(a => a.severity === 'medium').length,
    risks: allAlerts.filter(a => a.category === 'risk').length,
    opportunities: allAlerts.filter(a => a.category === 'opportunity').length,
    totalArrAtRisk: allAlerts.filter(a => a.category === 'risk').reduce((sum, a) => sum + (a.arrAtRisk || 0), 0),
  }), [allAlerts]);
  
  if (error) {
    return (
      <div className="dashboard">
        <TabNavigation />
        <div className="dashboard-content">
          <div className="error-message">
            Failed to load alerts. Please try again.
          </div>
        </div>
      </div>
    );
  }
  
  return (
    <div className="dashboard alert-inbox">
      <TabNavigation />
      
      <div className="dashboard-content">
        <header className="dashboard-header">
          <div>
            <h1>Alert Inbox</h1>
            <p className="subtitle">Prioritized alerts across your customer portfolio</p>
          </div>
        </header>
        
        {/* Stats Bar */}
        <div className="alert-stats-bar">
          <div className="stat-item critical">
            <span className="stat-value">{stats.critical}</span>
            <span className="stat-label">Critical</span>
          </div>
          <div className="stat-item high">
            <span className="stat-value">{stats.high}</span>
            <span className="stat-label">High</span>
          </div>
          <div className="stat-item medium">
            <span className="stat-value">{stats.medium}</span>
            <span className="stat-label">Medium</span>
          </div>
          <div className="stat-divider" />
          <div className="stat-item risks">
            <span className="stat-value">{stats.risks}</span>
            <span className="stat-label">Risks</span>
          </div>
          <div className="stat-item opportunities">
            <span className="stat-value">{stats.opportunities}</span>
            <span className="stat-label">Opportunities</span>
          </div>
          {stats.totalArrAtRisk > 0 && (
            <>
              <div className="stat-divider" />
              <div className="stat-item arr-at-risk">
                <span className="stat-value">${stats.totalArrAtRisk.toLocaleString()}</span>
                <span className="stat-label">ARR at Risk</span>
              </div>
            </>
          )}
        </div>
        
        {/* Filters */}
        <div className="alert-filters glass-card">
          <div className="filter-row">
            <input
              type="text"
              placeholder="Search alerts..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="search-input"
            />
            
            <select 
              value={severityFilter} 
              onChange={(e) => setSeverityFilter(e.target.value as FilterSeverity)}
              className="filter-select"
            >
              <option value="all">All Severities</option>
              <option value="critical">Critical</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
            
            <select 
              value={categoryFilter} 
              onChange={(e) => setCategoryFilter(e.target.value as FilterCategory)}
              className="filter-select"
            >
              <option value="all">All Categories</option>
              <option value="risk">Risks</option>
              <option value="opportunity">Opportunities</option>
              <option value="action_required">Action Required</option>
              <option value="informational">Informational</option>
            </select>
            
            <select 
              value={sortBy} 
              onChange={(e) => setSortBy(e.target.value as SortOption)}
              className="filter-select"
            >
              <option value="severity">Sort by Severity</option>
              <option value="newest">Newest First</option>
              <option value="oldest">Oldest First</option>
              <option value="sla">SLA Deadline</option>
              <option value="arr">ARR at Risk</option>
            </select>
          </div>
        </div>
        
        {/* Alerts List */}
        {isLoading ? (
          <div className="loading-state">
            <div className="loading-spinner" />
            <p>Loading alerts...</p>
          </div>
        ) : sortedAlerts.length > 0 ? (
          <div className="alerts-list-container">
            <div className="alerts-count">
              Showing {sortedAlerts.length} of {allAlerts.length} alerts
            </div>
            
            <div className="alerts-list">
              {sortedAlerts.map((alert) => (
                <AlertListItem key={alert.id} alert={alert} />
              ))}
            </div>
          </div>
        ) : (
          <div className="glass-card empty-state">
            <div className="empty-icon">✅</div>
            <p>No alerts match your filters</p>
            {allAlerts.length === 0 && <p className="empty-sub">All customers are healthy!</p>}
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// Sub-Components
// ============================================================================

function AlertListItem({ alert }: { alert: AlertWithAccount }) {
  const [isExpanded, setIsExpanded] = useState(false);
  
  const severityColors = {
    critical: '#ef4444',
    high: '#f97316',
    medium: '#eab308',
    low: '#22c55e',
  };
  
  const categoryIcons = {
    risk: '⚠️',
    opportunity: '💡',
    action_required: '⚡',
    informational: 'ℹ️',
  };
  
  return (
    <div className={`alert-list-item severity-${alert.severity}`}>
      <div className="alert-list-header" onClick={() => setIsExpanded(!isExpanded)}>
        <div className="alert-severity-indicator" style={{ backgroundColor: severityColors[alert.severity] }} />
        
        <div className="alert-main-content">
          <div className="alert-title-row">
            <span className="alert-category-icon">{categoryIcons[alert.category]}</span>
            <h4 className="alert-title">{alert.title}</h4>
            <span className={`alert-severity-badge ${alert.severity}`}>{alert.severity}</span>
          </div>
          
          <div className="alert-meta-row">
            {alert.accountName && (
              <Link 
                to={`/account/${alert.accountId}`} 
                className="alert-account-link"
                onClick={(e) => e.stopPropagation()}
              >
                {alert.accountName}
              </Link>
            )}
            <span className="alert-type-badge">{alert.type.replace(/_/g, ' ')}</span>
            <span className="alert-time">{formatRelativeTime(alert.createdAt)}</span>
          </div>
        </div>
        
        <div className="alert-actions">
          {alert.arrAtRisk && (
            <span className="arr-at-risk-badge">${alert.arrAtRisk.toLocaleString()} ARR</span>
          )}
          <button className="expand-btn">{isExpanded ? '▼' : '▶'}</button>
        </div>
      </div>
      
      {isExpanded && (
        <div className="alert-expanded-content">
          <p className="alert-description">{alert.description}</p>
          
          {alert.evidence && alert.evidence.length > 0 && (
            <div className="alert-evidence">
              <strong>Evidence:</strong>
              <ul>
                {alert.evidence.map((e, i) => (
                  <li key={i}>{e}</li>
                ))}
              </ul>
            </div>
          )}
          
          <div className="alert-suggested-action">
            <strong>Suggested Action:</strong>
            <p>{alert.suggestedAction}</p>
          </div>
          
          <div className="alert-action-buttons">
            <button className="btn-primary">Acknowledge</button>
            <button className="btn-secondary">Snooze</button>
            <Link to={`/account/${alert.accountId}`} className="btn-secondary">
              View Account
            </Link>
          </div>
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

export default AlertInbox;
