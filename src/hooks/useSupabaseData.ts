/**
 * Supabase Data Hooks
 * 
 * React hooks for CRUD operations on Supabase tables with localStorage fallback.
 * These hooks provide seamless data persistence whether Supabase is configured or not.
 */

import { useState, useEffect, useCallback } from 'react';
import {
  getSupabaseClient,
  isSupabaseConfigured,
  type TaskRow,
  type TaskInsert,
  type TaskUpdate,
  type SuccessPlanRow,
  type SuccessPlanInsert,
  type SuccessPlanUpdate,
  type EmailRow,
  type EmailInsert,
  type AlertStateRow,
  type AlertStateInsert,
  type AlertStateUpdate,
} from '../lib/supabase-client';
import type { Interaction, StoredTask } from '../lib/arda-client';
import type { SuccessPlan, Goal, Milestone } from '../lib/types/account';

const API_BASE = '/api/cs/accounts';

// ============================================================================
// SHARED UTILITIES
// ============================================================================

interface DataState<T> {
  data: T;
  isLoading: boolean;
  error: Error | null;
  isFromCache: boolean;
}

type CacheEnvelope<T> = {
  data: T;
  savedAt: number;
};

const LOCAL_CACHE_DEFAULT_TTL_MS = 5 * 60 * 1000; // 5 minutes
const INTERACTIONS_CACHE_TTL_MS = LOCAL_CACHE_DEFAULT_TTL_MS;
const TASKS_CACHE_TTL_MS = LOCAL_CACHE_DEFAULT_TTL_MS;
const SUCCESS_PLAN_CACHE_TTL_MS = 10 * 60 * 1000;
const EMAILS_CACHE_TTL_MS = 10 * 60 * 1000;
const ALERT_STATES_CACHE_TTL_MS = LOCAL_CACHE_DEFAULT_TTL_MS;

function isCacheEnvelope<T>(value: unknown): value is CacheEnvelope<T> {
  if (!value || typeof value !== 'object') return false;
  return 'data' in value && 'savedAt' in value;
}

function unwrapCache<T>(value: unknown, ttlMs: number): { data: T | null; isStale: boolean } {
  if (isCacheEnvelope<T>(value)) {
    const savedAt = Number(value.savedAt);
    if (!Number.isFinite(savedAt) || Date.now() - savedAt > ttlMs) {
      return { data: null, isStale: true };
    }
    return { data: value.data, isStale: false };
  }
  return { data: (value as T) ?? null, isStale: false };
}

// ============================================================================
// useInteractions Hook
// ============================================================================

const INTERACTIONS_STORAGE_KEY = 'arda_csm_interactions';

interface UseInteractionsResult {
  interactions: Interaction[];
  isLoading: boolean;
  error: Error | null;
  isFromCache: boolean;
  addInteraction: (interaction: Omit<Interaction, 'id'>) => Promise<void>;
  deleteInteraction: (interactionId: string) => Promise<void>;
  refresh: () => Promise<void>;
}

export function useInteractions(accountId: string | undefined): UseInteractionsResult {
  const [state, setState] = useState<DataState<Interaction[]>>({
    data: [],
    isLoading: true,
    error: null,
    isFromCache: false,
  });

  // Load from localStorage
  const loadFromLocalStorage = useCallback((): Interaction[] => {
    try {
      const data = localStorage.getItem(INTERACTIONS_STORAGE_KEY);
      if (!data) return [];
      const allInteractions: Record<string, unknown> = JSON.parse(data);
      const entry = allInteractions[accountId || ''];
      const { data: interactions, isStale } = unwrapCache<Interaction[]>(
        entry,
        INTERACTIONS_CACHE_TTL_MS
      );
      if (isStale) {
        delete allInteractions[accountId || ''];
        localStorage.setItem(INTERACTIONS_STORAGE_KEY, JSON.stringify(allInteractions));
        return [];
      }
      return interactions || [];
    } catch {
      return [];
    }
  }, [accountId]);

  // Save to localStorage
  const saveToLocalStorage = useCallback((interactions: Interaction[]) => {
    try {
      const data = localStorage.getItem(INTERACTIONS_STORAGE_KEY);
      const allInteractions: Record<string, unknown> = data ? JSON.parse(data) : {};
      allInteractions[accountId || ''] = {
        data: interactions,
        savedAt: Date.now(),
      } satisfies CacheEnvelope<Interaction[]>;
      localStorage.setItem(INTERACTIONS_STORAGE_KEY, JSON.stringify(allInteractions));
    } catch (error) {
      console.error('Failed to save interactions to localStorage:', error);
    }
  }, [accountId]);

  // Fetch interactions (server-first, local fallback)
  const fetchInteractions = useCallback(async () => {
    if (!accountId) {
      setState({ data: [], isLoading: false, error: null, isFromCache: false });
      return;
    }

    setState(prev => ({ ...prev, isLoading: true }));

    try {
      const resp = await fetch(`${API_BASE}/${encodeURIComponent(accountId)}/interactions`, {
        method: 'GET',
      });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const json = await resp.json();
      const interactions: Interaction[] = json.interactions ?? [];
      saveToLocalStorage(interactions);
      setState({
        data: interactions,
        isLoading: false,
        error: null,
        isFromCache: false,
      });
    } catch (error) {
      console.error('Failed to fetch interactions from API, using local cache:', error);
      const localData = loadFromLocalStorage();
      setState({
        data: localData,
        isLoading: false,
        error: error as Error,
        isFromCache: true,
      });
    }
  }, [accountId, loadFromLocalStorage, saveToLocalStorage]);

  // Add interaction
  const addInteraction = useCallback(async (interaction: Omit<Interaction, 'id'>) => {
    if (!accountId) return;

    const newId = `int_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const newInteraction: Interaction = {
      ...interaction,
      id: newId,
    };

    try {
      const resp = await fetch(`${API_BASE}/${encodeURIComponent(accountId)}/interactions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(interaction),
      });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const json = await resp.json();
      const savedInteraction: Interaction = json.interaction ?? newInteraction;

      setState(prev => {
        const updated = [savedInteraction, ...prev.data];
        saveToLocalStorage(updated);
        return { ...prev, data: updated };
      });
    } catch (error) {
      console.error('Failed to add interaction via API, caching locally:', error);
      const current = loadFromLocalStorage();
      const updated = [newInteraction, ...current];
      saveToLocalStorage(updated);
      setState(prev => ({ ...prev, data: updated, error: error as Error, isFromCache: true }));
    }
  }, [accountId, loadFromLocalStorage, saveToLocalStorage]);

  // Delete interaction
  const deleteInteraction = useCallback(async (interactionId: string) => {
    if (!accountId) return;

    try {
      const resp = await fetch(`${API_BASE}/${encodeURIComponent(accountId)}/interactions?interactionId=${encodeURIComponent(interactionId)}`, {
        method: 'DELETE',
      });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);

      setState(prev => {
        const updated = prev.data.filter(i => i.id !== interactionId);
        saveToLocalStorage(updated);
        return { ...prev, data: updated };
      });
    } catch (error) {
      console.error('Failed to delete interaction via API, updating local cache:', error);
      const current = loadFromLocalStorage();
      const updated = current.filter(i => i.id !== interactionId);
      saveToLocalStorage(updated);
      setState(prev => ({ ...prev, data: updated, error: error as Error }));
    }
  }, [accountId, loadFromLocalStorage, saveToLocalStorage]);

  useEffect(() => {
    fetchInteractions();
  }, [fetchInteractions]);

  return {
    interactions: state.data,
    isLoading: state.isLoading,
    error: state.error,
    isFromCache: state.isFromCache,
    addInteraction,
    deleteInteraction,
    refresh: fetchInteractions,
  };
}

// ============================================================================
// useTasks Hook
// ============================================================================

const TASKS_STORAGE_KEY = 'arda_account_tasks_';

interface UseTasksResult {
  tasks: StoredTask[];
  isLoading: boolean;
  error: Error | null;
  isFromCache: boolean;
  addTask: (task: Omit<StoredTask, 'id' | 'createdAt' | 'updatedAt'>) => Promise<void>;
  updateTask: (taskId: string, updates: Partial<StoredTask>) => Promise<void>;
  deleteTask: (taskId: string) => Promise<void>;
  completeTask: (taskId: string) => Promise<void>;
  uncompleteTask: (taskId: string) => Promise<void>;
  refresh: () => Promise<void>;
}

export function useTasks(accountId: string | undefined): UseTasksResult {
  const storageKey = `${TASKS_STORAGE_KEY}${accountId || ''}`;
  
  const [state, setState] = useState<DataState<StoredTask[]>>({
    data: [],
    isLoading: true,
    error: null,
    isFromCache: false,
  });

  // Load from localStorage
  const loadFromLocalStorage = useCallback((): StoredTask[] => {
    try {
      const data = localStorage.getItem(storageKey);
      if (!data) return [];
      const parsed = JSON.parse(data);
      const { data: tasks, isStale } = unwrapCache<StoredTask[]>(
        parsed,
        TASKS_CACHE_TTL_MS
      );
      if (isStale) {
        localStorage.removeItem(storageKey);
        return [];
      }
      return tasks || [];
    } catch {
      return [];
    }
  }, [storageKey]);

  // Save to localStorage
  const saveToLocalStorage = useCallback((tasks: StoredTask[]) => {
    try {
      const envelope: CacheEnvelope<StoredTask[]> = {
        data: tasks,
        savedAt: Date.now(),
      };
      localStorage.setItem(storageKey, JSON.stringify(envelope));
    } catch (error) {
      console.error('Failed to save tasks to localStorage:', error);
    }
  }, [storageKey]);

  // Map database row to StoredTask
  const mapRowToTask = (row: TaskRow): StoredTask => ({
    id: row.id,
    accountId: row.account_id,
    title: row.title,
    description: row.description || undefined,
    type: 'custom',
    priority: row.priority as StoredTask['priority'],
    status: row.status as StoredTask['status'],
    dueDate: row.due_date || undefined,
    completedAt: row.completed_at || undefined,
    source: 'manual',
    createdAt: row.created_at,
    updatedAt: row.created_at,
  });

  // Fetch tasks (server-first, local fallback)
  const fetchTasks = useCallback(async () => {
    if (!accountId) {
      setState({ data: [], isLoading: false, error: null, isFromCache: false });
      return;
    }

    setState(prev => ({ ...prev, isLoading: true }));

    try {
      const resp = await fetch(`${API_BASE}/${encodeURIComponent(accountId)}/tasks`, { method: 'GET' });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const json = await resp.json();
      const tasks: StoredTask[] = (json.tasks || []).map((t: any) => ({
        id: t.id,
        accountId: t.accountId,
        title: t.title,
        description: t.description,
        type: t.type || 'custom',
        priority: t.priority,
        status: t.status,
        dueDate: t.dueDate,
        completedAt: t.completedAt,
        source: t.source || 'manual',
        createdAt: t.createdAt,
        updatedAt: t.updatedAt,
      }));
      saveToLocalStorage(tasks);
      setState({
        data: tasks,
        isLoading: false,
        error: null,
        isFromCache: false,
      });
    } catch (error) {
      console.error('Failed to fetch tasks from API, using local cache:', error);
      const localData = loadFromLocalStorage();
      setState({
        data: localData,
        isLoading: false,
        error: error as Error,
        isFromCache: true,
      });
    }
  }, [accountId, loadFromLocalStorage, saveToLocalStorage]);

  // Add task
  const addTask = useCallback(async (task: Omit<StoredTask, 'id' | 'createdAt' | 'updatedAt'>) => {
    if (!accountId) return;

    const now = new Date().toISOString();
    const newId = `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const newTask: StoredTask = {
      ...task,
      id: newId,
      createdAt: now,
      updatedAt: now,
    };

    try {
      const resp = await fetch(`${API_BASE}/${encodeURIComponent(accountId)}/tasks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(task),
      });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const json = await resp.json();
      const savedTask: StoredTask = json.task
        ? {
            id: json.task.id,
            accountId: json.task.accountId,
            title: json.task.title,
            description: json.task.description,
            type: 'custom',
            priority: json.task.priority,
            status: json.task.status,
            dueDate: json.task.dueDate,
            completedAt: json.task.completedAt,
            source: json.task.source || 'manual',
            createdAt: json.task.createdAt,
            updatedAt: json.task.updatedAt,
          }
        : newTask;
      setState(prev => {
        const updated = [savedTask, ...prev.data];
        saveToLocalStorage(updated);
        return { ...prev, data: updated };
      });
    } catch (error) {
      console.error('Failed to add task via API, caching locally:', error);
      const current = loadFromLocalStorage();
      const updated = [newTask, ...current];
      saveToLocalStorage(updated);
      setState(prev => ({ ...prev, data: updated, error: error as Error, isFromCache: true }));
    }
  }, [accountId, loadFromLocalStorage, saveToLocalStorage]);

  // Update task
  const updateTask = useCallback(async (taskId: string, updates: Partial<StoredTask>) => {
    if (!accountId) return;

    try {
      const resp = await fetch(`${API_BASE}/${encodeURIComponent(accountId)}/tasks`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ taskId, ...updates }),
      });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const json = await resp.json();
      const savedTask: StoredTask | null = json.task
        ? {
            id: json.task.id,
            accountId: json.task.accountId,
            title: json.task.title,
            description: json.task.description,
            type: 'custom',
            priority: json.task.priority,
            status: json.task.status,
            dueDate: json.task.dueDate,
            completedAt: json.task.completedAt,
            source: json.task.source || 'manual',
            createdAt: json.task.createdAt,
            updatedAt: json.task.updatedAt,
          }
        : null;

      setState(prev => {
        const updated = prev.data.map(t => 
          t.id === taskId
            ? { ...t, ...(savedTask || updates), updatedAt: new Date().toISOString() }
            : t
        );
        saveToLocalStorage(updated);
        return { ...prev, data: updated };
      });
    } catch (error) {
      console.error('Failed to update task via API, updating local cache:', error);
      const current = loadFromLocalStorage();
      const updated = current.map(t => 
        t.id === taskId ? { ...t, ...updates, updatedAt: new Date().toISOString() } : t
      );
      saveToLocalStorage(updated);
      setState(prev => ({ ...prev, data: updated, error: error as Error }));
    }
  }, [accountId, loadFromLocalStorage, saveToLocalStorage]);

  // Delete task
  const deleteTask = useCallback(async (taskId: string) => {
    if (!accountId) return;

    try {
      const resp = await fetch(`${API_BASE}/${encodeURIComponent(accountId)}/tasks?taskId=${encodeURIComponent(taskId)}`, {
        method: 'DELETE',
      });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);

      setState(prev => {
        const updated = prev.data.filter(t => t.id !== taskId);
        saveToLocalStorage(updated);
        return { ...prev, data: updated };
      });
    } catch (error) {
      console.error('Failed to delete task via API, updating local cache:', error);
      const current = loadFromLocalStorage();
      const updated = current.filter(t => t.id !== taskId);
      saveToLocalStorage(updated);
      setState(prev => ({ ...prev, data: updated, error: error as Error }));
    }
  }, [accountId, loadFromLocalStorage, saveToLocalStorage]);

  // Complete task
  const completeTask = useCallback(async (taskId: string) => {
    await updateTask(taskId, { 
      status: 'completed', 
      completedAt: new Date().toISOString() 
    });
  }, [updateTask]);

  // Uncomplete task
  const uncompleteTask = useCallback(async (taskId: string) => {
    await updateTask(taskId, { 
      status: 'pending', 
      completedAt: undefined 
    });
  }, [updateTask]);

  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  return {
    tasks: state.data,
    isLoading: state.isLoading,
    error: state.error,
    isFromCache: state.isFromCache,
    addTask,
    updateTask,
    deleteTask,
    completeTask,
    uncompleteTask,
    refresh: fetchTasks,
  };
}

// ============================================================================
// useSuccessPlan Hook
// ============================================================================

const SUCCESS_PLAN_STORAGE_KEY = 'arda_success_plan_';

interface UseSuccessPlanResult {
  successPlan: SuccessPlan | null;
  isLoading: boolean;
  error: Error | null;
  isFromCache: boolean;
  createPlan: (plan: SuccessPlan) => Promise<void>;
  updatePlan: (updates: Partial<SuccessPlan>) => Promise<void>;
  deletePlan: () => Promise<void>;
  updateMilestone: (milestoneId: string, updates: Partial<Milestone>) => Promise<void>;
  refresh: () => Promise<void>;
}

export function useSuccessPlan(accountId: string | undefined): UseSuccessPlanResult {
  const storageKey = `${SUCCESS_PLAN_STORAGE_KEY}${accountId || ''}`;
  
  const [state, setState] = useState<DataState<SuccessPlan | null>>({
    data: null,
    isLoading: true,
    error: null,
    isFromCache: false,
  });

  // Load from localStorage
  const loadFromLocalStorage = useCallback((): SuccessPlan | null => {
    try {
      const data = localStorage.getItem(storageKey);
      if (!data) return null;
      const parsed = JSON.parse(data);
      const { data: plan, isStale } = unwrapCache<SuccessPlan | null>(
        parsed,
        SUCCESS_PLAN_CACHE_TTL_MS
      );
      if (isStale) {
        localStorage.removeItem(storageKey);
        return null;
      }
      return plan || null;
    } catch {
      return null;
    }
  }, [storageKey]);

  // Save to localStorage
  const saveToLocalStorage = useCallback((plan: SuccessPlan | null) => {
    try {
      if (plan) {
        const envelope: CacheEnvelope<SuccessPlan> = {
          data: plan,
          savedAt: Date.now(),
        };
        localStorage.setItem(storageKey, JSON.stringify(envelope));
      } else {
        localStorage.removeItem(storageKey);
      }
    } catch (error) {
      console.error('Failed to save success plan to localStorage:', error);
    }
  }, [storageKey]);

  // Map database row to SuccessPlan
  const mapRowToPlan = (row: SuccessPlanRow): SuccessPlan => ({
    id: row.id,
    accountId: row.account_id,
    name: row.name,
    templateId: undefined,
    status: row.status as SuccessPlan['status'],
    goals: (row.goals || []) as Goal[],
    milestones: (row.milestones || []) as Milestone[],
    startDate: row.start_date || undefined,
    targetEndDate: row.target_end_date || undefined,
    createdAt: row.created_at,
    updatedAt: row.created_at,
  });

  // Fetch success plan
  const fetchSuccessPlan = useCallback(async () => {
    if (!accountId) {
      setState({ data: null, isLoading: false, error: null, isFromCache: false });
      return;
    }

    setState(prev => ({ ...prev, isLoading: true }));

    const client = getSupabaseClient();
    
    if (!client || !isSupabaseConfigured()) {
      const localData = loadFromLocalStorage();
      setState({
        data: localData,
        isLoading: false,
        error: null,
        isFromCache: true,
      });
      return;
    }

    try {
      const { data, error } = await client
        .from('success_plans')
        .select('*')
        .eq('account_id', accountId)
        .maybeSingle();

      if (error) throw error;

      const plan = data ? mapRowToPlan(data) : null;
      if (plan) saveToLocalStorage(plan);

      setState({
        data: plan,
        isLoading: false,
        error: null,
        isFromCache: false,
      });
    } catch (error) {
      console.error('Failed to fetch success plan from Supabase:', error);
      const localData = loadFromLocalStorage();
      setState({
        data: localData,
        isLoading: false,
        error: error as Error,
        isFromCache: true,
      });
    }
  }, [accountId, loadFromLocalStorage, saveToLocalStorage]);

  // Create plan
  const createPlan = useCallback(async (plan: SuccessPlan) => {
    if (!accountId) return;

    const client = getSupabaseClient();

    if (!client || !isSupabaseConfigured()) {
      saveToLocalStorage(plan);
      setState(prev => ({ ...prev, data: plan }));
      return;
    }

    try {
      const insertData: SuccessPlanInsert = {
        account_id: accountId,
        name: plan.name,
        status: plan.status || 'active',
        progress: 0,
        goals: plan.goals as unknown as Record<string, unknown>[],
        milestones: plan.milestones as unknown as Record<string, unknown>[],
        start_date: plan.startDate || null,
        target_end_date: plan.targetEndDate || null,
      };

      const { data, error } = await client
        .from('success_plans')
        .insert(insertData)
        .select()
        .single();

      if (error) throw error;

      const savedPlan = mapRowToPlan(data);
      saveToLocalStorage(savedPlan);
      setState(prev => ({ ...prev, data: savedPlan }));
    } catch (error) {
      console.error('Failed to create success plan in Supabase:', error);
      saveToLocalStorage(plan);
      setState(prev => ({ ...prev, data: plan, error: error as Error, isFromCache: true }));
    }
  }, [accountId, saveToLocalStorage]);

  // Update plan
  const updatePlan = useCallback(async (updates: Partial<SuccessPlan>) => {
    if (!accountId || !state.data) return;

    const updatedPlan = { ...state.data, ...updates, updatedAt: new Date().toISOString() };

    const client = getSupabaseClient();

    if (!client || !isSupabaseConfigured()) {
      saveToLocalStorage(updatedPlan);
      setState(prev => ({ ...prev, data: updatedPlan }));
      return;
    }

    try {
      const updateData: SuccessPlanUpdate = {};
      if (updates.name !== undefined) updateData.name = updates.name;
      if (updates.status !== undefined) updateData.status = updates.status;
      if (updates.goals !== undefined) updateData.goals = updates.goals as unknown as Record<string, unknown>[];
      if (updates.milestones !== undefined) updateData.milestones = updates.milestones as unknown as Record<string, unknown>[];
      if (updates.startDate !== undefined) updateData.start_date = updates.startDate;
      if (updates.targetEndDate !== undefined) updateData.target_end_date = updates.targetEndDate;

      // Calculate progress
      if (updates.milestones) {
        const completed = updates.milestones.filter(m => m.status === 'completed').length;
        const total = updates.milestones.length;
        updateData.progress = total > 0 ? Math.round((completed / total) * 100) : 0;
      }

      const { error } = await client
        .from('success_plans')
        .update(updateData)
        .eq('account_id', accountId);

      if (error) throw error;

      saveToLocalStorage(updatedPlan);
      setState(prev => ({ ...prev, data: updatedPlan }));
    } catch (error) {
      console.error('Failed to update success plan in Supabase:', error);
      saveToLocalStorage(updatedPlan);
      setState(prev => ({ ...prev, data: updatedPlan, error: error as Error }));
    }
  }, [accountId, state.data, saveToLocalStorage]);

  // Delete plan
  const deletePlan = useCallback(async () => {
    if (!accountId) return;

    const client = getSupabaseClient();

    if (!client || !isSupabaseConfigured()) {
      saveToLocalStorage(null);
      setState(prev => ({ ...prev, data: null }));
      return;
    }

    try {
      const { error } = await client
        .from('success_plans')
        .delete()
        .eq('account_id', accountId);

      if (error) throw error;

      saveToLocalStorage(null);
      setState(prev => ({ ...prev, data: null }));
    } catch (error) {
      console.error('Failed to delete success plan from Supabase:', error);
      saveToLocalStorage(null);
      setState(prev => ({ ...prev, data: null, error: error as Error }));
    }
  }, [accountId, saveToLocalStorage]);

  // Update milestone
  const updateMilestone = useCallback(async (milestoneId: string, updates: Partial<Milestone>) => {
    if (!state.data) return;

    const updatedMilestones = state.data.milestones.map(m =>
      m.id === milestoneId ? { ...m, ...updates } : m
    );

    await updatePlan({ milestones: updatedMilestones });
  }, [state.data, updatePlan]);

  useEffect(() => {
    fetchSuccessPlan();
  }, [fetchSuccessPlan]);

  return {
    successPlan: state.data,
    isLoading: state.isLoading,
    error: state.error,
    isFromCache: state.isFromCache,
    createPlan,
    updatePlan,
    deletePlan,
    updateMilestone,
    refresh: fetchSuccessPlan,
  };
}

// ============================================================================
// useEmails Hook
// ============================================================================

interface SentEmail {
  id: string;
  accountId: string;
  templateId: string;
  templateName: string;
  recipientEmail: string;
  subject: string;
  sentAt: string;
  category: string;
}

interface DraftEmail {
  id: string;
  accountId: string;
  templateId?: string;
  templateName?: string;
  category?: string;
  recipientEmail: string;
  subject: string;
  body: string;
  savedAt: string;
}

interface UseEmailsResult {
  sentEmails: SentEmail[];
  draftEmails: DraftEmail[];
  isLoading: boolean;
  error: Error | null;
  isFromCache: boolean;
  addSentEmail: (email: Omit<SentEmail, 'id'>) => Promise<void>;
  addDraft: (draft: Omit<DraftEmail, 'id' | 'savedAt'>) => Promise<void>;
  updateDraft: (draftId: string, updates: Partial<DraftEmail>) => Promise<void>;
  deleteDraft: (draftId: string) => Promise<void>;
  markDraftAsSent: (draftId: string) => Promise<void>;
  refresh: () => Promise<void>;
}

export function useEmails(accountId: string | undefined): UseEmailsResult {
  const sentStorageKey = `arda_sent_emails_${accountId || ''}`;
  const draftStorageKey = `arda_draft_emails_${accountId || ''}`;
  
  const [sentState, setSentState] = useState<DataState<SentEmail[]>>({
    data: [],
    isLoading: true,
    error: null,
    isFromCache: false,
  });

  const [draftState, setDraftState] = useState<DataState<DraftEmail[]>>({
    data: [],
    isLoading: true,
    error: null,
    isFromCache: false,
  });

  // Load from localStorage
  const loadSentFromLocalStorage = useCallback((): SentEmail[] => {
    try {
      const data = localStorage.getItem(sentStorageKey);
      if (!data) return [];
      const parsed = JSON.parse(data);
      const { data: sentEmails, isStale } = unwrapCache<SentEmail[]>(
        parsed,
        EMAILS_CACHE_TTL_MS
      );
      if (isStale) {
        localStorage.removeItem(sentStorageKey);
        return [];
      }
      return sentEmails || [];
    } catch {
      return [];
    }
  }, [sentStorageKey]);

  const loadDraftsFromLocalStorage = useCallback((): DraftEmail[] => {
    try {
      const data = localStorage.getItem(draftStorageKey);
      if (!data) return [];
      const parsed = JSON.parse(data);
      const { data: drafts, isStale } = unwrapCache<DraftEmail[]>(
        parsed,
        EMAILS_CACHE_TTL_MS
      );
      if (isStale) {
        localStorage.removeItem(draftStorageKey);
        return [];
      }
      return drafts || [];
    } catch {
      return [];
    }
  }, [draftStorageKey]);

  // Save to localStorage
  const saveSentToLocalStorage = useCallback((emails: SentEmail[]) => {
    try {
      const envelope: CacheEnvelope<SentEmail[]> = {
        data: emails,
        savedAt: Date.now(),
      };
      localStorage.setItem(sentStorageKey, JSON.stringify(envelope));
    } catch (error) {
      console.error('Failed to save sent emails to localStorage:', error);
    }
  }, [sentStorageKey]);

  const saveDraftsToLocalStorage = useCallback((drafts: DraftEmail[]) => {
    try {
      const envelope: CacheEnvelope<DraftEmail[]> = {
        data: drafts,
        savedAt: Date.now(),
      };
      localStorage.setItem(draftStorageKey, JSON.stringify(envelope));
    } catch (error) {
      console.error('Failed to save drafts to localStorage:', error);
    }
  }, [draftStorageKey]);

  // Fetch emails
  const fetchEmails = useCallback(async () => {
    if (!accountId) {
      setSentState({ data: [], isLoading: false, error: null, isFromCache: false });
      setDraftState({ data: [], isLoading: false, error: null, isFromCache: false });
      return;
    }

    setSentState(prev => ({ ...prev, isLoading: true }));
    setDraftState(prev => ({ ...prev, isLoading: true }));

    const client = getSupabaseClient();
    
    if (!client || !isSupabaseConfigured()) {
      setSentState({
        data: loadSentFromLocalStorage(),
        isLoading: false,
        error: null,
        isFromCache: true,
      });
      setDraftState({
        data: loadDraftsFromLocalStorage(),
        isLoading: false,
        error: null,
        isFromCache: true,
      });
      return;
    }

    try {
      const { data, error } = await client
        .from('emails')
        .select('*')
        .eq('account_id', accountId)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const sent: SentEmail[] = [];
      const drafts: DraftEmail[] = [];

      for (const row of data || []) {
        if (row.type === 'sent') {
          sent.push({
            id: row.id,
            accountId: row.account_id,
            templateId: row.template_id || 'manual',
            templateName: row.template_id || 'Manual Email',
            recipientEmail: row.recipient_email || '',
            subject: row.subject,
            sentAt: row.sent_at || row.created_at,
            category: 'check_in',
          });
        } else {
          drafts.push({
            id: row.id,
            accountId: row.account_id,
            templateId: row.template_id || undefined,
            templateName: row.template_id || undefined,
            recipientEmail: row.recipient_email || '',
            subject: row.subject,
            body: row.body,
            savedAt: row.created_at,
          });
        }
      }

      saveSentToLocalStorage(sent);
      saveDraftsToLocalStorage(drafts);

      setSentState({
        data: sent,
        isLoading: false,
        error: null,
        isFromCache: false,
      });
      setDraftState({
        data: drafts,
        isLoading: false,
        error: null,
        isFromCache: false,
      });
    } catch (error) {
      console.error('Failed to fetch emails from Supabase:', error);
      setSentState({
        data: loadSentFromLocalStorage(),
        isLoading: false,
        error: error as Error,
        isFromCache: true,
      });
      setDraftState({
        data: loadDraftsFromLocalStorage(),
        isLoading: false,
        error: error as Error,
        isFromCache: true,
      });
    }
  }, [accountId, loadSentFromLocalStorage, loadDraftsFromLocalStorage, saveSentToLocalStorage, saveDraftsToLocalStorage]);

  // Add sent email
  const addSentEmail = useCallback(async (email: Omit<SentEmail, 'id'>) => {
    if (!accountId) return;

    const newId = `sent_${Date.now()}`;
    const newEmail: SentEmail = { ...email, id: newId };

    const client = getSupabaseClient();

    if (!client || !isSupabaseConfigured()) {
      const current = loadSentFromLocalStorage();
      const updated = [newEmail, ...current];
      saveSentToLocalStorage(updated);
      setSentState(prev => ({ ...prev, data: updated }));
      return;
    }

    try {
      const insertData: EmailInsert = {
        account_id: accountId,
        type: 'sent',
        template_id: email.templateId,
        subject: email.subject,
        body: '',
        recipient_email: email.recipientEmail,
        sent_at: email.sentAt,
      };

      const { data, error } = await client
        .from('emails')
        .insert(insertData)
        .select()
        .single();

      if (error) throw error;

      const savedEmail: SentEmail = {
        id: data.id,
        accountId: data.account_id,
        templateId: data.template_id || 'manual',
        templateName: data.template_id || 'Manual Email',
        recipientEmail: data.recipient_email || '',
        subject: data.subject,
        sentAt: data.sent_at || data.created_at,
        category: email.category,
      };

      setSentState(prev => {
        const updated = [savedEmail, ...prev.data];
        saveSentToLocalStorage(updated);
        return { ...prev, data: updated };
      });
    } catch (error) {
      console.error('Failed to add sent email to Supabase:', error);
      const current = loadSentFromLocalStorage();
      const updated = [newEmail, ...current];
      saveSentToLocalStorage(updated);
      setSentState(prev => ({ ...prev, data: updated, error: error as Error, isFromCache: true }));
    }
  }, [accountId, loadSentFromLocalStorage, saveSentToLocalStorage]);

  // Add draft
  const addDraft = useCallback(async (draft: Omit<DraftEmail, 'id' | 'savedAt'>) => {
    if (!accountId) return;

    const newId = `draft_${Date.now()}`;
    const now = new Date().toISOString();
    const newDraft: DraftEmail = { ...draft, id: newId, savedAt: now };

    const client = getSupabaseClient();

    if (!client || !isSupabaseConfigured()) {
      const current = loadDraftsFromLocalStorage();
      const updated = [newDraft, ...current];
      saveDraftsToLocalStorage(updated);
      setDraftState(prev => ({ ...prev, data: updated }));
      return;
    }

    try {
      const insertData: EmailInsert = {
        account_id: accountId,
        type: 'draft',
        template_id: draft.templateId,
        subject: draft.subject,
        body: draft.body,
        recipient_email: draft.recipientEmail,
      };

      const { data, error } = await client
        .from('emails')
        .insert(insertData as never)
        .select()
        .single();

      if (error) throw error;

      const savedDraft: DraftEmail = {
        id: data.id,
        accountId: data.account_id,
        templateId: data.template_id || undefined,
        recipientEmail: data.recipient_email || '',
        subject: data.subject,
        body: data.body,
        savedAt: data.created_at,
      };

      setDraftState(prev => {
        const updated = [savedDraft, ...prev.data];
        saveDraftsToLocalStorage(updated);
        return { ...prev, data: updated };
      });
    } catch (error) {
      console.error('Failed to add draft to Supabase:', error);
      const current = loadDraftsFromLocalStorage();
      const updated = [newDraft, ...current];
      saveDraftsToLocalStorage(updated);
      setDraftState(prev => ({ ...prev, data: updated, error: error as Error, isFromCache: true }));
    }
  }, [accountId, loadDraftsFromLocalStorage, saveDraftsToLocalStorage]);

  // Update draft
  const updateDraft = useCallback(async (draftId: string, updates: Partial<DraftEmail>) => {
    const client = getSupabaseClient();

    if (!client || !isSupabaseConfigured()) {
      const current = loadDraftsFromLocalStorage();
      const updated = current.map(d => 
        d.id === draftId ? { ...d, ...updates, savedAt: new Date().toISOString() } : d
      );
      saveDraftsToLocalStorage(updated);
      setDraftState(prev => ({ ...prev, data: updated }));
      return;
    }

    try {
      const updateData: Partial<EmailInsert> = {};
      if (updates.subject !== undefined) updateData.subject = updates.subject;
      if (updates.body !== undefined) updateData.body = updates.body;
      if (updates.recipientEmail !== undefined) updateData.recipient_email = updates.recipientEmail;
      if (updates.templateId !== undefined) updateData.template_id = updates.templateId;

      const { error } = await client
        .from('emails')
        .update(updateData as never)
        .eq('id', draftId);

      if (error) throw error;

      setDraftState(prev => {
        const updated = prev.data.map(d => 
          d.id === draftId ? { ...d, ...updates, savedAt: new Date().toISOString() } : d
        );
        saveDraftsToLocalStorage(updated);
        return { ...prev, data: updated };
      });
    } catch (error) {
      console.error('Failed to update draft in Supabase:', error);
      const current = loadDraftsFromLocalStorage();
      const updated = current.map(d => 
        d.id === draftId ? { ...d, ...updates, savedAt: new Date().toISOString() } : d
      );
      saveDraftsToLocalStorage(updated);
      setDraftState(prev => ({ ...prev, data: updated, error: error as Error }));
    }
  }, [loadDraftsFromLocalStorage, saveDraftsToLocalStorage]);

  // Delete draft
  const deleteDraft = useCallback(async (draftId: string) => {
    const client = getSupabaseClient();

    if (!client || !isSupabaseConfigured()) {
      const current = loadDraftsFromLocalStorage();
      const updated = current.filter(d => d.id !== draftId);
      saveDraftsToLocalStorage(updated);
      setDraftState(prev => ({ ...prev, data: updated }));
      return;
    }

    try {
      const { error } = await client
        .from('emails')
        .delete()
        .eq('id', draftId);

      if (error) throw error;

      setDraftState(prev => {
        const updated = prev.data.filter(d => d.id !== draftId);
        saveDraftsToLocalStorage(updated);
        return { ...prev, data: updated };
      });
    } catch (error) {
      console.error('Failed to delete draft from Supabase:', error);
      const current = loadDraftsFromLocalStorage();
      const updated = current.filter(d => d.id !== draftId);
      saveDraftsToLocalStorage(updated);
      setDraftState(prev => ({ ...prev, data: updated, error: error as Error }));
    }
  }, [loadDraftsFromLocalStorage, saveDraftsToLocalStorage]);

  // Mark draft as sent
  const markDraftAsSent = useCallback(async (draftId: string) => {
    const draft = draftState.data.find(d => d.id === draftId);
    if (!draft) return;

    // Add as sent email
    await addSentEmail({
      accountId: draft.accountId,
      templateId: draft.templateId || 'manual',
      templateName: draft.templateName || 'Manual Email',
      recipientEmail: draft.recipientEmail,
      subject: draft.subject,
      sentAt: new Date().toISOString(),
      category: draft.category || 'check_in',
    });

    // Delete draft
    await deleteDraft(draftId);
  }, [draftState.data, addSentEmail, deleteDraft]);

  useEffect(() => {
    fetchEmails();
  }, [fetchEmails]);

  return {
    sentEmails: sentState.data,
    draftEmails: draftState.data,
    isLoading: sentState.isLoading || draftState.isLoading,
    error: sentState.error || draftState.error,
    isFromCache: sentState.isFromCache || draftState.isFromCache,
    addSentEmail,
    addDraft,
    updateDraft,
    deleteDraft,
    markDraftAsSent,
    refresh: fetchEmails,
  };
}

// ============================================================================
// useAlertStates Hook
// ============================================================================

interface AlertState {
  id: string;
  alertId: string;
  accountId: string;
  status: 'acknowledged' | 'snoozed' | 'resolved' | 'active';
  snoozedUntil?: string;
  resolvedAt?: string;
  notes?: string;
  updatedBy?: string;
  updatedAt: string;
}

interface UseAlertStatesResult {
  alertStates: Record<string, AlertState>;
  isLoading: boolean;
  error: Error | null;
  isFromCache: boolean;
  getAlertState: (alertId: string) => AlertState | undefined;
  acknowledgeAlert: (alertId: string, accountId: string, notes?: string) => Promise<void>;
  snoozeAlert: (alertId: string, accountId: string, until: string, notes?: string) => Promise<void>;
  resolveAlert: (alertId: string, accountId: string, notes?: string) => Promise<void>;
  refresh: () => Promise<void>;
}

const ALERT_STATES_STORAGE_KEY = 'arda_alert_states';

export function useAlertStates(): UseAlertStatesResult {
  const [state, setState] = useState<DataState<Record<string, AlertState>>>({
    data: {},
    isLoading: true,
    error: null,
    isFromCache: false,
  });

  // Load from localStorage
  const loadFromLocalStorage = useCallback((): Record<string, AlertState> => {
    try {
      const data = localStorage.getItem(ALERT_STATES_STORAGE_KEY);
      if (!data) return {};
      const parsed = JSON.parse(data);
      const { data: alertStates, isStale } = unwrapCache<Record<string, AlertState>>(
        parsed,
        ALERT_STATES_CACHE_TTL_MS
      );
      if (isStale) {
        localStorage.removeItem(ALERT_STATES_STORAGE_KEY);
        return {};
      }
      return alertStates || {};
    } catch {
      return {};
    }
  }, []);

  // Save to localStorage
  const saveToLocalStorage = useCallback((alertStates: Record<string, AlertState>) => {
    try {
      const envelope: CacheEnvelope<Record<string, AlertState>> = {
        data: alertStates,
        savedAt: Date.now(),
      };
      localStorage.setItem(ALERT_STATES_STORAGE_KEY, JSON.stringify(envelope));
    } catch (error) {
      console.error('Failed to save alert states to localStorage:', error);
    }
  }, []);

  // Map database row to AlertState
  const mapRowToAlertState = (row: AlertStateRow): AlertState => ({
    id: row.id,
    alertId: row.alert_id,
    accountId: row.account_id,
    status: row.status as AlertState['status'],
    snoozedUntil: row.snoozed_until || undefined,
    resolvedAt: row.resolved_at || undefined,
    notes: row.notes || undefined,
    updatedBy: row.updated_by || undefined,
    updatedAt: row.updated_at,
  });

  // Fetch alert states
  const fetchAlertStates = useCallback(async () => {
    setState(prev => ({ ...prev, isLoading: true }));

    const client = getSupabaseClient();
    
    if (!client || !isSupabaseConfigured()) {
      const localData = loadFromLocalStorage();
      setState({
        data: localData,
        isLoading: false,
        error: null,
        isFromCache: true,
      });
      return;
    }

    try {
      const { data, error } = await client
        .from('alert_states')
        .select('*')
        .order('updated_at', { ascending: false });

      if (error) throw error;

      const alertStates: Record<string, AlertState> = {};
      for (const row of data || []) {
        const state = mapRowToAlertState(row);
        alertStates[state.alertId] = state;
      }

      saveToLocalStorage(alertStates);

      setState({
        data: alertStates,
        isLoading: false,
        error: null,
        isFromCache: false,
      });
    } catch (error) {
      console.error('Failed to fetch alert states from Supabase:', error);
      const localData = loadFromLocalStorage();
      setState({
        data: localData,
        isLoading: false,
        error: error as Error,
        isFromCache: true,
      });
    }
  }, [loadFromLocalStorage, saveToLocalStorage]);

  // Get alert state
  const getAlertState = useCallback((alertId: string): AlertState | undefined => {
    return state.data[alertId];
  }, [state.data]);

  // Update or create alert state
  const upsertAlertState = useCallback(async (
    alertId: string,
    accountId: string,
    status: AlertState['status'],
    extra: { snoozedUntil?: string; resolvedAt?: string; notes?: string }
  ) => {
    const now = new Date().toISOString();
    const newState: AlertState = {
      id: state.data[alertId]?.id || `alert_state_${Date.now()}`,
      alertId,
      accountId,
      status,
      snoozedUntil: extra.snoozedUntil,
      resolvedAt: extra.resolvedAt,
      notes: extra.notes,
      updatedAt: now,
    };

    const client = getSupabaseClient();

    if (!client || !isSupabaseConfigured()) {
      const current = loadFromLocalStorage();
      const updated = { ...current, [alertId]: newState };
      saveToLocalStorage(updated);
      setState(prev => ({ ...prev, data: updated }));
      return;
    }

    try {
      const upsertData: AlertStateInsert = {
        alert_id: alertId,
        account_id: accountId,
        status,
        snoozed_until: extra.snoozedUntil || null,
        resolved_at: extra.resolvedAt || null,
        notes: extra.notes || null,
        updated_at: now,
      };

      const { data, error } = await client
        .from('alert_states')
        .upsert(upsertData as never, { onConflict: 'alert_id' })
        .select()
        .single();

      if (error) throw error;

      const savedState = mapRowToAlertState(data);
      setState(prev => {
        const updated = { ...prev.data, [alertId]: savedState };
        saveToLocalStorage(updated);
        return { ...prev, data: updated };
      });
    } catch (error) {
      console.error('Failed to update alert state in Supabase:', error);
      const current = loadFromLocalStorage();
      const updated = { ...current, [alertId]: newState };
      saveToLocalStorage(updated);
      setState(prev => ({ ...prev, data: updated, error: error as Error }));
    }
  }, [state.data, loadFromLocalStorage, saveToLocalStorage]);

  // Acknowledge alert
  const acknowledgeAlert = useCallback(async (alertId: string, accountId: string, notes?: string) => {
    await upsertAlertState(alertId, accountId, 'acknowledged', { notes });
  }, [upsertAlertState]);

  // Snooze alert
  const snoozeAlert = useCallback(async (alertId: string, accountId: string, until: string, notes?: string) => {
    await upsertAlertState(alertId, accountId, 'snoozed', { snoozedUntil: until, notes });
  }, [upsertAlertState]);

  // Resolve alert
  const resolveAlert = useCallback(async (alertId: string, accountId: string, notes?: string) => {
    await upsertAlertState(alertId, accountId, 'resolved', { 
      resolvedAt: new Date().toISOString(), 
      notes 
    });
  }, [upsertAlertState]);

  useEffect(() => {
    fetchAlertStates();
  }, [fetchAlertStates]);

  return {
    alertStates: state.data,
    isLoading: state.isLoading,
    error: state.error,
    isFromCache: state.isFromCache,
    getAlertState,
    acknowledgeAlert,
    snoozeAlert,
    resolveAlert,
    refresh: fetchAlertStates,
  };
}
