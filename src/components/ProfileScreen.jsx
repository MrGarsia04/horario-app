import { useEffect, useState } from 'react'
import { updateUsername, changePassword } from '../lib/auth'
import { updateProfileInfo, fetchPublicProfile } from '../lib/profile'
import FriendsPanel from './FriendsPanel'
import PublicProfile from './PublicProfile'

export default function ProfileScreen({ userId, username, onUsernameChanged, onBack }) {
  const [tab, setTab] = useState('cuenta')
  const [viewingProfileId, setViewingProfileId] = useState(null)

  const [editingName, setEditingName] = useState(false)
  const [nameInput, setNameInput] = useState(username)
  const [nameError, setNameError] = useState('')
  const [nameSuccess, setNameSuccess] = useState(false)

  const [birthday, setBirthday] = useState('')
  const [bio, setBio] = useState('')
  const [infoLoading, setInfoLoading] = useState(true)
  const [infoError, setInfoError] = useState('')
  const [infoSuccess, setInfoSuccess] = useState(false)

  const [showPasswordForm, setShowPasswordForm] = useState(false)
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [passwordError, setPasswordError] = useState('')
  const [passwordSuccess, setPasswordSuccess] = useState(false)

  useEffect(() => {
    setInfoLoading(true)
    fetchPublicProfile(userId).then((result) => {
      if (result.data) {
        setBirthday(result.data.birthday ?? '')
        setBio(result.data.bio ?? '')
      }
      setInfoLoading(false)
    })
  }, [userId])

  async function handleSaveName(e) {
    e.preventDefault()
    setNameError('')
    setNameSuccess(false)
    const result = await updateUsername(userId, nameInput)
    if (result.error) {
      setNameError(result.error)
      return
    }
    setEditingName(false)
    setNameSuccess(true)
    onUsernameChanged(result.data.username)
  }

  async function handleSaveInfo(e) {
    e.preventDefault()
    setInfoError('')
    setInfoSuccess(false)
    const result = await updateProfileInfo(userId, { birthday, bio })
    if (result.error) {
      setInfoError(result.error)
      return
    }
    setInfoSuccess(true)
  }

  async function handleChangePassword(e) {
    e.preventDefault()
    setPasswordError('')
    setPasswordSuccess(false)

    if (newPassword !== confirmPassword) {
      setPasswordError('Las contraseñas nuevas no coinciden.')
      return
    }

    const result = await changePassword(userId, currentPassword, newPassword)
    if (result.error) {
      setPasswordError(result.error)
      return
    }
    setPasswordSuccess(true)
    setCurrentPassword('')
    setNewPassword('')
    setConfirmPassword('')
  }

  if (viewingProfileId) {
    return <PublicProfile userId={viewingProfileId} onBack={() => setViewingProfileId(null)} />
  }

  return (
    <div className="min-h-screen max-w-md mx-auto px-4 py-10">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-semibold">Tu perfil</h1>
        <button onClick={onBack} className="text-sm text-board-cream/50 hover:text-board-cream">
          Volver
        </button>
      </div>

      <div className="flex gap-2 mb-6">
        <button
          onClick={() => setTab('cuenta')}
          className={`px-4 py-2 rounded text-sm font-medium ${
            tab === 'cuenta' ? 'bg-board-amber text-board-bg' : 'bg-board-panel text-board-cream/70'
          }`}
        >
          Cuenta
        </button>
        <button
          onClick={() => setTab('amigos')}
          className={`px-4 py-2 rounded text-sm font-medium ${
            tab === 'amigos' ? 'bg-board-amber text-board-bg' : 'bg-board-panel text-board-cream/70'
          }`}
        >
          Amigos
        </button>
      </div>

      {tab === 'cuenta' ? (
        <div className="space-y-4">
          <div className="bg-board-panel border border-board-line rounded-md p-6">
            <p className="text-sm text-board-cream/70 mb-2">Nombre de usuario</p>
            {editingName ? (
              <form onSubmit={handleSaveName} className="flex items-center gap-2">
                <input
                  value={nameInput}
                  onChange={(e) => setNameInput(e.target.value)}
                  className="flex-1 bg-board-bg border border-board-line rounded px-3 py-2 text-sm outline-none focus:border-board-amber"
                  autoFocus
                />
                <button type="submit" className="text-sm text-board-amber hover:brightness-110">
                  Guardar
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setEditingName(false)
                    setNameInput(username)
                    setNameError('')
                  }}
                  className="text-sm text-board-cream/40"
                >
                  Cancelar
                </button>
              </form>
            ) : (
              <div className="flex items-center justify-between">
                <span className="text-lg font-semibold">{username}</span>
                <button
                  onClick={() => setEditingName(true)}
                  className="text-xs text-board-cream/40 hover:text-board-amber"
                >
                  editar
                </button>
              </div>
            )}
            {nameError && <p className="text-sm text-red-400 mt-2">{nameError}</p>}
            {nameSuccess && !editingName && (
              <p className="text-sm text-board-teal mt-2">Nombre actualizado.</p>
            )}
          </div>

          <div className="bg-board-panel border border-board-line rounded-md p-6">
            <p className="text-sm text-board-cream/70 mb-3">Sobre ti</p>
            {infoLoading ? (
              <p className="text-sm text-board-cream/40">Cargando…</p>
            ) : (
              <form onSubmit={handleSaveInfo} className="space-y-3">
                <div>
                  <label className="block text-xs text-board-cream/50 mb-1">Cumpleaños</label>
                  <input
                    type="date"
                    value={birthday}
                    onChange={(e) => setBirthday(e.target.value)}
                    className="w-full bg-board-bg border border-board-line rounded px-3 py-2 text-sm outline-none focus:border-board-amber"
                  />
                  <p className="text-xs text-board-cream/40 mt-1">
                    Aparecerá marcado en tu horario ese día cada año.
                  </p>
                </div>
                <div>
                  <label className="block text-xs text-board-cream/50 mb-1">Descripción breve</label>
                  <textarea
                    value={bio}
                    onChange={(e) => setBio(e.target.value)}
                    maxLength={200}
                    rows={3}
                    placeholder="Cuenta algo sobre ti…"
                    className="w-full bg-board-bg border border-board-line rounded px-3 py-2 text-sm outline-none focus:border-board-amber resize-none"
                  />
                  <p className="text-xs text-board-cream/40 mt-1 text-right">{bio.length}/200</p>
                </div>
                {infoError && <p className="text-sm text-red-400">{infoError}</p>}
                {infoSuccess && <p className="text-sm text-board-teal">Guardado.</p>}
                <button
                  type="submit"
                  className="w-full bg-board-amber text-board-bg font-semibold py-2 rounded hover:brightness-110 transition"
                >
                  Guardar
                </button>
              </form>
            )}
          </div>

          <div className="bg-board-panel border border-board-line rounded-md overflow-hidden">
            <button
              onClick={() => setShowPasswordForm((s) => !s)}
              className="w-full flex items-center justify-between px-6 py-4 text-sm text-board-cream/70 hover:text-board-cream"
            >
              Cambiar contraseña
              <span className="text-board-cream/40">{showPasswordForm ? '▾' : '▸'}</span>
            </button>
            {showPasswordForm && (
              <form onSubmit={handleChangePassword} className="px-6 pb-6 space-y-3">
                <input
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="Contraseña actual"
                  className="w-full bg-board-bg border border-board-line rounded px-3 py-2 text-sm outline-none focus:border-board-amber"
                />
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Contraseña nueva"
                  className="w-full bg-board-bg border border-board-line rounded px-3 py-2 text-sm outline-none focus:border-board-amber"
                />
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Repite la contraseña nueva"
                  className="w-full bg-board-bg border border-board-line rounded px-3 py-2 text-sm outline-none focus:border-board-amber"
                />
                {passwordError && <p className="text-sm text-red-400">{passwordError}</p>}
                {passwordSuccess && <p className="text-sm text-board-teal">Contraseña actualizada.</p>}
                <button
                  type="submit"
                  className="w-full bg-board-amber text-board-bg font-semibold py-2 rounded hover:brightness-110 transition"
                >
                  Cambiar contraseña
                </button>
              </form>
            )}
          </div>
        </div>
      ) : (
        <FriendsPanel userId={userId} onViewProfile={setViewingProfileId} />
      )}
    </div>
  )
}