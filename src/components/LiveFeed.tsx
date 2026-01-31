import { useState, useEffect, useMemo, useRef, useCallback, memo } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useVirtualizer } from '@tanstack/react-virtual';
import { fetchActivityEvents, fetchActivityAggregate, type ActivityEvent } from '../lib/arda-client';
import { TabNavigation } from './TabNavigation';

// Types for filters
interface FeedFilters {
  eventTypes: string[];
  customerSearch: string;
  detailsSearch: string;
  dateRange: { start: Date | null; end: Date | null };
}

// Hook for relative time that updates
function useRelativeTime(timestamp: number) {
  const [, setTick] = useState(0);
  
  useEffect(() => {
    const interval = setInterval(() => setTick(t => t + 1), 60000); // Update every minute
    return () => clearInterval(interval);
  }, []);
  
  return getRelativeTime(timestamp);
}

export function LiveFeed() {
  const [filters, setFilters] = useState<FeedFilters>({
    eventTypes: [],
    customerSearch: '',
    detailsSearch: '',
    dateRange: { start: null, end: null },
  });
  const [expandedEvents, setExpandedEvents] = useState<Set<string>>(new Set());
  const [showNewActivityBanner, setShowNewActivityBanner] = useState(false);
  const [newEventCount, setNewEventCount] = useState(0);
  const previousEventsRef = useRef<string[]>([]);
  const [countdown, setCountdown] = useState(30);
  const [showFilters, setShowFilters] = useState(false);
  const listRef = useRef<HTMLDivElement | null>(null);

  // Main events query
  const { data: events, isLoading, error, refetch, isFetching, dataUpdatedAt } = useQuery<ActivityEvent[]>({
    queryKey: ['activityEvents'],
    queryFn: () => fetchActivityEvents({ limit: 100 }),
    refetchInterval: 30000,
    staleTime: 1000 * 10,
  });

  // Activity aggregate for stats
  const { data: activityStats } = useQuery({
    queryKey: ['activityAggregate', 7],
    queryFn: () => fetchActivityAggregate({ days: 7 }),
    staleTime: 1000 * 60 * 2,
  });

  // Countdown timer
  useEffect(() => {
    const interval = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) return 30;
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // Reset countdown when data updates
  useEffect(() => {
    setCountdown(30);
  }, [dataUpdatedAt]);

  // Detect new events
  useEffect(() => {
    if (events && events.length > 0) {
      const currentIds = events.map(e => e.id);
      const previousIds = previousEventsRef.current;
      
      if (previousIds.length > 0) {
        const newIds = currentIds.filter(id => !previousIds.includes(id));
        if (newIds.length > 0) {
          setNewEventCount(newIds.length);
          setShowNewActivityBanner(true);
        }
      }
      
      previousEventsRef.current = currentIds;
    }
  }, [events]);

  // Filter events
  const filteredEvents = useMemo(() => {
    if (!events) return [];
    
    return events.filter(event => {
      // Filter by event type
      if (filters.eventTypes.length > 0 && !filters.eventTypes.includes(event.type)) {
        return false;
      }
      
      // Filter by customer search
      if (filters.customerSearch) {
        const search = filters.customerSearch.toLowerCase();
        if (!event.tenantName.toLowerCase().includes(search) && 
            !event.tenantId.toLowerCase().includes(search)) {
          return false;
        }
      }
      
      // Filter by details search
      if (filters.detailsSearch) {
        const search = filters.detailsSearch.toLowerCase();
        const detailsStr = JSON.stringify(event.details).toLowerCase();
        if (!detailsStr.includes(search)) {
          return false;
        }
      }
      
      // Filter by date range
      if (filters.dateRange.start && event.timestamp < filters.dateRange.start.getTime()) {
        return false;
      }
      if (filters.dateRange.end && event.timestamp > filters.dateRange.end.getTime() + 86400000) {
        return false;
      }
      
      return true;
    });
  }, [events, filters]);

  const rowVirtualizer = useVirtualizer({
    count: filteredEvents.length,
    getScrollElement: () => listRef.current,
    estimateSize: () => 120,
    overscan: 8,
  });

  // Calculate today's stats
  const todayStats = useMemo(() => {
    if (!events) return { today: 0, yesterday: 0, lastWeek: 0 };
    
    const now = Date.now();
    const todayStart = new Date().setHours(0, 0, 0, 0);
    const yesterdayStart = todayStart - 86400000;
    const lastWeekStart = todayStart - 7 * 86400000;
    
    const today = events.filter(e => e.timestamp >= todayStart).length;
    const yesterday = events.filter(e => e.timestamp >= yesterdayStart && e.timestamp < todayStart).length;
    const lastWeekDaily = events.filter(e => e.timestamp >= lastWeekStart).length / 7;
    
    return { today, yesterday, lastWeek: Math.round(lastWeekDaily) };
  }, [events]);

  // Most active customers today
  const mostActiveToday = useMemo(() => {
    if (!events) return [];
    
    const todayStart = new Date().setHours(0, 0, 0, 0);
    const todayEvents = events.filter(e => e.timestamp >= todayStart);
    
    const customerCounts = new Map<string, { name: string; count: number; id: string }>();
    for (const event of todayEvents) {
      const existing = customerCounts.get(event.tenantId) || { name: event.tenantName, count: 0, id: event.tenantId };
      existing.count++;
      customerCounts.set(event.tenantId, existing);
    }
    
    return Array.from(customerCounts.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
  }, [events]);

  // Event type options
  const eventTypeOptions = [
    { value: 'item_created', label: 'Items Created' },
    { value: 'card_created', label: 'Cards Created' },
    { value: 'card_state_change', label: 'Card State Changes' },
    { value: 'order_placed', label: 'Orders Placed' },
  ];

  // Toggle event expansion
  const toggleExpand = useCallback((eventId: string) => {
    setExpandedEvents(prev => {
      const next = new Set(prev);
      if (next.has(eventId)) {
        next.delete(eventId);
      } else {
        next.add(eventId);
      }
      return next;
    });
  }, []);

  // Dismiss new activity banner
  const dismissBanner = useCallback(() => {
    setShowNewActivityBanner(false);
    setNewEventCount(0);
  }, []);

  // Clear all filters
  const clearFilters = useCallback(() => {
    setFilters({
      eventTypes: [],
      customerSearch: '',
      detailsSearch: '',
      dateRange: { start: null, end: null },
    });
  }, []);

  const hasActiveFilters = filters.eventTypes.length > 0 || 
    filters.customerSearch || 
    filters.detailsSearch || 
    filters.dateRange.start || 
    filters.dateRange.end;

  if (error) {
    return (
      <div className="dashboard">
        <TabNavigation />
        <div className="dashboard-content">
          <div className="error-message">
            Failed to load activity feed. Please try again.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="dashboard">
      <TabNavigation />
      
      <div className="dashboard-content">
        <header className="dashboard-header feed-header">
          <div>
            <h1>Live Feed</h1>
            <p className="subtitle">Real-time platform activity across all customers</p>
          </div>
          
          <div className="feed-controls">
            <div className="countdown-timer" title="Auto-refresh countdown">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="timer-icon">
                <circle cx="12" cy="12" r="10" />
                <path d="M12 6v6l4 2" />
              </svg>
              <span className="countdown-value">{countdown}s</span>
            </div>
            
            <button 
              className="refresh-button" 
              onClick={() => refetch()}
              disabled={isFetching}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={isFetching ? 'spinning' : ''}>
                <path d="M23 4v6h-6" />
                <path d="M1 20v-6h6" />
                <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
              </svg>
              {isFetching ? 'Refreshing...' : 'Refresh'}
            </button>
            
            <button 
              className={`filter-toggle-btn ${showFilters ? 'active' : ''} ${hasActiveFilters ? 'has-filters' : ''}`}
              onClick={() => setShowFilters(!showFilters)}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
              </svg>
              Filters
              {hasActiveFilters && <span className="filter-count">{
                (filters.eventTypes.length || 0) + 
                (filters.customerSearch ? 1 : 0) + 
                (filters.detailsSearch ? 1 : 0) + 
                (filters.dateRange.start ? 1 : 0)
              }</span>}
            </button>
          </div>
        </header>

        {/* Activity Stats Bar */}
        <div className="activity-stats-bar glass-card">
          <div className="stat-item">
            <span className="stat-value primary">{todayStats.today}</span>
            <span className="stat-label">Today</span>
          </div>
          <div className="stat-divider" />
          <div className="stat-item">
            <span className="stat-value">{todayStats.yesterday}</span>
            <span className="stat-label">Yesterday</span>
          </div>
          <div className="stat-divider" />
          <div className="stat-item">
            <span className="stat-value">{todayStats.lastWeek}</span>
            <span className="stat-label">Daily Avg (7d)</span>
          </div>
          <div className="stat-divider" />
          <div className="stat-item trend-item">
            <span className={`stat-value ${todayStats.today >= todayStats.yesterday ? 'up' : 'down'}`}>
              {todayStats.today >= todayStats.yesterday ? '↑' : '↓'} 
              {todayStats.yesterday > 0 
                ? Math.round(((todayStats.today - todayStats.yesterday) / todayStats.yesterday) * 100)
                : todayStats.today > 0 ? 100 : 0}%
            </span>
            <span className="stat-label">vs Yesterday</span>
          </div>
          
          {/* Sparkline */}
          {activityStats && (
            <>
              <div className="stat-divider" />
              <div className="stat-item sparkline-item">
                <ActivitySparkline data={activityStats.timeline.slice(-7)} />
                <span className="stat-label">7-Day Trend</span>
              </div>
            </>
          )}
          
          {/* Most Active Today */}
          {mostActiveToday.length > 0 && (
            <>
              <div className="stat-divider" />
              <div className="stat-item most-active-item">
                <div className="most-active-list">
                  {mostActiveToday.slice(0, 3).map((customer, i) => (
                    <Link 
                      key={customer.id} 
                      to={`/account/${customer.id}`}
                      className="most-active-customer"
                      title={`${customer.name}: ${customer.count} events`}
                    >
                      <span className="rank">#{i + 1}</span>
                      <span className="name">{customer.name.slice(0, 12)}{customer.name.length > 12 ? '...' : ''}</span>
                      <span className="count">{customer.count}</span>
                    </Link>
                  ))}
                </div>
                <span className="stat-label">Most Active Today</span>
              </div>
            </>
          )}
        </div>

        {/* Filters Panel */}
        {showFilters && (
          <div className="feed-filters glass-card">
            <div className="filters-row">
              <div className="filter-group">
                <label>Event Type</label>
                <div className="event-type-toggles">
                  {eventTypeOptions.map(opt => (
                    <button
                      key={opt.value}
                      className={`type-toggle ${filters.eventTypes.includes(opt.value) ? 'active' : ''}`}
                      onClick={() => {
                        setFilters(prev => ({
                          ...prev,
                          eventTypes: prev.eventTypes.includes(opt.value)
                            ? prev.eventTypes.filter(t => t !== opt.value)
                            : [...prev.eventTypes, opt.value]
                        }));
                      }}
                    >
                      <span className={`type-icon ${opt.value}`}>{getEventEmoji(opt.value)}</span>
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
              
              <div className="filter-group">
                <label>Customer</label>
                <input
                  type="text"
                  className="filter-input"
                  placeholder="Search by name or ID..."
                  value={filters.customerSearch}
                  onChange={e => setFilters(prev => ({ ...prev, customerSearch: e.target.value }))}
                />
              </div>
              
              <div className="filter-group">
                <label>Details</label>
                <input
                  type="text"
                  className="filter-input"
                  placeholder="Search event details..."
                  value={filters.detailsSearch}
                  onChange={e => setFilters(prev => ({ ...prev, detailsSearch: e.target.value }))}
                />
              </div>
              
              <div className="filter-group date-range-group">
                <label id="date-range-label">Date Range</label>
                <div className="date-inputs">
                  <input
                    type="date"
                    className="filter-input date-input"
                    title="Start date"
                    aria-label="Start date"
                    aria-describedby="date-range-label"
                    value={filters.dateRange.start?.toISOString().split('T')[0] || ''}
                    onChange={e => setFilters(prev => ({
                      ...prev,
                      dateRange: { ...prev.dateRange, start: e.target.value ? new Date(e.target.value) : null }
                    }))}
                  />
                  <span className="date-separator">to</span>
                  <input
                    type="date"
                    className="filter-input date-input"
                    title="End date"
                    aria-label="End date"
                    aria-describedby="date-range-label"
                    value={filters.dateRange.end?.toISOString().split('T')[0] || ''}
                    onChange={e => setFilters(prev => ({
                      ...prev,
                      dateRange: { ...prev.dateRange, end: e.target.value ? new Date(e.target.value) : null }
                    }))}
                  />
                </div>
              </div>
            </div>
            
            {hasActiveFilters && (
              <div className="filters-footer">
                <span className="results-count">
                  Showing {filteredEvents.length} of {events?.length || 0} events
                </span>
                <button className="clear-filters-btn" onClick={clearFilters}>
                  Clear All Filters
                </button>
              </div>
            )}
          </div>
        )}

        {/* New Activity Banner */}
        {showNewActivityBanner && (
          <div className="new-activity-banner" onClick={dismissBanner}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
              <path d="M13.73 21a2 2 0 0 1-3.46 0" />
            </svg>
            <span>{newEventCount} new {newEventCount === 1 ? 'event' : 'events'} arrived</span>
            <button className="dismiss-btn">✕</button>
          </div>
        )}

        {isLoading ? (
          <div className="loading-state">
            <div className="loading-spinner" />
            <p>Loading activity feed...</p>
          </div>
        ) : filteredEvents && filteredEvents.length > 0 ? (
          <div className="glass-card feed-container">
            <div className="feed-list feed-list-virtual" ref={listRef}>
              <div
                className="feed-list-virtual-inner"
                style={{ height: `${rowVirtualizer.getTotalSize()}px` }}
              >
                {rowVirtualizer.getVirtualItems().map((virtualRow) => {
                  const event = filteredEvents[virtualRow.index];
                  if (!event) return null;
                  return (
                    <div
                      key={event.id}
                      className="feed-list-virtual-row"
                      style={{ transform: `translateY(${virtualRow.start}px)` }}
                    >
                      <FeedEntry
                        event={event}
                        isNew={virtualRow.index < newEventCount && showNewActivityBanner}
                        isExpanded={expandedEvents.has(event.id)}
                        onToggleExpand={() => toggleExpand(event.id)}
                      />
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        ) : (
          <div className="glass-card empty-state">
            {hasActiveFilters ? (
              <>
                <p>No events match your filters</p>
                <button className="clear-filters-btn" onClick={clearFilters}>
                  Clear Filters
                </button>
              </>
            ) : (
              <p>No recent activity</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// Activity Sparkline Component
const ActivitySparkline = memo(function ActivitySparkline({ data }: { data: Array<{ date: string; items: number; cards: number; orders: number }> }) {
  const values = data.map(d => d.items + d.cards + d.orders);
  const max = Math.max(...values, 1);
  const hasActivity = values.some(v => v > 0);

  if (!hasActivity) {
    return <span className="sparkline-empty">—</span>;
  }

  return (
    <svg className="feed-sparkline" viewBox="0 0 100 30" preserveAspectRatio="none">
      <defs>
        <linearGradient id="feedSparkGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#FC5928" stopOpacity="0.8" />
          <stop offset="100%" stopColor="#FC5928" stopOpacity="0.1" />
        </linearGradient>
      </defs>
      <path
        d={`M 0 ${30 - (values[0] / max) * 26} ${values.map((v, i) => `L ${(i / (values.length - 1)) * 100} ${30 - (v / max) * 26}`).join(' ')} L 100 30 L 0 30 Z`}
        fill="url(#feedSparkGrad)"
      />
      <path
        d={`M 0 ${30 - (values[0] / max) * 26} ${values.map((v, i) => `L ${(i / (values.length - 1)) * 100} ${30 - (v / max) * 26}`).join(' ')}`}
        fill="none"
        stroke="#FC5928"
        strokeWidth="2"
      />
    </svg>
  );
});

// Feed Entry Component
const FeedEntry = memo(function FeedEntry({ 
  event, 
  isNew, 
  isExpanded,
  onToggleExpand 
}: { 
  event: ActivityEvent; 
  isNew: boolean;
  isExpanded: boolean;
  onToggleExpand: () => void;
}) {
  const timeAgo = useRelativeTime(event.timestamp);
  
  // Generate avatar initials
  const initials = event.tenantName
    .split(' ')
    .map(word => word[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
  
  // Generate consistent color from tenant ID
  const avatarColor = getAvatarColor(event.tenantId);
  
  return (
    <div className={`feed-entry ${event.type} ${isNew ? 'new-entry' : ''} ${isExpanded ? 'expanded' : ''}`}>
      <div className="feed-avatar" style={{ background: avatarColor }}>
        {initials}
      </div>
      
      <div className="feed-icon">
        {getEventIcon(event.type)}
      </div>
      
      <div className="feed-content">
        <div className="feed-main">
          <Link to={`/account/${event.tenantId}`} className="feed-customer">
            {event.tenantName}
          </Link>
          <span className="feed-action">{getEventAction(event.type)}</span>
          <span className="feed-details">{event.details.name}</span>
        </div>
        
        {event.details.newState && event.type === 'card_created' && (
          <span className="feed-state">→ {event.details.newState}</span>
        )}
        
        {/* Expandable Details */}
        {isExpanded && (
          <div className="feed-expanded">
            <div className="expanded-details">
              <div className="detail-row">
                <span className="detail-label">Event ID:</span>
                <span className="detail-value">{event.id}</span>
              </div>
              <div className="detail-row">
                <span className="detail-label">Tenant ID:</span>
                <span className="detail-value">{event.tenantId}</span>
              </div>
              <div className="detail-row">
                <span className="detail-label">Timestamp:</span>
                <span className="detail-value">{new Date(event.timestamp).toLocaleString()}</span>
              </div>
              {event.details.itemSku && (
                <div className="detail-row">
                  <span className="detail-label">SKU:</span>
                  <span className="detail-value">{event.details.itemSku}</span>
                </div>
              )}
              {event.details.orderNumber && (
                <div className="detail-row">
                  <span className="detail-label">Order #:</span>
                  <span className="detail-value">{event.details.orderNumber}</span>
                </div>
              )}
              {event.details.previousState && (
                <div className="detail-row">
                  <span className="detail-label">Previous State:</span>
                  <span className="detail-value">{event.details.previousState}</span>
                </div>
              )}
            </div>
            
            {/* Quick Actions */}
            <div className="quick-actions">
              <Link to={`/account/${event.tenantId}`} className="quick-action-btn">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                  <circle cx="12" cy="7" r="4" />
                </svg>
                View Account
              </Link>
              <a 
                href={`mailto:?subject=Activity Alert: ${event.tenantName}&body=Activity detected for ${event.tenantName}:%0A%0AEvent: ${getEventAction(event.type)} - ${event.details.name}%0ATime: ${new Date(event.timestamp).toLocaleString()}`}
                className="quick-action-btn"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                  <polyline points="22,6 12,13 2,6" />
                </svg>
                Send Email
              </a>
            </div>
          </div>
        )}
      </div>
      
      <div className="feed-right">
        <span className="feed-time">{timeAgo}</span>
        <button 
          className={`expand-btn ${isExpanded ? 'expanded' : ''}`}
          onClick={onToggleExpand}
          title={isExpanded ? 'Collapse' : 'Expand details'}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </button>
      </div>
    </div>
  );
});

// Helper: Get avatar color from tenant ID
function getAvatarColor(tenantId: string): string {
  const colors = [
    '#FC5928', '#3B82F6', '#22C55E', '#F59E0B', '#8B5CF6',
    '#EC4899', '#14B8A6', '#F97316', '#6366F1', '#84CC16'
  ];
  
  let hash = 0;
  for (let i = 0; i < tenantId.length; i++) {
    hash = tenantId.charCodeAt(i) + ((hash << 5) - hash);
  }
  
  return colors[Math.abs(hash) % colors.length];
}

// Helper: Get event emoji for filter toggles
function getEventEmoji(type: string): string {
  switch (type) {
    case 'item_created': return '📦';
    case 'card_created': return '🎴';
    case 'card_state_change': return '🔄';
    case 'order_placed': return '🛒';
    default: return '📌';
  }
}

function getEventIcon(type: ActivityEvent['type']) {
  switch (type) {
    case 'item_created':
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M12 2L2 7l10 5 10-5-10-5z" />
          <path d="M2 17l10 5 10-5" />
          <path d="M2 12l10 5 10-5" />
        </svg>
      );
    case 'card_created':
    case 'card_state_change':
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="3" y="3" width="7" height="9" rx="1" />
          <rect x="14" y="3" width="7" height="5" rx="1" />
          <rect x="14" y="12" width="7" height="9" rx="1" />
          <rect x="3" y="16" width="7" height="5" rx="1" />
        </svg>
      );
    case 'order_placed':
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="9" cy="21" r="1" />
          <circle cx="20" cy="21" r="1" />
          <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
        </svg>
      );
    default:
      return null;
  }
}

function getEventAction(type: ActivityEvent['type']) {
  switch (type) {
    case 'item_created':
      return 'created item';
    case 'card_created':
      return 'created card';
    case 'card_state_change':
      return 'moved card';
    case 'order_placed':
      return 'placed order';
    default:
      return 'performed action';
  }
}

function getRelativeTime(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;
  
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  
  if (days > 0) return `${days}d ago`;
  if (hours > 0) return `${hours}h ago`;
  if (minutes > 0) return `${minutes}m ago`;
  return 'just now';
}
