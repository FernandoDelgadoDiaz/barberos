import assert from 'node:assert/strict'
import { summarizeActiveServices } from '../src/utils/serviceCatalogSummary.ts'

const mk = (category, is_active, base_price) => ({ category, is_active, base_price })

assert.deepEqual(summarizeActiveServices([]), { activeCount: 0, avgPrice: null })
assert.deepEqual(
  summarizeActiveServices([
    mk('servicio', true, 7000),
    mk('servicio', true, 20000),
    mk('servicio', false, 100000),
    mk('producto', true, 4500),
    mk('producto', false, 700000),
  ]),
  { activeCount: 2, avgPrice: 13500 },
)
assert.deepEqual(
  summarizeActiveServices([mk('producto', true, 10000), mk('servicio', false, 22000)]),
  { activeCount: 0, avgPrice: null },
)
assert.deepEqual(
  summarizeActiveServices([mk('servicio', true, 9999), mk('servicio', true, 10000)]),
  { activeCount: 2, avgPrice: 10000 },
)
console.log('Service catalog KPI tests passed')
