import { createClient, type SupabaseClient } from '@supabase/supabase-js';

/**
 * Server-side Supabase client.
 *
 * Uses the service role key (never exposed to the browser) so we can persist
 * alert state / notes from API routes without leaking credentials.
 */

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

let supabase: SupabaseClient | null = null;

export function getSupabaseServerClient(): SupabaseClient | null {
  if (!supabaseUrl || !supabaseServiceKey) return null;
  if (!supabase) {
    supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
  }
  return supabase;
}
