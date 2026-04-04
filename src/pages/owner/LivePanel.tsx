import { useEffect, useState, useCallback } from 'react'
import { useTenantStore } from '../../stores/tenantStore'
import { supabase } from '../../config/supabase'
import { useServiceLogsRealtime } from '../../hooks/useRealtime'
import type { ServiceLog, Profile } from '../../types'

type ServiceLogWithBarber = ServiceLog & {
  barber_name: string
}

type BarberStats = {
  barber: Profile
  servicesCount: number
  totalGenerated: number
  ownerCommission: number
  lastServiceAt: string | null
  isActive: boolean
  highlight: boolean
}

export function LivePanel() {
  const { tenant, profile } = useTenantStore()
  const tenantId = tenant?.id || profile?.tenant_id

  const [logs, setLogs] = useState<ServiceLogWithBarber[]>([])
  const [barbers, setBarbers] = useState<Profile[]>([])
  const [loading, setLoading] = useState(true)
  const [highlightBarberId, setHighlightBarberId] = useState<string | null>(null)

  // Calculate totals
  const totalDay = logs.reduce((sum, log) => sum + log.price_charged, 0)
  const ownerEarning = logs.reduce((sum, log) => sum + log.owner_earning, 0)
  const totalServices = logs.length

  // Calculate barber stats
  const barberStats: BarberStats[] = barbers.map(barber => {
    const barberLogs = logs.filter(log => log.barber_id === barber.id)
    const servicesCount = barberLogs.length
    const totalGenerated = barberLogs.reduce((sum, log) => sum + log.price_charged, 0)
    const ownerCommission = barberLogs.reduce((sum, log) => sum + log.owner_earning, 0)
    const lastServiceAt = barberLogs.length > 0
      ? barberLogs[barberLogs.length - 1].started_at
      : null
    const isActive = lastServiceAt
      ? (Date.now() - new Date(lastServiceAt).getTime()) < 60 * 60 * 1000 // within last hour
      : false

    return {
      barber,
      servicesCount,
      totalGenerated,
      ownerCommission,
      lastServiceAt,
      isActive,
      highlight: highlightBarberId === barber.id
    }
  })

  // Load today's logs and active barbers
  const loadInitialData = useCallback(async () => {
    if (!tenantId) return

    setLoading(true)
    try {
      // Load today's service logs with barber names
      const today = new Date().toISOString().split('T')[0]
      const { data: logsData, error: logsError } = await supabase
        .from('service_logs')
        .select(`
          *,
          profiles!inner(display_name)
        `)
        .eq('tenant_id', tenantId)
        .gte('started_at', `${today}T00:00:00`)
        .lte('started_at', `${today}T23:59:59`)
        .order('started_at', { ascending: false })

      if (logsError) throw logsError

      const logsWithBarber: ServiceLogWithBarber[] = (logsData || []).map((log: any) => ({
        ...log,
        barber_name: log.profiles.display_name
      }))
      setLogs(logsWithBarber)

      // Load all barbers for this tenant
      const { data: barbersData, error: barbersError } = await supabase
        .from('profiles')
        .select('*')
        .eq('tenant_id', tenantId)
        .eq('role', 'barber')
        .order('display_name')

      if (barbersError) throw barbersError
      setBarbers(barbersData || [])
    } catch (error) {
      console.error('Error loading initial data:', error)
    } finally {
      setLoading(false)
    }
  }, [tenantId])

  useEffect(() => {
    loadInitialData()
  }, [loadInitialData])

  // Handle new logs from realtime subscription
  const handleNewLog = useCallback(async (newLog: ServiceLog) => {
    // Fetch barber name for the new log
    const { data } = await supabase
      .from('profiles')
      .select('display_name')
      .eq('id', newLog.barber_id)
      .single()

    const logWithBarber: ServiceLogWithBarber = {
      ...newLog,
      barber_name: data?.display_name || 'Barbero'
    }

    setLogs(prev => [logWithBarber, ...prev])

    // Highlight the barber for 2 seconds
    setHighlightBarberId(newLog.barber_id)
    setTimeout(() => setHighlightBarberId(null), 2000)
  }, [])

  // Subscribe to realtime updates
  useServiceLogsRealtime(tenantId || '', handleNewLog)

  // Progress bar calculation (percentage of day based on current time)
  const getDayProgress = () => {
    const now = new Date()
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0)
    const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59)
    const totalDayMs = endOfDay.getTime() - startOfDay.getTime()
    const elapsedMs = now.getTime() - startOfDay.getTime()
    return Math.min(100, Math.round((elapsedMs / totalDayMs) * 100))
  }

  const dayProgress = getDayProgress()

  if (loading) {
    return (
      <div style={{ maxWidth: '1000px', margin: '0 auto', padding: '24px', color: '#fff', textAlign: 'center' }}>
        Cargando panel en vivo...
      </div>
    )
  }

  return (
    <div style={{ maxWidth: '1000px', margin: '0 auto', position: 'relative', background: '#1a1a1a', color: '#fff', padding: '24px', borderRadius: '12px' }}>
      {/* Large scissors decoration */}
      <svg width="300" height="300" viewBox="0 0 300 300" fill="none" style={{ position: 'absolute', right: '-50px', top: '-50px', opacity: 0.04, pointerEvents: 'none' }}>
        <circle cx="150" cy="150" r="120" stroke="#C8A97E" strokeWidth="2" strokeDasharray="8 8" />
        <circle cx="100" cy="200" r="25" stroke="#C8A97E" strokeWidth="4" />
        <circle cx="200" cy="200" r="25" stroke="#C8A97E" strokeWidth="4" />
        <line x1="100" y1="200" x2="200" y2="100" stroke="#C8A97E" strokeWidth="4" strokeLinecap="round" />
        <line x1="200" y1="200" x2="100" y2="100" stroke="#383838" strokeWidth="4" strokeLinecap="round" />
        <circle cx="100" cy="100" r="25" stroke="#383838" strokeWidth="4" />
        <circle cx="200" cy="100" r="25" stroke="#383838" strokeWidth="4" />
        <line x1="130" y1="150" x2="170" y2="150" stroke="#C8A97E" strokeWidth="3" />
      </svg>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
        <h1 style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: '26px', color: '#fff', margin: 0 }}>Panel en vivo</h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontFamily: 'Space Grotesk, sans-serif', fontWeight: 600, fontSize: '12px', color: '#C8A97E', border: '1px solid #C8A97E', borderRadius: '20px', padding: '4px 12px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>EN VIVO</span>
          <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#C8A97E', animation: 'pulse 1s infinite' }} />
        </div>
      </div>
      <p style={{ color: '#888', fontSize: '14px', marginBottom: '24px' }}>{tenant?.name || 'Tu barbería'} • Monitoreo en tiempo real</p>

      {/* Total card */}
      <div style={{ background: '#242424', border: '1px solid #383838', borderRadius: '12px', padding: '24px', marginBottom: '24px', position: 'relative', overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <h3 style={{ fontFamily: 'Space Grotesk, sans-serif', fontWeight: 500, fontSize: '14px', color: '#888', margin: 0 }}>Total del día</h3>
            <div style={{ fontFamily: 'Space Grotesk, sans-serif', fontWeight: 700, fontSize: 'clamp(28px, 7vw, 42px)', color: '#C8A97E', marginTop: '4px' }}>
              ${totalDay.toLocaleString()}
            </div>
            <div style={{ fontFamily: 'Space Grotesk, sans-serif', fontWeight: 400, fontSize: '14px', color: '#fff', marginTop: '8px' }}>
              Tu parte: <span style={{ fontWeight: 600 }}>${ownerEarning.toLocaleString()}</span>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ width: '60px', height: '60px', borderRadius: '12px', background: '#2a2a2a', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#C8A97E" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontFamily: 'Space Grotesk, sans-serif', fontWeight: 700, fontSize: '18px', color: '#fff' }}>{totalServices}</div>
              <div style={{ fontFamily: 'Space Grotesk, sans-serif', fontWeight: 400, fontSize: '12px', color: '#888' }}>servicios</div>
            </div>
          </div>
        </div>
        <div style={{ height: '4px', background: '#383838', marginTop: '20px', borderRadius: '2px', overflow: 'hidden' }}>
          <div style={{ width: `${dayProgress}%`, height: '100%', background: '#C8A97E', borderRadius: '2px', transition: 'width 0.5s ease' }} />
        </div>
        <div style={{ fontFamily: 'Space Grotesk, sans-serif', fontWeight: 400, fontSize: '12px', color: '#888', marginTop: '8px', textAlign: 'right' }}>
          {dayProgress}% del día transcurrido
        </div>
      </div>

      {/* Barbers list */}
      <div style={{ background: '#2a2a2a', border: '1px solid #383838', borderRadius: '12px', padding: '24px' }}>
        <h2 style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: '18px', color: '#fff', margin: '0 0 20px 0' }}>Barberos</h2>

        {barberStats.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px', color: '#888' }}>
            <p style={{ fontSize: '16px', marginBottom: '8px' }}>No hay barberos</p>
            <p style={{ fontSize: '14px' }}>Agrega barberos en la configuración</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {barberStats.map((stats) => (
              <div
                key={stats.barber.id}
                className="mobile-padding"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '16px',
                  background: '#383838',
                  borderRadius: '8px',
                  border: `1px solid ${stats.highlight ? '#C8A97E' : '#484848'}`,
                  transition: 'border-color 0.3s ease',
                  boxShadow: stats.highlight ? '0 0 12px rgba(200, 169, 126, 0.4)' : 'none'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                  <div style={{
                    width: '44px',
                    height: '44px',
                    borderRadius: '10px',
                    background: 'linear-gradient(135deg, #C8A97E, #8B6200)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontFamily: 'Syne, sans-serif',
                    fontWeight: 700,
                    fontSize: '16px',
                    color: '#080808'
                  }}>
                    {stats.barber.display_name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                  </div>
                  <div>
                    <div style={{ fontFamily: 'Space Grotesk, sans-serif', fontWeight: 600, fontSize: '15px', color: '#fff' }}>
                      {stats.barber.display_name}
                      {stats.isActive && (
                        <span style={{ marginLeft: '8px', width: '8px', height: '8px', borderRadius: '50%', background: '#10B981', display: 'inline-block' }} />
                      )}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '4px' }}>
                      <span style={{ fontFamily: 'Space Grotesk, sans-serif', fontWeight: 400, fontSize: '12px', color: '#888' }}>
                        {stats.servicesCount} servicio{stats.servicesCount !== 1 ? 's' : ''}
                      </span>
                      <span style={{ width: '4px', height: '4px', borderRadius: '50%', background: '#888' }} />
                      <span style={{ fontFamily: 'Space Grotesk, sans-serif', fontWeight: 400, fontSize: '12px', color: '#888' }}>
                        ${stats.totalGenerated.toLocaleString()}
                      </span>
                    </div>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontFamily: 'Space Grotesk, sans-serif', fontWeight: 700, fontSize: '18px', color: '#C8A97E' }}>
                      ${stats.ownerCommission.toLocaleString()}
                    </div>
                    <div style={{ fontFamily: 'Space Grotesk, sans-serif', fontWeight: 400, fontSize: '11px', color: '#888', letterSpacing: '0.5px' }}>COMISIÓN</div>
                  </div>
                  <div style={{
                    width: '10px',
                    height: '10px',
                    borderRadius: '50%',
                    background: stats.isActive ? '#C8A97E' : '#888',
                    opacity: stats.isActive ? 1 : 0.5,
                    animation: stats.isActive ? 'pulse 2s infinite' : 'none'
                  }} />
                </div>
              </div>
            ))}
          </div>
        )}

        {logs.length === 0 && barberStats.length > 0 && (
          <div style={{ marginTop: '20px', paddingTop: '20px', borderTop: '1px solid #383838', color: '#888', fontSize: '12px', textAlign: 'center' }}>
            <p>Esperando el primer servicio del día...</p>
          </div>
        )}

        {logs.length > 0 && (
          <div style={{ marginTop: '20px', paddingTop: '20px', borderTop: '1px solid #383838', color: '#888', fontSize: '12px', textAlign: 'center' }}>
            <p>Actualizado en tiempo real • Último servicio: {new Date(logs[0].started_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
          </div>
        )}
      </div>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
      `}</style>
    </div>
  )
}