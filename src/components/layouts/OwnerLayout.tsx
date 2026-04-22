import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { useTenantStore } from '../../stores/tenantStore'
import { useAuth } from '../../hooks/useAuth'

const NavIcon = ({ label }: { label: string }) => {
  if (label === 'Panel en vivo') return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <rect x="1" y="1" width="6" height="6" rx="1" stroke="currentColor" strokeWidth="1.5"/>
      <rect x="9" y="1" width="6" height="6" rx="1" stroke="currentColor" strokeWidth="1.5"/>
      <rect x="1" y="9" width="6" height="6" rx="1" stroke="currentColor" strokeWidth="1.5"/>
      <rect x="9" y="9" width="6" height="6" rx="1" stroke="currentColor" strokeWidth="1.5"/>
    </svg>
  )
  if (label === 'Métricas') return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <polyline points="1,13 5,8 9,10 15,3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )
  if (label === 'Barberos') return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <circle cx="6" cy="5" r="2.5" stroke="currentColor" strokeWidth="1.5"/>
      <path d="M1 14c0-2.761 2.239-5 5-5s5 2.239 5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      <circle cx="12" cy="5" r="2" stroke="currentColor" strokeWidth="1.5"/>
      <path d="M14 14c0-2.209-1.343-4-3-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  )
  if (label === 'Servicios') return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeWidth="1.5"/>
      <path d="M8 4.5v7M6 6.5c0-.828.895-1.5 2-1.5s2 .672 2 1.5-1 1.5-2 1.5-2 .672-2 1.5.895 1.5 2 1.5 2-.672 2-1.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  )
  if (label === 'Configuración') return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <circle cx="8" cy="8" r="2.5" stroke="currentColor" strokeWidth="1.5"/>
      <path d="M8 1v2M8 13v2M1 8h2M13 8h2M3.05 3.05l1.414 1.414M11.536 11.536l1.414 1.414M3.05 12.95l1.414-1.414M11.536 4.464l1.414-1.414" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  )
  return null
}

const SHORT_LABELS: Record<string, string> = {
  'Panel en vivo': 'Live',
  'Métricas': 'Métricas',
  'Configuración': 'Config',
  'Barberos': 'Barberos',
  'Servicios': 'Servicios',
}

export function OwnerLayout() {
  const { tenant } = useTenantStore()
  const { signOut } = useAuth()
  const navigate = useNavigate()
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768)

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 768)
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  const handleSignOut = async () => {
    try {
      await signOut()
      navigate('/login')
    } catch (err) {
      console.error('Error al cerrar sesión:', err)
      navigate('/login')
    }
  }

  const navItems = [
    { to: '/owner/live', label: 'Panel en vivo' },
    { to: '/owner/metrics', label: 'Métricas' },
    { to: '/owner/settings', label: 'Configuración' },
    { to: '/owner/barbers', label: 'Barberos' },
    { to: '/owner/services', label: 'Servicios' },
  ]

  if (isMobile) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', background: '#F4F5F7' }}>
        {/* Mobile top header */}
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, height: '52px', background: 'var(--primary, #3D3A8C)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 16px', zIndex: 100 }}>
          <span style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: '16px', color: '#fff' }}>
            {tenant?.name}
          </span>
          <button
            onClick={handleSignOut}
            style={{ background: 'transparent', border: 'none', padding: 0, color: 'var(--secondary, #FF8C42)', fontSize: '13px', cursor: 'pointer', fontWeight: 500 }}
          >
            Cerrar sesión
          </button>
        </div>

        {/* Content */}
        <div style={{ marginTop: '52px', flex: 1, padding: '24px', paddingBottom: '80px', overflow: 'auto' }}>
          <Outlet />
        </div>

        {/* Mobile bottom nav */}
        <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, height: '60px', background: 'var(--primary, #3D3A8C)', display: 'flex', alignItems: 'center', zIndex: 100 }}>
          {navItems.map(({ to, label }) => (
            <NavLink
              key={to}
              to={to}
              style={({ isActive }) => ({
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '3px',
                color: isActive ? 'var(--secondary, #FF8C42)' : 'rgba(255,255,255,0.5)',
                textDecoration: 'none',
                fontSize: '10px',
                fontWeight: 500,
              })}
            >
              <NavIcon label={label} />
              {SHORT_LABELS[label]}
            </NavLink>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      {/* Sidebar */}
      <div style={{ width: '210px', flexShrink: 0, display: 'flex', flexDirection: 'column', background: 'var(--primary, #3D3A8C)', position: 'fixed', top: 0, left: 0, height: '100vh' }}>
        {/* Tenant info */}
        <div style={{ padding: '24px 20px 20px' }}>
          <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: '17px', color: '#fff', marginBottom: '4px' }}>
            {tenant?.name}
          </div>
          <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.45)' }}>
            Panel de administración
          </div>
        </div>

        {/* Nav items */}
        <nav style={{ flex: 1, padding: '8px 0' }}>
          {navItems.map(({ to, label }) => (
            <NavLink
              key={to}
              to={to}
              style={({ isActive }) => ({
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                padding: '10px 20px',
                fontSize: '13px',
                fontWeight: 500,
                color: isActive ? '#fff' : 'rgba(255,255,255,0.6)',
                background: isActive ? 'rgba(255,255,255,0.15)' : 'transparent',
                borderRight: isActive ? '3px solid var(--secondary, #FF8C42)' : '3px solid transparent',
                textDecoration: 'none',
              })}
            >
              <NavIcon label={label} />
              {label}
            </NavLink>
          ))}
        </nav>

        {/* Footer */}
        <div style={{ padding: '16px 20px', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
          <button
            onClick={handleSignOut}
            style={{ background: 'transparent', border: 'none', padding: 0, color: 'var(--secondary, #FF8C42)', fontSize: '12px', cursor: 'pointer', fontWeight: 500 }}
          >
            Cerrar sesión
          </button>
        </div>

        {/* Watermark */}
        <div style={{ textAlign: 'center', padding: '10px 0 14px', fontSize: '10px', color: 'rgba(255,255,255,0.15)' }}>
          Aliada Barberías
        </div>
      </div>

      {/* Main content */}
      <div style={{ marginLeft: '210px', flex: 1, background: '#F4F5F7', minHeight: '100vh', overflow: 'auto', padding: '24px' }}>
        <Outlet />
      </div>
    </div>
  )
}
