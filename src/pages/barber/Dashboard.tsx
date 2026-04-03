import { useTenantStore } from '../../stores/tenantStore'

const services = [
  { id: 1, name: 'Corte clásico', price: 2500, duration_minutes: 30 },
  { id: 2, name: 'Barba', price: 1500, duration_minutes: 20 },
  { id: 3, name: 'Corte + barba', price: 3500, duration_minutes: 45 },
]

export function Dashboard() {
  const { profile } = useTenantStore()

  return (
    <div style={{ maxWidth: '1000px', margin: '0 auto' }}>
      {/* Hero card */}
      <div style={{ background: '#111111', border: '1px solid #1c1c1c', borderRadius: '12px', padding: '24px', marginBottom: '24px', position: 'relative', overflow: 'hidden' }}>
        <h1 style={{ fontFamily: 'Syne, sans-serif', fontWeight: 800, fontSize: '36px', color: '#fff', margin: 0 }}>
          Hola, {profile?.display_name || 'Barbero'}
        </h1>
        <p style={{ color: '#666', fontSize: '14px', marginTop: '8px' }}>Tu día empieza ahora. Que los cortes fluyan.</p>
        {/* Barber pole decorative */}
        <svg width="120" height="120" viewBox="0 0 120 120" fill="none" style={{ position: 'absolute', right: '20px', top: '20px', opacity: 0.1 }}>
          <rect x="50" y="10" width="20" height="100" fill="#B8FF47" />
          <rect x="50" y="10" width="20" height="33.33" fill="#fff" />
          <rect x="50" y="43.33" width="20" height="33.33" fill="#080808" />
          <rect x="50" y="76.66" width="20" height="33.33" fill="#B8FF47" />
          <circle cx="60" cy="10" r="10" fill="#B8FF47" />
          <circle cx="60" cy="110" r="10" fill="#B8FF47" />
        </svg>
      </div>

      {/* Grid cards */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '24px' }}>
        <div style={{ background: '#111111', border: '1px solid #1c1c1c', borderRadius: '12px', padding: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <h3 style={{ fontFamily: 'Space Grotesk, sans-serif', fontWeight: 500, fontSize: '14px', color: '#666', margin: 0 }}>Servicios hoy</h3>
              <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 800, fontSize: '32px', color: '#fff', marginTop: '8px' }}>0</div>
            </div>
            <div style={{ width: '40px', height: '40px', borderRadius: '8px', background: '#1a1a1a', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#B8FF47" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
            </div>
          </div>
        </div>
        <div style={{ background: '#111111', border: '1px solid #B8FF47', borderRadius: '12px', padding: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <h3 style={{ fontFamily: 'Space Grotesk, sans-serif', fontWeight: 500, fontSize: '14px', color: '#666', margin: 0 }}>Mi ganancia</h3>
              <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 800, fontSize: '32px', color: '#B8FF47', marginTop: '8px' }}>$0</div>
            </div>
            <div style={{ width: '40px', height: '40px', borderRadius: '8px', background: '#1a1a1a', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#B8FF47" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          </div>
        </div>
      </div>

      {/* Services list */}
      <div style={{ background: '#111111', border: '1px solid #1c1c1c', borderRadius: '12px', padding: '20px', marginBottom: '24px' }}>
        <h2 style={{ fontFamily: 'Syne, sans-serif', fontWeight: 800, fontSize: '18px', color: '#fff', margin: '0 0 16px 0' }}>Catálogo de servicios</h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {services.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '24px', color: '#666', fontFamily: 'Space Grotesk, sans-serif', fontSize: '14px' }}>
              No hay servicios configurados
            </div>
          ) : (
            services.map((service) => {
              const estimatedEarning = service.price * 0.5 // 50% como ejemplo
              return (
                <div key={service.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px', background: '#111111', borderRadius: '8px', border: '1px solid #1c1c1c' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{ width: '32px', height: '32px', borderRadius: '6px', background: '#1a1a1a', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#B8FF47" strokeWidth="2">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M14.121 14.121L19 19m-7-7l7-7m-7 7l-7-7m7 7l-7 7" />
                      </svg>
                    </div>
                    <div>
                      <div style={{ fontFamily: 'Space Grotesk, sans-serif', fontWeight: 500, fontSize: '14px', color: '#fff' }}>{service.name}</div>
                      <div style={{ fontFamily: 'Space Grotesk, sans-serif', fontWeight: 400, fontSize: '11px', color: '#666', marginTop: '2px' }}>
                        Ganancia estimada: <span style={{ color: '#B8FF47' }}>${estimatedEarning.toLocaleString()}</span>
                      </div>
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 800, fontSize: '16px', color: '#B8FF47' }}>${service.price.toLocaleString()}</div>
                    <div style={{ fontFamily: 'Space Grotesk, sans-serif', fontWeight: 400, fontSize: '11px', color: '#666' }}>{service.duration_minutes} min</div>
                  </div>
                </div>
              )
            })
          )}
        </div>
      </div>

      {/* Register service button */}
      <button style={{ width: '100%', background: '#B8FF47', color: '#080808', fontFamily: 'Syne, sans-serif', fontWeight: 800, fontSize: '16px', border: 'none', borderRadius: '12px', padding: '16px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#080808" strokeWidth="3">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
        </svg>
        + Registrar servicio
      </button>
    </div>
  )
}