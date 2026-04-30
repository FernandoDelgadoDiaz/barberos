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
  const isMounted = useRef(true)

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
  const totalBarberEarnings = barberStats.reduce((sum, s) => sum + s.barberEarnings, 0)

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

      const { data: expensesData } = await supabase
        .from('daily_expenses')
        .select('*')
        .eq('tenant_id', tenantId)
        .eq('expense_date', todayArgentina)
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
      const argToday = getArgentinaDateString()
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

  if (loading) {
    return (
      <div style={{ maxWidth: '1000px', margin: '0 auto', padding: '24px', color: '#1a1a2e', textAlign: 'center' }}>
        Cargando panel en vivo...
      </div>
    )
  }

  return (
    <div style={{ maxWidth: '1000px', margin: '0 auto', position: 'relative', padding: '8px' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
        <div>
          <h1 style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: '22px', color: '#1a1a2e', margin: 0 }}>Panel en vivo</h1>
          <p style={{ color: '#888', fontSize: '13px', margin: '2px 0 0 0' }}>{tenant?.name || 'Tu barbería'} • Monitoreo en tiempo real</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ background: '#FF8C42', color: '#fff', fontSize: '11px', padding: '4px 10px', borderRadius: '20px', fontWeight: 500 }}>● EN VIVO</span>
        </div>
      </div>

      {/* Stats row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', marginBottom: '20px', marginTop: '20px' }}>
        <div style={{ background: '#fff', borderRadius: '10px', padding: '16px', border: '0.5px solid #e0e0e0', position: 'relative' }}>
          <div style={{ fontSize: '11px', color: '#888', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '6px' }}>Total del día</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{ fontSize: '22px', fontWeight: 500, color: '#1a1a2e' }}>${totalDay.toLocaleString()}</div>
            <button
              onClick={() => setShowPaymentBreakdown(prev => !prev)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '2px', color: '#888', display: 'flex', alignItems: 'center' }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path strokeLinecap="round" strokeLinejoin="round" d={showPaymentBreakdown ? 'M18 15l-6-6-6 6' : 'M6 9l6 6 6-6'} />
              </svg>
            </button>
          </div>
          {showPaymentBreakdown && (
            <div style={{
              position: 'absolute',
              top: '100%',
              left: 0,
              right: 0,
              marginTop: '4px',
              background: '#fff',
              border: '0.5px solid #e0e0e0',
              borderRadius: '8px',
              padding: '12px',
              boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
              zIndex: 10,
            }}>
              <div style={{ fontSize: '13px', color: '#555', marginBottom: '6px' }}>💵 Efectivo: <strong>${efectivoTotal.toLocaleString()}</strong></div>
              <div style={{ fontSize: '13px', color: '#555' }}>📲 Transferencia: <strong>${transferenciaTotal.toLocaleString()}</strong></div>
            </div>
          )}
        </div>
        <div style={{ background: '#fff', borderRadius: '10px', padding: '16px', border: '0.5px solid #e0e0e0' }}>
          <div style={{ fontSize: '11px', color: '#888', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '6px' }}>Tu ganancia</div>
          <div style={{ fontSize: '22px', fontWeight: 500, color: '#FF8C42' }}>${ownerEarning.toLocaleString()}</div>
        </div>
        <div style={{ background: '#fff', borderRadius: '10px', padding: '16px', border: '0.5px solid #e0e0e0' }}>
          <div style={{ fontSize: '11px', color: '#888', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '6px' }}>Servicios</div>
          <div style={{ fontSize: '22px', fontWeight: 500, color: '#1a1a2e' }}>{totalServices}</div>
          <div style={{ height: '3px', background: '#f0f0f0', borderRadius: '2px', marginTop: '8px', overflow: 'hidden' }}>
            <div style={{ width: `${dayProgress}%`, height: '100%', background: 'linear-gradient(90deg, #3D3A8C, #FF8C42)', borderRadius: '2px', transition: 'width 0.5s ease' }} />
          </div>
          <div style={{ fontSize: '10px', color: '#aaa', marginTop: '4px' }}>{statusText}</div>
        </div>
      </div>

      {/* Barbers list */}
      <div style={{ background: '#fff', borderRadius: '10px', padding: '20px', border: '0.5px solid #e0e0e0', marginBottom: '16px' }}>
        <h2 style={{ fontFamily: 'Syne, sans-serif', fontWeight: 600, fontSize: '14px', color: '#888', textTransform: 'uppercase', letterSpacing: '0.5px', margin: '0 0 16px 0' }}>Tu equipo</h2>

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
          <div style={{ marginTop: '20px', paddingTop: '20px', borderTop: '0.5px solid #f0f0f0', color: '#aaa', fontSize: '12px', textAlign: 'center' }}>
            <p>Esperando el primer servicio del día...</p>
          </div>
        )}

        {logs.length > 0 && (
          <div style={{ marginTop: '20px', paddingTop: '20px', borderTop: '0.5px solid #f0f0f0', color: '#aaa', fontSize: '12px', textAlign: 'center' }}>
            <p>Actualizado en tiempo real • Último servicio: {new Date(logs[0].started_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
          </div>
        )}
      </div>

      {/* Expenses section */}
      <div style={{ background: '#fff', border: '0.5px solid #e0e0e0', borderRadius: '10px', padding: '20px', marginBottom: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: expenses.length > 0 ? '12px' : '0' }}>
          <h2 style={{ fontFamily: 'Syne, sans-serif', fontWeight: 600, fontSize: '14px', color: '#888', textTransform: 'uppercase', letterSpacing: '0.5px', margin: 0 }}>GASTOS DEL DÍA</h2>
          <button
            onClick={() => setShowExpenseModal(true)}
            style={{ background: 'var(--primary)', color: '#fff', border: 'none', borderRadius: '6px', padding: '8px 16px', fontSize: '13px', cursor: 'pointer' }}
          >
            ＋ Agregar gasto
          </button>
        </div>
        {expenses.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {expenses.map(expense => (
              <div key={expense.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px' }}>
                <span style={{ color: '#444' }}>{expense.description}</span>
                <span style={{ color: '#e74c3c', fontWeight: 500 }}>-${expense.amount.toLocaleString()}</span>
              </div>
            ))}
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', fontWeight: 700, borderTop: '0.5px solid #f0f0f0', paddingTop: '8px', marginTop: '4px' }}>
              <span style={{ color: '#1a1a2e' }}>Total gastos</span>
              <span style={{ color: '#e74c3c' }}>-${totalExpenses.toLocaleString()}</span>
            </div>
          </div>
        )}
      </div>

      {/* Settlement summary */}
      {barberStats.length > 0 && logs.length > 0 && (
        <div style={{ background: '#3D3A8C', borderRadius: '10px', padding: '20px' }}>
          <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '12px' }}>
            Liquidación del día
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '8px', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
              <span style={{ fontSize: '13px', color: 'rgba(255,255,255,0.7)' }}>Total Barbería</span>
              <span style={{ fontSize: '14px', fontWeight: 500, color: '#fff' }}>${totalDay.toLocaleString()}</span>
            </div>
            {barberStats.map((stats) => (
              <div key={stats.barber.id} style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '8px', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                <span style={{ fontSize: '13px', color: 'rgba(255,255,255,0.7)' }}>{stats.barber.display_name}</span>
                <span style={{ fontSize: '14px', fontWeight: 500, color: '#fff' }}>${stats.barberEarnings.toLocaleString()}</span>
              </div>
            ))}
            {totalExpenses > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '8px' }}>
                <span style={{ fontSize: '13px', color: 'rgba(255,255,255,0.7)' }}>Insumos del día</span>
                <span style={{ fontSize: '14px', fontWeight: 500, color: '#FF6B6B' }}>-${totalExpenses.toLocaleString()}</span>
              </div>
            )}
            <div style={{ borderTop: '1px solid rgba(255,255,255,0.2)', paddingTop: '12px', display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '14px', color: '#fff', fontWeight: 600 }}>Ganancia real del dueño</span>
              <span style={{ fontSize: '18px', fontWeight: 700, color: '#FF8C42' }}>${(totalDay - totalBarberEarnings - totalExpenses).toLocaleString()}</span>
            </div>
          </div>
        </div>
      )}

      {/* Expense modal */}
      {showExpenseModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
          <div style={{ background: '#fff', border: '0.5px solid #e0e0e0', borderRadius: '12px', padding: '32px', maxWidth: '400px', width: '90%', color: '#1a1a2e' }}>
            <h3 style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: '18px', color: '#1a1a2e', margin: '0 0 24px 0' }}>Agregar gasto</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginBottom: '24px' }}>
              <input
                type="text"
                placeholder="Ej: Shampoo, toallas, etc."
                value={expenseForm.description}
                onChange={e => setExpenseForm(prev => ({ ...prev, description: e.target.value }))}
                style={{ border: '0.5px solid #e0e0e0', borderRadius: '8px', padding: '12px', fontSize: '14px', outline: 'none', backgroundColor: '#f8f8f8', color: '#1a1a2e', width: '100%', boxSizing: 'border-box' }}
              />
              <input
                type="number"
                placeholder="0"
                value={expenseForm.amount}
                onChange={e => setExpenseForm(prev => ({ ...prev, amount: e.target.value }))}
                style={{ border: '0.5px solid #e0e0e0', borderRadius: '8px', padding: '12px', fontSize: '14px', outline: 'none', backgroundColor: '#f8f8f8', color: '#1a1a2e', width: '100%', boxSizing: 'border-box' }}
              />
            </div>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button
                onClick={() => { setShowExpenseModal(false); setExpenseForm({ description: '', amount: '' }) }}
                style={{ background: 'none', border: '0.5px solid #e0e0e0', borderRadius: '8px', padding: '10px 20px', fontSize: '14px', cursor: 'pointer', color: '#666' }}
              >
                Cancelar
              </button>
              <button
                onClick={handleAddExpense}
                disabled={savingExpense}
                style={{ background: 'var(--primary)', color: '#fff', border: 'none', borderRadius: '8px', padding: '10px 20px', fontSize: '14px', cursor: savingExpense ? 'not-allowed' : 'pointer', opacity: savingExpense ? 0.7 : 1 }}
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
  )
}