export interface OwnerDayStateInput {
  isOpen: boolean
  isPostMidnight: boolean
  serviceCount: number
  recordCount: number
}
export interface OwnerDayState {
  hasActivity: boolean
  recordLabel: string
  title: string
  detail: string
}
/** Neutral operational status derived from loaded rows and configured business hours. */
export function getOwnerDayStatus({ isOpen, isPostMidnight, serviceCount, recordCount }: OwnerDayStateInput): OwnerDayState {
  if (recordCount > 0) {
    return {
      hasActivity: true,
      recordLabel: `${recordCount} ${recordCount === 1 ? 'registro' : 'registros'} cargados`,
      title: isPostMidnight ? 'Actividad de la última jornada' : 'Actividad registrada',
      detail: serviceCount > 0
        ? `${serviceCount} ${serviceCount === 1 ? 'servicio registrado' : 'servicios registrados'} en ${isPostMidnight ? 'la última jornada' : 'la jornada de hoy'}.`
        : 'Hay movimientos registrados, pero todavía no se cargaron servicios.',
    }
  }
  if (isPostMidnight) return {
    hasActivity: false,
    recordLabel: 'Sin registros cargados',
    title: 'Última jornada sin registros',
    detail: 'No hay movimientos cargados para la última jornada consultada.',
  }
  return {
    hasActivity: false,
    recordLabel: 'Sin registros cargados',
    title: isOpen ? 'Jornada sin movimientos' : 'Fuera del horario configurado',
    detail: isOpen
      ? 'El local está dentro de su horario, pero todavía no hay movimientos cargados.'
      : 'Todavía no hay movimientos cargados para la jornada de hoy.',
  }
}
