import { createClient } from '@supabase/supabase-js'
import { proxiedFetch } from '../utils/supabaseProxy'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

// Production calls Supabase through the app's own domain (see utils/supabaseProxy).
const useProxy = import.meta.env.PROD && /^https:\/\/[a-z0-9]+\.supabase\.co$/.test(supabaseUrl)

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  ...(useProxy ? { global: { fetch: proxiedFetch(supabaseUrl, window.location.origin) } } : {}),
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
    flowType: 'pkce',
    storage: window.localStorage,
    storageKey: 'barberos-auth-token',
    lock: async (_name, _acquireTimeout, fn) => {
      return fn()
    }
  }
})