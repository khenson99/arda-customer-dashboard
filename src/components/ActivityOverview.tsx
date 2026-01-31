import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { fetchActivityAggregate, type ActivityAggregate } from '../lib/arda-client';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { TabNavigation } from './TabNavigation';

type TimeRange = 7 | 30 | 90;

export function ActivityOverview() {
  const [days, setDays] = useState<TimeRange>(30);

  const { data, isLoading, error } = useQuery<ActivityAggregate>({
    queryKey: ['activityAggregate', days],
    queryFn: () => fetchActivityAggregate({ days }),
    staleTime: 1000 * 60 * 2, // 2 minutes
  });

  if (error) {
    return (
      <div className="dashboard">
        <TabNavigation />
        <div className="dashboard-content">
          <div className="error-message">
            Failed to load activity data. Please try again.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="dashboard">
      <TabNavigation />
      
      <div className="dashboard-content">
        <header className="dashboard-header">
          <div>
            <h1>Activity Overview</h1>
            <p className="subtitle">Platform activity trends across all customers</p>
          </div>
          
          <div className="time-selector">
            {([7, 30, 90] as TimeRange[]).map((d) => (
              <button
                key={d}
                className={`time-button ${days === d ? 'active' : ''}`}
                onClick={() => setDays(d)}
              >
                {d}d
              </button>
            ))}
          </div>
        </header>

        {isLoading ? (
          <div className="loading-state">
            <div className="loading-spinner" />
            <p>Loading activity data...</p>
          </div>
        ) : data ? (
          <>
            {/* Stacked Area Chart */}
            <div className="glass-card chart-card">
              <h3>Platform Activity ({days} Days)</h3>
              <div style={{ height: 350 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={data.timeline} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="itemsGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#FC5928" stopOpacity={0.8} />
                        <stop offset="95%" stopColor="#FC5928" stopOpacity={0.1} />
                      </linearGradient>
                      <linearGradient id="cardsGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.8} />
                        <stop offset="95%" stopColor="#3B82F6" stopOpacity={0.1} />
                      </linearGradient>
                      <linearGradient id="ordersGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#22C55E" stopOpacity={0.8} />
                        <stop offset="95%" stopColor="#22C55E" stopOpacity={0.1} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.1)" />
                    <XAxis 
                      dataKey="date" 
                      tickFormatter={(date) => new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      stroke="#64748b"
                      fontSize={12}
                    />
                    <YAxis stroke="#64748b" fontSize={12} />
                    <Tooltip 
                      contentStyle={{
                        backgroundColor: 'white',
                        border: '1px solid #e2e8f0',
                        borderRadius: '8px',
                        boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
                      }}
                      labelFormatter={(date) => new Date(date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                    />
                    <Legend />
                    <Area
                      type="monotone"
                      dataKey="items"
                      name="Items Added"
                      stackId="1"
                      stroke="#FC5928"
                      fill="url(#itemsGradient)"
                    />
                    <Area
                      type="monotone"
                      dataKey="cards"
                      name="Cards Created"
                      stackId="1"
                      stroke="#3B82F6"
                      fill="url(#cardsGradient)"
                    />
                    <Area
                      type="monotone"
                      dataKey="orders"
                      name="Orders Placed"
                      stackId="1"
                      stroke="#22C55E"
                      fill="url(#ordersGradient)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Customer Breakdown Table */}
            <div className="glass-card customer-table-container">
              <h3>Activity by Customer</h3>
              <table className="customer-table activity-table">
                <thead>
                  <tr>
                    <th>Customer</th>
                    <th>Trend</th>
                    <th>Items</th>
                    <th>Cards</th>
                    <th>Orders</th>
                    <th>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {data.byCustomer.map((customer) => (
                    <tr key={customer.tenantId} className="customer-row">
                      <td>
                        <Link to={`/account/${customer.tenantId}`} className="customer-link">
                          {customer.tenantName}
                        </Link>
                      </td>
                      <td>
                        <MiniSparkline data={customer.trend} />
                      </td>
                      <td className="metric-cell">{customer.items}</td>
                      <td className="metric-cell">{customer.cards}</td>
                      <td className="metric-cell">{customer.orders}</td>
                      <td className="metric-cell total">{customer.total}</td>
                    </tr>
                  ))}
                  {data.byCustomer.length === 0 && (
                    <tr>
                      <td colSpan={6} style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
                        No activity in this time period
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}

// Mini sparkline for the activity table
function MiniSparkline({ data }: { data: number[] }) {
  const max = Math.max(...data, 1);
  const hasActivity = data.some(d => d > 0);

  if (!hasActivity) {
    return <span className="sparkline-empty">—</span>;
  }

  return (
    <svg className="mini-sparkline" viewBox="0 0 70 20" preserveAspectRatio="none">
      <defs>
        <linearGradient id="miniSparkGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#FC5928" stopOpacity="0.8" />
          <stop offset="100%" stopColor="#FC5928" stopOpacity="0.1" />
        </linearGradient>
      </defs>
      <path
        d={`M 0 ${20 - (data[0] / max) * 18} ${data.map((d, i) => `L ${(i / (data.length - 1)) * 70} ${20 - (d / max) * 18}`).join(' ')} L 70 20 L 0 20 Z`}
        fill="url(#miniSparkGrad)"
      />
      <path
        d={`M 0 ${20 - (data[0] / max) * 18} ${data.map((d, i) => `L ${(i / (data.length - 1)) * 70} ${20 - (d / max) * 18}`).join(' ')}`}
        fill="none"
        stroke="#FC5928"
        strokeWidth="1.5"
      />
    </svg>
  );
}
