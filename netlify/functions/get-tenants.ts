import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

const supabase = createClient(supabaseUrl, supabaseServiceKey)

interface TenantWithStats {
  id: string
  slug: string
  name: string
  logo_url: string | null
  primary_color: string
  secondary_color: string
  is_active: boolean
  created_at: string
  total_barberos: number
  total_servicios: number
  total_facturado: number
}

interface NetlifyFunctionEvent {
  httpMethod: string
  headers: Record<string, string>
}

async function verifySuperadmin(authHeader: string | undefined): Promise<boolean> {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return false
  }
  const token = authHeader.substring(7)
  try {
    // Verify token and get user
    const { data: { user }, error } = await supabase.auth.getUser(token)
    if (error || !user) {
      console.error('Token verification error:', error)
      return false
    }
    // Get profile to check role
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

export const handler = async (event: NetlifyFunctionEvent) => {
  // CORS headers
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
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

  // Only GET allowed
  if (event.httpMethod !== 'GET') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' }),
    }
  }

  try {
    // Verify superadmin role
    const isSuperadmin = await verifySuperadmin(event.headers.authorization)
    if (!isSuperadmin) {
      return {
        statusCode: 403,
        headers,
        body: JSON.stringify({ error: 'Forbidden: superadmin role required' }),
      }
    }

    // Fetch all tenants
    const { data: tenants, error: tenantsError } = await supabase
      .from('tenants')
      .select('*')
      .order('created_at', { ascending: false })

    if (tenantsError) {
      console.error('Tenants fetch error:', tenantsError)
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: 'Failed to fetch tenants' }),
      }
    }

    if (!tenants || tenants.length === 0) {
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify([]),
      }
    }

    // Get barber counts per tenant (role='barber')
    const { data: barberCounts, error: barberError } = await supabase
      .from('profiles')
      .select('tenant_id')
      .eq('role', 'barber')

    if (barberError) {
      console.error('Barber counts error:', barberError)
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: 'Failed to fetch barber counts' }),
      }
    }

    // Get service logs stats per tenant
    const { data: serviceLogs, error: logsError } = await supabase
      .from('service_logs')
      .select('tenant_id, price_charged')

    if (logsError) {
      console.error('Service logs error:', logsError)
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: 'Failed to fetch service logs' }),
      }
    }

    // Compute aggregates
    const barberCountsMap = barberCounts.reduce((acc, item) => {
      acc[item.tenant_id] = (acc[item.tenant_id] || 0) + 1
      return acc
    }, {} as Record<string, number>)

    const serviceStatsMap = serviceLogs.reduce((acc, item) => {
      if (!acc[item.tenant_id]) {
        acc[item.tenant_id] = { count: 0, sum: 0 }
      }
      acc[item.tenant_id].count += 1
      acc[item.tenant_id].sum += item.price_charged
      return acc
    }, {} as Record<string, { count: number, sum: number }>)

    const tenantsWithStats: TenantWithStats[] = tenants.map((tenant) => ({
      ...tenant,
      total_barberos: barberCountsMap[tenant.id] || 0,
      total_servicios: serviceStatsMap[tenant.id]?.count || 0,
      total_facturado: serviceStatsMap[tenant.id]?.sum || 0,
    }))

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(tenantsWithStats),
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