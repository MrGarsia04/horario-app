// Paginación de días del horario en móvil: las columnas se desplazan con el dedo (scroll horizontal con «snap»)
// y aquí se calcula qué día queda primero a la vista y a qué posición hay que ir para abrir en un día concreto.

export const DAYS_IN_WEEK = 7

/** Índice (0–6) del primer día visible según el desplazamiento horizontal. */
export function firstVisibleDay(scrollLeft: number, colWidth: number, dayCount: number): number {
  if (colWidth <= 0) return 0
  const max = Math.max(0, DAYS_IN_WEEK - dayCount)
  return Math.max(0, Math.min(max, Math.round(scrollLeft / colWidth)))
}

/** Desplazamiento horizontal para que `day` sea el primer día visible (acotado: nunca se muestra vacío por la derecha). */
export function scrollLeftForDay(day: number, colWidth: number, dayCount: number): number {
  const max = Math.max(0, DAYS_IN_WEEK - dayCount)
  return Math.max(0, Math.min(max, day)) * colWidth
}

/** Ancho de las columnas: todas caben justas en `dayCount` columnas visibles. */
export function columnWidth(containerWidth: number, dayCount: number): number {
  return containerWidth / Math.max(1, dayCount)
}

export function canScroll(first: number, dayCount: number): { left: boolean; right: boolean } {
  return { left: first > 0, right: first < DAYS_IN_WEEK - dayCount }
}
