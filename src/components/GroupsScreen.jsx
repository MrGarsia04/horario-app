import { useState } from 'react'
import { useMyGroups, useJoinGroup, useLeaveGroup, useCreateGroup } from '../hooks/useGroups'
import Button from '../ui/Button'
import { Card, EmptyState } from '../ui/misc'

// Lista de grupos. Unirse (con código de invitación) y crear van en tarjetas plegables
// para que lo importante —tus grupos— se vea primero.
export default function GroupsScreen({ userId, onEnterGroup }) {
  const [joinOpen, setJoinOpen] = useState(false)
  const [createOpen, setCreateOpen] = useState(false)
  const [newCode, setNewCode] = useState('')
  const [error, setError] = useState('')
  const [createName, setCreateName] = useState('')
  const [createError, setCreateError] = useState('')
  const groupsQuery = useMyGroups(userId)
  const joinGroup = useJoinGroup(userId)
  const leaveGroup = useLeaveGroup(userId)
  const createGroup = useCreateGroup(userId)
  const groups = groupsQuery.data ?? []

  async function handleJoin(e) {
    e.preventDefault()
    setError('')
    const invite = newCode.trim()
    if (!invite) return
    try {
      await joinGroup.mutateAsync(invite)
      setNewCode('')
      setJoinOpen(false)
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
      setCreateOpen(false)
    } catch (err) {
      setCreateError(err.message)
    }
  }

  function handleLeave(code) {
    const ok = window.confirm(`¿Salir del grupo "${code}"? Podrás volver a entrar con su código de invitación.`)
    if (ok) leaveGroup.mutate(code)
  }

  return (
    <div className="max-w-md mx-auto">
      <h1 className="text-2xl font-semibold mb-4">Mis grupos</h1>

      {groupsQuery.isLoading ? (
        <p className="text-sm text-board-cream/50">Cargando…</p>
      ) : groups.length === 0 ? (
        <EmptyState
          title="Todavía no estás en ningún grupo"
          text="Únete con el código de invitación que te pase alguien, o crea uno nuevo para tus amigos."
        />
      ) : (
        <ul className="space-y-2">
          {groups.map((code) => (
            <li key={code}>
              <Card className="flex items-center justify-between !py-3">
                <span className="font-mono text-sm">{code}</span>
                <span className="flex items-center gap-1">
                  <Button variant="ghost" small onClick={() => handleLeave(code)}>Salir</Button>
                  <Button small onClick={() => onEnterGroup(code)}>Entrar</Button>
                </span>
              </Card>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-6 space-y-3">
        <Card data-tour="join-group">
          <button className="flex w-full items-center justify-between text-left text-sm font-medium" onClick={() => setJoinOpen((o) => !o)} aria-expanded={joinOpen}>
            Unirme a un grupo <span className="text-board-cream/50">{joinOpen ? '−' : '+'}</span>
          </button>
          {joinOpen && (
            <form onSubmit={handleJoin} className="mt-3 space-y-3">
              <input value={newCode} onChange={(e) => setNewCode(e.target.value)} placeholder="Código de invitación" autoComplete="off" className="field font-mono" aria-label="Código de invitación" />
              {error && <p className="text-sm text-board-danger">{error}</p>}
              <Button type="submit" block>Unirme</Button>
              <p className="text-xs text-board-cream/50">Pídele el código a quien administra el grupo.</p>
            </form>
          )}
        </Card>

        <Card>
          <button className="flex w-full items-center justify-between text-left text-sm font-medium" onClick={() => setCreateOpen((o) => !o)} aria-expanded={createOpen}>
            Crear un grupo nuevo <span className="text-board-cream/50">{createOpen ? '−' : '+'}</span>
          </button>
          {createOpen && (
            <form onSubmit={handleCreate} className="mt-3 space-y-3">
              <input value={createName} onChange={(e) => setCreateName(e.target.value)} placeholder="Nombre del grupo (p. ej. ing-4b)" className="field" aria-label="Nombre del grupo" />
              {createError && <p className="text-sm text-board-danger">{createError}</p>}
              <Button type="submit" variant="secondary" block>Crear grupo</Button>
              <p className="text-xs text-board-cream/50">Serás el propietario y podrás compartir el código de invitación.</p>
            </form>
          )}
        </Card>
      </div>
    </div>
  )
}
