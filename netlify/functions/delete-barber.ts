import { createClient } from '@supabase/supabase-js'

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

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
  const response = (statusCode: number, error?: string) => ({
    statusCode, headers, body: JSON.stringify(error ? { error } : { success: true }),
  })
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' }
  if (event.httpMethod !== 'POST') return response(405, 'Método no permitido')

  try {
    const authHeader = event.headers.authorization || event.headers.Authorization
    if (!authHeader?.startsWith('Bearer ')) return response(401, 'No autorizado')
    const { data: { user }, error: authError } = await supabase.auth.getUser(authHeader.slice(7))
    if (authError || !user) return response(401, 'Sesión inválida')

    const body: unknown = JSON.parse(event.body)
    const barberId = body && typeof body === 'object' && 'barber_id' in body ? body.barber_id : null
    if (typeof barberId !== 'string' || !UUID_RE.test(barberId)) return response(400, 'Barbero inválido')

    const { data: owner, error: ownerError } = await supabase
      .from('profiles')
      .select('tenant_id')
      .eq('user_id', user.id)
      .eq('role', 'owner')
      .single()
    if (ownerError || !owner?.tenant_id) return response(403, 'Solo el dueño puede eliminar barberos')

    const { data: barber, error: barberError } = await supabase
      .from('profiles')
      .select('user_id')
      .eq('tenant_id', owner.tenant_id)
      .eq('id', barberId)
      .eq('role', 'barber')
      .single()
    if (barberError || !barber) return response(404, 'Barbero no encontrado en tu barbería')

    // No se borra ningún perfil con actividad. Las FK RESTRICT de la migración
    // protegen también frente a un turno creado después de estas consultas.
    const tables = ['shifts', 'appointments', 'service_logs', 'daily_summaries', 'product_sales']
    for (const table of tables) {
      const { count, error } = await supabase
        .from(table)
        .select('id', { count: 'exact', head: true })
        .eq('tenant_id', owner.tenant_id)
        .eq('barber_id', barberId)
      if (error) {
        console.error('Barber activity check failed:', table, error)
        return response(500, 'No se pudo verificar el historial del barbero')
      }
      if (count && count > 0) return response(409, 'Este barbero ya tiene actividad registrada. Desactivalo y archivalo para conservar el historial.')
    }

    if (barber.user_id) {
      // Normalmente un usuario tiene un único perfil. Evitamos eliminar otras
      // cuentas por CASCADE si hay datos heredados con el mismo auth.user.
      const { count, error: profilesError } = await supabase
        .from('profiles')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', barber.user_id)
      if (profilesError || count !== 1) return response(409, 'La cuenta está vinculada a otros perfiles; requiere revisión manual.')

      const { error: deleteError } = await supabase.auth.admin.deleteUser(barber.user_id)
      if (deleteError) {
        console.error('Failed to delete barber auth user:', deleteError)
        return response(deleteError.code === 'unexpected_failure' ? 409 : 500,
          'No se pudo eliminar. Revisá si el barbero tiene actividad y volvé a intentar.')
      }
    } else {
      const { error: deleteError } = await supabase
        .from('profiles')
        .delete()
        .eq('tenant_id', owner.tenant_id)
        .eq('id', barberId)
        .eq('role', 'barber')
      if (deleteError) {
        console.error('Failed to delete barber profile:', deleteError)
        return response(409, 'No se pudo eliminar. Desactivá al barbero si tiene historial.')
      }
    }
    return response(200)
  } catch (error) {
    console.error('Delete barber error:', error)
    return response(500, 'No se pudo eliminar el barbero')
  }
}
