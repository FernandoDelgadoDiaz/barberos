// Behavioural tests of the REAL netlify/functions/log-service.ts handler against an
// in-memory Supabase (scripts/support/supabase-memory.mjs). No network, no real data.
// Run: node --import ./scripts/support/supabase-memory-loader.mjs scripts/test-log-service-handler.mjs
import assert from 'node:assert/strict'
import { buildAttentionPayload } from '../src/utils/barberCheckout.ts'

process.env.SUPABASE_URL = 'http://memory.local'
process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-test'
const { db, resetDb } = await import('./support/supabase-memory.mjs')
const { handler } = await import('../netlify/functions/log-service.ts')

const TENANT = '11111111-1111-4111-8111-111111111111'
const OTHER_TENANT = '22222222-2222-4222-8222-222222222222'
const BARBER = 'b0000000-0000-4000-8000-000000000001'
const OWNER = 'b0000000-0000-4000-8000-000000000002'
const SHIFT = 'c0000000-0000-4000-8000-000000000001'
const OWNER_SHIFT = 'c0000000-0000-4000-8000-000000000002'
const P = {
  corte: { id: 'a0000000-0000-4000-8000-000000000001', name: 'Corte', base_price: 20000, category: 'servicio' },
  barba: { id: 'a0000000-0000-4000-8000-000000000002', name: 'Barba', base_price: 7000, category: 'servicio' },
  cera: { id: 'a0000000-0000-4000-8000-000000000003', name: 'Cera', base_price: 15000, category: 'producto' },
  coca: { id: 'a0000000-0000-4000-8000-000000000004', name: 'Coca lata', base_price: 2000, category: 'producto' },
  ajeno: { id: 'a0000000-0000-4000-8000-000000000005', name: 'Cera ajena', base_price: 1, category: 'producto' },
}
// Tiered rules as configured for a real tenant: 1-3 → 50/50, 4th → 100% barber, 5+ → 50/50.
const RULES = { resets_daily: true, rules: [
  { from_service: 1, to_service: 3, barber_pct: 50, owner_pct: 50 },
  { from_service: 4, to_service: 4, barber_pct: 100, owner_pct: 0 },
  { from_service: 5, to_service: null, barber_pct: 50, owner_pct: 50 },
] }
const seed = {
  users: { 'tok-barber': { id: 'user-barber' }, 'tok-owner': { id: 'user-owner' } },
  tables: {
    profiles: [
      { id: BARBER, user_id: 'user-barber', tenant_id: TENANT, role: 'barber', works_as_barber: false, earning_mode: 'tenant_rules', is_active: true },
      { id: OWNER, user_id: 'user-owner', tenant_id: TENANT, role: 'owner', works_as_barber: true, earning_mode: 'owner_100', is_active: true },
    ],
    tenants: [{ id: TENANT, is_active: true, commission_rules: RULES }],
    shifts: [
      { id: SHIFT, tenant_id: TENANT, barber_id: BARBER, status: 'open' },
      { id: OWNER_SHIFT, tenant_id: TENANT, barber_id: OWNER, status: 'open' },
    ],
    services_catalog: [
      ...[P.corte, P.barba, P.cera, P.coca].map(p => ({ ...p, tenant_id: TENANT })),
      { ...P.ajeno, tenant_id: OTHER_TENANT },
    ],
    appointments: [], service_logs: [], product_sales: [],
  },
}

// Same builder the Dashboard uses, so the client payload is part of what is tested.
function payload({ services = [], products = [], qty = {}, pay = 'efectivo', tip = '', tipPay = pay, othersPay = pay, barber = BARBER, shift = SHIFT }) {
  return buildAttentionPayload({
    barberId: barber, tenantId: TENANT, shiftId: shift,
    services, products, productQty: qty,
    paymentMethod: pay, tipRaw: tip, tipPaymentMethod: tipPay, othersPaymentMethod: othersPay,
    startedAt: new Date().toISOString(),
  })
}
async function post(body, token = 'tok-barber') {
  const res = await handler({ httpMethod: 'POST', headers: { authorization: `Bearer ${token}` }, body: JSON.stringify(body) })
  return { status: res.statusCode, body: JSON.parse(res.body || '{}') }
}
const appts = () => db.tables.appointments
const logs = () => db.tables.service_logs
const sales = () => db.tables.product_sales
const last = arr => arr[arr.length - 1]
const logsOf = appt => logs().filter(l => l.appointment_id === appt.id)
const scenario = async (name, fn) => { resetDb(seed); await fn(); console.log(`  ✓ ${name}`) }

await scenario('Un corte sin productos', async () => {
  const r = await post(payload({ services: [P.corte] }))
  assert.equal(r.status, 200, JSON.stringify(r.body))
  const a = last(appts())
  assert.deepEqual([a.total_price, a.total_barber_earning, a.total_owner_earning, a.attention_number], [20000, 10000, 10000, 1])
  assert.equal(sales().length, 0)
  assert.deepEqual(logsOf(a).map(l => [l.service_id, l.price_charged, l.others_amount, l.service_number_today]), [[P.corte.id, 20000, 0, 1]])
})

await scenario('Corte + barba sin productos', async () => {
  const r = await post(payload({ services: [P.corte, P.barba] }))
  assert.equal(r.status, 200)
  const a = last(appts())
  assert.deepEqual([a.total_price, a.total_barber_earning, a.total_owner_earning], [27000, 13500, 13500])
  assert.deepEqual(logsOf(a).map(l => l.service_number_today), [1, 2])
  const sum = logsOf(a).reduce((s, l) => s + l.barber_earning + l.owner_earning, 0)
  assert.equal(sum, 27000)
})

await scenario('Servicio con propina, sin productos (propina 100% barbero)', async () => {
  const r = await post(payload({ services: [P.corte], tip: '3000' }))
  assert.equal(r.status, 200)
  const a = last(appts())
  assert.deepEqual([a.total_barber_earning, a.total_owner_earning], [13000, 10000])
  assert.equal(logsOf(a)[0].tip_amount, 3000)
})

await scenario('Servicio sin propina ni productos', async () => {
  const r = await post(payload({ services: [P.barba], tip: '' }))
  assert.equal(r.status, 200)
  const l = logsOf(last(appts()))[0]
  assert.deepEqual([l.tip_amount, l.others_amount, l.barber_earning, l.owner_earning], [0, 0, 3500, 3500])
})

await scenario('Servicio con uno o más productos (precio del catálogo, 100% dueño)', async () => {
  const body = payload({ services: [P.corte], products: [P.cera, P.coca], qty: { [P.cera.id]: 2 } })
  body.products[0].unit_price = 1 // un cliente adulterado no puede bajar el precio
  const r = await post(body)
  assert.equal(r.status, 200)
  const a = last(appts())
  assert.deepEqual([a.total_price, a.total_barber_earning, a.total_owner_earning], [20000, 10000, 10000 + 32000])
  assert.deepEqual(sales().map(s => [s.product_id, s.quantity, s.line_total]), [[P.cera.id, 2, 30000], [P.coca.id, 1, 2000]])
})

await scenario('Venta exclusivamente de productos (no avanza el tramo)', async () => {
  const r = await post(payload({ products: [P.coca] }))
  assert.equal(r.status, 200)
  const a = last(appts())
  assert.deepEqual([a.total_price, a.total_barber_earning, a.total_owner_earning], [0, 0, 2000])
  assert.deepEqual(logsOf(a).map(l => [l.service_id, l.price_charged, l.service_number_today]), [[null, 0, 0]])
})

await scenario('Ningún servicio ni producto → se impide sin escribir nada', async () => {
  const r = await post(payload({}))
  assert.equal(r.status, 400)
  assert.equal(appts().length + logs().length + sales().length, 0)
})

await scenario('Pago por transferencia', async () => {
  const r = await post(payload({ services: [P.corte], pay: 'transferencia' }))
  assert.equal(r.status, 200)
  assert.equal(logsOf(last(appts()))[0].payment_method, 'transferencia')
})

await scenario('Servicio, propina y productos con distintos medios de pago', async () => {
  const r = await post(payload({ services: [P.corte], products: [P.coca], pay: 'transferencia', tip: '1000', tipPay: 'efectivo', othersPay: 'efectivo' }))
  assert.equal(r.status, 200)
  const l = logsOf(last(appts()))[0]
  assert.deepEqual([l.payment_method, l.tip_payment_method, l.others_payment_method], ['transferencia', 'efectivo', 'efectivo'])
  assert.equal(last(sales()).payment_method, 'efectivo')
})

await scenario('Tramos: 1-3 50/50, 4ª 100% barbero, 5ª 50/50; la venta suelta no cuenta', async () => {
  const split = []
  for (let i = 1; i <= 5; i++) {
    if (i === 3) assert.equal((await post(payload({ products: [P.coca] }))).status, 200)
    const r = await post(payload({ services: [P.corte] }))
    assert.equal(r.status, 200)
    split.push([r.body.total_barber_earning, r.body.total_owner_earning])
  }
  assert.deepEqual(split, [[10000, 10000], [10000, 10000], [10000, 10000], [20000, 0], [10000, 10000]])
  // attention_number es correlativo e incluye la venta suelta; service_number_today no.
  assert.deepEqual(appts().map(a => a.attention_number), [1, 2, 3, 4, 5, 6])
  assert.deepEqual(logs().filter(l => l.price_charged > 0).map(l => l.service_number_today), [1, 2, 3, 4, 5])
})

await scenario('Dueño que trabaja como barbero (owner_100) cobra el 100% del servicio', async () => {
  const r = await post(payload({ services: [P.corte], barber: OWNER, shift: OWNER_SHIFT, tip: '500', products: [P.coca] }), 'tok-owner')
  assert.equal(r.status, 200)
  assert.deepEqual([r.body.total_barber_earning, r.body.total_owner_earning], [20500, 2000])
})

await scenario('Propina negativa se rechaza (no descuenta al barbero)', async () => {
  const body = payload({ services: [P.corte] })
  body.tip_amount = -5000
  assert.equal((await post(body)).status, 400)
  assert.equal(appts().length, 0)
  assert.equal(payload({ services: [P.corte], tip: '-5000' }).tip_amount, 0, 'el cliente nunca manda negativos')
})

await scenario('Producto de otro tenant se rechaza', async () => {
  const r = await post(payload({ services: [P.corte], products: [P.ajeno] }))
  assert.equal(r.status, 400)
  assert.equal(appts().length, 0)
})

await scenario('Fallo del servidor al guardar productos → 500 y rollback completo', async () => {
  db.failInsertOn = 'product_sales'
  const r = await post(payload({ services: [P.corte], products: [P.cera] }))
  assert.equal(r.status, 500)
  assert.ok(r.body.error)
  assert.equal(appts().length + logs().length, 0, 'no quedan registros a medias')
  db.failInsertOn = null
  const retry = await post(payload({ services: [P.corte], products: [P.cera] }))
  assert.equal(retry.status, 200, 'el reintento registra normalmente')
  assert.equal(last(appts()).attention_number, 1)
})

console.log('log-service handler: all checkout scenarios passed')
