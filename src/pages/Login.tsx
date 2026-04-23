import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { useTenantStore } from '../stores/tenantStore'
import { supabase } from '../config/supabase'

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
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al iniciar sesión')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#F4F5F7', padding: '20px' }}>
      <div style={{ width: 'min(90vw, 400px)', maxWidth: '400px' }}>
        <div style={{ background: '#fff', border: '0.5px solid #e0e0e0', borderRadius: '12px', boxShadow: '0 4px 24px rgba(0,0,0,0.06)', padding: '32px' }}>
          <div style={{ marginBottom: '32px', textAlign: 'center' }}>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '24px' }}>
              <span style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: '20px', color: '#1E2A3A' }}>
                Aliada Barberías
              </span>
            </div>

            {tenantName ? (
              <>
                <h1 style={{ fontSize: '24px', fontFamily: 'Syne, sans-serif', fontWeight: 700, color: '#1E2A3A', marginBottom: '8px' }}>
                  {tenantName}
                </h1>
                <p style={{ color: '#aaa' }}>Ingresá a tu cuenta</p>
              </>
            ) : (
              <>
                <h1 style={{ fontSize: '24px', fontFamily: 'Syne, sans-serif', fontWeight: 700, color: '#1E2A3A', marginBottom: '8px' }}>
                  Aliada Barberías
                </h1>
                <p style={{ color: '#aaa' }}>Sistema de gestión para barberías</p>
              </>
            )}
          </div>

          <form onSubmit={handleSubmit}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              <div>
                <label
                  htmlFor="email"
                  style={{ display: 'block', fontSize: '14px', fontWeight: 500, color: '#aaa', marginBottom: '12px' }}
                >
                  Email
                </label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  style={{ width: '100%', padding: '14px 16px', background: '#f8f8f8', border: '0.5px solid #e0e0e0', borderRadius: '8px', color: '#1a1a2e', fontSize: '16px', outline: 'none', transition: 'all 0.2s', height: '48px' }}
                  placeholder="tu@email.com"
                  required
                  disabled={isLoading}
                  onFocus={(e) => e.target.style.borderColor = '#1E2A3A'}
                  onBlur={(e) => e.target.style.borderColor = '#e0e0e0'}
                />
              </div>

              <div>
                <label
                  htmlFor="password"
                  style={{ display: 'block', fontSize: '14px', fontWeight: 500, color: '#aaa', marginBottom: '12px' }}
                >
                  Contraseña
                </label>
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  style={{ width: '100%', padding: '14px 16px', background: '#f8f8f8', border: '0.5px solid #e0e0e0', borderRadius: '8px', color: '#1a1a2e', fontSize: '16px', outline: 'none', transition: 'all 0.2s', height: '48px' }}
                  placeholder="••••••••"
                  required
                  disabled={isLoading}
                  onFocus={(e) => e.target.style.borderColor = '#1E2A3A'}
                  onBlur={(e) => e.target.style.borderColor = '#e0e0e0'}
                />
              </div>

              {error && (
                <div style={{ padding: '16px', background: '#fff5f5', border: '0.5px solid #ffcccc', borderRadius: '12px' }}>
                  <p style={{ color: '#cc3333', fontSize: '14px', fontWeight: 500 }}>{error}</p>
                </div>
              )}

              <button
                type="submit"
                disabled={isLoading}
                style={{ width: '100%', padding: '14px', background: '#1E2A3A', color: '#fff', fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: '16px', borderRadius: '8px', border: 'none', cursor: isLoading ? 'not-allowed' : 'pointer', opacity: isLoading ? 0.5 : 1, transition: 'all 0.2s', height: '52px' }}
              >
                {isLoading ? (
                  <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                    <div style={{ width: '20px', height: '20px', border: '2px solid #fff', borderTopColor: 'transparent', borderRadius: '9999px', animation: 'spin 1s linear infinite' }} />
                    Ingresando...
                  </span>
                ) : (
                  'Ingresar'
                )}
              </button>
            </div>
          </form>
        </div>

        <div style={{ marginTop: '24px', textAlign: 'center' }}>
          <p style={{ color: '#aaa', fontSize: '14px' }}>
            ¿Sos dueño de una barbería? →{' '}
            <a href="/register" style={{ color: '#1E2A3A', textDecoration: 'none', fontWeight: 600 }}>
              Registrá tu local gratis
            </a>
          </p>
        </div>

        <div style={{ marginTop: '24px', textAlign: 'center' }}>
          <p style={{ color: '#aaa', fontSize: '14px' }}>
            © {new Date().getFullYear()} Aliada Barberías • Sistema de gestión profesional
          </p>
        </div>
      </div>
    </div>
  )
}
