/**
 * InsightsDashboard Component
 * 
 * The main Insights tab page featuring:
 * - Portfolio health summary
 * - Key metrics (Total ARR, At-Risk ARR, Expansion Pipeline)
 * - AI-generated insights list
 * - Revenue forecast chart
 * - Top accounts needing attention
 */

import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { fetchCustomerMetrics } from '../lib/arda-client';
import { TabNavigation } from './TabNavigation';
import { InsightsPanel } from './InsightsPanel';
import { ForecastChart, ForecastMetrics, ForecastTable, ChurnDistributionChart } from './ForecastChart';
import { 
  generatePortfolioInsights, 
  getInsightCountsBySeverity,
  type Insight,
} from '../lib/insights-engine';
import { 
  forecastRevenue, 
  getPortfolioForecast,
  getChurnMetrics,
  type PortfolioForecast,
  type ChurnPrediction,
} from '../lib/forecasting';
import type { AccountSummary, HealthGrade, HealthTrend } from '../lib/types/account';

// ============================================================================
// TYPES
// ============================================================================

interface AccountNeedingAttention {
  id: string;
  name: string;
  healthScore: number;
  healthGrade: HealthGrade;
  healthTrend: HealthTrend;
  arr?: number;
  daysToRenewal?: number;
  criticalAlertCount: number;
  reason: string;
}

// ============================================================================
// Main Component
// ============================================================================

export function InsightsDashboard() {
  const [activeView, setActiveView] = useState<'overview' | 'forecast' | 'accounts'>('overview');
  
  // Fetch customer data
  const { data: customers, isLoading, error } = useQuery({
    queryKey: ['customerMetrics'],
    queryFn: fetchCustomerMetrics,
  });
  
  // Convert customers to AccountSummary format for insights generation
  const accountSummaries: AccountSummary[] = useMemo(() => {
    if (!customers) return [];
    
    return customers.map(c => ({
      id: c.tenantId || c.id,
      name: c.tenantName || c.name || 'Unknown',
      segment: c.segment || 'smb',
      tier: c.tier || 'starter',
      ownerName: c.assignedCSM,
      healthScore: c.healthScore || 50,
      healthGrade: getHealthGrade(c.healthScore || 50),
      healthTrend: c.healthTrend || 'stable',
      activeUsers: c.activeUsersLast30Days || 0,
      daysSinceLastActivity: c.daysSinceLastActivity || 0,
      lifecycleStage: c.lifecycleStage || 'adoption',
      onboardingStatus: c.onboardingStatus || 'not_started',
      arr: c.arr || 0,
      daysToRenewal: c.daysToRenewal,
      alertCount: c.alerts?.length || 0,
      criticalAlertCount: c.alerts?.filter(a => a.severity === 'critical').length || 0,
      activityTrend: c.activityTrend || [],
      primaryTenantId: c.tenantId,
    }));
  }, [customers]);
  
  // Generate portfolio insights
  const insights = useMemo(() => {
    return generatePortfolioInsights(accountSummaries);
  }, [accountSummaries]);
  
  // Generate revenue forecast
  const portfolioForecast = useMemo(() => {
    return getPortfolioForecast(accountSummaries);
  }, [accountSummaries]);
  
  // Calculate churn metrics
  const churnMetrics = useMemo(() => {
    // Simplified churn calculation from account summaries
    const atRisk = accountSummaries.filter(a => 
      a.healthScore < 50 || a.criticalAlertCount > 0
    );
    
    return {
      criticalCount: atRisk.filter(a => a.healthScore < 30).length,
      highCount: atRisk.filter(a => a.healthScore >= 30 && a.healthScore < 50).length,
      mediumCount: accountSummaries.filter(a => a.healthScore >= 50 && a.healthScore < 70).length,
      lowCount: accountSummaries.filter(a => a.healthScore >= 70).length,
      totalARRAtRisk: atRisk.reduce((sum, a) => sum + (a.arr || 0), 0),
      avgProbability: 0,
    };
  }, [accountSummaries]);
  
  // Get accounts needing attention
  const accountsNeedingAttention = useMemo(() => {
    return accountSummaries
      .filter(a => 
        a.healthScore < 50 || 
        a.criticalAlertCount > 0 || 
        (a.daysToRenewal && a.daysToRenewal <= 30) ||
        a.daysSinceLastActivity > 14
      )
      .map(a => ({
        id: a.id,
        name: a.name,
        healthScore: a.healthScore,
        healthGrade: a.healthGrade,
        healthTrend: a.healthTrend,
        arr: a.arr,
        daysToRenewal: a.daysToRenewal,
        criticalAlertCount: a.criticalAlertCount,
        reason: getAttentionReason(a),
      }))
      .sort((a, b) => {
        // Sort by severity: critical alerts > low health > renewal approaching
        if (a.criticalAlertCount !== b.criticalAlertCount) {
          return b.criticalAlertCount - a.criticalAlertCount;
        }
        return a.healthScore - b.healthScore;
      })
      .slice(0, 10);
  }, [accountSummaries]);
  
  // Portfolio health summary
  const portfolioHealth = useMemo(() => {
    const total = accountSummaries.length;
    if (total === 0) return { healthy: 0, moderate: 0, atRisk: 0, avgScore: 0 };
    
    const healthy = accountSummaries.filter(a => a.healthScore >= 70).length;
    const moderate = accountSummaries.filter(a => a.healthScore >= 40 && a.healthScore < 70).length;
    const atRisk = accountSummaries.filter(a => a.healthScore < 40).length;
    const avgScore = Math.round(accountSummaries.reduce((s, a) => s + a.healthScore, 0) / total);
    
    return {
      healthy,
      moderate,
      atRisk,
      avgScore,
      healthyPercent: Math.round((healthy / total) * 100),
      moderatePercent: Math.round((moderate / total) * 100),
      atRiskPercent: Math.round((atRisk / total) * 100),
    };
  }, [accountSummaries]);
  
  const insightCounts = useMemo(() => getInsightCountsBySeverity(insights), [insights]);
  
  if (isLoading) {
    return (
      <div className="dashboard">
        <TabNavigation />
        <div className="dashboard-content">
          <div className="loading-state">
            <div className="loading-spinner" />
            <p>Generating insights from your portfolio data...</p>
          </div>
        </div>
      </div>
    );
  }
  
  if (error) {
    return (
      <div className="dashboard">
        <TabNavigation />
        <div className="dashboard-content">
          <div className="error-message">
            <div className="error-icon">⚠️</div>
            <p>Failed to load portfolio data for insights.</p>
          </div>
        </div>
      </div>
    );
  }
  
  return (
    <div className="dashboard insights-dashboard">
      <TabNavigation />
      
      <div className="dashboard-content">
        {/* Page Header */}
        <header className="dashboard-header insights-header">
          <div className="header-top">
            <div>
              <h1>🧠 AI Insights & Forecasting</h1>
              <p>Predictive analytics and actionable intelligence for your customer portfolio</p>
            </div>
            <div className="insights-view-toggle">
              <button 
                className={`view-btn ${activeView === 'overview' ? 'active' : ''}`}
                onClick={() => setActiveView('overview')}
              >
                📊 Overview
              </button>
              <button 
                className={`view-btn ${activeView === 'forecast' ? 'active' : ''}`}
                onClick={() => setActiveView('forecast')}
              >
                📈 Forecast
              </button>
              <button 
                className={`view-btn ${activeView === 'accounts' ? 'active' : ''}`}
                onClick={() => setActiveView('accounts')}
              >
                👥 Accounts
              </button>
            </div>
          </div>
        </header>
        
        {/* Key Metrics Row */}
        <div className="insights-metrics-row">
          <div className="glass-card insight-metric-card">
            <div className="metric-icon">💰</div>
            <div className="metric-content">
              <span className="metric-value">${portfolioForecast.currentARR.toLocaleString()}</span>
              <span className="metric-label">Total ARR</span>
            </div>
          </div>
          
          <div className="glass-card insight-metric-card at-risk">
            <div className="metric-icon">⚠️</div>
            <div className="metric-content">
              <span className="metric-value danger">${portfolioForecast.totalAtRisk.toLocaleString()}</span>
              <span className="metric-label">At-Risk ARR</span>
            </div>
          </div>
          
          <div className="glass-card insight-metric-card expansion">
            <div className="metric-icon">🚀</div>
            <div className="metric-content">
              <span className="metric-value success">
                ${portfolioForecast.totalExpansionOpportunity.toLocaleString()}
              </span>
              <span className="metric-label">Expansion Pipeline</span>
            </div>
          </div>
          
          <div className="glass-card insight-metric-card">
            <div className="metric-icon">💚</div>
            <div className="metric-content">
              <span className="metric-value">{portfolioHealth.avgScore}</span>
              <span className="metric-label">Avg Health Score</span>
            </div>
          </div>
          
          <div className="glass-card insight-metric-card alerts">
            <div className="metric-icon">🔔</div>
            <div className="metric-content">
              <div className="alert-counts">
                {insightCounts.critical > 0 && (
                  <span className="alert-count critical">{insightCounts.critical}</span>
                )}
                {insightCounts.warning > 0 && (
                  <span className="alert-count warning">{insightCounts.warning}</span>
                )}
                <span className="alert-count info">{insightCounts.info}</span>
              </div>
              <span className="metric-label">Active Insights</span>
            </div>
          </div>
        </div>
        
        {/* View Content */}
        {activeView === 'overview' && (
          <div className="insights-overview-content">
            {/* Two Column Layout */}
            <div className="insights-two-column">
              {/* Left Column: Insights Panel */}
              <div className="insights-main-column">
                <div className="glass-card insights-panel-container">
                  <InsightsPanel 
                    insights={insights}
                    title="Portfolio Insights"
                    showFilters={true}
                    showAccountLinks={true}
                  />
                </div>
              </div>
              
              {/* Right Column: Summary Cards */}
              <div className="insights-side-column">
                {/* Portfolio Health Distribution */}
                <div className="glass-card health-distribution-card">
                  <h3>📊 Portfolio Health</h3>
                  <div className="health-distribution">
                    <div className="health-bar">
                      <div 
                        className="health-segment healthy" 
                        style={{ width: `${portfolioHealth.healthyPercent}%` }}
                        title={`${portfolioHealth.healthy} healthy accounts`}
                      />
                      <div 
                        className="health-segment moderate" 
                        style={{ width: `${portfolioHealth.moderatePercent}%` }}
                        title={`${portfolioHealth.moderate} moderate accounts`}
                      />
                      <div 
                        className="health-segment at-risk" 
                        style={{ width: `${portfolioHealth.atRiskPercent}%` }}
                        title={`${portfolioHealth.atRisk} at-risk accounts`}
                      />
                    </div>
                    <div className="health-legend">
                      <div className="legend-item">
                        <span className="legend-dot healthy" />
                        <span>Healthy ({portfolioHealth.healthy})</span>
                      </div>
                      <div className="legend-item">
                        <span className="legend-dot moderate" />
                        <span>Moderate ({portfolioHealth.moderate})</span>
                      </div>
                      <div className="legend-item">
                        <span className="legend-dot at-risk" />
                        <span>At-Risk ({portfolioHealth.atRisk})</span>
                      </div>
                    </div>
                  </div>
                </div>
                
                {/* Revenue Forecast Mini */}
                <div className="glass-card forecast-mini-card">
                  <h3>📈 6-Month Forecast</h3>
                  <ForecastChart 
                    forecast={portfolioForecast}
                    height={180}
                    variant="compact"
                    showAtRisk={false}
                    showExpansion={false}
                  />
                  <Link to="#" onClick={() => setActiveView('forecast')} className="view-full-link">
                    View Full Forecast →
                  </Link>
                </div>
                
                {/* Top Accounts Needing Attention */}
                <div className="glass-card attention-accounts-card">
                  <h3>🚨 Needs Attention</h3>
                  <div className="attention-accounts-list">
                    {accountsNeedingAttention.slice(0, 5).map(account => (
                      <Link 
                        key={account.id}
                        to={`/account/${account.id}`}
                        className="attention-account-item"
                      >
                        <div className="account-health-indicator">
                          <span className={`health-grade grade-${account.healthGrade.toLowerCase()}`}>
                            {account.healthGrade}
                          </span>
                        </div>
                        <div className="account-info">
                          <span className="account-name">{account.name}</span>
                          <span className="account-reason">{account.reason}</span>
                        </div>
                        {account.arr && (
                          <span className="account-arr">
                            ${(account.arr / 1000).toFixed(0)}K
                          </span>
                        )}
                      </Link>
                    ))}
                  </div>
                  {accountsNeedingAttention.length > 5 && (
                    <button 
                      className="view-all-accounts-btn"
                      onClick={() => setActiveView('accounts')}
                    >
                      View all {accountsNeedingAttention.length} accounts →
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
        
        {activeView === 'forecast' && (
          <div className="insights-forecast-content">
            {/* Forecast Metrics */}
            <ForecastMetrics forecast={portfolioForecast} />
            
            {/* Main Forecast Chart */}
            <div className="glass-card forecast-chart-container">
              <h3>📈 Revenue Forecast</h3>
              <ForecastChart 
                forecast={portfolioForecast}
                height={350}
                variant="full"
              />
            </div>
            
            {/* Two Column: Churn Distribution and Forecast Table */}
            <div className="forecast-details-row">
              <div className="glass-card churn-distribution-container">
                <h3>⚠️ Churn Risk Distribution</h3>
                <ChurnDistributionChart data={churnMetrics} height={200} />
              </div>
              
              <div className="glass-card forecast-table-container">
                <h3>📅 Monthly Breakdown</h3>
                <ForecastTable forecasts={portfolioForecast.forecasts} />
              </div>
            </div>
          </div>
        )}
        
        {activeView === 'accounts' && (
          <div className="insights-accounts-content">
            <div className="glass-card accounts-needing-attention">
              <h3>🚨 Accounts Needing Attention ({accountsNeedingAttention.length})</h3>
              <p className="section-description">
                These accounts show risk signals and require proactive outreach.
              </p>
              
              <div className="attention-accounts-table">
                <table>
                  <thead>
                    <tr>
                      <th>Account</th>
                      <th>Health</th>
                      <th>ARR</th>
                      <th>Alerts</th>
                      <th>Reason</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {accountsNeedingAttention.map(account => (
                      <tr key={account.id}>
                        <td className="account-cell">
                          <Link to={`/account/${account.id}`}>
                            {account.name}
                          </Link>
                        </td>
                        <td className="health-cell">
                          <span className={`health-badge grade-${account.healthGrade.toLowerCase()}`}>
                            {account.healthScore}
                            <span className={`trend-arrow ${account.healthTrend}`}>
                              {account.healthTrend === 'improving' ? '↑' : 
                               account.healthTrend === 'declining' ? '↓' : '→'}
                            </span>
                          </span>
                        </td>
                        <td className="arr-cell">
                          {account.arr ? `$${account.arr.toLocaleString()}` : '—'}
                        </td>
                        <td className="alerts-cell">
                          {account.criticalAlertCount > 0 && (
                            <span className="alert-badge critical">
                              {account.criticalAlertCount}
                            </span>
                          )}
                        </td>
                        <td className="reason-cell">
                          <span className="reason-text">{account.reason}</span>
                        </td>
                        <td className="actions-cell">
                          <Link 
                            to={`/account/${account.id}`}
                            className="btn-secondary btn-small"
                          >
                            View →
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// Helper Functions
// ============================================================================

function getHealthGrade(score: number): HealthGrade {
  if (score >= 80) return 'A';
  if (score >= 60) return 'B';
  if (score >= 40) return 'C';
  if (score >= 20) return 'D';
  return 'F';
}

function getAttentionReason(account: AccountSummary): string {
  if (account.criticalAlertCount > 0) {
    return `${account.criticalAlertCount} critical alert${account.criticalAlertCount > 1 ? 's' : ''}`;
  }
  if (account.healthScore < 30) {
    return 'Critical health score';
  }
  if (account.healthScore < 50) {
    return 'Low health score';
  }
  if (account.daysToRenewal && account.daysToRenewal <= 30) {
    return `Renewal in ${account.daysToRenewal} days`;
  }
  if (account.daysSinceLastActivity > 14) {
    return `Inactive for ${account.daysSinceLastActivity} days`;
  }
  if (account.healthTrend === 'declining') {
    return 'Health declining';
  }
  return 'Needs review';
}

export default InsightsDashboard;
