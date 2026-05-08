import { useState, useEffect } from 'react'
import { useTenantStore } from '../../stores/tenantStore'
import { supabase } from '../../config/supabase'
import type { ServiceLog, DailySummary as BackendDailySummary, Shift } from '../../types'

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
        const today = new Date().toISOString().split('T')[0]

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
            .gte('started_at', `${today}T00:00:00`)
            .lte('started_at', `${today}T23:59:59`)
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
            .gte('started_at', `${today}T00:00:00`)
            .lte('started_at', `${today}T23:59:59`)
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

        // Load monthly accumulated stats (Argentina timezone UTC-3)
        try {
          const now = new Date()
          const argOffset = -3 * 60 // UTC-3 en minutos
          const argNow = new Date(now.getTime() + (argOffset - now.getTimezoneOffset()) * 60000)
          const firstDayUTC = new Date(Date.UTC(argNow.getFullYear(), argNow.getMonth(), 1, 3, 0, 0))
          const lastDayUTC = new Date(Date.UTC(argNow.getFullYear(), argNow.getMonth() + 1, 1, 2, 59, 59))
          console.log('[Summary] month range (UTC):', firstDayUTC.toISOString(), '→', lastDayUTC.toISOString())
          const { data: monthLogs, error: monthError } = await supabase
            .from('service_logs')
            .select('barber_earning')
            .eq('tenant_id', tenant.id)
            .eq('barber_id', profile.id)
            .in('status', ['completed', 'closed'])
            .gte('created_at', firstDayUTC.toISOString())
            .lte('created_at', lastDayUTC.toISOString())
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
      const today = new Date().toISOString().split('T')[0]
      const response = await fetch('/api/close-day', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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
        .gte('started_at', `${today}T00:00:00`)
        .lte('started_at', `${today}T23:59:59`)
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
      <div style={{ maxWidth: '1000px', margin: '0 auto', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '240px', gap: '16px' }}>
        <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
        <div style={{ width: 40, height: 40, borderRadius: '50%', border: '3px solid #F3F4F6', borderTopColor: '#D4A853', animation: 'spin 0.8s linear infinite' }} />
        <p style={{ fontSize: 14, color: '#9CA3AF', fontFamily: 'Space Grotesk, sans-serif', margin: 0 }}>Cargando tu resumen...</p>
      </div>
    )
  }

  return (
    <div style={{ maxWidth: '1000px', margin: '0 auto' }}>

      {/* Page header */}
      <div style={{ marginBottom: '28px' }}>
        <h1 style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: '26px', color: '#1E2A3A', margin: 0 }}>Mi Resumen</h1>
        <div style={{ fontFamily: 'Space Grotesk, sans-serif', fontSize: '14px', color: '#6B7280', marginTop: '4px', textTransform: 'capitalize' }}>{monthName}</div>
      </div>

      {/* Monthly hero card */}
      <div style={{ background: 'linear-gradient(135deg, #1E2A3A 0%, #2D3F52 100%)', borderRadius: '16px', padding: '32px', marginBottom: '24px' }}>
        <div style={{ fontFamily: 'Space Grotesk, sans-serif', fontSize: '10px', color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: '2px', marginBottom: '12px' }}>MES ACTUAL</div>
        <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 800, fontSize: '44px', color: '#D4A853', lineHeight: 1 }}>
          ${totalEarningsMonth.toLocaleString('es-AR')}
        </div>
        <div style={{ fontFamily: 'Space Grotesk, sans-serif', fontSize: '15px', color: 'rgba(255,255,255,0.75)', marginTop: '8px' }}>
          {totalServicesMonth} {totalServicesMonth === 1 ? 'servicio' : 'servicios'} registrados
        </div>
        <div style={{ marginTop: '20px', borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '16px' }}>
          <div style={{ fontFamily: 'Space Grotesk, sans-serif', fontSize: '12px', color: 'rgba(255,255,255,0.4)' }}>Mi ganancia acumulada del mes</div>
        </div>
      </div>

      {/* Error message */}
      {error && (
        <div style={{ background: '#FEF2F2', border: '1px solid #FCA5A5', borderRadius: '10px', padding: '12px 16px', marginBottom: '24px', color: '#DC2626', fontFamily: 'Space Grotesk, sans-serif', fontSize: '14px' }}>
          {error}
        </div>
      )}

      {/* Today section header */}
      <div style={{ marginBottom: '16px' }}>
        <h2 style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: '20px', color: '#1E2A3A', margin: 0 }}>Hoy</h2>
        <p style={{ color: '#6B7280', fontSize: '13px', fontFamily: 'Space Grotesk, sans-serif', marginTop: '4px', marginBottom: 0 }}>Métricas del día en curso</p>
      </div>

      {/* Today stat cards */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '24px' }}>
        <div style={{ background: '#fff', border: '1px solid #E8E9EB', borderRadius: '12px', padding: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
          <div style={{ fontFamily: 'Space Grotesk, sans-serif', fontWeight: 500, fontSize: '11px', color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '12px' }}>Servicios hoy</div>
          <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: '36px', color: '#1E2A3A', lineHeight: 1 }}>{summary?.totalServices || 0}</div>
        </div>
        <div style={{ background: '#fff', borderTop: '3px solid #D4A853', borderLeft: '1.5px solid #D4A853', borderRight: '1.5px solid #D4A853', borderBottom: '1.5px solid #D4A853', borderRadius: '12px', padding: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
          <div style={{ fontFamily: 'Space Grotesk, sans-serif', fontWeight: 500, fontSize: '11px', color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '12px' }}>Mi ganancia hoy</div>
          <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: '36px', color: '#D4A853', lineHeight: 1 }}>${summary?.barberEarnings.toLocaleString() || '0'}</div>
        </div>
      </div>

      {/* Close day section */}
      <div style={{ background: '#fff', border: '1px solid #E8E9EB', borderRadius: '12px', padding: '28px', marginBottom: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
        {dayClosed ? (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
              <div style={{ width: 32, height: 32, borderRadius: '50%', background: '#F0FDF4', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#16A34A" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
              </div>
              <h2 style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: '18px', color: '#1E2A3A', margin: 0 }}>Día Cerrado</h2>
            </div>
            <p style={{ color: '#6B7280', fontSize: '14px', fontFamily: 'Space Grotesk, sans-serif', marginBottom: '20px', marginTop: 0 }}>El día ya fue cerrado. Aquí está el resumen final.</p>
            {(closeResult || existingSummary) && (
              <div style={{ background: '#F9FAFB', border: '1px solid #E8E9EB', borderRadius: '10px', padding: '20px' }}>
                <div style={{ fontFamily: 'Space Grotesk, sans-serif', fontSize: '11px', color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '16px' }}>Resumen del día cerrado</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                  <div>
                    <div style={{ fontFamily: 'Space Grotesk, sans-serif', fontSize: '12px', color: '#9CA3AF', marginBottom: '4px' }}>Servicios totales</div>
                    <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: '24px', color: '#1E2A3A' }}>
                      {closeResult ? closeResult.summary.total_services : existingSummary?.total_services}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontFamily: 'Space Grotesk, sans-serif', fontSize: '12px', color: '#9CA3AF', marginBottom: '4px' }}>Tu ganancia total</div>
                    <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: '24px', color: '#D4A853' }}>
                      ${closeResult ? closeResult.summary.barber_earnings.toLocaleString() : existingSummary?.barber_earnings.toLocaleString()}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        ) : (
          <>
            <div className="mobile-stack" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '16px', marginBottom: closeResult ? '20px' : 0 }}>
              <div style={{ flex: 1 }}>
                <h2 style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: '18px', color: '#1E2A3A', marginBottom: '6px', marginTop: 0 }}>Cierre del día</h2>
                <p style={{ color: '#6B7280', fontSize: '14px', fontFamily: 'Space Grotesk, sans-serif', margin: 0 }}>Genera el resumen final y registra tus ganancias.</p>
              </div>
              <button
                onClick={handleCloseDay}
                disabled={closingDay || activeLogs.length === 0}
                style={{ background: activeLogs.length === 0 ? '#F3F4F6' : '#D4A853', color: activeLogs.length === 0 ? '#9CA3AF' : '#1E2A3A', border: 'none', borderRadius: '8px', padding: '12px 24px', fontFamily: 'Space Grotesk, sans-serif', fontWeight: 600, fontSize: '14px', cursor: activeLogs.length === 0 ? 'not-allowed' : 'pointer', opacity: closingDay ? 0.6 : 1, whiteSpace: 'nowrap', flexShrink: 0 }}
              >
                {closingDay ? 'Procesando...' : 'Cerrar el día'}
              </button>
            </div>
            {closeResult && (
              <div style={{ background: '#F9FAFB', border: '1px solid #E8E9EB', borderRadius: '10px', padding: '20px' }}>
                <div style={{ fontFamily: 'Space Grotesk, sans-serif', fontSize: '11px', color: '#16A34A', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '16px', fontWeight: 600 }}>✓ Día cerrado exitosamente</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                  <div>
                    <div style={{ fontFamily: 'Space Grotesk, sans-serif', fontSize: '12px', color: '#9CA3AF', marginBottom: '4px' }}>Servicios totales</div>
                    <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: '24px', color: '#1E2A3A' }}>{closeResult.summary.total_services}</div>
                  </div>
                  <div>
                    <div style={{ fontFamily: 'Space Grotesk, sans-serif', fontSize: '12px', color: '#9CA3AF', marginBottom: '4px' }}>Tu ganancia total</div>
                    <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: '24px', color: '#D4A853' }}>${closeResult.summary.barber_earnings.toLocaleString()}</div>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Services history */}
      <div style={{ background: '#fff', border: '1px solid #E8E9EB', borderRadius: '12px', overflow: 'hidden', marginBottom: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
        <div style={{ padding: '20px 24px', borderBottom: '1px solid #F3F4F6' }}>
          <h2 style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: '18px', color: '#1E2A3A', margin: 0 }}>Historial de clientes hoy</h2>
        </div>
        {clientGroups.length === 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '48px 24px', gap: '12px', textAlign: 'center' }}>
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#D4A853" strokeWidth="1.5" style={{ opacity: 0.6 }}>
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
            </svg>
            <div>
              <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 600, fontSize: '16px', color: '#1E2A3A' }}>Sin registros hoy</div>
              <div style={{ fontFamily: 'Space Grotesk, sans-serif', fontSize: '14px', color: '#6B7280', marginTop: '4px' }}>Los servicios que registres aparecerán aquí</div>
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
                <div key={firstLog.id} style={{ padding: '16px 24px', borderBottom: '1px solid #F3F4F6' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <div style={{ fontFamily: 'Space Grotesk, sans-serif', fontWeight: 600, fontSize: '14px', color: '#1E2A3A' }}>
                      Cliente #{idx + 1}
                    </div>
                    <span style={{ fontFamily: 'Space Grotesk, sans-serif', fontSize: '13px', color: '#6B7280' }}>
                      {formatTime(firstLog.started_at)}
                    </span>
                  </div>
                  {paymentMethod && (
                    <div style={{ marginBottom: '10px' }}>
                      <span style={{ fontSize: '11px', fontFamily: 'Space Grotesk, sans-serif', fontWeight: 600, padding: '2px 8px', borderRadius: '20px', background: paymentMethod === 'efectivo' ? '#F0FDF4' : '#EFF6FF', color: paymentMethod === 'efectivo' ? '#16A34A' : '#3B82F6' }}>
                        {paymentMethod === 'efectivo' ? '💵 Efectivo' : '📲 Transferencia'}
                      </span>
                    </div>
                  )}
                  <div style={{ borderTop: '1px solid #F3F4F6', marginBottom: '8px' }} />
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginBottom: '8px' }}>
                    {group.map(log => (
                      <div key={log.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', color: '#374151', fontFamily: 'Space Grotesk, sans-serif' }}>
                        <span>· Servicio</span>
                        <span>${log.price_charged.toLocaleString()}</span>
                      </div>
                    ))}
                  </div>
                  <div style={{ borderTop: '1px solid #F3F4F6', marginBottom: '8px' }} />
                  {tipTotal > 0 && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', fontFamily: 'Space Grotesk, sans-serif', marginBottom: '6px' }}>
                      <span style={{ color: '#6B7280' }}>Propina:</span>
                      <span style={{ color: '#D4A853', fontWeight: 600 }}>${tipTotal.toLocaleString()}</span>
                    </div>
                  )}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontFamily: 'Space Grotesk, sans-serif', fontSize: '13px', color: '#6B7280' }}>Total ganancia:</span>
                    <span style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: '16px', color: '#D4A853' }}>+${earningsTotal.toLocaleString()}</span>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Shifts history */}
      <div style={{ background: '#fff', border: '1px solid #E8E9EB', borderRadius: '12px', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
        <div style={{ padding: '20px 24px', borderBottom: '1px solid #F3F4F6' }}>
          <h2 style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: '18px', color: '#1E2A3A', margin: 0 }}>Historial de turnos hoy</h2>
        </div>
        {shifts.length === 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '48px 24px', gap: '12px', textAlign: 'center' }}>
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#D4A853" strokeWidth="1.5" style={{ opacity: 0.6 }}>
              <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
            </svg>
            <div>
              <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 600, fontSize: '16px', color: '#1E2A3A' }}>Sin turnos cerrados hoy</div>
              <div style={{ fontFamily: 'Space Grotesk, sans-serif', fontSize: '14px', color: '#6B7280', marginTop: '4px' }}>Los turnos cerrados aparecerán aquí</div>
            </div>
          </div>
        ) : (
          <>
            <div>
              {shifts.map((shift) => (
                <div
                  key={shift.id}
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 24px', borderBottom: '1px solid #F3F4F6', transition: 'background 150ms' }}
                  onMouseEnter={e => { e.currentTarget.style.background = '#FAFAFA' }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
                >
                  <div style={{ flex: 1 }}>
                    <div style={{ fontFamily: 'Space Grotesk, sans-serif', fontWeight: 500, fontSize: '14px', color: '#1E2A3A', marginBottom: '3px' }}>
                      {formatTime(shift.started_at)} — {shift.closed_at ? formatTime(shift.closed_at) : 'En curso'}
                    </div>
                    <div style={{ fontFamily: 'Space Grotesk, sans-serif', fontSize: '13px', color: '#6B7280' }}>
                      {shift.total_services} servicios · ${shift.total_revenue.toLocaleString()}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 600, fontSize: '16px', color: '#D4A853' }}>+${shift.barber_earnings.toLocaleString()}</div>
                    <div style={{ fontFamily: 'Space Grotesk, sans-serif', fontSize: '11px', color: '#9CA3AF', marginTop: '2px' }}>Ganancia</div>
                  </div>
                </div>
              ))}
            </div>
            <div style={{ padding: '20px 24px', background: '#F9FAFB', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontFamily: 'Space Grotesk, sans-serif', fontWeight: 600, fontSize: '14px', color: '#1E2A3A' }}>Total acumulado del día</div>
                <div style={{ fontFamily: 'Space Grotesk, sans-serif', fontSize: '12px', color: '#9CA3AF', marginTop: '2px' }}>Suma de todos los turnos cerrados</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: '24px', color: '#D4A853' }}>
                  ${shifts.reduce((sum, shift) => sum + shift.barber_earnings, 0).toLocaleString()}
                </div>
                <div style={{ fontFamily: 'Space Grotesk, sans-serif', fontSize: '12px', color: '#9CA3AF', marginTop: '2px' }}>
                  {shifts.reduce((sum, shift) => sum + shift.total_services, 0)} servicios totales
                </div>
              </div>
            </div>
          </>
        )}
      </div>

    </div>
  )
}
