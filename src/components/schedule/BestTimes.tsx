import { useMemo, useState } from 'react'
import { bestSlots, toLabel, toMinutes } from '../../lib/schedule/availability'
import type { DayKey, MemberSchedule } from '../../lib/schedule/types'
import { DAYS } from './constants'

const DURATIONS = [30, 45, 60, 90, 120, 180, 240]

interface Props {
  members: MemberSchedule[]
  weekStart: string
  groupCode: string
  config: { days: DayKey[]; startTime: string; endTime: string }
  onCreatePlan: (p: { date: string; startTime: string; endTime: string; inviteeIds: string[] }) => void
}

export default function BestTimes({ members, weekStart, groupCode, config, onCreatePlan }: Props) {
  const [duration, setDuration] = useState(90)
  const win = useMemo(
    () => ({ days: config.days, startMin: toMinutes(config.startTime), endMin: toMinutes(config.endTime) }),
    [config.days, config.startTime, config.endTime]
  )
  // No se proponen franjas que ya han pasado (el plan se crearía para el año siguiente).
  const best = useMemo(() => {
    const now = new Date()
    const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
    return bestSlots(members, weekStart, groupCode, win, duration, 3, undefined, 2, { date: today, min: now.getHours() * 60 + now.getMinutes() })
  }, [members, weekStart, groupCode, win, duration])
  const names = Object.fromEntries(members.map((m) => [m.userId, m.name]))

  return (
    <div className="mt-6 bg-board-panel border border-board-line rounded-md p-4">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <p className="text-sm font-medium">Mejor momento para quedar (esta semana)</p>
        <label className="text-xs text-board-cream/60">
          Duración{' '}
          <select value={duration} onChange={(e) => setDuration(Number(e.target.value))} className="bg-board-bg border border-board-line rounded px-2 py-1 text-sm">
            {DURATIONS.map((d) => (
              <option key={d} value={d}>{d >= 60 ? `${d / 60} h${d % 60 ? ` ${d % 60} min` : ''}` : `${d} min`}</option>
            ))}
          </select>
        </label>
      </div>

      {best.length === 0 ? (
        <p className="text-sm text-board-cream/50">No hay ninguna franja futura de esa duración con al menos 2 personas libres dentro de la ventana del grupo. Prueba otra duración u otra semana.</p>
      ) : (
        <ol className="space-y-2">
          {best.map((c, i) => {
            const day = DAYS.find((d) => d.key === c.day)!
            const dd = c.date.slice(8, 10) + '/' + c.date.slice(5, 7)
            const absent = members.filter((m) => !c.freeUserIds.includes(m.userId)).map((m) => m.name)
            return (
              <li key={c.date + c.startMin} className="flex flex-wrap items-center justify-between gap-2 text-sm">
                <div>
                  <span className="font-mono text-board-amber">{i + 1}.</span> {day.label} {dd} · {toLabel(c.startMin)}–{toLabel(c.endMin)}
                  <span className="block text-xs text-board-cream/50">
                    {c.freeUserIds.length} de {c.total} libres: {c.freeUserIds.map((id) => names[id]).join(', ')}
                    {absent.length > 0 && ` · no pueden: ${absent.join(', ')}`}
                  </span>
                </div>
                <button
                  onClick={() => onCreatePlan({ date: c.date, startTime: toLabel(c.startMin), endTime: toLabel(c.endMin), inviteeIds: c.freeUserIds })}
                  className="text-xs text-board-amber hover:brightness-110"
                >
                  Crear plan
                </button>
              </li>
            )
          })}
        </ol>
      )}
    </div>
  )
}
