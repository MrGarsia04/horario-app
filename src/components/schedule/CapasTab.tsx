import { useState } from 'react'
import { toLabel, toMinutes } from '../../lib/schedule/availability'
import { layerSummary } from '../../lib/schedule/layers'
import type { Exception, Template } from '../../lib/schedule/types'
import Button from '../../ui/Button'
import ConfirmSheet from '../../ui/ConfirmSheet'
import { Card, Chip, EmptyState, Toggle } from '../../ui/misc'
import { IconPlus } from '../../ui/icons'
import { COLORS } from './constants'

interface Props {
  layers: Template[]
  blockCount: Record<string, number>
  exceptions: Exception[]
  groupCode: string | null
  weekStart: string
  onNew: () => void
  onEdit: (id: string) => void
  onToggle: (id: string, active: boolean) => Promise<void>
  onDuplicate: (id: string) => Promise<void>
  onDelete: (id: string) => Promise<void>
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

function Layers({ layers, blockCount, onNew, onEdit, onToggle, onDuplicate, onDelete, guard }: Props & G) {
  const [toDelete, setToDelete] = useState<Template | null>(null)
  return (
    <section>
      <div className="mb-1 flex items-center justify-between">
        <h3 className="text-sm font-semibold">Mis capas</h3>
        <Button small icon={<IconPlus className="h-4 w-4" />} onClick={onNew}>Nueva capa</Button>
      </div>
      <p className="mb-3 text-xs text-board-cream/60">
        Una capa es un conjunto de bloques que se repite con una frecuencia («Clases» cada semana, «Prácticas» cada 2…). Apaga una capa y deja de contar, sin borrarla.
      </p>

      <div className="space-y-3">
        {layers.map((t) => (
          <Card key={t.id} className={`space-y-3 ${t.is_active ? '' : 'opacity-70'}`}>
            <div className="flex items-center gap-3">
              <span className="h-9 w-9 shrink-0 rounded-full ring-2 ring-board-line" style={{ backgroundColor: t.color ?? COLORS[0] }} aria-hidden="true" />
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{t.name}</p>
                <p className="text-xs text-board-cream/60">{blockCount[t.id] ?? 0} {(blockCount[t.id] ?? 0) === 1 ? 'bloque' : 'bloques'}</p>
              </div>
              <Toggle checked={t.is_active} label={`Capa ${t.name} activada`} onChange={(v) => guard(() => onToggle(t.id, v))} />
            </div>
            <p className="text-xs text-board-cream/70">{layerSummary(t)}{!t.is_active && ' · apagada: no cuenta para nadie'}</p>
            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" small onClick={() => onEdit(t.id)}>Editar</Button>
              <Button variant="ghost" small onClick={() => guard(() => onDuplicate(t.id))}>Duplicar</Button>
              {layers.length > 1 && <Button variant="danger" small onClick={() => setToDelete(t)}>Borrar</Button>}
            </div>
          </Card>
        ))}
      </div>

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
