import { createClient, type SupabaseClient } from '@supabase/supabase-js'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _db: SupabaseClient<any> | null = null

// Lazily initialized so build-time static analysis doesn't crash without env vars.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function getDb(): SupabaseClient<any> {
  if (_db) return _db
  const url = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set')
  _db = createClient(url, key)
  return _db
}
