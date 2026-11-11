import { create } from 'zustand'
import type { Tenant, Profile } from '../types'

interface TenantStore {
  tenant: Tenant | null
  profile: Profile | null
  isLoading: boolean
  /**
   * Startup state of the stored session. 'checking' until the session stored on
   * the device has been read and, if there is one, the profile has loaded. Routes
   * must wait for it instead of treating "no profile yet" as "logged out".
   */
  authStatus: 'checking' | 'ready' | 'error'
  authError: string | null
  activeShiftId: string | null
  setTenant: (tenant: Tenant | null) => void
  setProfile: (profile: Profile | null) => void
  setActiveShiftId: (id: string | null) => void
  setAuthStatus: (authStatus: 'checking' | 'ready' | 'error', authError?: string | null) => void
  clearSession: () => void
  isOwner: () => boolean
  isBarber: () => boolean
  isSuperadmin: () => boolean
}

export const useTenantStore = create<TenantStore>((set, get) => ({
  tenant: null,
  profile: null,
  isLoading: false,
  authStatus: 'checking',
  authError: null,
  activeShiftId: null,
  setTenant: (tenant) => set({ tenant }),
  setProfile: (profile) => set({ profile }),
  setActiveShiftId: (id) => set({ activeShiftId: id }),
  setAuthStatus: (authStatus, authError = null) => set({ authStatus, authError }),
  clearSession: () => set({ tenant: null, profile: null, isLoading: false, activeShiftId: null }),
  isOwner: () => get().profile?.role === 'owner',
  isBarber: () => get().profile?.role === 'barber',
  isSuperadmin: () => get().profile?.role === 'superadmin'
}))