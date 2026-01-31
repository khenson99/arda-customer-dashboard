import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const mockNavigate = vi.fn();

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

vi.mock('@tanstack/react-query', () => ({
  useQuery: () => ({
    data: [
      {
        tenantId: 'tenant-1',
        tenantName: 'Tenant One',
        companyName: 'Tenant One',
        displayName: 'Tenant One',
        assignedCSM: 'CSM',
        tier: 'growth',
        plan: 'Pro',
        status: 'ACTIVE',
        createdAt: new Date().toISOString(),
        itemCount: 2,
        kanbanCardCount: 3,
        orderCount: 1,
        userCount: 1,
        lastActivityDate: new Date().toISOString(),
        healthScore: 80,
        healthBreakdown: { recency: 20, breadth: 20, depth: 20, velocity: 20 },
        daysInactive: 0,
        alerts: [],
        stage: 'live',
        lifecycleStage: 'growth',
        interactions: [],
        accountAgeDays: 10,
        users: [],
        activityTimeline: [{ week: 'W1', activity: 1 }],
      },
    ],
    isLoading: false,
    error: null,
  }),
  useQueryClient: () => ({ invalidateQueries: vi.fn() }),
}));

vi.mock('../../lib/arda-client', () => ({
  fetchCustomerMetrics: vi.fn(),
}));

import App from '../../App';
import { MemoryRouter } from 'react-router-dom';

describe('App row navigation', () => {
  it('uses SPA navigation instead of full page reload', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter
        initialEntries={['/']}
        future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
      >
        <App />
      </MemoryRouter>
    );

    const row = screen.getByText('Tenant One').closest('tr');
    if (!row) throw new Error('Row not found');

    await user.click(row);

    expect(mockNavigate).toHaveBeenCalledWith('/customer/tenant-1');
  });
});
