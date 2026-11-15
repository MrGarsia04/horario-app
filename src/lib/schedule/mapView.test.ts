import { describe, it, expect, beforeEach } from 'vitest'
import { daysLabel, effectiveWindow, hasHiddenBusy, hoursLabel, loadMapView, mapViewKey, sanitizeMapView, saveMapView } from './mapView'
import { cellAvailability } from './availability'
import type { Block, MemberSchedule } from './types'

const AUTO = { days: ['mon', 'tue', 'wed', 'thu', 'fri'] as ('mon' | 'tue' | 'wed' | 'thu' | 'fri')[], startMin: 480, endMin: 1200 }
const W1 = '2026-11-09'
const blk = (over: Partial<Block>): Block => ({ id: 'b' + Math.random(), template_id: 't', user_id: 'u', group_code: null, title: null, color: null, location: null, day: 'mon', start_min: 540, end_min: 600, repeat: 'weekly', valid_from: null, valid_to: null, ...over })
const mem = (blocks: Block[]): MemberSchedule => ({ userId: 'u', name: 'u', mode: 'blocks', visibility: 'busy', legacyBase: [], legacyOverrides: [], exceptions: [], blocks, templates: [{ id: 't', user_id: 'u', name: 'x', is_active: true, active_from: null, active_to: null }] })

describe('sanitizeMapView', () => {
  it('acepta una vista válida y ordena los días de lunes a domingo', () => {
    expect(sanitizeMapView({ days: ['fri', 'mon', 'sat'], startMin: 600, endMin: 1320 })).toEqual({ days: ['mon', 'fri', 'sat'], startMin: 600, endMin: 1320 })
  })
  it('admite medias horas y redondea a pasos de 30 min', () => {
    expect(sanitizeMapView({ days: ['mon'], startMin: 570, endMin: 1230 })).toEqual({ days: ['mon'], startMin: 570, endMin: 1230 })
    expect(sanitizeMapView({ days: ['mon'], startMin: 575, endMin: 1201 })).toEqual({ days: ['mon'], startMin: 570, endMin: 1230 })
  })
  it('acota a 0–24 h', () => {
    expect(sanitizeMapView({ days: ['mon'], startMin: -50, endMin: 9999 })).toEqual({ days: ['mon'], startMin: 0, endMin: 1440 })
  })
  it('descarta lo inválido: sin días, rango al revés o datos raros', () => {
    expect(sanitizeMapView({ days: [], startMin: 480, endMin: 1200 })).toBeNull()
    expect(sanitizeMapView({ days: ['mon'], startMin: 1200, endMin: 480 })).toBeNull()
    expect(sanitizeMapView({ days: ['xxx'], startMin: 480, endMin: 1200 })).toBeNull()
    expect(sanitizeMapView({ days: ['mon'], startMin: 'a', endMin: 1200 })).toBeNull()
    expect(sanitizeMapView(null)).toBeNull()
    expect(sanitizeMapView('texto')).toBeNull()
  })
})

describe('guardado por persona y grupo', () => {
  beforeEach(() => {
    const store = new Map<string, string>()
    ;(globalThis as unknown as { localStorage: unknown }).localStorage = {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
      removeItem: (k: string) => void store.delete(k),
    }
  })
  it('cada persona y cada grupo tiene su propia vista', () => {
    saveMapView(mapViewKey('ana', 'uni'), { days: ['mon'], startMin: 600, endMin: 1080 })
    expect(loadMapView(mapViewKey('ana', 'uni'))).toEqual({ days: ['mon'], startMin: 600, endMin: 1080 })
    expect(loadMapView(mapViewKey('ana', 'piso'))).toBeNull()
    expect(loadMapView(mapViewKey('beto', 'uni'))).toBeNull()
  })
  it('restablecer a automático borra la vista', () => {
    const k = mapViewKey('ana', 'uni')
    saveMapView(k, { days: ['mon'], startMin: 600, endMin: 1080 })
    saveMapView(k, null)
    expect(loadMapView(k)).toBeNull()
  })
  it('un valor corrupto en el almacenamiento se ignora', () => {
    const k = mapViewKey('ana', 'uni')
    localStorage.setItem(k, '{no es json')
    expect(loadMapView(k)).toBeNull()
    localStorage.setItem(k, JSON.stringify({ days: ['mon'], startMin: 900, endMin: 100 }))
    expect(loadMapView(k)).toBeNull()
  })
  it('la vista propia manda sobre la automática; sin ella, la automática', () => {
    expect(effectiveWindow(AUTO, null)).toEqual(AUTO)
    expect(effectiveWindow(AUTO, { days: ['sat'], startMin: 540, endMin: 900 })).toEqual({ days: ['sat'], startMin: 540, endMin: 900 })
  })
})

describe('etiquetas', () => {
  it('daysLabel', () => {
    expect(daysLabel(['mon', 'tue', 'wed', 'thu', 'fri'])).toBe('Lun–Vie')
    expect(daysLabel(['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'])).toBe('Toda la semana')
    expect(daysLabel(['mon', 'wed', 'fri'])).toBe('Lun, Mié, Vie')
    expect(daysLabel(['mon', 'tue'])).toBe('Lun, Mar')
    expect(daysLabel(['mon', 'tue', 'wed', 'sat'])).toBe('Lun–Mié, Sáb')
    expect(daysLabel(['sat'])).toBe('Sáb')
  })
  it('hoursLabel', () => {
    expect(hoursLabel(480, 1200)).toBe('8:00–20:00')
    expect(hoursLabel(570, 1230)).toBe('9:30–20:30')
  })
})

describe('hasHiddenBusy: aviso de que la vista oculta algo que cuenta', () => {
  const win = { days: ['mon', 'tue', 'wed', 'thu', 'fri'] as ('mon' | 'tue' | 'wed' | 'thu' | 'fri')[], startMin: 480, endMin: 1200 }
  it('false si todo cabe', () => {
    expect(hasHiddenBusy([mem([blk({ start_min: 540, end_min: 600 })])], W1, null, win)).toBe(false)
  })
  it('true si hay algo antes o después del rango', () => {
    expect(hasHiddenBusy([mem([blk({ start_min: 420, end_min: 500 })])], W1, null, win)).toBe(true)
    expect(hasHiddenBusy([mem([blk({ start_min: 1190, end_min: 1260 })])], W1, null, win)).toBe(true)
  })
  it('true si hay algo en un día que no se muestra', () => {
    expect(hasHiddenBusy([mem([blk({ day: 'sat' })])], W1, null, win)).toBe(true)
    expect(hasHiddenBusy([mem([blk({ day: 'sat' })])], W1, null, { ...win, days: [...win.days, 'sat'] })).toBe(false)
  })
  it('un bloque que justo toca el borde no se considera oculto', () => {
    expect(hasHiddenBusy([mem([blk({ start_min: 480, end_min: 1200 })])], W1, null, win)).toBe(false)
  })
  it('solo cuenta lo que realmente cae esa semana (capas apagadas o fechas fuera)', () => {
    const off = mem([blk({ day: 'sat' })])
    off.templates[0].is_active = false
    expect(hasHiddenBusy([off], W1, null, win)).toBe(false)
  })
})

describe('ocultar no rompe el cálculo', () => {
  it('con una ventana más estrecha, las franjas visibles dan lo mismo que en la ventana completa', () => {
    const m = mem([blk({ start_min: 600, end_min: 660 }), blk({ day: 'tue', start_min: 1300, end_min: 1380 })])
    const completa = cellAvailability([m], W1, null, { days: ['mon', 'tue'], startMin: 480, endMin: 1440 }, 60)
    const estrecha = cellAvailability([m], W1, null, { days: ['mon'], startMin: 540, endMin: 720 }, 60)
    const lunesCompleto = completa[0].cells.filter((c) => c.startMin >= 540 && c.endMin <= 720)
    expect(estrecha[0].cells).toEqual(lunesCompleto)
  })
})
