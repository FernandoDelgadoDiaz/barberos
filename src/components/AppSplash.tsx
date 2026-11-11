import { retryAuthBootstrap } from '../hooks/useAuth'
import { supabase } from '../config/supabase'

interface Props {
  error?: string | null
}

/**
 * Shown while the stored session is restored at startup, instead of the login
 * form. With an error it offers a retry that keeps the session.
 */
export function AppSplash({ error = null }: Props) {
  return (
    <div data-testid="app-splash" style={{ minHeight: '100dvh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '16px', background: '#F8FAFC', padding: '24px', boxSizing: 'border-box', fontFamily: 'Space Grotesk, sans-serif', textAlign: 'center' }}>
      <style>{'@keyframes app-splash-spin { to { transform: rotate(360deg) } }'}</style>
      <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: '22px', color: '#0F172A' }}>BarberOS</div>
      {error ? (
        <>
          <p style={{ margin: 0, fontSize: '14px', color: '#475569', maxWidth: '300px', lineHeight: 1.45 }}>
            No pudimos conectar. Revisá la conexión y volvé a intentar; tu sesión sigue iniciada.
          </p>
          <button type="button" data-testid="app-splash-retry" onClick={() => void retryAuthBootstrap()}
            style={{ minHeight: '48px', padding: '0 24px', background: '#2563EB', color: '#fff', border: 'none', borderRadius: '12px', fontFamily: 'inherit', fontWeight: 600, fontSize: '15px', cursor: 'pointer' }}>
            Reintentar
          </button>
          <button type="button" onClick={() => void supabase.auth.signOut()}
            style={{ background: 'transparent', border: 'none', color: '#64748B', fontFamily: 'inherit', fontSize: '13px', cursor: 'pointer', padding: '8px' }}>
            Ingresar con otra cuenta
          </button>
        </>
      ) : (
        <>
          <div style={{ width: 32, height: 32, borderRadius: '50%', border: '3px solid #E2E8F0', borderTopColor: '#2563EB', animation: 'app-splash-spin 0.8s linear infinite' }} />
          <p style={{ margin: 0, fontSize: '14px', color: '#94A3B8' }}>Cargando…</p>
        </>
      )}
    </div>
  )
}
