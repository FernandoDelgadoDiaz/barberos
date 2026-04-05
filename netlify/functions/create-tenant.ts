import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

const supabase = createClient(supabaseUrl, supabaseServiceKey)

interface RequestBody {
  barberia_name: string
  slug: string
  owner_name: string
  owner_email: string
  owner_password: string
  primary_color?: string
  secondary_color?: string
}

interface TenantInsert {
  slug: string
  name: string
  primary_color: string
  secondary_color: string
  commission_rules: {
    rules: Array<{
      from_service: number
      to_service: number | null
      barber_pct: number
      owner_pct: number
    }>
    resets_daily: boolean
  }
  is_active: boolean
}

interface NetlifyFunctionEvent {
  httpMethod: string
  body: string
}

const defaultCommissionRules = {
  rules: [
    { from_service: 1, to_service: 1, barber_pct: 100, owner_pct: 0 },
    { from_service: 2, to_service: null, barber_pct: 50, owner_pct: 50 }
  ],
  resets_daily: true
}

const defaultServices = [
  { name: 'Corte', base_price: 1500, duration_min: 30 },
  { name: 'Barba', base_price: 800, duration_min: 20 },
  { name: 'Cejas', base_price: 500, duration_min: 15 },
  { name: 'Diseño', base_price: 2000, duration_min: 45 }
]

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

  let tenantId: string | null = null
  let userId: string | null = null

  try {
    const body: RequestBody = JSON.parse(event.body)

    // Validate required fields
    if (!body.barberia_name || !body.slug || !body.owner_name || !body.owner_email || !body.owner_password) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Missing required fields' }),
      }
    }

    // Validate slug format (lowercase letters, numbers, hyphens)
    const slugRegex = /^[a-z0-9-]+$/
    if (!slugRegex.test(body.slug)) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Slug must contain only lowercase letters, numbers, and hyphens' }),
      }
    }

    // Check if slug already exists
    const { data: existingTenant, error: slugError } = await supabase
      .from('tenants')
      .select('id')
      .eq('slug', body.slug)
      .single()

    if (existingTenant) {
      return {
        statusCode: 409,
        headers,
        body: JSON.stringify({ error: 'Slug already taken' }),
      }
    }
    if (slugError && slugError.code !== 'PGRST116') { // PGRST116 = no rows returned
      console.error('Slug check error:', slugError)
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: 'Failed to check slug availability' }),
      }
    }

    // Start transaction (Supabase doesn't support true transactions across auth+db,
    // so we'll implement manual rollback)
    try {
      // 1. Create auth user
      const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
        email: body.owner_email,
        password: body.owner_password,
        email_confirm: true,
        user_metadata: {
          name: body.owner_name,
          role: 'owner'
        }
      })

      if (authError) {
        console.error('Auth create error:', authError)
        return {
          statusCode: 500,
          headers,
          body: JSON.stringify({ error: 'Failed to create user: ' + authError.message }),
        }
      }

      userId = authUser.user.id

      // 2. Create tenant
      const tenantInsert: TenantInsert = {
        slug: body.slug,
        name: body.barberia_name,
        primary_color: body.primary_color || '#1a1a2e',
        secondary_color: body.secondary_color || '#C8A97E',
        commission_rules: defaultCommissionRules,
        is_active: true
      }

      const { data: newTenant, error: tenantError } = await supabase
        .from('tenants')
        .insert(tenantInsert)
        .select()
        .single()

      if (tenantError || !newTenant) {
        console.error('Tenant create error:', tenantError)
        // Rollback: delete auth user
        if (userId) {
          await supabase.auth.admin.deleteUser(userId)
        }
        return {
          statusCode: 500,
          headers,
          body: JSON.stringify({ error: 'Failed to create tenant' }),
        }
      }

      tenantId = newTenant.id

      // 3. Create owner profile
      const profileInsert = {
        tenant_id: tenantId,
        user_id: userId,
        role: 'owner' as const,
        display_name: body.owner_name,
        is_active: true
      }

      const { error: profileError } = await supabase
        .from('profiles')
        .insert(profileInsert)

      if (profileError) {
        console.error('Profile create error:', profileError)
        // Rollback: delete tenant and auth user
        await supabase.from('tenants').delete().eq('id', tenantId)
        await supabase.auth.admin.deleteUser(userId)
        return {
          statusCode: 500,
          headers,
          body: JSON.stringify({ error: 'Failed to create profile' }),
        }
      }

      // 4. Create default services
      const servicesInsert = defaultServices.map(service => ({
        tenant_id: tenantId,
        name: service.name,
        base_price: service.base_price,
        duration_min: service.duration_min,
        is_active: true
      }))

      const { error: servicesError } = await supabase
        .from('services_catalog')
        .insert(servicesInsert)

      if (servicesError) {
        console.error('Services create error:', servicesError)
        // Rollback: delete profile, tenant, and auth user
        await supabase.from('profiles').delete().eq('user_id', userId)
        await supabase.from('tenants').delete().eq('id', tenantId)
        await supabase.auth.admin.deleteUser(userId)
        return {
          statusCode: 500,
          headers,
          body: JSON.stringify({ error: 'Failed to create default services' }),
        }
      }

      // Success!
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          tenant_id: tenantId,
          slug: body.slug,
          owner_email: body.owner_email,
          success: true
        }),
      }

    } catch (transactionError: unknown) {
      console.error('Transaction error:', transactionError)
      // Comprehensive rollback
      if (tenantId) {
        await supabase.from('tenants').delete().eq('id', tenantId).catch(console.error)
      }
      if (userId) {
        await supabase.auth.admin.deleteUser(userId).catch(console.error)
      }
      const errorMessage = transactionError instanceof Error ? transactionError.message : 'Transaction failed'
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: errorMessage }),
      }
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