import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { buildSteps, markTourSeen, nextIndex, progress, type TourStep } from './tourSteps'
import Button from '../ui/Button'

// Recorrido guiado sobre la interfaz real: foco (spotlight) sobre el elemento, tooltip con texto corto y
// «Siguiente / Atrás / Saltar». Solo SEÑALA: no pulsa nada ni modifica datos. Si un elemento no existe se salta ese paso.
// Se escribe a mano (≈200 líneas, sin dependencias) porque necesita navegar entre rutas de React Router y saltar
// pasos que no existan, y así no añade peso ni una librería más que mantener.

const PAD = 8
const FIND_TIMEOUT_MS = 4000

interface Props {
  groupCode: string | null
  onClose: () => void
}

const reducedMotion = () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

const find = (target: string) => document.querySelector<HTMLElement>(`[data-tour="${target}"]`)

export default function Tour({ groupCode, onClose }: Props) {
  const steps = useMemo(() => buildSteps(groupCode), [groupCode])
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const [i, setI] = useState(0)
  const [dir, setDir] = useState<1 | -1>(1)
  const [rect, setRect] = useState<DOMRect | null>(null)
  const [ready, setReady] = useState(false)
  const step = steps[i]
  const primary = useRef<HTMLButtonElement>(null)
  // pasos que ya se comprobó que no se pueden mostrar (el elemento no apareció)
  const missing = useRef<Set<string>>(new Set())
  const available = useCallback((s: TourStep) => !missing.current.has(s.id), [])

  const finish = useCallback(() => {
    markTourSeen()
    onClose()
  }, [onClose])

  const go = useCallback((d: 1 | -1) => {
    setDir(d)
    const n = nextIndex(steps, i, d, available)
    if (n === null) {
      if (d === 1) finish()
      return
    }
    setReady(false)
    setRect(null)
    setI(n)
  }, [steps, i, available, finish])

  // Al entrar en un paso: ir a su ruta si hace falta y esperar a que exista el elemento (o saltar el paso)
  useEffect(() => {
    if (!step.target) {
      setReady(true)
      return
    }
    if (step.path && pathname !== step.path) navigate(step.path)
    let cancelled = false
    const started = Date.now()
    const tick = () => {
      if (cancelled) return
      const el = find(step.target!)
      if (el) {
        el.scrollIntoView({ block: 'center', behavior: reducedMotion() ? 'auto' : 'smooth' })
        setRect(el.getBoundingClientRect())
        setReady(true)
      } else if (Date.now() - started > FIND_TIMEOUT_MS) {
        missing.current.add(step.id)
        const n = nextIndex(steps, i, dir, available)
        if (n === null) {
          if (dir === 1) finish()
          else setI(0)
        } else setI(n)
      } else setTimeout(tick, 100)
    }
    tick()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [i])

  // Mantener el foco sobre el elemento si la página se mueve o cambia de tamaño
  useEffect(() => {
    if (!step.target || !ready) return
    const update = () => {
      const el = find(step.target!)
      if (el) setRect(el.getBoundingClientRect())
    }
    const id = window.setInterval(update, 250)
    window.addEventListener('resize', update)
    window.addEventListener('scroll', update, true)
    return () => {
      window.clearInterval(id)
      window.removeEventListener('resize', update)
      window.removeEventListener('scroll', update, true)
    }
  }, [step, ready])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') finish()
      else if (e.key === 'ArrowRight') go(1)
      else if (e.key === 'ArrowLeft') go(-1)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [go, finish])

  useLayoutEffect(() => {
    if (ready) primary.current?.focus({ preventScroll: true })
  }, [ready, i])

  const { n, total } = progress(steps, i, available)
  const isLast = nextIndex(steps, i, 1, available) === null
  const centered = !step.target || !rect

  // Posición del tooltip: debajo del elemento si cabe, si no encima; siempre dentro de la pantalla
  const vw = typeof window === 'undefined' ? 390 : window.innerWidth
  const vh = typeof window === 'undefined' ? 800 : window.innerHeight
  const width = Math.min(vw - 24, 340)
  let tooltipStyle: React.CSSProperties = { width, left: Math.round((vw - width) / 2), top: Math.round(vh / 2 - 110) }
  if (!centered && rect) {
    const below = rect.bottom + PAD + 12
    const placeBelow = below + 190 < vh
    const left = Math.max(12, Math.min(vw - width - 12, rect.left + rect.width / 2 - width / 2))
    tooltipStyle = placeBelow ? { width, left, top: below } : { width, left, bottom: vh - rect.top + PAD + 12 }
  }

  if (!ready) return <div className="fixed inset-0 z-[70] bg-black/40" aria-hidden="true" />

  return (
    <div className="fixed inset-0 z-[70]" role="dialog" aria-modal="true" aria-label="Recorrido de la app" aria-live="polite">
      {/* Bloquea los toques sobre la app mientras dura el recorrido (solo se señala, no se usa) */}
      <div className="absolute inset-0" onClick={(e) => e.stopPropagation()} />
      {centered ? (
        <div className="absolute inset-0 bg-black/65" aria-hidden="true" />
      ) : (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute rounded-2xl ring-2 ring-board-amber motion-safe:transition-all motion-safe:duration-200"
          style={{ top: rect!.top - PAD, left: rect!.left - PAD, width: rect!.width + PAD * 2, height: rect!.height + PAD * 2, boxShadow: '0 0 0 9999px rgba(0,0,0,0.65)' }}
        />
      )}

      <div className="absolute rounded-2xl border border-board-line bg-board-bg p-4 shadow-2xl" style={tooltipStyle}>
        <div className="mb-1 flex items-start justify-between gap-3">
          <h2 className="text-base font-semibold">{step.title}</h2>
          <button onClick={finish} className="shrink-0 text-xs text-board-cream/60 hover:text-board-cream" aria-label="Saltar el recorrido">Saltar</button>
        </div>
        <p className="text-sm text-board-cream/80">{step.text}</p>
        <div className="mt-4 flex items-center justify-between gap-2">
          <span className="text-xs text-board-cream/50" aria-label={`Paso ${n} de ${total}`}>{n} de {total}</span>
          <div className="flex gap-2">
            {i > 0 && <Button variant="ghost" small onClick={() => go(-1)}>Atrás</Button>}
            <Button small ref={primary} onClick={() => (isLast ? finish() : go(1))}>{i === 0 ? 'Empezar' : isLast ? 'Listo' : 'Siguiente'}</Button>
          </div>
        </div>
      </div>
    </div>
  )
}
