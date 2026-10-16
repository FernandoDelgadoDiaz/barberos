/**
 * Pure rules of the barber checkout wizard (Servicios → Pago → Propina →
 * Productos → Confirmar). Kept free of React so the regression tests exercise
 * the exact code the Dashboard runs.
 *
 * Commissions are NOT computed here: they live only in log-service. This module
 * decides which action the barber can take and builds the request body.
 */

export type PaymentMethod = 'efectivo' | 'transferencia'

/** An attention needs at least one service or one product. Nothing else. */
export function canSubmitAttention(services: number, products: number): boolean {
  return services > 0 || products > 0
}

/**
 * Step 1. Continuing without a service is legitimate (product-only sale), but it
 * must be an explicit, differently-labelled choice: a generic "Siguiente" let a
 * missed tap on the service row reach the products step with nothing selected,
 * where the only way forward was selling a product.
 */
export function getServicesStepAction(services: number): 'continue-with-services' | 'products-only' {
  return services > 0 ? 'continue-with-services' : 'products-only'
}

/**
 * Step 4. Products are optional whenever a service was selected; a
 * product-only sale needs at least one product.
 */
export function getProductsStepAction(services: number, products: number): 'continue-with-products' | 'skip-products' | 'needs-selection' {
  if (products > 0) return 'continue-with-products'
  if (services > 0) return 'skip-products'
  return 'needs-selection'
}

/** Tip typed by the barber → non-negative finite amount (empty, invalid or negative → 0). */
export function sanitizeTip(raw: string): number {
  const value = parseFloat(raw.replace(',', '.'))
  return Number.isFinite(value) && value > 0 ? value : 0
}

export interface CheckoutItem {
  id: string
  name: string
  base_price: number
}

export interface AttentionPayloadInput {
  barberId: string
  tenantId: string
  shiftId: string | null
  services: CheckoutItem[]
  products: CheckoutItem[]
  productQty: Record<string, number>
  paymentMethod: PaymentMethod
  tipRaw: string
  tipPaymentMethod: PaymentMethod
  othersPaymentMethod: PaymentMethod
  startedAt: string
}

export function buildAttentionPayload(input: AttentionPayloadInput) {
  const products = input.products.map(p => {
    const quantity = input.productQty[p.id] || 1
    return {
      product_id: p.id,
      product_name: p.name,
      unit_price: p.base_price,
      quantity,
      line_total: p.base_price * quantity,
    }
  })
  return {
    barber_id: input.barberId,
    tenant_id: input.tenantId,
    services: input.services.map(s => ({ service_id: s.id, price_charged: s.base_price })),
    started_at: input.startedAt,
    shift_id: input.shiftId,
    payment_method: input.paymentMethod,
    tip_amount: sanitizeTip(input.tipRaw),
    tip_payment_method: input.tipPaymentMethod,
    others_amount: products.reduce((sum, p) => sum + p.line_total, 0),
    others_payment_method: input.othersPaymentMethod,
    products,
  }
}
