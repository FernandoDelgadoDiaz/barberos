import { useState } from 'react'
import { useTenantStore } from '../../stores/tenantStore'

interface Service {
  id: number
  name: string
  price: number
  duration_minutes: number
  is_active: boolean
}

export function Services() {
  const { tenant } = useTenantStore()
  const [services, setServices] = useState<Service[]>([
    { id: 1, name: 'Corte clásico', price: 2500, duration_minutes: 30, is_active: true },
    { id: 2, name: 'Barba', price: 1500, duration_minutes: 20, is_active: true },
    { id: 3, name: 'Corte + barba', price: 3500, duration_minutes: 45, is_active: true },
    { id: 4, name: 'Afeitado tradicional', price: 2000, duration_minutes: 25, is_active: false },
  ])
  const [showModal, setShowModal] = useState(false)
  const [editingService, setEditingService] = useState<Service | null>(null)

  const handleToggleActive = (id: number) => {
    setServices(services.map(s => s.id === id ? { ...s, is_active: !s.is_active } : s))
  }

  const handleEdit = (service: Service) => {
    setEditingService(service)
    setShowModal(true)
  }

  const handleAdd = () => {
    setEditingService(null)
    setShowModal(true)
  }

  return (
    <div style={{ maxWidth: '1000px', margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '32px' }}>
        <div>
          <h1 style={{ fontFamily: 'Syne, sans-serif', fontWeight: 800, fontSize: '32px', color: '#fff', marginBottom: '8px' }}>Servicios</h1>
          <p style={{ color: '#666', fontSize: '14px' }}>{tenant?.name || 'Tu barbería'} • Catálogo de servicios y precios</p>
        </div>
        <button
          onClick={handleAdd}
          style={{
            background: '#B8FF47',
            color: '#080808',
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
          Agregar servicio
        </button>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {services.map((service) => (
          <div
            key={service.id}
            style={{
              background: '#111111',
              border: '1px solid #1c1c1c',
              borderRadius: '12px',
              padding: '20px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                <div style={{ width: '48px', height: '48px', borderRadius: '10px', background: '#1a1a1a', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={service.is_active ? '#B8FF47' : '#666'} strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
                  </svg>
                </div>
                <div>
                  <div style={{ fontFamily: 'Space Grotesk, sans-serif', fontWeight: 600, fontSize: '16px', color: '#fff', marginBottom: '4px' }}>
                    {service.name}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '16px', fontFamily: 'Space Grotesk, sans-serif', fontWeight: 400, fontSize: '13px', color: '#666' }}>
                    <span>${service.price.toLocaleString()}</span>
                    <span style={{ width: '4px', height: '4px', borderRadius: '50%', background: '#666' }} />
                    <span>{service.duration_minutes} min</span>
                  </div>
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <button
                onClick={() => handleEdit(service)}
                style={{
                  background: 'transparent',
                  border: '1px solid #333',
                  borderRadius: '6px',
                  padding: '8px 12px',
                  fontFamily: 'Space Grotesk, sans-serif',
                  fontWeight: 500,
                  fontSize: '12px',
                  color: '#666',
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
                <div style={{ fontFamily: 'Space Grotesk, sans-serif', fontWeight: 400, fontSize: '12px', color: service.is_active ? '#B8FF47' : '#666' }}>
                  {service.is_active ? 'Activo' : 'Inactivo'}
                </div>
                <div
                  onClick={() => handleToggleActive(service.id)}
                  style={{
                    width: '36px',
                    height: '20px',
                    borderRadius: '10px',
                    background: service.is_active ? '#B8FF47' : '#333',
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
                    left: service.is_active ? '18px' : '2px',
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
            background: '#111111',
            border: '1px solid #1c1c1c',
            borderRadius: '12px',
            padding: '32px',
            width: '100%',
            maxWidth: '480px',
          }}>
            <h2 style={{ fontFamily: 'Syne, sans-serif', fontWeight: 800, fontSize: '20px', color: '#fff', marginBottom: '24px' }}>
              {editingService ? 'Editar servicio' : 'Agregar servicio'}
            </h2>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', fontFamily: 'Space Grotesk, sans-serif', fontWeight: 400, fontSize: '13px', color: '#666', marginBottom: '8px' }}>
                  Nombre
                </label>
                <input
                  type="text"
                  defaultValue={editingService?.name || ''}
                  style={{
                    width: '100%',
                    background: '#1a1a1a',
                    border: '1px solid #333',
                    borderRadius: '6px',
                    padding: '12px',
                    fontFamily: 'Space Grotesk, sans-serif',
                    fontWeight: 400,
                    fontSize: '14px',
                    color: '#fff',
                  }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div>
                  <label style={{ display: 'block', fontFamily: 'Space Grotesk, sans-serif', fontWeight: 400, fontSize: '13px', color: '#666', marginBottom: '8px' }}>
                    Precio ($)
                  </label>
                  <input
                    type="number"
                    defaultValue={editingService?.price || ''}
                    style={{
                      width: '100%',
                      background: '#1a1a1a',
                      border: '1px solid #333',
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
                  <label style={{ display: 'block', fontFamily: 'Space Grotesk, sans-serif', fontWeight: 400, fontSize: '13px', color: '#666', marginBottom: '8px' }}>
                    Duración (min)
                  </label>
                  <input
                    type="number"
                    defaultValue={editingService?.duration_minutes || ''}
                    style={{
                      width: '100%',
                      background: '#1a1a1a',
                      border: '1px solid #333',
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
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '32px' }}>
              <button
                onClick={() => setShowModal(false)}
                style={{
                  background: 'transparent',
                  border: '1px solid #333',
                  borderRadius: '6px',
                  padding: '10px 20px',
                  fontFamily: 'Space Grotesk, sans-serif',
                  fontWeight: 500,
                  fontSize: '14px',
                  color: '#666',
                  cursor: 'pointer',
                }}
              >
                Cancelar
              </button>
              <button
                onClick={() => setShowModal(false)}
                style={{
                  background: '#B8FF47',
                  color: '#080808',
                  border: 'none',
                  borderRadius: '6px',
                  padding: '10px 20px',
                  fontFamily: 'Space Grotesk, sans-serif',
                  fontWeight: 600,
                  fontSize: '14px',
                  cursor: 'pointer',
                }}
              >
                {editingService ? 'Guardar cambios' : 'Crear servicio'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}