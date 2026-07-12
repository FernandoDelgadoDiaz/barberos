import { useTenantStore } from '../stores/tenantStore'
import { getAccessState, useSubscriptionPayment } from '../hooks/useSubscription'

interface Props {
  /** Márgenes/espaciado según dónde lo monte cada página. */
  style?: React.CSSProperties
}

/**
 * Banner de aviso durante el período de gracia (suscripción vencida,
 * acceso todavía permitido). Elemento ESTÁTICO en el flujo normal:
 * cada página lo monta como primer elemento del contenido, antes del hero.
 * No usa position:fixed ni safe-areas — no tapa ni desplaza nada.
 * Owner ve días restantes + botón de pago; barber solo el aviso.
 */
export function GraceBanner({ style }: Props) {
  const { tenant, profile } = useTenantStore()
  const isOwner = profile?.role === 'owner'
  const { payLoading, handlePay } = useSubscriptionPayment()

  if (!tenant) return null
  const access = getAccessState(tenant)
  if (access.blocked || !access.inGrace) return null

  const ownerText = access.graceDaysLeft > 0
    ? `Suscripción vencida. Quedan ${access.graceDaysLeft} ${access.graceDaysLeft === 1 ? 'día' : 'días'} para pagar.`
    : 'Suscripción vencida. Último día para pagar.'
  const barberText = 'El acceso vence pronto. Avisale al dueño de la barbería.'

  return (
    <div style={{
      background: '#FEF3C7',
      border: '1px solid #FDE68A',
      borderRadius: '12px',
      padding: '10px 14px',
      display: 'flex',
      alignItems: 'center',
      gap: '10px',
      ...style,
    }}>
      <span style={{
        flex: 1,
        minWidth: 0,
        fontFamily: "'Space Grotesk', sans-serif",
        fontSize: '13px',
        fontWeight: 600,
        color: '#78350F',
        lineHeight: 1.4,
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
            height: '30px',
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
          {payLoading ? (
            <span style={{
              display: 'inline-block',
              width: '12px',
              height: '12px',
              border: '2px solid #fff',
              borderTopColor: 'transparent',
              borderRadius: '50%',
              animation: 'grace-spin 0.8s linear infinite',
            }} />
          ) : null}
          Pagar
        </button>
      )}
      <style>{`@keyframes grace-spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
