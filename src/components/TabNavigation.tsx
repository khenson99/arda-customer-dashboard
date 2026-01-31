import { useState, useEffect, useCallback } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { fetchCustomerMetrics } from '../lib/arda-client';

export function TabNavigation() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const location = useLocation();
  
  const { data: metrics } = useQuery({
    queryKey: ['nav-alerts'],
    queryFn: fetchCustomerMetrics,
    staleTime: 60_000,
  });

  const criticalAlerts =
    metrics?.reduce((sum, m) => sum + (m.alerts?.filter(a => a.severity === 'critical').length || 0), 0) || 0;

  // Close mobile menu on route change
  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [location.pathname]);

  // Close mobile menu on escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsMobileMenuOpen(false);
      }
    };
    
    if (isMobileMenuOpen) {
      document.addEventListener('keydown', handleEscape);
      // Prevent body scroll when menu is open
      document.body.style.overflow = 'hidden';
    }
    
    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = '';
    };
  }, [isMobileMenuOpen]);

  const toggleMobileMenu = useCallback(() => {
    setIsMobileMenuOpen(prev => !prev);
  }, []);

  const handleOverlayClick = useCallback(() => {
    setIsMobileMenuOpen(false);
  }, []);

  return (
    <>
      {/* Mobile menu overlay */}
      <div 
        className={`mobile-nav-overlay ${isMobileMenuOpen ? 'open' : ''}`}
        onClick={handleOverlayClick}
        aria-hidden="true"
      />
      
      <nav className="tab-navigation" role="navigation" aria-label="Main navigation">
        {/* Logo/Brand for mobile */}
        <div className="nav-brand">
          <span className="nav-logo">Arda</span>
        </div>
        
        {/* Hamburger menu toggle */}
        <button 
          className={`mobile-menu-toggle ${isMobileMenuOpen ? 'open' : ''}`}
          onClick={toggleMobileMenu}
          aria-expanded={isMobileMenuOpen}
          aria-controls="nav-links"
          aria-label={isMobileMenuOpen ? 'Close menu' : 'Open menu'}
        >
          <div className="hamburger">
            <span className="hamburger-line" />
            <span className="hamburger-line" />
            <span className="hamburger-line" />
          </div>
        </button>
        
        {/* Navigation links */}
        <div 
          id="nav-links"
          className={`nav-links ${isMobileMenuOpen ? 'open' : ''}`}
        >
          <NavLink 
            to="/" 
            end
            className={({ isActive }) => `tab-link ${isActive ? 'active' : ''}`}
            onClick={() => setIsMobileMenuOpen(false)}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
              <path d="M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
            <span>Customers</span>
          </NavLink>
          
          <NavLink 
            to="/alerts" 
            className={({ isActive }) => `tab-link ${isActive ? 'active' : ''}`}
            onClick={() => setIsMobileMenuOpen(false)}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
              <line x1="12" y1="9" x2="12" y2="13" />
              <line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
            <span>Alerts</span>
            {criticalAlerts > 0 && (
              <span className="alert-badge" aria-label={`${criticalAlerts} critical alerts`}>
                {criticalAlerts}
              </span>
            )}
          </NavLink>
          
          <NavLink 
            to="/insights" 
            className={({ isActive }) => `tab-link ${isActive ? 'active' : ''}`}
            onClick={() => setIsMobileMenuOpen(false)}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <circle cx="12" cy="12" r="10" />
              <path d="M12 16v-4" />
              <path d="M12 8h.01" />
              <path d="M8 12l2-2 2 2 4-4" />
            </svg>
            <span>Insights</span>
          </NavLink>
          
          <NavLink 
            to="/activity" 
            className={({ isActive }) => `tab-link ${isActive ? 'active' : ''}`}
            onClick={() => setIsMobileMenuOpen(false)}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
            </svg>
            <span>Activity</span>
          </NavLink>
          
          <NavLink 
            to="/feed" 
            className={({ isActive }) => `tab-link ${isActive ? 'active' : ''}`}
            onClick={() => setIsMobileMenuOpen(false)}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <path d="M4 11a9 9 0 0 1 9 9" />
              <path d="M4 4a16 16 0 0 1 16 16" />
              <circle cx="5" cy="19" r="1" />
            </svg>
            <span>Live Feed</span>
          </NavLink>

          <NavLink 
            to="/status" 
            className={({ isActive }) => `tab-link ${isActive ? 'active' : ''}`}
            onClick={() => setIsMobileMenuOpen(false)}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <path d="M3 12h4l3 8 4-16 3 8h4" />
            </svg>
            <span>Status</span>
          </NavLink>
        </div>
      </nav>
    </>
  );
}
