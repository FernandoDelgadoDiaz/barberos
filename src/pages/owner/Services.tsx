import { useState, useEffect } from 'react'
import { useTenantStore } from '../../stores/tenantStore'
import { supabase } from '../../config/supabase'
import type { ServiceCatalog } from '../../types'

// =============================================================================
// Palette — slate + blue (consistent with Barbers / LivePanel / Metrics / History)
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
  green: '#059669',
  greenBg: '#D1FAE5',
  greenDot: '#10B981',
  red: '#DC2626',
} as const

// Deterministic item-icon color — SAME hash + palette used for the avatars in
// Barbers / LivePanel / History, replicated locally because the scope only
// allows editing Services.tsx. Hashes on `id || name`. NO color is persisted:
// it is derived at render time only (mockup M14/M15 were decorative).
const ICON_PALETTE = [
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

function getIconColor(id: string, name: string): string {
  return ICON_PALETTE[hashIndex(id || name, ICON_PALETTE.length)]
}

export function Services() {
  const { tenant } = useTenantStore()
  const [services, setServices] = useState<ServiceCatalog[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showModal, setShowModal] = useState(false)
  const [editingService, setEditingService] = useState<ServiceCatalog | null>(null)
  const [openMenuId, setOpenMenuId] = useState<string | null>(null)
  const [formData, setFormData] = useState({
    name: '',
    base_price: '',
    duration_min: '',
    is_active: true,
    category: 'servicio' as 'servicio' | 'producto',
  })
  const [saving, setSaving] = useState(false)

  // Load services
  useEffect(() => {
    const loadServices = async () => {
      if (!tenant?.id) return
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

    if (!tenant?.id) {
      const retryId = setTimeout(() => { loadServices() }, 500)
      return () => clearTimeout(retryId)
    }

    loadServices()
  }, [tenant])

  // Close kebab menu on any outside click
  useEffect(() => {
    if (!openMenuId) return
    const close = () => setOpenMenuId(null)
    window.addEventListener('click', close)
    return () => window.removeEventListener('click', close)
  }, [openMenuId])

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
      category: service.category,
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
      category: 'servicio',
    })
    setShowModal(true)
  }

  const handleSave = async () => {
    if (!tenant?.id) {
      setError('No hay tenant seleccionado')
      return
    }
    const isProduct = formData.category === 'producto'
    if (!formData.name || !formData.base_price || (!isProduct && !formData.duration_min)) {
      setError('Por favor completa todos los campos')
      return
    }

    // Validación numérica
    const basePrice = parseFloat(formData.base_price)
    // Productos no tienen duración: se persiste 0
    const durationMin = isProduct ? 0 : parseInt(formData.duration_min)
    if (isNaN(basePrice) || basePrice < 0) {
      setError('El precio debe ser un número válido y mayor o igual a 0')
      return
    }
    if (!isProduct && (isNaN(durationMin) || durationMin <= 0)) {
      setError('La duración debe ser un número entero positivo')
      return
    }

    setSaving(true)
    setError(null)

    try {
      const serviceData = {
        tenant_id: tenant.id,
        name: formData.name,
        base_price: basePrice,
        duration_min: durationMin,
        is_active: editingService ? formData.is_active : true,
        category: formData.category,
      }

      if (editingService) {
        // Update existing - no incluir tenant_id (no debe cambiar)
        const updateData = {
          name: formData.name,
          base_price: basePrice,
          duration_min: durationMin,
          is_active: formData.is_active,
          category: formData.category,
        }
        const { error } = await supabase
          .from('services_catalog')
          .update(updateData)
          .eq('id', editingService.id)
          .eq('tenant_id', tenant.id)

        if (error) throw error

        // Actualizar estado local con los datos actualizados (incluyendo tenant_id)
        setServices(services.map(s =>
          s.id === editingService.id ? { ...s, ...updateData } : s
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
    if (!confirm(`¿Desactivar servicio "${service.name}"? Ya no aparecerá en el catálogo.`)) return

    try {
      const { error } = await supabase
        .from('services_catalog')
        .update({ is_active: false })
        .eq('id', service.id)
        .eq('tenant_id', tenant.id)

      if (error) throw error

      setServices(services.map(s => s.id === service.id ? { ...s, is_active: false } : s))
    } catch (err: unknown) {
      console.error('Error deleting service:', err)
      const errorMessage = err instanceof Error ? err.message : 'Error al desactivar servicio'
      setError(errorMessage)
    }
  }

  // ---------------------------------------------------------------------------
  // Loading
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
        Cargando servicios...
      </div>
    )
  }

  // ---------------------------------------------------------------------------
  // Derived metrics (real data — M7 / M8). No persistence, computed in render.
  // ---------------------------------------------------------------------------
  const activeCount = services.filter(s => s.is_active).length
  const avgPrice = services.length
    ? Math.round(services.reduce((sum, s) => sum + s.base_price, 0) / services.length)
    : 0

  const servicioItems = services
    .filter((s) => s.category === 'servicio')
    .sort((a, b) => a.name.localeCompare(b.name))
  const productoItems = services
    .filter((s) => s.category === 'producto')
    .sort((a, b) => a.name.localeCompare(b.name))

  const renderItemCard = (service: ServiceCatalog) => {
    const menuOpen = openMenuId === service.id
    const iconColor = getIconColor(service.id, service.name)
    const isProduct = service.category === 'producto'
    return (
      <div
        key={service.id}
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
        {/* Colored icon square (deterministic, not persisted) */}
        <div
          style={{
            width: 44,
            height: 44,
            borderRadius: 12,
            background: iconColor,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#fff',
            flexShrink: 0,
            boxShadow: '0 2px 8px rgba(15,23,42,0.10)',
          }}
        >
          {isProduct ? <BoxIcon /> : <ScissorsIcon />}
        </div>

        {/* Name + price·duration + status badge */}
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <div
            style={{
              fontFamily: 'Syne, sans-serif',
              fontWeight: 700,
              fontSize: 'clamp(15px, 4.36vw, 17px)',
              color: C.ink,
              lineHeight: 1.2,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {service.name}
          </div>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              fontFamily: 'Space Grotesk, sans-serif',
              fontWeight: 400,
              fontSize: 'clamp(12px, 3.33vw, 13px)',
              color: C.slate500,
            }}
          >
            <span style={{ fontWeight: 600, color: C.slate600 }}>${service.base_price.toLocaleString()}</span>
            {!isProduct && (
              <>
                <span style={{ width: 3, height: 3, borderRadius: '50%', background: C.slate400 }} />
                <span>{service.duration_min} min</span>
              </>
            )}
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
              background: service.is_active ? C.greenBg : C.borderLt,
              color: service.is_active ? C.green : C.slate500,
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
                background: service.is_active ? C.greenDot : C.slate400,
              }}
            />
            {service.is_active ? 'Activo' : 'Inactivo'}
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
                setOpenMenuId(menuOpen ? null : service.id)
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
                    handleEdit(service)
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
                  label={service.is_active ? 'Desactivar' : 'Activar'}
                  color={service.is_active ? C.slate600 : C.green}
                  onClick={() => {
                    setOpenMenuId(null)
                    handleToggleActive(service)
                  }}
                  icon={
                    service.is_active ? (
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
                <div style={{ height: 1, background: C.borderLt, margin: '4px 8px' }} />
                <MenuItem
                  label="Eliminar"
                  color={C.red}
                  onClick={() => {
                    setOpenMenuId(null)
                    handleDelete(service)
                  }}
                  icon={
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M3 6h18" />
                      <path d="M19 6l-.867 12.142A2 2 0 0 1 16.138 20H7.862a2 2 0 0 1-1.995-1.858L5 6" />
                      <path d="M10 11v6M14 11v6" />
                      <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
                    </svg>
                  }
                />
              </div>
            )}
          </div>

          <button
            onClick={() => handleEdit(service)}
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
  }

  // ---------------------------------------------------------------------------
  // Main
  // ---------------------------------------------------------------------------
  return (
    <div style={rootStyle}>
      <ScreenHeader tenantName={tenant?.name} />

      {/* Stat cards (derived real data) */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
          gap: '12px',
          marginTop: '20px',
        }}
      >
        <StatCard
          label="Servicios activos"
          value={String(activeCount)}
          suffix={activeCount === 1 ? 'activo' : 'activos'}
          chipBg={C.greenBg}
          iconStroke={C.green}
          icon={<CheckBadgeIcon />}
        />
        <StatCard
          label="Precio promedio"
          value={`$${avgPrice.toLocaleString()}`}
          suffix="promedio"
          chipBg="#EDE9FE"
          iconStroke="#7C3AED"
          icon={<TagIcon />}
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
            Agregar servicio
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
            Crear un nuevo servicio
          </div>
        </div>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.9, flexShrink: 0 }}>
          <path d="M9 18l6-6-6-6" />
        </svg>
      </button>

      {/* Error message */}
      {error && (
        <div
          style={{
            marginTop: '16px',
            background: '#FEF2F2',
            border: '1px solid #FECACA',
            borderRadius: '12px',
            padding: '12px 16px',
            color: C.red,
            fontFamily: 'Space Grotesk, sans-serif',
            fontSize: '14px',
          }}
        >
          {error}
        </div>
      )}

      {/* Catalog */}
      {services.length === 0 ? (
        <div
          style={{
            marginTop: '16px',
            background: '#fff',
            border: `1px solid ${C.borderLt}`,
            borderRadius: '16px',
            padding: '48px 24px',
            textAlign: 'center',
            color: C.slate400,
            fontFamily: 'Space Grotesk, sans-serif',
            fontSize: '14px',
            boxShadow: '0 1px 2px rgba(15,23,42,0.04)',
          }}
        >
          No hay servicios configurados. Agregá tu primer servicio.
        </div>
      ) : (
        <>
          <div style={{ marginTop: '20px' }}>
            <h2 style={sectionTitleStyle}>Catálogo de servicios</h2>
            <p style={sectionSubtitleStyle}>Gestioná los precios, estados y disponibilidad</p>
          </div>

          {servicioItems.length > 0 && (
            <section style={{ marginTop: '12px' }}>
              <h3 style={groupLabelStyle}>SERVICIOS</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {servicioItems.map(renderItemCard)}
              </div>
            </section>
          )}

          {productoItems.length > 0 && (
            <section style={{ marginTop: '20px' }}>
              <h3 style={groupLabelStyle}>PRODUCTOS</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {productoItems.map(renderItemCard)}
              </div>
            </section>
          )}
        </>
      )}

      {/* Spacer to clear the floating bottom-nav */}
      <div style={{ height: '110px' }} />

      {/* Modal Agregar/Editar (logic preserved) */}
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
              {editingService ? 'Editar servicio' : 'Agregar servicio'}
            </h2>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={modalLabelStyle}>Tipo</label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  {(['servicio', 'producto'] as const).map((cat) => {
                    const selected = formData.category === cat
                    return (
                      <button
                        key={cat}
                        type="button"
                        onClick={() => setFormData({ ...formData, category: cat })}
                        style={{
                          flex: 1,
                          padding: '10px 12px',
                          borderRadius: '8px',
                          border: selected ? 'none' : `1px solid ${C.border}`,
                          background: selected ? C.blue : '#F8FAFC',
                          color: selected ? '#fff' : C.slate500,
                          fontFamily: 'Space Grotesk, sans-serif',
                          fontWeight: 600,
                          fontSize: '14px',
                          cursor: 'pointer',
                        }}
                      >
                        {cat === 'servicio' ? 'Servicio' : 'Producto'}
                      </button>
                    )
                  })}
                </div>
              </div>

              <div>
                <label style={modalLabelStyle}>Nombre</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  style={modalInputStyle}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '16px' }}>
                <div>
                  <label style={modalLabelStyle}>Precio ($)</label>
                  <input
                    type="number"
                    value={formData.base_price}
                    onChange={(e) => setFormData({ ...formData, base_price: e.target.value })}
                    style={modalInputStyle}
                  />
                </div>

                {formData.category !== 'producto' && (
                  <div>
                    <label style={modalLabelStyle}>Duración (min)</label>
                    <input
                      type="number"
                      value={formData.duration_min}
                      onChange={(e) => setFormData({ ...formData, duration_min: e.target.value })}
                      style={modalInputStyle}
                    />
                  </div>
                )}
              </div>

              {editingService && (
                <div>
                  <label style={modalLabelStyle}>Estado</label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div
                      onClick={() => setFormData({ ...formData, is_active: !formData.is_active })}
                      style={{
                        width: '36px',
                        height: '20px',
                        borderRadius: '10px',
                        background: formData.is_active ? C.blue : C.border,
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
                    <div style={{ fontFamily: 'Space Grotesk, sans-serif', fontWeight: 400, fontSize: '13px', color: formData.is_active ? C.blue : C.slate400 }}>
                      {formData.is_active ? 'Activo' : 'Inactivo'}
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '28px' }}>
              <button
                onClick={() => setShowModal(false)}
                disabled={saving}
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
                  opacity: saving ? 0.5 : 1,
                }}
              >
                Cancelar
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
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
                  opacity: saving ? 0.5 : 1,
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
  background: `linear-gradient(135deg, ${C.blue} 0%, ${C.blueBright} 100%)`,
  border: 'none',
  borderRadius: '16px',
  padding: '16px 18px',
  display: 'flex',
  alignItems: 'center',
  gap: '14px',
  cursor: 'pointer',
  boxShadow: '0 4px 12px rgba(37,99,235,0.25)',
}

const sectionTitleStyle: React.CSSProperties = {
  fontFamily: 'Syne, sans-serif',
  fontWeight: 700,
  fontSize: 'clamp(15px, 4.36vw, 17px)',
  color: C.ink,
  margin: 0,
  lineHeight: 1.2,
}

const sectionSubtitleStyle: React.CSSProperties = {
  fontFamily: 'Space Grotesk, sans-serif',
  fontWeight: 400,
  fontSize: 'clamp(12px, 3.33vw, 13px)',
  color: C.slate500,
  margin: '4px 0 0',
}

const groupLabelStyle: React.CSSProperties = {
  fontFamily: 'Space Grotesk, sans-serif',
  fontWeight: 600,
  fontSize: '12px',
  textTransform: 'uppercase',
  letterSpacing: '0.08em',
  color: C.slate400,
  margin: '0 0 10px 2px',
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

function ScreenHeader({ tenantName }: { tenantName?: string }) {
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
        Servicios
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
        {tenantName ? `${tenantName} • ` : ''}Catálogo de servicios y precios
      </p>
    </div>
  )
}

function StatCard({
  label,
  value,
  suffix,
  chipBg,
  iconStroke,
  icon,
}: {
  label: string
  value: string
  suffix: string
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
        padding: '14px',
        boxShadow: '0 1px 2px rgba(15,23,42,0.04)',
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        minWidth: 0,
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          width: 38,
          height: 38,
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
      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', minWidth: 0, flex: 1 }}>
        <div
          style={{
            fontFamily: 'Space Grotesk, sans-serif',
            fontWeight: 500,
            fontSize: 'clamp(10px, 2.8vw, 12px)',
            color: C.slate500,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            maxWidth: '100%',
          }}
        >
          {label}
        </div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '5px', flexWrap: 'wrap', minWidth: 0 }}>
          <span
            style={{
              fontFamily: "'Inter', system-ui, sans-serif",
              fontWeight: 800,
              fontSize: 'clamp(18px, 5.4vw, 22px)',
              color: C.ink,
              letterSpacing: '-0.5px',
              lineHeight: 1.05,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              maxWidth: '100%',
            }}
          >
            {value}
          </span>
          <span
            style={{
              fontFamily: 'Space Grotesk, sans-serif',
              fontWeight: 400,
              fontSize: 'clamp(10px, 2.8vw, 12px)',
              color: C.slate400,
              whiteSpace: 'nowrap',
            }}
          >
            {suffix}
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

function ScissorsIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="6" cy="6" r="3" />
      <circle cx="6" cy="18" r="3" />
      <path d="M20 4L8.12 15.88" />
      <path d="M14.47 14.48L20 20" />
      <path d="M8.12 8.12L12 12" />
    </svg>
  )
}

function BoxIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
      <path d="M3.27 6.96L12 12.01l8.73-5.05" />
      <path d="M12 22.08V12" />
    </svg>
  )
}

function CheckBadgeIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 12l2 2 4-4" />
      <path d="M12 3l2.4 1.8 3 .2.2 3L19.4 13l-1.8 2.4-.2 3-3 .2L12 21l-2.4-1.8-3-.2-.2-3L3.6 13l1.8-2.4.2-3 3-.2L12 3z" />
    </svg>
  )
}

function TagIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" />
      <path d="M7 7h.01" />
    </svg>
  )
}

export default Services
