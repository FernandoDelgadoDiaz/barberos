import { Link } from 'react-router-dom'

type Variant = 'exito' | 'pendiente' | 'error'

interface Props {
  variant: Variant
}

const WHATSAPP_URL = 'https://wa.me/542966785213'

const CONTENT: Record<Variant, { emoji: string; title: string; message: string }> = {
  exito: {
    emoji: '✅',
    title: 'Pago recibido',
    message: 'Tu cuenta fue activada. Ya podés seguir usando la aplicación.',
  },
  pendiente: {
    emoji: '⏳',
    title: 'Pago pendiente de confirmación',
    message: 'Tu pago está siendo procesado. Apenas se acredite, tu cuenta se activará automáticamente.',
  },
  error: {
    emoji: '❌',
    title: 'Hubo un error con el pago',
    message: 'El pago no pudo completarse. Podés reintentarlo o contactarnos si el problema persiste.',
  },
}

const buttonStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '10px',
  padding: '14px 28px',
  background: '#2563EB',
  color: '#fff',
  border: 'none',
  borderRadius: '12px',
  fontFamily: 'Syne, sans-serif',
  fontWeight: 700,
  fontSize: '16px',
  textDecoration: 'none',
  cursor: 'pointer',
}

const secondaryButtonStyle: React.CSSProperties = {
  ...buttonStyle,
  background: 'transparent',
  color: '#475569',
  border: '1px solid #CBD5E1',
  fontSize: '15px',
  padding: '12px 24px',
}

/**
 * Página de retorno del checkout de MercadoPago (back_urls).
 * Es solo UX post-pago: el desbloqueo real lo hace el webhook (mp-webhook.ts).
 */
export function PaymentResult({ variant }: Props) {
  const { emoji, title, message } = CONTENT[variant]

  return (
    <div style={{
      minHeight: '100vh',
      background: '#F4F5F7',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '20px',
    }}>
      <div style={{ textAlign: 'center', maxWidth: '440px' }}>
        <div style={{ fontSize: '64px', marginBottom: '24px' }}>{emoji}</div>

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
          {message}
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', alignItems: 'center' }}>
          {variant === 'error' ? (
            <>
              {/* El paywall se muestra automáticamente al volver al panel */}
              <Link to="/owner" style={buttonStyle}>Reintentar pago</Link>
              <a
                href={WHATSAPP_URL}
                target="_blank"
                rel="noopener noreferrer"
                style={secondaryButtonStyle}
              >
                Contactar por WhatsApp
              </a>
            </>
          ) : (
            <Link to="/owner" style={buttonStyle}>Volver al panel</Link>
          )}
        </div>
      </div>
    </div>
  )
}
