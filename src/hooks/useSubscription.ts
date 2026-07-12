import { useCallback, useState } from 'react'
import { supabase } from '../config/supabase'

const MS_PER_DAY = 1000 * 60 * 60 * 24

async function getAuthHeader(): Promise<string> {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) {
    const { data: { session: refreshed } } = await supabase.auth.refreshSession()
    if (!refreshed?.access_token) throw new Error('No session')
    return `Bearer ${refreshed.access_token}`
  }
  return `Bearer ${session.access_token}`
}

export const formatPrice = (amount: number): string =>
  new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    maximumFractionDigits: 0,
  }).format(amount)

/** Normaliza una fecha al inicio del día (comparaciones a nivel día). */
const startOfDay = (d: Date): Date => {
  const r = new Date(d)
  r.setHours(0, 0, 0, 0)
  return r
}

export type PaymentLink = {
  init_point: string
  price: number
}

export type AccessState = {
  blocked: boolean
  /** true si el bloqueo/aviso corresponde a una suscripción paga vencida (no al trial) */
  isSubscription: boolean
  /** true si está dentro del período de gracia (acceso permitido, banner visible) */
  inGrace: boolean
  /** días restantes de gracia (0 = hoy es el último día) */
  graceDaysLeft: number
}

/**
 * Deriva el estado de acceso SOLO de fechas (no depende de que el cron
 * haya actualizado subscription_status):
 * - is_exempt_trial → acceso libre
 * - pagó alguna vez (subscription_ends_at != null):
 *     hoy <= subscription_ends_at + grace_days → acceso (banner si ya venció)
 * - nunca pagó: trial_ends_at > hoy → acceso; si no → paywall
 */
export function getAccessState(tenant: {
  is_exempt_trial?: boolean
  subscription_ends_at?: string | null
  grace_days?: number
  trial_ends_at?: string | null
}): AccessState {
  const none: AccessState = { blocked: false, isSubscription: false, inGrace: false, graceDaysLeft: 0 }

  if (tenant.is_exempt_trial) return none

  const today = startOfDay(new Date())

  if (tenant.subscription_ends_at) {
    const subEnd = startOfDay(new Date(tenant.subscription_ends_at))
    const graceDays = tenant.grace_days ?? 5
    const deadline = new Date(subEnd.getTime() + graceDays * MS_PER_DAY)

    if (today > deadline) {
      return { blocked: true, isSubscription: true, inGrace: false, graceDaysLeft: 0 }
    }
    if (today > subEnd) {
      const daysLeft = Math.round((deadline.getTime() - today.getTime()) / MS_PER_DAY)
      return { blocked: false, isSubscription: true, inGrace: true, graceDaysLeft: daysLeft }
    }
    return none
  }

  // Nunca pagó: rige el trial (mismo comportamiento que antes)
  if (tenant.trial_ends_at) {
    const trialEnd = startOfDay(new Date(tenant.trial_ends_at))
    if (trialEnd <= today) {
      return { blocked: true, isSubscription: false, inGrace: false, graceDaysLeft: 0 }
    }
  }
  return none
}

/**
 * Flujo de pago compartido entre el paywall (TrialExpiredGuard) y el
 * GraceBanner: genera el link via /api/create-payment y redirige a MP.
 */
export function useSubscriptionPayment() {
  const [payment, setPayment] = useState<PaymentLink | null>(null)
  const [payLoading, setPayLoading] = useState(false)
  const [payError, setPayError] = useState<string | null>(null)

  const requestPayment = useCallback(async (): Promise<PaymentLink | null> => {
    setPayLoading(true)
    setPayError(null)
    try {
      const authHeader = await getAuthHeader()
      const response = await fetch('/api/create-payment', {
        method: 'POST',
        headers: { 'Authorization': authHeader },
      })
      if (!response.ok) throw new Error(`Error ${response.status}`)
      const data = await response.json() as PaymentLink
      setPayment(data)
      return data
    } catch (err) {
      console.error('Error creating payment link:', err)
      setPayError('No se pudo generar el link de pago. Intentá de nuevo o contactanos.')
      return null
    } finally {
      setPayLoading(false)
    }
  }, [])

  const handlePay = useCallback(async () => {
    if (payLoading) return
    const link = payment ?? await requestPayment()
    if (link) window.location.href = link.init_point
  }, [payment, payLoading, requestPayment])

  return { payment, payLoading, payError, requestPayment, handlePay }
}
