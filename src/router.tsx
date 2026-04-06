import { createBrowserRouter, Navigate } from 'react-router-dom'
import { Login } from './pages/Login'
import { Register } from './pages/Register'
import Landing from './pages/Landing'
import { PrivateRoute } from './components/PrivateRoute'
import { BarberLayout } from './components/layouts/BarberLayout'
import { OwnerLayout } from './components/layouts/OwnerLayout'
import { Dashboard } from './pages/barber/Dashboard'
import { Summary } from './pages/barber/Summary'
import { LivePanel } from './pages/owner/LivePanel'
import { Metrics } from './pages/owner/Metrics'
import { Settings } from './pages/owner/Settings'
import { Barbers } from './pages/owner/Barbers'
import { Services } from './pages/owner/Services'
import { Tenants } from './pages/superadmin/Tenants'

export const router = createBrowserRouter([
  {
    path: '/',
    element: <Landing />
  },
  {
    path: '/login',
    element: <Login />
  },
  {
    path: '/register',
    element: <Register />
  },
  {
    path: '/barber',
    element: <PrivateRoute allowedRoles={['barber']} />,
    children: [
      {
        element: <BarberLayout />,
        children: [
          {
            path: 'dashboard',
            element: <Dashboard />
          },
          {
            path: 'summary',
            element: <Summary />
          },
          {
            index: true,
            element: <Navigate to="dashboard" replace />
          }
        ]
      }
    ]
  },
  {
    path: '/owner',
    element: <PrivateRoute allowedRoles={['owner']} />,
    children: [
      {
        element: <OwnerLayout />,
        children: [
          {
            path: 'live',
            element: <LivePanel />
          },
          {
            path: 'metrics',
            element: <Metrics />
          },
          {
            path: 'settings',
            element: <Settings />
          },
          {
            path: 'barbers',
            element: <Barbers />
          },
          {
            path: 'services',
            element: <Services />
          },
          {
            index: true,
            element: <Navigate to="live" replace />
          }
        ]
      }
    ]
  },
  {
    path: '/superadmin',
    element: <PrivateRoute allowedRoles={['superadmin']} />,
    children: [
      {
        path: 'tenants',
        element: <Tenants />
      },
      {
        index: true,
        element: <Navigate to="tenants" replace />
      }
    ]
  },
  {
    path: '*',
    element: <Navigate to="/login" replace />
  }
])