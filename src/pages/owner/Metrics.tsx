import { useEffect, useState } from 'react'
import { useTenantStore } from '../../stores/tenantStore'

function useMobile() {
  const [isMobile, setIsMobile] = useState(false)
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768)
    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])
  return isMobile
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
}

function formatDate(fecha: string): string {
  const date = new Date(fecha)
  const options: Intl.DateTimeFormatOptions = { weekday: 'long', day: 'numeric', month: 'long' }
  return date.toLocaleDateString('es-ES', options)
}

function formatHour(hora: number): string {
  return `${hora.toString().padStart(2, '0')}:00`
}

function formatMonth(mes: string): string {
  const [year, month] = mes.split('-')
  const date = new Date(parseInt(year), parseInt(month) - 1, 1)
  return date.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(amount)
}

function formatNumber(num: number): string {
  return new Intl.NumberFormat('es-AR').format(num)
}

function getArgentinaDateString(date = new Date()): string {
  return date.toLocaleDateString('en-CA', { timeZone: 'America/Argentina/Buenos_Aires' })
}

function getCurrentWeekRange(): string {
  const now = new Date()
  const argDateStr = getArgentinaDateString(now)
  const [year, month, day] = argDateStr.split('-').map(Number)
  const argNoon = new Date(Date.UTC(year, month - 1, day, 12, 0, 0))
  const dayOfWeek = argNoon.getUTCDay()
  const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek
  const monday = new Date(argNoon)
  monday.setUTCDate(argNoon.getUTCDate() + diffToMonday)
  const sunday = new Date(monday)
  sunday.setUTCDate(monday.getUTCDate() + 6)
  const format = (d: Date) =>
    d.toLocaleDateString('es-ES', {
      day: 'numeric',
      month: 'short',
      timeZone: 'America/Argentina/Buenos_Aires'
    })
  return `${format(monday)} - ${format(sunday)}`
}

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

const CalendarIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#3D3A8C" strokeWidth="2">
    <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
    <line x1="16" y1="2" x2="16" y2="6" />
    <line x1="8" y1="2" x2="8" y2="6" />
    <line x1="3" y1="10" x2="21" y2="10" />
  </svg>
)

const ClockIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#3D3A8C" strokeWidth="2">
    <circle cx="12" cy="12" r="10" />
    <polyline points="12 6 12 12 16 14" />
  </svg>
)

const ScissorsIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#3D3A8C" strokeWidth="2">
    <circle cx="6" cy="6" r="3" />
    <circle cx="6" cy="18" r="3" />
    <line x1="20" y1="4" x2="8.12" y2="15.88" />
    <line x1="14.47" y1="14.48" x2="20" y2="20" />
    <line x1="8.12" y1="8.12" x2="12" y2="12" />
  </svg>
)

const UserCircleIcon = ({ initial }: { initial: string }) => (
  <div style={{
    width: '36px',
    height: '36px',
    borderRadius: '50%',
    background: '#3D3A8C',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#fff',
    fontFamily: 'Syne, sans-serif',
    fontWeight: 700,
    fontSize: '14px'
  }}>
    {initial.toUpperCase()}
  </div>
)

export function Metrics() {
  const { tenant } = useTenantStore()
  const [metrics, setMetrics] = useState<MetricsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const isMobile = useMobile()

  useEffect(() => {
    const fetchMetrics = async () => {
      if (!tenant?.id) return
      setLoading(true)
      setError(null)
      try {
        const response = await fetch(`/api/get-metrics?tenant_id=${tenant.id}`)
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
  const hasData = metrics && (metrics.historico.total_servicios > 0 || metrics.dia_mas_cortes !== null)

  // ── LOADING ──────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '24px' }}>
        <div style={{ marginBottom: '32px' }}>
          <div style={{ width: '200px', height: '32px', background: '#f0f0f0', borderRadius: '8px', marginBottom: '8px', animation: 'pulse 1.5s infinite' }} />
          <div style={{ width: '300px', height: '16px', background: '#f0f0f0', borderRadius: '8px', animation: 'pulse 1.5s infinite' }} />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px', marginBottom: '32px' }}>
          {[1, 2, 3].map(i => (
            <div key={i} style={{ height: '100px', background: '#f0f0f0', borderRadius: '10px', animation: 'pulse 1.5s infinite' }} />
          ))}
        </div>
        <div style={{ background: '#f0f0f0', borderRadius: '10px', height: '180px', marginBottom: '32px', animation: 'pulse 1.5s infinite' }} />
        <div style={{ background: '#f0f0f0', borderRadius: '10px', height: '140px', marginBottom: '32px', animation: 'pulse 1.5s infinite' }} />
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '16px', marginBottom: '32px' }}>
          {[1, 2, 3, 4].map(i => (
            <div key={i} style={{ height: '160px', background: '#f0f0f0', borderRadius: '10px', animation: 'pulse 1.5s infinite' }} />
          ))}
        </div>
        <div style={{ background: '#f0f0f0', borderRadius: '10px', height: '100px', marginBottom: '32px', animation: 'pulse 1.5s infinite' }} />
        <div style={{ background: '#f0f0f0', borderRadius: '10px', height: '90px', animation: 'pulse 1.5s infinite' }} />
      </div>
    )
  }

  // ── ERROR ────────────────────────────────────────────────────────────────────
  if (error) {
    return (
      <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '24px' }}>
        <div style={{ background: '#fff5f5', border: '0.5px solid #ffcccc', borderRadius: '10px', padding: '40px', textAlign: 'center' }}>
          <div style={{ fontFamily: 'Space Grotesk, sans-serif', fontSize: '15px', color: '#cc3333', marginBottom: '20px' }}>
            Error al cargar métricas: {error}
          </div>
          <button
            onClick={() => window.location.reload()}
            style={{ background: '#3D3A8C', color: '#fff', border: 'none', borderRadius: '8px', padding: '10px 24px', fontFamily: 'Space Grotesk, sans-serif', fontWeight: 600, fontSize: '14px', cursor: 'pointer' }}
          >
            Reintentar
          </button>
        </div>
      </div>
    )
  }

  // ── NO DATA ──────────────────────────────────────────────────────────────────
  if (!hasData) {
    return (
      <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '24px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ background: '#fff', border: '0.5px solid #e0e0e0', borderRadius: '10px', padding: '60px 40px', textAlign: 'center', maxWidth: '400px' }}>
          <ScissorsIcon />
          <div style={{ fontFamily: 'Space Grotesk, sans-serif', fontSize: '15px', color: '#aaa', marginTop: '20px', lineHeight: 1.6 }}>
            Registrá tu primer servicio para ver las métricas aparecer aquí
          </div>
        </div>
      </div>
    )
  }

  // ── BAR CHART ────────────────────────────────────────────────────────────────
  const maxServicios = Math.max(...metrics!.servicios_por_dia.map(d => d.servicios), 1)

  // ── MAIN DASHBOARD ───────────────────────────────────────────────────────────
  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '24px' }}>

      {/* Header */}
      <div style={{ marginBottom: '32px' }}>
        <h1 style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: '28px', color: '#1a1a2e', marginBottom: '4px' }}>
          Métricas
        </h1>
        <p style={{ color: '#aaa', fontSize: '13px' }}>
          Análisis y reportes de desempeño
        </p>
      </div>

      {/* SECCIÓN 1 — HERO KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, 1fr)', gap: '16px', marginBottom: '16px' }}>
        <div style={{ background: '#fff', border: '0.5px solid #e0e0e0', borderLeft: '3px solid #3D3A8C', borderRadius: '10px', padding: '22px 24px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          <div style={{ fontSize: '11px', color: '#aaa', letterSpacing: '1.5px', textTransform: 'uppercase', marginBottom: '6px' }}>FACTURACIÓN TOTAL</div>
          <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: isMobile ? '22px' : '26px', color: '#1a1a2e', lineHeight: 1 }}>
            {formatCurrency(metrics!.historico.total_facturado)}
          </div>
          <div style={{ fontSize: '11px', color: '#ccc', marginTop: '4px' }}>desde el primer servicio</div>
        </div>

        <div style={{ background: '#fff', border: '0.5px solid #e0e0e0', borderLeft: '3px solid #3D3A8C', borderRadius: '10px', padding: '22px 24px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          <div style={{ fontSize: '11px', color: '#aaa', letterSpacing: '1.5px', textTransform: 'uppercase', marginBottom: '6px' }}>TU GANANCIA</div>
          <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: isMobile ? '22px' : '26px', color: '#FF8C42', lineHeight: 1 }}>
            {formatCurrency(metrics!.historico.total_owner)}
          </div>
          <div style={{ fontSize: '11px', color: '#ccc', marginTop: '4px' }}>tu parte acumulada</div>
        </div>

        <div style={{ background: '#fff', border: '0.5px solid #e0e0e0', borderLeft: '3px solid #3D3A8C', borderRadius: '10px', padding: '22px 24px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          <div style={{ fontSize: '11px', color: '#aaa', letterSpacing: '1.5px', textTransform: 'uppercase', marginBottom: '6px' }}>SERVICIOS TOTALES</div>
          <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: isMobile ? '22px' : '26px', color: '#1a1a2e', lineHeight: 1 }}>
            {formatNumber(metrics!.historico.total_servicios)}
          </div>
          <div style={{ fontSize: '11px', color: '#ccc', marginTop: '4px' }}>registrados en la plataforma</div>
        </div>
      </div>

      {/* SECCIÓN 2 — COMPARACIÓN SEMANAL */}
      <div style={{ background: '#fff', border: '0.5px solid #e0e0e0', borderRadius: '10px', padding: '20px', marginBottom: '16px' }}>
        <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', justifyContent: 'space-between', alignItems: isMobile ? 'flex-start' : 'center', gap: '12px', marginBottom: '20px' }}>
          <div>
            <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: '16px', color: '#1a1a2e', marginBottom: '2px' }}>Esta semana</div>
            <div style={{ fontSize: '12px', color: '#aaa' }}>{getCurrentWeekRange()}</div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            {weekVariation.servicios !== 0 && (
              <span style={{ background: weekVariation.servicios > 0 ? '#eafaf1' : '#fdf0ef', color: weekVariation.servicios > 0 ? '#2ecc71' : '#e74c3c', fontSize: '11px', padding: '3px 8px', borderRadius: '20px', fontWeight: 600 }}>
                {weekVariation.servicios > 0 ? '↑' : '↓'} {Math.abs(weekVariation.servicios).toFixed(1)}% servicios
              </span>
            )}
            {weekVariation.facturado !== 0 && (
              <span style={{ background: weekVariation.facturado > 0 ? '#eafaf1' : '#fdf0ef', color: weekVariation.facturado > 0 ? '#2ecc71' : '#e74c3c', fontSize: '11px', padding: '3px 8px', borderRadius: '20px', fontWeight: 600 }}>
                {weekVariation.facturado > 0 ? '↑' : '↓'} {Math.abs(weekVariation.facturado).toFixed(1)}% facturación
              </span>
            )}
            {weekVariation.servicios === 0 && weekVariation.facturado === 0 && (
              <span style={{ fontSize: '12px', color: '#aaa' }}>—</span>
            )}
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '24px' }}>
          <div>
            <div style={{ fontSize: '12px', color: '#aaa', marginBottom: '6px' }}>Esta semana</div>
            <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: '22px', color: '#1a1a2e', marginBottom: '2px' }}>
              {formatNumber(metrics!.semana_actual.servicios)} servicios
            </div>
            <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 600, fontSize: '18px', color: '#FF8C42' }}>
              {formatCurrency(metrics!.semana_actual.facturado)}
            </div>
          </div>
          <div>
            <div style={{ fontSize: '12px', color: '#aaa', marginBottom: '6px' }}>Semana anterior</div>
            <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: '22px', color: '#ccc', marginBottom: '2px' }}>
              {formatNumber(metrics!.semana_anterior.servicios)} servicios
            </div>
            <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 600, fontSize: '18px', color: '#ddd' }}>
              {formatCurrency(metrics!.semana_anterior.facturado)}
            </div>
          </div>
        </div>
      </div>

      {/* SECCIÓN 2.5 — BAR CHART */}
      <div style={{ background: '#fff', border: '0.5px solid #e0e0e0', borderRadius: '10px', padding: '20px', marginBottom: '16px' }}>
        <div style={{ fontSize: '11px', color: '#aaa', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '16px' }}>
          Servicios esta semana
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '6px', alignItems: 'end', height: '120px' }}>
          {metrics!.servicios_por_dia.map((d, i) => {
            const isMax = d.servicios === maxServicios && d.servicios > 0
            const barHeightPct = d.servicios === 0 ? 3 : Math.max(10, Math.round((d.servicios / maxServicios) * 90))
            return (
              <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end', height: '100%' }}>
                {d.servicios > 0 && (
                  <span style={{ fontSize: '10px', color: '#1a1a2e', fontWeight: 600, marginBottom: '3px' }}>{d.servicios}</span>
                )}
                <div style={{
                  width: '100%',
                  height: `${barHeightPct}%`,
                  background: d.servicios === 0 ? '#f0f0f0' : isMax ? '#FF8C42' : '#3D3A8C',
                  borderRadius: '4px 4px 0 0',
                }} />
              </div>
            )
          })}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '6px', marginTop: '6px' }}>
          {metrics!.servicios_por_dia.map((d, i) => (
            <div key={i} style={{ textAlign: 'center', fontSize: '10px', color: '#aaa' }}>{d.dia}</div>
          ))}
        </div>
      </div>

      {/* SECCIÓN 3 — INSIGHTS */}
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
        <div style={{ background: '#fff', border: '0.5px solid #e0e0e0', borderRadius: '10px', padding: '20px', display: 'flex', flexDirection: 'column' }}>
          <div style={{ width: '36px', height: '36px', borderRadius: '8px', background: '#eeedf8', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '12px' }}>
            <CalendarIcon />
          </div>
          <div style={{ fontSize: '10px', color: '#aaa', letterSpacing: '1px', textTransform: 'uppercase', marginBottom: '6px' }}>DÍA MÁS ACTIVO</div>
          <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: '20px', color: '#1a1a2e', marginBottom: '4px' }}>
            {metrics!.dia_mas_cortes ? formatDate(metrics!.dia_mas_cortes.fecha).split(',')[0] : '—'}
          </div>
          <div style={{ fontSize: '11px', color: '#aaa' }}>
            {metrics!.dia_mas_cortes ? `${metrics!.dia_mas_cortes.fecha.split('-')[2]} de ${formatMonth(metrics!.dia_mas_cortes.fecha.split('-')[0] + '-' + metrics!.dia_mas_cortes.fecha.split('-')[1])} · ${metrics!.dia_mas_cortes.total} cortes` : '—'}
          </div>
        </div>

        <div style={{ background: '#fff', border: '0.5px solid #e0e0e0', borderRadius: '10px', padding: '20px', display: 'flex', flexDirection: 'column' }}>
          <div style={{ width: '36px', height: '36px', borderRadius: '8px', background: '#eeedf8', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '12px' }}>
            <ClockIcon />
          </div>
          <div style={{ fontSize: '10px', color: '#aaa', letterSpacing: '1px', textTransform: 'uppercase', marginBottom: '6px' }}>HORA PICO</div>
          <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: '20px', color: '#1a1a2e', marginBottom: '4px' }}>
            {metrics!.hora_pico ? `${formatHour(metrics!.hora_pico.hora)} hs` : '—'}
          </div>
          <div style={{ fontSize: '11px', color: '#aaa' }}>mayor concentración de servicios</div>
        </div>

        <div style={{ background: '#fff', border: '0.5px solid #e0e0e0', borderRadius: '10px', padding: '20px', display: 'flex', flexDirection: 'column' }}>
          <div style={{ marginBottom: '12px' }}>
            {metrics!.barbero_estrella ? (
              <UserCircleIcon initial={metrics!.barbero_estrella.nombre.charAt(0)} />
            ) : (
              <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: '#f0f0f0' }} />
            )}
          </div>
          <div style={{ fontSize: '10px', color: '#aaa', letterSpacing: '1px', textTransform: 'uppercase', marginBottom: '6px' }}>BARBERO ESTRELLA</div>
          <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: '20px', color: '#1a1a2e', marginBottom: '4px' }}>
            {metrics!.barbero_estrella ? metrics!.barbero_estrella.nombre : '—'}
          </div>
          <div style={{ fontSize: '11px', color: '#aaa' }}>
            {metrics!.barbero_estrella ? `${metrics!.barbero_estrella.servicios} servicios · ${formatCurrency(metrics!.barbero_estrella.generado)} generados` : '—'}
          </div>
        </div>

        <div style={{ background: '#fff', border: '0.5px solid #e0e0e0', borderRadius: '10px', padding: '20px', display: 'flex', flexDirection: 'column' }}>
          <div style={{ width: '36px', height: '36px', borderRadius: '8px', background: '#eeedf8', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '12px' }}>
            <ScissorsIcon />
          </div>
          <div style={{ fontSize: '10px', color: '#aaa', letterSpacing: '1px', textTransform: 'uppercase', marginBottom: '6px' }}>SERVICIO TOP</div>
          <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: '20px', color: '#1a1a2e', marginBottom: '4px' }}>
            {metrics!.servicio_popular ? metrics!.servicio_popular.nombre : '—'}
          </div>
          <div style={{ fontSize: '11px', color: '#aaa' }}>
            {metrics!.servicio_popular ? `${metrics!.servicio_popular.total} veces solicitado` : '—'}
          </div>
        </div>
      </div>

      {/* SECCIÓN 4 — TICKET PROMEDIO */}
      <div style={{ background: '#3D3A8C', borderRadius: '10px', padding: '20px 24px', marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.5)', letterSpacing: '1.5px', textTransform: 'uppercase', marginBottom: '6px' }}>
            TICKET PROMEDIO
          </div>
          <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.5)' }}>
            valor promedio por servicio registrado
          </div>
        </div>
        <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 800, fontSize: isMobile ? '24px' : '28px', color: '#FF8C42' }}>
          {metrics!.ticket_promedio ? formatCurrency(metrics!.ticket_promedio) : '—'}
        </div>
      </div>

      {/* SECCIÓN 5 — MEJOR MES */}
      {metrics!.mes_top && (
        <div style={{ background: '#fff', border: '0.5px solid #e0e0e0', borderRadius: '10px', padding: '20px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: '11px', color: '#aaa', letterSpacing: '1.5px', textTransform: 'uppercase', marginBottom: '6px' }}>MEJOR MES</div>
            <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: '18px', color: '#1a1a2e' }}>
              {formatMonth(metrics!.mes_top.mes)}
            </div>
          </div>
          <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: '28px', color: '#FF8C42' }}>
            {formatCurrency(metrics!.mes_top.total)}
          </div>
        </div>
      )}
    </div>
  )
}
