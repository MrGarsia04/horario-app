import { useState } from 'react'
import { useMyGroups, useJoinGroup, useLeaveGroup, useCreateGroup } from '../hooks/useGroups'
import ThemeToggle from './ThemeToggle'
import InstallButton from './InstallButton'

export default function GroupsScreen({ userId, username, onEnterGroup, onSignOut, onOpenProfile, onOpenEvents }) {
  const [newCode, setNewCode] = useState('')
  const [error, setError] = useState('')
  const [createName, setCreateName] = useState('')
  const [createError, setCreateError] = useState('')
  const createGroup = useCreateGroup(userId)
  const groupsQuery = useMyGroups(userId)
  const joinGroup = useJoinGroup(userId)
  const leaveGroup = useLeaveGroup(userId)
  const groups = groupsQuery.data ?? []
  const loading = groupsQuery.isLoading

  async function handleJoin(e) {
    e.preventDefault()
    setError('')
    const invite = newCode.trim()
    if (!invite) return
    try {
      await joinGroup.mutateAsync(invite)
      setNewCode('')
    } catch (err) {
      setError(err.message)
    }
  }

  async function handleCreate(e) {
    e.preventDefault()
    setCreateError('')
    const code = createName.trim().toLowerCase()
    if (!code) return
    try {
      await createGroup.mutateAsync(code)
      setCreateName('')
    } catch (err) {
      setCreateError(err.message)
    }
  }

  function handleLeave(code) {
    const ok = window.confirm(
      `¿Salir del grupo "${code}"? Podrás volver a entrar más tarde con el mismo código.`
    )
    if (ok) leaveGroup.mutate(code)
  }

  return (
    <div className="min-h-screen max-w-md mx-auto px-4 py-10">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-semibold">{username}</h1>
        <div className="flex items-center gap-4">
          <button onClick={onOpenProfile} className="text-sm text-board-cream/50 hover:text-board-cream">
            Perfil
          </button>
          <button onClick={onOpenEvents} className="text-sm text-board-cream/50 hover:text-board-cream">
            Planes
          </button>
          <button onClick={onSignOut} className="text-sm text-board-cream/50 hover:text-board-cream">
            Cerrar sesión
          </button>
        </div>
      </div>

      <p className="text-sm text-board-cream/50 mb-6">Tus grupos</p>

      {loading ? (
        <p className="text-sm text-board-cream/50">Cargando…</p>
      ) : groups.length === 0 ? (
        <p className="text-sm text-board-cream/50 mb-6">Todavía no estás en ningún grupo.</p>
      ) : (
        <ul className="space-y-2 mb-8">
          {groups.map((code) => (
            <li
              key={code}
              className="flex items-center justify-between bg-board-panel border border-board-line rounded px-4 py-3"
            >
              <span className="font-mono text-sm">{code}</span>
              <div className="flex gap-3">
                <button onClick={() => onEnterGroup(code)} className="text-sm text-board-amber hover:brightness-110">
                  Entrar
                </button>
                <button onClick={() => handleLeave(code)} className="text-sm text-board-cream/40 hover:text-board-cream/70">
                  Salir
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <form onSubmit={handleJoin} className="bg-board-panel border border-board-line rounded-md p-6 mb-4">
        <label className="block text-sm text-board-cream/70 mb-1">Unirte a un grupo</label>
        <input
          value={newCode}
          onChange={(e) => setNewCode(e.target.value)}
          placeholder="código de invitación"
          autoComplete="off"
          className="w-full mb-3 bg-board-bg border border-board-line rounded px-3 py-2 font-mono text-sm outline-none focus:border-board-amber"
        />
        {error && <p className="text-sm text-board-danger mb-3">{error}</p>}
        <button type="submit" className="w-full bg-board-amber text-board-onaccent font-semibold py-2 rounded hover:brightness-110 transition">
          Unirme
        </button>
        <p className="text-xs text-board-cream/40 mt-3">
          Pídele el código de invitación a quien administre el grupo.
        </p>
      </form>

      <form onSubmit={handleCreate} className="bg-board-panel border border-board-line rounded-md p-6">
        <label className="block text-sm text-board-cream/70 mb-1">Crear un grupo nuevo</label>
        <input
          value={createName}
          onChange={(e) => setCreateName(e.target.value)}
          placeholder="p.ej. ing-4b"
          className="w-full mb-3 bg-board-bg border border-board-line rounded px-3 py-2 outline-none focus:border-board-amber"
        />
        {createError && <p className="text-sm text-board-danger mb-3">{createError}</p>}
        <button type="submit" className="w-full border border-board-amber text-board-amber font-semibold py-2 rounded hover:brightness-110 transition">
          Crear grupo
        </button>
        <p className="text-xs text-board-cream/40 mt-3">
          Serás el propietario y podrás compartir el código de invitación.
        </p>
      </form>

      <div className="mt-8">
        <div className="flex flex-wrap items-start justify-center gap-2">
          <ThemeToggle />
          <InstallButton />
        </div>
      </div>
    </div>
  )
}