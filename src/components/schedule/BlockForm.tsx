import { useState } from 'react'
import { toLabel, toMinutes } from '../../lib/schedule/availability'
import type { Block, DayKey, Repeat } from '../../lib/schedule/types'
import { COLORS, DAYS, REPEAT_LABELS } from './constants'

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
  saving: boolean
  onSave: (v: Omit<Block, 'id' | 'user_id' | 'template_id'> & { id?: string }) => void
  onDelete?: () => void
  onCopyTo?: (days: DayKey[]) => void
  onCancel: () => void
}

const input = 'w-full bg-board-bg border border-board-line rounded px-3 py-2 text-sm outline-none focus:border-board-amber'

export default function BlockForm({ draft, groupCode, saving, onSave, onDelete, onCopyTo, onCancel }: Props) {
  const [title, setTitle] = useState(draft.title ?? '')
  const [day, setDay] = useState<DayKey>(draft.day)
  const [start, setStart] = useState(toLabel(draft.start_min))
  const [end, setEnd] = useState(toLabel(draft.end_min))
  const [color, setColor] = useState(draft.color ?? COLORS[0])
  const [location, setLocation] = useState(draft.location ?? '')
  const [repeat, setRepeat] = useState<Repeat>(draft.repeat ?? 'weekly')
  const [scope, setScope] = useState<'all' | 'group'>(draft.group_code ? 'group' : 'all')
  const [validFrom, setValidFrom] = useState(draft.valid_from ?? '')
  const [validTo, setValidTo] = useState(draft.valid_to ?? '')
  const [copyDays, setCopyDays] = useState<DayKey[]>([])
  const [error, setError] = useState('')

  function submit(e: React.FormEvent) {
    e.preventDefault()
    const s = toMinutes(start)
    const en = toMinutes(end)
    if (!(en > s)) return setError('La hora de fin debe ser posterior a la de inicio.')
    if (validFrom && validTo && validFrom > validTo) return setError('«Válido desde» no puede ser posterior a «hasta».')
    setError('')
    onSave({
      id: draft.id,
      title: title.trim() || null,
      color,
      location: location.trim() || null,
      day,
      start_min: s,
      end_min: en,
      repeat,
      group_code: scope === 'group' ? groupCode : null,
      valid_from: validFrom || null,
      valid_to: validTo || null,
    })
  }

  return (
    <form onSubmit={submit} className="bg-board-panel border border-board-line rounded-md p-4 mt-4 space-y-3">
      <p className="text-sm font-medium">{draft.id ? 'Editar bloque' : 'Nuevo bloque'}</p>

      <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Nombre (asignatura, turno…) — opcional" maxLength={80} className={input} />

      <div className="grid grid-cols-3 gap-2">
        <label className="text-xs text-board-cream/60">
          Día
          <select value={day} onChange={(e) => setDay(e.target.value as DayKey)} className={`${input} mt-1`}>
            {DAYS.map((d) => <option key={d.key} value={d.key}>{d.label}</option>)}
          </select>
        </label>
        <label className="text-xs text-board-cream/60">
          Desde
          <input type="time" step={900} value={start} onChange={(e) => setStart(e.target.value)} className={`${input} mt-1`} />
        </label>
        <label className="text-xs text-board-cream/60">
          Hasta
          <input type="time" step={900} value={end} onChange={(e) => setEnd(e.target.value)} className={`${input} mt-1`} />
        </label>
      </div>

      <div className="flex flex-wrap items-center gap-2" role="radiogroup" aria-label="Color">
        {COLORS.map((c) => (
          <button
            key={c}
            type="button"
            role="radio"
            aria-checked={color === c}
            aria-label={`Color ${c}`}
            onClick={() => setColor(c)}
            style={{ backgroundColor: c }}
            className={`w-6 h-6 rounded-full ${color === c ? 'ring-2 ring-board-cream' : 'ring-1 ring-board-line'}`}
          />
        ))}
      </div>

      <input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Lugar (opcional)" maxLength={80} className={input} />

      <div className="grid grid-cols-2 gap-2">
        <label className="text-xs text-board-cream/60">
          Repetición
          <select value={repeat} onChange={(e) => setRepeat(e.target.value as Repeat)} className={`${input} mt-1`}>
            {Object.entries(REPEAT_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </label>
        <label className="text-xs text-board-cream/60">
          Visible en
          <select value={scope} onChange={(e) => setScope(e.target.value as 'all' | 'group')} disabled={!groupCode} className={`${input} mt-1`}>
            <option value="all">Todos mis grupos</option>
            {groupCode && <option value="group">Solo en «{groupCode}»</option>}
          </select>
        </label>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <label className="text-xs text-board-cream/60">
          Válido desde (opcional)
          <input type="date" value={validFrom} onChange={(e) => setValidFrom(e.target.value)} className={`${input} mt-1`} />
        </label>
        <label className="text-xs text-board-cream/60">
          Válido hasta (opcional)
          <input type="date" value={validTo} onChange={(e) => setValidTo(e.target.value)} className={`${input} mt-1`} />
        </label>
      </div>

      {error && <p className="text-sm text-board-danger">{error}</p>}

      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" disabled={saving} className="bg-board-amber text-board-onaccent font-semibold px-4 py-2 rounded text-sm hover:brightness-110 disabled:opacity-60">
          {saving ? 'Guardando…' : 'Guardar'}
        </button>
        <button type="button" onClick={onCancel} className="text-sm text-board-cream/50 hover:text-board-cream">Cancelar</button>
        {onDelete && (
          <button type="button" onClick={onDelete} className="text-sm text-board-danger/80 hover:text-board-danger ml-auto">Borrar</button>
        )}
      </div>

      {draft.id && onCopyTo && (
        <div className="border-t border-board-line pt-3">
          <p className="text-xs text-board-cream/60 mb-2">Copiar este bloque a otros días</p>
          <div className="flex flex-wrap gap-2">
            {DAYS.filter((d) => d.key !== draft.day).map((d) => (
              <label key={d.key} className="text-xs flex items-center gap-1">
                <input type="checkbox" checked={copyDays.includes(d.key)} onChange={(e) => setCopyDays((p) => (e.target.checked ? [...p, d.key] : p.filter((x) => x !== d.key)))} />
                {d.short}
              </label>
            ))}
            <button type="button" disabled={copyDays.length === 0} onClick={() => onCopyTo(copyDays)} className="text-xs text-board-amber disabled:opacity-40">Copiar</button>
          </div>
        </div>
      )}
    </form>
  )
}
