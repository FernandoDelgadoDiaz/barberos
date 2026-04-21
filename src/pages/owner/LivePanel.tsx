import { useEffect, useState, useCallback, useRef } from 'react'
import { useTenantStore } from '../../stores/tenantStore'
import { supabase } from '../../config/supabase'
import { useServiceLogsRealtime } from '../../hooks/useRealtime'
import { ExpandableBarberCard } from '../../components/owner/ExpandableBarberCard'
import type { ServiceLog, Profile } from '../../types'

function getArgentinaDateString(date = new Date()): string {
  return date.toLocaleDateString('en-CA', { timeZone: 'America/Argentina/Buenos_Aires' })
}

function getArgentinaDayRangeUTC(date = new Date()): { startUTC: string; endUTC: string } {
  // Argentina is UTC-3 (no DST since 2009)
  const argDate = getArgentinaDateString(date)
  // Start of day Argentina is 03:00 UTC of the same date
  const startUTC = `${argDate}T03:00:00Z`
  // End of day Argentina is 02:59:59.999Z of the next day
  const nextDay = new Date(date)
  nextDay.setDate(nextDay.getDate() + 1)
  const argNextDate = getArgentinaDateString(nextDay)
  const endUTC = `${argNextDate}T02:59:59.999Z`
  return { startUTC, endUTC }
}


type ServiceLogSupabaseResponse = ServiceLog & {
  profiles: { display_name: string }
  appointments?: {
    total_price: number
    total_barber_earning: number
    total_owner_earning: number
  }
}

// Extended type with appointment details for commission breakdown
export type ServiceLogWithDetails = ServiceLog & {
  barber_name: string
  appointment_total_price?: number
  appointment_total_barber_earning?: number
  appointment_total_owner_earning?: number
  service_name?: string
}

// Grouped appointments with their services
export type AppointmentWithServices = {
  appointment_id: string
  barber_id: string
  started_at: string
  total_price: number
  total_barber_earning: number
  total_owner_earning: number
  services: ServiceLogWithDetails[]
}

export type BarberStats = {
  barber: Profile
  servicesCount: number
  totalGenerated: number
  ownerCommission: number
  lastServiceAt: string | null
  isActive: boolean
  highlight: boolean
  appointments: AppointmentWithServices[]
  barberEarnings: number // Total earnings for the barber (sum of barber_earning)
}

export function LivePanel() {
  const { tenant, profile } = useTenantStore()
  const tenantId = tenant?.id || profile?.tenant_id

  const [logs, setLogs] = useState<ServiceLogWithDetails[]>([])
  const [barbers, setBarbers] = useState<Profile[]>([])
  const [loading, setLoading] = useState(true)
  const [highlightBarberId, setHighlightBarberId] = useState<string | null>(null)
  const [currentDate, setCurrentDate] = useState<string>('')
  const isMounted = useRef(true)

  // Calculate totals
  const totalDay = logs.reduce((sum, log) => sum + log.price_charged, 0)
  const ownerEarning = logs.reduce((sum, log) => sum + log.owner_earning, 0)
  const totalServices = logs.length

  // Calculate barber stats with appointments grouping
  const barberStats: BarberStats[] = barbers.map(barber => {
    const barberLogs = logs.filter(log => log.barber_id === barber.id)
    const servicesCount = barberLogs.length
    const totalGenerated = barberLogs.reduce((sum, log) => sum + log.price_charged, 0)
    const ownerCommission = barberLogs.reduce((sum, log) => sum + log.owner_earning, 0)
    const barberEarnings = barberLogs.reduce((sum, log) => sum + log.barber_earning, 0)
    const lastServiceAt = barberLogs.length > 0
      ? barberLogs[barberLogs.length - 1].started_at
      : null
    const isActive = lastServiceAt
      ? (Date.now() - new Date(lastServiceAt).getTime()) < 60 * 60 * 1000 // within last hour
      : false

    // Group logs by appointment_id
    const appointmentsMap = new Map<string, AppointmentWithServices>()
    barberLogs.forEach(log => {
      if (!log.appointment_id) return

      if (!appointmentsMap.has(log.appointment_id)) {
        appointmentsMap.set(log.appointment_id, {
          appointment_id: log.appointment_id,
          barber_id: log.barber_id,
          started_at: log.started_at,
          total_price: log.appointment_total_price || 0,
          total_barber_earning: log.appointment_total_barber_earning || 0,
          total_owner_earning: log.appointment_total_owner_earning || 0,
          services: []
        })
      }

      const appointment = appointmentsMap.get(log.appointment_id)!
      appointment.services.push(log)
    })

    // Convert map to array and sort by started_at (newest first)
    const appointments = Array.from(appointmentsMap.values())
      .sort((a, b) => new Date(b.started_at).getTime() - new Date(a.started_at).getTime())

    return {
      barber,
      servicesCount,
      totalGenerated,
      ownerCommission,
      barberEarnings,
      lastServiceAt,
      isActive,
      highlight: highlightBarberId === barber.id,
      appointments
    }
  })

  // Load today's logs and active barbers
  const loadInitialData = useCallback(async () => {
    if (!tenantId) {
      if (isMounted.current) {
        setLoading(false)
      }
      return
    }

    if (isMounted.current) {
      setLoading(true)
    }

    try {
      // Load today's service logs with barber names
      const todayArgentina = getArgentinaDateString()
      if (isMounted.current) {
        setCurrentDate(todayArgentina)
      }
      const { startUTC, endUTC } = getArgentinaDayRangeUTC()
      const { data: logsData, error: logsError } = await supabase
        .from('service_logs')
        .select(`
          *,
          profiles!inner(display_name),
          appointments!inner(total_price, total_barber_earning, total_owner_earning)
        `)
        .eq('tenant_id', tenantId)
        .gte('started_at', startUTC)
        .lte('started_at', endUTC)
        .order('started_at', { ascending: false })

      if (logsError) throw logsError

      const logsWithDetails: ServiceLogWithDetails[] = (logsData || []).map((log: ServiceLogSupabaseResponse) => ({
        ...log,
        barber_name: log.profiles.display_name,
        appointment_total_price: log.appointments?.total_price,
        appointment_total_barber_earning: log.appointments?.total_barber_earning,
        appointment_total_owner_earning: log.appointments?.total_owner_earning
      }))
      if (isMounted.current) {
        setLogs(logsWithDetails)
      }

      // Load all barbers for this tenant (no is_active filter)
      const { data: barbersData, error: barbersError } = await supabase
        .from('profiles')
        .select('*')
        .eq('tenant_id', tenantId)
        .eq('role', 'barber')
        .order('display_name')

      if (barbersError) throw barbersError
      if (isMounted.current) {
        setBarbers(barbersData || [])
      }
    } catch (error) {
      console.error('Error loading initial data:', error)
    } finally {
      if (isMounted.current) {
        setLoading(false)
      }
    }
  }, [tenantId])

  useEffect(() => {
    isMounted.current = true
    if (!tenantId) {
      // Retry after 500ms in case store is still hydrating
      const retryId = setTimeout(() => {
        if (isMounted.current) loadInitialData()
      }, 500)
      return () => {
        clearTimeout(retryId)
        isMounted.current = false
      }
    }
    const loadDataWithTimeout = async () => {
      const timeoutId = setTimeout(() => {
        if (isMounted.current) {
          console.warn('LivePanel loading timeout, forcing display')
          setLoading(false)
        }
      }, 5000)
      try {
        await loadInitialData()
      } finally {
        if (isMounted.current) clearTimeout(timeoutId)
      }
    }
    loadDataWithTimeout()
    return () => { isMounted.current = false }
  }, [loadInitialData, tenantId])

  // Reset data when day changes
  useEffect(() => {
    if (!tenantId) return

    const checkDateChange = () => {
      const todayArgentina = getArgentinaDateString()
      if (currentDate && currentDate !== todayArgentina) {
        console.log('Day changed, reloading data')
        loadInitialData()
      }
    }

    // Check every minute
    const intervalId = setInterval(checkDateChange, 60000)
    return () => clearInterval(intervalId)
  }, [tenantId, currentDate, loadInitialData])

  // Handle new logs from realtime subscription
  const handleNewLog = useCallback(async (newLog: ServiceLog) => {
    // Fetch barber name and appointment details for the new log
    const [{ data: barberData }, { data: appointmentData }] = await Promise.all([
      supabase
        .from('profiles')
        .select('display_name')
        .eq('id', newLog.barber_id)
        .single(),
      newLog.appointment_id
        ? supabase
            .from('appointments')
            .select('total_price, total_barber_earning, total_owner_earning')
            .eq('id', newLog.appointment_id)
            .single()
        : Promise.resolve({ data: null })
    ])

    const logWithDetails: ServiceLogWithDetails = {
      ...newLog,
      barber_name: barberData?.display_name || 'Barbero',
      appointment_total_price: appointmentData?.total_price,
      appointment_total_barber_earning: appointmentData?.total_barber_earning,
      appointment_total_owner_earning: appointmentData?.total_owner_earning
    }

    setLogs(prev => [logWithDetails, ...prev])

    // Highlight the barber for 2 seconds
    setHighlightBarberId(newLog.barber_id)
    setTimeout(() => setHighlightBarberId(null), 2000)
  }, [])

  // Subscribe to realtime updates
  useServiceLogsRealtime(tenantId || '', handleNewLog)

  // Parse time string "HH:MM" to minutes since midnight
  const parseTimeToMinutes = (timeStr: string) => {
    const [hours, minutes] = timeStr.split(':').map(Number)
    return hours * 60 + minutes
  }

  // Progress bar calculation based on business hours
  const getBusinessHoursProgress = () => {
    const opening = parseTimeToMinutes(tenant?.opening_time || '09:00')
    const closing = parseTimeToMinutes(tenant?.closing_time || '21:00')
    const now = new Date()
    const currentHour = now.getHours()
    const currentMinute = now.getMinutes()
    const nowMinutes = currentHour * 60 + currentMinute

    if (nowMinutes < opening) {
      return { progress: 0, statusText: 'El local aún no abrió' }
    }
    if (nowMinutes > closing) {
      return { progress: 100, statusText: 'El local cerró' }
    }
    const progress = ((nowMinutes - opening) / (closing - opening)) * 100
    return { progress, statusText: `${Math.round(progress)}% del día laboral transcurrido` }
  }

  const { progress: dayProgress, statusText } = getBusinessHoursProgress()

  if (loading) {
    return (
      <div style={{ maxWidth: '1000px', margin: '0 auto', padding: '24px', color: '#fff', textAlign: 'center' }}>
        Cargando panel en vivo...
      </div>
    )
  }

  return (
    <div style={{ maxWidth: '1000px', margin: '0 auto', position: 'relative', background: 'var(--primary, #1a1a1a)', color: '#fff', padding: '24px', borderRadius: '12px' }}>
      {/* Large scissors decoration */}
      <svg width="300" height="300" viewBox="0 0 300 300" fill="none" style={{ position: 'absolute', right: '-50px', top: '-50px', opacity: 0.04, pointerEvents: 'none' }}>
        <circle cx="150" cy="150" r="120" stroke="var(--secondary, #C8A97E)" strokeWidth="2" strokeDasharray="8 8" />
        <circle cx="100" cy="200" r="25" stroke="var(--secondary, #C8A97E)" strokeWidth="4" />
        <circle cx="200" cy="200" r="25" stroke="var(--secondary, #C8A97E)" strokeWidth="4" />
        <line x1="100" y1="200" x2="200" y2="100" stroke="var(--secondary, #C8A97E)" strokeWidth="4" strokeLinecap="round" />
        <line x1="200" y1="200" x2="100" y2="100" stroke="#383838" strokeWidth="4" strokeLinecap="round" />
        <circle cx="100" cy="100" r="25" stroke="#383838" strokeWidth="4" />
        <circle cx="200" cy="100" r="25" stroke="#383838" strokeWidth="4" />
        <line x1="130" y1="150" x2="170" y2="150" stroke="var(--secondary, #C8A97E)" strokeWidth="3" />
      </svg>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
        <h1 style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: '26px', color: '#fff', margin: 0 }}>Panel en vivo</h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontFamily: 'Space Grotesk, sans-serif', fontWeight: 600, fontSize: '12px', color: 'var(--secondary, #C8A97E)', border: '1px solid var(--secondary, #C8A97E)', borderRadius: '20px', padding: '4px 12px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>EN VIVO</span>
          <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--secondary, #C8A97E)', animation: 'pulse 1s infinite' }} />
        </div>
      </div>
      <p style={{ color: '#888', fontSize: '14px', marginBottom: '24px' }}>{tenant?.name || 'Tu barbería'} • Monitoreo en tiempo real</p>

      {/* Total card */}
      <div style={{ background: '#242424', border: '1px solid #383838', borderRadius: '12px', padding: '24px', marginBottom: '24px', position: 'relative', overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <h3 style={{ fontFamily: 'Space Grotesk, sans-serif', fontWeight: 500, fontSize: '14px', color: '#888', margin: 0 }}>Total del día</h3>
            <div style={{ fontFamily: 'Space Grotesk, sans-serif', fontWeight: 700, fontSize: 'clamp(28px, 7vw, 42px)', color: 'var(--secondary, #C8A97E)', marginTop: '4px' }}>
              ${totalDay.toLocaleString()}
            </div>
            <div style={{ fontFamily: 'Space Grotesk, sans-serif', fontWeight: 400, fontSize: '14px', color: '#fff', marginTop: '8px' }}>
              Tu parte: <span style={{ fontWeight: 600 }}>${ownerEarning.toLocaleString()}</span>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ width: '60px', height: '60px', borderRadius: '12px', background: '#2a2a2a', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--secondary, #C8A97E)" strokeWidth="2">
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
          <div style={{ width: `${dayProgress}%`, height: '100%', background: 'var(--secondary, #C8A97E)', borderRadius: '2px', transition: 'width 0.5s ease' }} />
        </div>
        <div style={{ fontFamily: 'Space Grotesk, sans-serif', fontWeight: 400, fontSize: '12px', color: '#888', marginTop: '8px', textAlign: 'right' }}>
          {statusText}
        </div>
      </div>

      {/* Barbers list */}
      <div style={{ background: '#2a2a2a', border: '1px solid #383838', borderRadius: '12px', padding: '24px' }}>
        <h2 style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: '18px', color: '#fff', margin: '0 0 20px 0' }}>Tu equipo</h2>

        {barberStats.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px', color: '#888' }}>
            <p style={{ fontSize: '16px', marginBottom: '8px' }}>No hay barberos</p>
            <p style={{ fontSize: '14px' }}>Agrega barberos en la configuración</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {barberStats.map((stats) => (
              <ExpandableBarberCard key={stats.barber.id} stats={stats} />
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

      {/* Settlement summary */}
      {barberStats.length > 0 && logs.length > 0 && (
        <div style={{
          marginTop: '24px',
          padding: '20px',
          background: 'rgba(200, 169, 126, 0.05)',
          border: '1px solid rgba(200, 169, 126, 0.2)',
          borderRadius: '12px',
          textAlign: 'center'
        }}>
          <div style={{
            fontFamily: 'Space Grotesk, sans-serif',
            fontWeight: 600,
            fontSize: '13px',
            color: '#C8A97E',
            marginBottom: '8px',
            textTransform: 'uppercase',
            letterSpacing: '0.5px'
          }}>
            Liquidación del día
          </div>
          <div style={{
            fontFamily: 'Space Grotesk, sans-serif',
            fontWeight: 400,
            fontSize: '14px',
            color: '#fff',
            lineHeight: 1.6
          }}>
            Para vos: <span style={{ fontWeight: 700 }}>${ownerEarning.toLocaleString()}</span>
            {barberStats.map((stats) => (
              <span key={stats.barber.id}>
                {' | '}
                {stats.barber.display_name}: <span style={{ fontWeight: 700 }}>${stats.barberEarnings.toLocaleString()}</span>
              </span>
            ))}
          </div>
        </div>
      )}

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
      `}</style>
    </div>
  )
}