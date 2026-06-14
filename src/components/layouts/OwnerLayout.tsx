import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { useTenantStore } from '../../stores/tenantStore'
import { useAuth } from '../../hooks/useAuth'
import { TrialExpiredGuard } from '../TrialExpiredGuard'
import { SuspendedGuard } from '../SuspendedGuard'

// Bottom-nav / drawer icons. 24px nominal stroke icons.
const NavIcon = ({ label, active }: { label: string; active?: boolean }) => {
  const color = active ? '#2563EB' : '#9CA3AF'
  if (label === 'Panel en vivo' || label === 'Inicio') return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
      <path d="M3 11.5L12 4l9 7.5" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M5 10v9a1 1 0 0 0 1 1h4v-6h4v6h4a1 1 0 0 0 1-1v-9" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )
  if (label === 'Métricas') return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
      <path d="M4 19V5" stroke={color} strokeWidth="1.8" strokeLinecap="round"/>
      <path d="M4 19h16" stroke={color} strokeWidth="1.8" strokeLinecap="round"/>
      <rect x="7" y="11" width="3" height="6" rx="0.5" stroke={color} strokeWidth="1.8"/>
      <rect x="12" y="8" width="3" height="9" rx="0.5" stroke={color} strokeWidth="1.8"/>
      <rect x="17" y="5" width="3" height="12" rx="0.5" stroke={color} strokeWidth="1.8"/>
    </svg>
  )
  if (label === 'Historial') return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="8" stroke={color} strokeWidth="1.8"/>
      <path d="M12 7v5l3 2" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )
  if (label === 'Barberos') return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
      <circle cx="9" cy="8" r="3.2" stroke={color} strokeWidth="1.8"/>
      <path d="M3 19c0-3.3 2.7-6 6-6s6 2.7 6 6" stroke={color} strokeWidth="1.8" strokeLinecap="round"/>
      <circle cx="17" cy="9" r="2.5" stroke={color} strokeWidth="1.8"/>
      <path d="M21 18c0-2.2-1.8-4-4-4" stroke={color} strokeWidth="1.8" strokeLinecap="round"/>
    </svg>
  )
  if (label === 'Servicios') return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
      <path d="M14.5 4.5a3 3 0 1 0-3 3l-7 7a2.1 2.1 0 0 0 3 3l7-7a3 3 0 0 0 3-3l-2 2-2-2 2-2z" stroke={color} strokeWidth="1.8" strokeLinejoin="round"/>
    </svg>
  )
  if (label === 'Configuración') return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="3" stroke={color} strokeWidth="1.8"/>
      <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1A1.7 1.7 0 0 0 4.6 9a1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )
  return null
}

// Bottom nav: 5 items. Order requested: Inicio / Métricas / Historial / Barberos / Servicios.
const MOBILE_BOTTOM_NAV: { to: string; label: string; shortLabel: string }[] = [
  { to: '/owner/live', label: 'Panel en vivo', shortLabel: 'Inicio' },
  { to: '/owner/metrics', label: 'Métricas', shortLabel: 'Métricas' },
  { to: '/owner/history', label: 'Historial', shortLabel: 'Historial' },
  { to: '/owner/barbers', label: 'Barberos', shortLabel: 'Barberos' },
  { to: '/owner/services', label: 'Servicios', shortLabel: 'Servicios' },
]

export function OwnerLayout() {
  const { tenant } = useTenantStore()
  const { signOut } = useAuth()
  const navigate = useNavigate()
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768)
  const [drawerOpen, setDrawerOpen] = useState(false)

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

  // Desktop sidebar nav items (unchanged behavior)
  const navItems = [
    { to: '/owner/live', label: 'Panel en vivo' },
    { to: '/owner/metrics', label: 'Métricas' },
    { to: '/owner/history', label: 'Historial' },
    { to: '/owner/settings', label: 'Configuración' },
    { to: '/owner/barbers', label: 'Barberos' },
    { to: '/owner/services', label: 'Servicios' },
  ]

  if (isMobile) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', background: '#F4F6FA', overflowX: 'hidden' }}>
        {/* Drawer (hamburger menu) — includes Configuración and logout */}
        {drawerOpen && (
          <>
            <div
              onClick={() => setDrawerOpen(false)}
              style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 200 }}
            />
            <div style={{ position: 'fixed', top: 0, left: 0, bottom: 0, width: '78%', maxWidth: '320px', background: '#fff', zIndex: 201, padding: '24px 20px', display: 'flex', flexDirection: 'column' }}>
              <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: '18px', color: '#0F172A', marginBottom: '4px' }}>
                {tenant?.name}
              </div>
              <div style={{ fontSize: '12px', color: '#94A3B8', marginBottom: '24px' }}>
                Panel de administración
              </div>
              <nav style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '4px' }}>
                {navItems.map(({ to, label }) => (
                  <NavLink
                    key={to}
                    to={to}
                    onClick={() => setDrawerOpen(false)}
                    style={({ isActive }) => ({
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                      padding: '12px 12px',
                      borderRadius: '10px',
                      fontSize: '14px',
                      fontWeight: 500,
                      color: isActive ? '#2563EB' : '#475569',
                      background: isActive ? '#EFF6FF' : 'transparent',
                      textDecoration: 'none',
                    })}
                  >
                    <NavIcon label={label} active={false} />
                    <span>{label}</span>
                  </NavLink>
                ))}
              </nav>
              <button
                onClick={handleSignOut}
                style={{ background: 'transparent', border: '1px solid #E2E8F0', borderRadius: '10px', padding: '12px', fontSize: '14px', cursor: 'pointer', color: '#0F172A', fontWeight: 500 }}
              >
                Cerrar sesión
              </button>
            </div>
          </>
        )}

        {/* Content */}
        <div style={{ flex: 1, paddingBottom: '24px', overflowX: 'hidden' }}>
          <SuspendedGuard>
            <TrialExpiredGuard>
              <Outlet context={{ onOpenDrawer: () => setDrawerOpen(true) }} />
            </TrialExpiredGuard>
          </SuspendedGuard>
        </div>

        {/* Mobile bottom nav: floating white rounded card, ~64px tall, radius 24, soft shadow */}
        <div style={{
          position: 'fixed',
          bottom: '16px',
          left: '50%',
          transform: 'translateX(-50%)',
          width: 'calc(100% - 24px)',
          maxWidth: '414px',
          zIndex: 100,
          pointerEvents: 'none',
        }}>
          <div style={{
            background: '#fff',
            borderRadius: '24px',
            boxShadow: '0 6px 24px rgba(15, 23, 42, 0.10), 0 2px 8px rgba(15, 23, 42, 0.06)',
            height: '64px',
            padding: '0 6px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-around',
            pointerEvents: 'auto',
            boxSizing: 'border-box',
          }}>
            {MOBILE_BOTTOM_NAV.map(({ to, label, shortLabel }) => (
              <NavLink
                key={to}
                to={to}
                style={{ textDecoration: 'none', flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}
              >
                {({ isActive }) => (
                  <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '2px',
                    padding: '6px 4px',
                    borderRadius: '16px',
                    minWidth: '48px',
                    background: isActive ? '#EFF6FF' : 'transparent',
                    transition: 'background 150ms',
                  }}>
                    <NavIcon label={label} active={isActive} />
                    <span style={{
                      fontSize: 'clamp(9px, 2.82vw, 11px)',
                      fontWeight: 600,
                      color: isActive ? '#2563EB' : '#9CA3AF',
                      letterSpacing: '0.1px',
                      whiteSpace: 'nowrap',
                    }}>{shortLabel}</span>
                  </div>
                )}
              </NavLink>
            ))}
          </div>
        </div>
      </div>
    )
  }

  // Desktop sidebar (unchanged behavior)
  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      <div style={{ width: '210px', flexShrink: 0, display: 'flex', flexDirection: 'column', background: 'var(--primary, #1E2A3A)', position: 'fixed', top: 0, left: 0, height: '100vh' }}>
        <div style={{ padding: '24px 20px 20px' }}>
          <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: '17px', color: '#fff', marginBottom: '4px' }}>
            {tenant?.name}
          </div>
          <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.45)' }}>
            Panel de administración
          </div>
        </div>

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
                borderRight: isActive ? '3px solid var(--secondary, #D4A853)' : '3px solid transparent',
                textDecoration: 'none',
              })}
            >
              {label}
            </NavLink>
          ))}
        </nav>

        <div style={{ padding: '16px 20px', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
          <button
            onClick={handleSignOut}
            style={{ background: 'transparent', border: 'none', padding: 0, color: 'var(--secondary, #D4A853)', fontSize: '12px', cursor: 'pointer', fontWeight: 500 }}
          >
            Cerrar sesión
          </button>
        </div>

        <div style={{ textAlign: 'center', padding: '10px 0 14px', fontSize: '10px', color: 'rgba(255,255,255,0.15)' }}>
          Aliada Barberías
        </div>
      </div>

      <div style={{ marginLeft: '210px', flex: 1, background: '#F4F5F7', minHeight: '100vh', overflow: 'auto', padding: '24px' }}>
        <SuspendedGuard>
          <TrialExpiredGuard>
            <Outlet />
          </TrialExpiredGuard>
        </SuspendedGuard>
      </div>
    </div>
  )
}
