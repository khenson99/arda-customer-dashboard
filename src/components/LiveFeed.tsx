import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { fetchActivityEvents, type ActivityEvent } from '../lib/arda-client';
import { TabNavigation } from './TabNavigation';

export function LiveFeed() {
  const { data: events, isLoading, error, refetch, isFetching } = useQuery<ActivityEvent[]>({
    queryKey: ['activityEvents'],
    queryFn: () => fetchActivityEvents({ limit: 100 }),
    refetchInterval: 30000, // Refresh every 30 seconds
    staleTime: 1000 * 10, // 10 seconds
  });

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
        <header className="dashboard-header">
          <div>
            <h1>Live Feed</h1>
            <p className="subtitle">Real-time platform activity across all customers</p>
          </div>
          
          <div className="feed-controls">
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
            <span className="auto-refresh-note">Auto-refreshes every 30s</span>
          </div>
        </header>

        {isLoading ? (
          <div className="loading-state">
            <div className="loading-spinner" />
            <p>Loading activity feed...</p>
          </div>
        ) : events && events.length > 0 ? (
          <div className="glass-card feed-container">
            <div className="feed-list">
              {events.map((event) => (
                <FeedEntry key={event.id} event={event} />
              ))}
            </div>
          </div>
        ) : (
          <div className="glass-card empty-state">
            <p>No recent activity</p>
          </div>
        )}
      </div>
    </div>
  );
}

function FeedEntry({ event }: { event: ActivityEvent }) {
  const timeAgo = getRelativeTime(event.timestamp);
  
  return (
    <div className={`feed-entry ${event.type}`}>
      <div className="feed-icon">
        {getEventIcon(event.type)}
      </div>
      
      <div className="feed-content">
        <div className="feed-main">
          <Link to={`/customer/${event.tenantId}`} className="feed-customer">
            {event.tenantName}
          </Link>
          <span className="feed-action">{getEventAction(event.type)}</span>
          <span className="feed-details">{event.details.name}</span>
        </div>
        
        {event.details.newState && event.type === 'card_created' && (
          <span className="feed-state">→ {event.details.newState}</span>
        )}
      </div>
      
      <div className="feed-time">{timeAgo}</div>
    </div>
  );
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
