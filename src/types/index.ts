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
}

export type ServiceLog = {
  id: string
  tenant_id: string
  barber_id: string
  service_id: string
  price_charged: number
  barber_earning: number
  owner_earning: number
  service_number_today: number
  started_at: string
  ended_at: string | null
  status: string
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