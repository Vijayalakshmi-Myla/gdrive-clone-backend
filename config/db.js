import { createClient } from '@supabase/supabase-js';
import { ENV } from "./env.js"

// Public client (non-privileged operations)
export const supabase = createClient(ENV.SUPABASE_URL, ENV.SUPABASE_ANON_KEY, {
  auth: { persistSession: false }
});

// Service-role client for admin ops (signed URLs, server-only tasks)
export const supabaseAdmin = createClient(ENV.SUPABASE_URL, ENV.SUPABASE_SERVICE_ROLE, {
  auth: { persistSession: false }
});
