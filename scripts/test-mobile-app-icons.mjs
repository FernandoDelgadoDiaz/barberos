import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const manifest = JSON.parse(readFileSync('public/manifest.webmanifest', 'utf8'))
const html = readFileSync('index.html', 'utf8')
const entries = [
  ['public/apple-touch-icon.png', 180],
  ['public/favicon-32.png', 32],
  ['public/icon-192.png', 192],
  ['public/icon-512.png', 512],
  ['public/icon-maskable-512.png', 512],
]

for (const [file, side] of entries) {
  const bytes = readFileSync(file)
  assert.equal(bytes.subarray(0, 8).toString('hex'), '89504e470d0a1a0a', `${file} must be a PNG`)
  assert.equal(bytes.readUInt32BE(16), side, `${file} width`)
  assert.equal(bytes.readUInt32BE(20), side, `${file} height`)
  assert.ok(bytes.length > 600, `${file} should have image contents`)
}
assert.equal(manifest.id, '/')
assert.equal(manifest.scope, '/')
assert.equal(manifest.start_url, '/')
assert.equal(manifest.short_name, 'BarberOS')
assert.equal(manifest.display, 'standalone')
assert.equal(manifest.lang, 'es-AR')
for (const name of ['icon-192.png', 'icon-512.png', 'icon-maskable-512.png']) {
  assert.ok(manifest.icons.some(icon => icon.src === '/'+name), `missing ${name}`)
}
assert.ok(manifest.icons.some(icon => icon.src === '/icon-maskable-512.png' && icon.purpose === 'maskable'))
for (const token of ['href="/manifest.webmanifest"', 'href="/apple-touch-icon.png"', 'href="/favicon-32.png"', 'name="apple-mobile-web-app-title"', 'viewport-fit=cover']) {
  assert.ok(html.includes(token), `missing markup ${token}`)
}
assert.ok(!html.includes('href="/favicon.svg"'), 'old lime-green scissors favicon must not remain active')
assert.ok(!html.includes('<html lang="en">'))
console.log('iOS / Android icon and manifest checks passed')
