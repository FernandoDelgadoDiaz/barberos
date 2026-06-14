import { useState } from 'react'
import type { BarberStats } from '../../pages/owner/LivePanel'

interface ExpandableBarberCardProps {
  stats: BarberStats
}

export function ExpandableBarberCard({ stats }: ExpandableBarberCardProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  const toggleExpand = () => setIsExpanded(!isExpanded)

  const allServices = stats.appointments.flatMap(a => a.services)
  const efectivoTotal = allServices
    .filter(s => (s.payment_method || 'efectivo') === 'efectivo')
    .reduce((sum, s) => sum + s.price_charged, 0)
  const transferenciaTotal = allServices
    .filter(s => s.payment_method === 'transferencia')
    .reduce((sum, s) => sum + s.price_charged, 0)

  const initial = stats.barber.display_name.charAt(0).toUpperCase()
  const accentIndex = stats.barber.id.charCodeAt(0) % 3
  const avatarStyle = [
    { background: 'linear-gradient(135deg, #DBEAFE, #CFFAFE)', color: '#2563EB' },
    { background: 'linear-gradient(135deg, #D1FAE5, #ECFDF5)', color: '#059669' },
    { background: 'linear-gradient(135deg, #FEF3C7, #FFFBEB)', color: '#B45309' },
  ][accentIndex]

  return (
    <div style={{ background: stats.highlight ? '#EFF6FF' : '#FFFFFF', borderRadius: '28px', border: stats.highlight ? '1px solid #93C5FD' : '1px solid #E2E8F0', overflow: 'hidden', boxShadow: stats.highlight ? '0 18px 50px rgba(37,99,235,0.16)' : '0 12px 35px rgba(15,23,42,0.05)', transition: 'box-shadow 180ms ease, border-color 180ms ease, background 180ms ease' }}>
      <button
        type="button"
        onClick={toggleExpand}
        style={{ width: '100%', background: 'transparent', border: 'none', padding: '18px', cursor: 'pointer', display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto', gap: '14px', alignItems: 'center', textAlign: 'left' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '13px', minWidth: 0 }}>
          <div style={{ width: '54px', height: '54px', borderRadius: '20px', background: avatarStyle.background, color: avatarStyle.color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Syne, sans-serif', fontWeight: 900, fontSize: '22px', boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.9), 0 14px 28px rgba(15,23,42,0.08)', flexShrink: 0 }}>
            {initial}
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <span style={{ color: '#0F172A', fontWeight: 800, fontSize: '16px' }}>{stats.barber.display_name}</span>
              {stats.isActive && (
                <span style={{ color: '#047857', background: '#ECFDF5', border: '1px solid #A7F3D0', borderRadius: '999px', padding: '4px 8px', fontSize: '11px', fontWeight: 800 }}>Activo</span>
              )}
            </div>
            <div style={{ color: '#64748B', fontSize: '13px', fontWeight: 600, marginTop: '4px' }}>
              {stats.appointments.length} cliente{stats.appointments.length !== 1 ? 's' : ''} · {stats.servicesCount} servicio{stats.servicesCount !== 1 ? 's' : ''} · ${stats.totalGenerated.toLocaleString()}
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(96px, 1fr))', gap: '10px' }}>
            <div style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '18px', padding: '10px 12px', textAlign: 'right' }}>
              <div style={{ color: '#64748B', fontSize: '10px', fontWeight: 800, textTransform: 'uppercase' }}>Barbero</div>
              <div style={{ color: '#0F172A', fontSize: '15px', fontWeight: 800 }}>${stats.barberEarnings.toLocaleString()}</div>
            </div>
            <div style={{ background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: '18px', padding: '10px 12px', textAlign: 'right' }}>
              <div style={{ color: '#B45309', fontSize: '10px', fontWeight: 800, textTransform: 'uppercase' }}>Dueño</div>
              <div style={{ color: '#F59E0B', fontSize: '15px', fontWeight: 900 }}>${stats.ownerCommission.toLocaleString()}</div>
            </div>
          </div>
          <div style={{ width: '34px', height: '34px', borderRadius: '14px', background: '#F8FAFC', border: '1px solid #E2E8F0', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748B', transform: isExpanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.25s ease' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3">
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        </div>
      </button>

      {isExpanded && stats.appointments.length > 0 && (
        <div style={{ borderTop: '1px solid #E2E8F0', padding: '18px', background: '#F8FAFC' }}>
          <div style={{ color: '#64748B', fontSize: '12px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '12px' }}>Detalle de clientes</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {stats.appointments.map((appointment) => (
              <div key={appointment.appointment_id} style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '24px', padding: '14px', boxShadow: '0 10px 24px rgba(15,23,42,0.04)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px', flexWrap: 'wrap' }}>
                  <div>
                    <div style={{ color: '#0F172A', fontSize: '14px', fontWeight: 800 }}>
                      Cliente #{appointment.services[0]?.service_number_today || '?'}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '6px', flexWrap: 'wrap' }}>
                      <span style={{ color: '#64748B', fontSize: '12px', fontWeight: 700 }}>
                        {new Date(appointment.started_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                      {appointment.services[0]?.payment_method === 'transferencia' ? (
                        <span style={{ color: '#0E7490', background: '#ECFEFF', border: '1px solid #CFFAFE', borderRadius: '999px', padding: '4px 9px', fontSize: '11px', fontWeight: 800 }}>
                          Transferencia
                        </span>
                      ) : (
                        <span style={{ color: '#047857', background: '#ECFDF5', border: '1px solid #A7F3D0', borderRadius: '999px', padding: '4px 9px', fontSize: '11px', fontWeight: 800 }}>
                          Efectivo
                        </span>
                      )}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ color: '#0F172A', fontSize: '18px', fontWeight: 900 }}>${appointment.total_price.toLocaleString()}</div>
                    <div style={{ color: '#64748B', fontSize: '12px', fontWeight: 700 }}>{appointment.services.length} servicio{appointment.services.length !== 1 ? 's' : ''}</div>
                  </div>
                </div>
                {(() => {
                  const totalTip = appointment.services.reduce((sum, s) => sum + (s.tip_amount ?? 0), 0)
                  const totalOthers = appointment.services.reduce((sum, s) => sum + (s.others_amount ?? 0), 0)
                  const earningWithoutTip = appointment.total_barber_earning - totalTip
                  const barberPct = appointment.total_price > 0 ? Math.round(earningWithoutTip / appointment.total_price * 100) : 0
                  const ownerPct = appointment.total_price > 0 ? Math.round(appointment.total_owner_earning / appointment.total_price * 100) : 0
                  return (
                    <div style={{ marginTop: '12px', display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
                      <div style={{ background: '#F8FAFC', borderRadius: '16px', padding: '10px' }}>
                        <div style={{ color: '#64748B', fontSize: '11px', fontWeight: 700 }}>Barbero</div>
                        <div style={{ color: '#0F172A', fontWeight: 800 }}>${earningWithoutTip.toLocaleString()}</div>
                      </div>
                      <div style={{ background: '#EFF6FF', borderRadius: '16px', padding: '10px', textAlign: 'center' }}>
                        <div style={{ color: '#2563EB', fontSize: '11px', fontWeight: 700 }}>Split</div>
                        <div style={{ color: '#0F172A', fontWeight: 800 }}>{barberPct}% / {ownerPct}%</div>
                      </div>
                      <div style={{ background: '#FFFBEB', borderRadius: '16px', padding: '10px', textAlign: 'right' }}>
                        <div style={{ color: '#B45309', fontSize: '11px', fontWeight: 700 }}>Dueño</div>
                        <div style={{ color: '#F59E0B', fontWeight: 900 }}>${appointment.total_owner_earning.toLocaleString()}</div>
                      </div>
                      {totalTip > 0 && (
                        <div style={{ gridColumn: '1 / -1', color: '#B45309', background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: '16px', padding: '9px 10px', fontSize: '12px', fontWeight: 700 }}>
                          +${totalTip.toLocaleString()} propina · 100% barbero
                        </div>
                      )}
                      {totalOthers > 0 && (
                        <div style={{ gridColumn: '1 / -1', color: '#2563EB', background: '#EFF6FF', border: '1px solid #DBEAFE', borderRadius: '16px', padding: '9px 10px', fontSize: '12px', fontWeight: 700 }}>
                          ${totalOthers.toLocaleString()} otros · 100% dueño
                        </div>
                      )}
                    </div>
                  )
                })()}
                <div style={{ marginTop: '12px' }}>
                  <div style={{ color: '#64748B', fontSize: '11px', fontWeight: 800, marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Servicios</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {appointment.services.map((service, index) => (
                      <div key={index} style={{ display: 'flex', justifyContent: 'space-between', gap: '10px', background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '14px', padding: '8px 10px', fontSize: '12px', fontWeight: 700 }}>
                        <span style={{ color: '#0F172A' }}>Servicio · ${service.price_charged.toLocaleString()}</span>
                        <span style={{ color: '#64748B' }}>Barbero ${service.barber_earning.toLocaleString()}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
          <div style={{ marginTop: '12px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
            <div style={{ background: '#ECFDF5', border: '1px solid #A7F3D0', borderRadius: '18px', padding: '10px 12px', display: 'flex', justifyContent: 'space-between', color: '#047857', fontSize: '12px', fontWeight: 800 }}>
              <span>Efectivo</span>
              <span>${efectivoTotal.toLocaleString()}</span>
            </div>
            {transferenciaTotal > 0 && (
              <div style={{ background: '#ECFEFF', border: '1px solid #CFFAFE', borderRadius: '18px', padding: '10px 12px', display: 'flex', justifyContent: 'space-between', color: '#0E7490', fontSize: '12px', fontWeight: 800 }}>
                <span>Transferencia</span>
                <span>${transferenciaTotal.toLocaleString()}</span>
              </div>
            )}
          </div>
          <div style={{ marginTop: '10px', padding: '12px', background: '#EFF6FF', border: '1px solid #DBEAFE', borderRadius: '18px', display: 'flex', justifyContent: 'space-between', gap: '12px', alignItems: 'center' }}>
            <div style={{ fontSize: '13px', color: '#2563EB', fontWeight: 800 }}>Total para {stats.barber.display_name}</div>
            <div style={{ fontSize: '15px', fontWeight: 900, color: '#0F172A' }}>${stats.barberEarnings.toLocaleString()}</div>
          </div>
        </div>
      )}
    </div>
  )
}
