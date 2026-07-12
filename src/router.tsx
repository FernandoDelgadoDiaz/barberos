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
import { History } from './pages/owner/History'
import { Products } from './pages/owner/Products'
import { Tenants } from './pages/superadmin/Tenants'
import { PaymentResult } from './pages/PaymentResult'

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
    path: '/pago/exito',
    element: <PaymentResult variant="exito" />
  },
  {
    path: '/pago/pendiente',
    element: <PaymentResult variant="pendiente" />
  },
  {
    path: '/pago/error',
    element: <PaymentResult variant="error" />
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
            path: 'history',
            element: <History />
          },
          {
            path: 'products',
            element: <Products />
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
