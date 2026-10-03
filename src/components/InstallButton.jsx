import { useState } from 'react'
import { useInstallState, promptInstall } from '../lib/install'

function DownloadIcon({ className = '' }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M12 3v12" />
      <path d="m7 10 5 5 5-5" />
      <path d="M5 21h14" />
    </svg>
  )
}

const STEPS = {
  ios: [
    'Pulsa el botón Compartir (el cuadrado con la flecha hacia arriba).',
    'Desliza y elige «Añadir a pantalla de inicio».',
    'Pulsa «Añadir».',
  ],
  manual: [
    'Abre el menú del navegador (⋮ o ≡).',
    'Elige «Instalar aplicación» o «Añadir a pantalla de inicio».',
  ],
}

// Botón para instalar la app. Si el navegador lo permite, abre el diálogo nativo;
// si no (iPhone, Firefox…), despliega los pasos manuales. Una vez instalada
// (o abierta ya como app) desaparece.
// installedMessage: en vez de desaparecer cuando ya está instalada, muestra un aviso
// (útil en Perfil, para que no parezca que falta el botón).
export default function InstallButton({ className = '', installedMessage = false }) {
  const state = useInstallState()
  const [showSteps, setShowSteps] = useState(false)

  if (state === 'installed') {
    return installedMessage ? (
      <p className="text-sm text-board-teal">✓ La app ya está instalada en este dispositivo.</p>
    ) : null
  }

  const handleClick = () => {
    if (state === 'prompt') promptInstall()
    else setShowSteps((s) => !s)
  }

  return (
    <div className={`flex flex-col items-center ${className}`}>
      <button
        type="button"
        onClick={handleClick}
        aria-expanded={state === 'prompt' ? undefined : showSteps}
        className="inline-flex items-center gap-2 text-xs px-3 py-1.5 rounded-full border border-board-amber text-board-amber hover:brightness-110 transition bg-board-panel"
      >
        <DownloadIcon className="w-4 h-4" />
        Instalar en el móvil
      </button>

      {state !== 'prompt' && showSteps && (
        <ol className="mt-3 w-64 list-decimal pl-5 pr-3 py-3 text-xs text-board-cream/70 bg-board-panel border border-board-line rounded-md space-y-1">
          {STEPS[state].map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>
      )}
    </div>
  )
}
