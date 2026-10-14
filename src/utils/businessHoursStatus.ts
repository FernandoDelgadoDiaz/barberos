export interface BusinessHoursStatus { label: string; withinHours: boolean; phase: 'before'|'within'|'after'|'invalid' }
const asMinutes = (value: string): number|null => {
  const m = /^(\d{1,2}):(\d{2})(?::\d{2})?$/.exec(value)
  if (!m) return null
  const h = Number(m[1]), min = Number(m[2])
  return h < 24 && min < 60 ? h*60+min : null
}
const clock = (n: number) => `${String(Math.floor(n/60)).padStart(2,'0')}:${String(n%60).padStart(2,'0')}`
/** Informative configured hours only; never says the business is actually open. */
export function businessHoursStatus(opening: string, closing: string, currentLocalTime: string): BusinessHoursStatus {
  const a = asMinutes(opening), b = asMinutes(closing), n = asMinutes(currentLocalTime)
  if (a === null || b === null || n === null || a === b)
    return { label: 'Horario habitual por revisar', withinHours: false, phase: 'invalid' }
  const night = a > b
  const inside = night ? n >= a || n < b : n >= a && n < b
  if (inside) return { label: 'Dentro del horario habitual', withinHours: true, phase: 'within' }
  if (!night && n >= b)
    return { label: `Horario finalizado · Abre mañana a las ${clock(a)}`, withinHours: false, phase: 'after' }
  return { label: `Abre a las ${clock(a)}`, withinHours: false, phase: 'before' }
}
