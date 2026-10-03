import { useTheme, THEMES } from '../lib/theme'
import bowUrl from '../assets/rosa/bow.svg'

function MoonIcon({ className = '' }) {
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
      <path d="M20.5 13.5A8.5 8.5 0 1 1 10.5 3.5a6.8 6.8 0 0 0 10 10z" />
    </svg>
  )
}

// Botón pequeño para alternar entre el tema oscuro y el rosa. Pensado para
// pantallas sin ajustes (acceso, lista de grupos). El selector completo con
// vista previa está en ThemePicker (pantalla de perfil).
export default function ThemeToggle({ className = '' }) {
  const [theme, setTheme] = useTheme()
  const isRosa = theme === 'rosa'

  return (
    <button
      type="button"
      onClick={() => setTheme(isRosa ? 'panel' : 'rosa')}
      className={`inline-flex items-center gap-2 text-xs px-3 py-1.5 rounded-full border border-board-line bg-board-panel text-board-cream/70 hover:text-board-cream transition ${className}`}
    >
      {isRosa ? (
        <MoonIcon className="w-4 h-4" />
      ) : (
        <img src={bowUrl} alt="" aria-hidden="true" className="w-5 h-auto" />
      )}
      {isRosa ? 'Modo oscuro' : 'Modo rosa'}
    </button>
  )
}

// Colores LITERALES de cada tema para dibujar su miniatura: a propósito no usan
// las variables CSS, porque la miniatura debe mostrar el tema "ajeno" al activo.
const PREVIEW = {
  panel: { bg: '#1B2430', card: '#131920', line: '#2A3444', accent: '#E8A33D', busy: '#4C7C7C', text: '#F2EFE9', radius: 4 },
  rosa: { bg: '#FFF0F5', card: '#FFFFFF', line: '#F7CBDD', accent: '#C43068', busy: '#A6E3CB', text: '#5B2B42', radius: 9 },
}
// 1 = ocupada, 0 = libre
const PREVIEW_CELLS = [0, 1, 0, 0, 1, 1, 0, 1, 0, 0, 1, 0]

function ThemePreview({ id }) {
  const c = PREVIEW[id]
  return (
    <div
      aria-hidden="true"
      style={{ background: c.bg, border: `1px solid ${c.line}`, borderRadius: c.radius + 3, padding: 8 }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6, height: 14 }}>
        <span style={{ width: 28, height: 8, borderRadius: 999, background: c.accent }} />
        <span style={{ flex: 1, height: 4, borderRadius: 999, background: c.text, opacity: 0.35 }} />
        {id === 'rosa' && <img src={bowUrl} alt="" style={{ width: 18, height: 'auto' }} />}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 3 }}>
        {PREVIEW_CELLS.map((busy, i) => (
          <span
            key={i}
            style={{ height: 9, borderRadius: c.radius / 2, background: busy ? c.busy : c.card }}
          />
        ))}
      </div>
    </div>
  )
}

// Selector de tema con miniaturas (se usa en el perfil)
export function ThemePicker() {
  const [theme, setTheme] = useTheme()

  return (
    <div className="bg-board-panel border border-board-line rounded-md p-6">
      <p className="text-sm text-board-cream/70 mb-3">Apariencia</p>
      <div role="radiogroup" aria-label="Tema de la aplicación" className="grid grid-cols-2 gap-3">
        {THEMES.map((t) => {
          const selected = theme === t.id
          return (
            <button
              key={t.id}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => setTheme(t.id)}
              className={`text-left rounded-md p-2 border-2 transition ${
                selected ? 'border-board-amber' : 'border-board-line hover:border-board-cream/40'
              }`}
            >
              <ThemePreview id={t.id} />
              <span className="block mt-2 px-1 text-sm font-semibold">{t.label}</span>
              <span className="block px-1 text-xs text-board-cream/50">{t.description}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
