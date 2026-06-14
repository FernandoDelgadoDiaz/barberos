import { useState } from 'react'
import type { BarberStats } from '../../pages/owner/LivePanel'

// Deterministic palette by name/id hash → only used for the avatar background.
// NO emoji badges, NO special-casing by name (no 👑 / ✂️).
const AVATAR_PALETTE = [
  { bg: '#2563EB', fg: '#FFFFFF' }, // blue
  { bg: '#14B8A6', fg: '#FFFFFF' }, // teal
  { bg: '#F97316', fg: '#FFFFFF' }, // orange
  { bg: '#7C3AED', fg: '#FFFFFF' }, // purple
  { bg: '#DC2626', fg: '#FFFFFF' }, // red
  { bg: '#D97706', fg: '#FFFFFF' }, // amber
]

// Strip decorative emoji / pictographs from a display name at render time.
// Presentation-only: the stored name in the DB is left untouched (decision (c):
// no decorative emojis next to barber names, e.g. "Javi ✂️" → "Javi").
export function cleanName(name: string): string {
  return name
    .replace(
      /[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2300}-\u{23FF}\u{2B00}-\u{2BFF}\u{FE00}-\u{FE0F}\u{200D}]/gu,
      '',
    )
    .replace(/\s{2,}/g, ' ')
    .trim()
}

function hashIndex(input: string, mod: number): number {
  let h = 0
  for (let i = 0; i < input.length; i++) {
    h = (h * 31 + input.charCodeAt(i)) | 0
  }
  return Math.abs(h) % mod
}

function getAvatarStyle(displayName: string, id: string): { bg: string; fg: string } {
  const palette = AVATAR_PALETTE[hashIndex(id || displayName, AVATAR_PALETTE.length)]
  return { bg: palette.bg, fg: palette.fg }
}

interface ExpandableBarberCardProps {
  stats: BarberStats
}

export function ExpandableBarberCard({ stats }: ExpandableBarberCardProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  const toggleExpand = () => setIsExpanded(!isExpanded)

  const displayName = cleanName(stats.barber.display_name)
  const initial = (displayName[0] || '?').toUpperCase()
  const avatar = getAvatarStyle(stats.barber.display_name, stats.barber.id)

  const allServices = stats.appointments.flatMap(a => a.services)
  const efectivoTotal = allServices
    .filter(s => (s.payment_method || 'efectivo') === 'efectivo')
    .reduce((sum, s) => sum + s.price_charged, 0)
  const transferenciaTotal = allServices
    .filter(s => s.payment_method === 'transferencia')
    .reduce((sum, s) => sum + s.price_charged, 0)

  const clientCount = stats.appointments.length
  const isWorking = stats.isActive

  // Responsive font helpers (anchor @390 mockup width).
  const fs = {
    name: 'clamp(13px, 3.85vw, 15px)',          // 15px @390
    badge: 'clamp(9px, 2.56vw, 10px)',          // 10px @390
    clientsLine: 'clamp(10px, 2.82vw, 11px)',   // 11px @390
    incomeLabel: 'clamp(9px, 2.56vw, 10px)',    // 10px @390
    incomeValue: 'clamp(13px, 4.1vw, 16px)',    // 16px @390
  }

  return (
    <div style={{ background: '#fff', borderRadius: '16px', boxShadow: '0 1px 2px rgba(15,23,42,0.04)', border: '1px solid #F1F5F9', overflow: 'hidden' }}>
      <div
        onClick={toggleExpand}
        style={{ padding: '14px', display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer' }}
      >
        {/* Avatar — 44px circle, 18px white initial, 12px status dot.
            NO emoji. NO crown / scissors. Only initial + status dot. */}
        <div style={{ position: 'relative', flexShrink: 0 }}>
          <div style={{
            width: '44px',
            height: '44px',
            borderRadius: '50%',
            background: avatar.bg,
            color: avatar.fg,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontWeight: 700,
            fontSize: '18px',
            fontFamily: 'Syne, sans-serif',
            lineHeight: 1,
          }}>
            {initial}
          </div>
          {/* Status dot: 12px, green if active, gray if inactive */}
          <span style={{
            position: 'absolute',
            bottom: 0,
            right: 0,
            width: '12px',
            height: '12px',
            borderRadius: '50%',
            background: isWorking ? '#22C55E' : '#94A3B8',
            border: '2px solid #fff',
          }} aria-hidden="true" />
        </div>

        {/* Name + clients + status badge */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <span style={{
              fontSize: fs.name,
              fontWeight: 700,
              color: '#0F172A',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              lineHeight: 1.2,
              maxWidth: '100%',
            }}>
              {displayName}
            </span>
            <span style={{
              fontSize: fs.badge,
              padding: '2px 8px',
              borderRadius: '999px',
              background: isWorking ? '#DCFCE7' : '#F1F5F9',
              color: isWorking ? '#15803D' : '#64748B',
              fontWeight: 600,
              whiteSpace: 'nowrap',
            }}>
              {isWorking ? 'Trabajando' : 'Disponible'}
            </span>
          </div>
          <div style={{
            fontSize: fs.clientsLine,
            color: '#94A3B8',
            marginTop: '4px',
            fontWeight: 400,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}>
            {clientCount} cliente{clientCount !== 1 ? 's' : ''}
            {stats.servicesCount > 0 && (
              <> · {stats.servicesCount} servicio{stats.servicesCount !== 1 ? 's' : ''}</>
            )}
          </div>
        </div>

        {/* Right: ingresos hoy + chevron */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: fs.incomeLabel, color: '#94A3B8', fontWeight: 400, marginBottom: '2px' }}>
              Ingresos hoy
            </div>
            <div style={{ fontSize: fs.incomeValue, fontWeight: 700, color: '#0F172A', lineHeight: 1.1 }}>
              ${stats.totalGenerated.toLocaleString()}
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '18px', height: '18px', transform: isExpanded ? 'rotate(90deg)' : 'none', transition: 'transform 0.25s ease' }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#94A3B8" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 6l6 6-6 6" />
            </svg>
          </div>
        </div>
      </div>

      {/* Expanded detail (preserved logic) */}
      {isExpanded && stats.appointments.length > 0 && (
        <div style={{ borderTop: '1px solid #F1F5F9', padding: '14px', background: '#FAFBFD' }}>
          <div style={{ fontSize: '10px', color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '10px', fontWeight: 600 }}>
            Detalle de clientes
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {stats.appointments.map((appointment) => {
              const totalTip = appointment.services.reduce((sum, s) => sum + (s.tip_amount ?? 0), 0)
              const totalOthers = appointment.services.reduce((sum, s) => sum + (s.others_amount ?? 0), 0)
              const earningWithoutTip = appointment.total_barber_earning - totalTip
              const barberPct = appointment.total_price > 0 ? Math.round(earningWithoutTip / appointment.total_price * 100) : 0
              const ownerPct = appointment.total_price > 0 ? Math.round(appointment.total_owner_earning / appointment.total_price * 100) : 0
              const time = new Date(appointment.started_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
              const isTransfer = appointment.services[0]?.payment_method === 'transferencia'
              return (
                <div key={appointment.appointment_id} style={{ background: '#fff', borderRadius: '10px', padding: '12px', border: '1px solid #F1F5F9' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '10px' }}>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ fontSize: '13px', fontWeight: 600, color: '#0F172A' }}>
                        Cliente #{appointment.services[0]?.service_number_today || '?'}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '4px', flexWrap: 'wrap' }}>
                        <span style={{ fontSize: '11px', color: '#94A3B8' }}>{time}</span>
                        <span style={{
                          fontSize: '10px',
                          padding: '2px 8px',
                          borderRadius: '999px',
                          background: isTransfer ? '#EFF6FF' : '#ECFDF5',
                          color: isTransfer ? '#2563EB' : '#059669',
                          fontWeight: 600,
                        }}>
                          {isTransfer ? 'Transferencia' : 'Efectivo'}
                        </span>
                      </div>
                    </div>
                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      <div style={{ fontSize: '15px', fontWeight: 700, color: '#0F172A' }}>
                        ${appointment.total_price.toLocaleString()}
                      </div>
                      <div style={{ fontSize: '11px', color: '#94A3B8' }}>
                        {appointment.services.length} servicio{appointment.services.length !== 1 ? 's' : ''}
                      </div>
                    </div>
                  </div>

                  <div style={{ marginTop: '10px', padding: '10px', background: '#F8FAFC', borderRadius: '8px', display: 'flex', justifyContent: 'space-between', gap: '8px' }}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: '10px', color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.4px' }}>Barbero</div>
                      <div style={{ fontSize: '13px', fontWeight: 600, color: '#0F172A' }}>${earningWithoutTip.toLocaleString()}</div>
                    </div>
                    <div style={{ textAlign: 'center', minWidth: 0 }}>
                      <div style={{ fontSize: '10px', color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.4px' }}>Split</div>
                      <div style={{ fontSize: '13px', fontWeight: 600, color: '#2563EB' }}>{barberPct}% / {ownerPct}%</div>
                    </div>
                    <div style={{ textAlign: 'right', minWidth: 0 }}>
                      <div style={{ fontSize: '10px', color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.4px' }}>Dueño</div>
                      <div style={{ fontSize: '13px', fontWeight: 600, color: '#EA580C' }}>${appointment.total_owner_earning.toLocaleString()}</div>
                    </div>
                  </div>

                  {(totalTip > 0 || totalOthers > 0) && (
                    <div style={{ marginTop: '8px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      {totalTip > 0 && (
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
                          <span style={{ color: '#D97706' }}>+${totalTip.toLocaleString()} propina</span>
                          <span style={{ color: '#64748B' }}>100% barbero</span>
                        </div>
                      )}
                      {totalOthers > 0 && (
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
                          <span style={{ color: '#64748B' }}>${totalOthers.toLocaleString()} otros</span>
                          <span style={{ color: '#EA580C' }}>100% dueño</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          <div style={{ marginTop: '12px', padding: '10px 12px', borderRadius: '10px', background: '#EFF6FF', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '12px', color: '#1E40AF', fontWeight: 500 }}>Total para {displayName}</span>
            <span style={{ fontSize: '15px', fontWeight: 700, color: '#1E40AF' }}>${stats.barberEarnings.toLocaleString()}</span>
          </div>

          <div style={{ marginTop: '8px', padding: '10px 12px', background: '#fff', borderRadius: '10px', border: '1px solid #F1F5F9' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#475569' }}>
              <span>Efectivo</span>
              <span style={{ fontWeight: 600, color: '#0F172A' }}>${efectivoTotal.toLocaleString()}</span>
            </div>
            {transferenciaTotal > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#475569', marginTop: '6px' }}>
                <span>Transferencia</span>
                <span style={{ fontWeight: 600, color: '#0F172A' }}>${transferenciaTotal.toLocaleString()}</span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
