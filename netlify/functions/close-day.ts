import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

const supabase = createClient(supabaseUrl, supabaseServiceKey)

interface RequestBody {
  barber_id: string
  date: string // YYYY-MM-DD format
}

interface DailySummary {
  tenant_id: string
  barber_id: string
  summary_date: string
  total_services: number
  total_revenue: number
  barber_earnings: number
  owner_earnings: number
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

    // Validate required fields
    if (!body.barber_id || !body.date) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Missing required fields' }),
      }
    }

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

    // 2. Aggregate service logs for the given date
    const argTodayParts = body.date.split('-')
    const argTomorrow = new Date(Date.UTC(+argTodayParts[0], +argTodayParts[1] - 1, +argTodayParts[2] + 1)).toISOString().split('T')[0]
    const logsStartUTC = `${body.date}T03:00:00Z`
    const logsEndUTC = `${argTomorrow}T02:59:59.999Z`

    const { data: logs, error: logsError } = await supabase
      .from('service_logs')
      .select('price_charged, barber_earning, owner_earning')
      .eq('barber_id', body.barber_id)
      .eq('tenant_id', tenantId)
      .eq('status', 'completed')
      .gte('started_at', logsStartUTC)
      .lte('started_at', logsEndUTC)

    if (logsError) {
      console.error('Logs aggregation error:', logsError)
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: 'Failed to aggregate service logs' }),
      }
    }

    // Calculate totals.
    // Una venta de productos sin servicio se guarda como una fila portadora con
    // price_charged 0: suma plata (owner_earnings) pero NO cuenta como servicio.
    const totalServices = logs.filter(log => log.price_charged > 0).length
    const totalRevenue = logs.reduce((sum, log) => sum + log.price_charged, 0)
    const barberEarnings = logs.reduce((sum, log) => sum + log.barber_earning, 0)
    const ownerEarnings = logs.reduce((sum, log) => sum + log.owner_earning, 0)

    // 3. Upsert into daily_summaries
    const summary: Omit<DailySummary, 'id'> = {
      tenant_id: tenantId,
      barber_id: body.barber_id,
      summary_date: body.date,
      total_services: totalServices,
      total_revenue: totalRevenue,
      barber_earnings: barberEarnings,
      owner_earnings: ownerEarnings,
    }

    const { data: upsertedSummary, error: upsertError } = await supabase
      .from('daily_summaries')
      .upsert(summary, {
        onConflict: 'tenant_id,barber_id,summary_date',
        ignoreDuplicates: false,
      })
      .select()
      .single()

    if (upsertError) {
      console.error('Upsert error:', upsertError)
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: 'Failed to save daily summary' }),
      }
    }

    // 4. Mark service logs as closed
    const { error: updateError } = await supabase
      .from('service_logs')
      .update({ status: 'closed' })
      .eq('barber_id', body.barber_id)
      .eq('tenant_id', tenantId)
      .eq('status', 'completed')
      .gte('started_at', logsStartUTC)
      .lte('started_at', logsEndUTC)

    if (updateError) {
      console.error('Failed to mark logs as closed:', updateError)
      // Rollback: delete the newly created summary
      await supabase
        .from('daily_summaries')
        .delete()
        .eq('id', upsertedSummary.id)
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: 'Failed to close service logs' }),
      }
    }

    // 5. Return success with full summary
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        summary: upsertedSummary,
        breakdown: logs.map(log => ({
          price_charged: log.price_charged,
          barber_earning: log.barber_earning,
          owner_earning: log.owner_earning,
        })),
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