import { useEffect, useMemo, useRef, useState } from 'react'
import { toLabel, weekParity } from '../../lib/schedule/availability'
import type { Block, DayKey, Template, Visibility } from '../../lib/schedule/types'
import { useMySchedule, useScheduleActions } from '../../hooks/useSchedules'
import BlockForm, { type BlockDraft } from './BlockForm'
import TemplatePanel from './TemplatePanel'
import ExceptionsPanel from './ExceptionsPanel'
import { DAYS, SNAP, snap } from './constants'

const PX_PER_MIN = 0.8 // 48 px por hora
const DEFAULT_FROM = 7 * 60
const DEFAULT_TO = 22 * 60

interface Props {
  userId: string
  groupCode: string
  weekStart: string
  visibility: Visibility
}

type ParityFilter = 'all' | 'a' | 'b'

export default function ScheduleEditor({ userId, groupCode, weekStart, visibility }: Props) {
  const mine = useMySchedule(userId)
  const actions = useScheduleActions(userId, groupCode)
  const [templateId, setTemplateId] = useState<string | null>(null)
  const [draft, setDraft] = useState<BlockDraft | null>(null)
  const [filter, setFilter] = useState<ParityFilter>('all')
  const [error, setError] = useState('')
  const creatingDefault = useRef(false)

  const templates = mine.data?.templates ?? []
  const allBlocks = mine.data?.blocks ?? []

  // Primera vez: se crea una plantilla «Mi horario» para poder empezar a pintar bloques.
  useEffect(() => {
    if (!mine.data || templates.length > 0 || creatingDefault.current) return
    creatingDefault.current = true
    actions.createTemplate.mutateAsync({ name: 'Mi horario' }).catch((e) => setError(e.message))
  }, [mine.data, templates.length]) // eslint-disable-line react-hooks/exhaustive-deps

  // Plantilla seleccionada por defecto: la primera activa, o la primera.
  useEffect(() => {
    if (templateId && templates.some((t) => t.id === templateId)) return
    setTemplateId((templates.find((t) => t.is_active) ?? templates[0])?.id ?? null)
  }, [templates, templateId])

  const blocks = useMemo(
    () => allBlocks.filter((b) => b.template_id === templateId && (filter === 'all' || b.repeat === 'weekly' || b.repeat === `biweekly_${filter}`)),
    [allBlocks, templateId, filter]
  )

  const from = Math.min(DEFAULT_FROM, Math.floor(Math.min(...blocks.map((b) => b.start_min), DEFAULT_FROM) / 60) * 60)
  const to = Math.max(DEFAULT_TO, Math.ceil(Math.max(...blocks.map((b) => b.end_min), DEFAULT_TO) / 60) * 60)
  const height = (to - from) * PX_PER_MIN
  const thisWeek = weekParity(weekStart)

  async function guard(fn: () => Promise<unknown>) {
    setError('')
    try {
      await fn()
    } catch (e) {
      setError((e as Error).message)
    }
  }

  const blockToDraft = (b: Block): BlockDraft => ({ ...b })

  async function saveDraft(v: Omit<Block, 'id' | 'user_id' | 'template_id'> & { id?: string }) {
    if (!templateId) return
    await guard(async () => {
      await actions.saveBlock.mutateAsync({ ...v, template_id: templateId })
      setDraft(null)
    })
  }

  async function copyBlock(b: BlockDraft, days: DayKey[]) {
    if (!templateId || !b.id) return
    const src = allBlocks.find((x) => x.id === b.id)
    if (!src) return
    await guard(async () => {
      const { id: _id, user_id: _u, ...rest } = src
      await actions.insertBlocks.mutateAsync(days.map((d) => ({ ...rest, day: d })))
      setDraft(null)
    })
  }

  async function copyDay(fromDay: DayKey, toDay: DayKey) {
    if (!templateId) return
    const src = blocks.filter((b) => b.day === fromDay)
    if (src.length === 0) return
    await guard(() =>
      actions.insertBlocks.mutateAsync(
        src.map(({ id: _id, user_id: _u, ...rest }) => ({ ...rest, day: toDay }))
      )
    )
  }

  async function duplicateTemplate(id: string) {
    const t = templates.find((x) => x.id === id)
    if (!t) return
    const copy = (await actions.createTemplate.mutateAsync({ name: `${t.name} (copia)`, is_active: false })) as Template
    const src = allBlocks.filter((b) => b.template_id === id)
    if (src.length) {
      await actions.insertBlocks.mutateAsync(src.map(({ id: _i, user_id: _u, template_id: _t, ...rest }) => ({ ...rest, template_id: copy.id })))
    }
    setTemplateId(copy.id)
  }

  if (mine.isLoading) return <p className="text-sm text-board-cream/50">Cargando tu horario…</p>
  if (mine.error) return <p className="text-sm text-board-danger">No se pudo cargar tu horario: {(mine.error as Error).message}</p>

  return (
    <div>
      <TemplatePanel
        templates={templates}
        selectedId={templateId}
        onSelect={setTemplateId}
        onCreate={async (name) => {
          const t = (await actions.createTemplate.mutateAsync({ name })) as Template
          setTemplateId(t.id)
        }}
        onUpdate={async (id, patch) => void (await actions.updateTemplate.mutateAsync({ id, ...patch }))}
        onDelete={async (id) => void (await actions.deleteTemplate.mutateAsync(id))}
        onDuplicate={duplicateTemplate}
      />

      <div className="flex flex-wrap items-center gap-2 mb-3 text-xs">
        <span className="text-board-cream/50">Semanas:</span>
        {(['all', 'a', 'b'] as ParityFilter[]).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1 rounded-full ${filter === f ? 'bg-board-amber text-board-onaccent' : 'bg-board-panel text-board-cream/70'}`}
          >
            {f === 'all' ? 'Todas' : f === 'a' ? 'Semana A' : 'Semana B'}
          </button>
        ))}
        <span className="text-board-cream/40">La semana que estás viendo es la semana {thisWeek.toUpperCase()}.</span>
        <button onClick={() => setDraft({ day: 'mon', start_min: 9 * 60, end_min: 10 * 60 })} className="ml-auto text-board-amber hover:brightness-110">
          + Añadir bloque
        </button>
      </div>

      <div className="overflow-x-auto">
        <div className="min-w-[640px] flex select-none">
          <div className="w-12 shrink-0 relative" style={{ height, marginTop: 28 }} aria-hidden="true">
            {Array.from({ length: Math.floor((to - from) / 60) + 1 }, (_, i) => (
              <span key={i} className="absolute right-1 -translate-y-1/2 font-mono text-[11px] text-board-cream/50" style={{ top: i * 60 * PX_PER_MIN }}>
                {toLabel(from + i * 60)}
              </span>
            ))}
          </div>
          {DAYS.map((d) => (
            <DayColumn
              key={d.key}
              dayKey={d.key}
              label={d.short}
              blocks={blocks.filter((b) => b.day === d.key)}
              from={from}
              to={to}
              height={height}
              onCreate={(s, e) => setDraft({ day: d.key, start_min: s, end_min: e })}
              onEdit={(b) => setDraft(blockToDraft(b))}
              onCopyDay={(target) => copyDay(d.key, target)}
              showParity={filter === 'all'}
            />
          ))}
        </div>
      </div>
      <p className="text-xs text-board-cream/40 mt-2">
        Arrastra sobre un día para crear un bloque; toca un bloque para editarlo. Los bloques son minutos reales: no tienen que coincidir con el resto del grupo.
      </p>
      {error && <p className="text-sm text-board-danger mt-2">{error}</p>}

      {draft && (
        <BlockForm
          key={draft.id ?? `${draft.day}-${draft.start_min}-${draft.end_min}`}
          draft={draft}
          groupCode={groupCode}
          saving={actions.saveBlock.isPending}
          onSave={saveDraft}
          onCancel={() => setDraft(null)}
          onDelete={draft.id ? () => guard(async () => { await actions.deleteBlock.mutateAsync(draft.id!); setDraft(null) }) : undefined}
          onCopyTo={draft.id ? (days) => copyBlock(draft, days) : undefined}
        />
      )}

      <ExceptionsPanel
        exceptions={mine.data?.exceptions ?? []}
        groupCode={groupCode}
        onAdd={async (v) => void (await actions.saveException.mutateAsync(v))}
        onDelete={async (id) => void (await actions.deleteException.mutateAsync(id))}
      />

      <div className="mt-6 text-sm">
        <label className="text-board-cream/70">
          En el grupo «{groupCode}», los demás ven de mi horario:{' '}
          <select
            value={visibility}
            onChange={(e) => actions.setVisibility.mutate(e.target.value as Visibility)}
            className="bg-board-bg border border-board-line rounded px-2 py-1 text-sm"
          >
            <option value="busy">Solo ocupado / libre</option>
            <option value="full">Nombres y lugares de mis bloques</option>
          </select>
        </label>
      </div>
    </div>
  )
}

interface ColProps {
  dayKey: DayKey
  label: string
  blocks: Block[]
  from: number
  to: number
  height: number
  showParity: boolean
  onCreate: (start: number, end: number) => void
  onEdit: (b: Block) => void
  onCopyDay: (target: DayKey) => void
}

function DayColumn({ dayKey, label, blocks, from, to, height, showParity, onCreate, onEdit, onCopyDay }: ColProps) {
  const ref = useRef<HTMLDivElement>(null)
  const [drag, setDrag] = useState<{ a: number; b: number } | null>(null)
  const [copyOpen, setCopyOpen] = useState(false)

  const minuteAt = (clientY: number) => {
    const rect = ref.current!.getBoundingClientRect()
    const m = from + (clientY - rect.top) / PX_PER_MIN
    return Math.max(from, Math.min(to, snap(m)))
  }

  // El arrastre vive en una ref (los eventos llegan más rápido que los renders) y se copia al estado para pintarlo.
  const dragRef = useRef<{ a: number; b: number } | null>(null)
  const setDragBoth = (d: { a: number; b: number } | null) => {
    dragRef.current = d
    setDrag(d)
  }

  function down(e: React.PointerEvent) {
    if (e.button !== 0 && e.pointerType === 'mouse') return
    e.currentTarget.setPointerCapture?.(e.pointerId)
    const m = minuteAt(e.clientY)
    setDragBoth({ a: m, b: m })
  }
  function move(e: React.PointerEvent) {
    const d = dragRef.current
    if (d) setDragBoth({ a: d.a, b: minuteAt(e.clientY) })
  }
  function up() {
    const d = dragRef.current
    if (!d) return
    let s = Math.min(d.a, d.b)
    let e = Math.max(d.a, d.b)
    if (e - s < SNAP) e = s + 60 // un simple toque = bloque de 1 h
    if (e > to) {
      e = to
      s = Math.min(s, e - SNAP)
    }
    setDragBoth(null)
    onCreate(s, e)
  }

  return (
    <div className="flex-1 min-w-[72px] relative">
      <div className="h-7 text-center font-mono text-xs text-board-cream/70 flex items-center justify-center gap-1 relative">
        {label}
        <button onClick={() => setCopyOpen((o) => !o)} className="text-[10px] text-board-cream/30 hover:text-board-amber" aria-label={`Copiar ${label} a otros días`} title="Copiar este día a otros">⧉</button>
        {copyOpen && (
          <div className="absolute top-7 z-10 bg-board-panel border border-board-line rounded p-2 text-left text-[11px] space-y-1 shadow">
            <p className="text-board-cream/50">Copiar a…</p>
            {DAYS.filter((d) => d.key !== dayKey).map((d) => (
              <button key={d.key} onClick={() => { setCopyOpen(false); onCopyDay(d.key) }} className="block hover:text-board-amber">{d.label}</button>
            ))}
          </div>
        )}
      </div>
      <div
        ref={ref}
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={up}
        onPointerCancel={() => setDragBoth(null)}
        style={{ height, touchAction: 'none', backgroundImage: 'linear-gradient(rgb(var(--board-line)) 1px, transparent 1px)', backgroundSize: `100% ${60 * PX_PER_MIN}px` }}
        className="relative border-l border-board-line bg-board-panel cursor-crosshair"
        data-testid={`col-${dayKey}`}
      >
        {blocks.map((b) => (
          <button
            key={b.id}
            onPointerDown={(e) => e.stopPropagation()}
            onClick={() => onEdit(b)}
            style={{ top: (b.start_min - from) * PX_PER_MIN, height: Math.max((b.end_min - b.start_min) * PX_PER_MIN - 1, 14), backgroundColor: b.color ?? '#4C7C7C' }}
            className="absolute left-0.5 right-0.5 rounded px-1 text-left text-[11px] leading-tight text-white overflow-hidden hover:brightness-110 cell-busy"
            aria-label={`${b.title ?? 'Bloque'} ${toLabel(b.start_min)}–${toLabel(b.end_min)}`}
          >
            <span className="font-medium block truncate">{b.title ?? 'Ocupado'}</span>
            <span className="opacity-80 block truncate">
              {toLabel(b.start_min)}–{toLabel(b.end_min)}
              {showParity && b.repeat !== 'weekly' ? ` · ${b.repeat === 'biweekly_a' ? 'A' : 'B'}` : ''}
            </span>
            {b.location && <span className="opacity-80 block truncate">{b.location}</span>}
          </button>
        ))}
        {drag && (
          <div
            className="absolute left-0 right-0 bg-board-amber/40 border border-board-amber pointer-events-none"
            style={{ top: (Math.min(drag.a, drag.b) - from) * PX_PER_MIN, height: Math.max(Math.abs(drag.b - drag.a) * PX_PER_MIN, 8) }}
          />
        )}
      </div>
    </div>
  )
}
