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
    <div className="min-h-screen flex items-center justify-center bg-background p-4 relative overflow-hidden">
      {/* Decorative barber pole background */}
      <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 opacity-5 pointer-events-none z-0">
        <img src="/barber-pole.svg" alt="" className="h-96" />
      </div>

      {/* Animated gradient orbs */}
      <div className="fixed top-0 left-0 w-96 h-96 bg-accent/5 rounded-full blur-3xl -translate-x-1/2 -translate-y-1/2" />
      <div className="fixed bottom-0 right-0 w-96 h-96 bg-accent/5 rounded-full blur-3xl translate-x-1/3 translate-y-1/3" />

      <div className="w-full max-w-md relative z-10">
        <div className="bg-surface border border-border rounded-2xl shadow-luxury p-8">
          {/* Logo and header */}
          <div className="mb-8 text-center">
            <div className="flex justify-center mb-6">
              <img src="/logo.svg" alt="BARBEROS" className="h-16" />
            </div>

            {tenantName ? (
              <>
                <h1 className="text-2xl font-syne font-bold text-text-primary mb-2">
                  {tenantName}
                </h1>
                <p className="text-text-secondary">Ingresa a tu cuenta</p>
              </>
            ) : (
              <>
                <h1 className="text-2xl font-syne font-bold text-text-primary mb-2">
                  BARBER<span className="text-accent">OS</span>
                </h1>
                <p className="text-text-secondary">Sistema de gestión para barberías</p>
              </>
            )}
          </div>

          {/* Login form */}
          <form onSubmit={handleSubmit}>
            <div className="space-y-6">
              <div>
                <label
                  htmlFor="email"
                  className="block text-sm font-medium text-text-secondary mb-3"
                >
                  Email
                </label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-4 py-3.5 bg-card border border-border rounded-xl focus:ring-2 focus:ring-accent focus:border-transparent text-text-primary placeholder-text-tertiary transition-all duration-200"
                  placeholder="tu@email.com"
                  required
                  disabled={isLoading}
                />
              </div>

              <div>
                <label
                  htmlFor="password"
                  className="block text-sm font-medium text-text-secondary mb-3"
                >
                  Contraseña
                </label>
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-4 py-3.5 bg-card border border-border rounded-xl focus:ring-2 focus:ring-accent focus:border-transparent text-text-primary placeholder-text-tertiary transition-all duration-200"
                  placeholder="••••••••"
                  required
                  disabled={isLoading}
                />
              </div>

              {error && (
                <div className="p-4 bg-card border border-border rounded-xl">
                  <p className="text-accent text-sm font-medium">{error}</p>
                </div>
              )}

              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-3.5 bg-accent text-background font-syne font-bold rounded-xl hover:bg-accent-dark transition-all duration-200 hover:scale-[1.02] active:scale-95 shadow-luxury-sm disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading ? (
                  <span className="flex items-center justify-center gap-2">
                    <div className="w-5 h-5 border-2 border-background border-t-transparent rounded-full animate-spin" />
                    Ingresando...
                  </span>
                ) : (
                  'Ingresar'
                )}
              </button>
            </div>
          </form>

          {/* Demo credentials */}
          <div className="mt-8 pt-6 border-t border-border">
            <p className="text-sm text-text-secondary text-center mb-4">
              Credenciales de prueba:
            </p>
            <div className="space-y-3">
              <div className="p-4 bg-card border border-border rounded-xl">
                <div className="font-medium text-text-primary">owner@demo.com</div>
                <div className="text-text-secondary text-sm">Demo1234!</div>
              </div>
              <div className="p-4 bg-card border border-border rounded-xl">
                <div className="font-medium text-text-primary">carlos@demo.com</div>
                <div className="text-text-secondary text-sm">Demo1234!</div>
              </div>
              <div className="p-4 bg-card border border-border rounded-xl">
                <div className="font-medium text-text-primary">gabriel@demo.com</div>
                <div className="text-text-secondary text-sm">Demo1234!</div>
              </div>
            </div>

            {/* Hint */}
            <div className="mt-6 p-4 bg-card/50 border border-border rounded-xl">
              <p className="text-xs text-text-tertiary text-center">
                <span className="text-accent">BARBEROS Luxury Edition</span> • Diseño Dark Luxury
              </p>
            </div>
          </div>
        </div>

        {/* Footer note */}
        <div className="mt-6 text-center">
          <p className="text-text-tertiary text-sm">
            © {new Date().getFullYear()} BARBEROS • Sistema de gestión profesional
          </p>
        </div>
      </div>
    </div>
  )
}