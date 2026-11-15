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

// ---------- Capas: frecuencia, ancla, interruptor, fechas, excepciones por capa ----------
import { layerAppliesOnWeek, nextOccurrences, weeksBetween, activeTemplates } from './availability'

const layer = (over: Partial<Template> = {}): Template => tpl({ every_n_weeks: 1, anchor_week: null, ...over })

describe('capas: frecuencia', () => {
  it('weeksBetween cuenta semanas, también hacia atrás', () => {
    expect(weeksBetween('2026-11-09', '2026-11-30')).toBe(3)
    expect(weeksBetween('2026-11-30', '2026-11-09')).toBe(-3)
  })
  it('todas las semanas (1) o sin ancla: siempre toca', () => {
    expect(layerAppliesOnWeek(layer({ every_n_weeks: 1 }), W1)).toBe(true)
    expect(layerAppliesOnWeek(layer({ every_n_weeks: 3, anchor_week: null }), W1)).toBe(true)
  })
  it('cada 2 semanas desde el ancla: toca ancla, ancla+2, ancla+4…', () => {
    const l = layer({ every_n_weeks: 2, anchor_week: '2026-11-09' })
    expect([0, 1, 2, 3, 4].map((i) => layerAppliesOnWeek(l, addW(W1, i)))).toEqual([true, false, true, false, true])
  })
  it('cada 3 y cada 4 semanas', () => {
    const l3 = layer({ every_n_weeks: 3, anchor_week: '2026-11-09' })
    expect([0, 1, 2, 3, 4, 5, 6].map((i) => layerAppliesOnWeek(l3, addW(W1, i)))).toEqual([true, false, false, true, false, false, true])
    const l4 = layer({ every_n_weeks: 4, anchor_week: '2026-11-23' })
    expect(layerAppliesOnWeek(l4, '2026-11-23')).toBe(true)
    expect(layerAppliesOnWeek(l4, '2026-12-21')).toBe(true)
    expect(layerAppliesOnWeek(l4, '2026-12-14')).toBe(false)
  })
  it('también cuenta hacia atrás desde el ancla (semanas anteriores)', () => {
    const l = layer({ every_n_weeks: 2, anchor_week: '2026-11-23' })
    expect(layerAppliesOnWeek(l, '2026-11-09')).toBe(true)
    expect(layerAppliesOnWeek(l, '2026-11-02')).toBe(false)
  })
  it('el ancla puede ser cualquier día de la semana (se normaliza al lunes)', () => {
    const l = layer({ every_n_weeks: 2, anchor_week: '2026-11-11' }) // miércoles
    expect(layerAppliesOnWeek(l, '2026-11-09')).toBe(true)
  })
  it('nextOccurrences lista las próximas semanas en que toca', () => {
    const l = layer({ every_n_weeks: 3, anchor_week: '2026-11-09' })
    expect(nextOccurrences(l, '2026-11-16', 3)).toEqual(['2026-11-30', '2026-12-21', '2027-01-11'])
    expect(nextOccurrences(l, '2026-11-12', 1)).toEqual(['2026-11-09']) // normaliza al lunes de esa semana
  })
})

function addW(w: string, n: number) {
  const d = new Date(w + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() + 7 * n)
  return d.toISOString().slice(0, 10)
}

describe('capas: disponibilidad', () => {
  const mondayBlock = (templateId: string, s = 540, e = 600) => block({ template_id: templateId, day: 'mon', start_min: s, end_min: e })

  it('una capa quincenal solo ocupa en sus semanas', () => {
    const m = member('u', {
      templates: [layer({ id: 'base' }), layer({ id: 'q', every_n_weeks: 2, anchor_week: W1 })],
      blocks: [mondayBlock('base', 540, 600), mondayBlock('q', 700, 760)],
    })
    expect(busyIntervalsForDate(m, '2026-11-09', null)).toEqual([{ start: 540, end: 600 }, { start: 700, end: 760 }])
    expect(busyIntervalsForDate(m, '2026-11-16', null)).toEqual([{ start: 540, end: 600 }])
    expect(busyIntervalsForDate(m, '2026-11-23', null)).toHaveLength(2)
  })
  it('capa desactivada: no cuenta, aunque toque esa semana', () => {
    const m = member('u', { templates: [layer({ id: 'q', every_n_weeks: 2, anchor_week: W1, is_active: false })], blocks: [mondayBlock('q')] })
    expect(busyIntervalsForDate(m, '2026-11-09', null)).toEqual([])
    expect(activeTemplates(m.templates, '2026-11-09')).toEqual([])
  })
  it('frecuencia + fechas de la capa: ambas condiciones', () => {
    const m = member('u', { templates: [layer({ id: 'q', every_n_weeks: 2, anchor_week: W1, active_from: '2026-11-20' })], blocks: [mondayBlock('q')] })
    expect(busyIntervalsForDate(m, '2026-11-09', null)).toEqual([]) // toca pero aún no ha empezado
    expect(busyIntervalsForDate(m, '2026-11-16', null)).toEqual([]) // no toca
    expect(busyIntervalsForDate(m, '2026-11-23', null)).toHaveLength(1)
  })
  it('excepción dirigida a una capa: libera solo esa capa', () => {
    const m = member('u', {
      templates: [layer({ id: 'a' }), layer({ id: 'b' })],
      blocks: [mondayBlock('a', 540, 600), mondayBlock('b', 700, 760)],
      exceptions: [exc({ kind: 'free', template_id: 'a' })],
    })
    expect(busyIntervalsForDate(m, '2026-11-09', null)).toEqual([{ start: 700, end: 760 }])
  })
  it('excepción sin capa: afecta a todo', () => {
    const m = member('u', {
      templates: [layer({ id: 'a' }), layer({ id: 'b' })],
      blocks: [mondayBlock('a', 540, 600), mondayBlock('b', 700, 760)],
      exceptions: [exc({ kind: 'free' })],
    })
    expect(busyIntervalsForDate(m, '2026-11-09', null)).toEqual([])
  })
  it('mapa del grupo y mejores franjas con capas distintas por persona', () => {
    const A = member('A', { templates: [layer({ id: 'qa', user_id: 'A', every_n_weeks: 2, anchor_week: W1 })], blocks: [block({ template_id: 'qa', user_id: 'A', day: 'mon', start_min: 600, end_min: 720 })] })
    const B = member('B', { templates: [layer({ id: 'wb', user_id: 'B' })], blocks: [block({ template_id: 'wb', user_id: 'B', day: 'mon', start_min: 540, end_min: 660 })] })
    const win = { days: ['mon' as const], startMin: 540, endMin: 780 }
    // Semana W1: A ocupado 10-12, B 9-11 → libres juntos desde 12:00
    expect(bestSlots([A, B], W1, null, win, 60, 1)[0]).toMatchObject({ startMin: 720, endMin: 780, freeUserIds: ['A', 'B'] })
    // Semana W2: a A no le toca → solo B ocupado hasta 11:00; los dos libres desde 11:00
    expect(bestSlots([A, B], W2, null, win, 60, 1)[0]).toMatchObject({ startMin: 660, endMin: 720 })
    const [mon] = groupAvailability([A, B], W2, null, win)
    expect(mon.slots.find((s) => s.startMin === 600)!.freeUserIds).toEqual(['A'])
  })
  it('compatibilidad: bloques con repetición A/B de antes siguen funcionando', () => {
    const p = weekParity(W1)
    const m = member('u', { templates: [layer({ id: 'x' })], blocks: [block({ template_id: 'x', repeat: p === 'a' ? 'biweekly_a' : 'biweekly_b' })] })
    expect(busyIntervalsForDate(m, W1, null)).toHaveLength(1)
    expect(busyIntervalsForDate(m, W2, null)).toHaveLength(0)
  })
})

// ---------- Franjas de 1 h / 30 min ----------
import { cellAvailability } from './availability'

describe('cellAvailability (franjas)', () => {
  // A ocupado 09:30–10:00 (media hora); B ocupado 09:00–11:00; C libre todo
  const A = member('A', { blocks: [block({ user_id: 'A', start_min: 570, end_min: 600 })] })
  const B = member('B', { blocks: [block({ user_id: 'B', start_min: 540, end_min: 660 })] })
  const C = member('C')
  const win = { days: ['mon' as const], startMin: 540, endMin: 720 }

  it('franja de 1 h: libres TODA la hora, solo parte y ocupados', () => {
    const [mon] = cellAvailability([A, B, C], W1, null, win, 60)
    const nueve = mon.cells[0] // 09:00–10:00
    expect(nueve.full).toEqual(['C'])
    expect(nueve.partial).toEqual([{ userId: 'A', freeMin: 30, freeRanges: [{ start: 540, end: 570 }, { start: 600, end: 600 }].filter((r) => r.end > r.start) }])
    expect(nueve.busy).toEqual(['B'])
  })
  it('los tramos libres parciales son correctos (hueco en medio)', () => {
    const X = member('X', { blocks: [block({ user_id: 'X', start_min: 570, end_min: 600 })] })
    const [mon] = cellAvailability([X], W1, null, win, 60)
    expect(mon.cells[0].partial[0].freeRanges).toEqual([{ start: 540, end: 570 }])
    const Y = member('Y', { blocks: [block({ user_id: 'Y', start_min: 560, end_min: 580 })] })
    expect(cellAvailability([Y], W1, null, win, 60)[0].cells[0].partial[0].freeRanges).toEqual([{ start: 540, end: 560 }, { start: 580, end: 600 }])
  })
  it('la misma persona pasa de «parcial» a «libre» al afinar a 30 min', () => {
    const [m60] = cellAvailability([A], W1, null, win, 60)
    const [m30] = cellAvailability([A], W1, null, win, 30)
    expect(m60.cells[0].partial.map((p) => p.userId)).toEqual(['A'])
    expect(m30.cells[0].full).toEqual(['A']) // 09:00–09:30 libre
    expect(m30.cells[1].busy).toEqual(['A']) // 09:30–10:00 ocupado
  })
  it('hay una franja por cada tramo de la ventana (y la última se recorta)', () => {
    const [mon] = cellAvailability([C], W1, null, { days: ['mon'], startMin: 540, endMin: 690 }, 60)
    expect(mon.cells.map((c) => [c.startMin, c.endMin])).toEqual([[540, 600], [600, 660], [660, 690]])
  })
  it('cada miembro cae en exactamente una categoría', () => {
    const [mon] = cellAvailability([A, B, C], W1, null, win, 60)
    for (const c of mon.cells) expect(c.full.length + c.partial.length + c.busy.length).toBe(3)
  })
  it('mezcla modelo antiguo y bloques', () => {
    const L = member('L', { mode: 'legacy', legacyBase: [{ day: 'mon', start: '09:00', end: '09:45' }] })
    const [mon] = cellAvailability([L], W1, null, win, 60)
    expect(mon.cells[0].partial[0]).toMatchObject({ userId: 'L', freeMin: 15 })
  })
})

// ---------- Ventana automática ----------
import { autoWindow, SOCIAL_WINDOW } from './availability'

describe('autoWindow', () => {
  it('sin horarios: lunes a viernes de 8:00 a 20:00', () => {
    expect(autoWindow([member('A')], W1, null)).toEqual({ days: ['mon', 'tue', 'wed', 'thu', 'fri'], startMin: 480, endMin: 1200 })
  })
  it('se amplía con 1 h de margen sobre el horario de cualquiera (redondeado a horas)', () => {
    const m = member('A', { blocks: [block({ user_id: 'A', day: 'tue', start_min: 7 * 60 + 15, end_min: 21 * 60 + 30 })] })
    const w = autoWindow([m], W1, null)
    expect(w.startMin).toBe(6 * 60) // 7:15 → 7:00 − 1 h
    expect(w.endMin).toBe(23 * 60) // 21:30 → 22:00 + 1 h
  })
  it('no baja de las 6:00 ni sube de las 24:00', () => {
    const m = member('A', { blocks: [block({ user_id: 'A', start_min: 120, end_min: 1440 })] })
    const w = autoWindow([m], W1, null)
    expect(w.startMin).toBe(360)
    expect(w.endMin).toBe(1440)
  })
  it('incluye sábado/domingo solo si alguien tiene algo', () => {
    const m = member('A', { blocks: [block({ user_id: 'A', day: 'sat', start_min: 600, end_min: 700 })] })
    expect(autoWindow([m], W1, null).days).toEqual(['mon', 'tue', 'wed', 'thu', 'fri', 'sat'])
  })
  it('usa lo que cuenta ESA semana (capas quincenales, apagadas…)', () => {
    const m = member('A', { templates: [layer({ id: 'q', every_n_weeks: 2, anchor_week: W1 })], blocks: [block({ template_id: 'q', user_id: 'A', day: 'sat', start_min: 600, end_min: 700 })] })
    expect(autoWindow([m], W1, null).days).toContain('sat')
    expect(autoWindow([m], W2, null).days).not.toContain('sat')
  })
  it('la ventana social es de 9:00 a 22:00 todos los días', () => {
    expect(SOCIAL_WINDOW.days).toHaveLength(7)
    expect([SOCIAL_WINDOW.startMin, SOCIAL_WINDOW.endMin]).toEqual([540, 1320])
  })
})
