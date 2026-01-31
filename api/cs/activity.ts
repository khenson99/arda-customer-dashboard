/**
 * Activity API Endpoint
 *
 * GET /api/cs/activity?mode=events|aggregate&limit=100&since=timestamp&days=30&tenantId=...
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import {
  fetchTenants,
  fetchItems,
  fetchKanbanCards,
  fetchOrders,
  type ArdaTenant,
} from '../../server/lib/arda-api.js';
import { resolveTenantName } from '../../server/lib/tenant-names.js';

interface ActivityEvent {
  id: string;
  type: 'item_created' | 'card_created' | 'order_placed';
  tenantId: string;
  tenantName: string;
  timestamp: number;
  details: {
    name?: string;
    orderNumber?: string;
    itemSku?: string;
    newState?: string;
  };
}

interface ActivityAggregate {
  timeline: Array<{
    date: string;
    items: number;
    cards: number;
    orders: number;
  }>;
  byCustomer: Array<{
    tenantId: string;
    tenantName: string;
    items: number;
    cards: number;
    orders: number;
    total: number;
    trend: number[];
  }>;
}

const DAY_MS = 24 * 60 * 60 * 1000;

function parseNumber(value: unknown, fallback: number): number {
  const parsed = typeof value === 'string' ? Number(value) : NaN;
  return Number.isFinite(parsed) ? parsed : fallback;
}

function buildActivityAggregate(events: ActivityEvent[], days: number): ActivityAggregate {
  const cutoff = Date.now() - days * DAY_MS;
  const filtered = events.filter((event) => event.timestamp >= cutoff);

  const timelineMap = new Map<string, { items: number; cards: number; orders: number }>();
  const customerMap = new Map<
    string,
    {
      tenantName: string;
      items: number;
      cards: number;
      orders: number;
      dailyActivity: Map<string, number>;
    }
  >();

  for (let i = 0; i < days; i++) {
    const date = new Date(Date.now() - i * DAY_MS);
    const dateStr = date.toISOString().split('T')[0];
    timelineMap.set(dateStr, { items: 0, cards: 0, orders: 0 });
  }

  for (const event of filtered) {
    const dateStr = new Date(event.timestamp).toISOString().split('T')[0];
    const dayData = timelineMap.get(dateStr);
    if (dayData) {
      if (event.type === 'item_created') dayData.items++;
      if (event.type === 'card_created') dayData.cards++;
      if (event.type === 'order_placed') dayData.orders++;
    }

    if (!customerMap.has(event.tenantId)) {
      customerMap.set(event.tenantId, {
        tenantName: event.tenantName,
        items: 0,
        cards: 0,
        orders: 0,
        dailyActivity: new Map(),
      });
    }

    const customer = customerMap.get(event.tenantId)!;
    if (event.type === 'item_created') customer.items++;
    if (event.type === 'card_created') customer.cards++;
    if (event.type === 'order_placed') customer.orders++;

    const currentDaily = customer.dailyActivity.get(dateStr) || 0;
    customer.dailyActivity.set(dateStr, currentDaily + 1);
  }

  const timeline = Array.from(timelineMap.entries())
    .map(([date, data]) => ({ date, ...data }))
    .sort((a, b) => a.date.localeCompare(b.date));

  const byCustomer = Array.from(customerMap.entries())
    .map(([tenantId, data]) => {
      const trend: number[] = [];
      for (let i = 6; i >= 0; i--) {
        const date = new Date(Date.now() - i * DAY_MS);
        const dateStr = date.toISOString().split('T')[0];
        trend.push(data.dailyActivity.get(dateStr) || 0);
      }

      return {
        tenantId,
        tenantName: data.tenantName,
        items: data.items,
        cards: data.cards,
        orders: data.orders,
        total: data.items + data.cards + data.orders,
        trend,
      };
    })
    .sort((a, b) => b.total - a.total);

  return { timeline, byCustomer };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type, X-Arda-API-Key, X-Arda-Author');
  res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=120');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const apiKey = (req.headers['x-arda-api-key'] as string) || process.env.ARDA_API_KEY;
    const author = (req.headers['x-arda-author'] as string) || process.env.ARDA_AUTHOR || 'dashboard@arda.cards';

    if (!apiKey) {
      return res.status(401).json({ error: 'Missing API key' });
    }

    const mode = String(req.query.mode || 'events');
    const limit = Math.max(1, parseNumber(req.query.limit, 100));
    const days = Math.max(1, parseNumber(req.query.days, 30));
    const since = parseNumber(req.query.since, 0);
    const tenantIdFilter = req.query.tenantId ? String(req.query.tenantId) : undefined;
    const effectiveSince = mode === 'aggregate' ? Date.now() - days * DAY_MS : since;

    const [tenants, items, kanbanCards, orders] = await Promise.all([
      fetchTenants(apiKey, author).catch(() => []),
      fetchItems(apiKey, author).catch(() => []),
      fetchKanbanCards(apiKey, author).catch(() => []),
      fetchOrders(apiKey, author).catch(() => []),
    ]);

    const tenantInfoMap = new Map<string, ArdaTenant>();
    for (const tenant of tenants) {
      tenantInfoMap.set(tenant.payload.eId, tenant);
    }

    const getTenantName = (tenantId: string) => {
      const info = tenantInfoMap.get(tenantId);
      return resolveTenantName(tenantId, info?.payload.tenantName, info?.payload.company?.name);
    };

    const events: ActivityEvent[] = [];
    const pushEvent = (event: ActivityEvent) => {
      if (tenantIdFilter && event.tenantId !== tenantIdFilter) return;
      if (effectiveSince && event.timestamp < effectiveSince) return;
      events.push(event);
    };

    for (const item of items) {
      const tenantId = (item.metadata as Record<string, unknown>)?.tenantId as string;
      if (!tenantId || !item.createdAt?.effective) continue;
      pushEvent({
        id: `item-${item.rId}`,
        type: 'item_created',
        tenantId,
        tenantName: getTenantName(tenantId),
        timestamp: item.createdAt.effective,
        details: {
          name: item.payload?.name || item.payload?.sku || 'Unnamed item',
          itemSku: item.payload?.sku,
        },
      });
    }

    for (const card of kanbanCards) {
      const tenantId = (card.metadata as Record<string, unknown>)?.tenantId as string;
      if (!tenantId || !card.createdAt?.effective) continue;
      pushEvent({
        id: `card-${card.rId}`,
        type: 'card_created',
        tenantId,
        tenantName: getTenantName(tenantId),
        timestamp: card.createdAt.effective,
        details: {
          name: card.payload?.title || card.payload?.item?.name || 'Unnamed card',
          newState: card.payload?.state,
        },
      });
    }

    for (const order of orders) {
      const tenantId = (order.metadata as Record<string, unknown>)?.tenantId as string;
      if (!tenantId || !order.createdAt?.effective) continue;
      pushEvent({
        id: `order-${order.rId}`,
        type: 'order_placed',
        tenantId,
        tenantName: getTenantName(tenantId),
        timestamp: order.createdAt.effective,
        details: {
          orderNumber: order.rId.slice(0, 8),
          name: `Order #${order.rId.slice(0, 8)}`,
        },
      });
    }

    events.sort((a, b) => b.timestamp - a.timestamp);

    if (mode === 'aggregate') {
      return res.status(200).json(buildActivityAggregate(events, days));
    }

    return res.status(200).json(events.slice(0, limit));
  } catch (error) {
    console.error('Activity API error:', error);
    return res.status(500).json({
      error: 'Failed to fetch activity data',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
