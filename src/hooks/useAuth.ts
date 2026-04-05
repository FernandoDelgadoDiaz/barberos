import { useEffect, useState, useRef } from 'react'
import { useTenantStore } from '../stores/tenantStore'
import { supabase } from '../config/supabase'
import type { Profile, Tenant } from '../types'

// No timeout for queries to avoid signOut on tab switch

export function useAuth() {
  const { setTenant, setProfile, clearSession } = useTenantStore()
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const { tenant, profile } = useTenantStore()
  const loadingRef = useRef(false) // Prevent multiple simultaneous loads
  const currentUserIdRef = useRef<string | null>(null) // Track current user ID for retries
  const transientErrorRef = useRef(false) // Track if we have a transient error

  // Validate UUID format (with or without hyphens)
  const isValidUserId = (userId: string): boolean => {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    const hexRegex = /^[0-9a-f]{32}$/i
    return uuidRegex.test(userId) || hexRegex.test(userId)
  }

  const loadUserData = async (userId: string, isRetry = false) => {
    // Prevent multiple simultaneous loads
    if (loadingRef.current && !isRetry) {
      console.warn('loadUserData already in progress, skipping')
      return
    }

    if (!isValidUserId(userId)) {
      const err = new Error(`ID de usuario inválido: ${userId}`)
      console.error('Invalid user ID format:', userId)
      setError(err.message)
      clearSession()
      currentUserIdRef.current = null
      transientErrorRef.current = false
      setTimeout(() => {
        supabase.auth.signOut().catch(err => console.error('Error durante signOut:', err))
      }, 0)
      throw err
    }

    currentUserIdRef.current = userId

    loadingRef.current = true
    setIsLoading(true)
    setError(null)

    try {
      // 1. Load profile without timeout (timeouts cause signOut on tab switch)
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', userId)
        .single()

      if (profileError) {
        const status = (profileError as any).status || 0
        const code = (profileError as any).code || ''
        if (status === 404 || code === 'PGRST116') { // No rows returned
          throw new Error('Perfil no encontrado. Contacta al administrador.')
        }
        // For network errors or server errors (5xx), treat as transient error
        console.error('Error al cargar perfil (transient):', profileError)
        throw new Error(`Error de conexión: ${profileError.message || 'no se pudo cargar el perfil'}`)
      }

      if (!profileData) {
        throw new Error('Perfil no encontrado')
      }

      setProfile(profileData as Profile)

      // 2. Load tenant without timeout
      const { data: tenantData, error: tenantError } = await supabase
        .from('tenants')
        .select('*')
        .eq('id', profileData.tenant_id)
        .single()

      if (tenantError) {
        const status = (tenantError as any).status || 0
        const code = (tenantError as any).code || ''
        if (status === 404 || code === 'PGRST116') {
          throw new Error('Tenant no encontrado para este perfil.')
        }
        console.error('Error al cargar tenant (transient):', tenantError)
        throw new Error(`Error de conexión: ${tenantError.message || 'no se pudo cargar el tenant'}`)
      }

      if (!tenantData) {
        throw new Error('Tenant no encontrado')
      }

      setTenant(tenantData as Tenant)
      transientErrorRef.current = false

    } catch (err) {
      console.error('Error loading user data:', err)
      const message = err instanceof Error ? err.message : 'Error desconocido al cargar datos'
      setError(message)

      // Determine error type
      const isNotFound = message.includes('Perfil no encontrado') ||
                         message.includes('Tenant no encontrado') ||
                         message.includes('ID de usuario inválido')
      const isTransient = message.includes('Error de conexión')

      if (isNotFound) {
        // Clear local session and sign out from Supabase auth
        clearSession()
        currentUserIdRef.current = null
        transientErrorRef.current = false
        console.log('Cerrando sesión de Supabase debido a error:', message)
        setTimeout(() => {
          supabase.auth.signOut().catch(err => console.error('Error durante signOut:', err))
        }, 0)
      } else if (isTransient) {
        // Transient error (network/server) - keep session data, don't sign out
        // User data remains in store (if already loaded), just show error
        // No clearSession() call
        transientErrorRef.current = true
        console.warn('Error transitorio, manteniendo sesión:', message)
      } else {
        // Unknown error type - be conservative: clear session but don't sign out
        clearSession()
        currentUserIdRef.current = null
        transientErrorRef.current = false
        console.error('Error desconocido, limpiando sesión local:', message)
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
        currentUserIdRef.current = null
        transientErrorRef.current = false
      }
      // Ignore other events like USER_UPDATED to prevent loops
    })

    subscription = authSubscription

    // Handle tab visibility changes to retry transient errors
    const handleVisibilityChange = () => {
      if (!mounted) return
      if (document.visibilityState === 'visible' && transientErrorRef.current && currentUserIdRef.current) {
        console.log('Tab visible again, retrying loadUserData after transient error')
        // Retry after a short delay to avoid race conditions
        setTimeout(() => {
          if (mounted && transientErrorRef.current && currentUserIdRef.current) {
            loadUserData(currentUserIdRef.current, true).catch(err =>
              console.error('Retry failed:', err)
            )
          }
        }, 1000)
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      mounted = false
      document.removeEventListener('visibilitychange', handleVisibilityChange)
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
    currentUserIdRef.current = null
    transientErrorRef.current = false
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