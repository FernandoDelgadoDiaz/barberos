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
  paused_at: string | null
  status: 'open' | 'paused' | 'closed'
  total_services: number
  total_revenue: number
  barber_earnings: number
  owner_earnings: number
  created_at?: string
  updated_at?: string | null
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

    // 2. Check for any shift today for this barber + tenant (any status)
    const today = new Date().toISOString().split('T')[0] // YYYY-MM-DD
    const todayStart = `${today}T00:00:00Z`
    const todayEnd = `${today}T23:59:59Z`

    const { data: todayShift, error: todayShiftError } = await supabase
      .from('shifts')
      .select('id, status, started_at')
      .eq('barber_id', body.barber_id)
      .eq('tenant_id', tenantId)
      .gte('started_at', todayStart)
      .lte('started_at', todayEnd)
      .maybeSingle()

    if (todayShiftError) {
      console.error('Today shift query error:', todayShiftError)
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: 'Failed to query today shifts' }),
      }
    }

    // If any shift exists today (open, paused, or closed), reject new shift creation
    if (todayShift) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          error: 'Ya existe un turno hoy. Solo se permite un turno por día por barbero.',
          existing_shift: todayShift
        }),
      }
    }

    // 3. Check for existing open shift for this barber + tenant (legacy duplicate protection)
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

    // 4. Create new shift
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