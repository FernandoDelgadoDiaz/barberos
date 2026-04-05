import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { useTenantStore } from '../stores/tenantStore'
import { supabase } from '../config/supabase'

const ScissorsIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
    <circle cx="5" cy="19" r="2.5" stroke="var(--secondary, #C8A97E)" strokeWidth="1.5"/>
    <circle cx="19" cy="19" r="2.5" stroke="var(--secondary, #C8A97E)" strokeWidth="1.5"/>
    <line x1="5" y1="19" x2="19" y2="5" stroke="var(--secondary, #C8A97E)" strokeWidth="1.5" strokeLinecap="round"/>
    <line x1="19" y1="19" x2="5" y2="5" stroke="var(--text-dim, #555)" strokeWidth="1.5" strokeLinecap="round"/>
    <circle cx="5" cy="5" r="2.5" stroke="var(--text-dim, #555)" strokeWidth="1.5"/>
    <circle cx="19" cy="5" r="2.5" stroke="var(--text-dim, #555)" strokeWidth="1.5"/>
    <line x1="10" y1="12" x2="14" y2="12" stroke="var(--secondary, #C8A97E)" strokeWidth="1"/>
  </svg>
)

export function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [tenantName, setTenantName] = useState<string | null>(null)
  const { signIn } = useAuth()
  const { profile } = useTenantStore()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()

  // Load tenant from URL param
  useEffect(() => {
    const tenantSlug = searchParams.get('tenant')
    if (tenantSlug) {
      supabase
        .from('tenants')
        .select('name')
        .eq('slug', tenantSlug)
        .eq('is_active', true)
        .single()
        .then(({ data }) => {
          if (data) setTenantName(data.name)
        })
    }
  }, [searchParams])

  // Redirect if already logged in
  useEffect(() => {
    if (profile) {
      if (profile.role === 'barber') navigate('/barber/dashboard')
      else if (profile.role === 'owner') navigate('/owner/live')
      else if (profile.role === 'superadmin') navigate('/superadmin/tenants')
    }
  }, [profile, navigate])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError(null)

    try {
      await signIn(email, password)
      // Redirection happens in the useEffect above
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al iniciar sesión')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--primary, #1a1a1a)', padding: '20px', position: 'relative', overflow: 'hidden' }}>
      {/* Decorative barber pole background */}
      <div style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', opacity: 0.06, pointerEvents: 'none', zIndex: 0 }}>
        <img src="/barber-pole.svg" alt="" style={{ height: '384px' }} />
      </div>

      {/* Animated gradient orbs */}
      <div style={{ position: 'fixed', top: 0, left: 0, width: '384px', height: '384px', background: 'rgba(200, 169, 126, 0.05)', borderRadius: '9999px', filter: 'blur(48px)', transform: 'translate(-50%, -50%)' }} />
      <div style={{ position: 'fixed', bottom: 0, right: 0, width: '384px', height: '384px', background: 'rgba(200, 169, 126, 0.05)', borderRadius: '9999px', filter: 'blur(48px)', transform: 'translate(33%, 33%)' }} />

      <div style={{ width: 'min(90vw, 400px)', maxWidth: '400px', position: 'relative', zIndex: 10 }}>
        <div style={{ background: 'var(--surface, #242424)', border: '1px solid var(--border, #383838)', borderRadius: '16px', boxShadow: '0 20px 60px rgba(0,0,0,0.5)', padding: '32px' }}>
          {/* Logo and header */}
          <div style={{ marginBottom: '32px', textAlign: 'center' }}>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '24px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <ScissorsIcon />
                <span style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: '24px', letterSpacing: '2px', color: 'var(--text, #fff)' }}>
                  BARBER<span style={{ color: 'var(--secondary, #C8A97E)' }}>OS</span>
                </span>
              </div>
            </div>

            {tenantName ? (
              <>
                <h1 style={{ fontSize: '24px', fontFamily: 'Syne, sans-serif', fontWeight: 700, color: 'var(--text, #ffffff)', marginBottom: '8px' }}>
                  {tenantName}
                </h1>
                <p style={{ color: 'var(--text-muted, #999999)' }}>Ingresa a tu cuenta</p>
              </>
            ) : (
              <>
                <h1 style={{ fontSize: '24px', fontFamily: 'Syne, sans-serif', fontWeight: 700, color: 'var(--text, #ffffff)', marginBottom: '8px' }}>
                  BARBER<span style={{ color: 'var(--secondary, #C8A97E)' }}>OS</span>
                </h1>
                <p style={{ color: 'var(--text-muted, #999999)' }}>Sistema de gestión para barberías</p>
              </>
            )}
          </div>

          {/* Login form */}
          <form onSubmit={handleSubmit}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              <div>
                <label
                  htmlFor="email"
                  style={{ display: 'block', fontSize: '14px', fontWeight: 500, color: 'var(--text-muted, #999999)', marginBottom: '12px' }}
                >
                  Email
                </label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  style={{ width: '100%', padding: '14px 16px', background: 'var(--card, #2a2a2a)', border: '1px solid var(--border, #383838)', borderRadius: '8px', color: 'var(--text, #ffffff)', fontSize: '16px', outline: 'none', transition: 'all 0.2s', height: '48px' }}
                  placeholder="tu@email.com"
                  required
                  disabled={isLoading}
                  onFocus={(e) => e.target.style.borderColor = 'var(--secondary, #C8A97E)'}
                  onBlur={(e) => e.target.style.borderColor = 'var(--border, #383838)'}
                />
              </div>

              <div>
                <label
                  htmlFor="password"
                  style={{ display: 'block', fontSize: '14px', fontWeight: 500, color: 'var(--text-muted, #999999)', marginBottom: '12px' }}
                >
                  Contraseña
                </label>
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  style={{ width: '100%', padding: '14px 16px', background: 'var(--card, #2a2a2a)', border: '1px solid var(--border, #383838)', borderRadius: '8px', color: 'var(--text, #ffffff)', fontSize: '16px', outline: 'none', transition: 'all 0.2s', height: '48px' }}
                  placeholder="••••••••"
                  required
                  disabled={isLoading}
                  onFocus={(e) => e.target.style.borderColor = 'var(--secondary, #C8A97E)'}
                  onBlur={(e) => e.target.style.borderColor = 'var(--border, #383838)'}
                />
              </div>

              {error && (
                <div style={{ padding: '16px', background: 'var(--card, #2a2a2a)', border: '1px solid var(--border, #383838)', borderRadius: '12px' }}>
                  <p style={{ color: 'var(--danger, #e94560)', fontSize: '14px', fontWeight: 500 }}>{error}</p>
                </div>
              )}

              <button
                type="submit"
                disabled={isLoading}
                style={{ width: '100%', padding: '14px', background: 'var(--secondary, #C8A97E)', color: 'var(--primary, #1a1a1a)', fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: '16px', borderRadius: '8px', border: 'none', cursor: isLoading ? 'not-allowed' : 'pointer', opacity: isLoading ? 0.5 : 1, transition: 'all 0.2s', height: '52px' }}
              >
                {isLoading ? (
                  <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                    <div style={{ width: '20px', height: '20px', border: '2px solid var(--primary, #1a1a1a)', borderTopColor: 'transparent', borderRadius: '9999px', animation: 'spin 1s linear infinite' }} />
                    Ingresando...
                  </span>
                ) : (
                  'Ingresar'
                )}
              </button>
            </div>
          </form>

          {/* Demo credentials */}
          <div style={{ marginTop: '32px', paddingTop: '24px', borderTop: '1px solid var(--border, #383838)' }}>
            <p style={{ fontSize: '14px', color: 'var(--text-muted, #999999)', textAlign: 'center', marginBottom: '16px' }}>
              Credenciales de prueba:
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ padding: '16px', background: 'var(--surface, #222222)', border: '1px solid var(--border, #383838)', borderRadius: '12px' }}>
                <div style={{ fontWeight: 500, color: 'var(--text, #ffffff)' }}>owner@demo.com</div>
                <div style={{ color: 'var(--text-dim, var(--text-dim, #555)555)', fontSize: '14px' }}>Demo1234!</div>
              </div>
              <div style={{ padding: '16px', background: 'var(--surface, #222222)', border: '1px solid var(--border, #383838)', borderRadius: '12px' }}>
                <div style={{ fontWeight: 500, color: 'var(--text, #ffffff)' }}>carlos@demo.com</div>
                <div style={{ color: 'var(--text-dim, var(--text-dim, #555)555)', fontSize: '14px' }}>Demo1234!</div>
              </div>
              <div style={{ padding: '16px', background: 'var(--surface, #222222)', border: '1px solid var(--border, #383838)', borderRadius: '12px' }}>
                <div style={{ fontWeight: 500, color: 'var(--text, #ffffff)' }}>gabriel@demo.com</div>
                <div style={{ color: 'var(--text-dim, var(--text-dim, #555)555)', fontSize: '14px' }}>Demo1234!</div>
              </div>
            </div>

            {/* Hint */}
            <div style={{ marginTop: '24px', padding: '16px', background: 'var(--card, #2a2a2a)', border: '1px solid var(--border, #383838)', borderRadius: '12px' }}>
              <p style={{ fontSize: '12px', color: 'var(--text-dim, var(--text-dim, #555)555)', textAlign: 'center' }}>
                <span style={{ color: 'var(--secondary, #C8A97E)' }}>BARBEROS Luxury Edition</span> • Diseño Dark Luxury
              </p>
            </div>
          </div>
        </div>

        {/* Registration link */}
        <div style={{ marginTop: '24px', textAlign: 'center' }}>
          <p style={{ color: 'var(--text-dim, var(--text-dim, #555)555)', fontSize: '14px' }}>
            ¿Sos dueño de una barbería? →{' '}
            <a href="/register" style={{ color: 'var(--secondary, #C8A97E)', textDecoration: 'none', fontWeight: 600 }}>
              Registrá tu local gratis
            </a>
          </p>
        </div>

        {/* Footer note */}
        <div style={{ marginTop: '24px', textAlign: 'center' }}>
          <p style={{ color: 'var(--text-dim, var(--text-dim, #555)555)', fontSize: '14px' }}>
            © {new Date().getFullYear()} BARBEROS • Sistema de gestión profesional
          </p>
        </div>
      </div>
    </div>
  )
}