import { useEffect, useState } from 'react'
import { loadFriendData, sendFriendRequest, respondToRequest, removeFriendOrCancel } from '../lib/friends'

export default function FriendsPanel({ userId, onViewProfile }) {
  const [friends, setFriends] = useState([])
  const [incoming, setIncoming] = useState([])
  const [outgoing, setOutgoing] = useState([])
  const [usernameInput, setUsernameInput] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    load()
  }, [])

  async function load() {
    setLoading(true)
    const result = await loadFriendData(userId)
    if (result.data) {
      setFriends(result.data.friends)
      setIncoming(result.data.incoming)
      setOutgoing(result.data.outgoing)
    }
    setLoading(false)
  }

  async function handleSend(e) {
    e.preventDefault()
    setError('')
    const result = await sendFriendRequest(userId, usernameInput)
    if (result.error) {
      setError(result.error)
      return
    }
    setUsernameInput('')
    load()
  }

  async function handleRespond(otherId, accept) {
    await respondToRequest(userId, otherId, accept)
    load()
  }

  async function handleRemove(otherId) {
    const ok = window.confirm('¿Seguro que quieres eliminar a este amigo?')
    if (!ok) return
    await removeFriendOrCancel(userId, otherId)
    load()
  }

  if (loading) return <p className="text-sm text-board-cream/50">Cargando…</p>

  return (
    <div>
      <form onSubmit={handleSend} className="flex gap-2 mb-6">
        <input
          value={usernameInput}
          onChange={(e) => setUsernameInput(e.target.value)}
          placeholder="nombre de usuario"
          className="flex-1 bg-board-bg border border-board-line rounded px-3 py-2 text-sm outline-none focus:border-board-amber"
        />
        <button
          type="submit"
          className="bg-board-amber text-board-bg font-semibold px-4 rounded text-sm hover:brightness-110"
        >
          Añadir
        </button>
      </form>
      {error && <p className="text-sm text-red-400 mb-4">{error}</p>}

      {incoming.length > 0 && (
        <div className="mb-6">
          <p className="text-sm text-board-cream/70 mb-2">Solicitudes recibidas</p>
          <ul className="space-y-2">
            {incoming.map((f) => (
              <li
                key={f.userId}
                className="flex items-center justify-between bg-board-panel border border-board-line rounded px-4 py-2"
              >
                <span className="text-sm">{f.name}</span>
                <div className="flex gap-3">
                  <button
                    onClick={() => handleRespond(f.userId, true)}
                    className="text-sm text-board-amber hover:brightness-110"
                  >
                    Aceptar
                  </button>
                  <button
                    onClick={() => handleRespond(f.userId, false)}
                    className="text-sm text-board-cream/40 hover:text-red-400"
                  >
                    Rechazar
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {outgoing.length > 0 && (
        <div className="mb-6">
          <p className="text-sm text-board-cream/70 mb-2">Solicitudes enviadas</p>
          <ul className="space-y-2">
            {outgoing.map((f) => (
              <li
                key={f.userId}
                className="flex items-center justify-between bg-board-panel border border-board-line rounded px-4 py-2"
              >
                <span className="text-sm">{f.name}</span>
                <button
                  onClick={() => handleRemove(f.userId)}
                  className="text-sm text-board-cream/40 hover:text-red-400"
                >
                  Cancelar
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <p className="text-sm text-board-cream/70 mb-2">Amigos ({friends.length})</p>
      {friends.length === 0 ? (
        <p className="text-sm text-board-cream/40">Todavía no tienes amigos añadidos.</p>
      ) : (
        <ul className="space-y-2">
          {friends.map((f) => (
            <li
              key={f.userId}
              className="flex items-center justify-between bg-board-panel border border-board-line rounded px-4 py-2"
            >
              <button 
                onClick={() => onViewProfile(f.userId)} 
                className="text-sm hover:text-board-amber text-left"
              >
                {f.name}
              </button>
              <button
                onClick={() => handleRemove(f.userId)}
                className="text-xs text-board-cream/40 hover:text-red-400"
              >
                Eliminar
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}