import { Navigate, Outlet } from 'react-router-dom'
import { useTenantStore } from '../stores/tenantStore'
import type { UserRole } from '../types'
import { AppSplash } from './AppSplash'

interface PrivateRouteProps {
  allowedRoles: UserRole[]
  requireBarberCapability?: boolean
}

export function PrivateRoute({ allowedRoles, requireBarberCapability = false }: PrivateRouteProps) {
  const { profile, authStatus, authError } = useTenantStore()

  // Wait for the stored session to be restored: a cold start (e.g. iOS reopening
  // the home-screen app) must not bounce a logged-in user to the login form.
  if (authStatus === 'checking') return <AppSplash />
  if (authStatus === 'error') return <AppSplash error={authError} />

  if (!profile) {
    return <Navigate to="/login" replace />
  }

  if (!allowedRoles.includes(profile.role)) {
    return <Navigate to="/login" replace />
  }

  if (requireBarberCapability && profile.role === 'owner' && !profile.works_as_barber) {
    return <Navigate to="/owner/barbers" replace />
  }

  return <Outlet />
}