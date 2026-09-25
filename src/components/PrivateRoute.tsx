import { Navigate, Outlet } from 'react-router-dom'
import { useTenantStore } from '../stores/tenantStore'
import type { UserRole } from '../types'

interface PrivateRouteProps {
  allowedRoles: UserRole[]
  requireBarberCapability?: boolean
}

export function PrivateRoute({ allowedRoles, requireBarberCapability = false }: PrivateRouteProps) {
  const { profile, isLoading } = useTenantStore()

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-lg">Cargando...</div>
      </div>
    )
  }

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