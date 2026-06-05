import { useState, useEffect } from 'react'
import { useTenantStore } from '../../stores/tenantStore'
import { supabase } from '../../config/supabase'
import type { ServiceCatalog, ServiceLog, CommissionRules, Shift } from '../../types'

async function getAuthHeader(): Promise<string> {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) {
    const { data: { session: refreshed } } = await supabase.auth.refreshSession()
    if (!refreshed?.access_token) throw new Error('No session')
    return `Bearer ${refreshed.access_token}`
  }
  return `Bearer ${session.access_token}`
}

interface ServiceWithEstimation extends ServiceCatalog {
  estimatedEarning: number
}

function applyCommission(rules: CommissionRules['rules'], serviceNumber: number, price: number) {
  const rule = rules.find(r =>
    serviceNumber >= r.from_service &&
    (r.to_service === null || serviceNumber <= r.to_service)
  )
  if (!rule) return price // default: todo al barbero
  return (price * rule.barber_pct) / 100
}

export function Dashboard() {
  const { tenant, profile, activeShiftId, setActiveShiftId } = useTenantStore()
  const [services, setServices] = useState<ServiceWithEstimation[]>([])
  const [products, setProducts] = useState<ServiceCatalog[]>([])
  const [todayLogs, setTodayLogs] = useState<ServiceLog[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [shiftStatus, setShiftStatus] = useState<'loading' | 'no_shift' | 'open' | 'paused' | 'closed'>('loading')
  const [currentShift, setCurrentShift] = useState<Shift | null>(null)
  const [selectedServices, setSelectedServices] = useState<ServiceWithEstimation[]>([])
  const [selectedProducts, setSelectedProducts] = useState<ServiceCatalog[]>([])
  const [wizardStep, setWizardStep] = useState<0|1|2|3|4|5>(0)
  const [wizardPaymentMethod, setWizardPaymentMethod] = useState<'efectivo'|'transferencia'>('efectivo')
  const [wizardTip, setWizardTip] = useState('')
  const [wizardTipEnabled, setWizardTipEnabled] = useState(false)
  const [processing, setProcessing] = useState(false)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [shiftLoading, setShiftLoading] = useState(false)
  const [confirmingClose, setConfirmingClose] = useState(false)
  const [refreshTrigger, setRefreshTrigger] = useState(0)
  const [appointmentsCount, setAppointmentsCount] = useState<number>(0)
  const [lastShiftDate, setLastShiftDate] = useState<string | null>(null)


  useEffect(() => {
    let isMounted = true

    if (!tenant?.id || !profile?.id) {
      if (isMounted) setLoading(false)
      const retryId = setTimeout(() => {
        if (isMounted) setRefreshTrigger(prev => prev + 1)
      }, 500)
      return () => {
        isMounted = false
        clearTimeout(retryId)
      }
    }

    const loadData = async () => {
      if (isMounted) setLoading(true)
      setError(null)

      try {
        // Check for active shift (open or paused)
        const { data: activeShift, error: shiftError } = await supabase
          .from('shifts')
          .select('*')
          .eq('tenant_id', tenant.id)
          .eq('barber_id', profile.id)
          .in('status', ['open', 'paused'])
          .maybeSingle()

        if (shiftError) {
          console.error('Error fetching active shift:', shiftError)
          // Continue without shift
        }

        if (activeShift) {
          if (isMounted) {
            setShiftStatus(activeShift.status) // 'open' or 'paused'
            setCurrentShift(activeShift)
            setActiveShiftId(activeShift.id)
          }
        } else {
          if (isMounted) {
            setShiftStatus(prev => prev === 'closed' ? 'closed' : 'no_shift')
            setCurrentShift(null)
            setActiveShiftId(null)
          }
        }

        // Load services catalog
        const { data: servicesData, error: servicesError } = await supabase
          .from('services_catalog')
          .select('*')
          .eq('tenant_id', tenant.id)
          .eq('is_active', true)
          .order('name')

        if (servicesError) throw servicesError

        // Resolve which shift_id to use for logs and appointments
        let shiftIdForLogs: string | null = null
        if (activeShift) {
          shiftIdForLogs = activeShift.id
        } else {
          const { data: closedShift } = await supabase
            .from('shifts')
            .select('id, started_at')
            .eq('tenant_id', tenant.id)
            .eq('barber_id', profile.id)
            .eq('status', 'closed')
            .order('started_at', { ascending: false })
            .limit(1)
            .maybeSingle()
          shiftIdForLogs = closedShift?.id ?? null
          if (closedShift?.started_at && isMounted) {
            const d = new Date(closedShift.started_at)
            const formatted = d.toLocaleDateString('es-AR', {
              weekday: 'long', day: 'numeric', month: 'long',
              timeZone: 'America/Argentina/Buenos_Aires',
            })
            setLastShiftDate(`Datos del turno del ${formatted}`)
          }
        }

        // Load service logs for the resolved shift (empty if no shift found)
        let logsData: any[] = []
        if (shiftIdForLogs) {
          const { data: logsDataQuery, error: logsError } = await supabase
            .from('service_logs')
            .select('*')
            .eq('tenant_id', tenant.id)
            .eq('barber_id', profile.id)
            .eq('status', 'completed')
            .eq('shift_id', shiftIdForLogs)
            .order('started_at', { ascending: false })
          if (logsError) throw logsError
          logsData = logsDataQuery || []
        }

        // Split catalog into services (commission-based) and products (100% owner)
        const catalog = servicesData || []
        const servicesOnly = catalog.filter(s => s.category === 'servicio')
        const productsOnly = catalog.filter(s => s.category === 'producto')

        // Calculate estimated earnings for each service based on next service number
        const nextServiceNumber = (logsData?.length || 0) + 1
        const commissionRules = tenant.commission_rules?.rules || []
        const servicesWithEstimation: ServiceWithEstimation[] = servicesOnly.map(service => ({
          ...service,
          estimatedEarning: applyCommission(commissionRules, nextServiceNumber, service.base_price),
        }))

        // Count appointments for the resolved shift
        let appointmentsCount = 0
        if (shiftIdForLogs) {
          const { count, error: appointmentsError } = await supabase
            .from('appointments')
            .select('*', { count: 'exact', head: true })
            .eq('tenant_id', tenant.id)
            .eq('barber_id', profile.id)
            .eq('shift_id', shiftIdForLogs)
          if (appointmentsError) {
            console.error('Error counting appointments:', appointmentsError)
          } else {
            appointmentsCount = count || 0
          }
        }

        if (isMounted) {
          setServices(servicesWithEstimation)
          setProducts(productsOnly)
          setTodayLogs(logsData || [])
          setAppointmentsCount(appointmentsCount)
        }
      } catch (err: unknown) {
        console.error('Error loading dashboard data:', err)
        const errorMessage = err instanceof Error ? err.message : 'Error al cargar datos'
        if (isMounted) setError(errorMessage)
      } finally {
        if (isMounted) setLoading(false)
      }
    }

    loadData()
    return () => { isMounted = false; setLoading(false) }
  }, [tenant, profile, setActiveShiftId, refreshTrigger])

  const totalEarningsToday = todayLogs.reduce((sum, log) => sum + log.barber_earning, 0)

  const handleOpenShift = async () => {
    if (!tenant || !profile) return
    setShiftLoading(true)
    setError(null)
    try {
      const authHeader = await getAuthHeader()
      const response = await fetch('/api/open-shift', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': authHeader },
        body: JSON.stringify({
          barber_id: profile.id,
          tenant_id: tenant.id,
        }),
      })
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Error al abrir turno')
      }
      const result = await response.json()
      // Update local state
      setShiftStatus('open')
      setCurrentShift(result.shift)
      setActiveShiftId(result.shift.id)
      setRefreshTrigger(prev => prev + 1) // Trigger reload of logs/services
      setSuccessMessage('Turno iniciado correctamente')
      setTimeout(() => setSuccessMessage(null), 5000)
    } catch (err: unknown) {
      console.error('Error opening shift:', err)
      const errorMessage = err instanceof Error ? err.message : 'Error al abrir turno'
      setError(errorMessage)
    } finally {
      setShiftLoading(false)
    }
  }

  const handleCloseShift = async () => {
    if (!tenant || !profile || !currentShift) return
    setShiftLoading(true)
    setError(null)
    try {
      const authHeader = await getAuthHeader()
      const response = await fetch('/api/close-shift', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': authHeader },
        body: JSON.stringify({
          shift_id: currentShift.id,
          tenant_id: tenant.id,
          barber_id: profile.id,
        }),
      })
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Error al cerrar turno')
      }
      // Update local state
      setShiftStatus('closed')
      setCurrentShift(null)
      setActiveShiftId(null)
      setRefreshTrigger(prev => prev + 1) // Trigger reload of logs/services
      setSuccessMessage('Turno cerrado correctamente')
      setTimeout(() => setSuccessMessage(null), 5000)
    } catch (err: unknown) {
      console.error('Error closing shift:', err)
      const errorMessage = err instanceof Error ? err.message : 'Error al cerrar turno'
      setError(errorMessage)
    } finally {
      setShiftLoading(false)
    }
  }

  const handlePauseResumeShift = async () => {
    if (!tenant || !profile || !currentShift) return
    setShiftLoading(true)
    setError(null)
    try {
      const authHeader = await getAuthHeader()
      const response = await fetch('/api/pause-shift', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': authHeader },
        body: JSON.stringify({
          shift_id: currentShift.id,
          tenant_id: tenant.id,
          barber_id: profile.id,
        }),
      })
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Error al pausar/reanudar turno')
      }
      const result = await response.json()
      // Update local state
      setShiftStatus(result.shift.status) // 'open' or 'paused'
      setCurrentShift(result.shift)
      setRefreshTrigger(prev => prev + 1) // Trigger reload of logs/services
      setSuccessMessage(result.message || 'Turno pausado/reanudado correctamente')
      setTimeout(() => setSuccessMessage(null), 5000)
    } catch (err: unknown) {
      console.error('Error pausing/resuming shift:', err)
      const errorMessage = err instanceof Error ? err.message : 'Error al pausar/reanudar turno'
      setError(errorMessage)
    } finally {
      setShiftLoading(false)
    }
  }

  const toggleServiceSelection = (service: ServiceWithEstimation) => {
    if (shiftStatus !== 'open') {
      setError('No hay un turno abierto. Inicia un turno para registrar servicios.')
      return
    }
    setSelectedServices(prev => {
      const existing = prev.find(s => s.id === service.id)
      if (existing) {
        // Remove
        return prev.filter(s => s.id !== service.id)
      } else {
        // Add
        return [...prev, service]
      }
    })
  }

  const toggleProductSelection = (product: ServiceCatalog) => {
    setSelectedProducts(prev => {
      const existing = prev.find(p => p.id === product.id)
      if (existing) {
        return prev.filter(p => p.id !== product.id)
      } else {
        return [...prev, product]
      }
    })
  }

  const confirmAttention = async () => {
    if (!tenant || !profile || selectedServices.length === 0) return
    if (shiftStatus !== 'open') {
      setError('No hay un turno abierto. Inicia un turno para registrar servicios.')
      return
    }

    setProcessing(true)
    setError(null)

    try {
      const servicesPayload = selectedServices.map(s => ({
        service_id: s.id,
        price_charged: s.base_price,
      }))

      const authHeader = await getAuthHeader()
      const response = await fetch('/.netlify/functions/log-service', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': authHeader },
        body: JSON.stringify({
          barber_id: profile.id,
          tenant_id: tenant.id,
          services: servicesPayload,
          started_at: new Date().toISOString(),
          shift_id: activeShiftId,
          payment_method: wizardPaymentMethod,
          tip_amount: parseFloat(wizardTip) || 0,
          tip_payment_method: wizardPaymentMethod,
          others_amount: selectedProducts.reduce((sum, p) => sum + p.base_price, 0),
          others_payment_method: wizardPaymentMethod,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Error al registrar atención')
      }

      const result = await response.json()

      // Refresh data
      setRefreshTrigger(prev => prev + 1)
      // Reset wizard
      setWizardStep(0)
      setSelectedServices([])
      setSelectedProducts([])
      setWizardPaymentMethod('efectivo')
      setWizardTip('')
      setWizardTipEnabled(false)

      setSuccessMessage(`¡Cliente registrado! ${result.message || ''}`)
      setTimeout(() => setSuccessMessage(null), 5000)
    } catch (err: unknown) {
      console.error('Error confirming attention:', err)
      const errorMessage = err instanceof Error ? err.message : 'Error al registrar atención'
      setError(errorMessage)
    } finally {
      setProcessing(false)
    }
  }


  if (loading) {
    return (
      <div style={{ maxWidth: '1000px', margin: '0 auto', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '240px', gap: '16px' }}>
        <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
        <div style={{ width: 36, height: 36, borderRadius: '50%', border: '3px solid #E8E9EB', borderTopColor: '#D4A853', animation: 'spin 0.8s linear infinite' }} />
        <p style={{ fontSize: 14, color: '#9CA3AF', fontFamily: 'Space Grotesk, sans-serif', margin: 0 }}>Cargando...</p>
      </div>
    )
  }

  return (
    <div style={{ width: '100%', maxWidth: '100%', overflowX: 'hidden' }}>

      {/* Success toast */}
      {successMessage && (
        <div style={{
          position: 'fixed', top: '20px', right: '20px',
          background: '#fff', color: '#1E2A3A',
          border: '1px solid #E8E9EB', padding: '14px 20px',
          borderRadius: '10px', fontFamily: 'Space Grotesk, sans-serif',
          fontWeight: 600, fontSize: '14px',
          zIndex: 1000, boxShadow: '0 4px 16px rgba(0,0,0,0.10)',
        }}>
          ✓ {successMessage}
        </div>
      )}

      {/* Hero banner */}
      <div className="dashboard-hero" style={{
        background: '#1E2A3A',
        backgroundImage: 'repeating-linear-gradient(45deg, rgba(255,255,255,0.03) 0px, rgba(255,255,255,0.03) 1px, transparent 1px, transparent 10px)',
        borderRadius: '14px', padding: '28px 32px', marginBottom: '20px',
        position: 'relative', overflow: 'hidden', width: '100%',
      }}>
        {/* Shift status badge */}
        <div style={{ position: 'absolute', top: '20px', right: '24px' }}>
          {shiftStatus === 'open' ? (
            <span style={{ background: 'rgba(212,168,83,0.15)', color: '#D4A853', border: '1px solid rgba(212,168,83,0.3)', borderRadius: '20px', padding: '4px 12px', fontSize: '12px', fontFamily: 'Space Grotesk, sans-serif', fontWeight: 600 }}>● Turno activo</span>
          ) : shiftStatus === 'paused' ? (
            <span style={{ background: 'rgba(212,168,83,0.1)', color: '#D4A853', border: '1px solid rgba(212,168,83,0.2)', borderRadius: '20px', padding: '4px 12px', fontSize: '12px', fontFamily: 'Space Grotesk, sans-serif', fontWeight: 600 }}>⏸ Pausado</span>
          ) : (
            <span style={{ background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.5)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '20px', padding: '4px 12px', fontSize: '12px', fontFamily: 'Space Grotesk, sans-serif', fontWeight: 600 }}>○ Sin turno</span>
          )}
        </div>
        <h1 style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: '28px', color: '#fff', margin: 0 }}>
          Hola, {profile?.display_name || 'Barbero'}
        </h1>
        <p style={{ color: 'rgba(255,255,255,0.65)', fontFamily: 'Space Grotesk, sans-serif', fontSize: '14px', marginTop: '8px', marginBottom: 0 }}>
          Tu día empieza ahora. Que los cortes fluyan.
        </p>
      </div>

      {/* Shift control card */}
      <div style={{ background: '#fff', border: '1px solid #E8E9EB', borderRadius: '12px', padding: '24px', marginBottom: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
        <h2 style={{ fontFamily: 'Space Grotesk, sans-serif', fontWeight: 500, fontSize: '11px', color: '#9CA3AF', margin: '0 0 20px 0', textTransform: 'uppercase', letterSpacing: '1.5px' }}>Control de turno</h2>

        {shiftStatus === 'loading' && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 600, fontSize: '18px', color: '#1E2A3A' }}>Verificando turno...</div>
              <div style={{ fontFamily: 'Space Grotesk, sans-serif', fontSize: '13px', color: '#6B7280', marginTop: '4px' }}>Consultando estado actual</div>
            </div>
            <button disabled style={{ background: '#F9FAFB', color: '#9CA3AF', border: '1px solid #E8E9EB', borderRadius: '8px', padding: '10px 20px', fontFamily: 'Space Grotesk, sans-serif', fontWeight: 600, fontSize: '14px', cursor: 'not-allowed', opacity: 0.6 }}>
              Cargando...
            </button>
          </div>
        )}

        {shiftStatus === 'no_shift' && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '16px 24px 8px', gap: '12px', textAlign: 'center' }}>
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#D4A853" strokeWidth="1.5" style={{ opacity: 0.7 }}>
              <circle cx="6" cy="6" r="3"/><circle cx="6" cy="18" r="3"/>
              <line x1="20" y1="4" x2="8.12" y2="15.88"/><line x1="14.47" y1="14.48" x2="20" y2="20"/>
              <line x1="8.12" y1="8.12" x2="12" y2="12"/>
            </svg>
            <div>
              <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 600, fontSize: '18px', color: '#1E2A3A' }}>No hay turno activo</div>
              <div style={{ fontFamily: 'Space Grotesk, sans-serif', fontSize: '14px', color: '#6B7280', marginTop: '4px' }}>Iniciá tu turno para comenzar a registrar clientes</div>
            </div>
            <button
              onClick={handleOpenShift}
              disabled={shiftLoading}
              style={{ background: '#D4A853', color: '#1E2A3A', border: 'none', borderRadius: '8px', padding: '12px 32px', fontFamily: 'Space Grotesk, sans-serif', fontWeight: 600, fontSize: '14px', cursor: shiftLoading ? 'not-allowed' : 'pointer', opacity: shiftLoading ? 0.6 : 1, marginTop: '4px', transition: 'background 150ms' }}
            >
              {shiftLoading ? 'Procesando...' : 'Iniciar turno'}
            </button>
          </div>
        )}

        {shiftStatus === 'open' && currentShift && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
            <div>
              <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 600, fontSize: '18px', color: '#1E2A3A' }}>Turno activo</div>
              <div style={{ fontFamily: 'Space Grotesk, sans-serif', fontSize: '13px', color: '#6B7280', marginTop: '4px' }}>
                Iniciado a las {new Date(currentShift.started_at).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
                {currentShift.total_services > 0 && ` · ${currentShift.total_services} servicios · $${currentShift.barber_earnings.toLocaleString()} ganados`}
              </div>
            </div>
            <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
              <button
                onClick={handlePauseResumeShift}
                disabled={shiftLoading}
                style={{ background: 'transparent', color: '#1E2A3A', border: '1.5px solid #1E2A3A', borderRadius: '8px', padding: '10px 20px', fontFamily: 'Space Grotesk, sans-serif', fontWeight: 600, fontSize: '14px', cursor: shiftLoading ? 'not-allowed' : 'pointer', opacity: shiftLoading ? 0.6 : 1, transition: 'all 150ms' }}
                onMouseEnter={e => { if (!shiftLoading) { e.currentTarget.style.background = '#1E2A3A'; e.currentTarget.style.color = '#fff' } }}
                onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#1E2A3A' }}
              >
                {shiftLoading ? 'Procesando...' : 'Pausar'}
              </button>
              {confirmingClose ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontFamily: 'Space Grotesk, sans-serif', fontSize: '13px', color: '#1E2A3A' }}>¿Cerrar turno?</span>
                  <button onClick={() => { setConfirmingClose(false); handleCloseShift() }} disabled={shiftLoading}
                    style={{ background: '#FEF2F2', color: '#DC2626', border: '1.5px solid #FCA5A5', borderRadius: '8px', padding: '8px 14px', fontFamily: 'Space Grotesk, sans-serif', fontWeight: 600, fontSize: '13px', cursor: 'pointer', transition: 'all 150ms' }}>
                    Sí, cerrar
                  </button>
                  <button onClick={() => setConfirmingClose(false)}
                    style={{ background: '#F9FAFB', color: '#6B7280', border: '1px solid #E8E9EB', borderRadius: '8px', padding: '8px 14px', fontFamily: 'Space Grotesk, sans-serif', fontWeight: 600, fontSize: '13px', cursor: 'pointer' }}>
                    Cancelar
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setConfirmingClose(true)}
                  disabled={shiftLoading}
                  style={{ background: '#FEF2F2', color: '#DC2626', border: '1.5px solid #FCA5A5', borderRadius: '8px', padding: '10px 20px', fontFamily: 'Space Grotesk, sans-serif', fontWeight: 600, fontSize: '14px', cursor: shiftLoading ? 'not-allowed' : 'pointer', opacity: shiftLoading ? 0.6 : 1, transition: 'all 150ms' }}
                  onMouseEnter={e => { if (!shiftLoading) { e.currentTarget.style.background = '#DC2626'; e.currentTarget.style.color = '#fff' } }}
                  onMouseLeave={e => { e.currentTarget.style.background = '#FEF2F2'; e.currentTarget.style.color = '#DC2626' }}
                >
                  {shiftLoading ? 'Procesando...' : 'Cerrar turno'}
                </button>
              )}
            </div>
          </div>
        )}

        {shiftStatus === 'paused' && currentShift && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
            <div>
              <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 600, fontSize: '18px', color: '#1E2A3A' }}>Turno pausado</div>
              <div style={{ fontFamily: 'Space Grotesk, sans-serif', fontSize: '13px', color: '#6B7280', marginTop: '4px' }}>
                Iniciado a las {new Date(currentShift.started_at).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
                {currentShift.paused_at && ` · Pausado a las ${new Date(currentShift.paused_at).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}`}
                {currentShift.total_services > 0 && ` · ${currentShift.total_services} servicios · $${currentShift.barber_earnings.toLocaleString()} ganados`}
              </div>
            </div>
            <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
              <button
                onClick={handlePauseResumeShift}
                disabled={shiftLoading}
                style={{ background: '#D4A853', color: '#1E2A3A', border: 'none', borderRadius: '8px', padding: '10px 20px', fontFamily: 'Space Grotesk, sans-serif', fontWeight: 600, fontSize: '14px', cursor: shiftLoading ? 'not-allowed' : 'pointer', opacity: shiftLoading ? 0.6 : 1 }}
              >
                {shiftLoading ? 'Procesando...' : 'Reanudar'}
              </button>
              {confirmingClose ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontFamily: 'Space Grotesk, sans-serif', fontSize: '13px', color: '#1E2A3A' }}>¿Cerrar turno?</span>
                  <button onClick={() => { setConfirmingClose(false); handleCloseShift() }} disabled={shiftLoading}
                    style={{ background: '#FEF2F2', color: '#DC2626', border: '1.5px solid #FCA5A5', borderRadius: '8px', padding: '8px 14px', fontFamily: 'Space Grotesk, sans-serif', fontWeight: 600, fontSize: '13px', cursor: 'pointer' }}>
                    Sí, cerrar
                  </button>
                  <button onClick={() => setConfirmingClose(false)}
                    style={{ background: '#F9FAFB', color: '#6B7280', border: '1px solid #E8E9EB', borderRadius: '8px', padding: '8px 14px', fontFamily: 'Space Grotesk, sans-serif', fontWeight: 600, fontSize: '13px', cursor: 'pointer' }}>
                    Cancelar
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setConfirmingClose(true)}
                  disabled={shiftLoading}
                  style={{ background: '#FEF2F2', color: '#DC2626', border: '1.5px solid #FCA5A5', borderRadius: '8px', padding: '10px 20px', fontFamily: 'Space Grotesk, sans-serif', fontWeight: 600, fontSize: '14px', cursor: shiftLoading ? 'not-allowed' : 'pointer', opacity: shiftLoading ? 0.6 : 1, transition: 'all 150ms' }}
                  onMouseEnter={e => { if (!shiftLoading) { e.currentTarget.style.background = '#DC2626'; e.currentTarget.style.color = '#fff' } }}
                  onMouseLeave={e => { e.currentTarget.style.background = '#FEF2F2'; e.currentTarget.style.color = '#DC2626' }}
                >
                  {shiftLoading ? 'Procesando...' : 'Cerrar turno'}
                </button>
              )}
            </div>
          </div>
        )}

        {shiftStatus === 'closed' && (
          <div>
            <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 600, fontSize: '18px', color: '#1E2A3A' }}>Turno cerrado</div>
            <div style={{ fontFamily: 'Space Grotesk, sans-serif', fontSize: '13px', color: '#6B7280', marginTop: '4px' }}>Tu día ha finalizado. Hasta mañana.</div>
          </div>
        )}
      </div>

      {/* Error message */}
      {error && (
        <div style={{ background: '#FEF2F2', border: '1px solid #FCA5A5', borderRadius: '10px', padding: '12px 16px', marginBottom: '16px', color: '#DC2626', fontFamily: 'Space Grotesk, sans-serif', fontSize: '14px' }}>
          {error}
        </div>
      )}

      {/* Stat cards */}
      <div className="stats-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '16px', marginBottom: '20px' }}>

        {/* Servicios */}
        <div
          style={{ background: '#fff', border: '1px solid #E8E9EB', borderRadius: '12px', padding: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)', transition: 'box-shadow 200ms, transform 200ms', cursor: 'default' }}
          onMouseEnter={e => { e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.08)'; e.currentTarget.style.transform = 'translateY(-1px)' }}
          onMouseLeave={e => { e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.06)'; e.currentTarget.style.transform = 'translateY(0)' }}
        >
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
            <div>
              <h3 style={{ fontFamily: 'Space Grotesk, sans-serif', fontWeight: 500, fontSize: '11px', color: '#9CA3AF', margin: 0, textTransform: 'uppercase', letterSpacing: '1px' }}>Servicios</h3>
              <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: '36px', color: '#1E2A3A', marginTop: '8px', lineHeight: 1 }}>{todayLogs.length}</div>
            </div>
            <div style={{ background: '#EFF6FF', borderRadius: '10px', width: 40, height: 40, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#3B82F6" strokeWidth="2">
                <circle cx="6" cy="6" r="3"/><circle cx="6" cy="18" r="3"/>
                <line x1="20" y1="4" x2="8.12" y2="15.88"/><line x1="14.47" y1="14.48" x2="20" y2="20"/>
                <line x1="8.12" y1="8.12" x2="12" y2="12"/>
              </svg>
            </div>
          </div>
        </div>

        {/* Mi ganancia — highlighted */}
        <div
          style={{ background: '#fff', borderTop: '3px solid #D4A853', borderLeft: '1.5px solid #D4A853', borderRight: '1.5px solid #D4A853', borderBottom: '1.5px solid #D4A853', borderRadius: '12px', padding: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)', transition: 'box-shadow 200ms', cursor: 'default', overflow: 'hidden' }}
          onMouseEnter={e => { e.currentTarget.style.boxShadow = '0 4px 16px rgba(212,168,83,0.15)' }}
          onMouseLeave={e => { e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.06)' }}
        >
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
            <div>
              <h3 style={{ fontFamily: 'Space Grotesk, sans-serif', fontWeight: 500, fontSize: '11px', color: '#9CA3AF', margin: 0, textTransform: 'uppercase', letterSpacing: '1px' }}>Mi ganancia</h3>
              <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: '36px', color: '#D4A853', marginTop: '8px', lineHeight: 1 }}>${totalEarningsToday.toLocaleString()}</div>
              <div style={{ fontFamily: 'Space Grotesk, sans-serif', fontSize: '11px', color: '#9CA3AF', marginTop: '6px' }}>del turno actual</div>
            </div>
            <div style={{ background: '#FBF7EC', borderRadius: '10px', width: 40, height: 40, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#D4A853" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          </div>
        </div>

        {/* Atenciones */}
        <div
          style={{ background: '#fff', border: '1px solid #E8E9EB', borderRadius: '12px', padding: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)', transition: 'box-shadow 200ms, transform 200ms', cursor: 'default' }}
          onMouseEnter={e => { e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.08)'; e.currentTarget.style.transform = 'translateY(-1px)' }}
          onMouseLeave={e => { e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.06)'; e.currentTarget.style.transform = 'translateY(0)' }}
        >
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
            <div>
              <h3 style={{ fontFamily: 'Space Grotesk, sans-serif', fontWeight: 500, fontSize: '11px', color: '#9CA3AF', margin: 0, textTransform: 'uppercase', letterSpacing: '1px' }}>Clientes</h3>
              <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: '36px', color: '#1E2A3A', marginTop: '8px', lineHeight: 1 }}>{appointmentsCount}</div>
            </div>
            <div style={{ background: '#F0FDF4', borderRadius: '10px', width: 40, height: 40, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#16A34A" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            </div>
          </div>
        </div>

      </div>

      {shiftStatus === 'closed' && lastShiftDate && (
        <div style={{ textAlign: 'center', color: '#9CA3AF', fontSize: '12px', fontFamily: 'Space Grotesk, sans-serif', marginBottom: '16px', marginTop: '-8px' }}>
          {lastShiftDate}
        </div>
      )}

      {/* Register attention button */}
      {shiftStatus === 'open' ? (
        <button
          onClick={() => { setSelectedServices([]); setSelectedProducts([]); setWizardStep(1) }}
          style={{ width: '100%', height: '56px', background: '#1E2A3A', color: '#fff', fontFamily: 'Space Grotesk, sans-serif', fontWeight: 600, fontSize: '16px', letterSpacing: '0.01em', border: 'none', borderRadius: '10px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', transition: 'all 150ms ease' }}
          onMouseEnter={e => { e.currentTarget.style.background = '#2D3F52'; e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = '0 4px 12px rgba(30,42,58,0.25)' }}
          onMouseLeave={e => { e.currentTarget.style.background = '#1E2A3A'; e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = 'none' }}
          onMouseDown={e => { e.currentTarget.style.transform = 'translateY(0)' }}
        >
          <span style={{ color: '#D4A853', fontSize: '22px', fontWeight: 700, lineHeight: 1 }}>+</span>
          Registrar cliente
        </button>
      ) : (
        <div>
          <button
            disabled
            style={{ width: '100%', height: '56px', background: '#F3F4F6', color: '#9CA3AF', fontFamily: 'Space Grotesk, sans-serif', fontWeight: 600, fontSize: '16px', border: 'none', borderRadius: '10px', cursor: 'not-allowed', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
          >
            <span style={{ fontSize: '22px', fontWeight: 700, lineHeight: 1 }}>+</span>
            Registrar cliente
          </button>
          <div style={{ textAlign: 'center', color: '#9CA3AF', fontSize: '12px', fontFamily: 'Space Grotesk, sans-serif', marginTop: '8px' }}>
            Inicia un turno para registrar
          </div>
        </div>
      )}

      {/* Wizard Modal */}
      {wizardStep > 0 && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: '#fff', maxWidth: '480px', width: '90vw', borderRadius: '16px', padding: '28px', position: 'relative', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>

            {/* Progress bar */}
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '4px', background: '#F3F4F6', borderRadius: '16px 16px 0 0', overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${Math.min(wizardStep, 4) / 4 * 100}%`, background: '#1E2A3A', transition: 'width 0.3s ease' }} />
            </div>

            {/* Back button (steps 2-5) */}
            {wizardStep > 1 && (
              <button
                onClick={() => setWizardStep(prev => (prev - 1) as 0|1|2|3|4|5)}
                style={{ position: 'absolute', top: '16px', left: '16px', background: 'transparent', border: 'none', cursor: 'pointer', color: '#9CA3AF', fontSize: '13px', fontFamily: 'Space Grotesk, sans-serif', display: 'flex', alignItems: 'center', gap: '4px', padding: '4px' }}
              >
                ← Volver
              </button>
            )}

            {/* ── Step 1: Services ── */}
            {wizardStep === 1 && (
              <>
                <div style={{ fontFamily: 'Space Grotesk, sans-serif', fontSize: '11px', color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '8px', marginTop: '8px' }}>Paso 1 de 5 · Servicios</div>
                <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: '20px', color: '#1E2A3A', marginBottom: '20px' }}>¿Qué servicios?</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '280px', overflowY: 'auto', marginBottom: '12px' }}>
                  {services.length === 0 && (
                    <div style={{ fontFamily: 'Space Grotesk, sans-serif', fontSize: '13px', color: '#9CA3AF', textAlign: 'center', padding: '12px' }}>
                      No hay servicios en el catálogo
                    </div>
                  )}
                  {services.map(service => {
                    const isSel = selectedServices.some(s => s.id === service.id)
                    return (
                      <div
                        key={service.id}
                        onClick={() => toggleServiceSelection(service)}
                        style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px', background: isSel ? '#EFF6FF' : '#F9FAFB', borderRadius: '8px', border: isSel ? '1px solid #1E2A3A' : '1px solid #E8E9EB', cursor: 'pointer' }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <div style={{ width: '18px', height: '18px', borderRadius: '4px', border: `2px solid ${isSel ? '#1E2A3A' : '#D1D5DB'}`, background: isSel ? '#1E2A3A' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                            {isSel && <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>}
                          </div>
                          <span style={{ fontFamily: 'Space Grotesk, sans-serif', fontSize: '14px', color: '#1E2A3A' }}>{service.name}</span>
                        </div>
                        <span style={{ fontFamily: 'Space Grotesk, sans-serif', fontWeight: 600, fontSize: '14px', color: '#1E2A3A' }}>${service.base_price.toLocaleString('es-AR')}</span>
                      </div>
                    )
                  })}
                </div>
                <div style={{ fontFamily: 'Space Grotesk, sans-serif', fontSize: '12px', color: '#6B7280', marginBottom: '16px', minHeight: '18px' }}>
                  {selectedServices.length > 0
                    ? `${selectedServices.length} seleccionado${selectedServices.length !== 1 ? 's' : ''} · $${selectedServices.reduce((s, x) => s + x.base_price, 0).toLocaleString('es-AR')}`
                    : 'Ningún servicio seleccionado'}
                </div>
                <button
                  onClick={() => setWizardStep(2)}
                  disabled={selectedServices.length === 0}
                  style={{ width: '100%', height: '48px', background: selectedServices.length > 0 ? '#1E2A3A' : '#E5E7EB', color: selectedServices.length > 0 ? '#fff' : '#9CA3AF', border: 'none', borderRadius: '8px', fontFamily: 'Space Grotesk, sans-serif', fontWeight: 600, fontSize: '15px', cursor: selectedServices.length > 0 ? 'pointer' : 'not-allowed' }}
                >
                  Siguiente →
                </button>
              </>
            )}

            {/* ── Step 2: Payment method ── */}
            {wizardStep === 2 && (
              <>
                <div style={{ fontFamily: 'Space Grotesk, sans-serif', fontSize: '11px', color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '8px', marginTop: '28px' }}>Paso 2 de 5 · Método de pago</div>
                <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: '24px', color: '#1E2A3A', marginBottom: '24px' }}>Método de pago</div>
                <div style={{ display: 'flex', gap: '12px' }}>
                  <button
                    onClick={() => { setWizardPaymentMethod('efectivo'); setWizardStep(3) }}
                    style={{ flex: 1, padding: '20px 12px', borderRadius: '10px', border: wizardPaymentMethod === 'efectivo' ? 'none' : '1px solid #E8E9EB', background: wizardPaymentMethod === 'efectivo' ? '#1E2A3A' : '#F9FAFB', color: wizardPaymentMethod === 'efectivo' ? '#fff' : '#1E2A3A', fontFamily: 'Space Grotesk, sans-serif', fontWeight: 600, fontSize: '15px', cursor: 'pointer' }}
                  >
                    💵 Efectivo
                  </button>
                  <button
                    onClick={() => { setWizardPaymentMethod('transferencia'); setWizardStep(3) }}
                    style={{ flex: 1, padding: '20px 12px', borderRadius: '10px', border: wizardPaymentMethod === 'transferencia' ? 'none' : '1px solid #E8E9EB', background: wizardPaymentMethod === 'transferencia' ? '#1E2A3A' : '#F9FAFB', color: wizardPaymentMethod === 'transferencia' ? '#fff' : '#1E2A3A', fontFamily: 'Space Grotesk, sans-serif', fontWeight: 600, fontSize: '15px', cursor: 'pointer' }}
                  >
                    📲 Transferencia
                  </button>
                </div>
              </>
            )}

            {/* ── Step 3: Tip ── */}
            {wizardStep === 3 && (
              <>
                <div style={{ fontFamily: 'Space Grotesk, sans-serif', fontSize: '11px', color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '8px', marginTop: '28px' }}>Paso 3 de 5 · Propina</div>
                <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: '24px', color: '#1E2A3A', marginBottom: '6px' }}>Propina</div>
                <div style={{ fontFamily: 'Space Grotesk, sans-serif', fontSize: '13px', color: '#6B7280', marginBottom: '24px' }}>La propina es 100% para el barbero</div>
                {!wizardTipEnabled ? (
                  <div style={{ display: 'flex', gap: '12px' }}>
                    <button onClick={() => setWizardTipEnabled(true)} style={{ flex: 1, padding: '16px', borderRadius: '10px', border: '1px solid #E8E9EB', background: '#F9FAFB', color: '#1E2A3A', fontFamily: 'Space Grotesk, sans-serif', fontWeight: 600, fontSize: '14px', cursor: 'pointer' }}>
                      Sí, hubo propina
                    </button>
                    <button onClick={() => { setWizardTip(''); setWizardStep(4) }} style={{ flex: 1, padding: '16px', borderRadius: '10px', border: 'none', background: '#1E2A3A', color: '#fff', fontFamily: 'Space Grotesk, sans-serif', fontWeight: 600, fontSize: '14px', cursor: 'pointer' }}>
                      No, continuar →
                    </button>
                  </div>
                ) : (
                  <>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
                      <span style={{ fontSize: '20px', fontWeight: 700, color: '#1E2A3A', fontFamily: 'Space Grotesk, sans-serif' }}>$</span>
                      <input type="number" placeholder="0" value={wizardTip} onChange={e => setWizardTip(e.target.value)} style={{ flex: 1, border: '1px solid #E8E9EB', borderRadius: '8px', padding: '12px', fontSize: '16px', background: '#F9FAFB', color: '#1E2A3A', outline: 'none', fontFamily: 'Space Grotesk, sans-serif' }} />
                    </div>
                    <button onClick={() => setWizardStep(4)} style={{ width: '100%', height: '48px', background: '#1E2A3A', color: '#fff', border: 'none', borderRadius: '8px', fontFamily: 'Space Grotesk, sans-serif', fontWeight: 600, fontSize: '15px', cursor: 'pointer' }}>
                      Siguiente →
                    </button>
                  </>
                )}
              </>
            )}

            {/* ── Step 4: Products ── */}
            {wizardStep === 4 && (
              <>
                <div style={{ fontFamily: 'Space Grotesk, sans-serif', fontSize: '11px', color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '8px', marginTop: '28px' }}>Paso 4 de 5 · Productos</div>
                <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: '24px', color: '#1E2A3A', marginBottom: '6px' }}>¿Vendiste algún producto?</div>
                <div style={{ fontFamily: 'Space Grotesk, sans-serif', fontSize: '13px', color: '#6B7280', marginBottom: '20px' }}>Ceras, bebidas, etc. Van 100% al dueño</div>
                {products.length === 0 ? (
                  <>
                    <div style={{ fontFamily: 'Space Grotesk, sans-serif', fontSize: '13px', color: '#9CA3AF', marginBottom: '16px', textAlign: 'center', padding: '12px' }}>
                      No hay productos en el catálogo
                    </div>
                    <button onClick={() => setWizardStep(5)} style={{ width: '100%', height: '48px', background: '#1E2A3A', color: '#fff', border: 'none', borderRadius: '8px', fontFamily: 'Space Grotesk, sans-serif', fontWeight: 600, fontSize: '15px', cursor: 'pointer' }}>
                      Continuar →
                    </button>
                  </>
                ) : (
                  <>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '280px', overflowY: 'auto', marginBottom: '12px' }}>
                      {products.map(product => {
                        const isSel = selectedProducts.some(p => p.id === product.id)
                        return (
                          <div
                            key={product.id}
                            onClick={() => toggleProductSelection(product)}
                            style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px', background: isSel ? '#FFF7ED' : '#F9FAFB', borderRadius: '8px', border: isSel ? '1px solid #F97316' : '1px solid #E8E9EB', cursor: 'pointer' }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                              <div style={{ width: '18px', height: '18px', borderRadius: '4px', border: `2px solid ${isSel ? '#F97316' : '#D1D5DB'}`, background: isSel ? '#F97316' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                {isSel && <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>}
                              </div>
                              <span style={{ fontFamily: 'Space Grotesk, sans-serif', fontSize: '14px', color: '#1E2A3A' }}>{product.name}</span>
                            </div>
                            <span style={{ fontFamily: 'Space Grotesk, sans-serif', fontWeight: 600, fontSize: '14px', color: '#1E2A3A' }}>${product.base_price.toLocaleString('es-AR')}</span>
                          </div>
                        )
                      })}
                    </div>
                    <div style={{ fontFamily: 'Space Grotesk, sans-serif', fontSize: '12px', color: '#6B7280', marginBottom: '16px', minHeight: '18px' }}>
                      {selectedProducts.length > 0
                        ? `${selectedProducts.length} seleccionado${selectedProducts.length !== 1 ? 's' : ''} · $${selectedProducts.reduce((s, x) => s + x.base_price, 0).toLocaleString('es-AR')}`
                        : 'Ningún producto seleccionado'}
                    </div>
                    <button onClick={() => setWizardStep(5)} style={{ width: '100%', height: '48px', background: '#1E2A3A', color: '#fff', border: 'none', borderRadius: '8px', fontFamily: 'Space Grotesk, sans-serif', fontWeight: 600, fontSize: '15px', cursor: 'pointer' }}>
                      Siguiente →
                    </button>
                  </>
                )}
              </>
            )}

            {/* ── Step 5: Summary & confirm ── */}
            {wizardStep === 5 && (
              <>
                <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: '20px', color: '#1E2A3A', marginBottom: '20px', marginTop: '8px' }}>Confirmar cliente</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '16px' }}>
                  {selectedServices.map(s => (
                    <div key={s.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', color: '#1E2A3A', fontFamily: 'Space Grotesk, sans-serif' }}>
                      <span>{s.name}</span>
                      <span style={{ fontWeight: 500 }}>${s.base_price.toLocaleString('es-AR')}</span>
                    </div>
                  ))}
                </div>
                {selectedProducts.length > 0 && (
                  <div style={{ borderTop: '1px solid #F3F4F6', paddingTop: '12px', marginBottom: '16px' }}>
                    <div style={{ fontFamily: 'Space Grotesk, sans-serif', fontSize: '11px', color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '8px' }}>Productos (100% dueño)</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {selectedProducts.map(p => (
                        <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', color: '#1E2A3A', fontFamily: 'Space Grotesk, sans-serif' }}>
                          <span>{p.name}</span>
                          <span style={{ fontWeight: 500 }}>${p.base_price.toLocaleString('es-AR')}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                <div style={{ borderTop: '1px solid #F3F4F6', paddingTop: '12px', marginBottom: '12px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <div style={{ fontFamily: 'Space Grotesk, sans-serif', fontSize: '13px', color: '#6B7280' }}>
                    Método de pago: {wizardPaymentMethod === 'transferencia' ? '📲 Transferencia' : '💵 Efectivo'}
                  </div>
                  {(parseFloat(wizardTip) || 0) > 0 && (
                    <div style={{ fontFamily: 'Space Grotesk, sans-serif', fontSize: '13px', color: '#6B7280' }}>
                      Propina: <span style={{ color: '#D4A853', fontWeight: 600 }}>${(parseFloat(wizardTip) || 0).toLocaleString('es-AR')}</span> <span style={{ color: '#9CA3AF' }}>(100% para vos)</span>
                    </div>
                  )}
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 16px', background: '#F9FAFB', borderRadius: '8px', marginBottom: '20px', border: '1px solid #E8E9EB' }}>
                  <span style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: '14px', color: '#1E2A3A' }}>Total</span>
                  <span style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: '22px', color: '#D4A853' }}>
                    ${(selectedServices.reduce((s, x) => s + x.base_price, 0) + (parseFloat(wizardTip) || 0) + selectedProducts.reduce((s, x) => s + x.base_price, 0)).toLocaleString('es-AR')}
                  </span>
                </div>
                <button
                  onClick={confirmAttention}
                  disabled={processing}
                  style={{ width: '100%', height: '52px', background: '#1E2A3A', color: '#fff', border: 'none', borderRadius: '12px', fontFamily: 'Space Grotesk, sans-serif', fontWeight: 600, fontSize: '15px', cursor: processing ? 'not-allowed' : 'pointer', opacity: processing ? 0.7 : 1 }}
                >
                  {processing ? 'Procesando...' : '✓ Confirmar y Registrar'}
                </button>
              </>
            )}

          </div>
        </div>
      )}

    </div>
  )
}
