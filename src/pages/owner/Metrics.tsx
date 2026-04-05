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

function getCurrentWeekRange(): string {
  const now = new Date()
  const currentDay = now.getDay()
  const diffToMonday = currentDay === 0 ? -6 : 1 - currentDay // Domingo = 0, Lunes = 1
  const monday = new Date(now)
  monday.setDate(now.getDate() + diffToMonday)
  const sunday = new Date(monday)
  sunday.setDate(monday.getDate() + 6)
  const format = (d: Date) => d.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })
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

// Íconos SVG inline
const CalendarIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#C8A97E" strokeWidth="2">
    <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
    <line x1="16" y1="2" x2="16" y2="6" />
    <line x1="8" y1="2" x2="8" y2="6" />
    <line x1="3" y1="10" x2="21" y2="10" />
  </svg>
)

const ClockIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#C8A97E" strokeWidth="2">
    <circle cx="12" cy="12" r="10" />
    <polyline points="12 6 12 12 16 14" />
  </svg>
)

const ScissorsIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#C8A97E" strokeWidth="2">
    <circle cx="6" cy="6" r="3" />
    <circle cx="6" cy="18" r="3" />
    <line x1="20" y1="4" x2="8.12" y2="15.88" />
    <line x1="14.47" y1="14.48" x2="20" y2="20" />
    <line x1="8.12" y1="8.12" x2="12" y2="12" />
  </svg>
)

const UserCircleIcon = ({ initial }: { initial: string }) => (
  <div style={{
    width: '40px',
    height: '40px',
    borderRadius: '50%',
    background: '#C8A97E',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#1a1a1a',
    fontFamily: 'Syne, sans-serif',
    fontWeight: 700,
    fontSize: '16px'
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

    fetchMetrics()
  }, [tenant?.id])

  const weekVariation = calculateWeekVariation(metrics)
  const hasData = metrics && (metrics.historico.total_servicios > 0 || metrics.dia_mas_cortes !== null)

  // ───────────────────────────────────────────────────────────────────────────────
  // LOADING STATE
  // ───────────────────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div style={{
        maxWidth: '1200px',
        margin: '0 auto',
        padding: '24px',
        background: '#1a1a1a',
        color: '#fff',
        minHeight: '100vh'
      }}>
        <div style={{ marginBottom: '32px' }}>
          <div style={{
            width: '200px',
            height: '32px',
            background: '#2a2a2a',
            borderRadius: '8px',
            marginBottom: '8px',
            animation: 'pulse 1.5s infinite'
          }} />
          <div style={{
            width: '300px',
            height: '16px',
            background: '#2a2a2a',
            borderRadius: '8px',
            animation: 'pulse 1.5s infinite'
          }} />
        </div>

        {/* Sección 1 — Hero KPIs skeleton */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
          gap: '20px',
          marginBottom: '40px'
        }}>
          {[1, 2, 3].map(i => (
            <div key={i} style={{
              height: '100px',
              background: '#2a2a2a',
              borderRadius: '12px',
              animation: 'pulse 1.5s infinite'
            }} />
          ))}
        </div>

        {/* Sección 2 — Comparación semanal skeleton */}
        <div style={{
          background: '#2a2a2a',
          borderRadius: '12px',
          height: '180px',
          marginBottom: '40px',
          animation: 'pulse 1.5s infinite'
        }} />

        {/* Sección 3 — Insights skeleton */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
          gap: '20px',
          marginBottom: '40px'
        }}>
          {[1, 2, 3, 4].map(i => (
            <div key={i} style={{
              height: '180px',
              background: '#222',
              borderRadius: '12px',
              animation: 'pulse 1.5s infinite'
            }} />
          ))}
        </div>

        {/* Sección 4 — Ticket promedio skeleton */}
        <div style={{
          background: '#2a2a2a',
          borderRadius: '12px',
          height: '120px',
          marginBottom: '40px',
          animation: 'pulse 1.5s infinite'
        }} />

        {/* Sección 5 — Mes top skeleton */}
        <div style={{
          background: '#2a2a2a',
          borderRadius: '12px',
          height: '100px',
          animation: 'pulse 1.5s infinite'
        }} />
      </div>
    )
  }

  // ───────────────────────────────────────────────────────────────────────────────
  // ERROR STATE
  // ───────────────────────────────────────────────────────────────────────────────
  if (error) {
    return (
      <div style={{
        maxWidth: '1200px',
        margin: '0 auto',
        padding: '24px',
        background: '#1a1a1a',
        color: '#fff',
        minHeight: '100vh'
      }}>
        <div style={{
          background: '#2a2a2a',
          border: '1px solid #383838',
          borderRadius: '12px',
          padding: '40px',
          textAlign: 'center'
        }}>
          <div style={{
            fontFamily: 'Space Grotesk, sans-serif',
            fontWeight: 400,
            fontSize: '16px',
            color: '#f87171',
            marginBottom: '20px'
          }}>
            Error al cargar métricas: {error}
          </div>
          <button
            onClick={() => window.location.reload()}
            style={{
              background: '#C8A97E',
              color: '#1a1a1a',
              border: 'none',
              borderRadius: '8px',
              padding: '12px 24px',
              fontFamily: 'Space Grotesk, sans-serif',
              fontWeight: 600,
              fontSize: '14px',
              cursor: 'pointer'
            }}
          >
            Reintentar
          </button>
        </div>
      </div>
    )
  }

  // ───────────────────────────────────────────────────────────────────────────────
  // NO DATA STATE
  // ───────────────────────────────────────────────────────────────────────────────
  if (!hasData) {
    return (
      <div style={{
        maxWidth: '1200px',
        margin: '0 auto',
        padding: '24px',
        background: '#1a1a1a',
        color: '#fff',
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center'
      }}>
        <div style={{
          background: '#2a2a2a',
          border: '1px solid #383838',
          borderRadius: '12px',
          padding: '60px 40px',
          textAlign: 'center',
          maxWidth: '400px'
        }}>
          <ScissorsIcon />
          <div style={{
            fontFamily: 'Space Grotesk, sans-serif',
            fontWeight: 400,
            fontSize: '16px',
            color: '#888',
            marginTop: '20px',
            lineHeight: 1.5
          }}>
            Registrá tu primer servicio para ver las métricas aparecer aquí
          </div>
        </div>
      </div>
    )
  }

  // ───────────────────────────────────────────────────────────────────────────────
  // MAIN DASHBOARD
  // ───────────────────────────────────────────────────────────────────────────────
  return (
    <div style={{
      maxWidth: '1200px',
      margin: '0 auto',
      padding: '24px',
      background: '#1a1a1a',
      color: '#fff',
      minHeight: '100vh'
    }}>
      {/* Header */}
      <div style={{ marginBottom: '40px' }}>
        <h1 style={{
          fontFamily: 'Syne, sans-serif',
          fontWeight: 700,
          fontSize: '32px',
          color: '#fff',
          marginBottom: '4px'
        }}>
          Métricas
        </h1>
        <p style={{
          color: '#888',
          fontSize: '14px'
        }}>
          Análisis y reportes de desempeño
        </p>
      </div>

      {/* SECCIÓN 1 — HERO KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-10">
        {/* Card 1 — Total facturado histórico */}
        <div style={{
          height: '100px',
          background: '#2a2a2a',
          borderLeft: '3px solid #C8A97E',
          borderRadius: '12px',
          padding: '20px 24px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center'
        }}>
          <div style={{
            fontSize: '10px',
            color: '#888',
            letterSpacing: '2px',
            textTransform: 'uppercase',
            marginBottom: '8px'
          }}>
            FACTURACIÓN TOTAL
          </div>
          <div style={{
            fontFamily: 'Syne, sans-serif',
            fontWeight: 700,
            fontSize: isMobile ? '24px' : '32px',
            color: '#C8A97E',
            lineHeight: 1
          }}>
            {formatCurrency(metrics!.historico.total_facturado)}
          </div>
          <div style={{
            fontSize: '11px',
            color: '#555',
            marginTop: '4px'
          }}>
            desde el primer servicio
          </div>
        </div>

        {/* Card 2 — Ganancia del owner */}
        <div style={{
          height: '100px',
          background: '#2a2a2a',
          borderLeft: '3px solid #C8A97E',
          borderRadius: '12px',
          padding: '20px 24px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center'
        }}>
          <div style={{
            fontSize: '10px',
            color: '#888',
            letterSpacing: '2px',
            textTransform: 'uppercase',
            marginBottom: '8px'
          }}>
            TU GANANCIA
          </div>
          <div style={{
            fontFamily: 'Syne, sans-serif',
            fontWeight: 700,
            fontSize: isMobile ? '24px' : '32px',
            color: '#fff',
            lineHeight: 1
          }}>
            {formatCurrency(metrics!.historico.total_owner)}
          </div>
          <div style={{
            fontSize: '11px',
            color: '#555',
            marginTop: '4px'
          }}>
            tu parte acumulada
          </div>
        </div>

        {/* Card 3 — Servicios totales */}
        <div style={{
          height: '100px',
          background: '#2a2a2a',
          borderLeft: '3px solid #C8A97E',
          borderRadius: '12px',
          padding: '20px 24px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center'
        }}>
          <div style={{
            fontSize: '10px',
            color: '#888',
            letterSpacing: '2px',
            textTransform: 'uppercase',
            marginBottom: '8px'
          }}>
            SERVICIOS TOTALES
          </div>
          <div style={{
            fontFamily: 'Syne, sans-serif',
            fontWeight: 700,
            fontSize: isMobile ? '24px' : '32px',
            color: '#fff',
            lineHeight: 1
          }}>
            {formatNumber(metrics!.historico.total_servicios)}
          </div>
          <div style={{
            fontSize: '11px',
            color: '#555',
            marginTop: '4px'
          }}>
            registrados en la plataforma
          </div>
        </div>
      </div>

      {/* SECCIÓN 2 — COMPARACIÓN SEMANAL */}
      <div style={{
        background: '#2a2a2a',
        borderRadius: '12px',
        padding: '20px 24px',
        marginBottom: '40px'
      }}>
        <div className="flex flex-col md:flex-row md:justify-between md:items-center mb-6">
          <div>
            <div style={{
              fontFamily: 'Syne, sans-serif',
              fontWeight: 700,
              fontSize: '18px',
              color: '#fff',
              marginBottom: '4px'
            }}>
              Esta semana
            </div>
            <div style={{
              fontSize: '13px',
              color: '#888'
            }}>
              {getCurrentWeekRange()}
            </div>
          </div>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px'
          }}>
            {/* Variación servicios */}
            {weekVariation.servicios !== 0 && (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '4px'
              }}>
                <div style={{
                  color: weekVariation.servicios > 0 ? '#4ade80' : '#f87171',
                  fontSize: '14px'
                }}>
                  {weekVariation.servicios > 0 ? '↑' : '↓'}
                </div>
                <div style={{
                  fontFamily: 'Space Grotesk, sans-serif',
                  fontWeight: 600,
                  fontSize: '14px',
                  color: weekVariation.servicios > 0 ? '#4ade80' : '#f87171'
                }}>
                  {Math.abs(weekVariation.servicios).toFixed(1)}%
                </div>
                <div style={{ fontSize: '12px', color: '#888' }}>servicios</div>
              </div>
            )}
            {/* Variación facturación */}
            {weekVariation.facturado !== 0 && (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '4px'
              }}>
                <div style={{
                  color: weekVariation.facturado > 0 ? '#4ade80' : '#f87171',
                  fontSize: '14px'
                }}>
                  {weekVariation.facturado > 0 ? '↑' : '↓'}
                </div>
                <div style={{
                  fontFamily: 'Space Grotesk, sans-serif',
                  fontWeight: 600,
                  fontSize: '14px',
                  color: weekVariation.facturado > 0 ? '#4ade80' : '#f87171'
                }}>
                  {Math.abs(weekVariation.facturado).toFixed(1)}%
                </div>
                <div style={{ fontSize: '12px', color: '#888' }}>facturación</div>
              </div>
            )}
            {(weekVariation.servicios === 0 && weekVariation.facturado === 0) && (
              <div style={{ fontSize: '13px', color: '#888' }}>—</div>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Esta semana */}
          <div>
            <div style={{
              fontSize: '13px',
              color: '#888',
              marginBottom: '8px'
            }}>
              Esta semana
            </div>
            <div style={{
              fontFamily: 'Syne, sans-serif',
              fontWeight: 700,
              fontSize: '24px',
              color: '#fff',
              marginBottom: '4px'
            }}>
              {formatNumber(metrics!.semana_actual.servicios)} servicios
            </div>
            <div style={{
              fontFamily: 'Syne, sans-serif',
              fontWeight: 600,
              fontSize: '20px',
              color: '#C8A97E'
            }}>
              {formatCurrency(metrics!.semana_actual.facturado)}
            </div>
          </div>

          {/* Semana anterior */}
          <div>
            <div style={{
              fontSize: '13px',
              color: '#888',
              marginBottom: '8px'
            }}>
              Semana anterior
            </div>
            <div style={{
              fontFamily: 'Syne, sans-serif',
              fontWeight: 700,
              fontSize: '24px',
              color: '#555',
              marginBottom: '4px'
            }}>
              {formatNumber(metrics!.semana_anterior.servicios)} servicios
            </div>
            <div style={{
              fontFamily: 'Syne, sans-serif',
              fontWeight: 600,
              fontSize: '20px',
              color: '#555'
            }}>
              {formatCurrency(metrics!.semana_anterior.facturado)}
            </div>
          </div>
        </div>
      </div>

      {/* SECCIÓN 3 — INSIGHTS (grid 2x2 en desktop, 1 columna en mobile) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-10">
        {/* Card — Día con más cortes */}
        <div style={{
          background: '#222',
          border: '1px solid #383838',
          borderRadius: '12px',
          padding: '20px',
          display: 'flex',
          flexDirection: 'column'
        }}>
          <div style={{ marginBottom: '12px' }}>
            <CalendarIcon />
          </div>
          <div style={{
            fontSize: '10px',
            color: '#888',
            letterSpacing: '1px',
            textTransform: 'uppercase',
            marginBottom: '8px'
          }}>
            DÍA MÁS ACTIVO
          </div>
          <div style={{
            fontFamily: 'Syne, sans-serif',
            fontWeight: 700,
            fontSize: '22px',
            color: '#fff',
            marginBottom: '4px'
          }}>
            {metrics!.dia_mas_cortes ? formatDate(metrics!.dia_mas_cortes.fecha).split(',')[0] : '—'}
          </div>
          <div style={{
            fontSize: '12px',
            color: '#888'
          }}>
            {metrics!.dia_mas_cortes ? `${metrics!.dia_mas_cortes.fecha.split('-')[2]} de ${formatMonth(metrics!.dia_mas_cortes.fecha.split('-')[0] + '-' + metrics!.dia_mas_cortes.fecha.split('-')[1])} · ${metrics!.dia_mas_cortes.total} cortes` : '—'}
          </div>
        </div>

        {/* Card — Hora pico */}
        <div style={{
          background: '#222',
          border: '1px solid #383838',
          borderRadius: '12px',
          padding: '20px',
          display: 'flex',
          flexDirection: 'column'
        }}>
          <div style={{ marginBottom: '12px' }}>
            <ClockIcon />
          </div>
          <div style={{
            fontSize: '10px',
            color: '#888',
            letterSpacing: '1px',
            textTransform: 'uppercase',
            marginBottom: '8px'
          }}>
            HORA PICO
          </div>
          <div style={{
            fontFamily: 'Syne, sans-serif',
            fontWeight: 700,
            fontSize: '22px',
            color: '#fff',
            marginBottom: '4px'
          }}>
            {metrics!.hora_pico ? `${formatHour(metrics!.hora_pico.hora)} hs` : '—'}
          </div>
          <div style={{
            fontSize: '12px',
            color: '#888'
          }}>
            mayor concentración de servicios
          </div>
        </div>

        {/* Card — Barbero estrella */}
        <div style={{
          background: '#222',
          border: '1px solid #383838',
          borderRadius: '12px',
          padding: '20px',
          display: 'flex',
          flexDirection: 'column'
        }}>
          <div style={{ marginBottom: '12px' }}>
            {metrics!.barbero_estrella ? (
              <UserCircleIcon initial={metrics!.barbero_estrella.nombre.charAt(0)} />
            ) : (
              <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: '#383838' }} />
            )}
          </div>
          <div style={{
            fontSize: '10px',
            color: '#888',
            letterSpacing: '1px',
            textTransform: 'uppercase',
            marginBottom: '8px'
          }}>
            BARBERO ESTRELLA
          </div>
          <div style={{
            fontFamily: 'Syne, sans-serif',
            fontWeight: 700,
            fontSize: '22px',
            color: '#fff',
            marginBottom: '4px'
          }}>
            {metrics!.barbero_estrella ? metrics!.barbero_estrella.nombre : '—'}
          </div>
          <div style={{
            fontSize: '12px',
            color: '#888'
          }}>
            {metrics!.barbero_estrella ? `${metrics!.barbero_estrella.servicios} servicios · ${formatCurrency(metrics!.barbero_estrella.generado)} generados` : '—'}
          </div>
        </div>

        {/* Card — Servicio más popular */}
        <div style={{
          background: '#222',
          border: '1px solid #383838',
          borderRadius: '12px',
          padding: '20px',
          display: 'flex',
          flexDirection: 'column'
        }}>
          <div style={{ marginBottom: '12px' }}>
            <ScissorsIcon />
          </div>
          <div style={{
            fontSize: '10px',
            color: '#888',
            letterSpacing: '1px',
            textTransform: 'uppercase',
            marginBottom: '8px'
          }}>
            SERVICIO TOP
          </div>
          <div style={{
            fontFamily: 'Syne, sans-serif',
            fontWeight: 700,
            fontSize: '22px',
            color: '#fff',
            marginBottom: '4px'
          }}>
            {metrics!.servicio_popular ? metrics!.servicio_popular.nombre : '—'}
          </div>
          <div style={{
            fontSize: '12px',
            color: '#888'
          }}>
            {metrics!.servicio_popular ? `${metrics!.servicio_popular.total} veces solicitado` : '—'}
          </div>
        </div>
      </div>

      {/* SECCIÓN 4 — TICKET PROMEDIO */}
      <div style={{
        background: 'linear-gradient(to right, #2a2a2a, #242424)',
        borderRadius: '12px',
        padding: '20px 24px',
        marginBottom: '40px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <div>
          <div style={{
            fontSize: '10px',
            color: '#888',
            letterSpacing: '2px',
            textTransform: 'uppercase',
            marginBottom: '8px'
          }}>
            TICKET PROMEDIO
          </div>
          <div style={{
            fontSize: '13px',
            color: '#888'
          }}>
            valor promedio por servicio registrado
          </div>
        </div>
        <div style={{
          fontFamily: 'Syne, sans-serif',
          fontWeight: 800,
          fontSize: '42px',
          color: '#C8A97E'
        }}>
          {metrics!.ticket_promedio ? formatCurrency(metrics!.ticket_promedio) : '—'}
        </div>
      </div>

      {/* SECCIÓN 5 — MES TOP (si hay datos) */}
      {metrics!.mes_top && (
        <div style={{
          background: '#2a2a2a',
          borderRadius: '12px',
          padding: '20px 24px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <div>
            <div style={{
              fontSize: '10px',
              color: '#888',
              letterSpacing: '2px',
              textTransform: 'uppercase',
              marginBottom: '8px'
            }}>
              MEJOR MES
            </div>
            <div style={{
              fontFamily: 'Syne, sans-serif',
              fontWeight: 700,
              fontSize: '20px',
              color: '#fff'
            }}>
              {formatMonth(metrics!.mes_top.mes)}
            </div>
          </div>
          <div style={{
            fontFamily: 'Syne, sans-serif',
            fontWeight: 700,
            fontSize: '32px',
            color: '#C8A97E'
          }}>
            {formatCurrency(metrics!.mes_top.total)}
          </div>
        </div>
      )}
    </div>
  )
}