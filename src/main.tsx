import React, { Suspense, lazy } from 'react'
import ReactDOM from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import App from './App'
import './index.css'
import { ErrorBoundary } from './components/ErrorBoundary'
import { EnvGuard } from './components/EnvGuard'

// Lazy load components for code splitting
const CustomerDetail = lazy(() =>
  import('./components/CustomerDetail').then((m) => ({ default: (m as any).CustomerDetail || (m as any).default }))
);
const Account360 = lazy(() =>
  import('./components/Account360').then((m) => ({ default: (m as any).Account360 || (m as any).default }))
);
const ActivityOverview = lazy(() =>
  import('./components/ActivityOverview').then((m) => ({ default: (m as any).ActivityOverview }))
);
const LiveFeed = lazy(() =>
  import('./components/LiveFeed').then((m) => ({ default: (m as any).LiveFeed }))
);
const AlertInbox = lazy(() =>
  import('./components/AlertInbox').then((m) => ({ default: (m as any).AlertInbox || (m as any).default }))
);
const StatusPage = lazy(() =>
  import('./components/StatusPage').then((m) => ({ default: (m as any).StatusPage || (m as any).default }))
);

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 2, // 2 minutes (reduced for more responsive updates)
      retry: 2,
      refetchOnWindowFocus: true,
    },
  },
})

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <ErrorBoundary>
          <EnvGuard />
          <Suspense fallback={<div className="loading-state"><div className="loading-spinner" /><p>Loading...</p></div>}>
            <Routes>
              <Route path="/" element={<App />} />
              <Route path="/activity" element={<ActivityOverview />} />
              <Route path="/feed" element={<LiveFeed />} />
              <Route path="/alerts" element={<AlertInbox />} />
              <Route path="/status" element={<StatusPage />} />
              {/* New Account 360 view - enhanced detail page */}
              <Route path="/account/:tenantId" element={<Account360 />} />
              {/* Legacy customer detail route - still supported */}
              <Route path="/customer/:tenantId" element={<CustomerDetail />} />
            </Routes>
          </Suspense>
        </ErrorBoundary>
      </BrowserRouter>
    </QueryClientProvider>
  </React.StrictMode>,
)
