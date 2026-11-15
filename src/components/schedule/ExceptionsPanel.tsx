import { useState } from 'react'
import { toLabel, toMinutes } from '../../lib/schedule/availability'
import type { Exception } from '../../lib/schedule/types'

interface Props {
  exceptions: Exception[]
  groupCode: string | null
  onAdd: (v: Omit<Exception, 'id' | 'user_id'>) => Promise<void>
  onDelete: (id: string) => Promise<void>
}

const field = 'bg-board-bg border border-board-line rounded px-2 py-1 text-sm outline-none focus:border-board-amber'

function fmtDate(d: string) {
  return new Date(d + 'T00:00:00Z').toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' })
}

export default function ExceptionsPanel({ exceptions, groupCode, onAdd, onDelete }: Props) {
  const [open, setOpen] = useState(false)
  const [date, setDate] = useState('')
  const [kind, setKind] = useState<'free' | 'busy'>('free')
  const [allDay, setAllDay] = useState(true)
  const [start, setStart] = useState('09:00')
  const [end, setEnd] = useState('10:00')
  const [title, setTitle] = useState('')
  const [scope, setScope] = useState<'all' | 'group'>('all')
  const [error, setError] = useState('')

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (!date) return setError('Elige una fecha.')
    const useRange = kind === 'busy' || !allDay
    if (useRange && toMinutes(end) <= toMinutes(start)) return setError('La hora de fin debe ser posterior a la de inicio.')
    try {
      await onAdd({
        date, kind,
        start_min: useRange ? toMinutes(start) : null,
        end_min: useRange ? toMinutes(end) : null,
        title: title.trim() || null,
        group_code: scope === 'group' ? groupCode : null,
      })
      setDate('')
      setTitle('')
    } catch (err) {
      setError((err as Error).message)
    }
  }

  const upcoming = exceptions.filter((e) => e.date >= new Date().toISOString().slice(0, 10))

  return (
    <div className="mt-6">
      <button onClick={() => setOpen((o) => !o)} className="text-sm text-board-amber hover:brightness-110">
        {open ? '▾' : '▸'} Excepciones por fecha ({upcoming.length})
      </button>
      {open && (
        <div className="mt-3 bg-board-panel border border-board-line rounded-md p-4 space-y-3">
          <p className="text-xs text-board-cream/50">Un día libre, o una cita puntual que no se repite. Solo afecta a esa fecha.</p>
          <form onSubmit={submit} className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={field} aria-label="Fecha" />
              <select value={kind} onChange={(e) => setKind(e.target.value as 'free' | 'busy')} className={field} aria-label="Tipo">
                <option value="free">Estoy libre</option>
                <option value="busy">Estoy ocupado</option>
              </select>
              {kind === 'free' && (
                <label className="text-xs flex items-center gap-1">
                  <input type="checkbox" checked={allDay} onChange={(e) => setAllDay(e.target.checked)} /> Todo el día
                </label>
              )}
              {(kind === 'busy' || !allDay) && (
                <>
                  <input type="time" step={900} value={start} onChange={(e) => setStart(e.target.value)} className={field} />
                  <span className="text-xs">–</span>
                  <input type="time" step={900} value={end} onChange={(e) => setEnd(e.target.value)} className={field} />
                </>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Motivo (opcional)" maxLength={80} className={`${field} flex-1 min-w-[8rem]`} />
              {groupCode && (
                <select value={scope} onChange={(e) => setScope(e.target.value as 'all' | 'group')} className={field} aria-label="Ámbito">
                  <option value="all">Todos mis grupos</option>
                  <option value="group">Solo «{groupCode}»</option>
                </select>
              )}
              <button type="submit" className="text-sm text-board-amber">Añadir</button>
            </div>
            {error && <p className="text-sm text-board-danger">{error}</p>}
          </form>

          {upcoming.length > 0 && (
            <ul className="space-y-1">
              {upcoming.map((e) => (
                <li key={e.id} className="flex items-center justify-between text-sm">
                  <span>
                    {fmtDate(e.date)} · {e.kind === 'free' ? 'libre' : 'ocupado'}
                    {e.start_min != null && e.end_min != null ? ` ${toLabel(e.start_min)}–${toLabel(e.end_min)}` : ' todo el día'}
                    {e.title ? ` · ${e.title}` : ''}
                  </span>
                  <button onClick={() => onDelete(e.id).catch(() => {})} className="text-xs text-board-cream/40 hover:text-board-danger">Quitar</button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
