// api/_supabase.js
// Service-role Supabase client shared by top-level api/*.js endpoints that
// need to read/write without RLS (currently just the Pro check in
// _requirePro.js). Deliberately separate from api/plaid/_supabase.js — same
// logic, but kept feature-scoped rather than shared across directories.
import { createClient } from '@supabase/supabase-js'

let cached = null

export function getServiceClient() {
  if (cached) return cached
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_KEY
  if (!url || !key) {
    throw new Error('SUPABASE_URL / SUPABASE_SERVICE_KEY env vars are not set')
  }
  cached = createClient(url, key)
  return cached
}
