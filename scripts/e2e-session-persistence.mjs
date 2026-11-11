// E2E: reopening the app from scratch with a stored session (what iOS does when it
// discards the home-screen app in the background) must land in the panel without
// ever showing the login form. Same build as the other E2E scripts:
//   node scripts/e2e-session-persistence.mjs dist-e2e
import assert from 'node:assert/strict'
import { readFileSync, existsSync } from 'node:fs'
import { join, extname, resolve } from 'node:path'
import { chromium } from 'playwright-core'

const DIST = resolve(process.argv[2] || 'dist-e2e')
assert.ok(existsSync(join(DIST, 'index.html')), `Missing build at ${DIST}`)
const MIME = { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.svg': 'image/svg+xml', '.png': 'image/png', '.webmanifest': 'application/manifest+json' }
const TENANT = { id: 't1', name: 'Barbería E2E', is_active: true, is_exempt_trial: true, commission_rules: { resets_daily: true, rules: [] } }
const PROFILE = { id: 'barber-1', user_id: 'user-1', tenant_id: 't1', role: 'barber', works_as_barber: false, is_active: true, earning_mode: 'tenant_rules' }
const LATENCY_MS = 1500 // a slow shop network makes the old login-form flash obvious

const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : { channel: 'chrome' })

async function open({ withSession, profileFails = () => false }) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, baseURL: 'http://app.test' })
  const now = Math.floor(Date.now() / 1000)
  const user = { id: 'user-1', aud: 'authenticated', role: 'authenticated', email: 'b@e2e.test', app_metadata: {}, user_metadata: {}, created_at: new Date().toISOString() }
  if (withSession) {
    const session = { access_token: 'e2e.' + Buffer.from(JSON.stringify({ sub: 'user-1', exp: now + 3000 })).toString('base64url') + '.sig', token_type: 'bearer', expires_in: 3000, expires_at: now + 3000, refresh_token: 'r', user }
    await context.addInitScript(s => { if (!sessionStorage.getItem('seeded')) { localStorage.setItem('barberos-auth-token', s); sessionStorage.setItem('seeded', '1') } }, JSON.stringify(session))
  }
  await context.route('**/*', async route => {
    const req = route.request()
    const url = new URL(req.url())
    if (url.host === 'app.test') {
      let file = join(DIST, url.pathname)
      if (!extname(url.pathname) || !existsSync(file)) file = join(DIST, 'index.html')
      return route.fulfill({ body: readFileSync(file), headers: { 'content-type': MIME[extname(file)] || 'application/octet-stream' } })
    }
    if (url.host !== 'e2e.supabase.test') return route.fulfill({ status: 204, body: '' })
    await new Promise(r => setTimeout(r, LATENCY_MS))
    if (url.pathname.startsWith('/auth/')) return route.fulfill({ json: user })
    const table = url.pathname.slice('/rest/v1/'.length)
    if (table === 'profiles' && profileFails()) return route.fulfill({ status: 503, json: { message: 'network down' } })
    const rows = { profiles: [PROFILE], tenants: [TENANT], shifts: (url.searchParams.get('status') || '').includes('open') ? [{ id: 'sh', status: 'open', barber_id: 'barber-1', tenant_id: 't1' }] : [] }[table] || []
    if (req.method() === 'HEAD') return route.fulfill({ status: 200, headers: { 'content-range': `*/${rows.length}` }, body: '' })
    if ((req.headers().accept || '').includes('vnd.pgrst.object')) return rows.length ? route.fulfill({ json: rows[0] }) : route.fulfill({ status: 406, json: {} })
    return route.fulfill({ json: rows })
  })
  const page = await context.newPage()
  return { page, close: () => context.close() }
}

// Watches the page until `done` holds, failing if the login form ever appears.
async function untilWithoutLoginForm(page, done, timeoutMs = 10000) {
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    assert.equal(await page.locator('input[type="password"]').count(), 0, `login form shown at ${new URL(page.url()).pathname}`)
    if (await done()) return
    await page.waitForTimeout(100)
  }
  throw new Error(`timed out at ${new URL(page.url()).pathname}`)
}
const inPanel = page => async () => new URL(page.url()).pathname === '/barber/dashboard' && await page.getByRole('button', { name: /Registrar cliente/ }).count() > 0

let failures = 0
async function scenario(name, opts, fn) {
  const ctx = await open(opts)
  try { await fn(ctx.page); console.log(`  ✓ ${name}`) } catch (err) { failures++; console.error(`  ✗ ${name}\n    ${err.message}`) } finally { await ctx.close() }
}

await scenario('Sesión guardada, reabre en el panel: entra sin formulario de login', { withSession: true }, async page => {
  await page.goto('/barber/dashboard')
  await untilWithoutLoginForm(page, inPanel(page))
})

await scenario('Sesión guardada, reabre desde el ícono (/): va directo al panel', { withSession: true }, async page => {
  await page.goto('/')
  await untilWithoutLoginForm(page, inPanel(page))
})

await scenario('Sesión guardada, reabre en /login: va al panel sin pedir la clave', { withSession: true }, async page => {
  await page.goto('/login')
  await untilWithoutLoginForm(page, inPanel(page))
})

await scenario('Recarga varias veces seguidas: sigue adentro', { withSession: true }, async page => {
  await page.goto('/barber/dashboard')
  for (let i = 0; i < 3; i++) {
    await untilWithoutLoginForm(page, inPanel(page))
    await page.reload()
  }
  await untilWithoutLoginForm(page, inPanel(page))
})

let failProfile = true
await scenario('Sin red al reabrir: ofrece Reintentar, conserva la sesión y no pide la clave', { withSession: true, profileFails: () => failProfile }, async page => {
  await page.goto('/barber/dashboard')
  await untilWithoutLoginForm(page, async () => await page.getByTestId('app-splash-retry').count() > 0)
  assert.ok(await page.evaluate(() => !!localStorage.getItem('barberos-auth-token')), 'session kept')
  failProfile = false
  await page.getByTestId('app-splash-retry').tap()
  await untilWithoutLoginForm(page, inPanel(page))
})

await scenario('Sin sesión: "/" muestra la página pública', { withSession: false }, async page => {
  await page.goto('/')
  await page.locator('a[href="/login"]').first().waitFor({ state: 'attached', timeout: 10000 })
  assert.equal(new URL(page.url()).pathname, '/')
})

await scenario('Sin sesión: el panel pide iniciar sesión', { withSession: false }, async page => {
  await page.goto('/barber/dashboard')
  await page.locator('input[type="password"]').waitFor({ timeout: 10000 })
  assert.equal(new URL(page.url()).pathname, '/login')
})

await browser.close()
if (failures) { console.error(`E2E session persistence: ${failures} failure(s)`); process.exit(1) }
console.log('E2E session persistence: all scenarios passed')
