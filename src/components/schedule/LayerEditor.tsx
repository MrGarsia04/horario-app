import { useMemo, useState } from 'react'
import { nextOccurrences, toLabel } from '../../lib/schedule/availability'
import { frequencyLabel, shortDate } from '../../lib/schedule/layers'
import { addWeeks, formatWeekLabelShort, getWeekStart } from '../../lib/weeks'
import type { Block, DayKey, Template } from '../../lib/schedule/types'
import { useScheduleActions } from '../../hooks/useSchedules'
import BlockSheet, { type BlockDraft } from './BlockSheet'
import WeekGrid from './WeekGrid'
import Button from '../../ui/Button'
import ConfirmSheet from '../../ui/ConfirmSheet'
import { Card, Chip, EmptyState, Toggle } from '../../ui/misc'
import { IconClose, IconPlus } from '../../ui/icons'
import { COLORS, DAYS } from './constants'

interface Props {
  userId: string
  groupCode: string
  /** null = capa nueva */
  layerId: string | null
  layers: Template[]
  blocks: Block[]
  weekStart: string
  colorIndex: number
  onClose: () => void
}

type Step = 1 | 2 | 3
const STEPS: { n: Step; label: string }[] = [{ n: 1, label: 'Nombre' }, { n: 2, label: 'Bloques' }, { n: 3, label: 'Cuándo' }]
const field = 'field'

/** Pantalla completa para crear o editar una capa: 1) nombre y color · 2) bloques · 3) frecuencia y fechas. Todo se guarda al momento. */
export default function LayerEditor({ userId, groupCode, layerId, layers, blocks, weekStart, colorIndex, onClose }: Props) {
  const actions = useScheduleActions(userId, groupCode)
  const [id, setId] = useState<string | null>(layerId)
  const isNew = layerId === null
  const layer = layers.find((l) => l.id === id) ?? null
  const [step, setStep] = useState<Step>(1)
  const [name, setName] = useState(layer?.name ?? '')
  const [color, setColor] = useState(layer?.color ?? COLORS[colorIndex % COLORS.length])
  const [draft, setDraft] = useState<BlockDraft | null>(null)
  const [discard, setDiscard] = useState(false)
  const [error, setError] = useState('')

  const layerBlocks = useMemo(() => blocks.filter((b) => b.template_id === id), [blocks, id])
  const blocksByDay = useMemo(() => {
    const out: Record<string, Block[]> = {}
    for (const d of DAYS) out[d.key] = layerBlocks.filter((b) => b.day === d.key)
    return out
  }, [layerBlocks])

  const guard = async (fn: () => Promise<unknown>) => {
    setError('')
    try {
      await fn()
      return true
    } catch (e) {
      setError((e as Error).message)
      return false
    }
  }
  const update = (patch: Partial<Template>) => id && guard(() => actions.updateTemplate.mutateAsync({ id, ...patch }))

  async function goNext() {
    if (step === 1) {
      const n = name.trim()
      if (!n) return setError('Ponle un nombre a la capa.')
      if (!layer) {
        // La capa se crea al salir del paso 1; empieza «esta semana» y se repite todas las semanas
        const ok = await guard(async () => {
          const t = (await actions.createTemplate.mutateAsync({ name: n, color, every_n_weeks: 1, anchor_week: null, active_from: getWeekStart(new Date()) })) as Template
          setId(t.id)
        })
        if (!ok) return
      } else if (n !== layer.name || color !== layer.color) {
        await update({ name: n, color })
      }
      setStep(2)
    } else if (step === 2) setStep(3)
    else close()
  }

  function close() {
    // Una capa nueva sin bloques no sirve de nada: se ofrece descartarla
    if (isNew && id && layerBlocks.length === 0) return setDiscard(true)
    onClose()
  }

  async function goStep(n: Step) {
    if (!layer && n > 1) return setError('Primero ponle nombre y color, y pulsa «Siguiente».')
    if (layer && step === 1 && name.trim() && (name.trim() !== layer.name || color !== layer.color)) await update({ name: name.trim(), color })
    setError('')
    setStep(n)
  }

  async function saveBlock(v: Omit<Block, 'id' | 'user_id'> & { id?: string }, extraDays: DayKey[]) {
    if (!id) return
    await guard(async () => {
      await actions.saveBlock.mutateAsync({ ...v, template_id: id })
      if (extraDays.length) {
        const { id: _id, ...rest } = v
        await actions.insertBlocks.mutateAsync(extraDays.map((d) => ({ ...rest, template_id: id, day: d })))
      }
      setDraft(null)
    })
  }

  return (
    <div className="fixed inset-0 z-40 flex flex-col bg-board-bg" role="dialog" aria-modal="true" aria-label={isNew ? 'Nueva capa' : 'Editar capa'}>
      <header className="pt-safe border-b border-board-line">
        <div className="mx-auto flex h-14 max-w-3xl items-center justify-between px-4">
          <h2 className="text-base font-semibold">{isNew ? 'Nueva capa' : 'Editar capa'}</h2>
          <button onClick={close} className="btn-ghost -mr-2 !px-2" aria-label="Cerrar"><IconClose className="h-6 w-6" /></button>
        </div>
        <nav aria-label="Pasos" className="mx-auto flex max-w-3xl gap-2 px-4 pb-3">
          {STEPS.map((s) => (
            <button key={s.n} onClick={() => goStep(s.n)} aria-current={step === s.n ? 'step' : undefined}
              className={`flex min-h-[40px] flex-1 items-center justify-center gap-1.5 rounded-lg text-sm font-medium transition ${step === s.n ? 'bg-board-amber text-board-onaccent' : 'bg-board-panel text-board-cream/70'}`}>
              <span className={`flex h-5 w-5 items-center justify-center rounded-full text-[11px] ${step === s.n ? 'bg-board-onaccent/20' : 'bg-board-line'}`}>{s.n}</span>{s.label}
            </button>
          ))}
        </nav>
      </header>

      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-3xl px-4 py-5">
          {step === 1 && (
            <div className="space-y-5">
              <label className="block text-sm font-medium">¿Cómo se llama?
                <input value={name} onChange={(e) => setName(e.target.value)} placeholder="p. ej. Clases, Prácticas, Trabajo…" maxLength={60} className={`${field} mt-2`} autoFocus={isNew} />
              </label>
              <div>
                <p className="mb-2 text-sm font-medium">Color</p>
                <div className="flex flex-wrap gap-3" role="radiogroup" aria-label="Color de la capa">
                  {COLORS.map((c) => (
                    <button key={c} role="radio" aria-checked={color === c} aria-label={`Color ${c}`} onClick={() => setColor(c)} style={{ backgroundColor: c }}
                      className={`h-11 w-11 rounded-full ${color === c ? 'ring-2 ring-board-cream ring-offset-2 ring-offset-board-bg' : ''}`} />
                  ))}
                </div>
                <p className="mt-2 text-xs text-board-cream/60">Los bloques de esta capa se pintan con este color.</p>
              </div>
              {layer && (
                <Card className="flex items-center justify-between">
                  <span className="text-sm">Capa activada<span className="block text-xs text-board-cream/60">Si la apagas, deja de contar para tu horario y el del grupo.</span></span>
                  <Toggle checked={layer.is_active} label="Capa activada" onChange={(v) => update({ is_active: v })} />
                </Card>
              )}
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm text-board-cream/70">Añade todos los bloques de «{layer?.name}»: toca un hueco o usa el botón.</p>
                <Button icon={<IconPlus className="h-4 w-4" />} onClick={() => setDraft({ day: 'mon', start_min: 9 * 60, end_min: 10 * 60 })}>Bloque</Button>
              </div>
              <WeekGrid blocksByDay={blocksByDay} layerColor={() => layer?.color ?? color} onCreate={(day, s, e) => setDraft({ day, start_min: s, end_min: e })} onEdit={(b) => setDraft({ ...b })} />
              <section>
                <h3 className="mb-2 text-sm font-semibold">Bloques de la capa ({layerBlocks.length})</h3>
                {layerBlocks.length === 0 ? (
                  <EmptyState title="Todavía no hay bloques" text="Añade el primero con el botón «Bloque»." />
                ) : (
                  <ul className="space-y-2">
                    {[...layerBlocks].sort((a, b) => DAYS.findIndex((d) => d.key === a.day) - DAYS.findIndex((d) => d.key === b.day) || a.start_min - b.start_min).map((b) => (
                      <li key={b.id}>
                        <Card className="flex items-center justify-between gap-3 !py-2.5">
                          <button onClick={() => setDraft({ ...b })} className="min-w-0 flex-1 text-left">
                            <span className="block truncate text-sm font-medium">{b.title ?? 'Bloque'}</span>
                            <span className="block text-xs text-board-cream/60">{DAYS.find((d) => d.key === b.day)!.label} · {toLabel(b.start_min)}–{toLabel(b.end_min)}</span>
                          </button>
                          <Button variant="ghost" small onClick={() => guard(() => actions.deleteBlock.mutateAsync(b.id))}>Quitar</Button>
                        </Card>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </div>
          )}

          {step === 3 && layer && <When layer={layer} weekStart={weekStart} onChange={update} />}

          {error && <p className="mt-4 text-sm text-board-danger">{error}</p>}
        </div>
      </div>

      <footer className="pb-safe border-t border-board-line bg-board-bg">
        <div className="mx-auto flex max-w-3xl gap-2 px-4 py-3">
          {step > 1 && <Button variant="ghost" onClick={() => goStep((step - 1) as Step)}>Atrás</Button>}
          <Button className="flex-1" onClick={goNext}>{step === 3 ? 'Listo' : 'Siguiente'}</Button>
        </div>
      </footer>

      {draft && (
        <BlockSheet
          key={draft.id ?? `${draft.day}-${draft.start_min}-${draft.end_min}`}
          draft={draft}
          groupCode={groupCode}
          layers={layer ? [layer] : []}
          layerId={id ?? ''}
          saving={actions.saveBlock.isPending}
          onSave={saveBlock}
          onClose={() => setDraft(null)}
          onDelete={draft.id ? () => guard(async () => { await actions.deleteBlock.mutateAsync(draft.id!); setDraft(null) }) : undefined}
        />
      )}

      <ConfirmSheet
        open={discard}
        title="¿Descartar la capa?"
        text="Todavía no tiene ningún bloque. Si la descartas, no se guarda."
        confirmLabel="Descartar"
        onConfirm={() => { if (id) actions.deleteTemplate.mutate(id); onClose() }}
        onClose={() => setDiscard(false)}
      />
    </div>
  )
}

function When({ layer, weekStart, onChange }: { layer: Template; weekStart: string; onChange: (p: Partial<Template>) => void }) {
  const n = layer.every_n_weeks ?? 1
  const thisMonday = getWeekStart(new Date())
  const start = layer.active_from ?? thisMonday
  const [hasEnd, setHasEnd] = useState(Boolean(layer.active_to))

  function setEvery(v: number) {
    onChange(v === 1 ? { every_n_weeks: 1, anchor_week: null } : { every_n_weeks: v, anchor_week: getWeekStart(start) })
  }
  function setStart(iso: string) {
    if (!iso) return
    onChange({ active_from: iso, ...(n > 1 ? { anchor_week: getWeekStart(iso) } : {}) })
  }
  const preview = nextOccurrences({ ...layer, active_from: start, anchor_week: n > 1 ? getWeekStart(start) : null }, getWeekStart(start) > weekStart ? getWeekStart(start) : weekStart, 3)

  return (
    <div className="space-y-6">
      <section>
        <h3 className="mb-2 text-sm font-semibold">¿Cada cuánto se repite?</h3>
        <div className="flex flex-wrap gap-1.5">
          {[1, 2, 3, 4].map((v) => <Chip key={v} active={n === v} onClick={() => setEvery(v)}>{v === 1 ? 'Todas las semanas' : `Cada ${v} semanas`}</Chip>)}
          <select value={n > 4 ? n : ''} onChange={(e) => e.target.value && setEvery(Number(e.target.value))} aria-label="Otra frecuencia" className="field !min-h-[36px] !w-auto !rounded-full !py-1 text-xs">
            <option value="">Otra…</option>
            {[5, 6, 7, 8, 9, 10, 11, 12].map((v) => <option key={v} value={v}>Cada {v} semanas</option>)}
          </select>
        </div>
      </section>

      <section>
        <h3 className="mb-2 text-sm font-semibold">¿Cuándo empieza?</h3>
        <div className="mb-2 flex flex-wrap gap-1.5">
          <Chip active={start === thisMonday} onClick={() => setStart(thisMonday)}>Esta semana</Chip>
          <Chip active={start === addWeeks(thisMonday, 1)} onClick={() => setStart(addWeeks(thisMonday, 1))}>La próxima</Chip>
        </div>
        <input type="date" value={start} onChange={(e) => setStart(e.target.value)} className="field" aria-label="Fecha de inicio" />
      </section>

      <section>
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold">Termina el…</h3>
          <Toggle checked={hasEnd} label="Tiene fecha de fin" onChange={(v) => { setHasEnd(v); if (!v) onChange({ active_to: null }) }} />
        </div>
        {hasEnd ? (
          <input type="date" value={layer.active_to ?? ''} min={start} onChange={(e) => onChange({ active_to: e.target.value || null })} className="field mt-2" aria-label="Fecha de fin" />
        ) : (
          <p className="mt-1 text-xs text-board-cream/60">Indefinidamente (siempre puedes borrarla o apagarla después).</p>
        )}
      </section>

      <Card className="space-y-1 bg-board-amber/5">
        <p className="text-sm font-medium">{frequencyLabel(n)}, desde el {shortDate(start)}{hasEnd && layer.active_to ? ` hasta el ${shortDate(layer.active_to)}` : ', sin fecha de fin'}.</p>
        {n > 1 && <p className="text-xs text-board-cream/70">Le toca: {preview.map(formatWeekLabelShort).join(' · ')}</p>}
      </Card>
    </div>
  )
}
