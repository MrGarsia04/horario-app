import { describe, it, expect } from 'vitest'
import { getWeekStart, addWeeks, getDateForDay, formatWeekLabel, resolveScheduleForWeek, todayISO, defaultWeek, formatWeekLabelShort } from './weeks'

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

describe('todayISO / defaultWeek / formatWeekLabelShort', () => {
  it('todayISO usa la fecha local', () => {
    expect(todayISO(new Date(2026, 10, 15, 23, 59))).toBe('2026-11-15')
    expect(todayISO(new Date(2026, 0, 1, 0, 1))).toBe('2026-01-01')
  })
  it('defaultWeek: entre semana es la actual', () => {
    expect(defaultWeek(new Date(2026, 10, 11))).toBe('2026-11-09') // miércoles
    expect(defaultWeek(new Date(2026, 10, 9))).toBe('2026-11-09') // lunes
    expect(defaultWeek(new Date(2026, 10, 13))).toBe('2026-11-09') // viernes
  })
  it('defaultWeek: en fin de semana salta a la siguiente', () => {
    expect(defaultWeek(new Date(2026, 10, 14))).toBe('2026-11-16') // sábado
    expect(defaultWeek(new Date(2026, 10, 15))).toBe('2026-11-16') // domingo
  })
  it('formatWeekLabelShort cabe en una línea y sirve para meses distintos', () => {
    expect(formatWeekLabelShort('2026-11-09')).toMatch(/^9–15 nov/)
    expect(formatWeekLabelShort('2026-11-30')).toMatch(/^30 nov – 6 dic/)
  })
})
