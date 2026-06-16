import { useEffect, useMemo, useState } from 'react'
import { useOutletContext, useNavigate } from 'react-router-dom'
import { useTenantStore } from '../../stores/tenantStore'
import { supabase } from '../../config/supabase'

async function getAuthHeader(): Promise<string> {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) {
    const { data: { session: refreshed } } = await supabase.auth.refreshSession()
    if (!refreshed?.access_token) throw new Error('No session')
    return `Bearer ${refreshed.access_token}`
  }
  return `Bearer ${session.access_token}`
}

interface MetricsData {
  dia_mas_cortes: { fecha: string; total: number } | null
  hora_pico: { hora: number; total: number } | null
  mes_top: { mes: string; total: number } | null
  barbero_estrella: { nombre: string; servicios: number; generado: number } | null
  servicio_popular: { nombre: string; total: number } | null
  ticket_promedio: number | null
  historico: { total_servicios: number; total_facturado: number; total_owner: number }
  semana_actual: { servicios: number; facturado: number }
  semana_anterior: { servicios: number; facturado: number }
  servicios_por_dia: { dia: string; servicios: number; facturado: number }[]
  gastos_mes: number
}

type OutletCtx = { onOpenDrawer?: () => void }

function formatCurrency(amount: number): string {
  // "$" glued to digits (no locale currency NBSP) so "$7.181.000" renders as one
  // homogeneous block, same as LivePanel.
  return '$' + new Intl.NumberFormat('es-AR', { maximumFractionDigits: 0 }).format(amount)
}

function formatNumber(num: number): string {
  return new Intl.NumberFormat('es-AR').format(num)
}

// "YYYY-MM-DD" (Argentina calendar date from get-metrics) → Spanish weekday, e.g. "Sábado".
// Built with the local-date constructor to avoid a UTC day shift; presentation only.
function dayNameFromISO(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number)
  if (!y || !m || !d) return iso
  const name = new Date(y, m - 1, d).toLocaleDateString('es-AR', { weekday: 'long' })
  return name.charAt(0).toUpperCase() + name.slice(1)
}

// ── Reused from original: do not touch logic ─────────────────────────────────
function calculateWeekVariation(metrics: MetricsData | null) {
  if (!metrics) return { servicios: 0, facturado: 0 }
  const { semana_actual, semana_anterior } = metrics
  const serviciosVar = semana_anterior.servicios === 0
    ? 0
    : ((semana_actual.servicios - semana_anterior.servicios) / semana_anterior.servicios) * 100
  const facturadoVar = semana_anterior.facturado === 0
    ? 0
    : ((semana_actual.facturado - semana_anterior.facturado) / semana_anterior.facturado) * 100
  return { servicios: serviciosVar, facturado: facturadoVar }
}

// ── Icons ────────────────────────────────────────────────────────────────────
const BarsIcon = ({ color = '#2563EB', size = 16 }: { color?: string; size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path d="M4 19V5" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
    <path d="M4 19h16" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
    <rect x="7" y="11" width="3" height="6" rx="0.5" stroke={color} strokeWidth="1.8" />
    <rect x="12" y="8" width="3" height="9" rx="0.5" stroke={color} strokeWidth="1.8" />
    <rect x="17" y="5" width="3" height="12" rx="0.5" stroke={color} strokeWidth="1.8" />
  </svg>
)

const InfoIcon = ({ color = 'rgba(255,255,255,0.9)', size = 14 }: { color?: string; size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <circle cx="12" cy="12" r="9" stroke={color} strokeWidth="1.6" />
    <path d="M12 11v5" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
    <circle cx="12" cy="8" r="1" fill={color === 'rgba(255,255,255,0.9)' ? '#fff' : color} />
  </svg>
)

const CalendarBtnIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <rect x="3" y="5" width="18" height="16" rx="2" stroke="#475569" strokeWidth="1.6" />
    <path d="M16 3v4M8 3v4M3 10h18" stroke="#475569" strokeWidth="1.6" strokeLinecap="round" />
  </svg>
)

const HamburgerIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path d="M4 7h16M4 12h16M4 17h16" stroke="#0F172A" strokeWidth="1.8" strokeLinecap="round" />
  </svg>
)

const TrendingUpIcon = ({ color = '#16A34A' }: { color?: string }) => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path d="M3 17l5-5 4 4 8-9" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M15 7h5v5" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
)

const ScissorsSmallIcon = ({ color = '#7C3AED' }: { color?: string }) => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <circle cx="6" cy="6" r="2.5" stroke={color} strokeWidth="1.7" />
    <circle cx="6" cy="18" r="2.5" stroke={color} strokeWidth="1.7" />
    <path d="M20 4L8.12 15.88" stroke={color} strokeWidth="1.7" strokeLinecap="round" />
    <path d="M14.47 14.48L20 20" stroke={color} strokeWidth="1.7" strokeLinecap="round" />
    <path d="M8.12 8.12L12 12" stroke={color} strokeWidth="1.7" strokeLinecap="round" />
  </svg>
)

const ReceiptSmallIcon = ({ color = '#EA580C' }: { color?: string }) => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path d="M6 3h12v18l-3-2-3 2-3-2-3 2V3z" stroke={color} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M9 8h6M9 12h6M9 16h4" stroke={color} strokeWidth="1.6" strokeLinecap="round" />
  </svg>
)

const CalendarSmallIcon = ({ color = '#2563EB' }: { color?: string }) => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <rect x="3" y="5" width="18" height="16" rx="2" stroke={color} strokeWidth="1.7" />
    <path d="M8 3v4M16 3v4M3 9h18" stroke={color} strokeWidth="1.7" strokeLinecap="round" />
  </svg>
)

const LeafIcon = ({ color = '#16A34A' }: { color?: string }) => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path d="M20 4c0 8-6 14-14 14 0-8 6-14 14-14z" stroke={color} strokeWidth="1.7" strokeLinejoin="round" />
    <path d="M5 19c4-4 8-7 13-13" stroke={color} strokeWidth="1.7" strokeLinecap="round" />
  </svg>
)

const ChevronDownIcon = ({ color = '#0F172A' }: { color?: string }) => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path d="M6 9l6 6 6-6" stroke={color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
)

// ── Hero decorative SVG curve (no real values shown) ─────────────────────────
const HERO_CURVE_PATH = 'M0 80 C 50 70, 90 55, 140 60 S 220 90, 270 70 S 350 30, 430 45'

// ── Bar chart toggle metric ──────────────────────────────────────────────────
type BarMetric = 'facturado' | 'servicios'

export function Metrics() {
  const { tenant } = useTenantStore()
  const ctx = useOutletContext<OutletCtx>() || {}
  const [metrics, setMetrics] = useState<MetricsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [barMetric, setBarMetric] = useState<BarMetric>('facturado')
  const [openSelector, setOpenSelector] = useState(false)

  useEffect(() => {
    const fetchMetrics = async () => {
      if (!tenant?.id) return
      setLoading(true)
      setError(null)
      try {
        const authHeader = await getAuthHeader()
        const response = await fetch(`/api/get-metrics?tenant_id=${tenant.id}`, {
          headers: { 'Authorization': authHeader },
        })
        if (!response.ok) {
          throw new Error(`Error ${response.status}: ${response.statusText}`)
        }
        const data = await response.json()
        setMetrics(data)
      } catch (err) {
        console.error('Failed to fetch metrics:', err)
        setError(err instanceof Error ? err.message : 'Error desconocido')
      } finally {
        setLoading(false)
      }
    }

    if (!tenant?.id) {
      const retryId = setTimeout(() => { fetchMetrics() }, 500)
      return () => clearTimeout(retryId)
    }

    fetchMetrics()
  }, [tenant?.id])

  const weekVariation = calculateWeekVariation(metrics)
  const hasData = !!metrics && (metrics.historico.total_servicios > 0 || metrics.dia_mas_cortes !== null)

  // Responsive type scale, anchored at 390px
  const fs = {
    headerTitle: 'clamp(15px, 5.64vw, 22px)',       // 22px @390
    headerSub: 'clamp(11px, 3.33vw, 13px)',         // 13px @390
    heroLabel: 'clamp(11px, 3.33vw, 13px)',         // 13px @390
    heroNumber: 'clamp(26px, 8.7vw, 34px)',         // 34px @390
    metricLabel: 'clamp(9px, 2.82vw, 11px)',        // 11px @390
    metricNumber: 'clamp(10px, 3.0vw, 12px)',       // small enough that "$2.546.500" fits the ~82px card w/o truncating
    metricSub: 'clamp(9px, 2.56vw, 10px)',          // 10px @390
    sectionTitle: 'clamp(14px, 4.1vw, 16px)',       // 16px @390
    sectionSelector: 'clamp(11px, 3.33vw, 13px)',   // 13px @390
    barLabel: 'clamp(9px, 2.56vw, 10px)',           // 10px @390
    barValue: 'clamp(9px, 2.56vw, 10px)',           // 10px @390
    insightKicker: 'clamp(10px, 2.82vw, 11px)',     // 11px @390
    insightTitle: 'clamp(13px, 4.1vw, 16px)',       // 16px @390
    insightBody: 'clamp(11px, 3.33vw, 13px)',       // 13px @390
    insightBadge: 'clamp(10px, 3.08vw, 12px)',      // 12px @390
  }

  // ── Header (shared across loading/error/empty/main) ────────────────────────
  const renderHeader = () => (
    <div style={{ padding: '14px 16px 8px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
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
            <HamburgerIcon />
          </button>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <h1 style={{
                fontFamily: 'Syne, sans-serif',
                fontWeight: 700,
                fontSize: fs.headerTitle,
                color: '#0F172A',
                margin: 0,
                lineHeight: 1.2,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}>
                Métricas
              </h1>
              <span style={{
                width: '24px',
                height: '24px',
                borderRadius: '8px',
                background: '#DBEAFE',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}>
                <BarsIcon color="#2563EB" size={14} />
              </span>
            </div>
            <div style={{
              fontSize: fs.headerSub,
              color: '#64748B',
              marginTop: '2px',
              fontWeight: 400,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}>
              Análisis y reportes de tu negocio
            </div>
          </div>
        </div>
        <button
          aria-label="Calendario"
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
          <CalendarBtnIcon />
        </button>
      </div>
    </div>
  )

  // ── LOADING ────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div style={{ maxWidth: '430px', margin: '0 auto', width: '100%', boxSizing: 'border-box', overflowX: 'hidden', paddingBottom: '120px' }}>
        {renderHeader()}
        <div style={{ padding: '12px 16px 0' }}>
          <div style={{ height: '180px', background: '#E5E7EB', borderRadius: '20px', marginBottom: '20px', animation: 'pulse 1.5s infinite' }} />
          <div style={{ display: 'flex', gap: '8px', marginBottom: '20px' }}>
            {[1, 2, 3, 4].map(i => (
              <div key={i} style={{ flex: 1, height: '100px', background: '#E5E7EB', borderRadius: '16px', animation: 'pulse 1.5s infinite' }} />
            ))}
          </div>
          <div style={{ height: '240px', background: '#E5E7EB', borderRadius: '16px', marginBottom: '20px', animation: 'pulse 1.5s infinite' }} />
          <div style={{ height: '120px', background: '#E5E7EB', borderRadius: '16px', animation: 'pulse 1.5s infinite' }} />
        </div>
      </div>
    )
  }

  // ── ERROR ──────────────────────────────────────────────────────────────────
  if (error) {
    return (
      <div style={{ maxWidth: '430px', margin: '0 auto', width: '100%', boxSizing: 'border-box', overflowX: 'hidden', paddingBottom: '120px' }}>
        {renderHeader()}
        <div style={{ padding: '12px 16px' }}>
          <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: '16px', padding: '24px', textAlign: 'center' }}>
            <div style={{ fontFamily: 'Space Grotesk, sans-serif', fontSize: '14px', color: '#B91C1C', marginBottom: '16px', lineHeight: 1.5 }}>
              Error al cargar métricas: {error}
            </div>
            <button
              onClick={() => window.location.reload()}
              style={{
                background: '#2563EB',
                color: '#fff',
                border: 'none',
                borderRadius: '12px',
                padding: '10px 22px',
                fontFamily: 'Space Grotesk, sans-serif',
                fontWeight: 600,
                fontSize: '14px',
                cursor: 'pointer',
              }}
            >
              Reintentar
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ── NO DATA ────────────────────────────────────────────────────────────────
  if (!hasData) {
    return (
      <div style={{ maxWidth: '430px', margin: '0 auto', width: '100%', boxSizing: 'border-box', overflowX: 'hidden', paddingBottom: '120px' }}>
        {renderHeader()}
        <div style={{ padding: '12px 16px' }}>
          <div style={{
            background: '#fff',
            border: '1px solid #E2E8F0',
            borderRadius: '20px',
            padding: '48px 24px',
            textAlign: 'center',
          }}>
            <div style={{
              width: '56px',
              height: '56px',
              borderRadius: '16px',
              background: '#EFF6FF',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: '16px',
            }}>
              <BarsIcon color="#2563EB" size={26} />
            </div>
            <div style={{
              fontFamily: 'Syne, sans-serif',
              fontSize: '16px',
              fontWeight: 700,
              color: '#0F172A',
              marginBottom: '6px',
            }}>
              Aún no hay datos
            </div>
            <div style={{ fontSize: '13px', color: '#64748B', lineHeight: 1.5 }}>
              Registrá tu primer servicio para empezar a ver tus métricas.
            </div>
          </div>
        </div>
      </div>
    )
  }

  // ── MAIN ───────────────────────────────────────────────────────────────────
  return <MainContent
    metrics={metrics!}
    weekVariation={weekVariation}
    fs={fs}
    renderHeader={renderHeader}
    barMetric={barMetric}
    setBarMetric={setBarMetric}
    openSelector={openSelector}
    setOpenSelector={setOpenSelector}
  />
}

// ─────────────────────────────────────────────────────────────────────────────
// Main dashboard content — extracted to keep top-level component scannable.
// ─────────────────────────────────────────────────────────────────────────────
type FsScale = {
  heroLabel: string
  heroNumber: string
  metricLabel: string
  metricNumber: string
  metricSub: string
  sectionTitle: string
  sectionSelector: string
  barLabel: string
  barValue: string
  insightKicker: string
  insightTitle: string
  insightBody: string
  insightBadge: string
  headerTitle: string
  headerSub: string
}

function MainContent({
  metrics,
  weekVariation,
  fs,
  renderHeader,
  barMetric,
  setBarMetric,
  openSelector,
  setOpenSelector,
}: {
  metrics: MetricsData
  weekVariation: { servicios: number; facturado: number }
  fs: FsScale
  renderHeader: () => React.ReactNode
  barMetric: BarMetric
  setBarMetric: (m: BarMetric) => void
  openSelector: boolean
  setOpenSelector: (b: boolean) => void
}) {
  const navigate = useNavigate()
  // Bar chart data: pick metric and find max for normalization
  const barData = metrics.servicios_por_dia
  const values = barData.map(d => (barMetric === 'facturado' ? d.facturado : d.servicios))
  const maxValue = useMemo(() => Math.max(...values, 1), [values])
  // Real max (no floor) — drives the Y-axis labels. 0 when the whole week is empty,
  // so the axis shows "$0"/"0" instead of an invented scale.
  const realMax = useMemo(() => Math.max(...values, 0), [values])
  const yAxisLabels = useMemo(() => {
    const fmt = (n: number) => (barMetric === 'facturado' ? formatCurrency(Math.round(n)) : formatNumber(Math.round(n)))
    return [fmt(realMax), fmt((realMax * 2) / 3), fmt(realMax / 3), fmt(0)]
  }, [realMax, barMetric])
  const maxIndex = useMemo(() => {
    let idx = -1
    let best = -1
    values.forEach((v, i) => {
      if (v > best) { best = v; idx = i }
    })
    return best > 0 ? idx : -1
  }, [values])

  // Insights derived from real data
  const facVar = weekVariation.facturado
  const insightTitle = facVar >= 0 ? '¡Vas por buen camino!' : 'Seguimiento de la semana'
  const isFlat = Math.abs(facVar) < 0.05 || metrics.semana_anterior.facturado === 0
  const insightBody = isFlat
    ? 'Tu facturación esta semana se mantiene estable respecto a la semana pasada.'
    : `Tu facturación esta semana es ${Math.abs(facVar).toFixed(1)}% ${facVar >= 0 ? 'mayor' : 'menor'} que la semana pasada.`

  const badgeUp = facVar >= 0
  const badgeColor = isFlat ? '#94A3B8' : (badgeUp ? '#16A34A' : '#DC2626')
  const badgeBg = isFlat ? '#F1F5F9' : (badgeUp ? '#DCFCE7' : '#FEE2E2')

  return (
    <div style={{ maxWidth: '430px', margin: '0 auto', width: '100%', boxSizing: 'border-box', overflowX: 'hidden', paddingBottom: '120px' }}>
      {renderHeader()}

      {/* ── HERO — Facturación total (gradient, decorative curve) ─────────── */}
      <div style={{ padding: '12px 16px 0' }}>
        <div style={{
          position: 'relative',
          borderRadius: '20px',
          padding: '18px',
          minHeight: '170px',
          background: 'linear-gradient(135deg, #3B82F6 0%, #2563EB 55%, #1D4ED8 100%)',
          color: '#fff',
          overflow: 'hidden',
          boxShadow: '0 10px 30px rgba(37, 99, 235, 0.30)',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          boxSizing: 'border-box',
        }}>
          <svg
            viewBox="0 0 430 110"
            preserveAspectRatio="none"
            style={{ position: 'absolute', left: 0, right: 0, bottom: 0, width: '100%', height: '110px', opacity: 0.7, pointerEvents: 'none' }}
            aria-hidden="true"
          >
            <defs>
              <linearGradient id="metricsHeroCurve" x1="0" y1="1" x2="1" y2="0">
                <stop offset="0%" stopColor="rgba(255,255,255,0)" />
                <stop offset="100%" stopColor="rgba(255,255,255,0.55)" />
              </linearGradient>
            </defs>
            <path d={HERO_CURVE_PATH} stroke="url(#metricsHeroCurve)" strokeWidth="2" fill="none" />
            <path d={`${HERO_CURVE_PATH} L 430 110 L 0 110 Z`} fill="rgba(255,255,255,0.08)" />
          </svg>

          <div style={{ position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: fs.heroLabel, color: '#fff', fontWeight: 600 }}>
              <span>Facturación total</span>
              <InfoIcon />
            </div>
            <div style={{
              // Use Inter (loaded @800) so "$" and digits render as one homogeneous block,
              // matching the LivePanel hero treatment.
              fontFamily: "'Inter', system-ui, sans-serif",
              fontWeight: 800,
              fontSize: fs.heroNumber,
              letterSpacing: '-1px',
              lineHeight: 1.05,
              color: '#fff',
              marginTop: '4px',
            }}>
              {formatCurrency(metrics.historico.total_facturado)}
            </div>
            <div style={{ fontSize: 'clamp(10px, 3.08vw, 12px)', color: 'rgba(255,255,255,0.85)', fontWeight: 500, marginTop: '2px' }}>
              Desde el primer servicio
            </div>
          </div>
        </div>
      </div>

      {/* ── 4 CARDS ──────────────────────────────────────────────────────── */}
      <div style={{ padding: '20px 16px 0' }}>
        <div style={{
          display: 'flex',
          gap: '8px',
          alignItems: 'stretch',
          overflowX: 'auto',
          // Hide scrollbar where supported; row only scrolls if it doesn't fit
          scrollbarWidth: 'none',
        }}>
          <SmallMetricCard
            iconBg="#DCFCE7"
            icon={<TrendingUpIcon color="#16A34A" />}
            label="Ganancia neta"
            value={formatCurrency(metrics.historico.total_owner)}
            sub="Histórico"
            fs={fs}
          />
          <SmallMetricCard
            iconBg="#EDE9FE"
            icon={<ScissorsSmallIcon color="#7C3AED" />}
            label="Servicios totales"
            value={formatNumber(metrics.historico.total_servicios)}
            sub="Histórico"
            fs={fs}
          />
          <SmallMetricCard
            iconBg="#FFEDD5"
            icon={<ReceiptSmallIcon color="#EA580C" />}
            label="Gastos del mes"
            value={formatCurrency(metrics.gastos_mes || 0)}
            sub="Este mes"
            fs={fs}
          />
          <SmallMetricCard
            iconBg="#DBEAFE"
            icon={<CalendarSmallIcon color="#2563EB" />}
            label="Más activo"
            value={metrics.dia_mas_cortes ? dayNameFromISO(metrics.dia_mas_cortes.fecha) : '—'}
            sub={metrics.hora_pico ? `Pico: ${metrics.hora_pico.hora}hs` : 'Sin datos'}
            fs={fs}
          />
        </div>
      </div>

      {/* ── FACTURACIÓN DIARIA — bar chart with toggle ───────────────────── */}
      <div style={{ padding: '24px 16px 0' }}>
        <div style={{
          background: '#fff',
          border: '1px solid #F1F5F9',
          borderRadius: '20px',
          padding: '16px 14px 14px',
          boxShadow: '0 1px 2px rgba(15,23,42,0.04)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', marginBottom: '14px' }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', minWidth: 0 }}>
              <h2 style={{
                fontFamily: 'Syne, sans-serif',
                fontWeight: 700,
                fontSize: fs.sectionTitle,
                color: '#0F172A',
                margin: 0,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}>
                Facturación diaria
              </h2>
              <InfoIcon color="#94A3B8" size={13} />
            </div>
            <div style={{ position: 'relative', flexShrink: 0 }}>
              <button
                onClick={() => setOpenSelector(!openSelector)}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  background: '#F8FAFC',
                  border: '1px solid #E2E8F0',
                  borderRadius: '999px',
                  padding: '5px 10px',
                  fontSize: fs.sectionSelector,
                  fontWeight: 600,
                  color: '#0F172A',
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                }}
              >
                <span>{barMetric === 'facturado' ? 'Ingresos' : 'Servicios'}</span>
                <ChevronDownIcon />
              </button>
              {openSelector && (
                <>
                  <div
                    onClick={() => setOpenSelector(false)}
                    style={{ position: 'fixed', inset: 0, zIndex: 50 }}
                  />
                  <div style={{
                    position: 'absolute',
                    top: 'calc(100% + 6px)',
                    right: 0,
                    background: '#fff',
                    border: '1px solid #E2E8F0',
                    borderRadius: '12px',
                    boxShadow: '0 8px 24px rgba(15,23,42,0.10)',
                    padding: '4px',
                    zIndex: 60,
                    minWidth: '120px',
                  }}>
                    {(['facturado', 'servicios'] as BarMetric[]).map(opt => (
                      <button
                        key={opt}
                        onClick={() => { setBarMetric(opt); setOpenSelector(false) }}
                        style={{
                          display: 'block',
                          width: '100%',
                          textAlign: 'left',
                          background: barMetric === opt ? '#EFF6FF' : 'transparent',
                          color: barMetric === opt ? '#2563EB' : '#0F172A',
                          border: 'none',
                          borderRadius: '8px',
                          padding: '8px 10px',
                          fontSize: fs.sectionSelector,
                          fontWeight: 600,
                          cursor: 'pointer',
                          fontFamily: 'inherit',
                        }}
                      >
                        {opt === 'facturado' ? 'Ingresos' : 'Servicios'}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Chart: Y axis + gridlines + baseline always render, even when every value is 0 */}
          <div style={{ display: 'flex', gap: '8px' }}>
            {/* Y axis labels */}
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              height: '160px',
              minWidth: '34px',
              textAlign: 'right',
              fontSize: fs.barLabel,
              color: '#CBD5E1',
              fontWeight: 500,
            }}>
              {yAxisLabels.map((lbl, i) => (
                <span key={i} style={{ whiteSpace: 'nowrap', lineHeight: 1 }}>{lbl}</span>
              ))}
            </div>
            {/* Plot area */}
            <div style={{ position: 'relative', flex: 1, height: '160px' }}>
              {/* Horizontal gridlines (last one is the baseline) */}
              {[0, 1, 2, 3].map(g => (
                <div key={g} style={{
                  position: 'absolute',
                  left: 0,
                  right: 0,
                  top: `${(g * 100) / 3}%`,
                  borderTop: g === 3 ? '1px solid #E2E8F0' : '1px solid #F1F5F9',
                }} />
              ))}
              {/* Bars */}
              <div style={{
                position: 'absolute',
                inset: 0,
                display: 'grid',
                gridTemplateColumns: 'repeat(7, 1fr)',
                gap: '6px',
                alignItems: 'end',
              }}>
                {barData.map((d, i) => {
                  const v = barMetric === 'facturado' ? d.facturado : d.servicios
                  const isMax = i === maxIndex && v > 0
                  const heightPct = v === 0 ? 0 : Math.max(8, Math.round((v / maxValue) * 100))
                  return (
                    <div key={i} style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'flex-end',
                      height: '100%',
                      gap: '4px',
                    }}>
                      {isMax && (
                        <span style={{
                          fontSize: fs.barValue,
                          fontWeight: 700,
                          color: '#1D4ED8',
                          background: '#DBEAFE',
                          padding: '2px 6px',
                          borderRadius: '999px',
                          whiteSpace: 'nowrap',
                        }}>
                          {barMetric === 'facturado' ? formatCurrency(v) : formatNumber(v)}
                        </span>
                      )}
                      <div style={{
                        width: '100%',
                        height: `${heightPct}%`,
                        minHeight: v > 0 ? '4px' : '0',
                        background: isMax ? '#2563EB' : '#BFDBFE',
                        borderRadius: '6px 6px 0 0',
                        transition: 'height 200ms ease',
                      }} />
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
          {/* X axis day labels — aligned with the plot area (Y gutter offset) */}
          <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
            <div style={{ minWidth: '34px' }} aria-hidden="true" />
            <div style={{ flex: 1, display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '6px' }}>
              {barData.map((d, i) => (
                <div key={i} style={{
                  textAlign: 'center',
                  fontSize: fs.barLabel,
                  color: '#94A3B8',
                  fontWeight: 500,
                }}>
                  {d.dia}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── INSIGHTS card (green) ─────────────────────────────────────────── */}
      <div style={{ padding: '24px 16px 0' }}>
        <div style={{
          position: 'relative',
          background: 'linear-gradient(135deg, #ECFDF5 0%, #D1FAE5 100%)',
          border: '1px solid #BBF7D0',
          borderRadius: '20px',
          padding: '16px 16px 18px',
          overflow: 'hidden',
        }}>
          {/* Decorative SVG curve, no values */}
          <svg
            viewBox="0 0 200 80"
            preserveAspectRatio="none"
            style={{
              position: 'absolute',
              right: -8,
              top: 8,
              width: '120px',
              height: '70px',
              opacity: 0.55,
              pointerEvents: 'none',
            }}
            aria-hidden="true"
          >
            <path
              d="M0 60 C 40 50, 70 30, 110 25 S 170 10, 200 5"
              stroke="#16A34A"
              strokeWidth="2"
              fill="none"
              strokeLinecap="round"
            />
          </svg>

          <div style={{ position: 'relative', zIndex: 1, display: 'flex', alignItems: 'flex-start', gap: '10px', marginBottom: '8px' }}>
            <span style={{
              width: '32px',
              height: '32px',
              borderRadius: '10px',
              background: '#DCFCE7',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}>
              <LeafIcon color="#16A34A" />
            </span>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{
                fontSize: fs.insightKicker,
                color: '#15803D',
                fontWeight: 600,
                letterSpacing: '0.4px',
                textTransform: 'uppercase',
                marginBottom: '2px',
              }}>
                Insights
              </div>
              <div style={{
                fontFamily: 'Syne, sans-serif',
                fontWeight: 700,
                fontSize: fs.insightTitle,
                color: '#064E3B',
                lineHeight: 1.25,
              }}>
                {insightTitle}
              </div>
            </div>
          </div>
          <div style={{
            position: 'relative',
            zIndex: 1,
            display: 'flex',
            alignItems: 'flex-end',
            justifyContent: 'space-between',
            gap: '10px',
            marginTop: '6px',
          }}>
            <div style={{
              fontSize: fs.insightBody,
              color: '#065F46',
              lineHeight: 1.45,
              fontWeight: 500,
              flex: 1,
              minWidth: 0,
            }}>
              {insightBody}
            </div>
            {!isFlat && (
              <span style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '2px',
                background: badgeBg,
                color: badgeColor,
                fontSize: fs.insightBadge,
                fontWeight: 700,
                padding: '4px 9px',
                borderRadius: '999px',
                whiteSpace: 'nowrap',
                flexShrink: 0,
              }}>
                {badgeUp ? '↑' : '↓'} {Math.abs(facVar).toFixed(1)}%
              </span>
            )}
          </div>
        </div>
      </div>

      {/* ── Acceso a Ventas de productos ──────────────────────────────────── */}
      <div style={{ padding: '24px 16px 0' }}>
        <button
          type="button"
          onClick={() => navigate('/owner/products')}
          style={{
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            gap: '14px',
            background: '#fff',
            border: '1px solid #F1F5F9',
            borderRadius: '16px',
            padding: '16px',
            boxShadow: '0 1px 2px rgba(15,23,42,0.04)',
            cursor: 'pointer',
            textAlign: 'left',
          }}
        >
          <span style={{
            width: 44,
            height: 44,
            borderRadius: 12,
            background: '#DBEAFE',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#2563EB" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
              <path d="M3.27 6.96L12 12.01l8.73-5.05M12 22.08V12" />
            </svg>
          </span>
          <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '2px' }}>
            <span style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 'clamp(15px, 4.36vw, 17px)', color: '#0F172A', lineHeight: 1.15 }}>
              Ventas de productos
            </span>
            <span style={{ fontFamily: 'Space Grotesk, sans-serif', fontWeight: 400, fontSize: 'clamp(12px, 3.33vw, 13px)', color: '#64748B', lineHeight: 1.3 }}>
              Ver detalle por producto →
            </span>
          </span>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#94A3B8" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }} aria-hidden="true">
            <path d="M9 18l6-6-6-6" />
          </svg>
        </button>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Small metric card — 4 across, tinted icon chip, no pills, no sparklines.
// ─────────────────────────────────────────────────────────────────────────────
function SmallMetricCard({
  iconBg,
  icon,
  label,
  value,
  sub,
  fs,
}: {
  iconBg: string
  icon: React.ReactNode
  label: string
  value: string
  sub: string
  fs: FsScale
}) {
  return (
    <div style={{
      background: '#fff',
      border: '1px solid #F1F5F9',
      borderRadius: '16px',
      padding: '10px 8px',
      boxShadow: '0 1px 2px rgba(15,23,42,0.04)',
      display: 'flex',
      flexDirection: 'column',
      gap: '6px',
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
        fontSize: fs.metricLabel,
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
        fontFamily: "'Inter', system-ui, sans-serif",
        fontSize: fs.metricNumber,
        fontWeight: 800,
        color: '#0F172A',
        lineHeight: 1.1,
        letterSpacing: '-0.5px',
        whiteSpace: 'nowrap',
      }}>
        {value}
      </div>
      <div style={{
        fontSize: fs.metricSub,
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
