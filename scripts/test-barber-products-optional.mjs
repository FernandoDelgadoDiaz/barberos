// Behaviour of the checkout wizard rules (src/utils/barberCheckout.ts), the same
// functions the barber Dashboard runs. Products are optional when a service exists.
import assert from 'node:assert/strict'
import {
  buildAttentionPayload, canSubmitAttention, getProductsStepAction, getServicesStepAction, sanitizeTip,
} from '../src/utils/barberCheckout.ts'

const corte = { id: 's1', name: 'Corte', base_price: 20000 }
const barba = { id: 's2', name: 'Barba', base_price: 7000 }
const cera = { id: 'p1', name: 'Cera', base_price: 15000 }
const coca = { id: 'p2', name: 'Coca', base_price: 2000 }
const base = { barberId: 'b', tenantId: 't', shiftId: 'sh', productQty: {}, paymentMethod: 'efectivo', tipRaw: '', tipPaymentMethod: 'efectivo', othersPaymentMethod: 'efectivo', startedAt: '2026-10-16T18:00:00.000Z' }
const build = over => buildAttentionPayload({ ...base, services: [], products: [], ...over })

// Step 1: continuing without a service is an explicit, different action.
assert.equal(getServicesStepAction(1), 'continue-with-services')
assert.equal(getServicesStepAction(2), 'continue-with-services')
assert.equal(getServicesStepAction(0), 'products-only')

// Step 4: never requires a product when there is a service.
const cases = [
  ['Un corte sin productos', 1, 0, 'skip-products', true],
  ['Corte + barba sin productos', 2, 0, 'skip-products', true],
  ['Servicio con productos', 1, 2, 'continue-with-products', true],
  ['Solo productos', 0, 1, 'continue-with-products', true],
  ['Nada seleccionado', 0, 0, 'needs-selection', false],
]
for (const [name, s, p, action, submit] of cases) {
  assert.equal(getProductsStepAction(s, p), action, name)
  assert.equal(canSubmitAttention(s, p), submit, name)
}

// Tip is optional and never negative.
assert.equal(sanitizeTip(''), 0)
assert.equal(sanitizeTip('abc'), 0)
assert.equal(sanitizeTip('-500'), 0)
assert.equal(sanitizeTip('1500'), 1500)
assert.equal(sanitizeTip('1500,5'), 1500.5)

// Payload: service only, no tip, no products.
let body = build({ services: [corte] })
assert.deepEqual(body.services, [{ service_id: 's1', price_charged: 20000 }])
assert.deepEqual(body.products, [])
assert.equal(body.others_amount, 0)
assert.equal(body.tip_amount, 0)

// Payload: two services + tip + products, each with its own payment method.
body = build({ services: [corte, barba], products: [cera, coca], productQty: { p1: 2 }, paymentMethod: 'transferencia', tipRaw: '3000', tipPaymentMethod: 'efectivo', othersPaymentMethod: 'efectivo' })
assert.equal(body.services.length, 2)
assert.deepEqual(body.products.map(p => [p.product_id, p.quantity, p.line_total]), [['p1', 2, 30000], ['p2', 1, 2000]])
assert.equal(body.others_amount, 32000)
assert.deepEqual([body.payment_method, body.tip_payment_method, body.others_payment_method, body.tip_amount], ['transferencia', 'efectivo', 'efectivo', 3000])

// Payload: product-only sale.
body = build({ products: [coca] })
assert.deepEqual(body.services, [])
assert.equal(body.others_amount, 2000)

console.log('Checkout with and without products: behaviour checks passed')
