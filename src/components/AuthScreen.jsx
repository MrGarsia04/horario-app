import { useState } from 'react'
import { signIn, signUp, MIN_PASSWORD } from '../lib/auth'
import { requestRecoveryCode, confirmRecovery } from '../lib/recuperar'
import PasswordInput from '../ui/PasswordInput'
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
  const [info, setInfo] = useState('')
  const [code, setCode] = useState('')
  const [loading, setLoading] = useState(false)

  function switchMode() {
    setMode(mode === 'login' ? 'signup' : 'login')
    setError('')
    setInfo('')
    setNeedNewPassword(false)
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setInfo('')

    if (mode === 'forgot') {
      setLoading(true)
      const r = await requestRecoveryCode(username)
      setLoading(false)
      if (r.error) return setError(r.error)
      setInfo(r.data)
      setMode('code')
      return
    }
    if (mode === 'code') {
      if (newPassword !== password) return setError('Las contraseñas no coinciden.')
      setLoading(true)
      const r = await confirmRecovery(username, code, newPassword)
      setLoading(false)
      if (r.error) return setError(r.error)
      setInfo(r.data)
      setMode('login')
      setPassword('')
      setNewPassword('')
      setCode('')
      return
    }

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
          <p className="font-mono text-board-amber text-xs tracking-wide mb-1">Orden, por favor</p>
          <h1 className="text-2xl font-semibold mb-6">{mode === 'login' ? 'Inicia sesión' : mode === 'signup' ? 'Crea tu cuenta' : mode === 'forgot' ? 'Recupera tu contraseña' : 'Pon una contraseña nueva'}</h1>

          <label className="block text-sm text-board-cream/70 mb-1">Nombre de usuario</label>
          <input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="iker"
            autoComplete="username"
            autoCapitalize="none"
            className={inputClass}
          />

          {mode === 'code' && (
            <>
              <label className="block text-sm text-board-cream/70 mb-1">Código de 6 dígitos</label>
              <input
                value={code}
                onChange={(e) => setCode(e.target.value)}
                inputMode="numeric"
                maxLength={6}
                autoComplete="one-time-code"
                placeholder="123456"
                className={`${inputClass} font-mono tracking-widest`}
              />
            </>
          )}

          {mode !== 'forgot' && (
            <>
              <label className="block text-sm text-board-cream/70 mb-1">
                {mode === 'code' ? 'Contraseña nueva' : 'Contraseña'}
              </label>
              <PasswordInput
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                className="w-full mb-2 bg-board-bg border border-board-line rounded px-3 py-2 outline-none focus:border-board-amber"
              />
            </>
          )}
          {(mode === 'signup' || mode === 'code') && <p className="text-xs text-board-cream/40 mb-4">Mínimo {MIN_PASSWORD} caracteres.</p>}

          {mode === 'code' && (
            <>
              <label className="block text-sm text-board-cream/70 mb-1">Repite la contraseña nueva</label>
              <PasswordInput
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                autoComplete="new-password"
                className={inputClass}
              />
            </>
          )}

          {mode === 'login' && needNewPassword && (
            <>
              <label className="block text-sm text-board-cream/70 mb-1 mt-2">Contraseña nueva</label>
              <PasswordInput
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                autoComplete="new-password"
                className={inputClass}
              />
            </>
          )}

          {error && <p className="text-sm text-board-danger my-3">{error}</p>}
          {info && <p className="text-sm text-board-teal my-3">{info}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-board-amber text-board-onaccent font-semibold py-2 rounded hover:brightness-110 transition disabled:opacity-60"
          >
            {loading ? 'Un momento…' : mode === 'login' ? 'Entrar' : mode === 'signup' ? 'Crear cuenta' : mode === 'forgot' ? 'Enviar código' : 'Cambiar contraseña'}
          </button>

          {mode === 'login' || mode === 'signup' ? (
            <button
              type="button"
              onClick={switchMode}
              className="w-full text-center text-sm text-board-cream/50 hover:text-board-cream mt-4"
            >
              {mode === 'login' ? '¿No tienes cuenta? Créala' : '¿Ya tienes cuenta? Inicia sesión'}
            </button>
          ) : (
            <button
              type="button"
              onClick={() => {
                setMode('login')
                setError('')
                setInfo('')
              }}
              className="w-full text-center text-sm text-board-cream/50 hover:text-board-cream mt-4"
            >
              ← Volver a iniciar sesión
            </button>
          )}
          {mode === 'login' && (
            <button
              type="button"
              onClick={() => {
                setMode('forgot')
                setError('')
                setInfo('')
              }}
              className="w-full text-center text-xs text-board-cream/40 hover:text-board-cream/70 mt-3"
            >
              He olvidado mi contraseña
            </button>
          )}
          {mode === 'code' && (
            <p className="text-center text-xs text-board-cream/40 mt-3">
              ¿No te llega nada? Pídele ayuda a quien administra la app.
            </p>
          )}
        </form>

        <div className="mt-5">
          <div className="flex flex-wrap items-start justify-center gap-2">
            <InstallButton />
          </div>
        </div>
      </div>
    </div>
  )
}
