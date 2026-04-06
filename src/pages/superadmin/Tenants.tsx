import { useEffect, useState } from 'react'
import { supabase } from '../../config/supabase'
import type { Tenant, Profile, ServiceCatalog } from '../../types'

async function getAuthHeader(): Promise<string> {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session?.access_token) {
    throw new Error('No authenticated session')
  }
  return `Bearer ${session.access_token}`
}

type TenantWithStats = Tenant & {
  total_barberos: number
  total_servicios: number
  total_facturado: number
}

type TenantDetails = Tenant & {
  barberos: Array<Pick<Profile, 'id' | 'display_name' | 'is_active' | 'created_at'>>
  servicios: Array<Pick<ServiceCatalog, 'id' | 'name' | 'base_price' | 'duration_min' | 'is_active'>>
  metricas_recientes: {
    servicios_completados: number
    facturacion_total: number
    turnos_activos: number
  }
}

export function Tenants() {
  const [tenants, setTenants] = useState<TenantWithStats[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showDetailsModal, setShowDetailsModal] = useState(false)
  const [selectedTenant, setSelectedTenant] = useState<TenantWithStats | null>(null)
  const [tenantDetails, setTenantDetails] = useState<TenantDetails | null>(null)
  const [loadingDetails, setLoadingDetails] = useState(false)
  const [errorDetails, setErrorDetails] = useState<string | null>(null)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [deleteConfirmationText, setDeleteConfirmationText] = useState('')
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    loadTenants()
  }, [])

  const loadTenants = async () => {
    try {
      setLoading(true)
      const authHeader = await getAuthHeader()
      const response = await fetch('/api/get-tenants', {
        headers: {
          'Authorization': authHeader,
        },
      })
      if (!response.ok) {
        if (response.status === 403) {
          throw new Error('Acceso denegado: se requiere rol superadmin')
        }
        throw new Error(`Error ${response.status}: ${response.statusText}`)
      }
      const tenantsData = await response.json()
      setTenants(tenantsData)
    } catch (err) {
      console.error('Error loading tenants:', err)
      setError(err instanceof Error ? err.message : 'Error al cargar barberías')
    } finally {
      setLoading(false)
    }
  }

  const toggleTenantStatus = async (tenantId: string, currentStatus: boolean) => {
    try {
      const authHeader = await getAuthHeader()
      const response = await fetch('/api/toggle-tenant', {
        method: 'POST',
        headers: {
          'Authorization': authHeader,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          tenant_id: tenantId,
          is_active: !currentStatus,
        }),
      })
      if (!response.ok) {
        if (response.status === 403) {
          throw new Error('Acceso denegado: se requiere rol superadmin')
        }
        throw new Error(`Error ${response.status}: ${response.statusText}`)
      }
      const updatedTenant = await response.json()
      // Actualizar estado local
      setTenants(prev =>
        prev.map(tenant =>
          tenant.id === tenantId ? { ...tenant, is_active: updatedTenant.is_active } : tenant
        )
      )
    } catch (err) {
      console.error('Error updating tenant status:', err)
      setError(err instanceof Error ? err.message : 'Error al actualizar estado')
    }
  }

  const handleViewDetails = async (tenant: TenantWithStats) => {
    setSelectedTenant(tenant)
    setShowDetailsModal(true)
    setLoadingDetails(true)
    setErrorDetails(null)
    try {
      const authHeader = await getAuthHeader()
      const response = await fetch(`/api/get-tenant-details?tenant_id=${tenant.id}`, {
        headers: { 'Authorization': authHeader }
      })
      if (!response.ok) {
        if (response.status === 403) {
          throw new Error('Acceso denegado: se requiere rol superadmin')
        }
        throw new Error(`Error ${response.status}: ${response.statusText}`)
      }
      const details = await response.json()
      setTenantDetails(details)
    } catch (err) {
      console.error('Error loading tenant details:', err)
      setErrorDetails(err instanceof Error ? err.message : 'Error al cargar detalles')
    } finally {
      setLoadingDetails(false)
    }
  }

  const handleDeleteTenant = (tenant: TenantWithStats) => {
    if (tenant.is_active) {
      setError('No se puede eliminar una barbería activa')
      return
    }
    setSelectedTenant(tenant)
    setDeleteConfirmationText('')
    setShowDeleteModal(true)
  }

  const confirmDelete = async () => {
    if (!selectedTenant || deleteConfirmationText !== selectedTenant.slug) return

    setDeleting(true)
    try {
      const authHeader = await getAuthHeader()
      const response = await fetch('/api/delete-tenant', {
        method: 'POST',
        headers: {
          'Authorization': authHeader,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ tenant_id: selectedTenant.id })
      })

      if (!response.ok) {
        if (response.status === 403) {
          throw new Error('Acceso denegado: se requiere rol superadmin')
        }
        throw new Error(`Error ${response.status}: ${response.statusText}`)
      }

      // Actualizar lista optimista
      setTenants(prev => prev.filter(t => t.id !== selectedTenant.id))
      setShowDeleteModal(false)
      setDeleteConfirmationText('')
    } catch (err) {
      console.error('Error deleting tenant:', err)
      setError(err instanceof Error ? err.message : 'Error al eliminar barbería')
    } finally {
      setDeleting(false)
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
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--secondary, #C8A97E)" strokeWidth="2">
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
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--secondary, #C8A97E)" strokeWidth="2">
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
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--secondary, #C8A97E)" strokeWidth="2">
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
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--secondary, #C8A97E)" strokeWidth="2">
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
            <div style={{ display: 'inline-block', width: '40px', height: '40px', border: '3px solid #383838', borderTopColor: 'var(--secondary, #C8A97E)', borderRadius: '9999px', animation: 'spin 1s linear infinite' }} />
            <p style={{ marginTop: '16px', color: '#999999' }}>Cargando barberías...</p>
          </div>
        ) : error ? (
          <div style={{ padding: '48px', textAlign: 'center' }}>
            <div style={{ padding: '16px', background: '#2a2a2a', border: '1px solid #383838', borderRadius: '12px', display: 'inline-block' }}>
              <p style={{ color: '#e94560', fontSize: '14px' }}>{error}</p>
            </div>
            <button
              onClick={loadTenants}
              style={{ marginTop: '16px', padding: '10px 20px', background: 'transparent', color: 'var(--secondary, #C8A97E)', border: '1px solid var(--secondary, #C8A97E)', borderRadius: '8px', cursor: 'pointer' }}
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
                      <span style={{ fontWeight: 600, color: 'var(--secondary, #C8A97E)' }}>{formatCurrency(tenant.total_facturado)}</span>
                    </td>
                    <td style={{ padding: '16px 24px' }}>
                      <button
                        onClick={() => toggleTenantStatus(tenant.id, tenant.is_active)}
                        style={{
                          padding: '6px 12px',
                          background: tenant.is_active ? 'rgba(200, 169, 126, 0.1)' : 'rgba(255, 255, 255, 0.05)',
                          color: tenant.is_active ? 'var(--secondary, #C8A97E)' : '#999999',
                          border: `1px solid ${tenant.is_active ? 'var(--secondary, #C8A97E)' : '#383838'}`,
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
                      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                        <button
                          onClick={() => handleViewDetails(tenant)}
                          style={{
                            padding: '8px 16px',
                            background: 'transparent',
                            color: 'var(--secondary, #C8A97E)',
                            border: '1px solid var(--secondary, #C8A97E)',
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
                        {!tenant.is_active && (
                          <button
                            onClick={() => handleDeleteTenant(tenant)}
                            style={{
                              padding: '8px 16px',
                              background: 'transparent',
                              color: '#e94560',
                              border: '1px solid #e94560',
                              borderRadius: '8px',
                              fontSize: '14px',
                              fontWeight: 500,
                              cursor: 'pointer',
                              transition: 'all 0.2s',
                            }}
                            onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(233, 69, 96, 0.1)'}
                            onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                          >
                            Eliminar
                          </button>
                        )}
                      </div>
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
                background: 'var(--secondary, #C8A97E)',
                color: 'var(--primary, #1a1a1a)',
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

      {/* Modal de detalles del tenant */}
      {showDetailsModal && selectedTenant && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.8)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: '20px',
        }}>
          <div style={{
            backgroundColor: '#1a1a1a',
            borderRadius: '16px',
            border: '1px solid #383838',
            maxWidth: '900px',
            width: '100%',
            maxHeight: '90vh',
            overflowY: 'auto',
            position: 'relative',
          }}>
            {/* Header */}
            <div style={{
              padding: '24px',
              borderBottom: '1px solid #383838',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}>
              <div>
                <h2 style={{ fontSize: '24px', fontWeight: 700, color: '#ffffff', marginBottom: '8px' }}>
                  {selectedTenant.name}
                </h2>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{
                    width: '20px',
                    height: '20px',
                    borderRadius: '4px',
                    backgroundColor: selectedTenant.primary_color,
                  }} />
                  <div style={{
                    width: '20px',
                    height: '20px',
                    borderRadius: '4px',
                    backgroundColor: selectedTenant.secondary_color,
                  }} />
                  <span style={{ color: '#999999', fontSize: '14px' }}>
                    {selectedTenant.slug}
                  </span>
                </div>
              </div>
              <button
                onClick={() => {
                  setShowDetailsModal(false)
                  setSelectedTenant(null)
                  setTenantDetails(null)
                  setErrorDetails(null)
                }}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: '#999999',
                  fontSize: '24px',
                  cursor: 'pointer',
                  padding: '8px',
                }}
              >
                ×
              </button>
            </div>

            {/* Contenido */}
            <div style={{ padding: '24px' }}>
              {loadingDetails ? (
                <div style={{ padding: '48px', textAlign: 'center' }}>
                  <div style={{
                    display: 'inline-block',
                    width: '40px',
                    height: '40px',
                    border: '3px solid #383838',
                    borderTopColor: 'var(--secondary, #C8A97E)',
                    borderRadius: '9999px',
                    animation: 'spin 1s linear infinite',
                  }} />
                  <p style={{ marginTop: '16px', color: '#999999' }}>
                    Cargando detalles...
                  </p>
                </div>
              ) : errorDetails ? (
                <div style={{ padding: '24px', textAlign: 'center' }}>
                  <p style={{ color: '#e94560', marginBottom: '16px' }}>{errorDetails}</p>
                  <button
                    onClick={() => handleViewDetails(selectedTenant)}
                    style={{
                      padding: '8px 16px',
                      background: 'transparent',
                      color: 'var(--secondary, #C8A97E)',
                      border: '1px solid var(--secondary, #C8A97E)',
                      borderRadius: '8px',
                      cursor: 'pointer',
                    }}
                  >
                    Reintentar
                  </button>
                </div>
              ) : tenantDetails ? (
                <div>
                  {/* Información básica */}
                  <div style={{ marginBottom: '32px' }}>
                    <h3 style={{ fontSize: '18px', fontWeight: 600, color: '#ffffff', marginBottom: '16px' }}>
                      Información básica
                    </h3>
                    <div style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                      gap: '16px',
                    }}>
                      <div style={{ background: '#242424', padding: '16px', borderRadius: '8px' }}>
                        <div style={{ color: '#999999', fontSize: '14px', marginBottom: '4px' }}>Slug</div>
                        <div style={{ color: '#ffffff', fontFamily: 'monospace' }}>{tenantDetails.slug}</div>
                      </div>
                      <div style={{ background: '#242424', padding: '16px', borderRadius: '8px' }}>
                        <div style={{ color: '#999999', fontSize: '14px', marginBottom: '4px' }}>Estado</div>
                        <div style={{ color: tenantDetails.is_active ? 'var(--secondary, #C8A97E)' : '#999999' }}>
                          {tenantDetails.is_active ? 'Activo' : 'Inactivo'}
                        </div>
                      </div>
                      <div style={{ background: '#242424', padding: '16px', borderRadius: '8px' }}>
                        <div style={{ color: '#999999', fontSize: '14px', marginBottom: '4px' }}>Creado</div>
                        <div style={{ color: '#ffffff' }}>
                          {new Date(tenantDetails.created_at).toLocaleDateString('es-AR')}
                        </div>
                      </div>
                      {tenantDetails.opening_time && tenantDetails.closing_time && (
                        <div style={{ background: '#242424', padding: '16px', borderRadius: '8px' }}>
                          <div style={{ color: '#999999', fontSize: '14px', marginBottom: '4px' }}>Horario</div>
                          <div style={{ color: '#ffffff' }}>
                            {tenantDetails.opening_time} - {tenantDetails.closing_time}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Métricas recientes */}
                  <div style={{ marginBottom: '32px' }}>
                    <h3 style={{ fontSize: '18px', fontWeight: 600, color: '#ffffff', marginBottom: '16px' }}>
                      Métricas (últimos 30 días)
                    </h3>
                    <div style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                      gap: '16px',
                    }}>
                      <div style={{ background: '#242424', padding: '16px', borderRadius: '8px' }}>
                        <div style={{ color: '#999999', fontSize: '14px', marginBottom: '4px' }}>Servicios completados</div>
                        <div style={{ fontSize: '24px', fontWeight: 700, color: '#ffffff' }}>
                          {tenantDetails.metricas_recientes.servicios_completados}
                        </div>
                      </div>
                      <div style={{ background: '#242424', padding: '16px', borderRadius: '8px' }}>
                        <div style={{ color: '#999999', fontSize: '14px', marginBottom: '4px' }}>Facturación total</div>
                        <div style={{ fontSize: '24px', fontWeight: 700, color: 'var(--secondary, #C8A97E)' }}>
                          {formatCurrency(tenantDetails.metricas_recientes.facturacion_total)}
                        </div>
                      </div>
                      <div style={{ background: '#242424', padding: '16px', borderRadius: '8px' }}>
                        <div style={{ color: '#999999', fontSize: '14px', marginBottom: '4px' }}>Turnos activos</div>
                        <div style={{ fontSize: '24px', fontWeight: 700, color: '#ffffff' }}>
                          {tenantDetails.metricas_recientes.turnos_activos}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Barberos */}
                  <div style={{ marginBottom: '32px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                      <h3 style={{ fontSize: '18px', fontWeight: 600, color: '#ffffff' }}>
                        Barberos ({tenantDetails.barberos.length})
                      </h3>
                      <div style={{ color: '#999999', fontSize: '14px' }}>
                        {tenantDetails.barberos.filter(b => b.is_active).length} activos
                      </div>
                    </div>
                    {tenantDetails.barberos.length === 0 ? (
                      <p style={{ color: '#999999', textAlign: 'center', padding: '24px' }}>
                        No hay barberos registrados
                      </p>
                    ) : (
                      <div style={{
                        background: '#242424',
                        border: '1px solid #383838',
                        borderRadius: '8px',
                        overflow: 'hidden',
                      }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                          <thead>
                            <tr style={{ background: '#2a2a2a' }}>
                              <th style={{ textAlign: 'left', padding: '12px 16px', color: '#999999', fontSize: '14px', fontWeight: 500 }}>Nombre</th>
                              <th style={{ textAlign: 'left', padding: '12px 16px', color: '#999999', fontSize: '14px', fontWeight: 500 }}>Estado</th>
                              <th style={{ textAlign: 'left', padding: '12px 16px', color: '#999999', fontSize: '14px', fontWeight: 500 }}>Registrado</th>
                            </tr>
                          </thead>
                          <tbody>
                            {tenantDetails.barberos.map((barbero) => (
                              <tr key={barbero.id} style={{ borderTop: '1px solid #383838' }}>
                                <td style={{ padding: '12px 16px', color: '#ffffff' }}>{barbero.display_name}</td>
                                <td style={{ padding: '12px 16px' }}>
                                  <span style={{
                                    display: 'inline-block',
                                    padding: '4px 8px',
                                    borderRadius: '4px',
                                    fontSize: '12px',
                                    fontWeight: 500,
                                    backgroundColor: barbero.is_active ? 'rgba(200, 169, 126, 0.1)' : 'rgba(255, 255, 255, 0.05)',
                                    color: barbero.is_active ? 'var(--secondary, #C8A97E)' : '#999999',
                                    border: `1px solid ${barbero.is_active ? 'var(--secondary, #C8A97E)' : '#383838'}`,
                                  }}>
                                    {barbero.is_active ? 'Activo' : 'Inactivo'}
                                  </span>
                                </td>
                                <td style={{ padding: '12px 16px', color: '#999999', fontSize: '14px' }}>
                                  {new Date(barbero.created_at).toLocaleDateString('es-AR')}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>

                  {/* Servicios */}
                  <div style={{ marginBottom: '32px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                      <h3 style={{ fontSize: '18px', fontWeight: 600, color: '#ffffff' }}>
                        Servicios ({tenantDetails.servicios.length})
                      </h3>
                      <div style={{ color: '#999999', fontSize: '14px' }}>
                        {tenantDetails.servicios.filter(s => s.is_active).length} activos
                      </div>
                    </div>
                    {tenantDetails.servicios.length === 0 ? (
                      <p style={{ color: '#999999', textAlign: 'center', padding: '24px' }}>
                        No hay servicios configurados
                      </p>
                    ) : (
                      <div style={{
                        background: '#242424',
                        border: '1px solid #383838',
                        borderRadius: '8px',
                        overflow: 'hidden',
                      }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                          <thead>
                            <tr style={{ background: '#2a2a2a' }}>
                              <th style={{ textAlign: 'left', padding: '12px 16px', color: '#999999', fontSize: '14px', fontWeight: 500 }}>Servicio</th>
                              <th style={{ textAlign: 'left', padding: '12px 16px', color: '#999999', fontSize: '14px', fontWeight: 500 }}>Precio base</th>
                              <th style={{ textAlign: 'left', padding: '12px 16px', color: '#999999', fontSize: '14px', fontWeight: 500 }}>Duración</th>
                              <th style={{ textAlign: 'left', padding: '12px 16px', color: '#999999', fontSize: '14px', fontWeight: 500 }}>Estado</th>
                            </tr>
                          </thead>
                          <tbody>
                            {tenantDetails.servicios.map((servicio) => (
                              <tr key={servicio.id} style={{ borderTop: '1px solid #383838' }}>
                                <td style={{ padding: '12px 16px', color: '#ffffff' }}>{servicio.name}</td>
                                <td style={{ padding: '12px 16px', color: 'var(--secondary, #C8A97E)' }}>
                                  {formatCurrency(servicio.base_price)}
                                </td>
                                <td style={{ padding: '12px 16px', color: '#ffffff' }}>{servicio.duration_min} min</td>
                                <td style={{ padding: '12px 16px' }}>
                                  <span style={{
                                    display: 'inline-block',
                                    padding: '4px 8px',
                                    borderRadius: '4px',
                                    fontSize: '12px',
                                    fontWeight: 500,
                                    backgroundColor: servicio.is_active ? 'rgba(200, 169, 126, 0.1)' : 'rgba(255, 255, 255, 0.05)',
                                    color: servicio.is_active ? 'var(--secondary, #C8A97E)' : '#999999',
                                    border: `1px solid ${servicio.is_active ? 'var(--secondary, #C8A97E)' : '#383838'}`,
                                  }}>
                                    {servicio.is_active ? 'Activo' : 'Inactivo'}
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </div>
              ) : null}
            </div>

            {/* Footer */}
            <div style={{
              padding: '24px',
              borderTop: '1px solid #383838',
              display: 'flex',
              justifyContent: 'flex-end',
              gap: '12px',
            }}>
              <button
                onClick={() => {
                  setShowDetailsModal(false)
                  setSelectedTenant(null)
                  setTenantDetails(null)
                  setErrorDetails(null)
                }}
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
                Cerrar
              </button>
              {tenantDetails && (
                <>
                  <button
                    onClick={() => toggleTenantStatus(tenantDetails.id, tenantDetails.is_active)}
                    style={{
                      padding: '10px 20px',
                      background: tenantDetails.is_active ? 'rgba(200, 169, 126, 0.1)' : 'transparent',
                      color: tenantDetails.is_active ? 'var(--secondary, #C8A97E)' : '#999999',
                      border: `1px solid ${tenantDetails.is_active ? 'var(--secondary, #C8A97E)' : '#383838'}`,
                      borderRadius: '8px',
                      fontSize: '14px',
                      fontWeight: 500,
                      cursor: 'pointer',
                    }}
                  >
                    {tenantDetails.is_active ? 'Desactivar' : 'Activar'}
                  </button>
                  {!tenantDetails.is_active && (
                    <button
                      onClick={() => {
                        setShowDetailsModal(false)
                        handleDeleteTenant(selectedTenant)
                      }}
                      style={{
                        padding: '10px 20px',
                        background: 'transparent',
                        color: '#e94560',
                        border: '1px solid #e94560',
                        borderRadius: '8px',
                        fontSize: '14px',
                        fontWeight: 500,
                        cursor: 'pointer',
                      }}
                    >
                      Eliminar barbería
                    </button>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal de confirmación de eliminación */}
      {showDeleteModal && selectedTenant && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.8)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1001,
          padding: '20px',
        }}>
          <div style={{
            backgroundColor: '#1a1a1a',
            borderRadius: '16px',
            border: '1px solid #383838',
            maxWidth: '500px',
            width: '100%',
            padding: '24px',
          }}>
            <h2 style={{ fontSize: '20px', fontWeight: 700, color: '#ffffff', marginBottom: '16px' }}>
              ⚠️ Eliminar barbería "{selectedTenant.name}"
            </h2>

            <div style={{ marginBottom: '24px' }}>
              <p style={{ color: '#ffffff', marginBottom: '12px' }}>
                <strong>Esta acción no se puede deshacer.</strong>
              </p>
              <p style={{ color: '#999999', fontSize: '14px', marginBottom: '12px' }}>
                Se eliminarán permanentemente todos los datos asociados a esta barbería:
              </p>
              <ul style={{ color: '#999999', fontSize: '14px', paddingLeft: '20px', marginBottom: '16px' }}>
                <li>Perfiles de barberos y dueños</li>
                <li>Catálogo completo de servicios</li>
                <li>Historial de turnos y atenciones</li>
                <li>Registros de facturación</li>
              </ul>
              <p style={{ color: '#e94560', fontSize: '14px' }}>
                Asegúrate de que la barbería esté inactiva y no tenga turnos abiertos antes de continuar.
              </p>
            </div>

            <div style={{ marginBottom: '24px' }}>
              <p style={{ color: '#ffffff', marginBottom: '8px' }}>
                Para confirmar, escribe el slug de la barbería:
              </p>
              <p style={{ color: 'var(--secondary, #C8A97E)', fontFamily: 'monospace', fontSize: '14px', marginBottom: '12px' }}>
                {selectedTenant.slug}
              </p>
              <input
                type="text"
                value={deleteConfirmationText}
                onChange={(e) => setDeleteConfirmationText(e.target.value)}
                placeholder={`Escribe "${selectedTenant.slug}"`}
                style={{
                  width: '100%',
                  padding: '12px 16px',
                  backgroundColor: '#242424',
                  border: `1px solid ${deleteConfirmationText === selectedTenant.slug ? 'var(--secondary, #C8A97E)' : '#383838'}`,
                  borderRadius: '8px',
                  color: '#ffffff',
                  fontSize: '14px',
                  outline: 'none',
                }}
                disabled={deleting}
              />
              {deleteConfirmationText && deleteConfirmationText !== selectedTenant.slug && (
                <p style={{ color: '#e94560', fontSize: '14px', marginTop: '8px' }}>
                  El texto no coincide con el slug
                </p>
              )}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
              <button
                onClick={() => {
                  setShowDeleteModal(false)
                  setDeleteConfirmationText('')
                }}
                disabled={deleting}
                style={{
                  padding: '10px 20px',
                  background: 'transparent',
                  color: '#999999',
                  border: '1px solid #383838',
                  borderRadius: '8px',
                  fontSize: '14px',
                  fontWeight: 500,
                  cursor: 'pointer',
                  opacity: deleting ? 0.5 : 1,
                }}
              >
                Cancelar
              </button>
              <button
                onClick={confirmDelete}
                disabled={deleteConfirmationText !== selectedTenant.slug || deleting}
                style={{
                  padding: '10px 20px',
                  background: '#e94560',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '14px',
                  fontWeight: 600,
                  cursor: deleteConfirmationText === selectedTenant.slug && !deleting ? 'pointer' : 'not-allowed',
                  opacity: deleteConfirmationText === selectedTenant.slug && !deleting ? 1 : 0.5,
                }}
              >
                {deleting ? 'Eliminando...' : 'Eliminar permanentemente'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Global styles for spinner animation */}
      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  )
}