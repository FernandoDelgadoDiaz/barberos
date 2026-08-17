export type UserRole = 'superadmin' | 'owner' | 'barber'

export type CommissionRule = {
  from_service: number
  to_service: number | null
  barber_pct: number
  owner_pct: number
}

export type CommissionRules = {
  rules: CommissionRule[]
  resets_daily: boolean
}

export type Tenant = {
  id: string
  slug: string
  name: string
  logo_url: string | null
  primary_color: string
  secondary_color: string
  commission_rules: CommissionRules
  is_active: boolean
  opening_time?: string
  closing_time?: string
  created_at: string
  contact_phone?: string | null
  trial_days?: number | null
  trial_ends_at?: string | null
  is_exempt_trial?: boolean
  subscription_status?: 'trial' | 'active' | 'grace_period' | 'suspended'
  subscription_ends_at?: string | null
  grace_days?: number
  last_payment_at?: string | null
  last_payment_id?: string | null
}

export type Profile = {
  id: string
  tenant_id: string
  user_id: string
  role: UserRole
  display_name: string
  is_active: boolean | null
  created_at: string
}

export type ServiceCatalog = {
  id: string
  tenant_id: string
  name: string
  base_price: number
  duration_min: number
  is_active: boolean
  category: 'servicio' | 'producto'
}

export type ServiceLog = {
  id: string
  tenant_id: string
  barber_id: string
  // null en una fila portadora: venta de productos sin servicio (ver isRealService)
  service_id: string | null
  price_charged: number
  barber_earning: number
  owner_earning: number
  service_number_today: number
  appointment_id?: string | null  // Nueva referencia a appointment
  started_at: string
  ended_at: string | null
  status: string
  shift_id?: string | null
  payment_method?: 'efectivo' | 'transferencia'
  tip_amount?: number
  tip_payment_method?: 'efectivo' | 'transferencia'
  others_amount?: number
  others_payment_method?: 'efectivo' | 'transferencia'
  created_at: string
}

/**
 * Una venta de productos sin ningún servicio se guarda igual en service_logs, como
 * una única "fila portadora": service_id null, price_charged 0 y el importe de los
 * productos en others_amount / owner_earning. Se hace así para que la plata siga
 * fluyendo por las mismas lecturas que todo el resto (panel en vivo, historial,
 * cierre de caja, métricas), que leen service_logs y no appointments.
 *
 * Consecuencia: al CONTAR servicios hay que excluir esas filas, porque no son un
 * servicio. Al SUMAR plata hay que incluirlas. Un servicio real siempre tiene
 * price_charged > 0 (la Function lo valida), así que ese es el discriminador.
 */
export function isRealService(log: { price_charged: number }): boolean {
  return log.price_charged > 0
}

export type ProductSale = {
  id: string
  tenant_id: string
  appointment_id: string | null
  barber_id: string | null
  product_id: string | null
  product_name: string
  unit_price: number
  quantity: number
  line_total: number
  payment_method: 'efectivo' | 'transferencia'
  sold_at: string
  created_at: string
}

export type DailySummary = {
  id: string
  tenant_id: string
  barber_id: string
  summary_date: string
  total_services: number
  total_revenue: number
  barber_earnings: number
  owner_earnings: number
}

export type Shift = {
  id: string
  tenant_id: string
  barber_id: string
  started_at: string
  closed_at: string | null
  paused_at?: string | null
  status: 'open' | 'paused' | 'closed'
  total_services: number
  total_revenue: number
  barber_earnings: number
  owner_earnings: number
  created_at?: string
  updated_at?: string | null
}

export type Appointment = {
  id: string
  tenant_id: string
  barber_id: string
  shift_id: string | null
  attention_number: number
  total_price: number
  total_barber_earning: number
  total_owner_earning: number
  started_at: string
  ended_at: string | null
  status: string
  created_at: string
  updated_at: string | null
}

export interface ServiceItem {
  service_id: string
  price_charged: number
}

export interface LogServiceRequest {
  barber_id: string
  services: ServiceItem[]
  started_at: string
  ended_at?: string
  shift_id?: string
  tip_amount?: number
  tip_payment_method?: 'efectivo' | 'transferencia'
  others_amount?: number
  others_payment_method?: 'efectivo' | 'transferencia'
}

export interface LogServiceResponse {
  appointment: Appointment
  service_logs: ServiceLog[]
}

export interface DailyExpense {
  id: string
  tenant_id: string
  owner_id: string
  amount: number
  description: string
  expense_date: string
  created_at: string
}
