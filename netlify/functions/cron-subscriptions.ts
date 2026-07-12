import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

const supabase = createClient(supabaseUrl, supabaseServiceKey)

const MS_PER_DAY = 1000 * 60 * 60 * 24

type SubscriptionStatus = 'trial' | 'active' | 'grace_period' | 'suspended'

interface TenantSubscriptionRow {
  id: string
  subscription_status: SubscriptionStatus
  subscription_ends_at: string
  grace_days: number
}

/** Normaliza una fecha al inicio del día UTC (comparaciones a nivel día). */
function startOfDayUTC(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))
}

/**
 * Misma semántica que TrialExpiredGuard (deriva de fechas, a nivel día):
 * - hoy <= fin del período           → active
 * - fin < hoy <= fin + grace_days    → grace_period
 * - hoy > fin + grace_days           → suspended
 */
function getDesiredStatus(tenant: TenantSubscriptionRow, today: Date): SubscriptionStatus {
  const subEnd = startOfDayUTC(new Date(tenant.subscription_ends_at))
  const graceDays = tenant.grace_days ?? 5
  const deadline = new Date(subEnd.getTime() + graceDays * MS_PER_DAY)

  if (today > deadline) return 'suspended'
  if (today > subEnd) return 'grace_period'
  return 'active'
}

/**
 * Scheduled function (diaria, ver netlify.toml → schedule = "0 12 * * *").
 * Transiciona subscription_status según fechas. El BLOQUEO real no depende
 * de este cron (el guard deriva el acceso de fechas): esto mantiene el estado
 * consistente para el panel del superadmin y el banner de gracia.
 *
 * No procesa tenants exentos ni tenants que nunca pagaron
 * (subscription_ends_at IS NULL → el trial lo maneja TrialExpiredGuard).
 *
 * Las scheduled functions de Netlify no son invocables por URL pública:
 * solo las dispara el scheduler, por eso no llevan auth.
 */
export const handler = async () => {
  try {
    const { data: tenants, error: fetchError } = await supabase
      .from('tenants')
      .select('id, subscription_status, subscription_ends_at, grace_days')
      .eq('is_exempt_trial', false)
      .not('subscription_ends_at', 'is', null)

    if (fetchError) {
      console.error('cron-subscriptions: tenants fetch error:', fetchError)
      return { statusCode: 500, body: JSON.stringify({ error: 'Failed to fetch tenants' }) }
    }

    const rows = (tenants ?? []) as TenantSubscriptionRow[]
    const today = startOfDayUTC(new Date())

    // Agrupar cambios por estado destino → 1 UPDATE por grupo (máx. 3 writes)
    const changesByStatus: Record<SubscriptionStatus, string[]> = {
      trial: [],
      active: [],
      grace_period: [],
      suspended: [],
    }

    for (const tenant of rows) {
      const desired = getDesiredStatus(tenant, today)
      if (desired !== tenant.subscription_status) {
        changesByStatus[desired].push(tenant.id)
      }
    }

    let changed = 0
    const failures: string[] = []

    for (const status of ['active', 'grace_period', 'suspended'] as const) {
      const ids = changesByStatus[status]
      if (ids.length === 0) continue

      const { error: updateError } = await supabase
        .from('tenants')
        .update({ subscription_status: status })
        .in('id', ids)

      if (updateError) {
        console.error(`cron-subscriptions: update to '${status}' failed:`, updateError, 'ids:', ids)
        failures.push(status)
      } else {
        changed += ids.length
        console.log(`cron-subscriptions: ${ids.length} tenant(s) → '${status}': ${ids.join(', ')}`)
      }
    }

    console.log(`cron-subscriptions: processed=${rows.length} changed=${changed} failures=${failures.length}`)

    if (failures.length > 0) {
      return {
        statusCode: 500,
        body: JSON.stringify({ processed: rows.length, changed, failed_statuses: failures }),
      }
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ processed: rows.length, changed }),
    }
  } catch (error: unknown) {
    console.error('cron-subscriptions: unhandled error:', error)
    return { statusCode: 500, body: JSON.stringify({ error: 'Internal server error' }) }
  }
}
