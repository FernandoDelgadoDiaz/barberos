import { useState, useEffect } from 'react'
import { useTenantStore } from '../../stores/tenantStore'
import { supabase } from '../../config/supabase'
import type { CommissionRule, CommissionRules, Tenant } from '../../types'

export function Settings() {
  const { tenant, setTenant } = useTenantStore()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  // Tenant form data
  const [tenantForm, setTenantForm] = useState({
    name: '',
    primary_color: '',
    secondary_color: '',
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
    if (!tenant) return

    setTenantForm({
      name: tenant.name || '',
      primary_color: tenant.primary_color || '#C8A97E',
      secondary_color: tenant.secondary_color || '#1a1a1a',
    })

    setCommissionRules(tenant.commission_rules || {
      rules: [],
      resets_daily: true,
    })

    setLoading(false)
  }, [tenant])

  const formatRule = (rule: CommissionRule) => {
    if (rule.to_service === null) {
      return `Del servicio ${rule.from_service} en adelante → Barbero ${rule.barber_pct}% / Dueño ${rule.owner_pct}%`
    } else if (rule.from_service === rule.to_service) {
      return `Servicio ${rule.from_service} → Barbero ${rule.barber_pct}% / Dueño ${rule.owner_pct}%`
    } else {
      return `Del servicio ${rule.from_service} al ${rule.to_service} → Barbero ${rule.barber_pct}% / Dueño ${rule.owner_pct}%`
    }
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
      const updates: Partial<Tenant> = {
        name: tenantForm.name.trim(),
        primary_color: tenantForm.primary_color,
        secondary_color: tenantForm.secondary_color,
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
      setTenant(data as Tenant)
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
      <div style={{ maxWidth: '1000px', margin: '0 auto', padding: '40px', textAlign: 'center', color: '#888' }}>
        Cargando configuración...
      </div>
    )
  }

  return (
    <div style={{ maxWidth: '1000px', margin: '0 auto', background: '#1a1a1a', color: '#fff', padding: '24px', borderRadius: '12px' }}>
      <h1 style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: '26px', color: '#fff', marginBottom: '8px' }}>Configuración</h1>
      <p style={{ color: '#888', fontSize: '14px', marginBottom: '32px' }}>Personaliza tu barbería</p>

      {/* Success message */}
      {success && (
        <div style={{
          background: '#2a2a2a',
          border: '1px solid #C8A97E',
          borderRadius: '8px',
          padding: '12px 16px',
          marginBottom: '24px',
          color: '#C8A97E',
          fontFamily: 'Space Grotesk, sans-serif',
          fontSize: '14px',
        }}>
          {success}
        </div>
      )}

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

      {/* Sección 1 — Identidad de la barbería */}
      <div style={{ background: '#2a2a2a', border: '1px solid #383838', borderRadius: '12px', padding: '32px', marginBottom: '24px' }}>
        <h2 style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: '18px', color: '#fff', marginBottom: '24px' }}>
          Identidad de la barbería
        </h2>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          <div>
            <label style={{ display: 'block', fontFamily: 'Space Grotesk, sans-serif', fontWeight: 400, fontSize: '13px', color: '#888', marginBottom: '8px' }}>
              Nombre de la barbería
            </label>
            <input
              type="text"
              value={tenantForm.name}
              onChange={(e) => setTenantForm({ ...tenantForm, name: e.target.value })}
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

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
            <div>
              <label style={{ display: 'block', fontFamily: 'Space Grotesk, sans-serif', fontWeight: 400, fontSize: '13px', color: '#888', marginBottom: '8px' }}>
                Color primario
              </label>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <input
                  type="color"
                  value={tenantForm.primary_color}
                  onChange={(e) => setTenantForm({ ...tenantForm, primary_color: e.target.value })}
                  style={{
                    width: '60px',
                    height: '40px',
                    borderRadius: '6px',
                    border: '1px solid #383838',
                    cursor: 'pointer',
                  }}
                />
                <div style={{ fontFamily: 'Space Grotesk, sans-serif', fontWeight: 400, fontSize: '14px', color: '#fff' }}>
                  {tenantForm.primary_color}
                </div>
              </div>
            </div>

            <div>
              <label style={{ display: 'block', fontFamily: 'Space Grotesk, sans-serif', fontWeight: 400, fontSize: '13px', color: '#888', marginBottom: '8px' }}>
                Color secundario
              </label>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <input
                  type="color"
                  value={tenantForm.secondary_color}
                  onChange={(e) => setTenantForm({ ...tenantForm, secondary_color: e.target.value })}
                  style={{
                    width: '60px',
                    height: '40px',
                    borderRadius: '6px',
                    border: '1px solid #383838',
                    cursor: 'pointer',
                  }}
                />
                <div style={{ fontFamily: 'Space Grotesk, sans-serif', fontWeight: 400, fontSize: '14px', color: '#fff' }}>
                  {tenantForm.secondary_color}
                </div>
              </div>
            </div>
          </div>

          <div>
            <label style={{ display: 'block', fontFamily: 'Space Grotesk, sans-serif', fontWeight: 400, fontSize: '13px', color: '#888', marginBottom: '8px' }}>
              Logo
            </label>
            <div style={{
              width: '100%',
              height: '120px',
              background: '#2a2a2a',
              border: '1px dashed #383838',
              borderRadius: '6px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#888',
              fontFamily: 'Space Grotesk, sans-serif',
              fontWeight: 400,
              fontSize: '14px',
            }}>
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginBottom: '8px' }}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              Sube tu logo (próximamente)
            </div>
          </div>
        </div>
      </div>

      {/* Sección 2 — Reglas de comisión */}
      <div style={{ background: '#2a2a2a', border: '1px solid #383838', borderRadius: '12px', padding: '32px', marginBottom: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
          <h2 style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: '18px', color: '#fff' }}>
            Reglas de comisión
          </h2>
          <button
            onClick={() => setShowAddRule(true)}
            style={{
              background: '#C8A97E',
              color: '#1a1a1a',
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
              background: '#2a2a2a',
              border: '1px dashed #383838',
              borderRadius: '8px',
              padding: '40px 20px',
              textAlign: 'center',
              color: '#888',
              fontFamily: 'Space Grotesk, sans-serif',
              fontSize: '14px',
            }}>
              No hay reglas de comisión configuradas. Agrega tu primera regla.
            </div>
          ) : (
            commissionRules.rules.map((rule, index) => (
              <div
                key={index}
                style={{
                  background: '#2a2a2a',
                  border: '1px solid #383838',
                  borderRadius: '8px',
                  padding: '16px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <div style={{ fontFamily: 'Space Grotesk, sans-serif', fontWeight: 400, fontSize: '14px', color: '#fff' }}>
                  {formatRule(rule)}
                </div>
                <button
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
            <div style={{ fontFamily: 'Space Grotesk, sans-serif', fontWeight: 400, fontSize: '12px', color: '#888' }}>
              {commissionRules.resets_daily ? 'Las reglas se reinician cada día.' : 'Las reglas son acumulativas.'}
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{ fontFamily: 'Space Grotesk, sans-serif', fontWeight: 400, fontSize: '12px', color: commissionRules.resets_daily ? '#C8A97E' : '#888' }}>
              {commissionRules.resets_daily ? 'Reinicio diario' : 'Acumulativo'}
            </div>
            <div
              onClick={handleToggleResetDaily}
              style={{
                width: '36px',
                height: '20px',
                borderRadius: '10px',
                background: commissionRules.resets_daily ? '#C8A97E' : '#383838',
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
            </div>
          </div>
        </div>
      </div>

      {/* Sección 3 — Información */}
      <div style={{ background: '#2a2a2a', border: '1px solid #383838', borderRadius: '12px', padding: '32px', marginBottom: '32px' }}>
        <h2 style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: '18px', color: '#fff', marginBottom: '24px' }}>
          Información
        </h2>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
          <div>
            <label style={{ display: 'block', fontFamily: 'Space Grotesk, sans-serif', fontWeight: 400, fontSize: '13px', color: '#888', marginBottom: '8px' }}>
              Tenant slug
            </label>
            <div style={{
              background: '#2a2a2a',
              border: '1px solid #383838',
              borderRadius: '6px',
              padding: '12px',
              fontFamily: 'Space Grotesk, sans-serif',
              fontWeight: 400,
              fontSize: '14px',
              color: '#fff',
            }}>
              {tenant?.slug || 'barber-demo'}
            </div>
          </div>

          <div>
            <label style={{ display: 'block', fontFamily: 'Space Grotesk, sans-serif', fontWeight: 400, fontSize: '13px', color: '#888', marginBottom: '8px' }}>
              Fecha de creación
            </label>
            <div style={{
              background: '#2a2a2a',
              border: '1px solid #383838',
              borderRadius: '6px',
              padding: '12px',
              fontFamily: 'Space Grotesk, sans-serif',
              fontWeight: 400,
              fontSize: '14px',
              color: '#fff',
            }}>
              {tenant?.created_at ? new Date(tenant.created_at).toLocaleDateString('es-ES') : '2026-04-03'}
            </div>
          </div>
        </div>
      </div>

      {/* Save button */}
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <button
          onClick={handleSaveTenant}
          disabled={saving}
          style={{
            background: '#C8A97E',
            color: '#1a1a1a',
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
              Agregar regla de comisión
            </h2>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div>
                  <label style={{ display: 'block', fontFamily: 'Space Grotesk, sans-serif', fontWeight: 400, fontSize: '13px', color: '#888', marginBottom: '8px' }}>
                    Desde servicio
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={newRule.from_service}
                    onChange={(e) => setNewRule({ ...newRule, from_service: e.target.value })}
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
                    placeholder="1"
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontFamily: 'Space Grotesk, sans-serif', fontWeight: 400, fontSize: '13px', color: '#888', marginBottom: '8px' }}>
                    Hasta servicio (opcional)
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={newRule.to_service}
                    onChange={(e) => setNewRule({ ...newRule, to_service: e.target.value })}
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
                    placeholder="Vacío = infinito"
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div>
                  <label style={{ display: 'block', fontFamily: 'Space Grotesk, sans-serif', fontWeight: 400, fontSize: '13px', color: '#888', marginBottom: '8px' }}>
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
                      background: '#2a2a2a',
                      border: '1px solid #383838',
                      borderRadius: '6px',
                      padding: '12px',
                      fontFamily: 'Space Grotesk, sans-serif',
                      fontWeight: 400,
                      fontSize: '14px',
                      color: '#fff',
                    }}
                    placeholder="50"
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontFamily: 'Space Grotesk, sans-serif', fontWeight: 400, fontSize: '13px', color: '#888', marginBottom: '8px' }}>
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
                      background: '#2a2a2a',
                      border: '1px solid #383838',
                      borderRadius: '6px',
                      padding: '12px',
                      fontFamily: 'Space Grotesk, sans-serif',
                      fontWeight: 400,
                      fontSize: '14px',
                      color: '#fff',
                    }}
                    placeholder="50"
                  />
                </div>
              </div>

              <div style={{ fontFamily: 'Space Grotesk, sans-serif', fontSize: '12px', color: '#888' }}>
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
                onClick={handleAddRule}
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
                Agregar regla
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}