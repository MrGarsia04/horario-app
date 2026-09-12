import { useState } from 'react'

export default function JoinGroup({ onJoin }) {
  const [name, setName] = useState('')
  const [groupCode, setGroupCode] = useState('')

  function handleSubmit(e) {
    e.preventDefault()
    if (!name.trim() || !groupCode.trim()) return
    onJoin({ name: name.trim(), groupCode: groupCode.trim().toLowerCase() })
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm bg-board-panel border border-board-line rounded-md p-8"
      >
        <p className="font-mono text-board-amber text-xs tracking-wide mb-1">
          panel de horarios
        </p>
        <h1 className="text-2xl font-semibold mb-6">Entra a tu grupo</h1>

        <label className="block text-sm text-board-cream/70 mb-1">Tu nombre</label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Iker"
          className="w-full mb-4 bg-board-bg border border-board-line rounded px-3 py-2 outline-none focus:border-board-amber"
        />

        <label className="block text-sm text-board-cream/70 mb-1">Código del grupo</label>
        <input
          value={groupCode}
          onChange={(e) => setGroupCode(e.target.value)}
          placeholder="p.ej. ing-4b"
          className="w-full mb-6 bg-board-bg border border-board-line rounded px-3 py-2 outline-none focus:border-board-amber"
        />
        <p className="text-xs text-board-cream/50 mb-6">
          Usa el mismo código que tus compañeros para compartir horarios. Si es la primera
          vez que se usa ese código, se crea el grupo automáticamente.
        </p>

        <button
          type="submit"
          className="w-full bg-board-amber text-board-bg font-semibold py-2 rounded hover:brightness-110 transition"
        >
          Entrar
        </button>
      </form>
    </div>
  )
}
