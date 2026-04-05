import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { useTenantStore } from '../../stores/tenantStore'
import { useAuth } from '../../hooks/useAuth'

const ScissorsIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
    <circle cx="5" cy="19" r="2.5" stroke="var(--secondary, #C8A97E)" strokeWidth="1.5"/>
    <circle cx="19" cy="19" r="2.5" stroke="var(--secondary, #C8A97E)" strokeWidth="1.5"/>
    <line x1="5" y1="19" x2="19" y2="5" stroke="var(--secondary, #C8A97E)" strokeWidth="1.5" strokeLinecap="round"/>
    <line x1="19" y1="19" x2="5" y2="5" stroke="var(--text-dim, #555)" strokeWidth="1.5" strokeLinecap="round"/>
    <circle cx="5" cy="5" r="2.5" stroke="var(--text-dim, #555)" strokeWidth="1.5"/>
    <circle cx="19" cy="5" r="2.5" stroke="var(--text-dim, #555)" strokeWidth="1.5"/>
    <line x1="10" y1="12" x2="14" y2="12" stroke="var(--secondary, #C8A97E)" strokeWidth="1"/>
  </svg>
)

export function OwnerLayout() {
  const { profile, tenant } = useTenantStore()
  const { signOut } = useAuth()
  const navigate = useNavigate()

  const initials = profile?.display_name
    ?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || 'OW'

  const handleSignOut = async () => {
    await signOut()
    navigate('/login')
  }

  const navItems = [
    { to: '/owner/live', label: 'Panel en vivo' },
    { to: '/owner/metrics', label: 'Métricas' },
    { to: '/owner/settings', label: 'Configuración' },
    { to: '/owner/barbers', label: 'Barberos' },
    { to: '/owner/services', label: 'Servicios' },
  ]

  return (
    <div style={{ minHeight: '100vh', background: 'var(--primary, #1a1a1a)' }}>
      <header className="owner-header" style={{ background: 'var(--primary, #1a1a1a)', borderBottom: '1px solid var(--border, #383838)', padding: '14px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '2px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <ScissorsIcon />
            <span className="owner-logo" style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: '18px', letterSpacing: '2px', color: 'var(--text, #fff)' }}>
              BARBER<span style={{ color: 'var(--secondary, #C8A97E)' }}>OS</span>
            </span>
          </div>
          <span style={{ fontSize: '11px', color: 'var(--text-muted, #888)', letterSpacing: '1px' }}>
            {tenant?.name}
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span className="hide-mobile" style={{ background: 'var(--card, #2a2a2a)', border: '1px solid var(--border, #383838)', borderRadius: '100px', padding: '4px 12px', fontSize: '10px', color: 'var(--text-tertiary, #777)', letterSpacing: '1.5px', textTransform: 'uppercase' }}>owner</span>
          <div style={{ width: '30px', height: '30px', borderRadius: '50%', background: 'linear-gradient(135deg, var(--secondary, #C8A97E), var(--accent-dark, #8B6200))', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: '11px', color: 'var(--primary, #1a1a1a)' }}>{initials}</div>
          <button onClick={handleSignOut} style={{ background: 'transparent', border: '1px solid var(--border, #383838)', borderRadius: '8px', padding: '6px 14px', color: 'var(--text-dim, #555)', fontSize: '12px', cursor: 'pointer' }}>Salir</button>
        </div>
      </header>
      <nav className="owner-nav" style={{ background: 'var(--primary, #1a1a1a)', borderBottom: '1px solid var(--border, #383838)', display: 'flex', padding: '0 20px' }}>
        {navItems.map(({ to, label }) => (
          <NavLink key={to} to={to} className="owner-nav-link" style={({ isActive }) => ({ padding: '12px 16px', fontSize: '13px', fontWeight: 500, color: isActive ? 'var(--secondary, #C8A97E)' : 'var(--text-dim, #555)', borderBottom: isActive ? '2px solid var(--secondary, #C8A97E)' : '2px solid transparent', textDecoration: 'none', letterSpacing: '0.3px' })}>
            {label}
          </NavLink>
        ))}
      </nav>
      <main className="owner-main" style={{ padding: '20px' }}>
        <Outlet />
      </main>
    </div>
  )
}