import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { TabNavigation } from '../TabNavigation';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// Helper to wrap components with router
const renderWithRouter = (component: React.ReactNode) => {
  const queryClient = new QueryClient();
  return render(
    <QueryClientProvider client={queryClient}>
      <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        {component}
      </BrowserRouter>
    </QueryClientProvider>
  );
};

describe('TabNavigation', () => {
  it('renders all tab links', () => {
    renderWithRouter(<TabNavigation />);
    
    expect(screen.getByText('Customers')).toBeInTheDocument();
    expect(screen.getByText('Alerts')).toBeInTheDocument();
    expect(screen.getByText('Activity')).toBeInTheDocument();
    expect(screen.getByText('Live Feed')).toBeInTheDocument();
  });

  it('links point to correct routes', () => {
    renderWithRouter(<TabNavigation />);
    
    const customersLink = screen.getByText('Customers').closest('a');
    const alertsLink = screen.getByText('Alerts').closest('a');
    const activityLink = screen.getByText('Activity').closest('a');
    const feedLink = screen.getByText('Live Feed').closest('a');
    
    expect(customersLink).toHaveAttribute('href', '/');
    expect(alertsLink).toHaveAttribute('href', '/alerts');
    expect(activityLink).toHaveAttribute('href', '/activity');
    expect(feedLink).toHaveAttribute('href', '/feed');
  });

  it('has correct CSS classes for navigation', () => {
    const { container } = renderWithRouter(<TabNavigation />);
    
    expect(container.querySelector('.tab-navigation')).toBeInTheDocument();
    expect(container.querySelectorAll('.tab-link').length).toBe(4);
  });
});
