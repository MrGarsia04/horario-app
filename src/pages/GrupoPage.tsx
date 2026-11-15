import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { defaultWeek } from '../lib/weeks'
import { useGroupView } from '../hooks/useGroupView'
import GroupHeatmap from '../components/GroupHeatmap'
import AvailabilityMap from '../components/schedule/AvailabilityMap'
import MemberList from '../components/MemberList'
import WeekNavigator from '../components/WeekNavigator'
import ScheduleGrid from '../components/ScheduleGrid'
import GroupMembersList from '../components/GroupMembersList'
import InviteBox from '../components/InviteBox'
import { Tabs, EmptyState } from '../ui/misc'

// Pestaña «Grupo»: mapa de disponibilidad + mejores momentos, y la lista de miembros.
export default function GrupoPage() {
  const codigo = decodeURIComponent(useParams().codigo ?? '')
  const navigate = useNavigate()
  const [week, setWeek] = useState(defaultWeek())
  const [tab, setTab] = useState<'mapa' | 'miembros'>('mapa')
  const [selected, setSelected] = useState<string | null>(null)
  const v = useGroupView(codigo, week)

  if (v.modelLoading || v.membersLoading) return <p className="text-sm text-board-cream/50">Cargando…</p>

  const selectedSchedule = v.scheduleMembers.filter((m) => m.name === selected)

  return (
    <div>
      <Tabs<'mapa' | 'miembros'> label="Secciones del grupo" value={tab} onChange={setTab} items={[{ id: 'mapa', label: 'Disponibilidad' }, { id: 'miembros', label: `Miembros (${v.members.length})` }]} />

      {tab === 'miembros' ? (
        <div className="mt-4">
          {v.isAdmin && <InviteBox groupCode={codigo} />}
          <GroupMembersList members={v.members} myUserId={v.user.id} />
        </div>
      ) : v.members.length <= 1 ? (
        <div className="mt-4"><EmptyState title="Aquí falta gente" text="Invita a tus amigos con el código del grupo (en Ajustes → Administrar el grupo) para ver cuándo coincidís." /></div>
      ) : v.blockModel ? (
        <div className="mt-4 space-y-4">
          <button onClick={() => navigate('/planes')} className="card flex w-full items-center justify-between text-left hover:border-board-amber/50">
            <span className="text-sm"><span className="font-medium">¿Quedamos?</span> <span className="text-board-cream/60">Mira el mejor momento en Planes</span></span>
            <span className="text-board-amber" aria-hidden="true">›</span>
          </button>
          <WeekNavigator weekStart={week} onChange={setWeek} statusText={null} />
          <MemberList members={v.resolvedMembers} selected={selected} onSelect={setSelected} />
          {v.scheduleLoading ? (
            <p className="text-sm text-board-cream/50">Cargando horarios…</p>
          ) : selected ? (
            <AvailabilityMap single config={v.groupConfig} members={selectedSchedule} weekStart={week} groupCode={codigo} myUserId={v.user.id} highlightDayKey={v.birthdayDayKey} />
          ) : (
            <AvailabilityMap config={v.groupConfig} members={v.scheduleMembers} weekStart={week} groupCode={codigo} myUserId={v.user.id} highlightDayKey={v.birthdayDayKey} />
          )}
        </div>
      ) : (
        <div className="mt-4">
          <WeekNavigator weekStart={week} onChange={setWeek} statusText={null} />
          <MemberList members={v.resolvedMembers} selected={selected} onSelect={setSelected} />
          {selected ? (
            <ScheduleGridReadOnly v={v} name={selected} />
          ) : (
            <GroupHeatmap config={v.groupConfig} members={v.resolvedMembers} myUserId={v.user.id} />
          )}
        </div>
      )}
    </div>
  )
}

function ScheduleGridReadOnly({ v, name }: { v: ReturnType<typeof useGroupView>; name: string }) {
  const m = v.resolvedMembers.find((x) => x.name === name)
  return <ScheduleGrid config={v.groupConfig} mySchedule={m?.schedule ?? []} readOnly />
}
