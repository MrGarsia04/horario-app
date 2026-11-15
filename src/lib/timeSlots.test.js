import { describe, it, expect } from 'vitest'
import { DEFAULT_CONFIG, buildRows, getDaysForConfig, intervalsOverlap, isBusyAt } from './timeSlots'

describe('buildRows', () => {
  it('genera franjas y respeta el descanso de la config por defecto', () => {
    const rows = buildRows(DEFAULT_CONFIG)
    expect(rows[0]).toEqual({ type: 'class', start: '09:00', end: '10:30' })
    // la franja 10:30–12:00 y luego 12:00–13:30 termina justo donde empieza el descanso
    expect(rows).toContainEqual({ type: 'break', start: '13:30', end: '14:00' })
    expect(rows.at(-1).end).toBe('18:30')
  })
  it('acorta la franja que choca con un descanso', () => {
    const rows = buildRows({ days: ['mon'], startTime: '09:00', endTime: '12:00', slotMinutes: 120, breaks: [{ start: '10:00', end: '10:30' }] })
    expect(rows).toEqual([
      { type: 'class', start: '09:00', end: '10:00' },
      { type: 'break', start: '10:00', end: '10:30' },
      { type: 'class', start: '10:30', end: '12:00' },
    ])
  })
  it('sin descansos solo hay franjas de clase', () => {
    const rows = buildRows({ days: ['mon'], startTime: '08:00', endTime: '10:00', slotMinutes: 60 })
    expect(rows).toHaveLength(2)
    expect(rows.every((r) => r.type === 'class')).toBe(true)
  })
  it('la última franja se recorta al final', () => {
    const rows = buildRows({ days: ['mon'], startTime: '08:00', endTime: '09:30', slotMinutes: 60 })
    expect(rows.at(-1)).toEqual({ type: 'class', start: '09:00', end: '09:30' })
  })
})

describe('getDaysForConfig', () => {
  it('filtra y conserva el orden de la semana', () => {
    expect(getDaysForConfig({ days: ['fri', 'mon'] }).map((d) => d.key)).toEqual(['mon', 'fri'])
  })
})

describe('intervalsOverlap', () => {
  it('detecta solapes', () => {
    expect(intervalsOverlap('09:00', '10:00', '09:30', '10:30')).toBe(true)
    expect(intervalsOverlap('09:00', '10:00', '09:00', '10:00')).toBe(true)
  })
  it('intervalos contiguos no se solapan', () => {
    expect(intervalsOverlap('09:00', '10:00', '10:00', '11:00')).toBe(false)
  })
})

describe('isBusyAt', () => {
  const schedule = [{ day: 'mon', start: '09:00', end: '10:30' }]
  it('ocupado solo el día y la franja correctos', () => {
    expect(isBusyAt(schedule, 'mon', '10:00', '11:00')).toBe(true)
    expect(isBusyAt(schedule, 'tue', '09:00', '10:30')).toBe(false)
    expect(isBusyAt(schedule, 'mon', '10:30', '12:00')).toBe(false)
  })
  it('tolera horario nulo', () => {
    expect(isBusyAt(null, 'mon', '09:00', '10:00')).toBe(false)
  })
})
