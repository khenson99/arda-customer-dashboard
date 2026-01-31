/**
 * Supabase Client
 * 
 * Centralized Supabase client initialization with type-safe database types.
 * Falls back to localStorage when Supabase is not configured.
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';

// ============================================================================
// DATABASE TYPES
// ============================================================================

export interface Database {
  public: {
    Tables: {
      interactions: {
        Row: {
          id: string;
          account_id: string;
          type: string;
          summary: string;
          next_action: string | null;
          created_by: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          account_id: string;
          type: string;
          summary: string;
          next_action?: string | null;
          created_by: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          account_id?: string;
          type?: string;
          summary?: string;
          next_action?: string | null;
          created_by?: string;
          created_at?: string;
        };
      };
      tasks: {
        Row: {
          id: string;
          account_id: string;
          title: string;
          description: string | null;
          priority: string;
          status: string;
          due_date: string | null;
          completed_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          account_id: string;
          title: string;
          description?: string | null;
          priority: string;
          status?: string;
          due_date?: string | null;
          completed_at?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          account_id?: string;
          title?: string;
          description?: string | null;
          priority?: string;
          status?: string;
          due_date?: string | null;
          completed_at?: string | null;
          created_at?: string;
        };
      };
      success_plans: {
        Row: {
          id: string;
          account_id: string;
          name: string;
          status: string;
          progress: number;
          goals: Record<string, unknown>[] | null;
          milestones: Record<string, unknown>[] | null;
          start_date: string | null;
          target_end_date: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          account_id: string;
          name: string;
          status?: string;
          progress?: number;
          goals?: Record<string, unknown>[] | null;
          milestones?: Record<string, unknown>[] | null;
          start_date?: string | null;
          target_end_date?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          account_id?: string;
          name?: string;
          status?: string;
          progress?: number;
          goals?: Record<string, unknown>[] | null;
          milestones?: Record<string, unknown>[] | null;
          start_date?: string | null;
          target_end_date?: string | null;
          created_at?: string;
        };
      };
      emails: {
        Row: {
          id: string;
          account_id: string;
          type: string;
          template_id: string | null;
          subject: string;
          body: string;
          recipient_email: string | null;
          sent_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          account_id: string;
          type: string;
          template_id?: string | null;
          subject: string;
          body: string;
          recipient_email?: string | null;
          sent_at?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          account_id?: string;
          type?: string;
          template_id?: string | null;
          subject?: string;
          body?: string;
          recipient_email?: string | null;
          sent_at?: string | null;
          created_at?: string;
        };
      };
      alert_states: {
        Row: {
          id: string;
          alert_id: string;
          account_id: string;
          status: string;
          snoozed_until: string | null;
          resolved_at: string | null;
          notes: string | null;
          updated_by: string | null;
          updated_at: string;
        };
        Insert: {
          id?: string;
          alert_id: string;
          account_id: string;
          status: string;
          snoozed_until?: string | null;
          resolved_at?: string | null;
          notes?: string | null;
          updated_by?: string | null;
          updated_at?: string;
        };
        Update: {
          id?: string;
          alert_id?: string;
          account_id?: string;
          status?: string;
          snoozed_until?: string | null;
          resolved_at?: string | null;
          notes?: string | null;
          updated_by?: string | null;
          updated_at?: string;
        };
      };
    };
  };
}

// ============================================================================
// CLIENT INITIALIZATION
// ============================================================================

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

/**
 * Check if Supabase is properly configured
 */
export const isSupabaseConfigured = (): boolean => {
  return Boolean(supabaseUrl && supabaseAnonKey);
};

/**
 * Create Supabase client instance
 * Returns null if not configured
 */
let supabaseClient: SupabaseClient<Database> | null = null;

export const getSupabaseClient = (): SupabaseClient<Database> | null => {
  if (!isSupabaseConfigured()) {
    return null;
  }
  
  if (!supabaseClient) {
    supabaseClient = createClient<Database>(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
      },
    });
  }
  
  return supabaseClient;
};

// Export the client directly for convenience (may be null)
export const supabase = getSupabaseClient();

// ============================================================================
// ERROR HANDLING WRAPPER
// ============================================================================

export interface SupabaseResult<T> {
  data: T | null;
  error: Error | null;
  isFromCache: boolean;
}

/**
 * Execute a Supabase operation with error handling and optional fallback
 */
export async function executeSupabaseOperation<T>(
  operation: () => Promise<{ data: T | null; error: Error | null }>,
  fallbackFn?: () => T | null
): Promise<SupabaseResult<T>> {
  const client = getSupabaseClient();
  
  // If Supabase is not configured, use fallback
  if (!client) {
    if (fallbackFn) {
      return {
        data: fallbackFn(),
        error: null,
        isFromCache: true,
      };
    }
    return {
      data: null,
      error: new Error('Supabase is not configured'),
      isFromCache: false,
    };
  }
  
  try {
    const { data, error } = await operation();
    
    if (error) {
      console.error('Supabase operation failed:', error);
      
      // Try fallback if available
      if (fallbackFn) {
        return {
          data: fallbackFn(),
          error: error as Error,
          isFromCache: true,
        };
      }
      
      return {
        data: null,
        error: error as Error,
        isFromCache: false,
      };
    }
    
    return {
      data,
      error: null,
      isFromCache: false,
    };
  } catch (err) {
    console.error('Supabase operation threw exception:', err);
    
    // Try fallback if available
    if (fallbackFn) {
      return {
        data: fallbackFn(),
        error: err as Error,
        isFromCache: true,
      };
    }
    
    return {
      data: null,
      error: err as Error,
      isFromCache: false,
    };
  }
}

// ============================================================================
// TYPE HELPERS
// ============================================================================

export type InteractionRow = Database['public']['Tables']['interactions']['Row'];
export type InteractionInsert = Database['public']['Tables']['interactions']['Insert'];
export type InteractionUpdate = Database['public']['Tables']['interactions']['Update'];

export type TaskRow = Database['public']['Tables']['tasks']['Row'];
export type TaskInsert = Database['public']['Tables']['tasks']['Insert'];
export type TaskUpdate = Database['public']['Tables']['tasks']['Update'];

export type SuccessPlanRow = Database['public']['Tables']['success_plans']['Row'];
export type SuccessPlanInsert = Database['public']['Tables']['success_plans']['Insert'];
export type SuccessPlanUpdate = Database['public']['Tables']['success_plans']['Update'];

export type EmailRow = Database['public']['Tables']['emails']['Row'];
export type EmailInsert = Database['public']['Tables']['emails']['Insert'];
export type EmailUpdate = Database['public']['Tables']['emails']['Update'];

export type AlertStateRow = Database['public']['Tables']['alert_states']['Row'];
export type AlertStateInsert = Database['public']['Tables']['alert_states']['Insert'];
export type AlertStateUpdate = Database['public']['Tables']['alert_states']['Update'];
