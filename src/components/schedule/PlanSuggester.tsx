import { useState } from 'react'
import { useAuth } from '../../context/AuthContext'
import { useMyGroups } from '../../hooks/useGroups'
import { useGroupView } from '../../hooks/useGroupView'
import { ACTIVE_GROUP_KEY } from '../../context/AuthContext'
import { addWeeks, defaultWeek } from '../../lib/weeks'
import BestTimes from './BestTimes'
import { Chip } from '../../ui/misc'

interface Props {
  onCreatePlan: (p: { title: string; date: string; startTime: string; endTime: string; inviteeIds: string[] }) => void
}

// «Mejor momento para quedar»: vive en Planes. Elige grupo (si tienes varios), semana y duración, y propone 3 franjas.
export default function PlanSuggester({ onCreatePlan }: Props) {
  const { user } = useAuth()
  const groups: string[] = useMyGroups(user.id).data ?? []
  const saved = (() => { try { return localStorage.getItem(ACTIVE_GROUP_KEY) } catch { return null } })()
  const [picked, setPicked] = useState<string | null>(null)
  const code = picked ?? (saved && groups.includes(saved) ? saved : groups[0]) ?? ''
  const [offset, setOffset] = useState(0)
  const week = addWeeks(defaultWeek(), offset)

  if (groups.length === 0) return null
  return <Inner key={code} code={code} groups={groups} onPick={setPicked} week={week} offset={offset} setOffset={setOffset} onCreatePlan={onCreatePlan} userId={user.id} />
}

function Inner({ code, groups, onPick, week, offset, setOffset, onCreatePlan }: { code: string; groups: string[]; onPick: (g: string) => void; week: string; offset: number; setOffset: (n: number) => void; onCreatePlan: Props['onCreatePlan']; userId: string }) {
  const v = useGroupView(code, week)
  if (v.modelLoading || v.membersLoading || v.scheduleLoading) return <p className="mb-6 text-sm text-board-cream/50">Buscando huecos…</p>
  if (!v.blockModel || v.scheduleMembers.length < 2) return null

  const extra = (
    <div className="space-y-2">
      {groups.length > 1 && (
        <div className="-mx-1 flex gap-2 overflow-x-auto px-1" role="group" aria-label="Grupo">
          {groups.map((g) => <Chip key={g} active={g === code} onClick={() => onPick(g)}>{g}</Chip>)}
        </div>
      )}
      <div className="flex gap-2" role="group" aria-label="Semana">
        <Chip active={offset === 0} onClick={() => setOffset(0)}>Esta semana</Chip>
        <Chip active={offset === 1} onClick={() => setOffset(1)}>La próxima</Chip>
      </div>
    </div>
  )
  return (
    <div className="mb-6">
      <BestTimes members={v.scheduleMembers} weekStart={week} groupCode={code} config={v.groupConfig} onCreatePlan={(p) => onCreatePlan({ title: '', date: p.date, startTime: p.startTime, endTime: p.endTime, inviteeIds: p.inviteeIds.filter((id) => id !== v.user.id) })} extra={extra} />
    </div>
  )
}
