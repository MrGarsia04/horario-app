import { describe, it, expect } from 'vitest'
import {
  bestSlots, busyIntervalsForDate, dayKeyOf, groupAvailability, mergeIntervals, subtractInterval, toLabel, toMinutes, weekParity,
} from './availability'
import type { Block, Exception, MemberSchedule, Template } from './types'

// Semana de prueba: lunes 2026-11-09 … domingo 2026-11-15
const W1 = '2026-11-09'
const W2 = '2026-11-16'

const tpl = (over: Partial<Template> = {}): Template => ({
  id: 't1', user_id: 'u', name: 'Mi horario', is_active: true, active_from: null, active_to: null, ...over,
})
let n = 0
const block = (over: Partial<Block>): Block => ({
  id: `b${n++}`, template_id: 't1', user_id: 'u', group_code: null, title: null, color: null, location: null,
  day: 'mon', start_min: 540, end_min: 630, repeat: 'weekly', valid_from: null, valid_to: null, ...over,
})
const exc = (over: Partial<Exception>): Exception => ({
  id: `e${n++}`, user_id: 'u', group_code: null, date: '2026-11-09', kind: 'free', start_min: null, end_min: null, title: null, ...over,
})
const member = (id: string, over: Partial<MemberSchedule> = {}): MemberSchedule => ({
  userId: id, name: id, mode: 'blocks', visibility: 'busy', blocks: [], templates: [tpl()], exceptions: [],
  legacyBase: [], legacyOverrides: [], ...over,
})

describe('tiempo', () => {
  it('convierte HH:MM <-> minutos', () => {
    expect(toMinutes('09:30')).toBe(570)
    expect(toLabel(570)).toBe('09:30')
    expect(toLabel(0)).toBe('00:00')
  })
  it('dayKeyOf', () => {
    expect(dayKeyOf('2026-11-09')).toBe('mon')
    expect(dayKeyOf('2026-11-15')).toBe('sun')
  })
  it('weekParity alterna cada semana y cruza años', () => {
    expect(weekParity(W1)).not.toBe(weekParity(W2))
    expect(weekParity(W1)).toBe(weekParity('2026-11-23'))
    expect(weekParity('2026-12-28')).not.toBe(weekParity('2027-01-04'))
  })
})

describe('intervalos', () => {
  it('mergeIntervals fusiona solapes y contiguos', () => {
    expect(mergeIntervals([{ start: 60, end: 120 }, { start: 100, end: 150 }, { start: 150, end: 180 }, { start: 300, end: 330 }]))
      .toEqual([{ start: 60, end: 180 }, { start: 300, end: 330 }])
  })
  it('subtractInterval parte o recorta', () => {
    expect(subtractInterval([{ start: 60, end: 180 }], { start: 90, end: 120 }))
      .toEqual([{ start: 60, end: 90 }, { start: 120, end: 180 }])
    expect(subtractInterval([{ start: 60, end: 180 }], { start: 0, end: 200 })).toEqual([])
  })
})

describe('busyIntervalsForDate (bloques)', () => {
  it('bloque semanal: solo su día', () => {
    const m = member('u', { blocks: [block({ day: 'mon' })] })
    expect(busyIntervalsForDate(m, '2026-11-09', null)).toEqual([{ start: 540, end: 630 }])
    expect(busyIntervalsForDate(m, '2026-11-10', null)).toEqual([])
  })
  it('quincenal: solo en las semanas de su paridad', () => {
    const parityW1 = weekParity(W1)
    const m = member('u', { blocks: [block({ repeat: parityW1 === 'a' ? 'biweekly_a' : 'biweekly_b' })] })
    expect(busyIntervalsForDate(m, '2026-11-09', null)).toHaveLength(1)
    expect(busyIntervalsForDate(m, '2026-11-16', null)).toHaveLength(0)
    expect(busyIntervalsForDate(m, '2026-11-23', null)).toHaveLength(1)
  })
  it('validez por fechas del bloque', () => {
    const m = member('u', { blocks: [block({ valid_from: '2026-11-10', valid_to: '2026-11-20' })] })
    expect(busyIntervalsForDate(m, '2026-11-09', null)).toHaveLength(0)
    expect(busyIntervalsForDate(m, '2026-11-16', null)).toHaveLength(1)
    expect(busyIntervalsForDate(m, '2026-11-23', null)).toHaveLength(0)
  })
  it('bloques de un grupo concreto no cuentan en otro; los personales sí en todos', () => {
    const m = member('u', { blocks: [block({ group_code: 'x' }), block({ group_code: null, start_min: 800, end_min: 860 })] })
    expect(busyIntervalsForDate(m, '2026-11-09', 'x')).toHaveLength(2)
    expect(busyIntervalsForDate(m, '2026-11-09', 'y')).toEqual([{ start: 800, end: 860 }])
  })
  it('plantillas por fechas: solo cuenta la activa en esa fecha', () => {
    const m = member('u', {
      templates: [
        tpl({ id: 'clases', active_from: null, active_to: '2026-11-30' }),
        tpl({ id: 'examenes', active_from: '2026-12-01', active_to: null }),
      ],
      blocks: [
        block({ template_id: 'clases', start_min: 540, end_min: 600 }),
        block({ template_id: 'examenes', start_min: 700, end_min: 760 }),
      ],
    })
    expect(busyIntervalsForDate(m, '2026-11-09', null)).toEqual([{ start: 540, end: 600 }])
    expect(busyIntervalsForDate(m, '2026-12-07', null)).toEqual([{ start: 700, end: 760 }])
  })
  it('plantilla desactivada no cuenta', () => {
    const m = member('u', { templates: [tpl({ is_active: false })], blocks: [block({})] })
    expect(busyIntervalsForDate(m, '2026-11-09', null)).toEqual([])
  })
  it('varias plantillas activas a la vez se suman', () => {
    const m = member('u', {
      templates: [tpl({ id: 'a' }), tpl({ id: 'b' })],
      blocks: [block({ template_id: 'a', start_min: 540, end_min: 600 }), block({ template_id: 'b', start_min: 590, end_min: 660 })],
    })
    expect(busyIntervalsForDate(m, '2026-11-09', null)).toEqual([{ start: 540, end: 660 }])
  })
  it('excepción: día libre completo, rango libre y ocupación puntual', () => {
    const base = { blocks: [block({ start_min: 540, end_min: 720 })] }
    expect(busyIntervalsForDate(member('u', { ...base, exceptions: [exc({ kind: 'free' })] }), '2026-11-09', null)).toEqual([])
    expect(
      busyIntervalsForDate(member('u', { ...base, exceptions: [exc({ kind: 'free', start_min: 600, end_min: 660 })] }), '2026-11-09', null)
    ).toEqual([{ start: 540, end: 600 }, { start: 660, end: 720 }])
    expect(
      busyIntervalsForDate(member('u', { ...base, exceptions: [exc({ kind: 'busy', start_min: 900, end_min: 960 })] }), '2026-11-09', null)
    ).toEqual([{ start: 540, end: 720 }, { start: 900, end: 960 }])
  })
  it('la excepción solo afecta a su fecha y a su grupo', () => {
    const m = member('u', { blocks: [block({})], exceptions: [exc({ group_code: 'x' })] })
    expect(busyIntervalsForDate(m, '2026-11-09', 'x')).toEqual([])
    expect(busyIntervalsForDate(m, '2026-11-09', 'y')).toHaveLength(1)
    expect(busyIntervalsForDate(m, '2026-11-16', 'x')).toHaveLength(1)
  })
})

describe('busyIntervalsForDate (modo antiguo)', () => {
  it('usa schedules + overrides por semana', () => {
    const m = member('u', {
      mode: 'legacy',
      legacyBase: [{ day: 'mon', start: '09:00', end: '10:30' }],
      legacyOverrides: [{ week_start: W2, busy_slots: [{ day: 'mon', start: '12:00', end: '13:00' }] }],
    })
    expect(busyIntervalsForDate(m, '2026-11-09', null)).toEqual([{ start: 540, end: 630 }])
    expect(busyIntervalsForDate(m, '2026-11-16', null)).toEqual([{ start: 720, end: 780 }])
    expect(busyIntervalsForDate(m, '2026-11-23', null)).toEqual([{ start: 720, end: 780 }]) // se arrastra
  })
})

describe('groupAvailability y bestSlots con horarios distintos', () => {
  // A ocupado lunes 09:00–10:30, B ocupado lunes 10:00–11:00 (no encajan en una rejilla común)
  const A = member('A', { blocks: [block({ user_id: 'A', start_min: 540, end_min: 630 })] })
  const B = member('B', { blocks: [block({ user_id: 'B', start_min: 600, end_min: 660 })] })
  const win = { days: ['mon' as const], startMin: 540, endMin: 720 }

  it('calcula por minutos reales (15 min)', () => {
    const [mon] = groupAvailability([A, B], W1, null, win)
    const at = (min: number) => mon.slots.find((s) => s.startMin === min)!.freeUserIds
    expect(at(540)).toEqual(['B']) // 09:00 A ocupado
    expect(at(600)).toEqual([]) // 10:00 ambos
    expect(at(630)).toEqual(['A']) // 10:30 B sigue ocupado
    expect(at(660)).toEqual(['A', 'B']) // 11:00 libres
  })
  it('bestSlots devuelve las franjas con más gente libre y sin solaparse', () => {
    const r = bestSlots([A, B], W1, null, win, 60, 3)
    expect(r[0]).toMatchObject({ startMin: 660, endMin: 720 })
    expect(r[0].freeUserIds).toEqual(['A', 'B'])
    for (let i = 0; i < r.length; i++) for (let j = i + 1; j < r.length; j++) {
      expect(r[i].date === r[j].date && r[i].startMin < r[j].endMin && r[j].startMin < r[i].endMin).toBe(false)
    }
  })
  it('exige que estén libres TODA la franja', () => {
    // 60 min desde 09:30 pisaría el bloque de A
    const r = bestSlots([A, B], W1, null, win, 60, 10, 15, 2)
    expect(r.every((c) => c.startMin >= 660)).toBe(true)
  })
  it('sin franjas posibles: lista vacía', () => {
    expect(bestSlots([A, B], W1, null, win, 300, 3)).toEqual([])
  })
  it('mezcla miembros nuevos y antiguos', () => {
    const L = member('L', { mode: 'legacy', legacyBase: [{ day: 'mon', start: '11:00', end: '12:00' }] })
    const [mon] = groupAvailability([A, L], W1, null, win)
    expect(mon.slots.find((s) => s.startMin === 660)!.freeUserIds).toEqual(['A'])
  })
})

describe('bestSlots: no propone el pasado', () => {
  const A = member('A')
  const B = member('B')
  const win = { days: ['mon' as const, 'tue' as const], startMin: 540, endMin: 720 }
  it('descarta franjas anteriores al instante dado', () => {
    const r = bestSlots([A, B], W1, null, win, 60, 10, 15, 2, { date: '2026-11-10', min: 600 })
    expect(r.every((c) => c.date > '2026-11-10' || (c.date === '2026-11-10' && c.startMin >= 600))).toBe(true)
    expect(r.some((c) => c.date === '2026-11-09')).toBe(false)
  })
})
