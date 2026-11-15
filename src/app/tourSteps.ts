// Lógica pura del recorrido guiado (sin React): los pasos y cómo avanzar saltando los que no se puedan mostrar.

export interface TourStep {
  id: string
  /** ruta a la que hay que ir para ver el elemento (si no se está ya en ella) */
  path?: string
  /** valor de data-tour del elemento a señalar; sin él, el paso es una tarjeta centrada (inicio / cierre) */
  target?: string
  title: string
  text: string
}

export const TOUR_KEY = 'opf-tutorial-v2'

export function tourSeen(): boolean {
  try {
    return localStorage.getItem(TOUR_KEY) === '1'
  } catch {
    return true // sin almacenamiento no se insiste en cada carga
  }
}
export function markTourSeen() {
  try {
    localStorage.setItem(TOUR_KEY, '1')
  } catch {
    /* sin almacenamiento: volverá a salir */
  }
}

/** Pasos del recorrido. Sin grupo solo se enseña lo que hay sin grupo. Nunca modifica datos: solo señala. */
export function buildSteps(groupCode: string | null): TourStep[] {
  const enc = groupCode ? encodeURIComponent(groupCode) : null
  const welcome: TourStep = { id: 'inicio', title: 'Bienvenido a «Orden, por favor»', text: 'Te enseño la app en menos de un minuto: tu horario, el de tu grupo y cuándo podéis quedar.' }
  const settings: TourStep = { id: 'ajustes', target: 'settings', title: 'Ajustes', text: 'Aquí cambias el tema (oscuro o rosa), quién ve los detalles de tu horario, instalas la app y repites este recorrido.' }
  const end: TourStep = { id: 'fin', title: '¡Listo!', text: 'Ya sabes lo básico. Si algo no queda claro, repite el recorrido desde Ajustes.' }

  if (!enc) {
    return [
      welcome,
      settings,
      { id: 'grupos', path: '/grupos', target: 'join-group', title: 'Únete a un grupo', text: 'Pídele el código de invitación a quien lo administre y pégalo aquí. También puedes crear uno nuevo e invitar a tu gente.' },
      end,
    ]
  }
  return [
    welcome,
    settings,
    { id: 'capas', path: `/g/${enc}`, target: 'tab-capas', title: 'Tu horario va por capas', text: 'Una capa es un conjunto de bloques que se repite con su frecuencia: «Clases» cada semana, «Prácticas» cada dos… Desde «Capas» las creas, editas y apagas.' },
    { id: 'bloque', path: `/g/${enc}`, target: 'add-block', title: 'Añade un bloque', text: 'Pulsa «Bloque» para añadir una clase o un turno; puedes marcar varios días a la vez. Para cambiar uno que ya tengas, tócalo en la semana.' },
    { id: 'mapa', path: `/g/${enc}/grupo`, target: 'map', title: 'El mapa del grupo', text: 'Cuanto más intenso el color, más gente libre; el número te dice cuántos. El borde verde marca cuándo estás libre tú. Toca una franja para ver quién.' },
    { id: 'planes', path: '/planes', target: 'best-times', title: 'Mejor momento para quedar', text: 'Elige la duración y la semana y te propongo los 3 mejores huecos. Con «Crear plan» invitas a quienes están libres.' },
    end,
  ]
}

/**
 * Siguiente paso a mostrar en la dirección dada (+1 / −1), saltando los pasos cuyo elemento no existe.
 * `available(step)` indica si un paso con `target` se puede mostrar. Devuelve null si no queda ninguno.
 */
export function nextIndex(steps: TourStep[], from: number, dir: 1 | -1, available: (s: TourStep) => boolean): number | null {
  for (let i = from + dir; i >= 0 && i < steps.length; i += dir) {
    const s = steps[i]
    if (!s.target || available(s)) return i
  }
  return null
}

/** «3 de 6» contando solo los pasos que se pueden mostrar. */
export function progress(steps: TourStep[], index: number, available: (s: TourStep) => boolean): { n: number; total: number } {
  const shown = steps.filter((s) => !s.target || available(s))
  const n = shown.findIndex((s) => s.id === steps[index]?.id) + 1
  return { n: Math.max(n, 1), total: Math.max(shown.length, 1) }
}
