import { RouterProvider } from 'react-router-dom'
import { router } from './router'
import { TenantTheme } from './components/TenantTheme'
import { AppUpdateNotice } from './components/AppUpdateNotice'

export default function App() {
  return (
    <TenantTheme>
      <RouterProvider router={router} />
      <AppUpdateNotice />
    </TenantTheme>
  )
}