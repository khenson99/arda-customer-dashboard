import { useQuery } from '@tanstack/react-query';
import { checkApiHealth, envSummary } from '../lib/health';
import { TabNavigation } from './TabNavigation';

export function StatusPage() {
  const { data, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: ['status'],
    queryFn: checkApiHealth,
    refetchOnWindowFocus: false,
  });

  const env = envSummary();

  return (
    <div className="dashboard">
      <TabNavigation />
      <div className="dashboard-content">
        <header className="dashboard-header">
          <h1>Status</h1>
          <p className="subtitle">Deployment and API connectivity checks</p>
        </header>

        <div className="metrics-grid">
          <div className="glass-card metric-card">
            <div className="label">API Base</div>
            <div className="value">{env.apiBasePresent ? 'Configured' : 'Missing'}</div>
          </div>
          <div className="glass-card metric-card">
            <div className="label">API Key</div>
            <div className="value">{env.apiKeyPresent ? 'Present' : 'Missing'}</div>
          </div>
          <div className="glass-card metric-card">
            <div className="label">Author Header</div>
            <div className="value">{env.authorSet ? 'Present' : 'Missing'}</div>
          </div>
          <div className="glass-card metric-card">
            <div className="label">Health</div>
            <div className={`value ${data?.ok ? 'text-success' : 'text-danger'}`}>
              {isLoading ? 'Checking…' : data?.ok ? 'OK' : 'Fail'}
            </div>
            {data?.latencyMs !== undefined && (
              <div className="trend up">{data.latencyMs} ms</div>
            )}
          </div>
        </div>

        <div className="glass-card">
          <div className="status-row">
            <div>
              <h3>API probe</h3>
              <p>{error ? (error as Error).message : data?.message || 'POST /v1/tenant/tenant/query size=1'}</p>
            </div>
            <button className="refresh-button" onClick={() => refetch()} disabled={isFetching}>
              {isFetching ? 'Rechecking…' : 'Run check'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default StatusPage;
