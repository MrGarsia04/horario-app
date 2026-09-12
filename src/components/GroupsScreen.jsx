import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { updateUsername } from '../lib/auth'

export default function GroupsScreen({ userId, username, onEnterGroup, onSignOut, onUsernameChanged }) {
  const [groups, setGroups] = useState([])
  const [newCode, setNewCode] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  const [editingName, setEditingName] = useState(false)
  const [nameInput, setNameInput] = useState(username)
  const [nameError, setNameError] = useState('')
  const [savingName, setSavingName] = useState(false)

  useEffect(() => {
    loadGroups()
  }, [])

  async function loadGroups() {
    setLoading(true)
    const { data, error } = await supabase
      .from('group_memberships')
      .select('group_code')
      .eq('user_id', userId)
      .order('joined_at', { ascending: true })

    if (!error) setGroups((data ?? []).map((r) => r.group_code))
    setLoading(false)
  }

  async function handleJoin(e) {
    e.preventDefault()
    setError('')
    const code = newCode.trim().toLowerCase()
    if (!code) return

    const { error } = await supabase
      .from('group_memberships')
      .insert({ user_id: userId, group_code: code })

    if (error) {
      setError(error.code === '23505' ? 'Ya estás en ese grupo.' : error.message)
      return
    }
    setNewCode('')
    loadGroups()
  }

  async function handleLeave(code) {
    const ok = window.confirm(
      `¿Salir del grupo "${code}"? Podrás volver a entrar más tarde con el mismo código.`
    )
    if (!ok) return
    await supabase.from('group_memberships').delete().eq('user_id', userId).eq('group_code', code)
    loadGroups()
  }

  async function handleSaveName(e) {
    e.preventDefault()
    setNameError('')
    setSavingName(true)
    const result = await updateUsername(userId, nameInput)
    setSavingName(false)

    if (result.error) {
      setNameError(result.error)
      return
    }
    setEditingName(false)
    onUsernameChanged(result.data.username)
  }

  return (
    <div className="min-h-screen max-w-md mx-auto px-4 py-10">
      <div className="flex items-center justify-between mb-2">
        {editingName ? (
          <form onSubmit={handleSaveName} className="flex items-center gap-2 flex-1">
            <input
              value={nameInput}
              onChange={(e) => setNameInput(e.target.value)}
              className="bg-board-bg border border-board-line rounded px-2 py-1 text-lg font-semibold outline-none focus:border-board-amber"
              autoFocus
            />
            <button type="submit" disabled={savingName} className="text-sm text-board-amber hover:brightness-110">
              Guardar
            </button>
            <button
              type="button"
              onClick={() => {
                setEditingName(false)
                setNameInput(username)
                setNameError('')
              }}
              className="text-sm text-board-cream/40 hover:text-board-cream/70"
            >
              Cancelar
            </button>
          </form>
        ) : (
          <h1 className="text-2xl font-semibold flex items-center gap-2">
            {username}
            <button
              onClick={() => setEditingName(true)}
              className="text-xs text-board-cream/40 hover:text-board-amber font-normal"
            >
              editar nombre
            </button>
          </h1>
        )}
        <button onClick={onSignOut} className="text-sm text-board-cream/50 hover:text-board-cream ml-3">
          Cerrar sesión
        </button>
      </div>
      {nameError && <p className="text-sm text-red-400 mb-4">{nameError}</p>}

      <p className="text-sm text-board-cream/50 mb-6 mt-6">Tus grupos</p>

      {loading ? (
        <p className="text-sm text-board-cream/50">Cargando…</p>
      ) : groups.length === 0 ? (
        <p className="text-sm text-board-cream/50 mb-6">Todavía no estás en ningún grupo.</p>
      ) : (
        <ul className="space-y-2 mb-8">
          {groups.map((code) => (
            <li
              key={code}
              className="flex items-center justify-between bg-board-panel border border-board-line rounded px-4 py-3"
            >
              <span className="font-mono text-sm">{code}</span>
              <div className="flex gap-3">
                <button onClick={() => onEnterGroup(code)} className="text-sm text-board-amber hover:brightness-110">
                  Entrar
                </button>
                <button onClick={() => handleLeave(code)} className="text-sm text-board-cream/40 hover:text-board-cream/70">
                  Salir
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <form onSubmit={handleJoin} className="bg-board-panel border border-board-line rounded-md p-6">
        <label className="block text-sm text-board-cream/70 mb-1">Unirte a un grupo</label>
        <input
          value={newCode}
          onChange={(e) => setNewCode(e.target.value)}
          placeholder="p.ej. ing-4b"
          className="w-full mb-3 bg-board-bg border border-board-line rounded px-3 py-2 outline-none focus:border-board-amber"
        />
        {error && <p className="text-sm text-red-400 mb-3">{error}</p>}
        <button type="submit" className="w-full bg-board-amber text-board-bg font-semibold py-2 rounded hover:brightness-110 transition">
          Unirme / crear grupo
        </button>
        <p className="text-xs text-board-cream/40 mt-3">
          Si el código no existe todavía, se crea un grupo nuevo automáticamente.
        </p>
      </form>
    </div>
  )
}