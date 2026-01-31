import { memo } from 'react';

interface MetricsGridProps {
  totalCustomers: number;
  liveCustomers: number;
  avgHealthScore: number;
  atRiskCount: number;
}

/**
 * Summary metrics grid showing key KPIs.
 */
export const MetricsGrid = memo(function MetricsGrid({
  totalCustomers,
  liveCustomers,
  avgHealthScore,
  atRiskCount,
}: MetricsGridProps) {
  const livePercentage = totalCustomers > 0 
    ? Math.round((liveCustomers / totalCustomers) * 100) 
    : 0;
  
  return (
    <div className="metrics-grid">
      <div className="glass-card metric-card">
        <div className="label">Total Customers</div>
        <div className="value">{totalCustomers}</div>
      </div>
      <div className="glass-card metric-card">
        <div className="label">Live Customers</div>
        <div className="value">{liveCustomers}</div>
        <div className="trend up">
          ↑ {livePercentage}% of total
        </div>
      </div>
      <div className="glass-card metric-card">
        <div className="label">Avg Health Score</div>
        <div className="value">{avgHealthScore}</div>
      </div>
      <div className="glass-card metric-card">
        <div className="label">At Risk</div>
        <div className="value">{atRiskCount}</div>
        {atRiskCount > 0 && (
          <div className="trend down">Needs attention</div>
        )}
      </div>
    </div>
  );
});

export default MetricsGrid;
