import { useSyncExternalStore } from 'react'

// Temas disponibles. Para añadir uno nuevo: crea su bloque de variables CSS
// (ver src/theme-rosa.css), añádelo aquí y ya aparece en el selector del perfil.
//   color → el que se pinta en la barra del navegador del móvil (<meta theme-color>)
export const THEMES = [
  { id: 'panel', label: 'Oscuro', description: 'El panel de siempre', color: '#1B2430' },
  { id: 'rosa', label: 'Rosa', description: 'Pastel, con flores y lacitos', color: '#FFF0F5' },
]

const THEME_KEY = 'horario-app-theme'
const DEFAULT_THEME = 'panel'

const isValid = (id) => THEMES.some((t) => t.id === id)

function readStoredTheme() {
  try {
    const stored = localStorage.getItem(THEME_KEY)
    return isValid(stored) ? stored : DEFAULT_THEME
  } catch {
    return DEFAULT_THEME // p. ej. navegación privada con el almacenamiento bloqueado
  }
}

// Pone el tema en el documento: atributo data-theme (lo que activa el CSS) y
// color de la barra del navegador.
function applyTheme(id) {
  document.documentElement.setAttribute('data-theme', id)
  const meta = document.querySelector('meta[name="theme-color"]')
  if (meta) meta.setAttribute('content', THEMES.find((t) => t.id === id).color)
}

let current = readStoredTheme()
const listeners = new Set()
applyTheme(current)

function notify() {
  listeners.forEach((listener) => listener())
}

export function setTheme(id) {
  if (!isValid(id) || id === current) return
  current = id
  try {
    localStorage.setItem(THEME_KEY, id)
  } catch {
    // si no se puede guardar, el cambio sigue valiendo para esta sesión
  }
  applyTheme(id)
  notify()
}

// Si la app está abierta en dos pestañas, que se mantengan sincronizadas
window.addEventListener('storage', (e) => {
  if (e.key !== THEME_KEY) return
  const next = readStoredTheme()
  if (next === current) return
  current = next
  applyTheme(next)
  notify()
})

function subscribe(listener) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

// Uso: const [theme, setTheme] = useTheme()
export function useTheme() {
  const theme = useSyncExternalStore(subscribe, () => current)
  return [theme, setTheme]
}
