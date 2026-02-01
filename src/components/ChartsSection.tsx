import { memo, useMemo } from 'react';
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
import type { CustomerMetrics } from '../lib/arda-client';

interface ChartsSectionProps {
  metrics: CustomerMetrics[];
}

// Shared tooltip styles
const tooltipStyle = {
  background: 'rgba(18, 18, 26, 0.95)',
  border: '1px solid rgba(255,255,255,0.1)',
  borderRadius: '8px',
};

// Shared axis styles
const axisTickStyle = { fill: 'rgba(255,255,255,0.5)', fontSize: 11 };
const axisLineStyle = { stroke: 'rgba(255,255,255,0.1)' };

/**
 * Dashboard charts section.
 * Contains funnel, activity, stage distribution, and health charts.
 */
export const ChartsSection = memo(function ChartsSection({ 
  metrics 
}: ChartsSectionProps) {
  // Memoize stage data calculation
  const stageData = useMemo(() => {
    const stageCounts = {
      signed: metrics.filter((c) => c.stage === 'signed').length,
      deployed: metrics.filter((c) => c.stage === 'deployed').length,
      training: metrics.filter((c) => c.stage === 'training').length,
      live: metrics.filter((c) => c.stage === 'live').length,
    };
    
    return [
      { name: 'Signed', value: stageCounts.signed, color: '#818cf8' },
      { name: 'Deployed', value: stageCounts.deployed, color: '#60a5fa' },
      { name: 'Training', value: stageCounts.training, color: '#fbbf24' },
      { name: 'Live', value: stageCounts.live, color: '#34d399' },
    ];
  }, [metrics]);
  
  // Memoize activity data for bar chart - limit to 8 customers for readability
  const activityData = useMemo(() => 
    metrics.slice(0, 8).map((c) => ({
      name: (c.displayName || c.tenantName).substring(0, 12),
      items: c.itemCount,
      kanban: c.kanbanCardCount,
      orders: c.orderCount,
    })),
    [metrics]
  );
  
  // Memoize health distribution data
  const healthData = useMemo(() => 
    [...metrics]
      .sort((a, b) => b.healthScore - a.healthScore)
      .map((c, i) => ({ name: `#${i + 1}`, score: c.healthScore })),
    [metrics]
  );
  
  // Calculate max stage value for funnel sizing
  const maxStageValue = useMemo(() => 
    Math.max(...stageData.map(s => s.value || 1)),
    [stageData]
  );
  
  return (
    <div className="charts-grid">
      {/* Onboarding Funnel */}
      <div className="glass-card chart-card">
        <h3>📊 Onboarding Funnel</h3>
        <div className="funnel-container">
          {stageData.map((stage) => (
            <div key={stage.name} className="funnel-stage">
              <div className="funnel-label">
                <span>{stage.name}</span>
              </div>
              <div
                className="funnel-bar"
                style={{
                  width: `${Math.max(40, (stage.value / maxStageValue) * 200)}px`,
                  background: stage.color,
                }}
              />
              <span className="funnel-count">{stage.value}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Activity by Customer - Full Width */}
      <div className="activity-chart-container">
        <div className="glass-card chart-card">
          <h3>📈 Activity by Customer</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={activityData} margin={{ top: 10, right: 30, left: 10, bottom: 60 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.08)" />
              <XAxis 
                dataKey="name" 
                tick={{ fill: '#374151', fontSize: 12, fontWeight: 500 }}
                axisLine={{ stroke: '#e5e7eb' }}
                angle={-35}
                textAnchor="end"
                height={60}
                interval={0}
              />
              <YAxis 
                tick={{ fill: '#374151', fontSize: 11 }}
                axisLine={{ stroke: '#e5e7eb' }}
              />
              <Tooltip contentStyle={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: '8px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }} />
              <Bar dataKey="items" fill="#FC5928" name="Items" radius={[4, 4, 0, 0]} barSize={40} />
              <Bar dataKey="kanban" fill="#3b82f6" name="Kanban" radius={[4, 4, 0, 0]} barSize={40} />
              <Bar dataKey="orders" fill="#22c55e" name="Orders" radius={[4, 4, 0, 0]} barSize={40} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Stage Distribution */}
      <div className="glass-card chart-card">
        <h3>🎯 Stage Distribution</h3>
        <ResponsiveContainer width="100%" height={250}>
          <PieChart>
            <Pie
              data={stageData}
              cx="50%"
              cy="50%"
              innerRadius={60}
              outerRadius={100}
              paddingAngle={2}
              dataKey="value"
            >
              {stageData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip contentStyle={tooltipStyle} />
          </PieChart>
        </ResponsiveContainer>
      </div>

      {/* Health Distribution */}
      <div className="glass-card chart-card">
        <h3>❤️ Health Distribution</h3>
        <ResponsiveContainer width="100%" height={250}>
          <AreaChart data={healthData}>
            <defs>
              <linearGradient id="healthGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#10b981" stopOpacity={0.8} />
                <stop offset="50%" stopColor="#f59e0b" stopOpacity={0.5} />
                <stop offset="100%" stopColor="#ef4444" stopOpacity={0.2} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
            <XAxis 
              dataKey="name" 
              tick={axisTickStyle}
              axisLine={axisLineStyle}
            />
            <YAxis 
              domain={[0, 100]}
              tick={axisTickStyle}
              axisLine={axisLineStyle}
            />
            <Tooltip contentStyle={tooltipStyle} />
            <Area
              type="monotone"
              dataKey="score"
              stroke="#10b981"
              fill="url(#healthGradient)"
              name="Health Score"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
});

export default ChartsSection;
