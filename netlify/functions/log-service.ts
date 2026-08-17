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
  if ((timestamp.includes('+') || timestamp.includes('-')) && timestamp.lastIndexOf('-') > 10) {
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

// Detalle de un producto vendido (opcional en el body).
// Solo product_id y quantity se leen; product_name, unit_price y line_total se
// ignoran y se resuelven contra services_catalog. El cliente los sigue mandando,
// así que quedan declarados como opcionales para documentar que llegan y se descartan.
interface ProductItem {
  product_id: string
  quantity: number
  product_name?: string
  unit_price?: number
  line_total?: number
}

// Se valida el formato antes de mandar el id a Postgres: un string cualquiera en un
// `.in('id', ...)` sobre una columna uuid hace fallar la query entera.
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// Producto normalizado/validado del lado del servidor (precio tomado del catálogo)
type NormalizedProduct = {
  product_id: string
  product_name: string
  unit_price: number
  quantity: number
  line_total: number
}

// Request body actualizado: array de servicios
interface RequestBody {
  barber_id: string
  services: ServiceItem[]  // Puede venir vacío si hay products (venta suelta)
  started_at: string
  ended_at?: string        // Opcional, se ignora (ended_at será null)
  shift_id?: string
  payment_method?: 'efectivo' | 'transferencia'
  tip_amount?: number
  tip_payment_method?: 'efectivo' | 'transferencia'
  others_amount?: number
  others_payment_method?: 'efectivo' | 'transferencia'
  products?: ProductItem[]  // Opcional: detalle de productos vendidos
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
  // null en la fila portadora de una venta de productos sin servicio
  service_id: string | null
  price_charged: number
  barber_earning: number
  owner_earning: number
  service_number_today: number
  appointment_id: string | null
  started_at: string
  ended_at: string | null
  status: 'completed'
  shift_id?: string | null
  payment_method: 'efectivo' | 'transferencia'
  tip_amount: number
  tip_payment_method: 'efectivo' | 'transferencia'
  others_amount: number
  others_payment_method: 'efectivo' | 'transferencia'
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
  headers: Record<string, string>
}

export const handler = async (event: NetlifyFunctionEvent) => {
  // CORS headers
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
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

    // --- JWT validation ---
    const authHeader = event.headers.authorization || event.headers.Authorization
    if (!authHeader?.startsWith('Bearer ')) {
      return { statusCode: 401, headers, body: JSON.stringify({ error: 'Unauthorized' }) }
    }
    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)
    if (authError || !user) {
      return { statusCode: 401, headers, body: JSON.stringify({ error: 'Invalid token' }) }
    }

    const body: RequestBody = JSON.parse(event.body)
    const paymentMethod: 'efectivo' | 'transferencia' =
      body.payment_method === 'transferencia' ? 'transferencia' : 'efectivo'
    const tipAmount = typeof body.tip_amount === 'number' ? body.tip_amount : 0
    const tipPaymentMethod: 'efectivo' | 'transferencia' =
      body.tip_payment_method === 'transferencia' ? 'transferencia' : 'efectivo'
    const othersPaymentMethod: 'efectivo' | 'transferencia' =
      body.others_payment_method === 'transferencia' ? 'transferencia' : 'efectivo'

    // Del cliente solo se aceptan product_id y quantity. El precio NO se toma del
    // body: se resuelve contra services_catalog más abajo, una vez conocido el
    // tenant. (Antes se confiaba en unit_price del cliente, lo que permitía
    // subdeclarar una venta —vender una cera de $15.000 y reportarla en $0— y
    // quedarse con la diferencia, porque los productos van 100% al dueño.)
    const requestedProducts: { product_id: string; quantity: number }[] = []
    if (Array.isArray(body.products)) {
      for (const p of body.products) {
        if (!p || typeof p.product_id !== 'string' || !UUID_RE.test(p.product_id)) {
          return { statusCode: 400, headers, body: JSON.stringify({ error: 'Producto inválido: product_id es requerido' }) }
        }
        const quantity = Number(p.quantity)
        if (!Number.isInteger(quantity) || quantity <= 0) {
          return { statusCode: 400, headers, body: JSON.stringify({ error: 'Producto inválido: quantity debe ser un entero positivo' }) }
        }
        requestedProducts.push({ product_id: p.product_id, quantity })
      }
    }

    // Validar required fields
    if (!body.barber_id || !Array.isArray(body.services) || !body.started_at) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Missing required fields: barber_id, services, started_at' }),
      }
    }

    // Una atención necesita al menos un servicio O al menos un producto.
    // services vacío + products => venta suelta de productos (sin servicio).
    if (body.services.length === 0 && requestedProducts.length === 0) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Se requiere al menos un servicio o un producto' }),
      }
    }

    // Venta suelta: no hay servicios, la atención es solo productos.
    const isProductOnly = body.services.length === 0

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

    // 1. Get barber profile to obtain tenant_id — also verifies ownership via user_id
    const { data: barberProfile, error: barberError } = await supabase
      .from('profiles')
      .select('tenant_id')
      .eq('id', body.barber_id)
      .eq('user_id', user.id)
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

    // 1b. Fetch tenant once: verify it's active (block suspended tenants) and
    // grab the commission rules used below. Fail-closed: a missing/failed lookup
    // also blocks.
    const { data: tenant } = await supabase
      .from('tenants')
      .select('is_active, commission_rules')
      .eq('id', tenantId)
      .single()

    if (!tenant?.is_active) {
      return { statusCode: 403, headers, body: JSON.stringify({ error: 'Tenant suspendido' }) }
    }

    const commissionRules = tenant.commission_rules as CommissionRules

    // 1c. Resolver los productos contra el catálogo del tenant. El precio unitario
    // sale de acá, NUNCA del body: es plata del dueño y el cliente no es confiable.
    const products: NormalizedProduct[] = []
    if (requestedProducts.length > 0) {
      const uniqueIds = [...new Set(requestedProducts.map(p => p.product_id))]
      const { data: catalogRows, error: catalogError } = await supabase
        .from('services_catalog')
        .select('id, name, base_price, category')
        .eq('tenant_id', tenantId)
        .in('id', uniqueIds)

      if (catalogError) {
        console.error('Product catalog lookup error:', catalogError)
        return { statusCode: 500, headers, body: JSON.stringify({ error: 'Failed to validate products' }) }
      }

      const catalogById = new Map(
        (catalogRows ?? []).map(row => [row.id as string, row as { id: string; name: string; base_price: number; category: string }])
      )

      for (const requested of requestedProducts) {
        // No está en el mapa => no existe, o es de otro tenant (el .eq('tenant_id')
        // lo filtró). Los dos casos se rechazan igual, sin decir cuál fue.
        const catalogItem = catalogById.get(requested.product_id)
        if (!catalogItem) {
          return {
            statusCode: 400,
            headers,
            body: JSON.stringify({ error: 'Producto inválido: no existe en el catálogo de la barbería' }),
          }
        }
        if (catalogItem.category !== 'producto') {
          return {
            statusCode: 400,
            headers,
            body: JSON.stringify({ error: `"${catalogItem.name.trim()}" no es un producto` }),
          }
        }
        const unitPrice = Number(catalogItem.base_price)
        if (!Number.isFinite(unitPrice) || unitPrice < 0) {
          return {
            statusCode: 400,
            headers,
            body: JSON.stringify({ error: `"${catalogItem.name.trim()}" tiene un precio inválido en el catálogo` }),
          }
        }
        products.push({
          product_id: requested.product_id,
          // Snapshot del nombre del catálogo (no el del cliente), para que el
          // histórico refleje lo que la barbería tenía cargado en ese momento.
          product_name: catalogItem.name.trim() || 'Producto',
          unit_price: unitPrice,
          quantity: requested.quantity,
          line_total: unitPrice * requested.quantity,
        })
      }
    }

    // others_amount alimenta la ganancia del dueño. Si vino detalle de productos, se
    // deriva de los precios del catálogo; si no, se usa el escalar del body (retrocompat
    // con clientes viejos que mandaban others_amount suelto, sin detalle).
    // El escalar solo se acepta si es un número finito y no negativo: un negativo
    // descontaba de la ganancia del dueño (totalOwnerEarning solo se valida contra
    // el 0 absoluto, así que la comisión de la atención absorbía el descuento).
    const legacyOthersAmount = Number(body.others_amount ?? 0)
    if (!Number.isFinite(legacyOthersAmount) || legacyOthersAmount < 0) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'others_amount inválido' }) }
    }
    const othersAmount = products.length > 0
      ? products.reduce((sum, p) => sum + p.line_total, 0)
      : legacyOthersAmount

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

    // 3. Calculate attention_number (número de atención en el turno o día).
    // Se cuentan TODAS las atenciones (incluidas las de solo productos) para que la
    // numeración visible al dueño quede correlativa y sin huecos.
    const buildAttentionQuery = () => {
      let q = supabase
        .from('appointments')
        .select('*', { count: 'exact', head: true })
        .eq('barber_id', body.barber_id)
        .eq('tenant_id', tenantId)

      if (body.shift_id) {
        q = q.eq('shift_id', body.shift_id)
      } else {
        // Si no hay shift_id, contar por día (backward compatibility)
        const { start, end } = getArgentinaDayRange()
        q = q.gte('started_at', start).lte('started_at', end)
      }
      return q
    }

    const { count: attentionCount, error: attentionError } = await buildAttentionQuery()

    if (attentionError) {
      console.error('Attention count error:', attentionError)
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: 'Failed to count appointments' }),
      }
    }

    const attentionNumber = (attentionCount || 0) + 1 // +1 para esta nueva atención

    // 3b. El TRAMO DE COMISIÓN se calcula aparte, contando solo las atenciones que
    // tuvieron servicios (total_price > 0). Si contáramos las ventas sueltas de
    // productos, un barbero avanzaría de tramo vendiendo gaseosas y se llevaría un
    // porcentaje mayor en el próximo corte real.
    // Backward compatible: hasta hoy toda atención tiene total_price > 0, así que
    // este número coincide con attentionNumber en el flujo normal.
    const { count: billableCount, error: billableError } = await buildAttentionQuery()
      .gt('total_price', 0)

    if (billableError) {
      console.error('Billable attention count error:', billableError)
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: 'Failed to count appointments' }),
      }
    }

    const commissionTierNumber = (billableCount || 0) + 1

    // 5. Calcular total_price sumando todos los servicios (0 en una venta suelta)
    const totalPrice = body.services.reduce((sum, service) => sum + service.price_charged, 0)

    // 6. Aplicar comisión sobre el TOTAL de la atención
    const { barber: commissionBarberEarning, owner: commissionOwnerEarning } = applyCommission(
      commissionRules.rules,
      commissionTierNumber,
      totalPrice
    )
    // tip 100% al barbero; others 100% al dueño
    const totalBarberEarning = commissionBarberEarning + tipAmount
    const totalOwnerEarning  = commissionOwnerEarning  + othersAmount

    // Validate numeric values.
    // En una venta suelta totalPrice es 0 legítimamente; en ese caso lo que no puede
    // ser 0 es el importe de los productos.
    if (isNaN(totalPrice) || totalPrice < 0 || (totalPrice === 0 && !isProductOnly)) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Invalid total price calculation' }),
      }
    }
    if (isProductOnly && !(othersAmount > 0)) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Una venta sin servicios requiere productos con importe mayor a 0' }),
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
    // Contar servicios existentes para determinar el número base.
    // price_charged > 0 excluye las filas portadoras de ventas sueltas, que no son
    // servicios: si no, el próximo corte real saltearía un número.
    let serviceCountQuery = supabase
      .from('service_logs')
      .select('*', { count: 'exact', head: true })
      .eq('barber_id', body.barber_id)
      .eq('tenant_id', tenantId)
      .eq('status', 'completed')
      .gt('price_charged', 0)

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

    // 9. Insertar service_logs.
    // Caso normal: una fila por servicio.
    // Venta suelta (sin servicios): UNA sola fila portadora con service_id null y
    // price_charged 0, que transporta el importe de los productos por el mismo
    // camino que todo lo demás (panel en vivo, historial, cierre de caja, métricas
    // leen service_logs, no appointments). service_number_today = 0 la marca como
    // "no es un servicio".
    const logsToInsert: Omit<ServiceLog, 'id'>[] = isProductOnly
      ? [{
          tenant_id: tenantId,
          barber_id: body.barber_id,
          service_id: null,
          price_charged: 0,
          barber_earning: tipAmount,
          owner_earning: othersAmount,
          service_number_today: 0,
          appointment_id: appointment.id,
          started_at: startedAtUTC,
          ended_at: null,
          status: 'completed',
          shift_id: body.shift_id ?? null,
          payment_method: paymentMethod,
          tip_amount: tipAmount,
          tip_payment_method: tipPaymentMethod,
          others_amount: othersAmount,
          others_payment_method: othersPaymentMethod,
        }]
      : body.services.map((service, i) => {
          const isFirst = i === 0
          return {
            tenant_id: tenantId,
            barber_id: body.barber_id,
            service_id: service.service_id,
            price_charged: service.price_charged,
            barber_earning: commissionBarberEarning * (service.price_charged / totalPrice) + (isFirst ? tipAmount : 0),
            owner_earning:  commissionOwnerEarning  * (service.price_charged / totalPrice) + (isFirst ? othersAmount : 0),
            service_number_today: currentServiceNumber + i + 1,
            appointment_id: appointment.id,
            started_at: startedAtUTC,
            ended_at: null,
            status: 'completed' as const,
            shift_id: body.shift_id ?? null,
            payment_method: paymentMethod,
            tip_amount:    isFirst ? tipAmount    : 0,
            tip_payment_method: tipPaymentMethod,
            others_amount: isFirst ? othersAmount : 0,
            others_payment_method: othersPaymentMethod,
          }
        })

    for (const serviceLog of logsToInsert) {
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
          body: JSON.stringify({ error: `Failed to insert service log for service ${serviceLog.service_id ?? 'venta de productos'}` }),
        }
      }

      insertedServiceLogIds.push(insertedLog.id)
      serviceLogs.push(insertedLog as ServiceLog)
    }

    // 9.b Persistir el detalle de productos vendidos (solo reporte para el dueño;
    // la plata ya fluye por others_amount en el primer service_log).
    if (products.length > 0) {
      const productRows = products.map(p => ({
        tenant_id: tenantId,
        appointment_id: appointment.id,
        barber_id: body.barber_id,
        product_id: p.product_id,
        product_name: p.product_name,
        unit_price: p.unit_price,
        quantity: p.quantity,
        line_total: p.line_total,
        payment_method: othersPaymentMethod,
        sold_at: startedAtUTC,
      }))

      const { error: productsError } = await supabase
        .from('product_sales')
        .insert(productRows)

      if (productsError) {
        console.error('Product sales insert error:', productsError)
        // Rollback: borrar service_logs insertados y el appointment
        // (appointment_id es ON DELETE CASCADE, limpia cualquier product_sales parcial).
        for (const logId of insertedServiceLogIds) {
          await supabase.from('service_logs').delete().eq('id', logId)
        }
        await supabase.from('appointments').delete().eq('id', appointment.id)
        return {
          statusCode: 500,
          headers,
          body: JSON.stringify({ error: 'Failed to insert product sales detail' }),
        }
      }
    }

    // 10. Return success
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        appointment: appointment,
        service_logs: serviceLogs,
        message: isProductOnly
          ? `Venta #${attentionNumber} registrada con ${products.length} producto${products.length === 1 ? '' : 's'}`
          : `Attention #${attentionNumber} registered with ${body.services.length} services`,
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