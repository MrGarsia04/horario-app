import { describe, it, expect } from 'vitest'
import { buildSteps, nextIndex, progress } from './tourSteps'

describe('buildSteps', () => {
  it('con grupo: inicio, ajustes, capas, bloque, mapa, planes y cierre, en ese orden', () => {
    const s = buildSteps('informaticos')
    expect(s.map((x) => x.id)).toEqual(['inicio', 'ajustes', 'capas', 'bloque', 'mapa', 'planes', 'fin'])
  })
  it('cada paso con elemento declara su ruta salvo los de la cabecera, y el inicio/cierre no señalan nada', () => {
    const s = buildSteps('uni')
    expect(s[0].target).toBeUndefined()
    expect(s[s.length - 1].target).toBeUndefined()
    expect(s.find((x) => x.id === 'ajustes')!.path).toBeUndefined()
    expect(s.find((x) => x.id === 'mapa')!.path).toBe('/g/uni/grupo')
    expect(s.find((x) => x.id === 'planes')!.path).toBe('/planes')
  })
  it('el código de grupo se codifica en la ruta', () => {
    expect(buildSteps('ing 4b/x').find((x) => x.id === 'capas')!.path).toBe('/g/ing%204b%2Fx')
  })
  it('sin grupo solo enseña lo que existe sin grupo', () => {
    expect(buildSteps(null).map((x) => x.id)).toEqual(['inicio', 'ajustes', 'grupos', 'fin'])
  })
})

describe('nextIndex', () => {
  const steps = buildSteps('uni')
  const all = () => true
  it('avanza y retrocede de uno en uno si todo está disponible', () => {
    expect(nextIndex(steps, 0, 1, all)).toBe(1)
    expect(nextIndex(steps, 3, -1, all)).toBe(2)
  })
  it('salta los pasos cuyo elemento no existe', () => {
    const noMap = (s: (typeof steps)[number]) => s.id !== 'mapa'
    expect(nextIndex(steps, 3, 1, noMap)).toBe(steps.findIndex((s) => s.id === 'planes'))
    expect(nextIndex(steps, steps.findIndex((s) => s.id === 'planes'), -1, noMap)).toBe(3)
  })
  it('salta varios seguidos y llega al cierre aunque no exista ningún elemento', () => {
    expect(nextIndex(steps, 1, 1, () => false)).toBe(steps.length - 1)
  })
  it('devuelve null al salirse por cualquiera de los dos extremos', () => {
    expect(nextIndex(steps, steps.length - 1, 1, all)).toBeNull()
    expect(nextIndex(steps, 0, -1, all)).toBeNull()
  })
  it('hacia atrás desde el primer paso con elemento llega al inicio', () => {
    expect(nextIndex(steps, 2, -1, () => false)).toBe(0)
  })
})

describe('progress', () => {
  const steps = buildSteps('uni')
  it('cuenta solo los pasos que se pueden mostrar', () => {
    expect(progress(steps, 0, () => true)).toEqual({ n: 1, total: 7 })
    const sinMapa = (s: (typeof steps)[number]) => s.id !== 'mapa'
    expect(progress(steps, steps.findIndex((s) => s.id === 'planes'), sinMapa)).toEqual({ n: 5, total: 6 })
  })
})
