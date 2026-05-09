import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { useTenantStore } from '../../stores/tenantStore'
import { useAuth } from '../../hooks/useAuth'
import { TrialExpiredGuard } from '../TrialExpiredGuard'

const ScissorsIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
    <circle cx="5" cy="19" r="2.5" stroke="var(--secondary, #D4A853)" strokeWidth="1.5"/>
    <circle cx="19" cy="19" r="2.5" stroke="var(--secondary, #D4A853)" strokeWidth="1.5"/>
    <line x1="5" y1="19" x2="19" y2="5" stroke="var(--secondary, #D4A853)" strokeWidth="1.5" strokeLinecap="round"/>
    <line x1="19" y1="19" x2="5" y2="5" stroke="var(--primary, #1E2A3A)" strokeWidth="1.5" strokeLinecap="round"/>
    <circle cx="5" cy="5" r="2.5" stroke="var(--primary, #1E2A3A)" strokeWidth="1.5"/>
    <circle cx="19" cy="5" r="2.5" stroke="var(--primary, #1E2A3A)" strokeWidth="1.5"/>
    <line x1="10" y1="12" x2="14" y2="12" stroke="var(--secondary, #D4A853)" strokeWidth="1"/>
  </svg>
)

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
    <div style={{ minHeight: '100vh', background: '#F4F5F7' }}>
      <header className="barber-header" style={{ background: '#fff', borderBottom: '0.5px solid #e0e0e0', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', padding: '14px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '2px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <ScissorsIcon />
            <span style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: '18px', color: '#1E2A3A' }}>
              {tenant?.name || 'Mi barbería'}
            </span>
          </div>
          <span style={{ fontFamily: 'Space Grotesk, sans-serif', fontSize: '11px', color: '#aaa', letterSpacing: '1px' }}>
            Panel del barbero
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span className="hide-mobile" style={{ background: '#f0f0f0', border: '0.5px solid #e0e0e0', borderRadius: '100px', padding: '4px 12px', fontFamily: 'Space Grotesk, sans-serif', fontSize: '10px', color: '#1a1a2e', letterSpacing: '1.5px', textTransform: 'uppercase' }}>barbero</span>
          <div style={{ width: '30px', height: '30px', borderRadius: '50%', background: 'linear-gradient(135deg, var(--secondary, #D4A853), var(--primary, #1E2A3A))', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: '11px', color: '#fff' }}>{initials}</div>
          <button onClick={handleSignOut} style={{ background: '#fff', border: '0.5px solid #e0e0e0', borderRadius: '8px', padding: '6px 14px', color: '#666', fontFamily: 'Space Grotesk, sans-serif', fontSize: '12px', cursor: 'pointer' }}>Salir</button>
        </div>
      </header>
      <nav className="barber-nav" style={{ background: '#fff', borderBottom: '0.5px solid #e0e0e0', display: 'flex', padding: '0 20px' }}>
        {[{ to: '/barber/dashboard', label: 'Mi día' }, { to: '/barber/summary', label: 'Resumen' }].map(({ to, label }) => (
          <NavLink key={to} to={to} className="barber-nav-link" style={({ isActive }) => ({ padding: '12px 16px', fontFamily: 'Space Grotesk, sans-serif', fontSize: '13px', fontWeight: isActive ? 700 : 500, color: isActive ? 'var(--primary, #1E2A3A)' : '#aaa', borderBottom: isActive ? '2px solid var(--secondary, #D4A853)' : '2px solid transparent', textDecoration: 'none', letterSpacing: '0.3px' })}>
            {label}
          </NavLink>
        ))}
      </nav>
      <main className="barber-main" style={{ padding: '20px', background: '#F4F5F7' }}>
        <TrialExpiredGuard>
          <Outlet />
        </TrialExpiredGuard>
      </main>
    </div>
  )
}
