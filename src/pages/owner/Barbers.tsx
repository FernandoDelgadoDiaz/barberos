import { useState, useEffect, useCallback } from 'react'
import { useTenantStore } from '../../stores/tenantStore'
import { supabase } from '../../config/supabase'
import type { Profile } from '../../types'

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
        const response = await fetch('/api/create-barber', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
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
    return name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()
  }

  if (loading) {
    return (
      <div style={{ maxWidth: '1000px', margin: '0 auto', padding: '24px', textAlign: 'center', color: '#aaa', fontSize: '14px' }}>
        Cargando barberos...
      </div>
    )
  }

  if (error) {
    return (
      <div style={{ maxWidth: '1000px', margin: '0 auto', padding: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '32px' }}>
          <div>
            <h1 style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: '26px', color: '#1a1a2e', marginBottom: '8px' }}>Barberos</h1>
            <p style={{ color: '#aaa', fontSize: '14px' }}>{tenant?.name || 'Tu barbería'} · Gestiona tu equipo</p>
          </div>
          <button
            onClick={handleAdd}
            style={{
              background: '#3D3A8C',
              color: '#fff',
              border: 'none',
              borderRadius: '8px',
              padding: '12px 20px',
              fontFamily: 'Space Grotesk, sans-serif',
              fontWeight: 600,
              fontSize: '14px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            Agregar barbero
          </button>
        </div>
        <div style={{ background: '#fff5f5', border: '0.5px solid #ffcccc', borderRadius: '12px', padding: '20px', color: '#cc3333', fontFamily: 'Space Grotesk, sans-serif' }}>
          <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '8px' }}>Error al cargar barberos</h3>
          <p style={{ fontSize: '14px' }}>{error}</p>
          <button
            onClick={() => loadBarbers()}
            style={{
              background: '#3D3A8C',
              color: '#fff',
              border: 'none',
              borderRadius: '6px',
              padding: '8px 16px',
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
      </div>
    )
  }

  return (
    <div style={{ maxWidth: '1000px', margin: '0 auto', padding: '24px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '32px' }}>
        <div>
          <h1 style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: '26px', color: '#1a1a2e', marginBottom: '8px' }}>Barberos</h1>
          <p style={{ color: '#aaa', fontSize: '14px' }}>{tenant?.name || 'Tu barbería'} · Gestiona tu equipo</p>
        </div>
        <button
          onClick={handleAdd}
          style={{
            background: '#3D3A8C',
            color: '#fff',
            border: 'none',
            borderRadius: '8px',
            padding: '12px 20px',
            fontFamily: 'Space Grotesk, sans-serif',
            fontWeight: 600,
            fontSize: '14px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          Agregar barbero
        </button>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {barbers.map((barber) => (
          <div
            key={barber.id}
            className="responsive-row"
            style={{
              background: '#fff',
              border: '0.5px solid #e0e0e0',
              borderRadius: '10px',
              padding: '16px 20px',
            }}
          >
            <div className="responsive-row-left" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{ width: '48px', height: '48px', borderRadius: '10px', background: '#3D3A8C', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '16px', color: '#fff', flexShrink: 0 }}>
                {getInitials(barber.display_name)}
              </div>
              <div>
                <div style={{ fontFamily: 'Space Grotesk, sans-serif', fontWeight: 600, fontSize: '15px', color: '#1a1a2e', marginBottom: '2px' }}>
                  {barber.display_name}
                </div>
                <div style={{ fontFamily: 'Space Grotesk, sans-serif', fontWeight: 400, fontSize: '12px', color: '#aaa' }}>
                  Barbero
                </div>
              </div>
            </div>

            <div className="responsive-row-right" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <button
                onClick={() => handleEdit(barber)}
                style={{
                  background: 'transparent',
                  border: '0.5px solid #e0e0e0',
                  borderRadius: '6px',
                  padding: '8px 12px',
                  fontFamily: 'Space Grotesk, sans-serif',
                  fontWeight: 500,
                  fontSize: '12px',
                  color: '#888',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
                Editar
              </button>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{ fontFamily: 'Space Grotesk, sans-serif', fontWeight: 400, fontSize: '12px', color: barber.is_active ? '#3D3A8C' : '#aaa' }}>
                  {barber.is_active ? 'Activo' : 'Inactivo'}
                </div>
                <div
                  onClick={() => handleToggleActive(barber.id)}
                  style={{
                    width: '36px',
                    height: '20px',
                    borderRadius: '10px',
                    background: barber.is_active ? '#3D3A8C' : '#e0e0e0',
                    position: 'relative',
                    cursor: 'pointer',
                  }}
                >
                  <div style={{
                    width: '16px',
                    height: '16px',
                    borderRadius: '50%',
                    background: '#fff',
                    position: 'absolute',
                    top: '2px',
                    left: barber.is_active ? '18px' : '2px',
                    transition: 'left 0.2s',
                  }} />
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {showModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.4)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
        }}>
          <div style={{
            background: '#fff',
            border: '0.5px solid #e0e0e0',
            borderRadius: '12px',
            padding: '32px',
            width: '100%',
            maxWidth: '480px',
          }}>
            <h2 style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: '20px', color: '#1a1a2e', marginBottom: '24px' }}>
              {editingBarber ? 'Editar barbero' : 'Agregar barbero'}
            </h2>

            {modalError && (
              <div style={{
                background: '#fff5f5',
                border: '0.5px solid #ffcccc',
                borderRadius: '8px',
                padding: '12px',
                marginBottom: '20px',
                color: '#cc3333',
                fontFamily: 'Space Grotesk, sans-serif',
                fontSize: '13px',
              }}>
                {modalError}
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', fontFamily: 'Space Grotesk, sans-serif', fontWeight: 400, fontSize: '13px', color: '#888', marginBottom: '8px' }}>
                  Nombre para mostrar
                </label>
                <input
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  style={{
                    width: '100%',
                    background: '#f8f8f8',
                    border: '0.5px solid #e0e0e0',
                    borderRadius: '6px',
                    padding: '12px',
                    fontFamily: 'Space Grotesk, sans-serif',
                    fontWeight: 400,
                    fontSize: '14px',
                    color: '#1a1a2e',
                    boxSizing: 'border-box',
                  }}
                />
              </div>

              {!editingBarber && (
                <>
                  <div>
                    <label style={{ display: 'block', fontFamily: 'Space Grotesk, sans-serif', fontWeight: 400, fontSize: '13px', color: '#888', marginBottom: '8px' }}>
                      Email
                    </label>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      style={{
                        width: '100%',
                        background: '#f8f8f8',
                        border: '0.5px solid #e0e0e0',
                        borderRadius: '6px',
                        padding: '12px',
                        fontFamily: 'Space Grotesk, sans-serif',
                        fontWeight: 400,
                        fontSize: '14px',
                        color: '#1a1a2e',
                        boxSizing: 'border-box',
                      }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontFamily: 'Space Grotesk, sans-serif', fontWeight: 400, fontSize: '13px', color: '#888', marginBottom: '8px' }}>
                      Contraseña
                    </label>
                    <input
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      style={{
                        width: '100%',
                        background: '#f8f8f8',
                        border: '0.5px solid #e0e0e0',
                        borderRadius: '6px',
                        padding: '12px',
                        fontFamily: 'Space Grotesk, sans-serif',
                        fontWeight: 400,
                        fontSize: '14px',
                        color: '#1a1a2e',
                        boxSizing: 'border-box',
                      }}
                    />
                  </div>
                </>
              )}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '32px' }}>
              <button
                onClick={() => setShowModal(false)}
                disabled={modalLoading}
                style={{
                  background: 'transparent',
                  border: '0.5px solid #e0e0e0',
                  borderRadius: '6px',
                  padding: '10px 20px',
                  fontFamily: 'Space Grotesk, sans-serif',
                  fontWeight: 500,
                  fontSize: '14px',
                  color: '#888',
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
                  background: '#3D3A8C',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '6px',
                  padding: '10px 20px',
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
