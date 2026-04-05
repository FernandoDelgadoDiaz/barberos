import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

const supabase = createClient(supabaseUrl, supabaseServiceKey)

interface RequestBody {
  barber_id: string
  tenant_id?: string // optional, will be validated against barber's tenant
}

interface Shift {
  id: string
  tenant_id: string
  barber_id: string
  started_at: string
  closed_at: string | null
  status: 'open' | 'closed'
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
    if (!body.barber_id) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Missing barber_id' }),
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

    // Validate tenant_id if provided (must match barber's tenant)
    if (body.tenant_id && body.tenant_id !== tenantId) {
      return {
        statusCode: 403,
        headers,
        body: JSON.stringify({ error: 'Barber does not belong to this tenant' }),
      }
    }

    // 2. Check for existing open shift for this barber + tenant
    const { data: existingShift, error: shiftError } = await supabase
      .from('shifts')
      .select('*')
      .eq('barber_id', body.barber_id)
      .eq('tenant_id', tenantId)
      .eq('status', 'open')
      .maybeSingle()

    if (shiftError) {
      console.error('Shift query error:', shiftError)
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: 'Failed to query existing shifts' }),
      }
    }

    // If open shift exists, return it (no duplicate)
    if (existingShift) {
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          shift: existingShift,
          message: 'Open shift already exists',
        }),
      }
    }

    // 3. Create new shift
    const newShift: Omit<Shift, 'id'> = {
      tenant_id: tenantId,
      barber_id: body.barber_id,
      started_at: new Date().toISOString(),
      closed_at: null,
      status: 'open',
      total_services: 0,
      total_revenue: 0,
      barber_earnings: 0,
      owner_earnings: 0,
    }

    const { data: insertedShift, error: insertError } = await supabase
      .from('shifts')
      .insert(newShift)
      .select()
      .single()

    if (insertError) {
      console.error('Shift creation error:', insertError)
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: 'Failed to create shift' }),
      }
    }

    // 4. Return success with full shift
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        shift: insertedShift,
        message: 'Shift opened successfully',
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