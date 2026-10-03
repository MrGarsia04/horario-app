import { useState } from 'react'
import { signIn, signUp } from '../lib/auth'
import ThemeToggle from './ThemeToggle'
import bowUrl from '../assets/rosa/bow.svg'

export default function AuthScreen({ onAuthed }) {
  const [mode, setMode] = useState('login')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)

    const result = mode === 'login' ? await signIn(username, password) : await signUp(username, password)

    setLoading(false)
    if (result.error) {
      setError(result.error)
      return
    }
    onAuthed(result.data)
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="relative w-full max-w-sm">
        {/* Lacito sobre la tarjeta: solo visible en el tema rosa */}
        <img src={bowUrl} alt="" aria-hidden="true" className="only-rosa auth-bow" />

        <form
          onSubmit={handleSubmit}
          className="w-full bg-board-panel border border-board-line rounded-md p-8"
        >
          <p className="font-mono text-board-amber text-xs tracking-wide mb-1">panel de horarios</p>
          <h1 className="text-2xl font-semibold mb-6">
            {mode === 'login' ? 'Inicia sesión' : 'Crea tu cuenta'}
          </h1>

          <label className="block text-sm text-board-cream/70 mb-1">Nombre de usuario</label>
          <input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="iker"
            className="w-full mb-4 bg-board-bg border border-board-line rounded px-3 py-2 outline-none focus:border-board-amber"
          />

          <label className="block text-sm text-board-cream/70 mb-1">Contraseña</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            className="w-full mb-2 bg-board-bg border border-board-line rounded px-3 py-2 outline-none focus:border-board-amber"
          />
          {mode === 'signup' && (
            <p className="text-xs text-board-cream/40 mb-4">Mínimo 4 caracteres.</p>
          )}

          {error && <p className="text-sm text-board-danger mb-4">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-board-amber text-board-onaccent font-semibold py-2 rounded hover:brightness-110 transition disabled:opacity-60"
          >
            {loading ? 'Un momento…' : mode === 'login' ? 'Entrar' : 'Crear cuenta'}
          </button>

          <button
            type="button"
            onClick={() => {
              setMode(mode === 'login' ? 'signup' : 'login')
              setError('')
            }}
            className="w-full text-center text-sm text-board-cream/50 hover:text-board-cream mt-4"
          >
            {mode === 'login' ? '¿No tienes cuenta? Créala' : '¿Ya tienes cuenta? Inicia sesión'}
          </button>
        </form>

        <div className="mt-5 flex justify-center">
          <ThemeToggle />
        </div>
      </div>
    </div>
  )
}