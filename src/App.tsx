import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { fetchCustomerMetrics } from './lib/arda-client';
import { EditableName } from './components/EditableName';
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

function App() {
  // All hooks must be called at the top, before any conditional returns
  const [selectedCSM, setSelectedCSM] = useState<string>('all');
  const [selectedLifecycle, setSelectedLifecycle] = useState<string>('all');
  const queryClient = useQueryClient();
  
  const { data: customers, isLoading, error } = useQuery({
    queryKey: ['customerMetrics'],
    queryFn: fetchCustomerMetrics,
  });

  if (isLoading) {
    return (
      <div className="loading">
        <div className="loading-spinner" />
        <p className="loading-text">Loading customer data from Arda API...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="error">
        <div className="error-icon">⚠️</div>
        <p className="error-message">Failed to load customer data</p>
        <p className="error-hint">
          Make sure your Arda API key is set. Add VITE_ARDA_API_KEY to your .env file
          or set it in localStorage.
        </p>
      </div>
    );
  }

  const metrics = customers || [];
  
  // Get unique CSMs for filter dropdown
  const uniqueCSMs = [...new Set(metrics.map(c => c.assignedCSM).filter(Boolean))] as string[];
  const uniqueLifecycles = ['onboarding', 'adoption', 'growth', 'mature', 'renewal'];
  
  // Apply filters
  const filteredMetrics = metrics.filter(c => {
    if (selectedCSM !== 'all' && c.assignedCSM !== selectedCSM) return false;
    if (selectedLifecycle !== 'all' && c.lifecycleStage !== selectedLifecycle) return false;
    return true;
  });
  
  // Calculate summary stats from filtered data
  const totalCustomers = filteredMetrics.length;
  const liveCustomers = filteredMetrics.filter((c) => c.stage === 'live').length;
  const avgHealthScore = filteredMetrics.length
    ? Math.round(filteredMetrics.reduce((sum, c) => sum + c.healthScore, 0) / filteredMetrics.length)
    : 0;
  const atRiskCount = filteredMetrics.filter((c) => c.alerts?.some(a => a.type === 'churn_risk')).length;
  const customersWithAlerts = filteredMetrics.filter((c) => c.alerts?.length > 0);

  // Stage distribution for funnel
  const stageCounts = {
    signed: metrics.filter((c) => c.stage === 'signed').length,
    deployed: metrics.filter((c) => c.stage === 'deployed').length,
    training: metrics.filter((c) => c.stage === 'training').length,
    live: metrics.filter((c) => c.stage === 'live').length,
  };

  const stageData = [
    { name: 'Signed', value: stageCounts.signed, color: '#818cf8' },
    { name: 'Deployed', value: stageCounts.deployed, color: '#60a5fa' },
    { name: 'Training', value: stageCounts.training, color: '#fbbf24' },
    { name: 'Live', value: stageCounts.live, color: '#34d399' },
  ];

  // Activity data for charts
  const activityData = metrics.map((c) => ({
    name: c.tenantName.substring(0, 12),
    items: c.itemCount,
    kanban: c.kanbanCardCount,
    orders: c.orderCount,
  }));

  return (
    <div className="dashboard">
      <header className="dashboard-header">
        <div className="header-top">
          <div>
            <h1>Arda Customer Dashboard</h1>
            <p>Track usage, onboarding progress, and customer health</p>
          </div>
          <div className="filter-controls">
            <select 
              value={selectedCSM} 
              onChange={(e) => setSelectedCSM(e.target.value)}
              className="filter-select"
            >
              <option value="all">All CSMs</option>
              {uniqueCSMs.map(csm => (
                <option key={csm} value={csm}>{csm}</option>
              ))}
            </select>
            <select 
              value={selectedLifecycle} 
              onChange={(e) => setSelectedLifecycle(e.target.value)}
              className="filter-select"
            >
              <option value="all">All Lifecycle Stages</option>
              {uniqueLifecycles.map(stage => (
                <option key={stage} value={stage}>{stage.charAt(0).toUpperCase() + stage.slice(1)}</option>
              ))}
            </select>
          </div>
        </div>
      </header>

      {/* Metrics Grid */}
      <div className="metrics-grid">
        <div className="glass-card metric-card">
          <div className="label">Total Customers</div>
          <div className="value">{totalCustomers}</div>
        </div>
        <div className="glass-card metric-card">
          <div className="label">Live Customers</div>
          <div className="value">{liveCustomers}</div>
          <div className="trend up">
            ↑ {totalCustomers > 0 ? Math.round((liveCustomers / totalCustomers) * 100) : 0}% of total
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

      {/* At Risk Section */}
      {customersWithAlerts.length > 0 && (
        <div className="glass-card at-risk-section">
          <h3>⚠️ Attention Required ({customersWithAlerts.length})</h3>
          <div className="alert-cards">
            {customersWithAlerts.slice(0, 5).map((customer) => (
              <Link 
                key={customer.tenantId} 
                to={`/customer/${customer.tenantId}`}
                className="alert-card"
              >
                <div className="alert-card-header">
                  <span className="customer-name">{customer.displayName}</span>
                  <span className="health-badge" data-score={customer.healthScore <= 40 ? 'critical' : 'warning'}>
                    {customer.healthScore}
                  </span>
                </div>
                <div className="alert-list">
                  {customer.alerts.slice(0, 2).map((alert, i) => (
                    <div key={i} className={`alert-item ${alert.severity}`}>
                      <span className="alert-icon">
                        {alert.type === 'churn_risk' ? '🔴' : alert.type === 'onboarding_stalled' ? '🟡' : '🟢'}
                      </span>
                      <span className="alert-message">{alert.message}</span>
                    </div>
                  ))}
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Customer Table */}
      <div className="glass-card customer-table-container">
        <table className="customer-table">
          <thead>
            <tr>
              <th>Customer</th>
              <th>CSM</th>
              <th>Lifecycle</th>
              <th>Stage</th>
              <th>Engagement</th>
              <th>Items</th>
              <th>Kanban</th>
              <th>Orders</th>
              <th>Users</th>
              <th>Health</th>
            </tr>
          </thead>
          <tbody>
            {filteredMetrics.map((customer) => (
              <tr key={customer.tenantId} className="customer-row">
                <td>
                  <div className="customer-cell">
                    <EditableName 
                      tenantId={customer.tenantId}
                      displayName={customer.displayName}
                      onSave={() => queryClient.invalidateQueries({ queryKey: ['customerMetrics'] })}
                    />
                    <Link to={`/customer/${customer.tenantId}`} className="customer-link">
                      <div className="customer-id">
                        {customer.tier && <span className={`tier-badge ${customer.tier}`}>{customer.tier}</span>}
                        {customer.accountAgeDays}d old
                      </div>
                    </Link>
                  </div>
                </td>
                <td>
                  <span className="csm-name">{customer.assignedCSM || '—'}</span>
                </td>
                <td>
                  <span className={`lifecycle-badge ${customer.lifecycleStage}`}>
                    {customer.lifecycleStage}
                  </span>
                </td>
                <td>
                  <span className={`stage-badge ${customer.stage}`}>
                    {customer.stage}
                  </span>
                </td>
                <td>
                  <EngagementSparkline data={customer.activityTimeline} />
                </td>
                <td>{customer.itemCount}</td>
                <td>{customer.kanbanCardCount}</td>
                <td>{customer.orderCount}</td>
                <td>{customer.userCount}</td>
                <td>
                  <HealthScore score={customer.healthScore} />
                </td>
              </tr>
            ))}
            {filteredMetrics.length === 0 && (
              <tr>
                <td colSpan={10} style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
                  No customers found
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Charts */}
      <div className="charts-grid">
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
                    width: `${Math.max(40, (stage.value / Math.max(...stageData.map(s => s.value || 1))) * 200)}px`,
                    background: stage.color,
                  }}
                />
                <span className="funnel-count">{stage.value}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="glass-card chart-card">
          <h3>📈 Activity by Customer</h3>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={activityData}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
              <XAxis 
                dataKey="name" 
                tick={{ fill: 'rgba(255,255,255,0.5)', fontSize: 11 }}
                axisLine={{ stroke: 'rgba(255,255,255,0.1)' }}
              />
              <YAxis 
                tick={{ fill: 'rgba(255,255,255,0.5)', fontSize: 11 }}
                axisLine={{ stroke: 'rgba(255,255,255,0.1)' }}
              />
              <Tooltip 
                contentStyle={{ 
                  background: 'rgba(18, 18, 26, 0.95)', 
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: '8px',
                }}
              />
              <Bar dataKey="items" fill="#6366f1" name="Items" />
              <Bar dataKey="kanban" fill="#8b5cf6" name="Kanban" />
              <Bar dataKey="orders" fill="#10b981" name="Orders" />
            </BarChart>
          </ResponsiveContainer>
        </div>

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
              <Tooltip 
                contentStyle={{ 
                  background: 'rgba(18, 18, 26, 0.95)', 
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: '8px',
                }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div className="glass-card chart-card">
          <h3>❤️ Health Distribution</h3>
          <ResponsiveContainer width="100%" height={250}>
            <AreaChart
              data={metrics
                .sort((a, b) => b.healthScore - a.healthScore)
                .map((c, i) => ({ name: `#${i + 1}`, score: c.healthScore }))}
            >
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
                tick={{ fill: 'rgba(255,255,255,0.5)', fontSize: 11 }}
                axisLine={{ stroke: 'rgba(255,255,255,0.1)' }}
              />
              <YAxis 
                domain={[0, 100]}
                tick={{ fill: 'rgba(255,255,255,0.5)', fontSize: 11 }}
                axisLine={{ stroke: 'rgba(255,255,255,0.1)' }}
              />
              <Tooltip 
                contentStyle={{ 
                  background: 'rgba(18, 18, 26, 0.95)', 
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: '8px',
                }}
              />
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
    </div>
  );
}

function HealthScore({ score }: { score: number }) {
  const level = score >= 70 ? 'healthy' : score >= 40 ? 'at-risk' : 'critical';
  
  return (
    <div className="health-score">
      <div className="health-score-bar">
        <div
          className={`health-score-fill ${level}`}
          style={{ width: `${score}%` }}
        />
      </div>
      <span className="health-score-value">{score}</span>
    </div>
  );
}

// Compact sparkline chart for engagement visualization in table cells
function EngagementSparkline({ data }: { data: Array<{ week: string; activity: number }> }) {
  const hasActivity = data.some(d => d.activity > 0);
  const maxActivity = Math.max(...data.map(d => d.activity), 1);
  
  return (
    <div className="engagement-sparkline">
      <ResponsiveContainer width={80} height={28}>
        <AreaChart data={data} margin={{ top: 2, right: 2, left: 2, bottom: 2 }}>
          <defs>
            <linearGradient id="sparkGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#FC5928" stopOpacity={0.8} />
              <stop offset="100%" stopColor="#FC5928" stopOpacity={0.1} />
            </linearGradient>
          </defs>
          <Area
            type="monotone"
            dataKey="activity"
            stroke="#FC5928"
            strokeWidth={1.5}
            fill="url(#sparkGradient)"
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
      {!hasActivity && (
        <span className="sparkline-empty">—</span>
      )}
    </div>
  );
}

export default App;
