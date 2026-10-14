import type { ServiceCatalog } from '../types'

type ServicePricing = Pick<ServiceCatalog, 'category' | 'is_active' | 'base_price'>

/**
 * Count and average only active services, not products or archived services.
 * Returns null when there is no valid active service instead of implying $0.
 * This function is presentation-only and doesn't alter catalog or billing data.
 */
export function summarizeActiveServices(catalog: readonly ServicePricing[]): {
  activeCount: number
  avgPrice: number | null
} {
  const activeServices = catalog.filter(
    item => item.category === 'servicio' && item.is_active,
  )
  const activeCount = activeServices.length
  if (activeCount === 0) return { activeCount: 0, avgPrice: null }

  const sum = activeServices.reduce((total, item) => total + item.base_price, 0)
  return { activeCount, avgPrice: Math.round(sum / activeCount) }
}
