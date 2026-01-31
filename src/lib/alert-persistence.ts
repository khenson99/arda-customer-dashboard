/**
 * Alert Persistence (server-backed)
 * Thin wrappers around the CS alerts API.
 */

import type { AlertStatus, AlertOutcome, AlertActionLog, AlertNote } from './types/account';
import { updateAlert, addAlertNote as addAlertNoteApi } from './api/cs-api';

// User context (placeholder auth)
export interface CurrentUser {
  id: string;
  name: string;
  email: string;
}

const CURRENT_USER_KEY = 'arda_current_user';

export function getCurrentUser(): CurrentUser {
  const stored = typeof localStorage !== 'undefined' ? localStorage.getItem(CURRENT_USER_KEY) : null;
  if (stored) return JSON.parse(stored);
  return { id: 'csm-001', name: 'Demo CSM', email: 'demo@arda.cards' };
}

export function setCurrentUser(user: CurrentUser): void {
  if (typeof localStorage === 'undefined') return;
  localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(user));
}

// Alert state overrides (no-op client side; server is source of truth)
export function getAlertState(_alertId: string): undefined {
  return undefined;
}
export function getAllAlertStates(): Map<string, never> {
  return new Map();
}

export async function acknowledgeAlert(alertId: string): Promise<void> {
  const user = getCurrentUser();
  await updateAlert(alertId, {
    status: 'acknowledged' as AlertStatus,
    acknowledgedAt: new Date().toISOString(),
    acknowledgedBy: user.id,
  });
}

export async function snoozeAlert(alertId: string, days: number, reason?: string): Promise<void> {
  const until = new Date();
  until.setDate(until.getDate() + days);
  await updateAlert(alertId, {
    status: 'snoozed' as AlertStatus,
    snoozedUntil: until.toISOString(),
    snoozeReason: reason,
  });
}

export type OutcomeResult = 'success' | 'partial' | 'failed' | 'not_applicable';

export async function resolveAlert(alertId: string, outcome: OutcomeResult, notes?: string): Promise<void> {
  const user = getCurrentUser();
  await updateAlert(alertId, {
    status: 'resolved' as AlertStatus,
    resolvedAt: new Date().toISOString(),
    resolvedBy: user.id,
    outcome: {
      result: outcome,
      notes,
      resolvedBy: user.name,
    } as AlertOutcome,
  });
}

export async function assignAlert(alertId: string, assigneeId: string, assigneeName: string): Promise<void> {
  await updateAlert(alertId, {
    ownerId: assigneeId,
    ownerName: assigneeName,
  });
}

export async function reopenAlert(alertId: string): Promise<void> {
  await updateAlert(alertId, {
    status: 'open' as AlertStatus,
    acknowledgedAt: undefined,
    acknowledgedBy: undefined,
    snoozedUntil: undefined,
    snoozeReason: undefined,
    resolvedAt: undefined,
    resolvedBy: undefined,
    outcome: undefined,
  });
}

export interface SnoozeDuration { label: string; days: number; }
export const SNOOZE_DURATIONS: SnoozeDuration[] = [
  { label: '1 day', days: 1 },
  { label: '3 days', days: 3 },
  { label: '1 week', days: 7 },
  { label: '2 weeks', days: 14 },
  { label: 'Custom', days: -1 },
];

export const OUTCOME_OPTIONS = [
  { value: 'success', label: 'Resolved Successfully', icon: '✅' },
  { value: 'partial', label: 'Partially Resolved', icon: '🔶' },
  { value: 'failed', label: 'Resolution Failed', icon: '❌' },
  { value: 'not_applicable', label: 'Not Applicable', icon: '➖' },
] as const;

export function calculateSLA(slaDeadline?: string, createdAt?: string) {
  if (!slaDeadline || !createdAt) return { status: 'none', remainingHours: null, overdueHours: null };
  const now = Date.now();
  const deadline = new Date(slaDeadline).getTime();
  const remainingMs = deadline - now;
  return {
    status: remainingMs < 0 ? 'breached' : remainingMs < 6 * 3600 * 1000 ? 'at_risk' : 'on_track',
    remainingHours: remainingMs > 0 ? Math.round(remainingMs / 3600000) : null,
    overdueHours: remainingMs < 0 ? Math.round(Math.abs(remainingMs) / 3600000) : null,
  };
}

// Notes and action log now live on the alert payload from the API.
export function getAlertNotes(_alertId: string, alerts?: { id: string; notes?: AlertNote[] }[]): AlertNote[] {
  const alert = alerts?.find(a => a.id === _alertId);
  return alert?.notes || [];
}

export function getAlertActionLog(_alertId: string, alerts?: { id: string; actionLog?: AlertActionLog[] }[]): AlertActionLog[] {
  const alert = alerts?.find(a => a.id === _alertId);
  return alert?.actionLog || [];
}

export async function addAlertNote(alertId: string, content: string): Promise<void> {
  await addAlertNoteApi(alertId, {
    content,
    createdBy: getCurrentUser().name,
  });
}

// Lightweight stubs for playbooks/teams to keep UI functional.
export const TEAM_MEMBERS = [
  { id: 'csm-001', name: 'Demo CSM', email: 'demo@arda.cards', role: 'csm' },
];

export const PLAYBOOKS = [
  { 
    id: 'churn-intervention', 
    name: 'Churn Intervention', 
    description: 'Stabilize health, rebuild executive confidence, and secure renewal.',
    estimatedDays: 14,
    alertTypes: ['churn_risk', 'usage_decline', 'health_drop'],
    tasks: [
      { title: 'Book health check with champion', description: 'Schedule a 30-minute sync to review objectives and recent changes.' },
      { title: 'Usage deep dive', description: 'Pull product analytics to identify drop-off points.' },
      { title: 'Executive update email', description: 'Send concise plan and ask for exec sponsor alignment.' },
      { title: 'Adoption play', description: 'Roll out quick wins and enablement resources.' },
    ],
  },
];

export function getRecommendedPlaybook(_type: string) {
  return PLAYBOOKS[0];
}

export async function startPlaybook(alertId: string, playbookId: string) {
  const user = getCurrentUser();
  await updateAlert(alertId, {
    playbookId,
    playbookProgress: 0,
    actionLogEntry: {
      id: `log-${Date.now()}`,
      alertId,
      action: 'playbook_started',
      actor: user.id,
      actorName: user.name,
      timestamp: new Date().toISOString(),
      details: { playbookId },
    },
  } as any);
}

export async function updatePlaybookProgress(alertId: string, progress: number) {
  await updateAlert(alertId, { playbookProgress: progress } as any);
}

export async function completePlaybook(alertId: string) {
  const user = getCurrentUser();
  await updateAlert(alertId, {
    playbookProgress: 100,
    actionLogEntry: {
      id: `log-${Date.now()}`,
      alertId,
      action: 'playbook_completed',
      actor: user.id,
      actorName: user.name,
      timestamp: new Date().toISOString(),
    },
  } as any);
}
