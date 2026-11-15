import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useAuth, ACTIVE_GROUP_KEY } from '../context/AuthContext'
import { useGroupConfig, useGroupMembers, useSaveGroupConfig, useSaveOverride } from '../hooks/useGroupData'
import { useMyBirthday } from '../hooks/useMyBirthday'
import { DEFAULT_CONFIG, ALL_DAYS, intervalsOverlap } from '../lib/timeSlots'
import { getWeekStart, resolveScheduleForWeek, getDateForDay } from '../lib/weeks'
import InstallButton from '../components/InstallButton'
import ScheduleGrid from '../components/ScheduleGrid'
import GroupHeatmap from '../components/GroupHeatmap'
import MemberList from '../components/MemberList'
import GroupSettings from '../components/GroupSettings'
import WeekNavigator from '../components/WeekNavigator'
import GroupMembersList from '../components/GroupMembersList'
import InviteBox from '../components/InviteBox'
import ScheduleEditor from '../components/schedule/ScheduleEditor'
import GroupHeatmap15 from '../components/schedule/GroupHeatmap15'
import BestTimes from '../components/schedule/BestTimes'
import { useBlockModelAvailable, useGroupSchedules } from '../hooks/useSchedules'

function birthdayDayKeyForWeek(weekStart, birthday) {
  if (!birthday) return null
  const monthDay = birthday.slice(5)
  const match = ALL_DAYS.find((d) => getDateForDay(weekStart, d.key).slice(5) === monthDay)
  return match?.key ?? null
}

// `settings` = true cuando la URL es /g/:codigo/config
export default function GroupPage({ settings = false }) {
  const { codigo } = useParams()
  const navigate = useNavigate()
  const { user, signOut } = useAuth()

  const configQuery = useGroupConfig(codigo)
  const membersQuery = useGroupMembers(codigo)
  const birthdayQuery = useMyBirthday(user.id)
  const saveConfig = useSaveGroupConfig(codigo)
  const saveOverride = useSaveOverride(codigo, user.id)
  // Modelo de bloques disponible (migración 0005 aplicada); si no, se usa el modelo antiguo.
  const modelQuery = useBlockModelAvailable()
  const blockModel = modelQuery.data === true

  const [selectedWeek, setSelectedWeek] = useState(getWeekStart(new Date()))
  const [view, setView] = useState('mine')
  const [selectedMember, setSelectedMember] = useState(null)

  const groupConfig = configQuery.data ?? DEFAULT_CONFIG
  const members = membersQuery.data?.members ?? []
  const overridesByUser = membersQuery.data?.overridesByUser ?? {}
  const scheduleQuery = useGroupSchedules(codigo, members, overridesByUser, blockModel)
  const scheduleMembers = scheduleQuery.data ?? []
  const me = members.find((m) => m.userId === user.id)
  const isAdmin = me?.role === 'owner' || me?.role === 'admin'

  const { schedule: mySchedule, isCustomThisWeek } = resolveScheduleForWeek(
    me?.baseSchedule ?? [],
    overridesByUser[user.id] ?? [],
    selectedWeek
  )

  const resolvedMembers = members.map((m) => ({
    userId: m.userId,
    name: m.name,
    schedule: resolveScheduleForWeek(m.baseSchedule, overridesByUser[m.userId] ?? [], selectedWeek)
      .schedule,
  }))

  const myBirthdayDayKey = birthdayDayKeyForWeek(selectedWeek, birthdayQuery.data)

  function saveOverrideForSelectedWeek(next) {
    saveOverride.mutate({ weekStart: selectedWeek, busySlots: next })
  }

  function toggleSlot(day, start, end) {
    const overlapping = mySchedule.filter(
      (iv) => iv.day === day && intervalsOverlap(iv.start, iv.end, start, end)
    )
    const next =
      overlapping.length > 0
        ? mySchedule.filter((iv) => !(iv.day === day && intervalsOverlap(iv.start, iv.end, start, end)))
        : [...mySchedule, { day, start, end }]
    saveOverrideForSelectedWeek(next)
  }

  function handleBackToGroups() {
    localStorage.removeItem(ACTIVE_GROUP_KEY)
    navigate('/grupos')
  }

  const myVisibility = scheduleMembers.find((m) => m.userId === user.id)?.visibility ?? 'busy'
  const selectedSchedule = scheduleMembers.filter((m) => m.name === selectedMember)

  function handleCreatePlan(plan) {
    navigate('/planes', {
      state: { newPlan: { title: '', date: plan.date, startTime: plan.startTime, endTime: plan.endTime, inviteeIds: plan.inviteeIds.filter((id) => id !== user.id) } },
    })
  }

  function handleSaveConfig(newConfig) {
    saveConfig.mutate(newConfig)
    navigate(`/g/${codigo}`)
  }

  const weekStatusText = isCustomThisWeek ? 'Personalizada desde esta semana' : 'Horario habitual'

  return (
    <div className="min-h-screen max-w-3xl mx-auto px-4 py-8">
      <header className="flex items-center justify-between mb-6">
        <div>
          <p className="font-mono text-board-amber text-xs tracking-wide mb-1">grupo: {codigo}</p>
          <h1 className="text-2xl font-semibold">Hola, {user.username}</h1>
        </div>
        <div className="flex items-center gap-4">
          <HeaderButton onClick={() => navigate('/perfil')}>Perfil</HeaderButton>
          <HeaderButton onClick={() => navigate('/planes')}>Planes</HeaderButton>
          {(isAdmin || settings) && (
            <HeaderButton onClick={() => navigate(settings ? `/g/${codigo}` : `/g/${codigo}/config`)}>
              {settings ? 'Volver' : 'Configurar horario'}
            </HeaderButton>
          )}
          <HeaderButton onClick={handleBackToGroups}>Mis grupos</HeaderButton>
        </div>
      </header>

      {settings ? (
        <GroupSettings
          config={groupConfig}
          blockModel={blockModel}
          onSave={handleSaveConfig}
          onCancel={() => navigate(`/g/${codigo}`)}
        />
      ) : (
        <>
          <div className="flex gap-2 mb-4">
            <TabButton active={view === 'mine'} onClick={() => setView('mine')}>
              Mi horario
            </TabButton>
            <TabButton active={view === 'group'} onClick={() => setView('group')}>
              Disponibilidad del grupo ({members.length})
            </TabButton>
            <TabButton active={view === 'members'} onClick={() => setView('members')}>
              Miembros
            </TabButton>
          </div>

          {view !== 'members' && (view !== 'mine' || !blockModel) && (
            <WeekNavigator
              weekStart={selectedWeek}
              onChange={setSelectedWeek}
              statusText={view === 'mine' ? weekStatusText : null}
            />
          )}

          {view === 'mine' && blockModel ? (
            <ScheduleEditor userId={user.id} groupCode={codigo} weekStart={selectedWeek} visibility={myVisibility} />
          ) : view === 'mine' ? (
            <>
              <ScheduleGrid
                config={groupConfig}
                mySchedule={mySchedule}
                onToggle={toggleSlot}
                onClearAll={() => saveOverrideForSelectedWeek([])}
                highlightDayKey={myBirthdayDayKey}
              />
              <p className="text-xs text-board-cream/40 mt-2 h-4">
                {saveOverride.isPending ? 'Guardando…' : ''}
              </p>
            </>
          ) : view === 'group' && blockModel ? (
            <>
              <MemberList members={resolvedMembers} selected={selectedMember} onSelect={setSelectedMember} />
              {scheduleQuery.isLoading ? (
                <p className="text-sm text-board-cream/50">Cargando horarios…</p>
              ) : selectedMember ? (
                <GroupHeatmap15 single config={groupConfig} members={selectedSchedule} weekStart={selectedWeek} groupCode={codigo} myUserId={user.id} highlightDayKey={myBirthdayDayKey} />
              ) : (
                <>
                  <GroupHeatmap15 config={groupConfig} members={scheduleMembers} weekStart={selectedWeek} groupCode={codigo} myUserId={user.id} highlightDayKey={myBirthdayDayKey} />
                  <BestTimes members={scheduleMembers} weekStart={selectedWeek} groupCode={codigo} config={groupConfig} onCreatePlan={handleCreatePlan} />
                </>
              )}
            </>
          ) : view === 'group' ? (
            <>
              <MemberList
                members={resolvedMembers}
                selected={selectedMember}
                onSelect={setSelectedMember}
              />
              {selectedMember ? (
                <ScheduleGrid
                  config={groupConfig}
                  mySchedule={resolvedMembers.find((m) => m.name === selectedMember)?.schedule ?? []}
                  readOnly
                />
              ) : (
                <GroupHeatmap config={groupConfig} members={resolvedMembers} myUserId={user.id} />
              )}
            </>
          ) : (
            <>
              {isAdmin && <InviteBox groupCode={codigo} />}
              <GroupMembersList members={members} myUserId={user.id} />
            </>
          )}
        </>
      )}

      <div className="mt-12 flex flex-wrap items-start justify-center gap-2">
        <InstallButton />
        <button
          onClick={signOut}
          className="inline-flex items-center text-xs px-3 py-1.5 rounded-full border border-board-line bg-board-panel text-board-cream/70 hover:text-board-cream transition"
        >
          Cerrar sesión
        </button>
      </div>
    </div>
  )
}

function HeaderButton({ onClick, children }) {
  return (
    <button onClick={onClick} className="text-sm text-board-cream/50 hover:text-board-cream">
      {children}
    </button>
  )
}

function TabButton({ active, onClick, children }) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-2 rounded text-sm font-medium transition ${
        active
          ? 'bg-board-amber text-board-onaccent'
          : 'bg-board-panel text-board-cream/70 hover:text-board-cream'
      }`}
    >
      {children}
    </button>
  )
}
