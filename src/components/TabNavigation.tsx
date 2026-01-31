import { NavLink } from 'react-router-dom';

export function TabNavigation() {
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
    </nav>
  );
}
