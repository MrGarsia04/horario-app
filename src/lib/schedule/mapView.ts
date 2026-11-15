import { DAY_KEYS, busyIntervalsForDate } from './availability'
import { getDateForDay } from '../weeks'
import type { DayKey, MemberSchedule, ViewWindow } from './types'

// Vista PROPIA del mapa del grupo (por persona y grupo, solo en este dispositivo): qué días y qué horas se ven.
// No es un ajuste del grupo. Sin ella el mapa usa el rango automático calculado a partir de los horarios reales.
// Se guarda en localStorage: no hay en el esquema actual un sitio de perfil para preferencias y no justifica una migración.
export interface MapViewPref {
  days: DayKey[]
  startMin: number
  endMin: number
}

export const mapViewKey = (userId: string, groupCode: string) => `opf-map-view:${userId}:${groupCode}`

/** Valida lo guardado (puede venir de otra versión o estar manipulado): días válidos y rango coherente en pasos de 30 min. */
export function sanitizeMapView(raw: unknown): MapViewPref | null {
  if (!raw || typeof raw !== 'object') return null
  const r = raw as Record<string, unknown>
  const days = Array.isArray(r.days) ? DAY_KEYS.filter((d) => (r.days as unknown[]).includes(d)) : []
  const start = Number(r.startMin)
  const end = Number(r.endMin)
  if (days.length === 0 || !Number.isFinite(start) || !Number.isFinite(end)) return null
  const s = Math.max(0, Math.min(23 * 60 + 30, Math.floor(start / 30) * 30))
  const e = Math.max(30, Math.min(24 * 60, Math.ceil(end / 30) * 30))
  if (e <= s) return null
  return { days, startMin: s, endMin: e }
}

export function loadMapView(key: string): MapViewPref | null {
  try {
    const raw = localStorage.getItem(key)
    return raw ? sanitizeMapView(JSON.parse(raw)) : null
  } catch {
    return null
  }
}

export function saveMapView(key: string, pref: MapViewPref | null) {
  try {
    if (pref) localStorage.setItem(key, JSON.stringify(pref))
    else localStorage.removeItem(key)
  } catch {
    /* sin almacenamiento: solo dura esta sesión */
  }
}

/** La vista propia manda; si no hay, el rango automático. */
export function effectiveWindow(auto: ViewWindow, pref: MapViewPref | null): ViewWindow {
  return pref ? { days: pref.days, startMin: pref.startMin, endMin: pref.endMin } : auto
}

const SHORT: Record<DayKey, string> = { mon: 'Lun', tue: 'Mar', wed: 'Mié', thu: 'Jue', fri: 'Vie', sat: 'Sáb', sun: 'Dom' }

/** «Lun–Vie», «Toda la semana», «Lun–Mié, Sáb»… */
export function daysLabel(days: DayKey[]): string {
  const idx = DAY_KEYS.map((d, i) => (days.includes(d) ? i : -1)).filter((i) => i >= 0)
  if (idx.length === 7) return 'Toda la semana'
  const runs: number[][] = []
  for (const i of idx) {
    const last = runs[runs.length - 1]
    if (last && i === last[last.length - 1] + 1) last.push(i)
    else runs.push([i])
  }
  return runs.map((r) => (r.length === 1 ? SHORT[DAY_KEYS[r[0]]] : r.length === 2 ? `${SHORT[DAY_KEYS[r[0]]]}, ${SHORT[DAY_KEYS[r[1]]]}` : `${SHORT[DAY_KEYS[r[0]]]}–${SHORT[DAY_KEYS[r[r.length - 1]]]}`)).join(', ')
}

/** «8:00–20:00» (sin ceros a la izquierda) */
export function hoursLabel(startMin: number, endMin: number): string {
  const f = (m: number) => `${Math.floor(m / 60)}:${String(m % 60).padStart(2, '0')}`
  return `${f(startMin)}–${f(endMin)}`
}

/**
 * ¿Hay en esa semana algo ocupado (de cualquiera) que queda FUERA de la ventana (otro día u otra hora)?
 * Sirve para avisar de que la vista elegida oculta cosas que cuentan; el cálculo no cambia.
 */
export function hasHiddenBusy(members: MemberSchedule[], weekStart: string, groupCode: string | null, win: ViewWindow): boolean {
  for (const day of DAY_KEYS) {
    const date = getDateForDay(weekStart, day)
    const dayShown = win.days.includes(day)
    for (const m of members) {
      for (const iv of busyIntervalsForDate(m, date, groupCode)) {
        if (!dayShown || iv.start < win.startMin || iv.end > win.endMin) return true
      }
    }
  }
  return false
}
