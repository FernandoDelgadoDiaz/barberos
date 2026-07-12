import { useEffect, useState, useCallback, useRef } from 'react'
import { useOutletContext } from 'react-router-dom'
import { useTenantStore } from '../../stores/tenantStore'
import { supabase } from '../../config/supabase'
import { useServiceLogsRealtime } from '../../hooks/useRealtime'
import { ExpandableBarberCard, cleanName } from '../../components/owner/ExpandableBarberCard'
import { GraceBanner } from '../../components/GraceBanner'
import type { ServiceLog, Profile, DailyExpense } from '../../types'

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
  lastServiceAt: string | null
  isActive: boolean
  highlight: boolean
  appointments: AppointmentWithServices[]
  barberEarnings: number
}

type OutletCtx = { onOpenDrawer?: () => void }

export function LivePanel() {
  const { tenant, profile } = useTenantStore()
  const tenantId = tenant?.id || profile?.tenant_id
  const ctx = useOutletContext<OutletCtx>() || {}

  const [logs, setLogs] = useState<ServiceLogWithDetails[]>([])
  const [barbers, setBarbers] = useState<Profile[]>([])
  const [loading, setLoading] = useState(true)
  const [highlightBarberId, setHighlightBarberId] = useState<string | null>(null)
  const [currentDate, setCurrentDate] = useState<string>('')
  const [expenses, setExpenses] = useState<DailyExpense[]>([])
  const [showExpenseModal, setShowExpenseModal] = useState(false)
  const [expenseForm, setExpenseForm] = useState({ description: '', amount: '' })
  const [savingExpense, setSavingExpense] = useState(false)
  const isMounted = useRef(true)

  // Totals
  const totalDay = logs.reduce((sum, log) => sum + log.price_charged, 0)
  const ownerEarning = logs.reduce((sum, log) => sum + log.owner_earning, 0)
  const totalServices = logs.length

  // Per-barber stats
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
      ? (Date.now() - new Date(lastServiceAt).getTime()) < 60 * 60 * 1000
      : false

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
      lastServiceAt,
      isActive,
      highlight: highlightBarberId === barber.id,
      appointments
    }
  })

  const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0)
  const totalBarberEarningsExTips = logs.reduce((sum, log) => sum + log.barber_earning - (log.tip_amount ?? 0), 0)
  const totalOthers = logs.reduce((sum, log) => sum + (log.others_amount ?? 0), 0)

  // Real "barberos activos X de Y" — based on existing isActive (had a service in last hour).
  const activeBarbersCount = barberStats.filter(s => s.isActive).length
  const totalBarbersCount = barbers.length

  // Real average ticket
  const avgTicket = totalServices > 0 ? Math.round(totalDay / totalServices) : 0

  const loadInitialData = useCallback(async () => {
    if (!tenantId) {
      if (isMounted.current) setLoading(false)
      return
    }
    if (isMounted.current) setLoading(true)

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
        .order('display_name')

      if (barbersError) throw barbersError
      if (isMounted.current) setBarbers(barbersData || [])

      const { data: expensesData } = await supabase
        .from('daily_expenses')
        .select('*')
        .eq('tenant_id', tenantId)
        .eq('expense_date', targetArgentina)
        .order('created_at', { ascending: true })
      if (isMounted.current) setExpenses(expensesData || [])
    } catch (error) {
      console.error('Error loading initial data:', error)
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
      const todayArgentina = getArgentinaDateString()
      if (currentDate && currentDate !== todayArgentina) {
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

  const isPostMidnight = (() => {
    const h = parseInt(new Date().toLocaleString('en-US', {
      hour: 'numeric', hour12: false,
      timeZone: 'America/Argentina/Buenos_Aires'
    }))
    return h >= 0 && h < 6
  })()

  if (loading) {
    return (
      <div style={{ padding: '24px', color: '#0F172A', textAlign: 'center', fontSize: '14px' }}>
        Cargando panel en vivo...
      </div>
    )
  }

  // Build a smooth SVG curve for the hero
  const heroCurve = "M0,90 C40,80 80,30 130,40 C180,50 220,90 270,75 C320,60 360,20 410,25"

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
    heroNumber: 'clamp(34px, 11.79vw, 46px)',      // 46px @390
    heroNeutralPill: 'clamp(10px, 3.08vw, 12px)',  // 12px @390
    metricLabel: 'clamp(9px, 2.82vw, 11px)',       // 11px @390 (min 9px @320)
    metricNumber: 'clamp(13px, 4.1vw, 16px)',      // 16px @390
    metricSub: 'clamp(9px, 2.56vw, 10px)',         // 10px @390
    sectionTitle: 'clamp(14px, 4.1vw, 16px)',      // 16px @390
    sectionLink: 'clamp(11px, 3.33vw, 13px)',      // 13px @390
    insightKicker: 'clamp(10px, 2.82vw, 11px)',    // 11px @390
    insightTitle: 'clamp(13px, 3.59vw, 14px)',     // 14px @390
    insightBody: 'clamp(11px, 3.33vw, 13px)',      // 13px @390
  }

  return (
    <div style={{ maxWidth: '430px', margin: '0 auto', width: '100%', boxSizing: 'border-box', overflowX: 'hidden' }}>
      {/* Aviso de gracia (suscripción vencida) — primer elemento del contenido */}
      <GraceBanner style={{ margin: '12px 16px 0' }} />

      {/* Top header (mobile) */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px 8px' }}>
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
              {tenant?.name || 'Tu barbería'} <span aria-hidden="true">💈</span>
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
                ? <>¡Buenos días, <span style={{ fontWeight: 500, color: '#2563EB' }}>{greetingName}</span>! <span aria-hidden="true">👋</span></>
                : <>¡Buenos días! <span aria-hidden="true">👋</span></>}
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0, marginLeft: '8px' }}>
          <button
            aria-label="Notificaciones"
            style={{
              position: 'relative',
              background: '#fff',
              border: '1px solid #E2E8F0',
              borderRadius: '50%',
              width: '36px',
              height: '36px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              padding: 0,
            }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <path d="M6 8a6 6 0 1 1 12 0c0 5 2 6 2 7H4c0-1 2-2 2-7z" stroke="#475569" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M10 19a2 2 0 0 0 4 0" stroke="#475569" strokeWidth="1.6" strokeLinecap="round"/>
            </svg>
            <span style={{
              position: 'absolute',
              top: '8px',
              right: '9px',
              width: '7px',
              height: '7px',
              borderRadius: '50%',
              background: '#2563EB',
              border: '1.5px solid #fff',
            }} aria-hidden="true" />
          </button>
          <button
            aria-label="Mensajes"
            style={{
              background: '#fff',
              border: '1px solid #E2E8F0',
              borderRadius: '50%',
              width: '36px',
              height: '36px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              padding: 0,
            }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <path d="M4 6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H9l-4 4V6z" stroke="#475569" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
        </div>
      </div>

      {/* Open/closed status */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 16px 24px', gap: '8px' }}>
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
            {isOpen ? 'Abierto' : 'Cerrado'}
            <span style={{ color: '#64748B' }}>
              {' · '}
              {isOpen ? `Cierra a las ${formatClosing(closingTime)}` : `Abre a las ${formatClosing(openingTime)}`}
            </span>
          </span>
        </div>
        <span style={{
          fontSize: fs.stateLink,
          color: '#2563EB',
          fontWeight: 600,
          display: 'inline-flex',
          alignItems: 'center',
          gap: '2px',
          flexShrink: 0,
        }}>
          Ver horario
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M9 6l6 6-6 6" stroke="#2563EB" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
      </div>

      {/* Hero: blue gradient with curve — 358×180 @390 */}
      <div style={{ margin: '0 16px' }}>
        <div style={{
          position: 'relative',
          borderRadius: '20px',
          padding: '18px',
          minHeight: '180px',
          background: 'linear-gradient(135deg, #3B82F6 0%, #2563EB 55%, #1D4ED8 100%)',
          color: '#fff',
          overflow: 'hidden',
          boxShadow: '0 10px 30px rgba(37, 99, 235, 0.30)',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          boxSizing: 'border-box',
        }}>
          {/* Decorative curve */}
          <svg
            viewBox="0 0 430 110"
            preserveAspectRatio="none"
            style={{ position: 'absolute', left: 0, right: 0, bottom: 0, width: '100%', height: '110px', opacity: 0.7, pointerEvents: 'none' }}
            aria-hidden="true"
          >
            <defs>
              <linearGradient id="heroCurveGradient" x1="0" y1="1" x2="1" y2="0">
                <stop offset="0%" stopColor="rgba(255,255,255,0)" />
                <stop offset="100%" stopColor="rgba(255,255,255,0.55)" />
              </linearGradient>
            </defs>
            <path d={heroCurve} stroke="url(#heroCurveGradient)" strokeWidth="2" fill="none" />
            <path d={`${heroCurve} L 430 110 L 0 110 Z`} fill="rgba(255,255,255,0.08)" />
          </svg>

          <div style={{ position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: fs.heroLabel, color: '#fff', fontWeight: 600 }}>
                <span>Facturación hoy</span>
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
                <span>Hoy</span>
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path d="M6 9l6 6 6-6" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
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

          <div style={{ position: 'relative', zIndex: 1, marginTop: '8px' }}>
            <span style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: fs.heroNeutralPill,
              fontWeight: 600,
              color: '#fff',
              background: 'rgba(255,255,255,0.20)',
              padding: '5px 12px',
              borderRadius: '999px',
              border: '1px solid rgba(255,255,255,0.28)',
            }}>
              <span style={{
                width: '6px',
                height: '6px',
                borderRadius: '50%',
                background: '#22C55E',
                display: 'inline-block',
                boxShadow: '0 0 0 3px rgba(34,197,94,0.25)',
              }} aria-hidden="true" />
              En tiempo real
            </span>
          </div>
        </div>
      </div>

      {/* 4 metric cards — horizontal row, fits in 390, scrolls only if narrower */}
      <div style={{ padding: '20px 0 0' }}>
        <div
          style={{
            display: 'flex',
            flexDirection: 'row',
            gap: '8px',
            overflowX: 'auto',
            overflowY: 'hidden',
            padding: '4px 16px',
            WebkitOverflowScrolling: 'touch',
            scrollbarWidth: 'none',
          }}
        >
          <MetricCard
            iconBg="#2563EB"
            label="Servicios hoy"
            value={totalServices.toString()}
            sub="En vivo"
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
            label="Ganancia hoy"
            value={`$${ownerEarning.toLocaleString()}`}
            sub="En vivo"
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
            sub={`de ${totalBarbersCount}`}
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
            value={totalServices > 0 ? `$${avgTicket.toLocaleString()}` : '$0'}
            sub="Por servicio"
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

      {/* Barberos en tiempo real */}
      <div style={{ padding: '24px 16px 0' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '12px' }}>
          <h2 style={{
            fontFamily: 'Syne, sans-serif',
            fontWeight: 700,
            fontSize: fs.sectionTitle,
            color: '#0F172A',
            margin: 0,
          }}>
            Barberos en tiempo real
          </h2>
          <span style={{ fontSize: fs.sectionLink, color: '#2563EB', fontWeight: 600 }}>Ver todos</span>
        </div>
        {barberStats.length === 0 ? (
          <div style={{ background: '#fff', borderRadius: '16px', padding: '24px', textAlign: 'center', color: '#64748B', border: '1px solid #F1F5F9' }}>
            <p style={{ fontSize: '14px', margin: '0 0 4px 0' }}>No hay barberos</p>
            <p style={{ fontSize: '12px', margin: 0, color: '#94A3B8' }}>Agrega barberos en la configuración</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {barberStats.map((stats) => (
              <ExpandableBarberCard key={stats.barber.id} stats={stats} />
            ))}
          </div>
        )}
      </div>

      {/* Gastos del día */}
      <div style={{ padding: '20px 16px 0' }}>
        <div style={{ background: '#fff', border: '1px solid #F1F5F9', borderRadius: '16px', padding: '16px', boxShadow: '0 1px 2px rgba(15,23,42,0.04)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: expenses.length > 0 ? '12px' : '0' }}>
            <h2 style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 'clamp(13px, 3.59vw, 14px)', color: '#0F172A', margin: 0 }}>Gastos del día</h2>
            <button
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

      {/* Insight card — LAST. 358×78 base (grows for text), padding 16, lavender bg.
          Square chart icon on the left + neutral copy + 3D bars + ✨ on the right. */}
      <div style={{ padding: '24px 16px 0' }}>
        <div style={{
          background: 'linear-gradient(135deg, #EEF2FF 0%, #E0E7FF 60%, #C7D2FE 100%)',
          borderRadius: '20px',
          padding: '16px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '12px',
          boxShadow: '0 6px 18px rgba(99, 102, 241, 0.12)',
          overflow: 'hidden',
          position: 'relative',
          minHeight: '78px',
        }}>
          {/* Left: square chart icon */}
          <div style={{
            width: '40px',
            height: '40px',
            borderRadius: '10px',
            background: 'linear-gradient(135deg, #6366F1, #4338CA)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            boxShadow: '0 4px 10px rgba(67, 56, 202, 0.30)',
          }} aria-hidden="true">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
              <path d="M4 19V5" stroke="#fff" strokeWidth="1.8" strokeLinecap="round"/>
              <path d="M4 19h16" stroke="#fff" strokeWidth="1.8" strokeLinecap="round"/>
              <rect x="7" y="12" width="2.5" height="5" rx="0.5" fill="#fff"/>
              <rect x="11" y="9" width="2.5" height="8" rx="0.5" fill="#fff"/>
              <rect x="15" y="6" width="2.5" height="11" rx="0.5" fill="#fff"/>
            </svg>
          </div>

          {/* Middle: text */}
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{
              fontFamily: 'Syne, sans-serif',
              fontSize: fs.insightTitle,
              fontWeight: 700,
              color: '#1E1B4B',
              lineHeight: 1.25,
            }}>
              ¡Vas excelente! <span aria-hidden="true">🚀</span>
            </div>
            <div style={{
              fontSize: fs.insightBody,
              fontWeight: 400,
              color: '#3730A3',
              marginTop: '2px',
              opacity: 0.92,
              lineHeight: 1.35,
            }}>
              Datos actualizados en tiempo real
            </div>
          </div>

          {/* Right: 3D ascending bars + ✨ */}
          <div style={{ flexShrink: 0, position: 'relative', width: '88px', height: '64px' }} aria-hidden="true">
            <svg width="88" height="64" viewBox="0 0 88 64" fill="none">
              <defs>
                <linearGradient id="bar3dGrad1" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#A5B4FC" />
                  <stop offset="100%" stopColor="#6366F1" />
                </linearGradient>
                <linearGradient id="bar3dGrad2" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#818CF8" />
                  <stop offset="100%" stopColor="#4F46E5" />
                </linearGradient>
                <linearGradient id="bar3dGrad3" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#6366F1" />
                  <stop offset="100%" stopColor="#4338CA" />
                </linearGradient>
                <linearGradient id="bar3dGrad4" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#4F46E5" />
                  <stop offset="100%" stopColor="#312E81" />
                </linearGradient>
                <linearGradient id="barSideGrad" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor="rgba(49, 46, 129, 0.55)" />
                  <stop offset="100%" stopColor="rgba(49, 46, 129, 0.20)" />
                </linearGradient>
              </defs>

              {/* Ground shadow */}
              <ellipse cx="44" cy="60" rx="38" ry="2.5" fill="rgba(49, 46, 129, 0.18)" />

              {/* Bar 1 (shortest) */}
              <g>
                <polygon points="6,58 11,53 11,40 6,45" fill="url(#barSideGrad)" />
                <polygon points="6,45 11,40 21,40 16,45" fill="rgba(255,255,255,0.5)" />
                <rect x="6" y="45" width="10" height="13" rx="1.5" fill="url(#bar3dGrad1)" />
              </g>

              {/* Bar 2 */}
              <g>
                <polygon points="24,58 29,53 29,32 24,37" fill="url(#barSideGrad)" />
                <polygon points="24,37 29,32 39,32 34,37" fill="rgba(255,255,255,0.55)" />
                <rect x="24" y="37" width="10" height="21" rx="1.5" fill="url(#bar3dGrad2)" />
              </g>

              {/* Bar 3 */}
              <g>
                <polygon points="42,58 47,53 47,22 42,27" fill="url(#barSideGrad)" />
                <polygon points="42,27 47,22 57,22 52,27" fill="rgba(255,255,255,0.60)" />
                <rect x="42" y="27" width="10" height="31" rx="1.5" fill="url(#bar3dGrad3)" />
              </g>

              {/* Bar 4 (tallest) */}
              <g>
                <polygon points="60,58 65,53 65,12 60,17" fill="url(#barSideGrad)" />
                <polygon points="60,17 65,12 75,12 70,17" fill="rgba(255,255,255,0.65)" />
                <rect x="60" y="17" width="10" height="41" rx="1.5" fill="url(#bar3dGrad4)" />
              </g>

              {/* Ascending trend line */}
              <path
                d="M11 47 L 29 38 L 47 28 L 65 18"
                stroke="#312E81"
                strokeWidth="1.6"
                strokeLinecap="round"
                fill="none"
                opacity="0.75"
              />
              {/* Arrow head at the tip */}
              <path
                d="M65 18 L 61 17 M 65 18 L 64 22"
                stroke="#312E81"
                strokeWidth="1.6"
                strokeLinecap="round"
                fill="none"
                opacity="0.85"
              />
              <circle cx="65" cy="18" r="2.2" fill="#312E81" />

              {/* Sparkle */}
              <g transform="translate(80, 8)" opacity="0.95">
                <path d="M0 -4 L 1 -1 L 4 0 L 1 1 L 0 4 L -1 1 L -4 0 L -1 -1 Z" fill="#FACC15" />
              </g>
            </svg>
          </div>
        </div>
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

/* Internal metric card — 82×105 @390, padding 10, radius 16. White bg + 32×32 colored
   icon square. No progress bars, no "Objetivo" copy. */
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
    <div style={{
      background: '#fff',
      borderRadius: '16px',
      padding: '10px',
      border: '1px solid #F1F5F9',
      boxShadow: '0 1px 2px rgba(15,23,42,0.04)',
      display: 'flex',
      flexDirection: 'column',
      gap: '6px',
      // Fluid width: ~82px @390 (4 cards + 3 gaps + 32px padding ≈ 390)
      // Use percentage minus gap allowance so 4 cards fit holgado @390.
      width: 'calc((100% - 24px) / 4)',
      minWidth: '78px',
      maxWidth: '110px',
      flexShrink: 0,
      boxSizing: 'border-box',
      minHeight: '105px',
    }}>
      <div style={{
        width: '32px',
        height: '32px',
        borderRadius: '10px',
        background: iconBg,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
      }}>
        {icon}
      </div>
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
      }}>
        {value}
      </div>
      <div style={{
        fontSize: subSize,
        color: '#94A3B8',
        fontWeight: 400,
        whiteSpace: 'normal',
        overflowWrap: 'break-word',
        lineHeight: 1.15,
        marginTop: 'auto',
      }}>
        {sub}
      </div>
    </div>
  )
}
