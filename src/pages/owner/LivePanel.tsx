import { useEffect, useState, useCallback, useRef } from 'react'
import { useTenantStore } from '../../stores/tenantStore'
import { supabase } from '../../config/supabase'
import { useServiceLogsRealtime } from '../../hooks/useRealtime'
import { ExpandableBarberCard } from '../../components/owner/ExpandableBarberCard'
import type { ServiceLog, Profile, DailyExpense } from '../../types'

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

function getTargetArgentinaDate(): string {
  const now = new Date()
  const argHour = parseInt(now.toLocaleString('en-US', {
    hour: 'numeric', hour12: false,
    timeZone: 'America/Argentina/Buenos_Aires'
  }))
  const target = new Date(now)
  if (argHour >= 0 && argHour < 6) {
    target.setDate(target.getDate() - 1)
  }
  return target.toLocaleDateString('en-CA', {
    timeZone: 'America/Argentina/Buenos_Aires'
  })
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
  const [showPaymentBreakdown, setShowPaymentBreakdown] = useState(false)
  const [expenses, setExpenses] = useState<DailyExpense[]>([])
  const [showExpenseModal, setShowExpenseModal] = useState(false)
  const [expenseForm, setExpenseForm] = useState({ description: '', amount: '' })
  const [savingExpense, setSavingExpense] = useState(false)
  const [isSmallMobile, setIsSmallMobile] = useState(window.innerWidth <= 480)
  const isMounted = useRef(true)

  useEffect(() => {
    const handler = () => setIsSmallMobile(window.innerWidth <= 480)
    window.addEventListener('resize', handler)
    return () => window.removeEventListener('resize', handler)
  }, [])

  // Calculate totals
  const totalDay = logs.reduce((sum, log) => sum + log.price_charged, 0)
  const ownerEarning = logs.reduce((sum, log) => sum + log.owner_earning, 0)
  const totalServices = logs.length
  const efectivoTotal = logs
    .filter(log => (log.payment_method || 'efectivo') === 'efectivo')
    .reduce((sum, log) => sum + log.price_charged, 0)
  const transferenciaTotal = logs
    .filter(log => log.payment_method === 'transferencia')
    .reduce((sum, log) => sum + log.price_charged, 0)

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

  const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0)
  const totalBarberEarningsExTips = logs.reduce((sum, log) => sum + log.barber_earning - (log.tip_amount ?? 0), 0)

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
      // Use target date: if 00:00-05:59 Argentina, use yesterday for post-midnight closing
      const now = new Date()
      const argHour = parseInt(now.toLocaleString('en-US', {
        hour: 'numeric', hour12: false,
        timeZone: 'America/Argentina/Buenos_Aires'
      }))
      const targetDateObj = new Date(now)
      if (argHour >= 0 && argHour < 6) targetDateObj.setDate(targetDateObj.getDate() - 1)
      const targetArgentina = getArgentinaDateString(targetDateObj)
      if (isMounted.current) {
        setCurrentDate(targetArgentina)
      }
      const { startUTC, endUTC } = getArgentinaDayRangeUTC(targetDateObj)
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

      const { data: expensesData } = await supabase
        .from('daily_expenses')
        .select('*')
        .eq('tenant_id', tenantId)
        .eq('expense_date', targetArgentina)
        .order('created_at', { ascending: true })
      if (isMounted.current) {
        setExpenses(expensesData || [])
      }
    } catch (error) {
      console.error('Error loading initial data:', error)
    } finally {
      if (isMounted.current) {
        setLoading(false)
      }
    }
  }, [tenantId])

  const handleAddExpense = async () => {
    if (!tenantId || !profile) return
    const amount = parseFloat(expenseForm.amount)
    if (!expenseForm.description.trim() || isNaN(amount) || amount <= 0) return
    setSavingExpense(true)
    try {
      const argToday = getTargetArgentinaDate()
      const { data, error } = await supabase
        .from('daily_expenses')
        .insert({
          tenant_id: tenantId,
          owner_id: profile.id,
          amount,
          description: expenseForm.description.trim(),
          expense_date: argToday
        })
        .select()
        .single()
      if (error) throw error
      if (isMounted.current) {
        setExpenses(prev => [...prev, data])
        setExpenseForm({ description: '', amount: '' })
        setShowExpenseModal(false)
      }
    } catch (err) {
      console.error('Error saving expense:', err)
    } finally {
      if (isMounted.current) setSavingExpense(false)
    }
  }

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

  const isPostMidnight = (() => {
    const h = parseInt(new Date().toLocaleString('en-US', {
      hour: 'numeric', hour12: false,
      timeZone: 'America/Argentina/Buenos_Aires'
    }))
    return h >= 0 && h < 6
  })()

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: '#F8FAFC', padding: '24px' }}>
        <div style={{ maxWidth: '1180px', margin: '0 auto' }}>
          <div style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '32px', padding: '32px', boxShadow: '0 24px 70px rgba(15,23,42,0.08)' }}>
            <div style={{ width: '160px', height: '16px', borderRadius: '999px', background: '#E2E8F0', marginBottom: '18px', animation: 'pulse 1.4s infinite' }} />
            <div style={{ width: '280px', maxWidth: '80%', height: '44px', borderRadius: '18px', background: '#E2E8F0', marginBottom: '18px', animation: 'pulse 1.4s infinite' }} />
            <div style={{ width: '70%', height: '14px', borderRadius: '999px', background: '#E2E8F0', animation: 'pulse 1.4s infinite' }} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: isSmallMobile ? '1fr' : 'repeat(3, 1fr)', gap: '16px', marginTop: '18px' }}>
            {[1, 2, 3].map(item => (
              <div key={item} style={{ height: '132px', borderRadius: '28px', background: '#FFFFFF', border: '1px solid #E2E8F0', boxShadow: '0 18px 45px rgba(15,23,42,0.06)', animation: 'pulse 1.4s infinite' }} />
            ))}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: '#F8FAFC', color: '#0F172A', padding: isSmallMobile ? '12px' : '24px' }}>
      <div style={{ maxWidth: '1180px', margin: '0 auto', position: 'relative' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap', marginBottom: '22px' }}>
        <div>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', color: '#2563EB', background: '#EFF6FF', border: '1px solid #DBEAFE', borderRadius: '999px', padding: '8px 12px', fontSize: '12px', fontWeight: 700, marginBottom: '12px' }}>
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#10B981', boxShadow: '0 0 0 5px rgba(16,185,129,0.12)' }} />
            Jornada activa
          </div>
          <h1 style={{ fontFamily: 'Syne, sans-serif', fontWeight: 800, fontSize: isSmallMobile ? '28px' : '38px', color: '#0F172A', margin: 0, letterSpacing: '0' }}>Buen día</h1>
          <p style={{ color: '#64748B', fontSize: '15px', margin: '6px 0 0 0', fontWeight: 500 }}>{tenant?.name || 'Tu barbería'} · Datos actualizados en tiempo real</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          {isPostMidnight && (
            <button
              onClick={() => window.location.reload()}
              style={{ background: '#2563EB', color: '#fff', border: 'none', borderRadius: '999px', padding: '12px 18px', fontSize: '13px', fontFamily: 'Space Grotesk, sans-serif', fontWeight: 700, cursor: 'pointer', boxShadow: '0 14px 30px rgba(37,99,235,0.24)' }}
            >
              Iniciar nuevo día
            </button>
          )}
          <span style={{ background: '#ECFDF5', color: '#047857', border: '1px solid #A7F3D0', fontSize: '12px', padding: '9px 13px', borderRadius: '999px', fontWeight: 800, display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#10B981' }} />
            EN VIVO
          </span>
        </div>
      </div>

      {/* Hero */}
      <div style={{ background: 'linear-gradient(135deg, #FFFFFF 0%, #F0F9FF 52%, #ECFDF5 100%)', border: '1px solid #DCEBFA', borderRadius: '32px', padding: isSmallMobile ? '24px' : '34px', boxShadow: '0 30px 80px rgba(15,23,42,0.09)', marginBottom: '18px', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', right: '-70px', top: '-80px', width: '220px', height: '220px', borderRadius: '50%', background: 'rgba(6,182,212,0.16)' }} />
        <div style={{ position: 'absolute', right: '70px', bottom: '-110px', width: '220px', height: '220px', borderRadius: '50%', background: 'rgba(37,99,235,0.12)' }} />
        <div style={{ position: 'relative', display: 'grid', gridTemplateColumns: isSmallMobile ? '1fr' : 'minmax(0, 1.45fr) minmax(260px, 0.8fr)', gap: '24px', alignItems: 'end' }}>
          <div>
            <div style={{ color: '#2563EB', fontSize: '12px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '12px' }}>Resumen del día</div>
            <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 800, fontSize: isSmallMobile ? '40px' : '58px', lineHeight: 1, color: '#0F172A', letterSpacing: '0' }}>${totalDay.toLocaleString()}</div>
            <p style={{ color: '#475569', fontSize: '15px', lineHeight: 1.6, maxWidth: '520px', margin: '14px 0 0' }}>
              Información generada con datos reales del negocio. Seguimiento activo de la jornada.
            </p>
          </div>
          <div style={{ background: 'rgba(255,255,255,0.78)', border: '1px solid rgba(226,232,240,0.9)', borderRadius: '28px', padding: '18px', boxShadow: '0 18px 45px rgba(15,23,42,0.08)', backdropFilter: 'blur(14px)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '14px', marginBottom: '14px' }}>
              <div>
                <div style={{ color: '#64748B', fontSize: '12px', fontWeight: 700 }}>Ganancia dueño</div>
                <div style={{ color: '#10B981', fontSize: '26px', fontWeight: 800 }}>${ownerEarning.toLocaleString()}</div>
              </div>
              <div style={{ width: '46px', height: '46px', borderRadius: '16px', background: '#ECFDF5', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#10B981' }}>
                <svg width="23" height="23" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v18M17 7.5c-.9-1-2.2-1.5-3.8-1.5-2.1 0-3.7 1-3.7 2.7 0 3.7 8 1.8 8 5.8 0 1.8-1.7 3-4.1 3-1.8 0-3.4-.6-4.4-1.8" />
                </svg>
              </div>
            </div>
            <div style={{ height: '10px', borderRadius: '999px', background: '#E2E8F0', overflow: 'hidden' }}>
              <div style={{ width: `${dayProgress}%`, height: '100%', background: 'linear-gradient(90deg, #2563EB, #06B6D4, #10B981)', borderRadius: '999px', transition: 'width 0.5s ease' }} />
            </div>
            <div style={{ color: '#64748B', fontSize: '12px', fontWeight: 600, marginTop: '9px' }}>{statusText}</div>
          </div>
        </div>
      </div>

      {/* Stats row */}
      <div style={{ display: 'grid', gridTemplateColumns: isSmallMobile ? '1fr' : 'repeat(5, minmax(0, 1fr))', gap: '14px', marginBottom: '18px' }}>
        {[
          { label: 'Servicios hoy', value: totalServices, color: '#2563EB', bg: '#EFF6FF' },
          { label: 'Ganancias hoy', value: `$${ownerEarning.toLocaleString()}`, color: '#10B981', bg: '#ECFDF5' },
          { label: 'Barbería', value: `$${totalDay.toLocaleString()}`, color: '#06B6D4', bg: '#ECFEFF' },
          { label: 'Barberos activos', value: barberStats.filter(stats => stats.isActive).length, color: '#F59E0B', bg: '#FFFBEB' },
          { label: 'Ticket promedio', value: totalServices > 0 ? `$${Math.round(totalDay / totalServices).toLocaleString()}` : '$0', color: '#2563EB', bg: '#EFF6FF' },
        ].map(card => (
          <div key={card.label} style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '28px', padding: '18px', boxShadow: '0 18px 45px rgba(15,23,42,0.06)', minHeight: '132px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
            <div style={{ width: '42px', height: '42px', borderRadius: '16px', background: card.bg, color: card.color, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: `0 10px 24px ${card.color}22` }}>
              <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 17l6-6 4 4 6-8" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 7h5v5" />
              </svg>
            </div>
            <div>
              <div style={{ fontSize: '12px', color: '#64748B', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '6px' }}>{card.label}</div>
              <div style={{ fontFamily: 'Syne, sans-serif', fontSize: '24px', lineHeight: 1.05, color: '#0F172A', fontWeight: 800 }}>{card.value}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Barbers list */}
      <div style={{ background: '#FFFFFF', borderRadius: '32px', padding: isSmallMobile ? '18px' : '24px', border: '1px solid #E2E8F0', marginBottom: '18px', boxShadow: '0 24px 70px rgba(15,23,42,0.07)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '16px', alignItems: 'flex-start', marginBottom: '18px', flexWrap: 'wrap' }}>
          <div>
            <h2 style={{ fontFamily: 'Syne, sans-serif', fontWeight: 800, fontSize: '21px', color: '#0F172A', margin: 0 }}>Equipo en vivo</h2>
            <p style={{ color: '#64748B', fontSize: '13px', margin: '5px 0 0', fontWeight: 600 }}>Servicios del día por barbero</p>
          </div>
          <button
            onClick={() => setShowPaymentBreakdown(prev => !prev)}
            style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', color: '#2563EB', borderRadius: '999px', padding: '10px 14px', fontSize: '12px', fontWeight: 800, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '7px' }}
          >
            Medios de pago
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path strokeLinecap="round" strokeLinejoin="round" d={showPaymentBreakdown ? 'M18 15l-6-6-6 6' : 'M6 9l6 6 6-6'} />
            </svg>
          </button>
        </div>

        {showPaymentBreakdown && (
          <div style={{ display: 'grid', gridTemplateColumns: isSmallMobile ? '1fr' : '1fr 1fr', gap: '10px', marginBottom: '16px' }}>
            <div style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '22px', padding: '14px' }}>
              <div style={{ color: '#64748B', fontSize: '12px', fontWeight: 700 }}>Efectivo</div>
              <div style={{ color: '#0F172A', fontSize: '20px', fontWeight: 800 }}>${efectivoTotal.toLocaleString()}</div>
            </div>
            <div style={{ background: '#ECFEFF', border: '1px solid #CFFAFE', borderRadius: '22px', padding: '14px' }}>
              <div style={{ color: '#0E7490', fontSize: '12px', fontWeight: 700 }}>Transferencia</div>
              <div style={{ color: '#0F172A', fontSize: '20px', fontWeight: 800 }}>${transferenciaTotal.toLocaleString()}</div>
            </div>
          </div>
        )}

        {barberStats.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '54px 20px', color: '#64748B', border: '1px dashed #CBD5E1', borderRadius: '28px', background: '#F8FAFC' }}>
            <p style={{ fontSize: '17px', color: '#0F172A', fontWeight: 800, margin: '0 0 6px' }}>No hay barberos</p>
            <p style={{ fontSize: '14px', margin: 0 }}>Agrega barberos en la configuración</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {barberStats.map((stats) => (
              <ExpandableBarberCard key={stats.barber.id} stats={stats} />
            ))}
          </div>
        )}

        {logs.length === 0 && barberStats.length > 0 && (
          <div style={{ marginTop: '18px', padding: '16px', borderRadius: '22px', background: '#F8FAFC', border: '1px solid #E2E8F0', color: '#64748B', fontSize: '13px', textAlign: 'center', fontWeight: 700 }}>
            Esperando el primer servicio del día...
          </div>
        )}

        {logs.length > 0 && (
          <div style={{ marginTop: '18px', padding: '16px', borderRadius: '22px', background: '#ECFDF5', border: '1px solid #A7F3D0', color: '#047857', fontSize: '13px', textAlign: 'center', fontWeight: 800 }}>
            Actualizado en tiempo real · Último servicio: {new Date(logs[0].started_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </div>
        )}
      </div>

      {/* Expenses section */}
      <div style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '32px', padding: isSmallMobile ? '18px' : '22px', marginBottom: '18px', boxShadow: '0 24px 70px rgba(15,23,42,0.07)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '14px', marginBottom: expenses.length > 0 ? '16px' : '0', flexWrap: 'wrap' }}>
          <div>
            <h2 style={{ fontFamily: 'Syne, sans-serif', fontWeight: 800, fontSize: '19px', color: '#0F172A', margin: 0 }}>Gastos del día</h2>
            <p style={{ color: '#64748B', fontSize: '12px', margin: '4px 0 0', fontWeight: 600 }}>Insumos y gastos operativos</p>
          </div>
          <button
            onClick={() => setShowExpenseModal(true)}
            style={{ background: '#2563EB', color: '#fff', border: 'none', borderRadius: '999px', padding: '11px 15px', fontSize: '12px', fontWeight: 800, cursor: 'pointer', boxShadow: '0 14px 30px rgba(37,99,235,0.22)', whiteSpace: 'nowrap' }}
          >
            Agregar gasto
          </button>
        </div>
        {expenses.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {expenses.map(expense => (
              <div key={expense.id} style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', fontSize: '14px', background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '18px', padding: '11px 12px' }}>
                <span style={{ color: '#334155', fontWeight: 700 }}>{expense.description}</span>
                <span style={{ color: '#F59E0B', fontWeight: 900 }}>-${expense.amount.toLocaleString()}</span>
              </div>
            ))}
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '15px', fontWeight: 900, borderTop: '1px solid #E2E8F0', paddingTop: '12px', marginTop: '4px' }}>
              <span style={{ color: '#0F172A' }}>Total gastos</span>
              <span style={{ color: '#F59E0B' }}>-${totalExpenses.toLocaleString()}</span>
            </div>
          </div>
        ) : (
          <div style={{ marginTop: '16px', border: '1px dashed #CBD5E1', background: '#F8FAFC', color: '#64748B', borderRadius: '22px', padding: '20px', fontSize: '13px', fontWeight: 700, textAlign: 'center' }}>
            Sin gastos cargados para esta jornada
          </div>
        )}
      </div>

      {/* Settlement summary */}
      {barberStats.length > 0 && logs.length > 0 && (
        <div style={{ background: '#FFFFFF', border: '1px solid #DCEBFA', borderRadius: '32px', padding: isSmallMobile ? '18px' : '22px', boxShadow: '0 24px 70px rgba(15,23,42,0.08)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
            <div style={{ width: '44px', height: '44px', borderRadius: '16px', background: '#EFF6FF', color: '#2563EB', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 8h12M6 12h12M6 16h8M5 4h14a1 1 0 0 1 1 1v14l-3-2-3 2-3-2-3 2-3-2-3 2V5a1 1 0 0 1 1-1Z" />
              </svg>
            </div>
            <div>
              <h2 style={{ fontFamily: 'Syne, sans-serif', fontWeight: 800, fontSize: '19px', color: '#0F172A', margin: 0 }}>Liquidación del día</h2>
              <p style={{ color: '#64748B', fontSize: '12px', margin: '4px 0 0', fontWeight: 600 }}>Resumen para cierre de caja</p>
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', padding: '12px 0', borderBottom: '1px solid #E2E8F0' }}>
              <span style={{ fontSize: '13px', color: '#64748B', fontWeight: 800 }}>Total Barbería</span>
              <span style={{ fontSize: '15px', fontWeight: 900, color: '#0F172A' }}>${totalDay.toLocaleString()}</span>
            </div>
            {barberStats.map((stats) => (
              <div key={stats.barber.id} style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', paddingBottom: '10px', borderBottom: '1px solid #F1F5F9' }}>
                <span style={{ fontSize: '13px', color: '#64748B', fontWeight: 700 }}>{stats.barber.display_name}</span>
                <span style={{ fontSize: '14px', fontWeight: 800, color: '#0F172A' }}>${stats.barberEarnings.toLocaleString()}</span>
              </div>
            ))}
            {totalExpenses > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', paddingBottom: '10px' }}>
                <span style={{ fontSize: '13px', color: '#64748B', fontWeight: 700 }}>Insumos del día</span>
                <span style={{ fontSize: '14px', fontWeight: 900, color: '#F59E0B' }}>-${totalExpenses.toLocaleString()}</span>
              </div>
            )}
            <div style={{ borderTop: '1px solid #DCEBFA', paddingTop: '14px', marginTop: '4px', display: 'flex', justifyContent: 'space-between', gap: '12px', alignItems: 'baseline', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '14px', color: '#0F172A', fontWeight: 900 }}>Ganancia real del dueño</span>
              <span style={{ fontSize: '23px', fontWeight: 900, color: '#10B981', fontFamily: 'Syne, sans-serif' }}>${(totalDay - totalBarberEarningsExTips - totalExpenses).toLocaleString()}</span>
            </div>
          </div>
        </div>
      )}

      {/* Expense modal */}
      {showExpenseModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: '18px', backdropFilter: 'blur(10px)' }}>
          <div style={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: '32px', padding: '28px', maxWidth: '430px', width: '100%', color: '#0F172A', boxShadow: '0 30px 90px rgba(15,23,42,0.18)' }}>
            <h3 style={{ fontFamily: 'Syne, sans-serif', fontWeight: 800, fontSize: '22px', color: '#0F172A', margin: '0 0 8px 0' }}>Agregar gasto</h3>
            <p style={{ color: '#64748B', fontSize: '13px', fontWeight: 600, margin: '0 0 22px' }}>Registrá un gasto real de la jornada.</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginBottom: '24px' }}>
              <input
                type="text"
                placeholder="Ej: Shampoo, toallas, etc."
                value={expenseForm.description}
                onChange={e => setExpenseForm(prev => ({ ...prev, description: e.target.value }))}
                style={{ border: '1px solid #E2E8F0', borderRadius: '18px', padding: '14px 16px', fontSize: '14px', outline: 'none', backgroundColor: '#F8FAFC', color: '#0F172A', width: '100%', boxSizing: 'border-box', fontWeight: 600 }}
              />
              <input
                type="number"
                placeholder="0"
                value={expenseForm.amount}
                onChange={e => setExpenseForm(prev => ({ ...prev, amount: e.target.value }))}
                style={{ border: '1px solid #E2E8F0', borderRadius: '18px', padding: '14px 16px', fontSize: '14px', outline: 'none', backgroundColor: '#F8FAFC', color: '#0F172A', width: '100%', boxSizing: 'border-box', fontWeight: 600 }}
              />
            </div>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button
                onClick={() => { setShowExpenseModal(false); setExpenseForm({ description: '', amount: '' }) }}
                style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '999px', padding: '11px 18px', fontSize: '14px', cursor: 'pointer', color: '#64748B', fontWeight: 800 }}
              >
                Cancelar
              </button>
              <button
                onClick={handleAddExpense}
                disabled={savingExpense}
                style={{ background: '#2563EB', color: '#fff', border: 'none', borderRadius: '999px', padding: '11px 20px', fontSize: '14px', cursor: savingExpense ? 'not-allowed' : 'pointer', opacity: savingExpense ? 0.7 : 1, fontWeight: 900, boxShadow: '0 14px 30px rgba(37,99,235,0.22)' }}
              >
                {savingExpense ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
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
    </div>
  )
}
