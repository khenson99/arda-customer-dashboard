/**
 * AccountInsightsWidget Component
 * 
 * A compact widget for the Account360 Overview tab showing:
 * - Account-specific insights
 * - Churn probability score
 * - Key recommendations
 */

import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { generateAccountInsights, type Insight } from '../lib/insights-engine';
import { predictChurnRisk, type ChurnPrediction } from '../lib/forecasting';
import type { AccountDetail } from '../lib/types/account';

interface AccountInsightsWidgetProps {
  account: AccountDetail;
}

export function AccountInsightsWidget({ account }: AccountInsightsWidgetProps) {
  // Generate account-specific insights
  const insights = useMemo(() => {
    return generateAccountInsights(account);
  }, [account]);
  
  // Predict churn risk
  const churnPrediction = useMemo(() => {
    return predictChurnRisk(account);
  }, [account]);
  
  // Get top 3 insights by severity
  const topInsights = useMemo(() => {
    const severityOrder = { critical: 0, warning: 1, info: 2 };
    return [...insights]
      .sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity])
      .slice(0, 3);
  }, [insights]);
  
  const getRiskColor = (level: ChurnPrediction['riskLevel']): string => {
    switch (level) {
      case 'critical': return 'var(--danger)';
      case 'high': return '#f97316';
      case 'medium': return 'var(--warning)';
      case 'low': return 'var(--success)';
    }
  };
  
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
  
  return (
    <div className="account-insights-widget glass-card">
      <div className="widget-header">
        <h3>🧠 AI Insights</h3>
        {insights.length > 3 && (
          <Link to="/insights" className="view-all-link">
            View all →
          </Link>
        )}
      </div>
      
      {/* Churn Risk Score */}
      <div className="churn-risk-section">
        <div className="churn-risk-header">
          <span className="churn-label">Churn Risk</span>
          <span 
            className={`churn-level ${churnPrediction.riskLevel}`}
            style={{ color: getRiskColor(churnPrediction.riskLevel) }}
          >
            {churnPrediction.riskLevel.toUpperCase()}
          </span>
        </div>
        
        <div className="churn-score-container">
          <div className="churn-score-bar">
            <div 
              className="churn-score-fill"
              style={{ 
                width: `${churnPrediction.probability}%`,
                background: getRiskColor(churnPrediction.riskLevel),
              }}
            />
          </div>
          <span className="churn-score-value">{churnPrediction.probability}%</span>
        </div>
        
        {/* Top Risk Factors */}
        {churnPrediction.factors.length > 0 && (
          <div className="churn-factors">
            <span className="factors-label">Key Factors:</span>
            <ul className="factors-list">
              {churnPrediction.factors.slice(0, 2).map((factor, i) => (
                <li key={i} className={`factor-item ${factor.impact}`}>
                  <span className="factor-icon">
                    {factor.impact === 'negative' ? '⚠️' : factor.impact === 'positive' ? '✓' : '•'}
                  </span>
                  <span className="factor-text">{factor.name}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
      
      {/* Insights List */}
      {topInsights.length > 0 ? (
        <div className="insights-list">
          {topInsights.map(insight => (
            <div 
              key={insight.id} 
              className={`insight-item ${insight.severity}`}
            >
              <div className="insight-header">
                <span className={`severity-indicator ${insight.severity}`}>
                  {insight.severity === 'critical' ? '🔴' : 
                   insight.severity === 'warning' ? '🟠' : '🔵'}
                </span>
                <span className="insight-type">
                  {getTypeIcon(insight.type)}
                </span>
              </div>
              <div className="insight-content">
                <span className="insight-title">{insight.title}</span>
                {insight.suggestedAction && (
                  <span className="insight-action">
                    → {insight.suggestedAction}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="no-insights">
          <span className="no-insights-icon">✨</span>
          <span className="no-insights-text">No alerts for this account</span>
        </div>
      )}
      
      {/* Recommended Actions */}
      {churnPrediction.recommendedActions.length > 0 && churnPrediction.probability >= 30 && (
        <div className="recommended-actions">
          <h4>💡 Recommended Actions</h4>
          <ul className="actions-list">
            {churnPrediction.recommendedActions.slice(0, 2).map((action, i) => (
              <li key={i} className="action-item">
                <span className="action-bullet">→</span>
                <span className="action-text">{action}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Compact version for smaller spaces
// ============================================================================

interface AccountInsightsBadgeProps {
  account: AccountDetail;
}

export function AccountInsightsBadge({ account }: AccountInsightsBadgeProps) {
  const churnPrediction = useMemo(() => predictChurnRisk(account), [account]);
  const insights = useMemo(() => generateAccountInsights(account), [account]);
  
  const criticalCount = insights.filter(i => i.severity === 'critical').length;
  const warningCount = insights.filter(i => i.severity === 'warning').length;
  
  if (criticalCount === 0 && warningCount === 0 && churnPrediction.probability < 30) {
    return null;
  }
  
  return (
    <div className="account-insights-badge">
      {churnPrediction.probability >= 50 && (
        <span 
          className={`churn-badge ${churnPrediction.riskLevel}`}
          title={`Churn risk: ${churnPrediction.probability}%`}
        >
          ⚠️ {churnPrediction.probability}% churn
        </span>
      )}
      {criticalCount > 0 && (
        <span className="insight-count-badge critical" title={`${criticalCount} critical insights`}>
          🔴 {criticalCount}
        </span>
      )}
      {warningCount > 0 && (
        <span className="insight-count-badge warning" title={`${warningCount} warnings`}>
          🟠 {warningCount}
        </span>
      )}
    </div>
  );
}

export default AccountInsightsWidget;
