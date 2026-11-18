// The browser sends every Supabase HTTP call through /sb on the app's domain.
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { toProxiedUrl, proxiedFetch } from '../src/utils/supabaseProxy.ts'

const SB = 'https://anwqupemaircnlszjgmd.supabase.co'
const APP = 'https://barberos-app.netlify.app'
assert.equal(toProxiedUrl(`${SB}/auth/v1/token?grant_type=refresh_token`, SB, APP), `${APP}/sb/auth/v1/token?grant_type=refresh_token`)
assert.equal(toProxiedUrl(`${SB}/rest/v1/profiles?select=*&user_id=eq.x`, SB, APP), `${APP}/sb/rest/v1/profiles?select=*&user_id=eq.x`)
assert.equal(toProxiedUrl(`${SB}/storage/v1/object/tenant-logos/a.jpg`, SB + '/', APP), `${APP}/sb/storage/v1/object/tenant-logos/a.jpg`)
assert.equal(toProxiedUrl('https://other.example.com/x', SB, APP), 'https://other.example.com/x')
assert.equal(toProxiedUrl(`${SB}.evil.com/x`, SB, APP), `${SB}.evil.com/x`, 'only the exact project host is rewritten')

// proxiedFetch rewrites strings, URLs and Request objects and keeps method, headers and body.
const seen = []
globalThis.fetch = async (input, init) => { seen.push({ url: typeof input === 'string' ? input : input.url, method: (init?.method || input.method || 'GET'), auth: new Headers(init?.headers || input.headers).get('apikey') }); return new Response('{}') }
const f = proxiedFetch(SB, APP)
await f(`${SB}/rest/v1/tenants`, { method: 'GET', headers: { apikey: 'k' } })
await f(new URL(`${SB}/auth/v1/user`), { headers: { apikey: 'k' } })
await f(new Request(`${SB}/rest/v1/appointments`, { method: 'POST', headers: { apikey: 'k' }, body: '{}' }))
assert.deepEqual(seen.map(s => s.url), [`${APP}/sb/rest/v1/tenants`, `${APP}/sb/auth/v1/user`, `${APP}/sb/rest/v1/appointments`])
assert.deepEqual(seen.map(s => s.method), ['GET', 'GET', 'POST'])
assert.ok(seen.every(s => s.auth === 'k'), 'apikey header kept')

// netlify.toml: the proxy points at the same project and is before the SPA catch-all.
const toml = readFileSync('netlify.toml', 'utf8')
assert.ok(toml.includes(`to = "${SB}/:splat"`))
assert.ok(toml.indexOf('from = "/sb/*"') < toml.indexOf('from = "/*"'), '/sb/* must come before the SPA catch-all')
console.log('Supabase proxy: OK')
