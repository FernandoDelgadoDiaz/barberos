import assert from 'node:assert/strict'

function applyCommission(rules, serviceNumber, price) {
  const rule = rules.find(r =>
    serviceNumber >= r.from_service &&
    (r.to_service === null || serviceNumber <= r.to_service)
  )
  if (!rule) return { barber: price, owner: 0 }
  return {
    barber: (price * rule.barber_pct) / 100,
    owner: (price * rule.owner_pct) / 100,
  }
}

function allocate({ rules, serviceNumber, price, earningMode = 'tenant_rules', tip = 0, products = 0 }) {
  const tenant = applyCommission(rules, serviceNumber, price)
  const barberBase = earningMode === 'owner_100' ? price : tenant.barber
  const ownerBase = earningMode === 'owner_100' ? 0 : tenant.owner
  return { barber: barberBase + tip, owner: ownerBase + products }
}

const fixed50 = [{ from_service: 1, to_service: null, barber_pct: 50, owner_pct: 50 }]
const fixed70 = [{ from_service: 1, to_service: null, barber_pct: 70, owner_pct: 30 }]
const stepped = [
  { from_service: 1, to_service: 1, barber_pct: 100, owner_pct: 0 },
  { from_service: 2, to_service: null, barber_pct: 50, owner_pct: 50 },
]

assert.deepEqual(allocate({ rules: fixed50, serviceNumber: 1, price: 20000 }), { barber: 10000, owner: 10000 })
assert.deepEqual(allocate({ rules: fixed70, serviceNumber: 1, price: 20000 }), { barber: 14000, owner: 6000 })
assert.deepEqual(allocate({ rules: stepped, serviceNumber: 1, price: 20000 }), { barber: 20000, owner: 0 })
assert.deepEqual(allocate({ rules: stepped, serviceNumber: 2, price: 20000 }), { barber: 10000, owner: 10000 })
assert.deepEqual(allocate({ rules: fixed50, serviceNumber: 9, price: 20000, earningMode: 'owner_100' }), { barber: 20000, owner: 0 })
assert.deepEqual(allocate({ rules: fixed50, serviceNumber: 2, price: 20000, tip: 3000 }), { barber: 13000, owner: 10000 })
assert.deepEqual(allocate({ rules: fixed50, serviceNumber: 2, price: 20000, products: 5000 }), { barber: 10000, owner: 15000 })
assert.deepEqual(allocate({ rules: fixed50, serviceNumber: 9, price: 20000, earningMode: 'owner_100', tip: 3000, products: 5000 }), { barber: 23000, owner: 5000 })

for (const scenario of [
  { rules: fixed50, serviceNumber: 1, price: 20000, tip: 0, products: 0 },
  { rules: fixed70, serviceNumber: 1, price: 20000, tip: 0, products: 0 },
  { rules: stepped, serviceNumber: 1, price: 20000, tip: 0, products: 0 },
  { rules: stepped, serviceNumber: 2, price: 20000, tip: 0, products: 0 },
  { rules: fixed50, serviceNumber: 9, price: 20000, earningMode: 'owner_100', tip: 3000, products: 5000 },
]) {
  const out = allocate(scenario)
  assert.equal(out.barber + out.owner, scenario.price + scenario.tip + scenario.products)
}

console.log('Economic scenarios: OK')
