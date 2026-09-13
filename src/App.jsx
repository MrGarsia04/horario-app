import { useEffect, useState } from 'react'
import { supabase } from './lib/supabaseClient'
import { DEFAULT_CONFIG, intervalsOverlap } from './lib/timeSlots'
import AuthScreen from './components/AuthScreen'
import GroupsScreen from './components/GroupsScreen'
import ScheduleGrid from './components/ScheduleGrid'
import GroupHeatmap from './components/GroupHeatmap'
import MemberList from './components/MemberList'
import GroupSettings from './components/GroupSettings'
import WeekNavigator from './components/WeekNavigator'
import ProfileScreen from './components/ProfileScreen'
import GroupMembersList from './components/GroupMembersList'
import EventsScreen from './components/EventsScreen'
import { getWeekStart, resolveScheduleForWeek, getDateForDay } from './lib/weeks'
import { ALL_DAYS } from './lib/timeSlots'

const SESSION_KEY = 'horario-app-user'
const ACTIVE_GROUP_KEY = 'horario-app-active-group'

export default function App() {
  const [user, setUser] = useState(null)
  const [activeGroup, setActiveGroup] = useState(null)
  const [groupConfig, setGroupConfig] = useState(DEFAULT_CONFIG)

  const [selectedWeek, setSelectedWeek] = useState(getWeekStart(new Date()))
  const [myBaseSchedule, setMyBaseSchedule] = useState([])
  const [myOverrides, setMyOverrides] = useState([])

  const [members, setMembers] = useState([])
  const [overridesByUser, setOverridesByUser] = useState({})

  const [view, setView] = useState('mine')
  const [saving, setSaving] = useState(false)
  const [selectedMember, setSelectedMember] = useState(null)
  const [showSettings, setShowSettings] = useState(false)
  const [showProfile, setShowProfile] = useState(false)
  const [showEvents, setShowEvents] = useState(false)
  const [myBirthday, setMyBirthday] = useState(null)

  useEffect(() => {
    const savedUser = localStorage.getItem(SESSION_KEY)
    if (savedUser) setUser(JSON.parse(savedUser))

    const savedGroup = localStorage.getItem(ACTIVE_GROUP_KEY)
    if (savedGroup) setActiveGroup(savedGroup)
  }, [])

  function handleAuthed(newUser) {
    localStorage.setItem(SESSION_KEY, JSON.stringify(newUser))
    setUser(newUser)
  }

  function handleUsernameChanged(newUsername) {
    const updated = { ...user, username: newUsername }
    localStorage.setItem(SESSION_KEY, JSON.stringify(updated))
    setUser(updated)
  }

  function handleSignOut() {
    localStorage.removeItem(SESSION_KEY)
    localStorage.removeItem(ACTIVE_GROUP_KEY)
    setUser(null)
    setActiveGroup(null)
    resetGroupState()
  }

  function handleEnterGroup(code) {
    localStorage.setItem(ACTIVE_GROUP_KEY, code)
    setActiveGroup(code)
  }

  function resetGroupState() {
    setMyBaseSchedule([])
    setMyOverrides([])
    setMembers([])
    setOverridesByUser({})
    setSelectedMember(null)
    setShowSettings(false)
  }

  function handleBackToGroups() {
    localStorage.removeItem(ACTIVE_GROUP_KEY)
    setActiveGroup(null)
    resetGroupState()
  }

  useEffect(() => {
  if (!user) return
  supabase
    .from('profiles')
    .select('birthday')
    .eq('id', user.id)
    .maybeSingle()
    .then(({ data }) => setMyBirthday(data?.birthday ?? null))
}, [user?.id, showProfile])

  useEffect(() => {
    if (!activeGroup || !user) return
    loadGroupConfig()
    loadMyData()
    loadGroupMembers()
    setSelectedMember(null)
  }, [activeGroup, user?.id])

  async function loadGroupConfig() {
    const { data, error } = await supabase
      .from('group_settings')
      .select('config')
      .eq('group_code', activeGroup)
      .maybeSingle()

    if (error) {
      console.error(error)
      return
    }
    setGroupConfig(data?.config ?? DEFAULT_CONFIG)
  }

  async function saveGroupConfig(newConfig) {
    setGroupConfig(newConfig)
    setShowSettings(false)
    const { error } = await supabase
      .from('group_settings')
      .upsert({ group_code: activeGroup, config: newConfig }, { onConflict: 'group_code' })
    if (error) console.error(error)
  }

  async function loadMyData() {
    const [{ data: baseRow, error: baseErr }, { data: overrideRows, error: ovErr }] = await Promise.all([
      supabase
        .from('schedules')
        .select('busy_slots')
        .eq('group_code', activeGroup)
        .eq('user_id', user.id)
        .maybeSingle(),
      supabase
        .from('schedule_overrides')
        .select('week_start, busy_slots')
        .eq('group_code', activeGroup)
        .eq('user_id', user.id),
    ])

    if (baseErr) console.error(baseErr)
    if (ovErr) console.error(ovErr)

    setMyBaseSchedule(baseRow?.busy_slots ?? [])
    setMyOverrides(overrideRows ?? [])
  }

  async function loadGroupMembers() {
    const { data: memberships, error: memErr } = await supabase
      .from('group_memberships')
      .select('user_id')
      .eq('group_code', activeGroup)

    if (memErr) {
      console.error(memErr)
      return
    }

    const userIds = memberships.map((m) => m.user_id)
    if (userIds.length === 0) {
      setMembers([])
      setOverridesByUser({})
      return
    }

    const [{ data: profileRows }, { data: scheduleRows }, { data: overrideRows }] = await Promise.all([
      supabase.from('profiles').select('id, username').in('id', userIds),
      supabase.from('schedules').select('user_id, busy_slots').eq('group_code', activeGroup),
      supabase
        .from('schedule_overrides')
        .select('user_id, week_start, busy_slots')
        .eq('group_code', activeGroup)
        .in('user_id', userIds),
    ])

    const usernames = Object.fromEntries((profileRows ?? []).map((p) => [p.id, p.username]))
    const baseByUser = Object.fromEntries(
      (scheduleRows ?? []).map((s) => [s.user_id, s.busy_slots ?? []])
    )

    const grouped = {}
    for (const row of overrideRows ?? []) {
      if (!grouped[row.user_id]) grouped[row.user_id] = []
      grouped[row.user_id].push({ week_start: row.week_start, busy_slots: row.busy_slots })
    }
    setOverridesByUser(grouped)

    setMembers(
      userIds.map((id) => ({
        userId: id,
        name: usernames[id] ?? '(desconocido)',
        baseSchedule: baseByUser[id] ?? [],
      }))
    )
  }

  const { schedule: mySchedule, isCustomThisWeek } = resolveScheduleForWeek(
    myBaseSchedule,
    myOverrides,
    selectedWeek
  )

  const resolvedMembers = members.map((m) => ({
    userId: m.userId,
    name: m.name,
    schedule: resolveScheduleForWeek(m.baseSchedule, overridesByUser[m.userId] ?? [], selectedWeek)
      .schedule,
  }))

  function birthdayDayKeyForWeek(weekStart, birthday) {
  if (!birthday) return null
  const monthDay = birthday.slice(5)
  const match = ALL_DAYS.find((d) => getDateForDay(weekStart, d.key).slice(5) === monthDay)
  return match?.key ?? null
}

const myBirthdayDayKey = birthdayDayKeyForWeek(selectedWeek, myBirthday)

  async function saveOverrideForSelectedWeek(next) {
    setSaving(true)
    const { error } = await supabase.from('schedule_overrides').upsert(
      { group_code: activeGroup, user_id: user.id, week_start: selectedWeek, busy_slots: next },
      { onConflict: 'group_code,user_id,week_start' }
    )
    setSaving(false)
    if (error) {
      console.error(error)
      return
    }
    setMyOverrides((prev) => {
      const others = prev.filter((o) => o.week_start !== selectedWeek)
      return [...others, { week_start: selectedWeek, busy_slots: next }]
    })
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

  function clearMySchedule() {
    saveOverrideForSelectedWeek([])
  }

  if (!user) return <AuthScreen onAuthed={handleAuthed} />

  if (showProfile) {
    return (
      <ProfileScreen
        userId={user.id}
        username={user.username}
        onUsernameChanged={handleUsernameChanged}
        onBack={() => setShowProfile(false)}
      />
    )
  }

  if (showEvents) {
    return <EventsScreen userId={user.id} onBack={() => setShowEvents(false)} />
  }

  if (!activeGroup) {
    return (
      <GroupsScreen
        userId={user.id}
        username={user.username}
        onEnterGroup={handleEnterGroup}
        onSignOut={handleSignOut}
        onOpenProfile={() => setShowProfile(true)}
        onOpenEvents={() => setShowEvents(true)}
      />
    )
  }

  const weekStatusText = isCustomThisWeek ? 'Personalizada desde esta semana' : 'Horario habitual'

  return (
    <div className="min-h-screen max-w-3xl mx-auto px-4 py-8">
      <header className="flex items-center justify-between mb-6">
        <div>
          <p className="font-mono text-board-amber text-xs tracking-wide mb-1">
            grupo: {activeGroup}
          </p>
          <h1 className="text-2xl font-semibold">Hola, {user.username}</h1>
        </div>
        <div className="flex items-center gap-4">
          <button
            onClick={() => setShowProfile(true)}
            className="text-sm text-board-cream/50 hover:text-board-cream"
          >
            Perfil
          </button>
          <button onClick={() => setShowEvents(true)} className="text-sm text-board-cream/50 hover:text-board-cream">
            Planes
          </button>
          <button onClick={() => setShowSettings((s) => !s)} className="text-sm text-board-cream/50 hover:text-board-cream">
            {showSettings ? 'Volver' : 'Configurar horario'}
          </button>
          <button
            onClick={handleBackToGroups}
            className="text-sm text-board-cream/50 hover:text-board-cream"
          >
            Mis grupos
          </button>
        </div>
      </header>

      {showSettings ? (
        <GroupSettings
          config={groupConfig}
          onSave={saveGroupConfig}
          onCancel={() => setShowSettings(false)}
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

          {view !== 'members' && (
            <WeekNavigator
              weekStart={selectedWeek}
              onChange={setSelectedWeek}
              statusText={view === 'mine' ? weekStatusText : null}
            />
          )}

          {view === 'mine' ? (
            <>
              <ScheduleGrid
                config={groupConfig}
                mySchedule={mySchedule}
                onToggle={toggleSlot}
                onClearAll={clearMySchedule}
                highlightDayKey={myBirthdayDayKey}
              />
              <p className="text-xs text-board-cream/40 mt-2 h-4">{saving ? 'Guardando…' : ''}</p>
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
            <GroupMembersList members={members} myUserId={user.id} />
          )}
        </>
      )}
    </div>
  )
}

function TabButton({ active, onClick, children }) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-2 rounded text-sm font-medium transition ${
        active
          ? 'bg-board-amber text-board-bg'
          : 'bg-board-panel text-board-cream/70 hover:text-board-cream'
      }`}
    >
      {children}
    </button>
  )
}