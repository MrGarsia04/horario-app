import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { getWeekStart, resolveScheduleForWeek } from '../lib/weeks'
import { intervalsOverlap } from '../lib/timeSlots'
import { useGroupView } from '../hooks/useGroupView'
import { useSaveOverride } from '../hooks/useGroupData'
import ScheduleEditor from '../components/schedule/ScheduleEditor'
import ScheduleGrid from '../components/ScheduleGrid'
import WeekNavigator from '../components/WeekNavigator'

// Pestaña «Horario». Con la migración 0005: editor por bloques. Sin ella: la rejilla antigua.
export default function HorarioPage() {
  const codigo = decodeURIComponent(useParams().codigo ?? '')
  const [week, setWeek] = useState(getWeekStart(new Date()))
  const v = useGroupView(codigo, week)
  const saveOverride = useSaveOverride(codigo, v.user.id)

  if (v.modelLoading || v.membersLoading) return <p className="text-sm text-board-cream/50">Cargando…</p>
  if (v.blockModel) return <ScheduleEditor userId={v.user.id} groupCode={codigo} weekStart={week} onWeekChange={setWeek} />

  // ---- Modelo antiguo ----
  const base = v.me?.baseSchedule ?? []
  const { schedule: mySchedule, isCustomThisWeek } = resolveScheduleForWeek(base, v.overridesByUser[v.user.id] ?? [], week)
  function save(next: unknown[]) {
    ;(saveOverride as any).mutate({ weekStart: week, busySlots: next })
  }
  function toggle(day: string, start: string, end: string) {
    const overlapping = (mySchedule as any[]).filter((iv) => iv.day === day && intervalsOverlap(iv.start, iv.end, start, end))
    save(overlapping.length > 0 ? (mySchedule as any[]).filter((iv) => !(iv.day === day && intervalsOverlap(iv.start, iv.end, start, end))) : [...(mySchedule as any[]), { day, start, end }])
  }
  return (
    <div>
      <WeekNavigator weekStart={week} onChange={setWeek} statusText={isCustomThisWeek ? 'Personalizada desde esta semana' : 'Horario habitual'} />
      <ScheduleGrid config={v.groupConfig} mySchedule={mySchedule} onToggle={toggle} onClearAll={() => save([])} highlightDayKey={v.birthdayDayKey} />
      <p className="mt-2 h-4 text-xs text-board-cream/40">{saveOverride.isPending ? 'Guardando…' : ''}</p>
    </div>
  )
}
