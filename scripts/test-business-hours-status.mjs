import assert from 'node:assert/strict'
import { businessHoursStatus as state } from '../src/utils/businessHoursStatus.ts'
const check=(a,b,n,label,phase)=>{
  const actual=state(a,b,n)
  assert.equal(actual.label,label)
  assert.equal(actual.phase,phase)
  assert.equal(actual.withinHours,phase==='within')
}
check('14:00:00','22:00:00','10:34','Abre a las 14:00','before')
check('14:00:00','22:00:00','14:00','Dentro del horario habitual','within')
check('14:00:00','22:00:00','21:59','Dentro del horario habitual','within')
check('14:00:00','22:00:00','22:00','Horario finalizado · Abre mañana a las 14:00','after')
check('20:00:00','04:00:00','23:00','Dentro del horario habitual','within')
check('20:00:00','04:00:00','02:00','Dentro del horario habitual','within')
check('20:00:00','04:00:00','04:00','Abre a las 20:00','before')
check('20:00:00','04:00:00','18:00','Abre a las 20:00','before')
check('12:00','12:00','08:00','Horario habitual por revisar','invalid')
check('?', '22:00','08:00','Horario habitual por revisar','invalid')
console.log('Business hours status tests passed')
