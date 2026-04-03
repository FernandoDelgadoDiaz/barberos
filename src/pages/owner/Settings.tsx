import { useTenantStore } from '../../stores/tenantStore'
import { useState } from 'react'

export function Settings() {
  const { tenant } = useTenantStore()
  const [showAddRule, setShowAddRule] = useState(false)

  // Datos de ejemplo si tenant no tiene commission_rules
  const commissionRules = tenant?.commission_rules || {
    rules: [
      { from_service: 1, to_service: 1, barber_pct: 100, owner_pct: 0 },
      { from_service: 2, to_service: null, barber_pct: 50, owner_pct: 50 },
    ],
    resets_daily: true,
  }

  const formatRule = (rule: any) => {
    if (rule.to_service === null) {
      return `Del servicio ${rule.from_service} en adelante → Barbero ${rule.barber_pct}% / Dueño ${rule.owner_pct}%`
    } else if (rule.from_service === rule.to_service) {
      return `Servicio ${rule.from_service} → Barbero ${rule.barber_pct}% / Dueño ${rule.owner_pct}%`
    } else {
      return `Del servicio ${rule.from_service} al ${rule.to_service} → Barbero ${rule.barber_pct}% / Dueño ${rule.owner_pct}%`
    }
  }

  return (
    <div style={{ maxWidth: '1000px', margin: '0 auto' }}>
      <h1 style={{ fontFamily: 'Syne, sans-serif', fontWeight: 800, fontSize: '32px', color: '#fff', marginBottom: '8px' }}>Configuración</h1>
      <p style={{ color: '#666', fontSize: '14px', marginBottom: '32px' }}>Personaliza tu barbería</p>

      {/* Sección 1 — Identidad de la barbería */}
      <div style={{ background: '#111111', border: '1px solid #1c1c1c', borderRadius: '12px', padding: '32px', marginBottom: '24px' }}>
        <h2 style={{ fontFamily: 'Syne, sans-serif', fontWeight: 800, fontSize: '18px', color: '#fff', marginBottom: '24px' }}>
          Identidad de la barbería
        </h2>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          <div>
            <label style={{ display: 'block', fontFamily: 'Space Grotesk, sans-serif', fontWeight: 400, fontSize: '13px', color: '#666', marginBottom: '8px' }}>
              Nombre de la barbería
            </label>
            <input
              type="text"
              defaultValue={tenant?.name || ''}
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

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
            <div>
              <label style={{ display: 'block', fontFamily: 'Space Grotesk, sans-serif', fontWeight: 400, fontSize: '13px', color: '#666', marginBottom: '8px' }}>
                Color primario
              </label>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <input
                  type="color"
                  defaultValue={tenant?.primary_color || '#B8FF47'}
                  style={{
                    width: '60px',
                    height: '40px',
                    borderRadius: '6px',
                    border: '1px solid #333',
                    cursor: 'pointer',
                  }}
                />
                <div style={{ fontFamily: 'Space Grotesk, sans-serif', fontWeight: 400, fontSize: '14px', color: '#fff' }}>
                  {tenant?.primary_color || '#B8FF47'}
                </div>
              </div>
            </div>

            <div>
              <label style={{ display: 'block', fontFamily: 'Space Grotesk, sans-serif', fontWeight: 400, fontSize: '13px', color: '#666', marginBottom: '8px' }}>
                Color secundario
              </label>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <input
                  type="color"
                  defaultValue={tenant?.secondary_color || '#1a1a1a'}
                  style={{
                    width: '60px',
                    height: '40px',
                    borderRadius: '6px',
                    border: '1px solid #333',
                    cursor: 'pointer',
                  }}
                />
                <div style={{ fontFamily: 'Space Grotesk, sans-serif', fontWeight: 400, fontSize: '14px', color: '#fff' }}>
                  {tenant?.secondary_color || '#1a1a1a'}
                </div>
              </div>
            </div>
          </div>

          <div>
            <label style={{ display: 'block', fontFamily: 'Space Grotesk, sans-serif', fontWeight: 400, fontSize: '13px', color: '#666', marginBottom: '8px' }}>
              Logo
            </label>
            <div style={{
              width: '100%',
              height: '120px',
              background: '#1a1a1a',
              border: '1px dashed #333',
              borderRadius: '6px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#666',
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
      <div style={{ background: '#111111', border: '1px solid #1c1c1c', borderRadius: '12px', padding: '32px', marginBottom: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
          <h2 style={{ fontFamily: 'Syne, sans-serif', fontWeight: 800, fontSize: '18px', color: '#fff' }}>
            Reglas de comisión
          </h2>
          <button
            onClick={() => setShowAddRule(true)}
            style={{
              background: '#B8FF47',
              color: '#080808',
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

        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {commissionRules.rules.map((rule: any, index: number) => (
            <div
              key={index}
              style={{
                background: '#1a1a1a',
                border: '1px solid #333',
                borderRadius: '8px',
                padding: '16px',
                fontFamily: 'Space Grotesk, sans-serif',
                fontWeight: 400,
                fontSize: '14px',
                color: '#fff',
              }}
            >
              {formatRule(rule)}
            </div>
          ))}
        </div>

        <div style={{ marginTop: '16px', fontFamily: 'Space Grotesk, sans-serif', fontWeight: 400, fontSize: '12px', color: '#666' }}>
          {commissionRules.resets_daily ? 'Las reglas se reinician cada día.' : 'Las reglas son acumulativas.'}
        </div>
      </div>

      {/* Sección 3 — Información */}
      <div style={{ background: '#111111', border: '1px solid #1c1c1c', borderRadius: '12px', padding: '32px' }}>
        <h2 style={{ fontFamily: 'Syne, sans-serif', fontWeight: 800, fontSize: '18px', color: '#fff', marginBottom: '24px' }}>
          Información
        </h2>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
          <div>
            <label style={{ display: 'block', fontFamily: 'Space Grotesk, sans-serif', fontWeight: 400, fontSize: '13px', color: '#666', marginBottom: '8px' }}>
              Tenant slug
            </label>
            <div style={{
              background: '#1a1a1a',
              border: '1px solid #333',
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
            <label style={{ display: 'block', fontFamily: 'Space Grotesk, sans-serif', fontWeight: 400, fontSize: '13px', color: '#666', marginBottom: '8px' }}>
              Fecha de creación
            </label>
            <div style={{
              background: '#1a1a1a',
              border: '1px solid #333',
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

      {/* Modal para agregar regla (placeholder) */}
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
            background: '#111111',
            border: '1px solid #1c1c1c',
            borderRadius: '12px',
            padding: '32px',
            width: '100%',
            maxWidth: '480px',
          }}>
            <h2 style={{ fontFamily: 'Syne, sans-serif', fontWeight: 800, fontSize: '20px', color: '#fff', marginBottom: '24px' }}>
              Agregar regla de comisión
            </h2>
            <div style={{ color: '#666', fontFamily: 'Space Grotesk, sans-serif', fontWeight: 400, fontSize: '14px', textAlign: 'center', padding: '20px 0' }}>
              Esta funcionalidad estará disponible próximamente.
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '24px' }}>
              <button
                onClick={() => setShowAddRule(false)}
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
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}