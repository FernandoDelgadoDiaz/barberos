import { useEffect, useState } from 'react'
import { useTenantStore } from '../stores/tenantStore'
import { supabase } from '../config/supabase'
import type { Profile, Tenant } from '../types'

export function useAuth() {
  const { setTenant, setProfile, clearSession } = useTenantStore()
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const { tenant, profile } = useTenantStore()

  const loadUserData = async (userId: string) => {
    try {
      // 1. Load profile
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', userId)
        .single()

      if (profileError) throw profileError
      if (!profileData) throw new Error('Perfil no encontrado')

      setProfile(profileData as Profile)

      // 2. Load tenant
      const { data: tenantData, error: tenantError } = await supabase
        .from('tenants')
        .select('*')
        .eq('id', profileData.tenant_id)
        .single()

      if (tenantError) throw tenantError
      if (!tenantData) throw new Error('Tenant no encontrado')

      setTenant(tenantData as Tenant)
    } catch (err) {
      console.error('Error loading user data:', err)
      setError(err instanceof Error ? err.message : 'Error desconocido')
      clearSession()
    }
  }

  useEffect(() => {
    // Check existing session on mount
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        loadUserData(session.user.id).finally(() => setIsLoading(false))
      } else {
        setIsLoading(false)
      }
    })

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      setIsLoading(true)
      setError(null)

      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        if (session?.user) {
          await loadUserData(session.user.id)
        }
      } else if (event === 'SIGNED_OUT') {
        clearSession()
      }

      setIsLoading(false)
    })

    return () => subscription.unsubscribe()
  }, [])

  const signIn = async (email: string, password: string) => {
    setIsLoading(true)
    setError(null)

    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) throw error
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al iniciar sesión')
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