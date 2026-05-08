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

  return (
    <div style={{ background: '#fff', borderRadius: '10px', border: '0.5px solid #e0e0e0', overflow: 'hidden' }}>
      <div style={{ padding: '14px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }} onClick={toggleExpand}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0 }}>
          <div style={{ width: '40px', height: '40px', borderRadius: '8px', background: '#3D3A8C', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '14px', color: '#fff', flexShrink: 0 }}>
            {stats.barber.display_name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: '14px', fontWeight: 500, color: '#1a1a2e', display: 'flex', alignItems: 'center', gap: '6px' }}>
              {stats.barber.display_name}
              {stats.isActive && <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#2ecc71', display: 'inline-block', flexShrink: 0 }} />}
            </div>
            <div style={{ fontSize: '12px', color: '#aaa', marginTop: '2px' }}>
              {stats.appointments.length} cliente{stats.appointments.length !== 1 ? 's' : ''} · ${stats.totalGenerated.toLocaleString()}
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
          <div style={{ textAlign: 'right', display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div>
              <div style={{ fontSize: '13px', fontWeight: 500, color: '#1a1a2e' }}>${stats.barberEarnings.toLocaleString()}</div>
              <div style={{ fontSize: '10px', color: '#aaa', letterSpacing: '0.5px' }}>BARBERO</div>
            </div>
            <div style={{ width: '1px', height: '20px', background: '#e0e0e0' }} />
            <div>
              <div style={{ fontSize: '16px', fontWeight: 700, color: '#FF8C42' }}>${stats.ownerCommission.toLocaleString()}</div>
              <div style={{ fontSize: '10px', color: '#aaa', letterSpacing: '0.5px' }}>DUEÑO</div>
            </div>
          </div>
          <div style={{ width: '24px', height: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center', transform: isExpanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.3s ease' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#aaa" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        </div>
      </div>

      {isExpanded && stats.appointments.length > 0 && (
        <div style={{ borderTop: '0.5px solid #f0f0f0', padding: '16px' }}>
          <div style={{ fontSize: '11px', color: '#888', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '12px' }}>Detalle de clientes</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {stats.appointments.map((appointment) => (
              <div key={appointment.appointment_id} style={{ background: '#f8f8f8', borderRadius: '8px', padding: '12px', border: '0.5px solid #eeeeee' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <div style={{ fontSize: '13px', fontWeight: 500, color: '#1a1a2e' }}>
                      Cliente #{appointment.services[0]?.service_number_today || '?'}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '4px' }}>
                      <span style={{ fontSize: '11px', color: '#aaa' }}>
                        {new Date(appointment.started_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                      {appointment.services[0]?.payment_method === 'transferencia' ? (
                        <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '10px', background: '#f0f4ff', color: '#3D3A8C' }}>
                          📲 Transferencia
                        </span>
                      ) : (
                        <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '10px', background: '#f0f9f0', color: '#2ecc71' }}>
                          💵 Efectivo
                        </span>
                      )}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '15px', fontWeight: 700, color: '#1a1a2e' }}>${appointment.total_price.toLocaleString()}</div>
                    <div style={{ fontSize: '11px', color: '#aaa' }}>{appointment.services.length} servicio{appointment.services.length !== 1 ? 's' : ''}</div>
                  </div>
                </div>
                {(() => {
                  const totalTip = appointment.services.reduce((sum, s) => sum + (s.tip_amount ?? 0), 0)
                  const totalOthers = appointment.services.reduce((sum, s) => sum + (s.others_amount ?? 0), 0)
                  const earningWithoutTip = appointment.total_barber_earning - totalTip
                  const barberPct = appointment.total_price > 0 ? Math.round(earningWithoutTip / appointment.total_price * 100) : 0
                  const ownerPct = appointment.total_price > 0 ? Math.round(appointment.total_owner_earning / appointment.total_price * 100) : 0
                  return (
                    <div style={{ marginTop: '10px', padding: '8px', background: '#fff', borderRadius: '6px', border: '0.5px solid #eeeeee' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <div>
                          <div style={{ fontSize: '11px', color: '#aaa' }}>Barbero</div>
                          <div style={{ fontSize: '13px', fontWeight: 500, color: '#1a1a2e' }}>${earningWithoutTip.toLocaleString()}</div>
                        </div>
                        <div style={{ textAlign: 'center' }}>
                          <div style={{ fontSize: '11px', color: '#aaa' }}>Split</div>
                          <div style={{ fontSize: '13px', fontWeight: 500, color: '#3D3A8C' }}>{barberPct}% / {ownerPct}%</div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontSize: '11px', color: '#aaa' }}>Owner</div>
                          <div style={{ fontSize: '13px', fontWeight: 500, color: '#FF8C42' }}>${appointment.total_owner_earning.toLocaleString()}</div>
                        </div>
                      </div>
                      {totalTip > 0 && (
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '6px', paddingTop: '6px', borderTop: '0.5px solid #f0f0f0' }}>
                          <div style={{ fontSize: '12px', color: '#D4A853' }}>+${totalTip.toLocaleString()} propina</div>
                          <div style={{ fontSize: '12px', color: '#6B7280' }}>100% barbero</div>
                          <div />
                        </div>
                      )}
                      {totalOthers > 0 && (
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '6px', paddingTop: '6px', borderTop: '0.5px solid #f0f0f0' }}>
                          <div style={{ fontSize: '12px', color: '#6B7280' }}>${totalOthers.toLocaleString()} otros</div>
                          <div />
                          <div style={{ fontSize: '12px', color: '#F97316' }}>100% dueño</div>
                        </div>
                      )}
                    </div>
                  )
                })()}
                <div style={{ marginTop: '8px' }}>
                  <div style={{ fontSize: '11px', color: '#aaa', marginBottom: '4px' }}>Servicios:</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    {appointment.services.map((service, index) => (
                      <div key={index} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 8px', background: '#fff', borderRadius: '4px', border: '0.5px solid #eeeeee', fontSize: '12px' }}>
                        <span style={{ color: '#1a1a2e' }}>· ${service.price_charged.toLocaleString()}</span>
                        <span style={{ color: '#aaa' }}>(barbero: ${service.barber_earning.toLocaleString()})</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
          <div style={{ marginTop: '14px', padding: '12px', background: '#3D3A8C', borderRadius: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ fontSize: '13px', color: 'rgba(255,255,255,0.7)' }}>Total para {stats.barber.display_name}</div>
            <div style={{ fontSize: '15px', fontWeight: 700, color: '#fff' }}>${stats.barberEarnings.toLocaleString()}</div>
          </div>
          <div style={{ marginTop: '8px', padding: '10px 12px', background: '#f8f8f8', borderRadius: '8px', border: '0.5px solid #eeeeee' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#666' }}>
              <span>💵 Efectivo</span>
              <span style={{ fontWeight: 500 }}>${efectivoTotal.toLocaleString()}</span>
            </div>
            {transferenciaTotal > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#666', marginTop: '6px' }}>
                <span>📲 Transferencia</span>
                <span style={{ fontWeight: 500 }}>${transferenciaTotal.toLocaleString()}</span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
