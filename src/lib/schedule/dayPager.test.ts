import { describe, it, expect } from 'vitest'
import { canScroll, columnWidth, firstVisibleDay, scrollLeftForDay } from './dayPager'

describe('dayPager (3 días visibles)', () => {
  const w = 100 // ancho de una columna
  it('primer día visible según el desplazamiento, redondeando al día más cercano', () => {
    expect(firstVisibleDay(0, w, 3)).toBe(0)
    expect(firstVisibleDay(40, w, 3)).toBe(0)
    expect(firstVisibleDay(60, w, 3)).toBe(1)
    expect(firstVisibleDay(300, w, 3)).toBe(3)
  })
  it('nunca pasa del último grupo de días (con 3 visibles, el primero máximo es el 5.º: Vie–Dom)', () => {
    expect(firstVisibleDay(9999, w, 3)).toBe(4)
    expect(firstVisibleDay(-50, w, 3)).toBe(0)
  })
  it('con todos los días visibles no hay desplazamiento', () => {
    expect(firstVisibleDay(500, w, 7)).toBe(0)
    expect(scrollLeftForDay(3, w, 7)).toBe(0)
  })
  it('scrollLeftForDay abre en un día concreto y lo acota', () => {
    expect(scrollLeftForDay(2, w, 3)).toBe(200)
    expect(scrollLeftForDay(6, w, 3)).toBe(400) // domingo → empieza en el viernes (4 columnas a la izquierda)
    expect(scrollLeftForDay(-1, w, 3)).toBe(0)
  })
  it('ida y vuelta: scrollLeftForDay y firstVisibleDay son coherentes', () => {
    for (let d = 0; d <= 4; d++) expect(firstVisibleDay(scrollLeftForDay(d, w, 3), w, 3)).toBe(d)
  })
  it('columnWidth reparte el ancho entre los días visibles', () => {
    expect(columnWidth(300, 3)).toBe(100)
    expect(columnWidth(700, 7)).toBe(100)
    expect(columnWidth(500, 0)).toBe(500)
  })
  it('canScroll indica si hay más días a cada lado', () => {
    expect(canScroll(0, 3)).toEqual({ left: false, right: true })
    expect(canScroll(2, 3)).toEqual({ left: true, right: true })
    expect(canScroll(4, 3)).toEqual({ left: true, right: false })
    expect(canScroll(0, 7)).toEqual({ left: false, right: false })
  })
})
