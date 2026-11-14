import { useState } from 'react'
import { signIn, signUp, claimLegacyAccount, requestPasswordReset, MIN_PASSWORD } from '../lib/auth'
import ThemeToggle from './ThemeToggle'
import InstallButton from './InstallButton'
import bowUrl from '../assets/rosa/bow.svg'

// mode: 'login' | 'signup' | 'forgot'. Al iniciar sesión, AuthContext detecta la sesión
// por onAuthStateChange, así que no hace falta devolver nada al padre.
export default function AuthScreen() {
  const [mode, setMode] = useState('login')
  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [oldPassword, setOldPassword] = useState('')
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')
  const [loading, setLoading] = useState(false)

  function switchMode(next) {
    setMode(next)
    setError('')
    setInfo('')
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setInfo('')
    setLoading(true)

    let result
    if (mode === 'login') result = await signIn(email, password)
    else if (mode === 'legacy') result = await claimLegacyAccount(username, oldPassword, email, password)
    else if (mode === 'signup') result = await signUp(username, email, password)
    else result = await requestPasswordReset(email)

    setLoading(false)
    if (result.error === 'LEGACY_USERNAME') {
      setUsername(email)
      setEmail('')
      setMode('legacy')
      setInfo('Eso parece un nombre de usuario antiguo. Rellena estos datos para pasar tu cuenta al nuevo sistema; no pierdes nada.')
      return
    }
    if (result.error) {
      setError(result.error)
      return
    }
    if ((mode === 'signup' || mode === 'legacy') && result.data.needsConfirmation) {
      switchMode('login')
      setInfo('Cuenta creada. Te hemos enviado un email: confírmalo para poder entrar.')
    } else if (mode === 'forgot') {
      setInfo('Si ese email tiene cuenta, te hemos enviado un enlace para restablecer la contraseña.')
    }
  }

  const title = mode === 'login' ? 'Inicia sesión' : mode === 'signup' ? 'Crea tu cuenta' : mode === 'legacy' ? 'Pasa tu cuenta antigua' : 'Recupera tu contraseña'
  const inputClass =
    'w-full mb-4 bg-board-bg border border-board-line rounded px-3 py-2 outline-none focus:border-board-amber'

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="relative w-full max-w-sm">
        {/* Lacito sobre la tarjeta: solo visible en el tema rosa */}
        <img src={bowUrl} alt="" aria-hidden="true" className="only-rosa auth-bow" />

        <form onSubmit={handleSubmit} className="w-full bg-board-panel border border-board-line rounded-md p-8">
          <p className="font-mono text-board-amber text-xs tracking-wide mb-1">panel de horarios</p>
          <h1 className="text-2xl font-semibold mb-6">{title}</h1>

          {(mode === 'signup' || mode === 'legacy') && (
            <>
              <label className="block text-sm text-board-cream/70 mb-1">{mode === 'legacy' ? 'Tu nombre de usuario de siempre' : 'Nombre de usuario'}</label>
              <input
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="iker"
                autoComplete="username"
                className={inputClass}
              />
            </>
          )}

          {mode === 'legacy' && (
            <>
              <label className="block text-sm text-board-cream/70 mb-1">Tu contraseña de siempre</label>
              <input
                type="password"
                value={oldPassword}
                onChange={(e) => setOldPassword(e.target.value)}
                autoComplete="off"
                className={inputClass}
              />
            </>
          )}

          <label className="block text-sm text-board-cream/70 mb-1">{mode === 'legacy' ? 'Email (a partir de ahora entrarás con él)' : 'Email'}</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="tu@email.com"
            autoComplete="email"
            className={inputClass}
          />

          {mode !== 'forgot' && (
            <>
              <label className="block text-sm text-board-cream/70 mb-1">{mode === 'legacy' ? 'Contraseña nueva' : 'Contraseña'}</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                className="w-full mb-2 bg-board-bg border border-board-line rounded px-3 py-2 outline-none focus:border-board-amber"
              />
              {(mode === 'signup' || mode === 'legacy') && (
                <p className="text-xs text-board-cream/40 mb-4">Mínimo {MIN_PASSWORD} caracteres.</p>
              )}
            </>
          )}

          {mode === 'login' && (
            <button
              type="button"
              onClick={() => switchMode('legacy')}
              className="text-xs text-board-amber hover:brightness-110 mb-2 block"
            >
              Ya tenía cuenta de antes (solo con usuario)
            </button>
          )}
          {mode === 'login' && (
            <button
              type="button"
              onClick={() => switchMode('forgot')}
              className="text-xs text-board-cream/50 hover:text-board-cream mb-4 block"
            >
              He olvidado mi contraseña
            </button>
          )}

          {error && <p className="text-sm text-board-danger mb-4">{error}</p>}
          {info && <p className="text-sm text-board-teal mb-4">{info}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-board-amber text-board-onaccent font-semibold py-2 rounded hover:brightness-110 transition disabled:opacity-60"
          >
            {loading
              ? 'Un momento…'
              : mode === 'login'
                ? 'Entrar'
                : mode === 'signup' || mode === 'legacy'
                  ? mode === 'legacy' ? 'Pasar mi cuenta' : 'Crear cuenta'
                  : 'Enviar enlace'}
          </button>

          <button
            type="button"
            onClick={() => switchMode(mode === 'login' ? 'signup' : 'login')}
            className="w-full text-center text-sm text-board-cream/50 hover:text-board-cream mt-4"
          >
            {mode === 'login' ? '¿No tienes cuenta? Créala' : '← Volver a iniciar sesión'}
          </button>
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
