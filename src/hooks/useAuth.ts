import { useEffect, useState, useRef } from 'react'
import { useTenantStore } from '../stores/tenantStore'
import { supabase } from '../config/supabase'
import type { Profile, Tenant } from '../types'

const QUERY_TIMEOUT_MS = 5000 // 5 seconds timeout for profile/tenant queries

export function useAuth() {
  const { setTenant, setProfile, clearSession } = useTenantStore()
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const { tenant, profile } = useTenantStore()
  const loadingRef = useRef(false) // Prevent multiple simultaneous loads

  // Validate UUID format (with or without hyphens)
  const isValidUserId = (userId: string): boolean => {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    const hexRegex = /^[0-9a-f]{32}$/i
    return uuidRegex.test(userId) || hexRegex.test(userId)
  }

  const loadUserData = async (userId: string) => {
    // Prevent multiple simultaneous loads
    if (loadingRef.current) {
      console.warn('loadUserData already in progress, skipping')
      return
    }

    if (!isValidUserId(userId)) {
      const err = new Error(`ID de usuario inválido: ${userId}`)
      console.error('Invalid user ID format:', userId)
      setError(err.message)
      clearSession()
      setTimeout(() => {
        supabase.auth.signOut().catch(err => console.error('Error durante signOut:', err))
      }, 0)
      throw err
    }

    loadingRef.current = true
    setIsLoading(true)
    setError(null)

    try {
      // 1. Load profile with timeout
      const profilePromise = supabase
        .from('profiles')
        .select('*')
        .eq('user_id', userId)
        .single()

      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Timeout: la consulta de perfil tardó demasiado')), QUERY_TIMEOUT_MS)
      )

      const { data: profileData, error: profileError } = await Promise.race([profilePromise, timeoutPromise])

      if (profileError) {
        // If profile not found (404), still treat as error but don't sign out immediately
        const status = (profileError as any).status || 0
        const code = (profileError as any).code || ''
        if (status === 404 || code === 'PGRST116') { // No rows returned
          throw new Error('Perfil no encontrado. Contacta al administrador.')
        }
        // For 500 errors or other server errors
        console.error('Error del servidor al cargar perfil:', profileError)
        throw new Error(`Error del servidor: ${profileError.message || 'consulta a profiles falló'}`)
      }

      if (!profileData) {
        throw new Error('Perfil no encontrado')
      }

      setProfile(profileData as Profile)

      // 2. Load tenant with timeout
      const tenantPromise = supabase
        .from('tenants')
        .select('*')
        .eq('id', profileData.tenant_id)
        .single()

      const tenantTimeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Timeout: la consulta de tenant tardó demasiado')), QUERY_TIMEOUT_MS)
      )

      const { data: tenantData, error: tenantError } = await Promise.race([tenantPromise, tenantTimeoutPromise])

      if (tenantError) {
        const status = (tenantError as any).status || 0
        const code = (tenantError as any).code || ''
        if (status === 404 || code === 'PGRST116') {
          throw new Error('Tenant no encontrado para este perfil.')
        }
        console.error('Error del servidor al cargar tenant:', tenantError)
        throw new Error(`Error del servidor: ${tenantError.message || 'consulta a tenants falló'}`)
      }

      if (!tenantData) {
        throw new Error('Tenant no encontrado')
      }

      setTenant(tenantData as Tenant)

    } catch (err) {
      console.error('Error loading user data:', err)
      const message = err instanceof Error ? err.message : 'Error desconocido al cargar datos'
      setError(message)

      // Always clear local session data
      clearSession()

      // Determine if we should also sign out from Supabase auth
      const shouldSignOut =
        message.includes('Error del servidor') ||
        message.includes('Timeout') ||
        message.includes('Perfil no encontrado') ||
        message.includes('Tenant no encontrado') ||
        message.includes('ID de usuario inválido')

      if (shouldSignOut) {
        console.log('Cerrando sesión de Supabase debido a error:', message)
        // Schedule signOut to avoid interfering with current auth state change listener
        setTimeout(() => {
          supabase.auth.signOut().catch(err => console.error('Error durante signOut:', err))
        }, 0)
      }

      throw err // Re-throw for caller to handle if needed
    } finally {
      loadingRef.current = false
      setIsLoading(false)
    }
  }

  useEffect(() => {
    let mounted = true
    let subscription: { unsubscribe: () => void } | null = null

    const initializeAuth = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession()

        if (!mounted) return

        if (session?.user) {
          await loadUserData(session.user.id)
        }
      } catch (err) {
        console.error('Error initializing auth:', err)
      } finally {
        if (mounted) {
          setIsLoading(false)
        }
      }
    }

    initializeAuth()

    // Listen for auth changes - simplified to avoid loops
    const { data: { subscription: authSubscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!mounted) return

      // Only handle specific events
      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        if (session?.user) {
          try {
            await loadUserData(session.user.id)
          } catch (err) {
            // Error already handled in loadUserData
          }
        }
      } else if (event === 'SIGNED_OUT') {
        clearSession()
      }
      // Ignore other events like USER_UPDATED to prevent loops
    })

    subscription = authSubscription

    return () => {
      mounted = false
      if (subscription) {
        subscription.unsubscribe()
      }
    }
  }, [])

  const signIn = async (email: string, password: string) => {
    setIsLoading(true)
    setError(null)

    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) throw error
      // Auth state change listener will handle loading user data
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