import { useState } from 'react'
import { toLabel, toMinutes } from '../../lib/schedule/availability'
import type { Block, DayKey, Repeat, Template } from '../../lib/schedule/types'
import Sheet from '../../ui/Sheet'
import Button from '../../ui/Button'
import { Chip, Disclosure } from '../../ui/misc'
import { COLORS, DAYS } from './constants'

export interface BlockDraft {
  id?: string
  day: DayKey
  start_min: number
  end_min: number
  title?: string | null
  color?: string | null
  location?: string | null
  repeat?: Repeat
  group_code?: string | null
  template_id?: string
  valid_from?: string | null
  valid_to?: string | null
}

interface Props {
  draft: BlockDraft
  groupCode: string | null
  /** Capas entre las que se puede elegir y la preseleccionada */
  layers: Template[]
  layerId: string
  saving: boolean
  /** `extraDays`: otros días en los que crear el mismo bloque (solo al crear uno nuevo) */
  onSave: (v: Omit<Block, 'id' | 'user_id'> & { id?: string }, extraDays: DayKey[]) => void
  onDelete?: () => void
  onCopyTo?: (days: DayKey[]) => void
  onClose: () => void
}

export default function BlockSheet({ draft, groupCode, layers, layerId: initialLayer, saving, onSave, onDelete, onCopyTo, onClose }: Props) {
  const [title, setTitle] = useState(draft.title ?? '')
  const [days, setDays] = useState<DayKey[]>([draft.day])
  const [start, setStart] = useState(toLabel(draft.start_min))
  const [end, setEnd] = useState(toLabel(draft.end_min))
  const [layerId, setLayerId] = useState(initialLayer)
  // null = hereda el color de la capa
  // El color lo da la capa; si el bloque ya tenía uno propio se conserva tal cual
  const color = draft.color ?? null
  const [location, setLocation] = useState(draft.location ?? '')
  const [scope, setScope] = useState<'all' | 'group'>(draft.group_code ? 'group' : 'all')
  const [validFrom, setValidFrom] = useState(draft.valid_from ?? '')
  const [validTo, setValidTo] = useState(draft.valid_to ?? '')
  const [copyDays, setCopyDays] = useState<DayKey[]>([])
  const [error, setError] = useState('')

  function save() {
    const s = toMinutes(start)
    const en = toMinutes(end)
    if (!(en > s)) return setError('La hora de fin debe ser posterior a la de inicio.')
    if (validFrom && validTo && validFrom > validTo) return setError('«Desde» no puede ser posterior a «hasta».')
    setError('')
    onSave({
      id: draft.id, title: title.trim() || null, color, location: location.trim() || null, day: days[0] ?? draft.day,
      template_id: layerId, start_min: s, end_min: en, repeat: draft.repeat ?? 'weekly', group_code: scope === 'group' ? groupCode : null,
      valid_from: validFrom || null, valid_to: validTo || null,
    }, days.slice(1))
  }

  return (
    <Sheet
      open
      onClose={onClose}
      title={draft.id ? 'Editar bloque' : 'Nuevo bloque'}
      footer={
        <div className="flex items-center gap-2 pb-2">
          {onDelete && <Button variant="danger" onClick={onDelete}>Borrar</Button>}
          <Button className="flex-1" onClick={save} loading={saving}>Guardar</Button>
        </div>
      }
    >
      <div className="space-y-4">
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Nombre (asignatura, turno…)" maxLength={80} className="field" aria-label="Nombre" autoFocus={!draft.id} />

        {layers.length > 1 && (
          <div>
            <p className="mb-1.5 text-xs text-board-cream/60">Capa</p>
            <div className="flex flex-wrap gap-1.5">
              {layers.map((l) => (
                <Chip key={l.id} active={layerId === l.id} onClick={() => setLayerId(l.id)}>
                  <span className="mr-1.5 inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: l.color ?? COLORS[0] }} />{l.name}
                </Chip>
              ))}
            </div>
          </div>
        )}

        <div>
          <p className="mb-1.5 text-xs text-board-cream/60">{draft.id ? 'Día' : 'Día (puedes marcar varios)'}</p>
          <div className="flex flex-wrap gap-1.5">
            {DAYS.map((d) => (
              <Chip key={d.key} active={days.includes(d.key)} onClick={() => setDays((p) => (draft.id ? [d.key] : p.includes(d.key) ? (p.length > 1 ? p.filter((x) => x !== d.key) : p) : [...p, d.key]))}>{d.short}</Chip>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <label className="text-xs text-board-cream/60">Desde<input type="time" step={900} value={start} onChange={(e) => setStart(e.target.value)} className="field mt-1" /></label>
          <label className="text-xs text-board-cream/60">Hasta<input type="time" step={900} value={end} onChange={(e) => setEnd(e.target.value)} className="field mt-1" /></label>
        </div>

        {error && <p className="text-sm text-board-danger">{error}</p>}

        <Disclosure title="Más opciones">
          <input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Lugar (opcional)" maxLength={80} className="field" aria-label="Lugar" />

          <div className="grid grid-cols-2 gap-3">
            <label className="text-xs text-board-cream/60">Válido desde<input type="date" value={validFrom} onChange={(e) => setValidFrom(e.target.value)} className="field mt-1" /></label>
            <label className="text-xs text-board-cream/60">Válido hasta<input type="date" value={validTo} onChange={(e) => setValidTo(e.target.value)} className="field mt-1" /></label>
          </div>

          {groupCode && (
            <div>
              <p className="mb-1.5 text-xs text-board-cream/60">¿Dónde se ve?</p>
              <div className="flex flex-wrap gap-1.5">
                <Chip active={scope === 'all'} onClick={() => setScope('all')}>Todos mis grupos</Chip>
                <Chip active={scope === 'group'} onClick={() => setScope('group')}>Solo «{groupCode}»</Chip>
              </div>
            </div>
          )}

          {draft.id && onCopyTo && (
            <div>
              <p className="mb-1.5 text-xs text-board-cream/60">Copiar este bloque a otros días</p>
              <div className="flex flex-wrap items-center gap-1.5">
                {DAYS.filter((d) => d.key !== days[0]).map((d) => (
                  <Chip key={d.key} active={copyDays.includes(d.key)} onClick={() => setCopyDays((p) => (p.includes(d.key) ? p.filter((x) => x !== d.key) : [...p, d.key]))}>{d.short}</Chip>
                ))}
                <Button variant="secondary" small disabled={copyDays.length === 0} onClick={() => onCopyTo(copyDays)}>Copiar</Button>
              </div>
            </div>
          )}
        </Disclosure>
      </div>
    </Sheet>
  )
}
