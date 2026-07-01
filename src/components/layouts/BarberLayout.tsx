import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { useTenantStore } from '../../stores/tenantStore'
import { useAuth } from '../../hooks/useAuth'
import { TrialExpiredGuard } from '../TrialExpiredGuard'
import { SuspendedGuard } from '../SuspendedGuard'

// =============================================================================
// Palette — slate + blue (consistent with the owner panel: LivePanel / Metrics
// / Services). Replicated locally because the scope is limited to barber files.
// =============================================================================
const C = {
  bg: '#F8FAFC',
  ink: '#0F172A',
  slate500: '#64748B',
  slate400: '#94A3B8',
  border: '#E2E8F0',
  blue: '#2563EB',
  blueBright: '#3B82F6',
  blueBg: '#EFF6FF',
} as const

// Bottom-nav icons. 24px nominal stroke icons (mirrors the owner NavIcon set).
const NavIcon = ({ label, active }: { label: string; active?: boolean }) => {
  const color = active ? C.blue : C.slate400
  if (label === 'Mi día') return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
      <path d="M3 11.5L12 4l9 7.5" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M5 10v9a1 1 0 0 0 1 1h4v-6h4v6h4a1 1 0 0 0 1-1v-9" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
  if (label === 'Resumen') return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
      <path d="M4 19V5" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
      <path d="M4 19h16" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
      <rect x="7" y="11" width="3" height="6" rx="0.5" stroke={color} strokeWidth="1.8" />
      <rect x="12" y="8" width="3" height="9" rx="0.5" stroke={color} strokeWidth="1.8" />
      <rect x="17" y="5" width="3" height="12" rx="0.5" stroke={color} strokeWidth="1.8" />
    </svg>
  )
  return null
}

const BOTTOM_NAV: { to: string; label: string }[] = [
  { to: '/barber/dashboard', label: 'Mi día' },
  { to: '/barber/summary', label: 'Resumen' },
]

export function BarberLayout() {
  const { profile, tenant } = useTenantStore()
  const { signOut } = useAuth()
  const navigate = useNavigate()

  const initials = profile?.display_name
    ?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || 'BB'

  const handleSignOut = async () => {
    try {
      await signOut()
      navigate('/login')
    } catch (err) {
      console.error('Error al cerrar sesión:', err)
      // Forzar navegación a login de todos modos
      navigate('/login')
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100dvh', background: C.bg, overflow: 'hidden' }}>
      {/* Top header — restyled to the slate+blue language, logout lives here */}
      <header
        className="barber-header"
        style={{
          background: '#fff',
          borderBottom: `1px solid ${C.border}`,
          padding: '14px 16px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexShrink: 0,
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '2px', minWidth: 0 }}>
          <span
            style={{
              fontFamily: 'Syne, sans-serif',
              fontWeight: 700,
              fontSize: 'clamp(15px, 4.6vw, 18px)',
              color: C.ink,
              lineHeight: 1.2,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              maxWidth: '52vw',
            }}
          >
            {tenant?.name || 'Mi barbería'}
          </span>
          <span
            style={{
              fontFamily: 'Space Grotesk, sans-serif',
              fontSize: '11px',
              color: C.slate400,
              letterSpacing: '0.3px',
            }}
          >
            Panel del barbero
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }}>
          <div
            style={{
              width: '32px',
              height: '32px',
              borderRadius: '50%',
              background: `linear-gradient(135deg, ${C.blueBright}, ${C.blue})`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontFamily: 'Syne, sans-serif',
              fontWeight: 700,
              fontSize: '12px',
              color: '#fff',
            }}
          >
            {initials}
          </div>
          <button
            onClick={handleSignOut}
            style={{
              background: '#fff',
              border: `1px solid ${C.border}`,
              borderRadius: '10px',
              padding: '7px 14px',
              color: C.slate500,
              fontFamily: 'Space Grotesk, sans-serif',
              fontWeight: 500,
              fontSize: '12px',
              cursor: 'pointer',
            }}
          >
            Salir
          </button>
        </div>
      </header>

      {/*
        Content — the ONLY scrollable region of the app shell (flex:1 +
        overflow-y:auto inside a fixed 100dvh root). Padded at the bottom to
        clear the floating nav AND any page-level fixed CTA (e.g. Dashboard's
        "Registrar cliente"), plus the iOS home-indicator safe area.
      */}
      <main
        className="barber-main"
        style={{
          flex: 1,
          minHeight: 0,
          overflowY: 'auto',
          WebkitOverflowScrolling: 'touch',
          background: C.bg,
          paddingBottom: 'calc(110px + env(safe-area-inset-bottom))',
        }}
      >
        <SuspendedGuard>
          <TrialExpiredGuard>
            <Outlet />
          </TrialExpiredGuard>
        </SuspendedGuard>
      </main>

      {/*
        Floating bottom nav: white rounded card, ~64px tall, radius 24, soft shadow.
        bottom is offset by env(safe-area-inset-bottom) so the card floats ABOVE
        the iOS home indicator instead of being partially covered by it. On
        Android / desktop the env() value resolves to 0px and the original 16px
        spacing is preserved.
      */}
      <div
        style={{
          position: 'fixed',
          bottom: 'calc(16px + env(safe-area-inset-bottom))',
          left: '50%',
          transform: 'translateX(-50%)',
          width: 'calc(100% - 32px)',
          maxWidth: '398px',
          zIndex: 100,
          pointerEvents: 'none',
        }}
      >
        <div
          style={{
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
          }}
        >
          {BOTTOM_NAV.map(({ to, label }) => (
            <NavLink
              key={to}
              to={to}
              style={{ textDecoration: 'none', flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}
            >
              {({ isActive }) => (
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '3px',
                    padding: '6px 14px',
                    borderRadius: '16px',
                    background: isActive ? C.blueBg : 'transparent',
                    transition: 'background 150ms ease',
                  }}
                >
                  <NavIcon label={label} active={isActive} />
                  <span
                    style={{
                      fontFamily: 'Space Grotesk, sans-serif',
                      fontSize: 'clamp(10px, 2.82vw, 12px)',
                      fontWeight: 600,
                      color: isActive ? C.blue : C.slate400,
                      letterSpacing: '0.1px',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {label}
                  </span>
                </div>
              )}
            </NavLink>
          ))}
        </div>
      </div>
    </div>
  )
}
