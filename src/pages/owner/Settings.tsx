import { useState, useEffect, useRef } from 'react'
import { useTenantStore } from '../../stores/tenantStore'
import { supabase } from '../../config/supabase'
import type { CommissionRule, CommissionRules, Tenant } from '../../types'
import { TENANT_COVER_BUCKET, getTenantCoverUrl, prepareCoverImage } from '../../utils/tenantCover'
import { TENANT_LOGO_BUCKET, getTenantLogoUrl, prepareTenantLogo } from '../../utils/tenantLogo'
import { TenantLogoAvatar } from '../../components/owner/TenantLogoAvatar'
import '../../styles/owner-premium.css'

export function Settings() {
  const { tenant } = useTenantStore()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [coverBusy, setCoverBusy] = useState(false)
  const [logoBusy, setLogoBusy] = useState(false)
  const logoFileRef = useRef<HTMLInputElement>(null)
  const [coverPosition, setCoverPosition] = useState(50)
  const coverFileRef = useRef<HTMLInputElement>(null)

  // Tenant form data
  const [tenantForm, setTenantForm] = useState({
    name: '',
    opening_time: '09:00',
    closing_time: '21:00',
  })

  // Commission rules
  const [commissionRules, setCommissionRules] = useState<CommissionRules>({
    rules: [],
    resets_daily: true,
  })
  const [showAddRule, setShowAddRule] = useState(false)
  const [newRule, setNewRule] = useState({
    from_service: '',
    to_service: '',
    barber_pct: '',
    owner_pct: '',
  })

  // Load tenant data and commission rules
  useEffect(() => {
    const applyTenant = () => {
      if (!tenant) return
      setTenantForm({
        name: tenant.name || '',
        opening_time: tenant.opening_time || '09:00',
        closing_time: tenant.closing_time || '21:00',
      })
      setCoverPosition(tenant.cover_image_position ?? 50)
      setCommissionRules(tenant.commission_rules || {
        rules: [],
        resets_daily: true,
      })
      setLoading(false)
    }

    if (!tenant) {
      const retryId = setTimeout(() => { applyTenant() }, 500)
      return () => clearTimeout(retryId)
    }

    applyTenant()
  }, [tenant])


  // Portadas: guardado independiente del formulario de comisiones/horarios.
  // Los objetos se aíslan por tenant en Supabase Storage mediante RLS.
  const coverUrl = tenant ? getTenantCoverUrl(tenant.id, tenant.cover_image_path) : null
  const logoUrl = tenant ? getTenantLogoUrl(tenant.id, tenant.logo_url) : null

  const handleCoverUpload = async (file?: File) => {
    if (!tenant || !file || coverBusy) return
    setCoverBusy(true)
    setError(null)
    setSuccess(null)

    let uploadedPath: string | null = null
    const oldPath = tenant.cover_image_path
    try {
      const optimizedImage = await prepareCoverImage(file)
      const path = `${tenant.id}/${crypto.randomUUID()}.jpg`
      const { error: uploadError } = await supabase.storage
        .from(TENANT_COVER_BUCKET)
        .upload(path, optimizedImage, { contentType: 'image/jpeg', upsert: false, cacheControl: '31536000' })
      if (uploadError) throw uploadError
      uploadedPath = path

      const { data, error: updateError } = await supabase
        .from('tenants')
        .update({ cover_image_path: path, cover_image_position: 50 })
        .eq('id', tenant.id)
        .select()
        .single()
      if (updateError || !data) throw updateError ?? new Error('No se pudo guardar la portada.')

      useTenantStore.getState().setTenant(data as Tenant)
      setCoverPosition(50)
      setSuccess('Portada actualizada. Ya se muestra en Inicio.')
      if (oldPath?.startsWith(`${tenant.id}/`) && oldPath !== path) {
        const { error: deleteError } = await supabase.storage.from(TENANT_COVER_BUCKET).remove([oldPath])
        if (deleteError) console.warn('No se pudo limpiar la portada anterior:', deleteError)
      }
    } catch (err: unknown) {
      if (uploadedPath) {
        const { error: cleanupError } = await supabase.storage.from(TENANT_COVER_BUCKET).remove([uploadedPath])
        if (cleanupError) console.warn('No se pudo limpiar una carga incompleta:', cleanupError)
      }
      setError(err instanceof Error ? err.message : 'No se pudo cargar la portada.')
    } finally {
      if (coverFileRef.current) coverFileRef.current.value = ''
      setCoverBusy(false)
    }
  }

  const handleSaveCoverPosition = async () => {
    if (!tenant || coverBusy || !coverUrl) return
    setCoverBusy(true)
    setError(null)
    setSuccess(null)
    try {
      const position = Math.round(Math.min(100, Math.max(0, coverPosition)))
      const { data, error: updateError } = await supabase
        .from('tenants')
        .update({ cover_image_position: position })
        .eq('id', tenant.id)
        .select()
        .single()
      if (updateError || !data) throw updateError ?? new Error('No se pudo guardar el encuadre.')
      useTenantStore.getState().setTenant(data as Tenant)
      setSuccess('Encuadre de la portada guardado.')
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar el encuadre.')
    } finally {
      setCoverBusy(false)
    }
  }

  const handleRemoveCover = async () => {
    if (!tenant || coverBusy || !coverUrl) return
    const oldPath = tenant.cover_image_path
    setCoverBusy(true)
    setError(null)
    setSuccess(null)
    try {
      const { data, error: updateError } = await supabase
        .from('tenants')
        .update({ cover_image_path: null, cover_image_position: 50 })
        .eq('id', tenant.id)
        .select()
        .single()
      if (updateError || !data) throw updateError ?? new Error('No se pudo quitar la portada.')
      useTenantStore.getState().setTenant(data as Tenant)
      setCoverPosition(50)
      setSuccess('Portada quitada. Inicio vuelve al diseño predeterminado.')
      if (oldPath?.startsWith(`${tenant.id}/`)) {
        const { error: deleteError } = await supabase.storage.from(TENANT_COVER_BUCKET).remove([oldPath])
        if (deleteError) console.warn('No se pudo borrar el archivo anterior:', deleteError)
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'No se pudo quitar la portada.')
    } finally {
      setCoverBusy(false)
    }
  }


  // Logo is distinct from the cover image and its Storage policies are tenant-scoped.
  const handleLogoUpload = async (file?: File) => {
    if (!tenant || !file || logoBusy) return
    setLogoBusy(true)
    setError(null)
    setSuccess(null)
    let uploadedPath: string | null = null
    const previous = tenant.logo_url
    try {
      const optimized = await prepareTenantLogo(file)
      const path = tenant.id + '/' + crypto.randomUUID() + '.png'
      const { error: uploadedError } = await supabase.storage.from(TENANT_LOGO_BUCKET)
        .upload(path, optimized, { contentType: 'image/png', upsert: false, cacheControl: '31536000' })
      if (uploadedError) throw uploadedError
      uploadedPath = path

      const { data, error: saveError } = await supabase.from('tenants')
        .update({ logo_url: path }).eq('id', tenant.id).select().single()
      if (saveError || !data) throw saveError ?? new Error('No se pudo guardar el logo.')
      useTenantStore.getState().setTenant(data as Tenant)
      setSuccess('Logo guardado. Ya está disponible en Inicio y Métricas.')
      if (previous?.startsWith(tenant.id + '/') && previous !== path) {
        const { error: oldError } = await supabase.storage.from(TENANT_LOGO_BUCKET).remove([previous])
        if (oldError) console.warn('Logo anterior pendiente de limpieza:', oldError)
      }
    } catch (err: unknown) {
      if (uploadedPath) {
        const { error: cleanup } = await supabase.storage.from(TENANT_LOGO_BUCKET).remove([uploadedPath])
        if (cleanup) console.warn('Logo temporal pendiente de limpieza:', cleanup)
      }
      setError(err instanceof Error ? err.message : 'No se pudo subir el logo.')
    } finally {
      if (logoFileRef.current) logoFileRef.current.value = ''
      setLogoBusy(false)
    }
  }

  const handleRemoveLogo = async () => {
    if (!tenant || !logoUrl || logoBusy) return
    const previous = tenant.logo_url
    setLogoBusy(true)
    setError(null)
    setSuccess(null)
    try {
      const { data, error: saveError } = await supabase.from('tenants')
        .update({ logo_url: null }).eq('id', tenant.id).select().single()
      if (saveError || !data) throw saveError ?? new Error('No se pudo quitar el logo.')
      useTenantStore.getState().setTenant(data as Tenant)
      setSuccess('Logo quitado. Ahora se muestra la inicial del local.')
      if (previous?.startsWith(tenant.id + '/')) {
        const { error: cleanup } = await supabase.storage.from(TENANT_LOGO_BUCKET).remove([previous])
        if (cleanup) console.warn('Logo anterior pendiente de limpieza:', cleanup)
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'No se pudo quitar el logo.')
    } finally {
      setLogoBusy(false)
    }
  }

  const formatRule = (rule: CommissionRule) => {
    if (rule.to_service === null) {
      return `Del servicio ${rule.from_service} en adelante → Barbero ${rule.barber_pct}% / Dueño ${rule.owner_pct}%`
    } else if (rule.from_service === rule.to_service) {
      return `Servicio ${rule.from_service} → Barbero ${rule.barber_pct}% / Dueño ${rule.owner_pct}%`
    } else {
      return `Del servicio ${rule.from_service} al ${rule.to_service} → Barbero ${rule.barber_pct}% / Dueño ${rule.owner_pct}%`
    }
  }

  const validateCommissionRules = (rules: CommissionRule[]): string | null => {
    if (rules.length === 0) return 'Debés configurar al menos una regla de comisión.'
    const sorted = [...rules].sort((a, b) => a.from_service - b.from_service)
    if (sorted[0].from_service !== 1) return 'Las reglas deben comenzar en la atención 1.'
    for (let i = 0; i < sorted.length; i++) {
      const rule = sorted[i]
      if (rule.barber_pct < 0 || rule.owner_pct < 0 || rule.barber_pct > 100 || rule.owner_pct > 100 || rule.barber_pct + rule.owner_pct !== 100) {
        return 'Cada regla debe repartir exactamente el 100% entre barbero y dueño.'
      }
      if (i < sorted.length - 1) {
        if (rule.to_service === null) return 'Solo la última regla puede ser abierta (en adelante).'
        if (sorted[i + 1].from_service !== rule.to_service + 1) return 'Las reglas no pueden tener huecos ni superponerse.'
      } else if (rule.to_service !== null) {
        return 'La última regla debe cubrir desde su inicio en adelante.'
      }
    }
    return null
  }

  const handleAddRule = () => {
    // Validate
    if (!newRule.from_service || !newRule.barber_pct || !newRule.owner_pct) {
      setError('Por favor completa los campos obligatorios')
      return
    }

    const from = parseInt(newRule.from_service)
    const to = newRule.to_service ? parseInt(newRule.to_service) : null
    const barberPct = parseInt(newRule.barber_pct)
    const ownerPct = parseInt(newRule.owner_pct)

    if (from < 1) {
      setError('El servicio inicial debe ser al menos 1')
      return
    }
    if (to !== null && to < from) {
      setError('El servicio final debe ser mayor o igual al inicial')
      return
    }
    if (barberPct < 0 || ownerPct < 0 || barberPct > 100 || ownerPct > 100) {
      setError('Los porcentajes deben estar entre 0% y 100%')
      return
    }
    if (barberPct + ownerPct !== 100) {
      setError('Los porcentajes deben sumar 100%')
      return
    }

    const rule: CommissionRule = {
      from_service: from,
      to_service: to,
      barber_pct: barberPct,
      owner_pct: ownerPct,
    }

    const newRules = [...commissionRules.rules, rule]
    // Sort by from_service ascending
    newRules.sort((a, b) => a.from_service - b.from_service)

    setCommissionRules({
      ...commissionRules,
      rules: newRules,
    })

    setNewRule({
      from_service: '',
      to_service: '',
      barber_pct: '',
      owner_pct: '',
    })
    setShowAddRule(false)
    setError(null)
  }

  const handleRemoveRule = (index: number) => {
    const newRules = [...commissionRules.rules]
    newRules.splice(index, 1)
    setCommissionRules({
      ...commissionRules,
      rules: newRules,
    })
  }

  const handleToggleResetDaily = () => {
    setCommissionRules({
      ...commissionRules,
      resets_daily: !commissionRules.resets_daily,
    })
  }

  const handleSaveTenant = async () => {
    if (!tenant) return

    setSaving(true)
    setError(null)
    setSuccess(null)

    try {
      const commissionError = validateCommissionRules(commissionRules.rules)
      if (commissionError) {
        setError(commissionError)
        return
      }

      const updates: Partial<Tenant> = {
        name: tenantForm.name.trim(),
        opening_time: tenantForm.opening_time,
        closing_time: tenantForm.closing_time,
        commission_rules: commissionRules,
      }

      const { data, error } = await supabase
        .from('tenants')
        .update(updates)
        .eq('id', tenant.id)
        .select()
        .single()

      if (error) throw error

      // Update tenant store
      const store = useTenantStore.getState()
      store.setTenant(data as Tenant)
      setSuccess('Configuración guardada exitosamente')
      setTimeout(() => setSuccess(null), 5000)
    } catch (err: unknown) {
      console.error('Error saving tenant:', err)
      const errorMessage = err instanceof Error ? err.message : 'Error al guardar configuración'
      setError(errorMessage)
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div style={{ maxWidth: '1000px', margin: '0 auto', padding: '40px', textAlign: 'center', color: '#aaa' }}>
        Cargando configuración...
      </div>
    )
  }

  return (
    <div className="premium-settings" style={{ maxWidth: '1000px', margin: '0 auto' }}>
      <h1 className="premium-settings-title" style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: '26px', color: '#1a1a2e', marginBottom: '8px' }}>Configuración</h1>
      <p className="premium-settings-subtitle" style={{ color: '#aaa', fontSize: '14px', marginBottom: '32px' }}>Personalizá tu barbería y administrá sus reglas</p>

      {/* Success message */}
      {success && (
        <div style={{
          background: '#eafaf1',
          border: '0.5px solid #2ecc71',
          borderRadius: '8px',
          padding: '12px 16px',
          marginBottom: '24px',
          color: '#2ecc71',
          fontFamily: 'Space Grotesk, sans-serif',
          fontSize: '14px',
        }}>
          {success}
        </div>
      )}

      {/* Error message — hidden when modal is open (error is shown inside modal instead) */}
      {error && !showAddRule && (
        <div style={{
          background: '#fff5f5',
          border: '0.5px solid #ffcccc',
          borderRadius: '8px',
          padding: '12px 16px',
          marginBottom: '24px',
          color: '#cc3333',
          fontFamily: 'Space Grotesk, sans-serif',
          fontSize: '14px',
        }}>
          {error}
        </div>
      )}

      {/* Sección 1 — Identidad de la barbería */}
      <div className="premium-settings-section" style={{ background: '#fff', border: '0.5px solid #e0e0e0', borderRadius: '10px', padding: '32px', marginBottom: '24px' }}>
        <h2 style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: '18px', color: '#1a1a2e', marginBottom: '24px' }}>
          Identidad de la barbería
        </h2>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          <div>
            <label style={{ display: 'block', fontFamily: 'Space Grotesk, sans-serif', fontWeight: 400, fontSize: '13px', color: '#aaa', marginBottom: '8px' }}>
              Nombre de la barbería
            </label>
            <input
              type="text"
              value={tenantForm.name}
              onChange={(e) => setTenantForm({ ...tenantForm, name: e.target.value })}
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
              }}
            />
          </div>

          {/* La portada es opcional y se configura de forma independiente por tenant. */}
          <section className="premium-cover-settings" aria-label="Foto de portada de la barbería">
            <div className="premium-cover-heading">Foto de portada de Inicio</div>
            <p className="premium-cover-explanation">
              Mostrá tu barbería en el encabezado de Inicio. La foto conserva sus colores; la facturación se muestra debajo, en una tarjeta independiente.
            </p>
            <div className="premium-cover-preview" aria-label="Vista previa del encabezado de Inicio">
              <div
                className={`premium-cover-preview-photo${coverUrl ? ' has-photo' : ''}`}
                style={coverUrl ? {
                  backgroundImage: `url("${coverUrl}")`,
                  backgroundPosition: `center ${coverPosition}%`,
                } : undefined}
                role="img"
                aria-label={coverUrl ? 'Portada del local a color' : 'Sin foto de portada'}
              >
                {!coverUrl && <span>Sin foto de portada</span>}
              </div>
              <div className="premium-cover-preview-name">{tenant?.name || 'Tu barbería'}</div>
              <div className="premium-cover-preview-revenue">
                <span className="premium-cover-preview-label">Facturación hoy</span>
                <strong className="premium-cover-preview-value">—</strong>
                <span className="premium-cover-preview-meta">Ejemplo visual · no son datos de facturación</span>
              </div>
            </div>
            <input
              ref={coverFileRef}
              type="file"
              accept="image/*"
              aria-label="Seleccionar foto de portada"
              className="premium-cover-hidden-file"
              disabled={coverBusy}
              onChange={(e) => { void handleCoverUpload(e.target.files?.[0]) }}
            />
            <div className="premium-cover-actions">
              <button
                type="button"
                className="premium-cover-primary"
                onClick={() => coverFileRef.current?.click()}
                disabled={coverBusy}
              >
                {coverBusy ? 'Guardando...' : coverUrl ? 'Cambiar foto' : 'Subir foto'}
              </button>
              {coverUrl && (
                <button type="button" className="premium-cover-secondary" onClick={() => { void handleRemoveCover() }} disabled={coverBusy}>
                  Quitar foto
                </button>
              )}
            </div>
            <p className="premium-cover-hint">
              JPG, PNG o fotos compatibles con tu celular. Máximo 10 MB; BarberOS las optimiza antes de subirlas. La portada se puede ver en el panel y su archivo tiene una URL pública.
            </p>
            {coverUrl && (
              <div className="premium-cover-position">
                <label htmlFor="cover-vertical-position">Ajustar encuadre de la foto del encabezado</label>
                <input
                  id="cover-vertical-position"
                  type="range"
                  min={0}
                  max={100}
                  value={coverPosition}
                  disabled={coverBusy}
                  onChange={(e) => setCoverPosition(Number(e.target.value))}
                />
                <button type="button" className="premium-cover-secondary" onClick={() => { void handleSaveCoverPosition() }}
                  disabled={coverBusy || coverPosition === (tenant?.cover_image_position ?? 50)}>
                  Guardar encuadre
                </button>
              </div>
            )}
          </section>

          <section className="premium-settings-logo-editor" aria-label="Logo de la barbería">
            <div className="premium-cover-heading">Logo de la barbería</div>
            <p className="premium-cover-explanation">Subí tu logo para el círculo que abre las opciones de cuenta. Es independiente de la foto de portada.</p>
            <div className="premium-settings-logo-row">
              <TenantLogoAvatar tenantId={tenant?.id} logoPath={tenant?.logo_url} name={tenant?.name} />
              <span className="premium-settings-logo-description">
                <strong>{logoUrl ? 'Logo personalizado' : 'Inicial predeterminada'}</strong>
                <small>JPG, PNG o WebP · Máximo 10 MB · Se optimiza automáticamente</small>
              </span>
            </div>
            <input ref={logoFileRef} type="file" className="premium-cover-hidden-file"
              aria-label="Seleccionar logo de la barbería" disabled={logoBusy}
              accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
              onChange={(event) => { void handleLogoUpload(event.target.files?.[0]) }} />
            <div className="premium-cover-actions">
              <button type="button" className="premium-cover-primary" disabled={logoBusy}
                onClick={() => logoFileRef.current?.click()}>
                {logoBusy ? 'Guardando...' : logoUrl ? 'Cambiar logo' : 'Subir logo'}
              </button>
              {logoUrl && (
                <button type="button" className="premium-cover-secondary" disabled={logoBusy}
                  onClick={() => { void handleRemoveLogo() }}>Quitar logo</button>
              )}
            </div>
          </section>

          <div className="premium-settings-hours">
            <label style={{ display: 'block', fontFamily: 'Space Grotesk, sans-serif', fontWeight: 400, fontSize: '13px', color: '#aaa', marginBottom: '8px' }}>
              Horario habitual del local
            </label>
            <p className="premium-settings-hours-note">Se utiliza en Inicio como referencia, sin confirmar apertura real.</p>
            <div className="premium-settings-time-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
              <div>
                <label style={{ display: 'block', fontFamily: 'Space Grotesk, sans-serif', fontWeight: 400, fontSize: '13px', color: '#aaa', marginBottom: '8px' }}>
                  Horario de apertura
                </label>
                <input
                  type="time"
                  value={tenantForm.opening_time}
                  onChange={(e) => setTenantForm({ ...tenantForm, opening_time: e.target.value })}
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
                  }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontFamily: 'Space Grotesk, sans-serif', fontWeight: 400, fontSize: '13px', color: '#aaa', marginBottom: '8px' }}>
                  Horario de cierre
                </label>
                <input
                  type="time"
                  value={tenantForm.closing_time}
                  onChange={(e) => setTenantForm({ ...tenantForm, closing_time: e.target.value })}
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
                  }}
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Sección 2 — Reglas de comisión */}
      <div className="premium-settings-section premium-settings-rules" style={{ background: '#fff', border: '0.5px solid #e0e0e0', borderRadius: '10px', padding: '32px', marginBottom: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
          <h2 style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: '18px', color: '#1a1a2e' }}>
            Reglas de comisión
          </h2>
          <button
            className="premium-settings-add-rule"
            onClick={() => setShowAddRule(true)}
            style={{
              background: 'var(--primary, #3D3A8C)',
              color: '#fff',
              border: 'none',
              borderRadius: '6px',
              padding: '8px 16px',
              fontFamily: 'Space Grotesk, sans-serif',
              fontWeight: 600,
              fontSize: '12px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            Agregar regla
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '20px' }}>
          {commissionRules.rules.length === 0 ? (
            <div style={{
              background: '#f8f8f8',
              border: '1px dashed #e0e0e0',
              borderRadius: '8px',
              padding: '40px 20px',
              textAlign: 'center',
              color: '#aaa',
              fontFamily: 'Space Grotesk, sans-serif',
              fontSize: '14px',
            }}>
              No hay reglas de comisión configuradas. Agrega tu primera regla.
            </div>
          ) : (
            commissionRules.rules.map((rule, index) => (
              <div
                key={index}
                className="premium-settings-rule-card"
                style={{
                  background: '#f8f8f8',
                  border: '0.5px solid #e0e0e0',
                  borderRadius: '8px',
                  padding: '16px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <div style={{ fontFamily: 'Space Grotesk, sans-serif', fontWeight: 400, fontSize: '14px', color: '#1a1a2e' }}>
                  {formatRule(rule)}
                </div>
                <button
                  className="premium-settings-remove-rule"
                  onClick={() => handleRemoveRule(index)}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: '#e94560',
                    cursor: 'pointer',
                    padding: '4px 8px',
                    borderRadius: '4px',
                    fontFamily: 'Space Grotesk, sans-serif',
                    fontSize: '12px',
                  }}
                >
                  Eliminar
                </button>
              </div>
            ))
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontFamily: 'Space Grotesk, sans-serif', fontWeight: 400, fontSize: '12px', color: '#aaa' }}>
              {commissionRules.resets_daily ? 'El tramo de comisión vuelve a empezar cada día.' : 'El tramo de comisión se acumula históricamente.'}
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{ fontFamily: 'Space Grotesk, sans-serif', fontWeight: 400, fontSize: '12px', color: commissionRules.resets_daily ? 'var(--primary, #3D3A8C)' : '#aaa' }}>
              {commissionRules.resets_daily ? 'Reinicio diario' : 'Acumulativo'}
            </div>
            <button type="button" className="premium-settings-switch" role="switch" aria-label="Reinicio diario de comisiones" aria-checked={commissionRules.resets_daily}
              onClick={handleToggleResetDaily}
              style={{
                width: '36px',
                height: '20px',
                borderRadius: '10px',
                background: commissionRules.resets_daily ? 'var(--primary, #3D3A8C)' : '#e0e0e0',
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
                left: commissionRules.resets_daily ? '18px' : '2px',
                transition: 'left 0.2s',
              }} />
            </button>
          </div>
        </div>
      </div>

      {/* Sección 3 — Información */}
      <div className="premium-settings-section" style={{ background: '#fff', border: '0.5px solid #e0e0e0', borderRadius: '10px', padding: '32px', marginBottom: '32px' }}>
        <h2 style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: '18px', color: '#1a1a2e', marginBottom: '24px' }}>
          Información
        </h2>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
          <div>
            <label style={{ display: 'block', fontFamily: 'Space Grotesk, sans-serif', fontWeight: 400, fontSize: '13px', color: '#aaa', marginBottom: '8px' }}>
              Tenant slug
            </label>
            <div style={{
              background: '#f8f8f8',
              border: '0.5px solid #e0e0e0',
              borderRadius: '6px',
              padding: '12px',
              fontFamily: 'Space Grotesk, sans-serif',
              fontWeight: 400,
              fontSize: '14px',
              color: '#1a1a2e',
            }}>
              {tenant?.slug || 'barber-demo'}
            </div>
          </div>

          <div>
            <label style={{ display: 'block', fontFamily: 'Space Grotesk, sans-serif', fontWeight: 400, fontSize: '13px', color: '#aaa', marginBottom: '8px' }}>
              Fecha de creación
            </label>
            <div style={{
              background: '#f8f8f8',
              border: '0.5px solid #e0e0e0',
              borderRadius: '6px',
              padding: '12px',
              fontFamily: 'Space Grotesk, sans-serif',
              fontWeight: 400,
              fontSize: '14px',
              color: '#1a1a2e',
            }}>
              {tenant?.created_at ? new Date(tenant.created_at).toLocaleDateString('es-ES') : '2026-04-03'}
            </div>
          </div>
        </div>
      </div>

      {/* Save button */}
      <div className="premium-settings-save" style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '16px' }}>
        {success && (
          <span style={{
            fontFamily: 'Space Grotesk, sans-serif',
            fontSize: '13px',
            color: '#2ecc71',
          }}>
            ✓ {success}
          </span>
        )}
        {error && !showAddRule && (
          <span style={{
            fontFamily: 'Space Grotesk, sans-serif',
            fontSize: '13px',
            color: '#cc3333',
          }}>
            {error}
          </span>
        )}
        <button
          className="premium-settings-save-button"
          onClick={handleSaveTenant}
          disabled={saving}
          style={{
            background: 'var(--primary, #3D3A8C)',
            color: '#fff',
            border: 'none',
            borderRadius: '8px',
            padding: '14px 32px',
            fontFamily: 'Space Grotesk, sans-serif',
            fontWeight: 600,
            fontSize: '14px',
            cursor: 'pointer',
            opacity: saving ? 0.6 : 1,
          }}
        >
          {saving ? 'Guardando...' : 'Guardar cambios'}
        </button>
      </div>

      {/* Modal para agregar regla */}
      {showAddRule && (
        <div className="premium-settings-modal-overlay" style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
        }}>
          <div className="premium-settings-modal" style={{
            background: '#fff',
            border: '0.5px solid #e0e0e0',
            borderRadius: '12px',
            padding: '32px',
            width: '100%',
            maxWidth: '480px',
            position: 'relative',
            zIndex: 1001,
          }}>
            <h2 style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: '20px', color: '#1a1a2e', marginBottom: '24px' }}>
              Agregar regla de comisión
            </h2>

            {/* Error banner inside modal — visible even with backdrop active */}
            {error && (
              <div style={{
                background: '#fff5f5',
                border: '0.5px solid #ffcccc',
                borderRadius: '8px',
                padding: '10px 14px',
                marginBottom: '16px',
                color: '#cc3333',
                fontFamily: 'Space Grotesk, sans-serif',
                fontSize: '13px',
              }}>
                {error}
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div>
                  <label style={{ display: 'block', fontFamily: 'Space Grotesk, sans-serif', fontWeight: 400, fontSize: '13px', color: '#aaa', marginBottom: '8px' }}>
                    Desde servicio
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={newRule.from_service}
                    onChange={(e) => setNewRule({ ...newRule, from_service: e.target.value })}
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
                    }}
                    placeholder="1"
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontFamily: 'Space Grotesk, sans-serif', fontWeight: 400, fontSize: '13px', color: '#aaa', marginBottom: '8px' }}>
                    Hasta servicio (opcional)
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={newRule.to_service}
                    onChange={(e) => setNewRule({ ...newRule, to_service: e.target.value })}
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
                    }}
                    placeholder="Vacío = infinito"
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div>
                  <label style={{ display: 'block', fontFamily: 'Space Grotesk, sans-serif', fontWeight: 400, fontSize: '13px', color: '#aaa', marginBottom: '8px' }}>
                    % Barbero
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={newRule.barber_pct}
                    onChange={(e) => setNewRule({ ...newRule, barber_pct: e.target.value })}
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
                    }}
                    placeholder="50"
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontFamily: 'Space Grotesk, sans-serif', fontWeight: 400, fontSize: '13px', color: '#aaa', marginBottom: '8px' }}>
                    % Dueño
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={newRule.owner_pct}
                    onChange={(e) => setNewRule({ ...newRule, owner_pct: e.target.value })}
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
                    }}
                    placeholder="50"
                  />
                </div>
              </div>

              <div style={{ fontFamily: 'Space Grotesk, sans-serif', fontSize: '12px', color: '#aaa' }}>
                Los porcentajes deben sumar 100%. Deja vacío "Hasta servicio" para aplicar desde ese servicio en adelante.
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '32px' }}>
              <button
                onClick={() => {
                  setShowAddRule(false)
                  setError(null)
                }}
                style={{
                  background: 'transparent',
                  border: '0.5px solid #e0e0e0',
                  borderRadius: '6px',
                  padding: '10px 20px',
                  fontFamily: 'Space Grotesk, sans-serif',
                  fontWeight: 500,
                  fontSize: '14px',
                  color: '#aaa',
                  cursor: 'pointer',
                }}
              >
                Cancelar
              </button>
              <button
                onClick={handleAddRule}
                style={{
                  background: 'var(--primary, #3D3A8C)',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '6px',
                  padding: '10px 20px',
                  fontFamily: 'Space Grotesk, sans-serif',
                  fontWeight: 600,
                  fontSize: '14px',
                  cursor: 'pointer',
                }}
              >
                Agregar regla
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
