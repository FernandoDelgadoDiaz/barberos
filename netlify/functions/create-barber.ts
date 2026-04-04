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
    if (!body.display_name || !body.email || !body.password || !body.tenant_id) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Missing required fields' }),
      }
    }

    // 1. Create user in Auth
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email: body.email,
      password: body.password,
      email_confirm: true,
    })

    if (authError) {
      console.error('Auth error:', authError)
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Failed to create user: ' + authError.message }),
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