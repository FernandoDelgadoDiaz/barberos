import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

const supabase = createClient(supabaseUrl, supabaseServiceKey)

const TIMEOUT_MS = 8000 // 8 seconds timeout for Supabase operations

function timeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => {
      setTimeout(() => reject(new Error(`Operation timed out after ${ms}ms`)), ms)
    })
  ])
}

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
    if (!body.shift_id || !body.tenant_id || !body.barber_id) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Missing required fields' }),
      }
    }

    // 1. Verify shift exists, is open, and belongs to the given barber & tenant
    const { data: shift, error: shiftError } = await timeout(
      supabase
        .from('shifts')
        .select('*')
        .eq('id', body.shift_id)
        .eq('tenant_id', body.tenant_id)
        .eq('barber_id', body.barber_id)
        .eq('status', 'open')
        .single(),
      TIMEOUT_MS
    )

    if (shiftError || !shift) {
      console.error('Shift validation error:', shiftError)
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({ error: 'Shift not found, already closed, or does not belong to specified barber/tenant' }),
      }
    }

    // 2. Aggregate service logs for this shift
    const { data: logs, error: logsError } = await timeout(
      supabase
        .from('service_logs')
        .select('price_charged, barber_earning, owner_earning')
        .eq('shift_id', body.shift_id)
        .eq('tenant_id', body.tenant_id)
        .eq('barber_id', body.barber_id)
        .eq('status', 'completed'),
      TIMEOUT_MS
    )

    if (logsError) {
      console.error('Logs aggregation error:', logsError)
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: 'Failed to aggregate service logs' }),
      }
    }

    // Ensure logs is an array
    const safeLogs = logs || []

    // Calculate totals
    const totalServices = safeLogs.length
    const totalRevenue = safeLogs.reduce((sum, log) => sum + log.price_charged, 0)
    const barberEarnings = safeLogs.reduce((sum, log) => sum + log.barber_earning, 0)
    const ownerEarnings = safeLogs.reduce((sum, log) => sum + log.owner_earning, 0)

    // 3. Update shift with totals and close it
    const updates: Partial<Shift> = {
      closed_at: new Date().toISOString(),
      status: 'closed',
      total_services: totalServices,
      total_revenue: totalRevenue,
      barber_earnings: barberEarnings,
      owner_earnings: ownerEarnings,
    }

    const { data: updatedShift, error: updateError } = await timeout(
      supabase
        .from('shifts')
        .update(updates)
        .eq('id', body.shift_id)
        .select()
        .single(),
      TIMEOUT_MS
    )

    if (updateError) {
      console.error('Shift update error:', updateError)
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: 'Failed to close shift' }),
      }
    }

    // 4. Return success with full shift
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        shift: updatedShift,
        breakdown: safeLogs.map(log => ({
          price_charged: log.price_charged,
          barber_earning: log.barber_earning,
          owner_earning: log.owner_earning,
        })),
        message: 'Shift closed successfully',
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