/**
 * Alert Inbox Component
 * 
 * Central hub for managing all customer alerts across the portfolio.
 * Enables CSMs to prioritize work and track alert resolution.
 */

import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { TabNavigation } from './TabNavigation';
import { fetchAlerts, queryKeys, defaultQueryOptions, type AlertWithAccount } from '../lib/api/cs-api';
import type { AlertSeverity, AlertCategory, AlertStatus } from '../lib/types/account';

// ============================================================================
// Types
// ============================================================================

type FilterSeverity = AlertSeverity | 'all';
type FilterCategory = AlertCategory | 'all';
type FilterStatus = AlertStatus | 'all';
type SortOption = 'severity' | 'newest' | 'oldest' | 'sla' | 'arr';

// ============================================================================
// Main Component
// ============================================================================

export function AlertInbox() {
  // Query client for cache invalidation
  const queryClient = useQueryClient();
  
  // Filters
  const [severityFilter, setSeverityFilter] = useState<FilterSeverity>('all');
  const [categoryFilter, setCategoryFilter] = useState<FilterCategory>('all');
  const [statusFilter, setStatusFilter] = useState<FilterStatus>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<SortOption>('severity');
  
  // Fetch alerts from the dedicated alerts API
  const { data: alertsResponse, isLoading, error } = useQuery({
    queryKey: queryKeys.alerts({ severityFilter, statusFilter }),
    queryFn: () => fetchAlerts({
      // Only apply server-side filters if they're set (for efficiency)
      severity: severityFilter !== 'all' ? severityFilter : undefined,
      status: statusFilter !== 'all' && statusFilter !== 'snoozed' && statusFilter !== 'resolved' 
        ? statusFilter as 'open' | 'acknowledged' | 'in_progress' 
        : undefined,
    }),
    ...defaultQueryOptions,
  });
  
  // All alerts from API response (with account name enrichment)
  const allAlerts: AlertWithAccount[] = useMemo(() => {
    if (!alertsResponse?.alerts) return [];
    return alertsResponse.alerts as AlertWithAccount[];
  }, [alertsResponse]);
  
  // Apply client-side filters (category, search, and status filters not supported by API)
  const filteredAlerts = useMemo(() => {
    return allAlerts.filter(alert => {
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
  }, [allAlerts, categoryFilter, statusFilter, searchQuery]);
  
  // Apply sorting
  const sortedAlerts = useMemo(() => {
    return [...filteredAlerts].sort((a, b) => {
      switch (sortBy) {
        case 'severity': {
          const severityOrder: Record<AlertSeverity, number> = { critical: 0, high: 1, medium: 2, low: 3 };
          return severityOrder[a.severity] - severityOrder[b.severity];
        }
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
  
  // Stats computed from all alerts (not filtered)
  const stats = useMemo(() => ({
    total: allAlerts.length,
    critical: allAlerts.filter(a => a.severity === 'critical').length,
    high: allAlerts.filter(a => a.severity === 'high').length,
    medium: allAlerts.filter(a => a.severity === 'medium').length,
    low: allAlerts.filter(a => a.severity === 'low').length,
    risks: allAlerts.filter(a => a.category === 'risk').length,
    opportunities: allAlerts.filter(a => a.category === 'opportunity').length,
    totalArrAtRisk: allAlerts
      .filter(a => a.category === 'risk')
      .reduce((sum, a) => sum + (a.arrAtRisk || 0), 0),
  }), [allAlerts]);
  
  // Mutation for acknowledging alerts (placeholder - would integrate with backend)
  const acknowledgeMutation = useMutation({
    mutationFn: async (alertId: string) => {
      // TODO: Implement server-side alert acknowledgment
      console.log('Acknowledging alert:', alertId);
      return { success: true };
    },
    onSuccess: () => {
      // Invalidate alerts cache to refresh
      queryClient.invalidateQueries({ queryKey: ['cs', 'alerts'] });
    },
  });
  
  // Handle error state
  if (error) {
    return (
      <div className="dashboard">
        <TabNavigation />
        <div className="dashboard-content">
          <div className="error-message">
            <div className="error-icon">⚠️</div>
            <p>Failed to load alerts. Please check your Arda API key.</p>
            <p className="error-detail">{error instanceof Error ? error.message : 'Unknown error'}</p>
          </div>
        </div>
      </div>
    );
  }

  // Handle loading state
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
          <div 
            className={`stat-item critical ${severityFilter === 'critical' ? 'active' : ''}`}
            onClick={() => setSeverityFilter(severityFilter === 'critical' ? 'all' : 'critical')}
          >
            <span className="stat-value">{stats.critical}</span>
            <span className="stat-label">Critical</span>
          </div>
          <div 
            className={`stat-item high ${severityFilter === 'high' ? 'active' : ''}`}
            onClick={() => setSeverityFilter(severityFilter === 'high' ? 'all' : 'high')}
          >
            <span className="stat-value">{stats.high}</span>
            <span className="stat-label">High</span>
          </div>
          <div 
            className={`stat-item medium ${severityFilter === 'medium' ? 'active' : ''}`}
            onClick={() => setSeverityFilter(severityFilter === 'medium' ? 'all' : 'medium')}
          >
            <span className="stat-value">{stats.medium}</span>
            <span className="stat-label">Medium</span>
          </div>
          <div 
            className={`stat-item low ${severityFilter === 'low' ? 'active' : ''}`}
            onClick={() => setSeverityFilter(severityFilter === 'low' ? 'all' : 'low')}
          >
            <span className="stat-value">{stats.low}</span>
            <span className="stat-label">Low</span>
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
              aria-label="Filter by severity"
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
              aria-label="Filter by category"
            >
              <option value="all">All Categories</option>
              <option value="risk">Risks</option>
              <option value="opportunity">Opportunities</option>
              <option value="action_required">Action Required</option>
              <option value="informational">Informational</option>
            </select>
            
            <select 
              value={statusFilter} 
              onChange={(e) => setStatusFilter(e.target.value as FilterStatus)}
              className="filter-select"
              aria-label="Filter by status"
            >
              <option value="all">All Status</option>
              <option value="open">Open</option>
              <option value="acknowledged">Acknowledged</option>
              <option value="in_progress">In Progress</option>
              <option value="resolved">Resolved</option>
              <option value="snoozed">Snoozed</option>
            </select>
            
            <select 
              value={sortBy} 
              onChange={(e) => setSortBy(e.target.value as SortOption)}
              className="filter-select"
              aria-label="Sort alerts by"
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
        {sortedAlerts.length > 0 ? (
          <div className="alerts-list-container">
            <div className="alerts-count">
              Showing {sortedAlerts.length} of {allAlerts.length} alerts
            </div>
            
            <div className="alerts-list">
              {sortedAlerts.map((alert) => (
                <AlertListItem 
                  key={alert.id} 
                  alert={alert}
                  onAcknowledge={() => acknowledgeMutation.mutate(alert.id)}
                />
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

interface AlertListItemProps {
  alert: AlertWithAccount;
  onAcknowledge?: () => void;
}

function AlertListItem({ alert, onAcknowledge }: AlertListItemProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  
  const categoryIcons: Record<AlertCategory, string> = {
    risk: '⚠️',
    opportunity: '💡',
    action_required: '⚡',
    informational: 'ℹ️',
  };
  
  const handleAcknowledge = (e: React.MouseEvent) => {
    e.stopPropagation();
    onAcknowledge?.();
  };
  
  return (
    <div className={`alert-list-item severity-${alert.severity}`}>
      <div className="alert-list-header" onClick={() => setIsExpanded(!isExpanded)}>
        <div className={`alert-severity-indicator severity-${alert.severity}`} />
        
        <div className="alert-main-content">
          <div className="alert-title-row">
            <span className="alert-category-icon">{categoryIcons[alert.category]}</span>
            <h4 className="alert-title">{alert.title}</h4>
            <span className={`alert-severity-badge ${alert.severity}`}>{alert.severity}</span>
            {alert.slaStatus && alert.slaStatus !== 'none' && (
              <span className={`alert-sla-badge ${alert.slaStatus}`}>
                {alert.slaStatus === 'breached' ? '🔴' : alert.slaStatus === 'at_risk' ? '🟡' : '🟢'}
                SLA
              </span>
            )}
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
            {alert.ownerName && (
              <span className="alert-owner">Assigned: {alert.ownerName}</span>
            )}
          </div>
        </div>
        
        <div className="alert-actions">
          {alert.arrAtRisk && alert.arrAtRisk > 0 && (
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
          
          {alert.suggestedAction && (
            <div className="alert-suggested-action">
              <strong>Suggested Action:</strong>
              <p>{alert.suggestedAction}</p>
            </div>
          )}
          
          {alert.slaDeadline && (
            <div className="alert-sla-info">
              <strong>SLA Deadline:</strong>
              <span className={`sla-deadline ${alert.slaStatus}`}>
                {new Date(alert.slaDeadline).toLocaleString()}
              </span>
            </div>
          )}
          
          <div className="alert-action-buttons">
            {alert.status === 'open' && (
              <button className="btn-primary" onClick={handleAcknowledge}>
                Acknowledge
              </button>
            )}
            {(alert.status === 'open' || alert.status === 'acknowledged') && (
              <button className="btn-secondary">Snooze</button>
            )}
            <Link to={`/account/${alert.accountId}`} className="btn-secondary">
              View Account
            </Link>
            {alert.playbook && (
              <button className="btn-outline">
                Run Playbook: {alert.playbook}
              </button>
            )}
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
