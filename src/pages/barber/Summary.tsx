import { useState, useEffect } from 'react'
import { useTenantStore } from '../../stores/tenantStore'
import { supabase } from '../../config/supabase'

export function Summary() {
  const { tenant, profile } = useTenantStore()
  const [loading, setLoading] = useState(true)
  const [refreshTrigger, setRefreshTrigger] = useState(0)
  const [totalServicesMonth, setTotalServicesMonth] = useState(0)
  const [totalEarningsMonth, setTotalEarningsMonth] = useState(0)
  const [monthName, setMonthName] = useState('')

  useEffect(() => {
    let isMounted = true

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

    const loadMonthlyData = async () => {
      if (isMounted) setLoading(true)

      try {
        const argNow = new Date()
        const argToday = argNow.toLocaleDateString('en-CA', { timeZone: 'America/Argentina/Buenos_Aires' })
        const [year, month] = argToday.split('-').map(Number)
        const monthStart = new Date(Date.UTC(year, month - 1, 1, 3, 0, 0)).toISOString()
        const monthEnd = new Date(Date.UTC(year, month, 1, 2, 59, 59, 999)).toISOString()
        console.log('[Summary] month range (UTC):', monthStart, '→', monthEnd)

        const { data: monthLogs, error: monthError } = await supabase
          .from('service_logs')
          .select('barber_earning')
          .eq('tenant_id', tenant.id)
          .eq('barber_id', profile.id)
          .in('status', ['completed', 'closed'])
          .gte('started_at', monthStart)
          .lte('started_at', monthEnd)

        if (monthError) {
          console.warn('[Summary] monthly logs query error:', monthError)
        } else if (isMounted) {
          setTotalServicesMonth((monthLogs || []).length)
          setTotalEarningsMonth((monthLogs || []).reduce((sum, l) => sum + l.barber_earning, 0))
          setMonthName(argNow.toLocaleDateString('es-AR', { month: 'long', year: 'numeric', timeZone: 'America/Argentina/Buenos_Aires' }))
        }
      } catch (err) {
        console.warn('[Summary] monthly data exception:', err)
      } finally {
        if (isMounted) setLoading(false)
      }
    }

    loadMonthlyData()
    return () => { isMounted = false }
  }, [tenant, profile, refreshTrigger])

  if (loading) {
    return (
      <div style={{ maxWidth: '1000px', margin: '0 auto', padding: '40px', textAlign: 'center', color: '#999' }}>
        Cargando resumen...
      </div>
    )
  }

  return (
    <div style={{ maxWidth: '1000px', margin: '0 auto' }}>
      <div>
        <h2 style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: '22px', color: '#1a1a2e', margin: 0 }}>Mi mes</h2>
        <div style={{ color: '#aaa', fontSize: '13px', marginTop: '4px', marginBottom: '16px', textTransform: 'capitalize' }}>{monthName}</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
          <div style={{ background: '#fff', border: '0.5px solid #e0e0e0', borderRadius: '10px', padding: '20px' }}>
            <div style={{ fontFamily: 'Space Grotesk, sans-serif', fontSize: '10px', color: '#aaa', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '8px' }}>Servicios del mes</div>
            <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: '32px', color: '#1a1a2e' }}>{totalServicesMonth}</div>
          </div>
          <div style={{ background: '#fff', border: '0.5px solid var(--primary, #1E2A3A)', borderRadius: '10px', padding: '20px' }}>
            <div style={{ fontFamily: 'Space Grotesk, sans-serif', fontSize: '10px', color: '#aaa', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '8px' }}>Mi ganancia del mes</div>
            <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: '28px', color: 'var(--secondary, #D4A853)' }}>${totalEarningsMonth.toLocaleString('es-AR')}</div>
          </div>
        </div>
      </div>
    </div>
  )
}
