import { useEffect, useState } from 'react'
import { fetchPublicProfile } from '../lib/profile'

export default function PublicProfile({ userId, onBack }) {
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    fetchPublicProfile(userId).then((result) => {
      if (result.data) setProfile(result.data)
      setLoading(false)
    })
  }, [userId])

  function formatBirthday(dateStr) {
    if (!dateStr) return null
    const d = new Date(dateStr + 'T00:00:00Z')
    return d.toLocaleDateString('es-ES', { day: 'numeric', month: 'long', timeZone: 'UTC' })
  }

  return (
    <div className="min-h-screen max-w-md mx-auto px-4 py-10">
      <button onClick={onBack} className="text-sm text-board-cream/50 hover:text-board-cream mb-6">
        ‹ Volver
      </button>

      {loading ? (
        <p className="text-sm text-board-cream/50">Cargando…</p>
      ) : !profile ? (
        <p className="text-sm text-board-cream/50">No se encontró este perfil.</p>
      ) : (
        <div className="bg-board-panel border border-board-line rounded-md p-6">
          <h1 className="text-2xl font-semibold mb-4">{profile.username}</h1>
          {profile.birthday && (
            <p className="text-sm text-board-cream/70 mb-2">🎂 {formatBirthday(profile.birthday)}</p>
          )}
          {profile.bio ? (
            <p className="text-sm text-board-cream/80 mt-4 whitespace-pre-wrap">{profile.bio}</p>
          ) : (
            <p className="text-sm text-board-cream/40 mt-4 italic">Sin descripción todavía.</p>
          )}
        </div>
      )}
    </div>
  )
}