import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
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
} from 'recharts';
import { fetchCustomerDetails, CustomerDetails, saveInteraction, getStoredInteractions, Interaction } from '../lib/arda-client';
import { resolveTenantName, getTenantInfo } from '../lib/tenant-names';

export function CustomerDetail() {
  const { tenantId } = useParams<{ tenantId: string }>();
  const queryClient = useQueryClient();
  
  // Interaction form state
  const [interactionType, setInteractionType] = useState<'call' | 'email' | 'meeting' | 'note'>('note');
  const [interactionSummary, setInteractionSummary] = useState('');
  const [interactionNextAction, setInteractionNextAction] = useState('');
  const [interactions, setInteractions] = useState<Interaction[]>(getStoredInteractions(tenantId || ''));
  
  const { data: customer, isLoading, error } = useQuery({
    queryKey: ['customerDetails', tenantId],
    queryFn: () => fetchCustomerDetails(tenantId!),
    enabled: !!tenantId,
  });

  const handleAddInteraction = () => {
    if (!interactionSummary.trim() || !tenantId) return;
    
    const newInteraction: Interaction = {
      id: crypto.randomUUID(),
      date: new Date().toISOString(),
      type: interactionType,
      summary: interactionSummary,
      nextAction: interactionNextAction || undefined,
      createdBy: 'CSM',
    };
    
    saveInteraction(tenantId, newInteraction);
    setInteractions(getStoredInteractions(tenantId));
    setInteractionSummary('');
    setInteractionNextAction('');
    
    // Refresh metrics to get updated interaction count
    queryClient.invalidateQueries({ queryKey: ['customerMetrics'] });
  };

  if (isLoading) {
    return (
      <div className="loading">
        <div className="loading-spinner" />
        <p className="loading-text">Loading customer details...</p>
      </div>
    );
  }

  if (error || !customer) {
    return (
      <div className="error">
        <div className="error-icon">⚠️</div>
        <p className="error-message">Failed to load customer details</p>
        <Link to="/" className="back-link">← Back to Dashboard</Link>
      </div>
    );
  }

  // Build activity timeline data (by week)
  const activityTimeline = buildActivityTimeline(customer);

  return (
    <div className="customer-detail">
      <header className="detail-header">
        <Link to="/" className="back-link">← Back to Dashboard</Link>
        <h1>{resolveTenantName(tenantId!) || customer.companyName}</h1>
        <p className="tenant-info">
          <span className={`stage-badge ${customer.stage}`}>{customer.stage}</span>
          {getTenantInfo(tenantId!)?.tier && (
            <span className={`tier-badge ${getTenantInfo(tenantId!)?.tier}`}>{getTenantInfo(tenantId!)?.tier}</span>
          )}
          {getTenantInfo(tenantId!)?.csm && (
            <span className="plan-badge">CSM: {getTenantInfo(tenantId!)?.csm}</span>
          )}
          <span className="plan-badge">{customer.plan}</span>
          <span className="status-badge">{customer.status}</span>
        </p>
      </header>

      {/* Summary Stats */}
      <div className="metrics-grid detail-metrics">
        <div className="glass-card metric-card">
          <div className="label">Items</div>
          <div className="value">{customer.items.length}</div>
        </div>
        <div className="glass-card metric-card">
          <div className="label">Kanban Cards</div>
          <div className="value">{customer.kanbanCards.length}</div>
        </div>
        <div className="glass-card metric-card">
          <div className="label">Users</div>
          <div className="value">{customer.users.length}</div>
        </div>
        <div className="glass-card metric-card">
          <div className="label">Health Score</div>
          <div className="value">{customer.healthScore}</div>
        </div>
      </div>

      {/* Activity Timeline Chart */}
      <div className="glass-card chart-card detail-chart">
        <h3>📈 Activity Over Time</h3>
        <ResponsiveContainer width="100%" height={300}>
          <AreaChart data={activityTimeline}>
            <defs>
              <linearGradient id="activityGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#6366f1" stopOpacity={0.8} />
                <stop offset="100%" stopColor="#6366f1" stopOpacity={0.1} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
            <XAxis 
              dataKey="week" 
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
            <Area
              type="monotone"
              dataKey="activity"
              stroke="#6366f1"
              fill="url(#activityGradient)"
              name="Activity"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Users List */}
      <div className="glass-card detail-section">
        <h3>👥 Users ({customer.users.length})</h3>
        <div className="users-list">
          {customer.users.length === 0 ? (
            <p className="empty-state">No users found for this tenant</p>
          ) : (
            <table className="detail-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {customer.users.map((user) => (
                  <tr key={user.id}>
                    <td>{user.name}</td>
                    <td>{user.email}</td>
                    <td>
                      <span className="status-dot active" />
                      Active
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Items List */}
      <div className="glass-card detail-section">
        <h3>📦 Items ({customer.items.length})</h3>
        <div className="items-grid">
          {customer.items.length === 0 ? (
            <p className="empty-state">No items found for this tenant</p>
          ) : (
            customer.items.map((item) => (
              <div key={item.id} className="item-card">
                <div className="item-name">{item.name}</div>
                <div className="item-sku">{item.sku || 'No SKU'}</div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Kanban Cards */}
      <div className="glass-card detail-section">
        <h3>📋 Kanban Cards ({customer.kanbanCards.length})</h3>
        <div className="kanban-grid">
          {customer.kanbanCards.length === 0 ? (
            <p className="empty-state">No kanban cards found for this tenant</p>
          ) : (
            <div className="kanban-summary">
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={groupByStatus(customer.kanbanCards)}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                  <XAxis 
                    dataKey="status" 
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
                  <Bar dataKey="count" fill="#8b5cf6" name="Cards" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>

      {/* CSM Interactions */}
      <div className="glass-card detail-section interaction-section">
        <h3>📝 Interactions ({interactions.length})</h3>

        {/* Add interaction form */}
        <div className="interaction-form">
          <div className="interaction-form-row">
            <select
              value={interactionType}
              onChange={(e) => setInteractionType(e.target.value as 'call' | 'email' | 'meeting' | 'note')}
            >
              <option value="note">📝 Note</option>
              <option value="call">📞 Call</option>
              <option value="email">📧 Email</option>
              <option value="meeting">🤝 Meeting</option>
            </select>
          </div>
          <textarea
            placeholder="Summary of interaction..."
            value={interactionSummary}
            onChange={(e) => setInteractionSummary(e.target.value)}
          />
          <input
            type="text"
            placeholder="Next action (optional)"
            value={interactionNextAction}
            onChange={(e) => setInteractionNextAction(e.target.value)}
          />
          <button onClick={handleAddInteraction}>Log Interaction</button>
        </div>

        {/* Interaction history */}
        <div className="interaction-list">
          {interactions.length === 0 ? (
            <p className="empty-state">No interactions logged yet</p>
          ) : (
            interactions.map((interaction) => (
              <div key={interaction.id} className="interaction-item">
                <div className="interaction-item-header">
                  <span className="interaction-type">
                    {interaction.type === 'call' ? '📞' : interaction.type === 'email' ? '📧' : interaction.type === 'meeting' ? '🤝' : '📝'}
                    {interaction.type}
                  </span>
                  <span className="interaction-date">
                    {new Date(interaction.date).toLocaleDateString()}
                  </span>
                </div>
                <p className="interaction-summary">{interaction.summary}</p>
                {interaction.nextAction && (
                  <p className="interaction-next-action">⚡ Next: {interaction.nextAction}</p>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

// Helper functions
function buildActivityTimeline(customer: CustomerDetails) {
  // Group all activity by week
  const allDates = [
    ...customer.items.map(i => i.createdAt),
    ...customer.kanbanCards.map(k => k.createdAt),
  ].filter(Boolean);

  if (allDates.length === 0) {
    return [{ week: 'No data', activity: 0 }];
  }

  const weeks = new Map<string, number>();
  allDates.forEach(dateStr => {
    const date = new Date(dateStr);
    const weekStart = new Date(date);
    weekStart.setDate(date.getDate() - date.getDay());
    const weekKey = weekStart.toISOString().split('T')[0];
    weeks.set(weekKey, (weeks.get(weekKey) || 0) + 1);
  });

  return Array.from(weeks.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-12) // Last 12 weeks
    .map(([week, activity]) => ({ 
      week: new Date(week).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }), 
      activity 
    }));
}

function groupByStatus(kanbanCards: CustomerDetails['kanbanCards']) {
  const statusCounts = new Map<string, number>();
  kanbanCards.forEach(card => {
    const status = card.status || 'Unknown';
    statusCounts.set(status, (statusCounts.get(status) || 0) + 1);
  });
  
  return Array.from(statusCounts.entries()).map(([status, count]) => ({
    status,
    count,
  }));
}

export default CustomerDetail;
