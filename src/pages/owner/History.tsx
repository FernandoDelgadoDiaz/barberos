import { useEffect, useMemo, useState, useCallback } from 'react'
import { useTenantStore } from '../../stores/tenantStore'
import { supabase } from '../../config/supabase'
import type { ServiceLog, DailyExpense } from '../../types'

// =============================================================================
// Date helpers — Argentina timezone (UTC-3, no DST since 2009)
// =============================================================================
function getArgentinaDateString(date: Date = new Date()): string {
  return date.toLocaleDateString('en-CA', {
    timeZone: 'America/Argentina/Buenos_Aires',
  })
}

function getArgentinaDayRangeUTC(date: Date = new Date()): {
  startUTC: string
  endUTC: string
} {
  const argDate = getArgentinaDateString(date)
  const startUTC = `${argDate}T03:00:00.000Z`
  const nextDay = new Date(date)
  nextDay.setDate(nextDay.getDate() + 1)
  const argNextDate = getArgentinaDateString(nextDay)
  const endUTC = `${argNextDate}T02:59:59.999Z`
  return { startUTC, endUTC }
}

function getArgentinaRangeUTC(startDate: string, endDate: string): {
  startUTC: string
  endUTC: string
} {
  // startDate / endDate are 'YYYY-MM-DD' in Argentina time
  const startUTC = `${startDate}T03:00:00.000Z`
  // End of endDate Argentina = 02:59:59.999Z of the NEXT day
  const [y, m, d] = endDate.split('-').map(Number)
  const next = new Date(Date.UTC(y, m - 1, d))
  next.setUTCDate(next.getUTCDate() + 1)
  const yy = next.getUTCFullYear()
  const mm = String(next.getUTCMonth() + 1).padStart(2, '0')
  const dd = String(next.getUTCDate()).padStart(2, '0')
  const endUTC = `${yy}-${mm}-${dd}T02:59:59.999Z`
  return { startUTC, endUTC }
}

function addDaysISO(isoDate: string, delta: number): string {
  const [y, m, d] = isoDate.split('-').map(Number)
  const dt = new Date(Date.UTC(y, m - 1, d))
  dt.setUTCDate(dt.getUTCDate() + delta)
  const yy = dt.getUTCFullYear()
  const mm = String(dt.getUTCMonth() + 1).padStart(2, '0')
  const dd = String(dt.getUTCDate()).padStart(2, '0')
  return `${yy}-${mm}-${dd}`
}

function getMondayOfWeek(isoDate: string): string {
  const [y, m, d] = isoDate.split('-').map(Number)
  const dt = new Date(Date.UTC(y, m - 1, d))
  const dow = dt.getUTCDay() // 0 = Sun, 1 = Mon ... 6 = Sat
  const diff = dow === 0 ? -6 : 1 - dow
  dt.setUTCDate(dt.getUTCDate() + diff)
  const yy = dt.getUTCFullYear()
  const mm = String(dt.getUTCMonth() + 1).padStart(2, '0')
  const dd = String(dt.getUTCDate()).padStart(2, '0')
  return `${yy}-${mm}-${dd}`
}

function getFirstOfMonth(isoDate: string): string {
  const [y, m] = isoDate.split('-').map(Number)
  return `${y}-${String(m).padStart(2, '0')}-01`
}

function diffDaysInclusive(startISO: string, endISO: string): number {
  const [ys, ms, ds] = startISO.split('-').map(Number)
  const [ye, me, de] = endISO.split('-').map(Number)
  const a = Date.UTC(ys, ms - 1, ds)
  const b = Date.UTC(ye, me - 1, de)
  return Math.round((b - a) / 86_400_000) + 1
}

function formatDateLong(isoDate: string): string {
  const [y, m, d] = isoDate.split('-').map(Number)
  const dt = new Date(Date.UTC(y, m - 1, d, 12))
  return dt.toLocaleDateString('es-AR', {
    timeZone: 'America/Argentina/Buenos_Aires',
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  })
}

function formatDateShort(isoDate: string): string {
  const [y, m, d] = isoDate.split('-').map(Number)
  const dt = new Date(Date.UTC(y, m - 1, d, 12))
  return dt.toLocaleDateString('es-AR', {
    timeZone: 'America/Argentina/Buenos_Aires',
    day: '2-digit',
    month: '2-digit',
  })
}

function formatTimeAR(iso: string): string {
  return new Date(iso).toLocaleTimeString('es-AR', {
    timeZone: 'America/Argentina/Buenos_Aires',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
}

function getArgentinaDateFromUTC(iso: string): string {
  return new Date(iso).toLocaleDateString('en-CA', {
    timeZone: 'America/Argentina/Buenos_Aires',
  })
}

function fmtMoney(n: number): string {
  return `$${Math.round(n).toLocaleString('es-AR')}`
}

// =============================================================================
// Types
// =============================================================================
type ServiceLogWithBarber = ServiceLog & {
  barber_name: string
}

type ShortcutKey = 'today' | 'week' | 'fortnight' | 'month' | 'custom'

// =============================================================================
// Component
// =============================================================================
export function History() {
  const { tenant } = useTenantStore()
  const tenantId = tenant?.id

  const todayAR = useMemo(() => getArgentinaDateString(new Date()), [])

  const [mode, setMode] = useState<'day' | 'range'>('day')
  const [activeShortcut, setActiveShortcut] = useState<ShortcutKey>('today')
  const [selectedDate, setSelectedDate] = useState<string>(todayAR)
  const [rangeStart, setRangeStart] = useState<string>(todayAR)
  const [rangeEnd, setRangeEnd] = useState<string>(todayAR)

  const [logs, setLogs] = useState<ServiceLogWithBarber[]>([])
  const [expenses, setExpenses] = useState<DailyExpense[]>([])
  const [loading, setLoading] = useState(false)
  const [isMobile, setIsMobile] = useState(
    typeof window !== 'undefined' ? window.innerWidth <= 768 : false
  )

  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth <= 768)
    window.addEventListener('resize', handler)
    return () => window.removeEventListener('resize', handler)
  }, [])

  // ----------------------------------------------------------------------
  // Shortcut handlers
  // ----------------------------------------------------------------------
  const applyShortcut = (key: ShortcutKey) => {
    setActiveShortcut(key)
    const today = getArgentinaDateString(new Date())
    if (key === 'today') {
      setMode('day')
      setSelectedDate(today)
    } else if (key === 'week') {
      setMode('range')
      setRangeStart(getMondayOfWeek(today))
      setRangeEnd(today)
    } else if (key === 'fortnight') {
      setMode('range')
      setRangeStart(addDaysISO(today, -13))
      setRangeEnd(today)
    } else if (key === 'month') {
      setMode('range')
      setRangeStart(getFirstOfMonth(today))
      setRangeEnd(today)
    } else if (key === 'custom') {
      setMode('range')
      // Keep current range, defaulting to today→today if not set
      if (!rangeStart) setRangeStart(today)
      if (!rangeEnd) setRangeEnd(today)
    }
  }

  // ----------------------------------------------------------------------
  // Data loading
  // ----------------------------------------------------------------------
  const loadData = useCallback(async () => {
    if (!tenantId) return
    setLoading(true)
    try {
      let startUTC: string
      let endUTC: string
      let startDateAR: string
      let endDateAR: string

      if (mode === 'day') {
        const [y, m, d] = selectedDate.split('-').map(Number)
        const refDate = new Date(Date.UTC(y, m - 1, d, 15)) // noon-ish AR
        const range = getArgentinaDayRangeUTC(refDate)
        startUTC = range.startUTC
        endUTC = range.endUTC
        startDateAR = selectedDate
        endDateAR = selectedDate
      } else {
        // Validate / normalize range (start <= end)
        const s = rangeStart <= rangeEnd ? rangeStart : rangeEnd
        const e = rangeStart <= rangeEnd ? rangeEnd : rangeStart
        const range = getArgentinaRangeUTC(s, e)
        startUTC = range.startUTC
        endUTC = range.endUTC
        startDateAR = s
        endDateAR = e
      }

      type LogRow = ServiceLog & { profiles: { display_name: string } | null }

      const [logsRes, expensesRes] = await Promise.all([
        supabase
          .from('service_logs')
          .select('*, profiles:barber_id(display_name)')
          .eq('tenant_id', tenantId)
          .in('status', ['completed', 'closed'])
          .gte('created_at', startUTC)
          .lte('created_at', endUTC)
          .order('created_at', { ascending: false }),
        supabase
          .from('daily_expenses')
          .select('*')
          .eq('tenant_id', tenantId)
          .gte('expense_date', startDateAR)
          .lte('expense_date', endDateAR)
          .order('expense_date', { ascending: true }),
      ])

      if (logsRes.error) throw logsRes.error
      if (expensesRes.error) throw expensesRes.error

      const logsRows = (logsRes.data || []) as LogRow[]
      const mapped: ServiceLogWithBarber[] = logsRows.map((row) => ({
        ...row,
        barber_name: row.profiles?.display_name || 'Barbero',
      }))

      setLogs(mapped)
      setExpenses((expensesRes.data || []) as DailyExpense[])
    } catch (err) {
      console.error('Error loading history:', err)
      setLogs([])
      setExpenses([])
    } finally {
      setLoading(false)
    }
  }, [tenantId, mode, selectedDate, rangeStart, rangeEnd])

  useEffect(() => {
    loadData()
  }, [loadData])

  // ----------------------------------------------------------------------
  // Render
  // ----------------------------------------------------------------------
  return (
    <div style={{ maxWidth: '1000px', margin: '0 auto', padding: isMobile ? '4px' : '8px' }}>
      <Header
        mode={mode}
        activeShortcut={activeShortcut}
        selectedDate={selectedDate}
        rangeStart={rangeStart}
        rangeEnd={rangeEnd}
        isMobile={isMobile}
        onShortcut={applyShortcut}
        onSelectedDate={(v) => {
          setSelectedDate(v)
          setActiveShortcut('custom')
          setMode('day')
        }}
        onRangeStart={(v) => {
          setRangeStart(v)
          setActiveShortcut('custom')
          setMode('range')
        }}
        onRangeEnd={(v) => {
          setRangeEnd(v)
          setActiveShortcut('custom')
          setMode('range')
        }}
      />

      {loading ? (
        <LoadingSpinner />
      ) : logs.length === 0 && expenses.length === 0 ? (
        <EmptyState />
      ) : mode === 'day' ? (
        <DayView
          dateAR={selectedDate}
          logs={logs}
          expenses={expenses}
          isMobile={isMobile}
        />
      ) : (
        <RangeView
          startAR={rangeStart <= rangeEnd ? rangeStart : rangeEnd}
          endAR={rangeStart <= rangeEnd ? rangeEnd : rangeStart}
          logs={logs}
          expenses={expenses}
          isMobile={isMobile}
        />
      )}
    </div>
  )
}

// =============================================================================
// Header
// =============================================================================
type HeaderProps = {
  mode: 'day' | 'range'
  activeShortcut: ShortcutKey
  selectedDate: string
  rangeStart: string
  rangeEnd: string
  isMobile: boolean
  onShortcut: (k: ShortcutKey) => void
  onSelectedDate: (v: string) => void
  onRangeStart: (v: string) => void
  onRangeEnd: (v: string) => void
}

function Header({
  mode,
  activeShortcut,
  selectedDate,
  rangeStart,
  rangeEnd,
  isMobile,
  onShortcut,
  onSelectedDate,
  onRangeStart,
  onRangeEnd,
}: HeaderProps) {
  const shortcuts: { key: ShortcutKey; label: string }[] = [
    { key: 'today', label: 'Hoy' },
    { key: 'week', label: 'Esta semana' },
    { key: 'fortnight', label: 'Últimas 2 semanas' },
    { key: 'month', label: 'Este mes' },
    { key: 'custom', label: 'Personalizado' },
  ]

  return (
    <div style={{ marginBottom: '20px' }}>
      <h1
        style={{
          fontFamily: 'Syne, sans-serif',
          fontWeight: 700,
          fontSize: '22px',
          color: '#1E2A3A',
          margin: '0 0 4px 0',
        }}
      >
        Historial
      </h1>
      <p style={{ color: '#6B7280', fontSize: '13px', margin: '0 0 16px 0' }}>
        Consultá los servicios y gastos por día o rango
      </p>

      {/* Shortcut pills */}
      <div
        style={{
          display: 'flex',
          gap: '8px',
          flexWrap: 'wrap',
          marginBottom: '12px',
        }}
      >
        {shortcuts.map((s) => {
          const active = activeShortcut === s.key
          return (
            <button
              key={s.key}
              onClick={() => onShortcut(s.key)}
              style={{
                background: active ? '#1E2A3A' : '#fff',
                color: active ? '#fff' : '#6B7280',
                border: active ? '1px solid #1E2A3A' : '1px solid #E8E9EB',
                borderRadius: '20px',
                padding: '8px 16px',
                fontSize: '13px',
                fontWeight: 500,
                fontFamily: 'Space Grotesk, sans-serif',
                cursor: 'pointer',
                transition: 'all 150ms ease',
              }}
            >
              {s.label}
            </button>
          )
        })}
      </div>

      {/* Date inputs */}
      {mode === 'day' && activeShortcut === 'custom' && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <label style={{ fontSize: '12px', color: '#6B7280' }}>Fecha:</label>
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => onSelectedDate(e.target.value)}
            style={inputStyle}
          />
        </div>
      )}

      {mode === 'range' && activeShortcut === 'custom' && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <label style={{ fontSize: '12px', color: '#6B7280' }}>Desde:</label>
          <input
            type="date"
            value={rangeStart}
            onChange={(e) => onRangeStart(e.target.value)}
            style={inputStyle}
          />
          <label style={{ fontSize: '12px', color: '#6B7280' }}>Hasta:</label>
          <input
            type="date"
            value={rangeEnd}
            onChange={(e) => onRangeEnd(e.target.value)}
            style={inputStyle}
          />
        </div>
      )}

      {/* Active range label */}
      {mode === 'range' && activeShortcut !== 'custom' && (
        <div style={{ fontSize: '12px', color: '#6B7280', fontFamily: 'Space Grotesk, sans-serif' }}>
          {formatDateShort(rangeStart <= rangeEnd ? rangeStart : rangeEnd)} →{' '}
          {formatDateShort(rangeStart <= rangeEnd ? rangeEnd : rangeStart)}
        </div>
      )}
      {mode === 'day' && activeShortcut !== 'custom' && (
        <div
          style={{
            fontSize: '12px',
            color: '#6B7280',
            fontFamily: 'Space Grotesk, sans-serif',
            textTransform: 'capitalize',
          }}
        >
          {formatDateLong(selectedDate)}
        </div>
      )}

      {/* Suppress unused-prop warning for isMobile (kept for future use) */}
      <span style={{ display: 'none' }}>{isMobile ? '' : ''}</span>
    </div>
  )
}

const inputStyle: React.CSSProperties = {
  border: '1px solid #E8E9EB',
  borderRadius: '8px',
  padding: '8px 12px',
  fontSize: '13px',
  fontFamily: 'Space Grotesk, sans-serif',
  color: '#1E2A3A',
  background: '#fff',
  outline: 'none',
}

// =============================================================================
// Loading / Empty
// =============================================================================
function LoadingSpinner() {
  return (
    <div
      style={{
        maxWidth: '1000px',
        margin: '0 auto',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '240px',
        gap: '16px',
      }}
    >
      <style>{`@keyframes spinHist { to { transform: rotate(360deg) } }`}</style>
      <div
        style={{
          width: 40,
          height: 40,
          borderRadius: '50%',
          border: '3px solid #F3F4F6',
          borderTopColor: '#D4A853',
          animation: 'spinHist 0.8s linear infinite',
        }}
      />
      <p
        style={{
          fontSize: 14,
          color: '#9CA3AF',
          fontFamily: 'Space Grotesk, sans-serif',
          margin: 0,
        }}
      >
        Cargando historial...
      </p>
    </div>
  )
}

function EmptyState() {
  return (
    <div
      style={{
        background: '#fff',
        borderRadius: '12px',
        border: '1px solid #E8E9EB',
        padding: '60px 24px',
        textAlign: 'center',
        marginTop: '20px',
      }}
    >
      <svg
        width="48"
        height="48"
        viewBox="0 0 24 24"
        fill="none"
        stroke="#D4A853"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{ opacity: 0.6, margin: '0 auto 16px' }}
      >
        <rect x="3" y="4" width="18" height="18" rx="2" />
        <path d="M16 2v4M8 2v4M3 10h18" />
      </svg>
      <div
        style={{
          fontFamily: 'Syne, sans-serif',
          fontWeight: 600,
          fontSize: '18px',
          color: '#1E2A3A',
          marginBottom: '8px',
        }}
      >
        Sin registros para este período
      </div>
      <div
        style={{
          fontSize: '14px',
          color: '#6B7280',
          fontFamily: 'Space Grotesk, sans-serif',
        }}
      >
        Seleccioná otra fecha para consultar
      </div>
    </div>
  )
}

// =============================================================================
// Day View
// =============================================================================
type DayViewProps = {
  dateAR: string
  logs: ServiceLogWithBarber[]
  expenses: DailyExpense[]
  isMobile: boolean
}

function DayView({ dateAR, logs, expenses, isMobile }: DayViewProps) {
  // Aggregate totals
  const totalDay = logs.reduce((s, l) => s + (l.price_charged || 0), 0)
  const ownerEarning = logs.reduce((s, l) => s + (l.owner_earning || 0), 0)
  const totalExpenses = expenses.reduce((s, e) => s + (e.amount || 0), 0)
  const totalBarberEarningsExTips = logs.reduce(
    (s, l) => s + (l.barber_earning || 0) - (l.tip_amount || 0),
    0
  )

  // Unique appointments count
  const uniqueAppointments = new Set(
    logs.map((l) => l.appointment_id || `${l.barber_id}-${l.started_at}`)
  )
  const clientsCount = uniqueAppointments.size

  // Group logs by barber
  type BarberGroup = {
    barberId: string
    barberName: string
    logs: ServiceLogWithBarber[]
    totalGenerated: number
    barberEarning: number
    ownerEarning: number
    appointments: Map<string, ServiceLogWithBarber[]>
  }

  const barberMap = new Map<string, BarberGroup>()
  logs.forEach((log) => {
    let group = barberMap.get(log.barber_id)
    if (!group) {
      group = {
        barberId: log.barber_id,
        barberName: log.barber_name,
        logs: [],
        totalGenerated: 0,
        barberEarning: 0,
        ownerEarning: 0,
        appointments: new Map(),
      }
      barberMap.set(log.barber_id, group)
    }
    group.logs.push(log)
    group.totalGenerated += log.price_charged || 0
    group.barberEarning += log.barber_earning || 0
    group.ownerEarning += log.owner_earning || 0

    const key = log.appointment_id || `${log.barber_id}-${log.started_at}`
    const list = group.appointments.get(key) || []
    list.push(log)
    group.appointments.set(key, list)
  })

  const barberGroups = Array.from(barberMap.values()).sort(
    (a, b) => b.totalGenerated - a.totalGenerated
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div style={{ fontSize: '13px', color: '#6B7280', textTransform: 'capitalize' }}>
        {formatDateLong(dateAR)}
      </div>

      {/* Stats grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(4, 1fr)',
          gap: '12px',
        }}
      >
        <StatCard label="Total del día" value={fmtMoney(totalDay)} />
        <StatCard
          label="Ganancia dueño"
          value={fmtMoney(ownerEarning)}
          accent="#D4A853"
        />
        <StatCard label="Clientes" value={String(clientsCount)} />
        <StatCard
          label="Gastos"
          value={fmtMoney(totalExpenses)}
          accent={totalExpenses > 0 ? '#E74C3C' : undefined}
        />
      </div>

      {/* Barber breakdown */}
      {barberGroups.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {barberGroups.map((g) => (
            <BarberDayCard key={g.barberId} group={g} />
          ))}
        </div>
      )}

      {/* Expenses list */}
      {expenses.length > 0 && (
        <div
          style={{
            background: '#fff',
            borderRadius: '12px',
            border: '1px solid #E8E9EB',
            padding: '20px',
          }}
        >
          <div
            style={{
              fontFamily: 'Syne, sans-serif',
              fontWeight: 600,
              fontSize: '13px',
              color: '#6B7280',
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
              marginBottom: '12px',
            }}
          >
            Gastos del día
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {expenses.map((e) => (
              <div
                key={e.id}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  fontSize: '14px',
                }}
              >
                <span style={{ color: '#444' }}>{e.description}</span>
                <span style={{ color: '#E74C3C', fontWeight: 500 }}>
                  -{fmtMoney(e.amount)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Settlement summary */}
      {logs.length > 0 && (
        <div style={{ background: '#1E2A3A', borderRadius: '12px', padding: '20px' }}>
          <div
            style={{
              fontSize: '11px',
              color: 'rgba(255,255,255,0.5)',
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
              marginBottom: '12px',
            }}
          >
            Liquidación del día
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <RowDark label="Total Barbería" value={fmtMoney(totalDay)} />
            {barberGroups.map((g) => (
              <RowDark
                key={g.barberId}
                label={g.barberName}
                value={fmtMoney(g.barberEarning)}
              />
            ))}
            {totalExpenses > 0 && (
              <RowDark
                label="Insumos del día"
                value={`-${fmtMoney(totalExpenses)}`}
                valueColor="#FF6B6B"
              />
            )}
            <div
              style={{
                borderTop: '1px solid rgba(255,255,255,0.2)',
                paddingTop: '12px',
                display: 'flex',
                justifyContent: 'space-between',
                marginTop: '4px',
              }}
            >
              <span style={{ fontSize: '14px', color: '#fff', fontWeight: 600 }}>
                Ganancia real del dueño
              </span>
              <span style={{ fontSize: '18px', fontWeight: 700, color: '#D4A853' }}>
                {fmtMoney(totalDay - totalBarberEarningsExTips - totalExpenses)}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function StatCard({
  label,
  value,
  accent,
}: {
  label: string
  value: string
  accent?: string
}) {
  return (
    <div
      style={{
        background: '#fff',
        borderRadius: '12px',
        padding: '16px',
        border: '1px solid #E8E9EB',
      }}
    >
      <div
        style={{
          fontSize: '11px',
          color: '#6B7280',
          textTransform: 'uppercase',
          letterSpacing: '0.5px',
          marginBottom: '6px',
          fontFamily: 'Space Grotesk, sans-serif',
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontSize: '22px',
          fontWeight: 600,
          color: accent || '#1E2A3A',
          fontFamily: 'Syne, sans-serif',
        }}
      >
        {value}
      </div>
    </div>
  )
}

function RowDark({
  label,
  value,
  valueColor = '#fff',
}: {
  label: string
  value: string
  valueColor?: string
}) {
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        paddingBottom: '8px',
        borderBottom: '1px solid rgba(255,255,255,0.08)',
      }}
    >
      <span style={{ fontSize: '13px', color: 'rgba(255,255,255,0.7)' }}>{label}</span>
      <span style={{ fontSize: '14px', fontWeight: 500, color: valueColor }}>{value}</span>
    </div>
  )
}

// -----------------------------------------------------------------------------
// Barber day card with expandable client list
// -----------------------------------------------------------------------------
type BarberGroupView = {
  barberId: string
  barberName: string
  logs: ServiceLogWithBarber[]
  totalGenerated: number
  barberEarning: number
  ownerEarning: number
  appointments: Map<string, ServiceLogWithBarber[]>
}

function BarberDayCard({ group }: { group: BarberGroupView }) {
  const [expanded, setExpanded] = useState(false)
  const appointments = Array.from(group.appointments.entries())
    .map(([key, logs]) => ({
      key,
      logs: [...logs].sort(
        (a, b) =>
          new Date(a.started_at).getTime() - new Date(b.started_at).getTime()
      ),
    }))
    .sort(
      (a, b) =>
        new Date(a.logs[0].started_at).getTime() -
        new Date(b.logs[0].started_at).getTime()
    )

  return (
    <div
      style={{
        background: '#fff',
        borderRadius: '12px',
        border: '1px solid #E8E9EB',
        padding: '16px 20px',
      }}
    >
      <div
        onClick={() => setExpanded((v) => !v)}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          cursor: 'pointer',
          gap: '12px',
        }}
      >
        <div style={{ minWidth: 0, flex: 1 }}>
          <div
            style={{
              fontFamily: 'Syne, sans-serif',
              fontWeight: 600,
              fontSize: '16px',
              color: '#1E2A3A',
              marginBottom: '2px',
            }}
          >
            {group.barberName}
          </div>
          <div style={{ fontSize: '12px', color: '#6B7280' }}>
            {appointments.length} {appointments.length === 1 ? 'cliente' : 'clientes'} ·{' '}
            {fmtMoney(group.totalGenerated)} generado
          </div>
        </div>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '11px', color: '#6B7280', textTransform: 'uppercase' }}>
              Barbero
            </div>
            <div style={{ fontSize: '14px', fontWeight: 600, color: '#1E2A3A' }}>
              {fmtMoney(group.barberEarning)}
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '11px', color: '#6B7280', textTransform: 'uppercase' }}>
              Dueño
            </div>
            <div style={{ fontSize: '14px', fontWeight: 600, color: '#D4A853' }}>
              {fmtMoney(group.ownerEarning)}
            </div>
          </div>
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#6B7280"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{
              transform: expanded ? 'rotate(180deg)' : 'rotate(0)',
              transition: 'transform 150ms ease',
            }}
          >
            <path d="M6 9l6 6 6-6" />
          </svg>
        </div>
      </div>

      {expanded && appointments.length > 0 && (
        <div
          style={{
            marginTop: '16px',
            paddingTop: '12px',
            borderTop: '1px solid #F3F4F6',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
          }}
        >
          {appointments.map((a, idx) => {
            const total = a.logs.reduce((s, l) => s + (l.price_charged || 0), 0)
            const barberE = a.logs.reduce((s, l) => s + (l.barber_earning || 0), 0)
            const ownerE = a.logs.reduce((s, l) => s + (l.owner_earning || 0), 0)
            const time = formatTimeAR(a.logs[0].started_at)
            const payment = a.logs[0].payment_method || 'efectivo'
            return (
              <div
                key={a.key}
                style={{
                  background: '#FAFAFA',
                  borderRadius: '8px',
                  padding: '12px 14px',
                  border: '1px solid #F3F4F6',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'baseline',
                    marginBottom: '6px',
                  }}
                >
                  <div
                    style={{
                      fontSize: '13px',
                      fontWeight: 600,
                      color: '#1E2A3A',
                      fontFamily: 'Space Grotesk, sans-serif',
                    }}
                  >
                    Cliente #{idx + 1}
                  </div>
                  <div style={{ fontSize: '12px', color: '#6B7280' }}>
                    {time} · {payment === 'transferencia' ? 'Transferencia' : 'Efectivo'}
                  </div>
                </div>
                <div
                  style={{
                    fontSize: '12px',
                    color: '#6B7280',
                    marginBottom: '6px',
                  }}
                >
                  {a.logs.length} {a.logs.length === 1 ? 'servicio' : 'servicios'}
                </div>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    fontSize: '12px',
                    color: '#374151',
                  }}
                >
                  <span>Total: {fmtMoney(total)}</span>
                  <span>
                    Barbero: {fmtMoney(barberE)} · Dueño:{' '}
                    <span style={{ color: '#D4A853', fontWeight: 600 }}>
                      {fmtMoney(ownerE)}
                    </span>
                  </span>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// =============================================================================
// Range View
// =============================================================================
type RangeViewProps = {
  startAR: string
  endAR: string
  logs: ServiceLogWithBarber[]
  expenses: DailyExpense[]
  isMobile: boolean
}

function RangeView({ startAR, endAR, logs, expenses, isMobile }: RangeViewProps) {
  const days = diffDaysInclusive(startAR, endAR)
  const totalGenerated = logs.reduce((s, l) => s + (l.price_charged || 0), 0)
  const barberEarningsExTips = logs.reduce(
    (s, l) => s + (l.barber_earning || 0) - (l.tip_amount || 0),
    0
  )
  const totalExpenses = expenses.reduce((s, e) => s + (e.amount || 0), 0)
  const realOwnerNet = totalGenerated - barberEarningsExTips - totalExpenses

  const efectivoTotal = logs
    .filter((l) => (l.payment_method || 'efectivo') === 'efectivo')
    .reduce((s, l) => s + (l.price_charged || 0), 0)
  const transferenciaTotal = logs
    .filter((l) => l.payment_method === 'transferencia')
    .reduce((s, l) => s + (l.price_charged || 0), 0)

  const uniqueAppointments = new Set(
    logs.map((l) => l.appointment_id || `${l.barber_id}-${l.started_at}`)
  )
  const clientsCount = uniqueAppointments.size
  const servicesCount = logs.length

  // Build daily totals for chart
  const dayTotals = useMemo(() => {
    const m = new Map<string, number>()
    // initialize range with 0 to keep chart continuous
    for (let i = 0; i < days; i++) {
      m.set(addDaysISO(startAR, i), 0)
    }
    logs.forEach((l) => {
      const d = getArgentinaDateFromUTC(l.created_at)
      if (m.has(d)) m.set(d, (m.get(d) || 0) + (l.price_charged || 0))
    })
    return Array.from(m.entries()).map(([date, total]) => ({ date, total }))
  }, [logs, startAR, days])

  // Optionally group by week if range > 14 days
  const chartBuckets = useMemo(() => {
    if (days <= 14) {
      return dayTotals.map((d) => ({ label: formatDateShort(d.date), total: d.total, key: d.date }))
    }
    // group weekly: monday-anchored
    const weeks = new Map<string, { total: number; first: string; last: string }>()
    dayTotals.forEach(({ date, total }) => {
      const monday = getMondayOfWeek(date)
      const w = weeks.get(monday)
      if (w) {
        w.total += total
        if (date > w.last) w.last = date
        if (date < w.first) w.first = date
      } else {
        weeks.set(monday, { total, first: date, last: date })
      }
    })
    return Array.from(weeks.entries()).map(([k, v]) => ({
      key: k,
      label: `${formatDateShort(v.first)}-${formatDateShort(v.last)}`,
      total: v.total,
    }))
  }, [dayTotals, days])

  // Per-barber summary
  type BarberRow = {
    barberId: string
    barberName: string
    clients: Set<string>
    services: number
    generated: number
    earning: number
  }
  const barberRowsMap = new Map<string, BarberRow>()
  logs.forEach((l) => {
    let row = barberRowsMap.get(l.barber_id)
    if (!row) {
      row = {
        barberId: l.barber_id,
        barberName: l.barber_name,
        clients: new Set(),
        services: 0,
        generated: 0,
        earning: 0,
      }
      barberRowsMap.set(l.barber_id, row)
    }
    row.services += 1
    row.generated += l.price_charged || 0
    row.earning += l.barber_earning || 0
    row.clients.add(l.appointment_id || `${l.barber_id}-${l.started_at}`)
  })
  const barberRows = Array.from(barberRowsMap.values()).sort(
    (a, b) => b.generated - a.generated
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Hero summary */}
      <div
        style={{
          background: '#1E2A3A',
          borderRadius: '16px',
          padding: isMobile ? '24px' : '32px',
          color: '#fff',
        }}
      >
        <div
          style={{
            fontSize: '13px',
            color: 'rgba(255,255,255,0.6)',
            marginBottom: '12px',
            fontFamily: 'Space Grotesk, sans-serif',
          }}
        >
          {days} {days === 1 ? 'día' : 'días'} · {clientsCount}{' '}
          {clientsCount === 1 ? 'cliente' : 'clientes'} · {servicesCount}{' '}
          {servicesCount === 1 ? 'servicio' : 'servicios'}
        </div>
        <div
          style={{
            fontSize: '11px',
            color: 'rgba(255,255,255,0.4)',
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
            marginBottom: '4px',
          }}
        >
          Total generado
        </div>
        <div
          style={{
            fontFamily: 'Syne, sans-serif',
            fontWeight: 800,
            fontSize: isMobile ? '32px' : '44px',
            color: '#fff',
            lineHeight: 1.1,
          }}
        >
          {fmtMoney(totalGenerated)}
        </div>
        <div
          style={{
            marginTop: '12px',
            fontSize: '24px',
            fontWeight: 600,
            color: '#D4A853',
            fontFamily: 'Syne, sans-serif',
          }}
        >
          Ganancia neta dueño: {fmtMoney(realOwnerNet)}
        </div>
        <div
          style={{
            margin: '20px 0 0 0',
            paddingTop: '16px',
            borderTop: '1px solid rgba(255,255,255,0.15)',
            display: 'flex',
            gap: '24px',
            flexWrap: 'wrap',
            fontSize: '13px',
            color: 'rgba(255,255,255,0.7)',
          }}
        >
          <span>
            Efectivo:{' '}
            <strong style={{ color: '#fff' }}>{fmtMoney(efectivoTotal)}</strong>
          </span>
          <span>
            Transferencia:{' '}
            <strong style={{ color: '#fff' }}>{fmtMoney(transferenciaTotal)}</strong>
          </span>
        </div>
      </div>

      {/* Chart */}
      {chartBuckets.length > 0 && (
        <BarsChart buckets={chartBuckets} isMobile={isMobile} />
      )}

      {/* Executive table */}
      {barberRows.length > 0 && (
        <ExecutiveTable
          rows={barberRows}
          totalGenerated={totalGenerated}
          isMobile={isMobile}
        />
      )}

      {/* Payment + expenses + net */}
      <div
        style={{
          background: '#fff',
          borderRadius: '12px',
          border: '1px solid #E8E9EB',
          padding: '20px',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
        }}
      >
        <div
          style={{
            fontFamily: 'Syne, sans-serif',
            fontWeight: 600,
            fontSize: '13px',
            color: '#6B7280',
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
            marginBottom: '4px',
          }}
        >
          Desglose del período
        </div>
        <RowLight label="Total generado" value={fmtMoney(totalGenerated)} />
        <RowLight label="Efectivo" value={fmtMoney(efectivoTotal)} />
        <RowLight label="Transferencia" value={fmtMoney(transferenciaTotal)} />
        <RowLight
          label="Ganancia barberos"
          value={`-${fmtMoney(barberEarningsExTips)}`}
          valueColor="#6B7280"
        />
        <RowLight
          label="Gastos"
          value={`-${fmtMoney(totalExpenses)}`}
          valueColor={totalExpenses > 0 ? '#E74C3C' : '#6B7280'}
        />
        <div
          style={{
            borderTop: '1px solid #F3F4F6',
            paddingTop: '12px',
            marginTop: '4px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'baseline',
          }}
        >
          <span
            style={{
              fontSize: '14px',
              fontWeight: 600,
              color: '#1E2A3A',
              fontFamily: 'Syne, sans-serif',
            }}
          >
            Ganancia real neta dueño
          </span>
          <span
            style={{
              fontSize: '20px',
              fontWeight: 700,
              color: '#D4A853',
              fontFamily: 'Syne, sans-serif',
            }}
          >
            {fmtMoney(realOwnerNet)}
          </span>
        </div>
      </div>
    </div>
  )
}

function RowLight({
  label,
  value,
  valueColor = '#1E2A3A',
}: {
  label: string
  value: string
  valueColor?: string
}) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px' }}>
      <span style={{ color: '#6B7280' }}>{label}</span>
      <span style={{ color: valueColor, fontWeight: 500 }}>{value}</span>
    </div>
  )
}

// -----------------------------------------------------------------------------
// SVG Bar Chart (no external deps)
// -----------------------------------------------------------------------------
type ChartBucket = { key: string; label: string; total: number }

function BarsChart({ buckets, isMobile }: { buckets: ChartBucket[]; isMobile: boolean }) {
  const [hoverIdx, setHoverIdx] = useState<number | null>(null)
  const max = Math.max(1, ...buckets.map((b) => b.total))
  const padding = { top: 16, right: 12, bottom: 36, left: 44 }
  const width = isMobile ? 340 : 920
  const height = isMobile ? 220 : 260
  const innerW = width - padding.left - padding.right
  const innerH = height - padding.top - padding.bottom
  const bucketCount = buckets.length
  const barGap = bucketCount > 1 ? Math.min(8, innerW / bucketCount / 4) : 0
  const barWidth = (innerW - barGap * (bucketCount - 1)) / bucketCount

  // Y-axis ticks
  const ticks = 4
  const tickValues: number[] = []
  for (let i = 0; i <= ticks; i++) tickValues.push((max / ticks) * i)

  // X-axis label thinning (only show every Nth)
  const labelStep = Math.max(1, Math.ceil(bucketCount / (isMobile ? 5 : 12)))

  return (
    <div
      style={{
        background: '#fff',
        borderRadius: '12px',
        border: '1px solid #E8E9EB',
        padding: '16px',
        overflowX: 'auto',
      }}
    >
      <div
        style={{
          fontFamily: 'Syne, sans-serif',
          fontWeight: 600,
          fontSize: '13px',
          color: '#6B7280',
          textTransform: 'uppercase',
          letterSpacing: '0.5px',
          marginBottom: '12px',
        }}
      >
        {bucketCount > 14 ? 'Total semanal' : 'Total diario'}
      </div>
      <div style={{ position: 'relative' }}>
        <svg
          width={width}
          height={height}
          viewBox={`0 0 ${width} ${height}`}
          style={{ display: 'block', maxWidth: '100%' }}
          onMouseLeave={() => setHoverIdx(null)}
        >
          {/* Y grid + labels */}
          {tickValues.map((tv, i) => {
            const y = padding.top + innerH - (tv / max) * innerH
            return (
              <g key={i}>
                <line
                  x1={padding.left}
                  x2={padding.left + innerW}
                  y1={y}
                  y2={y}
                  stroke="#F3F4F6"
                  strokeWidth={1}
                />
                <text
                  x={padding.left - 8}
                  y={y + 4}
                  fontSize={10}
                  fill="#9CA3AF"
                  textAnchor="end"
                  fontFamily="Space Grotesk, sans-serif"
                >
                  {tv >= 1000 ? `$${Math.round(tv / 1000)}k` : `$${Math.round(tv)}`}
                </text>
              </g>
            )
          })}

          {/* Bars */}
          {buckets.map((b, i) => {
            const h = (b.total / max) * innerH
            const x = padding.left + i * (barWidth + barGap)
            const y = padding.top + innerH - h
            const isHovered = hoverIdx === i
            return (
              <g key={b.key}>
                <rect
                  x={x}
                  y={y}
                  width={Math.max(2, barWidth)}
                  height={Math.max(0, h)}
                  rx={3}
                  fill={isHovered ? '#D4A853' : '#1E2A3A'}
                  onMouseEnter={() => setHoverIdx(i)}
                  style={{ cursor: 'pointer', transition: 'fill 120ms ease' }}
                />
                {i % labelStep === 0 && (
                  <text
                    x={x + barWidth / 2}
                    y={padding.top + innerH + 16}
                    fontSize={10}
                    fill="#6B7280"
                    textAnchor="middle"
                    fontFamily="Space Grotesk, sans-serif"
                  >
                    {b.label}
                  </text>
                )}
              </g>
            )
          })}

          {/* Axis line */}
          <line
            x1={padding.left}
            x2={padding.left + innerW}
            y1={padding.top + innerH}
            y2={padding.top + innerH}
            stroke="#E8E9EB"
            strokeWidth={1}
          />
        </svg>

        {/* Tooltip */}
        {hoverIdx !== null && buckets[hoverIdx] && (
          <div
            style={{
              position: 'absolute',
              top: 8,
              right: 8,
              background: '#1E2A3A',
              color: '#fff',
              padding: '8px 12px',
              borderRadius: '8px',
              fontSize: '12px',
              fontFamily: 'Space Grotesk, sans-serif',
              boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
              pointerEvents: 'none',
            }}
          >
            <div style={{ color: 'rgba(255,255,255,0.6)', marginBottom: '2px' }}>
              {buckets[hoverIdx].label}
            </div>
            <div style={{ fontWeight: 600, color: '#D4A853' }}>
              {fmtMoney(buckets[hoverIdx].total)}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// -----------------------------------------------------------------------------
// Executive table per barber
// -----------------------------------------------------------------------------
type ExecRow = {
  barberId: string
  barberName: string
  clients: Set<string>
  services: number
  generated: number
  earning: number
}

function ExecutiveTable({
  rows,
  totalGenerated,
  isMobile,
}: {
  rows: ExecRow[]
  totalGenerated: number
  isMobile: boolean
}) {
  void totalGenerated // reserved for future percentage column
  const totals = rows.reduce(
    (acc, r) => {
      acc.clients += r.clients.size
      acc.services += r.services
      acc.generated += r.generated
      acc.earning += r.earning
      return acc
    },
    { clients: 0, services: 0, generated: 0, earning: 0 }
  )

  const thStyle: React.CSSProperties = {
    fontSize: '11px',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
    color: '#6B7280',
    fontWeight: 600,
    textAlign: 'left',
    padding: '12px 16px',
    background: '#F4F5F7',
    fontFamily: 'Space Grotesk, sans-serif',
  }
  const tdStyle: React.CSSProperties = {
    fontSize: '13px',
    color: '#1E2A3A',
    padding: '12px 16px',
    borderBottom: '1px solid #F3F4F6',
    fontFamily: 'Space Grotesk, sans-serif',
  }

  return (
    <div
      style={{
        background: '#fff',
        borderRadius: '12px',
        border: '1px solid #E8E9EB',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          padding: '16px 20px',
          fontFamily: 'Syne, sans-serif',
          fontWeight: 600,
          fontSize: '13px',
          color: '#6B7280',
          textTransform: 'uppercase',
          letterSpacing: '0.5px',
        }}
      >
        Resumen ejecutivo
      </div>
      <div style={{ overflowX: 'auto' }}>
        <table
          style={{
            width: '100%',
            borderCollapse: 'collapse',
            minWidth: isMobile ? 480 : 'auto',
          }}
        >
          <thead>
            <tr>
              <th style={thStyle}>Barbero</th>
              <th style={{ ...thStyle, textAlign: 'right' }}>Clientes</th>
              <th style={{ ...thStyle, textAlign: 'right' }}>Servicios</th>
              <th style={{ ...thStyle, textAlign: 'right' }}>Generado</th>
              <th style={{ ...thStyle, textAlign: 'right' }}>Ganancia barbero</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr
                key={r.barberId}
                style={{ transition: 'background 120ms ease' }}
                onMouseEnter={(e) => (e.currentTarget.style.background = '#FAFAFA')}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
              >
                <td style={{ ...tdStyle, fontWeight: 500 }}>{r.barberName}</td>
                <td style={{ ...tdStyle, textAlign: 'right' }}>{r.clients.size}</td>
                <td style={{ ...tdStyle, textAlign: 'right' }}>{r.services}</td>
                <td style={{ ...tdStyle, textAlign: 'right' }}>{fmtMoney(r.generated)}</td>
                <td
                  style={{
                    ...tdStyle,
                    textAlign: 'right',
                    color: '#D4A853',
                    fontWeight: 600,
                  }}
                >
                  {fmtMoney(r.earning)}
                </td>
              </tr>
            ))}
            <tr style={{ background: '#1E2A3A' }}>
              <td
                style={{
                  ...tdStyle,
                  color: '#fff',
                  fontWeight: 600,
                  borderBottom: 'none',
                }}
              >
                TOTAL
              </td>
              <td
                style={{
                  ...tdStyle,
                  color: '#fff',
                  fontWeight: 600,
                  textAlign: 'right',
                  borderBottom: 'none',
                }}
              >
                {totals.clients}
              </td>
              <td
                style={{
                  ...tdStyle,
                  color: '#fff',
                  fontWeight: 600,
                  textAlign: 'right',
                  borderBottom: 'none',
                }}
              >
                {totals.services}
              </td>
              <td
                style={{
                  ...tdStyle,
                  color: '#fff',
                  fontWeight: 600,
                  textAlign: 'right',
                  borderBottom: 'none',
                }}
              >
                {fmtMoney(totals.generated)}
              </td>
              <td
                style={{
                  ...tdStyle,
                  color: '#D4A853',
                  fontWeight: 700,
                  textAlign: 'right',
                  borderBottom: 'none',
                }}
              >
                {fmtMoney(totals.earning)}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  )
}

export default History
