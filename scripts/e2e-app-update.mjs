// E2E: a device running an old deploy picks up the new one (AppUpdateNotice).
// Uses the same build as e2e-barber-checkout.mjs:
//   node scripts/e2e-app-update.mjs dist-e2e
import assert from 'node:assert/strict'
import { readFileSync, existsSync } from 'node:fs'
import { join, extname, resolve } from 'node:path'
import { chromium } from 'playwright-core'
import { extractEntryBundle } from '../src/utils/appVersion.ts'

const DIST = resolve(process.argv[2] || 'dist-e2e')
const INDEX = readFileSync(join(DIST, 'index.html'), 'utf8')
const RUNNING = extractEntryBundle(INDEX)
assert.ok(RUNNING, 'build must reference a hashed entry bundle')
assert.equal(extractEntryBundle('<script type="module" crossorigin src="/assets/index-AbC123.js"></script>'), '/assets/index-AbC123.js')
assert.equal(extractEntryBundle('<html>sin bundle</html>'), null)

const MIME = { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.svg': 'image/svg+xml', '.png': 'image/png', '.webmanifest': 'application/manifest+json' }
const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : { channel: 'chrome' })

async function open() {
  const context = await browser.newContext({ viewport: { width: 390, height: 664 }, isMobile: true, hasTouch: true, baseURL: 'http://app.test' })
  const state = { deployed: false }
  await context.route('**/*', route => {
    const url = new URL(route.request().url())
    if (url.host !== 'app.test') return route.fulfill({ status: 204, body: '' })
    // The update check fetches "/?v=…": after a "deploy" it references another bundle.
    if (url.pathname === '/' && url.searchParams.has('v')) {
      const html = state.deployed ? INDEX.replace(RUNNING, '/assets/index-NEWDEPLOY.js') : INDEX
      return route.fulfill({ body: html, headers: { 'content-type': 'text/html' } })
    }
    let file = join(DIST, url.pathname)
    if (!extname(url.pathname) || !existsSync(file)) file = join(DIST, 'index.html')
    return route.fulfill({ body: readFileSync(file), headers: { 'content-type': MIME[extname(file)] || 'application/octet-stream' } })
  })
  const page = await context.newPage()
  await page.goto('/login')
  await page.waitForLoadState('networkidle')
  await page.evaluate(() => { window.__sameDocument = true })
  return { page, state, close: () => context.close() }
}
const resume = page => page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')))
const sameDocument = page => page.evaluate(() => window.__sameDocument === true)

let failures = 0
async function scenario(name, fn) {
  const ctx = await open()
  try { await fn(ctx); console.log(`  ✓ ${name}`) } catch (err) { failures++; console.error(`  ✗ ${name}\n    ${err.message}`) } finally { await ctx.close() }
}

await scenario('Sin deploy nuevo: no muestra aviso ni recarga', async ({ page }) => {
  await resume(page)
  await page.waitForTimeout(500)
  assert.equal(await sameDocument(page), true)
  assert.equal(await page.getByTestId('app-update-notice').count(), 0)
})

await scenario('Deploy nuevo al volver a la app: recarga sola', async ({ page, state }) => {
  state.deployed = true
  await Promise.all([page.waitForEvent('load'), resume(page)])
  assert.equal(await sameDocument(page), false, 'the page was reloaded')
})

await scenario('Deploy nuevo con un cobro abierto: avisa y no recarga', async ({ page, state }) => {
  await page.evaluate(() => { const d = document.createElement('div'); d.dataset.testid = 'barber-wizard'; document.body.appendChild(d) })
  state.deployed = true
  await resume(page)
  await page.getByTestId('app-update-notice').waitFor()
  assert.equal(await sameDocument(page), true, 'an open checkout is never wiped')
  await Promise.all([page.waitForEvent('load'), page.getByTestId('app-update-reload').tap()])
  assert.equal(await sameDocument(page), false)
})

await browser.close()
if (failures) { console.error(`E2E app update: ${failures} failure(s)`); process.exit(1) }
console.log('E2E app update: all scenarios passed')
