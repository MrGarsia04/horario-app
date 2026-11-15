import type { DayKey } from '../../lib/schedule/types'

export const DAYS: { key: DayKey; label: string; short: string }[] = [
  { key: 'mon', label: 'Lunes', short: 'Lun' },
  { key: 'tue', label: 'Martes', short: 'Mar' },
  { key: 'wed', label: 'Miércoles', short: 'Mié' },
  { key: 'thu', label: 'Jueves', short: 'Jue' },
  { key: 'fri', label: 'Viernes', short: 'Vie' },
  { key: 'sat', label: 'Sábado', short: 'Sáb' },
  { key: 'sun', label: 'Domingo', short: 'Dom' },
]

export const COLORS = ['#4C7C7C', '#E8A33D', '#C0504D', '#5B8DEF', '#8E6BBF', '#4CAF7A', '#D96AA7', '#8C8C8C']

export const REPEAT_LABELS = {
  weekly: 'Todas las semanas',
  biweekly_a: 'Semanas A (quincenal)',
  biweekly_b: 'Semanas B (quincenal)',
} as const

export const SNAP = 15
export const snap = (min: number) => Math.round(min / SNAP) * SNAP
