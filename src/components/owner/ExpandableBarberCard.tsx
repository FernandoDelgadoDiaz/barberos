import { useState } from 'react'
import { GlassCard } from '../ui/GlassCard'
import type { BarberStats } from '../../pages/owner/LivePanel'

interface ExpandableBarberCardProps {
  stats: BarberStats
}

export function ExpandableBarberCard({ stats }: ExpandableBarberCardProps) {
  const [isExpanded, setIsExpanded] = useState(false)

  const toggleExpand = () => setIsExpanded(!isExpanded)

  return (
    <GlassCard hoverGlow={stats.highlight} glowColor={stats.highlight ? '#C8A97E' : undefined}>
      <div style={{ padding: '16px' }}>
        {/* Collapsed header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            cursor: 'pointer'
          }}
          onClick={toggleExpand}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div style={{
              width: '44px',
              height: '44px',
              borderRadius: '10px',
              background: 'linear-gradient(135deg, var(--secondary, #C8A97E), #8B6200)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontFamily: 'Syne, sans-serif',
              fontWeight: 700,
              fontSize: '16px',
              color: '#080808'
            }}>
              {stats.barber.display_name.split(' ').map(n => n[0]).join('').slice(0, 2)}
            </div>
            <div>
              <div style={{ fontFamily: 'Space Grotesk, sans-serif', fontWeight: 600, fontSize: '15px', color: '#fff' }}>
                {stats.barber.display_name}
                {stats.isActive && (
                  <span style={{ marginLeft: '8px', width: '8px', height: '8px', borderRadius: '50%', background: '#10B981', display: 'inline-block' }} />
                )}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '4px' }}>
                <span style={{ fontFamily: 'Space Grotesk, sans-serif', fontWeight: 400, fontSize: '12px', color: '#888' }}>
                  {stats.servicesCount} servicio{stats.servicesCount !== 1 ? 's' : ''}
                </span>
                <span style={{ width: '4px', height: '4px', borderRadius: '50%', background: '#888' }} />
                <span style={{ fontFamily: 'Space Grotesk, sans-serif', fontWeight: 400, fontSize: '12px', color: '#888' }}>
                  ${stats.totalGenerated.toLocaleString()}
                </span>
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{ textAlign: 'right', display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div>
                <div style={{ fontFamily: 'Space Grotesk, sans-serif', fontWeight: 600, fontSize: '14px', color: '#fff' }}>
                  ${stats.barberEarnings.toLocaleString()}
                </div>
                <div style={{ fontFamily: 'Space Grotesk, sans-serif', fontWeight: 400, fontSize: '10px', color: '#888', letterSpacing: '0.5px' }}>BARBERO</div>
              </div>
              <div style={{ width: '1px', height: '20px', background: '#484848' }} />
              <div>
                <div style={{ fontFamily: 'Space Grotesk, sans-serif', fontWeight: 700, fontSize: '18px', color: 'var(--secondary, #C8A97E)' }}>
                  ${stats.ownerCommission.toLocaleString()}
                </div>
                <div style={{ fontFamily: 'Space Grotesk, sans-serif', fontWeight: 400, fontSize: '10px', color: '#888', letterSpacing: '0.5px' }}>OWNER</div>
              </div>
            </div>
            <div style={{
              width: '24px',
              height: '24px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transform: isExpanded ? 'rotate(180deg)' : 'none',
              transition: 'transform 0.3s ease'
            }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#888" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </div>
          </div>
        </div>

        {/* Expanded content */}
        {isExpanded && stats.appointments.length > 0 && (
          <div style={{ marginTop: '20px', paddingTop: '20px', borderTop: '1px solid #383838' }}>
            <h4 style={{ fontFamily: 'Space Grotesk, sans-serif', fontWeight: 600, fontSize: '14px', color: '#fff', marginBottom: '12px' }}>
              Detalle de atenciones
            </h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {stats.appointments.map((appointment) => (
                <div
                  key={appointment.appointment_id}
                  style={{
                    background: '#383838',
                    borderRadius: '8px',
                    padding: '12px',
                    border: '1px solid #484848'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <div style={{ fontFamily: 'Space Grotesk, sans-serif', fontWeight: 600, fontSize: '13px', color: '#fff' }}>
                        Atención #{appointment.services[0]?.service_number_today || '?'}
                      </div>
                      <div style={{ fontFamily: 'Space Grotesk, sans-serif', fontWeight: 400, fontSize: '11px', color: '#888', marginTop: '2px' }}>
                        {new Date(appointment.started_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontFamily: 'Space Grotesk, sans-serif', fontWeight: 700, fontSize: '16px', color: '#fff' }}>
                        ${appointment.total_price.toLocaleString()}
                      </div>
                      <div style={{ fontFamily: 'Space Grotesk, sans-serif', fontWeight: 400, fontSize: '11px', color: '#888' }}>
                        {appointment.services.length} servicio{appointment.services.length !== 1 ? 's' : ''}
                      </div>
                    </div>
                  </div>

                  {/* Commission breakdown */}
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    marginTop: '8px',
                    padding: '8px',
                    background: '#2a2a2a',
                    borderRadius: '6px'
                  }}>
                    <div>
                      <div style={{ fontFamily: 'Space Grotesk, sans-serif', fontWeight: 400, fontSize: '11px', color: '#888' }}>Barbero</div>
                      <div style={{ fontFamily: 'Space Grotesk, sans-serif', fontWeight: 600, fontSize: '13px', color: '#fff' }}>
                        ${appointment.total_barber_earning.toLocaleString()}
                      </div>
                    </div>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontFamily: 'Space Grotesk, sans-serif', fontWeight: 400, fontSize: '11px', color: '#888' }}>Split</div>
                      <div style={{ fontFamily: 'Space Grotesk, sans-serif', fontWeight: 600, fontSize: '13px', color: '#C8A97E' }}>
                        {appointment.total_price > 0
                          ? Math.round((appointment.total_barber_earning / appointment.total_price) * 100)
                          : 0}% / {appointment.total_price > 0
                          ? Math.round((appointment.total_owner_earning / appointment.total_price) * 100)
                          : 0}%
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontFamily: 'Space Grotesk, sans-serif', fontWeight: 400, fontSize: '11px', color: '#888' }}>Owner</div>
                      <div style={{ fontFamily: 'Space Grotesk, sans-serif', fontWeight: 600, fontSize: '13px', color: '#C8A97E' }}>
                        ${appointment.total_owner_earning.toLocaleString()}
                      </div>
                    </div>
                  </div>

                  {/* Services list */}
                  <div style={{ marginTop: '8px' }}>
                    <div style={{ fontFamily: 'Space Grotesk, sans-serif', fontWeight: 400, fontSize: '11px', color: '#888', marginBottom: '4px' }}>
                      Servicios:
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      {appointment.services.map((service, index) => (
                        <div
                          key={index}
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            padding: '6px 8px',
                            background: '#2a2a2a',
                            borderRadius: '4px',
                            fontSize: '12px'
                          }}
                        >
                          <span style={{ color: '#ccc' }}>• ${service.price_charged.toLocaleString()}</span>
                          <span style={{ color: '#888' }}>
                            (barbero: ${service.barber_earning.toLocaleString()})
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Barber total earnings */}
            <div style={{
              marginTop: '16px',
              padding: '12px',
              background: 'rgba(200, 169, 126, 0.1)',
              border: '1px solid rgba(200, 169, 126, 0.2)',
              borderRadius: '8px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <div style={{ fontFamily: 'Space Grotesk, sans-serif', fontWeight: 600, fontSize: '13px', color: '#C8A97E' }}>
                Total para {stats.barber.display_name}
              </div>
              <div style={{ fontFamily: 'Space Grotesk, sans-serif', fontWeight: 700, fontSize: '16px', color: '#fff' }}>
                ${stats.barberEarnings.toLocaleString()}
              </div>
            </div>
          </div>
        )}
      </div>
    </GlassCard>
  )
}