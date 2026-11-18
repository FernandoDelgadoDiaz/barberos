import { createClient } from '@supabase/supabase-js'

// El dueño le asigna una contraseña nueva a un barbero de SU barbería cuando el
// barbero la olvidó. No hay recuperación por email porque muchos barberos se
// crean con emails que no reciben correo.
const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
export const MIN_PASSWORD_LENGTH = 6
const MAX_PASSWORD_LENGTH = 72 // límite de bcrypt en Supabase Auth

interface NetlifyFunctionEvent {
  httpMethod: string
  body: string
  headers: Record<string, string>
}

export const handler = async (event: NetlifyFunctionEvent) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json',
  }
  const reply = (statusCode: number, payload: Record<string, unknown>) => ({ statusCode, headers, body: JSON.stringify(payload) })
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' }
  if (event.httpMethod !== 'POST') return reply(405, { error: 'Método no permitido' })

  try {
    const authHeader = event.headers.authorization || event.headers.Authorization
    if (!authHeader?.startsWith('Bearer ')) return reply(401, { error: 'No autorizado' })
    const { data: { user }, error: authError } = await supabase.auth.getUser(authHeader.slice(7))
    if (authError || !user) return reply(401, { error: 'Sesión inválida' })

    let body: unknown
    try { body = JSON.parse(event.body) } catch { return reply(400, { error: 'Solicitud inválida' }) }
    const barberId = body && typeof body === 'object' && 'barber_id' in body ? body.barber_id : null
    const password = body && typeof body === 'object' && 'password' in body ? body.password : null
    if (typeof barberId !== 'string' || !UUID_RE.test(barberId)) return reply(400, { error: 'Barbero inválido' })
    if (typeof password !== 'string' || password.trim().length < MIN_PASSWORD_LENGTH) {
      return reply(400, { error: `La contraseña debe tener al menos ${MIN_PASSWORD_LENGTH} caracteres.` })
    }
    if (password.length > MAX_PASSWORD_LENGTH) return reply(400, { error: 'La contraseña es demasiado larga.' })

    const { data: owner, error: ownerError } = await supabase
      .from('profiles')
      .select('tenant_id')
      .eq('user_id', user.id)
      .eq('role', 'owner')
      .single()
    if (ownerError || !owner?.tenant_id) return reply(403, { error: 'Solo el dueño puede cambiar contraseñas' })

    // Solo barberos de la misma barbería: el dueño nunca puede tocar la cuenta de
    // otro dueño ni la de un barbero de otro tenant.
    const { data: barber, error: barberError } = await supabase
      .from('profiles')
      .select('user_id')
      .eq('tenant_id', owner.tenant_id)
      .eq('id', barberId)
      .eq('role', 'barber')
      .single()
    if (barberError || !barber?.user_id) return reply(404, { error: 'Barbero no encontrado en tu barbería' })

    const { data: updated, error: updateError } = await supabase.auth.admin.updateUserById(barber.user_id, { password: password.trim() })
    if (updateError) {
      console.error('Failed to set barber password:', updateError)
      return reply(500, { error: 'No se pudo cambiar la contraseña. Intentá de nuevo.' })
    }
    // El email se devuelve para que el dueño sepa con qué usuario tiene que entrar el barbero.
    return reply(200, { success: true, email: updated?.user?.email ?? null })
  } catch (error) {
    console.error('Set barber password error:', error)
    return reply(500, { error: 'No se pudo cambiar la contraseña' })
  }
}
