import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

const supabase = createClient(supabaseUrl, supabaseServiceKey)

interface RequestBody {
  tenant_id: string
}

interface NetlifyFunctionEvent {
  httpMethod: string
  headers: Record<string, string>
  body: string
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
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json',
  }

  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers,
      body: '',
    }
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

    let body: RequestBody
    try {
      body = JSON.parse(event.body)
    } catch {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Invalid JSON body' }),
      }
    }

    const tenantId = body.tenant_id
    if (!tenantId || typeof tenantId !== 'string' || tenantId.trim() === '') {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Missing required field: tenant_id' }),
      }
    }

    // 1. Verificar que el tenant existe y está inactivo
    const { data: tenant, error: tenantError } = await supabase
      .from('tenants')
      .select('id, name, slug, is_active')
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

    if (tenant.is_active) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          error: 'Cannot delete active tenant. Deactivate tenant first.'
        }),
      }
    }

    // 2. Verificar que no haya turnos abiertos o pausados
    const { data: activeShifts, error: shiftsError } = await supabase
      .from('shifts')
      .select('id, status')
      .eq('tenant_id', tenantId)
      .in('status', ['open', 'paused'])

    if (shiftsError) {
      console.error('Shifts fetch error:', shiftsError)
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: 'Failed to check active shifts' }),
      }
    }

    if (activeShifts && activeShifts.length > 0) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          error: `Cannot delete tenant with ${activeShifts.length} active or paused shifts. Close all shifts first.`
        }),
      }
    }

    // 3. Eliminar en orden respetando foreign keys
    const deletionSteps: Array<{ table: string; label: string }> = [
      { table: 'service_logs',     label: 'service_logs' },
      { table: 'appointments',     label: 'appointments' },
      { table: 'daily_expenses',   label: 'daily_expenses' },
      { table: 'daily_summaries',  label: 'daily_summaries' },
      { table: 'shifts',           label: 'shifts' },
      { table: 'services_catalog', label: 'services_catalog' },
      { table: 'profiles',         label: 'profiles' },
    ]

    for (const step of deletionSteps) {
      const { error: stepError } = await supabase
        .from(step.table)
        .delete()
        .eq('tenant_id', tenantId)
      if (stepError) {
        console.error(`Delete ${step.label} error:`, stepError)
        return {
          statusCode: 500,
          headers,
          body: JSON.stringify({ error: `Failed to delete ${step.label}` }),
        }
      }
    }

    const { error: deleteError } = await supabase
      .from('tenants')
      .delete()
      .eq('id', tenantId)

    if (deleteError) {
      console.error('Delete tenant error:', deleteError)
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: 'Failed to delete tenant' }),
      }
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        message: `Tenant "${tenant.name}" (${tenant.slug}) deleted successfully`,
        deleted_tenant: tenant
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