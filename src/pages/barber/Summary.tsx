import { useState, useEffect } from 'react'
import { useTenantStore } from '../../stores/tenantStore'
import { supabase } from '../../config/supabase'
import type { ServiceLog, DailySummary as BackendDailySummary } from '../../types'

interface TodaySummary {
  totalServices: number
  totalRevenue: number
  barberEarnings: number
  ownerEarnings: number
}

export function Summary() {
  const { tenant, profile } = useTenantStore()
  const [logs, setLogs] = useState<ServiceLog[]>([])
  const [summary, setSummary] = useState<TodaySummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [closingDay, setClosingDay] = useState(false)
  const [closeResult, setCloseResult] = useState<any>(null)
  const [dayClosed, setDayClosed] = useState(false)
  const [existingSummary, setExistingSummary] = useState<BackendDailySummary | null>(null)

  const activeLogs = logs.filter(log => log.status === 'completed')

  // Load today's logs
  useEffect(() => {
    if (!tenant?.id || !profile?.id) {
      setLoading(false)
      return
    }

    let isMounted = true

    const loadTodayLogs = async () => {
      if (isMounted) setLoading(true)
      setError(null)

      try {
        const today = new Date().toISOString().split('T')[0]

        // Check if day already closed
        const { data: dailySummary } = await supabase
          .from('daily_summaries')
          .select('*')
          .eq('tenant_id', tenant.id)
          .eq('barber_id', profile.id)
          .eq('summary_date', today)
          .maybeSingle()

        const dayClosed = !!dailySummary
        if (isMounted) setDayClosed(dayClosed)
        if (isMounted) setExistingSummary(dailySummary || null)

        // Load all service logs for today (including closed)
        const { data: logsData, error: logsError } = await supabase
          .from('service_logs')
          .select('*')
          .eq('tenant_id', tenant.id)
          .eq('barber_id', profile.id)
          .gte('started_at', `${today}T00:00:00`)
          .lte('started_at', `${today}T23:59:59`)
          .order('started_at', { ascending: false })

        if (logsError) throw logsError

        if (isMounted) setLogs(logsData || [])

        // Calculate summary
        let totalServices, totalRevenue, barberEarnings, ownerEarnings
        if (dayClosed && dailySummary) {
          totalServices = dailySummary.total_services
          totalRevenue = dailySummary.total_revenue
          barberEarnings = dailySummary.barber_earnings
          ownerEarnings = dailySummary.owner_earnings
        } else {
          const activeLogs = logsData?.filter(log => log.status === 'completed') || []
          totalServices = activeLogs.length
          totalRevenue = activeLogs.reduce((sum, log) => sum + log.price_charged, 0)
          barberEarnings = activeLogs.reduce((sum, log) => sum + log.barber_earning, 0)
          ownerEarnings = activeLogs.reduce((sum, log) => sum + log.owner_earning, 0)
        }

        if (isMounted) setSummary({
          totalServices,
          totalRevenue,
          barberEarnings,
          ownerEarnings,
        })
      } catch (err: unknown) {
        console.error('Error loading today logs:', err)
        const errorMessage = err instanceof Error ? err.message : 'Error al cargar resumen'
        if (isMounted) setError(errorMessage)
      } finally {
        if (isMounted) setLoading(false)
      }
    }

    loadTodayLogs()
    return () => { isMounted = false }
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
    </div>
  )
}