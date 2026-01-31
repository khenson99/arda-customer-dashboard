import { memo, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { EditableName } from './EditableName';
import { HealthScore } from './HealthScore';
import { Sparkline } from './Sparkline';
import type { CustomerMetrics } from '../lib/arda-client';

interface CustomerTableProps {
  customers: CustomerMetrics[];
}

/**
 * Customer data table with clickable rows.
 * Uses memoized row components for performance.
 */
export const CustomerTable = memo(function CustomerTable({ 
  customers 
}: CustomerTableProps) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  
  const handleRowClick = useCallback((e: React.MouseEvent, tenantId: string) => {
    // Don't navigate if clicking on editable name input
    if ((e.target as HTMLElement).tagName === 'INPUT') return;
    navigate(`/account/${tenantId}`);
  }, [navigate]);
  
  const handleSave = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['customerMetrics'] });
  }, [queryClient]);
  
  return (
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
          {customers.map((customer) => (
            <CustomerRow 
              key={customer.tenantId}
              customer={customer}
              onRowClick={handleRowClick}
              onSave={handleSave}
            />
          ))}
          {customers.length === 0 && (
            <tr>
              <td colSpan={10} style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
                No customers found
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
});

interface CustomerRowProps {
  customer: CustomerMetrics;
  onRowClick: (e: React.MouseEvent, tenantId: string) => void;
  onSave: () => void;
}

/**
 * Individual customer row component.
 * Memoized to prevent unnecessary re-renders when other rows change.
 */
const CustomerRow = memo(function CustomerRow({
  customer,
  onRowClick,
  onSave,
}: CustomerRowProps) {
  return (
    <tr 
      className="customer-row clickable-row"
      onClick={(e) => onRowClick(e, customer.tenantId)}
    >
      <td>
        <div className="customer-cell">
          <EditableName 
            tenantId={customer.tenantId}
            displayName={customer.displayName}
            onSave={onSave}
          />
          <Link 
            to={`/account/${customer.tenantId}`} 
            className="customer-link" 
            onClick={(e) => e.stopPropagation()}
          >
            <div className="customer-id">
              {customer.tier && (
                <span className={`tier-badge ${customer.tier}`}>
                  {customer.tier}
                </span>
              )}
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
        <Sparkline data={customer.activityTimeline} />
      </td>
      <td>{customer.itemCount}</td>
      <td>{customer.kanbanCardCount}</td>
      <td>{customer.orderCount}</td>
      <td>{customer.userCount}</td>
      <td>
        <HealthScore score={customer.healthScore} />
      </td>
    </tr>
  );
});

export default CustomerTable;
