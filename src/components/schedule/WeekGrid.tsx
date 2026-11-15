import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { toLabel } from '../../lib/schedule/availability'
import { canScroll, columnWidth, firstVisibleDay, scrollLeftForDay } from '../../lib/schedule/dayPager'
import type { Block, DayKey } from '../../lib/schedule/types'
import { IconLeft, IconRight, IconRepeat } from '../../ui/icons'
import { DAYS } from './constants'

const PX_PER_MIN = 0.8 // 48 px por hora
const DEFAULT_FROM = 7 * 60
const DEFAULT_TO = 22 * 60

/** Cuántos días caben cómodos: 3 en móvil, 5 en tablet, 7 en escritorio (sin scroll horizontal). */
function useDayCount() {
  const calc = () => (typeof window === 'undefined' ? 3 : window.innerWidth < 520 ? 3 : window.innerWidth < 900 ? 5 : 7)
  const [n, setN] = useState(calc)
  useEffect(() => {
    const on = () => setN(calc())
    window.addEventListener('resize', on)
    return () => window.removeEventListener('resize', on)
  }, [])
  return n
}

interface Props {
  blocksByDay: Record<string, Block[]>
  layerColor: (templateId: string) => string
  /** fechas de cada día (si hay semana concreta); sin ellas se muestran solo los nombres */
  dates?: Record<string, string> | null
  today?: string
  freeDays?: Set<string>
  /** día en el que abrir (índice 0-6) */
  initialDay?: number
  onEdit: (b: Block) => void
}

export default function WeekGrid({ blocksByDay, layerColor, dates = null, today, freeDays, initialDay = 0, onEdit }: Props) {
  const dayCount = useDayCount()
  const scroller = useRef<HTMLDivElement>(null)
  const [first, setFirst] = useState(Math.min(initialDay, 7 - dayCount))

  // Todas las columnas existen siempre; en móvil se ven 3 y el resto se alcanza DESLIZANDO el dedo, con scroll libre (sin saltos por día: se puede ir de una punta a otra de golpe)
  const shown = DAYS.flatMap((d) => blocksByDay[d.key] ?? [])
  const { from, to } = useMemo(() => ({
    from: Math.min(DEFAULT_FROM, Math.floor(Math.min(...shown.map((b) => b.start_min), DEFAULT_FROM) / 60) * 60),
    to: Math.max(DEFAULT_TO, Math.ceil(Math.max(...shown.map((b) => b.end_min), DEFAULT_TO) / 60) * 60),
  }), [shown])
  const height = (to - from) * PX_PER_MIN
  const reduced = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

  const colW = () => columnWidth(scroller.current?.clientWidth ?? 0, dayCount)
  const raf = useRef(0)
  const syncFirst = useCallback(() => {
    const el = scroller.current
    if (el) setFirst(firstVisibleDay(el.scrollLeft, columnWidth(el.clientWidth, dayCount), dayCount))
  }, [dayCount])

  // El aviso de qué días se ven se actualiza mientras se desplaza (como mucho una vez por fotograma)
  const onScroll = useCallback(() => {
    if (raf.current) return
    raf.current = requestAnimationFrame(() => {
      raf.current = 0
      syncFirst()
    })
  }, [syncFirst])
  useEffect(() => () => cancelAnimationFrame(raf.current), [])

  // Abrir en el día pedido (hoy, o el lunes) y recolocar si cambia el número de días visibles (girar el móvil, redimensionar)
  useLayoutEffect(() => {
    const el = scroller.current
    if (!el) return
    el.scrollLeft = scrollLeftForDay(initialDay, columnWidth(el.clientWidth, dayCount), dayCount)
    syncFirst()
  }, [initialDay, dayCount, syncFirst])

  // Las flechas mueven una «página» de días (3 en móvil) con scroll suave; el scroll libre con el dedo sigue sin encajar por día
  const move = (delta: number) => {
    const el = scroller.current
    if (el) el.scrollTo({ left: scrollLeftForDay(first + delta * dayCount, colW(), dayCount), behavior: reduced ? 'auto' : 'smooth' })
  }
  const can = canScroll(first, dayCount)
  const last = Math.min(6, first + dayCount - 1)

  return (
    <div>
      <div className="card relative !p-0 overflow-hidden" data-tour="week-grid">
        <div className="flex select-none">
          <div className="w-11 shrink-0 border-r border-board-line">
            <div className="h-11 border-b border-board-line" />
            <div className="relative" style={{ height }} aria-hidden="true">
              {Array.from({ length: Math.floor((to - from) / 60) }, (_, i) => (
                <span key={i} className="absolute right-1.5 font-mono text-[10px] text-board-cream/50" style={{ top: i * 60 * PX_PER_MIN + 2 }}>{toLabel(from + i * 60)}</span>
              ))}
            </div>
          </div>
          <div
            ref={scroller}
            onScroll={onScroll}
            className="min-w-0 flex-1 overflow-x-auto overscroll-x-contain"
            style={{ scrollbarWidth: 'none', WebkitOverflowScrolling: 'touch' }}
            aria-label="Días de la semana: desliza para ver más"
          >
            <div className="flex" style={{ width: `${(7 / dayCount) * 100}%` }}>
              {DAYS.map((d) => (
                <DayColumn
                  key={d.key}
                  dayKey={d.key}
                  label={d.short}
                  date={dates?.[d.key] ?? null}
                  isToday={Boolean(today) && dates?.[d.key] === today}
                  blocks={blocksByDay[d.key] ?? []}
                  layerColor={layerColor}
                  from={from}
                  to={to}
                  height={height}
                  hasFree={freeDays?.has(d.key) ?? false}
                  onEdit={onEdit}
                />
              ))}
            </div>
          </div>
        </div>

        {/* Flechas como alternativa (ratón, teclado y accesibilidad): siguen al scroll; en el móvil lo normal es deslizar con el dedo */}
        {can.left && <button onClick={() => move(-1)} className="absolute left-12 top-1.5 flex h-8 w-8 items-center justify-center rounded-full bg-board-bg/80 text-board-cream/70 hover:text-board-cream" aria-label="Días anteriores"><IconLeft className="h-4 w-4" /></button>}
        {can.right && <button onClick={() => move(1)} className="absolute right-1 top-1.5 flex h-8 w-8 items-center justify-center rounded-full bg-board-bg/80 text-board-cream/70 hover:text-board-cream" aria-label="Días siguientes"><IconRight className="h-4 w-4" /></button>}
      </div>
      {dayCount < 7 && (
        <p className="mt-2 text-center text-xs text-board-cream/50" role="status">
          {DAYS[first].short}–{DAYS[last].short} · desliza hacia los lados para ver más días
        </p>
      )}
    </div>
  )
}

interface ColProps {
  dayKey: DayKey
  label: string
  date: string | null
  isToday: boolean
  blocks: Block[]
  layerColor: (templateId: string) => string
  from: number
  to: number
  height: number
  hasFree: boolean
  onEdit: (b: Block) => void
}

function DayColumn({ dayKey, label, date, isToday, blocks, layerColor, from, to, height, hasFree, onEdit }: ColProps) {
  return (
    <div className="min-w-0 flex-1 border-l border-board-line first:border-l-0">
      <div className={`flex h-11 items-center justify-center border-b border-board-line px-0.5 ${isToday ? 'bg-board-amber/15' : ''}`}>
        <div className="text-center leading-tight">
          <div className={`text-xs font-semibold ${isToday ? 'text-board-amber' : ''}`}>{label}</div>
          <div className="font-mono text-[10px] text-board-cream/50">{date ? date.slice(8) : '\u00a0'}{hasFree ? ' · libre' : ''}</div>
        </div>
      </div>
      <div
        style={{ height, backgroundImage: 'linear-gradient(rgb(var(--board-line) / 0.6) 1px, transparent 1px)', backgroundSize: `100% ${60 * PX_PER_MIN}px` }}
        className="relative"
        data-testid={`col-${dayKey}`}
      >
        {blocks.map((b) => (
          <button
            key={b.id}
            onClick={() => onEdit(b)}
            style={{ top: (b.start_min - from) * PX_PER_MIN, height: Math.max((b.end_min - b.start_min) * PX_PER_MIN - 1, 16), backgroundColor: b.color ?? layerColor(b.template_id) }}
            className="absolute inset-x-0.5 overflow-hidden rounded-md px-1.5 py-0.5 text-left text-[11px] leading-tight text-white shadow-sm hover:brightness-110"
            aria-label={`${b.title ?? 'Bloque'} ${toLabel(b.start_min)}–${toLabel(b.end_min)}`}
          >
            <span className="block truncate font-semibold">{b.title ?? 'Ocupado'}</span>
            <span className="block truncate opacity-85">
              {toLabel(b.start_min)}–{toLabel(b.end_min)}
              {b.repeat !== 'weekly' && <IconRepeat className="ml-1 inline h-3 w-3" aria-label="Cada 2 semanas" />}
            </span>
            {b.location && <span className="block truncate opacity-85">{b.location}</span>}
          </button>
        ))}
      </div>
    </div>
  )
}
