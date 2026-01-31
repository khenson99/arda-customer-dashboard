import { memo } from 'react';
import { Link } from 'react-router-dom';
import type { CustomerMetrics } from '../lib/arda-client';

interface AlertSectionProps {
  customersWithAlerts: CustomerMetrics[];
}

/**
 * Section displaying customers requiring attention.
 */
export const AlertSection = memo(function AlertSection({ 
  customersWithAlerts 
}: AlertSectionProps) {
  if (customersWithAlerts.length === 0) {
    return null;
  }
  
  return (
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
              <span 
                className="health-badge" 
                data-score={customer.healthScore <= 40 ? 'critical' : 'warning'}
              >
                {customer.healthScore}
              </span>
            </div>
            <div className="alert-list">
              {customer.alerts.slice(0, 2).map((alert, i) => (
                <div key={i} className={`alert-item ${alert.severity}`}>
                  <span className="alert-icon">
                    {alert.type === 'churn_risk' 
                      ? '🔴' 
                      : alert.type === 'onboarding_stalled' 
                        ? '🟡' 
                        : '🟢'}
                  </span>
                  <span className="alert-message">{alert.message}</span>
                </div>
              ))}
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
});

export default AlertSection;
