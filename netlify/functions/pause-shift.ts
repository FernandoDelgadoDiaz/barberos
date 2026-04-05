import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

const supabase = createClient(supabaseUrl, supabaseServiceKey)

interface RequestBody {
  shift_id: string
  tenant_id: string
  barber_id: string
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
    if (!body.shift_id || !body.tenant_id || !body.barber_id) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Missing required fields: shift_id, tenant_id, barber_id' }),
      }
    }

    // 1. Verify shift exists and belongs to the given barber & tenant
    const { data: shift, error: shiftError } = await supabase
      .from('shifts')
      .select('*')
      .eq('id', body.shift_id)
      .eq('tenant_id', body.tenant_id)
      .eq('barber_id', body.barber_id)
      .in('status', ['open', 'paused']) // only open or paused shifts can be toggled
      .single()

    if (shiftError || !shift) {
      console.error('Shift validation error:', shiftError)
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({ error: 'Shift not found, already closed, or does not belong to specified barber/tenant' }),
      }
    }

    // 2. Determine new status based on current status
    const currentStatus = shift.status
    let newStatus: 'open' | 'paused'
    let pausedAt: string | null = null

    if (currentStatus === 'open') {
      newStatus = 'paused'
      pausedAt = new Date().toISOString()
    } else if (currentStatus === 'paused') {
      newStatus = 'open'
      pausedAt = null
    } else {
      // This should not happen due to the .in('status', ['open', 'paused']) filter above
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Shift cannot be paused/resumed because it is closed' }),
      }
    }

    // 3. Update shift with new status and paused_at
    const updates: Partial<Shift> = {
      status: newStatus,
      paused_at: pausedAt,
    }

    const { data: updatedShift, error: updateError } = await supabase
      .from('shifts')
      .update(updates)
      .eq('id', body.shift_id)
      .select()
      .single()

    if (updateError) {
      console.error('Shift update error:', updateError)
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: 'Failed to update shift' }),
      }
    }

    // 4. Return success with updated shift
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        shift: updatedShift,
        message: newStatus === 'paused' ? 'Shift paused successfully' : 'Shift resumed successfully',
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