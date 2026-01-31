/**
 * ForecastChart Component
 * 
 * Revenue forecast visualization with at-risk revenue highlighting,
 * expansion opportunity overlay, and interactive tooltips.
 */

import { useMemo } from 'react';
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  ComposedChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  ReferenceLine,
  Cell,
} from 'recharts';
import type { RevenueForecast, PortfolioForecast } from '../lib/forecasting';

// ============================================================================
// TYPES
// ============================================================================

interface ForecastChartProps {
  forecast: PortfolioForecast;
  height?: number;
  showExpansion?: boolean;
  showAtRisk?: boolean;
  variant?: 'full' | 'compact';
}

interface ForecastMetricsProps {
  forecast: PortfolioForecast;
  compact?: boolean;
}

// ============================================================================
// Utility Functions
// ============================================================================

function formatCurrency(value: number): string {
  if (value >= 1000000) {
    return `$${(value / 1000000).toFixed(1)}M`;
  }
  if (value >= 1000) {
    return `$${(value / 1000).toFixed(0)}K`;
  }
  return `$${value.toLocaleString()}`;
}

function formatCurrencyFull(value: number): string {
  return `$${value.toLocaleString()}`;
}

// ============================================================================
// Main ForecastChart Component
// ============================================================================

export function ForecastChart({
  forecast,
  height = 300,
  showExpansion = true,
  showAtRisk = true,
  variant = 'full',
}: ForecastChartProps) {
  const chartData = useMemo(() => {
    // Add current month as baseline
    const currentMonth = new Date().toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'short' 
    });
    
    const baselineData = {
      month: currentMonth,
      predictedARR: forecast.currentARR,
      atRiskARR: forecast.totalAtRisk,
      expansionARR: 0,
      netChange: 0,
      confidence: 100,
      isBaseline: true,
    };
    
    return [
      baselineData,
      ...forecast.forecasts.map(f => ({
        ...f,
        isBaseline: false,
      })),
    ];
  }, [forecast]);
  
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload || !payload.length) return null;
    
    const data = payload[0]?.payload;
    if (!data) return null;
    
    return (
      <div className="forecast-tooltip">
        <div className="tooltip-header">
          <span className="tooltip-month">{label}</span>
          {!data.isBaseline && (
            <span className="tooltip-confidence">
              {data.confidence}% confidence
            </span>
          )}
        </div>
        
        <div className="tooltip-metrics">
          <div className="tooltip-metric primary">
            <span className="metric-label">Predicted ARR</span>
            <span className="metric-value">{formatCurrencyFull(data.predictedARR)}</span>
          </div>
          
          {showAtRisk && data.atRiskARR > 0 && (
            <div className="tooltip-metric at-risk">
              <span className="metric-label">At Risk</span>
              <span className="metric-value danger">{formatCurrencyFull(data.atRiskARR)}</span>
            </div>
          )}
          
          {showExpansion && data.expansionARR > 0 && (
            <div className="tooltip-metric expansion">
              <span className="metric-label">Expansion</span>
              <span className="metric-value success">+{formatCurrencyFull(data.expansionARR)}</span>
            </div>
          )}
          
          {!data.isBaseline && (
            <>
              <div className="tooltip-metric">
                <span className="metric-label">Expected Churn</span>
                <span className="metric-value">{formatCurrencyFull(data.churnedARR)}</span>
              </div>
              
              <div className={`tooltip-metric net-change ${data.netChange >= 0 ? 'positive' : 'negative'}`}>
                <span className="metric-label">Net Change</span>
                <span className="metric-value">
                  {data.netChange >= 0 ? '+' : ''}{formatCurrencyFull(data.netChange)}
                </span>
              </div>
            </>
          )}
        </div>
      </div>
    );
  };
  
  if (variant === 'compact') {
    return (
      <div className="forecast-chart compact">
        <ResponsiveContainer width="100%" height={height}>
          <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="arrGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#6366f1" stopOpacity={0.4} />
                <stop offset="100%" stopColor="#6366f1" stopOpacity={0.05} />
              </linearGradient>
            </defs>
            <XAxis 
              dataKey="month" 
              tick={{ fill: 'var(--text-muted)', fontSize: 10 }}
              tickLine={false}
              axisLine={false}
            />
            <YAxis 
              tickFormatter={formatCurrency}
              tick={{ fill: 'var(--text-muted)', fontSize: 10 }}
              tickLine={false}
              axisLine={false}
              width={60}
            />
            <Tooltip content={<CustomTooltip />} />
            <Area
              type="monotone"
              dataKey="predictedARR"
              stroke="#6366f1"
              strokeWidth={2}
              fill="url(#arrGradient)"
              name="Predicted ARR"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    );
  }
  
  return (
    <div className="forecast-chart full">
      <ResponsiveContainer width="100%" height={height}>
        <ComposedChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
          <defs>
            <linearGradient id="arrGradientFull" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#6366f1" stopOpacity={0.5} />
              <stop offset="100%" stopColor="#6366f1" stopOpacity={0.1} />
            </linearGradient>
            <linearGradient id="atRiskGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#ef4444" stopOpacity={0.4} />
              <stop offset="100%" stopColor="#ef4444" stopOpacity={0.1} />
            </linearGradient>
            <linearGradient id="expansionGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#22c55e" stopOpacity={0.6} />
              <stop offset="100%" stopColor="#22c55e" stopOpacity={0.1} />
            </linearGradient>
          </defs>
          
          <CartesianGrid strokeDasharray="3 3" stroke="var(--glass-border)" />
          
          <XAxis 
            dataKey="month" 
            tick={{ fill: 'var(--text-secondary)', fontSize: 12 }}
            tickLine={false}
          />
          <YAxis 
            tickFormatter={formatCurrency}
            tick={{ fill: 'var(--text-secondary)', fontSize: 12 }}
            tickLine={false}
            axisLine={false}
            width={80}
          />
          
          <Tooltip content={<CustomTooltip />} />
          
          <Legend 
            verticalAlign="top"
            height={36}
            wrapperStyle={{ paddingBottom: '10px' }}
          />
          
          {/* Reference line for current ARR */}
          <ReferenceLine 
            y={forecast.currentARR} 
            stroke="var(--text-muted)" 
            strokeDasharray="5 5"
            label={{ 
              value: 'Current ARR', 
              position: 'right',
              fill: 'var(--text-muted)',
              fontSize: 11,
            }}
          />
          
          {/* Main ARR prediction line */}
          <Area
            type="monotone"
            dataKey="predictedARR"
            stroke="#6366f1"
            strokeWidth={3}
            fill="url(#arrGradientFull)"
            name="Predicted ARR"
            dot={{ fill: '#6366f1', strokeWidth: 2, r: 4 }}
            activeDot={{ r: 6, strokeWidth: 2 }}
          />
          
          {/* At-risk revenue bar */}
          {showAtRisk && (
            <Bar
              dataKey="atRiskARR"
              fill="url(#atRiskGradient)"
              stroke="#ef4444"
              strokeWidth={1}
              name="At-Risk ARR"
              barSize={20}
              radius={[4, 4, 0, 0]}
            />
          )}
          
          {/* Expansion opportunity line */}
          {showExpansion && (
            <Line
              type="monotone"
              dataKey="expansionARR"
              stroke="#22c55e"
              strokeWidth={2}
              strokeDasharray="5 5"
              name="Expansion Opportunity"
              dot={{ fill: '#22c55e', strokeWidth: 1, r: 3 }}
            />
          )}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

// ============================================================================
// Forecast Metrics Summary
// ============================================================================

export function ForecastMetrics({ forecast, compact = false }: ForecastMetricsProps) {
  const endOfPeriodARR = forecast.forecasts.length > 0
    ? forecast.forecasts[forecast.forecasts.length - 1].predictedARR
    : forecast.currentARR;
  
  const totalChange = endOfPeriodARR - forecast.currentARR;
  const changePercent = forecast.currentARR > 0
    ? ((totalChange / forecast.currentARR) * 100).toFixed(1)
    : '0';
  
  const atRiskPercent = forecast.currentARR > 0
    ? ((forecast.totalAtRisk / forecast.currentARR) * 100).toFixed(1)
    : '0';
  
  if (compact) {
    return (
      <div className="forecast-metrics compact">
        <div className="forecast-metric-item">
          <span className="metric-value">{formatCurrency(forecast.currentARR)}</span>
          <span className="metric-label">Current ARR</span>
        </div>
        <div className={`forecast-metric-item ${totalChange >= 0 ? 'positive' : 'negative'}`}>
          <span className="metric-value">
            {totalChange >= 0 ? '+' : ''}{changePercent}%
          </span>
          <span className="metric-label">6mo Forecast</span>
        </div>
        <div className="forecast-metric-item at-risk">
          <span className="metric-value">{formatCurrency(forecast.totalAtRisk)}</span>
          <span className="metric-label">At Risk</span>
        </div>
      </div>
    );
  }
  
  return (
    <div className="forecast-metrics full">
      <div className="forecast-metrics-grid">
        <div className="forecast-metric-card glass-card">
          <div className="metric-icon">💰</div>
          <div className="metric-content">
            <span className="metric-label">Current ARR</span>
            <span className="metric-value primary">{formatCurrency(forecast.currentARR)}</span>
          </div>
        </div>
        
        <div className={`forecast-metric-card glass-card ${totalChange >= 0 ? 'positive' : 'negative'}`}>
          <div className="metric-icon">{totalChange >= 0 ? '📈' : '📉'}</div>
          <div className="metric-content">
            <span className="metric-label">Projected Change (6mo)</span>
            <span className={`metric-value ${totalChange >= 0 ? 'success' : 'danger'}`}>
              {totalChange >= 0 ? '+' : ''}{formatCurrency(totalChange)}
            </span>
            <span className="metric-sub">
              {totalChange >= 0 ? '+' : ''}{changePercent}%
            </span>
          </div>
        </div>
        
        <div className="forecast-metric-card glass-card at-risk">
          <div className="metric-icon">⚠️</div>
          <div className="metric-content">
            <span className="metric-label">ARR at Risk</span>
            <span className="metric-value danger">{formatCurrency(forecast.totalAtRisk)}</span>
            <span className="metric-sub">{atRiskPercent}% of portfolio</span>
          </div>
        </div>
        
        <div className="forecast-metric-card glass-card expansion">
          <div className="metric-icon">🚀</div>
          <div className="metric-content">
            <span className="metric-label">Expansion Pipeline</span>
            <span className="metric-value success">
              +{formatCurrency(forecast.totalExpansionOpportunity)}
            </span>
            <span className="metric-sub">Potential upsell</span>
          </div>
        </div>
      </div>
      
      <div className="forecast-confidence">
        <span className="confidence-label">Forecast Confidence:</span>
        <div className="confidence-bar">
          <div 
            className="confidence-fill" 
            style={{ width: `${forecast.confidence}%` }}
          />
        </div>
        <span className="confidence-value">{forecast.confidence}%</span>
      </div>
    </div>
  );
}

// ============================================================================
// Monthly Breakdown Table
// ============================================================================

interface ForecastTableProps {
  forecasts: RevenueForecast[];
}

export function ForecastTable({ forecasts }: ForecastTableProps) {
  return (
    <div className="forecast-table-container">
      <table className="forecast-table">
        <thead>
          <tr>
            <th>Month</th>
            <th>Predicted ARR</th>
            <th>At Risk</th>
            <th>Expansion</th>
            <th>Renewals</th>
            <th>Churn</th>
            <th>Net Change</th>
            <th>Confidence</th>
          </tr>
        </thead>
        <tbody>
          {forecasts.map((f, index) => (
            <tr key={f.month} className={index % 2 === 0 ? 'even' : 'odd'}>
              <td className="month-cell">{f.month}</td>
              <td className="arr-cell">{formatCurrency(f.predictedARR)}</td>
              <td className="risk-cell">
                <span className="risk-value">{formatCurrency(f.atRiskARR)}</span>
              </td>
              <td className="expansion-cell">
                <span className="expansion-value">+{formatCurrency(f.expansionARR)}</span>
              </td>
              <td className="renewal-cell">{formatCurrency(f.renewalARR)}</td>
              <td className="churn-cell">
                <span className="churn-value">-{formatCurrency(f.churnedARR)}</span>
              </td>
              <td className={`change-cell ${f.netChange >= 0 ? 'positive' : 'negative'}`}>
                {f.netChange >= 0 ? '+' : ''}{formatCurrency(f.netChange)}
              </td>
              <td className="confidence-cell">
                <div className="confidence-indicator">
                  <div 
                    className="confidence-bar-mini"
                    style={{ width: `${f.confidence}%` }}
                  />
                  <span>{f.confidence}%</span>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ============================================================================
// Churn Risk Distribution Chart
// ============================================================================

interface ChurnDistributionProps {
  data: {
    criticalCount: number;
    highCount: number;
    mediumCount: number;
    lowCount: number;
    totalARRAtRisk: number;
  };
  height?: number;
}

export function ChurnDistributionChart({ data, height = 200 }: ChurnDistributionProps) {
  const chartData = [
    { name: 'Critical', value: data.criticalCount, color: '#ef4444' },
    { name: 'High', value: data.highCount, color: '#f97316' },
    { name: 'Medium', value: data.mediumCount, color: '#f59e0b' },
    { name: 'Low', value: data.lowCount, color: '#22c55e' },
  ].filter(d => d.value > 0);
  
  return (
    <div className="churn-distribution-chart">
      <ResponsiveContainer width="100%" height={height}>
        <BarChart data={chartData} layout="vertical" margin={{ left: 20, right: 20 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--glass-border)" horizontal={false} />
          <XAxis type="number" tick={{ fill: 'var(--text-muted)', fontSize: 11 }} />
          <YAxis 
            type="category" 
            dataKey="name" 
            tick={{ fill: 'var(--text-secondary)', fontSize: 12 }}
            width={60}
          />
          <Tooltip
            formatter={(value: number) => [`${value} accounts`, 'Count']}
            contentStyle={{
              background: 'var(--bg-card)',
              border: '1px solid var(--glass-border)',
              borderRadius: 'var(--radius-md)',
            }}
          />
          <Bar dataKey="value" radius={[0, 4, 4, 0]}>
            {chartData.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.color} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      
      <div className="churn-summary">
        <span className="churn-summary-label">Total ARR at Risk:</span>
        <span className="churn-summary-value">{formatCurrency(data.totalARRAtRisk)}</span>
      </div>
    </div>
  );
}

export default ForecastChart;
