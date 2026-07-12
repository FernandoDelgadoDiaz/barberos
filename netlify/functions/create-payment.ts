import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

const supabase = createClient(supabaseUrl, supabaseServiceKey)

// URL pública del sitio (Netlify inyecta URL en producción; fallback explícito)
const SITE_URL = process.env.URL || 'https://barberos-app.netlify.app'

interface NetlifyFunctionEvent {
  httpMethod: string
  headers: Record<string, string>
}

interface MPPreferenceResponse {
  id: string
  init_point: string
}

/**
 * Verifica que el caller sea un owner autenticado y devuelve su tenant_id.
 * El tenant_id se deriva SIEMPRE del profile del token (nunca del body),
 * para que un owner no pueda generar pagos a nombre de otro tenant.
 */
async function verifyOwnerTenant(authHeader: string | undefined): Promise<string | null> {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null
  }
  const token = authHeader.substring(7)
  try {
    const { data: { user }, error } = await supabase.auth.getUser(token)
    if (error || !user) {
      console.error('Token verification error:', error)
      return null
    }
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('role, tenant_id')
      .eq('user_id', user.id)
      .single()
    if (profileError || !profile) {
      console.error('Profile fetch error:', profileError)
      return null
    }
    if (profile.role !== 'owner') return null
    return profile.tenant_id
  } catch (err) {
    console.error('Error verifying owner:', err)
    return null
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
    return { statusCode: 200, headers, body: '' }
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' }),
    }
  }

  try {
    const tenantId = await verifyOwnerTenant(event.headers.authorization)
    if (!tenantId) {
      return {
        statusCode: 403,
        headers,
        body: JSON.stringify({ error: 'Forbidden: owner role required' }),
      }
    }

    const mpAccessToken = process.env.MP_ACCESS_TOKEN
    if (!mpAccessToken) {
      console.error('MP_ACCESS_TOKEN not configured')
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: 'Payment provider not configured' }),
      }
    }

    // Precio configurable via variable de entorno (fallback 30000 ARS)
    const price = Number(process.env.MP_PRICE_ARS ?? '30000')
    if (!Number.isFinite(price) || price <= 0) {
      console.error('Invalid MP_PRICE_ARS:', process.env.MP_PRICE_ARS)
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: 'Invalid price configuration' }),
      }
    }

    // Nombre del tenant para el título del checkout
    const { data: tenant, error: tenantError } = await supabase
      .from('tenants')
      .select('name')
      .eq('id', tenantId)
      .single()

    if (tenantError || !tenant) {
      console.error('Tenant fetch error:', tenantError)
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: 'Failed to load tenant' }),
      }
    }

    // Crear Preference en MercadoPago (API REST, sin SDK)
    const preferenceBody = {
      items: [
        {
          id: 'barberos-subscription-monthly',
          title: `Suscripción mensual — ${tenant.name}`,
          quantity: 1,
          unit_price: price,
          currency_id: 'ARS',
        },
      ],
      external_reference: tenantId,
      metadata: { tenant_id: tenantId },
      notification_url: `${SITE_URL}/api/mp-webhook`,
      back_urls: {
        success: `${SITE_URL}/pago/exito`,
        pending: `${SITE_URL}/pago/pendiente`,
        failure: `${SITE_URL}/pago/error`,
      },
      auto_return: 'approved',
    }

    const mpResponse = await fetch('https://api.mercadopago.com/checkout/preferences', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${mpAccessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(preferenceBody),
    })

    if (!mpResponse.ok) {
      const errorText = await mpResponse.text()
      console.error('MP preference error:', mpResponse.status, errorText)
      return {
        statusCode: 502,
        headers,
        body: JSON.stringify({ error: 'Failed to create payment link' }),
      }
    }

    const preference = await mpResponse.json() as MPPreferenceResponse

    // Guardar la preference generada en el tenant (service_role: el trigger lo permite)
    const { error: updateError } = await supabase
      .from('tenants')
      .update({ mp_preference_id: preference.id })
      .eq('id', tenantId)

    if (updateError) {
      // No es fatal: el webhook reconcilia por external_reference, no por preference
      console.error('Failed to store mp_preference_id:', updateError)
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        init_point: preference.init_point,
        price,
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
