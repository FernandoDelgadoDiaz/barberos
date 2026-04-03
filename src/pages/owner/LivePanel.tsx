import { useTenantStore } from '../../stores/tenantStore'

const barbers = [
  { id: 1, name: 'Carlos', services: 5, earnings: 8500, avatarColor: 'gold' },
  { id: 2, name: 'Gabriel', services: 3, earnings: 4500, avatarColor: 'purple' },
]

export function LivePanel() {
  const { tenant } = useTenantStore()

  return (
    <div style={{ maxWidth: '1000px', margin: '0 auto', position: 'relative', background: '#1a1a1a', color: '#fff', padding: '24px', borderRadius: '12px' }}>
      {/* Large scissors decoration */}
      <svg width="300" height="300" viewBox="0 0 300 300" fill="none" style={{ position: 'absolute', right: '-50px', top: '-50px', opacity: 0.04, pointerEvents: 'none' }}>
        <circle cx="150" cy="150" r="120" stroke="#C8A97E" strokeWidth="2" strokeDasharray="8 8" />
        <circle cx="100" cy="200" r="25" stroke="#C8A97E" strokeWidth="4" />
        <circle cx="200" cy="200" r="25" stroke="#C8A97E" strokeWidth="4" />
        <line x1="100" y1="200" x2="200" y2="100" stroke="#C8A97E" strokeWidth="4" strokeLinecap="round" />
        <line x1="200" y1="200" x2="100" y2="100" stroke="#383838" strokeWidth="4" strokeLinecap="round" />
        <circle cx="100" cy="100" r="25" stroke="#383838" strokeWidth="4" />
        <circle cx="200" cy="100" r="25" stroke="#383838" strokeWidth="4" />
        <line x1="130" y1="150" x2="170" y2="150" stroke="#C8A97E" strokeWidth="3" />
      </svg>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
        <h1 style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: '26px', color: '#fff', margin: 0 }}>Panel en vivo</h1>
        <span style={{ fontFamily: 'Space Grotesk, sans-serif', fontWeight: 600, fontSize: '12px', color: '#C8A97E', border: '1px solid #C8A97E', borderRadius: '20px', padding: '4px 12px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>EN VIVO</span>
      </div>
      <p style={{ color: '#888', fontSize: '14px', marginBottom: '24px' }}>{tenant?.name || 'Tu barbería'} • Monitoreo en tiempo real</p>

      {/* Total card */}
      <div style={{ background: '#242424', border: '1px solid #383838', borderRadius: '12px', padding: '24px', marginBottom: '24px', position: 'relative', overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <h3 style={{ fontFamily: 'Space Grotesk, sans-serif', fontWeight: 500, fontSize: '14px', color: '#888', margin: 0 }}>Total del día</h3>
            <div style={{ fontFamily: 'Space Grotesk, sans-serif', fontWeight: 700, fontSize: 'clamp(28px, 7vw, 42px)', color: '#C8A97E', marginTop: '4px' }}>$12,500</div>
            <div style={{ fontFamily: 'Space Grotesk, sans-serif', fontWeight: 400, fontSize: '14px', color: '#fff', marginTop: '8px' }}>Tu parte: <span style={{ fontWeight: 600 }}>$3,125</span></div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ width: '60px', height: '60px', borderRadius: '12px', background: '#2a2a2a', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#C8A97E" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontFamily: 'Space Grotesk, sans-serif', fontWeight: 700, fontSize: '18px', color: '#fff' }}>16</div>
              <div style={{ fontFamily: 'Space Grotesk, sans-serif', fontWeight: 400, fontSize: '12px', color: '#888' }}>servicios</div>
            </div>
          </div>
        </div>
        <div style={{ height: '4px', background: '#383838', marginTop: '20px', borderRadius: '2px', overflow: 'hidden' }}>
          <div style={{ width: '75%', height: '100%', background: '#C8A97E', borderRadius: '2px' }} />
        </div>
      </div>

      {/* Barbers list */}
      <div style={{ background: '#2a2a2a', border: '1px solid #383838', borderRadius: '12px', padding: '24px' }}>
        <h2 style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: '18px', color: '#fff', margin: '0 0 20px 0' }}>Barberos activos</h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {barbers.map((barber) => (
            <div key={barber.id} className="mobile-padding" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px', background: '#383838', borderRadius: '8px', border: '1px solid #484848' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                <div style={{ width: '44px', height: '44px', borderRadius: '10px', background: barber.avatarColor === 'gold' ? 'linear-gradient(135deg, #C8A97E, #8B6200)' : barber.avatarColor === 'purple' ? 'linear-gradient(135deg, #7c3aed, #4c1d95)' : 'linear-gradient(135deg, #888, #333)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: '16px', color: '#080808' }}>
                  {barber.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                </div>
                <div>
                  <div style={{ fontFamily: 'Space Grotesk, sans-serif', fontWeight: 600, fontSize: '15px', color: '#fff' }}>{barber.name}</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '4px' }}>
                    <span style={{ fontFamily: 'Space Grotesk, sans-serif', fontWeight: 400, fontSize: '12px', color: '#888' }}>{barber.services} servicios</span>
                    <span style={{ width: '4px', height: '4px', borderRadius: '50%', background: '#888' }} />
                    <span style={{ fontFamily: 'Space Grotesk, sans-serif', fontWeight: 400, fontSize: '12px', color: '#888' }}>${barber.earnings.toLocaleString()}</span>
                  </div>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontFamily: 'Space Grotesk, sans-serif', fontWeight: 700, fontSize: '18px', color: '#C8A97E' }}>${Math.round(barber.earnings * 0.25).toLocaleString()}</div>
                  <div style={{ fontFamily: 'Space Grotesk, sans-serif', fontWeight: 400, fontSize: '11px', color: '#888', letterSpacing: '0.5px' }}>COMISIÓN</div>
                </div>
                <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: barber.avatarColor === 'gold' ? '#C8A97E' : barber.avatarColor === 'purple' ? '#7c3aed' : '#888', animation: 'pulse 2s infinite' }} />
              </div>
            </div>
          ))}
        </div>
        <div style={{ marginTop: '20px', paddingTop: '20px', borderTop: '1px solid #383838', color: '#888', fontSize: '12px', textAlign: 'center' }}>
          <p>Conectando en tiempo real...</p>
        </div>
      </div>
    </div>
  )
}