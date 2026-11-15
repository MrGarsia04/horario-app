import { useState } from 'react'
import { toLabel, toMinutes } from '../../lib/schedule/availability'
import type { Block, DayKey, Repeat } from '../../lib/schedule/types'
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
  valid_from?: string | null
  valid_to?: string | null
}

interface Props {
  draft: BlockDraft
  groupCode: string | null
  /** Paridad de la semana que se está viendo: sirve para explicar «cada 2 semanas» sin jerga */
  thisWeekParity: 'a' | 'b'
  saving: boolean
  onSave: (v: Omit<Block, 'id' | 'user_id' | 'template_id'> & { id?: string }) => void
  onDelete?: () => void
  onCopyTo?: (days: DayKey[]) => void
  onClose: () => void
}

type RepeatChoice = 'weekly' | 'this' | 'next'

export default function BlockSheet({ draft, groupCode, thisWeekParity, saving, onSave, onDelete, onCopyTo, onClose }: Props) {
  const [title, setTitle] = useState(draft.title ?? '')
  const [day, setDay] = useState<DayKey>(draft.day)
  const [start, setStart] = useState(toLabel(draft.start_min))
  const [end, setEnd] = useState(toLabel(draft.end_min))
  const [color, setColor] = useState(draft.color ?? COLORS[0])
  const [location, setLocation] = useState(draft.location ?? '')
  const [repeat, setRepeat] = useState<RepeatChoice>(
    !draft.repeat || draft.repeat === 'weekly' ? 'weekly' : draft.repeat === `biweekly_${thisWeekParity}` ? 'this' : 'next'
  )
  const [scope, setScope] = useState<'all' | 'group'>(draft.group_code ? 'group' : 'all')
  const [validFrom, setValidFrom] = useState(draft.valid_from ?? '')
  const [validTo, setValidTo] = useState(draft.valid_to ?? '')
  const [copyDays, setCopyDays] = useState<DayKey[]>([])
  const [error, setError] = useState('')

  const other = thisWeekParity === 'a' ? 'b' : 'a'
  const repeatValue = (): Repeat => (repeat === 'weekly' ? 'weekly' : repeat === 'this' ? `biweekly_${thisWeekParity}` : `biweekly_${other}`)

  function save() {
    const s = toMinutes(start)
    const en = toMinutes(end)
    if (!(en > s)) return setError('La hora de fin debe ser posterior a la de inicio.')
    if (validFrom && validTo && validFrom > validTo) return setError('«Desde» no puede ser posterior a «hasta».')
    setError('')
    onSave({
      id: draft.id, title: title.trim() || null, color, location: location.trim() || null, day,
      start_min: s, end_min: en, repeat: repeatValue(), group_code: scope === 'group' ? groupCode : null,
      valid_from: validFrom || null, valid_to: validTo || null,
    })
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

        <div>
          <p className="mb-1.5 text-xs text-board-cream/60">Día</p>
          <div className="flex flex-wrap gap-1.5">
            {DAYS.map((d) => (
              <Chip key={d.key} active={day === d.key} onClick={() => setDay(d.key)}>{d.short}</Chip>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <label className="text-xs text-board-cream/60">Desde<input type="time" step={900} value={start} onChange={(e) => setStart(e.target.value)} className="field mt-1" /></label>
          <label className="text-xs text-board-cream/60">Hasta<input type="time" step={900} value={end} onChange={(e) => setEnd(e.target.value)} className="field mt-1" /></label>
        </div>

        <div className="flex flex-wrap items-center gap-2.5" role="radiogroup" aria-label="Color">
          {COLORS.map((c) => (
            <button key={c} type="button" role="radio" aria-checked={color === c} aria-label={`Color ${c}`} onClick={() => setColor(c)} style={{ backgroundColor: c }} className={`h-8 w-8 rounded-full ${color === c ? 'ring-2 ring-board-cream ring-offset-2 ring-offset-board-bg' : ''}`} />
          ))}
        </div>

        {error && <p className="text-sm text-board-danger">{error}</p>}

        <Disclosure title="Más opciones">
          <div>
            <p className="mb-1.5 text-xs text-board-cream/60">¿Cada cuánto se repite?</p>
            <div className="flex flex-col gap-1.5">
              <Chip active={repeat === 'weekly'} onClick={() => setRepeat('weekly')}>Todas las semanas</Chip>
              <Chip active={repeat === 'this'} onClick={() => setRepeat('this')}>Solo cada 2 semanas, empezando esta semana</Chip>
              <Chip active={repeat === 'next'} onClick={() => setRepeat('next')}>Solo cada 2 semanas, empezando la semana que viene</Chip>
            </div>
            <p className="mt-1.5 text-xs text-board-cream/50">«Esta semana» es la que estás viendo en el horario.</p>
          </div>

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
                {DAYS.filter((d) => d.key !== draft.day).map((d) => (
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
