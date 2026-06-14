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
  const totalOthers = logs.reduce((sum, log) => sum + (log.others_amount ?? 0), 0)

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

  const formatMoney = (value: number) => `$${value.toLocaleString()}`
  const averageTicket = totalServices > 0 ? Math.round(totalDay / totalServices) : 0
  const activeBarbersCount = barberStats.filter(stats => stats.isActive).length
  const ownerFirstName = profile?.display_name?.split(' ')[0]
  const isBusinessOpen = dayProgress > 0 && dayProgress < 100
  const formattedClosingTime = (() => {
    if (!tenant?.closing_time) return ''
    const [hours, minutes] = tenant.closing_time.split(':').map(Number)
    if (Number.isNaN(hours) || Number.isNaN(minutes)) return tenant.closing_time
    const date = new Date()
    date.setHours(hours, minutes, 0, 0)
    return date.toLocaleTimeString('es-AR', { hour: 'numeric', minute: '2-digit' })
  })()

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: '#F8FAFC', padding: '22px 14px 120px' }}>
        <div style={{ maxWidth: '430px', margin: '0 auto' }}>
          <div style={{ height: '116px', borderRadius: '30px', background: '#FFFFFF', boxShadow: '0 18px 48px rgba(15,23,42,0.08)', border: '1px solid rgba(226,232,240,0.72)' }} />
          <div style={{ height: '214px', borderRadius: '28px', background: 'linear-gradient(135deg, #2563EB, #38BDF8)', marginTop: '22px', boxShadow: '0 20px 48px rgba(37,99,235,0.24)' }} />
        </div>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: '#F8FAFC', color: '#070B1D', padding: isSmallMobile ? '18px 14px 118px' : '24px 18px 118px', fontFamily: 'Space Grotesk, system-ui, sans-serif' }}>
      <div style={{ maxWidth: '430px', margin: '0 auto' }}>
        <header style={{ display: 'grid', gridTemplateColumns: '62px 1fr 52px 52px', gap: '10px', alignItems: 'center', marginBottom: '20px' }}>
          <button type="button" style={{ width: '56px', height: '56px', borderRadius: '18px', border: '1px solid rgba(226,232,240,0.72)', background: '#FFFFFF', boxShadow: '0 16px 34px rgba(15,23,42,0.08)', color: '#0F172A', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 }} aria-label="Menu">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path strokeLinecap="round" d="M4 7h16M4 12h16M4 17h16" /></svg>
          </button>
          <div style={{ minWidth: 0 }}>
            <h1 style={{ margin: 0, color: '#070B1D', fontSize: '24px', lineHeight: 1.05, fontWeight: 900 }}>{tenant?.name || 'La Barbería'} 💈</h1>
            <p style={{ margin: '6px 0 0', color: '#334155', fontSize: '16px', lineHeight: 1.15, fontWeight: 700 }}>
              ¡Buenos días{ownerFirstName ? ', ' : ''}<span style={{ color: '#2563EB' }}>{ownerFirstName || ''}</span>{ownerFirstName ? '! 👋' : '!'}
            </p>
          </div>
          <button type="button" style={{ position: 'relative', width: '48px', height: '48px', borderRadius: '17px', border: '1px solid rgba(226,232,240,0.72)', background: '#FFFFFF', boxShadow: '0 16px 34px rgba(15,23,42,0.08)', color: '#0F172A', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 }} aria-label="Notificaciones">
            <span style={{ position: 'absolute', top: '9px', right: '11px', width: '7px', height: '7px', borderRadius: '50%', background: '#2563EB' }} />
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M18 8a6 6 0 0 0-12 0c0 7-3 6-3 8h18c0-2-3-1-3-8"/><path strokeLinecap="round" d="M10 20h4"/></svg>
          </button>
          <button type="button" style={{ width: '48px', height: '48px', borderRadius: '17px', border: '1px solid rgba(226,232,240,0.72)', background: '#FFFFFF', boxShadow: '0 16px 34px rgba(15,23,42,0.08)', color: '#0F172A', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 }} aria-label="Mensajes">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M21 12a8 8 0 0 1-8 8H7l-4 2 1.3-4A8 8 0 1 1 21 12Z"/><path strokeLinecap="round" d="M8 12h.01M12 12h.01M16 12h.01"/></svg>
          </button>
        </header>

        <section style={{ background: '#FFFFFF', borderRadius: '22px', border: '1px solid rgba(226,232,240,0.76)', boxShadow: '0 16px 42px rgba(15,23,42,0.07)', padding: '13px 14px', display: 'grid', gridTemplateColumns: 'auto 1px 1fr auto', gap: '14px', alignItems: 'center', marginBottom: '18px' }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', background: isBusinessOpen ? '#ECFDF5' : '#F1F5F9', color: isBusinessOpen ? '#16A34A' : '#64748B', borderRadius: '999px', padding: '8px 11px', fontSize: '14px', fontWeight: 900 }}><span style={{ width: '8px', height: '8px', borderRadius: '50%', background: isBusinessOpen ? '#22C55E' : '#94A3B8' }} />{isBusinessOpen ? 'Abierto' : 'Cerrado'}</span>
          <span style={{ width: '1px', height: '28px', background: '#CBD5E1' }} />
          <span style={{ color: '#1E293B', fontSize: '14px', fontWeight: 700 }}>{formattedClosingTime ? `Cierra a las ${formattedClosingTime}` : statusText}</span>
          <span style={{ color: '#2563EB', fontSize: '13px', fontWeight: 900, whiteSpace: 'nowrap' }}>Ver horario</span>
        </section>

        <section style={{ position: 'relative', overflow: 'hidden', borderRadius: '28px', background: 'linear-gradient(135deg, #315CF6 0%, #2563EB 48%, #56C6F7 100%)', minHeight: '214px', padding: '24px 22px', color: '#FFFFFF', boxShadow: '0 22px 54px rgba(37,99,235,0.28)', marginBottom: '18px' }}>
          <div style={{ position: 'relative', zIndex: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '16px' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '18px', fontWeight: 800, opacity: 0.94 }}>Facturación hoy <span style={{ width: '18px', height: '18px', borderRadius: '50%', border: '1px solid rgba(255,255,255,0.45)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px' }}>i</span></div>
              <div style={{ marginTop: '18px', fontSize: '56px', lineHeight: 0.95, fontWeight: 900, letterSpacing: '0' }}>{formatMoney(totalDay)}</div>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', marginTop: '22px', padding: '10px 14px', borderRadius: '999px', background: 'rgba(255,255,255,0.92)', color: '#2563EB', fontSize: '13px', fontWeight: 900 }}>Datos en tiempo real</div>
            </div>
            <button type="button" style={{ border: 'none', borderRadius: '16px', background: 'rgba(255,255,255,0.13)', color: '#FFFFFF', padding: '12px 15px', fontSize: '15px', fontWeight: 800, display: 'inline-flex', alignItems: 'center', gap: '8px' }}>Hoy <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M6 9l6 6 6-6" /></svg></button>
          </div>
          <svg style={{ position: 'absolute', right: '24px', bottom: '28px', width: '68%', height: '92px', opacity: 0.84 }} viewBox="0 0 280 100" fill="none" preserveAspectRatio="none">
            <path d="M0 82 C32 76 44 90 70 66 C98 40 112 76 142 43 C170 12 180 67 210 32 C236 2 242 48 280 12" stroke="rgba(255,255,255,0.86)" strokeWidth="5" strokeLinecap="round" />
            <path d="M0 82 C32 76 44 90 70 66 C98 40 112 76 142 43 C170 12 180 67 210 32 C236 2 242 48 280 12" stroke="rgba(255,255,255,0.18)" strokeWidth="12" strokeLinecap="round" />
          </svg>
        </section>

        <section style={{ background: '#FFFFFF', border: '1px solid rgba(226,232,240,0.72)', borderRadius: '20px', padding: '13px 14px', boxShadow: '0 14px 34px rgba(15,23,42,0.06)', marginBottom: '18px' }}>
          <button type="button" onClick={() => setShowPaymentBreakdown(prev => !prev)} style={{ width: '100%', background: 'transparent', border: 'none', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: '#2563EB', fontSize: '14px', fontWeight: 900, cursor: 'pointer' }}>
            <span>Medios de pago</span>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ transform: showPaymentBreakdown ? 'rotate(180deg)' : 'none', transition: 'transform 180ms ease' }}><path strokeLinecap="round" strokeLinejoin="round" d="M6 9l6 6 6-6" /></svg>
          </button>
          {showPaymentBreakdown && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginTop: '12px' }}>
              <div style={{ background: '#ECFDF5', border: '1px solid #BBF7D0', borderRadius: '16px', padding: '10px', color: '#16A34A', fontSize: '13px', fontWeight: 900 }}><div>Efectivo</div><div style={{ color: '#070B1D', fontSize: '18px', marginTop: '4px' }}>{formatMoney(efectivoTotal)}</div></div>
              <div style={{ background: '#EFF6FF', border: '1px solid #DBEAFE', borderRadius: '16px', padding: '10px', color: '#2563EB', fontSize: '13px', fontWeight: 900 }}><div>Transferencia</div><div style={{ color: '#070B1D', fontSize: '18px', marginTop: '4px' }}>{formatMoney(transferenciaTotal)}</div></div>
            </div>
          )}
        </section>

        <section style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '10px', marginBottom: '18px' }}>
          {[
            { label: 'Servicios hoy', value: totalServices.toLocaleString(), helper: 'Datos reales', color: '#2563EB', bg: '#DBEAFE', icon: 'bag' },
            { label: 'Ganancia hoy', value: formatMoney(ownerEarning), helper: 'Dueño', color: '#16A34A', bg: '#DCFCE7', icon: 'trend' },
            { label: 'Barberos activos', value: activeBarbersCount.toLocaleString(), helper: `de ${barberStats.length}`, color: '#7C3AED', bg: '#EDE9FE', icon: 'users' },
            { label: 'Ticket promedio', value: formatMoney(averageTicket), helper: 'Por servicio', color: '#F59E0B', bg: '#FEF3C7', icon: 'tag' },
          ].map(card => (
            <div key={card.label} style={{ minHeight: '154px', background: '#FFFFFF', border: '1px solid rgba(226,232,240,0.72)', borderRadius: '24px', padding: '16px', boxShadow: '0 16px 42px rgba(15,23,42,0.07)' }}>
              <div style={{ width: '44px', height: '44px', borderRadius: '15px', background: card.bg, color: card.color, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '18px' }}>
                {card.icon === 'bag' && <svg width="23" height="23" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M6 8h12l-1 12H7L6 8Z"/><path strokeLinecap="round" d="M9 8a3 3 0 0 1 6 0"/></svg>}
                {card.icon === 'trend' && <svg width="23" height="23" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M4 17l6-6 4 4 6-8"/><path strokeLinecap="round" strokeLinejoin="round" d="M15 7h5v5"/></svg>}
                {card.icon === 'users' && <svg width="23" height="23" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" d="M16 21v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2"/><circle cx="9.5" cy="7" r="4"/><path strokeLinecap="round" d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></svg>}
                {card.icon === 'tag' && <svg width="23" height="23" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M20.6 13.4 13.4 20.6a2 2 0 0 1-2.8 0L3 13V3h10l7.6 7.6a2 2 0 0 1 0 2.8Z"/><circle cx="8" cy="8" r="1.5"/></svg>}
              </div>
              <div style={{ color: '#475569', fontSize: '13px', fontWeight: 800, marginBottom: '12px' }}>{card.label}</div>
              <div style={{ color: '#070B1D', fontSize: '25px', fontWeight: 900, lineHeight: 1 }}>{card.value}</div>
              <div style={{ color: '#64748B', fontSize: '13px', fontWeight: 700, marginTop: '14px' }}>{card.helper}</div>
            </div>
          ))}
        </section>

        <section style={{ background: '#FFFFFF', border: '1px solid rgba(226,232,240,0.72)', borderRadius: '26px', padding: '18px', boxShadow: '0 18px 48px rgba(15,23,42,0.08)', marginBottom: '18px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', marginBottom: '14px' }}>
            <h2 style={{ color: '#070B1D', fontSize: '21px', fontWeight: 900, margin: 0 }}>Barberos en tiempo real</h2>
            <span style={{ color: '#2563EB', fontSize: '14px', fontWeight: 900 }}>Ver todos</span>
          </div>
          {barberStats.length === 0 ? (
            <div style={{ padding: '32px 8px', textAlign: 'center', color: '#64748B', fontWeight: 700 }}>No hay barberos cargados</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {barberStats.map((stats) => <ExpandableBarberCard key={stats.barber.id} stats={stats} />)}
            </div>
          )}
        </section>

        <section style={{ display: 'grid', gridTemplateColumns: '74px 1fr', gap: '14px', alignItems: 'center', background: 'linear-gradient(135deg, #EFF6FF, #FFFFFF)', border: '1px solid rgba(219,234,254,0.9)', borderRadius: '22px', padding: '16px', boxShadow: '0 16px 42px rgba(15,23,42,0.06)', marginBottom: '18px' }}>
          <div style={{ width: '58px', height: '58px', borderRadius: '18px', background: '#DBEAFE', color: '#2563EB', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path strokeLinecap="round" strokeLinejoin="round" d="M4 18V6M4 18h16M8 15l4-4 3 3 5-7"/><path strokeLinecap="round" strokeLinejoin="round" d="M15 7h5v5"/></svg>
          </div>
          <div>
            <h3 style={{ color: '#070B1D', fontSize: '18px', fontWeight: 900, margin: 0 }}>Seguimiento activo de la jornada</h3>
            <p style={{ color: '#1E293B', fontSize: '14px', lineHeight: 1.45, fontWeight: 700, margin: '8px 0 0' }}>Datos actualizados en tiempo real con la actividad de la barbería.</p>
          </div>
        </section>

        <section style={{ background: '#FFFFFF', border: '1px solid rgba(226,232,240,0.72)', borderRadius: '24px', padding: '18px', boxShadow: '0 18px 48px rgba(15,23,42,0.07)', marginBottom: '18px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', marginBottom: expenses.length > 0 ? '14px' : 0 }}>
            <div>
              <h2 style={{ color: '#070B1D', fontSize: '18px', fontWeight: 900, margin: 0 }}>Gastos del día</h2>
              <p style={{ color: '#64748B', fontSize: '12px', fontWeight: 700, margin: '4px 0 0' }}>Insumos y caja diaria</p>
            </div>
            <button onClick={() => setShowExpenseModal(true)} style={{ background: '#2563EB', color: '#FFFFFF', border: 'none', borderRadius: '14px', padding: '10px 12px', fontSize: '12px', fontWeight: 900, cursor: 'pointer' }}>Agregar</button>
          </div>
          {expenses.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {expenses.map(expense => (
                <div key={expense.id} style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', color: '#1E293B', fontSize: '14px', fontWeight: 700 }}>
                  <span>{expense.description}</span>
                  <span style={{ color: '#F59E0B', fontWeight: 900 }}>-{formatMoney(expense.amount)}</span>
                </div>
              ))}
              <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid #E2E8F0', paddingTop: '12px', color: '#070B1D', fontSize: '15px', fontWeight: 900 }}>
                <span>Total gastos</span>
                <span style={{ color: '#F59E0B' }}>-{formatMoney(totalExpenses)}</span>
              </div>
            </div>
          )}
        </section>

        {barberStats.length > 0 && logs.length > 0 && (
          <section style={{ background: '#FFFFFF', border: '1px solid rgba(226,232,240,0.72)', borderRadius: '24px', padding: '18px', boxShadow: '0 18px 48px rgba(15,23,42,0.07)' }}>
            <h2 style={{ color: '#070B1D', fontSize: '18px', fontWeight: 900, margin: '0 0 14px' }}>Liquidación del día</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', color: '#1E293B', fontSize: '14px', fontWeight: 800 }}><span>Total Barbería</span><span>{formatMoney(totalDay)}</span></div>
              {barberStats.map((stats) => (
                <div key={stats.barber.id} style={{ display: 'flex', justifyContent: 'space-between', color: '#64748B', fontSize: '13px', fontWeight: 700 }}><span>{stats.barber.display_name}</span><span>{formatMoney(stats.barberEarnings)}</span></div>
              ))}
              {totalExpenses > 0 && <div style={{ display: 'flex', justifyContent: 'space-between', color: '#64748B', fontSize: '13px', fontWeight: 700 }}><span>Insumos del día</span><span style={{ color: '#F59E0B' }}>-{formatMoney(totalExpenses)}</span></div>}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', borderTop: '1px solid #E2E8F0', paddingTop: '12px', color: '#070B1D', fontSize: '14px', fontWeight: 900 }}>
                <span>Ganancia real del dueño</span>
                <span style={{ color: '#10B981', fontSize: '21px' }}>{formatMoney(totalDay - totalBarberEarningsExTips + totalOthers - totalExpenses)}</span>
              </div>
            </div>
          </section>
        )}

        {isPostMidnight && (
          <button onClick={() => window.location.reload()} style={{ width: '100%', marginTop: '18px', background: '#0F172A', color: '#FFFFFF', border: 'none', borderRadius: '18px', padding: '14px', fontSize: '14px', fontWeight: 900, cursor: 'pointer' }}>Iniciar nuevo día</button>
        )}
      </div>

      {showExpenseModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.42)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 120, padding: '18px' }}>
          <div style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '26px', padding: '24px', maxWidth: '390px', width: '100%', color: '#070B1D', boxShadow: '0 28px 70px rgba(15,23,42,0.18)' }}>
            <h3 style={{ fontFamily: 'Syne, sans-serif', fontWeight: 900, fontSize: '20px', color: '#070B1D', margin: '0 0 20px 0' }}>Agregar gasto</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginBottom: '22px' }}>
              <input type="text" placeholder="Ej: Shampoo, toallas, etc." value={expenseForm.description} onChange={e => setExpenseForm(prev => ({ ...prev, description: e.target.value }))} style={{ border: '1px solid #E2E8F0', borderRadius: '16px', padding: '13px 14px', fontSize: '14px', outline: 'none', backgroundColor: '#F8FAFC', color: '#070B1D', width: '100%', boxSizing: 'border-box', fontWeight: 700 }} />
              <input type="number" placeholder="0" value={expenseForm.amount} onChange={e => setExpenseForm(prev => ({ ...prev, amount: e.target.value }))} style={{ border: '1px solid #E2E8F0', borderRadius: '16px', padding: '13px 14px', fontSize: '14px', outline: 'none', backgroundColor: '#F8FAFC', color: '#070B1D', width: '100%', boxSizing: 'border-box', fontWeight: 700 }} />
            </div>
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button onClick={() => { setShowExpenseModal(false); setExpenseForm({ description: '', amount: '' }) }} style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '14px', padding: '10px 16px', fontSize: '14px', cursor: 'pointer', color: '#64748B', fontWeight: 800 }}>Cancelar</button>
              <button onClick={handleAddExpense} disabled={savingExpense} style={{ background: '#2563EB', color: '#FFFFFF', border: 'none', borderRadius: '14px', padding: '10px 18px', fontSize: '14px', cursor: savingExpense ? 'not-allowed' : 'pointer', opacity: savingExpense ? 0.7 : 1, fontWeight: 900 }}>{savingExpense ? 'Guardando...' : 'Guardar'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}