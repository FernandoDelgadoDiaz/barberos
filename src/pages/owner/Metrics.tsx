import { useEffect, useState } from 'react'
import { useTenantStore } from '../../stores/tenantStore'

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
}

interface MetricCard {
  label: string
  icon: string
  value: string
  subvalue?: string
}

function formatDate(fecha: string): string {
  const date = new Date(fecha)
  const options: Intl.DateTimeFormatOptions = { weekday: 'long', day: 'numeric', month: 'long' }
  return date.toLocaleDateString('es-ES', options)
}

function formatHour(hora: number): string {
  const start = hora.toString().padStart(2, '0') + ':00'
  const end = (hora === 23 ? 0 : hora + 1).toString().padStart(2, '0') + ':00'
  return `${start} - ${end} hs`
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

function renderIcon(icon: string) {
  const size = 20
  const stroke = '#C8A97E'
  switch (icon) {
    case 'calendar':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth="2">
          <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
          <line x1="16" y1="2" x2="16" y2="6" />
          <line x1="8" y1="2" x2="8" y2="6" />
          <line x1="3" y1="10" x2="21" y2="10" />
        </svg>
      )
    case 'clock':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth="2">
          <circle cx="12" cy="12" r="10" />
          <polyline points="12 6 12 12 16 14" />
        </svg>
      )
    case 'chart':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth="2">
          <line x1="18" y1="20" x2="18" y2="10" />
          <line x1="12" y1="20" x2="12" y2="4" />
          <line x1="6" y1="20" x2="6" y2="14" />
        </svg>
      )
    case 'crown':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth="2">
          <path d="M12 8l3 5 5-2-2 8H6L4 11l5 2 3-5z" />
        </svg>
      )
    case 'scissors':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth="2">
          <circle cx="6" cy="6" r="3" />
          <circle cx="6" cy="18" r="3" />
          <line x1="20" y1="4" x2="8.12" y2="15.88" />
          <line x1="14.47" y1="14.48" x2="20" y2="20" />
          <line x1="8.12" y1="8.12" x2="12" y2="12" />
        </svg>
      )
    case 'dollar':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth="2">
          <line x1="12" y1="1" x2="12" y2="23" />
          <path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6" />
        </svg>
      )
    default:
      return null
  }
}

export function Metrics() {
  const { tenant } = useTenantStore()
  const [metrics, setMetrics] = useState<MetricsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

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

    fetchMetrics()
  }, [tenant?.id])

  const buildMetricCards = (): MetricCard[] => {
    if (!metrics) return []

    const cards: MetricCard[] = []

    // Día con más cortes
    cards.push({
      label: 'Día con más cortes',
      icon: 'calendar',
      value: metrics.dia_mas_cortes
        ? formatDate(metrics.dia_mas_cortes.fecha)
        : '--',
      subvalue: metrics.dia_mas_cortes
        ? `${metrics.dia_mas_cortes.total} cortes`
        : undefined
    })

    // Hora pico
    cards.push({
      label: 'Hora pico',
      icon: 'clock',
      value: metrics.hora_pico
        ? formatHour(metrics.hora_pico.hora)
        : '--',
      subvalue: metrics.hora_pico
        ? `${metrics.hora_pico.total} cortes`
        : undefined
    })

    // Mes top
    cards.push({
      label: 'Mes top',
      icon: 'chart',
      value: metrics.mes_top
        ? formatMonth(metrics.mes_top.mes)
        : '--',
      subvalue: metrics.mes_top
        ? formatCurrency(metrics.mes_top.total)
        : undefined
    })

    // Barbero estrella
    cards.push({
      label: 'Barbero estrella',
      icon: 'crown',
      value: metrics.barbero_estrella
        ? metrics.barbero_estrella.nombre
        : '--',
      subvalue: metrics.barbero_estrella
        ? `${metrics.barbero_estrella.servicios} servicios`
        : undefined
    })

    // Servicio más popular
    cards.push({
      label: 'Servicio más popular',
      icon: 'scissors',
      value: metrics.servicio_popular
        ? metrics.servicio_popular.nombre
        : '--',
      subvalue: metrics.servicio_popular
        ? `${metrics.servicio_popular.total} veces`
        : undefined
    })

    // Ticket promedio
    cards.push({
      label: 'Ticket promedio',
      icon: 'dollar',
      value: metrics.ticket_promedio
        ? formatCurrency(metrics.ticket_promedio)
        : '--',
      subvalue: undefined
    })

    return cards
  }

  const calculateWeekVariation = () => {
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

  const metricCards = buildMetricCards()
  const weekVariation = calculateWeekVariation()
  const hasData = metrics && (metrics.historico.total_servicios > 0 || metrics.dia_mas_cortes !== null)

  return (
    <div style={{ maxWidth: '1000px', margin: '0 auto', background: '#1a1a1a', color: '#fff', padding: '24px', borderRadius: '12px' }}>
      <h1 style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: '26px', color: '#fff', marginBottom: '8px' }}>Métricas</h1>
      <p style={{ color: '#888', fontSize: '14px', marginBottom: '32px' }}>Análisis y reportes de desempeño</p>

      {loading && (
        <div style={{ textAlign: 'center', padding: '40px' }}>
          <div style={{ fontFamily: 'Space Grotesk, sans-serif', fontWeight: 400, fontSize: '16px', color: '#888' }}>
            Cargando métricas...
          </div>
        </div>
      )}

      {error && (
        <div style={{ background: '#2a2a2a', border: '1px solid #383838', borderRadius: '12px', padding: '40px', textAlign: 'center', marginBottom: '32px' }}>
          <div style={{ fontFamily: 'Space Grotesk, sans-serif', fontWeight: 400, fontSize: '16px', color: '#ff6b6b' }}>
            Error al cargar métricas: {error}
          </div>
        </div>
      )}

      {!loading && !error && (
        <>
          {/* Main metrics grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '12px', marginBottom: '32px' }}>
            {metricCards.map((card, index) => (
              <div
                key={index}
                style={{
                  background: '#2a2a2a',
                  border: '1px solid #383838',
                  borderRadius: '12px',
                  padding: '20px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '16px',
                }}
              >
                <div style={{ width: '48px', height: '48px', borderRadius: '10px', background: '#2a2a2a', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {renderIcon(card.icon)}
                </div>
                <div>
                  <div style={{ fontFamily: 'Space Grotesk, sans-serif', fontWeight: 400, fontSize: '13px', color: '#888', marginBottom: '4px' }}>
                    {card.label}
                  </div>
                  <div style={{ fontFamily: 'Space Grotesk, sans-serif', fontWeight: 700, fontSize: '24px', color: '#fff', marginBottom: card.subvalue ? '2px' : 0 }}>
                    {card.value}
                  </div>
                  {card.subvalue && (
                    <div style={{ fontFamily: 'Space Grotesk, sans-serif', fontWeight: 400, fontSize: '12px', color: '#C8A97E' }}>
                      {card.subvalue}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Historical summary */}
          {hasData && (
            <div style={{ background: '#2a2a2a', border: '1px solid #383838', borderRadius: '12px', padding: '24px', marginBottom: '32px' }}>
              <h2 style={{ fontFamily: 'Space Grotesk, sans-serif', fontWeight: 600, fontSize: '18px', color: '#fff', marginBottom: '20px' }}>
                Resumen histórico
              </h2>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
                <div>
                  <div style={{ fontFamily: 'Space Grotesk, sans-serif', fontWeight: 400, fontSize: '13px', color: '#888', marginBottom: '4px' }}>
                    Total servicios registrados
                  </div>
                  <div style={{ fontFamily: 'Space Grotesk, sans-serif', fontWeight: 700, fontSize: '24px', color: '#fff' }}>
                    {formatNumber(metrics!.historico.total_servicios)}
                  </div>
                </div>
                <div>
                  <div style={{ fontFamily: 'Space Grotesk, sans-serif', fontWeight: 400, fontSize: '13px', color: '#888', marginBottom: '4px' }}>
                    Total facturado histórico
                  </div>
                  <div style={{ fontFamily: 'Space Grotesk, sans-serif', fontWeight: 700, fontSize: '24px', color: '#fff' }}>
                    {formatCurrency(metrics!.historico.total_facturado)}
                  </div>
                </div>
                <div>
                  <div style={{ fontFamily: 'Space Grotesk, sans-serif', fontWeight: 400, fontSize: '13px', color: '#888', marginBottom: '4px' }}>
                    Total ganancia del owner
                  </div>
                  <div style={{ fontFamily: 'Space Grotesk, sans-serif', fontWeight: 700, fontSize: '24px', color: '#fff' }}>
                    {formatCurrency(metrics!.historico.total_owner)}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Weekly comparison */}
          {hasData && (
            <div style={{ background: '#2a2a2a', border: '1px solid #383838', borderRadius: '12px', padding: '24px', marginBottom: '32px' }}>
              <h2 style={{ fontFamily: 'Space Grotesk, sans-serif', fontWeight: 600, fontSize: '18px', color: '#fff', marginBottom: '20px' }}>
                Comparación semanal
              </h2>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '24px' }}>
                <div>
                  <div style={{ fontFamily: 'Space Grotesk, sans-serif', fontWeight: 400, fontSize: '13px', color: '#888', marginBottom: '4px' }}>
                    Esta semana
                  </div>
                  <div style={{ fontFamily: 'Space Grotesk, sans-serif', fontWeight: 700, fontSize: '20px', color: '#fff', marginBottom: '4px' }}>
                    {formatNumber(metrics!.semana_actual.servicios)} servicios
                  </div>
                  <div style={{ fontFamily: 'Space Grotesk, sans-serif', fontWeight: 600, fontSize: '18px', color: '#C8A97E' }}>
                    {formatCurrency(metrics!.semana_actual.facturado)}
                  </div>
                </div>
                <div>
                  <div style={{ fontFamily: 'Space Grotesk, sans-serif', fontWeight: 400, fontSize: '13px', color: '#888', marginBottom: '4px' }}>
                    Semana pasada
                  </div>
                  <div style={{ fontFamily: 'Space Grotesk, sans-serif', fontWeight: 700, fontSize: '20px', color: '#fff', marginBottom: '4px' }}>
                    {formatNumber(metrics!.semana_anterior.servicios)} servicios
                  </div>
                  <div style={{ fontFamily: 'Space Grotesk, sans-serif', fontWeight: 600, fontSize: '18px', color: '#C8A97E' }}>
                    {formatCurrency(metrics!.semana_anterior.facturado)}
                  </div>
                </div>
                <div>
                  <div style={{ fontFamily: 'Space Grotesk, sans-serif', fontWeight: 400, fontSize: '13px', color: '#888', marginBottom: '4px' }}>
                    Variación
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{ fontFamily: 'Space Grotesk, sans-serif', fontWeight: 700, fontSize: '20px', color: weekVariation.servicios >= 0 ? '#4CAF50' : '#ff6b6b' }}>
                      {weekVariation.servicios >= 0 ? '+' : ''}{weekVariation.servicios.toFixed(1)}%
                    </div>
                    <div style={{ fontFamily: 'Space Grotesk, sans-serif', fontWeight: 400, fontSize: '14px', color: '#888' }}>
                      servicios
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
                    <div style={{ fontFamily: 'Space Grotesk, sans-serif', fontWeight: 700, fontSize: '20px', color: weekVariation.facturado >= 0 ? '#4CAF50' : '#ff6b6b' }}>
                      {weekVariation.facturado >= 0 ? '+' : ''}{weekVariation.facturado.toFixed(1)}%
                    </div>
                    <div style={{ fontFamily: 'Space Grotesk, sans-serif', fontWeight: 400, fontSize: '14px', color: '#888' }}>
                      facturación
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Empty state */}
          {!hasData && !loading && !error && (
            <div style={{ background: '#2a2a2a', border: '1px solid #383838', borderRadius: '12px', padding: '40px', textAlign: 'center' }}>
              <div style={{ fontFamily: 'Space Grotesk, sans-serif', fontWeight: 400, fontSize: '16px', color: '#555', lineHeight: 1.5 }}>
                Registrá servicios para ver métricas
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}