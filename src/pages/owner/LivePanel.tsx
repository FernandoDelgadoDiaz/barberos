import { useTenantStore } from '../../stores/tenantStore'

const barbers = [
  { id: 1, name: 'Carlos', services: 5, earnings: 8500, avatarColor: 'green' },
  { id: 2, name: 'Gabriel', services: 3, earnings: 4500, avatarColor: 'purple' },
]

export function LivePanel() {
  const { tenant } = useTenantStore()

  return (
    <div style={{ maxWidth: '1000px', margin: '0 auto', position: 'relative' }}>
      {/* Large scissors decoration */}
      <svg width="300" height="300" viewBox="0 0 300 300" fill="none" style={{ position: 'absolute', right: '-50px', top: '-50px', opacity: 0.04, pointerEvents: 'none' }}>
        <circle cx="150" cy="150" r="120" stroke="#B8FF47" strokeWidth="2" strokeDasharray="8 8" />
        <circle cx="100" cy="200" r="25" stroke="#B8FF47" strokeWidth="4" />
        <circle cx="200" cy="200" r="25" stroke="#B8FF47" strokeWidth="4" />
        <line x1="100" y1="200" x2="200" y2="100" stroke="#B8FF47" strokeWidth="4" strokeLinecap="round" />
        <line x1="200" y1="200" x2="100" y2="100" stroke="#555" strokeWidth="4" strokeLinecap="round" />
        <circle cx="100" cy="100" r="25" stroke="#555" strokeWidth="4" />
        <circle cx="200" cy="100" r="25" stroke="#555" strokeWidth="4" />
        <line x1="130" y1="150" x2="170" y2="150" stroke="#B8FF47" strokeWidth="3" />
      </svg>

      <h1 style={{ fontFamily: 'Syne, sans-serif', fontWeight: 800, fontSize: '32px', color: '#fff', marginBottom: '8px' }}>Panel en vivo</h1>
      <p style={{ color: '#666', fontSize: '14px', marginBottom: '24px' }}>{tenant?.name || 'Tu barbería'} • Monitoreo en tiempo real</p>

      {/* Total card */}
      <div style={{ background: '#111111', border: '1px solid #1c1c1c', borderRadius: '12px', padding: '24px', marginBottom: '24px', position: 'relative', overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <h3 style={{ fontFamily: 'Space Grotesk, sans-serif', fontWeight: 500, fontSize: '14px', color: '#666', margin: 0 }}>Total del día</h3>
            <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 800, fontSize: '48px', color: '#B8FF47', marginTop: '4px' }}>$12,500</div>
            <div style={{ fontFamily: 'Space Grotesk, sans-serif', fontWeight: 400, fontSize: '14px', color: '#fff', marginTop: '8px' }}>Tu parte: <span style={{ fontWeight: 600 }}>$3,125</span></div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ width: '60px', height: '60px', borderRadius: '12px', background: '#1a1a1a', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#B8FF47" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 800, fontSize: '18px', color: '#fff' }}>16</div>
              <div style={{ fontFamily: 'Space Grotesk, sans-serif', fontWeight: 400, fontSize: '12px', color: '#666' }}>servicios</div>
            </div>
          </div>
        </div>
        <div style={{ height: '4px', background: '#1c1c1c', marginTop: '20px', borderRadius: '2px', overflow: 'hidden' }}>
          <div style={{ width: '75%', height: '100%', background: '#B8FF47', borderRadius: '2px' }} />
        </div>
      </div>

      {/* Barbers list */}
      <div style={{ background: '#111111', border: '1px solid #1c1c1c', borderRadius: '12px', padding: '24px' }}>
        <h2 style={{ fontFamily: 'Syne, sans-serif', fontWeight: 800, fontSize: '18px', color: '#fff', margin: '0 0 20px 0' }}>Barberos activos</h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {barbers.map((barber) => (
            <div key={barber.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px', background: '#111111', borderRadius: '8px', border: '1px solid #1c1c1c' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                <div style={{ width: '44px', height: '44px', borderRadius: '10px', background: barber.avatarColor === 'green' ? 'linear-gradient(135deg, #B8FF47, #4a9900)' : barber.avatarColor === 'purple' ? 'linear-gradient(135deg, #c084fc, #9333ea)' : 'linear-gradient(135deg, #666, #333)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Syne, sans-serif', fontWeight: 800, fontSize: '16px', color: '#080808' }}>
                  {barber.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                </div>
                <div>
                  <div style={{ fontFamily: 'Space Grotesk, sans-serif', fontWeight: 600, fontSize: '15px', color: '#fff' }}>{barber.name}</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '4px' }}>
                    <span style={{ fontFamily: 'Space Grotesk, sans-serif', fontWeight: 400, fontSize: '12px', color: '#666' }}>{barber.services} servicios</span>
                    <span style={{ width: '4px', height: '4px', borderRadius: '50%', background: '#666' }} />
                    <span style={{ fontFamily: 'Space Grotesk, sans-serif', fontWeight: 400, fontSize: '12px', color: '#666' }}>${barber.earnings.toLocaleString()}</span>
                  </div>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 800, fontSize: '18px', color: '#B8FF47' }}>${Math.round(barber.earnings * 0.25).toLocaleString()}</div>
                  <div style={{ fontFamily: 'Space Grotesk, sans-serif', fontWeight: 400, fontSize: '11px', color: '#666', letterSpacing: '0.5px' }}>COMISIÓN</div>
                </div>
                <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: barber.avatarColor === 'green' ? '#B8FF47' : barber.avatarColor === 'purple' ? '#c084fc' : '#666', animation: 'pulse 2s infinite' }} />
              </div>
            </div>
          ))}
        </div>
        <div style={{ marginTop: '20px', paddingTop: '20px', borderTop: '1px solid #1c1c1c', color: '#666', fontSize: '12px', textAlign: 'center' }}>
          <p>Conectando en tiempo real...</p>
        </div>
      </div>
    </div>
  )
}