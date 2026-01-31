/**
 * InsightsPanel Component
 * 
 * Displays a list of AI-generated insights with severity badges,
 * filtering, dismiss/acknowledge actions, and deep links to related accounts.
 */

import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import type { Insight, InsightFilter } from '../lib/insights-engine';
import { filterInsights, getInsightCountsBySeverity } from '../lib/insights-engine';

interface InsightsPanelProps {
  insights: Insight[];
  title?: string;
  showFilters?: boolean;
  showAccountLinks?: boolean;
  maxItems?: number;
  compact?: boolean;
  onDismiss?: (insightId: string) => void;
  onAcknowledge?: (insightId: string) => void;
}

export function InsightsPanel({
  insights,
  title = 'AI Insights',
  showFilters = true,
  showAccountLinks = true,
  maxItems,
  compact = false,
  onDismiss,
  onAcknowledge,
}: InsightsPanelProps) {
  const [activeFilter, setActiveFilter] = useState<InsightFilter>('all');
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());
  const [acknowledgedIds, setAcknowledgedIds] = useState<Set<string>>(new Set());
  
  // Filter insights
  const filteredInsights = useMemo(() => {
    let result = filterInsights(insights, activeFilter);
    // Remove dismissed insights
    result = result.filter(i => !dismissedIds.has(i.id));
    // Apply max items limit
    if (maxItems) {
      result = result.slice(0, maxItems);
    }
    return result;
  }, [insights, activeFilter, dismissedIds, maxItems]);
  
  const counts = useMemo(() => getInsightCountsBySeverity(insights), [insights]);
  
  const handleDismiss = (insightId: string) => {
    setDismissedIds(prev => new Set([...prev, insightId]));
    onDismiss?.(insightId);
  };
  
  const handleAcknowledge = (insightId: string) => {
    setAcknowledgedIds(prev => new Set([...prev, insightId]));
    onAcknowledge?.(insightId);
  };
  
  const filterButtons: { filter: InsightFilter; label: string; icon: string }[] = [
    { filter: 'all', label: 'All', icon: '📊' },
    { filter: 'trend', label: 'Trends', icon: '📈' },
    { filter: 'anomaly', label: 'Anomalies', icon: '⚡' },
    { filter: 'prediction', label: 'Predictions', icon: '🔮' },
    { filter: 'recommendation', label: 'Actions', icon: '💡' },
    { filter: 'benchmark', label: 'Benchmarks', icon: '📏' },
  ];
  
  if (insights.length === 0) {
    return (
      <div className={`insights-panel ${compact ? 'compact' : ''}`}>
        <div className="insights-header">
          <h3>🧠 {title}</h3>
        </div>
        <div className="insights-empty">
          <span className="empty-icon">✨</span>
          <p>No insights to display</p>
          <span className="empty-sub">Check back later for AI-generated recommendations</span>
        </div>
      </div>
    );
  }
  
  return (
    <div className={`insights-panel ${compact ? 'compact' : ''}`}>
      <div className="insights-header">
        <div className="insights-title-row">
          <h3>🧠 {title}</h3>
          <div className="insights-severity-summary">
            {counts.critical > 0 && (
              <span className="severity-count critical">{counts.critical} critical</span>
            )}
            {counts.warning > 0 && (
              <span className="severity-count warning">{counts.warning} warning</span>
            )}
            <span className="severity-count info">{counts.info} info</span>
          </div>
        </div>
        
        {showFilters && !compact && (
          <div className="insights-filters">
            {filterButtons.map(({ filter, label, icon }) => (
              <button
                key={filter}
                className={`insights-filter-btn ${activeFilter === filter ? 'active' : ''}`}
                onClick={() => setActiveFilter(filter)}
              >
                <span className="filter-icon">{icon}</span>
                <span className="filter-label">{label}</span>
              </button>
            ))}
          </div>
        )}
      </div>
      
      <div className="insights-list">
        {filteredInsights.map(insight => (
          <InsightCard
            key={insight.id}
            insight={insight}
            showAccountLink={showAccountLinks}
            isAcknowledged={acknowledgedIds.has(insight.id)}
            compact={compact}
            onDismiss={() => handleDismiss(insight.id)}
            onAcknowledge={() => handleAcknowledge(insight.id)}
          />
        ))}
        
        {filteredInsights.length === 0 && (
          <div className="insights-no-results">
            <p>No {activeFilter !== 'all' ? activeFilter : ''} insights found</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// InsightCard Component
// ============================================================================

interface InsightCardProps {
  insight: Insight;
  showAccountLink?: boolean;
  isAcknowledged?: boolean;
  compact?: boolean;
  onDismiss?: () => void;
  onAcknowledge?: () => void;
}

function InsightCard({
  insight,
  showAccountLink = true,
  isAcknowledged = false,
  compact = false,
  onDismiss,
  onAcknowledge,
}: InsightCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  
  const getTypeIcon = (type: Insight['type']): string => {
    switch (type) {
      case 'trend': return '📈';
      case 'anomaly': return '⚡';
      case 'prediction': return '🔮';
      case 'recommendation': return '💡';
      case 'benchmark': return '📏';
      default: return '📊';
    }
  };
  
  const getSeverityClass = (severity: Insight['severity']): string => {
    switch (severity) {
      case 'critical': return 'severity-critical';
      case 'warning': return 'severity-warning';
      case 'info': return 'severity-info';
      default: return '';
    }
  };
  
  const getCategoryIcon = (category?: Insight['category']): string => {
    switch (category) {
      case 'usage': return '📦';
      case 'health': return '💚';
      case 'commercial': return '💰';
      case 'engagement': return '🎯';
      case 'risk': return '⚠️';
      default: return '';
    }
  };
  
  const formatTimeAgo = (timestamp: string): string => {
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
  };
  
  return (
    <div 
      className={`insight-card ${getSeverityClass(insight.severity)} ${isAcknowledged ? 'acknowledged' : ''} ${compact ? 'compact' : ''}`}
    >
      <div className="insight-card-header">
        <div className="insight-badges">
          <span className={`insight-severity-badge ${insight.severity}`}>
            {insight.severity === 'critical' ? '🔴' : 
             insight.severity === 'warning' ? '🟠' : '🔵'}
            {insight.severity}
          </span>
          <span className="insight-type-badge">
            {getTypeIcon(insight.type)} {insight.type}
          </span>
          {insight.category && (
            <span className="insight-category-badge">
              {getCategoryIcon(insight.category)} {insight.category}
            </span>
          )}
        </div>
        <div className="insight-meta">
          <span className="insight-confidence">
            {insight.confidence}% confidence
          </span>
          <span className="insight-time">
            {formatTimeAgo(insight.createdAt)}
          </span>
        </div>
      </div>
      
      <h4 className="insight-title">{insight.title}</h4>
      
      {!compact && (
        <p className="insight-description">{insight.description}</p>
      )}
      
      {/* Evidence Section - Expandable */}
      {!compact && insight.evidence.length > 0 && (
        <div className="insight-evidence">
          <button 
            className="evidence-toggle"
            onClick={() => setIsExpanded(!isExpanded)}
          >
            <span className="evidence-label">📋 Evidence ({insight.evidence.length})</span>
            <span className="evidence-arrow">{isExpanded ? '▼' : '▶'}</span>
          </button>
          
          {isExpanded && (
            <ul className="evidence-list">
              {insight.evidence.map((e, i) => (
                <li key={i}>{e}</li>
              ))}
            </ul>
          )}
        </div>
      )}
      
      {/* Suggested Action */}
      {!compact && insight.suggestedAction && (
        <div className="insight-action">
          <span className="action-label">💡 Suggested Action:</span>
          <span className="action-text">{insight.suggestedAction}</span>
        </div>
      )}
      
      {/* Footer with Account Link and Actions */}
      <div className="insight-card-footer">
        {showAccountLink && insight.accountId && (
          <Link 
            to={`/account/${insight.accountId}`}
            className="insight-account-link"
          >
            <span className="account-icon">🏢</span>
            <span className="account-name">{insight.accountName || insight.accountId}</span>
            <span className="link-arrow">→</span>
          </Link>
        )}
        
        <div className="insight-actions">
          {onAcknowledge && !isAcknowledged && (
            <button 
              className="insight-action-btn acknowledge"
              onClick={onAcknowledge}
              title="Acknowledge this insight"
            >
              ✓ Acknowledge
            </button>
          )}
          {isAcknowledged && (
            <span className="acknowledged-badge">✓ Acknowledged</span>
          )}
          {onDismiss && (
            <button 
              className="insight-action-btn dismiss"
              onClick={onDismiss}
              title="Dismiss this insight"
            >
              ✕
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Compact Insight Widget (for embedding in other views)
// ============================================================================

interface InsightWidgetProps {
  insights: Insight[];
  title?: string;
  maxItems?: number;
  showViewAll?: boolean;
  viewAllLink?: string;
}

export function InsightWidget({
  insights,
  title = 'Key Insights',
  maxItems = 3,
  showViewAll = true,
  viewAllLink = '/insights',
}: InsightWidgetProps) {
  // Sort by severity and take top N
  const topInsights = useMemo(() => {
    const severityOrder = { critical: 0, warning: 1, info: 2 };
    return [...insights]
      .sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity])
      .slice(0, maxItems);
  }, [insights, maxItems]);
  
  if (topInsights.length === 0) {
    return null;
  }
  
  return (
    <div className="insight-widget glass-card">
      <div className="widget-header">
        <h4>🧠 {title}</h4>
        {showViewAll && insights.length > maxItems && (
          <Link to={viewAllLink} className="widget-view-all">
            View all ({insights.length}) →
          </Link>
        )}
      </div>
      
      <div className="widget-insights-list">
        {topInsights.map(insight => (
          <div 
            key={insight.id} 
            className={`widget-insight-item ${insight.severity}`}
          >
            <div className="widget-insight-header">
              <span className={`widget-severity-dot ${insight.severity}`} />
              <span className="widget-insight-type">
                {insight.type === 'trend' ? '📈' :
                 insight.type === 'anomaly' ? '⚡' :
                 insight.type === 'prediction' ? '🔮' :
                 insight.type === 'recommendation' ? '💡' : '📏'}
              </span>
            </div>
            <div className="widget-insight-content">
              <span className="widget-insight-title">{insight.title}</span>
              {insight.suggestedAction && (
                <span className="widget-insight-action">
                  → {insight.suggestedAction}
                </span>
              )}
            </div>
            {insight.accountId && (
              <Link 
                to={`/account/${insight.accountId}`}
                className="widget-insight-link"
                title={`View ${insight.accountName}`}
              >
                →
              </Link>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

export default InsightsPanel;
