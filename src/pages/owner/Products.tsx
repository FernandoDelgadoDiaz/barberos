import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTenantStore } from '../../stores/tenantStore'
import { supabase } from '../../config/supabase'

// =============================================================================
// Palette — slate + blue (consistent with LivePanel / Metrics / History)
// =============================================================================
const C = {
  ink: '#0F172A',
  slate600: '#475569',
  slate500: '#64748B',
  slate400: '#94A3B8',
  border: '#E2E8F0',
  borderLt: '#F1F5F9',
  blue: '#2563EB',
  blueLt: '#DBEAFE',
  blueBg: '#EFF6FF',
  blueText: '#1D4ED8',
} as const

// =============================================================================
// Date helpers — Argentina timezone (UTC-3, no DST since 2009)
// (replicated locally, same convention used in History.tsx / Summary.tsx)
// =============================================================================
function getArgentinaDateString(date: Date = new Date()): string {
  return date.toLocaleDateString('en-CA', { timeZone: 'America/Argentina/Buenos_Aires' })
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

// Maps an Argentina calendar range [start, end] (YYYY-MM-DD) to its UTC bounds.
function getArgentinaRangeUTC(startDate: string, endDate: string): { startUTC: string; endUTC: string } {
  const startUTC = `${startDate}T03:00:00.000Z`
  const [y, m, d] = endDate.split('-').map(Number)
  const next = new Date(Date.UTC(y, m - 1, d))
  next.setUTCDate(next.getUTCDate() + 1)
  const yy = next.getUTCFullYear()
  const mm = String(next.getUTCMonth() + 1).padStart(2, '0')
  const dd = String(next.getUTCDate()).padStart(2, '0')
  const endUTC = `${yy}-${mm}-${dd}T02:59:59.999Z`
  return { startUTC, endUTC }
}

function formatDateDayMonth(isoDate: string): string {
  const [y, m, d] = isoDate.split('-').map(Number)
  const dt = new Date(Date.UTC(y, m - 1, d, 12))
  return dt.toLocaleDateString('es-AR', {
    timeZone: 'America/Argentina/Buenos_Aires',
    day: 'numeric',
    month: 'short',
  })
}

function fmtMoney(n: number): string {
  return `$${Math.round(n).toLocaleString('es-AR')}`
}

// =============================================================================
// Types
// =============================================================================
type ShortcutKey = 'week' | 'month' | 'custom'

type ProductRow = {
  name: string
  units: number
  total: number
}

// =============================================================================
// Component
// =============================================================================
export function Products() {
  const navigate = useNavigate()
  const { tenant } = useTenantStore()
  const tenantId = tenant?.id

  const todayAR = useMemo(() => getArgentinaDateString(new Date()), [])

  const [activeShortcut, setActiveShortcut] = useState<ShortcutKey>('month')
  const [rangeStart, setRangeStart] = useState<string>(() => getFirstOfMonth(getArgentinaDateString(new Date())))
  const [rangeEnd, setRangeEnd] = useState<string>(() => getArgentinaDateString(new Date()))

  const [rows, setRows] = useState<ProductRow[]>([])
  const [loading, setLoading] = useState(false)

  const applyShortcut = (key: ShortcutKey) => {
    setActiveShortcut(key)
    const today = getArgentinaDateString(new Date())
    if (key === 'week') {
      setRangeStart(getMondayOfWeek(today))
      setRangeEnd(today)
    } else if (key === 'month') {
      setRangeStart(getFirstOfMonth(today))
      setRangeEnd(today)
    }
    // 'custom' keeps current range
  }

  const loadData = useCallback(async () => {
    if (!tenantId) return
    setLoading(true)
    try {
      const s = rangeStart <= rangeEnd ? rangeStart : rangeEnd
      const e = rangeStart <= rangeEnd ? rangeEnd : rangeStart
      const { startUTC, endUTC } = getArgentinaRangeUTC(s, e)

      const { data, error } = await supabase
        .from('product_sales')
        .select('product_name, quantity, line_total')
        .eq('tenant_id', tenantId)
        .gte('sold_at', startUTC)
        .lte('sold_at', endUTC)

      if (error) throw error

      // Aggregate by product_name in the client (Supabase JS has no GROUP BY).
      const map = new Map<string, ProductRow>()
      for (const r of (data || []) as { product_name: string; quantity: number; line_total: number }[]) {
        const key = r.product_name
        const acc = map.get(key) || { name: key, units: 0, total: 0 }
        acc.units += r.quantity || 0
        acc.total += r.line_total || 0
        map.set(key, acc)
      }
      const aggregated = Array.from(map.values()).sort((a, b) => b.units - a.units)
      setRows(aggregated)
    } catch (err) {
      console.error('Error loading product sales:', err)
      setRows([])
    } finally {
      setLoading(false)
    }
  }, [tenantId, rangeStart, rangeEnd])

  useEffect(() => {
    loadData()
  }, [loadData])

  const totals = useMemo(() => {
    const totalMoney = rows.reduce((s, r) => s + r.total, 0)
    const totalUnits = rows.reduce((s, r) => s + r.units, 0)
    const distinct = rows.length
    return { totalMoney, totalUnits, distinct }
  }, [rows])

  const normStart = rangeStart <= rangeEnd ? rangeStart : rangeEnd
  const normEnd = rangeStart <= rangeEnd ? rangeEnd : rangeStart

  const shortcuts: { key: ShortcutKey; label: string }[] = [
    { key: 'week', label: 'Esta semana' },
    { key: 'month', label: 'Este mes' },
    { key: 'custom', label: 'Personalizado' },
  ]

  return (
    <div style={{ maxWidth: '430px', margin: '0 auto', padding: '0 16px', boxSizing: 'border-box', overflowX: 'hidden' }}>
      {/* Header */}
      <div style={{ padding: '14px 0 4px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
          <button
            type="button"
            aria-label="Volver a Métricas"
            onClick={() => navigate('/owner/metrics')}
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
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={C.slate600} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M19 12H5M12 19l-7-7 7-7" />
            </svg>
          </button>
          <div style={{ minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <h1
                style={{
                  fontFamily: 'Syne, sans-serif',
                  fontWeight: 700,
                  fontSize: 'clamp(15px, 4.6vw, 18px)',
                  color: C.ink,
                  margin: 0,
                  lineHeight: 1.2,
                }}
              >
                Productos
              </h1>
              <span
                style={{
                  width: 24,
                  height: 24,
                  borderRadius: 8,
                  background: C.blueLt,
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                <BoxIcon />
              </span>
            </div>
            <p
              style={{
                color: C.slate500,
                fontSize: 'clamp(11px, 3.33vw, 13px)',
                fontFamily: 'Space Grotesk, sans-serif',
                margin: '2px 0 0 0',
              }}
            >
              Ventas y planificación de compras
            </p>
          </div>
        </div>

        {/* Shortcut pills */}
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '12px' }}>
          {shortcuts.map((sc) => {
            const active = activeShortcut === sc.key
            return (
              <button
                key={sc.key}
                onClick={() => applyShortcut(sc.key)}
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
                {sc.label}
              </button>
            )
          })}
        </div>

        {/* Custom date inputs */}
        {activeShortcut === 'custom' && (
          <div style={{ display: 'flex', gap: '12px', marginBottom: '12px' }}>
            <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <label style={dateLabelStyle}>Desde:</label>
              <input
                type="date"
                value={rangeStart}
                max={todayAR}
                onChange={(e) => setRangeStart(e.target.value)}
                style={inputStyle}
              />
            </div>
            <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <label style={dateLabelStyle}>Hasta:</label>
              <input
                type="date"
                value={rangeEnd}
                max={todayAR}
                onChange={(e) => setRangeEnd(e.target.value)}
                style={inputStyle}
              />
            </div>
          </div>
        )}

        {/* Active range label */}
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
          <span>{formatDateDayMonth(normStart)} – {formatDateDayMonth(normEnd)}</span>
        </div>
      </div>

      {/* Summary cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px', marginTop: '16px' }}>
        <SummaryCard label="Total" value={fmtMoney(totals.totalMoney)} accent={C.blue} />
        <SummaryCard label="Unidades" value={String(totals.totalUnits)} />
        <SummaryCard label="Productos" value={String(totals.distinct)} />
      </div>

      {/* Table / states */}
      {loading ? (
        <LoadingSpinner />
      ) : rows.length === 0 ? (
        <EmptyState />
      ) : (
        <div
          style={{
            background: '#fff',
            borderRadius: '16px',
            border: `1px solid ${C.borderLt}`,
            boxShadow: '0 1px 2px rgba(15,23,42,0.04)',
            overflow: 'hidden',
            marginTop: '16px',
          }}
        >
          {/* Header row */}
          <div style={{ display: 'flex', alignItems: 'center', padding: '12px 16px', background: '#F8FAFC', borderBottom: `1px solid ${C.borderLt}` }}>
            <span style={{ ...thStyle, flex: 1 }}>Producto</span>
            <span style={{ ...thStyle, width: 72, textAlign: 'right' }}>Unidades</span>
            <span style={{ ...thStyle, width: 96, textAlign: 'right' }}>Total</span>
          </div>

          {/* Data rows */}
          {rows.map((r, i) => (
            <div
              key={r.name}
              style={{
                display: 'flex',
                alignItems: 'center',
                padding: '12px 16px',
                background: i % 2 === 0 ? '#fff' : '#F8FAFC',
                borderBottom: `1px solid ${C.borderLt}`,
              }}
            >
              <span
                style={{
                  flex: 1,
                  minWidth: 0,
                  fontFamily: 'Space Grotesk, sans-serif',
                  fontWeight: 500,
                  fontSize: 'clamp(13px, 3.59vw, 14px)',
                  color: C.ink,
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  paddingRight: '8px',
                }}
              >
                {r.name}
              </span>
              <span
                style={{
                  width: 72,
                  textAlign: 'right',
                  fontFamily: "'Inter', system-ui, sans-serif",
                  fontWeight: 700,
                  fontSize: 'clamp(13px, 3.59vw, 14px)',
                  color: C.ink,
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                {r.units}
              </span>
              <span
                style={{
                  width: 96,
                  textAlign: 'right',
                  fontFamily: "'Inter', system-ui, sans-serif",
                  fontWeight: 700,
                  fontSize: 'clamp(13px, 3.59vw, 14px)',
                  color: C.ink,
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                {fmtMoney(r.total)}
              </span>
            </div>
          ))}

          {/* TOTAL row */}
          <div style={{ display: 'flex', alignItems: 'center', padding: '14px 16px', background: C.ink }}>
            <span
              style={{
                flex: 1,
                fontFamily: 'Syne, sans-serif',
                fontWeight: 700,
                fontSize: 'clamp(12px, 3.33vw, 13px)',
                color: '#fff',
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
              }}
            >
              Total
            </span>
            <span
              style={{
                width: 72,
                textAlign: 'right',
                fontFamily: "'Inter', system-ui, sans-serif",
                fontWeight: 800,
                fontSize: 'clamp(13px, 3.59vw, 14px)',
                color: '#fff',
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              {totals.totalUnits}
            </span>
            <span
              style={{
                width: 96,
                textAlign: 'right',
                fontFamily: "'Inter', system-ui, sans-serif",
                fontWeight: 800,
                fontSize: 'clamp(13px, 3.59vw, 14px)',
                color: '#60A5FA',
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              {fmtMoney(totals.totalMoney)}
            </span>
          </div>
        </div>
      )}

      {/* Spacer to clear the floating bottom-nav */}
      <div style={{ height: '110px' }} />
    </div>
  )
}

// =============================================================================
// Subcomponents / styles
// =============================================================================
const thStyle: React.CSSProperties = {
  fontFamily: 'Space Grotesk, sans-serif',
  fontWeight: 600,
  fontSize: '11px',
  textTransform: 'uppercase',
  letterSpacing: '0.5px',
  color: C.slate500,
}

const dateLabelStyle: React.CSSProperties = {
  fontSize: '12px',
  color: C.slate500,
  fontFamily: 'Space Grotesk, sans-serif',
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

function SummaryCard({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <div
      style={{
        background: '#fff',
        border: `1px solid ${C.borderLt}`,
        borderRadius: '16px',
        padding: '14px 12px',
        boxShadow: '0 1px 2px rgba(15,23,42,0.04)',
        display: 'flex',
        flexDirection: 'column',
        gap: '6px',
        minWidth: 0,
      }}
    >
      <div
        style={{
          fontFamily: 'Space Grotesk, sans-serif',
          fontWeight: 500,
          fontSize: 'clamp(11px, 3.08vw, 12px)',
          color: C.slate500,
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontFamily: "'Inter', system-ui, sans-serif",
          fontWeight: 800,
          fontSize: 'clamp(16px, 5.1vw, 20px)',
          color: accent || C.ink,
          letterSpacing: '-0.5px',
          lineHeight: 1.05,
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}
      >
        {value}
      </div>
    </div>
  )
}

function LoadingSpinner() {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '200px',
        gap: '16px',
      }}
    >
      <style>{`@keyframes spinProd { to { transform: rotate(360deg) } }`}</style>
      <div
        style={{
          width: 40,
          height: 40,
          borderRadius: '50%',
          border: `3px solid ${C.borderLt}`,
          borderTopColor: C.blue,
          animation: 'spinProd 0.8s linear infinite',
        }}
      />
      <p style={{ fontSize: 14, color: C.slate400, fontFamily: 'Space Grotesk, sans-serif', margin: 0 }}>
        Cargando ventas...
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
        marginTop: '16px',
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
        <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
        <path d="M3.27 6.96L12 12.01l8.73-5.05M12 22.08V12" />
      </svg>
      <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 600, fontSize: '18px', color: C.ink, marginBottom: '8px' }}>
        Sin ventas de productos
      </div>
      <div style={{ fontSize: '14px', color: C.slate500, fontFamily: 'Space Grotesk, sans-serif' }}>
        No se registraron ventas en este período
      </div>
    </div>
  )
}

function BoxIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={C.blue} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
      <path d="M3.27 6.96L12 12.01l8.73-5.05M12 22.08V12" />
    </svg>
  )
}

function CalendarIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={C.slate500} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <path d="M16 2v4M8 2v4M3 10h18" />
    </svg>
  )
}

export default Products
