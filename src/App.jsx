import { useEffect, useState } from 'react'
import { supabase } from './lib/supabaseClient'
import { DEFAULT_CONFIG, intervalsOverlap } from './lib/timeSlots'
import AuthScreen from './components/AuthScreen'
import GroupsScreen from './components/GroupsScreen'
import ScheduleGrid from './components/ScheduleGrid'
import GroupHeatmap from './components/GroupHeatmap'
import MemberList from './components/MemberList'
import GroupSettings from './components/GroupSettings'

const SESSION_KEY = 'horario-app-user'
const ACTIVE_GROUP_KEY = 'horario-app-active-group'

export default function App() {
  const [user, setUser] = useState(null)
  const [activeGroup, setActiveGroup] = useState(null)
  const [groupConfig, setGroupConfig] = useState(DEFAULT_CONFIG)
  const [mySchedule, setMySchedule] = useState([])
  const [members, setMembers] = useState([])
  const [view, setView] = useState('mine')
  const [saving, setSaving] = useState(false)
  const [selectedMember, setSelectedMember] = useState(null)
  const [showSettings, setShowSettings] = useState(false)

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
    setMySchedule([])
    setMembers([])
    setSelectedMember(null)
  }

  function handleEnterGroup(code) {
    localStorage.setItem(ACTIVE_GROUP_KEY, code)
    setActiveGroup(code)
  }

  function handleBackToGroups() {
    localStorage.removeItem(ACTIVE_GROUP_KEY)
    setActiveGroup(null)
    setMySchedule([])
    setMembers([])
    setSelectedMember(null)
    setShowSettings(false)
  }

  useEffect(() => {
    if (!activeGroup || !user) return
    loadGroupConfig()
    loadMySchedule()
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

  async function loadMySchedule() {
    const { data, error } = await supabase
      .from('schedules')
      .select('busy_slots')
      .eq('group_code', activeGroup)
      .eq('user_id', user.id)
      .maybeSingle()

    if (error) {
      console.error(error)
      return
    }
    setMySchedule(data?.busy_slots ?? [])
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
      return
    }

    const [{ data: profileRows }, { data: scheduleRows }] = await Promise.all([
      supabase.from('profiles').select('id, username').in('id', userIds),
      supabase.from('schedules').select('user_id, busy_slots').eq('group_code', activeGroup),
    ])

    const usernames = Object.fromEntries((profileRows ?? []).map((p) => [p.id, p.username]))
    const scheduleByUser = Object.fromEntries(
      (scheduleRows ?? []).map((s) => [s.user_id, s.busy_slots ?? []])
    )

    setMembers(
      userIds.map((id) => ({
        userId: id,
        name: usernames[id] ?? '(desconocido)',
        schedule: scheduleByUser[id] ?? [],
      }))
    )
  }

  async function saveMySchedule(next) {
    setMySchedule(next)
    setSaving(true)
    const { error } = await supabase.from('schedules').upsert(
      { group_code: activeGroup, user_id: user.id, busy_slots: next },
      { onConflict: 'group_code,user_id' }
    )
    setSaving(false)
    if (error) console.error(error)
  }

  function toggleSlot(day, start, end) {
    const overlapping = mySchedule.filter(
      (iv) => iv.day === day && intervalsOverlap(iv.start, iv.end, start, end)
    )
    const next =
      overlapping.length > 0
        ? mySchedule.filter((iv) => !(iv.day === day && intervalsOverlap(iv.start, iv.end, start, end)))
        : [...mySchedule, { day, start, end }]
    saveMySchedule(next)
  }

  function clearMySchedule() {
    saveMySchedule([])
  }

  if (!user) return <AuthScreen onAuthed={handleAuthed} />

  if (!activeGroup) {
    return (
      <GroupsScreen
        userId={user.id}
        username={user.username}
        onEnterGroup={handleEnterGroup}
        onSignOut={handleSignOut}
        onUsernameChanged={handleUsernameChanged}
      />
    )
  }

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
            onClick={() => setShowSettings((s) => !s)}
            className="text-sm text-board-cream/50 hover:text-board-cream"
          >
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
          <div className="flex gap-2 mb-6">
            <TabButton active={view === 'mine'} onClick={() => setView('mine')}>
              Mi horario
            </TabButton>
            <TabButton active={view === 'group'} onClick={() => setView('group')}>
              Disponibilidad del grupo ({members.length})
            </TabButton>
          </div>

          {view === 'mine' ? (
            <>
              <ScheduleGrid
                config={groupConfig}
                mySchedule={mySchedule}
                onToggle={toggleSlot}
                onClearAll={clearMySchedule}
              />
              <p className="text-xs text-board-cream/40 mt-2 h-4">{saving ? 'Guardando…' : ''}</p>
            </>
          ) : (
            <>
              <MemberList members={members} selected={selectedMember} onSelect={setSelectedMember} />
              {selectedMember ? (
                <ScheduleGrid
                  config={groupConfig}
                  mySchedule={members.find((m) => m.name === selectedMember)?.schedule ?? []}
                  readOnly
                />
              ) : (
                <GroupHeatmap config={groupConfig} members={members} myUserId={user.id} />
              )}
            </>
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