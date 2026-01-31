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
  
  // Memoize activity data for bar chart
  const activityData = useMemo(() => 
    metrics.slice(0, 15).map((c) => ({
      name: c.tenantName.substring(0, 12),
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

      {/* Activity by Customer */}
      <div className="glass-card chart-card">
        <h3>📈 Activity by Customer</h3>
        <ResponsiveContainer width="100%" height={250}>
          <BarChart data={activityData}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
            <XAxis 
              dataKey="name" 
              tick={axisTickStyle}
              axisLine={axisLineStyle}
            />
            <YAxis 
              tick={axisTickStyle}
              axisLine={axisLineStyle}
            />
            <Tooltip contentStyle={tooltipStyle} />
            <Bar dataKey="items" fill="#6366f1" name="Items" />
            <Bar dataKey="kanban" fill="#8b5cf6" name="Kanban" />
            <Bar dataKey="orders" fill="#10b981" name="Orders" />
          </BarChart>
        </ResponsiveContainer>
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
