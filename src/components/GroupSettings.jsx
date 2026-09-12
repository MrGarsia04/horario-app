import { useState } from 'react'
import { ALL_DAYS } from '../lib/timeSlots'

const SLOT_OPTIONS = [30, 45, 60, 75, 90, 105, 120]

export default function GroupSettings({ config, onSave, onCancel }) {
  const [days, setDays] = useState(config.days)
  const [startTime, setStartTime] = useState(config.startTime)
  const [endTime, setEndTime] = useState(config.endTime)
  const [slotMinutes, setSlotMinutes] = useState(config.slotMinutes)
  const [breaks, setBreaks] = useState(config.breaks || [])

  function toggleDay(key) {
    setDays((prev) => (prev.includes(key) ? prev.filter((d) => d !== key) : [...prev, key]))
  }

  function addBreak() {
    setBreaks((prev) => [...prev, { start: '13:30', end: '14:00' }])
  }

  function updateBreak(index, field, value) {
    setBreaks((prev) => prev.map((b, i) => (i === index ? { ...b, [field]: value } : b)))
  }

  function removeBreak(index) {
    setBreaks((prev) => prev.filter((_, i) => i !== index))
  }

  function handleSave() {
    onSave({ days, startTime, endTime, slotMinutes, breaks })
  }

  return (
    <div className="bg-board-panel border border-board-line rounded-md p-6 max-w-lg">
      <h2 className="text-lg font-semibold mb-1">Configurar horario del grupo</h2>
      <p className="text-xs text-board-cream/50 mb-6">
        Afecta a cómo veis la rejilla todos los del grupo. Los horarios ya marcados se
        conservan aunque cambies esto.
      </p>

      <div className="grid grid-cols-2 gap-4 mb-4">
        <div>
          <label className="block text-sm text-board-cream/70 mb-1">Hora de inicio</label>
          <input
            type="time"
            value={startTime}
            onChange={(e) => setStartTime(e.target.value)}
            className="w-full bg-board-bg border border-board-line rounded px-3 py-2 outline-none focus:border-board-amber"
          />
        </div>
        <div>
          <label className="block text-sm text-board-cream/70 mb-1">Hora de fin</label>
          <input
            type="time"
            value={endTime}
            onChange={(e) => setEndTime(e.target.value)}
            className="w-full bg-board-bg border border-board-line rounded px-3 py-2 outline-none focus:border-board-amber"
          />
        </div>
      </div>

      <label className="block text-sm text-board-cream/70 mb-1">Duración de cada clase</label>
      <select
        value={slotMinutes}
        onChange={(e) => setSlotMinutes(Number(e.target.value))}
        className="w-full mb-4 bg-board-bg border border-board-line rounded px-3 py-2 outline-none focus:border-board-amber"
      >
        {SLOT_OPTIONS.map((m) => (
          <option key={m} value={m}>
            {m} minutos
          </option>
        ))}
      </select>

      <label className="block text-sm text-board-cream/70 mb-2">Días</label>
      <div className="flex flex-wrap gap-2 mb-4">
        {ALL_DAYS.map((day) => (
          <button
            key={day.key}
            type="button"
            onClick={() => toggleDay(day.key)}
            className={`px-3 py-1 rounded-full text-xs font-medium transition ${
              days.includes(day.key)
                ? 'bg-board-amber text-board-bg'
                : 'bg-board-bg text-board-cream/50 border border-board-line'
            }`}
          >
            {day.label}
          </button>
        ))}
      </div>

      <label className="block text-sm text-board-cream/70 mb-2">
        Descansos fijos (siempre libres para todos)
      </label>
      <div className="space-y-2 mb-3">
        {breaks.map((b, i) => (
          <div key={i} className="flex items-center gap-2">
            <input
              type="time"
              value={b.start}
              onChange={(e) => updateBreak(i, 'start', e.target.value)}
              className="bg-board-bg border border-board-line rounded px-2 py-1 text-sm outline-none focus:border-board-amber"
            />
            <span className="text-board-cream/40 text-sm">–</span>
            <input
              type="time"
              value={b.end}
              onChange={(e) => updateBreak(i, 'end', e.target.value)}
              className="bg-board-bg border border-board-line rounded px-2 py-1 text-sm outline-none focus:border-board-amber"
            />
            <button
              type="button"
              onClick={() => removeBreak(i)}
              className="text-xs text-board-cream/40 hover:text-red-400 ml-2"
            >
              Quitar
            </button>
          </div>
        ))}
      </div>
      <button
        type="button"
        onClick={addBreak}
        className="text-xs text-board-amber hover:brightness-110 mb-6"
      >
        + Añadir descanso
      </button>

      <div className="flex gap-3">
        <button
          onClick={handleSave}
          className="flex-1 bg-board-amber text-board-bg font-semibold py-2 rounded hover:brightness-110 transition"
        >
          Guardar
        </button>
        <button
          onClick={onCancel}
          className="px-4 py-2 text-sm text-board-cream/50 hover:text-board-cream"
        >
          Cancelar
        </button>
      </div>
    </div>
  )
}