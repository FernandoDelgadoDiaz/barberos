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

  const firstName = stats.barber.display_name.split(' ')[0]
  const initial = firstName.charAt(0).toUpperCase()
  const accentIndex = Math.abs(stats.barber.display_name.charCodeAt(0)) % 3
  const avatarStyles = [
    { background: 'linear-gradient(135deg, #2563EB, #38BDF8)', badge: '#22C55E', mark: '♕' },
    { background: 'linear-gradient(135deg, #06B6D4, #10B981)', badge: '#22C55E', mark: '✂' },
    { background: 'linear-gradient(135deg, #F97316, #FB923C)', badge: '#94A3B8', mark: '' },
  ][accentIndex]
  const statusLabel = stats.isActive ? 'Trabajando' : 'Disponible'
  const statusColor = stats.isActive ? '#2563EB' : '#16A34A'
  const statusBg = stats.isActive ? '#DBEAFE' : '#DCFCE7'

  return (
    <div style={{ borderTop: '1px solid #EEF2F7' }}>
      <button
        type="button"
        onClick={toggleExpand}
        style={{ width: '100%', background: 'transparent', border: 'none', padding: '18px 0', display: 'grid', gridTemplateColumns: '64px 1fr auto 18px', gap: '14px', alignItems: 'center', textAlign: 'left', cursor: 'pointer' }}
      >
        <div style={{ position: 'relative', width: '58px', height: '58px', borderRadius: '22px', background: avatarStyles.background, color: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '28px', fontWeight: 900, boxShadow: '0 14px 28px rgba(37,99,235,0.22)' }}>
          <span style={{ position: 'absolute', top: '8px', fontSize: '12px', opacity: 0.85 }}>{avatarStyles.mark}</span>
          {initial}
          <span style={{ position: 'absolute', right: '-3px', bottom: '-3px', width: '18px', height: '18px', borderRadius: '50%', background: avatarStyles.badge, border: '3px solid #FFFFFF' }} />
        </div>

        <div style={{ minWidth: 0 }}>
          <div style={{ color: '#070B1D', fontSize: '20px', lineHeight: 1.1, fontWeight: 900, marginBottom: '9px' }}>{firstName}</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <span style={{ color: '#475569', fontSize: '14px', fontWeight: 700 }}>
              {stats.appointments.length > 0 ? `${stats.appointments.length} cliente${stats.appointments.length !== 1 ? 's' : ''}` : 'Sin clientes'}
            </span>
            <span style={{ color: statusColor, background: statusBg, borderRadius: '999px', padding: '5px 10px', fontSize: '12px', fontWeight: 900 }}>
              <span style={{ display: 'inline-block', width: '6px', height: '6px', borderRadius: '50%', background: statusColor, marginRight: '6px', verticalAlign: 'middle' }} />{statusLabel}
            </span>
          </div>
          <div style={{ marginTop: '7px', color: '#94A3B8', fontSize: '12px', fontWeight: 700 }}>{stats.servicesCount} servicio{stats.servicesCount !== 1 ? 's' : ''} · Total {stats.totalGenerated.toLocaleString()}</div>
        </div>

        <div style={{ textAlign: 'right', minWidth: '78px' }}>
          <div style={{ color: '#64748B', fontSize: '12px', fontWeight: 800, marginBottom: '5px' }}>Ingresos hoy</div>
          <div style={{ color: '#070B1D', fontSize: '20px', fontWeight: 900 }}>${stats.totalGenerated.toLocaleString()}</div>
        </div>

        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#94A3B8" strokeWidth="2.5" style={{ transform: isExpanded ? 'rotate(90deg)' : 'none', transition: 'transform 180ms ease' }}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 18l6-6-6-6" />
        </svg>
      </button>

      {isExpanded && stats.appointments.length > 0 && (
        <div style={{ padding: '0 0 18px 78px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '12px' }}>
            <div style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '16px', padding: '10px' }}>
              <div style={{ color: '#64748B', fontSize: '11px', fontWeight: 800 }}>Barbero</div>
              <div style={{ color: '#070B1D', fontSize: '15px', fontWeight: 900 }}>${stats.barberEarnings.toLocaleString()}</div>
            </div>
            <div style={{ background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: '16px', padding: '10px', textAlign: 'right' }}>
              <div style={{ color: '#B45309', fontSize: '11px', fontWeight: 800 }}>Dueño</div>
              <div style={{ color: '#F59E0B', fontSize: '15px', fontWeight: 900 }}>${stats.ownerCommission.toLocaleString()}</div>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {stats.appointments.map((appointment) => (
              <div key={appointment.appointment_id} style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '18px', padding: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', alignItems: 'flex-start' }}>
                  <div>
                    <div style={{ color: '#070B1D', fontSize: '14px', fontWeight: 900 }}>Cliente #{appointment.services[0]?.service_number_today || '?'}</div>
                    <div style={{ color: '#64748B', fontSize: '12px', fontWeight: 700, marginTop: '4px' }}>
                      {new Date(appointment.started_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ color: '#070B1D', fontSize: '16px', fontWeight: 900 }}>${appointment.total_price.toLocaleString()}</div>
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
                    <div style={{ marginTop: '10px', background: '#FFFFFF', borderRadius: '14px', padding: '10px', border: '1px solid #E2E8F0' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px', fontSize: '12px', fontWeight: 800 }}>
                        <span style={{ color: '#070B1D' }}>Barbero ${earningWithoutTip.toLocaleString()}</span>
                        <span style={{ color: '#2563EB' }}>{barberPct}% / {ownerPct}%</span>
                        <span style={{ color: '#F59E0B' }}>Dueño ${appointment.total_owner_earning.toLocaleString()}</span>
                      </div>
                      {totalTip > 0 && <div style={{ marginTop: '8px', color: '#B45309', fontSize: '12px', fontWeight: 800 }}>+${totalTip.toLocaleString()} propina · 100% barbero</div>}
                      {totalOthers > 0 && <div style={{ marginTop: '6px', color: '#2563EB', fontSize: '12px', fontWeight: 800 }}>${totalOthers.toLocaleString()} otros · 100% dueño</div>}
                    </div>
                  )
                })()}

                <div style={{ marginTop: '10px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {appointment.services.map((service, index) => (
                    <div key={index} style={{ display: 'flex', justifyContent: 'space-between', gap: '8px', background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '12px', padding: '8px 9px', fontSize: '12px', fontWeight: 800 }}>
                      <span style={{ color: '#070B1D' }}>Servicio · ${service.price_charged.toLocaleString()}</span>
                      <span style={{ color: service.payment_method === 'transferencia' ? '#2563EB' : '#16A34A' }}>{service.payment_method === 'transferencia' ? 'Transferencia' : 'Efectivo'}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <div style={{ marginTop: '10px', display: 'grid', gridTemplateColumns: transferenciaTotal > 0 ? '1fr 1fr' : '1fr', gap: '8px' }}>
            <div style={{ background: '#ECFDF5', border: '1px solid #BBF7D0', borderRadius: '14px', padding: '9px 10px', display: 'flex', justifyContent: 'space-between', color: '#16A34A', fontSize: '12px', fontWeight: 900 }}><span>Efectivo</span><span>${efectivoTotal.toLocaleString()}</span></div>
            {transferenciaTotal > 0 && <div style={{ background: '#EFF6FF', border: '1px solid #DBEAFE', borderRadius: '14px', padding: '9px 10px', display: 'flex', justifyContent: 'space-between', color: '#2563EB', fontSize: '12px', fontWeight: 900 }}><span>Transferencia</span><span>${transferenciaTotal.toLocaleString()}</span></div>}
          </div>
        </div>
      )}
    </div>
  )
}