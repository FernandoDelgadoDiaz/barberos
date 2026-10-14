import { useEffect, useState, useCallback, useRef } from 'react'
import { useNavigate, useOutletContext } from 'react-router-dom'
import { useTenantStore } from '../../stores/tenantStore'
import { supabase } from '../../config/supabase'
import { useServiceLogsRealtime } from '../../hooks/useRealtime'
import { ExpandableBarberCard, cleanName } from '../../components/owner/ExpandableBarberCard'
import { GraceBanner } from '../../components/GraceBanner'
import type { ServiceLog, Profile, DailyExpense } from '../../types'
import { isRealService } from '../../types'
import { getOwnerDayStatus } from '../../utils/ownerDayStatus'
import '../../styles/owner-premium.css'

function getArgentinaDateString(date = new Date()): string {
  return date.toLocaleDateString('en-CA', { timeZone: 'America/Argentina/Buenos_Aires' })
}

function getArgentinaDayRangeUTC(date = new Date()): { startUTC: string; endUTC: string } {
  // Argentina is UTC-3 (no DST since 2009)
  const argDate = getArgentinaDateString(date)
  const startUTC = `${argDate}T03:00:00Z`
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

export type ServiceLogWithDetails = ServiceLog & {
  barber_name: string
  appointment_total_price?: number
  appointment_total_barber_earning?: number
  appointment_total_owner_earning?: number
  service_name?: string
}

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
  hasRecordsInPeriod: boolean
  highlight: boolean
  appointments: AppointmentWithServices[]
  barberEarnings: number
}

type OutletCtx = { onOpenDrawer?: () => void }

export function LivePanel() {
  const { tenant, profile } = useTenantStore()
  const tenantId = tenant?.id || profile?.tenant_id
  const navigate = useNavigate()
  const ctx = useOutletContext<OutletCtx>() || {}

  const [logs, setLogs] = useState<ServiceLogWithDetails[]>([])
  const [barbers, setBarbers] = useState<Profile[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [highlightBarberId, setHighlightBarberId] = useState<string | null>(null)
  const [currentDate, setCurrentDate] = useState<string>('')
  const [expenses, setExpenses] = useState<DailyExpense[]>([])
  const [showExpenseModal, setShowExpenseModal] = useState(false)
  const [expenseForm, setExpenseForm] = useState({ description: '', amount: '' })
  const [savingExpense, setSavingExpense] = useState(false)
  const isMounted = useRef(true)

  // Totals.
  // La plata suma TODAS las filas (incluidas las portadoras de ventas sueltas de
  // productos); los CONTADORES de servicios solo las filas que son un servicio real.
  const totalDay = logs.reduce((sum, log) => sum + log.price_charged, 0)
  const ownerEarning = logs.reduce((sum, log) => sum + log.owner_earning, 0)
  const totalServices = logs.filter(isRealService).length

  // Per-barber stats
  const barberStats: BarberStats[] = barbers.map(barber => {
    const barberLogs = logs.filter(log => log.barber_id === barber.id)
    const servicesCount = barberLogs.filter(isRealService).length
    const totalGenerated = barberLogs.reduce((sum, log) => sum + log.price_charged, 0)
    const ownerCommission = barberLogs.reduce((sum, log) => sum + log.owner_earning, 0)
    const barberEarnings = barberLogs.reduce((sum, log) => sum + log.barber_earning, 0)
    const hasRecordsInPeriod = barberLogs.length > 0

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

    const appointments = Array.from(appointmentsMap.values())
      .sort((a, b) => new Date(b.started_at).getTime() - new Date(a.started_at).getTime())

    return {
      barber,
      servicesCount,
      totalGenerated,
      ownerCommission,
      barberEarnings,
      hasRecordsInPeriod,
      highlight: highlightBarberId === barber.id,
      appointments
    }
  })

  const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0)
  const totalBarberEarningsExTips = logs.reduce((sum, log) => sum + log.barber_earning - (log.tip_amount ?? 0), 0)
  const totalOthers = logs.reduce((sum, log) => sum + (log.others_amount ?? 0), 0)

  // The panel only loads enabled barbers. A recorded visit does not establish
  // whether a barber is currently free or busy.
  const activeBarbersCount = barbers.length

  // A visit can contain several services (or products), but is one ticket.
  // Older logs without an appointment use the same fallback grouping as History.
  const ticketsToday = new Set(logs.map(log => log.appointment_id || `${log.barber_id}-${log.started_at}`)).size
  const avgTicket = ticketsToday > 0 ? Math.round(totalDay / ticketsToday) : 0

  const loadInitialData = useCallback(async () => {
    if (!tenantId) {
      if (isMounted.current) {
        setLoadError('No se pudo identificar la barbería.')
        setLoading(false)
      }
      return
    }
    if (isMounted.current) {
      setLoadError(null)
      setLoading(true)
    }

    try {
      const now = new Date()
      const argHour = parseInt(now.toLocaleString('en-US', {
        hour: 'numeric', hour12: false,
        timeZone: 'America/Argentina/Buenos_Aires'
      }))
      const targetDateObj = new Date(now)
      if (argHour >= 0 && argHour < 6) targetDateObj.setDate(targetDateObj.getDate() - 1)
      const targetArgentina = getArgentinaDateString(targetDateObj)
      if (isMounted.current) setCurrentDate(targetArgentina)
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
      if (isMounted.current) setLogs(logsWithDetails)

      const { data: barbersData, error: barbersError } = await supabase
        .from('profiles')
        .select('*')
        .eq('tenant_id', tenantId)
        .eq('role', 'barber')
        .eq('is_active', true)
        .order('display_name')

      if (barbersError) throw barbersError
      if (isMounted.current) setBarbers(barbersData || [])

      const { data: expensesData, error: expensesError } = await supabase
        .from('daily_expenses')
        .select('*')
        .eq('tenant_id', tenantId)
        .eq('expense_date', targetArgentina)
        .order('created_at', { ascending: true })
      if (expensesError) throw expensesError
      if (isMounted.current) {
        setExpenses(expensesData || [])
        setLoadError(null)
      }
    } catch (error) {
      console.error('Error loading initial data:', error)
      if (isMounted.current) setLoadError('No pudimos cargar los datos del negocio. Reintentá para ver la información actualizada.')
    } finally {
      if (isMounted.current) setLoading(false)
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

  useEffect(() => {
    if (!tenantId) return
    const checkDateChange = () => {
      const targetArgentina = getTargetArgentinaDate()
      if (currentDate && currentDate !== targetArgentina) {
        loadInitialData()
      }
    }
    const intervalId = setInterval(checkDateChange, 60000)
    return () => clearInterval(intervalId)
  }, [tenantId, currentDate, loadInitialData])

  const handleNewLog = useCallback(async (newLog: ServiceLog) => {
    const [{ data: barberData }, { data: appointmentData }] = await Promise.all([
      supabase.from('profiles').select('display_name').eq('id', newLog.barber_id).single(),
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
    setHighlightBarberId(newLog.barber_id)
    setTimeout(() => setHighlightBarberId(null), 2000)
  }, [])

  useServiceLogsRealtime(tenantId || '', handleNewLog)

  // Open/close logic for "estado abierto"
  const parseTimeToMinutes = (timeStr: string) => {
    const [hours, minutes] = timeStr.split(':').map(Number)
    return hours * 60 + minutes
  }
  const closingTime = tenant?.closing_time || '21:00'
  const openingTime = tenant?.opening_time || '09:00'
  const isOpen = (() => {
    const argTimeStr = new Date().toLocaleTimeString('en-GB', {
      hour: '2-digit', minute: '2-digit', hour12: false,
      timeZone: 'America/Argentina/Buenos_Aires'
    })
    const nowMin = parseTimeToMinutes(argTimeStr)
    return nowMin >= parseTimeToMinutes(openingTime) && nowMin < parseTimeToMinutes(closingTime)
  })()
  // Format "10:00 p.m."
  const formatClosing = (timeStr: string): string => {
    const [hStr, mStr] = timeStr.split(':')
    const h = parseInt(hStr)
    const m = parseInt(mStr)
    const period = h >= 12 ? 'p.m.' : 'a.m.'
    const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h
    return `${h12}:${m.toString().padStart(2, '0')} ${period}`
  }

  const greetingName = profile?.display_name?.split(' ')[0] || ''
  const localHour = Number(new Date().toLocaleString('en-US', {
    hour: 'numeric', hour12: false,
    timeZone: 'America/Argentina/Buenos_Aires'
  }))
  const greeting = localHour >= 6 && localHour < 12
    ? 'Buenos días'
    : localHour >= 12 && localHour < 20 ? 'Buenas tardes' : 'Buenas noches'

  const isPostMidnight = (() => {
    const h = parseInt(new Date().toLocaleString('en-US', {
      hour: 'numeric', hour12: false,
      timeZone: 'America/Argentina/Buenos_Aires'
    }))
    return h >= 0 && h < 6
  })()
  const periodLabel = isPostMidnight ? 'Última jornada' : 'Hoy'
  const dayStatus = getOwnerDayStatus({ isOpen, isPostMidnight, serviceCount: totalServices, recordCount: logs.length })

  if (loading) {
    return (
      <div style={{ padding: '24px', color: '#0F172A', textAlign: 'center', fontSize: '14px' }}>
        Cargando panel en vivo...
      </div>
    )
  }

  if (loadError) {
    return (
      <div className="premium-live" style={{ maxWidth: '430px', margin: '0 auto', padding: '16px', color: '#0F172A' }}>
        <GraceBanner style={{ marginBottom: '12px' }} />
        <div role="alert" style={{ background: '#fff', border: '1px solid #FECACA', borderRadius: '16px', padding: '20px' }}>
          <strong style={{ display: 'block', marginBottom: '8px', fontFamily: 'Syne, sans-serif' }}>No se pudo actualizar Inicio</strong>
          <p style={{ color: '#64748B', fontSize: '13px', lineHeight: 1.5, margin: '0 0 16px' }}>{loadError}</p>
          <button type="button" onClick={() => void loadInitialData()} style={{ background: '#2563EB', color: '#fff', border: 'none', borderRadius: '10px', padding: '10px 18px', fontWeight: 600, cursor: 'pointer' }}>Reintentar</button>
        </div>
      </div>
    )
  }

  // Responsive font helpers: clamp(min, preferred-vw, max).
  // Anchor is @390px width (mockup reference). Preferred values use vw so they scale
  // smoothly across 320 → 430. Mins keep text readable at 320px.
  // Formula used: preferredVW ≈ targetPx * 100 / 390
  const fs = {
    headerTitle: 'clamp(15px, 4.6vw, 18px)',       // 18px @390
    headerGreeting: 'clamp(11px, 3.33vw, 13px)',   // 13px @390
    stateMain: 'clamp(10px, 3.08vw, 12px)',        // 12px @390
    stateLink: 'clamp(11px, 3.33vw, 13px)',        // 13px @390
    heroLabel: 'clamp(11px, 3.33vw, 13px)',        // 13px @390
    heroPill: 'clamp(10px, 3.08vw, 12px)',         // 12px @390
    heroNumber: 'clamp(34px, 10.8vw, 42px)',      // 46px @390
    heroNeutralPill: 'clamp(10px, 3.08vw, 12px)',  // 12px @390
    metricLabel: 'clamp(11px, 3.10vw, 12px)',
    metricNumber: 'clamp(16px, 4.35vw, 18px)',
    metricSub: 'clamp(11px, 3.08vw, 12px)',
    sectionTitle: 'clamp(16px, 4.6vw, 18px)',      // 16px @390
    sectionLink: 'clamp(11px, 3.33vw, 13px)',      // 13px @390
    insightKicker: 'clamp(10px, 2.82vw, 11px)',    // 11px @390
    insightTitle: 'clamp(13px, 3.59vw, 14px)',     // 14px @390
    insightBody: 'clamp(11px, 3.33vw, 13px)',      // 13px @390
  }

  return (
    <div className="premium-live" style={{ maxWidth: '430px', margin: '0 auto', width: '100%', boxSizing: 'border-box', overflowX: 'hidden' }}>
      {/* Aviso de gracia (suscripción vencida) — primer elemento del contenido */}
      <GraceBanner style={{ margin: '12px 16px 0' }} />

      {/* Top header (mobile) */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px 4px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0, flex: 1 }}>
          <button
            onClick={() => ctx.onOpenDrawer?.()}
            aria-label="Abrir menú"
            style={{
              background: '#fff',
              border: '1px solid #E2E8F0',
              borderRadius: '50%',
              width: '36px',
              height: '36px',
              minWidth: '36px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              padding: 0,
              flexShrink: 0,
            }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <path d="M4 7h16M4 12h16M4 17h16" stroke="#0F172A" strokeWidth="1.8" strokeLinecap="round"/>
            </svg>
          </button>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{
              fontFamily: 'Syne, sans-serif',
              fontWeight: 700,
              fontSize: fs.headerTitle,
              color: '#0F172A',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              lineHeight: 1.2,
            }}>
              {tenant?.name || 'Tu barbería'}
            </div>
            <div style={{
              fontSize: fs.headerGreeting,
              color: '#64748B',
              marginTop: '2px',
              fontWeight: 400,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}>
              {greetingName
                ? <>{greeting}, <span style={{ fontWeight: 500, color: '#2563EB' }}>{greetingName}</span></>
                : <>{greeting}</>}
            </div>
          </div>
        </div>
      </div>

      {/* Open/closed status */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 16px 12px', gap: '8px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: 0, flex: 1 }}>
          <span style={{
            width: '7px',
            height: '7px',
            borderRadius: '50%',
            background: isOpen ? '#22C55E' : '#94A3B8',
            display: 'inline-block',
            flexShrink: 0,
          }} />
          <span style={{
            fontSize: fs.stateMain,
            fontWeight: 500,
            color: '#0F172A',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}>
            {isOpen ? 'Dentro del horario' : 'Fuera de horario'}
            <span style={{ color: '#64748B' }}>
              {' · '}
              {formatClosing(openingTime)}–{formatClosing(closingTime)}
            </span>
          </span>
        </div>
        <button type="button" onClick={() => navigate('/owner/settings')} style={{
          fontSize: fs.stateLink,
          color: '#2563EB',
          fontWeight: 600,
          display: 'inline-flex',
          alignItems: 'center',
          gap: '2px',
          flexShrink: 0,
          background: 'transparent',
          border: 0,
          cursor: 'pointer',
          padding: '8px 0 8px 8px',
        }}>
          Ver horario
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M9 6l6 6-6 6" stroke="#2563EB" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </div>

      {/* Daily revenue summary. */}
      <div style={{ margin: '0 16px' }}>
        <div className="premium-live-hero" style={{
          position: 'relative',
          borderRadius: '20px',
          padding: '14px 16px',
          minHeight: '124px',
          background: 'linear-gradient(135deg, #3B82F6 0%, #2563EB 55%, #1D4ED8 100%)',
          color: '#fff',
          overflow: 'hidden',
          boxShadow: '0 10px 30px rgba(37, 99, 235, 0.30)',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          boxSizing: 'border-box',
        }}>

          <div style={{ position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: fs.heroLabel, color: '#fff', fontWeight: 600 }}>
                <span>{isPostMidnight ? 'Facturación última jornada' : 'Facturación hoy'}</span>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <circle cx="12" cy="12" r="9" stroke="rgba(255,255,255,0.9)" strokeWidth="1.6" />
                  <path d="M12 11v5" stroke="rgba(255,255,255,0.9)" strokeWidth="1.8" strokeLinecap="round" />
                  <circle cx="12" cy="8" r="1" fill="#fff" />
                </svg>
              </div>
              <div style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                fontSize: fs.heroPill,
                color: '#fff',
                background: 'rgba(255,255,255,0.20)',
                padding: '4px 10px',
                borderRadius: '999px',
                fontWeight: 500,
                flexShrink: 0,
              }}>
                <span>{periodLabel}</span>
              </div>
            </div>
            <div style={{
              // Inter (loaded @800) renders "$" and digits as one homogeneous block.
              // Syne lacks a matching heavy "$" glyph, so it fell back and looked off.
              fontFamily: "'Inter', system-ui, sans-serif",
              fontWeight: 800,
              fontSize: fs.heroNumber,
              letterSpacing: '-1.5px',
              lineHeight: 1.05,
              color: '#fff',
              marginTop: '4px',
            }}>
              ${totalDay.toLocaleString()}
            </div>
          </div>

          <div style={{ position: 'relative', zIndex: 1, marginTop: '4px' }}>
            <span className="premium-live-records" style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: fs.heroNeutralPill,
              fontWeight: 600,
              color: '#fff',
              background: 'rgba(255,255,255,0.20)',
              padding: '4px 10px',
              borderRadius: '999px',
              border: '1px solid rgba(255,255,255,0.28)',
            }}>
              <span style={{
                width: '6px',
                height: '6px',
                borderRadius: '50%',
                background: dayStatus.hasActivity ? '#10B981' : '#94A3B8',
                display: 'inline-block',
              }} aria-hidden="true" />
              {dayStatus.recordLabel}
            </span>
          </div>
        </div>
      </div>

      {/* Two columns keep labels and amounts readable on narrow phones. */}
      <div style={{ padding: '12px 0 0' }}>
        <div className="premium-live-stats"
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
            gap: '8px',
            padding: '0 16px',
          }}
        >
          <MetricCard
            iconBg="#2563EB"
            label={isPostMidnight ? 'Servicios última jornada' : 'Servicios hoy'}
            value={totalServices.toString()}
            sub={periodLabel}
            labelSize={fs.metricLabel}
            valueSize={fs.metricNumber}
            subSize={fs.metricSub}
            icon={(
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                <rect x="4" y="5" width="16" height="15" rx="2" stroke="#fff" strokeWidth="1.8"/>
                <path d="M8 3v4M16 3v4M4 10h16" stroke="#fff" strokeWidth="1.8" strokeLinecap="round"/>
              </svg>
            )}
          />
          <MetricCard
            iconBg="#059669"
            label="Parte del dueño"
            value={`$${ownerEarning.toLocaleString()}`}
            sub="Antes de gastos"
            labelSize={fs.metricLabel}
            valueSize={fs.metricNumber}
            subSize={fs.metricSub}
            icon={(
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                <path d="M3 17l5-5 4 4 8-9" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M15 7h5v5" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            )}
          />
          <MetricCard
            iconBg="#7C3AED"
            label="Barberos activos"
            value={`${activeBarbersCount}`}
            sub="Habilitados"
            labelSize={fs.metricLabel}
            valueSize={fs.metricNumber}
            subSize={fs.metricSub}
            icon={(
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                <circle cx="9" cy="9" r="3" stroke="#fff" strokeWidth="1.8"/>
                <path d="M3 19c0-3.3 2.7-6 6-6s6 2.7 6 6" stroke="#fff" strokeWidth="1.8" strokeLinecap="round"/>
                <circle cx="17" cy="10" r="2.4" stroke="#fff" strokeWidth="1.8"/>
                <path d="M21 18c0-2.2-1.8-4-4-4" stroke="#fff" strokeWidth="1.8" strokeLinecap="round"/>
              </svg>
            )}
          />
          <MetricCard
            iconBg="#EA580C"
            label="Ticket promedio"
            value={ticketsToday > 0 ? `$${avgTicket.toLocaleString()}` : '—'}
            sub="Por atención"
            labelSize={fs.metricLabel}
            valueSize={fs.metricNumber}
            subSize={fs.metricSub}
            icon={(
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                <path d="M20 12V7a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v5a2 2 0 0 1 0 4v5a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-5a2 2 0 0 1 0-4z" stroke="#fff" strokeWidth="1.6" strokeLinejoin="round"/>
                <path d="M10 8v8" stroke="#fff" strokeWidth="1.6" strokeLinecap="round" strokeDasharray="1.5 2"/>
              </svg>
            )}
          />
        </div>
      </div>

      {/* Today's recorded activity by enabled barber. */}
      <div className="premium-live-section" style={{ padding: '16px 16px 0' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '8px' }}>
          <h2 style={{
            fontFamily: 'Syne, sans-serif',
            fontWeight: 700,
            fontSize: fs.sectionTitle,
            color: '#0F172A',
            margin: 0,
          }}>
            Actividad por barbero
          </h2>
          <button type="button" onClick={() => navigate('/owner/barbers')} style={{ fontSize: fs.sectionLink, color: '#2563EB', fontWeight: 600, background: 'transparent', border: 0, cursor: 'pointer', padding: '8px 0 8px 8px' }}>Ver barberos</button>
        </div>
        {barberStats.length === 0 ? (
          <div style={{ background: '#fff', borderRadius: '16px', padding: '24px', textAlign: 'center', color: '#64748B', border: '1px solid #F1F5F9' }}>
            <p style={{ fontSize: '14px', margin: '0 0 4px 0' }}>No hay barberos</p>
            <p style={{ fontSize: '12px', margin: 0, color: '#94A3B8' }}>Agrega barberos en la configuración</p>
          </div>
        ) : (
          <div className="premium-live-barbers" style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {barberStats.map((stats) => (
              <ExpandableBarberCard key={stats.barber.id} stats={stats} />
            ))}
          </div>
        )}
      </div>

      {/* Gastos del día */}
      <div style={{ padding: '20px 16px 0' }}>
        <div className="premium-live-expenses" style={{ background: '#fff', border: '1px solid #F1F5F9', borderRadius: '16px', padding: '16px', boxShadow: '0 1px 2px rgba(15,23,42,0.04)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: expenses.length > 0 ? '12px' : '0' }}>
            <h2 style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 'clamp(13px, 3.59vw, 14px)', color: '#0F172A', margin: 0 }}>Gastos del día</h2>
            <button
              className="premium-live-add-expense"
              onClick={() => setShowExpenseModal(true)}
              style={{ background: '#2563EB', color: '#fff', border: 'none', borderRadius: '10px', padding: '8px 14px', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}
            >
              + Agregar
            </button>
          </div>
          {expenses.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {expenses.map(expense => (
                <div key={expense.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', gap: '12px' }}>
                  <span style={{ color: '#475569', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{expense.description}</span>
                  <span style={{ color: '#DC2626', fontWeight: 600, flexShrink: 0 }}>-${expense.amount.toLocaleString()}</span>
                </div>
              ))}
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', fontWeight: 700, borderTop: '1px solid #F1F5F9', paddingTop: '8px', marginTop: '4px' }}>
                <span style={{ color: '#0F172A' }}>Total gastos</span>
                <span style={{ color: '#DC2626' }}>-${totalExpenses.toLocaleString()}</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Liquidación del día — PRESERVES the protected formula (commit bf3bbf2) */}
      {barberStats.length > 0 && logs.length > 0 && (
        <div style={{ padding: '20px 16px 0' }}>
          <div style={{
            background: 'linear-gradient(135deg, #1E40AF 0%, #2563EB 100%)',
            borderRadius: '16px',
            padding: '18px 18px 20px',
            color: '#fff',
            boxShadow: '0 10px 24px rgba(30, 64, 175, 0.25)',
          }}>
            <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.78)', textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: '12px', fontWeight: 600 }}>
              Liquidación del día
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '8px', borderBottom: '1px solid rgba(255,255,255,0.15)' }}>
                <span style={{ fontSize: '13px', color: 'rgba(255,255,255,0.85)' }}>Total Barbería</span>
                <span style={{ fontSize: '14px', fontWeight: 600, color: '#fff' }}>${totalDay.toLocaleString()}</span>
              </div>
              {barberStats.map((stats) => (
                <div key={stats.barber.id} style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '8px', borderBottom: '1px solid rgba(255,255,255,0.10)', gap: '12px' }}>
                  <span style={{ fontSize: '13px', color: 'rgba(255,255,255,0.85)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{cleanName(stats.barber.display_name)}</span>
                  <span style={{ fontSize: '14px', fontWeight: 600, color: '#fff', flexShrink: 0 }}>${stats.barberEarnings.toLocaleString()}</span>
                </div>
              ))}
              {totalExpenses > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '8px' }}>
                  <span style={{ fontSize: '13px', color: 'rgba(255,255,255,0.85)' }}>Insumos del día</span>
                  <span style={{ fontSize: '14px', fontWeight: 600, color: '#FCA5A5' }}>-${totalExpenses.toLocaleString()}</span>
                </div>
              )}
              <div style={{ borderTop: '1px solid rgba(255,255,255,0.25)', paddingTop: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '12px' }}>
                <span style={{ fontSize: '14px', color: '#fff', fontWeight: 600 }}>Ganancia real del dueño</span>
                <span style={{ fontSize: '20px', fontWeight: 800, color: '#FACC15' }}>
                  ${(totalDay - totalBarberEarningsExTips + totalOthers - totalExpenses).toLocaleString()}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Post-midnight "Iniciar nuevo día" CTA preserved */}
      {isPostMidnight && (
        <div style={{ padding: '20px 16px 0' }}>
          <button
            onClick={() => window.location.reload()}
            style={{ width: '100%', background: '#0F172A', color: '#fff', border: 'none', borderRadius: '12px', padding: '14px', fontSize: '14px', fontFamily: 'Space Grotesk, sans-serif', fontWeight: 600, cursor: 'pointer' }}
          >
            Iniciar nuevo día →
          </button>
        </div>
      )}

      {/* Estado operativo contextual: no elogios ni tendencias ficticias. */}
      <div style={{ padding: '20px 16px 0' }}>
        <section className="premium-live-status" aria-label="Estado de la jornada">
          <span className="premium-live-status-icon" aria-hidden="true">
            {dayStatus.hasActivity ? (
              <svg width="19" height="19" viewBox="0 0 24 24" fill="none">
                <path d="M4 18h16M6 14l4-4 3 3 5-6" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M15 7h3v3" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            ) : (
              <svg width="19" height="19" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.7"/>
                <path d="M12 7v5l3 2" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            )}
          </span>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div className="premium-live-status-title">{dayStatus.title}</div>
            <p className="premium-live-status-body">{dayStatus.detail}</p>
          </div>
        </section>
      </div>

      {/* Bottom spacer (clears the floating bottom nav ~64px + 16px margin) */}
      <div style={{ height: '110px' }} />

      {/* Expense modal */}
      {showExpenseModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 300, padding: '16px' }}>
          <div style={{ background: '#fff', borderRadius: '16px', padding: '24px', maxWidth: '380px', width: '100%', color: '#0F172A' }}>
            <h3 style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: '17px', color: '#0F172A', margin: '0 0 18px 0' }}>Agregar gasto</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '18px' }}>
              <input
                type="text"
                placeholder="Ej: Shampoo, toallas, etc."
                value={expenseForm.description}
                onChange={e => setExpenseForm(prev => ({ ...prev, description: e.target.value }))}
                style={{ border: '1px solid #E2E8F0', borderRadius: '10px', padding: '12px', fontSize: '14px', outline: 'none', backgroundColor: '#F8FAFC', color: '#0F172A', width: '100%', boxSizing: 'border-box' }}
              />
              <input
                type="number"
                placeholder="0"
                value={expenseForm.amount}
                onChange={e => setExpenseForm(prev => ({ ...prev, amount: e.target.value }))}
                style={{ border: '1px solid #E2E8F0', borderRadius: '10px', padding: '12px', fontSize: '14px', outline: 'none', backgroundColor: '#F8FAFC', color: '#0F172A', width: '100%', boxSizing: 'border-box' }}
              />
            </div>
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button
                onClick={() => { setShowExpenseModal(false); setExpenseForm({ description: '', amount: '' }) }}
                style={{ background: 'none', border: '1px solid #E2E8F0', borderRadius: '10px', padding: '10px 16px', fontSize: '13px', cursor: 'pointer', color: '#475569', fontWeight: 500 }}
              >
                Cancelar
              </button>
              <button
                onClick={handleAddExpense}
                disabled={savingExpense}
                style={{ background: '#2563EB', color: '#fff', border: 'none', borderRadius: '10px', padding: '10px 18px', fontSize: '13px', cursor: savingExpense ? 'not-allowed' : 'pointer', opacity: savingExpense ? 0.7 : 1, fontWeight: 600 }}
              >
                {savingExpense ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

/* Compact metric card keeps all four figures visible before the barber list. */
function MetricCard({
  iconBg,
  label,
  value,
  sub,
  icon,
  labelSize,
  valueSize,
  subSize,
}: {
  iconBg: string
  label: string
  value: string
  sub: string
  icon: React.ReactNode
  labelSize: string
  valueSize: string
  subSize: string
}) {
  return (
    <div className="premium-live-metric" style={{
      background: '#fff',
      borderRadius: '16px',
      padding: '8px',
      border: '1px solid #F1F5F9',
      boxShadow: '0 1px 2px rgba(15,23,42,0.04)',
      display: 'grid',
      gridTemplateColumns: '28px minmax(0, 1fr)',
      alignItems: 'start',
      columnGap: '7px',
      width: '100%',
      minWidth: 0,
      boxSizing: 'border-box',
      minHeight: '76px',
    }}>
      <div style={{
        width: '28px',
        height: '28px',
        borderRadius: '8px',
        background: iconBg,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
      }}>
        {icon}
      </div>
      <div style={{ minWidth: 0, display: 'flex', flexDirection: 'column', gap: '2px' }}>
        <div style={{
          fontSize: labelSize,
          color: '#64748B',
          fontWeight: 500,
          whiteSpace: 'normal',
          overflowWrap: 'break-word',
          letterSpacing: '-0.2px',
          lineHeight: 1.15,
        }}>
          {label}
        </div>
        <div style={{
          fontFamily: 'Syne, sans-serif',
          fontSize: valueSize,
          fontWeight: 700,
          color: '#0F172A',
          lineHeight: 1.1,
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }} title={value}>
          {value}
        </div>
        <div style={{
          fontSize: subSize,
          color: '#94A3B8',
          fontWeight: 400,
          whiteSpace: 'normal',
          overflowWrap: 'break-word',
          lineHeight: 1.15,
        }}>
          {sub}
        </div>
      </div>
    </div>
  )
}
