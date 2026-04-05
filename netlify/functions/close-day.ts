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
    const body: RequestBody = JSON.parse(event.body)

    // Validate required fields
    if (!body.barber_id || !body.date) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Missing required fields' }),
      }
    }

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

    // 2. Aggregate service logs for the given date
    const startOfDay = `${body.date}T00:00:00`
    const endOfDay = `${body.date}T23:59:59`

    const { data: logs, error: logsError } = await supabase
      .from('service_logs')
      .select('price_charged, barber_earning, owner_earning')
      .eq('barber_id', body.barber_id)
      .eq('tenant_id', tenantId)
      .eq('status', 'completed')
      .gte('started_at', startOfDay)
      .lte('started_at', endOfDay)

    if (logsError) {
      console.error('Logs aggregation error:', logsError)
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: 'Failed to aggregate service logs' }),
      }
    }

    // Calculate totals
    const totalServices = logs.length
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
      .gte('started_at', startOfDay)
      .lte('started_at', endOfDay)

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