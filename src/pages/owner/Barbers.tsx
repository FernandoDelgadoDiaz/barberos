import { useState } from 'react'
import { useTenantStore } from '../../stores/tenantStore'

interface Barber {
  id: number
  name: string
  email: string
  is_active: boolean
  avatar_color: string
}

export function Barbers() {
  const { tenant } = useTenantStore()
  const [barbers, setBarbers] = useState<Barber[]>([
    { id: 1, name: 'Carlos', email: 'carlos@barberia.com', is_active: true, avatar_color: 'gold' },
    { id: 2, name: 'Gabriel', email: 'gabriel@barberia.com', is_active: true, avatar_color: 'purple' },
  ])
  const [showModal, setShowModal] = useState(false)
  const [editingBarber, setEditingBarber] = useState<Barber | null>(null)

  const handleToggleActive = (id: number) => {
    setBarbers(barbers.map(b => b.id === id ? { ...b, is_active: !b.is_active } : b))
  }

  const handleEdit = (barber: Barber) => {
    setEditingBarber(barber)
    setShowModal(true)
  }

  const handleAdd = () => {
    setEditingBarber(null)
    setShowModal(true)
  }

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()
  }

  return (
    <div style={{ maxWidth: '1000px', margin: '0 auto', background: '#1a1a1a', color: '#fff', padding: '24px', borderRadius: '12px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '32px' }}>
        <div>
          <h1 style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: '26px', color: '#fff', marginBottom: '8px' }}>Barberos</h1>
          <p style={{ color: '#888', fontSize: '14px' }}>{tenant?.name || 'Tu barbería'} • Gestiona tu equipo</p>
        </div>
        <button
          onClick={handleAdd}
          style={{
            background: '#C8A97E',
            color: '#1a1a1a',
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

      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {barbers.map((barber) => (
          <div
            key={barber.id}
            style={{
              background: '#2a2a2a',
              border: '1px solid #383838',
              borderRadius: '12px',
              padding: '20px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flex: 1 }}>
              <div style={{ width: '56px', height: '56px', borderRadius: '12px', background: barber.avatar_color === 'gold' ? 'linear-gradient(135deg, #C8A97E, #8B6200)' : 'linear-gradient(135deg, #7c3aed, #4c1d95)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: '18px', color: '#080808' }}>
                {getInitials(barber.name)}
              </div>
              <div>
                <div style={{ fontFamily: 'Space Grotesk, sans-serif', fontWeight: 600, fontSize: '16px', color: '#fff', marginBottom: '4px' }}>
                  {barber.name}
                </div>
                <div style={{ fontFamily: 'Space Grotesk, sans-serif', fontWeight: 400, fontSize: '13px', color: '#888' }}>
                  {barber.email}
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <button
                onClick={() => handleEdit(barber)}
                style={{
                  background: 'transparent',
                  border: '1px solid #383838',
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
                <div style={{ fontFamily: 'Space Grotesk, sans-serif', fontWeight: 400, fontSize: '12px', color: barber.is_active ? '#C8A97E' : '#888' }}>
                  {barber.is_active ? 'Activo' : 'Inactivo'}
                </div>
                <div
                  onClick={() => handleToggleActive(barber.id)}
                  style={{
                    width: '36px',
                    height: '20px',
                    borderRadius: '10px',
                    background: barber.is_active ? '#C8A97E' : '#383838',
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
          background: 'rgba(0,0,0,0.8)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
        }}>
          <div style={{
            background: '#242424',
            border: '1px solid #383838',
            borderRadius: '12px',
            padding: '32px',
            width: '100%',
            maxWidth: '480px',
          }}>
            <h2 style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: '20px', color: '#fff', marginBottom: '24px' }}>
              {editingBarber ? 'Editar barbero' : 'Agregar barbero'}
            </h2>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', fontFamily: 'Space Grotesk, sans-serif', fontWeight: 400, fontSize: '13px', color: '#888', marginBottom: '8px' }}>
                  Nombre
                </label>
                <input
                  type="text"
                  defaultValue={editingBarber?.name || ''}
                  style={{
                    width: '100%',
                    background: '#2a2a2a',
                    border: '1px solid #383838',
                    borderRadius: '6px',
                    padding: '12px',
                    fontFamily: 'Space Grotesk, sans-serif',
                    fontWeight: 400,
                    fontSize: '14px',
                    color: '#fff',
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontFamily: 'Space Grotesk, sans-serif', fontWeight: 400, fontSize: '13px', color: '#888', marginBottom: '8px' }}>
                  Email
                </label>
                <input
                  type="email"
                  defaultValue={editingBarber?.email || ''}
                  style={{
                    width: '100%',
                    background: '#2a2a2a',
                    border: '1px solid #383838',
                    borderRadius: '6px',
                    padding: '12px',
                    fontFamily: 'Space Grotesk, sans-serif',
                    fontWeight: 400,
                    fontSize: '14px',
                    color: '#fff',
                  }}
                />
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '32px' }}>
              <button
                onClick={() => setShowModal(false)}
                style={{
                  background: 'transparent',
                  border: '1px solid #383838',
                  borderRadius: '6px',
                  padding: '10px 20px',
                  fontFamily: 'Space Grotesk, sans-serif',
                  fontWeight: 500,
                  fontSize: '14px',
                  color: '#888',
                  cursor: 'pointer',
                }}
              >
                Cancelar
              </button>
              <button
                onClick={() => setShowModal(false)}
                style={{
                  background: '#C8A97E',
                  color: '#1a1a1a',
                  border: 'none',
                  borderRadius: '6px',
                  padding: '10px 20px',
                  fontFamily: 'Space Grotesk, sans-serif',
                  fontWeight: 600,
                  fontSize: '14px',
                  cursor: 'pointer',
                }}
              >
                {editingBarber ? 'Guardar cambios' : 'Crear barbero'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}