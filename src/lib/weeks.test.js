import { describe, it, expect } from 'vitest'
import { getWeekStart, addWeeks, getDateForDay, formatWeekLabel, resolveScheduleForWeek } from './weeks'

describe('getWeekStart', () => {
  it('devuelve el lunes para cualquier día de la semana', () => {
    expect(getWeekStart('2026-11-11')).toBe('2026-11-09') // miércoles
    expect(getWeekStart('2026-11-09')).toBe('2026-11-09') // lunes
  })
  it('el domingo pertenece a la semana que empezó el lunes anterior', () => {
    expect(getWeekStart('2026-11-15')).toBe('2026-11-09')
  })
  it('acepta objetos Date (hora local) sin desplazar el día', () => {
    expect(getWeekStart(new Date(2026, 10, 12, 23, 30))).toBe('2026-11-09')
  })
  it('cruza cambios de mes y de año', () => {
    expect(getWeekStart('2027-01-01')).toBe('2026-12-28')
  })
})

describe('addWeeks', () => {
  it('suma y resta semanas', () => {
    expect(addWeeks('2026-11-09', 1)).toBe('2026-11-16')
    expect(addWeeks('2026-11-09', -2)).toBe('2026-10-26')
  })
  it('no se ve afectado por el cambio de hora de octubre', () => {
    expect(addWeeks('2026-10-19', 2)).toBe('2026-11-02')
  })
})

describe('getDateForDay', () => {
  it('devuelve la fecha de cada día', () => {
    expect(getDateForDay('2026-11-09', 'mon')).toBe('2026-11-09')
    expect(getDateForDay('2026-11-09', 'sun')).toBe('2026-11-15')
  })
  it('un día desconocido cae en el lunes', () => {
    expect(getDateForDay('2026-11-09', 'xxx')).toBe('2026-11-09')
  })
})

describe('formatWeekLabel', () => {
  it('muestra el rango lunes–domingo', () => {
    const label = formatWeekLabel('2026-11-09')
    expect(label).toContain('2026')
    expect(label).toContain('–')
  })
})

describe('resolveScheduleForWeek', () => {
  const base = [{ day: 'mon', start: '09:00', end: '10:30' }]
  const ov1 = { week_start: '2026-11-09', busy_slots: [{ day: 'tue', start: '09:00', end: '10:30' }] }
  const ov2 = { week_start: '2026-11-23', busy_slots: [] }

  it('sin overrides usa el horario habitual', () => {
    expect(resolveScheduleForWeek(base, [], '2026-11-09')).toEqual({
      schedule: base,
      isCustomThisWeek: false,
      effectiveFrom: null,
    })
  })
  it('ignora overrides posteriores a la semana consultada', () => {
    expect(resolveScheduleForWeek(base, [ov1], '2026-11-02').schedule).toBe(base)
  })
  it('un override se arrastra a las semanas siguientes', () => {
    const r = resolveScheduleForWeek(base, [ov1], '2026-11-16')
    expect(r.schedule).toBe(ov1.busy_slots)
    expect(r.isCustomThisWeek).toBe(false)
    expect(r.effectiveFrom).toBe('2026-11-09')
  })
  it('usa el override más reciente aplicable', () => {
    const r = resolveScheduleForWeek(base, [ov2, ov1], '2026-11-23')
    expect(r.schedule).toEqual([])
    expect(r.isCustomThisWeek).toBe(true)
  })
  it('tolera base y overrides nulos', () => {
    expect(resolveScheduleForWeek(null, null, '2026-11-09').schedule).toEqual([])
  })
})
