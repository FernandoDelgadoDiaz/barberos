import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'

const ScissorsIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
    <circle cx="5" cy="19" r="2.5" stroke="#C8A97E" strokeWidth="1.5"/>
    <circle cx="19" cy="19" r="2.5" stroke="#C8A97E" strokeWidth="1.5"/>
    <line x1="5" y1="19" x2="19" y2="5" stroke="#C8A97E" strokeWidth="1.5" strokeLinecap="round"/>
    <line x1="19" y1="19" x2="5" y2="5" stroke="#555" strokeWidth="1.5" strokeLinecap="round"/>
    <circle cx="5" cy="5" r="2.5" stroke="#555" strokeWidth="1.5"/>
    <circle cx="19" cy="5" r="2.5" stroke="#555" strokeWidth="1.5"/>
    <line x1="10" y1="12" x2="14" y2="12" stroke="#C8A97E" strokeWidth="1"/>
  </svg>
)

type Step = 'barberia' | 'owner'

export function Register() {
  const navigate = useNavigate()
  const [step, setStep] = useState<Step>('barberia')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  // Step 1: Barbería
  const [barberiaName, setBarberiaName] = useState('')
  const [slug, setSlug] = useState('')
  const [primaryColor, setPrimaryColor] = useState('#1a1a2e')
  const [secondaryColor, setSecondaryColor] = useState('#C8A97E')

  // Step 2: Owner
  const [ownerName, setOwnerName] = useState('')
  const [ownerEmail, setOwnerEmail] = useState('')
  const [ownerPassword, setOwnerPassword] = useState('')
  const [ownerPasswordConfirm, setOwnerPasswordConfirm] = useState('')
  const [acceptTerms, setAcceptTerms] = useState(false)

  // Auto-generate slug from barberiaName
  useEffect(() => {
    if (barberiaName.trim()) {
      const generated = barberiaName
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '')
      setSlug(generated)
    }
  }, [barberiaName])

  const validateStep1 = (): boolean => {
    if (!barberiaName.trim()) {
      setError('Ingresá el nombre de tu barbería')
      return false
    }
    if (!slug.trim()) {
      setError('El slug no puede estar vacío')
      return false
    }
    const slugRegex = /^[a-z0-9-]+$/
    if (!slugRegex.test(slug)) {
      setError('El slug solo puede contener letras minúsculas, números y guiones')
      return false
    }
    return true
  }

  const validateStep2 = (): boolean => {
    if (!ownerName.trim()) {
      setError('Ingresá tu nombre completo')
      return false
    }
    if (!ownerEmail.trim()) {
      setError('Ingresá tu email')
      return false
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(ownerEmail)) {
      setError('Email inválido')
      return false
    }
    if (ownerPassword.length < 8) {
      setError('La contraseña debe tener al menos 8 caracteres')
      return false
    }
    if (ownerPassword !== ownerPasswordConfirm) {
      setError('Las contraseñas no coinciden')
      return false
    }
    if (!acceptTerms) {
      setError('Debés aceptar los términos de uso')
      return false
    }
    return true
  }

  const handleNextStep = () => {
    setError(null)
    if (validateStep1()) {
      setStep('owner')
    }
  }

  const handlePrevStep = () => {
    setError(null)
    setStep('barberia')
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!validateStep1() || !validateStep2()) {
      return
    }

    setIsLoading(true)

    try {
      const response = await fetch('/.netlify/functions/create-tenant', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          barberia_name: barberiaName,
          slug,
          owner_name: ownerName,
          owner_email: ownerEmail,
          owner_password: ownerPassword,
          primary_color: primaryColor,
          secondary_color: secondaryColor,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Error al crear la barbería')
      }

      setSuccess(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido')
    } finally {
      setIsLoading(false)
    }
  }

  if (success) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#1a1a1a', padding: '20px', position: 'relative', overflow: 'hidden' }}>
        {/* Decorative barber pole background */}
        <div style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', opacity: 0.06, pointerEvents: 'none', zIndex: 0 }}>
          <img src="/barber-pole.svg" alt="" style={{ height: '384px' }} />
        </div>

        {/* Animated gradient orbs */}
        <div style={{ position: 'fixed', top: 0, left: 0, width: '384px', height: '384px', background: 'rgba(200, 169, 126, 0.05)', borderRadius: '9999px', filter: 'blur(48px)', transform: 'translate(-50%, -50%)' }} />
        <div style={{ position: 'fixed', bottom: 0, right: 0, width: '384px', height: '384px', background: 'rgba(200, 169, 126, 0.05)', borderRadius: '9999px', filter: 'blur(48px)', transform: 'translate(33%, 33%)' }} />

        <div style={{ width: 'min(90vw, 500px)', maxWidth: '500px', position: 'relative', zIndex: 10 }}>
          <div style={{ background: '#242424', border: '1px solid #383838', borderRadius: '16px', boxShadow: '0 20px 60px rgba(0,0,0,0.5)', padding: '40px', textAlign: 'center' }}>
            {/* Logo and header */}
            <div style={{ marginBottom: '32px' }}>
              <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '24px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <ScissorsIcon />
                  <span style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: '24px', letterSpacing: '2px', color: '#fff' }}>
                    BARBER<span style={{ color: '#C8A97E' }}>OS</span>
                  </span>
                </div>
              </div>
              <h1 style={{ fontSize: '32px', fontFamily: 'Syne, sans-serif', fontWeight: 700, color: '#ffffff', marginBottom: '16px' }}>
                ¡Tu barbería está lista!
              </h1>
              <p style={{ color: '#999999', fontSize: '18px', marginBottom: '32px' }}>
                Ya podés comenzar a gestionar tu negocio.
              </p>
            </div>

            {/* Success details */}
            <div style={{ background: '#2a2a2a', border: '1px solid #383838', borderRadius: '12px', padding: '24px', marginBottom: '32px', textAlign: 'left' }}>
              <div style={{ marginBottom: '20px' }}>
                <div style={{ fontSize: '14px', color: '#999999', marginBottom: '4px' }}>Ingresá con:</div>
                <div style={{ fontSize: '18px', fontWeight: 600, color: '#C8A97E' }}>{ownerEmail}</div>
              </div>
              <div>
                <div style={{ fontSize: '14px', color: '#999999', marginBottom: '4px' }}>Tu URL personalizada:</div>
                <div style={{ fontSize: '16px', color: '#ffffff' }}>
                  barberos-app.netlify.app/login?tenant={slug}
                </div>
              </div>
            </div>

            {/* Actions */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <button
                onClick={() => navigate(`/login?tenant=${slug}`)}
                style={{ width: '100%', padding: '16px', background: '#C8A97E', color: '#1a1a1a', fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: '16px', borderRadius: '8px', border: 'none', cursor: 'pointer', transition: 'all 0.2s', height: '52px' }}
              >
                Ir al login →
              </button>
              <button
                onClick={() => navigate('/')}
                style={{ width: '100%', padding: '16px', background: 'transparent', color: '#999999', fontFamily: 'Syne, sans-serif', fontWeight: 600, fontSize: '14px', borderRadius: '8px', border: '1px solid #383838', cursor: 'pointer', transition: 'all 0.2s', height: '44px' }}
              >
                Volver al inicio
              </button>
            </div>

            {/* Footer */}
            <div style={{ marginTop: '32px', paddingTop: '24px', borderTop: '1px solid #383838' }}>
              <p style={{ fontSize: '14px', color: '#555555', textAlign: 'center' }}>
                <span style={{ color: '#C8A97E' }}>BARBEROS Luxury Edition</span> • Onboarding automático
              </p>
            </div>
          </div>

          {/* Footer note */}
          <div style={{ marginTop: '24px', textAlign: 'center' }}>
            <p style={{ color: '#555555', fontSize: '14px' }}>
              © {new Date().getFullYear()} BARBEROS • Sistema de gestión profesional
            </p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#1a1a1a', padding: '20px', position: 'relative', overflow: 'hidden' }}>
      {/* Decorative barber pole background */}
      <div style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', opacity: 0.06, pointerEvents: 'none', zIndex: 0 }}>
        <img src="/barber-pole.svg" alt="" style={{ height: '384px' }} />
      </div>

      {/* Animated gradient orbs */}
      <div style={{ position: 'fixed', top: 0, left: 0, width: '384px', height: '384px', background: 'rgba(200, 169, 126, 0.05)', borderRadius: '9999px', filter: 'blur(48px)', transform: 'translate(-50%, -50%)' }} />
      <div style={{ position: 'fixed', bottom: 0, right: 0, width: '384px', height: '384px', background: 'rgba(200, 169, 126, 0.05)', borderRadius: '9999px', filter: 'blur(48px)', transform: 'translate(33%, 33%)' }} />

      <div style={{ width: 'min(90vw, 500px)', maxWidth: '500px', position: 'relative', zIndex: 10 }}>
        <div style={{ background: '#242424', border: '1px solid #383838', borderRadius: '16px', boxShadow: '0 20px 60px rgba(0,0,0,0.5)', padding: '40px' }}>
          {/* Logo and header */}
          <div style={{ marginBottom: '32px', textAlign: 'center' }}>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '24px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <ScissorsIcon />
                <span style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: '24px', letterSpacing: '2px', color: '#fff' }}>
                  BARBER<span style={{ color: '#C8A97E' }}>OS</span>
                </span>
              </div>
            </div>
            <h1 style={{ fontSize: '28px', fontFamily: 'Syne, sans-serif', fontWeight: 700, color: '#ffffff', marginBottom: '8px' }}>
              Registrá tu barbería
            </h1>
            <p style={{ color: '#999999' }}>Empezá gratis hoy</p>
          </div>

          {/* Step indicator */}
          <div style={{ display: 'flex', justifyContent: 'center', gap: '12px', marginBottom: '32px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{ width: '24px', height: '24px', borderRadius: '9999px', background: step === 'barberia' ? '#C8A97E' : '#383838', color: step === 'barberia' ? '#1a1a1a' : '#555555', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: 700 }}>
                1
              </div>
              <span style={{ color: step === 'barberia' ? '#ffffff' : '#555555', fontSize: '14px' }}>Tu barbería</span>
            </div>
            <div style={{ width: '40px', height: '1px', background: '#383838', alignSelf: 'center' }} />
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{ width: '24px', height: '24px', borderRadius: '9999px', background: step === 'owner' ? '#C8A97E' : '#383838', color: step === 'owner' ? '#1a1a1a' : '#555555', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: 700 }}>
                2
              </div>
              <span style={{ color: step === 'owner' ? '#ffffff' : '#555555', fontSize: '14px' }}>Tu cuenta</span>
            </div>
          </div>

          <form onSubmit={handleSubmit}>
            {/* Step 1: Barbería */}
            {step === 'barberia' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                <div>
                  <label htmlFor="barberiaName" style={{ display: 'block', fontSize: '14px', fontWeight: 500, color: '#999999', marginBottom: '12px' }}>
                    Nombre de la barbería *
                  </label>
                  <input
                    id="barberiaName"
                    type="text"
                    value={barberiaName}
                    onChange={(e) => setBarberiaName(e.target.value)}
                    style={{ width: '100%', padding: '14px 16px', background: '#2a2a2a', border: '1px solid #383838', borderRadius: '8px', color: '#ffffff', fontSize: '16px', outline: 'none', transition: 'all 0.2s', height: '48px' }}
                    placeholder="Ej: Barbería Elegante"
                    required
                    disabled={isLoading}
                    onFocus={(e) => e.target.style.borderColor = '#C8A97E'}
                    onBlur={(e) => e.target.style.borderColor = '#383838'}
                  />
                </div>

                <div>
                  <label htmlFor="slug" style={{ display: 'block', fontSize: '14px', fontWeight: 500, color: '#999999', marginBottom: '12px' }}>
                    Slug / URL *
                  </label>
                  <input
                    id="slug"
                    type="text"
                    value={slug}
                    onChange={(e) => setSlug(e.target.value)}
                    style={{ width: '100%', padding: '14px 16px', background: '#2a2a2a', border: '1px solid #383838', borderRadius: '8px', color: '#ffffff', fontSize: '16px', outline: 'none', transition: 'all 0.2s', height: '48px' }}
                    placeholder="barberia-elegante"
                    required
                    disabled={isLoading}
                    onFocus={(e) => e.target.style.borderColor = '#C8A97E'}
                    onBlur={(e) => e.target.style.borderColor = '#383838'}
                  />
                  <div style={{ marginTop: '8px', fontSize: '12px', color: '#555555' }}>
                    Solo letras minúsculas, números y guiones. Tu URL será:{' '}
                    <span style={{ color: '#C8A97E' }}>barberos-app.netlify.app/login?tenant={slug || 'tu-slug'}</span>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                  <div>
                    <label htmlFor="primaryColor" style={{ display: 'block', fontSize: '14px', fontWeight: 500, color: '#999999', marginBottom: '12px' }}>
                      Color primario
                    </label>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <input
                        id="primaryColor"
                        type="color"
                        value={primaryColor}
                        onChange={(e) => setPrimaryColor(e.target.value)}
                        style={{ width: '48px', height: '48px', padding: '0', border: 'none', borderRadius: '8px', cursor: 'pointer' }}
                      />
                      <span style={{ color: '#ffffff', fontSize: '14px' }}>{primaryColor}</span>
                    </div>
                  </div>
                  <div>
                    <label htmlFor="secondaryColor" style={{ display: 'block', fontSize: '14px', fontWeight: 500, color: '#999999', marginBottom: '12px' }}>
                      Color secundario
                    </label>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <input
                        id="secondaryColor"
                        type="color"
                        value={secondaryColor}
                        onChange={(e) => setSecondaryColor(e.target.value)}
                        style={{ width: '48px', height: '48px', padding: '0', border: 'none', borderRadius: '8px', cursor: 'pointer' }}
                      />
                      <span style={{ color: '#ffffff', fontSize: '14px' }}>{secondaryColor}</span>
                    </div>
                  </div>
                </div>

                {error && (
                  <div style={{ padding: '16px', background: '#2a2a2a', border: '1px solid #383838', borderRadius: '12px' }}>
                    <p style={{ color: '#e94560', fontSize: '14px', fontWeight: 500 }}>{error}</p>
                  </div>
                )}

                <button
                  type="button"
                  onClick={handleNextStep}
                  disabled={isLoading}
                  style={{ width: '100%', padding: '14px', background: '#C8A97E', color: '#1a1a1a', fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: '16px', borderRadius: '8px', border: 'none', cursor: isLoading ? 'not-allowed' : 'pointer', opacity: isLoading ? 0.5 : 1, transition: 'all 0.2s', height: '52px' }}
                >
                  Siguiente →
                </button>
              </div>
            )}

            {/* Step 2: Owner */}
            {step === 'owner' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                <div>
                  <label htmlFor="ownerName" style={{ display: 'block', fontSize: '14px', fontWeight: 500, color: '#999999', marginBottom: '12px' }}>
                    Tu nombre completo *
                  </label>
                  <input
                    id="ownerName"
                    type="text"
                    value={ownerName}
                    onChange={(e) => setOwnerName(e.target.value)}
                    style={{ width: '100%', padding: '14px 16px', background: '#2a2a2a', border: '1px solid #383838', borderRadius: '8px', color: '#ffffff', fontSize: '16px', outline: 'none', transition: 'all 0.2s', height: '48px' }}
                    placeholder="Ej: Juan Pérez"
                    required
                    disabled={isLoading}
                    onFocus={(e) => e.target.style.borderColor = '#C8A97E'}
                    onBlur={(e) => e.target.style.borderColor = '#383838'}
                  />
                </div>

                <div>
                  <label htmlFor="ownerEmail" style={{ display: 'block', fontSize: '14px', fontWeight: 500, color: '#999999', marginBottom: '12px' }}>
                    Email *
                  </label>
                  <input
                    id="ownerEmail"
                    type="email"
                    value={ownerEmail}
                    onChange={(e) => setOwnerEmail(e.target.value)}
                    style={{ width: '100%', padding: '14px 16px', background: '#2a2a2a', border: '1px solid #383838', borderRadius: '8px', color: '#ffffff', fontSize: '16px', outline: 'none', transition: 'all 0.2s', height: '48px' }}
                    placeholder="tu@email.com"
                    required
                    disabled={isLoading}
                    onFocus={(e) => e.target.style.borderColor = '#C8A97E'}
                    onBlur={(e) => e.target.style.borderColor = '#383838'}
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                  <div>
                    <label htmlFor="ownerPassword" style={{ display: 'block', fontSize: '14px', fontWeight: 500, color: '#999999', marginBottom: '12px' }}>
                      Contraseña *
                    </label>
                    <input
                      id="ownerPassword"
                      type="password"
                      value={ownerPassword}
                      onChange={(e) => setOwnerPassword(e.target.value)}
                      style={{ width: '100%', padding: '14px 16px', background: '#2a2a2a', border: '1px solid #383838', borderRadius: '8px', color: '#ffffff', fontSize: '16px', outline: 'none', transition: 'all 0.2s', height: '48px' }}
                      placeholder="••••••••"
                      required
                      disabled={isLoading}
                      onFocus={(e) => e.target.style.borderColor = '#C8A97E'}
                      onBlur={(e) => e.target.style.borderColor = '#383838'}
                    />
                    <div style={{ marginTop: '8px', fontSize: '12px', color: '#555555' }}>Mínimo 8 caracteres</div>
                  </div>
                  <div>
                    <label htmlFor="ownerPasswordConfirm" style={{ display: 'block', fontSize: '14px', fontWeight: 500, color: '#999999', marginBottom: '12px' }}>
                      Confirmar contraseña *
                    </label>
                    <input
                      id="ownerPasswordConfirm"
                      type="password"
                      value={ownerPasswordConfirm}
                      onChange={(e) => setOwnerPasswordConfirm(e.target.value)}
                      style={{ width: '100%', padding: '14px 16px', background: '#2a2a2a', border: '1px solid #383838', borderRadius: '8px', color: '#ffffff', fontSize: '16px', outline: 'none', transition: 'all 0.2s', height: '48px' }}
                      placeholder="••••••••"
                      required
                      disabled={isLoading}
                      onFocus={(e) => e.target.style.borderColor = '#C8A97E'}
                      onBlur={(e) => e.target.style.borderColor = '#383838'}
                    />
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                  <input
                    id="acceptTerms"
                    type="checkbox"
                    checked={acceptTerms}
                    onChange={(e) => setAcceptTerms(e.target.checked)}
                    style={{ width: '20px', height: '20px', marginTop: '2px' }}
                    disabled={isLoading}
                  />
                  <label htmlFor="acceptTerms" style={{ fontSize: '14px', color: '#999999', lineHeight: '1.5' }}>
                    Acepto los{' '}
                    <a href="/terminos" style={{ color: '#C8A97E', textDecoration: 'none' }} target="_blank" rel="noopener noreferrer">
                      términos de uso
                    </a>{' '}
                    y{' '}
                    <a href="/privacidad" style={{ color: '#C8A97E', textDecoration: 'none' }} target="_blank" rel="noopener noreferrer">
                      política de privacidad
                    </a>
                  </label>
                </div>

                {error && (
                  <div style={{ padding: '16px', background: '#2a2a2a', border: '1px solid #383838', borderRadius: '12px' }}>
                    <p style={{ color: '#e94560', fontSize: '14px', fontWeight: 500 }}>{error}</p>
                  </div>
                )}

                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <button
                    type="submit"
                    disabled={isLoading || !acceptTerms}
                    style={{ width: '100%', padding: '14px', background: '#C8A97E', color: '#1a1a1a', fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: '16px', borderRadius: '8px', border: 'none', cursor: isLoading ? 'not-allowed' : 'pointer', opacity: isLoading || !acceptTerms ? 0.5 : 1, transition: 'all 0.2s', height: '52px' }}
                  >
                    {isLoading ? (
                      <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                        <div style={{ width: '20px', height: '20px', border: '2px solid #1a1a1a', borderTopColor: 'transparent', borderRadius: '9999px', animation: 'spin 1s linear infinite' }} />
                        Creando barbería...
                      </span>
                    ) : (
                      'Crear mi barbería'
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={handlePrevStep}
                    disabled={isLoading}
                    style={{ width: '100%', padding: '14px', background: 'transparent', color: '#999999', fontFamily: 'Syne, sans-serif', fontWeight: 600, fontSize: '14px', borderRadius: '8px', border: '1px solid #383838', cursor: 'pointer', transition: 'all 0.2s', height: '44px' }}
                  >
                    ← Atrás
                  </button>
                </div>
              </div>
            )}
          </form>

          {/* Footer */}
          <div style={{ marginTop: '32px', paddingTop: '24px', borderTop: '1px solid #383838', textAlign: 'center' }}>
            <p style={{ fontSize: '14px', color: '#555555' }}>
              ¿Ya tenés una barbería?{' '}
              <a href="/login" style={{ color: '#C8A97E', textDecoration: 'none', fontWeight: 600 }}>Ingresá</a>
            </p>
          </div>
        </div>

        {/* Footer note */}
        <div style={{ marginTop: '24px', textAlign: 'center' }}>
          <p style={{ color: '#555555', fontSize: '14px' }}>
            © {new Date().getFullYear()} BARBEROS • Sistema de gestión profesional
          </p>
        </div>
      </div>
    </div>
  )
}