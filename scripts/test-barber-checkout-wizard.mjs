// Structural guarantees of the wizard markup that the mobile E2E relies on.
// Behaviour is covered by test-barber-products-optional.mjs (rules),
// test-log-service-handler.mjs (server) and e2e-barber-checkout.mjs (browser).
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
const src = readFileSync('src/pages/barber/Dashboard.tsx', 'utf8')
const wizard = src.slice(src.indexOf('{/* Wizard Modal'), src.indexOf('// Shared subcomponents'))
const footer = wizard.slice(wizard.indexOf('data-testid="barber-wizard-footer"'))
assert.ok(wizard.length > 0 && footer.length > 0)
// Every forward action lives in the fixed footer, never inside the scrolling body.
for (const id of ['barber-services-next', 'barber-services-products-only', 'barber-payment-next', 'barber-tip-next', 'barber-products-skip', 'barber-products-next', 'barber-products-back-to-services', 'barber-confirm', 'barber-wizard-error'])
  assert.ok(footer.includes(`data-testid="${id}"`), `${id} must be in the fixed footer`)
// One scroll container: no nested fixed-height lists that trap the scroll on mobile.
assert.ok(!/maxHeight: '280px'/.test(wizard), 'no nested scroll lists inside the wizard')
// Payment step keeps PR #18: explicit choice, then continue.
assert.match(wizard, /disabled=\{!wizardPaymentChosen\}/)
// Double submission lock and in-modal errors.
assert.match(src, /if \(!tenant \|\| !profile \|\| submittingRef\.current\) return/)
assert.match(src, /setWizardError\(errorMessage\)/)
assert.match(src, /body: JSON\.stringify\(buildAttentionPayload\(/)
console.log('Checkout wizard regression checks passed')
