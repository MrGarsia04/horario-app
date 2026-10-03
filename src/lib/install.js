import { useSyncExternalStore } from 'react'

// Estado de la instalación como PWA:
//   'installed' → ya está instalada (abierta como app): no se muestra nada
//   'prompt'    → el navegador permite instalar con un clic (Chrome/Edge/Android)
//   'ios'       → iPhone/iPad: no hay botón nativo, se enseñan los pasos
//   'manual'    → otro navegador (p. ej. Firefox) o aún no elegible: se enseñan los pasos
//
// Este módulo se importa desde main.jsx para escuchar 'beforeinstallprompt' cuanto
// antes: el navegador lo lanza una sola vez, y si nadie lo guarda se pierde.

const isStandalone = () =>
  window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true

const isIOS = () =>
  /iphone|ipad|ipod/i.test(navigator.userAgent) ||
  (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1) // iPadOS

let deferredPrompt = null
let justInstalled = false // instalada en esta sesión, aunque esta pestaña aún no sea la app
let state = compute()
const listeners = new Set()

function compute() {
  if (justInstalled || isStandalone()) return 'installed'
  if (deferredPrompt) return 'prompt'
  return isIOS() ? 'ios' : 'manual'
}

function update() {
  const next = compute()
  if (next === state) return
  state = next
  listeners.forEach((l) => l())
}

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault() // evita la mini-barra automática: la lanzamos nosotros con el botón
  deferredPrompt = e
  update()
})

window.addEventListener('appinstalled', () => {
  justInstalled = true
  deferredPrompt = null
  update()
})

window.matchMedia('(display-mode: standalone)').addEventListener('change', update)

// Lanza el diálogo nativo de instalación. Devuelve true si la usuaria aceptó.
export async function promptInstall() {
  if (!deferredPrompt) return false
  deferredPrompt.prompt()
  const { outcome } = await deferredPrompt.userChoice
  deferredPrompt = null // el evento solo se puede usar una vez
  if (outcome === 'accepted') justInstalled = true
  update()
  return outcome === 'accepted'
}

function subscribe(listener) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function useInstallState() {
  return useSyncExternalStore(subscribe, () => state)
}
