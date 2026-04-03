import { useState, useEffect } from 'react'
import { useTenantStore } from '../../stores/tenantStore'
import { supabase } from '../../config/supabase'
import type { ServiceCatalog, ServiceLog, CommissionRules } from '../../types'

interface ServiceWithEstimation extends ServiceCatalog {
  estimatedEarning: number
}

function applyCommission(rules: CommissionRules['rules'], serviceNumber: number, price: number) {
  const rule = rules.find(r =>
    serviceNumber >= r.from_service &&
    (r.to_service === null || serviceNumber <= r.to_service)
  )
  if (!rule) return price // default: todo al barbero
  return (price * rule.barber_pct) / 100
}

export function Dashboard() {
  const { tenant, profile } = useTenantStore()
  const [services, setServices] = useState<ServiceWithEstimation[]>([])
  const [todayLogs, setTodayLogs] = useState<ServiceLog[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedService, setSelectedService] = useState<ServiceWithEstimation | null>(null)
  const [showConfirmModal, setShowConfirmModal] = useState(false)
  const [processing, setProcessing] = useState(false)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  // Load services and today's logs
  useEffect(() => {
    if (!tenant?.id || !profile?.id) return

    const loadData = async () => {
      setLoading(true)
      setError(null)

      try {
        // Load services catalog
        const { data: servicesData, error: servicesError } = await supabase
          .from('services_catalog')
          .select('*')
          .eq('tenant_id', tenant.id)
          .eq('is_active', true)
          .order('name')

        if (servicesError) throw servicesError

        // Load today's service logs
        const today = new Date().toISOString().split('T')[0]
        const { data: logsData, error: logsError } = await supabase
          .from('service_logs')
          .select('*')
          .eq('tenant_id', tenant.id)
          .eq('barber_id', profile.id)
          .gte('started_at', `${today}T00:00:00`)
          .lte('started_at', `${today}T23:59:59`)
          .order('started_at', { ascending: false })

        if (logsError) throw logsError

        // Calculate estimated earnings for each service based on next service number
        const nextServiceNumber = (logsData?.length || 0) + 1
        const commissionRules = tenant.commission_rules?.rules || []
        const servicesWithEstimation: ServiceWithEstimation[] = (servicesData || []).map(service => ({
          ...service,
          estimatedEarning: applyCommission(commissionRules, nextServiceNumber, service.base_price),
        }))

        setServices(servicesWithEstimation)
        setTodayLogs(logsData || [])
      } catch (err: unknown) {
        console.error('Error loading dashboard data:', err)
        const errorMessage = err instanceof Error ? err.message : 'Error al cargar datos'
        setError(errorMessage)
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [tenant, profile])

  const totalEarningsToday = todayLogs.reduce((sum, log) => sum + log.barber_earning, 0)

  const handleServiceClick = (service: ServiceWithEstimation) => {
    setSelectedService(service)
    setShowConfirmModal(true)
  }

  const confirmService = async () => {
    if (!selectedService || !tenant || !profile) return

    setProcessing(true)
    setError(null)

    try {
      const response = await fetch('/api/log-service', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          barber_id: profile.id,
          service_id: selectedService.id,
          price_charged: selectedService.base_price,
          started_at: new Date().toISOString(),
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Error al registrar servicio')
      }

      const result = await response.json()

      // Refresh data
      const today = new Date().toISOString().split('T')[0]
      const { data: logsData } = await supabase
        .from('service_logs')
        .select('*')
        .eq('tenant_id', tenant.id)
        .eq('barber_id', profile.id)
        .gte('started_at', `${today}T00:00:00`)
        .lte('started_at', `${today}T23:59:59`)
        .order('started_at', { ascending: false })

      setTodayLogs(logsData || [])

      // Update services with new estimation (next service number increased)
      const nextServiceNumber = (logsData?.length || 0) + 1
      const commissionRules = tenant.commission_rules?.rules || []
      const updatedServices = services.map(service => ({
        ...service,
        estimatedEarning: applyCommission(commissionRules, nextServiceNumber, service.base_price),
      }))
      setServices(updatedServices)

      setSuccessMessage(`¡Servicio registrado! Ganancia: $${result.barber_earning.toLocaleString()}`)
      setTimeout(() => setSuccessMessage(null), 5000)
      setShowConfirmModal(false)
      setSelectedService(null)
    } catch (err: unknown) {
      console.error('Error confirming service:', err)
      const errorMessage = err instanceof Error ? err.message : 'Error al registrar servicio'
      setError(errorMessage)
    } finally {
      setProcessing(false)
    }
  }

  if (loading) {
    return (
      <div style={{ maxWidth: '1000px', margin: '0 auto', padding: '40px', textAlign: 'center', color: '#999' }}>
        Cargando...
      </div>
    )
  }

  return (
    <div style={{ maxWidth: '1000px', margin: '0 auto' }}>
      {/* Success toast */}
      {successMessage && (
        <div style={{
          position: 'fixed',
          top: '20px',
          right: '20px',
          background: '#2a2a2a',
          color: '#fff',
          border: '1px solid #C8A97E',
          padding: '16px 20px',
          borderRadius: '8px',
          fontFamily: 'Space Grotesk, sans-serif',
          fontWeight: 600,
          fontSize: '14px',
          zIndex: 1000,
          boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
        }}>
          {successMessage}
        </div>
      )}

      {/* Hero card */}
      <div style={{ background: '#242424', border: '1px solid #383838', borderRadius: '14px', padding: '24px', marginBottom: '24px', position: 'relative', overflow: 'hidden' }}>
        <h1 style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: '28px', color: '#fff', margin: 0 }}>
          Hola, {profile?.display_name || 'Barbero'}
        </h1>
        <p style={{ color: '#999', fontSize: '14px', marginTop: '8px' }}>Tu día empieza ahora. Que los cortes fluyan.</p>
        {/* Barber pole decorative */}
        <svg width="120" height="120" viewBox="0 0 120 120" fill="none" style={{ position: 'absolute', right: '20px', top: '20px', opacity: 0.1 }}>
          <rect x="50" y="10" width="20" height="100" fill="#C8A97E" />
          <rect x="50" y="10" width="20" height="33.33" fill="#fff" />
          <rect x="50" y="43.33" width="20" height="33.33" fill="#1a1a1a" />
          <rect x="50" y="76.66" width="20" height="33.33" fill="#C8A97E" />
          <circle cx="60" cy="10" r="10" fill="#C8A97E" />
          <circle cx="60" cy="110" r="10" fill="#C8A97E" />
        </svg>
      </div>

      {/* Error message */}
      {error && (
        <div style={{
          background: '#1a1a1a',
          border: '1px solid #e94560',
          borderRadius: '8px',
          padding: '12px 16px',
          marginBottom: '16px',
          color: '#e94560',
          fontFamily: 'Space Grotesk, sans-serif',
          fontSize: '14px',
        }}>
          {error}
        </div>
      )}

      {/* Grid cards */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '24px' }}>
        <div style={{ background: '#2a2a2a', border: '1px solid #383838', borderRadius: '12px', padding: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <h3 style={{ fontFamily: 'Space Grotesk, sans-serif', fontWeight: 500, fontSize: '14px', color: '#999', margin: 0 }}>Servicios hoy</h3>
              <div style={{ fontFamily: 'Space Grotesk, sans-serif', fontWeight: 700, fontSize: '32px', color: '#fff', marginTop: '8px' }}>{todayLogs.length}</div>
            </div>
            <div style={{ width: '40px', height: '40px', borderRadius: '8px', background: '#1a1a1a', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#C8A97E" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
            </div>
          </div>
        </div>
        <div style={{ background: '#2a2a2a', border: '1px solid #C8A97E', borderRadius: '12px', padding: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <h3 style={{ fontFamily: 'Space Grotesk, sans-serif', fontWeight: 500, fontSize: '14px', color: '#999', margin: 0 }}>Mi ganancia</h3>
              <div style={{ fontFamily: 'Space Grotesk, sans-serif', fontWeight: 700, fontSize: '32px', color: '#C8A97E', marginTop: '8px' }}>${totalEarningsToday.toLocaleString()}</div>
            </div>
            <div style={{ width: '40px', height: '40px', borderRadius: '8px', background: '#1a1a1a', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#C8A97E" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          </div>
        </div>
      </div>

      {/* Services list */}
      <div style={{ background: '#2a2a2a', border: '1px solid #383838', borderRadius: '12px', padding: '20px', marginBottom: '24px' }}>
        <h2 style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: '18px', color: '#555', margin: '0 0 16px 0', textTransform: 'uppercase', letterSpacing: '1px' }}>Catálogo de servicios</h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {services.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '24px', color: '#999', fontFamily: 'Space Grotesk, sans-serif', fontSize: '14px' }}>
              No hay servicios configurados
            </div>
          ) : (
            services.map((service) => (
              <div
                key={service.id}
                onClick={() => handleServiceClick(service)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '12px',
                  background: '#2a2a2a',
                  borderBottom: '1px solid #383838',
                  cursor: 'pointer',
                  transition: 'border-color 0.2s',
                }}
                onMouseEnter={(e) => e.currentTarget.style.borderColor = '#C8A97E'}
                onMouseLeave={(e) => e.currentTarget.style.borderColor = '#383838'}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{ width: '32px', height: '32px', borderRadius: '6px', background: '#1a1a1a', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#555" strokeWidth="2">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M14.121 14.121L19 19m-7-7l7-7m-7 7l-7-7m7 7l-7 7" />
                    </svg>
                  </div>
                  <div>
                    <div style={{ fontFamily: 'Space Grotesk, sans-serif', fontWeight: 500, fontSize: '14px', color: '#fff' }}>{service.name}</div>
                    <div style={{ fontFamily: 'Space Grotesk, sans-serif', fontWeight: 400, fontSize: '11px', color: '#999', marginTop: '2px' }}>
                      Ganancia estimada: <span style={{ color: '#C8A97E' }}>${service.estimatedEarning.toLocaleString()}</span>
                    </div>
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontFamily: 'Space Grotesk, sans-serif', fontWeight: 700, fontSize: '16px', color: '#C8A97E' }}>${service.base_price.toLocaleString()}</div>
                  <div style={{ fontFamily: 'Space Grotesk, sans-serif', fontWeight: 400, fontSize: '11px', color: '#999' }}>{service.duration_min} min</div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Register service button (hidden when no services) */}
      {services.length > 0 && (
        <button
          onClick={() => services.length > 0 && handleServiceClick(services[0])}
          style={{
            width: '100%',
            background: '#C8A97E',
            color: '#1a1a1a',
            fontFamily: 'Space Grotesk, sans-serif',
            fontWeight: 600,
            fontSize: '16px',
            border: 'none',
            borderRadius: '12px',
            padding: '16px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
          }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#1a1a1a" strokeWidth="3">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
          </svg>
          + Registrar servicio
        </button>
      )}

      {/* Confirmation Modal */}
      {showConfirmModal && selectedService && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.7)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
        }}>
          <div style={{
            background: '#242424',
            border: '1px solid #383838',
            borderRadius: '16px',
            padding: '32px',
            width: '100%',
            maxWidth: '480px',
          }}>
            <h2 style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: '20px', color: '#fff', marginBottom: '16px' }}>
              ¿Confirmar servicio?
            </h2>
            <p style={{ color: '#999', fontFamily: 'Space Grotesk, sans-serif', fontSize: '14px', marginBottom: '24px' }}>
              Estás a punto de registrar el siguiente servicio:
            </p>

            <div style={{
              background: '#1a1a1a',
              border: '1px solid #383838',
              borderRadius: '8px',
              padding: '20px',
              marginBottom: '24px',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <div style={{ fontFamily: 'Space Grotesk, sans-serif', fontWeight: 600, fontSize: '16px', color: '#fff' }}>
                  {selectedService.name}
                </div>
                <div style={{ fontFamily: 'Space Grotesk, sans-serif', fontWeight: 700, fontSize: '18px', color: '#C8A97E' }}>
                  ${selectedService.base_price.toLocaleString()}
                </div>
              </div>
              <div style={{ fontFamily: 'Space Grotesk, sans-serif', fontSize: '13px', color: '#999' }}>
                Duración: {selectedService.duration_min} min
              </div>
              <div style={{ fontFamily: 'Space Grotesk, sans-serif', fontSize: '13px', color: '#999', marginTop: '8px' }}>
                Tu ganancia estimada: ${selectedService.estimatedEarning.toLocaleString()}
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
              <button
                onClick={() => setShowConfirmModal(false)}
                disabled={processing}
                style={{
                  background: 'transparent',
                  border: '1px solid #383838',
                  borderRadius: '6px',
                  padding: '10px 20px',
                  fontFamily: 'Space Grotesk, sans-serif',
                  fontWeight: 500,
                  fontSize: '14px',
                  color: '#999',
                  cursor: 'pointer',
                }}
              >
                Cancelar
              </button>
              <button
                onClick={confirmService}
                disabled={processing}
                style={{
                  background: '#C8A97E',
                  color: '#1a1a1a',
                  border: 'none',
                  borderRadius: '6px',
                  padding: '10px 20px',
                  fontFamily: 'Space Grotesk, sans-serif',
                  fontWeight: 600,
                  fontSize: '14px',
                  cursor: 'pointer',
                  opacity: processing ? 0.6 : 1,
                }}
              >
                {processing ? 'Procesando...' : 'Confirmar servicio'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}