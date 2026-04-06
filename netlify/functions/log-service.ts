import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

const supabase = createClient(supabaseUrl, supabaseServiceKey)

/**
 * Convert a timestamp to UTC, assuming Argentina local time (UTC-3) if no timezone offset is provided.
 * If the timestamp already ends with 'Z', it's already UTC.
 */
function convertToUTC(timestamp: string): string {
  if (timestamp.endsWith('Z')) {
    return timestamp
  }
  // If timestamp already contains a timezone offset (e.g., +/-HH:mm), let Date handle it
  if (timestamp.includes('+') || timestamp.includes('-') && timestamp.lastIndexOf('-') > 10) {
    // Has offset, let Date parse it
    return new Date(timestamp).toISOString()
  }
  // No offset, assume Argentina local time (UTC-3)
  // Append '-03:00' to indicate Argentina offset
  const withOffset = timestamp + '-03:00'
  return new Date(withOffset).toISOString()
}

/**
 * Get UTC start and end of the current Argentina day.
 * Returns ISO strings in UTC for filtering Supabase timestamps.
 */
function getArgentinaDayRange(): { start: string; end: string } {
  const nowUTC = new Date()
  const argentinaTime = new Date(nowUTC.getTime() - (3 * 60 * 60 * 1000))
  const year = argentinaTime.getUTCFullYear()
  const month = argentinaTime.getUTCMonth()
  const day = argentinaTime.getUTCDate()

  // Start of Argentina day (00:00 Argentina) in UTC
  const startArgentina = new Date(Date.UTC(year, month, day, 0, 0, 0, 0))
  const startUTC = new Date(startArgentina.getTime() + (3 * 60 * 60 * 1000))

  // End of Argentina day (23:59:59.999 Argentina) in UTC
  const endArgentina = new Date(Date.UTC(year, month, day, 23, 59, 59, 999))
  const endUTC = new Date(endArgentina.getTime() + (3 * 60 * 60 * 1000))

  return {
    start: startUTC.toISOString(),
    end: endUTC.toISOString()
  }
}

interface CommissionRule {
  from_service: number
  to_service: number | null
  barber_pct: number
  owner_pct: number
}

interface CommissionRules {
  rules: CommissionRule[]
  resets_daily: boolean
}

// Interfaz para cada servicio en el array
interface ServiceItem {
  service_id: string
  price_charged: number
}

// Request body actualizado: array de servicios
interface RequestBody {
  barber_id: string
  services: ServiceItem[]  // Array requerido
  started_at: string
  ended_at?: string        // Opcional, se ignora (ended_at será null)
  shift_id?: string
}

// Interfaz para appointment (local)
interface Appointment {
  id: string
  tenant_id: string
  barber_id: string
  shift_id: string | null
  attention_number: number
  total_price: number
  total_barber_earning: number
  total_owner_earning: number
  started_at: string
  ended_at: string | null
  status: string
  created_at: string
  updated_at: string | null
}

// Interfaz para service_log (local, con appointment_id)
interface ServiceLog {
  tenant_id: string
  barber_id: string
  service_id: string
  price_charged: number
  barber_earning: number
  owner_earning: number
  service_number_today: number
  appointment_id: string | null
  started_at: string
  ended_at: string | null
  status: 'completed'
  shift_id?: string | null
}

function applyCommission(rules: CommissionRule[], serviceNumber: number, price: number) {
  const rule = rules.find(r =>
    serviceNumber >= r.from_service &&
    (r.to_service === null || serviceNumber <= r.to_service)
  )
  if (!rule) return { barber: price, owner: 0 } // default: todo al barbero
  return {
    barber: (price * rule.barber_pct) / 100,
    owner: (price * rule.owner_pct) / 100
  }
}

interface NetlifyFunctionEvent {
  httpMethod: string
  body: string
}

export const handler = async (event: NetlifyFunctionEvent) => {
  // CORS headers
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json',
  }

  // Handle preflight
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers,
      body: '',
    }
  }

  // Only POST allowed
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' }),
    }
  }

  try {
    console.log('log-service invoked, checking env vars...')
    if (!supabaseUrl || !supabaseServiceKey) {
      console.error('Missing Supabase environment variables')
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: 'Server configuration error' }),
      }
    }
    const body: RequestBody = JSON.parse(event.body)

    // Validar required fields
    if (!body.barber_id || !body.services || !body.started_at) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Missing required fields: barber_id, services, started_at' }),
      }
    }

    // Validar que services no esté vacío
    if (body.services.length === 0) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Services array cannot be empty' }),
      }
    }

    // Validar cada servicio
    for (const service of body.services) {
      if (!service.service_id || service.price_charged <= 0) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: 'Each service must have service_id and positive price_charged' }),
        }
      }
    }

    // Convertir started_at a UTC (asume hora Argentina si no tiene offset)
    const startedAtUTC = convertToUTC(body.started_at)

    // 1. Get barber profile to obtain tenant_id
    const { data: barberProfile, error: barberError } = await supabase
      .from('profiles')
      .select('tenant_id')
      .eq('id', body.barber_id)
      .single()

    if (barberError || !barberProfile) {
      console.error('Barber profile error:', barberError)
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({ error: 'Barber not found' }),
      }
    }

    const tenantId = barberProfile.tenant_id

    // 2. Validate shift if provided
    if (body.shift_id) {
      const { data: shift, error: shiftError } = await supabase
        .from('shifts')
        .select('id, status')
        .eq('id', body.shift_id)
        .eq('tenant_id', tenantId)
        .eq('barber_id', body.barber_id)
        .eq('status', 'open')
        .single()

      if (shiftError || !shift) {
        console.error('Shift validation error:', shiftError)
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: 'Invalid shift: shift not found, already closed, or does not belong to barber/tenant' }),
        }
      }
    }

    // 3. Get tenant commission rules
    const { data: tenant, error: tenantError } = await supabase
      .from('tenants')
      .select('commission_rules')
      .eq('id', tenantId)
      .single()

    if (tenantError || !tenant) {
      console.error('Tenant error:', tenantError)
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({ error: 'Tenant not found' }),
      }
    }

    const commissionRules = tenant.commission_rules as CommissionRules

    // 4. Calculate attention_number (número de atención en el turno o día)
    let attentionQuery = supabase
      .from('appointments')
      .select('*', { count: 'exact', head: true })
      .eq('barber_id', body.barber_id)
      .eq('tenant_id', tenantId)

    if (body.shift_id) {
      attentionQuery = attentionQuery.eq('shift_id', body.shift_id)
    } else {
      // Si no hay shift_id, contar por día (backward compatibility)
      const { start, end } = getArgentinaDayRange()
      attentionQuery = attentionQuery
        .gte('started_at', start)
        .lte('started_at', end)
    }

    const { count: attentionCount, error: attentionError } = await attentionQuery

    if (attentionError) {
      console.error('Attention count error:', attentionError)
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: 'Failed to count appointments' }),
      }
    }

    const attentionNumber = (attentionCount || 0) + 1 // +1 para esta nueva atención

    // 5. Calcular total_price sumando todos los servicios
    const totalPrice = body.services.reduce((sum, service) => sum + service.price_charged, 0)

    // 6. Aplicar comisión sobre el TOTAL de la atención
    const { barber: totalBarberEarning, owner: totalOwnerEarning } = applyCommission(
      commissionRules.rules,
      attentionNumber,
      totalPrice
    )

    // Validate numeric values
    if (isNaN(totalPrice) || totalPrice <= 0) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Invalid total price calculation' }),
      }
    }
    if (isNaN(totalBarberEarning) || totalBarberEarning < 0) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Invalid barber earning calculation' }),
      }
    }
    if (isNaN(totalOwnerEarning) || totalOwnerEarning < 0) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Invalid owner earning calculation' }),
      }
    }

    // 7. Crear appointment
    const appointmentData = {
      tenant_id: tenantId,
      barber_id: body.barber_id,
      shift_id: body.shift_id ?? null,
      attention_number: attentionNumber,
      total_price: totalPrice,
      total_barber_earning: totalBarberEarning,
      total_owner_earning: totalOwnerEarning,
      started_at: startedAtUTC,
      ended_at: null, // según decisión del usuario
      status: 'completed',
    }

    const { data: appointment, error: appointmentError } = await supabase
      .from('appointments')
      .insert(appointmentData)
      .select()
      .single()

    if (appointmentError) {
      console.error('Appointment insert error:', appointmentError)
      console.error('Appointment data:', appointmentData)
      console.error('Supabase URL:', supabaseUrl)
      console.error('Tenant ID:', tenantId)
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({
          error: 'Failed to create appointment',
          details: appointmentError.message,
          hint: appointmentError.hint,
          code: appointmentError.code
        }),
      }
    }

    // 8. Calcular service_number_today para cada servicio (individual)
    // Contar servicios existentes para determinar el número base
    let serviceCountQuery = supabase
      .from('service_logs')
      .select('*', { count: 'exact', head: true })
      .eq('barber_id', body.barber_id)
      .eq('tenant_id', tenantId)
      .eq('status', 'completed')

    if (body.shift_id) {
      serviceCountQuery = serviceCountQuery.eq('shift_id', body.shift_id)
    } else {
      const { start, end } = getArgentinaDayRange()
      serviceCountQuery = serviceCountQuery
        .gte('started_at', start)
        .lte('started_at', end)
    }

    const { count: serviceCount, error: serviceCountError } = await serviceCountQuery

    if (serviceCountError) {
      console.error('Service count error:', serviceCountError)
      // Rollback: eliminar appointment recién creado
      await supabase.from('appointments').delete().eq('id', appointment.id)
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: 'Failed to count services' }),
      }
    }

    let currentServiceNumber = serviceCount || 0
    const serviceLogs: Omit<ServiceLog, 'id'>[] = []
    const insertedServiceLogIds: string[] = []

    // 9. Insertar service_logs para cada servicio
    for (let i = 0; i < body.services.length; i++) {
      const service = body.services[i]
      const serviceNumberToday = currentServiceNumber + i + 1

      const serviceLog: Omit<ServiceLog, 'id'> = {
        tenant_id: tenantId,
        barber_id: body.barber_id,
        service_id: service.service_id,
        price_charged: service.price_charged,
        barber_earning: totalBarberEarning * (service.price_charged / totalPrice),
        owner_earning: totalOwnerEarning * (service.price_charged / totalPrice),
        service_number_today: serviceNumberToday,
        appointment_id: appointment.id,
        started_at: startedAtUTC,
        ended_at: null,
        status: 'completed',
        shift_id: body.shift_id ?? null,
      }

      const { data: insertedLog, error: logError } = await supabase
        .from('service_logs')
        .insert(serviceLog)
        .select()
        .single()

      if (logError) {
        console.error('Service log insert error:', logError)
        // Rollback: eliminar todos los service_logs insertados y el appointment
        for (const logId of insertedServiceLogIds) {
          await supabase.from('service_logs').delete().eq('id', logId)
        }
        await supabase.from('appointments').delete().eq('id', appointment.id)
        return {
          statusCode: 500,
          headers,
          body: JSON.stringify({ error: `Failed to insert service log for service ${service.service_id}` }),
        }
      }

      insertedServiceLogIds.push(insertedLog.id)
      serviceLogs.push(insertedLog as ServiceLog)
    }

    // 10. Return success
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        appointment: appointment,
        service_logs: serviceLogs,
        message: `Attention #${attentionNumber} registered with ${body.services.length} services`,
        total_price: totalPrice,
        total_barber_earning: totalBarberEarning,
        total_owner_earning: totalOwnerEarning,
      }),
    }
  } catch (error: unknown) {
    console.error('Unhandled error:', error)
    const errorMessage = error instanceof Error ? error.message : 'Internal server error'
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: errorMessage }),
    }
  }
}