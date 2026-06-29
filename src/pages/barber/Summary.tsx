import { useState, useEffect } from 'react'
import { useTenantStore } from '../../stores/tenantStore'
import { supabase } from '../../config/supabase'
import type { ServiceLog, DailySummary as BackendDailySummary, Shift } from '../../types'

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

// Returns Argentina calendar date (YYYY-MM-DD) independent of device timezone.
function getArgentinaDateString(date: Date = new Date()): string {
  return date.toLocaleDateString('en-CA', { timeZone: 'America/Argentina/Buenos_Aires' })
}

// Returns the UTC range corresponding to the Argentina calendar day (UTC-3, no DST).
function getArgentinaDayRangeUTC(date: Date = new Date()): { startUTC: string; endUTC: string; today: string } {
  const argDate = getArgentinaDateString(date)
  // Start of day Argentina is 03:00 UTC of the same date
  const startUTC = `${argDate}T03:00:00.000Z`
  // End of day Argentina is 02:59:59.999 UTC of the next day
  const nextDay = new Date(date)
  nextDay.setDate(nextDay.getDate() + 1)
  const argNextDate = getArgentinaDateString(nextDay)
  const endUTC = `${argNextDate}T02:59:59.999Z`
  return { startUTC, endUTC, today: argDate }
}

// Returns the UTC range for the Argentina calendar month containing the given date.
function getArgentinaMonthRangeUTC(date: Date = new Date()): { firstDayUTC: string; lastDayUTC: string } {
  const argDate = getArgentinaDateString(date) // YYYY-MM-DD
  const [yearStr, monthStr] = argDate.split('-')
  const year = parseInt(yearStr, 10)
  const month = parseInt(monthStr, 10) // 1-12
  const firstOfMonth = `${yearStr}-${monthStr}-01`
  // First day of next month at 02:59:59.999 UTC = end of last day of current month in Argentina
  const nextMonth = month === 12 ? 1 : month + 1
  const nextYear = month === 12 ? year + 1 : year
  const nextMonthFirst = `${nextYear}-${String(nextMonth).padStart(2, '0')}-01`
  return {
    firstDayUTC: `${firstOfMonth}T03:00:00.000Z`,
    lastDayUTC: `${nextMonthFirst}T02:59:59.999Z`,
  }
}

interface TodaySummary {
  totalServices: number
  totalRevenue: number
  barberEarnings: number
  ownerEarnings: number
}

interface CloseDayResult {
  summary: BackendDailySummary
}

export function Summary() {
  const { tenant, profile } = useTenantStore()
  const [logs, setLogs] = useState<ServiceLog[]>([])
  const [summary, setSummary] = useState<TodaySummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [closingDay, setClosingDay] = useState(false)
  const [closeResult, setCloseResult] = useState<CloseDayResult | null>(null)
  const [dayClosed, setDayClosed] = useState(false)
  const [existingSummary, setExistingSummary] = useState<BackendDailySummary | null>(null)
  const [shifts, setShifts] = useState<Shift[]>([])
  const [totalServicesMonth, setTotalServicesMonth] = useState(0)
  const [totalEarningsMonth, setTotalEarningsMonth] = useState(0)
  const [monthName, setMonthName] = useState('')
  const [refreshTrigger, setRefreshTrigger] = useState(0)

  const activeLogs = logs.filter(log => log.status === 'completed')

  const clientGroups = (() => {
    const groupMap = new Map<string, ServiceLog[]>()
    activeLogs.forEach(log => {
      const key = log.appointment_id ?? log.started_at.substring(0, 16)
      const existing = groupMap.get(key)
      if (existing) existing.push(log)
      else groupMap.set(key, [log])
    })
    return Array.from(groupMap.values()).sort(
      (a, b) => new Date(a[0].started_at).getTime() - new Date(b[0].started_at).getTime()
    )
  })()

  // Load today's logs
  useEffect(() => {
    let isMounted = true
    let timeoutId: ReturnType<typeof setTimeout> | null = null

    if (!tenant?.id || !profile?.id) {
      setLoading(false)
      const retryId = setTimeout(() => {
        if (isMounted) setRefreshTrigger(prev => prev + 1)
      }, 500)
      return () => {
        isMounted = false
        clearTimeout(retryId)
      }
    }

    const loadTodayLogs = async () => {
      if (!tenant?.id || !profile?.id) return
      if (isMounted) setLoading(true)
      setError(null)

      // Safety timeout: force loading false after 5 seconds
      timeoutId = setTimeout(() => {
        if (isMounted) {
          setLoading(false)
          // setError('La carga está tomando más tiempo de lo esperado. Mostrando datos disponibles.')
        }
      }, 10000)

      try {
        // Argentina timezone (UTC-3): compute day range using toLocaleDateString
        // (independent of device timezone).
        const now = new Date()
        const { startUTC, endUTC, today } = getArgentinaDayRangeUTC(now)

        // Check if day already closed (optional query, continue even if fails)
        let dailySummary = null
        let isDayClosed = false
        try {
          const { data, error: summaryError } = await supabase
            .from('daily_summaries')
            .select('*')
            .eq('tenant_id', tenant.id)
            .eq('barber_id', profile.id)
            .eq('summary_date', today)
            .maybeSingle()

          if (summaryError) {
            console.warn('[Summary] daily_summaries query error (non‑blocking):', summaryError)
          } else {
            dailySummary = data
            isDayClosed = !!data
          }
        } catch (err) {
          console.warn('[Summary] daily_summaries query exception (non‑blocking):', err)
        }

        if (isMounted) {
          setDayClosed(isDayClosed)
          setExistingSummary(dailySummary || null)
        }

        // Load all service logs for today (including closed)
        let logsData: ServiceLog[] = []
        try {
          const { data, error: logsError } = await supabase
            .from('service_logs')
            .select('*')
            .eq('tenant_id', tenant.id)
            .eq('barber_id', profile.id)
            .gte('created_at', startUTC)
            .lte('created_at', endUTC)
            .order('started_at', { ascending: false })

          if (logsError) {
            console.error('[Summary] service_logs query error:', logsError)
          } else {
            logsData = data || []
          }
        } catch (err) {
          console.error('[Summary] service_logs query exception:', err)
        }

        if (isMounted) setLogs(logsData)

        // Load closed shifts for today
        let shiftsData: Shift[] = []
        try {
          const { data, error: shiftsError } = await supabase
            .from('shifts')
            .select('*')
            .eq('tenant_id', tenant.id)
            .eq('barber_id', profile.id)
            .eq('status', 'closed')
            .gte('created_at', startUTC)
            .lte('created_at', endUTC)
            .order('started_at', { ascending: true })

          if (shiftsError) {
            console.error('[Summary] shifts query error:', shiftsError)
          } else {
            shiftsData = data || []
          }
        } catch (err) {
          console.error('[Summary] shifts query exception:', err)
        }

        if (isMounted) setShifts(shiftsData)

        // Load monthly accumulated stats (Argentina timezone, device-independent)
        try {
          const { firstDayUTC, lastDayUTC } = getArgentinaMonthRangeUTC(now)
          console.log('[Summary] month range (UTC):', firstDayUTC, '→', lastDayUTC)
          const { data: monthLogs, error: monthError } = await supabase
            .from('service_logs')
            .select('barber_earning')
            .eq('tenant_id', tenant.id)
            .eq('barber_id', profile.id)
            .in('status', ['completed', 'closed'])
            .gte('created_at', firstDayUTC)
            .lte('created_at', lastDayUTC)
          if (monthError) {
            console.warn('[Summary] monthly logs query error (non-blocking):', monthError)
          } else if (isMounted) {
            setTotalServicesMonth((monthLogs || []).length)
            setTotalEarningsMonth((monthLogs || []).reduce((sum, l) => sum + l.barber_earning, 0))
            setMonthName(now.toLocaleDateString('es-AR', { month: 'long', year: 'numeric', timeZone: 'America/Argentina/Buenos_Aires' }))
          }
        } catch (err) {
          console.warn('[Summary] monthly logs query exception (non-blocking):', err)
        }

        // Calculate summary using only logs and shifts (ignore daily_summaries for calculation)
        const activeLogs = logsData.filter(log => log.status === 'completed')
        const totalServices = activeLogs.length
        const totalRevenue = activeLogs.reduce((sum, log) => sum + log.price_charged, 0)
        const barberEarnings = activeLogs.reduce((sum, log) => sum + log.barber_earning, 0)
        const ownerEarnings = activeLogs.reduce((sum, log) => sum + log.owner_earning, 0)

        if (isMounted) {
          setSummary({
            totalServices,
            totalRevenue,
            barberEarnings,
            ownerEarnings,
          })
        }
      } catch (err: unknown) {
        console.error('[Summary] Unexpected error in loadTodayLogs:', err)
        const errorMessage = err instanceof Error ? err.message : 'Error al cargar resumen'
        if (isMounted) setError(errorMessage)
      } finally {
        // Clear safety timeout
        if (timeoutId) clearTimeout(timeoutId)
        if (isMounted) setLoading(false)
      }
    }

    if (!tenant?.id || !profile?.id) {
      setLoading(false)
      const retryId = setTimeout(() => {
        if (isMounted) loadTodayLogs()
      }, 500)
      return () => {
        isMounted = false
        clearTimeout(retryId)
      }
    }

    loadTodayLogs()
    return () => {
      isMounted = false
      if (timeoutId) clearTimeout(timeoutId)
    }
  }, [tenant, profile, refreshTrigger])

  const handleCloseDay = async () => {
    if (!profile?.id || !tenant?.id) return

    setClosingDay(true)
    setError(null)

    try {
      // Argentina timezone (UTC-3): compute day range using toLocaleDateString
      // (independent of device timezone).
      const now = new Date()
      const { startUTC, endUTC, today } = getArgentinaDayRangeUTC(now)
      const authHeader = await getAuthHeader()
      const response = await fetch('/api/close-day', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': authHeader },
        body: JSON.stringify({
          barber_id: profile.id,
          date: today,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Error al cerrar el día')
      }

      const result = await response.json()
      setCloseResult(result)
      setDayClosed(true)
      setExistingSummary(result.summary)
      // Update summary state with closed day data
      setSummary({
        totalServices: result.summary.total_services,
        totalRevenue: result.summary.total_revenue,
        barberEarnings: result.summary.barber_earnings,
        ownerEarnings: result.summary.owner_earnings,
      })

      // Reload logs to reflect closure (including closed logs)
      const { data } = await supabase
        .from('service_logs')
        .select('*')
        .eq('tenant_id', tenant.id)
        .eq('barber_id', profile.id)
        .gte('created_at', startUTC)
        .lte('created_at', endUTC)
        .order('started_at', { ascending: false })

      setLogs(data || [])
    } catch (err: unknown) {
      console.error('Error closing day:', err)
      const errorMessage = err instanceof Error ? err.message : 'Error al cerrar el día'
      setError(errorMessage)
    } finally {
      setClosingDay(false)
    }
  }

  const formatTime = (isoString: string) => {
    const date = new Date(isoString)
    return date.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })
  }

  if (loading) {
    return (
      <div style={{ maxWidth: '430px', margin: '0 auto', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '240px', gap: '16px' }}>
        <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
        <div style={{ width: 40, height: 40, borderRadius: '50%', border: `3px solid ${C.borderLt}`, borderTopColor: C.blue, animation: 'spin 0.8s linear infinite' }} />
        <p style={{ fontSize: 14, color: C.slate400, fontFamily: fontBody, margin: 0 }}>Cargando tu resumen...</p>
      </div>
    )
  }

  return (
    <div style={{ maxWidth: '430px', margin: '0 auto', padding: '0 16px', boxSizing: 'border-box', overflowX: 'hidden' }}>

      {/* Page header */}
      <div style={{ padding: '16px 0 16px' }}>
        <h1 style={{ fontFamily: fontTitle, fontWeight: 700, fontSize: 'clamp(20px, 5.8vw, 24px)', color: C.ink, margin: 0, lineHeight: 1.2 }}>Mi Resumen</h1>
        <div style={{ fontFamily: fontBody, fontSize: '13px', color: C.slate500, marginTop: '4px', textTransform: 'capitalize' }}>{monthName}</div>
      </div>

      {/* Monthly hero card — blue gradient */}
      <div style={{
        position: 'relative',
        background: 'linear-gradient(135deg, #3B82F6 0%, #2563EB 55%, #1D4ED8 100%)',
        borderRadius: '20px', padding: '24px 22px', marginBottom: '16px',
        color: '#fff', overflow: 'hidden',
        boxShadow: '0 10px 30px rgba(37, 99, 235, 0.30)',
      }}>
        <div style={{ position: 'absolute', top: -40, right: -30, width: 160, height: 160, borderRadius: '50%', background: 'rgba(255,255,255,0.10)', pointerEvents: 'none' }} />
        <div style={{ fontFamily: fontBody, fontSize: '12px', color: 'rgba(255,255,255,0.7)', marginBottom: '12px' }}>Mes actual</div>
        <div style={{ fontFamily: fontNum, fontWeight: 800, fontSize: 'clamp(36px, 11vw, 46px)', color: '#fff', lineHeight: 1, letterSpacing: '-1px' }}>
          ${totalEarningsMonth.toLocaleString('es-AR')}
        </div>
        <div style={{ fontFamily: fontBody, fontSize: '14px', color: 'rgba(255,255,255,0.85)', marginTop: '10px' }}>
          {totalServicesMonth} {totalServicesMonth === 1 ? 'servicio' : 'servicios'} registrados
        </div>
        <div style={{ marginTop: '18px', borderTop: '1px solid rgba(255,255,255,0.18)', paddingTop: '14px' }}>
          <div style={{ fontFamily: fontBody, fontSize: '12px', color: 'rgba(255,255,255,0.6)' }}>Mi ganancia acumulada del mes</div>
        </div>
      </div>

      {/* Error message */}
      {error && (
        <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: '12px', padding: '12px 16px', marginBottom: '16px', color: C.red, fontFamily: fontBody, fontSize: '14px' }}>
          {error}
        </div>
      )}

      {/* Today section header */}
      <div style={{ marginBottom: '12px' }}>
        <h2 style={{ fontFamily: fontTitle, fontWeight: 700, fontSize: '18px', color: C.ink, margin: 0 }}>Hoy</h2>
        <p style={{ color: C.slate500, fontSize: '13px', fontFamily: fontBody, marginTop: '4px', marginBottom: 0 }}>Métricas del día en curso</p>
      </div>

      {/* Today stat cards */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
        <div style={{ background: '#fff', border: `1px solid ${C.borderLt}`, borderRadius: '16px', padding: '18px', boxShadow: '0 1px 2px rgba(15,23,42,0.04)' }}>
          <div style={{ fontFamily: fontBody, fontWeight: 500, fontSize: '12px', color: C.slate500, marginBottom: '10px' }}>Servicios hoy</div>
          <div style={{ fontFamily: fontNum, fontWeight: 800, fontSize: 'clamp(28px, 8vw, 34px)', color: C.ink, lineHeight: 1, letterSpacing: '-0.5px' }}>{summary?.totalServices || 0}</div>
        </div>
        <div style={{ background: '#fff', border: `1px solid ${C.borderLt}`, borderRadius: '16px', padding: '18px', boxShadow: '0 1px 2px rgba(15,23,42,0.04)' }}>
          <div style={{ fontFamily: fontBody, fontWeight: 500, fontSize: '12px', color: C.slate500, marginBottom: '10px' }}>Mi ganancia hoy</div>
          <div style={{ fontFamily: fontNum, fontWeight: 800, fontSize: 'clamp(28px, 8vw, 34px)', color: C.blue, lineHeight: 1, letterSpacing: '-0.5px' }}>${summary?.barberEarnings.toLocaleString() || '0'}</div>
        </div>
      </div>

      {/* Close day section */}
      <div style={{ background: '#fff', border: `1px solid ${C.borderLt}`, borderRadius: '16px', padding: '22px', marginBottom: '16px', boxShadow: '0 1px 2px rgba(15,23,42,0.04)' }}>
        {dayClosed ? (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px' }}>
              <div style={{ width: 32, height: 32, borderRadius: '50%', background: C.greenBg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={C.green} strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
              </div>
              <h2 style={{ fontFamily: fontTitle, fontWeight: 700, fontSize: '18px', color: C.ink, margin: 0 }}>Día Cerrado</h2>
            </div>
            <p style={{ color: C.slate500, fontSize: '14px', fontFamily: fontBody, marginBottom: '18px', marginTop: 0 }}>El día ya fue cerrado. Aquí está el resumen final.</p>
            {(closeResult || existingSummary) && (
              <div style={{ background: '#F8FAFC', border: `1px solid ${C.border}`, borderRadius: '12px', padding: '18px' }}>
                <div style={{ fontFamily: fontBody, fontSize: '11px', color: C.slate400, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '14px' }}>Resumen del día cerrado</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                  <div>
                    <div style={{ fontFamily: fontBody, fontSize: '12px', color: C.slate500, marginBottom: '4px' }}>Servicios totales</div>
                    <div style={{ fontFamily: fontNum, fontWeight: 800, fontSize: '24px', color: C.ink, letterSpacing: '-0.5px' }}>
                      {closeResult ? closeResult.summary.total_services : existingSummary?.total_services}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontFamily: fontBody, fontSize: '12px', color: C.slate500, marginBottom: '4px' }}>Tu ganancia total</div>
                    <div style={{ fontFamily: fontNum, fontWeight: 800, fontSize: '24px', color: C.blue, letterSpacing: '-0.5px' }}>
                      ${closeResult ? closeResult.summary.barber_earnings.toLocaleString() : existingSummary?.barber_earnings.toLocaleString()}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        ) : (
          <>
            <div className="mobile-stack" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '16px', marginBottom: closeResult ? '18px' : 0 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <h2 style={{ fontFamily: fontTitle, fontWeight: 700, fontSize: '18px', color: C.ink, marginBottom: '6px', marginTop: 0 }}>Cierre del día</h2>
                <p style={{ color: C.slate500, fontSize: '14px', fontFamily: fontBody, margin: 0 }}>Genera el resumen final y registra tus ganancias.</p>
              </div>
              <button
                onClick={handleCloseDay}
                disabled={closingDay || activeLogs.length === 0}
                style={{ background: `linear-gradient(135deg, ${C.blue} 0%, ${C.blueBright} 100%)`, color: '#fff', border: 'none', borderRadius: '12px', padding: '12px 22px', fontFamily: fontBody, fontWeight: 600, fontSize: '14px', cursor: (closingDay || activeLogs.length === 0) ? 'not-allowed' : 'pointer', opacity: (closingDay || activeLogs.length === 0) ? 0.6 : 1, whiteSpace: 'nowrap', flexShrink: 0, boxShadow: '0 4px 12px rgba(37,99,235,0.25)' }}
              >
                {closingDay ? 'Procesando...' : 'Cerrar el día'}
              </button>
            </div>
            {closeResult && (
              <div style={{ background: '#F8FAFC', border: `1px solid ${C.border}`, borderRadius: '12px', padding: '18px' }}>
                <div style={{ fontFamily: fontBody, fontSize: '11px', color: C.green, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '14px', fontWeight: 600 }}>✓ Día cerrado exitosamente</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                  <div>
                    <div style={{ fontFamily: fontBody, fontSize: '12px', color: C.slate500, marginBottom: '4px' }}>Servicios totales</div>
                    <div style={{ fontFamily: fontNum, fontWeight: 800, fontSize: '24px', color: C.ink, letterSpacing: '-0.5px' }}>{closeResult.summary.total_services}</div>
                  </div>
                  <div>
                    <div style={{ fontFamily: fontBody, fontSize: '12px', color: C.slate500, marginBottom: '4px' }}>Tu ganancia total</div>
                    <div style={{ fontFamily: fontNum, fontWeight: 800, fontSize: '24px', color: C.blue, letterSpacing: '-0.5px' }}>${closeResult.summary.barber_earnings.toLocaleString()}</div>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Services history */}
      <div style={{ background: '#fff', border: `1px solid ${C.borderLt}`, borderRadius: '16px', overflow: 'hidden', marginBottom: '16px', boxShadow: '0 1px 2px rgba(15,23,42,0.04)' }}>
        <div style={{ padding: '18px 20px', borderBottom: `1px solid ${C.borderLt}` }}>
          <h2 style={{ fontFamily: fontTitle, fontWeight: 700, fontSize: '17px', color: C.ink, margin: 0 }}>Historial de clientes hoy</h2>
        </div>
        {clientGroups.length === 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '48px 24px', gap: '12px', textAlign: 'center' }}>
            <div style={{ width: 56, height: 56, borderRadius: 16, background: C.blueBg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke={C.blue} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
              </svg>
            </div>
            <div>
              <div style={{ fontFamily: fontTitle, fontWeight: 700, fontSize: '16px', color: C.ink }}>Sin registros hoy</div>
              <div style={{ fontFamily: fontBody, fontSize: '14px', color: C.slate500, marginTop: '4px' }}>Los servicios que registres aparecerán aquí</div>
            </div>
          </div>
        ) : (
          <div>
            {clientGroups.map((group, idx) => {
              const firstLog = group[0]
              const tipTotal = group.reduce((sum, l) => sum + (l.tip_amount ?? 0), 0)
              const earningsTotal = group.reduce((sum, l) => sum + l.barber_earning, 0)
              const paymentMethod = firstLog.payment_method
              return (
                <div key={firstLog.id} style={{ padding: '16px 20px', borderBottom: `1px solid ${C.borderLt}` }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <div style={{ fontFamily: fontBody, fontWeight: 600, fontSize: '14px', color: C.ink }}>
                      Cliente #{idx + 1}
                    </div>
                    <span style={{ fontFamily: fontBody, fontSize: '13px', color: C.slate500 }}>
                      {formatTime(firstLog.started_at)}
                    </span>
                  </div>
                  {paymentMethod && (
                    <div style={{ marginBottom: '10px' }}>
                      <span style={{ fontSize: '11px', fontFamily: fontBody, fontWeight: 600, padding: '3px 9px', borderRadius: '999px', background: paymentMethod === 'efectivo' ? C.greenBg : C.blueBg, color: paymentMethod === 'efectivo' ? C.green : C.blue }}>
                        {paymentMethod === 'efectivo' ? '💵 Efectivo' : '📲 Transferencia'}
                      </span>
                    </div>
                  )}
                  <div style={{ borderTop: `1px solid ${C.borderLt}`, marginBottom: '8px' }} />
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginBottom: '8px' }}>
                    {group.map(log => (
                      <div key={log.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', color: C.slate600, fontFamily: fontBody }}>
                        <span>· Servicio</span>
                        <span>${log.price_charged.toLocaleString()}</span>
                      </div>
                    ))}
                  </div>
                  <div style={{ borderTop: `1px solid ${C.borderLt}`, marginBottom: '8px' }} />
                  {tipTotal > 0 && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', fontFamily: fontBody, marginBottom: '6px' }}>
                      <span style={{ color: C.slate500 }}>Propina:</span>
                      <span style={{ color: C.blue, fontWeight: 600 }}>${tipTotal.toLocaleString()}</span>
                    </div>
                  )}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontFamily: fontBody, fontSize: '13px', color: C.slate500 }}>Total ganancia:</span>
                    <span style={{ fontFamily: fontNum, fontWeight: 800, fontSize: '16px', color: C.blue, letterSpacing: '-0.3px' }}>+${earningsTotal.toLocaleString()}</span>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Shifts history */}
      <div style={{ background: '#fff', border: `1px solid ${C.borderLt}`, borderRadius: '16px', overflow: 'hidden', boxShadow: '0 1px 2px rgba(15,23,42,0.04)' }}>
        <div style={{ padding: '18px 20px', borderBottom: `1px solid ${C.borderLt}` }}>
          <h2 style={{ fontFamily: fontTitle, fontWeight: 700, fontSize: '17px', color: C.ink, margin: 0 }}>Historial de turnos hoy</h2>
        </div>
        {shifts.length === 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '48px 24px', gap: '12px', textAlign: 'center' }}>
            <div style={{ width: 56, height: 56, borderRadius: 16, background: C.blueBg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke={C.blue} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
              </svg>
            </div>
            <div>
              <div style={{ fontFamily: fontTitle, fontWeight: 700, fontSize: '16px', color: C.ink }}>Sin turnos cerrados hoy</div>
              <div style={{ fontFamily: fontBody, fontSize: '14px', color: C.slate500, marginTop: '4px' }}>Los turnos cerrados aparecerán aquí</div>
            </div>
          </div>
        ) : (
          <>
            <div>
              {shifts.map((shift) => (
                <div
                  key={shift.id}
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: `1px solid ${C.borderLt}` }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontFamily: fontBody, fontWeight: 500, fontSize: '14px', color: C.ink, marginBottom: '3px' }}>
                      {formatTime(shift.started_at)} — {shift.closed_at ? formatTime(shift.closed_at) : 'En curso'}
                    </div>
                    <div style={{ fontFamily: fontBody, fontSize: '13px', color: C.slate500 }}>
                      {shift.total_services} servicios · ${shift.total_revenue.toLocaleString()}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <div style={{ fontFamily: fontNum, fontWeight: 800, fontSize: '16px', color: C.blue, letterSpacing: '-0.3px' }}>+${shift.barber_earnings.toLocaleString()}</div>
                    <div style={{ fontFamily: fontBody, fontSize: '11px', color: C.slate400, marginTop: '2px' }}>Ganancia</div>
                  </div>
                </div>
              ))}
            </div>
            <div style={{ padding: '18px 20px', background: '#F8FAFC', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontFamily: fontBody, fontWeight: 600, fontSize: '14px', color: C.ink }}>Total acumulado del día</div>
                <div style={{ fontFamily: fontBody, fontSize: '12px', color: C.slate400, marginTop: '2px' }}>Suma de todos los turnos cerrados</div>
              </div>
              <div style={{ textAlign: 'right', flexShrink: 0 }}>
                <div style={{ fontFamily: fontNum, fontWeight: 800, fontSize: '24px', color: C.blue, letterSpacing: '-0.5px' }}>
                  ${shifts.reduce((sum, shift) => sum + shift.barber_earnings, 0).toLocaleString()}
                </div>
                <div style={{ fontFamily: fontBody, fontSize: '12px', color: C.slate400, marginTop: '2px' }}>
                  {shifts.reduce((sum, shift) => sum + shift.total_services, 0)} servicios totales
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Spacer to clear the floating bottom-nav */}
      <div style={{ height: '24px' }} />

    </div>
  )
}
