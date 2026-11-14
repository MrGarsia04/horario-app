import { useState } from 'react'
import { setNewPassword, MIN_PASSWORD } from '../lib/auth'

// Pantalla a la que llega el enlace del email de recuperación (/restablecer).
export default function ResetPasswordScreen({ onDone }) {
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    if (password !== confirm) return setError('Las contraseñas no coinciden.')
    setLoading(true)
    const result = await setNewPassword(password)
    setLoading(false)
    if (result.error) return setError(result.error)
    onDone()
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <form onSubmit={handleSubmit} className="w-full max-w-sm bg-board-panel border border-board-line rounded-md p-8">
        <h1 className="text-2xl font-semibold mb-6">Nueva contraseña</h1>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder={`Contraseña nueva (mín. ${MIN_PASSWORD})`}
          autoComplete="new-password"
          className="w-full mb-3 bg-board-bg border border-board-line rounded px-3 py-2 outline-none focus:border-board-amber"
        />
        <input
          type="password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          placeholder="Repite la contraseña"
          autoComplete="new-password"
          className="w-full mb-4 bg-board-bg border border-board-line rounded px-3 py-2 outline-none focus:border-board-amber"
        />
        {error && <p className="text-sm text-board-danger mb-4">{error}</p>}
        <button
          type="submit"
          disabled={loading}
          className="w-full bg-board-amber text-board-onaccent font-semibold py-2 rounded hover:brightness-110 transition disabled:opacity-60"
        >
          {loading ? 'Un momento…' : 'Guardar contraseña'}
        </button>
      </form>
    </div>
  )
}
