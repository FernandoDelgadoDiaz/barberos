// Behavioural tests of the REAL netlify/functions/set-barber-password.ts handler
// against an in-memory Supabase. No network, no real data.
// Run: node --import ./scripts/support/supabase-memory-loader.mjs scripts/test-set-barber-password.mjs
import assert from 'node:assert/strict'

process.env.SUPABASE_URL = 'http://memory.local'
process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-test'
const { db, resetDb } = await import('./support/supabase-memory.mjs')
const { handler } = await import('../netlify/functions/set-barber-password.ts')

const TENANT = '11111111-1111-4111-8111-111111111111'
const OTHER_TENANT = '22222222-2222-4222-8222-222222222222'
const BARBER = 'b0000000-0000-4000-8000-000000000001'
const OWNER = 'b0000000-0000-4000-8000-000000000002'
const OTHER_BARBER = 'b0000000-0000-4000-8000-000000000003'
const CO_OWNER = 'b0000000-0000-4000-8000-000000000004'
const seed = {
  users: { 'tok-owner': { id: 'user-owner' }, 'tok-barber': { id: 'user-barber' }, 'tok-other-owner': { id: 'user-other-owner' } },
  authUsers: {
    'user-barber': { email: 'pollo@barberia.test' },
    'user-other-barber': { email: 'ajeno@otra.test' },
    'user-co-owner': { email: 'socio@barberia.test' },
  },
  tables: {
    profiles: [
      { id: BARBER, user_id: 'user-barber', tenant_id: TENANT, role: 'barber' },
      { id: OWNER, user_id: 'user-owner', tenant_id: TENANT, role: 'owner' },
      { id: CO_OWNER, user_id: 'user-co-owner', tenant_id: TENANT, role: 'owner' },
      { id: OTHER_BARBER, user_id: 'user-other-barber', tenant_id: OTHER_TENANT, role: 'barber' },
      { id: 'b0000000-0000-4000-8000-000000000005', user_id: 'user-other-owner', tenant_id: OTHER_TENANT, role: 'owner' },
    ],
  },
}

async function post(body, token = 'tok-owner', method = 'POST') {
  const res = await handler({ httpMethod: method, body: JSON.stringify(body), headers: token ? { authorization: `Bearer ${token}` } : {} })
  return { status: res.statusCode, body: res.body ? JSON.parse(res.body) : null }
}

let n = 0
async function t(name, fn) { resetDb(seed); await fn(); n++; console.log(`  ✓ ${name}`) }

await t('El dueño cambia la contraseña de un barbero de su barbería y recibe su email', async () => {
  const r = await post({ barber_id: BARBER, password: 'Nueva2026' })
  assert.equal(r.status, 200)
  assert.equal(r.body.email, 'pollo@barberia.test')
  assert.deepEqual(db.passwordUpdates, [{ id: 'user-barber', password: 'Nueva2026' }])
})
await t('Recorta espacios accidentales al principio y al final', async () => {
  const r = await post({ barber_id: BARBER, password: '  Nueva2026 ' })
  assert.equal(r.status, 200)
  assert.equal(db.passwordUpdates[0].password, 'Nueva2026')
})
await t('Un barbero de otra barbería: 404 y no se toca nada', async () => {
  const r = await post({ barber_id: OTHER_BARBER, password: 'Nueva2026' })
  assert.equal(r.status, 404)
  assert.equal(db.passwordUpdates.length, 0)
})
await t('Otro dueño (no barbero): 404, el dueño solo resetea barberos', async () => {
  const r = await post({ barber_id: CO_OWNER, password: 'Nueva2026' })
  assert.equal(r.status, 404)
  assert.equal(db.passwordUpdates.length, 0)
})
await t('Un barbero no puede cambiar contraseñas: 403', async () => {
  const r = await post({ barber_id: BARBER, password: 'Nueva2026' }, 'tok-barber')
  assert.equal(r.status, 403)
  assert.equal(db.passwordUpdates.length, 0)
})
await t('El dueño de otro tenant no alcanza barberos ajenos: 404', async () => {
  const r = await post({ barber_id: BARBER, password: 'Nueva2026' }, 'tok-other-owner')
  assert.equal(r.status, 404)
  assert.equal(db.passwordUpdates.length, 0)
})
await t('Sin sesión o con token inválido: 401', async () => {
  assert.equal((await post({ barber_id: BARBER, password: 'Nueva2026' }, null)).status, 401)
  assert.equal((await post({ barber_id: BARBER, password: 'Nueva2026' }, 'tok-falso')).status, 401)
  assert.equal(db.passwordUpdates.length, 0)
})
await t('Contraseña corta, vacía, no texto o demasiado larga: 400', async () => {
  for (const password of ['12345', '      ', '', 123456, null, 'x'.repeat(73)]) {
    assert.equal((await post({ barber_id: BARBER, password })).status, 400, `password=${JSON.stringify(password)}`)
  }
  assert.equal(db.passwordUpdates.length, 0)
})
await t('barber_id inválido o JSON roto: 400', async () => {
  assert.equal((await post({ barber_id: 'nope', password: 'Nueva2026' })).status, 400)
  const res = await handler({ httpMethod: 'POST', body: '{roto', headers: { authorization: 'Bearer tok-owner' } })
  assert.equal(res.statusCode, 400)
})
await t('Solo acepta POST', async () => {
  assert.equal((await post({}, 'tok-owner', 'GET')).status, 405)
  assert.equal((await post({}, 'tok-owner', 'OPTIONS')).status, 200)
})

console.log(`set-barber-password: ${n} escenarios OK`)
