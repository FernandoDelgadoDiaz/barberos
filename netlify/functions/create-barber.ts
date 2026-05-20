import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

const supabase = createClient(supabaseUrl, supabaseServiceKey)

interface RequestBody {
  display_name: string
  email: string
  password: string
  tenant_id: string
}

interface NetlifyFunctionEvent {
  httpMethod: string
  body: string
  headers: Record<string, string>
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
    // --- JWT validation ---
    const authHeader = event.headers.authorization || event.headers.Authorization
    if (!authHeader?.startsWith('Bearer ')) {
      return { statusCode: 401, headers, body: JSON.stringify({ error: 'Unauthorized' }) }
    }
    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)
    if (authError || !user) {
      return { statusCode: 401, headers, body: JSON.stringify({ error: 'Invalid token' }) }
    }

    const body: RequestBody = JSON.parse(event.body)

    // Validate required fields
    if (!body.display_name || !body.email || !body.password || !body.tenant_id) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Missing required fields' }),
      }
    }

    // Verify caller is an owner of the specified tenant
    const { data: ownerProfile, error: ownerCheckError } = await supabase
      .from('profiles')
      .select('id')
      .eq('user_id', user.id)
      .eq('tenant_id', body.tenant_id)
      .eq('role', 'owner')
      .single()
    if (ownerCheckError || !ownerProfile) {
      return { statusCode: 403, headers, body: JSON.stringify({ error: 'Forbidden' }) }
    }

    // 1. Create user in Auth
    const { data: authData, error: createUserError } = await supabase.auth.admin.createUser({
      email: body.email,
      password: body.password,
      email_confirm: true,
    })

    if (createUserError) {
      console.error('Auth error:', createUserError)
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Failed to create user: ' + createUserError.message }),
      }
    }

    const userId = authData.user.id

    // 2. Create profile
    const { data: profileData, error: profileError } = await supabase
      .from('profiles')
      .insert({
        tenant_id: body.tenant_id,
        user_id: userId,
        role: 'barber',
        display_name: body.display_name,
        is_active: true,
      })
      .select()
      .single()

    if (profileError) {
      console.error('Profile error:', profileError)
      // Rollback: delete the auth user if profile creation fails
      await supabase.auth.admin.deleteUser(userId)
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: 'Failed to create profile: ' + profileError.message }),
      }
    }

    // 3. Return success
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        profile_id: profileData.id,
        user_id: userId,
        email: body.email,
        display_name: profileData.display_name,
        created_at: profileData.created_at,
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