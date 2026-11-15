import { useState } from 'react'
import { layerAppliesOnWeek, nextOccurrences, toLabel, toMinutes } from '../../lib/schedule/availability'
import { addWeeks, formatWeekLabelShort, getWeekStart } from '../../lib/weeks'
import type { Exception, Template } from '../../lib/schedule/types'
import Button from '../../ui/Button'
import ConfirmSheet from '../../ui/ConfirmSheet'
import { Card, Chip, Disclosure, EmptyState, Toggle } from '../../ui/misc'
import { COLORS } from './constants'

interface Props {
  layers: Template[]
  blockCount: Record<string, number>
  exceptions: Exception[]
  groupCode: string | null
  /** semana que se está viendo en «Mi semana»: «esta semana» se refiere a ella */
  weekStart: string
  onCreate: (name: string, every: number) => Promise<void>
  onUpdate: (id: string, patch: Partial<Template>) => Promise<void>
  onDelete: (id: string) => Promise<void>
  onDuplicate: (id: string) => Promise<void>
  onAddException: (v: Omit<Exception, 'id' | 'user_id'>) => Promise<void>
  onDeleteException: (id: string) => Promise<void>
}

const fmtDate = (d: string) => new Date(d + 'T00:00:00Z').toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' })

export default function CapasTab(p: Props) {
  const [error, setError] = useState('')
  const guard = async (fn: () => Promise<void>) => {
    setError('')
    try {
      await fn()
    } catch (e) {
      setError((e as Error).message)
    }
  }
  return (
    <div className="space-y-8">
      {error && <p className="text-sm text-board-danger">{error}</p>}
      <Layers {...p} guard={guard} />
      <Exceptions {...p} guard={guard} />
    </div>
  )
}

type G = { guard: (fn: () => Promise<void>) => Promise<void> }

function Layers({ layers, blockCount, weekStart, onCreate, onUpdate, onDelete, onDuplicate, guard }: Props & G) {
  const [name, setName] = useState('')
  const [every, setEvery] = useState(1)
  const [toDelete, setToDelete] = useState<Template | null>(null)

  return (
    <section>
      <h3 className="mb-1 text-sm font-semibold">Capas</h3>
      <p className="mb-3 text-xs text-board-cream/60">
        Organiza tu semana por capas: «Clases», «Prácticas», «Trabajo»… Cada capa tiene sus bloques y su propia frecuencia (todas las semanas, cada 2, cada 3…). Apaga una capa y deja de contar, sin borrarla.
      </p>

      <div className="space-y-3">
        {layers.map((t) => (
          <LayerCard key={t.id} layer={t} blocks={blockCount[t.id] ?? 0} weekStart={weekStart} canDelete={layers.length > 1}
            onUpdate={(patch) => guard(() => onUpdate(t.id, patch))} onDuplicate={() => guard(() => onDuplicate(t.id))} onAskDelete={() => setToDelete(t)} />
        ))}
      </div>

      <Card className="mt-4 space-y-3">
        <p className="text-sm font-medium">Nueva capa</p>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nombre (p. ej. Prácticas de laboratorio)" className="field" aria-label="Nombre de la nueva capa" maxLength={60} />
        <div className="flex flex-wrap gap-1.5">
          {[1, 2, 3, 4].map((n) => <Chip key={n} active={every === n} onClick={() => setEvery(n)}>{n === 1 ? 'Todas las semanas' : `Cada ${n}`}</Chip>)}
        </div>
        <Button variant="secondary" block onClick={() => name.trim() && guard(async () => { await onCreate(name.trim(), every); setName(''); setEvery(1) })}>Crear capa</Button>
      </Card>

      <ConfirmSheet
        open={Boolean(toDelete)}
        title="¿Borrar esta capa?"
        text={toDelete ? `Se borrará «${toDelete.name}» con sus ${blockCount[toDelete.id] ?? 0} bloques. No se puede deshacer. Si solo quieres dejar de verla, apágala con el interruptor.` : ''}
        confirmLabel="Borrar capa"
        onConfirm={() => toDelete && guard(() => onDelete(toDelete.id))}
        onClose={() => setToDelete(null)}
      />
    </section>
  )
}

function LayerCard({ layer: t, blocks, weekStart, canDelete, onUpdate, onDuplicate, onAskDelete }: {
  layer: Template; blocks: number; weekStart: string; canDelete: boolean
  onUpdate: (patch: Partial<Template>) => void; onDuplicate: () => void; onAskDelete: () => void
}) {
  const [colors, setColors] = useState(false)
  const n = t.every_n_weeks ?? 1
  const thisWeek = layerAppliesOnWeek(t, weekStart)
  const nextWeek = layerAppliesOnWeek(t, addWeeks(weekStart, 1))
  const startsChoice = thisWeek ? 'this' : nextWeek ? 'next' : 'other'
  const [pickDate, setPickDate] = useState(false)

  function setEveryN(v: number) {
    if (v === 1) onUpdate({ every_n_weeks: 1, anchor_week: null })
    else onUpdate({ every_n_weeks: v, anchor_week: t.anchor_week ?? weekStart })
  }

  return (
    <Card className={`space-y-3 ${t.is_active ? '' : 'opacity-70'}`}>
      <div className="flex items-center gap-3">
        <button onClick={() => setColors((c) => !c)} aria-label="Cambiar color de la capa" aria-expanded={colors} className="h-9 w-9 shrink-0 rounded-full ring-2 ring-board-line" style={{ backgroundColor: t.color ?? COLORS[0] }} />
        <input defaultValue={t.name} key={t.id + t.name} aria-label="Nombre de la capa" maxLength={60} className="field !min-h-[40px] flex-1 font-medium"
          onBlur={(e) => e.target.value.trim() && e.target.value.trim() !== t.name && onUpdate({ name: e.target.value.trim() })} />
        <Toggle checked={t.is_active} label={`Capa ${t.name} activada`} onChange={(v) => onUpdate({ is_active: v })} />
      </div>
      {colors && (
        <div className="flex flex-wrap gap-2.5" role="radiogroup" aria-label="Color de la capa">
          {COLORS.map((c) => (
            <button key={c} role="radio" aria-checked={t.color === c} aria-label={`Color ${c}`} onClick={() => { onUpdate({ color: c }); setColors(false) }} style={{ backgroundColor: c }} className={`h-8 w-8 rounded-full ${t.color === c ? 'ring-2 ring-board-cream ring-offset-2 ring-offset-board-panel' : ''}`} />
          ))}
        </div>
      )}
      <p className="text-xs text-board-cream/60">{blocks} {blocks === 1 ? 'bloque' : 'bloques'}{!t.is_active && ' · apagada: no cuenta para nadie'}</p>

      <div>
        <p className="mb-1.5 text-xs text-board-cream/60">Se repite</p>
        <div className="flex flex-wrap gap-1.5">
          {[1, 2, 3, 4].map((v) => <Chip key={v} active={n === v} onClick={() => setEveryN(v)}>{v === 1 ? 'Todas las semanas' : `Cada ${v} semanas`}</Chip>)}
          <select value={n > 4 ? n : ''} onChange={(e) => e.target.value && setEveryN(Number(e.target.value))} aria-label="Otra frecuencia" className="field !min-h-[36px] !w-auto !rounded-full !py-1 text-xs">
            <option value="">Otra…</option>
            {[5, 6, 7, 8, 9, 10, 11, 12].map((v) => <option key={v} value={v}>Cada {v} semanas</option>)}
          </select>
        </div>
      </div>

      {n > 1 && (
        <div>
          <p className="mb-1.5 text-xs text-board-cream/60">Empieza</p>
          <div className="flex flex-wrap gap-1.5">
            <Chip active={startsChoice === 'this' && !pickDate} onClick={() => { setPickDate(false); onUpdate({ anchor_week: weekStart }) }}>Esta semana</Chip>
            <Chip active={startsChoice === 'next' && !pickDate} onClick={() => { setPickDate(false); onUpdate({ anchor_week: addWeeks(weekStart, 1) }) }}>La próxima</Chip>
            <Chip active={startsChoice === 'other' || pickDate} onClick={() => setPickDate(true)}>Elegir…</Chip>
          </div>
          {(startsChoice === 'other' || pickDate) && (
            <label className="mt-2 block text-xs text-board-cream/60">Una semana en la que toca
              <input type="date" value={t.anchor_week ?? ''} onChange={(e) => e.target.value && onUpdate({ anchor_week: getWeekStart(e.target.value) })} className="field mt-1" />
            </label>
          )}
          <p className="mt-2 text-xs text-board-cream/70">
            Le toca: {nextOccurrences(t, weekStart, 3).map(formatWeekLabelShort).join(' · ')}
          </p>
        </div>
      )}

      <Disclosure title="Fechas (opcional)">
        <p className="text-xs text-board-cream/60">Si solo vale entre dos fechas (p. ej. el cuatrimestre), indícalo aquí.</p>
        <div className="grid grid-cols-2 gap-3">
          <label className="text-xs text-board-cream/60">Desde<input type="date" value={t.active_from ?? ''} onChange={(e) => onUpdate({ active_from: e.target.value || null })} className="field mt-1" /></label>
          <label className="text-xs text-board-cream/60">Hasta<input type="date" value={t.active_to ?? ''} onChange={(e) => onUpdate({ active_to: e.target.value || null })} className="field mt-1" /></label>
        </div>
      </Disclosure>

      <div className="flex gap-2">
        <Button variant="ghost" small onClick={onDuplicate}>Duplicar</Button>
        {canDelete && <Button variant="danger" small onClick={onAskDelete}>Borrar</Button>}
      </div>
    </Card>
  )
}

function Exceptions({ layers, exceptions, groupCode, onAddException, onDeleteException, guard }: Props & G) {
  const [date, setDate] = useState('')
  const [kind, setKind] = useState<'free' | 'busy'>('free')
  const [allDay, setAllDay] = useState(true)
  const [start, setStart] = useState('09:00')
  const [end, setEnd] = useState('10:00')
  const [title, setTitle] = useState('')
  const [scope, setScope] = useState<'all' | 'group'>('all')
  const [layerId, setLayerId] = useState<string | null>(null)
  const [msg, setMsg] = useState('')
  const today = new Date().toISOString().slice(0, 10)
  const upcoming = exceptions.filter((e) => e.date >= today)
  const layerName = (id?: string | null) => layers.find((l) => l.id === id)?.name

  async function add() {
    setMsg('')
    if (!date) return setMsg('Elige una fecha.')
    const useRange = kind === 'busy' || !allDay
    if (useRange && toMinutes(end) <= toMinutes(start)) return setMsg('La hora de fin debe ser posterior a la de inicio.')
    await guard(async () => {
      await onAddException({ date, kind, start_min: useRange ? toMinutes(start) : null, end_min: useRange ? toMinutes(end) : null, title: title.trim() || null, group_code: scope === 'group' ? groupCode : null, template_id: kind === 'free' ? layerId : null })
      setDate('')
      setTitle('')
    })
  }

  return (
    <section>
      <h3 className="mb-1 text-sm font-semibold">Excepciones por fecha</h3>
      <p className="mb-3 text-xs text-board-cream/60">Un día libre o una cita puntual que no se repite. Solo afecta a esa fecha.</p>
      <Card className="space-y-3">
        <div className="flex flex-wrap gap-1.5">
          <Chip active={kind === 'free'} onClick={() => setKind('free')}>Estoy libre</Chip>
          <Chip active={kind === 'busy'} onClick={() => setKind('busy')}>Estoy ocupado</Chip>
        </div>
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="field" aria-label="Fecha" />
        {kind === 'free' && (
          <div className="flex items-center justify-between text-sm"><span>Todo el día</span><Toggle checked={allDay} onChange={setAllDay} label="Todo el día" /></div>
        )}
        {(kind === 'busy' || !allDay) && (
          <div className="grid grid-cols-2 gap-3">
            <input type="time" step={900} value={start} onChange={(e) => setStart(e.target.value)} className="field" aria-label="Desde" />
            <input type="time" step={900} value={end} onChange={(e) => setEnd(e.target.value)} className="field" aria-label="Hasta" />
          </div>
        )}
        {kind === 'free' && layers.length > 1 && (
          <div>
            <p className="mb-1.5 text-xs text-board-cream/60">¿De qué capa?</p>
            <div className="flex flex-wrap gap-1.5">
              <Chip active={layerId === null} onClick={() => setLayerId(null)}>Todas</Chip>
              {layers.map((l) => <Chip key={l.id} active={layerId === l.id} onClick={() => setLayerId(l.id)}>{l.name}</Chip>)}
            </div>
          </div>
        )}
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Motivo (opcional)" maxLength={80} className="field" aria-label="Motivo" />
        {groupCode && (
          <div className="flex flex-wrap gap-1.5">
            <Chip active={scope === 'all'} onClick={() => setScope('all')}>Todos mis grupos</Chip>
            <Chip active={scope === 'group'} onClick={() => setScope('group')}>Solo «{groupCode}»</Chip>
          </div>
        )}
        {msg && <p className="text-sm text-board-danger">{msg}</p>}
        <Button variant="secondary" block onClick={add}>Añadir excepción</Button>
      </Card>

      <div className="mt-3 space-y-2">
        {upcoming.length === 0 ? (
          <EmptyState title="Sin excepciones próximas" text="Añade un día libre o una cita suelta cuando la necesites." />
        ) : (
          upcoming.map((e) => (
            <Card key={e.id} className="flex items-center justify-between !py-3">
              <span className="text-sm">
                <span className={e.kind === 'free' ? 'text-board-free' : 'text-board-teal'}>●</span> {fmtDate(e.date)}
                <span className="block text-xs text-board-cream/60">
                  {e.kind === 'free' ? 'Libre' : 'Ocupado'}{e.start_min != null && e.end_min != null ? ` ${toLabel(e.start_min)}–${toLabel(e.end_min)}` : ' todo el día'}
                  {layerName(e.template_id) ? ` · capa ${layerName(e.template_id)}` : ''}{e.title ? ` · ${e.title}` : ''}
                </span>
              </span>
              <Button variant="ghost" small onClick={() => guard(() => onDeleteException(e.id))}>Quitar</Button>
            </Card>
          ))
        )}
      </div>
    </section>
  )
}
