import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

const supabase = createClient(supabaseUrl, supabaseServiceKey)

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

interface RequestBody {
  barber_id: string
  service_id: string
  price_charged: number
  started_at: string
  ended_at?: string
}

interface ServiceLog {
  tenant_id: string
  barber_id: string
  service_id: string
  price_charged: number
  barber_earning: number
  owner_earning: number
  service_number_today: number
  started_at: string
  ended_at: string | null
  status: 'completed'
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
    const body: RequestBody = JSON.parse(event.body)

    // Validate required fields
    if (!body.barber_id || !body.service_id || !body.price_charged || !body.started_at) {
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

    // 2. Get tenant commission rules
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

    // 3. Calculate service_number_today (count of completed services today)
    const today = new Date().toISOString().split('T')[0]
    const { count, error: countError } = await supabase
      .from('service_logs')
      .select('*', { count: 'exact', head: true })
      .eq('barber_id', body.barber_id)
      .eq('tenant_id', tenantId)
      .eq('status', 'completed')
      .gte('started_at', `${today}T00:00:00`)
      .lte('started_at', `${today}T23:59:59`)

    if (countError) {
      console.error('Count error:', countError)
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: 'Failed to count services' }),
      }
    }

    const serviceNumberToday = (count || 0) + 1 // +1 for this new service

    // 4. Apply commission rule
    const { barber, owner } = applyCommission(
      commissionRules.rules,
      serviceNumberToday,
      body.price_charged
    )

    // 5. Insert service log
    const serviceLog: Omit<ServiceLog, 'id' | 'created_at'> = {
      tenant_id: tenantId,
      barber_id: body.barber_id,
      service_id: body.service_id,
      price_charged: body.price_charged,
      barber_earning: barber,
      owner_earning: owner,
      service_number_today: serviceNumberToday,
      started_at: body.started_at,
      ended_at: body.ended_at || null,
      status: 'completed',
    }

    const { data: insertedLog, error: insertError } = await supabase
      .from('service_logs')
      .insert(serviceLog)
      .select()
      .single()

    if (insertError) {
      console.error('Insert error:', insertError)
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: 'Failed to log service' }),
      }
    }

    // 6. Return success
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        service_log_id: insertedLog.id,
        barber_earning: barber,
        owner_earning: owner,
        service_number_today: serviceNumberToday,
        rule_applied: commissionRules.rules.find(r =>
          serviceNumberToday >= r.from_service &&
          (r.to_service === null || serviceNumberToday <= r.to_service)
        ),
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