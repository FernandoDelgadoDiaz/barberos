import { useState, useEffect } from 'react'
import { useTenantStore } from '../../stores/tenantStore'
import { supabase } from '../../config/supabase'
import type { ServiceCatalog, ServiceLog, CommissionRules, Shift } from '../../types'

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
  const [todayLogs, setTodayLogs] = useState<ServiceLog[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [shiftStatus, setShiftStatus] = useState<'loading' | 'no_shift' | 'open' | 'paused' | 'closed'>('loading')
  const [currentShift, setCurrentShift] = useState<Shift | null>(null)
  const [selectedServices, setSelectedServices] = useState<ServiceWithEstimation[]>([])
  const [wizardStep, setWizardStep] = useState<0|1|2|3|4|5>(0)
  const [wizardPaymentMethod, setWizardPaymentMethod] = useState<'efectivo'|'transferencia'>('efectivo')
  const [wizardTip, setWizardTip] = useState('')
  const [wizardTipEnabled, setWizardTipEnabled] = useState(false)
  const [wizardOthers, setWizardOthers] = useState('')
  const [wizardOthersEnabled, setWizardOthersEnabled] = useState(false)
  const [processing, setProcessing] = useState(false)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [shiftLoading, setShiftLoading] = useState(false)
  const [refreshTrigger, setRefreshTrigger] = useState(0)
  const [appointmentsCount, setAppointmentsCount] = useState<number>(0)


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
        console.log('[Dashboard] loadData start', { tenantId: tenant?.id, profileId: profile?.id, activeShiftId })

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
          console.log('[Dashboard] active shift found:', activeShift.id, 'status:', activeShift.status)
          if (isMounted) {
            setShiftStatus(activeShift.status) // 'open' or 'paused'
            setCurrentShift(activeShift)
            setActiveShiftId(activeShift.id)
          }
        } else {
          console.log('[Dashboard] no active shift, shiftError:', shiftError)
          if (isMounted) {
            setShiftStatus(prev => {
              console.log('[Dashboard] previous shiftStatus:', prev)
              return prev === 'closed' ? 'closed' : 'no_shift'
            })
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
            .select('id')
            .eq('tenant_id', tenant.id)
            .eq('barber_id', profile.id)
            .eq('status', 'closed')
            .order('started_at', { ascending: false })
            .limit(1)
            .maybeSingle()
          shiftIdForLogs = closedShift?.id ?? null
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

        // Calculate estimated earnings for each service based on next service number
        const nextServiceNumber = (logsData?.length || 0) + 1
        const commissionRules = tenant.commission_rules?.rules || []
        const servicesWithEstimation: ServiceWithEstimation[] = (servicesData || []).map(service => ({
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
    return () => { isMounted = false }
  }, [tenant, profile, setActiveShiftId, refreshTrigger])

  const totalEarningsToday = todayLogs.reduce((sum, log) => sum + log.barber_earning, 0)

  const handleOpenShift = async () => {
    if (!tenant || !profile) return
    setShiftLoading(true)
    setError(null)
    try {
      const response = await fetch('/api/open-shift', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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
    console.log('[Dashboard] handleCloseShift called', { currentShiftId: currentShift?.id, tenantId: tenant?.id, profileId: profile?.id })
    if (!tenant || !profile || !currentShift) return
    setShiftLoading(true)
    setError(null)
    try {
      const response = await fetch('/api/close-shift', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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
      const result = await response.json()
      console.log('[Dashboard] close-shift API success:', result)
      // Update local state
      setShiftStatus('closed')
      setCurrentShift(null)
      setActiveShiftId(null)
      setRefreshTrigger(prev => {
        console.log('[Dashboard] refreshTrigger increment')
        return prev + 1
      }) // Trigger reload of logs/services
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
    console.log('[Dashboard] handlePauseResumeShift called', { currentShiftId: currentShift?.id, tenantId: tenant?.id, profileId: profile?.id })
    if (!tenant || !profile || !currentShift) return
    setShiftLoading(true)
    setError(null)
    try {
      const response = await fetch('/api/pause-shift', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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
      console.log('[Dashboard] pause-shift API success:', result)
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

  const handleRegisterAttention = () => {
    if (shiftStatus !== 'open') {
      setError('No hay un turno abierto. Inicia un turno para registrar servicios.')
      return
    }
    if (selectedServices.length === 0) {
      setError('Selecciona al menos un servicio para registrar la atención.')
      return
    }
    setWizardStep(1)
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

      const response = await fetch('/.netlify/functions/log-service', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          barber_id: profile.id,
          tenant_id: tenant.id,
          services: servicesPayload,
          started_at: new Date().toISOString(),
          shift_id: activeShiftId,
          payment_method: wizardPaymentMethod,
          tip_amount: parseInt(wizardTip) || 0,
          tip_payment_method: wizardPaymentMethod,
          others_amount: parseInt(wizardOthers) || 0,
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
      setWizardPaymentMethod('efectivo')
      setWizardTip('')
      setWizardTipEnabled(false)
      setWizardOthers('')
      setWizardOthersEnabled(false)

      setSuccessMessage(`¡Atención registrada! ${result.message || ''}`)
      setTimeout(() => setSuccessMessage(null), 5000)
    } catch (err: unknown) {
      console.error('Error confirming attention:', err)
      const errorMessage = err instanceof Error ? err.message : 'Error al registrar atención'
      setError(errorMessage)
    } finally {
      setProcessing(false)
    }
  }

  const totalSelected = selectedServices.reduce((sum, s) => sum + s.base_price, 0)
  const selectedCount = selectedServices.length

  if (loading) {
    return (
      <div style={{ maxWidth: '1000px', margin: '0 auto', padding: '40px', textAlign: 'center', color: '#999' }}>
        Cargando...
      </div>
    )
  }

  return (
    <div style={{ maxWidth: '1000px', margin: '0 auto' }}>
      {/* Success toast */}
      {successMessage && (
        <div style={{
          position: 'fixed',
          top: '20px',
          right: '20px',
          background: '#2a2a2a',
          color: '#fff',
          border: '1px solid var(--secondary, #C8A97E)',
          padding: '16px 20px',
          borderRadius: '8px',
          fontFamily: 'Space Grotesk, sans-serif',
          fontWeight: 600,
          fontSize: '14px',
          zIndex: 1000,
          boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
        }}>
          {successMessage}
        </div>
      )}

      {/* Hero card */}
      <div className="dashboard-hero" style={{ background: '#242424', border: '1px solid #383838', borderRadius: '14px', padding: '24px', marginBottom: '24px', position: 'relative', overflow: 'hidden' }}>
        <h1 style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 'clamp(22px, 5vw, 32px)', color: '#fff', margin: 0 }}>
          Hola, {profile?.display_name || 'Barbero'}
        </h1>
        <p style={{ color: '#999', fontSize: '14px', marginTop: '8px' }}>Tu día empieza ahora. Que los cortes fluyan.</p>
        {/* Barber pole decorative */}
        <svg className="hide-mobile" width="120" height="120" viewBox="0 0 120 120" fill="none" style={{ position: 'absolute', right: '20px', top: '20px', opacity: 0.1 }}>
          <rect x="50" y="10" width="20" height="100" fill="var(--secondary, #C8A97E)" />
          <rect x="50" y="10" width="20" height="33.33" fill="#fff" />
          <rect x="50" y="43.33" width="20" height="33.33" fill="var(--primary, #1a1a1a)" />
          <rect x="50" y="76.66" width="20" height="33.33" fill="var(--secondary, #C8A97E)" />
          <circle cx="60" cy="10" r="10" fill="var(--secondary, #C8A97E)" />
          <circle cx="60" cy="110" r="10" fill="var(--secondary, #C8A97E)" />
        </svg>
      </div>

      {/* Shift control card */}
      <div style={{ background: '#2a2a2a', border: '1px solid #383838', borderRadius: '12px', padding: '20px', marginBottom: '24px' }}>
        <h2 style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: '18px', color: '#555', margin: '0 0 16px 0', textTransform: 'uppercase', letterSpacing: '1px' }}>Control de turno</h2>
        {shiftStatus === 'loading' && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontFamily: 'Space Grotesk, sans-serif', fontWeight: 600, fontSize: '16px', color: '#fff' }}>Cargando estado de turno...</div>
              <div style={{ fontFamily: 'Space Grotesk, sans-serif', fontSize: '13px', color: '#999', marginTop: '4px' }}>Verificando si hay un turno activo.</div>
            </div>
            <button disabled style={{
                background: '#555',
                color: '#999',
                border: 'none',
                borderRadius: '6px',
                padding: '10px 20px',
                fontFamily: 'Space Grotesk, sans-serif',
                fontWeight: 600,
                fontSize: '14px',
                cursor: 'not-allowed',
                opacity: 0.6,
              }}>
              Cargando...
            </button>
          </div>
        )}
        {shiftStatus === 'no_shift' && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontFamily: 'Space Grotesk, sans-serif', fontWeight: 600, fontSize: '16px', color: '#fff' }}>No hay un turno activo</div>
              <div style={{ fontFamily: 'Space Grotesk, sans-serif', fontSize: '13px', color: '#999', marginTop: '4px' }}>Inicia un turno para comenzar a registrar servicios.</div>
            </div>
            <button
              onClick={handleOpenShift}
              disabled={shiftLoading}
              style={{
                background: 'var(--secondary, #C8A97E)',
                color: 'var(--primary, #1a1a1a)',
                border: 'none',
                borderRadius: '6px',
                padding: '10px 20px',
                fontFamily: 'Space Grotesk, sans-serif',
                fontWeight: 600,
                fontSize: '14px',
                cursor: 'pointer',
                opacity: shiftLoading ? 0.6 : 1,
              }}
            >
              {shiftLoading ? 'Procesando...' : 'Iniciar turno'}
            </button>
          </div>
        )}
        {shiftStatus === 'open' && currentShift && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontFamily: 'Space Grotesk, sans-serif', fontWeight: 600, fontSize: '16px', color: '#fff' }}>Turno abierto</div>
              <div style={{ fontFamily: 'Space Grotesk, sans-serif', fontSize: '13px', color: '#999', marginTop: '4px' }}>
                Iniciado a las {new Date(currentShift.started_at).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
                {currentShift.total_services > 0 && ` • ${currentShift.total_services} servicios • $${currentShift.barber_earnings.toLocaleString()} ganados`}
              </div>
            </div>
            <div style={{ display: 'flex', gap: '12px' }}>
              <button
                onClick={handlePauseResumeShift}
                disabled={shiftLoading}
                style={{
                  background: '#555',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '6px',
                  padding: '10px 20px',
                  fontFamily: 'Space Grotesk, sans-serif',
                  fontWeight: 600,
                  fontSize: '14px',
                  cursor: 'pointer',
                  opacity: shiftLoading ? 0.6 : 1,
                }}
              >
                {shiftLoading ? 'Procesando...' : 'Pausar'}
              </button>
              <button
                onClick={handleCloseShift}
                disabled={shiftLoading}
                style={{
                  background: '#e94560',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '6px',
                  padding: '10px 20px',
                  fontFamily: 'Space Grotesk, sans-serif',
                  fontWeight: 600,
                  fontSize: '14px',
                  cursor: 'pointer',
                  opacity: shiftLoading ? 0.6 : 1,
                }}
              >
                {shiftLoading ? 'Procesando...' : 'Cerrar turno'}
              </button>
            </div>
          </div>
        )}
        {shiftStatus === 'paused' && currentShift && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontFamily: 'Space Grotesk, sans-serif', fontWeight: 600, fontSize: '16px', color: '#fff' }}>Turno pausado</div>
              <div style={{ fontFamily: 'Space Grotesk, sans-serif', fontSize: '13px', color: '#999', marginTop: '4px' }}>
                Iniciado a las {new Date(currentShift.started_at).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
                {currentShift.paused_at && ` • Pausado a las ${new Date(currentShift.paused_at).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}`}
                {currentShift.total_services > 0 && ` • ${currentShift.total_services} servicios • $${currentShift.barber_earnings.toLocaleString()} ganados`}
              </div>
            </div>
            <div style={{ display: 'flex', gap: '12px' }}>
              <button
                onClick={handlePauseResumeShift}
                disabled={shiftLoading}
                style={{
                  background: 'var(--secondary, #C8A97E)',
                  color: 'var(--primary, #1a1a1a)',
                  border: 'none',
                  borderRadius: '6px',
                  padding: '10px 20px',
                  fontFamily: 'Space Grotesk, sans-serif',
                  fontWeight: 600,
                  fontSize: '14px',
                  cursor: 'pointer',
                  opacity: shiftLoading ? 0.6 : 1,
                }}
              >
                {shiftLoading ? 'Procesando...' : 'Reanudar'}
              </button>
              <button
                onClick={handleCloseShift}
                disabled={shiftLoading}
                style={{
                  background: '#e94560',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '6px',
                  padding: '10px 20px',
                  fontFamily: 'Space Grotesk, sans-serif',
                  fontWeight: 600,
                  fontSize: '14px',
                  cursor: 'pointer',
                  opacity: shiftLoading ? 0.6 : 1,
                }}
              >
                {shiftLoading ? 'Procesando...' : 'Cerrar turno'}
              </button>
            </div>
          </div>
        )}
        {shiftStatus === 'closed' && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontFamily: 'Space Grotesk, sans-serif', fontWeight: 600, fontSize: '16px', color: '#fff' }}>Turno cerrado</div>
              <div style={{ fontFamily: 'Space Grotesk, sans-serif', fontSize: '13px', color: '#999', marginTop: '4px' }}>
                Tu día ha finalizado. Hasta mañana.
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Error message */}
      {error && (
        <div style={{
          background: 'var(--primary, #1a1a1a)',
          border: '1px solid #e94560',
          borderRadius: '8px',
          padding: '12px 16px',
          marginBottom: '16px',
          color: '#e94560',
          fontFamily: 'Space Grotesk, sans-serif',
          fontSize: '14px',
        }}>
          {error}
        </div>
      )}

      {/* Grid cards */}
      <div className="stats-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '16px', marginBottom: '24px' }}>
        <div style={{ background: '#2a2a2a', border: '1px solid #383838', borderRadius: '12px', padding: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <h3 style={{ fontFamily: 'Space Grotesk, sans-serif', fontWeight: 500, fontSize: '14px', color: '#999', margin: 0 }}>Servicios hoy</h3>
              <div style={{ fontFamily: 'Space Grotesk, sans-serif', fontWeight: 700, fontSize: '32px', color: '#fff', marginTop: '8px' }}>{todayLogs.length}</div>
            </div>
            <div style={{ width: '40px', height: '40px', borderRadius: '8px', background: 'var(--primary, #1a1a1a)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--secondary, #C8A97E)" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
            </div>
          </div>
        </div>
        <div style={{ background: '#2a2a2a', border: '1px solid var(--secondary, #C8A97E)', borderRadius: '12px', padding: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <h3 style={{ fontFamily: 'Space Grotesk, sans-serif', fontWeight: 500, fontSize: '14px', color: '#999', margin: 0 }}>Mi ganancia</h3>
              <div style={{ fontFamily: 'Space Grotesk, sans-serif', fontWeight: 700, fontSize: '32px', color: 'var(--secondary, #C8A97E)', marginTop: '8px' }}>${totalEarningsToday.toLocaleString()}</div>
            </div>
            <div style={{ width: '40px', height: '40px', borderRadius: '8px', background: 'var(--primary, #1a1a1a)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--secondary, #C8A97E)" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          </div>
        </div>
        <div style={{ background: '#2a2a2a', border: '1px solid #383838', borderRadius: '12px', padding: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <h3 style={{ fontFamily: 'Space Grotesk, sans-serif', fontWeight: 500, fontSize: '14px', color: '#999', margin: 0 }}>Atenciones</h3>
              <div style={{ fontFamily: 'Space Grotesk, sans-serif', fontWeight: 700, fontSize: '32px', color: '#fff', marginTop: '8px' }}>{appointmentsCount}</div>
            </div>
            <div style={{ width: '40px', height: '40px', borderRadius: '8px', background: 'var(--primary, #1a1a1a)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--secondary, #C8A97E)" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            </div>
          </div>
        </div>
      </div>

      {/* Services list */}
      {shiftStatus === 'open' && (
      <div className="services-catalog" style={{ background: '#2a2a2a', border: '1px solid #383838', borderRadius: '12px', padding: '20px', marginBottom: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <h2 style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: '18px', color: '#555', margin: 0, textTransform: 'uppercase', letterSpacing: '1px' }}>Catálogo de servicios</h2>
          {selectedCount > 0 && (
            <div style={{ fontFamily: 'Space Grotesk, sans-serif', fontWeight: 600, fontSize: '14px', color: 'var(--secondary, #C8A97E)' }}>
              {selectedCount} servicio{selectedCount !== 1 ? 's' : ''} seleccionado{selectedCount !== 1 ? 's' : ''} • Total: ${totalSelected.toLocaleString()}
            </div>
          )}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {services.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '24px', color: '#999', fontFamily: 'Space Grotesk, sans-serif', fontSize: '14px' }}>
              No hay servicios configurados
            </div>
          ) : (
            services.map((service) => {
              const isSelected = selectedServices.some(s => s.id === service.id)
              return (
                <div
                  key={service.id}
                  className="service-item"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '12px',
                    background: '#2a2a2a',
                    border: `1px solid ${isSelected ? 'var(--secondary, #C8A97E)' : '#383838'}`,
                    borderRadius: '8px',
                    minHeight: '60px',
                    opacity: shiftStatus !== 'open' ? 0.5 : 1,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div
                      style={{
                        width: '20px',
                        height: '20px',
                        borderRadius: '4px',
                        border: `2px solid ${isSelected ? 'var(--secondary, #C8A97E)' : '#555'}`,
                        background: isSelected ? 'var(--secondary, #C8A97E)' : 'transparent',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: shiftStatus === 'open' ? 'pointer' : 'not-allowed',
                      }}
                      onClick={() => shiftStatus === 'open' && toggleServiceSelection(service)}
                    >
                      {isSelected && (
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--primary, #1a1a1a)" strokeWidth="3">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </div>
                    <div style={{ width: '32px', height: '32px', borderRadius: '6px', background: 'var(--primary, #1a1a1a)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#555" strokeWidth="2">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M14.121 14.121L19 19m-7-7l7-7m-7 7l-7-7m7 7l-7 7" />
                      </svg>
                    </div>
                    <div>
                      <div className="service-name" style={{ fontFamily: 'Space Grotesk, sans-serif', fontWeight: 500, fontSize: '14px', color: '#fff' }}>{service.name}</div>
                      <div className="service-estimated" style={{ fontFamily: 'Space Grotesk, sans-serif', fontWeight: 400, fontSize: '11px', color: '#999', marginTop: '2px' }}>
                        Ganancia estimada: <span style={{ color: 'var(--secondary, #C8A97E)' }}>${service.estimatedEarning.toLocaleString()}</span>
                      </div>
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontFamily: 'Space Grotesk, sans-serif', fontWeight: 700, fontSize: '16px', color: 'var(--secondary, #C8A97E)' }}>${service.base_price.toLocaleString()}</div>
                    <div style={{ fontFamily: 'Space Grotesk, sans-serif', fontWeight: 400, fontSize: '11px', color: '#999' }}>{service.duration_min} min</div>
                  </div>
                </div>
              )
            })
          )}
        </div>
      </div>
      )}

      {/* Register attention button (hidden when no services or day closed) */}
      {services.length > 0 && shiftStatus === 'open' && (
        <button
          onClick={handleRegisterAttention}
          disabled={selectedCount === 0}
          style={{
            width: '100%',
            height: '52px',
            background: selectedCount > 0 ? 'var(--secondary, #C8A97E)' : '#555',
            color: selectedCount > 0 ? 'var(--primary, #1a1a1a)' : '#999',
            fontFamily: 'Space Grotesk, sans-serif',
            fontWeight: 600,
            fontSize: '16px',
            border: 'none',
            borderRadius: '12px',
            padding: '16px',
            cursor: selectedCount > 0 ? 'pointer' : 'not-allowed',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
          }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={selectedCount > 0 ? 'var(--primary, #1a1a1a)' : '#999'} strokeWidth="3">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
          </svg>
          {selectedCount > 0 ? `Registrar atención (${selectedCount} servicio${selectedCount !== 1 ? 's' : ''}) - Total: $${totalSelected.toLocaleString()}` : 'Selecciona servicios para registrar atención'}
        </button>
      )}

      {/* Wizard Modal */}
      {wizardStep > 0 && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: '#fff', maxWidth: '480px', width: '90vw', borderRadius: '12px', padding: '32px', position: 'relative' }}>

            {/* Progress bar */}
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '4px', background: '#f0f0f0', borderRadius: '12px 12px 0 0', overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${Math.min(wizardStep, 4) / 4 * 100}%`, background: 'var(--primary, #1E2A3A)', transition: 'width 0.3s ease' }} />
            </div>

            {/* Back button (steps 2-4) */}
            {wizardStep > 1 && wizardStep < 5 && (
              <button
                onClick={() => setWizardStep(prev => (prev - 1) as 0|1|2|3|4|5)}
                style={{ position: 'absolute', top: '16px', left: '16px', background: 'none', border: 'none', cursor: 'pointer', color: '#888', fontSize: '13px', fontFamily: 'Space Grotesk, sans-serif', display: 'flex', alignItems: 'center', gap: '4px', padding: '4px' }}
              >
                ← Volver
              </button>
            )}

            {/* ── Step 1: Services ── */}
            {wizardStep === 1 && (
              <>
                <div style={{ fontSize: '11px', color: '#aaa', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '8px', marginTop: '8px' }}>Paso 1 de 4 · Servicios</div>
                <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: '20px', color: '#1a1a2e', marginBottom: '20px' }}>¿Qué servicios?</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '280px', overflowY: 'auto', marginBottom: '12px' }}>
                  {services.map(service => {
                    const isSel = selectedServices.some(s => s.id === service.id)
                    return (
                      <div
                        key={service.id}
                        onClick={() => toggleServiceSelection(service)}
                        style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px', background: isSel ? '#f0f4ff' : '#f8f8f8', borderRadius: '8px', border: isSel ? '1px solid #3D3A8C' : '0.5px solid #e0e0e0', cursor: 'pointer' }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <div style={{ width: '18px', height: '18px', borderRadius: '4px', border: `2px solid ${isSel ? '#3D3A8C' : '#ccc'}`, background: isSel ? '#3D3A8C' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                            {isSel && <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>}
                          </div>
                          <span style={{ fontFamily: 'Space Grotesk, sans-serif', fontSize: '14px', color: '#1a1a2e' }}>{service.name}</span>
                        </div>
                        <span style={{ fontFamily: 'Space Grotesk, sans-serif', fontWeight: 700, fontSize: '14px', color: '#1a1a2e' }}>${service.base_price.toLocaleString('es-AR')}</span>
                      </div>
                    )
                  })}
                </div>
                <div style={{ fontSize: '12px', color: '#888', marginBottom: '16px', minHeight: '18px' }}>
                  {selectedServices.length > 0
                    ? `${selectedServices.length} seleccionado${selectedServices.length !== 1 ? 's' : ''} · $${selectedServices.reduce((s, x) => s + x.base_price, 0).toLocaleString('es-AR')}`
                    : 'Ningún servicio seleccionado'}
                </div>
                <button
                  onClick={() => setWizardStep(2)}
                  disabled={selectedServices.length === 0}
                  style={{ width: '100%', padding: '14px', background: selectedServices.length > 0 ? 'var(--primary, #1E2A3A)' : '#e0e0e0', color: selectedServices.length > 0 ? '#fff' : '#aaa', border: 'none', borderRadius: '8px', fontFamily: 'Space Grotesk, sans-serif', fontWeight: 600, fontSize: '15px', cursor: selectedServices.length > 0 ? 'pointer' : 'not-allowed' }}
                >
                  Siguiente →
                </button>
              </>
            )}

            {/* ── Step 2: Payment method ── */}
            {wizardStep === 2 && (
              <>
                <div style={{ fontSize: '11px', color: '#aaa', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '8px', marginTop: '28px' }}>Paso 2 de 4 · Método de pago</div>
                <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: '20px', color: '#1a1a2e', marginBottom: '24px' }}>¿Cómo pagó el cliente?</div>
                <div style={{ display: 'flex', gap: '12px' }}>
                  <button
                    onClick={() => { setWizardPaymentMethod('efectivo'); setWizardStep(3) }}
                    style={{ flex: 1, padding: '20px 12px', borderRadius: '10px', border: wizardPaymentMethod === 'efectivo' ? 'none' : '0.5px solid #e0e0e0', background: wizardPaymentMethod === 'efectivo' ? 'var(--primary, #1E2A3A)' : '#f8f8f8', color: wizardPaymentMethod === 'efectivo' ? '#fff' : '#aaa', fontFamily: 'Space Grotesk, sans-serif', fontWeight: 600, fontSize: '15px', cursor: 'pointer' }}
                  >
                    💵 Efectivo
                  </button>
                  <button
                    onClick={() => { setWizardPaymentMethod('transferencia'); setWizardStep(3) }}
                    style={{ flex: 1, padding: '20px 12px', borderRadius: '10px', border: wizardPaymentMethod === 'transferencia' ? 'none' : '0.5px solid #e0e0e0', background: wizardPaymentMethod === 'transferencia' ? 'var(--primary, #1E2A3A)' : '#f8f8f8', color: wizardPaymentMethod === 'transferencia' ? '#fff' : '#aaa', fontFamily: 'Space Grotesk, sans-serif', fontWeight: 600, fontSize: '15px', cursor: 'pointer' }}
                  >
                    📲 Transferencia
                  </button>
                </div>
              </>
            )}

            {/* ── Step 3: Tip ── */}
            {wizardStep === 3 && (
              <>
                <div style={{ fontSize: '11px', color: '#aaa', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '8px', marginTop: '28px' }}>Paso 3 de 4 · Propina</div>
                <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: '20px', color: '#1a1a2e', marginBottom: '6px' }}>¿Hubo propina?</div>
                <div style={{ fontSize: '13px', color: '#888', marginBottom: '24px' }}>La propina es 100% para el barbero</div>
                {!wizardTipEnabled ? (
                  <div style={{ display: 'flex', gap: '12px' }}>
                    <button
                      onClick={() => setWizardTipEnabled(true)}
                      style={{ flex: 1, padding: '16px', borderRadius: '10px', border: '0.5px solid #e0e0e0', background: '#f8f8f8', color: '#1a1a2e', fontFamily: 'Space Grotesk, sans-serif', fontWeight: 600, fontSize: '14px', cursor: 'pointer' }}
                    >
                      Sí, hubo propina
                    </button>
                    <button
                      onClick={() => { setWizardTip(''); setWizardStep(4) }}
                      style={{ flex: 1, padding: '16px', borderRadius: '10px', border: 'none', background: 'var(--primary, #1E2A3A)', color: '#fff', fontFamily: 'Space Grotesk, sans-serif', fontWeight: 600, fontSize: '14px', cursor: 'pointer' }}
                    >
                      No, continuar →
                    </button>
                  </div>
                ) : (
                  <>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
                      <span style={{ fontSize: '20px', fontWeight: 700, color: '#1a1a2e', fontFamily: 'Space Grotesk, sans-serif' }}>$</span>
                      <input
                        type="number"
                        placeholder="0"
                        value={wizardTip}
                        onChange={e => setWizardTip(e.target.value)}
                        style={{ flex: 1, border: '0.5px solid #e0e0e0', borderRadius: '8px', padding: '12px', fontSize: '16px', background: '#f8f8f8', color: '#1a1a2e', outline: 'none' }}
                      />
                    </div>
                    <button
                      onClick={() => setWizardStep(4)}
                      style={{ width: '100%', padding: '14px', background: 'var(--primary, #1E2A3A)', color: '#fff', border: 'none', borderRadius: '8px', fontFamily: 'Space Grotesk, sans-serif', fontWeight: 600, fontSize: '15px', cursor: 'pointer' }}
                    >
                      Siguiente →
                    </button>
                  </>
                )}
              </>
            )}

            {/* ── Step 4: Others ── */}
            {wizardStep === 4 && (
              <>
                <div style={{ fontSize: '11px', color: '#aaa', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '8px', marginTop: '28px' }}>Paso 4 de 4 · Otros</div>
                <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: '20px', color: '#1a1a2e', marginBottom: '6px' }}>¿Hubo otros?</div>
                <div style={{ fontSize: '13px', color: '#888', marginBottom: '24px' }}>Ceras, bebidas, etc. Van 100% al dueño</div>
                {!wizardOthersEnabled ? (
                  <div style={{ display: 'flex', gap: '12px' }}>
                    <button
                      onClick={() => setWizardOthersEnabled(true)}
                      style={{ flex: 1, padding: '16px', borderRadius: '10px', border: '0.5px solid #e0e0e0', background: '#f8f8f8', color: '#1a1a2e', fontFamily: 'Space Grotesk, sans-serif', fontWeight: 600, fontSize: '14px', cursor: 'pointer' }}
                    >
                      Sí, hubo otros
                    </button>
                    <button
                      onClick={() => { setWizardOthers(''); setWizardStep(5) }}
                      style={{ flex: 1, padding: '16px', borderRadius: '10px', border: 'none', background: 'var(--primary, #1E2A3A)', color: '#fff', fontFamily: 'Space Grotesk, sans-serif', fontWeight: 600, fontSize: '14px', cursor: 'pointer' }}
                    >
                      No, continuar →
                    </button>
                  </div>
                ) : (
                  <>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
                      <span style={{ fontSize: '20px', fontWeight: 700, color: '#1a1a2e', fontFamily: 'Space Grotesk, sans-serif' }}>$</span>
                      <input
                        type="number"
                        placeholder="0"
                        value={wizardOthers}
                        onChange={e => setWizardOthers(e.target.value)}
                        style={{ flex: 1, border: '0.5px solid #e0e0e0', borderRadius: '8px', padding: '12px', fontSize: '16px', background: '#f8f8f8', color: '#1a1a2e', outline: 'none' }}
                      />
                    </div>
                    <button
                      onClick={() => setWizardStep(5)}
                      style={{ width: '100%', padding: '14px', background: 'var(--primary, #1E2A3A)', color: '#fff', border: 'none', borderRadius: '8px', fontFamily: 'Space Grotesk, sans-serif', fontWeight: 600, fontSize: '15px', cursor: 'pointer' }}
                    >
                      Siguiente →
                    </button>
                  </>
                )}
              </>
            )}

            {/* ── Step 5: Summary & confirm ── */}
            {wizardStep === 5 && (
              <>
                <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: '20px', color: '#1a1a2e', marginBottom: '20px', marginTop: '8px' }}>Confirmar atención</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '16px' }}>
                  {selectedServices.map(s => (
                    <div key={s.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', color: '#1a1a2e', fontFamily: 'Space Grotesk, sans-serif' }}>
                      <span>{s.name}</span>
                      <span style={{ fontWeight: 500 }}>${s.base_price.toLocaleString('es-AR')}</span>
                    </div>
                  ))}
                </div>
                <div style={{ borderTop: '0.5px solid #f0f0f0', paddingTop: '12px', marginBottom: '12px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <div style={{ fontSize: '13px', color: '#555', fontFamily: 'Space Grotesk, sans-serif' }}>
                    Método de pago: {wizardPaymentMethod === 'transferencia' ? '📲 Transferencia' : '💵 Efectivo'}
                  </div>
                  {(parseInt(wizardTip) || 0) > 0 && (
                    <div style={{ fontSize: '13px', color: '#555', fontFamily: 'Space Grotesk, sans-serif' }}>
                      Propina: ${(parseInt(wizardTip) || 0).toLocaleString('es-AR')} <span style={{ color: '#888' }}>(100% para vos)</span>
                    </div>
                  )}
                  {(parseInt(wizardOthers) || 0) > 0 && (
                    <div style={{ fontSize: '13px', color: '#555', fontFamily: 'Space Grotesk, sans-serif' }}>
                      Otros: ${(parseInt(wizardOthers) || 0).toLocaleString('es-AR')} <span style={{ color: '#888' }}>(100% para el dueño)</span>
                    </div>
                  )}
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', background: '#f8f8f8', borderRadius: '8px', marginBottom: '20px' }}>
                  <span style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: '14px', color: '#1a1a2e' }}>Total</span>
                  <span style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: '20px', color: '#1a1a2e' }}>
                    ${(selectedServices.reduce((s, x) => s + x.base_price, 0) + (parseInt(wizardTip) || 0) + (parseInt(wizardOthers) || 0)).toLocaleString('es-AR')}
                  </span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <button
                    onClick={confirmAttention}
                    disabled={processing}
                    style={{ width: '100%', padding: '14px', background: 'var(--primary, #1E2A3A)', color: '#fff', border: 'none', borderRadius: '8px', fontFamily: 'Space Grotesk, sans-serif', fontWeight: 600, fontSize: '15px', cursor: processing ? 'not-allowed' : 'pointer', opacity: processing ? 0.7 : 1 }}
                  >
                    {processing ? 'Procesando...' : '✓ Confirmar atención'}
                  </button>
                  <button
                    onClick={() => setWizardStep(4)}
                    disabled={processing}
                    style={{ width: '100%', padding: '12px', background: 'none', color: '#888', border: '0.5px solid #e0e0e0', borderRadius: '8px', fontFamily: 'Space Grotesk, sans-serif', fontWeight: 500, fontSize: '14px', cursor: 'pointer' }}
                  >
                    ← Volver
                  </button>
                </div>
              </>
            )}

          </div>
        </div>
      )}

    </div>
  )
}