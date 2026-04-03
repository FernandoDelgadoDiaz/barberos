export function Metrics() {
  const metrics = [
    { label: 'Día con más cortes', icon: 'calendar' },
    { label: 'Hora pico', icon: 'clock' },
    { label: 'Mes top', icon: 'chart' },
    { label: 'Barbero estrella', icon: 'crown' },
    { label: 'Servicio más popular', icon: 'scissors' },
    { label: 'Ticket promedio', icon: 'dollar' },
  ]

  const renderIcon = (icon: string) => {
    const size = 20
    const stroke = '#B8FF47'
    switch (icon) {
      case 'calendar':
        return (
          <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth="2">
            <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
            <line x1="16" y1="2" x2="16" y2="6" />
            <line x1="8" y1="2" x2="8" y2="6" />
            <line x1="3" y1="10" x2="21" y2="10" />
          </svg>
        )
      case 'clock':
        return (
          <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth="2">
            <circle cx="12" cy="12" r="10" />
            <polyline points="12 6 12 12 16 14" />
          </svg>
        )
      case 'chart':
        return (
          <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth="2">
            <line x1="18" y1="20" x2="18" y2="10" />
            <line x1="12" y1="20" x2="12" y2="4" />
            <line x1="6" y1="20" x2="6" y2="14" />
          </svg>
        )
      case 'crown':
        return (
          <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth="2">
            <path d="M12 8l3 5 5-2-2 8H6L4 11l5 2 3-5z" />
          </svg>
        )
      case 'scissors':
        return (
          <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth="2">
            <circle cx="6" cy="6" r="3" />
            <circle cx="6" cy="18" r="3" />
            <line x1="20" y1="4" x2="8.12" y2="15.88" />
            <line x1="14.47" y1="14.48" x2="20" y2="20" />
            <line x1="8.12" y1="8.12" x2="12" y2="12" />
          </svg>
        )
      case 'dollar':
        return (
          <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth="2">
            <line x1="12" y1="1" x2="12" y2="23" />
            <path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6" />
          </svg>
        )
      default:
        return null
    }
  }

  return (
    <div style={{ maxWidth: '1000px', margin: '0 auto' }}>
      <h1 style={{ fontFamily: 'Syne, sans-serif', fontWeight: 800, fontSize: '32px', color: '#fff', marginBottom: '8px' }}>Métricas</h1>
      <p style={{ color: '#666', fontSize: '14px', marginBottom: '32px' }}>Análisis y reportes de desempeño</p>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '16px', marginBottom: '32px' }}>
        {metrics.map((metric, index) => (
          <div
            key={index}
            style={{
              background: '#111111',
              border: '1px solid #1c1c1c',
              borderRadius: '12px',
              padding: '20px',
              display: 'flex',
              alignItems: 'center',
              gap: '16px',
            }}
          >
            <div style={{ width: '48px', height: '48px', borderRadius: '10px', background: '#1a1a1a', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {renderIcon(metric.icon)}
            </div>
            <div>
              <div style={{ fontFamily: 'Space Grotesk, sans-serif', fontWeight: 400, fontSize: '13px', color: '#666', marginBottom: '4px' }}>
                {metric.label}
              </div>
              <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 800, fontSize: '24px', color: '#fff' }}>
                --
              </div>
            </div>
          </div>
        ))}
      </div>

      <div style={{ background: '#111111', border: '1px solid #1c1c1c', borderRadius: '12px', padding: '40px', textAlign: 'center' }}>
        <div style={{ fontFamily: 'Space Grotesk, sans-serif', fontWeight: 400, fontSize: '16px', color: '#666', lineHeight: 1.5 }}>
          Los datos aparecerán cuando registres servicios
        </div>
      </div>
    </div>
  )
}