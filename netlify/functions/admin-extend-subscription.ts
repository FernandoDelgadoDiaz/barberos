import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

const supabase = createClient(supabaseUrl, supabaseServiceKey)

interface NetlifyFunctionEvent {
  httpMethod: string
  headers: Record<string, string>
  body: string | null
}

interface RequestBody {
  tenant_id: string
  months?: number
}

async function verifySuperadmin(authHeader: string | undefined): Promise<boolean> {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return false
  }
  const token = authHeader.substring(7)
  try {
    const { data: { user }, error } = await supabase.auth.getUser(token)
    if (error || !user) {
      console.error('Token verification error:', error)
      return false
    }
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('role')
      .eq('user_id', user.id)
      .single()
    if (profileError || !profile) {
      console.error('Profile fetch error:', profileError)
      return false
    }
    return profile.role === 'superadmin'
  } catch (err) {
    console.error('Error verifying superadmin:', err)
    return false
  }
}

/**
 * Suma N meses calendario con clamping del día
 * (ej.: 31/ene + 1 mes = 28/feb, no 3/mar).
 */
function addMonths(date: Date, months: number): Date {
  const result = new Date(date.getTime())
  const day = result.getUTCDate()
  result.setUTCDate(1)
  result.setUTCMonth(result.getUTCMonth() + months)
  const lastDay = new Date(Date.UTC(result.getUTCFullYear(), result.getUTCMonth() + 1, 0)).getUTCDate()
  result.setUTCDate(Math.min(day, lastDay))
  return result
}

/**
 * Extensión manual de suscripción (superadmin-only).
 * Fallback para cuando el webhook de MP falla o el cobro se hace por fuera
 * (efectivo, transferencia). Registra el pago en subscription_payments con
 * status 'manual' para mantener la auditoría completa.
 */
export const handler = async (event: NetlifyFunctionEvent) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json',
  }

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' }
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' }),
    }
  }

  try {
    const isSuperadmin = await verifySuperadmin(event.headers.authorization)
    if (!isSuperadmin) {
      return {
        statusCode: 403,
        headers,
        body: JSON.stringify({ error: 'Forbidden: superadmin role required' }),
      }
    }

    if (!event.body) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Missing request body' }),
      }
    }

    const body: RequestBody = JSON.parse(event.body)
    if (!body.tenant_id) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'tenant_id is required' }),
      }
    }

    const months = body.months ?? 1
    if (!Number.isInteger(months) || months < 1 || months > 12) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'months must be an integer between 1 and 12' }),
      }
    }

    // Estado actual del tenant
    const { data: tenant, error: tenantError } = await supabase
      .from('tenants')
      .select('id, subscription_ends_at')
      .eq('id', body.tenant_id)
      .single()

    if (tenantError || !tenant) {
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({ error: 'Tenant not found' }),
      }
    }

    // Mismo criterio que el webhook: extender desde el máximo entre hoy
    // y el fin del período vigente
    const now = new Date()
    const currentEnd = tenant.subscription_ends_at ? new Date(tenant.subscription_ends_at) : null
    const periodStart = currentEnd && currentEnd > now ? currentEnd : now
    const periodEnd = addMonths(periodStart, months)

    const manualPaymentId = `manual-${body.tenant_id}-${Date.now()}`
    const price = Number(process.env.MP_PRICE_ARS ?? '30000')
    const amount = (Number.isFinite(price) && price > 0 ? price : 30000) * months

    // Registro de auditoría (mismo flujo que un pago real de MP)
    const { error: insertError } = await supabase
      .from('subscription_payments')
      .insert({
        tenant_id: body.tenant_id,
        mp_payment_id: manualPaymentId,
        amount,
        currency: 'ARS',
        status: 'manual',
        period_start: periodStart.toISOString(),
        period_end: periodEnd.toISOString(),
        raw: { source: 'admin-extend-subscription', months },
      })

    if (insertError) {
      console.error('Manual payment insert error:', insertError)
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: 'Failed to record manual payment' }),
      }
    }

    // Activar/extender la suscripción y devolver el tenant actualizado
    const { data: updatedTenant, error: updateError } = await supabase
      .from('tenants')
      .update({
        subscription_status: 'active',
        subscription_ends_at: periodEnd.toISOString(),
        last_payment_at: now.toISOString(),
        last_payment_id: manualPaymentId,
      })
      .eq('id', body.tenant_id)
      .select()
      .single()

    if (updateError || !updatedTenant) {
      console.error('Tenant update error:', updateError)
      // Compensación: no dejar el pago manual registrado sin extensión aplicada
      await supabase
        .from('subscription_payments')
        .delete()
        .eq('mp_payment_id', manualPaymentId)
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: 'Failed to extend subscription' }),
      }
    }

    console.log(`Manual extension: tenant=${body.tenant_id} months=${months} until=${periodEnd.toISOString()}`)
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(updatedTenant),
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
