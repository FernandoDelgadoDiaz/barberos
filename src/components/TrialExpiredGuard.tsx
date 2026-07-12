import { useEffect } from 'react'
import { useTenantStore } from '../stores/tenantStore'
import { formatPrice, getAccessState, useSubscriptionPayment } from '../hooks/useSubscription'

interface Props {
  children: React.ReactNode
}

const WHATSAPP_URL = 'https://wa.me/542966785213'

const ScissorsIcon = () => (
  <svg width="80" height="80" viewBox="0 0 24 24" fill="none">
    <circle cx="5" cy="19" r="2.5" stroke="#2563EB" strokeWidth="1.5"/>
    <circle cx="19" cy="19" r="2.5" stroke="#2563EB" strokeWidth="1.5"/>
    <line x1="5" y1="19" x2="19" y2="5" stroke="#2563EB" strokeWidth="1.5" strokeLinecap="round"/>
    <line x1="19" y1="19" x2="5" y2="5" stroke="#0F172A" strokeWidth="1.5" strokeLinecap="round"/>
    <circle cx="5" cy="5" r="2.5" stroke="#0F172A" strokeWidth="1.5"/>
    <circle cx="19" cy="5" r="2.5" stroke="#0F172A" strokeWidth="1.5"/>
  </svg>
)

const WhatsAppIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/>
    <path d="M11.5 2C6.262 2 2 6.262 2 11.5c0 1.687.44 3.27 1.207 4.647L2 22l6.003-1.196A9.44 9.44 0 0011.5 21C16.738 21 21 16.738 21 11.5S16.738 2 11.5 2zm0 17.2a7.68 7.68 0 01-3.913-1.07l-.281-.167-2.909.579.615-2.844-.185-.293A7.66 7.66 0 013.8 11.5C3.8 7.254 7.254 3.8 11.5 3.8c4.246 0 7.7 3.454 7.7 7.7 0 4.246-3.454 7.7-7.7 7.7z"/>
  </svg>
)

const Spinner = ({ size = 18, color = '#fff' }: { size?: number; color?: string }) => (
  <span style={{
    display: 'inline-block',
    width: `${size}px`,
    height: `${size}px`,
    border: `2px solid ${color}`,
    borderTopColor: 'transparent',
    borderRadius: '50%',
    animation: 'paywall-spin 0.8s linear infinite',
  }} />
)

/**
 * Bloqueo total por trial vencido o suscripción vencida (pasada la gracia).
 * El aviso NO bloqueante del período de gracia vive en GraceBanner, que cada
 * página monta como primer elemento de su contenido.
 */
export function TrialExpiredGuard({ children }: Props) {
  const { tenant, profile } = useTenantStore()
  const isOwner = profile?.role === 'owner'

  const { payment, payLoading, payError, requestPayment, handlePay } = useSubscriptionPayment()

  const access = tenant ? getAccessState(tenant) : null
  const blocked = access?.blocked ?? false

  // Prefetch del link de pago al mostrar el paywall (solo owner):
  // así el botón muestra el precio real (viene de MP_PRICE_ARS via la function)
  useEffect(() => {
    if (blocked && isOwner && !payment && !payLoading && !payError) {
      void requestPayment()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [blocked, isOwner])

  if (!tenant || !access || !blocked) return <>{children}</>

  // ─── Paywall (bloqueo total) ───
  const title = access.isSubscription ? 'Tu suscripción venció' : 'Tu prueba finalizó'
  const subtitle = isOwner
    ? (access.isSubscription
        ? 'Renová tu suscripción para seguir usando la aplicación.'
        : 'Suscribite para seguir usando la aplicación.')
    : 'Pedile al dueño de la barbería que realice el pago para recuperar el acceso.'

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
        <div style={{ marginBottom: '32px' }}>
          <ScissorsIcon />
        </div>

        <h1 style={{
          fontFamily: 'Syne, sans-serif',
          fontWeight: 700,
          fontSize: '24px',
          color: '#0F172A',
          marginBottom: '16px',
          lineHeight: 1.3,
        }}>
          {title}
        </h1>

        <p style={{
          fontFamily: "'Space Grotesk', sans-serif",
          fontSize: '16px',
          color: '#475569',
          marginBottom: '32px',
          lineHeight: 1.6,
        }}>
          {subtitle}
        </p>

        {isOwner && (
          <>
            <button
              onClick={() => { void handlePay() }}
              disabled={payLoading}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '10px',
                width: '100%',
                maxWidth: '320px',
                padding: '16px 28px',
                background: payLoading ? '#93C5FD' : '#2563EB',
                color: '#fff',
                border: 'none',
                borderRadius: '12px',
                fontFamily: 'Syne, sans-serif',
                fontWeight: 700,
                fontSize: '16px',
                cursor: payLoading ? 'wait' : 'pointer',
                transition: 'all 0.2s',
                marginBottom: '16px',
              }}
            >
              {payLoading ? (
                <>
                  <Spinner />
                  Generando link de pago…
                </>
              ) : (
                <>Pagar suscripción {payment ? `${formatPrice(payment.price)}/mes` : ''}</>
              )}
            </button>

            {payError && (
              <p style={{
                fontFamily: "'Space Grotesk', sans-serif",
                fontSize: '14px',
                color: '#DC2626',
                marginBottom: '16px',
              }}>
                {payError}
              </p>
            )}
          </>
        )}

        <div>
          <a
            href={WHATSAPP_URL}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '10px',
              padding: '12px 24px',
              background: 'transparent',
              color: '#475569',
              border: '1px solid #CBD5E1',
              borderRadius: '12px',
              fontFamily: 'Syne, sans-serif',
              fontWeight: 700,
              fontSize: '15px',
              textDecoration: 'none',
              transition: 'all 0.2s',
            }}
          >
            <span style={{ color: '#25D366', display: 'inline-flex' }}><WhatsAppIcon /></span>
            Contactar por WhatsApp
          </a>
        </div>

        <p style={{
          marginTop: '24px',
          fontSize: '14px',
          color: '#94A3B8',
          fontFamily: "'Space Grotesk', sans-serif",
        }}>
          +54 2966 785213
        </p>
      </div>
      <style>{`@keyframes paywall-spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
