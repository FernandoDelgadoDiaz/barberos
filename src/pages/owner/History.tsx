import { useEffect, useMemo, useState, useCallback } from 'react'
import { useTenantStore } from '../../stores/tenantStore'
import { supabase } from '../../config/supabase'
import type { ServiceLog, DailyExpense } from '../../types'
import { isRealService } from '../../types'

// =============================================================================
// Palette — slate + blue (consistent with LivePanel / Metrics redesign)
// =============================================================================
const C = {
  ink: '#0F172A',
  slate600: '#475569',
  slate500: '#64748B',
  slate400: '#94A3B8',
  border: '#E2E8F0',
  borderLt: '#F1F5F9',
  blue: '#2563EB',
  blueBright: '#3B82F6',
  blueLt: '#DBEAFE',
  blueBg: '#EFF6FF',
  blueText: '#1D4ED8',
  tooltip: '#1E293B',
  green: '#10B981',
  red: '#DC2626',
  redSoft: '#F87171',
  blueSoft: '#60A5FA',
} as const

// Deterministic barber color — SAME hash + palette as the avatars in
// ExpandableBarberCard (used by LivePanel), replicated locally because the
// scope only allows editing History.tsx. Hashes on `id || name` so the dot
// matches the barber's avatar color elsewhere in the app.
const BARBER_PALETTE = [
  '#2563EB', // blue
  '#14B8A6', // teal
  '#F97316', // orange
  '#7C3AED', // purple
  '#DC2626', // red
  '#D97706', // amber
] as const

function barberHashIndex(input: string, mod: number): number {
  let h = 0
  for (let i = 0; i < input.length; i++) {
    h = (h * 31 + input.charCodeAt(i)) | 0
  }
  return Math.abs(h) % mod
}

function getBarberColor(id: string, name: string): string {
  return BARBER_PALETTE[barberHashIndex(id || name, BARBER_PALETTE.length)]
}

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

// Short label like "8 jun" used in the range header (mockup style).
function formatDateDayMonth(isoDate: string): string {
  const [y, m, d] = isoDate.split('-').map(Number)
  const dt = new Date(Date.UTC(y, m - 1, d, 12))
  return dt.toLocaleDateString('es-AR', {
    timeZone: 'America/Argentina/Buenos_Aires',
    day: 'numeric',
    month: 'short',
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

type ShortcutKey = 'week' | 'month' | 'custom'

// =============================================================================
// Component
// =============================================================================
export function History() {
  const { tenant } = useTenantStore()
  const tenantId = tenant?.id

  const todayAR = useMemo(() => getArgentinaDateString(new Date()), [])

  const [mode, setMode] = useState<'day' | 'range'>('range')
  const [activeShortcut, setActiveShortcut] = useState<ShortcutKey>('week')
  const [selectedDate, setSelectedDate] = useState<string>(todayAR)
  const [rangeStart, setRangeStart] = useState<string>(() => getMondayOfWeek(getArgentinaDateString(new Date())))
  const [rangeEnd, setRangeEnd] = useState<string>(() => getArgentinaDateString(new Date()))

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
    if (key === 'week') {
      setMode('range')
      setRangeStart(getMondayOfWeek(today))
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

      const effMode = mode === 'range' && rangeStart === rangeEnd ? 'day' : mode
      const effDate = effMode === 'day' && mode === 'range' ? rangeStart : selectedDate

      if (effMode === 'day') {
        const [y, mo, d] = effDate.split('-').map(Number)
        const refDate = new Date(Date.UTC(y, mo - 1, d, 15)) // noon-ish AR
        const range = getArgentinaDayRangeUTC(refDate)
        startUTC = range.startUTC
        endUTC = range.endUTC
        startDateAR = effDate
        endDateAR = effDate
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
  const effectiveMode = mode === 'range' && rangeStart === rangeEnd ? 'day' : mode

  return (
    <div
      style={{
        maxWidth: '430px',
        margin: '0 auto',
        padding: '0 16px',
        boxSizing: 'border-box',
        overflowX: 'hidden',
      }}
    >
      <Header
        mode={mode}
        activeShortcut={activeShortcut}
        selectedDate={selectedDate}
        rangeStart={rangeStart}
        rangeEnd={rangeEnd}
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
      ) : effectiveMode === 'day' ? (
        <DayView
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

      {/* Spacer to clear the floating bottom-nav */}
      <div style={{ height: '110px' }} />
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
  onShortcut,
  onSelectedDate,
  onRangeStart,
  onRangeEnd,
}: HeaderProps) {
  const shortcuts: { key: ShortcutKey; label: string }[] = [
    { key: 'week', label: 'Esta semana' },
    { key: 'month', label: 'Este mes' },
    { key: 'custom', label: 'Personalizado' },
  ]

  const normStart = rangeStart <= rangeEnd ? rangeStart : rangeEnd
  const normEnd = rangeStart <= rangeEnd ? rangeEnd : rangeStart

  return (
    <div style={{ padding: '14px 0 4px' }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: '12px',
          marginBottom: '14px',
        }}
      >
        <div style={{ minWidth: 0 }}>
          <h1
            style={{
              fontFamily: 'Syne, sans-serif',
              fontWeight: 700,
              fontSize: 'clamp(15px, 4.6vw, 18px)',
              color: C.ink,
              margin: '0 0 2px 0',
              lineHeight: 1.2,
            }}
          >
            Historial <span aria-hidden>📋</span>
          </h1>
          <p
            style={{
              color: C.slate500,
              fontSize: 'clamp(11px, 3.33vw, 13px)',
              fontFamily: 'Space Grotesk, sans-serif',
              margin: 0,
            }}
          >
            Consultá tus servicios y ganancias
          </p>
        </div>
        <button
          type="button"
          aria-label="Filtros"
          style={{
            width: 36,
            height: 36,
            borderRadius: '50%',
            border: `1px solid ${C.border}`,
            background: '#fff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            flexShrink: 0,
          }}
        >
          <FunnelIcon />
        </button>
      </div>

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
                background: active ? C.blueLt : '#fff',
                color: active ? C.blueText : C.slate600,
                border: active ? `1px solid ${C.blueLt}` : `1px solid ${C.border}`,
                borderRadius: '999px',
                padding: '8px 14px',
                fontSize: 'clamp(11px, 3.33vw, 13px)',
                fontWeight: active ? 600 : 500,
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

      {/* Date inputs (custom) */}
      {mode === 'day' && activeShortcut === 'custom' && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginBottom: '4px' }}>
          <label style={{ fontSize: '12px', color: C.slate500, fontFamily: 'Space Grotesk, sans-serif' }}>
            Fecha:
          </label>
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => onSelectedDate(e.target.value)}
            style={inputStyle}
          />
        </div>
      )}

      {mode === 'range' && activeShortcut === 'custom' && (
        <div style={{ display: 'flex', gap: '12px', marginBottom: '12px' }}>
          <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <label style={dateLabelStyle}>Desde:</label>
            <input
              type="date"
              value={rangeStart}
              onChange={(e) => onRangeStart(e.target.value)}
              style={inputStyle}
            />
          </div>
          <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <label style={dateLabelStyle}>Hasta:</label>
            <input
              type="date"
              value={rangeEnd}
              onChange={(e) => onRangeEnd(e.target.value)}
              style={inputStyle}
            />
          </div>
        </div>
      )}

      {/* Active range / day label with calendar icon */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          fontSize: 'clamp(11px, 3.33vw, 13px)',
          color: C.slate600,
          fontFamily: 'Space Grotesk, sans-serif',
          fontWeight: 500,
        }}
      >
        <CalendarIcon />
        {mode === 'range' ? (
          <span>
            {formatDateDayMonth(normStart)} – {formatDateDayMonth(normEnd)}
          </span>
        ) : (
          <span style={{ textTransform: 'capitalize' }}>{formatDateLong(selectedDate)}</span>
        )}
      </div>
    </div>
  )
}

function FunnelIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke={C.slate600}
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M3 5h18l-7 8v6l-4 2v-8z" />
    </svg>
  )
}

function CalendarIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke={C.slate500}
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ flexShrink: 0 }}
    >
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <path d="M16 2v4M8 2v4M3 10h18" />
    </svg>
  )
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  boxSizing: 'border-box',
  border: `1px solid ${C.border}`,
  borderRadius: '8px',
  padding: '8px',
  fontSize: '13px',
  fontFamily: 'Space Grotesk, sans-serif',
  color: C.ink,
  background: '#fff',
  outline: 'none',
}

const dateLabelStyle: React.CSSProperties = {
  fontSize: '12px',
  color: C.slate500,
  fontFamily: 'Space Grotesk, sans-serif',
}

// =============================================================================
// Loading / Empty
// =============================================================================
function LoadingSpinner() {
  return (
    <div
      style={{
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
          border: `3px solid ${C.borderLt}`,
          borderTopColor: C.blue,
          animation: 'spinHist 0.8s linear infinite',
        }}
      />
      <p
        style={{
          fontSize: 14,
          color: C.slate400,
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
        borderRadius: '16px',
        border: `1px solid ${C.borderLt}`,
        padding: '60px 24px',
        textAlign: 'center',
        marginTop: '8px',
        boxShadow: '0 1px 2px rgba(15,23,42,0.04)',
      }}
    >
      <svg
        width="48"
        height="48"
        viewBox="0 0 24 24"
        fill="none"
        stroke={C.blue}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{ opacity: 0.5, margin: '0 auto 16px' }}
      >
        <rect x="3" y="4" width="18" height="18" rx="2" />
        <path d="M16 2v4M8 2v4M3 10h18" />
      </svg>
      <div
        style={{
          fontFamily: 'Syne, sans-serif',
          fontWeight: 600,
          fontSize: '18px',
          color: C.ink,
          marginBottom: '8px',
        }}
      >
        Sin registros para este período
      </div>
      <div
        style={{
          fontSize: '14px',
          color: C.slate500,
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
  logs: ServiceLogWithBarber[]
  expenses: DailyExpense[]
  isMobile: boolean
}

function DayView({ logs, expenses, isMobile }: DayViewProps) {
  // Aggregate totals
  const totalDay = logs.reduce((s, l) => s + (l.price_charged || 0), 0)
  const totalExpenses = expenses.reduce((s, e) => s + (e.amount || 0), 0)
  const totalBarberEarningsExTips = logs.reduce(
    (s, l) => s + (l.barber_earning || 0) - (l.tip_amount || 0),
    0
  )
  const totalOthers = logs.reduce((s, l) => s + (l.others_amount || 0), 0)
  const ownerEarning = totalDay - totalBarberEarningsExTips + totalOthers - totalExpenses

  // Payment method breakdown
  const efectivo = logs
    .filter((l) => (l.payment_method || 'efectivo') === 'efectivo')
    .reduce((s, l) => s + (l.price_charged || 0), 0)
  const transferencia = logs
    .filter((l) => l.payment_method === 'transferencia')
    .reduce((s, l) => s + (l.price_charged || 0), 0)

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
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginTop: '12px' }}>
      {/* Stats grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(4, 1fr)',
          gap: '12px',
        }}
      >
        <StatCard label="Total del día" value={fmtMoney(totalDay)} />
        <StatCard label="Ganancia dueño" value={fmtMoney(ownerEarning)} accent={C.blue} />
        <StatCard label="Clientes" value={String(clientsCount)} />
        <StatCard
          label="Gastos"
          value={fmtMoney(totalExpenses)}
          accent={totalExpenses > 0 ? C.red : undefined}
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
            borderRadius: '16px',
            border: `1px solid ${C.borderLt}`,
            padding: '20px',
            boxShadow: '0 1px 2px rgba(15,23,42,0.04)',
          }}
        >
          <div style={sectionTitleStyle}>Gastos del día</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '12px' }}>
            {expenses.map((e) => (
              <div
                key={e.id}
                style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px' }}
              >
                <span style={{ color: C.slate600 }}>{e.description}</span>
                <span style={{ color: C.red, fontWeight: 500 }}>-{fmtMoney(e.amount)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Settlement summary */}
      {logs.length > 0 && (
        <div style={{ background: C.ink, borderRadius: '16px', padding: '20px' }}>
          <div
            style={{
              fontSize: '11px',
              color: 'rgba(255,255,255,0.5)',
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
              marginBottom: '12px',
              fontFamily: 'Space Grotesk, sans-serif',
            }}
          >
            Liquidación del día
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <RowDark label="Total Barbería" value={fmtMoney(totalDay)} />
            {barberGroups.map((g) => (
              <RowDark key={g.barberId} label={g.barberName} value={fmtMoney(g.barberEarning)} />
            ))}
            {totalExpenses > 0 && (
              <RowDark
                label="Insumos del día"
                value={`-${fmtMoney(totalExpenses)}`}
                valueColor={C.redSoft}
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
              <span style={{ fontSize: '14px', color: '#fff', fontWeight: 600, fontFamily: 'Syne, sans-serif' }}>
                Ganancia real del dueño
              </span>
              <span
                style={{
                  fontSize: '18px',
                  fontWeight: 700,
                  color: C.blueSoft,
                  fontFamily: "'Inter', system-ui, sans-serif",
                }}
              >
                {fmtMoney(ownerEarning)}
              </span>
            </div>
            <div
              style={{
                borderTop: '1px solid rgba(255,255,255,0.1)',
                marginTop: '12px',
                paddingTop: '12px',
              }}
            >
              <div
                style={{
                  fontSize: '11px',
                  color: 'rgba(255,255,255,0.5)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px',
                  marginBottom: '8px',
                  fontFamily: 'Space Grotesk, sans-serif',
                }}
              >
                Métodos de pago
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <RowDark label="Efectivo" value={fmtMoney(efectivo)} />
                <RowDark label="Transferencia" value={fmtMoney(transferencia)} />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

const sectionTitleStyle: React.CSSProperties = {
  fontFamily: 'Syne, sans-serif',
  fontWeight: 700,
  fontSize: 'clamp(14px, 4.1vw, 16px)',
  color: C.ink,
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
        borderRadius: '16px',
        padding: '16px',
        border: `1px solid ${C.borderLt}`,
        boxShadow: '0 1px 2px rgba(15,23,42,0.04)',
      }}
    >
      <div
        style={{
          fontSize: '11px',
          color: C.slate500,
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
          fontWeight: 800,
          color: accent || C.ink,
          fontFamily: "'Inter', system-ui, sans-serif",
          letterSpacing: '-0.5px',
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
      <span style={{ fontSize: '13px', color: 'rgba(255,255,255,0.7)', fontFamily: 'Space Grotesk, sans-serif' }}>
        {label}
      </span>
      <span
        style={{
          fontSize: '14px',
          fontWeight: 500,
          color: valueColor,
          fontFamily: "'Inter', system-ui, sans-serif",
        }}
      >
        {value}
      </span>
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
  const dotColor = getBarberColor(group.barberId, group.barberName)
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
        borderRadius: '16px',
        border: `1px solid ${C.borderLt}`,
        padding: '16px 18px',
        boxShadow: '0 1px 2px rgba(15,23,42,0.04)',
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
        <div style={{ minWidth: 0, flex: 1, display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span
            style={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              background: dotColor,
              flexShrink: 0,
            }}
          />
          <div style={{ minWidth: 0 }}>
            <div
              style={{
                fontFamily: 'Syne, sans-serif',
                fontWeight: 600,
                fontSize: '16px',
                color: C.ink,
                marginBottom: '2px',
              }}
            >
              {group.barberName}
            </div>
            <div style={{ fontSize: '12px', color: C.slate500, fontFamily: 'Space Grotesk, sans-serif' }}>
              {appointments.length} {appointments.length === 1 ? 'cliente' : 'clientes'} ·{' '}
              {fmtMoney(group.totalGenerated)} generado
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '11px', color: C.slate500, textTransform: 'uppercase' }}>Barbero</div>
            <div
              style={{
                fontSize: '14px',
                fontWeight: 600,
                color: C.ink,
                fontFamily: "'Inter', system-ui, sans-serif",
              }}
            >
              {fmtMoney(group.barberEarning)}
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '11px', color: C.slate500, textTransform: 'uppercase' }}>Dueño</div>
            <div
              style={{
                fontSize: '14px',
                fontWeight: 600,
                color: C.blue,
                fontFamily: "'Inter', system-ui, sans-serif",
              }}
            >
              {fmtMoney(group.ownerEarning)}
            </div>
          </div>
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke={C.slate500}
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
            borderTop: `1px solid ${C.borderLt}`,
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
          }}
        >
          {appointments.map((a, idx) => {
            const total = a.logs.reduce((s, l) => s + (l.price_charged || 0), 0)
            const barberE = a.logs.reduce((s, l) => s + (l.barber_earning || 0), 0)
            const ownerE = a.logs.reduce((s, l) => s + (l.owner_earning || 0), 0)
            const tipTotal = a.logs.reduce((s, l) => s + (l.tip_amount || 0), 0)
            const othersTotal = a.logs.reduce((s, l) => s + (l.others_amount || 0), 0)
            // Venta suelta de productos: la fila portadora no es un servicio y deja
            // total (price_charged) en 0, así que el importe real está en othersTotal.
            const realCount = a.logs.filter(isRealService).length
            const isProductOnly = realCount === 0
            const time = formatTimeAR(a.logs[0].started_at)
            const payment = a.logs[0].payment_method || 'efectivo'
            const paymentLabel = payment === 'transferencia' ? 'Transferencia' : 'Efectivo'
            return (
              <div
                key={a.key}
                style={{
                  background: '#fff',
                  borderRadius: '12px',
                  padding: '16px',
                  border: `1px solid ${C.borderLt}`,
                }}
              >
                {/* Header: Cliente #N — hora */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                  <span style={{ fontFamily: 'Syne, sans-serif', fontWeight: 600, fontSize: '15px', color: C.ink }}>
                    {isProductOnly ? 'Venta de productos' : `Cliente #${idx + 1}`}
                  </span>
                  <span style={{ fontSize: '13px', color: C.slate500 }}>{time}</span>
                </div>
                {/* Subheader: método badge + servicios */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
                  <span
                    style={{
                      fontSize: '11px',
                      fontWeight: 600,
                      padding: '2px 8px',
                      borderRadius: '20px',
                      background: payment === 'transferencia' ? C.blueLt : '#D1FAE5',
                      color: payment === 'transferencia' ? C.blueText : '#065F46',
                    }}
                  >
                    {paymentLabel}
                  </span>
                  <span style={{ fontSize: '12px', color: C.slate400 }}>
                    {isProductOnly ? 'Solo productos' : `${realCount} ${realCount === 1 ? 'servicio' : 'servicios'}`}
                  </span>
                </div>
                {/* Separator */}
                <div style={{ borderTop: `1px solid ${C.borderLt}`, margin: '8px 0' }} />
                {/* Data rows */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: '13px', color: C.slate500 }}>Total cobrado</span>
                    <span style={{ fontSize: '13px', fontWeight: 600, color: C.ink }}>{fmtMoney(isProductOnly ? othersTotal : total)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: '13px', color: C.slate500 }}>Barbero</span>
                    <span style={{ fontSize: '13px', fontWeight: 600, color: C.ink }}>{fmtMoney(barberE - tipTotal)}</span>
                  </div>
                  {tipTotal > 0 && (
                    <div style={{ fontSize: '12px', color: C.blue, textAlign: 'right' }}>
                      +{fmtMoney(tipTotal)} propina · 100% barbero
                    </div>
                  )}
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: '13px', color: C.slate500 }}>Dueño</span>
                    <span style={{ fontSize: '13px', fontWeight: 600, color: C.blue }}>{fmtMoney(ownerE - othersTotal)}</span>
                  </div>
                  {othersTotal > 0 && (
                    <div style={{ fontSize: '12px', color: '#F97316', textAlign: 'right' }}>
                      +{fmtMoney(othersTotal)} otros · 100% dueño
                    </div>
                  )}
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
  // Excluye las filas portadoras de ventas de productos sin servicio: cuentan como
  // cliente (arriba) pero no como servicio.
  const servicesCount = logs.filter(isRealService).length

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

  // Latest activities — grouped by appointment (decision #10: no service name,
  // so we group logs by appointment and show hora · barbero · monto).
  const activities = useMemo(() => {
    type Acc = {
      key: string
      barberId: string
      barberName: string
      amount: number
      // Importe de productos, para poder mostrar un monto real en las ventas sueltas,
      // donde amount (price_charged) es 0.
      productsAmount: number
      serviceCount: number
      startedAt: string
      payment: 'efectivo' | 'transferencia'
    }
    const m = new Map<string, Acc>()
    logs.forEach((l) => {
      const key = l.appointment_id || `${l.barber_id}-${l.started_at}`
      const existing = m.get(key)
      if (existing) {
        existing.amount += l.price_charged || 0
        existing.productsAmount += l.others_amount || 0
        if (isRealService(l)) existing.serviceCount += 1
        if (l.started_at < existing.startedAt) existing.startedAt = l.started_at
      } else {
        m.set(key, {
          key,
          barberId: l.barber_id,
          barberName: l.barber_name,
          amount: l.price_charged || 0,
          productsAmount: l.others_amount || 0,
          serviceCount: isRealService(l) ? 1 : 0,
          startedAt: l.started_at,
          payment: l.payment_method || 'efectivo',
        })
      }
    })
    return Array.from(m.values())
      .sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime())
      .slice(0, 5)
  }, [logs])

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
    // La fila portadora de una venta suelta no es un servicio, pero sí es un cliente
    // atendido y su plata sí suma.
    if (isRealService(l)) row.services += 1
    row.generated += l.price_charged || 0
    row.earning += l.barber_earning || 0
    row.clients.add(l.appointment_id || `${l.barber_id}-${l.started_at}`)
  })
  const barberRows = Array.from(barberRowsMap.values()).sort(
    (a, b) => b.generated - a.generated
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', marginTop: '12px' }}>
      {/* Summary card (Ingresos / Ganancia neta) */}
      <div
        style={{
          background: C.blueBg,
          borderRadius: '20px',
          padding: '18px',
          border: `1px solid ${C.blueLt}`,
          boxShadow: '0 1px 2px rgba(15,23,42,0.04)',
          position: 'relative',
        }}
      >
        {/* Decorative trending badge (no % delta — decision #6) */}
        <div
          style={{
            position: 'absolute',
            top: 16,
            right: 16,
            width: 40,
            height: 40,
            borderRadius: '50%',
            background: C.blueLt,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
          aria-hidden
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke={C.blue}
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M3 17l6-6 4 4 8-8" />
            <path d="M17 7h4v4" />
          </svg>
        </div>
        <div style={{ display: 'flex', gap: '16px' }}>
          <div style={{ flex: 1, borderRight: `1px solid ${C.blueLt}`, paddingRight: '12px' }}>
            <div style={summaryLabelStyle}>Ingresos</div>
            <div style={summaryValueStyle}>{fmtMoney(totalGenerated)}</div>
            <div style={summarySubStyle}>
              {servicesCount} {servicesCount === 1 ? 'servicio' : 'servicios'}
            </div>
          </div>
          <div style={{ flex: 1 }}>
            <div style={summaryLabelStyle}>Ganancia neta</div>
            <div style={summaryValueStyle}>{fmtMoney(realOwnerNet)}</div>
            <div style={summarySubStyle}>
              {clientsCount} {clientsCount === 1 ? 'cliente' : 'clientes'}
            </div>
          </div>
        </div>
        <div
          style={{
            marginTop: '14px',
            paddingTop: '12px',
            borderTop: `1px solid ${C.blueLt}`,
            display: 'flex',
            gap: '16px',
            fontSize: '12px',
            color: C.slate500,
            fontFamily: 'Space Grotesk, sans-serif',
          }}
        >
          <span>
            Efectivo <strong style={{ color: C.ink }}>{fmtMoney(efectivoTotal)}</strong>
          </span>
          <span>
            Transferencia <strong style={{ color: C.ink }}>{fmtMoney(transferenciaTotal)}</strong>
          </span>
        </div>
      </div>

      {/* Chart */}
      {chartBuckets.length > 0 && (
        <div>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '12px',
            }}
          >
            <span style={sectionTitleStyle}>Ingresos por día</span>
            {/* Static metric label — no dropdown (decision #8) */}
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                fontSize: '12px',
                fontWeight: 500,
                color: C.slate600,
                fontFamily: 'Space Grotesk, sans-serif',
                background: C.borderLt,
                padding: '6px 10px',
                borderRadius: '8px',
              }}
            >
              Ingresos
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke={C.slate500} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M6 9l6 6 6-6" />
              </svg>
            </span>
          </div>
          <BarsChart buckets={chartBuckets} isMobile={isMobile} />
        </div>
      )}

      {/* Latest activities */}
      {activities.length > 0 && (
        <div>
          <div style={{ marginBottom: '12px' }}>
            <span style={sectionTitleStyle}>Últimas actividades</span>
          </div>
          <div
            style={{
              background: '#fff',
              borderRadius: '16px',
              border: `1px solid ${C.borderLt}`,
              boxShadow: '0 1px 2px rgba(15,23,42,0.04)',
              overflow: 'hidden',
            }}
          >
            {activities.map((a, i) => (
              <div
                key={a.key}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  padding: '14px 16px',
                  borderBottom: i === activities.length - 1 ? 'none' : `1px solid ${C.borderLt}`,
                }}
              >
                <span
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: '50%',
                    background: getBarberColor(a.barberId, a.barberName),
                    flexShrink: 0,
                  }}
                />
                <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '2px' }}>
                  <span
                    style={{
                      fontFamily: 'Space Grotesk, sans-serif',
                      fontWeight: 600,
                      fontSize: 'clamp(13px, 3.59vw, 14px)',
                      color: C.ink,
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                  >
                    {formatTimeAR(a.startedAt)} · {a.barberName}
                  </span>
                  <span style={{ fontSize: '12px', color: C.slate500, fontFamily: 'Space Grotesk, sans-serif' }}>
                    {a.serviceCount === 0
                      ? 'Solo productos'
                      : `${a.serviceCount} ${a.serviceCount === 1 ? 'servicio' : 'servicios'}`} ·{' '}
                    {a.payment === 'transferencia' ? 'Transferencia' : 'Efectivo'}
                  </span>
                </div>
                <span
                  style={{
                    fontFamily: "'Inter', system-ui, sans-serif",
                    fontWeight: 700,
                    fontSize: 'clamp(13px, 3.59vw, 14px)',
                    color: C.ink,
                    fontVariantNumeric: 'tabular-nums',
                    flexShrink: 0,
                  }}
                >
                  {fmtMoney(a.serviceCount === 0 ? a.productsAmount : a.amount)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Executive table */}
      {barberRows.length > 0 && (
        <ExecutiveTable rows={barberRows} totalGenerated={totalGenerated} isMobile={isMobile} />
      )}

      {/* Payment + expenses + net */}
      <div
        style={{
          background: '#fff',
          borderRadius: '16px',
          border: `1px solid ${C.borderLt}`,
          padding: '20px',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
          boxShadow: '0 1px 2px rgba(15,23,42,0.04)',
        }}
      >
        <div style={sectionTitleStyle}>Desglose del período</div>
        <RowLight label="Total generado" value={fmtMoney(totalGenerated)} />
        <RowLight label="Efectivo" value={fmtMoney(efectivoTotal)} />
        <RowLight label="Transferencia" value={fmtMoney(transferenciaTotal)} />
        <RowLight
          label="Ganancia barberos"
          value={`-${fmtMoney(barberEarningsExTips)}`}
          valueColor={C.slate500}
        />
        <RowLight
          label="Gastos"
          value={`-${fmtMoney(totalExpenses)}`}
          valueColor={totalExpenses > 0 ? C.red : C.slate500}
        />
        <div
          style={{
            borderTop: `1px solid ${C.borderLt}`,
            paddingTop: '12px',
            marginTop: '4px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'baseline',
          }}
        >
          <span style={{ fontSize: '14px', fontWeight: 600, color: C.ink, fontFamily: 'Syne, sans-serif' }}>
            Ganancia real neta dueño
          </span>
          <span
            style={{
              fontSize: '20px',
              fontWeight: 800,
              color: C.blue,
              fontFamily: "'Inter', system-ui, sans-serif",
              letterSpacing: '-0.5px',
            }}
          >
            {fmtMoney(realOwnerNet)}
          </span>
        </div>
      </div>
    </div>
  )
}

const summaryLabelStyle: React.CSSProperties = {
  fontSize: 'clamp(11px, 3.08vw, 12px)',
  color: C.slate500,
  fontFamily: 'Space Grotesk, sans-serif',
  fontWeight: 500,
}

const summaryValueStyle: React.CSSProperties = {
  fontSize: 'clamp(20px, 6.15vw, 24px)',
  fontWeight: 800,
  color: C.ink,
  fontFamily: "'Inter', system-ui, sans-serif",
  letterSpacing: '-0.5px',
  lineHeight: 1.1,
  marginTop: '4px',
}

const summarySubStyle: React.CSSProperties = {
  fontSize: 'clamp(10px, 2.82vw, 11px)',
  color: C.slate500,
  fontFamily: 'Space Grotesk, sans-serif',
  marginTop: '4px',
}

function RowLight({
  label,
  value,
  valueColor = C.ink,
}: {
  label: string
  value: string
  valueColor?: string
}) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px' }}>
      <span style={{ color: C.slate500, fontFamily: 'Space Grotesk, sans-serif' }}>{label}</span>
      <span
        style={{
          color: valueColor,
          fontWeight: 500,
          fontFamily: "'Inter', system-ui, sans-serif",
        }}
      >
        {value}
      </span>
    </div>
  )
}

// -----------------------------------------------------------------------------
// SVG Bar Chart (no external deps)
// -----------------------------------------------------------------------------
type ChartBucket = { key: string; label: string; total: number }

// Round a value up to a "nice" ceiling so bars leave headroom (for the peak
// tooltip) and the top axis label reads cleanly.
function niceCeil(v: number): number {
  if (v <= 0) return 1
  const mag = Math.pow(10, Math.floor(Math.log10(v)))
  const norm = v / mag
  let nice: number
  if (norm <= 1) nice = 1
  else if (norm <= 2) nice = 2
  else if (norm <= 2.5) nice = 2.5
  else if (norm <= 5) nice = 5
  else nice = 10
  return nice * mag
}

// SVG path for a bar rounded only on the top corners.
function topRoundedBarPath(x: number, y: number, w: number, h: number, r: number): string {
  const rr = Math.max(0, Math.min(r, w / 2, h))
  return [
    `M ${x} ${y + h}`,
    `L ${x} ${y + rr}`,
    `Q ${x} ${y} ${x + rr} ${y}`,
    `L ${x + w - rr} ${y}`,
    `Q ${x + w} ${y} ${x + w} ${y + rr}`,
    `L ${x + w} ${y + h}`,
    'Z',
  ].join(' ')
}

function BarsChart({ buckets, isMobile }: { buckets: ChartBucket[]; isMobile: boolean }) {
  const [hoverIdx, setHoverIdx] = useState<number | null>(null)
  const rawMax = Math.max(1, ...buckets.map((b) => b.total))
  const max = niceCeil(rawMax)
  const padding = { top: 16, right: 12, bottom: 36, left: 44 }
  const width = isMobile ? 340 : 920
  const height = isMobile ? 220 : 260
  const innerW = width - padding.left - padding.right
  const innerH = height - padding.top - padding.bottom
  const bucketCount = buckets.length
  const barGap = bucketCount > 1 ? Math.min(8, innerW / bucketCount / 4) : 0
  const barWidth = (innerW - barGap * (bucketCount - 1)) / bucketCount

  // Highlight the bucket with the max value (mockup shows the peak day filled).
  const peakIdx = buckets.reduce((best, b, i) => (b.total > buckets[best].total ? i : best), 0)

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
        borderRadius: '16px',
        border: `1px solid ${C.borderLt}`,
        padding: '16px 12px 12px',
        overflowX: 'auto',
        boxShadow: '0 1px 2px rgba(15,23,42,0.04)',
      }}
    >
      <div style={{ position: 'relative' }}>
        <svg
          width={width}
          height={height}
          viewBox={`0 0 ${width} ${height}`}
          style={{ display: 'block', maxWidth: '100%' }}
          onMouseLeave={() => setHoverIdx(null)}
        >
          <defs>
            <linearGradient id="histBarPeak" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#BFDBFE" />
              <stop offset="100%" stopColor="#3B82F6" />
            </linearGradient>
            <linearGradient id="histBarNormal" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#DBEAFE" />
              <stop offset="100%" stopColor="#93C5FD" />
            </linearGradient>
          </defs>

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
                  stroke={C.borderLt}
                  strokeWidth={1}
                  strokeDasharray="2 2"
                />
                <text
                  x={padding.left - 8}
                  y={y + 4}
                  fontSize={10}
                  fill={C.slate400}
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
            const bw = Math.max(2, barWidth)
            const h = Math.max(4, (b.total / max) * innerH) // min 4px so $0 stays visible
            const x = padding.left + i * (barWidth + barGap)
            const y = padding.top + innerH - h
            const isHovered = hoverIdx === i
            const isPeak = i === peakIdx
            const grad = isHovered || isPeak ? 'url(#histBarPeak)' : 'url(#histBarNormal)'
            return (
              <g key={b.key}>
                <path
                  d={topRoundedBarPath(x, y, bw, h, 6)}
                  fill={grad}
                  onMouseEnter={() => setHoverIdx(i)}
                  style={{ cursor: 'pointer' }}
                />
                {i % labelStep === 0 && (
                  <text
                    x={x + barWidth / 2}
                    y={padding.top + innerH + 16}
                    fontSize={10}
                    fill={C.slate500}
                    textAnchor="middle"
                    fontFamily="Space Grotesk, sans-serif"
                  >
                    {b.label}
                  </text>
                )}
              </g>
            )
          })}

          {/* Persistent tooltip over the tallest bar (mockup style) */}
          {buckets[peakIdx] && buckets[peakIdx].total > 0 && (() => {
            const peakH = Math.max(4, (buckets[peakIdx].total / max) * innerH)
            const peakCx = padding.left + peakIdx * (barWidth + barGap) + Math.max(2, barWidth) / 2
            const peakTop = padding.top + innerH - peakH
            const label = fmtMoney(buckets[peakIdx].total)
            const tw = label.length * 6.8 + 18
            const th = 22
            let tx = peakCx - tw / 2
            tx = Math.max(padding.left, Math.min(tx, padding.left + innerW - tw))
            let ty = peakTop - 10 - th
            let pointerDown = true
            if (ty < 2) {
              ty = peakTop + 8
              pointerDown = false
            }
            return (
              <g pointerEvents="none">
                <rect x={tx} y={ty} width={tw} height={th} rx={6} fill={C.tooltip} />
                <text
                  x={tx + tw / 2}
                  y={ty + th / 2 + 4}
                  fontSize={11}
                  fontWeight={600}
                  fill="#fff"
                  textAnchor="middle"
                  fontFamily="'Inter', system-ui, sans-serif"
                >
                  {label}
                </text>
                {pointerDown && (
                  <path
                    d={`M ${peakCx - 4} ${ty + th} L ${peakCx + 4} ${ty + th} L ${peakCx} ${ty + th + 5} Z`}
                    fill={C.tooltip}
                  />
                )}
              </g>
            )
          })()}

          {/* Axis line */}
          <line
            x1={padding.left}
            x2={padding.left + innerW}
            y1={padding.top + innerH}
            y2={padding.top + innerH}
            stroke={C.border}
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
              background: C.tooltip,
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
            <div style={{ fontWeight: 600, color: C.blueSoft, fontFamily: "'Inter', system-ui, sans-serif" }}>
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
    color: C.slate500,
    fontWeight: 600,
    textAlign: 'left',
    padding: '12px 16px',
    background: '#F8FAFC',
    fontFamily: 'Space Grotesk, sans-serif',
  }
  const tdStyle: React.CSSProperties = {
    fontSize: '13px',
    color: C.ink,
    padding: '12px 16px',
    borderBottom: `1px solid ${C.borderLt}`,
    fontFamily: 'Space Grotesk, sans-serif',
  }

  return (
    <div
      style={{
        background: '#fff',
        borderRadius: '16px',
        border: `1px solid ${C.borderLt}`,
        overflow: 'hidden',
        boxShadow: '0 1px 2px rgba(15,23,42,0.04)',
      }}
    >
      <div style={{ padding: '16px 20px', ...sectionTitleStyle }}>Resumen ejecutivo</div>
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
                <td style={{ ...tdStyle, fontWeight: 500 }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                    <span
                      style={{
                        width: 8,
                        height: 8,
                        borderRadius: '50%',
                        background: getBarberColor(r.barberId, r.barberName),
                        flexShrink: 0,
                      }}
                    />
                    {r.barberName}
                  </span>
                </td>
                <td style={{ ...tdStyle, textAlign: 'right' }}>{r.clients.size}</td>
                <td style={{ ...tdStyle, textAlign: 'right' }}>{r.services}</td>
                <td style={{ ...tdStyle, textAlign: 'right', fontFamily: "'Inter', system-ui, sans-serif" }}>
                  {fmtMoney(r.generated)}
                </td>
                <td
                  style={{
                    ...tdStyle,
                    textAlign: 'right',
                    color: C.blue,
                    fontWeight: 600,
                    fontFamily: "'Inter', system-ui, sans-serif",
                  }}
                >
                  {fmtMoney(r.earning)}
                </td>
              </tr>
            ))}
            <tr style={{ background: C.ink }}>
              <td style={{ ...tdStyle, color: '#fff', fontWeight: 600, borderBottom: 'none' }}>TOTAL</td>
              <td style={{ ...tdStyle, color: '#fff', fontWeight: 600, textAlign: 'right', borderBottom: 'none' }}>
                {totals.clients}
              </td>
              <td style={{ ...tdStyle, color: '#fff', fontWeight: 600, textAlign: 'right', borderBottom: 'none' }}>
                {totals.services}
              </td>
              <td
                style={{
                  ...tdStyle,
                  color: '#fff',
                  fontWeight: 600,
                  textAlign: 'right',
                  borderBottom: 'none',
                  fontFamily: "'Inter', system-ui, sans-serif",
                }}
              >
                {fmtMoney(totals.generated)}
              </td>
              <td
                style={{
                  ...tdStyle,
                  color: C.blueSoft,
                  fontWeight: 700,
                  textAlign: 'right',
                  borderBottom: 'none',
                  fontFamily: "'Inter', system-ui, sans-serif",
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
