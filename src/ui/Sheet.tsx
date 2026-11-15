import { useEffect, useRef, type ReactNode } from 'react'
import { IconClose } from './icons'

interface Props {
  open: boolean
  onClose: () => void
  title: string
  children: ReactNode
  /** Zona fija inferior (botones de acción) */
  footer?: ReactNode
  /** Ocupa casi toda la altura (pantallas largas) */
  tall?: boolean
}

// Hoja inferior en móvil, ventana centrada en pantallas grandes. Cierra con Esc o tocando fuera.
export default function Sheet({ open, onClose, title, children, footer, tall }: Props) {
  const panel = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    panel.current?.focus()
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [open, onClose])

  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center md:items-center" role="presentation">
      <div className="absolute inset-0 bg-black/55" onClick={onClose} aria-hidden="true" />
      <div
        ref={panel}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={`relative flex w-full max-w-lg flex-col rounded-t-2xl border border-board-line bg-board-bg shadow-2xl outline-none md:rounded-2xl ${tall ? 'h-[92dvh]' : 'max-h-[88dvh]'}`}
      >
        <div className="mx-auto mt-2 h-1 w-10 rounded-full bg-board-line md:hidden" aria-hidden="true" />
        <header className="flex items-center justify-between px-5 pb-2 pt-3">
          <h2 className="text-base font-semibold">{title}</h2>
          <button onClick={onClose} className="btn-ghost -mr-2 !min-h-[40px] !px-2" aria-label="Cerrar">
            <IconClose className="h-5 w-5" />
          </button>
        </header>
        <div className="flex-1 overflow-y-auto overscroll-contain px-5 pb-4">{children}</div>
        {footer && <div className="pb-safe border-t border-board-line bg-board-bg px-5 pt-3">{footer}</div>}
      </div>
    </div>
  )
}
