import { createClient } from '@supabase/supabase-js'
import { createHmac, timingSafeEqual } from 'node:crypto'

const supabaseUrl = process.env.SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

const supabase = createClient(supabaseUrl, supabaseServiceKey)

interface NetlifyFunctionEvent {
  httpMethod: string
  headers: Record<string, string>
  body: string | null
  queryStringParameters: Record<string, string> | null
}

interface MPPayment {
  id: number
  status: string
  external_reference?: string | null
  transaction_amount: number
  currency_id: string
  date_approved?: string | null
  metadata?: {
    tenant_id?: string
  }
}

interface WebhookBody {
  type?: string
  topic?: string
  action?: string
  data?: {
    id?: string | number
  }
}

/**
 * Valida la firma x-signature de MercadoPago si MP_WEBHOOK_SECRET está configurado.
 * Formato: "ts=<unix>,v1=<hmac-sha256-hex>" sobre el manifest
 * "id:<data.id>;request-id:<x-request-id>;ts:<ts>;"
 * Si no hay secret configurado, se omite (el re-fetch a la API de MP sigue
 * siendo la fuente de verdad: un webhook falso no puede fabricar un pago aprobado).
 */
function isValidSignature(
  headers: Record<string, string>,
  dataId: string
): boolean {
  const secret = process.env.MP_WEBHOOK_SECRET
  if (!secret) return true

  const signature = headers['x-signature']
  const requestId = headers['x-request-id']
  if (!signature || !requestId) return false

  const parts = signature.split(',').reduce((acc, part) => {
    const [key, value] = part.split('=').map(s => s.trim())
    if (key && value) acc[key] = value
    return acc
  }, {} as Record<string, string>)

  const ts = parts['ts']
  const v1 = parts['v1']
  if (!ts || !v1) return false

  // MP exige el data.id en minúsculas si es alfanumérico
  const manifest = `id:${dataId.toLowerCase()};request-id:${requestId};ts:${ts};`
  const expected = createHmac('sha256', secret).update(manifest).digest('hex')

  const expectedBuf = Buffer.from(expected, 'hex')
  const receivedBuf = Buffer.from(v1, 'hex')
  if (expectedBuf.length !== receivedBuf.length) return false
  return timingSafeEqual(expectedBuf, receivedBuf)
}

/**
 * Suma 1 mes calendario con clamping del día
 * (ej.: 31/ene + 1 mes = 28/feb, no 3/mar).
 */
function addOneMonth(date: Date): Date {
  const result = new Date(date.getTime())
  const day = result.getUTCDate()
  result.setUTCDate(1)
  result.setUTCMonth(result.getUTCMonth() + 1)
  const lastDay = new Date(Date.UTC(result.getUTCFullYear(), result.getUTCMonth() + 1, 0)).getUTCDate()
  result.setUTCDate(Math.min(day, lastDay))
  return result
}

/** Extrae el payment_id de los distintos formatos de notificación de MP. */
function extractPaymentId(event: NetlifyFunctionEvent): string | null {
  const qs = event.queryStringParameters ?? {}

  // Formato nuevo: ?type=payment&data.id=123
  if (qs['type'] === 'payment' && qs['data.id']) return qs['data.id']
  // Formato legacy (IPN): ?topic=payment&id=123
  if (qs['topic'] === 'payment' && qs['id']) return qs['id']

  // Body JSON: { "type": "payment", "data": { "id": "123" } }
  if (event.body) {
    try {
      const body = JSON.parse(event.body) as WebhookBody
      const isPayment = body.type === 'payment' || body.topic === 'payment'
        || (body.action?.startsWith('payment.') ?? false)
      if (isPayment && body.data?.id !== undefined) return String(body.data.id)
    } catch {
      // body no-JSON: se ignora
    }
  }

  return null
}

export const handler = async (event: NetlifyFunctionEvent) => {
  const headers = { 'Content-Type': 'application/json' }

  // MP envía POST; algunas notificaciones legacy llegan como GET
  if (event.httpMethod !== 'POST' && event.httpMethod !== 'GET') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' }),
    }
  }

  try {
    const paymentId = extractPaymentId(event)

    // Notificación que no es de pago (merchant_order, etc.) → 200 para que MP no reintente
    if (!paymentId) {
      return { statusCode: 200, headers, body: JSON.stringify({ ignored: true }) }
    }

    if (!isValidSignature(event.headers, paymentId)) {
      console.error('Invalid webhook signature for payment', paymentId)
      return {
        statusCode: 401,
        headers,
        body: JSON.stringify({ error: 'Invalid signature' }),
      }
    }

    const mpAccessToken = process.env.MP_ACCESS_TOKEN
    if (!mpAccessToken) {
      console.error('MP_ACCESS_TOKEN not configured')
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: 'Payment provider not configured' }),
      }
    }

    // Fuente de verdad: re-consultar el pago en la API de MP.
    // Nunca confiar en el body del webhook.
    const mpResponse = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
      headers: { 'Authorization': `Bearer ${mpAccessToken}` },
    })

    if (mpResponse.status === 404) {
      // Pago inexistente (id inválido o forjado) → 200 para cortar reintentos
      console.error('Payment not found in MP:', paymentId)
      return { statusCode: 200, headers, body: JSON.stringify({ ignored: true }) }
    }

    if (!mpResponse.ok) {
      // Error transitorio de MP → 500 para que MP reintente la notificación
      const errorText = await mpResponse.text()
      console.error('MP payment fetch error:', mpResponse.status, errorText)
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: 'Failed to verify payment' }),
      }
    }

    const payment = await mpResponse.json() as MPPayment

    // Solo procesamos pagos aprobados. Estados intermedios (pending/in_process)
    // NO se insertan: si se insertaran, la notificación posterior de "approved"
    // chocaría contra el UNIQUE y el pago nunca acreditaría.
    if (payment.status !== 'approved') {
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ received: true, status: payment.status }),
      }
    }

    const tenantId = payment.external_reference || payment.metadata?.tenant_id
    if (!tenantId) {
      console.error('Approved payment without tenant reference:', payment.id)
      return { statusCode: 200, headers, body: JSON.stringify({ ignored: true }) }
    }

    // Estado actual del tenant para calcular el nuevo período
    const { data: tenant, error: tenantError } = await supabase
      .from('tenants')
      .select('id, subscription_ends_at, last_payment_id')
      .eq('id', tenantId)
      .single()

    if (tenantError || !tenant) {
      console.error('Tenant not found for payment:', tenantId, tenantError)
      // Referencia inválida: reintentarlo no lo va a arreglar → 200
      return { statusCode: 200, headers, body: JSON.stringify({ ignored: true }) }
    }

    // Nuevo período: desde el máximo entre "hoy" y el fin del período vigente
    // (pagar antes de vencer no regala días; pagar tarde arranca desde hoy)
    const now = new Date()
    const currentEnd = tenant.subscription_ends_at ? new Date(tenant.subscription_ends_at) : null
    const periodStart = currentEnd && currentEnd > now ? currentEnd : now
    const periodEnd = addOneMonth(periodStart)

    // Idempotencia: el INSERT actúa de lock. Si el mp_payment_id ya existe
    // (unique_violation 23505), la notificación ya fue procesada → 200.
    const { error: insertError } = await supabase
      .from('subscription_payments')
      .insert({
        tenant_id: tenantId,
        mp_payment_id: String(payment.id),
        amount: payment.transaction_amount,
        currency: payment.currency_id,
        status: payment.status,
        period_start: periodStart.toISOString(),
        period_end: periodEnd.toISOString(),
        raw: payment,
      })

    if (insertError) {
      if (insertError.code === '23505') {
        // Pago ya registrado. Caso normal: notificación duplicada → 200.
        // Caso de recuperación: un intento anterior registró el pago pero
        // falló al extender el tenant (y la compensación también falló).
        // Se detecta porque last_payment_id no coincide → re-aplicar la
        // extensión con el período guardado en el registro original.
        if (tenant.last_payment_id !== String(payment.id)) {
          const { data: existingPayment } = await supabase
            .from('subscription_payments')
            .select('period_end')
            .eq('mp_payment_id', String(payment.id))
            .single()

          if (existingPayment?.period_end) {
            const { error: healError } = await supabase
              .from('tenants')
              .update({
                subscription_status: 'active',
                subscription_ends_at: existingPayment.period_end,
                last_payment_at: payment.date_approved ?? now.toISOString(),
                last_payment_id: String(payment.id),
              })
              .eq('id', tenantId)

            if (healError) {
              console.error('Self-heal tenant update error:', healError)
              return {
                statusCode: 500,
                headers,
                body: JSON.stringify({ error: 'Failed to activate subscription' }),
              }
            }
            console.log(`Subscription self-healed: tenant=${tenantId} payment=${payment.id} until=${existingPayment.period_end}`)
          }
        }
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({ received: true, duplicate: true }),
        }
      }
      console.error('Payment insert error:', insertError)
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: 'Failed to record payment' }),
      }
    }

    // Activar/extender la suscripción del tenant
    const { error: updateError } = await supabase
      .from('tenants')
      .update({
        subscription_status: 'active',
        subscription_ends_at: periodEnd.toISOString(),
        last_payment_at: payment.date_approved ?? now.toISOString(),
        last_payment_id: String(payment.id),
      })
      .eq('id', tenantId)

    if (updateError) {
      console.error('Tenant update error:', updateError)
      // Compensación: borrar el registro para que el reintento de MP
      // vuelva a procesar todo. Si el DELETE también falla, el reintento
      // caerá en el path de 23505, que se auto-repara (self-heal) usando
      // el período guardado en el registro original.
      const { error: deleteError } = await supabase
        .from('subscription_payments')
        .delete()
        .eq('mp_payment_id', String(payment.id))
      if (deleteError) {
        console.error('Compensation delete also failed (retry will self-heal):', deleteError)
      }
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: 'Failed to activate subscription' }),
      }
    }

    console.log(`Subscription extended: tenant=${tenantId} payment=${payment.id} until=${periodEnd.toISOString()}`)
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ received: true, tenant_id: tenantId, subscription_ends_at: periodEnd.toISOString() }),
    }
  } catch (error: unknown) {
    console.error('Unhandled error:', error)
    // Error inesperado → 500 para que MP reintente
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Internal server error' }),
    }
  }
}
