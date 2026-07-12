import { useEffect, useState } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { supabase } from '../../config/supabase'
import type { Tenant, Profile, ServiceCatalog } from '../../types'

// ─────────────────────────────────────────────────────────────────────────────
// Auth
// ─────────────────────────────────────────────────────────────────────────────
async function getAuthHeader(): Promise<string> {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) {
    const { data: { session: refreshed } } = await supabase.auth.refreshSession()
    if (!refreshed?.access_token) throw new Error('No session')
    return `Bearer ${refreshed.access_token}`
  }
  return `Bearer ${session.access_token}`
}

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────
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

type Badge = {
  label: string
  color: string
  bg: string
}

// ─────────────────────────────────────────────────────────────────────────────
// Badges (paleta clara, mismos umbrales de negocio que antes)
// ─────────────────────────────────────────────────────────────────────────────
const getTrialBadge = (tenant: TenantWithStats): (Badge & { days?: number }) | null => {
  if (tenant.is_exempt_trial) {
    return { label: 'Exento', color: '#475569', bg: '#F1F5F9' }
  }
  if (!tenant.trial_ends_at) return null
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const trialEnd = new Date(tenant.trial_ends_at)
  trialEnd.setHours(0, 0, 0, 0)
  const diffMs = trialEnd.getTime() - today.getTime()
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24))
  if (diffDays > 5) {
    return { label: 'Trial activo', color: '#15803D', bg: '#DCFCE7', days: diffDays }
  }
  if (diffDays >= 1) {
    return { label: 'Trial por vencer', color: '#B45309', bg: '#FEF3C7', days: diffDays }
  }
  return { label: 'Trial vencido', color: '#B91C1C', bg: '#FEE2E2', days: diffDays }
}

const getSubscriptionBadge = (tenant: TenantWithStats): Badge => {
  if (tenant.is_exempt_trial) {
    return { label: 'Exento', color: '#1D4ED8', bg: '#DBEAFE' }
  }
  switch (tenant.subscription_status) {
    case 'active':
      return { label: 'Suscripción activa', color: '#15803D', bg: '#DCFCE7' }
    case 'grace_period':
      return { label: 'En gracia', color: '#B45309', bg: '#FEF3C7' }
    case 'suspended':
      return { label: 'Suspendida', color: '#B91C1C', bg: '#FEE2E2' }
    case 'trial':
    default:
      return { label: 'Sin suscripción', color: '#475569', bg: '#F1F5F9' }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Formatters
// ─────────────────────────────────────────────────────────────────────────────
const formatDate = (dateStr: string | null | undefined): string => {
  if (!dateStr) return '—'
  const d = new Date(dateStr)
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`
}

// "$" pegado a los dígitos, igual que LivePanel/Metrics.
const formatCurrency = (amount: number): string =>
  '$' + new Intl.NumberFormat('es-AR', { maximumFractionDigits: 0 }).format(amount)

// ─────────────────────────────────────────────────────────────────────────────
// Icons (mismo trazo 1.6–1.8 que el resto de la app)
// ─────────────────────────────────────────────────────────────────────────────
const BuildingIcon = ({ color = '#2563EB' }: { color?: string }) => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path d="M4 21V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v16" stroke={color} strokeWidth="1.7" strokeLinecap="round" />
    <path d="M16 9h2a2 2 0 0 1 2 2v10" stroke={color} strokeWidth="1.7" strokeLinecap="round" />
    <path d="M2 21h20M8 7h2m-2 4h2m-2 4h2" stroke={color} strokeWidth="1.7" strokeLinecap="round" />
  </svg>
)

const UsersIcon = ({ color = '#7C3AED' }: { color?: string }) => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <circle cx="9" cy="8" r="3.2" stroke={color} strokeWidth="1.7" />
    <path d="M3.5 19c.7-3 3-4.5 5.5-4.5s4.8 1.5 5.5 4.5" stroke={color} strokeWidth="1.7" strokeLinecap="round" />
    <path d="M15.5 5.6a3.2 3.2 0 0 1 0 4.8M18 14.8c1.3.7 2.2 1.9 2.5 3.7" stroke={color} strokeWidth="1.7" strokeLinecap="round" />
  </svg>
)

const ScissorsIcon = ({ color = '#EA580C' }: { color?: string }) => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <circle cx="6" cy="6" r="2.5" stroke={color} strokeWidth="1.7" />
    <circle cx="6" cy="18" r="2.5" stroke={color} strokeWidth="1.7" />
    <path d="M20 4 8.12 15.88M14.47 14.48 20 20M8.12 8.12 12 12" stroke={color} strokeWidth="1.7" strokeLinecap="round" />
  </svg>
)

const DollarIcon = ({ color = '#16A34A' }: { color?: string }) => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <circle cx="12" cy="12" r="9" stroke={color} strokeWidth="1.7" />
    <path d="M12 7v10M14.5 9.2c-.5-.8-1.4-1.2-2.5-1.2-1.4 0-2.5.8-2.5 2s1.1 1.7 2.5 2 2.5.8 2.5 2-1.1 2-2.5 2c-1.1 0-2-.4-2.5-1.2" stroke={color} strokeWidth="1.7" strokeLinecap="round" />
  </svg>
)

const LogOutIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3" stroke="#475569" strokeWidth="1.7" strokeLinecap="round" />
    <path d="M10 8l-4 4 4 4M6 12h10" stroke="#475569" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
)

const ChevronIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path d="M9 6l6 6-6 6" stroke="#64748B" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
)

const PlusIcon = ({ color = '#fff' }: { color?: string }) => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path d="M12 5v14M5 12h14" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
  </svg>
)

const RefreshIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path d="M20 11a8 8 0 1 0-2.34 6.34" stroke="#475569" strokeWidth="1.7" strokeLinecap="round" />
    <path d="M20 5v6h-6" stroke="#475569" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
)

const WarningIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path d="M12 4 2.7 20h18.6L12 4z" stroke="#B91C1C" strokeWidth="1.7" strokeLinejoin="round" />
    <path d="M12 10v4.5" stroke="#B91C1C" strokeWidth="1.8" strokeLinecap="round" />
    <circle cx="12" cy="17.2" r="1" fill="#B91C1C" />
  </svg>
)

// ─────────────────────────────────────────────────────────────────────────────
// UI primitives
// ─────────────────────────────────────────────────────────────────────────────
const cardStyle: React.CSSProperties = {
  background: '#fff',
  border: '1px solid #E2E8F0',
  borderRadius: '16px',
  boxShadow: '0 1px 2px rgba(15,23,42,0.04)',
}

function Pill({ badge }: { badge: Badge }) {
  return (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      padding: '4px 10px',
      background: badge.bg,
      color: badge.color,
      borderRadius: '999px',
      fontFamily: 'Space Grotesk, sans-serif',
      fontSize: '12px',
      fontWeight: 600,
      whiteSpace: 'nowrap',
      lineHeight: 1.2,
    }}>
      {badge.label}
    </span>
  )
}

function StatCard({ icon, iconBg, value, label }: {
  icon: React.ReactNode
  iconBg: string
  value: string | number
  label: string
}) {
  return (
    <div style={{ ...cardStyle, padding: '14px', display: 'flex', flexDirection: 'column', gap: '10px', minWidth: 0 }}>
      <div style={{
        width: '30px',
        height: '30px',
        borderRadius: '10px',
        background: iconBg,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
      }}>
        {icon}
      </div>
      <div style={{ minWidth: 0 }}>
        <div style={{
          fontFamily: "'Inter', system-ui, sans-serif",
          fontWeight: 800,
          fontSize: 'clamp(17px, 5vw, 20px)',
          color: '#0F172A',
          lineHeight: 1.15,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}>
          {value}
        </div>
        <div style={{
          fontFamily: 'Space Grotesk, sans-serif',
          fontSize: '12px',
          color: '#64748B',
          marginTop: '2px',
        }}>
          {label}
        </div>
      </div>
    </div>
  )
}

// Skeleton con la forma real de las cards (nada de spinners genéricos)
function TenantCardSkeleton() {
  return (
    <div style={{ ...cardStyle, padding: '16px' }} aria-hidden="true">
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <div className="sa-shimmer" style={{ width: '42px', height: '42px', borderRadius: '12px' }} />
        <div style={{ flex: 1 }}>
          <div className="sa-shimmer" style={{ width: '55%', height: '14px', borderRadius: '6px', marginBottom: '8px' }} />
          <div className="sa-shimmer" style={{ width: '35%', height: '11px', borderRadius: '6px' }} />
        </div>
      </div>
      <div style={{ display: 'flex', gap: '8px', marginTop: '14px' }}>
        <div className="sa-shimmer" style={{ width: '96px', height: '24px', borderRadius: '999px' }} />
        <div className="sa-shimmer" style={{ width: '72px', height: '24px', borderRadius: '999px' }} />
      </div>
      <div className="sa-shimmer" style={{ width: '100%', height: '52px', borderRadius: '12px', marginTop: '14px' }} />
    </div>
  )
}

// Inicial del tenant sobre fondo tintado (identidad visual sin depender de logos)
function TenantAvatar({ name }: { name: string }) {
  return (
    <div style={{
      width: '42px',
      height: '42px',
      borderRadius: '12px',
      background: '#EFF6FF',
      border: '1px solid #DBEAFE',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
      fontFamily: 'Syne, sans-serif',
      fontWeight: 700,
      fontSize: '17px',
      color: '#2563EB',
    }}>
      {name.trim().charAt(0).toUpperCase() || '?'}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Página
// ─────────────────────────────────────────────────────────────────────────────
export function Tenants() {
  const reduceMotion = useReducedMotion()
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
  const [extendingId, setExtendingId] = useState<string | null>(null)
  const [togglingId, setTogglingId] = useState<string | null>(null)

  useEffect(() => {
    loadTenants()
  }, [])

  const loadTenants = async () => {
    try {
      setLoading(true)
      setError(null)
      const authHeader = await getAuthHeader()
      const response = await fetch('/api/get-tenants', {
        headers: { 'Authorization': authHeader },
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
    if (togglingId) return
    setTogglingId(tenantId)
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
      setTenants(prev =>
        prev.map(tenant =>
          tenant.id === tenantId ? { ...tenant, is_active: updatedTenant.is_active } : tenant
        )
      )
      setTenantDetails(prev =>
        prev && prev.id === tenantId ? { ...prev, is_active: updatedTenant.is_active } : prev
      )
      setSelectedTenant(prev =>
        prev && prev.id === tenantId ? { ...prev, is_active: updatedTenant.is_active } : prev
      )
    } catch (err) {
      console.error('Error updating tenant status:', err)
      setError(err instanceof Error ? err.message : 'Error al actualizar estado')
    } finally {
      setTogglingId(null)
    }
  }

  const extendSubscription = async (tenantId: string) => {
    if (extendingId) return
    if (!window.confirm('¿Extender la suscripción de esta barbería 1 mes?')) return
    setExtendingId(tenantId)
    try {
      const authHeader = await getAuthHeader()
      const response = await fetch('/api/admin-extend-subscription', {
        method: 'POST',
        headers: {
          'Authorization': authHeader,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ tenant_id: tenantId, months: 1 }),
      })
      if (!response.ok) {
        if (response.status === 403) {
          throw new Error('Acceso denegado: se requiere rol superadmin')
        }
        throw new Error(`Error ${response.status}: ${response.statusText}`)
      }
      const updatedTenant = await response.json()
      setTenants(prev =>
        prev.map(tenant =>
          tenant.id === tenantId ? { ...tenant, ...updatedTenant } : tenant
        )
      )
      setTenantDetails(prev =>
        prev && prev.id === tenantId ? { ...prev, ...updatedTenant } : prev
      )
      setSelectedTenant(prev =>
        prev && prev.id === tenantId ? { ...prev, ...updatedTenant } : prev
      )
    } catch (err) {
      console.error('Error extending subscription:', err)
      setError(err instanceof Error ? err.message : 'Error al extender suscripción')
    } finally {
      setExtendingId(null)
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

  const closeDetails = () => {
    setShowDetailsModal(false)
    setSelectedTenant(null)
    setTenantDetails(null)
    setErrorDetails(null)
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

      setTenants(prev => prev.filter(t => t.id !== selectedTenant.id))
      setShowDeleteModal(false)
      setDeleteConfirmationText('')
      setShowDetailsModal(false)
      setSelectedTenant(null)
      setTenantDetails(null)
    } catch (err) {
      console.error('Error deleting tenant:', err)
      setError(err instanceof Error ? err.message : 'Error al eliminar barbería')
    } finally {
      setDeleting(false)
    }
  }

  const handleSignOut = async () => {
    try {
      await supabase.auth.signOut()
      window.location.href = '/login'
    } catch (err) {
      console.error('Error signing out:', err)
    }
  }

  const totalBarberos = tenants.reduce((sum, t) => sum + t.total_barberos, 0)
  const totalServicios = tenants.reduce((sum, t) => sum + t.total_servicios, 0)
  const totalFacturado = tenants.reduce((sum, t) => sum + t.total_facturado, 0)

  return (
    <div style={{
      minHeight: '100dvh',
      background: '#F8FAFC',
      fontFamily: 'Space Grotesk, sans-serif',
    }}>
      <div style={{
        maxWidth: '430px',
        margin: '0 auto',
        padding: '0 16px calc(32px + env(safe-area-inset-bottom))',
      }}>

        {/* Header sticky */}
        <div style={{
          position: 'sticky',
          top: 0,
          zIndex: 10,
          background: 'rgba(248,250,252,0.92)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          margin: '0 -16px',
          padding: '18px 16px 14px',
          borderBottom: '1px solid #E2E8F0',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '12px',
        }}>
          <div style={{ minWidth: 0 }}>
            <h1 style={{
              fontFamily: 'Syne, sans-serif',
              fontWeight: 700,
              fontSize: 'clamp(19px, 5.6vw, 22px)',
              color: '#0F172A',
              lineHeight: 1.15,
            }}>
              Barberías
            </h1>
            <p style={{ fontSize: '12px', color: '#64748B', marginTop: '2px' }}>
              Panel superadmin
            </p>
          </div>
          <button
            className="sa-btn"
            onClick={handleSignOut}
            aria-label="Cerrar sesión"
            style={{
              width: '40px',
              height: '40px',
              borderRadius: '12px',
              background: '#fff',
              border: '1px solid #E2E8F0',
              boxShadow: '0 1px 2px rgba(15,23,42,0.04)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              flexShrink: 0,
            }}
          >
            <LogOutIcon />
          </button>
        </div>

        {/* Stats 2×2 */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr)',
          gap: '10px',
          marginTop: '16px',
        }}>
          <StatCard icon={<BuildingIcon />} iconBg="#EFF6FF" value={loading ? '—' : tenants.length} label="Barberías" />
          <StatCard icon={<UsersIcon />} iconBg="#F5F3FF" value={loading ? '—' : totalBarberos} label="Barberos activos" />
          <StatCard icon={<ScissorsIcon />} iconBg="#FFF7ED" value={loading ? '—' : totalServicios} label="Servicios registrados" />
          <StatCard icon={<DollarIcon />} iconBg="#F0FDF4" value={loading ? '—' : formatCurrency(totalFacturado)} label="Facturado total" />
        </div>

        {/* Error global */}
        {error && (
          <div style={{
            background: '#FEF2F2',
            border: '1px solid #FECACA',
            borderRadius: '12px',
            padding: '12px 14px',
            marginTop: '14px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '10px',
          }}>
            <span style={{ fontSize: '13px', color: '#B91C1C', lineHeight: 1.4 }}>{error}</span>
            <button
              className="sa-btn"
              onClick={() => { setError(null); loadTenants() }}
              style={{
                background: 'transparent',
                border: 'none',
                color: '#B91C1C',
                fontFamily: 'Syne, sans-serif',
                fontWeight: 700,
                fontSize: '13px',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                padding: '4px',
              }}
            >
              Reintentar
            </button>
          </div>
        )}

        {/* Lista */}
        <div style={{
          display: 'flex',
          alignItems: 'baseline',
          justifyContent: 'space-between',
          margin: '22px 0 12px',
        }}>
          <h2 style={{
            fontFamily: 'Syne, sans-serif',
            fontWeight: 700,
            fontSize: '16px',
            color: '#0F172A',
          }}>
            Todas las barberías
          </h2>
          {!loading && (
            <span style={{ fontSize: '12px', color: '#64748B' }}>
              {tenants.length} en total
            </span>
          )}
        </div>

        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <TenantCardSkeleton />
            <TenantCardSkeleton />
            <TenantCardSkeleton />
          </div>
        ) : tenants.length === 0 && !error ? (
          <div style={{ ...cardStyle, padding: '32px 20px', textAlign: 'center' }}>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '12px' }}>
              <div style={{
                width: '48px',
                height: '48px',
                borderRadius: '14px',
                background: '#EFF6FF',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}>
                <BuildingIcon />
              </div>
            </div>
            <p style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: '15px', color: '#0F172A' }}>
              Todavía no hay barberías
            </p>
            <p style={{ fontSize: '13px', color: '#64748B', marginTop: '6px', lineHeight: 1.5 }}>
              Registrá la primera para empezar a administrar el sistema.
            </p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {tenants.map((tenant, i) => {
              const subBadge = getSubscriptionBadge(tenant)
              const trialBadge = getTrialBadge(tenant)
              return (
                <motion.div
                  key={tenant.id}
                  initial={reduceMotion ? false : { opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.25, delay: Math.min(i * 0.04, 0.28), ease: [0.23, 1, 0.32, 1] }}
                  style={{ ...cardStyle, padding: '16px', opacity: tenant.is_active ? 1 : undefined }}
                >
                  {/* Cabecera de la card: identidad + estado, tap → detalles */}
                  <button
                    onClick={() => handleViewDetails(tenant)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                      width: '100%',
                      background: 'transparent',
                      border: 'none',
                      padding: 0,
                      cursor: 'pointer',
                      textAlign: 'left',
                    }}
                  >
                    <TenantAvatar name={tenant.name} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{
                        fontFamily: 'Syne, sans-serif',
                        fontWeight: 700,
                        fontSize: '15px',
                        color: tenant.is_active ? '#0F172A' : '#64748B',
                        lineHeight: 1.2,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}>
                        {tenant.name}
                      </div>
                      <div style={{
                        fontSize: '12px',
                        color: '#64748B',
                        marginTop: '3px',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}>
                        {tenant.slug}{!tenant.is_active && ' · inactiva'}
                      </div>
                    </div>
                    <ChevronIcon />
                  </button>

                  {/* Badges de suscripción / trial */}
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '12px' }}>
                    <Pill badge={subBadge} />
                    {trialBadge && !tenant.is_exempt_trial && (
                      <Pill badge={{
                        ...trialBadge,
                        label: typeof trialBadge.days === 'number' && trialBadge.days >= 1
                          ? `${trialBadge.label} · ${trialBadge.days}d`
                          : trialBadge.label,
                      }} />
                    )}
                  </div>

                  {/* Meta: números en Inter 800 */}
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr)',
                    gap: '8px 12px',
                    background: '#F8FAFC',
                    border: '1px solid #F1F5F9',
                    borderRadius: '12px',
                    padding: '10px 12px',
                    marginTop: '12px',
                  }}>
                    <div>
                      <div style={{ fontSize: '11px', color: '#64748B' }}>Facturado</div>
                      <div style={{ fontFamily: "'Inter', system-ui, sans-serif", fontWeight: 800, fontSize: '14px', color: '#0F172A', marginTop: '1px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {formatCurrency(tenant.total_facturado)}
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: '11px', color: '#64748B' }}>Barberos</div>
                      <div style={{ fontFamily: "'Inter', system-ui, sans-serif", fontWeight: 800, fontSize: '14px', color: '#0F172A', marginTop: '1px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {tenant.total_barberos}
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: '11px', color: '#64748B' }}>Susc. hasta</div>
                      <div style={{ fontFamily: "'Inter', system-ui, sans-serif", fontWeight: 800, fontSize: '13px', color: '#0F172A', marginTop: '1px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {formatDate(tenant.subscription_ends_at)}
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: '11px', color: '#64748B' }}>Último pago</div>
                      <div style={{ fontFamily: "'Inter', system-ui, sans-serif", fontWeight: 800, fontSize: '13px', color: '#0F172A', marginTop: '1px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {formatDate(tenant.last_payment_at)}
                      </div>
                    </div>
                  </div>

                  {/* Acciones */}
                  <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
                    <button
                      className="sa-btn"
                      onClick={() => extendSubscription(tenant.id)}
                      disabled={extendingId === tenant.id}
                      style={{
                        flex: 1,
                        padding: '10px 8px',
                        background: '#F0FDF4',
                        color: '#15803D',
                        border: '1px solid #BBF7D0',
                        borderRadius: '12px',
                        fontFamily: 'Syne, sans-serif',
                        fontWeight: 700,
                        fontSize: '13px',
                        cursor: extendingId === tenant.id ? 'wait' : 'pointer',
                        opacity: extendingId === tenant.id ? 0.6 : 1,
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {extendingId === tenant.id ? 'Extendiendo…' : '+1 mes'}
                    </button>
                    <button
                      className="sa-btn"
                      onClick={() => toggleTenantStatus(tenant.id, tenant.is_active)}
                      disabled={togglingId === tenant.id}
                      style={{
                        flex: 1,
                        padding: '10px 8px',
                        background: tenant.is_active ? '#fff' : '#EFF6FF',
                        color: tenant.is_active ? '#475569' : '#2563EB',
                        border: `1px solid ${tenant.is_active ? '#E2E8F0' : '#BFDBFE'}`,
                        borderRadius: '12px',
                        fontFamily: 'Syne, sans-serif',
                        fontWeight: 700,
                        fontSize: '13px',
                        cursor: togglingId === tenant.id ? 'wait' : 'pointer',
                        opacity: togglingId === tenant.id ? 0.6 : 1,
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {togglingId === tenant.id ? '…' : tenant.is_active ? 'Desactivar' : 'Activar'}
                    </button>
                    {!tenant.is_active && (
                      <button
                        className="sa-btn"
                        onClick={() => handleDeleteTenant(tenant)}
                        style={{
                          flex: 1,
                          padding: '10px 8px',
                          background: '#FEF2F2',
                          color: '#B91C1C',
                          border: '1px solid #FECACA',
                          borderRadius: '12px',
                          fontFamily: 'Syne, sans-serif',
                          fontWeight: 700,
                          fontSize: '13px',
                          cursor: 'pointer',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        Eliminar
                      </button>
                    )}
                  </div>
                </motion.div>
              )
            })}
          </div>
        )}

        {/* Footer de acciones */}
        {!loading && (
          <div style={{ display: 'flex', gap: '10px', marginTop: '18px' }}>
            <button
              className="sa-btn"
              onClick={loadTenants}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                padding: '13px 16px',
                background: '#fff',
                color: '#475569',
                border: '1px solid #E2E8F0',
                borderRadius: '12px',
                boxShadow: '0 1px 2px rgba(15,23,42,0.04)',
                fontFamily: 'Syne, sans-serif',
                fontWeight: 700,
                fontSize: '14px',
                cursor: 'pointer',
              }}
            >
              <RefreshIcon />
              Refrescar
            </button>
            <button
              className="sa-btn"
              onClick={() => window.open('/register', '_blank')}
              style={{
                flex: 1,
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                padding: '13px 16px',
                background: '#2563EB',
                color: '#fff',
                border: 'none',
                borderRadius: '12px',
                boxShadow: '0 4px 12px rgba(37,99,235,0.25)',
                fontFamily: 'Syne, sans-serif',
                fontWeight: 700,
                fontSize: '14px',
                cursor: 'pointer',
              }}
            >
              <PlusIcon />
              Nueva barbería
            </button>
          </div>
        )}
      </div>

      {/* ── Bottom sheet: detalles del tenant ── */}
      {showDetailsModal && selectedTenant && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 1000,
            display: 'flex',
            alignItems: 'flex-end',
            justifyContent: 'center',
          }}
        >
          <motion.div
            initial={reduceMotion ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.2 }}
            onClick={closeDetails}
            style={{
              position: 'absolute',
              inset: 0,
              background: 'rgba(15,23,42,0.45)',
            }}
          />
          <motion.div
            initial={reduceMotion ? false : { transform: 'translateY(100%)' }}
            animate={{ transform: 'translateY(0%)' }}
            transition={{ duration: 0.32, ease: [0.32, 0.72, 0, 1] }}
            style={{
              position: 'relative',
              width: '100%',
              maxWidth: '430px',
              maxHeight: '88dvh',
              background: '#F8FAFC',
              borderRadius: '20px 20px 0 0',
              overflowY: 'auto',
              paddingBottom: 'calc(20px + env(safe-area-inset-bottom))',
            }}
          >
            {/* Grip + header del sheet */}
            <div style={{
              position: 'sticky',
              top: 0,
              background: 'rgba(248,250,252,0.95)',
              backdropFilter: 'blur(8px)',
              WebkitBackdropFilter: 'blur(8px)',
              borderBottom: '1px solid #E2E8F0',
              padding: '10px 20px 14px',
              zIndex: 1,
            }}>
              <div style={{
                width: '36px',
                height: '4px',
                borderRadius: '999px',
                background: '#CBD5E1',
                margin: '0 auto 12px',
              }} />
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <TenantAvatar name={selectedTenant.name} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    fontFamily: 'Syne, sans-serif',
                    fontWeight: 700,
                    fontSize: '17px',
                    color: '#0F172A',
                    lineHeight: 1.2,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}>
                    {selectedTenant.name}
                  </div>
                  <div style={{ fontSize: '12px', color: '#64748B', marginTop: '2px' }}>
                    {selectedTenant.slug}
                  </div>
                </div>
                <button
                  className="sa-btn"
                  onClick={closeDetails}
                  aria-label="Cerrar"
                  style={{
                    width: '34px',
                    height: '34px',
                    borderRadius: '10px',
                    background: '#fff',
                    border: '1px solid #E2E8F0',
                    color: '#475569',
                    fontSize: '16px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    lineHeight: 1,
                    flexShrink: 0,
                  }}
                >
                  ×
                </button>
              </div>
            </div>

            <div style={{ padding: '16px 20px 0' }}>
              {loadingDetails ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <div className="sa-shimmer" style={{ height: '76px', borderRadius: '16px' }} />
                  <div className="sa-shimmer" style={{ height: '76px', borderRadius: '16px' }} />
                  <div className="sa-shimmer" style={{ height: '120px', borderRadius: '16px' }} />
                </div>
              ) : errorDetails ? (
                <div style={{
                  background: '#FEF2F2',
                  border: '1px solid #FECACA',
                  borderRadius: '12px',
                  padding: '16px',
                  textAlign: 'center',
                }}>
                  <p style={{ fontSize: '13px', color: '#B91C1C', marginBottom: '12px', lineHeight: 1.4 }}>{errorDetails}</p>
                  <button
                    className="sa-btn"
                    onClick={() => handleViewDetails(selectedTenant)}
                    style={{
                      padding: '9px 18px',
                      background: '#fff',
                      color: '#B91C1C',
                      border: '1px solid #FECACA',
                      borderRadius: '10px',
                      fontFamily: 'Syne, sans-serif',
                      fontWeight: 700,
                      fontSize: '13px',
                      cursor: 'pointer',
                    }}
                  >
                    Reintentar
                  </button>
                </div>
              ) : tenantDetails ? (
                <>
                  {/* Suscripción */}
                  <div style={{ ...cardStyle, padding: '14px 16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' }}>
                      <span style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: '13px', color: '#0F172A' }}>
                        Suscripción
                      </span>
                      <Pill badge={getSubscriptionBadge(selectedTenant)} />
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr) minmax(0,1fr)', gap: '10px', marginTop: '12px' }}>
                      <div>
                        <div style={{ fontSize: '11px', color: '#64748B' }}>Vence</div>
                        <div style={{ fontFamily: "'Inter', system-ui, sans-serif", fontWeight: 800, fontSize: '13px', color: '#0F172A', marginTop: '1px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {formatDate(selectedTenant.subscription_ends_at)}
                        </div>
                      </div>
                      <div>
                        <div style={{ fontSize: '11px', color: '#64748B' }}>Último pago</div>
                        <div style={{ fontFamily: "'Inter', system-ui, sans-serif", fontWeight: 800, fontSize: '13px', color: '#0F172A', marginTop: '1px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {formatDate(selectedTenant.last_payment_at)}
                        </div>
                      </div>
                      <div>
                        <div style={{ fontSize: '11px', color: '#64748B' }}>Trial hasta</div>
                        <div style={{ fontFamily: "'Inter', system-ui, sans-serif", fontWeight: 800, fontSize: '13px', color: '#0F172A', marginTop: '1px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {formatDate(selectedTenant.trial_ends_at)}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Información básica */}
                  <div style={{ ...cardStyle, padding: '14px 16px', marginTop: '12px' }}>
                    <span style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: '13px', color: '#0F172A' }}>
                      Información
                    </span>
                    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr) minmax(0,1fr)', gap: '10px', marginTop: '12px' }}>
                      <div>
                        <div style={{ fontSize: '11px', color: '#64748B' }}>Estado</div>
                        <div style={{ fontSize: '13px', fontWeight: 600, color: tenantDetails.is_active ? '#15803D' : '#B91C1C', marginTop: '1px' }}>
                          {tenantDetails.is_active ? 'Activa' : 'Inactiva'}
                        </div>
                      </div>
                      <div>
                        <div style={{ fontSize: '11px', color: '#64748B' }}>Creada</div>
                        <div style={{ fontFamily: "'Inter', system-ui, sans-serif", fontWeight: 800, fontSize: '13px', color: '#0F172A', marginTop: '1px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {formatDate(tenantDetails.created_at)}
                        </div>
                      </div>
                      <div>
                        <div style={{ fontSize: '11px', color: '#64748B' }}>Horario</div>
                        <div style={{ fontFamily: "'Inter', system-ui, sans-serif", fontWeight: 800, fontSize: '13px', color: '#0F172A', marginTop: '1px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {tenantDetails.opening_time && tenantDetails.closing_time
                            ? `${tenantDetails.opening_time.slice(0, 5)}–${tenantDetails.closing_time.slice(0, 5)}`
                            : '—'}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Métricas 30 días */}
                  <div style={{ ...cardStyle, padding: '14px 16px', marginTop: '12px' }}>
                    <span style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: '13px', color: '#0F172A' }}>
                      Últimos 30 días
                    </span>
                    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr) minmax(0,1fr)', gap: '10px', marginTop: '12px' }}>
                      <div>
                        <div style={{ fontFamily: "'Inter', system-ui, sans-serif", fontWeight: 800, fontSize: '17px', color: '#0F172A', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {tenantDetails.metricas_recientes.servicios_completados}
                        </div>
                        <div style={{ fontSize: '11px', color: '#64748B', marginTop: '2px' }}>Servicios</div>
                      </div>
                      <div>
                        <div style={{ fontFamily: "'Inter', system-ui, sans-serif", fontWeight: 800, fontSize: '17px', color: '#0F172A', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {formatCurrency(tenantDetails.metricas_recientes.facturacion_total)}
                        </div>
                        <div style={{ fontSize: '11px', color: '#64748B', marginTop: '2px' }}>Facturado</div>
                      </div>
                      <div>
                        <div style={{ fontFamily: "'Inter', system-ui, sans-serif", fontWeight: 800, fontSize: '17px', color: '#0F172A', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {tenantDetails.metricas_recientes.turnos_activos}
                        </div>
                        <div style={{ fontSize: '11px', color: '#64748B', marginTop: '2px' }}>Turnos activos</div>
                      </div>
                    </div>
                  </div>

                  {/* Barberos */}
                  <div style={{ ...cardStyle, padding: '14px 16px', marginTop: '12px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                      <span style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: '13px', color: '#0F172A' }}>
                        Barberos ({tenantDetails.barberos.length})
                      </span>
                      <span style={{ fontSize: '11px', color: '#64748B' }}>
                        {tenantDetails.barberos.filter(b => b.is_active).length} activos
                      </span>
                    </div>
                    {tenantDetails.barberos.length === 0 ? (
                      <p style={{ fontSize: '13px', color: '#64748B', marginTop: '10px' }}>
                        No hay barberos registrados.
                      </p>
                    ) : (
                      <div style={{ marginTop: '6px' }}>
                        {tenantDetails.barberos.map((barbero, idx) => (
                          <div
                            key={barbero.id}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              gap: '10px',
                              padding: '10px 0',
                              borderTop: idx === 0 ? 'none' : '1px solid #F1F5F9',
                            }}
                          >
                            <span style={{
                              fontSize: '13px',
                              fontWeight: 600,
                              color: '#0F172A',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                            }}>
                              {barbero.display_name}
                            </span>
                            <span style={{
                              fontSize: '11px',
                              fontWeight: 600,
                              color: barbero.is_active ? '#15803D' : '#64748B',
                              flexShrink: 0,
                            }}>
                              {barbero.is_active ? 'Activo' : 'Inactivo'}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Servicios */}
                  <div style={{ ...cardStyle, padding: '14px 16px', marginTop: '12px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                      <span style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: '13px', color: '#0F172A' }}>
                        Servicios ({tenantDetails.servicios.length})
                      </span>
                      <span style={{ fontSize: '11px', color: '#64748B' }}>
                        {tenantDetails.servicios.filter(s => s.is_active).length} activos
                      </span>
                    </div>
                    {tenantDetails.servicios.length === 0 ? (
                      <p style={{ fontSize: '13px', color: '#64748B', marginTop: '10px' }}>
                        No hay servicios configurados.
                      </p>
                    ) : (
                      <div style={{ marginTop: '6px' }}>
                        {tenantDetails.servicios.map((servicio, idx) => (
                          <div
                            key={servicio.id}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              gap: '10px',
                              padding: '10px 0',
                              borderTop: idx === 0 ? 'none' : '1px solid #F1F5F9',
                            }}
                          >
                            <span style={{
                              fontSize: '13px',
                              fontWeight: 600,
                              color: servicio.is_active ? '#0F172A' : '#64748B',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                            }}>
                              {servicio.name}
                            </span>
                            <span style={{
                              fontFamily: "'Inter', system-ui, sans-serif",
                              fontWeight: 800,
                              fontSize: '13px',
                              color: '#0F172A',
                              flexShrink: 0,
                            }}>
                              {formatCurrency(servicio.base_price)}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Acciones del sheet */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '16px' }}>
                    <button
                      className="sa-btn"
                      onClick={() => extendSubscription(tenantDetails.id)}
                      disabled={extendingId === tenantDetails.id}
                      style={{
                        padding: '13px',
                        background: '#2563EB',
                        color: '#fff',
                        border: 'none',
                        borderRadius: '12px',
                        boxShadow: '0 4px 12px rgba(37,99,235,0.25)',
                        fontFamily: 'Syne, sans-serif',
                        fontWeight: 700,
                        fontSize: '14px',
                        cursor: extendingId === tenantDetails.id ? 'wait' : 'pointer',
                        opacity: extendingId === tenantDetails.id ? 0.7 : 1,
                      }}
                    >
                      {extendingId === tenantDetails.id ? 'Extendiendo…' : 'Extender suscripción 1 mes'}
                    </button>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button
                        className="sa-btn"
                        onClick={() => toggleTenantStatus(tenantDetails.id, tenantDetails.is_active)}
                        disabled={togglingId === tenantDetails.id}
                        style={{
                          flex: 1,
                          padding: '12px',
                          background: '#fff',
                          color: '#475569',
                          border: '1px solid #E2E8F0',
                          borderRadius: '12px',
                          fontFamily: 'Syne, sans-serif',
                          fontWeight: 700,
                          fontSize: '13px',
                          cursor: togglingId === tenantDetails.id ? 'wait' : 'pointer',
                          opacity: togglingId === tenantDetails.id ? 0.6 : 1,
                        }}
                      >
                        {tenantDetails.is_active ? 'Desactivar' : 'Activar'}
                      </button>
                      {!tenantDetails.is_active && (
                        <button
                          className="sa-btn"
                          onClick={() => {
                            setShowDetailsModal(false)
                            handleDeleteTenant(selectedTenant)
                          }}
                          style={{
                            flex: 1,
                            padding: '12px',
                            background: '#FEF2F2',
                            color: '#B91C1C',
                            border: '1px solid #FECACA',
                            borderRadius: '12px',
                            fontFamily: 'Syne, sans-serif',
                            fontWeight: 700,
                            fontSize: '13px',
                            cursor: 'pointer',
                          }}
                        >
                          Eliminar
                        </button>
                      )}
                    </div>
                  </div>
                </>
              ) : null}
            </div>
          </motion.div>
        </div>
      )}

      {/* ── Modal: confirmación de eliminación ── */}
      {showDeleteModal && selectedTenant && (
        <div style={{
          position: 'fixed',
          inset: 0,
          zIndex: 1001,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '20px',
        }}>
          <motion.div
            initial={reduceMotion ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.2 }}
            onClick={() => { if (!deleting) { setShowDeleteModal(false); setDeleteConfirmationText('') } }}
            style={{ position: 'absolute', inset: 0, background: 'rgba(15,23,42,0.45)' }}
          />
          <motion.div
            initial={reduceMotion ? false : { opacity: 0, transform: 'scale(0.95)' }}
            animate={{ opacity: 1, transform: 'scale(1)' }}
            transition={{ duration: 0.22, ease: [0.23, 1, 0.32, 1] }}
            style={{
              position: 'relative',
              width: '100%',
              maxWidth: '390px',
              background: '#fff',
              borderRadius: '20px',
              boxShadow: '0 8px 24px rgba(15,23,42,0.12)',
              padding: '20px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px' }}>
              <div style={{
                width: '40px',
                height: '40px',
                borderRadius: '12px',
                background: '#FEF2F2',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}>
                <WarningIcon />
              </div>
              <h2 style={{
                fontFamily: 'Syne, sans-serif',
                fontWeight: 700,
                fontSize: '16px',
                color: '#0F172A',
                lineHeight: 1.25,
              }}>
                Eliminar "{selectedTenant.name}"
              </h2>
            </div>

            <p style={{ fontSize: '13px', color: '#475569', lineHeight: 1.5, marginBottom: '10px' }}>
              <strong style={{ color: '#B91C1C' }}>Esta acción no se puede deshacer.</strong>{' '}
              Se eliminan perfiles, servicios, turnos y toda la facturación de la barbería.
            </p>

            <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#475569', marginBottom: '6px' }}>
              Escribí el slug para confirmar:{' '}
              <span style={{ color: '#2563EB', fontWeight: 700 }}>{selectedTenant.slug}</span>
            </label>
            <input
              type="text"
              value={deleteConfirmationText}
              onChange={(e) => setDeleteConfirmationText(e.target.value)}
              placeholder={selectedTenant.slug}
              disabled={deleting}
              autoComplete="off"
              style={{
                width: '100%',
                padding: '12px 14px',
                background: '#F8FAFC',
                border: `1.5px solid ${deleteConfirmationText === selectedTenant.slug ? '#2563EB' : '#E2E8F0'}`,
                borderRadius: '12px',
                color: '#0F172A',
                fontFamily: 'Space Grotesk, sans-serif',
                fontSize: '14px',
                outline: 'none',
                transition: 'border-color 150ms ease',
                boxSizing: 'border-box',
              }}
            />
            {deleteConfirmationText && deleteConfirmationText !== selectedTenant.slug && (
              <p style={{ color: '#B91C1C', fontSize: '12px', marginTop: '6px' }}>
                El texto no coincide con el slug
              </p>
            )}

            <div style={{ display: 'flex', gap: '8px', marginTop: '16px' }}>
              <button
                className="sa-btn"
                onClick={() => { setShowDeleteModal(false); setDeleteConfirmationText('') }}
                disabled={deleting}
                style={{
                  flex: 1,
                  padding: '12px',
                  background: '#fff',
                  color: '#475569',
                  border: '1px solid #E2E8F0',
                  borderRadius: '12px',
                  fontFamily: 'Syne, sans-serif',
                  fontWeight: 700,
                  fontSize: '13px',
                  cursor: 'pointer',
                  opacity: deleting ? 0.5 : 1,
                }}
              >
                Cancelar
              </button>
              <button
                className="sa-btn"
                onClick={confirmDelete}
                disabled={deleteConfirmationText !== selectedTenant.slug || deleting}
                style={{
                  flex: 1,
                  padding: '12px',
                  background: '#DC2626',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '12px',
                  fontFamily: 'Syne, sans-serif',
                  fontWeight: 700,
                  fontSize: '13px',
                  cursor: deleteConfirmationText === selectedTenant.slug && !deleting ? 'pointer' : 'not-allowed',
                  opacity: deleteConfirmationText === selectedTenant.slug && !deleting ? 1 : 0.5,
                }}
              >
                {deleting ? 'Eliminando…' : 'Eliminar'}
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* Micro-interacciones globales de la página */}
      <style>{`
        .sa-btn {
          transition: transform 160ms cubic-bezier(0.23, 1, 0.32, 1);
        }
        .sa-btn:active:not(:disabled) {
          transform: scale(0.97);
        }
        .sa-shimmer {
          background: linear-gradient(90deg, #EEF2F7 25%, #F8FAFC 50%, #EEF2F7 75%);
          background-size: 200% 100%;
          animation: sa-shimmer 1.4s ease infinite;
        }
        @keyframes sa-shimmer {
          to { background-position: -200% 0; }
        }
        @media (prefers-reduced-motion: reduce) {
          .sa-btn { transition: none; }
          .sa-btn:active:not(:disabled) { transform: none; }
          .sa-shimmer { animation: none; }
        }
      `}</style>
    </div>
  )
}
