import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { fetchActivityEvents } from '../arda-client';

const item = {
  rId: 'item-1',
  payload: { name: 'Widget' },
  metadata: { tenantId: 'tenant-1' },
  createdAt: { effective: 1, recorded: 1 },
};

const card = {
  rId: 'card-1',
  payload: { title: 'Card', state: 'Doing' },
  metadata: { tenantId: 'tenant-1' },
  createdAt: { effective: 2, recorded: 2 },
};

const order = {
  rId: 'order-1',
  payload: {},
  metadata: { tenantId: 'tenant-2' },
  createdAt: { effective: 3, recorded: 3 },
};

const tenant = {
  rId: 'tenant-row-1',
  payload: {
    eId: 'tenant-1',
    tenantName: 'Personal tenant for user@example.com',
    company: { name: 'Example Co' },
    plan: 'Pro',
  },
  createdAt: { effective: 0, recorded: 0 },
  asOf: { effective: 0, recorded: 0 },
  metadata: {},
  author: '',
  createdBy: '',
  retired: false,
};

describe('fetchActivityEvents', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('/item/item/query')) {
        return new Response(JSON.stringify({ results: [item] }), { status: 200 });
      }
      if (url.includes('/kanban/kanban-card/query')) {
        return new Response(JSON.stringify({ results: [card] }), { status: 200 });
      }
      if (url.includes('/order/order/query')) {
        return new Response(JSON.stringify({ results: [order] }), { status: 200 });
      }
      if (url.includes('/tenant/tenant/query')) {
        return new Response(JSON.stringify({ results: [tenant] }), { status: 200 });
      }
      return new Response(JSON.stringify({ results: [] }), { status: 200 });
    });

    // @ts-expect-error - assign mock fetch for tests
    global.fetch = fetchMock;
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('uses tenantId from metadata for feed entries', async () => {
    const events = await fetchActivityEvents();
    const itemEvent = events.find((e) => e.id === 'item-item-1');
    expect(itemEvent?.tenantId).toBe('tenant-1');
    expect(itemEvent?.tenantName).toBe('Example');
  });

  it('includes tenants discovered from orders', async () => {
    const events = await fetchActivityEvents();
    const orderEvent = events.find((e) => e.id === 'order-order-1');
    expect(orderEvent?.tenantId).toBe('tenant-2');
    expect(orderEvent?.tenantName).toMatch(/Org tenant/i);
  });
});
