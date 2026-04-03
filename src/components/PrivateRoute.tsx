import { Navigate, Outlet } from 'react-router-dom'
import { useTenantStore } from '../stores/tenantStore'
import type { UserRole } from '../types'

interface PrivateRouteProps {
  allowedRoles: UserRole[]
}

export function PrivateRoute({ allowedRoles }: PrivateRouteProps) {
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

  return <Outlet />
}