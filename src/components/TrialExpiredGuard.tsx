import { useCallback, useEffect, useState } from 'react'
import { useTenantStore } from '../stores/tenantStore'
import { supabase } from '../config/supabase'

interface Props {
  children: React.ReactNode
}

const WHATSAPP_URL = 'https://wa.me/542966785213'
const MS_PER_DAY = 1000 * 60 * 60 * 24

async function getAuthHeader(): Promise<string> {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) {
    const { data: { session: refreshed } } = await supabase.auth.refreshSession()
    if (!refreshed?.access_token) throw new Error('No session')
    return `Bearer ${refreshed.access_token}`
  }
  return `Bearer ${session.access_token}`
}

const formatPrice = (amount: number): string =>
  new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    maximumFractionDigits: 0,
  }).format(amount)

/** Normaliza una fecha al inicio del día (comparaciones a nivel día). */
const startOfDay = (d: Date): Date => {
  const r = new Date(d)
  r.setHours(0, 0, 0, 0)
  return r
}

type PaymentLink = {
  init_point: string
  price: number
}

type AccessState = {
  blocked: boolean
  /** true si el bloqueo/aviso corresponde a una suscripción paga vencida (no al trial) */
  isSubscription: boolean
  /** true si está dentro del período de gracia (acceso permitido, banner visible) */
  inGrace: boolean
  /** días restantes de gracia (0 = hoy es el último día) */
  graceDaysLeft: number
}

/**
 * Deriva el estado de acceso SOLO de fechas (no depende de que el cron
 * haya actualizado subscription_status):
 * - is_exempt_trial → acceso libre
 * - pagó alguna vez (subscription_ends_at != null):
 *     hoy <= subscription_ends_at + grace_days → acceso (banner si ya venció)
 * - nunca pagó: trial_ends_at > hoy → acceso; si no → paywall
 */
function getAccessState(tenant: {
  is_exempt_trial?: boolean
  subscription_ends_at?: string | null
  grace_days?: number
  trial_ends_at?: string | null
}): AccessState {
  const none: AccessState = { blocked: false, isSubscription: false, inGrace: false, graceDaysLeft: 0 }

  if (tenant.is_exempt_trial) return none

  const today = startOfDay(new Date())

  if (tenant.subscription_ends_at) {
    const subEnd = startOfDay(new Date(tenant.subscription_ends_at))
    const graceDays = tenant.grace_days ?? 5
    const deadline = new Date(subEnd.getTime() + graceDays * MS_PER_DAY)

    if (today > deadline) {
      return { blocked: true, isSubscription: true, inGrace: false, graceDaysLeft: 0 }
    }
    if (today > subEnd) {
      const daysLeft = Math.round((deadline.getTime() - today.getTime()) / MS_PER_DAY)
      return { blocked: false, isSubscription: true, inGrace: true, graceDaysLeft: daysLeft }
    }
    return none
  }

  // Nunca pagó: rige el trial (mismo comportamiento que antes)
  if (tenant.trial_ends_at) {
    const trialEnd = startOfDay(new Date(tenant.trial_ends_at))
    if (trialEnd <= today) {
      return { blocked: true, isSubscription: false, inGrace: false, graceDaysLeft: 0 }
    }
  }
  return none
}

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

export function TrialExpiredGuard({ children }: Props) {
  const { tenant, profile } = useTenantStore()
  const isOwner = profile?.role === 'owner'

  const [payment, setPayment] = useState<PaymentLink | null>(null)
  const [payLoading, setPayLoading] = useState(false)
  const [payError, setPayError] = useState<string | null>(null)

  const access = tenant ? getAccessState(tenant) : null
  const blocked = access?.blocked ?? false
  const inGrace = access?.inGrace ?? false

  const requestPayment = useCallback(async (): Promise<PaymentLink | null> => {
    setPayLoading(true)
    setPayError(null)
    try {
      const authHeader = await getAuthHeader()
      const response = await fetch('/api/create-payment', {
        method: 'POST',
        headers: { 'Authorization': authHeader },
      })
      if (!response.ok) throw new Error(`Error ${response.status}`)
      const data = await response.json() as PaymentLink
      setPayment(data)
      return data
    } catch (err) {
      console.error('Error creating payment link:', err)
      setPayError('No se pudo generar el link de pago. Intentá de nuevo o contactanos.')
      return null
    } finally {
      setPayLoading(false)
    }
  }, [])

  // Prefetch del link de pago al mostrar el paywall (solo owner):
  // así el botón muestra el precio real (viene de MP_PRICE_ARS via la function)
  useEffect(() => {
    if (blocked && isOwner && !payment && !payLoading && !payError) {
      void requestPayment()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [blocked, isOwner])

  const handlePay = async () => {
    if (payLoading) return
    const link = payment ?? await requestPayment()
    if (link) window.location.href = link.init_point
  }

  if (!tenant || !access || (!blocked && !inGrace)) return <>{children}</>

  // ─── Banner de gracia (NO bloqueante) ───
  // Fijo arriba como notificación de sistema: no desplaza ni tapa contenido.
  // Un spacer de la misma altura empuja el contenido para que nada quede debajo.
  if (!blocked && inGrace) {
    const ownerText = access.graceDaysLeft > 0
      ? `Suscripción vencida. Quedan ${access.graceDaysLeft} ${access.graceDaysLeft === 1 ? 'día' : 'días'} para pagar.`
      : 'Suscripción vencida. Último día para pagar.'
    const barberText = 'El acceso vence pronto. Avisale al dueño de la barbería.'
    return (
      <>
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          zIndex: 50,
          height: 'calc(44px + env(safe-area-inset-top))',
          paddingTop: 'env(safe-area-inset-top)',
          background: '#FEF3C7',
          borderBottom: '1px solid #FDE68A',
          boxSizing: 'border-box',
        }}>
          <div style={{
            maxWidth: '430px',
            margin: '0 auto',
            height: '44px',
            padding: '0 12px',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
          }}>
            <span style={{
              flex: 1,
              minWidth: 0,
              fontFamily: "'Space Grotesk', sans-serif",
              fontSize: '13px',
              fontWeight: 600,
              color: '#78350F',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}>
              {isOwner ? ownerText : barberText}
            </span>
            {isOwner && (
              <button
                onClick={() => { void handlePay() }}
                disabled={payLoading}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  height: '28px',
                  padding: '0 14px',
                  background: '#B45309',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '999px',
                  fontFamily: 'Syne, sans-serif',
                  fontWeight: 700,
                  fontSize: '12px',
                  cursor: payLoading ? 'wait' : 'pointer',
                  whiteSpace: 'nowrap',
                  flexShrink: 0,
                }}
              >
                {payLoading ? <Spinner size={12} /> : null}
                Pagar
              </button>
            )}
          </div>
        </div>
        {/* Spacer: reserva el alto del banner para que el contenido no quede tapado */}
        <div style={{ height: 'calc(44px + env(safe-area-inset-top))' }} />
        {children}
        <style>{`@keyframes paywall-spin { to { transform: rotate(360deg); } }`}</style>
      </>
    )
  }

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
