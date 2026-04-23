import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'

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
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#F4F5F7', padding: '20px' }}>
        <div style={{ width: 'min(90vw, 500px)', maxWidth: '500px' }}>
          <div style={{ background: '#fff', border: '0.5px solid #e0e0e0', borderRadius: '12px', boxShadow: '0 4px 24px rgba(0,0,0,0.06)', padding: '40px', textAlign: 'center' }}>
            <div style={{ marginBottom: '32px' }}>
              <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '24px' }}>
                <span style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: '20px', color: '#1E2A3A' }}>
                  Aliada Barberías
                </span>
              </div>
              <h1 style={{ fontSize: '32px', fontFamily: 'Syne, sans-serif', fontWeight: 700, color: '#1E2A3A', marginBottom: '16px' }}>
                ¡Tu barbería está lista!
              </h1>
              <p style={{ color: '#aaa', fontSize: '18px', marginBottom: '32px' }}>
                Ya podés comenzar a gestionar tu negocio.
              </p>
            </div>

            <div style={{ background: '#f8f8f8', border: '0.5px solid #e0e0e0', borderRadius: '12px', padding: '24px', marginBottom: '32px', textAlign: 'left' }}>
              <div style={{ marginBottom: '20px' }}>
                <div style={{ fontSize: '14px', color: '#aaa', marginBottom: '4px' }}>Ingresá con:</div>
                <div style={{ fontSize: '18px', fontWeight: 600, color: '#1E2A3A' }}>{ownerEmail}</div>
              </div>
              <div>
                <div style={{ fontSize: '14px', color: '#aaa', marginBottom: '4px' }}>Tu URL personalizada:</div>
                <div style={{ fontSize: '16px', color: '#1a1a2e' }}>
                  barberos-app.netlify.app/login?tenant={slug}
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <button
                onClick={() => navigate(`/login?tenant=${slug}`)}
                style={{ width: '100%', padding: '16px', background: '#1E2A3A', color: '#fff', fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: '16px', borderRadius: '8px', border: 'none', cursor: 'pointer', transition: 'all 0.2s', height: '52px' }}
              >
                Ir al login →
              </button>
              <button
                onClick={() => navigate('/')}
                style={{ width: '100%', padding: '16px', background: 'transparent', color: '#aaa', fontFamily: 'Syne, sans-serif', fontWeight: 600, fontSize: '14px', borderRadius: '8px', border: '0.5px solid #e0e0e0', cursor: 'pointer', transition: 'all 0.2s', height: '44px' }}
              >
                Volver al inicio
              </button>
            </div>
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

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#F4F5F7', padding: '20px' }}>
      <div style={{ width: 'min(90vw, 500px)', maxWidth: '500px' }}>
        <div style={{ background: '#fff', border: '0.5px solid #e0e0e0', borderRadius: '12px', boxShadow: '0 4px 24px rgba(0,0,0,0.06)', padding: '40px' }}>
          <div style={{ marginBottom: '32px', textAlign: 'center' }}>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '24px' }}>
              <span style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: '20px', color: '#1E2A3A' }}>
                Aliada Barberías
              </span>
            </div>
            <h1 style={{ fontSize: '28px', fontFamily: 'Syne, sans-serif', fontWeight: 700, color: '#1E2A3A', marginBottom: '8px' }}>
              Registrá tu barbería
            </h1>
            <p style={{ color: '#aaa' }}>Empezá gratis hoy</p>
          </div>

          {/* Step indicator */}
          <div style={{ display: 'flex', justifyContent: 'center', gap: '12px', marginBottom: '32px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{ width: '24px', height: '24px', borderRadius: '9999px', background: step === 'barberia' ? '#1E2A3A' : '#e0e0e0', color: step === 'barberia' ? '#fff' : '#aaa', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: 700 }}>
                1
              </div>
              <span style={{ color: step === 'barberia' ? '#1E2A3A' : '#aaa', fontSize: '14px' }}>Tu barbería</span>
            </div>
            <div style={{ width: '40px', height: '1px', background: '#e0e0e0', alignSelf: 'center' }} />
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{ width: '24px', height: '24px', borderRadius: '9999px', background: step === 'owner' ? '#1E2A3A' : '#e0e0e0', color: step === 'owner' ? '#fff' : '#aaa', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: 700 }}>
                2
              </div>
              <span style={{ color: step === 'owner' ? '#1E2A3A' : '#aaa', fontSize: '14px' }}>Tu cuenta</span>
            </div>
          </div>

          <form onSubmit={handleSubmit}>
            {/* Step 1: Barbería */}
            {step === 'barberia' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                <div>
                  <label htmlFor="barberiaName" style={{ display: 'block', fontSize: '14px', fontWeight: 500, color: '#aaa', marginBottom: '12px' }}>
                    Nombre de la barbería *
                  </label>
                  <input
                    id="barberiaName"
                    type="text"
                    value={barberiaName}
                    onChange={(e) => setBarberiaName(e.target.value)}
                    style={{ width: '100%', padding: '14px 16px', background: '#f8f8f8', border: '0.5px solid #e0e0e0', borderRadius: '8px', color: '#1a1a2e', fontSize: '16px', outline: 'none', transition: 'all 0.2s', height: '48px' }}
                    placeholder="Ej: Barbería Elegante"
                    required
                    disabled={isLoading}
                    onFocus={(e) => e.target.style.borderColor = '#1E2A3A'}
                    onBlur={(e) => e.target.style.borderColor = '#e0e0e0'}
                  />
                </div>

                <div>
                  <label htmlFor="slug" style={{ display: 'block', fontSize: '14px', fontWeight: 500, color: '#aaa', marginBottom: '12px' }}>
                    Slug / URL *
                  </label>
                  <input
                    id="slug"
                    type="text"
                    value={slug}
                    onChange={(e) => setSlug(e.target.value)}
                    style={{ width: '100%', padding: '14px 16px', background: '#f8f8f8', border: '0.5px solid #e0e0e0', borderRadius: '8px', color: '#1a1a2e', fontSize: '16px', outline: 'none', transition: 'all 0.2s', height: '48px' }}
                    placeholder="barberia-elegante"
                    required
                    disabled={isLoading}
                    onFocus={(e) => e.target.style.borderColor = '#1E2A3A'}
                    onBlur={(e) => e.target.style.borderColor = '#e0e0e0'}
                  />
                  <div style={{ marginTop: '8px', fontSize: '12px', color: '#aaa' }}>
                    Solo letras minúsculas, números y guiones. Tu URL será:{' '}
                    <span style={{ color: '#1E2A3A' }}>barberos-app.netlify.app/login?tenant={slug || 'tu-slug'}</span>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                  <div>
                    <label htmlFor="primaryColor" style={{ display: 'block', fontSize: '14px', fontWeight: 500, color: '#aaa', marginBottom: '12px' }}>
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
                      <span style={{ color: '#1a1a2e', fontSize: '14px' }}>{primaryColor}</span>
                    </div>
                  </div>
                  <div>
                    <label htmlFor="secondaryColor" style={{ display: 'block', fontSize: '14px', fontWeight: 500, color: '#aaa', marginBottom: '12px' }}>
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
                      <span style={{ color: '#1a1a2e', fontSize: '14px' }}>{secondaryColor}</span>
                    </div>
                  </div>
                </div>

                {error && (
                  <div style={{ padding: '16px', background: '#fff5f5', border: '0.5px solid #ffcccc', borderRadius: '12px' }}>
                    <p style={{ color: '#cc3333', fontSize: '14px', fontWeight: 500 }}>{error}</p>
                  </div>
                )}

                <button
                  type="button"
                  onClick={handleNextStep}
                  disabled={isLoading}
                  style={{ width: '100%', padding: '14px', background: '#1E2A3A', color: '#fff', fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: '16px', borderRadius: '8px', border: 'none', cursor: isLoading ? 'not-allowed' : 'pointer', opacity: isLoading ? 0.5 : 1, transition: 'all 0.2s', height: '52px' }}
                >
                  Siguiente →
                </button>
              </div>
            )}

            {/* Step 2: Owner */}
            {step === 'owner' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                <div>
                  <label htmlFor="ownerName" style={{ display: 'block', fontSize: '14px', fontWeight: 500, color: '#aaa', marginBottom: '12px' }}>
                    Tu nombre completo *
                  </label>
                  <input
                    id="ownerName"
                    type="text"
                    value={ownerName}
                    onChange={(e) => setOwnerName(e.target.value)}
                    style={{ width: '100%', padding: '14px 16px', background: '#f8f8f8', border: '0.5px solid #e0e0e0', borderRadius: '8px', color: '#1a1a2e', fontSize: '16px', outline: 'none', transition: 'all 0.2s', height: '48px' }}
                    placeholder="Ej: Juan Pérez"
                    required
                    disabled={isLoading}
                    onFocus={(e) => e.target.style.borderColor = '#1E2A3A'}
                    onBlur={(e) => e.target.style.borderColor = '#e0e0e0'}
                  />
                </div>

                <div>
                  <label htmlFor="ownerEmail" style={{ display: 'block', fontSize: '14px', fontWeight: 500, color: '#aaa', marginBottom: '12px' }}>
                    Email *
                  </label>
                  <input
                    id="ownerEmail"
                    type="email"
                    value={ownerEmail}
                    onChange={(e) => setOwnerEmail(e.target.value)}
                    style={{ width: '100%', padding: '14px 16px', background: '#f8f8f8', border: '0.5px solid #e0e0e0', borderRadius: '8px', color: '#1a1a2e', fontSize: '16px', outline: 'none', transition: 'all 0.2s', height: '48px' }}
                    placeholder="tu@email.com"
                    required
                    disabled={isLoading}
                    onFocus={(e) => e.target.style.borderColor = '#1E2A3A'}
                    onBlur={(e) => e.target.style.borderColor = '#e0e0e0'}
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                  <div>
                    <label htmlFor="ownerPassword" style={{ display: 'block', fontSize: '14px', fontWeight: 500, color: '#aaa', marginBottom: '12px' }}>
                      Contraseña *
                    </label>
                    <input
                      id="ownerPassword"
                      type="password"
                      value={ownerPassword}
                      onChange={(e) => setOwnerPassword(e.target.value)}
                      style={{ width: '100%', padding: '14px 16px', background: '#f8f8f8', border: '0.5px solid #e0e0e0', borderRadius: '8px', color: '#1a1a2e', fontSize: '16px', outline: 'none', transition: 'all 0.2s', height: '48px' }}
                      placeholder="••••••••"
                      required
                      disabled={isLoading}
                      onFocus={(e) => e.target.style.borderColor = '#1E2A3A'}
                      onBlur={(e) => e.target.style.borderColor = '#e0e0e0'}
                    />
                    <div style={{ marginTop: '8px', fontSize: '12px', color: '#aaa' }}>Mínimo 8 caracteres</div>
                  </div>
                  <div>
                    <label htmlFor="ownerPasswordConfirm" style={{ display: 'block', fontSize: '14px', fontWeight: 500, color: '#aaa', marginBottom: '12px' }}>
                      Confirmar contraseña *
                    </label>
                    <input
                      id="ownerPasswordConfirm"
                      type="password"
                      value={ownerPasswordConfirm}
                      onChange={(e) => setOwnerPasswordConfirm(e.target.value)}
                      style={{ width: '100%', padding: '14px 16px', background: '#f8f8f8', border: '0.5px solid #e0e0e0', borderRadius: '8px', color: '#1a1a2e', fontSize: '16px', outline: 'none', transition: 'all 0.2s', height: '48px' }}
                      placeholder="••••••••"
                      required
                      disabled={isLoading}
                      onFocus={(e) => e.target.style.borderColor = '#1E2A3A'}
                      onBlur={(e) => e.target.style.borderColor = '#e0e0e0'}
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
                  <label htmlFor="acceptTerms" style={{ fontSize: '14px', color: '#aaa', lineHeight: '1.5' }}>
                    Acepto los{' '}
                    <a href="/terminos" style={{ color: '#1E2A3A', textDecoration: 'none' }} target="_blank" rel="noopener noreferrer">
                      términos de uso
                    </a>{' '}
                    y{' '}
                    <a href="/privacidad" style={{ color: '#1E2A3A', textDecoration: 'none' }} target="_blank" rel="noopener noreferrer">
                      política de privacidad
                    </a>
                  </label>
                </div>

                {error && (
                  <div style={{ padding: '16px', background: '#fff5f5', border: '0.5px solid #ffcccc', borderRadius: '12px' }}>
                    <p style={{ color: '#cc3333', fontSize: '14px', fontWeight: 500 }}>{error}</p>
                  </div>
                )}

                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <button
                    type="submit"
                    disabled={isLoading || !acceptTerms}
                    style={{ width: '100%', padding: '14px', background: '#1E2A3A', color: '#fff', fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: '16px', borderRadius: '8px', border: 'none', cursor: isLoading ? 'not-allowed' : 'pointer', opacity: isLoading || !acceptTerms ? 0.5 : 1, transition: 'all 0.2s', height: '52px' }}
                  >
                    {isLoading ? (
                      <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                        <div style={{ width: '20px', height: '20px', border: '2px solid #fff', borderTopColor: 'transparent', borderRadius: '9999px', animation: 'spin 1s linear infinite' }} />
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
                    style={{ width: '100%', padding: '14px', background: 'transparent', color: '#aaa', fontFamily: 'Syne, sans-serif', fontWeight: 600, fontSize: '14px', borderRadius: '8px', border: '0.5px solid #e0e0e0', cursor: 'pointer', transition: 'all 0.2s', height: '44px' }}
                  >
                    ← Atrás
                  </button>
                </div>
              </div>
            )}
          </form>

          <div style={{ marginTop: '32px', paddingTop: '24px', borderTop: '0.5px solid #e0e0e0', textAlign: 'center' }}>
            <p style={{ fontSize: '14px', color: '#aaa' }}>
              ¿Ya tenés una barbería?{' '}
              <a href="/login" style={{ color: '#1E2A3A', textDecoration: 'none', fontWeight: 600 }}>Ingresá</a>
            </p>
          </div>
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
