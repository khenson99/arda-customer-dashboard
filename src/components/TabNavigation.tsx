import { NavLink } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { fetchCustomerMetrics } from '../lib/arda-client';

export function TabNavigation() {
  const { data: metrics } = useQuery({
    queryKey: ['nav-alerts'],
    queryFn: fetchCustomerMetrics,
    staleTime: 60_000,
  });

  const criticalAlerts =
    metrics?.reduce((sum, m) => sum + (m.alerts?.filter(a => a.severity === 'critical').length || 0), 0) || 0;

  return (
    <nav className="tab-navigation">
      <NavLink 
        to="/" 
        end
        className={({ isActive }) => `tab-link ${isActive ? 'active' : ''}`}
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
          <circle cx="9" cy="7" r="4" />
          <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
          <path d="M16 3.13a4 4 0 0 1 0 7.75" />
        </svg>
        Customers
      </NavLink>
      
      <NavLink 
        to="/alerts" 
        className={({ isActive }) => `tab-link ${isActive ? 'active' : ''}`}
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
          <line x1="12" y1="9" x2="12" y2="13" />
          <line x1="12" y1="17" x2="12.01" y2="17" />
        </svg>
        Alerts
        {criticalAlerts > 0 && (
          <span className="alert-badge">{criticalAlerts}</span>
        )}
      </NavLink>
      
      <NavLink 
        to="/activity" 
        className={({ isActive }) => `tab-link ${isActive ? 'active' : ''}`}
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
        </svg>
        Activity
      </NavLink>
      
      <NavLink 
        to="/feed" 
        className={({ isActive }) => `tab-link ${isActive ? 'active' : ''}`}
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M4 11a9 9 0 0 1 9 9" />
          <path d="M4 4a16 16 0 0 1 16 16" />
          <circle cx="5" cy="19" r="1" />
        </svg>
        Live Feed
      </NavLink>

      <NavLink 
        to="/status" 
        className={({ isActive }) => `tab-link ${isActive ? 'active' : ''}`}
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M3 12h4l3 8 4-16 3 8h4" />
        </svg>
        Status
      </NavLink>
    </nav>
  );
}
