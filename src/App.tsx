import { RouterProvider } from 'react-router-dom'
import { router } from './router'
import { TenantTheme } from './components/TenantTheme'
import { AppUpdateNotice } from './components/AppUpdateNotice'
import { useAuthBootstrap } from './hooks/useAuth'

export default function App() {
  useAuthBootstrap()
  return (
    <TenantTheme>
      <RouterProvider router={router} />
      <AppUpdateNotice />
    </TenantTheme>
  )
}