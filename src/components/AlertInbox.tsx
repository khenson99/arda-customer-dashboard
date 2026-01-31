/**
 * Alert Inbox Component
 * 
 * Central hub for managing all customer alerts across the portfolio.
 * Enables CSMs to prioritize work, track alert resolution, and execute playbooks.
 */

import { useState, useMemo, useCallback, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { TabNavigation } from './TabNavigation';
import { fetchAlerts, queryKeys, defaultQueryOptions, type AlertWithAccount } from '../lib/api/cs-api';
import type { AlertSeverity, AlertCategory, AlertStatus, AlertType, Playbook } from '../lib/types/account';
import {
  getAlertState,
  getAllAlertStates,
  acknowledgeAlert,
  snoozeAlert,
  resolveAlert,
  assignAlert,
  reopenAlert,
  startPlaybook,
  updatePlaybookProgress,
  completePlaybook,
  addAlertNote,
  getAlertNotes,
  getAlertActionLog,
  calculateSLA,
  getRecommendedPlaybook,
  getCurrentUser,
  SNOOZE_DURATIONS,
  OUTCOME_OPTIONS,
  PLAYBOOKS,
  TEAM_MEMBERS,
  type AlertStateOverride,
  type AlertNote,
  type AlertActionLog,
  type SLAInfo,
  type PlaybookDefinition,
  type OutcomeResult,
} from '../lib/alert-persistence';

// ============================================================================
// Types
// ============================================================================

type FilterSeverity = AlertSeverity | 'all';
type FilterCategory = AlertCategory | 'all';
type FilterStatus = AlertStatus | 'all';
type SortOption = 'severity' | 'newest' | 'oldest' | 'sla' | 'arr';

interface EnrichedAlert extends AlertWithAccount {
  localState?: AlertStateOverride;
  slaInfo: SLAInfo;
  recommendedPlaybook?: PlaybookDefinition;
}

// ============================================================================
// Main Component
// ============================================================================

export function AlertInbox() {
  const queryClient = useQueryClient();
  
  // Filters
  const [severityFilter, setSeverityFilter] = useState<FilterSeverity>('all');
  const [categoryFilter, setCategoryFilter] = useState<FilterCategory>('all');
  const [statusFilter, setStatusFilter] = useState<FilterStatus>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<SortOption>('sla');
  
  // Selection for bulk actions
  const [selectedAlertIds, setSelectedAlertIds] = useState<Set<string>>(new Set());
  
  // Detail panel state
  const [detailPanelAlertId, setDetailPanelAlertId] = useState<string | null>(null);
  
  // Force re-render when local state changes
  const [localStateVersion, setLocalStateVersion] = useState(0);
  
  // Fetch alerts from the dedicated alerts API
  const { data: alertsResponse, isLoading, error } = useQuery({
    queryKey: queryKeys.alerts({ severityFilter, statusFilter }),
    queryFn: () => fetchAlerts({
      severity: severityFilter !== 'all' ? severityFilter : undefined,
      status: statusFilter !== 'all' && statusFilter !== 'snoozed' && statusFilter !== 'resolved' 
        ? statusFilter as 'open' | 'acknowledged' | 'in_progress' 
        : undefined,
    }),
    ...defaultQueryOptions,
  });
  
  // Enrich alerts with local state and SLA info
  const enrichedAlerts: EnrichedAlert[] = useMemo(() => {
    if (!alertsResponse?.alerts) return [];
    
    const localStates = getAllAlertStates();
    
    return alertsResponse.alerts.map(alert => {
      const localState = localStates.get(alert.id);
      const effectiveStatus = localState?.status || alert.status;
      const slaInfo = calculateSLA(alert.slaDeadline, alert.createdAt);
      const recommendedPlaybook = getRecommendedPlaybook(alert.type);
      
      return {
        ...alert,
        status: effectiveStatus,
        localState,
        slaInfo,
        recommendedPlaybook,
        ownerName: localState?.assignedToName || alert.ownerName,
        ownerId: localState?.assignedTo || alert.ownerId,
      };
    });
  }, [alertsResponse, localStateVersion]);
  
  // Apply client-side filters
  const filteredAlerts = useMemo(() => {
    return enrichedAlerts.filter(alert => {
      if (categoryFilter !== 'all' && alert.category !== categoryFilter) return false;
      
      // Handle status filter with local overrides
      if (statusFilter !== 'all') {
        const effectiveStatus = alert.localState?.status || alert.status;
        
        // Handle snoozed alerts - check if snooze has expired
        if (effectiveStatus === 'snoozed' && alert.localState?.snoozedUntil) {
          const snoozedUntil = new Date(alert.localState.snoozedUntil).getTime();
          if (snoozedUntil < Date.now()) {
            // Snooze expired, treat as open
            if (statusFilter !== 'open') return false;
          } else {
            if (statusFilter !== 'snoozed') return false;
          }
        } else if (effectiveStatus !== statusFilter) {
          return false;
        }
      }
      
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const matchesTitle = alert.title.toLowerCase().includes(query);
        const matchesAccount = alert.accountName?.toLowerCase().includes(query);
        const matchesType = alert.type.toLowerCase().includes(query);
        if (!matchesTitle && !matchesAccount && !matchesType) return false;
      }
      return true;
    });
  }, [enrichedAlerts, categoryFilter, statusFilter, searchQuery]);
  
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
          // Breached first, then by hours remaining
          if (a.slaInfo.status === 'breached' && b.slaInfo.status !== 'breached') return -1;
          if (b.slaInfo.status === 'breached' && a.slaInfo.status !== 'breached') return 1;
          return a.slaInfo.hoursRemaining - b.slaInfo.hoursRemaining;
        case 'arr':
          return (b.arrAtRisk || 0) - (a.arrAtRisk || 0);
        default:
          return 0;
      }
    });
  }, [filteredAlerts, sortBy]);
  
  // Stats computed from all alerts
  const stats = useMemo(() => {
    const slaBreached = enrichedAlerts.filter(a => a.slaInfo.status === 'breached').length;
    const slaAtRisk = enrichedAlerts.filter(a => a.slaInfo.status === 'at_risk').length;
    
    return {
      total: enrichedAlerts.length,
      critical: enrichedAlerts.filter(a => a.severity === 'critical').length,
      high: enrichedAlerts.filter(a => a.severity === 'high').length,
      medium: enrichedAlerts.filter(a => a.severity === 'medium').length,
      low: enrichedAlerts.filter(a => a.severity === 'low').length,
      risks: enrichedAlerts.filter(a => a.category === 'risk').length,
      opportunities: enrichedAlerts.filter(a => a.category === 'opportunity').length,
      totalArrAtRisk: enrichedAlerts
        .filter(a => a.category === 'risk' && a.status !== 'resolved')
        .reduce((sum, a) => sum + (a.arrAtRisk || 0), 0),
      slaBreached,
      slaAtRisk,
    };
  }, [enrichedAlerts]);
  
  // Refresh local state
  const refreshLocalState = useCallback(() => {
    setLocalStateVersion(v => v + 1);
  }, []);
  
  // Bulk actions
  const handleSelectAll = useCallback(() => {
    if (selectedAlertIds.size === sortedAlerts.length) {
      setSelectedAlertIds(new Set());
    } else {
      setSelectedAlertIds(new Set(sortedAlerts.map(a => a.id)));
    }
  }, [sortedAlerts, selectedAlertIds]);
  
  const handleToggleSelect = useCallback((alertId: string) => {
    setSelectedAlertIds(prev => {
      const next = new Set(prev);
      if (next.has(alertId)) {
        next.delete(alertId);
      } else {
        next.add(alertId);
      }
      return next;
    });
  }, []);
  
  const handleBulkAcknowledge = useCallback(() => {
    selectedAlertIds.forEach(id => acknowledgeAlert(id));
    setSelectedAlertIds(new Set());
    refreshLocalState();
  }, [selectedAlertIds, refreshLocalState]);
  
  const handleBulkSnooze = useCallback((days: number) => {
    selectedAlertIds.forEach(id => snoozeAlert(id, days));
    setSelectedAlertIds(new Set());
    refreshLocalState();
  }, [selectedAlertIds, refreshLocalState]);
  
  const handleBulkAssign = useCallback((assigneeId: string, assigneeName: string) => {
    selectedAlertIds.forEach(id => assignAlert(id, assigneeId, assigneeName));
    setSelectedAlertIds(new Set());
    refreshLocalState();
  }, [selectedAlertIds, refreshLocalState]);
  
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
        
        {/* SLA Warning Banner */}
        {(stats.slaBreached > 0 || stats.slaAtRisk > 0) && (
          <div className="sla-warning-banner">
            {stats.slaBreached > 0 && (
              <span className="sla-warning-item breached">
                🔴 {stats.slaBreached} SLA{stats.slaBreached > 1 ? 's' : ''} breached
              </span>
            )}
            {stats.slaAtRisk > 0 && (
              <span className="sla-warning-item at-risk">
                🟡 {stats.slaAtRisk} SLA{stats.slaAtRisk > 1 ? 's' : ''} at risk
              </span>
            )}
          </div>
        )}
        
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
              <option value="sla">SLA Urgency</option>
              <option value="severity">Severity</option>
              <option value="newest">Newest First</option>
              <option value="oldest">Oldest First</option>
              <option value="arr">ARR at Risk</option>
            </select>
          </div>
        </div>
        
        {/* Bulk Actions Bar */}
        {selectedAlertIds.size > 0 && (
          <BulkActionsBar
            selectedCount={selectedAlertIds.size}
            onAcknowledge={handleBulkAcknowledge}
            onSnooze={handleBulkSnooze}
            onAssign={handleBulkAssign}
            onClearSelection={() => setSelectedAlertIds(new Set())}
          />
        )}
        
        {/* Alerts List */}
        {sortedAlerts.length > 0 ? (
          <div className="alerts-list-container">
            <div className="alerts-list-header">
              <div className="alerts-count">
                <label className="select-all-checkbox">
                  <input
                    type="checkbox"
                    checked={selectedAlertIds.size === sortedAlerts.length && sortedAlerts.length > 0}
                    onChange={handleSelectAll}
                  />
                  <span>Select All</span>
                </label>
                <span className="count-text">
                  Showing {sortedAlerts.length} of {enrichedAlerts.length} alerts
                </span>
              </div>
            </div>
            
            <div className="alerts-list">
              {sortedAlerts.map((alert) => (
                <AlertListItem 
                  key={alert.id} 
                  alert={alert}
                  isSelected={selectedAlertIds.has(alert.id)}
                  onToggleSelect={() => handleToggleSelect(alert.id)}
                  onOpenDetail={() => setDetailPanelAlertId(alert.id)}
                  onStateChange={refreshLocalState}
                />
              ))}
            </div>
          </div>
        ) : (
          <div className="glass-card empty-state">
            <div className="empty-icon">✅</div>
            <p>No alerts match your filters</p>
            {enrichedAlerts.length === 0 && <p className="empty-sub">All customers are healthy!</p>}
          </div>
        )}
      </div>
      
      {/* Alert Detail Panel */}
      {detailPanelAlertId && (
        <AlertDetailPanel
          alertId={detailPanelAlertId}
          alerts={enrichedAlerts}
          onClose={() => setDetailPanelAlertId(null)}
          onStateChange={refreshLocalState}
        />
      )}
    </div>
  );
}

// ============================================================================
// Bulk Actions Bar
// ============================================================================

interface BulkActionsBarProps {
  selectedCount: number;
  onAcknowledge: () => void;
  onSnooze: (days: number) => void;
  onAssign: (assigneeId: string, assigneeName: string) => void;
  onClearSelection: () => void;
}

function BulkActionsBar({ selectedCount, onAcknowledge, onSnooze, onAssign, onClearSelection }: BulkActionsBarProps) {
  const [showSnoozeDropdown, setShowSnoozeDropdown] = useState(false);
  const [showAssignDropdown, setShowAssignDropdown] = useState(false);
  
  return (
    <div className="bulk-actions-bar">
      <span className="bulk-selected-count">{selectedCount} alert{selectedCount > 1 ? 's' : ''} selected</span>
      
      <div className="bulk-action-buttons">
        <button className="btn-bulk" onClick={onAcknowledge}>
          ✓ Acknowledge
        </button>
        
        <div className="bulk-dropdown-wrapper">
          <button 
            className="btn-bulk"
            onClick={() => setShowSnoozeDropdown(!showSnoozeDropdown)}
          >
            😴 Snooze ▾
          </button>
          {showSnoozeDropdown && (
            <div className="bulk-dropdown">
              {SNOOZE_DURATIONS.filter(d => d.days > 0).map(duration => (
                <button
                  key={duration.days}
                  className="dropdown-item"
                  onClick={() => {
                    onSnooze(duration.days);
                    setShowSnoozeDropdown(false);
                  }}
                >
                  {duration.label}
                </button>
              ))}
            </div>
          )}
        </div>
        
        <div className="bulk-dropdown-wrapper">
          <button 
            className="btn-bulk"
            onClick={() => setShowAssignDropdown(!showAssignDropdown)}
          >
            👤 Assign ▾
          </button>
          {showAssignDropdown && (
            <div className="bulk-dropdown">
              {TEAM_MEMBERS.map(member => (
                <button
                  key={member.id}
                  className="dropdown-item"
                  onClick={() => {
                    onAssign(member.id, member.name);
                    setShowAssignDropdown(false);
                  }}
                >
                  {member.name}
                  <span className="member-role">{member.role}</span>
                </button>
              ))}
            </div>
          )}
        </div>
        
        <button className="btn-bulk-cancel" onClick={onClearSelection}>
          ✕ Clear
        </button>
      </div>
    </div>
  );
}

// ============================================================================
// Alert List Item
// ============================================================================

interface AlertListItemProps {
  alert: EnrichedAlert;
  isSelected: boolean;
  onToggleSelect: () => void;
  onOpenDetail: () => void;
  onStateChange: () => void;
}

function AlertListItem({ alert, isSelected, onToggleSelect, onOpenDetail, onStateChange }: AlertListItemProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [showActions, setShowActions] = useState(false);
  
  const categoryIcons: Record<AlertCategory, string> = {
    risk: '⚠️',
    opportunity: '💡',
    action_required: '⚡',
    informational: 'ℹ️',
  };
  
  const handleAcknowledge = (e: React.MouseEvent) => {
    e.stopPropagation();
    acknowledgeAlert(alert.id);
    onStateChange();
  };
  
  const handleStartPlaybook = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (alert.recommendedPlaybook) {
      startPlaybook(alert.id, alert.recommendedPlaybook.id);
      onStateChange();
    }
  };
  
  const effectiveStatus = alert.localState?.status || alert.status;
  
  return (
    <div className={`alert-list-item severity-${alert.severity} ${isSelected ? 'selected' : ''}`}>
      <div className="alert-list-header" onClick={() => setIsExpanded(!isExpanded)}>
        <input
          type="checkbox"
          checked={isSelected}
          onChange={(e) => {
            e.stopPropagation();
            onToggleSelect();
          }}
          className="alert-checkbox"
          onClick={(e) => e.stopPropagation()}
        />
        
        <div className={`alert-severity-indicator severity-${alert.severity}`} />
        
        <div className="alert-main-content">
          <div className="alert-title-row">
            <span className="alert-category-icon">{categoryIcons[alert.category]}</span>
            <h4 className="alert-title">{alert.title}</h4>
            <span className={`alert-severity-badge ${alert.severity}`}>{alert.severity}</span>
            <span className={`alert-status-badge ${effectiveStatus}`}>{effectiveStatus.replace('_', ' ')}</span>
            {alert.slaInfo.status !== 'none' && (
              <SLABadge slaInfo={alert.slaInfo} />
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
              <span className="alert-owner">👤 {alert.ownerName}</span>
            )}
            {alert.localState?.playbookId && (
              <span className="playbook-progress-badge">
                📋 Playbook {alert.localState.playbookProgress || 0}%
              </span>
            )}
          </div>
        </div>
        
        <div className="alert-actions">
          {alert.arrAtRisk && alert.arrAtRisk > 0 && (
            <span className="arr-at-risk-badge">${alert.arrAtRisk.toLocaleString()} ARR</span>
          )}
          <button 
            className="detail-btn"
            onClick={(e) => {
              e.stopPropagation();
              onOpenDetail();
            }}
          >
            Details →
          </button>
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
          
          {alert.slaInfo.deadline && (
            <div className="alert-sla-info">
              <strong>SLA:</strong>
              <span className={`sla-countdown ${alert.slaInfo.status}`}>
                {alert.slaInfo.timeRemaining}
              </span>
              <span className="sla-deadline-date">
                (Deadline: {new Date(alert.slaInfo.deadline).toLocaleString()})
              </span>
            </div>
          )}
          
          {alert.recommendedPlaybook && !alert.localState?.playbookId && (
            <div className="recommended-playbook">
              <strong>Recommended Playbook:</strong>
              <div className="playbook-preview">
                <span className="playbook-name">📋 {alert.recommendedPlaybook.name}</span>
                <span className="playbook-duration">{alert.recommendedPlaybook.estimatedDays} days</span>
              </div>
            </div>
          )}
          
          <AlertActionButtons
            alert={alert}
            onStateChange={onStateChange}
          />
        </div>
      )}
    </div>
  );
}

// ============================================================================
// SLA Badge
// ============================================================================

interface SLABadgeProps {
  slaInfo: SLAInfo;
}

function SLABadge({ slaInfo }: SLABadgeProps) {
  const icons = {
    on_track: '🟢',
    at_risk: '🟡',
    breached: '🔴',
    none: '',
  };
  
  return (
    <span className={`alert-sla-badge ${slaInfo.status}`}>
      {icons[slaInfo.status]} {slaInfo.timeRemaining}
    </span>
  );
}

// ============================================================================
// Alert Action Buttons
// ============================================================================

interface AlertActionButtonsProps {
  alert: EnrichedAlert;
  onStateChange: () => void;
}

function AlertActionButtons({ alert, onStateChange }: AlertActionButtonsProps) {
  const [showSnoozeModal, setShowSnoozeModal] = useState(false);
  const [showResolveModal, setShowResolveModal] = useState(false);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [showNoteInput, setShowNoteInput] = useState(false);
  const [noteText, setNoteText] = useState('');
  
  const effectiveStatus = alert.localState?.status || alert.status;
  
  const handleAcknowledge = () => {
    acknowledgeAlert(alert.id);
    onStateChange();
  };
  
  const handleSnooze = (days: number, reason?: string) => {
    snoozeAlert(alert.id, days, reason);
    setShowSnoozeModal(false);
    onStateChange();
  };
  
  const handleResolve = (outcome: OutcomeResult, notes?: string) => {
    resolveAlert(alert.id, outcome, notes);
    setShowResolveModal(false);
    onStateChange();
  };
  
  const handleReopen = () => {
    reopenAlert(alert.id);
    onStateChange();
  };
  
  const handleAssign = (assigneeId: string, assigneeName: string) => {
    assignAlert(alert.id, assigneeId, assigneeName);
    setShowAssignModal(false);
    onStateChange();
  };
  
  const handleAddNote = () => {
    if (noteText.trim()) {
      addAlertNote(alert.id, noteText.trim());
      setNoteText('');
      setShowNoteInput(false);
      onStateChange();
    }
  };
  
  const handleStartPlaybook = () => {
    if (alert.recommendedPlaybook) {
      startPlaybook(alert.id, alert.recommendedPlaybook.id);
      onStateChange();
    }
  };
  
  return (
    <div className="alert-action-buttons">
      {effectiveStatus === 'open' && (
        <button className="btn-primary" onClick={handleAcknowledge}>
          ✓ Acknowledge
        </button>
      )}
      
      {effectiveStatus !== 'resolved' && (
        <>
          <button className="btn-secondary" onClick={() => setShowSnoozeModal(true)}>
            😴 Snooze
          </button>
          <button className="btn-secondary" onClick={() => setShowResolveModal(true)}>
            ✅ Resolve
          </button>
        </>
      )}
      
      {effectiveStatus === 'resolved' && (
        <button className="btn-secondary" onClick={handleReopen}>
          ↩️ Reopen
        </button>
      )}
      
      <button className="btn-secondary" onClick={() => setShowAssignModal(true)}>
        👤 Assign
      </button>
      
      <button className="btn-secondary" onClick={() => setShowNoteInput(!showNoteInput)}>
        📝 Add Note
      </button>
      
      <Link to={`/account/${alert.accountId}`} className="btn-secondary">
        View Account
      </Link>
      
      {alert.recommendedPlaybook && !alert.localState?.playbookId && (
        <button className="btn-outline" onClick={handleStartPlaybook}>
          📋 Start Playbook
        </button>
      )}
      
      {/* Note Input */}
      {showNoteInput && (
        <div className="note-input-container">
          <textarea
            value={noteText}
            onChange={(e) => setNoteText(e.target.value)}
            placeholder="Add a note..."
            className="note-textarea"
          />
          <div className="note-actions">
            <button className="btn-primary btn-small" onClick={handleAddNote}>Save</button>
            <button className="btn-secondary btn-small" onClick={() => setShowNoteInput(false)}>Cancel</button>
          </div>
        </div>
      )}
      
      {/* Snooze Modal */}
      {showSnoozeModal && (
        <SnoozeModal
          onSnooze={handleSnooze}
          onClose={() => setShowSnoozeModal(false)}
        />
      )}
      
      {/* Resolve Modal */}
      {showResolveModal && (
        <ResolveModal
          onResolve={handleResolve}
          onClose={() => setShowResolveModal(false)}
        />
      )}
      
      {/* Assign Modal */}
      {showAssignModal && (
        <AssignModal
          currentAssignee={alert.ownerId}
          onAssign={handleAssign}
          onClose={() => setShowAssignModal(false)}
        />
      )}
    </div>
  );
}

// ============================================================================
// Modals
// ============================================================================

interface SnoozeModalProps {
  onSnooze: (days: number, reason?: string) => void;
  onClose: () => void;
}

function SnoozeModal({ onSnooze, onClose }: SnoozeModalProps) {
  const [customDays, setCustomDays] = useState(7);
  const [reason, setReason] = useState('');
  const [showCustom, setShowCustom] = useState(false);
  
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        <h3>Snooze Alert</h3>
        <p>Choose how long to snooze this alert:</p>
        
        <div className="snooze-options">
          {SNOOZE_DURATIONS.filter(d => d.days > 0).map(duration => (
            <button
              key={duration.days}
              className="snooze-option"
              onClick={() => onSnooze(duration.days, reason)}
            >
              {duration.label}
            </button>
          ))}
          <button
            className="snooze-option custom"
            onClick={() => setShowCustom(true)}
          >
            Custom
          </button>
        </div>
        
        {showCustom && (
          <div className="custom-snooze">
            <label>Days:</label>
            <input
              type="number"
              value={customDays}
              onChange={(e) => setCustomDays(Number(e.target.value))}
              min={1}
              max={90}
            />
          </div>
        )}
        
        <div className="snooze-reason">
          <label>Reason (optional):</label>
          <input
            type="text"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Why are you snoozing this alert?"
          />
        </div>
        
        <div className="modal-actions">
          {showCustom && (
            <button className="btn-primary" onClick={() => onSnooze(customDays, reason)}>
              Snooze for {customDays} days
            </button>
          )}
          <button className="btn-secondary" onClick={onClose}>Cancel</button>
        </div>
      </div>
    </div>
  );
}

interface ResolveModalProps {
  onResolve: (outcome: OutcomeResult, notes?: string) => void;
  onClose: () => void;
}

function ResolveModal({ onResolve, onClose }: ResolveModalProps) {
  const [outcome, setOutcome] = useState<OutcomeResult>('success');
  const [notes, setNotes] = useState('');
  
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        <h3>Resolve Alert</h3>
        
        <div className="resolve-options">
          {OUTCOME_OPTIONS.map(opt => (
            <button
              key={opt.value}
              className={`resolve-option ${outcome === opt.value ? 'selected' : ''}`}
              onClick={() => setOutcome(opt.value)}
            >
              <span className="outcome-icon">{opt.icon}</span>
              <span>{opt.label}</span>
            </button>
          ))}
        </div>
        
        <div className="resolve-notes">
          <label>Resolution Notes:</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Describe how this was resolved..."
          />
        </div>
        
        <div className="modal-actions">
          <button className="btn-primary" onClick={() => onResolve(outcome, notes)}>
            Resolve Alert
          </button>
          <button className="btn-secondary" onClick={onClose}>Cancel</button>
        </div>
      </div>
    </div>
  );
}

interface AssignModalProps {
  currentAssignee?: string;
  onAssign: (assigneeId: string, assigneeName: string) => void;
  onClose: () => void;
}

function AssignModal({ currentAssignee, onAssign, onClose }: AssignModalProps) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        <h3>Assign Alert</h3>
        
        <div className="assign-options">
          {TEAM_MEMBERS.map(member => (
            <button
              key={member.id}
              className={`assign-option ${currentAssignee === member.id ? 'current' : ''}`}
              onClick={() => onAssign(member.id, member.name)}
            >
              <span className="member-avatar">
                {member.name.split(' ').map(n => n[0]).join('')}
              </span>
              <span className="member-info">
                <span className="member-name">{member.name}</span>
                <span className="member-email">{member.email}</span>
              </span>
              <span className={`member-role-badge ${member.role}`}>{member.role}</span>
              {currentAssignee === member.id && <span className="current-badge">Current</span>}
            </button>
          ))}
        </div>
        
        <div className="modal-actions">
          <button className="btn-secondary" onClick={onClose}>Cancel</button>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Alert Detail Panel (Slide-out)
// ============================================================================

interface AlertDetailPanelProps {
  alertId: string;
  alerts: EnrichedAlert[];
  onClose: () => void;
  onStateChange: () => void;
}

function AlertDetailPanel({ alertId, alerts, onClose, onStateChange }: AlertDetailPanelProps) {
  const alert = alerts.find(a => a.id === alertId);
  const [activeTab, setActiveTab] = useState<'details' | 'playbook' | 'history'>('details');
  
  const notes = getAlertNotes(alertId);
  const actionLog = getAlertActionLog(alertId);
  
  if (!alert) return null;
  
  const playbook = alert.localState?.playbookId 
    ? PLAYBOOKS.find(p => p.id === alert.localState?.playbookId)
    : alert.recommendedPlaybook;
  
  return (
    <div className="alert-detail-overlay" onClick={onClose}>
      <div className="alert-detail-panel" onClick={e => e.stopPropagation()}>
        <div className="detail-panel-header">
          <button className="close-btn" onClick={onClose}>✕</button>
          <div className="detail-header-content">
            <div className={`detail-severity-badge ${alert.severity}`}>{alert.severity}</div>
            <h2>{alert.title}</h2>
            <Link to={`/account/${alert.accountId}`} className="detail-account-link">
              {alert.accountName} →
            </Link>
          </div>
        </div>
        
        <div className="detail-panel-tabs">
          <button 
            className={activeTab === 'details' ? 'active' : ''}
            onClick={() => setActiveTab('details')}
          >
            Details
          </button>
          <button 
            className={activeTab === 'playbook' ? 'active' : ''}
            onClick={() => setActiveTab('playbook')}
          >
            Playbook
          </button>
          <button 
            className={activeTab === 'history' ? 'active' : ''}
            onClick={() => setActiveTab('history')}
          >
            History
          </button>
        </div>
        
        <div className="detail-panel-content">
          {activeTab === 'details' && (
            <DetailTabContent
              alert={alert}
              notes={notes}
              onStateChange={onStateChange}
            />
          )}
          
          {activeTab === 'playbook' && (
            <PlaybookTabContent
              alert={alert}
              playbook={playbook}
              onStateChange={onStateChange}
            />
          )}
          
          {activeTab === 'history' && (
            <HistoryTabContent
              actionLog={actionLog}
              notes={notes}
            />
          )}
        </div>
        
        <div className="detail-panel-footer">
          <AlertActionButtons alert={alert} onStateChange={onStateChange} />
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Detail Tab Content
// ============================================================================

interface DetailTabContentProps {
  alert: EnrichedAlert;
  notes: AlertNote[];
  onStateChange: () => void;
}

function DetailTabContent({ alert, notes, onStateChange }: DetailTabContentProps) {
  const [newNote, setNewNote] = useState('');
  
  const handleAddNote = () => {
    if (newNote.trim()) {
      addAlertNote(alert.id, newNote.trim());
      setNewNote('');
      onStateChange();
    }
  };
  
  return (
    <div className="detail-tab-content">
      <section className="detail-section">
        <h3>Description</h3>
        <p>{alert.description}</p>
      </section>
      
      {alert.evidence && alert.evidence.length > 0 && (
        <section className="detail-section">
          <h3>Evidence</h3>
          <div className="evidence-grid">
            {alert.evidence.map((e, i) => (
              <div key={i} className="evidence-item">
                <span className="evidence-icon">📊</span>
                <span>{e}</span>
              </div>
            ))}
          </div>
        </section>
      )}
      
      <section className="detail-section">
        <h3>SLA Status</h3>
        <div className="sla-detail">
          {alert.slaInfo.deadline ? (
            <>
              <div className={`sla-countdown-large ${alert.slaInfo.status}`}>
                {alert.slaInfo.timeRemaining}
              </div>
              <div className="sla-progress-bar">
                <div 
                  className={`sla-progress-fill ${alert.slaInfo.status}`}
                  style={{ width: `${alert.slaInfo.percentRemaining}%` }}
                />
              </div>
              <div className="sla-deadline-text">
                Deadline: {new Date(alert.slaInfo.deadline).toLocaleString()}
              </div>
            </>
          ) : (
            <div className="no-sla">No SLA defined</div>
          )}
        </div>
      </section>
      
      {alert.arrAtRisk && alert.arrAtRisk > 0 && (
        <section className="detail-section">
          <h3>ARR at Risk</h3>
          <div className="arr-at-risk-large">${alert.arrAtRisk.toLocaleString()}</div>
        </section>
      )}
      
      <section className="detail-section">
        <h3>Notes ({notes.length})</h3>
        <div className="notes-list">
          {notes.length > 0 ? (
            notes.map(note => (
              <div key={note.id} className="note-item">
                <div className="note-header">
                  <span className="note-author">{note.createdBy}</span>
                  <span className="note-time">{formatRelativeTime(note.createdAt)}</span>
                </div>
                <p className="note-content">{note.content}</p>
              </div>
            ))
          ) : (
            <p className="no-notes">No notes yet</p>
          )}
        </div>
        <div className="add-note-form">
          <textarea
            value={newNote}
            onChange={(e) => setNewNote(e.target.value)}
            placeholder="Add a note..."
          />
          <button className="btn-primary btn-small" onClick={handleAddNote} disabled={!newNote.trim()}>
            Add Note
          </button>
        </div>
      </section>
    </div>
  );
}

// ============================================================================
// Playbook Tab Content
// ============================================================================

interface PlaybookTabContentProps {
  alert: EnrichedAlert;
  playbook?: PlaybookDefinition;
  onStateChange: () => void;
}

function PlaybookTabContent({ alert, playbook, onStateChange }: PlaybookTabContentProps) {
  const isActive = !!alert.localState?.playbookId;
  const progress = alert.localState?.playbookProgress || 0;
  
  // Track completed tasks locally
  const [completedTasks, setCompletedTasks] = useState<Set<number>>(new Set());
  
  const handleToggleTask = (taskIndex: number) => {
    const newCompleted = new Set(completedTasks);
    if (newCompleted.has(taskIndex)) {
      newCompleted.delete(taskIndex);
    } else {
      newCompleted.add(taskIndex);
    }
    setCompletedTasks(newCompleted);
    
    if (playbook) {
      const newProgress = Math.round((newCompleted.size / playbook.tasks.length) * 100);
      updatePlaybookProgress(alert.id, newProgress);
      
      if (newProgress === 100) {
        completePlaybook(alert.id);
      }
      
      onStateChange();
    }
  };
  
  const handleStartPlaybook = () => {
    if (playbook) {
      startPlaybook(alert.id, playbook.id);
      onStateChange();
    }
  };
  
  if (!playbook) {
    return (
      <div className="detail-tab-content">
        <div className="no-playbook">
          <p>No playbook recommended for this alert type.</p>
          <p>Available playbooks:</p>
          <div className="playbook-list">
            {PLAYBOOKS.map(p => (
              <div key={p.id} className="playbook-option">
                <span className="playbook-name">{p.name}</span>
                <span className="playbook-types">{p.alertTypes.join(', ')}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }
  
  return (
    <div className="detail-tab-content">
      <section className="detail-section">
        <div className="playbook-header">
          <h3>{playbook.name}</h3>
          <span className="playbook-duration">{playbook.estimatedDays} days</span>
        </div>
        <p className="playbook-description">{playbook.description}</p>
      </section>
      
      {isActive && (
        <section className="detail-section">
          <h4>Progress</h4>
          <div className="playbook-progress-bar">
            <div 
              className="playbook-progress-fill"
              style={{ width: `${progress}%` }}
            />
          </div>
          <span className="playbook-progress-text">{progress}% Complete</span>
        </section>
      )}
      
      <section className="detail-section">
        <h4>Tasks ({completedTasks.size}/{playbook.tasks.length})</h4>
        <div className="playbook-tasks">
          {playbook.tasks.map((task, index) => (
            <div 
              key={index} 
              className={`playbook-task ${completedTasks.has(index) ? 'completed' : ''} ${!isActive ? 'disabled' : ''}`}
              onClick={() => isActive && handleToggleTask(index)}
            >
              <div className={`task-checkbox ${completedTasks.has(index) ? 'checked' : ''}`}>
                {completedTasks.has(index) && '✓'}
              </div>
              <div className="task-content">
                <span className="task-title">{task.title}</span>
                {task.description && (
                  <span className="task-description">{task.description}</span>
                )}
              </div>
            </div>
          ))}
        </div>
      </section>
      
      {!isActive && (
        <div className="start-playbook-container">
          <button className="btn-primary" onClick={handleStartPlaybook}>
            📋 Start This Playbook
          </button>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// History Tab Content
// ============================================================================

interface HistoryTabContentProps {
  actionLog: AlertActionLog[];
  notes: AlertNote[];
}

function HistoryTabContent({ actionLog, notes }: HistoryTabContentProps) {
  // Merge action log and notes into a timeline
  const timeline = [
    ...actionLog.map(log => ({
      type: 'action' as const,
      timestamp: log.timestamp,
      data: log,
    })),
    ...notes.map(note => ({
      type: 'note' as const,
      timestamp: note.createdAt,
      data: note,
    })),
  ].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  
  const actionLabels: Record<AlertActionLog['action'], string> = {
    acknowledged: 'Acknowledged',
    snoozed: 'Snoozed',
    resolved: 'Resolved',
    assigned: 'Assigned',
    note_added: 'Note Added',
    playbook_started: 'Playbook Started',
    playbook_completed: 'Playbook Completed',
    reopened: 'Reopened',
  };
  
  const actionIcons: Record<AlertActionLog['action'], string> = {
    acknowledged: '✓',
    snoozed: '😴',
    resolved: '✅',
    assigned: '👤',
    note_added: '📝',
    playbook_started: '📋',
    playbook_completed: '🎉',
    reopened: '↩️',
  };
  
  return (
    <div className="detail-tab-content">
      <section className="detail-section">
        <h3>Activity History</h3>
        {timeline.length > 0 ? (
          <div className="history-timeline">
            {timeline.map((item, index) => (
              <div key={index} className="history-item">
                {item.type === 'action' ? (
                  <>
                    <span className="history-icon">{actionIcons[item.data.action]}</span>
                    <div className="history-content">
                      <span className="history-action">{actionLabels[item.data.action]}</span>
                      <span className="history-actor">by {item.data.actorName}</span>
                      {item.data.details && Object.keys(item.data.details).length > 0 && (
                        <span className="history-details">
                          {JSON.stringify(item.data.details)}
                        </span>
                      )}
                    </div>
                    <span className="history-time">{formatRelativeTime(item.timestamp)}</span>
                  </>
                ) : (
                  <>
                    <span className="history-icon">📝</span>
                    <div className="history-content">
                      <span className="history-action">Note</span>
                      <span className="history-actor">by {item.data.createdBy}</span>
                      <p className="history-note-content">{item.data.content}</p>
                    </div>
                    <span className="history-time">{formatRelativeTime(item.timestamp)}</span>
                  </>
                )}
              </div>
            ))}
          </div>
        ) : (
          <p className="no-history">No activity recorded yet</p>
        )}
      </section>
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
