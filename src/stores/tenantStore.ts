import { create } from 'zustand'
import type { Tenant, Profile } from '../types'

interface TenantStore {
  tenant: Tenant | null
  profile: Profile | null
  isLoading: boolean
  activeShiftId: string | null
  setTenant: (tenant: Tenant | null) => void
  setProfile: (profile: Profile | null) => void
  setActiveShiftId: (id: string | null) => void
  clearSession: () => void
  isOwner: () => boolean
  isBarber: () => boolean
  isSuperadmin: () => boolean
}

export const useTenantStore = create<TenantStore>((set, get) => ({
  tenant: null,
  profile: null,
  isLoading: false,
  activeShiftId: null,
  setTenant: (tenant) => set({ tenant }),
  setProfile: (profile) => set({ profile }),
  setActiveShiftId: (id) => set({ activeShiftId: id }),
  clearSession: () => set({ tenant: null, profile: null, isLoading: false, activeShiftId: null }),
  isOwner: () => get().profile?.role === 'owner',
  isBarber: () => get().profile?.role === 'barber',
  isSuperadmin: () => get().profile?.role === 'superadmin'
}))