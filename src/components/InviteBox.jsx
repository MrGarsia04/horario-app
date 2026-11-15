import { useState } from 'react'
import { useInviteCode, useRotateInvite } from '../hooks/useGroups'

// Solo se monta para admins/owner del grupo: muestra el código de invitación largo.
export default function InviteBox({ groupCode }) {
  const invite = useInviteCode(groupCode, true)
  const rotate = useRotateInvite(groupCode)
  const [copied, setCopied] = useState(false)

  async function copy() {
    try {
      await navigator.clipboard.writeText(invite.data)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      /* el usuario puede copiarlo a mano */
    }
  }

  function handleRotate() {
    if (window.confirm('¿Generar un código nuevo? El anterior dejará de funcionar (los miembros actuales no se ven afectados).')) {
      rotate.mutate()
    }
  }

  if (invite.isLoading) return null
  if (!invite.data) return null

  return (
    <div className="bg-board-panel border border-board-line rounded px-4 py-3 mb-4">
      <p className="text-xs text-board-cream/50 mb-1">Código de invitación (compártelo solo con quien quieras que entre)</p>
      <div className="flex items-center gap-3">
        <code className="font-mono text-sm break-all flex-1">{invite.data}</code>
        <button onClick={copy} className="text-sm text-board-amber hover:brightness-110">
          {copied ? 'Copiado' : 'Copiar'}
        </button>
        <button onClick={handleRotate} className="text-sm text-board-cream/40 hover:text-board-cream/70">
          Renovar
        </button>
      </div>
    </div>
  )
}
