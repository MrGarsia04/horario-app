import { useEffect, useMemo, useRef, useState } from 'react'
import { activeTemplates, blockApplies, toLabel, weekParity } from '../../lib/schedule/availability'
import { getDateForDay, todayISO } from '../../lib/weeks'
import type { Block, DayKey, Template } from '../../lib/schedule/types'
import { useMySchedule, useScheduleActions } from '../../hooks/useSchedules'
import BlockSheet, { type BlockDraft } from './BlockSheet'
import PlantillasTab from './PlantillasTab'
import WeekNavigator from '../WeekNavigator'
import Button from '../../ui/Button'
import { Tabs } from '../../ui/misc'
import { IconPlus, IconLeft, IconRight, IconRepeat } from '../../ui/icons'
import { DAYS, SNAP, snap } from './constants'

const PX_PER_MIN = 0.8 // 48 px por hora
const DEFAULT_FROM = 7 * 60
const DEFAULT_TO = 22 * 60

interface Props {
  userId: string
  groupCode: string
  weekStart: string
  onWeekChange: (w: string) => void
}

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

export default function ScheduleEditor({ userId, groupCode, weekStart, onWeekChange }: Props) {
  const mine = useMySchedule(userId)
  const actions = useScheduleActions(userId, groupCode)
  const [tab, setTab] = useState<'semana' | 'plantillas'>('semana')
  const [draft, setDraft] = useState<BlockDraft | null>(null)
  const [error, setError] = useState('')
  const creatingDefault = useRef(false)
  const dayCount = useDayCount()
  const today = todayISO()
  const todayIdx = DAYS.findIndex((d) => getDateForDay(weekStart, d.key) === today)
  const [startIdx, setStartIdx] = useState(0)
  const maxStart = 7 - dayCount
  const first = Math.min(startIdx, maxStart)

  const templates = mine.data?.templates ?? []
  const allBlocks = mine.data?.blocks ?? []
  const exceptions = mine.data?.exceptions ?? []

  // Primera vez: se crea una plantilla «Mi horario» para poder empezar a pintar bloques.
  useEffect(() => {
    if (!mine.data || templates.length > 0 || creatingDefault.current) return
    creatingDefault.current = true
    actions.createTemplate.mutateAsync({ name: 'Mi horario' }).catch((e) => setError(e.message))
  }, [mine.data, templates.length]) // eslint-disable-line react-hooks/exhaustive-deps

  // En móvil se abre en el día de hoy si la semana visible es la actual.
  useEffect(() => {
    // Se abre en hoy si es entre semana; si no, desde el lunes
    setStartIdx(todayIdx >= 0 && todayIdx <= 4 ? Math.min(todayIdx, 7 - dayCount) : 0)
  }, [weekStart, dayCount]) // eslint-disable-line react-hooks/exhaustive-deps

  const parity = weekParity(weekStart)
  const visible = DAYS.slice(first, first + dayCount)

  // Bloques que cuentan en la semana que se está viendo (plantillas activas, quincenal, validez)
  const blocksByDay = useMemo(() => {
    const out: Record<string, Block[]> = {}
    for (const d of DAYS) {
      const date = getDateForDay(weekStart, d.key)
      const ids = new Set(activeTemplates(templates, date).map((t) => t.id))
      out[d.key] = allBlocks.filter((b) => ids.has(b.template_id) && blockApplies(b, date, groupCode, parity))
    }
    return out
  }, [templates, allBlocks, weekStart, groupCode, parity])

  const shown = visible.flatMap((d) => blocksByDay[d.key])
  const from = Math.min(DEFAULT_FROM, Math.floor(Math.min(...shown.map((b) => b.start_min), DEFAULT_FROM) / 60) * 60)
  const to = Math.max(DEFAULT_TO, Math.ceil(Math.max(...shown.map((b) => b.end_min), DEFAULT_TO) / 60) * 60)
  const height = (to - from) * PX_PER_MIN
  const targetTemplate = templates.find((t) => t.is_active) ?? templates[0]

  async function guard(fn: () => Promise<unknown>) {
    setError('')
    try {
      await fn()
    } catch (e) {
      setError((e as Error).message)
    }
  }

  async function saveDraft(v: Omit<Block, 'id' | 'user_id' | 'template_id'> & { id?: string }) {
    const existing = v.id ? allBlocks.find((b) => b.id === v.id) : null
    const template_id = existing?.template_id ?? targetTemplate?.id
    if (!template_id) return
    await guard(async () => {
      await actions.saveBlock.mutateAsync({ ...v, template_id })
      setDraft(null)
    })
  }

  async function copyBlock(b: BlockDraft, days: DayKey[]) {
    const src = allBlocks.find((x) => x.id === b.id)
    if (!src) return
    await guard(async () => {
      const { id: _id, user_id: _u, ...rest } = src
      await actions.insertBlocks.mutateAsync(days.map((d) => ({ ...rest, day: d })))
      setDraft(null)
    })
  }

  async function duplicateTemplate(id: string) {
    const t = templates.find((x) => x.id === id)
    if (!t) return
    const copy = (await actions.createTemplate.mutateAsync({ name: `${t.name} (copia)`, is_active: false })) as Template
    const src = allBlocks.filter((b) => b.template_id === id)
    if (src.length) {
      await actions.insertBlocks.mutateAsync(src.map(({ id: _i, user_id: _u, template_id: _t, ...rest }) => ({ ...rest, template_id: copy.id })))
    }
  }

  if (mine.isLoading) return <p className="text-sm text-board-cream/50">Cargando tu horario…</p>
  if (mine.error) return <p className="text-sm text-board-danger">No se pudo cargar tu horario: {(mine.error as Error).message}</p>

  return (
    <div>
      <Tabs<'semana' | 'plantillas'>
        label="Secciones de mi horario"
        value={tab}
        onChange={setTab}
        items={[{ id: 'semana', label: 'Mi semana' }, { id: 'plantillas', label: 'Plantillas y fechas' }]}
      />

      {tab === 'plantillas' ? (
        <div className="mt-4">
          <PlantillasTab
            templates={templates}
            exceptions={exceptions}
            groupCode={groupCode}
            onCreate={async (name) => void (await actions.createTemplate.mutateAsync({ name }))}
            onUpdate={async (id, patch) => void (await actions.updateTemplate.mutateAsync({ id, ...patch }))}
            onDelete={async (id) => void (await actions.deleteTemplate.mutateAsync(id))}
            onDuplicate={duplicateTemplate}
            onAddException={async (v) => void (await actions.saveException.mutateAsync(v))}
            onDeleteException={async (id) => void (await actions.deleteException.mutateAsync(id))}
          />
        </div>
      ) : (
        <>
          <div className="mt-4 flex items-start justify-between gap-3">
            <div className="flex-1"><WeekNavigator weekStart={weekStart} onChange={onWeekChange} statusText={null} /></div>
            <Button icon={<IconPlus className="h-4 w-4" />} onClick={() => setDraft({ day: visible[0].key, start_min: 9 * 60, end_min: 10 * 60 })}>Bloque</Button>
          </div>

          <div className="card !p-0 overflow-hidden">
            <div className="flex select-none">
              <div className="w-11 shrink-0 border-r border-board-line">
                <div className="h-11 border-b border-board-line" />
                <div className="relative" style={{ height }} aria-hidden="true">
                  {Array.from({ length: Math.floor((to - from) / 60) }, (_, i) => (
                    <span key={i} className="absolute right-1.5 font-mono text-[10px] text-board-cream/50" style={{ top: i * 60 * PX_PER_MIN + 2 }}>{toLabel(from + i * 60)}</span>
                  ))}
                </div>
              </div>
              {visible.map((d, idx) => (
                <DayColumn
                  key={d.key}
                  dayKey={d.key}
                  label={d.short}
                  date={getDateForDay(weekStart, d.key)}
                  isToday={getDateForDay(weekStart, d.key) === today}
                  blocks={blocksByDay[d.key]}
                  from={from}
                  to={to}
                  height={height}
                  hasFree={exceptions.some((e) => e.kind === 'free' && e.start_min == null && e.date === getDateForDay(weekStart, d.key))}
                  leftArrow={idx === 0 && first > 0 ? () => setStartIdx(first - 1) : undefined}
                  rightArrow={idx === visible.length - 1 && first < maxStart ? () => setStartIdx(first + 1) : undefined}
                  onCreate={(s, e) => setDraft({ day: d.key, start_min: s, end_min: e })}
                  onEdit={(b) => setDraft({ ...b })}
                />
              ))}
            </div>
          </div>

          {allBlocks.length === 0 && (
            <p className="mt-3 text-center text-sm text-board-cream/60">Toca un hueco del horario (o «Bloque») para añadir tu primera clase o turno.</p>
          )}
          {error && <p className="mt-2 text-sm text-board-danger">{error}</p>}
        </>
      )}

      {draft && (
        <BlockSheet
          key={draft.id ?? `${draft.day}-${draft.start_min}-${draft.end_min}`}
          draft={draft}
          groupCode={groupCode}
          thisWeekParity={parity}
          saving={actions.saveBlock.isPending}
          onSave={saveDraft}
          onClose={() => setDraft(null)}
          onDelete={draft.id ? () => guard(async () => { await actions.deleteBlock.mutateAsync(draft.id!); setDraft(null) }) : undefined}
          onCopyTo={draft.id ? (days) => copyBlock(draft, days) : undefined}
        />
      )}
    </div>
  )
}

interface ColProps {
  dayKey: DayKey
  label: string
  date: string
  isToday: boolean
  blocks: Block[]
  from: number
  to: number
  height: number
  hasFree: boolean
  leftArrow?: () => void
  rightArrow?: () => void
  onCreate: (start: number, end: number) => void
  onEdit: (b: Block) => void
}

function DayColumn({ dayKey, label, date, isToday, blocks, from, to, height, hasFree, leftArrow, rightArrow, onCreate, onEdit }: ColProps) {
  const ref = useRef<HTMLDivElement>(null)
  const [drag, setDrag] = useState<{ a: number; b: number } | null>(null)
  const dragRef = useRef<{ a: number; b: number } | null>(null)
  const touchRef = useRef<{ x: number; y: number; t: number; min: number } | null>(null)
  const setDragBoth = (d: { a: number; b: number } | null) => {
    dragRef.current = d
    setDrag(d)
  }

  const minuteAt = (clientY: number) => {
    const rect = ref.current!.getBoundingClientRect()
    return Math.max(from, Math.min(to, snap(from + (clientY - rect.top) / PX_PER_MIN)))
  }
  const quick = (min: number) => {
    const s = Math.min(Math.floor(min / 60) * 60, to - 60)
    onCreate(Math.max(from, s), Math.max(from, s) + 60) // un toque = bloque de 1 h en esa hora
  }

  // Ratón: arrastrar para crear. Táctil: un toque crea un bloque rápido y el desplazamiento vertical NO se bloquea.
  function down(e: React.PointerEvent) {
    if (e.pointerType === 'touch') {
      touchRef.current = { x: e.clientX, y: e.clientY, t: Date.now(), min: minuteAt(e.clientY) }
      return
    }
    if (e.button !== 0) return
    e.currentTarget.setPointerCapture?.(e.pointerId)
    const m = minuteAt(e.clientY)
    setDragBoth({ a: m, b: m })
  }
  function move(e: React.PointerEvent) {
    const d = dragRef.current
    if (d) setDragBoth({ a: d.a, b: minuteAt(e.clientY) })
  }
  function up(e: React.PointerEvent) {
    if (e.pointerType === 'touch') {
      const t = touchRef.current
      touchRef.current = null
      if (t && Math.hypot(e.clientX - t.x, e.clientY - t.y) < 8 && Date.now() - t.t < 500) quick(t.min)
      return
    }
    const d = dragRef.current
    if (!d) return
    let s = Math.min(d.a, d.b)
    let en = Math.max(d.a, d.b)
    setDragBoth(null)
    if (en - s < SNAP) return quick(s)
    if (en > to) {
      en = to
      s = Math.min(s, en - SNAP)
    }
    onCreate(s, en)
  }

  return (
    <div className="min-w-0 flex-1 border-l border-board-line first:border-l-0">
      <div className={`flex h-11 items-center justify-between border-b border-board-line px-0.5 ${isToday ? 'bg-board-amber/15' : ''}`}>
        <button onClick={leftArrow} disabled={!leftArrow} className="flex h-9 w-6 items-center justify-center text-board-cream/50 disabled:opacity-0" aria-label="Días anteriores"><IconLeft className="h-4 w-4" /></button>
        <div className="text-center leading-tight">
          <div className={`text-xs font-semibold ${isToday ? 'text-board-amber' : ''}`}>{label}</div>
          <div className="font-mono text-[10px] text-board-cream/50">{date.slice(8)}{hasFree ? ' · libre' : ''}</div>
        </div>
        <button onClick={rightArrow} disabled={!rightArrow} className="flex h-9 w-6 items-center justify-center text-board-cream/50 disabled:opacity-0" aria-label="Días siguientes"><IconRight className="h-4 w-4" /></button>
      </div>
      <div
        ref={ref}
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={up}
        onPointerCancel={() => { setDragBoth(null); touchRef.current = null }}
        style={{ height, touchAction: 'pan-y', backgroundImage: 'linear-gradient(rgb(var(--board-line) / 0.6) 1px, transparent 1px)', backgroundSize: `100% ${60 * PX_PER_MIN}px` }}
        className="relative cursor-crosshair"
        data-testid={`col-${dayKey}`}
      >
        {blocks.map((b) => (
          <button
            key={b.id}
            onPointerDown={(e) => e.stopPropagation()}
            onPointerUp={(e) => e.stopPropagation()}
            onClick={() => onEdit(b)}
            style={{ top: (b.start_min - from) * PX_PER_MIN, height: Math.max((b.end_min - b.start_min) * PX_PER_MIN - 1, 16), backgroundColor: b.color ?? '#4C7C7C' }}
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
        {drag && (
          <div className="pointer-events-none absolute inset-x-0 border border-board-amber bg-board-amber/40" style={{ top: (Math.min(drag.a, drag.b) - from) * PX_PER_MIN, height: Math.max(Math.abs(drag.b - drag.a) * PX_PER_MIN, 8) }} />
        )}
      </div>
    </div>
  )
}
