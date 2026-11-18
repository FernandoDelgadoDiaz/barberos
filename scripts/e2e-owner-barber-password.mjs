// E2E: the owner sets a new password for a barber who forgot it, from Barberos →
// ⋯ → Editar. Real build, Supabase and /api intercepted, phone viewport.
//   node scripts/e2e-owner-barber-password.mjs dist-e2e
import assert from 'node:assert/strict'
import { readFileSync, existsSync } from 'node:fs'
import { join, extname, resolve } from 'node:path'
import { chromium } from 'playwright-core'

const DIST = resolve(process.argv[2] || 'dist-e2e')
assert.ok(existsSync(join(DIST, 'index.html')), `Missing build at ${DIST}`)
const MIME = { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.svg': 'image/svg+xml', '.png': 'image/png', '.webmanifest': 'application/manifest+json' }
const TENANT = { id: 't1', name: 'Barbería E2E', is_active: true, is_exempt_trial: true, commission_rules: { resets_daily: true, rules: [] } }
const OWNER = { id: 'owner-1', user_id: 'user-owner', tenant_id: 't1', role: 'owner', display_name: 'Gus', works_as_barber: false, is_active: true, earning_mode: 'tenant_rules' }
const BARBER = { id: 'b0000000-0000-4000-8000-000000000001', user_id: 'user-barber', tenant_id: 't1', role: 'barber', display_name: 'Pollo', works_as_barber: true, is_active: true, earning_mode: 'tenant_rules' }

const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : { channel: 'chrome' })

async function open({ apiStatus = 200 } = {}) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, baseURL: 'http://app.test' })
  const now = Math.floor(Date.now() / 1000)
  const user = { id: 'user-owner', aud: 'authenticated', role: 'authenticated', email: 'gus@e2e.test', app_metadata: {}, user_metadata: {}, created_at: new Date().toISOString() }
  const session = { access_token: 'e2e.' + Buffer.from(JSON.stringify({ sub: 'user-owner', exp: now + 3000 })).toString('base64url') + '.sig', token_type: 'bearer', expires_in: 3000, expires_at: now + 3000, refresh_token: 'r', user }
  await context.addInitScript(s => localStorage.setItem('barberos-auth-token', s), JSON.stringify(session))
  const calls = { password: [], profileUpdates: [] }
  await context.route('**/*', async route => {
    const req = route.request()
    const url = new URL(req.url())
    if (url.host === 'app.test' && url.pathname === '/api/set-barber-password') {
      calls.password.push(JSON.parse(req.postData() || '{}'))
      return apiStatus === 200
        ? route.fulfill({ json: { success: true, email: 'pollo@barberia.test' } })
        : route.fulfill({ status: apiStatus, json: { error: 'Barbero no encontrado en tu barbería' } })
    }
    if (url.host === 'app.test') {
      let file = join(DIST, url.pathname)
      if (!extname(url.pathname) || !existsSync(file)) file = join(DIST, 'index.html')
      return route.fulfill({ body: readFileSync(file), headers: { 'content-type': MIME[extname(file)] || 'application/octet-stream' } })
    }
    if (url.host !== 'e2e.supabase.test') return route.fulfill({ status: 204, body: '' })
    if (url.pathname.startsWith('/auth/')) return route.fulfill({ json: user })
    const table = url.pathname.slice('/rest/v1/'.length)
    if (req.method() === 'PATCH' && table === 'profiles') {
      calls.profileUpdates.push(JSON.parse(req.postData() || '{}'))
      return route.fulfill({ status: 204, body: '' })
    }
    let rows = { tenants: [TENANT] }[table] || []
    if (table === 'profiles') rows = url.searchParams.get('user_id') ? [OWNER] : [OWNER, BARBER]
    if (req.method() === 'HEAD') return route.fulfill({ status: 200, headers: { 'content-range': `*/${rows.length}` }, body: '' })
    if ((req.headers().accept || '').includes('vnd.pgrst.object')) return rows.length ? route.fulfill({ json: rows[0] }) : route.fulfill({ status: 406, json: {} })
    return route.fulfill({ json: rows })
  })
  const page = await context.newPage()
  await page.goto('/owner/barbers')
  await page.getByText('Pollo').first().waitFor({ timeout: 15000 })
  return { page, calls, close: () => context.close() }
}

async function editPollo(page) {
  await page.getByRole('button', { name: 'Editar a Pollo' }).tap()
  await page.getByTestId('barber-new-password').waitFor()
}

let failures = 0
async function scenario(name, opts, fn) {
  const ctx = await open(opts)
  try { await fn(ctx); console.log(`  ✓ ${name}`) } catch (err) { failures++; console.error(`  ✗ ${name}\n    ${err.message}`) } finally { await ctx.close() }
}

await scenario('El dueño le pone una contraseña nueva a un barbero y ve con qué email entra', {}, async ({ page, calls }) => {
  await editPollo(page)
  await page.getByTestId('barber-new-password').fill('Nueva2026')
  await page.getByRole('button', { name: 'Guardar cambios' }).tap()
  await page.getByTestId('barber-action-notice').waitFor({ timeout: 10000 })
  assert.deepEqual(calls.password, [{ barber_id: BARBER.id, password: 'Nueva2026' }])
  assert.match(await page.getByTestId('barber-action-notice').innerText(), /pollo@barberia\.test/)
  assert.equal(calls.profileUpdates.length, 1, 'the name is still saved')
})

await scenario('Editar sin escribir contraseña no la cambia', {}, async ({ page, calls }) => {
  await editPollo(page)
  await page.getByRole('button', { name: 'Guardar cambios' }).tap()
  await page.getByTestId('barber-new-password').waitFor({ state: 'detached', timeout: 10000 })
  assert.equal(calls.password.length, 0)
  assert.equal(calls.profileUpdates.length, 1)
  assert.equal(await page.getByTestId('barber-action-notice').count(), 0)
})

await scenario('Contraseña demasiado corta: avisa y no llama al servidor', {}, async ({ page, calls }) => {
  await editPollo(page)
  await page.getByTestId('barber-new-password').fill('123')
  await page.getByRole('button', { name: 'Guardar cambios' }).tap()
  await page.getByText(/al menos 6 caracteres/).waitFor({ timeout: 5000 })
  assert.equal(calls.password.length, 0)
  assert.equal(calls.profileUpdates.length, 0)
})

await scenario('Si el servidor rechaza, muestra el error, no guarda nada y deja reintentar', { apiStatus: 404 }, async ({ page, calls }) => {
  await editPollo(page)
  await page.getByTestId('barber-new-password').fill('Nueva2026')
  await page.getByRole('button', { name: 'Guardar cambios' }).tap()
  await page.getByText('Barbero no encontrado en tu barbería').waitFor({ timeout: 5000 })
  assert.equal(calls.password.length, 1)
  assert.equal(calls.profileUpdates.length, 0)
  assert.equal(await page.getByTestId('barber-new-password').count(), 1, 'modal stays open')
})

await browser.close()
if (failures) { console.error(`E2E owner barber password: ${failures} failure(s)`); process.exit(1) }
console.log('E2E owner barber password: all scenarios passed')
