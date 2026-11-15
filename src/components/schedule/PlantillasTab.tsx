import { useState } from 'react'
import { toLabel, toMinutes } from '../../lib/schedule/availability'
import type { Exception, Template } from '../../lib/schedule/types'
import Button from '../../ui/Button'
import { Card, Chip, EmptyState, Toggle } from '../../ui/misc'

interface Props {
  templates: Template[]
  exceptions: Exception[]
  groupCode: string | null
  onCreate: (name: string) => Promise<void>
  onUpdate: (id: string, patch: Partial<Template>) => Promise<void>
  onDelete: (id: string) => Promise<void>
  onDuplicate: (id: string) => Promise<void>
  onAddException: (v: Omit<Exception, 'id' | 'user_id'>) => Promise<void>
  onDeleteException: (id: string) => Promise<void>
}

const fmtDate = (d: string) => new Date(d + 'T00:00:00Z').toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' })

export default function PlantillasTab(p: Props) {
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
    <div className="space-y-6">
      {error && <p className="text-sm text-board-danger">{error}</p>}
      <Templates {...p} guard={guard} />
      <Exceptions {...p} guard={guard} />
    </div>
  )
}

type G = { guard: (fn: () => Promise<void>) => Promise<void> }

function Templates({ templates, onCreate, onUpdate, onDelete, onDuplicate, guard }: Props & G) {
  const [name, setName] = useState('')
  return (
    <section>
      <h3 className="mb-1 text-sm font-semibold">Plantillas</h3>
      <p className="mb-3 text-xs text-board-cream/60">
        Una plantilla es un conjunto de bloques («Clases», «Exámenes», «Verano»). Cuentan solo las activas y dentro de sus fechas: prepara el horario de exámenes y se activa solo.
      </p>
      <div className="space-y-3">
        {templates.map((t) => (
          <Card key={t.id} className="space-y-3">
            <div className="flex items-center gap-3">
              <input defaultValue={t.name} key={t.id + t.name} aria-label="Nombre de la plantilla" className="field !min-h-[40px] flex-1 font-medium"
                onBlur={(e) => e.target.value.trim() && e.target.value.trim() !== t.name && guard(() => onUpdate(t.id, { name: e.target.value.trim() }))} />
              <Toggle checked={t.is_active} label={`Plantilla ${t.name} activa`} onChange={(v) => guard(() => onUpdate(t.id, { is_active: v }))} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <label className="text-xs text-board-cream/60">Activa desde<input type="date" value={t.active_from ?? ''} onChange={(e) => guard(() => onUpdate(t.id, { active_from: e.target.value || null }))} className="field mt-1" /></label>
              <label className="text-xs text-board-cream/60">Hasta<input type="date" value={t.active_to ?? ''} onChange={(e) => guard(() => onUpdate(t.id, { active_to: e.target.value || null }))} className="field mt-1" /></label>
            </div>
            <div className="flex gap-2">
              <Button variant="ghost" small onClick={() => guard(() => onDuplicate(t.id))}>Duplicar</Button>
              {templates.length > 1 && (
                <Button variant="danger" small onClick={() => window.confirm(`¿Borrar la plantilla «${t.name}» y todos sus bloques?`) && guard(() => onDelete(t.id))}>Borrar</Button>
              )}
            </div>
          </Card>
        ))}
      </div>
      <form className="mt-3 flex gap-2" onSubmit={(e) => { e.preventDefault(); if (name.trim()) guard(async () => { await onCreate(name.trim()); setName('') }) }}>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nueva plantilla (p. ej. Exámenes)" className="field flex-1" aria-label="Nombre de la nueva plantilla" />
        <Button variant="secondary" type="submit">Crear</Button>
      </form>
    </section>
  )
}

function Exceptions({ exceptions, groupCode, onAddException, onDeleteException, guard }: Props & G) {
  const [date, setDate] = useState('')
  const [kind, setKind] = useState<'free' | 'busy'>('free')
  const [allDay, setAllDay] = useState(true)
  const [start, setStart] = useState('09:00')
  const [end, setEnd] = useState('10:00')
  const [title, setTitle] = useState('')
  const [scope, setScope] = useState<'all' | 'group'>('all')
  const [msg, setMsg] = useState('')
  const today = new Date().toISOString().slice(0, 10)
  const upcoming = exceptions.filter((e) => e.date >= today)

  async function add() {
    setMsg('')
    if (!date) return setMsg('Elige una fecha.')
    const useRange = kind === 'busy' || !allDay
    if (useRange && toMinutes(end) <= toMinutes(start)) return setMsg('La hora de fin debe ser posterior a la de inicio.')
    await guard(async () => {
      await onAddException({ date, kind, start_min: useRange ? toMinutes(start) : null, end_min: useRange ? toMinutes(end) : null, title: title.trim() || null, group_code: scope === 'group' ? groupCode : null })
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
                  {e.kind === 'free' ? 'Libre' : 'Ocupado'}{e.start_min != null && e.end_min != null ? ` ${toLabel(e.start_min)}–${toLabel(e.end_min)}` : ' todo el día'}{e.title ? ` · ${e.title}` : ''}
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
