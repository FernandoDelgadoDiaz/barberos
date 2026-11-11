import { Navigate } from 'react-router-dom'
import { useTenantStore } from '../stores/tenantStore'
import { homePathFor } from '../hooks/useAuth'
import { AppSplash } from './AppSplash'
import Landing from '../pages/Landing'

/**
 * "/" is also where the home-screen app reopens (manifest start_url). With a
 * stored session go straight to the user's panel; the marketing page is only
 * for visitors without one.
 */
export function HomeRoute() {
  const { profile, authStatus, authError } = useTenantStore()
  if (authStatus === 'checking') return <AppSplash />
  if (authStatus === 'error') return <AppSplash error={authError} />
  if (profile) return <Navigate to={homePathFor(profile)} replace />
  return <Landing />
}
