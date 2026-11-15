import { useState } from 'react'
import { useAuth, ACTIVE_GROUP_KEY } from '../../context/AuthContext'
import { useMyGroups } from '../../hooks/useGroups'
import { useGroupView } from '../../hooks/useGroupView'
import { addWeeks, defaultWeek, formatWeekLabelShort, getWeekStart } from '../../lib/weeks'
import { SOCIAL_WINDOW, toLabel } from '../../lib/schedule/availability'
import BestTimes from './BestTimes'
import { IconCalendar, IconLeft, IconRight } from '../../ui/icons'

interface Props {
  onCreatePlan: (p: { title: string; date: string; startTime: string; endTime: string; inviteeIds: string[] }) => void
}

const SOCIAL_CONFIG = { days: SOCIAL_WINDOW.days, startTime: toLabel(SOCIAL_WINDOW.startMin), endTime: toLabel(SOCIAL_WINDOW.endMin) }

// «Mejor momento para quedar»: vive en Planes y trabaja SIEMPRE con tu grupo activo (el que ves en la cabecera).
export default function PlanSuggester({ onCreatePlan }: Props) {
  const { user } = useAuth()
  const groups: string[] = useMyGroups(user.id).data ?? []
  const saved = (() => { try { return localStorage.getItem(ACTIVE_GROUP_KEY) } catch { return null } })()
  const code = (saved && groups.includes(saved) ? saved : groups[0]) ?? ''
  const [week, setWeek] = useState(defaultWeek())
  if (!code) return null
  return <Inner code={code} week={week} setWeek={setWeek} onCreatePlan={onCreatePlan} />
}

function Inner({ code, week, setWeek, onCreatePlan }: { code: string; week: string; setWeek: (w: string) => void; onCreatePlan: Props['onCreatePlan'] }) {
  const v = useGroupView(code, week)
  const isDefault = week === defaultWeek()

  // Selector de semana libre: flechas, rango de fechas y salto a cualquier fecha
  const extra = (
    <div className="space-y-2">
      <p className="text-xs text-board-cream/60">Grupo «{code}» · entre las {SOCIAL_CONFIG.startTime} y las {SOCIAL_CONFIG.endTime}, todos los días</p>
      <div className="flex items-center gap-1">
        <button onClick={() => setWeek(addWeeks(week, -1))} className="btn-ghost !px-2" aria-label="Semana anterior"><IconLeft className="h-5 w-5" /></button>
        <div className="flex-1 text-center">
          <p className="font-mono text-sm">{formatWeekLabelShort(week)}</p>
          {!isDefault && <button onClick={() => setWeek(defaultWeek())} className="text-xs text-board-amber">Ir a la semana actual</button>}
        </div>
        <label className="btn-ghost btn-sm relative !px-3 text-xs" aria-label="Ir a una fecha">
          <IconCalendar className="h-5 w-5" />
          <input type="date" aria-label="Elegir fecha" onChange={(e) => e.target.value && setWeek(getWeekStart(e.target.value))} className="absolute inset-0 h-full w-full cursor-pointer opacity-0" />
        </label>
        <button onClick={() => setWeek(addWeeks(week, 1))} className="btn-ghost !px-2" aria-label="Semana siguiente"><IconRight className="h-5 w-5" /></button>
      </div>
    </div>
  )

  if (v.modelLoading || v.membersLoading || v.scheduleLoading) return <p className="mb-6 text-sm text-board-cream/50">Buscando huecos…</p>
  if (!v.blockModel) return null
  if (v.scheduleMembers.length < 2) {
    return (
      <div className="card mb-6" data-tour="best-times">
        <p className="text-sm font-semibold">Mejor momento para quedar</p>
        <p className="mt-1 text-sm text-board-cream/60">Cuando haya al menos dos personas con horario en «{code}», aquí verás los mejores huecos para quedar.</p>
      </div>
    )
  }
  return (
    <div className="mb-6" data-tour="best-times">
      <BestTimes members={v.scheduleMembers} weekStart={week} groupCode={code} config={SOCIAL_CONFIG} extra={extra}
        onCreatePlan={(p) => onCreatePlan({ title: '', date: p.date, startTime: p.startTime, endTime: p.endTime, inviteeIds: p.inviteeIds.filter((id) => id !== v.user.id) })} />
    </div>
  )
}
