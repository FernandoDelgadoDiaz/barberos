import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { supabase } from '../../config/supabase'
import type { Tenant, Profile, ServiceCatalog } from '../../types'
import { GlassCard } from '../../components/ui/GlassCard'
import { GlassStatCard } from '../../components/ui/GlassStatCard'
import { GlassTable, type Column } from '../../components/ui/GlassTable'

async function getAuthHeader(): Promise<string> {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session?.access_token) {
    throw new Error('No authenticated session')
  }
  return `Bearer ${session.access_token}`
}

// SVG Icons (using existing inline icons)
const BuildingIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
  </svg>
)

const UsersIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
  </svg>
)

const ScissorsIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
  </svg>
)

const DollarIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
)

const LogOutIcon = () => (
	  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
	    <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
	  </svg>
	)

	// Background blur circles component
const BackgroundCircles = () => (
  <>
    <div
      style={{
        position: 'fixed',
        top: '-300px',
        left: '-300px',
        width: '800px',
        height: '800px',
        borderRadius: '50%',
        background: 'rgba(200,169,126,0.12)',
        filter: 'blur(120px)',
        pointerEvents: 'none',
        zIndex: -1,
      }}
    />
    <div
      style={{
        position: 'fixed',
        top: '-300px',
        right: '-300px',
        width: '700px',
        height: '700px',
        borderRadius: '50%',
        background: 'rgba(59,130,246,0.08)',
        filter: 'blur(120px)',
        pointerEvents: 'none',
        zIndex: -1,
      }}
    />
    <div
      style={{
        position: 'fixed',
        bottom: '-300px',
        left: '50%',
        transform: 'translateX(-50%)',
        width: '600px',
        height: '600px',
        borderRadius: '50%',
        background: 'rgba(139,92,246,0.06)',
        filter: 'blur(120px)',
        pointerEvents: 'none',
        zIndex: -1,
      }}
    />
  </>
)



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
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    const mediaQuery = window.matchMedia('(max-width: 767px)')
    const handleChange = (e: MediaQueryListEvent) => setIsMobile(e.matches)
    // Set initial
    setIsMobile(mediaQuery.matches)
    mediaQuery.addEventListener('change', handleChange)
    return () => mediaQuery.removeEventListener('change', handleChange)
  }, [])

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

  const handleSignOut = async () => {
    try {
      await supabase.auth.signOut()
      window.location.href = '/login'
    } catch (err) {
      console.error('Error signing out:', err)
    }
  }

  // Eye icon for mobile actions
  const EyeIcon = () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
    </svg>
  )

  // Define columns for glass table (responsive)
  const columns: Column<TenantWithStats>[] = isMobile
    ? [
        {
          key: 'name',
          label: 'Nombre',
          width: '1.5fr',
          render: (_, row) => (
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div
                style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '8px',
                  background: row.primary_color,
                  border: '1px solid rgba(255,255,255,0.1)',
                }}
              />
              <div style={{ fontWeight: 600, color: '#ffffff', fontSize: '14px' }}>
                {row.name}
              </div>
            </div>
          ),
        },
        {
          key: 'total_barberos',
          label: 'Barberos',
          width: '0.8fr',
          align: 'center',
          render: (value) => (
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontWeight: 700, color: '#ffffff', fontSize: '16px' }}>{value}</div>
              <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)', marginTop: '2px' }}>
                activos
              </div>
            </div>
          ),
        },
        {
          key: 'total_facturado',
          label: 'Facturado',
          width: '1fr',
          align: 'right',
          render: (value) => (
            <div style={{ fontWeight: 700, color: '#C8A97E', fontSize: '15px', textAlign: 'right' }}>
              {formatCurrency(value)}
            </div>
          ),
        },
        {
          key: 'is_active',
          label: 'Estado',
          width: '0.8fr',
          align: 'center',
          render: (value, row) => (
            <button
              onClick={(e) => {
                e.stopPropagation()
                toggleTenantStatus(row.id, row.is_active)
              }}
              style={{
                padding: '6px 12px',
                background: value ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)',
                color: value ? 'rgba(34,197,94,0.9)' : 'rgba(239,68,68,0.9)',
                border: `1px solid ${value ? 'rgba(34,197,94,0.3)' : 'rgba(239,68,68,0.3)'}`,
                borderRadius: '9999px',
                fontSize: '12px',
                fontWeight: 500,
                cursor: 'pointer',
                transition: 'all 0.2s',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'scale(1.05)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'scale(1)'
              }}
            >
              {value ? 'Activo' : 'Inactivo'}
            </button>
          ),
        },
        {
          key: 'actions',
          label: 'Acciones',
          width: '1fr',
          align: 'center',
          render: (_, row) => (
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  handleViewDetails(row)
                }}
                style={{
                  padding: '8px',
                  background: 'transparent',
                  color: '#C8A97E',
                  border: '1px solid #C8A97E',
                  borderRadius: '8px',
                  fontSize: '13px',
                  fontWeight: 500,
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'rgba(200,169,126,0.1)'
                  e.currentTarget.style.transform = 'translateY(-2px)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'transparent'
                  e.currentTarget.style.transform = 'translateY(0)'
                }}
              >
                <EyeIcon />
              </button>
              {!row.is_active && (
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    handleDeleteTenant(row)
                  }}
                  style={{
                    padding: '8px 16px',
                    background: 'transparent',
                    color: '#e94560',
                    border: '1px solid #e94560',
                    borderRadius: '8px',
                    fontSize: '13px',
                    fontWeight: 500,
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'rgba(233,69,96,0.1)'
                    e.currentTarget.style.transform = 'translateY(-2px)'
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'transparent'
                    e.currentTarget.style.transform = 'translateY(0)'
                  }}
                >
                  Eliminar
                </button>
              )}
            </div>
          ),
        },
      ]
    : [
        {
          key: 'name',
          label: 'Nombre',
          width: '1.5fr',
          render: (_, row) => (
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div
                style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '8px',
                  background: row.primary_color,
                  border: '1px solid rgba(255,255,255,0.1)',
                }}
              />
              <div>
                <div style={{ fontWeight: 600, color: '#ffffff', fontSize: '14px' }}>{row.name}</div>
                <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)', fontFamily: 'monospace' }}>
                  ID: {row.id.slice(0, 8)}...
                </div>
              </div>
            </div>
          ),
        },
        {
          key: 'slug',
          label: 'Slug',
          width: '1fr',
          render: (slug) => (
            <div style={{ fontFamily: 'monospace', fontSize: '13px', color: 'rgba(255,255,255,0.7)' }}>
              {slug}
            </div>
          ),
        },
        {
          key: 'total_barberos',
          label: 'Barberos',
          width: '0.8fr',
          align: 'center',
          render: (value) => (
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontWeight: 700, color: '#ffffff', fontSize: '16px' }}>{value}</div>
              <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)', marginTop: '2px' }}>
                activos
              </div>
            </div>
          ),
        },
        {
          key: 'total_servicios',
          label: 'Servicios',
          width: '0.8fr',
          align: 'center',
          render: (value) => (
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontWeight: 700, color: '#ffffff', fontSize: '16px' }}>{value}</div>
              <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)', marginTop: '2px' }}>
                registrados
              </div>
            </div>
          ),
        },
        {
          key: 'total_facturado',
          label: 'Facturado',
          width: '1fr',
          align: 'right',
          render: (value) => (
            <div style={{ fontWeight: 700, color: '#C8A97E', fontSize: '15px', textAlign: 'right' }}>
              {formatCurrency(value)}
            </div>
          ),
        },
        {
          key: 'is_active',
          label: 'Estado',
          width: '0.8fr',
          align: 'center',
          render: (value, row) => (
            <button
              onClick={(e) => {
                e.stopPropagation()
                toggleTenantStatus(row.id, row.is_active)
              }}
              style={{
                padding: '6px 12px',
                background: value ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)',
                color: value ? 'rgba(34,197,94,0.9)' : 'rgba(239,68,68,0.9)',
                border: `1px solid ${value ? 'rgba(34,197,94,0.3)' : 'rgba(239,68,68,0.3)'}`,
                borderRadius: '9999px',
                fontSize: '12px',
                fontWeight: 500,
                cursor: 'pointer',
                transition: 'all 0.2s',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'scale(1.05)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'scale(1)'
              }}
            >
              {value ? 'Activo' : 'Inactivo'}
            </button>
          ),
        },
        {
          key: 'created_at',
          label: 'Creado',
          width: '0.9fr',
          render: (value) => (
            <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: '13px' }}>
              {new Date(value).toLocaleDateString('es-AR')}
            </div>
          ),
        },
        {
          key: 'actions',
          label: 'Acciones',
          width: '1.2fr',
          align: 'center',
          render: (_, row) => (
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  handleViewDetails(row)
                }}
                style={{
                  padding: '8px 16px',
                  background: 'transparent',
                  color: '#C8A97E',
                  border: '1px solid #C8A97E',
                  borderRadius: '8px',
                  fontSize: '13px',
                  fontWeight: 500,
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'rgba(200,169,126,0.1)'
                  e.currentTarget.style.transform = 'translateY(-2px)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'transparent'
                  e.currentTarget.style.transform = 'translateY(0)'
                }}
              >
                Ver detalles
              </button>
              {!row.is_active && (
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    handleDeleteTenant(row)
                  }}
                  style={{
                    padding: '8px 16px',
                    background: 'transparent',
                    color: '#e94560',
                    border: '1px solid #e94560',
                    borderRadius: '8px',
                    fontSize: '13px',
                    fontWeight: 500,
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'rgba(233,69,96,0.1)'
                    e.currentTarget.style.transform = 'translateY(-2px)'
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'transparent'
                    e.currentTarget.style.transform = 'translateY(0)'
                  }}
                >
                  Eliminar
                </button>
              )}
            </div>
          ),
        },
      ]

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
      style={{
        minHeight: '100vh',
        background: '#0A0A0F',
        position: 'relative',
        overflowX: 'hidden',
        padding: '40px',
        fontFamily: "'Inter', sans-serif",
      }}
    >
      {/* Background blur circles */}
      <BackgroundCircles />

      <div style={{ maxWidth: '1400px', margin: '0 auto', position: 'relative', zIndex: 1 }}>
        {/* Header */}
        <motion.div
          initial={{ y: -20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.6 }}
          style={{ marginBottom: '40px' }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <h1
                style={{
                  fontSize: '32px',
                  fontWeight: 800,
                  color: '#ffffff',
                  marginBottom: '8px',
                  fontFamily: "'Inter', sans-serif",
                }}
              >
                Gestión de Barberías
              </h1>
              <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '14px', fontFamily: "'Inter', sans-serif" }}>
                Administrador del sistema • Superadmin
              </p>
            </div>
            <button
              onClick={handleSignOut}
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
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(200,169,126,0.1)';
                e.currentTarget.style.transform = 'translateY(-2px)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'transparent';
                e.currentTarget.style.transform = 'translateY(0)';
              }}
            >
              <LogOutIcon />
              Cerrar sesión
            </button>
          </div>
        </motion.div>

        {/* Stats summary with GlassStatCard */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.8 }}
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
            gap: '24px',
            marginBottom: '32px'
          }}
        >
          <GlassStatCard
            icon={<BuildingIcon />}
            value={tenants.length}
            label="Total barberías"
            delay={0.1}
            color="#C8A97E"
          />
          <GlassStatCard
            icon={<UsersIcon />}
            value={tenants.reduce((sum, tenant) => sum + tenant.total_barberos, 0)}
            label="Total barberos"
            sublabel="activos"
            delay={0.2}
            color="#3B82F6"
          />
          <GlassStatCard
            icon={<ScissorsIcon />}
            value={tenants.reduce((sum, tenant) => sum + tenant.total_servicios, 0)}
            label="Total servicios"
            sublabel="registrados"
            delay={0.3}
            color="#8B5CF6"
          />
          <GlassStatCard
            icon={<DollarIcon />}
            value={formatCurrency(tenants.reduce((sum, tenant) => sum + tenant.total_facturado, 0))}
            label="Total facturado"
            delay={0.4}
            color="#10B981"
          />
        </motion.div>

        {/* Main table with GlassTable */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.5 }}
        >
          <GlassCard className="p-6 mb-6">
            <div style={{ marginBottom: '24px' }}>
              <h2 style={{ fontSize: '20px', fontWeight: 600, color: '#ffffff', marginBottom: '8px' }}>
                Todas las barberías
              </h2>
              <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '14px' }}>
                Listado completo con estadísticas
              </p>
            </div>

            <GlassTable
              columns={columns}
              data={tenants}
              rowKey="id"
              loading={loading}
              emptyMessage="No hay barberías registradas"
              onRowClick={(tenant) => handleViewDetails(tenant)}
              rowPadding={isMobile ? '24px 20px' : '16px 20px'}
            />

            {/* Table footer */}
            {!loading && !error && tenants.length > 0 && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.8 }}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginTop: '24px',
                  paddingTop: '24px',
                  borderTop: '1px solid rgba(255,255,255,0.08)'
                }}
              >
                <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: '14px' }}>
                  Mostrando {tenants.length} barberías
                </div>
                <div style={{ display: 'flex', gap: '12px' }}>
                  <button
                    onClick={loadTenants}
                    style={{
                      padding: '10px 20px',
                      background: 'transparent',
                      color: 'rgba(255,255,255,0.7)',
                      border: '1px solid rgba(255,255,255,0.2)',
                      borderRadius: '8px',
                      fontSize: '14px',
                      fontWeight: 500,
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = 'rgba(255,255,255,0.05)';
                      e.currentTarget.style.borderColor = 'rgba(255,255,255,0.3)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = 'transparent';
                      e.currentTarget.style.borderColor = 'rgba(255,255,255,0.2)';
                    }}
                  >
                    Refrescar
                  </button>
                  <button
                    style={{
                      padding: '10px 20px',
                      background: '#C8A97E',
                      color: '#0A0A0F',
                      border: 'none',
                      borderRadius: '8px',
                      fontSize: '14px',
                      fontWeight: 600,
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.background = '#D4B686'}
                    onMouseLeave={(e) => e.currentTarget.style.background = '#C8A97E'}
                    onClick={() => window.open('/register', '_blank')}
                  >
                    + Nueva barbería
                  </button>
                </div>
              </motion.div>
            )}

            {/* Error state */}
            {error && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                style={{ textAlign: 'center', padding: '40px 0' }}
              >
                <GlassCard className="p-6 inline-block">
                  <p style={{ color: '#e94560', fontSize: '14px', marginBottom: '16px' }}>{error}</p>
                  <button
                    onClick={loadTenants}
                    style={{
                      padding: '10px 20px',
                      background: 'transparent',
                      color: '#C8A97E',
                      border: '1px solid #C8A97E',
                      borderRadius: '8px',
                      fontSize: '14px',
                      fontWeight: 500,
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(200,169,126,0.1)'}
                    onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                  >
                    Reintentar
                  </button>
                </GlassCard>
              </motion.div>
            )}
          </GlassCard>
        </motion.div>
      </div>

      {/* Modal de detalles del tenant - Glassmorphism version */}
      {showDetailsModal && selectedTenant && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          style={{
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
            backdropFilter: 'blur(10px)',
          }}
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', damping: 25 }}
            style={{
              maxWidth: '900px',
              width: '100%',
              maxHeight: '90vh',
              overflowY: 'auto',
              position: 'relative',
            }}
          >
            <GlassCard className="overflow-hidden">
              {/* Header */}
              <div style={{
                padding: '24px',
                borderBottom: '1px solid rgba(255,255,255,0.08)',
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
                    <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: '14px', fontFamily: 'monospace' }}>
                      {selectedTenant.slug}
                    </span>
                  </div>
                </div>
                <button
                  onClick={() => {
                    setShowDetailsModal(false);
                    setSelectedTenant(null);
                    setTenantDetails(null);
                    setErrorDetails(null);
                  }}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: 'rgba(255,255,255,0.5)',
                    fontSize: '24px',
                    cursor: 'pointer',
                    padding: '8px',
                    borderRadius: '50%',
                    width: '40px',
                    height: '40px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    transition: 'all 0.2s',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'rgba(255,255,255,0.1)';
                    e.currentTarget.style.color = '#ffffff';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'transparent';
                    e.currentTarget.style.color = 'rgba(255,255,255,0.5)';
                  }}
                >
                  ×
                </button>
              </div>

              {/* Content */}
              <div style={{ padding: '24px' }}>
                {loadingDetails ? (
                  <div style={{ padding: '48px', textAlign: 'center' }}>
                    <div style={{
                      display: 'inline-block',
                      width: '40px',
                      height: '40px',
                      border: '3px solid rgba(255,255,255,0.1)',
                      borderTopColor: '#C8A97E',
                      borderRadius: '9999px',
                      animation: 'spin 1s linear infinite',
                    }} />
                    <p style={{ marginTop: '16px', color: 'rgba(255,255,255,0.5)' }}>
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
                        color: '#C8A97E',
                        border: '1px solid #C8A97E',
                        borderRadius: '8px',
                        cursor: 'pointer',
                        transition: 'all 0.2s',
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(200,169,126,0.1)'}
                      onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                    >
                      Reintentar
                    </button>
                  </div>
                ) : tenantDetails ? (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.2 }}
                  >
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
                        <GlassCard className="p-4">
                          <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: '14px', marginBottom: '4px' }}>Slug</div>
                          <div style={{ color: '#ffffff', fontFamily: 'monospace' }}>{tenantDetails.slug}</div>
                        </GlassCard>
                        <GlassCard className="p-4">
                          <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: '14px', marginBottom: '4px' }}>Estado</div>
                          <div style={{ color: tenantDetails.is_active ? '#C8A97E' : 'rgba(255,255,255,0.5)' }}>
                            {tenantDetails.is_active ? 'Activo' : 'Inactivo'}
                          </div>
                        </GlassCard>
                        <GlassCard className="p-4">
                          <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: '14px', marginBottom: '4px' }}>Creado</div>
                          <div style={{ color: '#ffffff' }}>
                            {new Date(tenantDetails.created_at).toLocaleDateString('es-AR')}
                          </div>
                        </GlassCard>
                        {tenantDetails.opening_time && tenantDetails.closing_time && (
                          <GlassCard className="p-4">
                            <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: '14px', marginBottom: '4px' }}>Horario</div>
                            <div style={{ color: '#ffffff' }}>
                              {tenantDetails.opening_time} - {tenantDetails.closing_time}
                            </div>
                          </GlassCard>
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
                        <GlassStatCard
                          icon={<ScissorsIcon />}
                          value={tenantDetails.metricas_recientes.servicios_completados}
                          label="Servicios completados"
                          color="#C8A97E"
                        />
                        <GlassStatCard
                          icon={<DollarIcon />}
                          value={formatCurrency(tenantDetails.metricas_recientes.facturacion_total)}
                          label="Facturación total"
                          color="#10B981"
                        />
                        <GlassStatCard
                          icon={<UsersIcon />}
                          value={tenantDetails.metricas_recientes.turnos_activos}
                          label="Turnos activos"
                          color="#3B82F6"
                        />
                      </div>
                    </div>

                    {/* Barberos */}
                    <div style={{ marginBottom: '32px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                        <h3 style={{ fontSize: '18px', fontWeight: 600, color: '#ffffff' }}>
                          Barberos ({tenantDetails.barberos.length})
                        </h3>
                        <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: '14px' }}>
                          {tenantDetails.barberos.filter(b => b.is_active).length} activos
                        </div>
                      </div>
                      {tenantDetails.barberos.length === 0 ? (
                        <GlassCard className="p-6">
                          <p style={{ color: 'rgba(255,255,255,0.4)', textAlign: 'center' }}>
                            No hay barberos registrados
                          </p>
                        </GlassCard>
                      ) : (
                        <GlassTable
                          columns={[
                            { key: 'display_name', label: 'Nombre', width: '1fr' },
                            { key: 'is_active', label: 'Estado', width: '100px' },
                            { key: 'created_at', label: 'Registrado', width: '120px' },
                          ]}
                          data={tenantDetails.barberos}
                          rowKey="id"
                        />
                      )}
                    </div>

                    {/* Servicios */}
                    <div style={{ marginBottom: '32px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                        <h3 style={{ fontSize: '18px', fontWeight: 600, color: '#ffffff' }}>
                          Servicios ({tenantDetails.servicios.length})
                        </h3>
                        <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: '14px' }}>
                          {tenantDetails.servicios.filter(s => s.is_active).length} activos
                        </div>
                      </div>
                      {tenantDetails.servicios.length === 0 ? (
                        <GlassCard className="p-6">
                          <p style={{ color: 'rgba(255,255,255,0.4)', textAlign: 'center' }}>
                            No hay servicios configurados
                          </p>
                        </GlassCard>
                      ) : (
                        <GlassTable
                          columns={[
                            { key: 'name', label: 'Servicio', width: '1fr' },
                            { key: 'base_price', label: 'Precio base', width: '120px' },
                            { key: 'duration_min', label: 'Duración', width: '100px' },
                            { key: 'is_active', label: 'Estado', width: '100px' },
                          ]}
                          data={tenantDetails.servicios}
                          rowKey="id"
                        />
                      )}
                    </div>
                  </motion.div>
                ) : null}
              </div>

              {/* Footer */}
              <div style={{
                padding: '24px',
                borderTop: '1px solid rgba(255,255,255,0.08)',
                display: 'flex',
                justifyContent: 'flex-end',
                gap: '12px',
              }}>
                <button
                  onClick={() => {
                    setShowDetailsModal(false);
                    setSelectedTenant(null);
                    setTenantDetails(null);
                    setErrorDetails(null);
                  }}
                  style={{
                    padding: '10px 20px',
                    background: 'transparent',
                    color: 'rgba(255,255,255,0.7)',
                    border: '1px solid rgba(255,255,255,0.2)',
                    borderRadius: '8px',
                    fontSize: '14px',
                    fontWeight: 500,
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'rgba(255,255,255,0.05)';
                    e.currentTarget.style.borderColor = 'rgba(255,255,255,0.3)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'transparent';
                    e.currentTarget.style.borderColor = 'rgba(255,255,255,0.2)';
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
                        background: tenantDetails.is_active ? 'rgba(200,169,126,0.1)' : 'transparent',
                        color: tenantDetails.is_active ? '#C8A97E' : 'rgba(255,255,255,0.7)',
                        border: `1px solid ${tenantDetails.is_active ? '#C8A97E' : 'rgba(255,255,255,0.2)'}`,
                        borderRadius: '8px',
                        fontSize: '14px',
                        fontWeight: 500,
                        cursor: 'pointer',
                        transition: 'all 0.2s',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = tenantDetails.is_active
                          ? 'rgba(200,169,126,0.2)'
                          : 'rgba(255,255,255,0.05)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = tenantDetails.is_active
                          ? 'rgba(200,169,126,0.1)'
                          : 'transparent';
                      }}
                    >
                      {tenantDetails.is_active ? 'Desactivar' : 'Activar'}
                    </button>
                    {!tenantDetails.is_active && (
                      <button
                        onClick={() => {
                          setShowDetailsModal(false);
                          handleDeleteTenant(selectedTenant);
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
                          transition: 'all 0.2s',
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(233,69,96,0.1)'}
                        onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                      >
                        Eliminar barbería
                      </button>
                    )}
                  </>
                )}
              </div>
            </GlassCard>
          </motion.div>
        </motion.div>
      )}

      {/* Modal de confirmación de eliminación - Glassmorphism version */}
      {showDeleteModal && selectedTenant && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          style={{
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
            backdropFilter: 'blur(10px)',
          }}
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', damping: 25 }}
            style={{
              maxWidth: '500px',
              width: '100%',
            }}
          >
            <GlassCard className="p-6">
              <h2 style={{ fontSize: '20px', fontWeight: 700, color: '#ffffff', marginBottom: '16px' }}>
                ⚠️ Eliminar barbería "{selectedTenant.name}"
              </h2>

              <div style={{ marginBottom: '24px' }}>
                <p style={{ color: '#ffffff', marginBottom: '12px' }}>
                  <strong>Esta acción no se puede deshacer.</strong>
                </p>
                <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '14px', marginBottom: '12px' }}>
                  Se eliminarán permanentemente todos los datos asociados a esta barbería:
                </p>
                <ul style={{ color: 'rgba(255,255,255,0.5)', fontSize: '14px', paddingLeft: '20px', marginBottom: '16px' }}>
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
                <p style={{ color: '#C8A97E', fontFamily: 'monospace', fontSize: '14px', marginBottom: '12px' }}>
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
                    backgroundColor: 'rgba(255,255,255,0.05)',
                    border: `1px solid ${deleteConfirmationText === selectedTenant.slug ? '#C8A97E' : 'rgba(255,255,255,0.2)'}`,
                    borderRadius: '8px',
                    color: '#ffffff',
                    fontSize: '14px',
                    outline: 'none',
                    transition: 'border-color 0.2s',
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
                    setShowDeleteModal(false);
                    setDeleteConfirmationText('');
                  }}
                  disabled={deleting}
                  style={{
                    padding: '10px 20px',
                    background: 'transparent',
                    color: 'rgba(255,255,255,0.7)',
                    border: '1px solid rgba(255,255,255,0.2)',
                    borderRadius: '8px',
                    fontSize: '14px',
                    fontWeight: 500,
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    opacity: deleting ? 0.5 : 1,
                  }}
                  onMouseEnter={(e) => {
                    if (!deleting) {
                      e.currentTarget.style.background = 'rgba(255,255,255,0.05)';
                      e.currentTarget.style.borderColor = 'rgba(255,255,255,0.3)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!deleting) {
                      e.currentTarget.style.background = 'transparent';
                      e.currentTarget.style.borderColor = 'rgba(255,255,255,0.2)';
                    }
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
                    transition: 'all 0.2s',
                  }}
                  onMouseEnter={(e) => {
                    if (deleteConfirmationText === selectedTenant.slug && !deleting) {
                      e.currentTarget.style.background = '#ff5773';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (deleteConfirmationText === selectedTenant.slug && !deleting) {
                      e.currentTarget.style.background = '#e94560';
                    }
                  }}
                >
                  {deleting ? 'Eliminando...' : 'Eliminar permanentemente'}
                </button>
              </div>
            </GlassCard>
          </motion.div>
        </motion.div>
      )}

      {/* Global styles for spinner animation */}
      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </motion.div>
  )
}