import { useEffect, useState } from 'react'
import { supabase } from '../../config/supabase'
import type { Tenant } from '../../types'

type TenantWithStats = Tenant & {
  total_barberos: number
  total_servicios: number
  total_facturado: number
}

export function Tenants() {
  const [tenants, setTenants] = useState<TenantWithStats[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    loadTenants()
  }, [])

  const loadTenants = async () => {
    try {
      setLoading(true)
      // 1. Obtener todos los tenants
      const { data: tenantsData, error: tenantsError } = await supabase
        .from('tenants')
        .select('*')
        .order('created_at', { ascending: false })

      if (tenantsError) throw tenantsError

      // 2. Obtener conteo de barberos por tenant (solo role='barber')
      const { data: barberCounts, error: barberError } = await supabase
        .from('profiles')
        .select('tenant_id')
        .eq('role', 'barber')

      if (barberError) throw barberError

      // 3. Obtener estadísticas de service_logs por tenant
      const { data: serviceLogs, error: logsError } = await supabase
        .from('service_logs')
        .select('tenant_id, price_charged')

      if (logsError) throw logsError

      // Calcular agregados
      const barberCountsMap = barberCounts.reduce((acc, item) => {
        acc[item.tenant_id] = (acc[item.tenant_id] || 0) + 1
        return acc
      }, {} as Record<string, number>)

      const serviceStatsMap = serviceLogs.reduce((acc, item) => {
        if (!acc[item.tenant_id]) {
          acc[item.tenant_id] = { count: 0, sum: 0 }
        }
        acc[item.tenant_id].count += 1
        acc[item.tenant_id].sum += item.price_charged
        return acc
      }, {} as Record<string, { count: number, sum: number }>)

      const transformed = tenantsData.map((tenant) => ({
        ...tenant,
        total_barberos: barberCountsMap[tenant.id] || 0,
        total_servicios: serviceStatsMap[tenant.id]?.count || 0,
        total_facturado: serviceStatsMap[tenant.id]?.sum || 0,
      }))

      setTenants(transformed)
    } catch (err) {
      console.error('Error loading tenants:', err)
      setError(err instanceof Error ? err.message : 'Error al cargar barberías')
    } finally {
      setLoading(false)
    }
  }

  const toggleTenantStatus = async (tenantId: string, currentStatus: boolean) => {
    try {
      const { error } = await supabase
        .from('tenants')
        .update({ is_active: !currentStatus })
        .eq('id', tenantId)

      if (error) throw error

      // Actualizar estado local
      setTenants(prev =>
        prev.map(tenant =>
          tenant.id === tenantId ? { ...tenant, is_active: !currentStatus } : tenant
        )
      )
    } catch (err) {
      console.error('Error updating tenant status:', err)
      setError(err instanceof Error ? err.message : 'Error al actualizar estado')
    }
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount)
  }

  return (
    <div style={{ padding: '32px', maxWidth: '1200px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{ marginBottom: '32px' }}>
        <h1 style={{ fontSize: '32px', fontFamily: 'Syne, sans-serif', fontWeight: 700, color: '#ffffff', marginBottom: '8px' }}>
          Gestión de Barberías
        </h1>
        <p style={{ color: '#999999' }}>Administrador del sistema • Superadmin</p>
      </div>

      {/* Stats summary */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '24px', marginBottom: '32px' }}>
        <div style={{ background: '#242424', border: '1px solid #383838', borderRadius: '12px', padding: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div style={{ padding: '12px', background: 'rgba(200, 169, 126, 0.1)', borderRadius: '8px' }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#C8A97E" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
            </div>
            <div>
              <div style={{ fontSize: '14px', color: '#999999' }}>Total barberías</div>
              <div style={{ fontSize: '24px', fontWeight: 700, color: '#ffffff' }}>{tenants.length}</div>
            </div>
          </div>
        </div>

        <div style={{ background: '#242424', border: '1px solid #383838', borderRadius: '12px', padding: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div style={{ padding: '12px', background: 'rgba(200, 169, 126, 0.1)', borderRadius: '8px' }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#C8A97E" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            </div>
            <div>
              <div style={{ fontSize: '14px', color: '#999999' }}>Total barberos</div>
              <div style={{ fontSize: '24px', fontWeight: 700, color: '#ffffff' }}>
                {tenants.reduce((sum, tenant) => sum + tenant.total_barberos, 0)}
              </div>
            </div>
          </div>
        </div>

        <div style={{ background: '#242424', border: '1px solid #383838', borderRadius: '12px', padding: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div style={{ padding: '12px', background: 'rgba(200, 169, 126, 0.1)', borderRadius: '8px' }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#C8A97E" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
            </div>
            <div>
              <div style={{ fontSize: '14px', color: '#999999' }}>Total servicios</div>
              <div style={{ fontSize: '24px', fontWeight: 700, color: '#ffffff' }}>
                {tenants.reduce((sum, tenant) => sum + tenant.total_servicios, 0)}
              </div>
            </div>
          </div>
        </div>

        <div style={{ background: '#242424', border: '1px solid #383838', borderRadius: '12px', padding: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div style={{ padding: '12px', background: 'rgba(200, 169, 126, 0.1)', borderRadius: '8px' }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#C8A97E" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <div style={{ fontSize: '14px', color: '#999999' }}>Total facturado</div>
              <div style={{ fontSize: '24px', fontWeight: 700, color: '#ffffff' }}>
                {formatCurrency(tenants.reduce((sum, tenant) => sum + tenant.total_facturado, 0))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main table */}
      <div style={{ background: '#242424', border: '1px solid #383838', borderRadius: '16px', overflow: 'hidden' }}>
        <div style={{ padding: '24px', borderBottom: '1px solid #383838' }}>
          <h2 style={{ fontSize: '20px', fontWeight: 600, color: '#ffffff' }}>Todas las barberías</h2>
          <p style={{ color: '#999999', fontSize: '14px' }}>Listado completo con estadísticas</p>
        </div>

        {loading ? (
          <div style={{ padding: '48px', textAlign: 'center' }}>
            <div style={{ display: 'inline-block', width: '40px', height: '40px', border: '3px solid #383838', borderTopColor: '#C8A97E', borderRadius: '9999px', animation: 'spin 1s linear infinite' }} />
            <p style={{ marginTop: '16px', color: '#999999' }}>Cargando barberías...</p>
          </div>
        ) : error ? (
          <div style={{ padding: '48px', textAlign: 'center' }}>
            <div style={{ padding: '16px', background: '#2a2a2a', border: '1px solid #383838', borderRadius: '12px', display: 'inline-block' }}>
              <p style={{ color: '#e94560', fontSize: '14px' }}>{error}</p>
            </div>
            <button
              onClick={loadTenants}
              style={{ marginTop: '16px', padding: '10px 20px', background: 'transparent', color: '#C8A97E', border: '1px solid #C8A97E', borderRadius: '8px', cursor: 'pointer' }}
            >
              Reintentar
            </button>
          </div>
        ) : tenants.length === 0 ? (
          <div style={{ padding: '48px', textAlign: 'center' }}>
            <p style={{ color: '#999999' }}>No hay barberías registradas</p>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#2a2a2a' }}>
                  <th style={{ textAlign: 'left', padding: '16px 24px', color: '#999999', fontSize: '14px', fontWeight: 500, borderBottom: '1px solid #383838' }}>Nombre</th>
                  <th style={{ textAlign: 'left', padding: '16px 24px', color: '#999999', fontSize: '14px', fontWeight: 500, borderBottom: '1px solid #383838' }}>Slug</th>
                  <th style={{ textAlign: 'left', padding: '16px 24px', color: '#999999', fontSize: '14px', fontWeight: 500, borderBottom: '1px solid #383838' }}>Barberos</th>
                  <th style={{ textAlign: 'left', padding: '16px 24px', color: '#999999', fontSize: '14px', fontWeight: 500, borderBottom: '1px solid #383838' }}>Servicios</th>
                  <th style={{ textAlign: 'left', padding: '16px 24px', color: '#999999', fontSize: '14px', fontWeight: 500, borderBottom: '1px solid #383838' }}>Facturado</th>
                  <th style={{ textAlign: 'left', padding: '16px 24px', color: '#999999', fontSize: '14px', fontWeight: 500, borderBottom: '1px solid #383838' }}>Estado</th>
                  <th style={{ textAlign: 'left', padding: '16px 24px', color: '#999999', fontSize: '14px', fontWeight: 500, borderBottom: '1px solid #383838' }}>Creado</th>
                  <th style={{ textAlign: 'left', padding: '16px 24px', color: '#999999', fontSize: '14px', fontWeight: 500, borderBottom: '1px solid #383838' }}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {tenants.map((tenant) => (
                  <tr key={tenant.id} style={{ borderBottom: '1px solid #383838' }}>
                    <td style={{ padding: '16px 24px', color: '#ffffff' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: tenant.primary_color }} />
                        <div>
                          <div style={{ fontWeight: 600 }}>{tenant.name}</div>
                          <div style={{ fontSize: '12px', color: '#999999' }}>ID: {tenant.id.slice(0, 8)}...</div>
                        </div>
                      </div>
                    </td>
                    <td style={{ padding: '16px 24px', color: '#ffffff', fontFamily: 'monospace', fontSize: '14px' }}>
                      {tenant.slug}
                    </td>
                    <td style={{ padding: '16px 24px', color: '#ffffff' }}>
                      <span style={{ fontWeight: 600 }}>{tenant.total_barberos}</span>
                      <span style={{ fontSize: '12px', color: '#999999', marginLeft: '4px' }}>activos</span>
                    </td>
                    <td style={{ padding: '16px 24px', color: '#ffffff' }}>
                      <span style={{ fontWeight: 600 }}>{tenant.total_servicios}</span>
                      <span style={{ fontSize: '12px', color: '#999999', marginLeft: '4px' }}>registrados</span>
                    </td>
                    <td style={{ padding: '16px 24px', color: '#ffffff' }}>
                      <span style={{ fontWeight: 600, color: '#C8A97E' }}>{formatCurrency(tenant.total_facturado)}</span>
                    </td>
                    <td style={{ padding: '16px 24px' }}>
                      <button
                        onClick={() => toggleTenantStatus(tenant.id, tenant.is_active)}
                        style={{
                          padding: '6px 12px',
                          background: tenant.is_active ? 'rgba(200, 169, 126, 0.1)' : 'rgba(255, 255, 255, 0.05)',
                          color: tenant.is_active ? '#C8A97E' : '#999999',
                          border: `1px solid ${tenant.is_active ? '#C8A97E' : '#383838'}`,
                          borderRadius: '6px',
                          fontSize: '12px',
                          fontWeight: 500,
                          cursor: 'pointer',
                          transition: 'all 0.2s',
                        }}
                      >
                        {tenant.is_active ? 'Activo' : 'Inactivo'}
                      </button>
                    </td>
                    <td style={{ padding: '16px 24px', color: '#999999', fontSize: '14px' }}>
                      {new Date(tenant.created_at).toLocaleDateString('es-AR')}
                    </td>
                    <td style={{ padding: '16px 24px' }}>
                      <button
                        style={{
                          padding: '8px 16px',
                          background: 'transparent',
                          color: '#C8A97E',
                          border: '1px solid #C8A97E',
                          borderRadius: '8px',
                          fontSize: '14px',
                          fontWeight: 500,
                          cursor: 'pointer',
                          transition: 'all 0.2s',
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(200, 169, 126, 0.1)'}
                        onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                      >
                        Ver detalles
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Table footer */}
        <div style={{ padding: '24px', borderTop: '1px solid #383838', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ color: '#999999', fontSize: '14px' }}>
            Mostrando {tenants.length} barberías
          </div>
          <div style={{ display: 'flex', gap: '12px' }}>
            <button
              onClick={loadTenants}
              style={{
                padding: '10px 20px',
                background: 'transparent',
                color: '#999999',
                border: '1px solid #383838',
                borderRadius: '8px',
                fontSize: '14px',
                fontWeight: 500,
                cursor: 'pointer',
              }}
            >
              Refrescar
            </button>
            <button
              style={{
                padding: '10px 20px',
                background: '#C8A97E',
                color: '#1a1a1a',
                border: 'none',
                borderRadius: '8px',
                fontSize: '14px',
                fontWeight: 600,
                cursor: 'pointer',
              }}
              onClick={() => window.open('/register', '_blank')}
            >
              + Nueva barbería
            </button>
          </div>
        </div>
      </div>

      {/* Global styles for spinner animation */}
      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  )
}