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

  const activeLogs = logs.filter(log => log.status === 'completed')

  // Load today's logs
  useEffect(() => {
    console.log('[Summary] useEffect triggered', { tenantId: tenant?.id, profileId: profile?.id })

    let isMounted = true
    let timeoutId: ReturnType<typeof setTimeout> | null = null

    const loadTodayLogs = async () => {
      if (!tenant?.id || !profile?.id) return
      console.log('[Summary] loadTodayLogs start')
      if (isMounted) setLoading(true)
      setError(null)

      // Safety timeout: force loading false after 5 seconds
      timeoutId = setTimeout(() => {
        console.log('[Summary] Safety timeout triggered, forcing loading false')
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
            console.log('[Summary] daily_summaries query result:', { dailySummary, isDayClosed })
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
            console.log('[Summary] service_logs query result count:', logsData.length)
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
            console.log('[Summary] shifts query result count:', shiftsData.length)
          }
        } catch (err) {
          console.error('[Summary] shifts query exception:', err)
        }

        if (isMounted) setShifts(shiftsData)

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
        console.log('[Summary] loadTodayLogs completed successfully')
      } catch (err: unknown) {
        console.error('[Summary] Unexpected error in loadTodayLogs:', err)
        const errorMessage = err instanceof Error ? err.message : 'Error al cargar resumen'
        if (isMounted) setError(errorMessage)
      } finally {
        // Clear safety timeout
        if (timeoutId) clearTimeout(timeoutId)
        console.log('[Summary] loadTodayLogs finally, isMounted:', isMounted)
        if (isMounted) setLoading(false)
      }
    }

    if (!tenant?.id || !profile?.id) {
      console.log('[Summary] missing tenant or profile, scheduling retry')
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
  }, [tenant, profile])

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
      <div style={{ maxWidth: '1000px', margin: '0 auto', padding: '40px', textAlign: 'center', color: '#999' }}>
        Cargando resumen...
      </div>
    )
  }

  return (
    <div style={{ maxWidth: '1000px', margin: '0 auto' }}>
      <div style={{ marginBottom: '32px' }}>
        <h1 style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: '26px', color: '#fff', marginBottom: '8px' }}>
          Resumen del Día
        </h1>
        <p style={{ color: '#999', fontSize: '14px' }}>Consulta tus métricas diarias</p>
      </div>

      {/* Error message */}
      {error && (
        <div style={{
          background: '#2a2a2a',
          border: '1px solid #e94560',
          borderRadius: '8px',
          padding: '12px 16px',
          marginBottom: '24px',
          color: '#e94560',
          fontFamily: 'Space Grotesk, sans-serif',
          fontSize: '14px',
        }}>
          {error}
        </div>
      )}

      {/* Summary cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '16px', marginBottom: '32px' }}>
        <div style={{ background: '#2a2a2a', border: '1px solid #383838', borderRadius: '12px', padding: '24px' }}>
          <h3 style={{ fontFamily: 'Space Grotesk, sans-serif', fontWeight: 500, fontSize: '14px', color: '#999', margin: '0 0 12px 0' }}>
            Servicios hoy
          </h3>
          <div style={{ fontFamily: 'Space Grotesk, sans-serif', fontWeight: 700, fontSize: '36px', color: '#fff' }}>
            {summary?.totalServices || 0}
          </div>
        </div>
        <div style={{ background: '#2a2a2a', border: '1px solid var(--secondary, #C8A97E)', borderRadius: '12px', padding: '24px' }}>
          <h3 style={{ fontFamily: 'Space Grotesk, sans-serif', fontWeight: 500, fontSize: '14px', color: '#999', margin: '0 0 12px 0' }}>
            Mi ganancia total
          </h3>
          <div style={{ fontFamily: 'Space Grotesk, sans-serif', fontWeight: 700, fontSize: '36px', color: 'var(--secondary, #C8A97E)' }}>
            ${summary?.barberEarnings.toLocaleString() || '0'}
          </div>
        </div>
      </div>

      {/* Close day section */}
      <div style={{ background: '#2a2a2a', border: '1px solid #383838', borderRadius: '12px', padding: '32px', marginBottom: '32px' }}>
        {dayClosed ? (
          <div>
            <h2 style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: '20px', color: '#fff', marginBottom: '8px' }}>
              Día Cerrado
            </h2>
            <p style={{ color: '#999', fontSize: '14px', fontFamily: 'Space Grotesk, sans-serif', marginBottom: '24px' }}>
              El día ya fue cerrado. Aquí está el resumen final.
            </p>
            {(closeResult || existingSummary) && (
              <div style={{
                background: '#2a2a2a',
                border: '1px solid var(--secondary, #C8A97E)',
                borderRadius: '8px',
                padding: '20px',
              }}>
                <h3 style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: '16px', color: 'var(--secondary, #C8A97E)', marginBottom: '12px' }}>
                  Resumen del día cerrado
                </h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '12px' }}>
                  <div>
                    <div style={{ fontFamily: 'Space Grotesk, sans-serif', fontSize: '12px', color: '#999' }}>Servicios totales</div>
                    <div style={{ fontFamily: 'Space Grotesk, sans-serif', fontWeight: 700, fontSize: '18px', color: '#fff' }}>
                      {closeResult ? closeResult.summary.total_services : existingSummary?.total_services}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontFamily: 'Space Grotesk, sans-serif', fontSize: '12px', color: '#999' }}>Tu ganancia total</div>
                    <div style={{ fontFamily: 'Space Grotesk, sans-serif', fontWeight: 700, fontSize: '18px', color: 'var(--secondary, #C8A97E)' }}>
                      ${closeResult ? closeResult.summary.barber_earnings.toLocaleString() : existingSummary?.barber_earnings.toLocaleString()}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        ) : (
          <>
            <div className="mobile-stack" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
              <div>
                <h2 style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: '20px', color: '#fff', marginBottom: '8px' }}>
                  Cierre del día
                </h2>
                <p style={{ color: '#999', fontSize: '14px', fontFamily: 'Space Grotesk, sans-serif' }}>
                  Genera el resumen final de hoy y registra tus ganancias.
                </p>
              </div>
              <button
                onClick={handleCloseDay}
                disabled={closingDay || activeLogs.length === 0}
                style={{
                  background: activeLogs.length === 0 ? '#383838' : 'var(--secondary, #C8A97E)',
                  color: activeLogs.length === 0 ? '#999' : 'var(--primary, #1a1a1a)',
                  border: 'none',
                  borderRadius: '8px',
                  padding: '12px 24px',
                  fontFamily: 'Space Grotesk, sans-serif',
                  fontWeight: 600,
                  fontSize: '14px',
                  cursor: activeLogs.length === 0 ? 'not-allowed' : 'pointer',
                  opacity: closingDay ? 0.6 : 1,
                  width: '100%',
                  height: '52px',
                }}
              >
                {closingDay ? 'Procesando...' : 'Cerrar el día'}
              </button>
            </div>
            {closeResult && (
              <div style={{
                background: '#2a2a2a',
                border: '1px solid var(--secondary, #C8A97E)',
                borderRadius: '8px',
                padding: '20px',
                marginTop: '20px',
              }}>
                <h3 style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: '16px', color: 'var(--secondary, #C8A97E)', marginBottom: '12px' }}>
                  Día cerrado exitosamente
                </h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '12px' }}>
                  <div>
                    <div style={{ fontFamily: 'Space Grotesk, sans-serif', fontSize: '12px', color: '#999' }}>Servicios totales</div>
                    <div style={{ fontFamily: 'Space Grotesk, sans-serif', fontWeight: 700, fontSize: '18px', color: '#fff' }}>
                      {closeResult.summary.total_services}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontFamily: 'Space Grotesk, sans-serif', fontSize: '12px', color: '#999' }}>Tu ganancia total</div>
                    <div style={{ fontFamily: 'Space Grotesk, sans-serif', fontWeight: 700, fontSize: '18px', color: 'var(--secondary, #C8A97E)' }}>
                      ${closeResult.summary.barber_earnings.toLocaleString()}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Services history */}
      <div style={{ background: '#2a2a2a', border: '1px solid #383838', borderRadius: '12px', padding: '32px' }}>
        <h2 style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: '20px', color: '#fff', marginBottom: '24px' }}>
          Historial de servicios hoy
        </h2>

        {logs.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px', color: '#999', fontFamily: 'Space Grotesk, sans-serif', fontSize: '14px' }}>
            No hay servicios registrados hoy.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {logs.map((log) => (
              <div
                key={log.id}
                style={{
                  background: '#2a2a2a',
                  borderBottom: '1px solid #383838',
                  padding: '20px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <div style={{ flex: 1 }}>
                  <div style={{ fontFamily: 'Space Grotesk, sans-serif', fontWeight: 600, fontSize: '16px', color: '#fff', marginBottom: '4px' }}>
                    Servicio #{log.service_number_today}
                  </div>
                  <div style={{ fontFamily: 'Space Grotesk, sans-serif', fontSize: '13px', color: '#999' }}>
                    {formatTime(log.started_at)} • ${log.price_charged.toLocaleString()}
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontFamily: 'Space Grotesk, sans-serif', fontWeight: 700, fontSize: '18px', color: 'var(--secondary, #C8A97E)' }}>
                    +${log.barber_earning.toLocaleString()}
                  </div>
                  <div style={{ fontFamily: 'Space Grotesk, sans-serif', fontSize: '11px', color: '#999', marginTop: '2px' }}>
                    Ganancia
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Shifts history */}
      <div style={{ background: '#2a2a2a', border: '1px solid #383838', borderRadius: '12px', padding: '32px', marginTop: '32px' }}>
        <h2 style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: '20px', color: '#fff', marginBottom: '24px' }}>
          Historial de turnos hoy
        </h2>

        {shifts.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px', color: '#999', fontFamily: 'Space Grotesk, sans-serif', fontSize: '14px' }}>
            No hay turnos cerrados hoy.
          </div>
        ) : (
          <>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {shifts.map((shift) => (
                <div
                  key={shift.id}
                  style={{
                    background: '#2a2a2a',
                    borderBottom: '1px solid #383838',
                    padding: '20px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                >
                  <div style={{ flex: 1 }}>
                    <div style={{ fontFamily: 'Space Grotesk, sans-serif', fontWeight: 600, fontSize: '16px', color: '#fff', marginBottom: '4px' }}>
                      Turno {formatTime(shift.started_at)} - {shift.closed_at ? formatTime(shift.closed_at) : 'No cerrado'}
                    </div>
                    <div style={{ fontFamily: 'Space Grotesk, sans-serif', fontSize: '13px', color: '#999' }}>
                      {shift.total_services} servicios • ${shift.total_revenue.toLocaleString()}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontFamily: 'Space Grotesk, sans-serif', fontWeight: 700, fontSize: '18px', color: 'var(--secondary, #C8A97E)' }}>
                      +${shift.barber_earnings.toLocaleString()}
                    </div>
                    <div style={{ fontFamily: 'Space Grotesk, sans-serif', fontSize: '11px', color: '#999', marginTop: '2px' }}>
                      Ganancia del turno
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <div style={{
              marginTop: '24px',
              padding: '20px',
              background: '#2a2a2a',
              border: '1px solid var(--secondary, #C8A97E)',
              borderRadius: '8px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}>
              <div>
                <div style={{ fontFamily: 'Space Grotesk, sans-serif', fontWeight: 600, fontSize: '16px', color: '#fff' }}>
                  Total acumulado del día
                </div>
                <div style={{ fontFamily: 'Space Grotesk, sans-serif', fontSize: '13px', color: '#999' }}>
                  Suma de ganancias de todos los turnos cerrados hoy
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontFamily: 'Space Grotesk, sans-serif', fontWeight: 700, fontSize: '24px', color: 'var(--secondary, #C8A97E)' }}>
                  ${shifts.reduce((sum, shift) => sum + shift.barber_earnings, 0).toLocaleString()}
                </div>
                <div style={{ fontFamily: 'Space Grotesk, sans-serif', fontSize: '12px', color: '#999', marginTop: '2px' }}>
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