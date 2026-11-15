import { weekParity } from './availability'
import type { Template } from './types'

const MONTHS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']
export function shortDate(iso: string): string {
  return `${Number(iso.slice(8, 10))} ${MONTHS[Number(iso.slice(5, 7)) - 1]}`
}

/** «Todas las semanas» / «Cada 2 semanas» */
export function frequencyLabel(n: number | undefined): string {
  const v = n ?? 1
  return v <= 1 ? 'Todas las semanas' : `Cada ${v} semanas`
}

/** Frase corta para la lista de capas: «Cada 2 semanas · desde el 16 nov · hasta el 30 ene». */
export function layerSummary(t: Template): string {
  const parts = [frequencyLabel(t.every_n_weeks)]
  parts.push(t.active_from ? `desde el ${shortDate(t.active_from)}` : 'desde siempre')
  parts.push(t.active_to ? `hasta el ${shortDate(t.active_to)}` : 'sin fecha de fin')
  return parts.join(' · ')
}

export { weekParity }
