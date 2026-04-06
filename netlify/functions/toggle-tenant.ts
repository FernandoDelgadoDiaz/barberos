import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

const supabase = createClient(supabaseUrl, supabaseServiceKey)

interface RequestBody {
  tenant_id: string
  is_active: boolean
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
    // Verify superadmin role
    const isSuperadmin = await verifySuperadmin(event.headers.authorization)
    if (!isSuperadmin) {
      return {
        statusCode: 403,
        headers,
        body: JSON.stringify({ error: 'Forbidden: superadmin role required' }),
      }
    }

    const body: RequestBody = JSON.parse(event.body)

    // Validate required fields
    if (!body.tenant_id || typeof body.is_active !== 'boolean') {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Missing required fields: tenant_id, is_active' }),
      }
    }

    // Update tenant is_active
    const { data: updatedTenant, error: updateError } = await supabase
      .from('tenants')
      .update({ is_active: body.is_active })
      .eq('id', body.tenant_id)
      .select()
      .single()

    if (updateError) {
      console.error('Tenant update error:', updateError)
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: 'Failed to update tenant status' }),
      }
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(updatedTenant),
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