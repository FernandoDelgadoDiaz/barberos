import { createClient } from '@supabase/supabase-js'
import type { Tenant, Profile, ServiceCatalog } from '../../src/types'

const supabaseUrl = process.env.SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

const supabase = createClient(supabaseUrl, supabaseServiceKey)

interface TenantDetails extends Tenant {
  barberos: Array<Pick<Profile, 'id' | 'display_name' | 'is_active' | 'created_at'>>
  servicios: Array<Pick<ServiceCatalog, 'id' | 'name' | 'base_price' | 'duration_min' | 'is_active'>>
  metricas_recientes: {
    servicios_completados: number
    facturacion_total: number
    turnos_activos: number
  }
}

interface NetlifyFunctionEvent {
  httpMethod: string
  headers: Record<string, string>
  queryStringParameters: Record<string, string>
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

export const handler = async (event: NetlifyFunctionEvent) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Content-Type': 'application/json',
  }

  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers,
      body: '',
    }
  }

  if (event.httpMethod !== 'GET') {
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

    const tenantId = event.queryStringParameters?.tenant_id
    if (!tenantId) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Missing tenant_id parameter' }),
      }
    }

    // 1. Obtener información básica del tenant
    const { data: tenant, error: tenantError } = await supabase
      .from('tenants')
      .select('*')
      .eq('id', tenantId)
      .single()

    if (tenantError) {
      console.error('Tenant fetch error:', tenantError)
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({ error: 'Tenant not found' }),
      }
    }

    // 2. Obtener barberos del tenant
    const { data: barberos, error: barberosError } = await supabase
      .from('profiles')
      .select('id, display_name, is_active, created_at')
      .eq('tenant_id', tenantId)
      .eq('role', 'barber')
      .order('display_name', { ascending: true })

    if (barberosError) {
      console.error('Barberos fetch error:', barberosError)
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: 'Failed to fetch barbers' }),
      }
    }

    // 3. Obtener servicios del tenant
    const { data: servicios, error: serviciosError } = await supabase
      .from('services_catalog')
      .select('id, name, base_price, duration_min, is_active')
      .eq('tenant_id', tenantId)
      .order('name', { ascending: true })

    if (serviciosError) {
      console.error('Servicios fetch error:', serviciosError)
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: 'Failed to fetch services' }),
      }
    }

    // 4. Obtener métricas de los últimos 30 días
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
    const thirtyDaysAgoISO = thirtyDaysAgo.toISOString()

    const { data: metricas, error: metricasError } = await supabase
      .from('service_logs')
      .select('id, price_charged, started_at')
      .eq('tenant_id', tenantId)
      .gte('started_at', thirtyDaysAgoISO)

    if (metricasError) {
      console.error('Métricas fetch error:', metricasError)
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: 'Failed to fetch metrics' }),
      }
    }

    // 5. Obtener turnos activos
    const { data: turnosActivos, error: turnosError } = await supabase
      .from('shifts')
      .select('id, status')
      .eq('tenant_id', tenantId)
      .in('status', ['open', 'paused'])

    if (turnosError) {
      console.error('Turnos fetch error:', turnosError)
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: 'Failed to fetch active shifts' }),
      }
    }

    // Calcular métricas
    const serviciosCompletados = metricas?.length || 0
    const facturacionTotal = metricas?.reduce((sum, item) => sum + item.price_charged, 0) || 0
    const turnosActivosCount = turnosActivos?.length || 0

    const tenantDetails: TenantDetails = {
      ...tenant,
      barberos: barberos || [],
      servicios: servicios || [],
      metricas_recientes: {
        servicios_completados,
        facturacion_total: facturacionTotal,
        turnos_activos: turnosActivosCount,
      },
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(tenantDetails),
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