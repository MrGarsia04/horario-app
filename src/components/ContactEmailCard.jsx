import { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { saveContactEmail } from '../lib/auth'

// Formulario del email de contacto (opcional). `onDone` se llama tras guardar;
// `onSkip` (si se pasa) añade el botón «Más tarde».
export default function ContactEmailCard({ onDone, onSkip, title = 'Añade tu correo' }) {
  const { user, contactEmail, contactEmailChanged } = useAuth()
  const [email, setEmail] = useState(contactEmail ?? '')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setSaving(true)
    const result = await saveContactEmail(user.id, email)
    setSaving(false)
    if (result.error) return setError(result.error)
    contactEmailChanged(result.data)
    onDone?.()
  }

  return (
    <form onSubmit={handleSubmit} className="bg-board-panel border border-board-line rounded-md p-6">
      <p className="text-sm text-board-cream/70 mb-1">{title}</p>
      <p className="text-xs text-board-cream/40 mb-3">
        Opcional. Solo lo ve quien administra la app y sirve para verificar tu identidad si olvidas tu contraseña.
      </p>
      <input
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="tu@correo.com"
        autoComplete="email"
        className="w-full mb-3 bg-board-bg border border-board-line rounded px-3 py-2 text-sm outline-none focus:border-board-amber"
      />
      {error && <p className="text-sm text-board-danger mb-3">{error}</p>}
      <div className="flex items-center gap-4">
        <button
          type="submit"
          disabled={saving}
          className="bg-board-amber text-board-onaccent font-semibold px-4 py-2 rounded text-sm hover:brightness-110 disabled:opacity-60"
        >
          {saving ? 'Guardando…' : 'Guardar'}
        </button>
        {onSkip && (
          <button type="button" onClick={onSkip} className="text-sm text-board-cream/50 hover:text-board-cream">
            Más tarde
          </button>
        )}
      </div>
    </form>
  )
}
