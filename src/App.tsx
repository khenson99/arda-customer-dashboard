import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchCustomerMetrics } from './lib/arda-client';
import { TabNavigation } from './components/TabNavigation';
import { MetricsGrid } from './components/MetricsGrid';
import { AlertSection } from './components/AlertSection';
import { CustomerTable } from './components/CustomerTable';
import { ChartsSection } from './components/ChartsSection';

function App() {
  // Filter state
  const [selectedCSM, setSelectedCSM] = useState<string>('all');
  const [selectedLifecycle, setSelectedLifecycle] = useState<string>('all');
  
  // Data fetching
  const { data: customers, isLoading, error } = useQuery({
    queryKey: ['customerMetrics'],
    queryFn: fetchCustomerMetrics,
  });

  const metrics = customers || [];
  
  // All hooks must be called unconditionally (before any early returns)
  const uniqueCSMs = useMemo(() => 
    [...new Set(metrics.map(c => c.assignedCSM).filter(Boolean))] as string[],
    [metrics]
  );
  
  const uniqueLifecycles = useMemo(() => 
    ['onboarding', 'adoption', 'growth', 'mature', 'renewal'],
    []
  );
  
  const filteredMetrics = useMemo(() => 
    metrics.filter(c => {
      if (selectedCSM !== 'all' && c.assignedCSM !== selectedCSM) return false;
      if (selectedLifecycle !== 'all' && c.lifecycleStage !== selectedLifecycle) return false;
      return true;
    }),
    [metrics, selectedCSM, selectedLifecycle]
  );
  
  const summaryStats = useMemo(() => {
    const totalCustomers = filteredMetrics.length;
    const liveCustomers = filteredMetrics.filter((c) => c.stage === 'live').length;
    const avgHealthScore = filteredMetrics.length
      ? Math.round(filteredMetrics.reduce((sum, c) => sum + c.healthScore, 0) / filteredMetrics.length)
      : 0;
    const atRiskCount = filteredMetrics.filter((c) => 
      c.alerts?.some(a => a.type === 'churn_risk')
    ).length;
    
    return { totalCustomers, liveCustomers, avgHealthScore, atRiskCount };
  }, [filteredMetrics]);
  
  const customersWithAlerts = useMemo(() => 
    filteredMetrics.filter((c) => c.alerts?.length > 0),
    [filteredMetrics]
  );

  // Early returns for loading/error states (AFTER all hooks)
  if (isLoading) {
    return (
      <div className="dashboard">
        <TabNavigation />
        <div className="dashboard-content">
          <div className="loading-state">
            <div className="loading-spinner" />
            <p>Loading customer data from Arda API...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="dashboard">
        <TabNavigation />
        <div className="dashboard-content">
          <div className="error-message">
            <div className="error-icon">⚠️</div>
            <p>Failed to load customer data. Please try again.</p>
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
          <div className="header-top">
            <div>
              <h1>Arda Customer Dashboard</h1>
              <p>Track usage, onboarding progress, and customer health</p>
            </div>
            <div className="filter-controls">
              <select 
                value={selectedCSM} 
                onChange={(e) => setSelectedCSM(e.target.value)}
                className="filter-select"
                aria-label="Filter by Customer Success Manager"
              >
                <option value="all">All CSMs</option>
                {uniqueCSMs.map(csm => (
                  <option key={csm} value={csm}>{csm}</option>
                ))}
              </select>
              <select 
                value={selectedLifecycle} 
                onChange={(e) => setSelectedLifecycle(e.target.value)}
                className="filter-select"
                aria-label="Filter by Lifecycle Stage"
              >
                <option value="all">All Lifecycle Stages</option>
                {uniqueLifecycles.map(stage => (
                  <option key={stage} value={stage}>
                    {stage.charAt(0).toUpperCase() + stage.slice(1)}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </header>

        {/* Metrics Grid */}
        <MetricsGrid 
          totalCustomers={summaryStats.totalCustomers}
          liveCustomers={summaryStats.liveCustomers}
          avgHealthScore={summaryStats.avgHealthScore}
          atRiskCount={summaryStats.atRiskCount}
        />

        {/* At Risk Section */}
        <AlertSection customersWithAlerts={customersWithAlerts} />

        {/* Customer Table */}
        <CustomerTable customers={filteredMetrics} />

        {/* Charts */}
        <ChartsSection metrics={metrics} />
      </div>
    </div>
  );
}

export default App;
