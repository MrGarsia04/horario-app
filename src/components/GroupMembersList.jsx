import { useEffect, useState } from 'react'
import { loadFriendData, sendFriendRequest, respondToRequest } from '../lib/friends'

export default function GroupMembersList({ members, myUserId }) {
  const [friendStatus, setFriendStatus] = useState({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    load()
  }, [])

  async function load() {
    setLoading(true)
    const result = await loadFriendData(myUserId)
    if (result.data) {
      const status = {}
      result.data.friends.forEach((f) => (status[f.userId] = 'friend'))
      result.data.incoming.forEach((f) => (status[f.userId] = 'incoming'))
      result.data.outgoing.forEach((f) => (status[f.userId] = 'outgoing'))
      setFriendStatus(status)
    }
    setLoading(false)
  }

  async function handleAdd(member) {
    setError('')
    const result = await sendFriendRequest(myUserId, member.name)
    if (result.error) {
      setError(result.error)
      return
    }
    load()
  }

  async function handleAccept(userId) {
    await respondToRequest(myUserId, userId, true)
    load()
  }

  if (loading) return <p className="text-sm text-board-cream/50">Cargando…</p>

  const others = members.filter((m) => m.userId !== myUserId)

  return (
    <div>
      {error && <p className="text-sm text-red-400 mb-3">{error}</p>}
      {others.length === 0 ? (
        <p className="text-sm text-board-cream/40">No hay más miembros en este grupo todavía.</p>
      ) : (
        <ul className="space-y-2">
          {others.map((m) => (
            <li
              key={m.userId}
              className="flex items-center justify-between bg-board-panel border border-board-line rounded px-4 py-3"
            >
              <span className="text-sm">{m.name}</span>
              {friendStatus[m.userId] === 'friend' && (
                <span className="text-xs text-board-teal">Amigos</span>
              )}
              {friendStatus[m.userId] === 'outgoing' && (
                <span className="text-xs text-board-cream/40">Solicitud enviada</span>
              )}
              {friendStatus[m.userId] === 'incoming' && (
                <button
                  onClick={() => handleAccept(m.userId)}
                  className="text-sm text-board-amber hover:brightness-110"
                >
                  Aceptar solicitud
                </button>
              )}
              {!friendStatus[m.userId] && (
                <button
                  onClick={() => handleAdd(m)}
                  className="text-sm text-board-amber hover:brightness-110"
                >
                  Añadir amigo
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}