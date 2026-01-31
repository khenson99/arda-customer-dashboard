import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { EditableName } from '../EditableName';

// Mock the coda-client module
vi.mock('../../lib/coda-client', () => ({
  saveCustomerOverride: vi.fn(() => Promise.resolve()),
}));

describe('EditableName', () => {
  const mockOnSave = vi.fn();
  
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('displays the display name initially', () => {
    render(
      <EditableName
        tenantId="test-tenant-123"
        displayName="Test Company"
        onSave={mockOnSave}
      />
    );
    
    expect(screen.getByText('Test Company')).toBeInTheDocument();
  });

  it('shows edit hint in the DOM', () => {
    const { container } = render(
      <EditableName
        tenantId="test-tenant-123"
        displayName="Test Company"
        onSave={mockOnSave}
      />
    );
    
    // The edit hint should be in the DOM
    const editHint = container.querySelector('.edit-hint');
    expect(editHint).toBeInTheDocument();
  });

  it('enters edit mode when double-clicked', async () => {
    const user = userEvent.setup();
    const { container } = render(
      <EditableName
        tenantId="test-tenant-123"
        displayName="Test Company"
        onSave={mockOnSave}
      />
    );
    
    // Double-click on the name
    const nameSpan = container.querySelector('.editable-name');
    expect(nameSpan).toBeInTheDocument();
    await user.dblClick(nameSpan!);
    
    // Input should appear
    const input = container.querySelector('input');
    expect(input).toBeInTheDocument();
    expect(input).toHaveValue('Test Company');
  });

  it('handles enter key to save', async () => {
    const user = userEvent.setup();
    const { container } = render(
      <EditableName
        tenantId="test-tenant-123"
        displayName="Test Company"
        onSave={mockOnSave}
      />
    );
    
    // Enter edit mode
    const nameSpan = container.querySelector('.editable-name');
    await user.dblClick(nameSpan!);
    
    const input = container.querySelector('input');
    expect(input).toBeInTheDocument();
    
    await user.clear(input!);
    await user.type(input!, 'New Name{Enter}');
    
    // onSave should be called
    await waitFor(() => {
      expect(mockOnSave).toHaveBeenCalledWith('New Name');
    });
  });

  it('handles escape key to cancel', async () => {
    const user = userEvent.setup();
    const { container } = render(
      <EditableName
        tenantId="test-tenant-123"
        displayName="Test Company"
        onSave={mockOnSave}
      />
    );
    
    // Enter edit mode
    const nameSpan = container.querySelector('.editable-name');
    await user.dblClick(nameSpan!);
    
    const input = container.querySelector('input');
    expect(input).toBeInTheDocument();
    
    await user.type(input!, 'Changed{Escape}');
    
    // Should exit edit mode without saving
    expect(mockOnSave).not.toHaveBeenCalled();
    expect(screen.getByText('Test Company')).toBeInTheDocument();
  });
});
