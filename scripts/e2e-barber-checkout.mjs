// Mobile E2E of the barber checkout wizard, in a real Chromium with touch emulation.
// Supabase and the Netlify Function are intercepted: no real data is read or written.
//
//   VITE_SUPABASE_URL=https://e2e.supabase.test VITE_SUPABASE_ANON_KEY=e2e npx vite build --outDir dist-e2e
//   node scripts/e2e-barber-checkout.mjs dist-e2e
//
// Browser: CHROMIUM_PATH, else the system Chrome (channel "chrome").
import assert from 'node:assert/strict'
import { readFileSync, existsSync } from 'node:fs'
import { join, extname, resolve } from 'node:path'
import { chromium } from 'playwright-core'

const DIST = resolve(process.argv[2] || 'dist-e2e')
assert.ok(existsSync(join(DIST, 'index.html')), `Missing build at ${DIST} (see header)`)
const MIME = { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.svg': 'image/svg+xml', '.png': 'image/png', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.ico': 'image/x-icon', '.webp': 'image/webp' }

const svc = (id, name, price, category) => ({ id, tenant_id: 't1', name, base_price: price, category, is_active: true })
// Mirrors the size of a real catalog: 6 services and 9 products.
const CATALOG = [
  svc('s-barba', 'Barba', 7000, 'servicio'), svc('s-cejas', 'Cejas', 5000, 'servicio'), svc('s-corte', 'Corte', 20000, 'servicio'),
  svc('s-cb', 'Corte + Barba', 25000, 'servicio'), svc('s-cc', 'Corte + Ceja', 23000, 'servicio'), svc('s-dis', 'Diseño', 5000, 'servicio'),
  svc('p-acu', 'Acuarius', 2500, 'producto'), svc('p-cera', 'Cera', 15000, 'producto'), svc('p-coca', 'Coca lata', 2000, 'producto'),
  svc('p-crema', 'Crema de peinar', 15000, 'producto'), svc('p-gat', 'Gatorade', 3500, 'producto'), svc('p-mon', 'Monster', 3500, 'producto'),
  svc('p-pep', 'Pepsi', 2000, 'producto'), svc('p-per1', 'Perfume chico', 5000, 'producto'), svc('p-per2', 'Perfume grande', 10000, 'producto'),
]
const TENANT = { id: 't1', name: 'Barbería E2E', is_active: true, is_exempt_trial: true, commission_rules: { resets_daily: true, rules: [{ from_service: 1, to_service: null, barber_pct: 50, owner_pct: 50 }] } }
const PROFILE = { id: 'barber-1', user_id: 'user-1', tenant_id: 't1', role: 'barber', works_as_barber: false, is_active: true, earning_mode: 'tenant_rules' }
const SHIFT = { id: 'shift-1', tenant_id: 't1', barber_id: 'barber-1', status: 'open', started_at: new Date().toISOString() }

const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : { channel: 'chrome' })

async function open(viewport, responder = () => ({ status: 200, json: { message: 'Attention #1 registered' } })) {
  const context = await browser.newContext({ viewport, deviceScaleFactor: 2, isMobile: true, hasTouch: true, baseURL: 'http://app.test' })
  const now = Math.floor(Date.now() / 1000)
  const user = { id: 'user-1', aud: 'authenticated', role: 'authenticated', email: 'barber@e2e.test', app_metadata: {}, user_metadata: {}, created_at: new Date().toISOString() }
  const session = { access_token: 'e2e.' + Buffer.from(JSON.stringify({ sub: 'user-1', exp: now + 36000 })).toString('base64url') + '.sig', token_type: 'bearer', expires_in: 36000, expires_at: now + 36000, refresh_token: 'r', user }
  await context.addInitScript(s => localStorage.setItem('barberos-auth-token', s), JSON.stringify(session))
  const calls = []
  await context.route('**/*', async route => {
    const req = route.request()
    const url = new URL(req.url())
    if (url.host === 'app.test' && url.pathname === '/.netlify/functions/log-service') {
      calls.push(req.postDataJSON())
      return route.fulfill(await responder(calls.length))
    }
    if (url.host === 'app.test') {
      let file = join(DIST, url.pathname)
      if (!extname(url.pathname) || !existsSync(file)) file = join(DIST, 'index.html')
      return route.fulfill({ body: readFileSync(file), headers: { 'content-type': MIME[extname(file)] || 'application/octet-stream' } })
    }
    if (url.pathname.startsWith('/auth/')) return route.fulfill({ json: user })
    if (url.pathname.startsWith('/rest/v1/')) {
      const table = url.pathname.slice('/rest/v1/'.length)
      const rows = { profiles: [PROFILE], tenants: [TENANT], services_catalog: CATALOG,
        shifts: (url.searchParams.get('status') || '').includes('open') ? [SHIFT] : [] }[table] || []
      if (req.method() === 'HEAD') return route.fulfill({ status: 200, headers: { 'content-range': `*/${rows.length}` }, body: '' })
      if ((req.headers().accept || '').includes('vnd.pgrst.object')) return rows.length ? route.fulfill({ json: rows[0] }) : route.fulfill({ status: 406, json: { code: 'PGRST116' } })
      return route.fulfill({ json: rows })
    }
    return route.fulfill({ status: 204, body: '' }) // fonts and other third parties
  })
  const page = await context.newPage()
  const errors = []
  page.on('pageerror', e => errors.push(e.message))
  await page.goto('/barber/dashboard')
  await page.getByRole('button', { name: /Registrar cliente/ }).click()
  await page.getByTestId('barber-wizard').waitFor()
  return { page, calls, errors, close: () => context.close() }
}

// The forward action must be visible and tappable WITHOUT scrolling.
async function tap(page, testId) {
  const el = page.getByTestId(testId)
  await el.waitFor({ state: 'visible' })
  const reachable = await el.evaluate(b => {
    const r = b.getBoundingClientRect()
    const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2)
    return r.top >= 0 && r.bottom <= window.innerHeight && !b.disabled && (hit === b || b.contains(hit))
  })
  assert.ok(reachable, `${testId} must be visible, enabled and tappable without scrolling`)
  await el.tap()
}
const option = (page, kind, name) => page.getByTestId(`barber-${kind}-option`).filter({ hasText: name }).first()
const pay = (page, method) => page.getByTestId(method === 'transferencia' ? 'barber-payment-transfer' : 'barber-payment-cash').tap()
async function finish(page) {
  await tap(page, 'barber-confirm')
  await page.getByText(/Cliente registrado/).waitFor()
  assert.equal(await page.getByTestId('barber-wizard').count(), 0, 'wizard closes only after the server confirms')
}

const VIEWPORTS = [
  { width: 375, height: 548 }, // iPhone SE / mini with Safari bars
  { width: 320, height: 480 }, // smallest supported
  { width: 390, height: 664 }, // iPhone 14 with Safari bars
  { width: 360, height: 640 }, // common Android
]

const scenarios = {
  async 'Un corte sin productos'({ page, calls }) {
    await option(page, 'service', 'Corte').tap()
    await tap(page, 'barber-services-next')
    await pay(page, 'efectivo'); await tap(page, 'barber-payment-next')
    await tap(page, 'barber-tip-next')
    await tap(page, 'barber-products-skip')
    await finish(page)
    assert.deepEqual(calls[0].services, [{ service_id: 's-corte', price_charged: 20000 }])
    assert.deepEqual(calls[0].products, [])
    assert.equal(calls[0].tip_amount, 0)
  },
  async 'Corte + barba sin productos, por transferencia'({ page, calls }) {
    await option(page, 'service', 'Corte').tap()
    await option(page, 'service', 'Barba').tap()
    await tap(page, 'barber-services-next')
    await pay(page, 'transferencia'); await tap(page, 'barber-payment-next')
    await tap(page, 'barber-tip-next')
    await tap(page, 'barber-products-skip')
    await finish(page)
    assert.deepEqual(calls[0].services.map(s => s.service_id).sort(), ['s-barba', 's-corte'])
    assert.equal(calls[0].payment_method, 'transferencia')
  },
  async 'Servicio con propina en otro medio de pago, sin productos'({ page, calls }) {
    await option(page, 'service', 'Corte').tap()
    await tap(page, 'barber-services-next')
    await pay(page, 'transferencia'); await tap(page, 'barber-payment-next')
    await page.getByTestId('barber-tip-yes').tap()
    await page.getByTestId('barber-tip-amount').fill('3000')
    await page.getByTestId('barber-tip-cash').tap()
    await tap(page, 'barber-tip-next')
    await tap(page, 'barber-products-skip')
    assert.match(await page.getByTestId('barber-confirm-total').textContent(), /23\.000/)
    await finish(page)
    assert.deepEqual([calls[0].payment_method, calls[0].tip_amount, calls[0].tip_payment_method], ['transferencia', 3000, 'efectivo'])
  },
  async 'Servicio con productos'({ page, calls }) {
    await option(page, 'service', 'Corte').tap()
    await tap(page, 'barber-services-next')
    await pay(page, 'efectivo'); await tap(page, 'barber-payment-next')
    await tap(page, 'barber-tip-next')
    await option(page, 'product', 'Cera').tap()
    await page.getByRole('button', { name: 'Sumar uno de Cera' }).tap()
    await option(page, 'product', 'Coca lata').tap()
    await tap(page, 'barber-products-next')
    await finish(page)
    assert.deepEqual(calls[0].products.map(p => [p.product_id, p.quantity]), [['p-cera', 2], ['p-coca', 1]])
  },
  async 'Venta exclusivamente de productos'({ page, calls }) {
    await tap(page, 'barber-services-products-only')
    await pay(page, 'efectivo'); await tap(page, 'barber-payment-next')
    await tap(page, 'barber-tip-next')
    assert.equal(await page.getByTestId('barber-products-skip').count(), 0, 'without a service, products are required')
    await option(page, 'product', 'Pepsi').tap()
    await tap(page, 'barber-products-next')
    await finish(page)
    assert.deepEqual(calls[0].services, [])
    assert.deepEqual(calls[0].products.map(p => p.product_id), ['p-pep'])
  },
  async 'Ningún servicio ni producto: se impide y se ofrece volver'({ page, calls }) {
    await tap(page, 'barber-services-products-only')
    await pay(page, 'efectivo'); await tap(page, 'barber-payment-next')
    await tap(page, 'barber-tip-next')
    await page.getByTestId('barber-products-needs-selection').waitFor()
    assert.equal(await page.getByTestId('barber-products-next').count() + await page.getByTestId('barber-products-skip').count(), 0)
    await tap(page, 'barber-products-back-to-services')
    await option(page, 'service', 'Cejas').tap()
    await tap(page, 'barber-services-next')
    await tap(page, 'barber-payment-next') // payment already chosen, kept
    await tap(page, 'barber-tip-next')
    await tap(page, 'barber-products-skip')
    await finish(page)
    assert.equal(calls.length, 1)
    assert.deepEqual(calls[0].services.map(s => s.service_id), ['s-cejas'])
  },
  async 'Retroceder y modificar mantiene un estado consistente'({ page, calls }) {
    await option(page, 'service', 'Corte').tap()
    await tap(page, 'barber-services-next')
    await pay(page, 'efectivo'); await tap(page, 'barber-payment-next')
    await tap(page, 'barber-tip-next')
    await option(page, 'product', 'Acuarius').tap()
    for (let i = 0; i < 3; i++) await tap(page, 'barber-wizard-back')
    assert.equal(await option(page, 'service', 'Corte').getAttribute('aria-pressed'), 'true', 'service survives going back')
    await option(page, 'service', 'Corte').tap() // deselect
    await option(page, 'service', 'Barba').tap()
    await tap(page, 'barber-services-next')
    assert.match(await page.getByTestId('barber-selection-recap').textContent(), /Barba/)
    await tap(page, 'barber-payment-next')
    await tap(page, 'barber-tip-next')
    assert.equal(await option(page, 'product', 'Acuarius').getAttribute('aria-pressed'), 'true', 'product survives going back')
    await tap(page, 'barber-products-next')
    await finish(page)
    assert.deepEqual(calls[0].services.map(s => s.service_id), ['s-barba'])
    assert.deepEqual(calls[0].products.map(p => p.product_id), ['p-acu'])
  },
}

let failures = 0
for (const viewport of VIEWPORTS) {
  for (const [name, run] of Object.entries(scenarios)) {
    const ctx = await open(viewport)
    try {
      await run(ctx)
      assert.deepEqual(ctx.errors, [])
      console.log(`  ✓ ${viewport.width}x${viewport.height} ${name}`)
    } catch (err) {
      failures++
      console.error(`  ✗ ${viewport.width}x${viewport.height} ${name}\n    ${err.message.split('\n')[0]}`)
      await ctx.page.screenshot({ path: `e2e-failure-${viewport.width}x${viewport.height}-${failures}.png` }).catch(() => {})
    } finally { await ctx.close() }
  }
}

// Server failure → visible error, retry works, nothing duplicated.
{
  const ctx = await open({ width: 375, height: 548 }, n => n === 1 ? { status: 500, json: { error: 'Failed to create appointment' } } : { status: 200, json: { message: 'ok' } })
  try {
    const { page, calls } = ctx
    await option(page, 'service', 'Corte').tap()
    await tap(page, 'barber-services-next')
    await pay(page, 'efectivo'); await tap(page, 'barber-payment-next')
    await tap(page, 'barber-tip-next')
    await tap(page, 'barber-products-skip')
    await tap(page, 'barber-confirm')
    await page.getByTestId('barber-wizard-error').waitFor()
    assert.match(await page.getByTestId('barber-wizard-error').textContent(), /Failed to create appointment/)
    assert.match(await page.getByTestId('barber-confirm').textContent(), /Reintentar/)
    await finish(page)
    assert.equal(calls.length, 2)
    console.log('  ✓ Fallo del servidor: error visible y reintento')
  } catch (err) { failures++; console.error(`  ✗ Fallo del servidor\n    ${err.message}`) } finally { await ctx.close() }
}

// Repeated taps on confirm while the request is in flight → a single request.
{
  const ctx = await open({ width: 375, height: 548 }, async () => { await new Promise(r => setTimeout(r, 800)); return { status: 200, json: { message: 'ok' } } })
  try {
    const { page, calls } = ctx
    await option(page, 'service', 'Corte').tap()
    await tap(page, 'barber-services-next')
    await pay(page, 'efectivo'); await tap(page, 'barber-payment-next')
    await tap(page, 'barber-tip-next')
    await tap(page, 'barber-products-skip')
    await page.getByTestId('barber-confirm').evaluate(b => { b.click(); b.click(); b.click() })
    await page.getByText(/Cliente registrado/).waitFor()
    assert.equal(calls.length, 1, 'only one attention is sent')
    console.log('  ✓ Pulsaciones repetidas: un solo registro')
  } catch (err) { failures++; console.error(`  ✗ Pulsaciones repetidas\n    ${err.message}`) } finally { await ctx.close() }
}

await browser.close()
if (failures) { console.error(`E2E barber checkout: ${failures} failure(s)`); process.exit(1) }
console.log('E2E barber checkout: all mobile scenarios passed')
