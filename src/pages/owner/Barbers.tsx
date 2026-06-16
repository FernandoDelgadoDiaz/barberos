import { useState, useEffect, useCallback } from 'react'
import { useTenantStore } from '../../stores/tenantStore'
import { supabase } from '../../config/supabase'
import type { Profile } from '../../types'

// =============================================================================
// Palette — slate + blue (consistent with LivePanel / Metrics / History)
// =============================================================================
const C = {
  ink: '#0F172A',
  slate600: '#475569',
  slate500: '#64748B',
  slate400: '#94A3B8',
  border: '#E2E8F0',
  borderLt: '#F1F5F9',
  blue: '#2563EB',
  blueBright: '#3B82F6',
  blueLt: '#DBEAFE',
  blueBg: '#EFF6FF',
  green: '#059669',
  greenBg: '#D1FAE5',
  greenDot: '#10B981',
  red: '#DC2626',
} as const

// Deterministic avatar color — SAME hash + palette as the avatars in
// ExpandableBarberCard (used by LivePanel) and History, replicated locally
// because the scope only allows editing Barbers.tsx. Hashes on `id || name`.
const AVATAR_PALETTE = [
  '#2563EB', // blue
  '#14B8A6', // teal
  '#F97316', // orange
  '#7C3AED', // purple
  '#DC2626', // red
  '#D97706', // amber
] as const

function hashIndex(input: string, mod: number): number {
  let h = 0
  for (let i = 0; i < input.length; i++) {
    h = (h * 31 + input.charCodeAt(i)) | 0
  }
  return Math.abs(h) % mod
}

function getAvatarColor(id: string, name: string): string {
  return AVATAR_PALETTE[hashIndex(id || name, AVATAR_PALETTE.length)]
}

async function getAuthHeader(): Promise<string> {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) {
    const { data: { session: refreshed } } = await supabase.auth.refreshSession()
    if (!refreshed?.access_token) throw new Error('No session')
    return `Bearer ${refreshed.access_token}`
  }
  return `Bearer ${session.access_token}`
}

interface Barber extends Profile {
  avatar_color: string
}

export function Barbers() {
  const { tenant, profile } = useTenantStore()
  const tenantId = tenant?.id || profile?.tenant_id
  const [barbers, setBarbers] = useState<Barber[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showModal, setShowModal] = useState(false)
  const [editingBarber, setEditingBarber] = useState<Barber | null>(null)
  const [modalLoading, setModalLoading] = useState(false)
  const [modalError, setModalError] = useState<string | null>(null)
  const [displayName, setDisplayName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [openMenuId, setOpenMenuId] = useState<string | null>(null)

  const loadBarbers = useCallback(async () => {
    setError(null)
    if (!tenantId) {
      setError('No se pudo identificar la barbería (tenantId missing).')
      setLoading(false)
      return
    }
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('tenant_id', tenantId)
        .eq('role', 'barber')
        .order('display_name')
      if (error) throw error
      const barbersWithColor: Barber[] = (data || []).map(profile => ({
        ...profile,
        is_active: profile.is_active ?? false,
        avatar_color: profile.id.charCodeAt(0) % 2 === 0 ? 'gold' : 'purple'
      }))
      setBarbers(barbersWithColor)
    } catch (error) {
      console.error('Error loading barbers:', error)
      setError('Error al cargar la lista de barberos. Verifica la conexión e inténtalo nuevamente.')
    } finally {
      setLoading(false)
    }
  }, [tenantId])

  useEffect(() => {
    if (!tenantId) {
      const retryId = setTimeout(() => { loadBarbers() }, 500)
      return () => clearTimeout(retryId)
    }
    loadBarbers()
  }, [loadBarbers, tenantId])

  // Close kebab menu on any outside click
  useEffect(() => {
    if (!openMenuId) return
    const close = () => setOpenMenuId(null)
    window.addEventListener('click', close)
    return () => window.removeEventListener('click', close)
  }, [openMenuId])

  const handleToggleActive = async (id: string) => {
    const barber = barbers.find(b => b.id === id)
    if (!barber || !tenantId) return
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ is_active: !barber.is_active })
        .eq('id', id)
        .eq('tenant_id', tenantId)
      if (error) throw error
      setBarbers(barbers.map(b => b.id === id ? { ...b, is_active: !b.is_active } : b))
    } catch (error) {
      console.error('Error updating barber status:', error)
    }
  }

  const handleEdit = (barber: Barber) => {
    setEditingBarber(barber)
    setDisplayName(barber.display_name)
    setEmail('')
    setPassword('')
    setModalError(null)
    setShowModal(true)
  }

  const handleAdd = () => {
    setEditingBarber(null)
    setDisplayName('')
    setEmail('')
    setPassword('')
    setModalError(null)
    setShowModal(true)
  }

  const handleCreateBarber = async () => {
    if (!tenantId) {
      setModalError('No se pudo identificar la barbería.')
      return
    }
    if (!displayName.trim()) {
      setModalError('El nombre es obligatorio.')
      return
    }
    if (!editingBarber) {
      if (!email.trim()) {
        setModalError('El email es obligatorio.')
        return
      }
      if (!password.trim()) {
        setModalError('La contraseña es obligatoria.')
        return
      }
    }
    setModalLoading(true)
    setModalError(null)
    try {
      if (editingBarber) {
        const { error } = await supabase
          .from('profiles')
          .update({ display_name: displayName.trim() })
          .eq('id', editingBarber.id)
          .eq('tenant_id', tenantId)
        if (error) throw error
        setBarbers(barbers.map(b => b.id === editingBarber.id ? { ...b, display_name: displayName.trim() } : b))
        setShowModal(false)
      } else {
        const authHeader = await getAuthHeader()
        const response = await fetch('/api/create-barber', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': authHeader },
          body: JSON.stringify({
            display_name: displayName.trim(),
            email: email.trim(),
            password: password.trim(),
            tenant_id: tenantId,
          }),
        })
        const data = await response.json()
        if (!response.ok) {
          throw new Error(data.error || 'Error desconocido al crear barbero')
        }
        const newBarber: Barber = {
          id: data.profile_id,
          tenant_id: tenantId,
          user_id: data.user_id,
          role: 'barber',
          display_name: displayName.trim(),
          is_active: true,
          avatar_color: data.profile_id.charCodeAt(0) % 2 === 0 ? 'gold' : 'purple',
          created_at: data.created_at,
        }
        setBarbers([...barbers, newBarber])
        setShowModal(false)
      }
    } catch (error: unknown) {
      console.error('Error saving barber:', error)
      setModalError(error instanceof Error ? error.message : 'Error desconocido')
    } finally {
      setModalLoading(false)
    }
  }

  const getInitials = (name: string) => {
    return (name.trim()[0] || '?').toUpperCase()
  }

  // ---------------------------------------------------------------------------
  // Loading / Error
  // ---------------------------------------------------------------------------
  if (loading) {
    return (
      <div
        style={{
          maxWidth: '430px',
          margin: '0 auto',
          padding: '60px 16px',
          textAlign: 'center',
          color: C.slate400,
          fontSize: '14px',
          fontFamily: 'Space Grotesk, sans-serif',
        }}
      >
        Cargando barberos...
      </div>
    )
  }

  if (error) {
    return (
      <div style={rootStyle}>
        <ScreenHeader />
        <div
          style={{
            background: '#FEF2F2',
            border: '1px solid #FECACA',
            borderRadius: '16px',
            padding: '20px',
            color: C.red,
            fontFamily: 'Space Grotesk, sans-serif',
            marginTop: '20px',
          }}
        >
          <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '8px', fontFamily: 'Syne, sans-serif' }}>
            Error al cargar barberos
          </h3>
          <p style={{ fontSize: '14px', lineHeight: 1.4 }}>{error}</p>
          <button
            onClick={() => loadBarbers()}
            style={{
              background: C.blue,
              color: '#fff',
              border: 'none',
              borderRadius: '10px',
              padding: '10px 18px',
              fontFamily: 'Space Grotesk, sans-serif',
              fontWeight: 600,
              fontSize: '13px',
              cursor: 'pointer',
              marginTop: '16px',
            }}
          >
            Reintentar
          </button>
        </div>
        <div style={{ height: '110px' }} />
      </div>
    )
  }

  // ---------------------------------------------------------------------------
  // Main
  // ---------------------------------------------------------------------------
  const activeCount = barbers.filter(b => b.is_active).length
  const totalCount = barbers.length

  return (
    <div style={rootStyle}>
      <ScreenHeader />

      {/* Stat cards */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(2, 1fr)',
          gap: '12px',
          marginTop: '20px',
        }}
      >
        <StatCard
          label="Activos"
          count={activeCount}
          chipBg={C.greenBg}
          iconStroke={C.green}
          icon={<UsersIcon />}
        />
        <StatCard
          label="Total"
          count={totalCount}
          chipBg="#EDE9FE"
          iconStroke="#7C3AED"
          icon={<UserIcon />}
        />
      </div>

      {/* CTA card */}
      <button onClick={handleAdd} style={ctaCardStyle}>
        <div
          style={{
            width: 48,
            height: 48,
            borderRadius: 12,
            background: 'rgba(255,255,255,0.95)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={C.blue} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 5v14M5 12h14" />
          </svg>
        </div>
        <div style={{ flex: 1, minWidth: 0, textAlign: 'left' }}>
          <div
            style={{
              fontFamily: 'Syne, sans-serif',
              fontWeight: 700,
              fontSize: 'clamp(15px, 4.36vw, 17px)',
              color: '#fff',
              lineHeight: 1.15,
            }}
          >
            Agregar barbero
          </div>
          <div
            style={{
              fontFamily: 'Space Grotesk, sans-serif',
              fontWeight: 400,
              fontSize: 'clamp(12px, 3.33vw, 13px)',
              color: 'rgba(255,255,255,0.85)',
              lineHeight: 1.3,
              marginTop: 2,
            }}
          >
            Crear un nuevo miembro del equipo
          </div>
        </div>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.9, flexShrink: 0 }}>
          <path d="M9 18l6-6-6-6" />
        </svg>
      </button>

      {/* Barber list */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '16px' }}>
        {barbers.map((barber) => {
          const menuOpen = openMenuId === barber.id
          return (
            <div
              key={barber.id}
              style={{
                position: 'relative',
                background: '#fff',
                border: `1px solid ${C.borderLt}`,
                borderRadius: '16px',
                padding: '14px 14px 14px 16px',
                boxShadow: '0 1px 2px rgba(15,23,42,0.04)',
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
              }}
            >
              {/* Avatar + presence dot */}
              <div style={{ position: 'relative', flexShrink: 0 }}>
                <div
                  style={{
                    width: 56,
                    height: 56,
                    borderRadius: '50%',
                    background: getAvatarColor(barber.id, barber.display_name),
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#fff',
                    fontFamily: 'Syne, sans-serif',
                    fontWeight: 700,
                    fontSize: 26,
                    lineHeight: 1,
                    boxShadow: '0 2px 8px rgba(15,23,42,0.10)',
                  }}
                >
                  {getInitials(barber.display_name)}
                </div>
                <span
                  style={{
                    position: 'absolute',
                    bottom: 2,
                    right: 2,
                    width: 14,
                    height: 14,
                    borderRadius: '50%',
                    background: barber.is_active ? '#22C55E' : C.slate400,
                    border: '2.5px solid #fff',
                  }}
                />
              </div>

              {/* Name + role + badge */}
              <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <div
                  style={{
                    fontFamily: 'Syne, sans-serif',
                    fontWeight: 700,
                    fontSize: 'clamp(16px, 4.62vw, 18px)',
                    color: C.ink,
                    lineHeight: 1.2,
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                >
                  {barber.display_name}
                </div>
                <div
                  style={{
                    fontFamily: 'Space Grotesk, sans-serif',
                    fontWeight: 400,
                    fontSize: 'clamp(12px, 3.33vw, 13px)',
                    color: C.slate400,
                    lineHeight: 1.2,
                  }}
                >
                  Barbero
                </div>
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    width: 'fit-content',
                    marginTop: '2px',
                    padding: '4px 10px',
                    borderRadius: '999px',
                    background: barber.is_active ? C.greenBg : C.borderLt,
                    color: barber.is_active ? C.green : C.slate500,
                    fontFamily: 'Space Grotesk, sans-serif',
                    fontWeight: 600,
                    fontSize: 'clamp(11px, 3.08vw, 12px)',
                  }}
                >
                  <span
                    style={{
                      width: 6,
                      height: 6,
                      borderRadius: '50%',
                      background: barber.is_active ? C.greenDot : C.slate400,
                    }}
                  />
                  {barber.is_active ? 'Disponible' : 'No disponible'}
                </span>
              </div>

              {/* Right column: kebab on top, edit below */}
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'flex-end',
                  gap: '8px',
                  flexShrink: 0,
                }}
              >
                <div style={{ position: 'relative' }}>
                  <button
                    aria-label="Más acciones"
                    onClick={(e) => {
                      e.stopPropagation()
                      setOpenMenuId(menuOpen ? null : barber.id)
                    }}
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: 8,
                      background: menuOpen ? C.borderLt : 'transparent',
                      border: 'none',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer',
                      color: C.slate400,
                    }}
                  >
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                      <circle cx="12" cy="5" r="1.6" />
                      <circle cx="12" cy="12" r="1.6" />
                      <circle cx="12" cy="19" r="1.6" />
                    </svg>
                  </button>

                  {menuOpen && (
                    <div
                      onClick={(e) => e.stopPropagation()}
                      style={{
                        position: 'absolute',
                        top: 'calc(100% + 6px)',
                        right: 0,
                        width: 200,
                        background: '#fff',
                        border: `1px solid ${C.border}`,
                        borderRadius: 12,
                        padding: 6,
                        boxShadow: '0 8px 24px rgba(15,23,42,0.12)',
                        zIndex: 50,
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 2,
                      }}
                    >
                      <MenuItem
                        label="Editar"
                        color={C.ink}
                        onClick={() => {
                          setOpenMenuId(null)
                          handleEdit(barber)
                        }}
                        icon={
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M12 20h9" />
                            <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
                          </svg>
                        }
                      />
                      <div style={{ height: 1, background: C.borderLt, margin: '4px 8px' }} />
                      <MenuItem
                        label={barber.is_active ? 'Desactivar' : 'Activar'}
                        color={barber.is_active ? C.red : C.green}
                        onClick={() => {
                          setOpenMenuId(null)
                          handleToggleActive(barber.id)
                        }}
                        icon={
                          barber.is_active ? (
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                              <circle cx="12" cy="12" r="10" />
                              <path d="M4.93 4.93l14.14 14.14" />
                            </svg>
                          ) : (
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M20 6L9 17l-5-5" />
                            </svg>
                          )
                        }
                      />
                    </div>
                  )}
                </div>

                <button
                  onClick={() => handleEdit(barber)}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    background: '#fff',
                    border: `1px solid ${C.border}`,
                    borderRadius: '10px',
                    padding: '8px 12px',
                    cursor: 'pointer',
                    fontFamily: 'Space Grotesk, sans-serif',
                    fontWeight: 600,
                    fontSize: 'clamp(12px, 3.33vw, 13px)',
                    color: C.slate600,
                  }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={C.slate500} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 20h9" />
                    <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
                  </svg>
                  Editar
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={C.slate400} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M9 18l6-6-6-6" />
                  </svg>
                </button>
              </div>
            </div>
          )
        })}
      </div>

      {/* Info card */}
      <div
        style={{
          marginTop: '16px',
          background: C.blueBg,
          border: `1px solid ${C.blueLt}`,
          borderRadius: '16px',
          padding: '14px 16px',
          display: 'flex',
          alignItems: 'flex-start',
          gap: '12px',
        }}
      >
        <div
          style={{
            width: 36,
            height: 36,
            borderRadius: 10,
            background: C.blueLt,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={C.blue} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <path d="M12 16v-4" />
            <path d="M12 8h.01" />
          </svg>
        </div>
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <div
            style={{
              fontFamily: 'Syne, sans-serif',
              fontWeight: 700,
              fontSize: 'clamp(14px, 4.10vw, 16px)',
              color: C.ink,
              lineHeight: 1.2,
            }}
          >
            Información
          </div>
          <div
            style={{
              fontFamily: 'Space Grotesk, sans-serif',
              fontWeight: 400,
              fontSize: 'clamp(12px, 3.33vw, 13px)',
              color: C.slate600,
              lineHeight: 1.4,
            }}
          >
            Los barberos inactivos no aparecerán en las pantallas de operación en tiempo real.
          </div>
        </div>
      </div>

      {/* Spacer to clear the floating bottom-nav */}
      <div style={{ height: '110px' }} />

      {/* Modal Agregar/Editar (preserved) */}
      {showModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(15,23,42,0.45)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: '16px',
        }}>
          <div style={{
            background: '#fff',
            border: `1px solid ${C.border}`,
            borderRadius: '16px',
            padding: '24px',
            width: '100%',
            maxWidth: '420px',
            boxSizing: 'border-box',
          }}>
            <h2 style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: '20px', color: C.ink, marginBottom: '24px' }}>
              {editingBarber ? 'Editar barbero' : 'Agregar barbero'}
            </h2>

            {modalError && (
              <div style={{
                background: '#FEF2F2',
                border: '1px solid #FECACA',
                borderRadius: '8px',
                padding: '12px',
                marginBottom: '20px',
                color: C.red,
                fontFamily: 'Space Grotesk, sans-serif',
                fontSize: '13px',
              }}>
                {modalError}
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={modalLabelStyle}>Nombre para mostrar</label>
                <input
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  style={modalInputStyle}
                />
              </div>

              {!editingBarber && (
                <>
                  <div>
                    <label style={modalLabelStyle}>Email</label>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      style={modalInputStyle}
                    />
                  </div>
                  <div>
                    <label style={modalLabelStyle}>Contraseña</label>
                    <input
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      style={modalInputStyle}
                    />
                  </div>
                </>
              )}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '28px' }}>
              <button
                onClick={() => setShowModal(false)}
                disabled={modalLoading}
                style={{
                  background: 'transparent',
                  border: `1px solid ${C.border}`,
                  borderRadius: '10px',
                  padding: '10px 18px',
                  fontFamily: 'Space Grotesk, sans-serif',
                  fontWeight: 500,
                  fontSize: '14px',
                  color: C.slate600,
                  cursor: 'pointer',
                  opacity: modalLoading ? 0.5 : 1,
                }}
              >
                Cancelar
              </button>
              <button
                onClick={handleCreateBarber}
                disabled={modalLoading}
                style={{
                  background: C.blue,
                  color: '#fff',
                  border: 'none',
                  borderRadius: '10px',
                  padding: '10px 18px',
                  fontFamily: 'Space Grotesk, sans-serif',
                  fontWeight: 600,
                  fontSize: '14px',
                  cursor: 'pointer',
                  opacity: modalLoading ? 0.5 : 1,
                }}
              >
                {modalLoading ? 'Procesando...' : editingBarber ? 'Guardar cambios' : 'Crear barbero'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// =============================================================================
// Shared styles / subcomponents
// =============================================================================
const rootStyle: React.CSSProperties = {
  maxWidth: '430px',
  margin: '0 auto',
  padding: '0 16px',
  boxSizing: 'border-box',
  overflowX: 'hidden',
}

const ctaCardStyle: React.CSSProperties = {
  marginTop: '16px',
  width: '100%',
  background: 'linear-gradient(135deg, #2563EB 0%, #3B82F6 100%)',
  border: 'none',
  borderRadius: '16px',
  padding: '16px 18px',
  display: 'flex',
  alignItems: 'center',
  gap: '14px',
  cursor: 'pointer',
  boxShadow: '0 4px 12px rgba(37,99,235,0.25)',
}

const modalLabelStyle: React.CSSProperties = {
  display: 'block',
  fontFamily: 'Space Grotesk, sans-serif',
  fontWeight: 400,
  fontSize: '13px',
  color: C.slate500,
  marginBottom: '8px',
}

const modalInputStyle: React.CSSProperties = {
  width: '100%',
  background: '#F8FAFC',
  border: `1px solid ${C.border}`,
  borderRadius: '8px',
  padding: '12px',
  fontFamily: 'Space Grotesk, sans-serif',
  fontWeight: 400,
  fontSize: '14px',
  color: C.ink,
  boxSizing: 'border-box',
  outline: 'none',
}

function ScreenHeader() {
  return (
    <div style={{ padding: '14px 0 16px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
      <h1
        style={{
          fontFamily: 'Syne, sans-serif',
          fontWeight: 700,
          fontSize: 'clamp(15px, 4.6vw, 18px)',
          color: C.ink,
          lineHeight: 1.2,
          margin: 0,
        }}
      >
        Barberos
      </h1>
      <p
        style={{
          fontFamily: 'Space Grotesk, sans-serif',
          fontWeight: 400,
          fontSize: 'clamp(11px, 3.33vw, 13px)',
          color: C.slate500,
          margin: 0,
        }}
      >
        Gestioná tu equipo de trabajo
      </p>
    </div>
  )
}

function StatCard({
  label,
  count,
  chipBg,
  iconStroke,
  icon,
}: {
  label: string
  count: number
  chipBg: string
  iconStroke: string
  icon: React.ReactNode
}) {
  return (
    <div
      style={{
        background: '#fff',
        border: `1px solid ${C.borderLt}`,
        borderRadius: '16px',
        padding: '14px 16px',
        boxShadow: '0 1px 2px rgba(15,23,42,0.04)',
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
      }}
    >
      <div
        style={{
          width: 40,
          height: 40,
          borderRadius: 10,
          background: chipBg,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          color: iconStroke,
        }}
      >
        {icon}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', minWidth: 0 }}>
        <div
          style={{
            fontFamily: 'Space Grotesk, sans-serif',
            fontWeight: 500,
            fontSize: 'clamp(12px, 3.33vw, 13px)',
            color: C.slate500,
          }}
        >
          {label}
        </div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px' }}>
          <span
            style={{
              fontFamily: "'Inter', system-ui, sans-serif",
              fontWeight: 800,
              fontSize: 'clamp(22px, 6.67vw, 26px)',
              color: C.ink,
              letterSpacing: '-0.5px',
              lineHeight: 1.05,
            }}
          >
            {count}
          </span>
          <span
            style={{
              fontFamily: 'Space Grotesk, sans-serif',
              fontWeight: 400,
              fontSize: 'clamp(11px, 3.08vw, 12px)',
              color: C.slate400,
            }}
          >
            {count === 1 ? 'barbero' : 'barberos'}
          </span>
        </div>
      </div>
    </div>
  )
}

function MenuItem({
  label,
  color,
  icon,
  onClick,
}: {
  label: string
  color: string
  icon: React.ReactNode
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        width: '100%',
        padding: '10px 12px',
        borderRadius: 8,
        background: 'transparent',
        border: 'none',
        cursor: 'pointer',
        fontFamily: 'Space Grotesk, sans-serif',
        fontWeight: 500,
        fontSize: '14px',
        color,
        textAlign: 'left',
      }}
      onMouseEnter={(e) => (e.currentTarget.style.background = '#F8FAFC')}
      onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
    >
      <span style={{ display: 'inline-flex', color }}>{icon}</span>
      {label}
    </button>
  )
}

function UsersIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  )
}

function UserIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  )
}

export default Barbers
