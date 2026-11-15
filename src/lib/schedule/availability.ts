import { getWeekStart, getDateForDay, resolveScheduleForWeek } from '../weeks'
import type {
  Block, Candidate, DayKey, Exception, Interval, MemberSchedule, Template, ViewWindow,
} from './types'

export const RESOLUTION = 15 // minutos por casilla del mapa de calor
export const DAY_KEYS: DayKey[] = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']

// ---------- conversiones ----------
export function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number)
  return h * 60 + (m || 0)
}

export function toLabel(min: number): string {
  const h = String(Math.floor(min / 60)).padStart(2, '0')
  const m = String(min % 60).padStart(2, '0')
  return `${h}:${m}`
}

function parseDate(date: string): Date {
  const [y, m, d] = date.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d))
}

/** Día de la semana ('mon'…'sun') de una fecha. */
export function dayKeyOf(date: string): DayKey {
  const dow = parseDate(date).getUTCDay() // 0 = domingo
  return DAY_KEYS[(dow + 6) % 7]
}

/**
 * Paridad de la semana para los horarios quincenales: se cuenta desde un lunes fijo
 * (1970-01-05), así 'a' y 'b' se alternan siempre igual para todos los usuarios.
 */
export function weekParity(weekStart: string): 'a' | 'b' {
  const days = Math.round(parseDate(weekStart).getTime() / 86_400_000)
  const weeks = Math.round((days - 4) / 7) // 1970-01-05 es el día 4
  return weeks % 2 === 0 ? 'a' : 'b'
}

function inRange(date: string, from: string | null, to: string | null): boolean {
  return (!from || date >= from) && (!to || date <= to)
}

// ---------- intervalos ----------
export function mergeIntervals(list: Interval[]): Interval[] {
  const sorted = list
    .filter((i) => i.end > i.start)
    .map((i) => ({ ...i }))
    .sort((a, b) => a.start - b.start)
  const out: Interval[] = []
  for (const iv of sorted) {
    const last = out[out.length - 1]
    if (last && iv.start <= last.end) last.end = Math.max(last.end, iv.end)
    else out.push(iv)
  }
  return out
}

export function subtractInterval(list: Interval[], cut: Interval): Interval[] {
  const out: Interval[] = []
  for (const iv of list) {
    if (cut.end <= iv.start || cut.start >= iv.end) out.push(iv)
    else {
      if (cut.start > iv.start) out.push({ start: iv.start, end: cut.start })
      if (cut.end < iv.end) out.push({ start: cut.end, end: iv.end })
    }
  }
  return out
}

export function overlaps(list: Interval[], start: number, end: number): boolean {
  return list.some((iv) => iv.start < end && start < iv.end)
}

// ---------- horario de una persona en una fecha ----------
export function activeTemplates(templates: Template[], date: string): Template[] {
  return templates.filter((t) => t.is_active && inRange(date, t.active_from, t.active_to))
}

function blockApplies(b: Block, date: string, groupCode: string | null, parity: 'a' | 'b'): boolean {
  if (b.group_code && b.group_code !== groupCode) return false
  if (b.day !== dayKeyOf(date)) return false
  if (!inRange(date, b.valid_from, b.valid_to)) return false
  if (b.repeat === 'biweekly_a' && parity !== 'a') return false
  if (b.repeat === 'biweekly_b' && parity !== 'b') return false
  return true
}

function applyExceptions(base: Interval[], exceptions: Exception[], date: string, groupCode: string | null): Interval[] {
  let busy = base
  const todays = exceptions.filter((e) => e.date === date && (!e.group_code || e.group_code === groupCode))
  // Primero las que liberan, luego las que ocupan: una ocupación puntual gana a una liberación.
  for (const e of todays.filter((x) => x.kind === 'free')) {
    busy = e.start_min == null || e.end_min == null ? [] : subtractInterval(busy, { start: e.start_min, end: e.end_min })
  }
  for (const e of todays.filter((x) => x.kind === 'busy')) {
    busy = busy.concat({ start: e.start_min ?? 0, end: e.end_min ?? 24 * 60 })
  }
  return busy
}

/** Intervalos ocupados (en minutos, ya fusionados) de un miembro en una fecha concreta. */
export function busyIntervalsForDate(member: MemberSchedule, date: string, groupCode: string | null): Interval[] {
  const weekStart = getWeekStart(date)
  let busy: Interval[]

  if (member.mode === 'legacy') {
    const { schedule } = resolveScheduleForWeek(member.legacyBase, member.legacyOverrides, weekStart)
    const day = dayKeyOf(date)
    busy = (schedule as { day: DayKey; start: string; end: string }[])
      .filter((iv) => iv.day === day)
      .map((iv) => ({ start: toMinutes(iv.start), end: toMinutes(iv.end) }))
  } else {
    const ids = new Set(activeTemplates(member.templates, date).map((t) => t.id))
    const parity = weekParity(weekStart)
    busy = member.blocks
      .filter((b) => ids.has(b.template_id) && blockApplies(b, date, groupCode, parity))
      .map((b) => ({ start: b.start_min, end: b.end_min }))
  }
  return mergeIntervals(applyExceptions(busy, member.exceptions, date, groupCode))
}

// ---------- mapa de calor ----------
export interface SlotAvailability {
  startMin: number
  endMin: number
  freeUserIds: string[]
}
export interface DayAvailability {
  day: DayKey
  date: string
  slots: SlotAvailability[]
}

/** Disponibilidad de todos los miembros, casilla a casilla (15 min), para una semana. */
export function groupAvailability(
  members: MemberSchedule[],
  weekStart: string,
  groupCode: string | null,
  win: ViewWindow,
  resolution = RESOLUTION
): DayAvailability[] {
  return win.days.map((day) => {
    const date = getDateForDay(weekStart, day)
    const busyByUser = members.map((m) => ({ id: m.userId, busy: busyIntervalsForDate(m, date, groupCode) }))
    const slots: SlotAvailability[] = []
    for (let s = win.startMin; s < win.endMin; s += resolution) {
      const e = Math.min(s + resolution, win.endMin)
      slots.push({
        startMin: s,
        endMin: e,
        freeUserIds: busyByUser.filter((u) => !overlaps(u.busy, s, e)).map((u) => u.id),
      })
    }
    return { day, date, slots }
  })
}

// ---------- mejor momento para quedar ----------
/**
 * Las mejores franjas de `durationMin` minutos: las que dejan libre a más gente durante TODA la franja.
 * Orden: más gente libre, luego fecha/hora más temprana. Las propuestas no se solapan entre sí.
 */
export function bestSlots(
  members: MemberSchedule[],
  weekStart: string,
  groupCode: string | null,
  win: ViewWindow,
  durationMin: number,
  limit = 3,
  resolution = RESOLUTION,
  minFree = 2,
  after?: { date: string; min: number } // no proponer nada anterior a este instante
): Candidate[] {
  const total = members.length
  const all: Candidate[] = []

  for (const day of win.days) {
    const date = getDateForDay(weekStart, day)
    const busyByUser = members.map((m) => ({ id: m.userId, busy: busyIntervalsForDate(m, date, groupCode) }))
    for (let s = win.startMin; s + durationMin <= win.endMin; s += resolution) {
      const e = s + durationMin
      const free = busyByUser.filter((u) => !overlaps(u.busy, s, e)).map((u) => u.id)
      if (after && (date < after.date || (date === after.date && s < after.min))) continue
      if (free.length >= Math.min(minFree, total)) {
        all.push({ date, day, startMin: s, endMin: e, freeUserIds: free, total })
      }
    }
  }

  all.sort(
    (a, b) =>
      b.freeUserIds.length - a.freeUserIds.length ||
      (a.date < b.date ? -1 : a.date > b.date ? 1 : 0) ||
      a.startMin - b.startMin
  )

  const picked: Candidate[] = []
  for (const c of all) {
    if (picked.length >= limit) break
    const clash = picked.some((p) => p.date === c.date && p.startMin < c.endMin && c.startMin < p.endMin)
    if (!clash) picked.push(c)
  }
  return picked
}
