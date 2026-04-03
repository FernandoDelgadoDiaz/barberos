import { RouterProvider } from 'react-router-dom'
import { router } from './router'
import { TenantTheme } from './components/TenantTheme'

export default function App() {
  return (
    <TenantTheme>
      <RouterProvider router={router} />
    </TenantTheme>
  )
}