import { useState, useEffect } from 'react'
import { useTenantStore } from '../../stores/tenantStore'
import { supabase } from '../../config/supabase'
import type { ServiceCatalog } from '../../types'

export function Services() {
  const { tenant } = useTenantStore()
  const [services, setServices] = useState<ServiceCatalog[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showModal, setShowModal] = useState(false)
  const [editingService, setEditingService] = useState<ServiceCatalog | null>(null)
  const [formData, setFormData] = useState({
    name: '',
    base_price: '',
    duration_min: '',
    is_active: true,
  })
  const [saving, setSaving] = useState(false)

  // Load services
  useEffect(() => {
    if (!tenant?.id) return

    const loadServices = async () => {
      setLoading(true)
      setError(null)

      try {
        const { data, error } = await supabase
          .from('services_catalog')
          .select('*')
          .eq('tenant_id', tenant.id)
          .order('name')

        if (error) throw error

        setServices(data || [])
      } catch (err: unknown) {
        console.error('Error loading services:', err)
        const errorMessage = err instanceof Error ? err.message : 'Error al cargar servicios'
        setError(errorMessage)
      } finally {
        setLoading(false)
      }
    }

    loadServices()
  }, [tenant])

  const handleToggleActive = async (service: ServiceCatalog) => {
    if (!tenant?.id) return

    try {
      const { error } = await supabase
        .from('services_catalog')
        .update({ is_active: !service.is_active })
        .eq('id', service.id)
        .eq('tenant_id', tenant.id)

      if (error) throw error

      // Update local state
      setServices(services.map(s =>
        s.id === service.id ? { ...s, is_active: !s.is_active } : s
      ))
    } catch (err: unknown) {
      console.error('Error toggling service:', err)
      const errorMessage = err instanceof Error ? err.message : 'Error al actualizar servicio'
      setError(errorMessage)
    }
  }

  const handleEdit = (service: ServiceCatalog) => {
    setEditingService(service)
    setFormData({
      name: service.name,
      base_price: service.base_price.toString(),
      duration_min: service.duration_min.toString(),
      is_active: service.is_active,
    })
    setShowModal(true)
  }

  const handleAdd = () => {
    setEditingService(null)
    setFormData({
      name: '',
      base_price: '',
      duration_min: '',
      is_active: true,
    })
    setShowModal(true)
  }

  const handleSave = async () => {
    if (!tenant?.id) return
    if (!formData.name || !formData.base_price || !formData.duration_min) {
      setError('Por favor completa todos los campos')
      return
    }

    setSaving(true)
    setError(null)

    try {
      const serviceData = {
        tenant_id: tenant.id,
        name: formData.name,
        base_price: parseFloat(formData.base_price),
        duration_min: parseInt(formData.duration_min),
        is_active: editingService ? formData.is_active : true,
      }

      if (editingService) {
        // Update existing
        const { error } = await supabase
          .from('services_catalog')
          .update(serviceData)
          .eq('id', editingService.id)
          .eq('tenant_id', tenant.id)

        if (error) throw error

        setServices(services.map(s =>
          s.id === editingService.id ? { ...s, ...serviceData } : s
        ))
      } else {
        // Insert new
        const { data, error } = await supabase
          .from('services_catalog')
          .insert(serviceData)
          .select()
          .single()

        if (error) throw error

        setServices([...services, data])
      }

      setShowModal(false)
      setEditingService(null)
    } catch (err: unknown) {
      console.error('Error saving service:', err)
      const errorMessage = err instanceof Error ? err.message : 'Error al guardar servicio'
      setError(errorMessage)
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (service: ServiceCatalog) => {
    if (!tenant?.id) return
    if (!confirm(`¿Eliminar servicio "${service.name}"?`)) return

    try {
      const { error } = await supabase
        .from('services_catalog')
        .delete()
        .eq('id', service.id)
        .eq('tenant_id', tenant.id)

      if (error) throw error

      setServices(services.filter(s => s.id !== service.id))
    } catch (err: unknown) {
      console.error('Error deleting service:', err)
      const errorMessage = err instanceof Error ? err.message : 'Error al eliminar servicio'
      setError(errorMessage)
    }
  }

  if (loading) {
    return (
      <div style={{ maxWidth: '1000px', margin: '0 auto', padding: '40px', textAlign: 'center', color: '#888' }}>
        Cargando servicios...
      </div>
    )
  }

  return (
    <div style={{ maxWidth: '1000px', margin: '0 auto', background: '#2a2a2a', color: '#fff', padding: '24px', borderRadius: '12px' }}>
      <div className="mobile-stack" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '32px', flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: '26px', color: '#fff', marginBottom: '8px' }}>Servicios</h1>
          <p style={{ color: '#888', fontSize: '14px' }}>{tenant?.name || 'Tu barbería'} • Catálogo de servicios y precios</p>
        </div>
        <button
          onClick={handleAdd}
          className="mobile-full"
          style={{
            background: '#C8A97E',
            color: '#2a2a2a',
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

      {/* Error message */}
      {error && (
        <div style={{
          background: '#2a2a2a',
          border: '1px solid #e94560',
          borderRadius: '8px',
          padding: '12px 16px',
          marginBottom: '24px',
          color: '#e94560',
          fontFamily: 'Space Grotesk, sans-serif',
          fontSize: '14px',
        }}>
          {error}
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {services.length === 0 ? (
          <div style={{
            background: '#2a2a2a',
            border: '1px solid #383838',
            borderRadius: '12px',
            padding: '60px 40px',
            textAlign: 'center',
            color: '#888',
            fontFamily: 'Space Grotesk, sans-serif',
            fontSize: '14px',
          }}>
            No hay servicios configurados. Agrega tu primer servicio.
          </div>
        ) : (
          services.map((service) => (
            <div
              key={service.id}
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
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                  <div style={{ width: '48px', height: '48px', borderRadius: '10px', background: '#2a2a2a', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={service.is_active ? '#C8A97E' : '#888'} strokeWidth="2">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
                    </svg>
                  </div>
                  <div>
                    <div style={{ fontFamily: 'Space Grotesk, sans-serif', fontWeight: 600, fontSize: '16px', color: '#fff', marginBottom: '4px' }}>
                      {service.name}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px', fontFamily: 'Space Grotesk, sans-serif', fontWeight: 400, fontSize: '13px', color: '#888' }}>
                      <span style={{ color: '#C8A97E' }}>${service.base_price.toLocaleString()}</span>
                      <span style={{ width: '4px', height: '4px', borderRadius: '50%', background: '#888' }} />
                      <span>{service.duration_min} min</span>
                    </div>
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                <button
                  onClick={() => handleEdit(service)}
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

                <button
                  onClick={() => handleDelete(service)}
                  style={{
                    background: 'transparent',
                    border: '1px solid #383838',
                    borderRadius: '6px',
                    padding: '8px 12px',
                    fontFamily: 'Space Grotesk, sans-serif',
                    fontWeight: 500,
                    fontSize: '12px',
                    color: '#e94560',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                  }}
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                  Eliminar
                </button>

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div style={{ fontFamily: 'Space Grotesk, sans-serif', fontWeight: 400, fontSize: '12px', color: service.is_active ? '#C8A97E' : '#888' }}>
                    {service.is_active ? 'Activo' : 'Inactivo'}
                  </div>
                  <div
                    onClick={() => handleToggleActive(service)}
                    style={{
                      width: '36px',
                      height: '20px',
                      borderRadius: '10px',
                      background: service.is_active ? '#C8A97E' : '#383838',
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
          ))
        )}
      </div>

      {/* Modal */}
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
            width: '90vw',
            maxWidth: '480px',
            alignSelf: 'center',
          }}>
            <h2 style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: '20px', color: '#fff', marginBottom: '24px' }}>
              {editingService ? 'Editar servicio' : 'Agregar servicio'}
            </h2>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', fontFamily: 'Space Grotesk, sans-serif', fontWeight: 400, fontSize: '13px', color: '#888', marginBottom: '8px' }}>
                  Nombre
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
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

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '16px' }}>
                <div>
                  <label style={{ display: 'block', fontFamily: 'Space Grotesk, sans-serif', fontWeight: 400, fontSize: '13px', color: '#888', marginBottom: '8px' }}>
                    Precio ($)
                  </label>
                  <input
                    type="number"
                    value={formData.base_price}
                    onChange={(e) => setFormData({ ...formData, base_price: e.target.value })}
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
                    Duración (min)
                  </label>
                  <input
                    type="number"
                    value={formData.duration_min}
                    onChange={(e) => setFormData({ ...formData, duration_min: e.target.value })}
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

              {editingService && (
                <div>
                  <label style={{ display: 'block', fontFamily: 'Space Grotesk, sans-serif', fontWeight: 400, fontSize: '13px', color: '#888', marginBottom: '8px' }}>
                    Estado
                  </label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div
                      onClick={() => setFormData({ ...formData, is_active: !formData.is_active })}
                      style={{
                        width: '36px',
                        height: '20px',
                        borderRadius: '10px',
                        background: formData.is_active ? '#C8A97E' : '#383838',
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
                        left: formData.is_active ? '18px' : '2px',
                        transition: 'left 0.2s',
                      }} />
                    </div>
                    <div style={{ fontFamily: 'Space Grotesk, sans-serif', fontWeight: 400, fontSize: '13px', color: formData.is_active ? '#C8A97E' : '#888' }}>
                      {formData.is_active ? 'Activo' : 'Inactivo'}
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '32px' }}>
              <button
                onClick={() => setShowModal(false)}
                disabled={saving}
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
                onClick={handleSave}
                disabled={saving}
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
                  opacity: saving ? 0.6 : 1,
                }}
              >
                {saving ? 'Guardando...' : editingService ? 'Guardar cambios' : 'Crear servicio'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}