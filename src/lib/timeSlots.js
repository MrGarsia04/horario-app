// Configuración central de la rejilla, ajustada a la duración real de las clases (1h30).
export const DAYS = [
  { key: 'mon', label: 'Lunes' },
  { key: 'tue', label: 'Martes' },
  { key: 'wed', label: 'Miércoles' },
  { key: 'thu', label: 'Jueves' },
  { key: 'fri', label: 'Viernes' },
]

// Cada fila es una franja de clase (seleccionable) o el descanso fijo entre turnos
// (no seleccionable, siempre libre para todos). El orden aquí es el orden visual.
export const ROWS = [
  { type: 'class', start: '09:00', end: '10:30' },
  { type: 'class', start: '10:30', end: '12:00' },
  { type: 'class', start: '12:00', end: '13:30' },
  { type: 'break', start: '13:30', end: '14:00' },
  { type: 'class', start: '14:00', end: '15:30' },
  { type: 'class', start: '15:30', end: '17:00' },
  { type: 'class', start: '17:00', end: '18:30' },
]

// Id único y estable para una casilla día+franja, usado como clave en la base de datos.
// Solo se genera para franjas de clase; el descanso no se guarda porque siempre es libre.
export function slotId(dayKey, start) {
  return `${dayKey}_${start}`
}