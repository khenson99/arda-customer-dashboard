/**
 * Alert State Persistence
 * 
 * Manages localStorage persistence for alert states, notes, and action history.
 * This enables offline-first functionality while we build out the backend.
 */

import type { AlertStatus, AlertOutcome } from './types/account';

// ============================================================================
// Types
// ============================================================================

export interface AlertStateOverride {
  alertId: string;
  status: AlertStatus;
  acknowledgedAt?: string;
  acknowledgedBy?: string;
  snoozedUntil?: string;
  snoozeReason?: string;
  resolvedAt?: string;
  resolvedBy?: string;
  outcome?: AlertOutcome;
  assignedTo?: string;
  assignedToName?: string;
  playbookId?: string;
  playbookStartedAt?: string;
  playbookProgress?: number;
  updatedAt: string;
}

export interface AlertNote {
  id: string;
  alertId: string;
  content: string;
  createdBy: string;
  createdAt: string;
}

export interface AlertActionLog {
  id: string;
  alertId: string;
  action: 'acknowledged' | 'snoozed' | 'resolved' | 'assigned' | 'note_added' | 'playbook_started' | 'playbook_completed' | 'reopened';
  actor: string;
  actorName: string;
  timestamp: string;
  details?: Record<string, unknown>;
}

export interface SnoozeDuration {
  label: string;
  days: number;
}

export const SNOOZE_DURATIONS: SnoozeDuration[] = [
  { label: '1 day', days: 1 },
  { label: '3 days', days: 3 },
  { label: '1 week', days: 7 },
  { label: '2 weeks', days: 14 },
  { label: 'Custom', days: -1 },
];

export type OutcomeResult = 'success' | 'partial' | 'failed' | 'not_applicable';

export const OUTCOME_OPTIONS: { value: OutcomeResult; label: string; icon: string }[] = [
  { value: 'success', label: 'Resolved Successfully', icon: '✅' },
  { value: 'partial', label: 'Partially Resolved', icon: '🔶' },
  { value: 'failed', label: 'Resolution Failed', icon: '❌' },
  { value: 'not_applicable', label: 'Not Applicable', icon: '➖' },
];

// ============================================================================
// LocalStorage Keys
// ============================================================================

const STORAGE_KEYS = {
  ALERT_STATES: 'arda_alert_states',
  ALERT_NOTES: 'arda_alert_notes',
  ALERT_ACTION_LOG: 'arda_alert_action_log',
  CURRENT_USER: 'arda_current_user',
} as const;

// ============================================================================
// User Context (simplified - would come from auth in production)
// ============================================================================

export interface CurrentUser {
  id: string;
  name: string;
  email: string;
}

export function getCurrentUser(): CurrentUser {
  const stored = localStorage.getItem(STORAGE_KEYS.CURRENT_USER);
  if (stored) {
    return JSON.parse(stored);
  }
  // Default user for demo
  return {
    id: 'csm-001',
    name: 'Demo CSM',
    email: 'demo@arda.cards',
  };
}

export function setCurrentUser(user: CurrentUser): void {
  localStorage.setItem(STORAGE_KEYS.CURRENT_USER, JSON.stringify(user));
}

// ============================================================================
// Alert State Management
// ============================================================================

function getAlertStates(): Map<string, AlertStateOverride> {
  const stored = localStorage.getItem(STORAGE_KEYS.ALERT_STATES);
  if (!stored) return new Map();
  
  try {
    const parsed = JSON.parse(stored) as Record<string, AlertStateOverride>;
    return new Map(Object.entries(parsed));
  } catch {
    return new Map();
  }
}

function saveAlertStates(states: Map<string, AlertStateOverride>): void {
  const obj = Object.fromEntries(states);
  localStorage.setItem(STORAGE_KEYS.ALERT_STATES, JSON.stringify(obj));
}

export function getAlertState(alertId: string): AlertStateOverride | undefined {
  return getAlertStates().get(alertId);
}

export function updateAlertState(alertId: string, updates: Partial<AlertStateOverride>): AlertStateOverride {
  const states = getAlertStates();
  const existing = states.get(alertId) || { alertId, status: 'open' as AlertStatus, updatedAt: '' };
  
  const updated: AlertStateOverride = {
    ...existing,
    ...updates,
    alertId,
    updatedAt: new Date().toISOString(),
  };
  
  states.set(alertId, updated);
  saveAlertStates(states);
  
  return updated;
}

export function getAllAlertStates(): Map<string, AlertStateOverride> {
  return getAlertStates();
}

// ============================================================================
// Alert Actions
// ============================================================================

export function acknowledgeAlert(alertId: string): AlertStateOverride {
  const user = getCurrentUser();
  const state = updateAlertState(alertId, {
    status: 'acknowledged',
    acknowledgedAt: new Date().toISOString(),
    acknowledgedBy: user.id,
  });
  
  logAlertAction(alertId, 'acknowledged', {});
  return state;
}

export function snoozeAlert(alertId: string, days: number, reason?: string): AlertStateOverride {
  const snoozedUntil = new Date();
  snoozedUntil.setDate(snoozedUntil.getDate() + days);
  
  const state = updateAlertState(alertId, {
    status: 'snoozed',
    snoozedUntil: snoozedUntil.toISOString(),
    snoozeReason: reason,
  });
  
  logAlertAction(alertId, 'snoozed', { days, until: snoozedUntil.toISOString(), reason });
  return state;
}

export function resolveAlert(alertId: string, outcome: OutcomeResult, notes?: string): AlertStateOverride {
  const user = getCurrentUser();
  const state = updateAlertState(alertId, {
    status: 'resolved',
    resolvedAt: new Date().toISOString(),
    resolvedBy: user.id,
    outcome: {
      result: outcome,
      notes,
      resolvedBy: user.name,
    },
  });
  
  logAlertAction(alertId, 'resolved', { outcome, notes });
  return state;
}

export function assignAlert(alertId: string, assigneeId: string, assigneeName: string): AlertStateOverride {
  const state = updateAlertState(alertId, {
    assignedTo: assigneeId,
    assignedToName: assigneeName,
  });
  
  logAlertAction(alertId, 'assigned', { assigneeId, assigneeName });
  return state;
}

export function reopenAlert(alertId: string): AlertStateOverride {
  const state = updateAlertState(alertId, {
    status: 'open',
    acknowledgedAt: undefined,
    acknowledgedBy: undefined,
    snoozedUntil: undefined,
    snoozeReason: undefined,
    resolvedAt: undefined,
    resolvedBy: undefined,
    outcome: undefined,
  });
  
  logAlertAction(alertId, 'reopened', {});
  return state;
}

export function startPlaybook(alertId: string, playbookId: string): AlertStateOverride {
  const state = updateAlertState(alertId, {
    status: 'in_progress',
    playbookId,
    playbookStartedAt: new Date().toISOString(),
    playbookProgress: 0,
  });
  
  logAlertAction(alertId, 'playbook_started', { playbookId });
  return state;
}

export function updatePlaybookProgress(alertId: string, progress: number): AlertStateOverride {
  return updateAlertState(alertId, {
    playbookProgress: progress,
  });
}

export function completePlaybook(alertId: string): AlertStateOverride {
  const state = updateAlertState(alertId, {
    playbookProgress: 100,
  });
  
  logAlertAction(alertId, 'playbook_completed', {});
  return state;
}

// ============================================================================
// Alert Notes
// ============================================================================

function getAllNotes(): AlertNote[] {
  const stored = localStorage.getItem(STORAGE_KEYS.ALERT_NOTES);
  if (!stored) return [];
  
  try {
    return JSON.parse(stored) as AlertNote[];
  } catch {
    return [];
  }
}

function saveNotes(notes: AlertNote[]): void {
  localStorage.setItem(STORAGE_KEYS.ALERT_NOTES, JSON.stringify(notes));
}

export function getAlertNotes(alertId: string): AlertNote[] {
  return getAllNotes()
    .filter(note => note.alertId === alertId)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

export function addAlertNote(alertId: string, content: string): AlertNote {
  const user = getCurrentUser();
  const note: AlertNote = {
    id: `note-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    alertId,
    content,
    createdBy: user.name,
    createdAt: new Date().toISOString(),
  };
  
  const notes = getAllNotes();
  notes.push(note);
  saveNotes(notes);
  
  logAlertAction(alertId, 'note_added', { noteId: note.id });
  
  return note;
}

export function deleteAlertNote(noteId: string): void {
  const notes = getAllNotes().filter(n => n.id !== noteId);
  saveNotes(notes);
}

// ============================================================================
// Action Log
// ============================================================================

function getAllActionLogs(): AlertActionLog[] {
  const stored = localStorage.getItem(STORAGE_KEYS.ALERT_ACTION_LOG);
  if (!stored) return [];
  
  try {
    return JSON.parse(stored) as AlertActionLog[];
  } catch {
    return [];
  }
}

function saveActionLogs(logs: AlertActionLog[]): void {
  localStorage.setItem(STORAGE_KEYS.ALERT_ACTION_LOG, JSON.stringify(logs));
}

export function logAlertAction(alertId: string, action: AlertActionLog['action'], details: Record<string, unknown>): AlertActionLog {
  const user = getCurrentUser();
  const log: AlertActionLog = {
    id: `log-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    alertId,
    action,
    actor: user.id,
    actorName: user.name,
    timestamp: new Date().toISOString(),
    details,
  };
  
  const logs = getAllActionLogs();
  logs.push(log);
  saveActionLogs(logs);
  
  return log;
}

export function getAlertActionLog(alertId: string): AlertActionLog[] {
  return getAllActionLogs()
    .filter(log => log.alertId === alertId)
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
}

// ============================================================================
// SLA Calculations
// ============================================================================

export interface SLAInfo {
  deadline: string | undefined;
  status: 'on_track' | 'at_risk' | 'breached' | 'none';
  timeRemaining: string;
  hoursRemaining: number;
  percentRemaining: number;
}

export function calculateSLA(slaDeadline: string | undefined, createdAt: string): SLAInfo {
  if (!slaDeadline) {
    return {
      deadline: undefined,
      status: 'none',
      timeRemaining: 'No SLA',
      hoursRemaining: Infinity,
      percentRemaining: 100,
    };
  }
  
  const now = Date.now();
  const deadline = new Date(slaDeadline).getTime();
  const created = new Date(createdAt).getTime();
  
  const totalDuration = deadline - created;
  const remaining = deadline - now;
  const percentRemaining = Math.max(0, Math.min(100, (remaining / totalDuration) * 100));
  
  const hoursRemaining = remaining / (1000 * 60 * 60);
  
  let status: SLAInfo['status'];
  if (remaining <= 0) {
    status = 'breached';
  } else if (percentRemaining <= 25) {
    status = 'at_risk';
  } else {
    status = 'on_track';
  }
  
  let timeRemaining: string;
  if (remaining <= 0) {
    const overBy = Math.abs(remaining);
    const hours = Math.floor(overBy / (1000 * 60 * 60));
    if (hours >= 24) {
      timeRemaining = `${Math.floor(hours / 24)}d overdue`;
    } else {
      timeRemaining = `${hours}h overdue`;
    }
  } else {
    const hours = Math.floor(remaining / (1000 * 60 * 60));
    const minutes = Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60));
    if (hours >= 24) {
      const days = Math.floor(hours / 24);
      const remainingHours = hours % 24;
      timeRemaining = `${days}d ${remainingHours}h`;
    } else if (hours > 0) {
      timeRemaining = `${hours}h ${minutes}m`;
    } else {
      timeRemaining = `${minutes}m`;
    }
  }
  
  return {
    deadline: slaDeadline,
    status,
    timeRemaining,
    hoursRemaining,
    percentRemaining,
  };
}

// ============================================================================
// Playbook Definitions (would come from API in production)
// ============================================================================

export interface PlaybookTask {
  id: string;
  title: string;
  description?: string;
  completed: boolean;
}

export interface PlaybookDefinition {
  id: string;
  name: string;
  description: string;
  alertTypes: string[];
  estimatedDays: number;
  tasks: Omit<PlaybookTask, 'id' | 'completed'>[];
}

export const PLAYBOOKS: PlaybookDefinition[] = [
  {
    id: 'churn-risk-response',
    name: 'Churn Risk Response',
    description: 'Structured approach to address churn signals and re-engage the customer',
    alertTypes: ['churn_risk', 'usage_decline', 'low_engagement'],
    estimatedDays: 14,
    tasks: [
      { title: 'Review account health data', description: 'Analyze usage trends, feature adoption, and engagement metrics' },
      { title: 'Schedule check-in call', description: 'Reach out to primary contact for a discovery conversation' },
      { title: 'Identify root cause', description: 'Document specific reasons for disengagement' },
      { title: 'Create action plan', description: 'Develop tailored plan to address identified issues' },
      { title: 'Executive outreach', description: 'If needed, involve executive sponsor' },
      { title: 'Follow-up within 7 days', description: 'Check on progress and adjust plan as needed' },
    ],
  },
  {
    id: 'expansion-opportunity',
    name: 'Expansion Opportunity',
    description: 'Capture expansion revenue by addressing capacity or feature needs',
    alertTypes: ['expansion_opportunity'],
    estimatedDays: 30,
    tasks: [
      { title: 'Validate expansion signal', description: 'Confirm the usage pattern indicates genuine need' },
      { title: 'Identify decision makers', description: 'Map stakeholders involved in purchase decisions' },
      { title: 'Prepare business case', description: 'Document ROI and value delivered so far' },
      { title: 'Schedule expansion conversation', description: 'Present upsell/cross-sell opportunity' },
      { title: 'Create proposal', description: 'Generate custom quote or proposal' },
      { title: 'Follow up on decision', description: 'Track progress to close' },
    ],
  },
  {
    id: 'onboarding-rescue',
    name: 'Onboarding Rescue',
    description: 'Get stalled onboarding back on track',
    alertTypes: ['onboarding_stalled'],
    estimatedDays: 7,
    tasks: [
      { title: 'Identify blockers', description: 'Determine what is preventing progress' },
      { title: 'Schedule rescue session', description: 'Intensive support call to work through issues' },
      { title: 'Provide additional resources', description: 'Share relevant documentation or training' },
      { title: 'Set clear milestones', description: 'Define next 7-day goals' },
      { title: 'Daily check-ins', description: 'Brief daily touchpoints until back on track' },
    ],
  },
  {
    id: 'champion-transition',
    name: 'Champion Transition',
    description: 'Maintain relationship when key contact leaves',
    alertTypes: ['champion_left'],
    estimatedDays: 21,
    tasks: [
      { title: 'Confirm departure', description: 'Verify the champion change and timing' },
      { title: 'Identify new champion', description: 'Find who is taking over responsibilities' },
      { title: 'Request introduction', description: 'Get warm introduction from departing champion' },
      { title: 'Schedule onboarding', description: 'Brief new contact on account status and goals' },
      { title: 'Update stakeholder map', description: 'Document new relationship structure' },
      { title: 'Re-establish success plan', description: 'Align on goals with new champion' },
    ],
  },
  {
    id: 'renewal-preparation',
    name: 'Renewal Preparation',
    description: 'Proactive renewal planning and execution',
    alertTypes: ['renewal_approaching'],
    estimatedDays: 60,
    tasks: [
      { title: 'Review account performance', description: 'Prepare renewal deck with value delivered' },
      { title: 'Identify expansion opportunities', description: 'Look for upsell potential' },
      { title: 'Gauge sentiment', description: 'Informal check-in on satisfaction' },
      { title: 'Schedule QBR', description: 'Formal review with stakeholders' },
      { title: 'Send renewal proposal', description: 'Initiate commercial discussion' },
      { title: 'Negotiate and close', description: 'Work through any objections' },
    ],
  },
];

export function getRecommendedPlaybook(alertType: string): PlaybookDefinition | undefined {
  return PLAYBOOKS.find(p => p.alertTypes.includes(alertType));
}

// ============================================================================
// CSM Team (would come from API in production)
// ============================================================================

export interface TeamMember {
  id: string;
  name: string;
  email: string;
  role: 'csm' | 'manager' | 'exec';
}

export const TEAM_MEMBERS: TeamMember[] = [
  { id: 'csm-001', name: 'Demo CSM', email: 'demo@arda.cards', role: 'csm' },
  { id: 'csm-002', name: 'Sarah Chen', email: 'sarah@arda.cards', role: 'csm' },
  { id: 'csm-003', name: 'Mike Johnson', email: 'mike@arda.cards', role: 'csm' },
  { id: 'csm-004', name: 'Lisa Thompson', email: 'lisa@arda.cards', role: 'manager' },
  { id: 'csm-005', name: 'David Park', email: 'david@arda.cards', role: 'exec' },
];
