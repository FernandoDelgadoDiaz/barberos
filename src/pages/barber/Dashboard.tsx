import { useState, useEffect } from 'react'
import { useTenantStore } from '../../stores/tenantStore'
import { supabase } from '../../config/supabase'
import { GraceBanner } from '../../components/GraceBanner'
import type { ServiceCatalog, ServiceLog, CommissionRules, Shift } from '../../types'

// =============================================================================
// Palette — slate + blue (consistent with the owner panel: LivePanel / Metrics
// / Services). Replicated locally because the scope is limited to barber files.
// =============================================================================
const C = {
  bg: '#F8FAFC',
  ink: '#0F172A',
  slate600: '#475569',
  slate500: '#64748B',
  slate400: '#94A3B8',
  border: '#E2E8F0',
  borderLt: '#F1F5F9',
  blue: '#2563EB',
  blueBright: '#3B82F6',
  blueSoft: '#DBEAFE',
  blueBg: '#EFF6FF',
  green: '#059669',
  greenBg: '#D1FAE5',
  greenDot: '#10B981',
  amber: '#B45309',
  amberBg: '#FEF3C7',
  red: '#DC2626',
} as const

const fontTitle = 'Syne, sans-serif'
const fontBody = 'Space Grotesk, sans-serif'
const fontNum = "'Inter', system-ui, sans-serif"

async function getAuthHeader(): Promise<string> {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) {
    const { data: { session: refreshed } } = await supabase.auth.refreshSession()
    if (!refreshed?.access_token) throw new Error('No session')
    return `Bearer ${refreshed.access_token}`
  }
  return `Bearer ${session.access_token}`
}

/**
 * Safely parse a fetch Response's JSON body.
 * Some non-OK responses (502, network proxies, empty bodies) are not valid JSON
 * and would cause response.json() to throw — masking the real HTTP error and
 * leaving the user trapped in a "loop". This returns null on any parse failure.
 */
async function safeJson(response: Response): Promise<unknown> {
  try {
    const text = await response.text()
    if (!text) return null
    return JSON.parse(text) as unknown
  } catch {
    return null
  }
}

function extractErrorMessage(payload: unknown, fallback: string): string {
  if (payload && typeof payload === 'object' && 'error' in payload) {
    const value = (payload as { error: unknown }).error
    if (typeof value === 'string' && value.length > 0) return value
  }
  return fallback
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
  const [productQty, setProductQty] = useState<Record<string, number>>({})
  const [wizardStep, setWizardStep] = useState<0|1|2|3|4|5>(0)
  const [wizardPaymentMethod, setWizardPaymentMethod] = useState<'efectivo'|'transferencia'>('efectivo')
  // Tip and products have their OWN payment method (cash register reconciliation):
  // the client may pay the service by transfer but the tip in cash, etc. They default
  // to the service method (set when the service method is chosen) and can be overridden.
  const [wizardTipPaymentMethod, setWizardTipPaymentMethod] = useState<'efectivo'|'transferencia'>('efectivo')
  const [wizardOthersPaymentMethod, setWizardOthersPaymentMethod] = useState<'efectivo'|'transferencia'>('efectivo')
  const [wizardTip, setWizardTip] = useState('')
  const [wizardTipEnabled, setWizardTipEnabled] = useState(false)
  const [processing, setProcessing] = useState(false)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [shiftLoading, setShiftLoading] = useState(false)
  const [confirmingClose, setConfirmingClose] = useState(false)
  const [refreshTrigger, setRefreshTrigger] = useState(0)
  const [appointmentsCount, setAppointmentsCount] = useState<number>(0)
  const [lastShiftDate, setLastShiftDate] = useState<string | null>(null)
  // Inline error shown INSIDE the wizard modal. Critical: when confirmAttention fails,
  // the page-level error banner is hidden behind the modal overlay (zIndex: 1000),
  // so users perceive an infinite loop. This state makes the failure visible in-modal
  // and the new escape button below it guarantees the user can always exit.
  const [wizardError, setWizardError] = useState<string | null>(null)

  const resetWizard = () => {
    setWizardStep(0)
    setSelectedServices([])
    setSelectedProducts([])
    setProductQty({})
    setWizardPaymentMethod('efectivo')
    setWizardTipPaymentMethod('efectivo')
    setWizardOthersPaymentMethod('efectivo')
    setWizardTip('')
    setWizardTipEnabled(false)
    setWizardError(null)
    setProcessing(false)
  }


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
        let logsData: ServiceLog[] = []
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
          logsData = (logsDataQuery as ServiceLog[] | null) || []
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
        // safeJson: 502/empty-body/HTML proxy errors make response.json() throw,
        // masking the real HTTP status and trapping the user (same fix as confirmAttention).
        const errorPayload = await safeJson(response)
        throw new Error(extractErrorMessage(errorPayload, `Error al abrir turno (HTTP ${response.status})`))
      }
      const result = (await safeJson(response)) as { shift: Shift } | null
      if (!result?.shift) throw new Error('Respuesta inválida del servidor al abrir turno')
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
        // safeJson: 502/empty-body/HTML proxy errors make response.json() throw,
        // masking the real HTTP status and trapping the user (same fix as confirmAttention).
        const errorPayload = await safeJson(response)
        throw new Error(extractErrorMessage(errorPayload, `Error al cerrar turno (HTTP ${response.status})`))
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
        // safeJson: 502/empty-body/HTML proxy errors make response.json() throw,
        // masking the real HTTP status and trapping the user (same fix as confirmAttention).
        const errorPayload = await safeJson(response)
        throw new Error(extractErrorMessage(errorPayload, `Error al pausar/reanudar turno (HTTP ${response.status})`))
      }
      const result = (await safeJson(response)) as { shift: Shift; message?: string } | null
      if (!result?.shift) throw new Error('Respuesta inválida del servidor al pausar/reanudar turno')
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
    setProductQty(prev => {
      const next = { ...prev }
      if (next[product.id]) {
        delete next[product.id]
      } else {
        next[product.id] = 1
      }
      return next
    })
  }

  const changeProductQty = (id: string, delta: number) => {
    setProductQty(prev => ({ ...prev, [id]: Math.max(1, (prev[id] || 1) + delta) }))
  }

  const confirmAttention = async () => {
    if (!tenant || !profile || selectedServices.length === 0) return
    if (shiftStatus !== 'open') {
      setWizardError('No hay un turno abierto. Inicia un turno para registrar servicios.')
      return
    }

    setProcessing(true)
    setError(null)
    setWizardError(null)

    try {
      const servicesPayload = selectedServices.map(s => ({
        service_id: s.id,
        price_charged: s.base_price,
      }))

      const productsPayload = selectedProducts.map(p => {
        const quantity = productQty[p.id] || 1
        return {
          product_id: p.id,
          product_name: p.name,
          unit_price: p.base_price,
          quantity,
          line_total: p.base_price * quantity,
        }
      })

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
          tip_payment_method: wizardTipPaymentMethod,
          others_amount: productsPayload.reduce((sum, p) => sum + p.line_total, 0),
          others_payment_method: wizardOthersPaymentMethod,
          products: productsPayload,
        }),
      })

      if (!response.ok) {
        // Use safeJson because some failure modes (502, empty body, HTML error pages
        // from proxies) make response.json() throw — which previously masked the real
        // HTTP status code from the user and contributed to the "stuck on confirm" UX.
        const errorPayload = await safeJson(response)
        const message = extractErrorMessage(
          errorPayload,
          `Error al registrar atención (HTTP ${response.status})`
        )
        throw new Error(message)
      }

      const result = (await safeJson(response)) as { message?: string } | null

      // Success path: refresh data, then fully reset the wizard so the user is never
      // left with stale selections/state.
      setRefreshTrigger(prev => prev + 1)
      resetWizard()

      setSuccessMessage(`¡Cliente registrado! ${result?.message ?? ''}`.trim())
      setTimeout(() => setSuccessMessage(null), 5000)
    } catch (err: unknown) {
      console.error('Error confirming attention:', err)
      const errorMessage = err instanceof Error ? err.message : 'Error al registrar atención'
      // Show the error BOTH inline (inside the modal, where the user is looking) AND
      // at the page level (visible after they close the modal). The wizard stays open
      // so the user can read the message and either retry or close — never stuck.
      setWizardError(errorMessage)
      setError(errorMessage)
    } finally {
      // Always re-enable the button. Critical: never leave processing=true on an
      // unrecoverable error or the user perceives an infinite loop.
      setProcessing(false)
    }
  }


  if (loading) {
    return (
      <div style={{ maxWidth: '430px', margin: '0 auto', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '240px', gap: '16px' }}>
        <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
        <div style={{ width: 36, height: 36, borderRadius: '50%', border: `3px solid ${C.borderLt}`, borderTopColor: C.blue, animation: 'spin 0.8s linear infinite' }} />
        <p style={{ fontSize: 14, color: C.slate400, fontFamily: fontBody, margin: 0 }}>Cargando...</p>
      </div>
    )
  }

  return (
    <div style={{ maxWidth: '430px', margin: '0 auto', padding: '0 16px', paddingBottom: 'calc(96px + env(safe-area-inset-bottom))', boxSizing: 'border-box', overflowX: 'hidden' }}>

      {/* Animation primitives — injected once. ≤300ms, opacity + transform only. */}
      <style>{`
        @keyframes barberFadeIn { from { opacity: 0; transform: translateY(6px) } to { opacity: 1; transform: translateY(0) } }
        @keyframes barberToastIn { from { opacity: 0; transform: translateY(-8px) } to { opacity: 1; transform: translateY(0) } }
        .barber-state { animation: barberFadeIn 260ms cubic-bezier(0.23,1,0.32,1); }
        .barber-step { animation: barberFadeIn 240ms cubic-bezier(0.23,1,0.32,1); }
        .barber-primary { transition: transform 160ms cubic-bezier(0.23,1,0.32,1), box-shadow 200ms ease, opacity 150ms ease; }
        .barber-primary:active:not(:disabled) { transform: scale(0.97); }
      `}</style>

      {/* Success toast */}
      {successMessage && (
        <div style={{
          position: 'fixed', top: '16px', left: '50%', transform: 'translateX(-50%)',
          background: '#fff', color: C.ink,
          border: `1px solid ${C.border}`, padding: '13px 18px',
          borderRadius: '14px', fontFamily: fontBody,
          fontWeight: 600, fontSize: '14px',
          display: 'flex', alignItems: 'center', gap: '8px',
          zIndex: 1000, boxShadow: '0 8px 24px rgba(15,23,42,0.12)',
          animation: 'barberToastIn 240ms cubic-bezier(0.23,1,0.32,1)',
          maxWidth: 'calc(100% - 32px)',
        }}>
          <span style={{ width: 20, height: 20, borderRadius: '50%', background: C.greenBg, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={C.green} strokeWidth="3"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
          </span>
          {successMessage}
        </div>
      )}

      {/* Aviso de gracia (suscripción vencida) — primer elemento, arriba del hero */}
      <GraceBanner style={{ marginTop: '16px' }} />

      {/* Hero banner — blue gradient greeting */}
      <div style={{ padding: '16px 0 0' }}>
        <div style={{
          position: 'relative',
          background: 'linear-gradient(135deg, #3B82F6 0%, #2563EB 55%, #1D4ED8 100%)',
          borderRadius: '20px', padding: '22px 20px',
          color: '#fff', overflow: 'hidden',
          boxShadow: '0 10px 30px rgba(37, 99, 235, 0.30)',
        }}>
          {/* Decorative soft glow */}
          <div style={{ position: 'absolute', top: -40, right: -30, width: 160, height: 160, borderRadius: '50%', background: 'rgba(255,255,255,0.10)', pointerEvents: 'none' }} />

          {/* Shift status badge */}
          <div style={{ position: 'absolute', top: '18px', right: '18px' }}>
            {shiftStatus === 'open' ? (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: C.greenBg, color: C.green, borderRadius: '999px', padding: '4px 11px', fontSize: '12px', fontFamily: fontBody, fontWeight: 600 }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: C.greenDot }} /> Turno activo
              </span>
            ) : shiftStatus === 'paused' ? (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: C.amberBg, color: C.amber, borderRadius: '999px', padding: '4px 11px', fontSize: '12px', fontFamily: fontBody, fontWeight: 600 }}>
                ⏸ Pausado
              </span>
            ) : (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: 'rgba(255,255,255,0.18)', color: 'rgba(255,255,255,0.85)', borderRadius: '999px', padding: '4px 11px', fontSize: '12px', fontFamily: fontBody, fontWeight: 600 }}>
                ○ Sin turno
              </span>
            )}
          </div>

          <h1 style={{ fontFamily: fontTitle, fontWeight: 700, fontSize: 'clamp(22px, 6.5vw, 26px)', color: '#fff', margin: 0, lineHeight: 1.15, paddingRight: '90px' }}>
            Hola, {profile?.display_name || 'Barbero'}
          </h1>
          <p style={{ color: 'rgba(255,255,255,0.8)', fontFamily: fontBody, fontSize: '14px', marginTop: '8px', marginBottom: 0 }}>
            Tu día empieza ahora.
          </p>
        </div>
      </div>

      {/* Shift control card */}
      <div style={{ background: '#fff', border: `1px solid ${C.borderLt}`, borderRadius: '16px', padding: '20px', marginTop: '16px', boxShadow: '0 1px 2px rgba(15,23,42,0.04)' }}>
        <h2 style={{ fontFamily: fontBody, fontWeight: 600, fontSize: '12px', color: C.slate500, margin: '0 0 16px 0' }}>Control de turno</h2>

        <div key={shiftStatus} className="barber-state">
          {shiftStatus === 'loading' && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
              <div>
                <div style={{ fontFamily: fontTitle, fontWeight: 700, fontSize: '17px', color: C.ink }}>Verificando turno...</div>
                <div style={{ fontFamily: fontBody, fontSize: '13px', color: C.slate500, marginTop: '4px' }}>Consultando estado actual</div>
              </div>
              <button disabled style={{ background: '#F8FAFC', color: C.slate400, border: `1px solid ${C.border}`, borderRadius: '10px', padding: '10px 20px', fontFamily: fontBody, fontWeight: 600, fontSize: '14px', cursor: 'not-allowed', opacity: 0.7 }}>
                Cargando...
              </button>
            </div>
          )}

          {shiftStatus === 'no_shift' && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '8px 8px 4px', gap: '14px', textAlign: 'center' }}>
              <div style={{ width: 56, height: 56, borderRadius: 16, background: C.blueBg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke={C.blue} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="6" cy="6" r="3" /><circle cx="6" cy="18" r="3" />
                  <path d="M20 4L8.12 15.88" /><path d="M14.47 14.48L20 20" /><path d="M8.12 8.12L12 12" />
                </svg>
              </div>
              <div>
                <div style={{ fontFamily: fontTitle, fontWeight: 700, fontSize: '18px', color: C.ink }}>No hay turno activo</div>
                <div style={{ fontFamily: fontBody, fontSize: '14px', color: C.slate500, marginTop: '4px' }}>Iniciá tu turno para comenzar a registrar clientes</div>
              </div>
              <button
                className="barber-primary"
                onClick={handleOpenShift}
                disabled={shiftLoading}
                style={{ background: `linear-gradient(135deg, ${C.blue} 0%, ${C.blueBright} 100%)`, color: '#fff', border: 'none', borderRadius: '12px', padding: '13px 36px', fontFamily: fontBody, fontWeight: 600, fontSize: '15px', cursor: shiftLoading ? 'not-allowed' : 'pointer', opacity: shiftLoading ? 0.6 : 1, boxShadow: '0 4px 12px rgba(37,99,235,0.25)' }}
              >
                {shiftLoading ? 'Procesando...' : 'Iniciar turno'}
              </button>
            </div>
          )}

          {shiftStatus === 'open' && currentShift && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontFamily: fontTitle, fontWeight: 700, fontSize: '18px', color: C.ink }}>Turno activo</div>
                <div style={{ fontFamily: fontBody, fontSize: '13px', color: C.slate500, marginTop: '4px' }}>
                  Iniciado a las {new Date(currentShift.started_at).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
                  {currentShift.total_services > 0 && ` · ${currentShift.total_services} servicios · $${currentShift.barber_earnings.toLocaleString()} ganados`}
                </div>
              </div>
              <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                <button
                  onClick={handlePauseResumeShift}
                  disabled={shiftLoading}
                  style={{ background: '#fff', color: C.slate600, border: `1px solid ${C.border}`, borderRadius: '12px', padding: '10px 18px', fontFamily: fontBody, fontWeight: 600, fontSize: '14px', cursor: shiftLoading ? 'not-allowed' : 'pointer', opacity: shiftLoading ? 0.6 : 1 }}
                >
                  {shiftLoading ? 'Procesando...' : 'Pausar'}
                </button>
                {confirmingClose ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontFamily: fontBody, fontSize: '13px', color: C.ink }}>¿Cerrar turno?</span>
                    <button onClick={() => { setConfirmingClose(false); handleCloseShift() }} disabled={shiftLoading}
                      style={{ background: '#FEF2F2', color: C.red, border: '1px solid #FECACA', borderRadius: '10px', padding: '8px 14px', fontFamily: fontBody, fontWeight: 600, fontSize: '13px', cursor: 'pointer' }}>
                      Sí, cerrar
                    </button>
                    <button onClick={() => setConfirmingClose(false)}
                      style={{ background: '#F8FAFC', color: C.slate500, border: `1px solid ${C.border}`, borderRadius: '10px', padding: '8px 14px', fontFamily: fontBody, fontWeight: 600, fontSize: '13px', cursor: 'pointer' }}>
                      Cancelar
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setConfirmingClose(true)}
                    disabled={shiftLoading}
                    style={{ background: '#FEE2E2', color: C.red, border: '1px solid #FECACA', borderRadius: '12px', padding: '10px 18px', fontFamily: fontBody, fontWeight: 600, fontSize: '14px', cursor: shiftLoading ? 'not-allowed' : 'pointer', opacity: shiftLoading ? 0.6 : 1 }}
                  >
                    {shiftLoading ? 'Procesando...' : 'Cerrar turno'}
                  </button>
                )}
              </div>
            </div>
          )}

          {shiftStatus === 'paused' && currentShift && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontFamily: fontTitle, fontWeight: 700, fontSize: '18px', color: C.ink }}>Turno pausado</div>
                <div style={{ fontFamily: fontBody, fontSize: '13px', color: C.slate500, marginTop: '4px' }}>
                  Iniciado a las {new Date(currentShift.started_at).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
                  {currentShift.paused_at && ` · Pausado a las ${new Date(currentShift.paused_at).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}`}
                  {currentShift.total_services > 0 && ` · ${currentShift.total_services} servicios · $${currentShift.barber_earnings.toLocaleString()} ganados`}
                </div>
              </div>
              <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                <button
                  className="barber-primary"
                  onClick={handlePauseResumeShift}
                  disabled={shiftLoading}
                  style={{ background: `linear-gradient(135deg, ${C.blue} 0%, ${C.blueBright} 100%)`, color: '#fff', border: 'none', borderRadius: '10px', padding: '10px 18px', fontFamily: fontBody, fontWeight: 600, fontSize: '14px', cursor: shiftLoading ? 'not-allowed' : 'pointer', opacity: shiftLoading ? 0.6 : 1, boxShadow: '0 4px 12px rgba(37,99,235,0.25)' }}
                >
                  {shiftLoading ? 'Procesando...' : 'Reanudar'}
                </button>
                {confirmingClose ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontFamily: fontBody, fontSize: '13px', color: C.ink }}>¿Cerrar turno?</span>
                    <button onClick={() => { setConfirmingClose(false); handleCloseShift() }} disabled={shiftLoading}
                      style={{ background: '#FEF2F2', color: C.red, border: '1px solid #FECACA', borderRadius: '10px', padding: '8px 14px', fontFamily: fontBody, fontWeight: 600, fontSize: '13px', cursor: 'pointer' }}>
                      Sí, cerrar
                    </button>
                    <button onClick={() => setConfirmingClose(false)}
                      style={{ background: '#F8FAFC', color: C.slate500, border: `1px solid ${C.border}`, borderRadius: '10px', padding: '8px 14px', fontFamily: fontBody, fontWeight: 600, fontSize: '13px', cursor: 'pointer' }}>
                      Cancelar
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setConfirmingClose(true)}
                    disabled={shiftLoading}
                    style={{ background: '#FEE2E2', color: C.red, border: '1px solid #FECACA', borderRadius: '12px', padding: '10px 18px', fontFamily: fontBody, fontWeight: 600, fontSize: '14px', cursor: shiftLoading ? 'not-allowed' : 'pointer', opacity: shiftLoading ? 0.6 : 1 }}
                  >
                    {shiftLoading ? 'Procesando...' : 'Cerrar turno'}
                  </button>
                )}
              </div>
            </div>
          )}

          {shiftStatus === 'closed' && (
            <div>
              <div style={{ fontFamily: fontTitle, fontWeight: 700, fontSize: '18px', color: C.ink }}>Turno cerrado</div>
              <div style={{ fontFamily: fontBody, fontSize: '13px', color: C.slate500, marginTop: '4px' }}>Tu día ha finalizado. Hasta mañana.</div>
            </div>
          )}
        </div>
      </div>

      {/* Error message */}
      {error && (
        <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: '12px', padding: '12px 16px', marginTop: '16px', color: C.red, fontFamily: fontBody, fontSize: '14px' }}>
          {error}
        </div>
      )}

      {/* Stat cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '12px', marginTop: '16px' }}>

        {/* Servicios */}
        <StatCard
          label="Servicios hoy"
          value={String(todayLogs.length)}
          chipBg={C.blueBg}
          iconStroke={C.blue}
          icon={
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={C.blue} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="6" cy="6" r="3" /><circle cx="6" cy="18" r="3" />
              <path d="M20 4L8.12 15.88" /><path d="M14.47 14.48L20 20" /><path d="M8.12 8.12L12 12" />
            </svg>
          }
        />

        {/* Clientes */}
        <StatCard
          label="Clientes"
          value={String(appointmentsCount)}
          chipBg={C.greenBg}
          iconStroke={C.green}
          icon={
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={C.green} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="9" cy="8" r="3.2" /><path d="M3 19c0-3.3 2.7-6 6-6s6 2.7 6 6" />
              <circle cx="17" cy="9" r="2.5" /><path d="M21 18c0-2.2-1.8-4-4-4" />
            </svg>
          }
        />

        {/* Mi ganancia — highlighted, spans full width */}
        <div
          style={{ gridColumn: '1 / -1', background: '#fff', border: `1px solid ${C.borderLt}`, borderRadius: '16px', padding: '18px', boxShadow: '0 1px 2px rgba(15,23,42,0.04)', display: 'flex', alignItems: 'center', gap: '14px' }}
        >
          <div style={{ width: 44, height: 44, borderRadius: 12, background: C.blueBg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, color: C.blue }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={C.blue} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontFamily: fontBody, fontWeight: 500, fontSize: '12px', color: C.slate500 }}>Mi ganancia</div>
            <div style={{ fontFamily: fontNum, fontWeight: 800, fontSize: 'clamp(28px, 8vw, 34px)', color: C.blue, marginTop: '4px', lineHeight: 1, letterSpacing: '-0.5px' }}>${totalEarningsToday.toLocaleString()}</div>
            <div style={{ fontFamily: fontBody, fontSize: '11px', color: C.slate400, marginTop: '6px' }}>del turno actual</div>
          </div>
        </div>

      </div>

      {shiftStatus === 'closed' && lastShiftDate && (
        <div style={{ textAlign: 'center', color: C.slate400, fontSize: '12px', fontFamily: fontBody, marginTop: '12px' }}>
          {lastShiftDate}
        </div>
      )}

      {/* Register attention button — FIXED to the viewport (not sticky), so it
          is entirely outside the scrollable content and can never end up
          overlapping/"taping" the cards above it, regardless of iOS/Android
          dynamic viewport resizing. bottom = 96px (nav height + 32px gap) +
          env(safe-area-inset-bottom), same math the bottom nav itself uses.
          Centered and width-matched to the nav card since fixed elements
          don't inherit the maxWidth/padding of the scrollable wrapper above. */}
      <div style={{
        position: 'fixed',
        bottom: 'calc(96px + env(safe-area-inset-bottom))',
        left: '50%',
        transform: 'translateX(-50%)',
        width: 'calc(100% - 32px)',
        maxWidth: '398px',
        zIndex: 90,
      }}>
        {shiftStatus === 'open' ? (
          <button
            className="barber-primary"
            onClick={() => { setSelectedServices([]); setSelectedProducts([]); setProductQty({}); setWizardError(null); setWizardStep(1) }}
            style={{ width: '100%', height: '56px', background: `linear-gradient(135deg, ${C.blue} 0%, ${C.blueBright} 100%)`, color: '#fff', fontFamily: fontBody, fontWeight: 600, fontSize: '16px', letterSpacing: '0.01em', border: 'none', borderRadius: '14px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', boxShadow: '0 6px 16px rgba(37,99,235,0.28)' }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14M5 12h14" /></svg>
            Registrar cliente
          </button>
        ) : (
          <div>
            <button
              disabled
              style={{ width: '100%', height: '56px', background: '#F1F5F9', color: C.slate400, fontFamily: fontBody, fontWeight: 600, fontSize: '16px', border: 'none', borderRadius: '14px', cursor: 'not-allowed', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14M5 12h14" /></svg>
              Registrar cliente
            </button>
            <div style={{ textAlign: 'center', color: C.slate400, fontSize: '12px', fontFamily: fontBody, marginTop: '8px' }}>
              Inicia un turno para registrar
            </div>
          </div>
        )}
      </div>

      {/* Wizard Modal */}
      {wizardStep > 0 && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '16px' }}>
          <div style={{ background: '#fff', maxWidth: '440px', width: '100%', borderRadius: '20px', padding: '28px', position: 'relative', boxShadow: '0 24px 60px rgba(15,23,42,0.28)', boxSizing: 'border-box' }}>

            {/* Progress bar */}
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '4px', background: C.borderLt, borderRadius: '20px 20px 0 0', overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${Math.min(wizardStep, 4) / 4 * 100}%`, background: `linear-gradient(90deg, ${C.blue}, ${C.blueBright})`, transition: 'width 0.3s ease' }} />
            </div>

            {/* Back button (steps 2-5) */}
            {wizardStep > 1 && (
              <button
                onClick={() => { setWizardError(null); setWizardStep(prev => (prev - 1) as 0|1|2|3|4|5) }}
                disabled={processing}
                style={{ position: 'absolute', top: '16px', left: '16px', background: 'transparent', border: 'none', cursor: processing ? 'not-allowed' : 'pointer', color: C.slate400, fontSize: '13px', fontFamily: fontBody, display: 'flex', alignItems: 'center', gap: '4px', padding: '4px', opacity: processing ? 0.5 : 1 }}
              >
                ← Volver
              </button>
            )}

            {/* Close (X) button — always available so the user can never get trapped */}
            <button
              onClick={resetWizard}
              disabled={processing}
              aria-label="Cerrar"
              style={{ position: 'absolute', top: '12px', right: '12px', background: 'transparent', border: 'none', cursor: processing ? 'not-allowed' : 'pointer', color: C.slate400, fontSize: '22px', lineHeight: 1, padding: '4px 10px', fontFamily: fontBody, opacity: processing ? 0.5 : 1 }}
            >
              ×
            </button>

            {/* Step content — fades between steps (opacity + translateY) */}
            <div key={wizardStep} className="barber-step">

            {/* ── Step 1: Services ── */}
            {wizardStep === 1 && (
              <>
                <div style={{ fontFamily: fontBody, fontSize: '11px', color: C.slate400, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '8px', marginTop: '8px' }}>Paso 1 de 5 · Servicios</div>
                <div style={{ fontFamily: fontTitle, fontWeight: 700, fontSize: '20px', color: C.ink, marginBottom: '20px' }}>¿Qué servicios?</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '280px', overflowY: 'auto', marginBottom: '12px' }}>
                  {services.length === 0 && (
                    <div style={{ fontFamily: fontBody, fontSize: '13px', color: C.slate400, textAlign: 'center', padding: '12px' }}>
                      No hay servicios en el catálogo
                    </div>
                  )}
                  {services.map(service => {
                    const isSel = selectedServices.some(s => s.id === service.id)
                    return (
                      <div
                        key={service.id}
                        onClick={() => toggleServiceSelection(service)}
                        style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px', background: isSel ? C.blueBg : '#F8FAFC', borderRadius: '10px', border: isSel ? `1px solid ${C.blue}` : `1px solid ${C.border}`, cursor: 'pointer' }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <div style={{ width: '18px', height: '18px', borderRadius: '5px', border: `2px solid ${isSel ? C.blue : '#CBD5E1'}`, background: isSel ? C.blue : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                            {isSel && <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>}
                          </div>
                          <span style={{ fontFamily: fontBody, fontSize: '14px', color: C.ink }}>{service.name}</span>
                        </div>
                        <span style={{ fontFamily: fontBody, fontWeight: 600, fontSize: '14px', color: C.ink }}>${service.base_price.toLocaleString('es-AR')}</span>
                      </div>
                    )
                  })}
                </div>
                <div style={{ fontFamily: fontBody, fontSize: '12px', color: C.slate500, marginBottom: '16px', minHeight: '18px' }}>
                  {selectedServices.length > 0
                    ? `${selectedServices.length} seleccionado${selectedServices.length !== 1 ? 's' : ''} · $${selectedServices.reduce((s, x) => s + x.base_price, 0).toLocaleString('es-AR')}`
                    : 'Ningún servicio seleccionado'}
                </div>
                <button
                  onClick={() => setWizardStep(2)}
                  disabled={selectedServices.length === 0}
                  style={{ width: '100%', height: '48px', background: selectedServices.length > 0 ? `linear-gradient(135deg, ${C.blue} 0%, ${C.blueBright} 100%)` : '#E2E8F0', color: selectedServices.length > 0 ? '#fff' : C.slate400, border: 'none', borderRadius: '12px', fontFamily: fontBody, fontWeight: 600, fontSize: '15px', cursor: selectedServices.length > 0 ? 'pointer' : 'not-allowed' }}
                >
                  Siguiente →
                </button>
              </>
            )}

            {/* ── Step 2: Payment method ── */}
            {wizardStep === 2 && (
              <>
                <div style={{ fontFamily: fontBody, fontSize: '11px', color: C.slate400, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '8px', marginTop: '28px' }}>Paso 2 de 5 · Método de pago</div>
                <div style={{ fontFamily: fontTitle, fontWeight: 700, fontSize: '22px', color: C.ink, marginBottom: '24px' }}>Método de pago</div>
                <div style={{ display: 'flex', gap: '12px' }}>
                  <button
                    onClick={() => { setWizardPaymentMethod('efectivo'); setWizardTipPaymentMethod('efectivo'); setWizardOthersPaymentMethod('efectivo'); setWizardStep(3) }}
                    style={{ flex: 1, padding: '20px 12px', borderRadius: '12px', border: wizardPaymentMethod === 'efectivo' ? 'none' : `1px solid ${C.border}`, background: wizardPaymentMethod === 'efectivo' ? C.blue : '#F8FAFC', color: wizardPaymentMethod === 'efectivo' ? '#fff' : C.ink, fontFamily: fontBody, fontWeight: 600, fontSize: '15px', cursor: 'pointer' }}
                  >
                    💵 Efectivo
                  </button>
                  <button
                    onClick={() => { setWizardPaymentMethod('transferencia'); setWizardTipPaymentMethod('transferencia'); setWizardOthersPaymentMethod('transferencia'); setWizardStep(3) }}
                    style={{ flex: 1, padding: '20px 12px', borderRadius: '12px', border: wizardPaymentMethod === 'transferencia' ? 'none' : `1px solid ${C.border}`, background: wizardPaymentMethod === 'transferencia' ? C.blue : '#F8FAFC', color: wizardPaymentMethod === 'transferencia' ? '#fff' : C.ink, fontFamily: fontBody, fontWeight: 600, fontSize: '15px', cursor: 'pointer' }}
                  >
                    📲 Transferencia
                  </button>
                </div>
              </>
            )}

            {/* ── Step 3: Tip ── */}
            {wizardStep === 3 && (
              <>
                <div style={{ fontFamily: fontBody, fontSize: '11px', color: C.slate400, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '8px', marginTop: '28px' }}>Paso 3 de 5 · Propina</div>
                <div style={{ fontFamily: fontTitle, fontWeight: 700, fontSize: '22px', color: C.ink, marginBottom: '6px' }}>Propina</div>
                <div style={{ fontFamily: fontBody, fontSize: '13px', color: C.slate500, marginBottom: '24px' }}>La propina es 100% para el barbero</div>
                {!wizardTipEnabled ? (
                  <div style={{ display: 'flex', gap: '12px' }}>
                    <button onClick={() => setWizardTipEnabled(true)} style={{ flex: 1, padding: '16px', borderRadius: '12px', border: `1px solid ${C.border}`, background: '#F8FAFC', color: C.ink, fontFamily: fontBody, fontWeight: 600, fontSize: '14px', cursor: 'pointer' }}>
                      Sí, hubo propina
                    </button>
                    <button onClick={() => { setWizardTip(''); setWizardStep(4) }} style={{ flex: 1, padding: '16px', borderRadius: '12px', border: 'none', background: C.blue, color: '#fff', fontFamily: fontBody, fontWeight: 600, fontSize: '14px', cursor: 'pointer' }}>
                      No, continuar →
                    </button>
                  </div>
                ) : (
                  <>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
                      <span style={{ fontSize: '20px', fontWeight: 700, color: C.ink, fontFamily: fontBody }}>$</span>
                      <input type="number" placeholder="0" value={wizardTip} onChange={e => setWizardTip(e.target.value)} style={{ flex: 1, border: `1px solid ${C.border}`, borderRadius: '10px', padding: '12px', fontSize: '16px', background: '#F8FAFC', color: C.ink, outline: 'none', fontFamily: fontBody }} />
                    </div>
                    <div style={{ fontFamily: fontBody, fontSize: '12px', color: C.slate500, marginBottom: '8px' }}>Método de pago de la propina</div>
                    <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
                      <button onClick={() => setWizardTipPaymentMethod('efectivo')} style={{ flex: 1, padding: '12px', borderRadius: '10px', border: wizardTipPaymentMethod === 'efectivo' ? 'none' : `1px solid ${C.border}`, background: wizardTipPaymentMethod === 'efectivo' ? C.blue : '#F8FAFC', color: wizardTipPaymentMethod === 'efectivo' ? '#fff' : C.ink, fontFamily: fontBody, fontWeight: 600, fontSize: '14px', cursor: 'pointer' }}>
                        💵 Efectivo
                      </button>
                      <button onClick={() => setWizardTipPaymentMethod('transferencia')} style={{ flex: 1, padding: '12px', borderRadius: '10px', border: wizardTipPaymentMethod === 'transferencia' ? 'none' : `1px solid ${C.border}`, background: wizardTipPaymentMethod === 'transferencia' ? C.blue : '#F8FAFC', color: wizardTipPaymentMethod === 'transferencia' ? '#fff' : C.ink, fontFamily: fontBody, fontWeight: 600, fontSize: '14px', cursor: 'pointer' }}>
                        📲 Transferencia
                      </button>
                    </div>
                    <button onClick={() => setWizardStep(4)} style={{ width: '100%', height: '48px', background: C.blue, color: '#fff', border: 'none', borderRadius: '12px', fontFamily: fontBody, fontWeight: 600, fontSize: '15px', cursor: 'pointer' }}>
                      Siguiente →
                    </button>
                  </>
                )}
              </>
            )}

            {/* ── Step 4: Products ── */}
            {wizardStep === 4 && (
              <>
                <div style={{ fontFamily: fontBody, fontSize: '11px', color: C.slate400, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '8px', marginTop: '28px' }}>Paso 4 de 5 · Productos</div>
                <div style={{ fontFamily: fontTitle, fontWeight: 700, fontSize: '22px', color: C.ink, marginBottom: '6px' }}>¿Vendiste algún producto?</div>
                <div style={{ fontFamily: fontBody, fontSize: '13px', color: C.slate500, marginBottom: '20px' }}>Ceras, bebidas, etc. Van 100% al dueño</div>
                {products.length === 0 ? (
                  <>
                    <div style={{ fontFamily: fontBody, fontSize: '13px', color: C.slate400, marginBottom: '16px', textAlign: 'center', padding: '12px' }}>
                      No hay productos en el catálogo
                    </div>
                    <button onClick={() => setWizardStep(5)} style={{ width: '100%', height: '48px', background: C.blue, color: '#fff', border: 'none', borderRadius: '12px', fontFamily: fontBody, fontWeight: 600, fontSize: '15px', cursor: 'pointer' }}>
                      Continuar →
                    </button>
                  </>
                ) : (
                  <>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '280px', overflowY: 'auto', marginBottom: '12px' }}>
                      {products.map(product => {
                        const isSel = selectedProducts.some(p => p.id === product.id)
                        const qty = productQty[product.id] || 1
                        return (
                          <div
                            key={product.id}
                            onClick={() => toggleProductSelection(product)}
                            style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px', background: isSel ? '#FFF7ED' : '#F8FAFC', borderRadius: '10px', border: isSel ? '1px solid #F97316' : `1px solid ${C.border}`, cursor: 'pointer' }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
                              <div style={{ width: '18px', height: '18px', borderRadius: '5px', border: `2px solid ${isSel ? '#F97316' : '#CBD5E1'}`, background: isSel ? '#F97316' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                {isSel && <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>}
                              </div>
                              <span style={{ fontFamily: fontBody, fontSize: '14px', color: C.ink, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{product.name}</span>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }}>
                              {isSel && (
                                <div onClick={(e) => e.stopPropagation()} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                  <button onClick={(e) => { e.stopPropagation(); changeProductQty(product.id, -1) }} aria-label="Restar uno" style={{ width: '26px', height: '26px', borderRadius: '7px', border: `1px solid ${C.border}`, background: '#fff', color: C.ink, fontSize: '16px', fontWeight: 700, lineHeight: 1, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 }}>−</button>
                                  <span style={{ minWidth: '18px', textAlign: 'center', fontFamily: fontBody, fontWeight: 600, fontSize: '14px', color: C.ink }}>{qty}</span>
                                  <button onClick={(e) => { e.stopPropagation(); changeProductQty(product.id, 1) }} aria-label="Sumar uno" style={{ width: '26px', height: '26px', borderRadius: '7px', border: `1px solid ${C.border}`, background: '#fff', color: C.ink, fontSize: '16px', fontWeight: 700, lineHeight: 1, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 }}>+</button>
                                </div>
                              )}
                              <span style={{ fontFamily: fontBody, fontWeight: 600, fontSize: '14px', color: C.ink, minWidth: '60px', textAlign: 'right' }}>${(product.base_price * qty).toLocaleString('es-AR')}</span>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                    <div style={{ fontFamily: fontBody, fontSize: '12px', color: C.slate500, marginBottom: '16px', minHeight: '18px' }}>
                      {selectedProducts.length > 0
                        ? `${selectedProducts.reduce((s, x) => s + (productQty[x.id] || 1), 0)} unidad${selectedProducts.reduce((s, x) => s + (productQty[x.id] || 1), 0) !== 1 ? 'es' : ''} · $${selectedProducts.reduce((s, x) => s + x.base_price * (productQty[x.id] || 1), 0).toLocaleString('es-AR')}`
                        : 'Ningún producto seleccionado'}
                    </div>
                    {selectedProducts.length > 0 && (
                      <>
                        <div style={{ fontFamily: fontBody, fontSize: '12px', color: C.slate500, marginBottom: '8px' }}>Método de pago de los productos</div>
                        <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
                          <button onClick={() => setWizardOthersPaymentMethod('efectivo')} style={{ flex: 1, padding: '12px', borderRadius: '10px', border: wizardOthersPaymentMethod === 'efectivo' ? 'none' : `1px solid ${C.border}`, background: wizardOthersPaymentMethod === 'efectivo' ? C.blue : '#F8FAFC', color: wizardOthersPaymentMethod === 'efectivo' ? '#fff' : C.ink, fontFamily: fontBody, fontWeight: 600, fontSize: '14px', cursor: 'pointer' }}>
                            💵 Efectivo
                          </button>
                          <button onClick={() => setWizardOthersPaymentMethod('transferencia')} style={{ flex: 1, padding: '12px', borderRadius: '10px', border: wizardOthersPaymentMethod === 'transferencia' ? 'none' : `1px solid ${C.border}`, background: wizardOthersPaymentMethod === 'transferencia' ? C.blue : '#F8FAFC', color: wizardOthersPaymentMethod === 'transferencia' ? '#fff' : C.ink, fontFamily: fontBody, fontWeight: 600, fontSize: '14px', cursor: 'pointer' }}>
                            📲 Transferencia
                          </button>
                        </div>
                      </>
                    )}
                    <button onClick={() => setWizardStep(5)} style={{ width: '100%', height: '48px', background: C.blue, color: '#fff', border: 'none', borderRadius: '12px', fontFamily: fontBody, fontWeight: 600, fontSize: '15px', cursor: 'pointer' }}>
                      Siguiente →
                    </button>
                  </>
                )}
              </>
            )}

            {/* ── Step 5: Summary & confirm ── */}
            {wizardStep === 5 && (
              <>
                <div style={{ fontFamily: fontTitle, fontWeight: 700, fontSize: '20px', color: C.ink, marginBottom: '20px', marginTop: '8px' }}>Confirmar cliente</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '16px' }}>
                  {selectedServices.map(s => (
                    <div key={s.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', color: C.ink, fontFamily: fontBody }}>
                      <span>{s.name}</span>
                      <span style={{ fontWeight: 500 }}>${s.base_price.toLocaleString('es-AR')}</span>
                    </div>
                  ))}
                </div>
                {selectedProducts.length > 0 && (
                  <div style={{ borderTop: `1px solid ${C.borderLt}`, paddingTop: '12px', marginBottom: '16px' }}>
                    <div style={{ fontFamily: fontBody, fontSize: '11px', color: C.slate400, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '8px' }}>Productos (100% dueño)</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {selectedProducts.map(p => {
                        const qty = productQty[p.id] || 1
                        return (
                          <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', color: C.ink, fontFamily: fontBody }}>
                            <span>{p.name}{qty > 1 ? ` ×${qty}` : ''}</span>
                            <span style={{ fontWeight: 500 }}>${(p.base_price * qty).toLocaleString('es-AR')}</span>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}
                <div style={{ borderTop: `1px solid ${C.borderLt}`, paddingTop: '12px', marginBottom: '12px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <div style={{ fontFamily: fontBody, fontSize: '13px', color: C.slate500 }}>
                    Método de pago: {wizardPaymentMethod === 'transferencia' ? '📲 Transferencia' : '💵 Efectivo'}
                  </div>
                  {(parseFloat(wizardTip) || 0) > 0 && (
                    <div style={{ fontFamily: fontBody, fontSize: '13px', color: C.slate500 }}>
                      Propina: <span style={{ color: C.blue, fontWeight: 600 }}>${(parseFloat(wizardTip) || 0).toLocaleString('es-AR')}</span> <span style={{ color: C.slate400 }}>(100% para vos · {wizardTipPaymentMethod === 'transferencia' ? '📲 Transferencia' : '💵 Efectivo'})</span>
                    </div>
                  )}
                  {selectedProducts.length > 0 && (
                    <div style={{ fontFamily: fontBody, fontSize: '13px', color: C.slate500 }}>
                      Productos: <span style={{ color: C.slate400 }}>{wizardOthersPaymentMethod === 'transferencia' ? '📲 Transferencia' : '💵 Efectivo'}</span>
                    </div>
                  )}
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 16px', background: '#F8FAFC', borderRadius: '12px', marginBottom: '20px', border: `1px solid ${C.border}` }}>
                  <span style={{ fontFamily: fontTitle, fontWeight: 700, fontSize: '14px', color: C.ink }}>Total</span>
                  <span style={{ fontFamily: fontNum, fontWeight: 800, fontSize: '22px', color: C.blue, letterSpacing: '-0.5px' }}>
                    ${(selectedServices.reduce((s, x) => s + x.base_price, 0) + (parseFloat(wizardTip) || 0) + selectedProducts.reduce((s, x) => s + x.base_price * (productQty[x.id] || 1), 0)).toLocaleString('es-AR')}
                  </span>
                </div>

                {/* Inline wizard error — critical: page-level error banner is hidden
                    behind the modal overlay, so any failure MUST be displayed here. */}
                {wizardError && (
                  <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: '10px', padding: '12px 14px', marginBottom: '12px', color: C.red, fontFamily: fontBody, fontSize: '13px', lineHeight: 1.4 }}>
                    {wizardError}
                  </div>
                )}

                <button
                  className="barber-primary"
                  onClick={confirmAttention}
                  disabled={processing}
                  style={{ width: '100%', height: '52px', background: `linear-gradient(135deg, ${C.blue} 0%, ${C.blueBright} 100%)`, color: '#fff', border: 'none', borderRadius: '14px', fontFamily: fontBody, fontWeight: 600, fontSize: '15px', cursor: processing ? 'not-allowed' : 'pointer', opacity: processing ? 0.7 : 1, boxShadow: '0 6px 16px rgba(37,99,235,0.28)' }}
                >
                  {processing ? 'Procesando...' : wizardError ? '↻ Reintentar' : '✓ Confirmar y Registrar'}
                </button>

                {/* Escape hatch: always allow the user to abandon the wizard,
                    especially after a failure. Prevents the "infinite loop" UX. */}
                {wizardError && !processing && (
                  <button
                    onClick={resetWizard}
                    style={{ width: '100%', height: '44px', marginTop: '10px', background: 'transparent', color: C.slate500, border: `1px solid ${C.border}`, borderRadius: '12px', fontFamily: fontBody, fontWeight: 600, fontSize: '14px', cursor: 'pointer' }}
                  >
                    Cancelar y cerrar
                  </button>
                )}
              </>
            )}

            </div>
          </div>
        </div>
      )}

    </div>
  )
}

// =============================================================================
// Shared subcomponents
// =============================================================================
function StatCard({
  label,
  value,
  chipBg,
  iconStroke,
  icon,
}: {
  label: string
  value: string
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
        padding: '16px',
        boxShadow: '0 1px 2px rgba(15,23,42,0.04)',
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
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
      <div style={{ minWidth: 0 }}>
        <div
          style={{
            fontFamily: fontBody,
            fontWeight: 500,
            fontSize: '12px',
            color: C.slate500,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {label}
        </div>
        <div
          style={{
            fontFamily: fontNum,
            fontWeight: 800,
            fontSize: 'clamp(26px, 7.5vw, 32px)',
            color: C.ink,
            letterSpacing: '-0.5px',
            lineHeight: 1.05,
            marginTop: '4px',
          }}
        >
          {value}
        </div>
      </div>
    </div>
  )
}
