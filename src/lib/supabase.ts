import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let _client: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient | null {
  if (_client) return _client;
  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !key) return null;
    _client = createClient(url, key);
    return _client;
  } catch {
    return null;
  }
}

export function isSupabaseConfigured(): boolean {
  return getSupabase() !== null;
}

// Convenience export – may be null before env vars are set
export const supabase = getSupabase();
