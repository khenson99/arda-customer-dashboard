// Arda API Client
// Base URL: https://prod.alpha001.io.arda.cards
// Using /api proxy in dev to avoid CORS

import { resolveTenantName, getTenantInfo, TENANT_NAMES } from './tenant-names';
import { fetchPortfolio, fetchAlerts } from './api/cs-api';
import { getCustomerOverrides, type CustomerOverride } from './coda-client';
const BASE_URL = '/api';

// Get API key from environment or localStorage
const getApiKey = () => {
  return import.meta.env.VITE_ARDA_API_KEY || localStorage.getItem('arda_api_key') || '';
};

const getAuthor = () => {
  return localStorage.getItem('arda_author') || 'dashboard@arda.cards';
};

interface QueryOptions {
  filter?: Record<string, unknown>;
  sort?: { entries: Array<{ field: string; direction: 'ASC' | 'DESC' }> };
  paginate?: { index: number; size: number };
}

const createHeaders = (): Record<string, string> => {
  const headers: Record<string, string> = {
    'X-Author': getAuthor(),
    'X-Request-ID': crypto.randomUUID(),
    'Content-Type': 'application/json',
  };
  const key = getApiKey();
  if (key) {
    headers['Authorization'] = `Bearer ${key}`;
  }
  return headers;
};

// Generic query function (single page)
async function queryEntity<T>(
  service: string,
  entity: string,
  options: QueryOptions = {}
): Promise<{ results: T[]; nextPage?: string }> {
  const timestamp = Date.now();
  const url = `${BASE_URL}/v1/${service}/${entity}/query?effectiveasof=${timestamp}`;
  
  const queryBody = {
    filter: options.filter ?? true,
    sort: options.sort || { entries: [] },
    paginate: options.paginate || { index: 0, size: 500 },
  };
  
  const response = await fetch(url, {
    method: 'POST',
    headers: createHeaders(),
    body: JSON.stringify(queryBody),
  });

  if (!response.ok) {
    throw new Error(`API Error: ${response.status} ${response.statusText}`);
  }

  return response.json();
}

// Fetch all pages for a given entity (prevents silent truncation)
async function queryAllEntities<T>(service: string, entity: string, pageSize = 500): Promise<T[]> {
  const results: T[] = [];
  let index = 0;

  while (true) {
    const page = await queryEntity<T>(service, entity, { paginate: { index, size: pageSize } });
    results.push(...page.results);

    if (page.nextPage) {
      const nextPageResponse = await fetch(page.nextPage, { headers: createHeaders(), method: 'POST' });
      if (!nextPageResponse.ok) break;
      const nextData = await nextPageResponse.json();
      results.push(...(nextData.results || []));
      if (!nextData.results || nextData.results.length < pageSize) break;
      index += 2; // processed two pages
    } else if (page.results.length < pageSize) {
      break;
    } else {
      index += 1;
    }
  }

  return results;
}

// Tenant API
export interface Tenant {
  rId: string;
  asOf: {
    effective: number;
    recorded: number;
  };
  payload: {
    eId: string;
    tenantName: string;
    company: {
      name: string;
    };
    plan: string;
    subscriptionReference?: {
      state: string;
    };
  };
  metadata: Record<string, unknown>;
  author: string;
  createdBy: string;
  createdAt: {
    effective: number;
    recorded: number;
  };
  retired: boolean;
}

export async function queryTenants() {
  return { results: await queryAllEntities<Tenant>('tenant', 'tenant') };
}

// User Account API
export interface UserAccount {
  rId: string;
  payload: {
    identity: {
      email: string;
      firstName?: string;
      lastName?: string;
    };
    activeAgency?: {
      tenant: string;
    };
  };
  createdAt: {
    effective: number;
    recorded: number;
  };
}

export async function queryUserAccounts() {
  return { results: await queryAllEntities<UserAccount>('user-account', 'user-account') };
}

// Items API
export interface Item {
  rId: string;
  payload: {
    name?: string;
    sku?: string;
  };
  metadata: Record<string, unknown>;
  createdAt: {
    effective: number;
    recorded: number;
  };
}

export async function queryItems() {
  return { results: await queryAllEntities<Item>('item', 'item') };
}

// Kanban API
export interface KanbanCard {
  rId: string;
  payload: {
    title?: string;
    state?: string;
    item?: {
      eId: string;
      name?: string;
    };
  };
  metadata: Record<string, unknown>;
  createdAt: {
    effective: number;
    recorded: number;
  };
}

export async function queryKanbanCards() {
  return { results: await queryAllEntities<KanbanCard>('kanban', 'kanban-card') };
}

// Order API
export interface Order {
  rId: string;
  payload: {
    status?: string;
    lineItems?: unknown[];
  };
  metadata: Record<string, unknown>;
  createdAt: {
    effective: number;
    recorded: number;
  };
}

export async function queryOrders() {
  return { results: await queryAllEntities<Order>('order', 'order') };
}

// Alert types for predictive health
export interface Alert {
  type: 'churn_risk' | 'expansion_opportunity' | 'onboarding_stalled';
  severity: 'critical' | 'warning' | 'info';
  message: string;
  suggestedAction: string;
}

// Health score breakdown for transparency
export interface HealthBreakdown {
  recency: number;    // 0-30 points (days since last activity)
  breadth: number;    // 0-25 points (active users / total users)
  depth: number;      // 0-25 points (kanban cards activity)
  velocity: number;   // 0-20 points (week-over-week change)
}

// Lifecycle stages for customer journey tracking
export type LifecycleStage = 
  | 'prospect'      // Not yet signed
  | 'onboarding'    // First 30 days, setting up
  | 'adoption'      // Learning and growing usage
  | 'growth'        // Actively expanding
  | 'mature'        // Stable, consistent usage
  | 'renewal';      // Approaching renewal period

// Interaction logging for CSM activities
export interface Interaction {
  id: string;
  date: string;
  type: 'call' | 'email' | 'meeting' | 'note';
  summary: string;
  nextAction?: string;
  createdBy: string;
}

// Engagement metrics for tracking success
export interface EngagementMetrics {
  timeToFirstItem: number;       // Days from signup to first item
  timeToFirstKanban: number;     // Days from signup to first kanban
  adoptionScore: number;         // 0-100 based on feature usage
  weeklyActiveUsers: number;     // Users active in last 7 days
  monthlyActiveUsers: number;    // Users active in last 30 days
}

// Aggregated customer data
export interface CustomerMetrics {
  tenantId: string;
  tenantName: string;
  companyName: string;
  displayName: string;              // Human-friendly resolved name
  assignedCSM?: string;             // Customer Success Manager
  tier?: 'enterprise' | 'growth' | 'starter' | 'trial';
  plan: string;
  status: string;
  createdAt: string;
  itemCount: number;
  kanbanCardCount: number;
  orderCount: number;
  userCount: number;
  lastActivityDate: string;
  healthScore: number;
  healthBreakdown?: HealthBreakdown; // Detailed score breakdown
  daysInactive: number;             // Days since last activity
  alerts: Alert[];                  // Active alerts for this customer
  stage: 'signed' | 'deployed' | 'training' | 'live';
  lifecycleStage: LifecycleStage;   // Customer journey phase
  engagement?: EngagementMetrics;   // Engagement tracking
  interactions: Interaction[];      // CSM interaction history
  accountAgeDays: number;           // Days since account creation
  users: Array<{ tenantId: string; email: string; name: string }>;
  activityTimeline: Array<{ week: string; activity: number }>;  // Weekly activity for sparkline
}

// localStorage utilities for CSM interaction persistence
const INTERACTIONS_KEY = 'arda_csm_interactions';

export function getStoredInteractions(tenantId: string): Interaction[] {
  try {
    const data = localStorage.getItem(INTERACTIONS_KEY);
    if (!data) return [];
    const allInteractions: Record<string, Interaction[]> = JSON.parse(data);
    return allInteractions[tenantId] || [];
  } catch {
    return [];
  }
}

export function saveInteraction(tenantId: string, interaction: Interaction): void {
  try {
    const data = localStorage.getItem(INTERACTIONS_KEY);
    const allInteractions: Record<string, Interaction[]> = data ? JSON.parse(data) : {};
    if (!allInteractions[tenantId]) {
      allInteractions[tenantId] = [];
    }
    allInteractions[tenantId].unshift(interaction); // Add to beginning
    localStorage.setItem(INTERACTIONS_KEY, JSON.stringify(allInteractions));
  } catch (error) {
    console.error('Failed to save interaction:', error);
  }
}

export function deleteInteraction(tenantId: string, interactionId: string): void {
  try {
    const data = localStorage.getItem(INTERACTIONS_KEY);
    if (!data) return;
    const allInteractions: Record<string, Interaction[]> = JSON.parse(data);
    if (allInteractions[tenantId]) {
      allInteractions[tenantId] = allInteractions[tenantId].filter(i => i.id !== interactionId);
      localStorage.setItem(INTERACTIONS_KEY, JSON.stringify(allInteractions));
    }
  } catch (error) {
    console.error('Failed to delete interaction:', error);
  }
}

// ============================================================================
// localStorage utilities for Task persistence
// ============================================================================

const TASKS_KEY = 'arda_csm_tasks';

export interface StoredTask {
  id: string;
  accountId: string;
  title: string;
  description?: string;
  type: 'follow_up' | 'check_in' | 'onboarding' | 'training' | 'review' | 'escalation' | 'renewal' | 'expansion' | 'custom';
  priority: 'urgent' | 'high' | 'normal' | 'low';
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled' | 'overdue';
  dueDate?: string;
  completedAt?: string;
  assigneeId?: string;
  assigneeName?: string;
  source: 'manual' | 'playbook' | 'alert' | 'recurring' | 'system';
  createdAt: string;
  updatedAt: string;
}

export function getStoredTasks(accountId: string): StoredTask[] {
  try {
    const data = localStorage.getItem(TASKS_KEY);
    if (!data) return [];
    const allTasks: Record<string, StoredTask[]> = JSON.parse(data);
    return allTasks[accountId] || [];
  } catch {
    return [];
  }
}

export function saveTask(accountId: string, task: StoredTask): void {
  try {
    const data = localStorage.getItem(TASKS_KEY);
    const allTasks: Record<string, StoredTask[]> = data ? JSON.parse(data) : {};
    if (!allTasks[accountId]) {
      allTasks[accountId] = [];
    }
    // Add to beginning of list
    allTasks[accountId].unshift(task);
    localStorage.setItem(TASKS_KEY, JSON.stringify(allTasks));
  } catch (error) {
    console.error('Failed to save task:', error);
  }
}

export function updateTask(accountId: string, taskId: string, updates: Partial<StoredTask>): void {
  try {
    const data = localStorage.getItem(TASKS_KEY);
    if (!data) return;
    const allTasks: Record<string, StoredTask[]> = JSON.parse(data);
    if (allTasks[accountId]) {
      allTasks[accountId] = allTasks[accountId].map(task => {
        if (task.id === taskId) {
          return { ...task, ...updates, updatedAt: new Date().toISOString() };
        }
        return task;
      });
      localStorage.setItem(TASKS_KEY, JSON.stringify(allTasks));
    }
  } catch (error) {
    console.error('Failed to update task:', error);
  }
}

export function deleteTask(accountId: string, taskId: string): void {
  try {
    const data = localStorage.getItem(TASKS_KEY);
    if (!data) return;
    const allTasks: Record<string, StoredTask[]> = JSON.parse(data);
    if (allTasks[accountId]) {
      allTasks[accountId] = allTasks[accountId].filter(t => t.id !== taskId);
      localStorage.setItem(TASKS_KEY, JSON.stringify(allTasks));
    }
  } catch (error) {
    console.error('Failed to delete task:', error);
  }
}

// Public email domains that should not be grouped
const PUBLIC_DOMAINS = ['gmail.com', 'icloud.com', 'outlook.com', 'me.com', 'yahoo.com', 'hotmail.com'];

// Extract email domain from tenant name
function extractEmailInfo(tenantName: string): { email: string; domain: string } | null {
  const match = tenantName.match(/Personal tenant for (.+)/);
  if (!match) return null;
  const email = match[1];
  const parts = email.split('@');
  if (parts.length !== 2) return null;
  return { email, domain: parts[1].toLowerCase() };
}

// Derive company name from domain
export function domainToCompanyName(domain: string): string {
  // Remove common TLDs and format nicely
  const name = domain
    .replace(/\.(com|net|org|io|co|cards)$/, '')
    .replace(/[.-]/g, ' ')
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
  return name;
}

// Build weekly activity timeline for sparkline charts (last 8 weeks)
function buildWeeklyTimeline(timestamps: number[]): Array<{ week: string; activity: number }> {
  const now = Date.now();
  const weekMs = 7 * 24 * 60 * 60 * 1000;
  const weeks: Array<{ week: string; activity: number }> = [];
  
  // Generate last 8 weeks
  for (let i = 7; i >= 0; i--) {
    const weekStart = now - (i + 1) * weekMs;
    const weekEnd = now - i * weekMs;
    const count = timestamps.filter(t => t >= weekStart && t < weekEnd).length;
    const weekLabel = `W${8 - i}`;
    weeks.push({ week: weekLabel, activity: count });
  }
  
  return weeks;
}

export async function fetchCustomerMetrics(): Promise<CustomerMetrics[]> {
  try {
    // Fetch all data in parallel (including Coda overrides for user-edited names)
    const [tenantsResult, itemsResult, kanbanResult, , ordersResult, codaOverrides] = await Promise.all([
      queryTenants(),
      queryItems().catch(() => ({ results: [] })),
      queryKanbanCards().catch(() => ({ results: [] })),
      queryUserAccounts().catch(() => ({ results: [] })),
      queryOrders().catch(() => ({ results: [] })),
      getCustomerOverrides().catch(() => ({} as Record<string, CustomerOverride>)),
    ]);

    // Build counts per tenant from Items and Kanban (the source of truth for activity)
    const itemsByTenant = new Map<string, number>();
    const kanbanByTenant = new Map<string, number>();
    const ordersByTenant = new Map<string, number>();
    const authorsByTenant = new Map<string, Set<string>>(); // Track unique authors per tenant
    const activityDatesByTenant = new Map<string, number[]>(); // Track all activity timestamps per tenant

    // Discover all active tenant IDs from items and collect authors
    for (const item of itemsResult.results) {
      const tenantId = (item.metadata as Record<string, unknown>)?.tenantId as string;
      const author = (item as unknown as Record<string, unknown>).author as string || (item as unknown as Record<string, unknown>).createdBy as string;
      if (tenantId) {
        itemsByTenant.set(tenantId, (itemsByTenant.get(tenantId) || 0) + 1);
        if (author) {
          if (!authorsByTenant.has(tenantId)) {
            authorsByTenant.set(tenantId, new Set());
          }
          authorsByTenant.get(tenantId)!.add(author);
        }
        // Track activity date
        const createdAt = item.createdAt?.effective;
        if (createdAt) {
          if (!activityDatesByTenant.has(tenantId)) {
            activityDatesByTenant.set(tenantId, []);
          }
          activityDatesByTenant.get(tenantId)!.push(createdAt);
        }
      }
    }

    // Discover tenant IDs from kanban cards and collect authors
    for (const card of kanbanResult.results) {
      const tenantId = (card.metadata as Record<string, unknown>)?.tenantId as string;
      const author = (card as unknown as Record<string, unknown>).author as string || (card as unknown as Record<string, unknown>).createdBy as string;
      if (tenantId) {
        kanbanByTenant.set(tenantId, (kanbanByTenant.get(tenantId) || 0) + 1);
        if (author) {
          if (!authorsByTenant.has(tenantId)) {
            authorsByTenant.set(tenantId, new Set());
          }
          authorsByTenant.get(tenantId)!.add(author);
        }
        // Track activity date
        const createdAt = card.createdAt?.effective;
        if (createdAt) {
          if (!activityDatesByTenant.has(tenantId)) {
            activityDatesByTenant.set(tenantId, []);
          }
          activityDatesByTenant.get(tenantId)!.push(createdAt);
        }
      }
    }

    for (const order of ordersResult.results) {
      const tenantId = (order.metadata as Record<string, unknown>)?.tenantId as string;
      if (tenantId) {
        ordersByTenant.set(tenantId, (ordersByTenant.get(tenantId) || 0) + 1);
      }
    }

    // Build a map of tenant eId -> tenant info for naming
    const tenantInfoMap = new Map<string, { name: string; email?: string; tenant: typeof tenantsResult.results[0] }>();
    for (const tenant of tenantsResult.results) {
      const emailInfo = extractEmailInfo(tenant.payload.tenantName);
      tenantInfoMap.set(tenant.payload.eId, { 
        name: emailInfo?.email.split('@')[0] || tenant.payload.tenantName,
        email: emailInfo?.email,
        tenant 
      });
    }

    // Collect all unique tenant IDs from Items, Kanban, Orders, and the tenant roster
    const allTenantIds = new Set<string>();
    for (const tenantId of itemsByTenant.keys()) allTenantIds.add(tenantId);
    for (const tenantId of kanbanByTenant.keys()) allTenantIds.add(tenantId);
    for (const tenantId of ordersByTenant.keys()) allTenantIds.add(tenantId);
    for (const tenant of tenantsResult.results) allTenantIds.add(tenant.payload.eId);

    // Build metrics for each tenant with activity (no exclusions)
    const metrics: CustomerMetrics[] = [];
    
    for (const tenantId of allTenantIds) {
      const itemCount = itemsByTenant.get(tenantId) || 0;
      const kanbanCount = kanbanByTenant.get(tenantId) || 0;
      const orderCount = ordersByTenant.get(tenantId) || 0;
      const authors = authorsByTenant.get(tenantId) || new Set<string>();

      // Get tenant info if available
      const tenantInfo = tenantInfoMap.get(tenantId);

      // Derive company name
      let companyName: string;
      let tenantName: string;
      
      if (tenantInfo?.email) {
        const domain = tenantInfo.email.split('@')[1].toLowerCase();
        if (PUBLIC_DOMAINS.includes(domain)) {
          companyName = tenantInfo.email;
          tenantName = tenantInfo.email;
        } else {
          companyName = domainToCompanyName(domain);
          tenantName = companyName;
        }
      } else {
        // Org tenant not in personal tenants list - use tenant ID as fallback
        companyName = `Org ${tenantId.slice(0, 8)}`;
        tenantName = companyName;
      }

      // Get status and timestamps from tenant if available
      const hasActiveSubscription = tenantInfo?.tenant.payload.subscriptionReference?.state === 'ACTIVE';
      const createdAt = tenantInfo?.tenant.createdAt.effective || Date.now();
      const lastActivity = tenantInfo?.tenant.asOf.effective || Date.now();
      const daysInactive = Math.floor((Date.now() - lastActivity) / (1000 * 60 * 60 * 24));

      // Weighted Health Scoring
      // Recency: 30% - based on days since last activity
      const recencyScore = Math.max(0, 30 - Math.min(30, daysInactive));
      
      // Breadth: 25% - based on number of active users (cap at 5+ users = full score)
      const breadthScore = Math.min(25, (authors.size / 5) * 25);
      
      // Depth: 25% - based on kanban activity (cap at 50+ cards = full score)
      const depthScore = Math.min(25, (kanbanCount / 50) * 25);
      
      // Velocity: 20% - based on items + kanban combined (cap at 100+ = full score)
      const totalActivity = itemCount + kanbanCount;
      const velocityScore = Math.min(20, (totalActivity / 100) * 20);
      
      const healthScore = Math.round(recencyScore + breadthScore + depthScore + velocityScore);
      
      const healthBreakdown: HealthBreakdown = {
        recency: Math.round(recencyScore),
        breadth: Math.round(breadthScore),
        depth: Math.round(depthScore),
        velocity: Math.round(velocityScore),
      };

      // Alert Generation
      const alerts: Alert[] = [];
      
      // Churn Risk: No activity for 14+ days
      if (daysInactive >= 14) {
        alerts.push({
          type: 'churn_risk',
          severity: daysInactive >= 30 ? 'critical' : 'warning',
          message: `No activity for ${daysInactive} days`,
          suggestedAction: 'Schedule a check-in call to re-engage the customer',
        });
      }
      
      // Churn Risk: Low health score
      if (healthScore < 40) {
        alerts.push({
          type: 'churn_risk',
          severity: healthScore < 25 ? 'critical' : 'warning',
          message: `Health score critically low (${healthScore})`,
          suggestedAction: 'Review account activity and schedule intervention',
        });
      }
      
      // Expansion Opportunity: High activity and engagement
      if (totalActivity > 50 && authors.size >= 3 && daysInactive < 7) {
        alerts.push({
          type: 'expansion_opportunity',
          severity: 'info',
          message: 'High engagement with multiple active users',
          suggestedAction: 'Consider upsell conversation for additional features',
        });
      }

      // Stage based on activity (move before onboarding check)
      let stage: CustomerMetrics['stage'];
      if (orderCount > 0 || (kanbanCount > 0 && itemCount > 0)) {
        stage = 'live';
      } else if (kanbanCount > 0) {
        stage = 'training';
      } else if (itemCount > 0) {
        stage = 'deployed';
      } else {
        stage = 'signed';
      }
      
      // Onboarding Stalled: Few items after account creation
      const accountAgeDays = Math.floor((Date.now() - createdAt) / (1000 * 60 * 60 * 24));
      if (accountAgeDays > 7 && itemCount < 5 && stage !== 'live') {
        alerts.push({
          type: 'onboarding_stalled',
          severity: 'warning',
          message: `Only ${itemCount} items after ${accountAgeDays} days`,
          suggestedAction: 'Offer onboarding assistance or training session',
        });
      }

      // Resolve human-friendly name using tenant mapping
      const resolvedName = resolveTenantName(tenantId);
      const tenantMapping = getTenantInfo(tenantId);

      // Calculate lifecycle stage based on account age and activity patterns
      let lifecycleStage: LifecycleStage;
      if (accountAgeDays <= 30 && stage !== 'live') {
        lifecycleStage = 'onboarding';
      } else if (accountAgeDays <= 90 && stage !== 'live') {
        lifecycleStage = 'adoption';
      } else if (stage === 'live' && healthScore >= 70 && totalActivity > 50) {
        lifecycleStage = 'growth';
      } else if (stage === 'live' && daysInactive < 7) {
        lifecycleStage = 'mature';
      } else if (accountAgeDays > 330) {
        // Approaching 1 year - renewal territory
        lifecycleStage = 'renewal';
      } else {
        lifecycleStage = 'adoption';
      }

      // Load interactions from localStorage (CSM notes persist locally)
      const storedInteractions = getStoredInteractions(tenantId);
      
      // Priority for displayName: Coda override > tenant mapping > resolved name
      const codaOverride = codaOverrides[tenantId];
      const resolvedDisplayName = codaOverride?.displayName || tenantMapping?.name || resolvedName;

      // Build activity timeline (last 8 weeks for sparkline)
      const activityDates = activityDatesByTenant.get(tenantId) || [];
      const activityTimeline = buildWeeklyTimeline(activityDates);

      metrics.push({
        tenantId,
        tenantName,
        companyName,
        displayName: resolvedDisplayName,
        assignedCSM: codaOverride?.csm || tenantMapping?.csm,
        tier: codaOverride?.tier || tenantMapping?.tier,
        plan: tenantInfo?.tenant.payload.plan || 'Unknown',
        status: hasActiveSubscription ? 'ACTIVE' : 'Unknown',
        createdAt: new Date(createdAt).toISOString(),
        itemCount,
        kanbanCardCount: kanbanCount,
        orderCount,
        userCount: authors.size,
        lastActivityDate: new Date(lastActivity).toISOString(),
        healthScore,
        healthBreakdown,
        daysInactive,
        alerts,
        stage,
        lifecycleStage,
        interactions: storedInteractions,
        accountAgeDays,
        users: Array.from(authors).map(authorId => ({ tenantId: authorId, email: authorId, name: authorId.slice(0, 8) })),
        activityTimeline,
      });
    }

    // Sort by stage priority and then by activity
    const stagePriority = { live: 0, training: 1, deployed: 2, signed: 3 };
    metrics.sort((a, b) => {
      const stageCompare = stagePriority[a.stage] - stagePriority[b.stage];
      if (stageCompare !== 0) return stageCompare;
      return (b.itemCount + b.kanbanCardCount) - (a.itemCount + a.kanbanCardCount);
    });
    return metrics;
  } catch (error) {
    console.error('Failed to fetch customer metrics:', error);
    throw error;
  }
}

// Customer Details interface for detail view
export interface CustomerDetails {
  tenantId: string;
  tenantName: string;
  companyName: string;
  plan: string;
  status: string;
  createdAt: string;
  healthScore: number;
  stage: 'signed' | 'deployed' | 'training' | 'live';
  users: Array<{
    id: string;
    name: string;
    email: string;
  }>;
  items: Array<{
    id: string;
    name: string;
    sku?: string;
    createdAt: string;
  }>;
  kanbanCards: Array<{
    id: string;
    title: string;
    status: string;
    createdAt: string;
  }>;
}

export async function fetchCustomerDetails(tenantIdOrDomain: string): Promise<CustomerDetails> {
  // Determine if input is a tenant ID (UUID) or domain/email
  const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(tenantIdOrDomain);
  
  // Fetch all data
  const [tenantsResult, itemsResult, kanbanResult] = await Promise.all([
    queryTenants(),
    queryItems().catch(() => ({ results: [] })),
    queryKanbanCards().catch(() => ({ results: [] })),
  ]);

  let targetTenantId: string;
  let companyName: string;
  let tenantInfo: typeof tenantsResult.results[0] | undefined;

  if (isUUID) {
    // Direct tenant ID lookup
    targetTenantId = tenantIdOrDomain;
    tenantInfo = tenantsResult.results.find(t => t.payload.eId === tenantIdOrDomain);
    
    if (tenantInfo) {
      const emailInfo = extractEmailInfo(tenantInfo.payload.tenantName);
      if (emailInfo) {
        companyName = PUBLIC_DOMAINS.includes(emailInfo.domain.toLowerCase())
          ? emailInfo.email
          : domainToCompanyName(emailInfo.domain);
      } else {
        companyName = tenantInfo.payload.tenantName;
      }
    } else {
      // Org tenant not in personal tenants list
      companyName = `Org ${tenantIdOrDomain.slice(0, 8)}`;
    }
  } else {
    // Domain or email lookup
    const isPublicDomainLookup = tenantIdOrDomain.includes('@');
    const matchingTenant = tenantsResult.results.find(tenant => {
      const emailInfo = extractEmailInfo(tenant.payload.tenantName);
      if (!emailInfo) return false;
      
      if (isPublicDomainLookup) {
        return emailInfo.email.toLowerCase() === tenantIdOrDomain.toLowerCase();
      } else {
        return emailInfo.domain.toLowerCase() === tenantIdOrDomain.toLowerCase();
      }
    });

    if (!matchingTenant) {
      throw new Error(`No tenants found for ${tenantIdOrDomain}`);
    }

    targetTenantId = matchingTenant.payload.eId;
    tenantInfo = matchingTenant;
    companyName = isPublicDomainLookup 
      ? tenantIdOrDomain 
      : domainToCompanyName(tenantIdOrDomain);
  }

  // Get items for this tenant
  const tenantItems = itemsResult.results.filter(item => {
    const itemTenantId = (item.metadata as Record<string, unknown>)?.tenantId as string;
    return itemTenantId === targetTenantId;
  });

  // Get kanban cards for this tenant
  const tenantKanbans = kanbanResult.results.filter(card => {
    const cardTenantId = (card.metadata as Record<string, unknown>)?.tenantId as string;
    return cardTenantId === targetTenantId;
  });

  // Collect unique authors from items and kanban
  const authors = new Set<string>();
  for (const item of tenantItems) {
    const author = (item as unknown as Record<string, unknown>).author as string || (item as unknown as Record<string, unknown>).createdBy as string;
    if (author) authors.add(author);
  }
  for (const card of tenantKanbans) {
    const author = (card as unknown as Record<string, unknown>).author as string || (card as unknown as Record<string, unknown>).createdBy as string;
    if (author) authors.add(author);
  }

  // Build items list
  const items = tenantItems.map(item => ({
    id: item.rId,
    name: item.payload?.name || 'Unnamed Item',
    sku: item.payload?.sku,
    createdAt: new Date((item as unknown as { createdAt: { effective: number } }).createdAt?.effective || Date.now()).toISOString(),
  }));

  // Build kanban cards list
  const kanbanCards = tenantKanbans.map(card => ({
    id: card.rId,
    title: card.payload?.item?.name || card.payload.title || 'Untitled Card',
    status: card.payload.state || 'Unknown',
    createdAt: new Date(card.createdAt.effective).toISOString(),
  }));

  // Build users list from authors
  const users = Array.from(authors).map(authorId => ({
    id: authorId,
    name: authorId.slice(0, 8),
    email: authorId,
  }));

  // Calculate health and stage
  const totalActivity = items.length + kanbanCards.length;
  let healthScore = 30;
  const hasActiveSubscription = tenantInfo?.payload.subscriptionReference?.state === 'ACTIVE';
  if (hasActiveSubscription) healthScore += 20;
  if (totalActivity > 0) healthScore += 20;
  if (totalActivity > 10) healthScore += 15;
  if (totalActivity > 50) healthScore += 15;
  healthScore = Math.min(100, healthScore);

  let stage: CustomerDetails['stage'];
  if (kanbanCards.length > 0 && items.length > 0) {
    stage = 'live';
  } else if (kanbanCards.length > 0) {
    stage = 'training';
  } else if (items.length > 0) {
    stage = 'deployed';
  } else {
    stage = 'signed';
  }

  const createdAt = tenantInfo?.createdAt.effective || Date.now();

  return {
    tenantId: targetTenantId,
    tenantName: companyName,
    companyName,
    plan: tenantInfo?.payload.plan || 'Unknown',
    status: hasActiveSubscription ? 'ACTIVE' : 'Unknown',
    createdAt: new Date(createdAt).toISOString(),
    healthScore,
    stage,
    users,
    items,
    kanbanCards,
  };
}

// ============================================
// Activity Feed & Aggregate APIs
// ============================================

export interface ActivityEvent {
  id: string;
  type: 'item_created' | 'card_created' | 'card_state_change' | 'order_placed';
  tenantId: string;
  tenantName: string;
  timestamp: number;
  details: {
    name?: string;
    previousState?: string;
    newState?: string;
    orderNumber?: string;
    itemSku?: string;
  };
}

export interface ActivityAggregate {
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

// Local helper to resolve tenant names using manual mappings
function resolveTenantNameLocal(tenantId: string): string {
  const info = TENANT_NAMES[tenantId];
  if (info) return info.name;
  
  // Fallback to abbreviated ID
  if (!tenantId || tenantId === 'unknown') return 'Unknown Org';
  return `Org ${tenantId.slice(0, 8)}`;
}

// Fetch recent activity events for live feed
export async function fetchActivityEvents(options?: {
  since?: number;
  tenantId?: string;
  limit?: number;
}): Promise<ActivityEvent[]> {
  const limit = options?.limit || 100;
  
  // Fetch all entities in parallel
  const [itemsResult, kanbanResult, ordersResult] = await Promise.all([
    queryItems().catch(() => ({ results: [] })),
    queryKanbanCards().catch(() => ({ results: [] })),
    queryOrders().catch(() => ({ results: [] })),
  ]);

  // Build tenant name map (support both rId and eId keys)
  const tenantNames = new Map<string, string>();
  const tenantsResult = await queryTenants().catch(() => ({ results: [] }));
  for (const tenant of tenantsResult.results) {
    const email = tenant.payload.tenantName?.match(/Personal tenant for (.+)/)?.[1];
    if (email) {
      const domain = email.split('@')[1]?.toLowerCase();
      if (domain && !['gmail.com', 'icloud.com', 'outlook.com'].includes(domain)) {
        const resolved = domainToCompanyName(domain);
        tenantNames.set(tenant.rId, resolved);
        tenantNames.set(tenant.payload.eId, resolved);
      } else {
        tenantNames.set(tenant.rId, email);
        tenantNames.set(tenant.payload.eId, email);
      }
    } else {
      const fallback = tenant.payload.company?.name || `Org ${tenant.rId.slice(0, 8)}`;
      tenantNames.set(tenant.rId, fallback);
      tenantNames.set(tenant.payload.eId, fallback);
    }
  }

  const events: ActivityEvent[] = [];

  // Process items
  for (const item of itemsResult.results) {
    const tenantId = (item.metadata as Record<string, unknown>)?.tenantId as string
      || (item.metadata as Record<string, unknown>)?.tenant as string
      || 'unknown';
    if (options?.tenantId && tenantId !== options.tenantId) continue;
    
    events.push({
      id: `item-${item.rId}`,
      type: 'item_created',
      tenantId,
      tenantName: tenantNames.get(tenantId) || resolveTenantNameLocal(tenantId),
      timestamp: item.createdAt.effective,
      details: {
        name: item.payload.name || item.payload.sku || 'Unnamed item',
        itemSku: item.payload.sku,
      },
    });
  }

  // Process kanban cards
  for (const card of kanbanResult.results) {
    const tenantId = (card.metadata as Record<string, unknown>)?.tenantId as string
      || (card.metadata as Record<string, unknown>)?.tenant as string
      || 'unknown';
    if (options?.tenantId && tenantId !== options.tenantId) continue;
    
    events.push({
      id: `card-${card.rId}`,
      type: 'card_created',
      tenantId,
      tenantName: tenantNames.get(tenantId) || resolveTenantNameLocal(tenantId),
      timestamp: card.createdAt.effective,
      details: {
        name: card.payload.title || card.payload.item?.name || 'Unnamed card',
        newState: card.payload.state,
      },
    });
  }

  // Process orders
  for (const order of ordersResult.results) {
    const tenantId = (order.metadata as Record<string, unknown>)?.tenantId as string
      || (order.metadata as Record<string, unknown>)?.tenant as string
      || 'unknown';
    if (options?.tenantId && tenantId !== options.tenantId) continue;
    
    events.push({
      id: `order-${order.rId}`,
      type: 'order_placed',
      tenantId,
      tenantName: tenantNames.get(tenantId) || resolveTenantNameLocal(tenantId),
      timestamp: order.createdAt.effective,
      details: {
        orderNumber: order.rId.slice(0, 8),
        name: `Order #${order.rId.slice(0, 8)}`,
      },
    });
  }

  // Filter by time if specified
  const since = options?.since || 0;
  const filtered = events.filter(e => e.timestamp >= since);

  // Sort by timestamp descending (most recent first)
  filtered.sort((a, b) => b.timestamp - a.timestamp);

  return filtered.slice(0, limit);
}

// Fetch aggregated activity data for overview charts
export async function fetchActivityAggregate(options?: {
  days?: number;
}): Promise<ActivityAggregate> {
  const days = options?.days || 30;
  const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;

  // Fetch all events
  const events = await fetchActivityEvents({ since: cutoff, limit: 10000 });

  // Build timeline by date
  const timelineMap = new Map<string, { items: number; cards: number; orders: number }>();
  const customerMap = new Map<string, {
    tenantName: string;
    items: number;
    cards: number;
    orders: number;
    dailyActivity: Map<string, number>;
  }>();

  // Initialize timeline for all days
  for (let i = 0; i < days; i++) {
    const date = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
    const dateStr = date.toISOString().split('T')[0];
    timelineMap.set(dateStr, { items: 0, cards: 0, orders: 0 });
  }

  // Process events
  for (const event of events) {
    const dateStr = new Date(event.timestamp).toISOString().split('T')[0];
    
    // Update timeline
    const dayData = timelineMap.get(dateStr);
    if (dayData) {
      if (event.type === 'item_created') dayData.items++;
      else if (event.type === 'card_created' || event.type === 'card_state_change') dayData.cards++;
      else if (event.type === 'order_placed') dayData.orders++;
    }

    // Update customer data
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
    else if (event.type === 'card_created' || event.type === 'card_state_change') customer.cards++;
    else if (event.type === 'order_placed') customer.orders++;

    // Track daily activity for sparkline
    const currentDaily = customer.dailyActivity.get(dateStr) || 0;
    customer.dailyActivity.set(dateStr, currentDaily + 1);
  }

  // Convert timeline to array (sorted by date ascending)
  const timeline = Array.from(timelineMap.entries())
    .map(([date, data]) => ({ date, ...data }))
    .sort((a, b) => a.date.localeCompare(b.date));

  // Convert customer data to array with trends
  const byCustomer = Array.from(customerMap.entries())
    .map(([tenantId, data]) => {
      // Build 7-day trend (last 7 days)
      const trend: number[] = [];
      for (let i = 6; i >= 0; i--) {
        const date = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
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
    .sort((a, b) => b.total - a.total); // Sort by total activity descending

  return { timeline, byCustomer };
}
