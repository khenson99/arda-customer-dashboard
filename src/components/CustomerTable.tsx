import { memo, useCallback, useState, useEffect } from 'react';
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
 * Responsive: Shows card view on mobile, table on desktop.
 */
export const CustomerTable = memo(function CustomerTable({ 
  customers 
}: CustomerTableProps) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [isMobile, setIsMobile] = useState(false);
  
  // Detect mobile viewport
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);
  
  const handleRowClick = useCallback((e: React.MouseEvent, tenantId: string) => {
    // Don't navigate if clicking on editable name input
    if ((e.target as HTMLElement).tagName === 'INPUT') return;
    navigate(`/account/${tenantId}`);
  }, [navigate]);
  
  const handleSave = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['customerMetrics'] });
  }, [queryClient]);
  
  // Mobile card view
  if (isMobile) {
    return (
      <div className="customer-cards-container">
        {customers.length === 0 ? (
          <div className="empty-state fade-in">
            <div className="empty-state-icon">👥</div>
            <p className="empty-state-title">No customers found</p>
            <p className="empty-state-description">
              Customers will appear here once they start using your product.
            </p>
          </div>
        ) : (
          customers.map((customer, index) => (
            <CustomerCard 
              key={customer.tenantId}
              customer={customer}
              onCardClick={handleRowClick}
              onSave={handleSave}
              animationDelay={index * 50}
            />
          ))
        )}
      </div>
    );
  }
  
  // Desktop table view
  return (
    <div className="glass-card customer-table-container no-hover-transform">
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
 * Individual customer row component for desktop table view.
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

interface CustomerCardProps {
  customer: CustomerMetrics;
  onCardClick: (e: React.MouseEvent, tenantId: string) => void;
  onSave: () => void;
  animationDelay?: number;
}

/**
 * Mobile-friendly customer card component.
 * Shows key metrics in a touch-friendly card layout.
 */
const CustomerCard = memo(function CustomerCard({
  customer,
  onCardClick,
  onSave,
  animationDelay = 0,
}: CustomerCardProps) {
  return (
    <div 
      className="customer-card glass-card fade-in-up"
      style={{ animationDelay: `${animationDelay}ms` }}
      onClick={(e) => onCardClick(e, customer.tenantId)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onCardClick(e as unknown as React.MouseEvent, customer.tenantId);
        }
      }}
    >
      {/* Card Header */}
      <div className="customer-card-header">
        <div className="customer-card-identity">
          <div className="customer-card-avatar avatar avatar-md avatar-primary">
            {customer.displayName?.charAt(0) || 'C'}
          </div>
          <div className="customer-card-info">
            <EditableName 
              tenantId={customer.tenantId}
              displayName={customer.displayName}
              onSave={onSave}
            />
            <div className="customer-card-badges">
              {customer.tier && (
                <span className={`tier-badge ${customer.tier}`}>
                  {customer.tier}
                </span>
              )}
              <span className={`lifecycle-badge ${customer.lifecycleStage}`}>
                {customer.lifecycleStage}
              </span>
            </div>
          </div>
        </div>
        <div className="customer-card-health">
          <HealthScore score={customer.healthScore} />
        </div>
      </div>
      
      {/* Card Metrics Grid */}
      <div className="customer-card-metrics">
        <div className="customer-card-metric">
          <span className="metric-value">{customer.itemCount}</span>
          <span className="metric-label">Items</span>
        </div>
        <div className="customer-card-metric">
          <span className="metric-value">{customer.kanbanCardCount}</span>
          <span className="metric-label">Kanban</span>
        </div>
        <div className="customer-card-metric">
          <span className="metric-value">{customer.orderCount}</span>
          <span className="metric-label">Orders</span>
        </div>
        <div className="customer-card-metric">
          <span className="metric-value">{customer.userCount}</span>
          <span className="metric-label">Users</span>
        </div>
      </div>
      
      {/* Card Footer */}
      <div className="customer-card-footer">
        <div className="customer-card-meta">
          <span className={`stage-badge ${customer.stage}`}>
            {customer.stage}
          </span>
          <span className="customer-card-age">{customer.accountAgeDays}d old</span>
        </div>
        {customer.assignedCSM && (
          <span className="customer-card-csm">
            CSM: {customer.assignedCSM}
          </span>
        )}
      </div>
      
      {/* Engagement Sparkline */}
      <div className="customer-card-engagement">
        <span className="engagement-label">Engagement</span>
        <Sparkline data={customer.activityTimeline} />
      </div>
    </div>
  );
});

export default CustomerTable;
