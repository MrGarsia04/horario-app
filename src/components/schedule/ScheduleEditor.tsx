import { useEffect, useMemo, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { activeTemplates, blockApplies, weekParity } from '../../lib/schedule/availability'
import { getDateForDay, todayISO } from '../../lib/weeks'
import type { Block, DayKey, Template } from '../../lib/schedule/types'
import { ensureDefaultLayer, useMySchedule, useScheduleActions } from '../../hooks/useSchedules'
import BlockSheet, { type BlockDraft } from './BlockSheet'
import CapasTab from './CapasTab'
import LayerEditor from './LayerEditor'
import WeekGrid from './WeekGrid'
import WeekNavigator from '../WeekNavigator'
import Button from '../../ui/Button'
import { Chip, Tabs } from '../../ui/misc'
import { IconPlus } from '../../ui/icons'
import { COLORS, DAYS } from './constants'

interface Props {
  userId: string
  groupCode: string
  weekStart: string
  onWeekChange: (w: string) => void
}

export default function ScheduleEditor({ userId, groupCode, weekStart, onWeekChange }: Props) {
  const mine = useMySchedule(userId)
  const actions = useScheduleActions(userId, groupCode)
  const qc = useQueryClient()
  const [tab, setTab] = useState<'semana' | 'capas'>('semana')
  const [onlyLayer, setOnlyLayer] = useState<string | null>(null)
  const [draft, setDraft] = useState<BlockDraft | null>(null)
  const [layerEditor, setLayerEditor] = useState<{ id: string | null } | null>(null)
  const [error, setError] = useState('')

  const templates = mine.data?.templates ?? []
  const allBlocks = mine.data?.blocks ?? []
  const exceptions = mine.data?.exceptions ?? []

  // Primera vez: la base crea «Mi horario» (una sola, aunque se pida varias veces a la vez)
  useEffect(() => {
    if (!mine.data || templates.length > 0) return
    ensureDefaultLayer()
      .then(() => qc.invalidateQueries({ queryKey: ['schedule', userId] }))
      .catch((e) => setError((e as Error).message))
  }, [mine.data, templates.length, qc, userId])

  const today = todayISO()
  const todayIdx = DAYS.findIndex((d) => getDateForDay(weekStart, d.key) === today)
  const parity = weekParity(weekStart)

  const dates = useMemo(() => Object.fromEntries(DAYS.map((d) => [d.key, getDateForDay(weekStart, d.key)])), [weekStart])
  // Bloques que cuentan en la semana que se está viendo (capas activas, frecuencia, fechas)
  const blocksByDay = useMemo(() => {
    const out: Record<string, Block[]> = {}
    for (const d of DAYS) {
      const date = dates[d.key]
      const ids = new Set(activeTemplates(templates, date).map((t) => t.id))
      out[d.key] = allBlocks.filter((b) => ids.has(b.template_id) && (!onlyLayer || b.template_id === onlyLayer) && blockApplies(b, date, groupCode, parity))
    }
    return out
  }, [templates, allBlocks, dates, groupCode, parity, onlyLayer])
  const freeDays = useMemo(() => new Set(exceptions.filter((e) => e.kind === 'free' && e.start_min == null && Object.values(dates).includes(e.date)).map((e) => DAYS.find((d) => dates[d.key] === e.date)!.key)), [exceptions, dates])

  const layerColor = (id: string) => templates.find((t) => t.id === id)?.color ?? COLORS[0]
  const blockCount = allBlocks.reduce<Record<string, number>>((acc, b) => ({ ...acc, [b.template_id]: (acc[b.template_id] ?? 0) + 1 }), {})
  const lastUsed = (() => { try { return localStorage.getItem('opf-last-layer') } catch { return null } })()
  const targetTemplate = templates.find((t) => t.id === lastUsed) ?? templates.find((t) => t.is_active) ?? templates[0]

  async function guard(fn: () => Promise<unknown>) {
    setError('')
    try {
      await fn()
    } catch (e) {
      setError((e as Error).message)
    }
  }

  async function saveDraft(v: Omit<Block, 'id' | 'user_id'> & { id?: string }, extraDays: DayKey[]) {
    if (!v.template_id) return
    try {
      localStorage.setItem('opf-last-layer', v.template_id)
    } catch {
      /* sin almacenamiento */
    }
    await guard(async () => {
      await actions.saveBlock.mutateAsync(v)
      if (extraDays.length) {
        const { id: _id, ...rest } = v
        await actions.insertBlocks.mutateAsync(extraDays.map((d) => ({ ...rest, day: d })))
      }
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

  async function duplicateLayer(id: string) {
    const t = templates.find((x) => x.id === id)
    if (!t) return
    const copy = (await actions.createTemplate.mutateAsync({ name: `${t.name} (copia)`.slice(0, 60), is_active: false, color: t.color ?? null, every_n_weeks: t.every_n_weeks ?? 1, anchor_week: t.anchor_week ?? null, active_from: t.active_from, active_to: t.active_to })) as Template
    const src = allBlocks.filter((b) => b.template_id === id)
    if (src.length) await actions.insertBlocks.mutateAsync(src.map(({ id: _i, user_id: _u, template_id: _t, ...rest }) => ({ ...rest, template_id: copy.id })))
  }

  if (mine.isLoading) return <p className="text-sm text-board-cream/50">Cargando tu horario…</p>
  if (mine.error) return <p className="text-sm text-board-danger">No se pudo cargar tu horario: {(mine.error as Error).message}</p>

  return (
    <div>
      <Tabs<'semana' | 'capas'>
        label="Secciones de mi horario"
        value={tab}
        onChange={setTab}
        items={[{ id: 'semana', label: 'Mi semana' }, { id: 'capas', label: `Capas (${templates.length})`, tour: 'tab-capas' }]}
      />

      {tab === 'capas' ? (
        <div className="mt-4">
          <CapasTab
            layers={templates}
            blockCount={blockCount}
            exceptions={exceptions}
            groupCode={groupCode}
            weekStart={weekStart}
            onNew={() => setLayerEditor({ id: null })}
            onEdit={(id) => setLayerEditor({ id })}
            onToggle={async (id, v) => void (await actions.updateTemplate.mutateAsync({ id, is_active: v }))}
            onDuplicate={duplicateLayer}
            onDelete={async (id) => void (await actions.deleteTemplate.mutateAsync(id))}
            onAddException={async (v) => void (await actions.saveException.mutateAsync(v))}
            onDeleteException={async (id) => void (await actions.deleteException.mutateAsync(id))}
          />
        </div>
      ) : (
        <>
          <div className="mt-4 flex items-start justify-between gap-3">
            <div className="flex-1"><WeekNavigator weekStart={weekStart} onChange={onWeekChange} statusText={null} /></div>
            <Button data-tour="add-block" icon={<IconPlus className="h-4 w-4" />} onClick={() => setDraft({ day: todayIdx >= 0 && todayIdx <= 4 ? DAYS[todayIdx].key : 'mon', start_min: 9 * 60, end_min: 10 * 60 })}>Bloque</Button>
          </div>

          {templates.length > 1 && (
            <div className="-mx-4 mb-3 flex gap-2 overflow-x-auto px-4 pb-1" role="group" aria-label="Filtrar por capa">
              <Chip active={onlyLayer === null} onClick={() => setOnlyLayer(null)}>Todas</Chip>
              {templates.map((t) => (
                <Chip key={t.id} active={onlyLayer === t.id} onClick={() => setOnlyLayer(onlyLayer === t.id ? null : t.id)}>
                  <span className="mr-1.5 inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: t.color ?? COLORS[0], opacity: t.is_active ? 1 : 0.35 }} />
                  <span className={t.is_active ? '' : 'line-through opacity-60'}>{t.name}</span>
                </Chip>
              ))}
            </div>
          )}

          <WeekGrid
            blocksByDay={blocksByDay}
            layerColor={layerColor}
            dates={dates}
            today={today}
            freeDays={freeDays}
            initialDay={todayIdx >= 0 && todayIdx <= 4 ? Math.min(todayIdx, 4) : 0}
            onCreate={(day, s, e) => setDraft({ day, start_min: s, end_min: e })}
            onEdit={(b) => setDraft({ ...b })}
          />

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
          layers={templates}
          layerId={draft.template_id ?? targetTemplate?.id ?? ''}
          saving={actions.saveBlock.isPending}
          onSave={saveDraft}
          onClose={() => setDraft(null)}
          onDelete={draft.id ? () => guard(async () => { await actions.deleteBlock.mutateAsync(draft.id!); setDraft(null) }) : undefined}
          onCopyTo={draft.id ? (days) => copyBlock(draft, days) : undefined}
        />
      )}

      {layerEditor && (
        <LayerEditor
          userId={userId}
          groupCode={groupCode}
          layerId={layerEditor.id}
          layers={templates}
          blocks={allBlocks}
          weekStart={weekStart}
          colorIndex={templates.length}
          onClose={() => setLayerEditor(null)}
        />
      )}
    </div>
  )
}
