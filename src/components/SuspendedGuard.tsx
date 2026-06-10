import { useTenantStore } from '../stores/tenantStore'

interface Props {
  children: React.ReactNode
}

/**
 * Bloquea el acceso a la app cuando el superadmin desactiva el tenant
 * (tenants.is_active === false). Distinto del TrialExpiredGuard: este
 * cubre suspensiones administrativas, no el vencimiento del período de prueba.
 * La suspensión tiene prioridad: envolver POR FUERA del TrialExpiredGuard.
 */
export function SuspendedGuard({ children }: Props) {
  const { tenant } = useTenantStore()

  // Sin tenant cargado o tenant activo → acceso normal.
  if (!tenant || tenant.is_active !== false) return <>{children}</>

  // Cuenta suspendida — pantalla de bloqueo
  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: '#F4F5F7',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 9999,
      padding: '20px',
    }}>
      <div style={{ textAlign: 'center', maxWidth: '440px' }}>
        {/* Ícono de candado (distinto al de tijeras del trial) */}
        <div style={{ marginBottom: '32px' }}>
          <svg width="80" height="80" viewBox="0 0 24 24" fill="none" style={{ color: '#e94560' }}>
            <rect x="4" y="10" width="16" height="11" rx="2" stroke="#e94560" strokeWidth="1.5" />
            <path d="M8 10V7a4 4 0 0 1 8 0v3" stroke="#1E2A3A" strokeWidth="1.5" strokeLinecap="round" />
            <circle cx="12" cy="15.5" r="1.5" fill="#e94560" />
          </svg>
        </div>

        <h1 style={{
          fontFamily: 'Syne, sans-serif',
          fontWeight: 700,
          fontSize: '24px',
          color: '#1E2A3A',
          marginBottom: '16px',
          lineHeight: 1.3,
        }}>
          Cuenta suspendida
        </h1>

        <p style={{
          fontSize: '16px',
          color: '#666',
          marginBottom: '32px',
          lineHeight: 1.6,
        }}>
          Tu cuenta ha sido suspendida. Contactate con nosotros.
        </p>

        <a
          href="https://wa.me/542966785213"
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '10px',
            padding: '14px 28px',
            background: '#25D366',
            color: '#fff',
            borderRadius: '8px',
            fontFamily: 'Syne, sans-serif',
            fontWeight: 700,
            fontSize: '16px',
            textDecoration: 'none',
            transition: 'all 0.2s',
          }}
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/>
            <path d="M11.5 2C6.262 2 2 6.262 2 11.5c0 1.687.44 3.27 1.207 4.647L2 22l6.003-1.196A9.44 9.44 0 0011.5 21C16.738 21 21 16.738 21 11.5S16.738 2 11.5 2zm0 17.2a7.68 7.68 0 01-3.913-1.07l-.281-.167-2.909.579.615-2.844-.185-.293A7.66 7.66 0 013.8 11.5C3.8 7.254 7.254 3.8 11.5 3.8c4.246 0 7.7 3.454 7.7 7.7 0 4.246-3.454 7.7-7.7 7.7z"/>
          </svg>
          Contactar por WhatsApp
        </a>

        <p style={{ marginTop: '24px', fontSize: '14px', color: '#aaa' }}>
          +54 2966 785213
        </p>
      </div>
    </div>
  )
}
