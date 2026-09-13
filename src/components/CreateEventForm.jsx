import { useEffect, useState } from 'react'
import { loadFriendData } from '../lib/friends'
import { createEvent, updateEvent } from '../lib/events'

const MONTHS = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
]

function daysInMonth(monthIndex) {
  return new Date(2024, monthIndex + 1, 0).getDate()
}

function resolveEventDate(day, monthIndex) {
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  let candidate = new Date(now.getFullYear(), monthIndex, day)
  if (candidate < today) candidate = new Date(now.getFullYear() + 1, monthIndex, day)

  const yyyy = candidate.getFullYear()
  const mm = String(candidate.getMonth() + 1).padStart(2, '0')
  const dd = String(candidate.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

export default function CreateEventForm({ userId, event, existingInviteeIds = [], onCreated, onCancel }) {
  const isEditing = Boolean(event)
  const initialDate = event ? new Date(event.event_date + 'T00:00:00') : new Date()

  const [friends, setFriends] = useState([])
  const [selectedIds, setSelectedIds] = useState(existingInviteeIds)
  const [title, setTitle] = useState(event?.title ?? '')
  const [description, setDescription] = useState(event?.description ?? '')
  const [day, setDay] = useState(initialDate.getDate())
  const [month, setMonth] = useState(initialDate.getMonth())
  const [startTime, setStartTime] = useState(event?.start_time ?? '')
  const [endTime, setEndTime] = useState(event?.end_time ?? '')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    loadFriendData(userId).then((result) => {
      if (result.data) setFriends(result.data.friends)
    })
  }, [userId])

  function toggleFriend(id) {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setSaving(true)

    const eventDate = resolveEventDate(day, month)
    const payload = { title, description, eventDate, startTime, endTime }

    const result = isEditing
      ? await updateEvent(event.id, payload, selectedIds)
      : await createEvent(userId, payload, selectedIds)

    setSaving(false)
    if (result.error) {
      setError(result.error)
      return
    }
    onCreated()
  }

  const dayOptions = Array.from({ length: daysInMonth(month) }, (_, i) => i + 1)

  return (
    <form onSubmit={handleSubmit} className="bg-board-panel border border-board-line rounded-md p-6 space-y-4">
      <div>
        <label className="block text-xs text-board-cream/50 mb-1">Nombre del plan</label>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Plan tenis"
          className="w-full bg-board-bg border border-board-line rounded px-3 py-2 text-sm outline-none focus:border-board-amber"
        />
      </div>

      <div>
        <label className="block text-xs text-board-cream/50 mb-1">Descripción</label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={2}
          placeholder="Ir a jugar al tenis al campo de..."
          className="w-full bg-board-bg border border-board-line rounded px-3 py-2 text-sm outline-none focus:border-board-amber resize-none"
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs text-board-cream/50 mb-1">Día</label>
          <select
            value={day}
            onChange={(e) => setDay(Number(e.target.value))}
            className="w-full bg-board-bg border border-board-line rounded px-2 py-2 text-sm outline-none focus:border-board-amber"
          >
            {dayOptions.map((d) => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs text-board-cream/50 mb-1">Mes</label>
          <select
            value={month}
            onChange={(e) => setMonth(Number(e.target.value))}
            className="w-full bg-board-bg border border-board-line rounded px-2 py-2 text-sm outline-none focus:border-board-amber"
          >
            {MONTHS.map((m, i) => (
              <option key={m} value={i}>{m}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs text-board-cream/50 mb-1">Desde</label>
          <input
            type="time"
            value={startTime}
            onChange={(e) => setStartTime(e.target.value)}
            className="w-full bg-board-bg border border-board-line rounded px-2 py-2 text-sm outline-none focus:border-board-amber"
          />
        </div>
        <div>
          <label className="block text-xs text-board-cream/50 mb-1">Hasta</label>
          <input
            type="time"
            value={endTime}
            onChange={(e) => setEndTime(e.target.value)}
            className="w-full bg-board-bg border border-board-line rounded px-2 py-2 text-sm outline-none focus:border-board-amber"
          />
        </div>
      </div>

      <div>
        <label className="block text-xs text-board-cream/50 mb-2">Invitar a</label>
        {friends.length === 0 ? (
          <p className="text-xs text-board-cream/40">
            Todavía no tienes amigos añadidos — puedes guardar el plan igualmente sin invitar a nadie.
          </p>
        ) : (
          <details className="border border-board-line rounded bg-board-bg">
            <summary className="px-3 py-2 text-sm cursor-pointer select-none text-board-cream/80">
              {selectedIds.length > 0 ? `${selectedIds.length} seleccionados` : 'Elegir amigos'}
            </summary>
            <div className="px-3 pb-3 pt-1 space-y-2 max-h-48 overflow-y-auto">
              {friends.map((f) => (
                <label key={f.userId} className="flex items-center gap-2 text-sm text-board-cream/80">
                  <input
                    type="checkbox"
                    checked={selectedIds.includes(f.userId)}
                    onChange={() => toggleFriend(f.userId)}
                  />
                  {f.name}
                </label>
              ))}
            </div>
          </details>
        )}
      </div>

      {error && <p className="text-sm text-red-400">{error}</p>}

      <div className="flex gap-3">
        <button
          type="submit"
          disabled={saving}
          className="flex-1 bg-board-amber text-board-bg font-semibold py-2 rounded hover:brightness-110 transition disabled:opacity-60"
        >
          {saving ? 'Guardando…' : isEditing ? 'Guardar cambios' : 'Crear plan'}
        </button>
        <button type="button" onClick={onCancel} className="px-4 py-2 text-sm text-board-cream/50">
          Cancelar
        </button>
      </div>
    </form>
  )
}