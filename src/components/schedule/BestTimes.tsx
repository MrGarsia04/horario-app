import { useMemo, useState } from 'react'
import { bestSlots, toLabel, toMinutes } from '../../lib/schedule/availability'
import type { DayKey, MemberSchedule } from '../../lib/schedule/types'
import { DAYS } from './constants'
import Button from '../../ui/Button'

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
    <section className="card border-board-amber/40 bg-board-amber/5">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold">Mejor momento para quedar</h2>
        <label className="text-xs text-board-cream/60">
          <span className="sr-only">Duración</span>
          <select value={duration} onChange={(e) => setDuration(Number(e.target.value))} className="field !min-h-[36px] !w-auto !py-1 text-xs" aria-label="Duración del plan">
            {DURATIONS.map((d) => (
              <option key={d} value={d}>{d >= 60 ? `${Math.floor(d / 60)} h${d % 60 ? ` ${d % 60} min` : ''}` : `${d} min`}</option>
            ))}
          </select>
        </label>
      </div>

      {best.length === 0 ? (
        <p className="text-sm text-board-cream/60">No hay ninguna franja futura de esa duración con al menos 2 personas libres. Prueba otra duración u otra semana.</p>
      ) : (
        <ol className="space-y-2">
          {best.map((c, i) => {
            const day = DAYS.find((d) => d.key === c.day)!
            const dd = c.date.slice(8, 10) + '/' + c.date.slice(5, 7)
            const absent = members.filter((m) => !c.freeUserIds.includes(m.userId)).map((m) => m.name)
            return (
              <li key={c.date + c.startMin} className={`flex items-center justify-between gap-3 rounded-lg px-3 py-2.5 ${i === 0 ? 'bg-board-panel ring-1 ring-board-free/50' : 'bg-board-panel/60'}`}>
                <div className="min-w-0">
                  <p className="text-sm font-semibold">{day.label} {dd} · {toLabel(c.startMin)}–{toLabel(c.endMin)}</p>
                  <p className="truncate text-xs text-board-cream/60">
                    <span className="text-board-free">● {c.freeUserIds.length} de {c.total} libres</span>
                    {absent.length > 0 && ` · no pueden: ${absent.join(', ')}`}
                  </p>
                </div>
                <Button variant={i === 0 ? 'primary' : 'secondary'} small onClick={() => onCreatePlan({ date: c.date, startTime: toLabel(c.startMin), endTime: toLabel(c.endMin), inviteeIds: c.freeUserIds })}>
                  Crear plan
                </Button>
              </li>
            )
          })}
        </ol>
      )}
    </section>
  )
}
