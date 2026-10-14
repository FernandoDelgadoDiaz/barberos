import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const live = readFileSync('src/pages/owner/LivePanel.tsx', 'utf8')
const settings = readFileSync('src/pages/owner/Settings.tsx', 'utf8')
const css = readFileSync('src/styles/owner-premium.css', 'utf8')

const bannerAt = live.indexOf('className="premium-live-cover-banner"')
const headerAt = live.indexOf('{/* Top header (mobile) */}')
const heroAt = live.indexOf('className="premium-live-hero"')
assert.ok(bannerAt > 0 && bannerAt < headerAt && headerAt < heroAt,
  'La portada debe mostrarse por encima de la identidad y de la facturación')
assert.ok(live.includes('{coverUrl && ('), 'No debe reservar espacio a barberías sin portada')
assert.equal((live.match(/className="premium-live-cover-banner"/g) || []).length, 1)
assert.ok(!live.includes('className="premium-live-cover"'),
  'La portada antigua no debe superponerse a la facturación')
assert.ok(css.includes('height: 112px'), 'Portada compacta en móviles')
assert.ok(!css.includes('opacity:.19'), 'La fotografía no debe seguir lavada')
assert.ok(!css.includes('filter:saturate(.78)'), 'No debe desaturarse la foto')
assert.ok(settings.includes('premium-cover-preview-photo'), 'La vista previa debe mostrar la foto aparte')
assert.ok(settings.includes('premium-cover-preview-revenue'), 'Los importes deben mantenerse separados')
assert.ok(settings.includes('handleCoverUpload') && settings.includes('handleRemoveCover') && settings.includes('handleSaveCoverPosition'),
  'El dueño debe poder subir, eliminar y encuadrar la foto')
assert.ok(live.includes('(totalDay - totalBarberEarningsExTips + totalOthers - totalExpenses)'),
  'La fórmula protegida de liquidación debe conservarse')
console.log('Owner cover header layout checks passed')
