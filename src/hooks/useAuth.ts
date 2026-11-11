import { useEffect, useState } from 'react'
import { useTenantStore } from '../stores/tenantStore'
import { supabase } from '../config/supabase'
import type { Profile, Tenant } from '../types'

/** Home screen for each role once logged in. */
export function homePathFor(profile: Pick<Profile, 'role'>): string {
  if (profile.role === 'owner') return '/owner/live'
  if (profile.role === 'superadmin') return '/superadmin/tenants'
  return '/barber/dashboard'
}

async function loadUserData(userId: string) {
  const { setProfile, setTenant, setAuthStatus } = useTenantStore.getState()
  setAuthStatus('checking')
  try {
    const { data: profileData, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('user_id', userId)
      .single()
    if (profileError) throw profileError
    if (!profileData) throw new Error('Perfil no encontrado')

    const { data: tenantData, error: tenantError } = await supabase
      .from('tenants')
      .select('*')
      .eq('id', profileData.tenant_id)
      .single()
    if (tenantError) throw tenantError
    if (!tenantData) throw new Error('Tenant no encontrado')

    setProfile(profileData as Profile)
    setTenant(tenantData as Tenant)
    setAuthStatus('ready')
  } catch (err) {
    console.error('Error loading user data:', err)
    // The session is still valid: never send the user back to the login form
    // because the network failed. The UI offers a retry instead.
    const message = err instanceof Error ? err.message : 'Error desconocido al cargar datos'
    setAuthStatus('error', message)
  }
}

/**
 * Restores the session stored on the device ONCE, at app startup (mounted in App).
 *
 * When iOS discards the home-screen app in the background, reopening it is a cold
 * start: the profile is not in memory yet. Routes used to read that as "logged out"
 * and showed the login form (or the marketing page), so barbers typed their
 * password again although the session was still stored and valid.
 */
export function useAuthBootstrap() {
  useEffect(() => {
    let active = true
    const { clearSession, setAuthStatus } = useTenantStore.getState()

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!active) return
      if (session) void loadUserData(session.user.id)
      else setAuthStatus('ready')
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' && session) {
        // Supabase also emits SIGNED_IN when the app comes back to the foreground;
        // reloading the same user there only made the screen flash.
        const current = useTenantStore.getState().profile
        // Deferred: supabase calls must not run inside this callback.
        if (current?.user_id !== session.user.id) setTimeout(() => void loadUserData(session.user.id), 0)
      } else if (event === 'SIGNED_OUT') {
        clearSession()
        setAuthStatus('ready')
      }
    })

    return () => {
      active = false
      subscription.unsubscribe()
    }
  }, [])
}

/** Retry after a failed startup load, keeping the stored session. */
export async function retryAuthBootstrap() {
  const { data: { session } } = await supabase.auth.getSession()
  if (session) await loadUserData(session.user.id)
  else useTenantStore.getState().setAuthStatus('ready')
}

export function useAuth() {
  const { clearSession, tenant, profile } = useTenantStore()
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const signIn = async (email: string, password: string) => {
    setIsLoading(true)
    setError(null)

    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) throw error
      // useAuthBootstrap's listener loads the profile on SIGNED_IN
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error al iniciar sesión'
      setError(message)
      throw err
    } finally {
      setIsLoading(false)
    }
  }

  const signOut = async () => {
    await supabase.auth.signOut()
    clearSession()
  }

  return {
    user: tenant && profile ? { ...profile, tenant } : null,
    profile,
    tenant,
    isLoading,
    error,
    signIn,
    signOut
  }
}
