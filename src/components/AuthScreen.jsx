import { useState } from 'react'
import { signIn, signUp, MIN_PASSWORD } from '../lib/auth'
import ThemeToggle from './ThemeToggle'
import InstallButton from './InstallButton'
import bowUrl from '../assets/rosa/bow.svg'

// Un solo formulario: usuario + contraseña. AuthContext detecta la sesión por
// onAuthStateChange, así que no hace falta devolver nada al padre.
export default function AuthScreen() {
  const [mode, setMode] = useState('login')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [needNewPassword, setNeedNewPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  function switchMode() {
    setMode(mode === 'login' ? 'signup' : 'login')
    setError('')
    setNeedNewPassword(false)
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    const result =
      mode === 'login' ? await signIn(username, password, needNewPassword ? newPassword : undefined) : await signUp(username, password)
    setLoading(false)

    if (result.needNewPassword) {
      setNeedNewPassword(true)
      setError(
        needNewPassword
          ? `Elige una contraseña nueva distinta, de al menos ${MIN_PASSWORD} caracteres.`
          : `Tu contraseña de siempre es muy corta para el sistema nuevo. Elige una nueva (mínimo ${MIN_PASSWORD} caracteres).`
      )
      return
    }
    if (result.error) setError(result.error)
  }

  const inputClass = 'w-full mb-4 bg-board-bg border border-board-line rounded px-3 py-2 outline-none focus:border-board-amber'

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="relative w-full max-w-sm">
        {/* Lacito sobre la tarjeta: solo visible en el tema rosa */}
        <img src={bowUrl} alt="" aria-hidden="true" className="only-rosa auth-bow" />

        <form onSubmit={handleSubmit} className="w-full bg-board-panel border border-board-line rounded-md p-8">
          <p className="font-mono text-board-amber text-xs tracking-wide mb-1">panel de horarios</p>
          <h1 className="text-2xl font-semibold mb-6">{mode === 'login' ? 'Inicia sesión' : 'Crea tu cuenta'}</h1>

          <label className="block text-sm text-board-cream/70 mb-1">Nombre de usuario</label>
          <input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="iker"
            autoComplete="username"
            autoCapitalize="none"
            className={inputClass}
          />

          <label className="block text-sm text-board-cream/70 mb-1">Contraseña</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
            className="w-full mb-2 bg-board-bg border border-board-line rounded px-3 py-2 outline-none focus:border-board-amber"
          />
          {mode === 'signup' && <p className="text-xs text-board-cream/40 mb-4">Mínimo {MIN_PASSWORD} caracteres.</p>}

          {needNewPassword && (
            <>
              <label className="block text-sm text-board-cream/70 mb-1 mt-2">Contraseña nueva</label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                autoComplete="new-password"
                className={inputClass}
              />
            </>
          )}

          {error && <p className="text-sm text-board-danger my-3">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-board-amber text-board-onaccent font-semibold py-2 rounded hover:brightness-110 transition disabled:opacity-60"
          >
            {loading ? 'Un momento…' : mode === 'login' ? 'Entrar' : 'Crear cuenta'}
          </button>

          <button
            type="button"
            onClick={switchMode}
            className="w-full text-center text-sm text-board-cream/50 hover:text-board-cream mt-4"
          >
            {mode === 'login' ? '¿No tienes cuenta? Créala' : '¿Ya tienes cuenta? Inicia sesión'}
          </button>
          {mode === 'login' && (
            <p className="text-center text-xs text-board-cream/40 mt-3">
              ¿Olvidaste la contraseña? Pídele a quien administra la app que te la restablezca.
            </p>
          )}
        </form>

        <div className="mt-5">
          <div className="flex flex-wrap items-start justify-center gap-2">
            <ThemeToggle />
            <InstallButton />
          </div>
        </div>
      </div>
    </div>
  )
}
