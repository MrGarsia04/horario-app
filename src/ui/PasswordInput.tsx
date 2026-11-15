import { forwardRef, useEffect, useImperativeHandle, useRef, useState, type InputHTMLAttributes } from 'react'
import { IconEye, IconEyeOff } from './icons'

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> & {
  /** clases del <input> (el hueco del botón a la derecha se añade solo) */
  className?: string
}

/**
 * Campo de contraseña con un ojo para ver lo escrito y comprobar que está bien. Por defecto va oculto.
 * - El botón no roba el foco ni mueve el cursor (se conserva la posición de la selección al alternar).
 * - Mantiene `autoComplete` tal cual se le pase (current-password / new-password) para los gestores de contraseñas.
 * - Zona táctil de 44 px dentro del campo, a la derecha.
 */
const PasswordInput = forwardRef<HTMLInputElement, Props>(function PasswordInput({ className = '', ...rest }, ref) {
  const [visible, setVisible] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  useImperativeHandle(ref, () => inputRef.current as HTMLInputElement)
  const caret = useRef<{ start: number | null; end: number | null; focused: boolean } | null>(null)

  function toggle() {
    const el = inputRef.current
    caret.current = el ? { start: el.selectionStart, end: el.selectionEnd, focused: document.activeElement === el } : null
    setVisible((v) => !v)
  }

  // Tras cambiar el tipo, el navegador puede perder la selección: se restaura y se devuelve el foco si lo tenía
  useEffect(() => {
    const el = inputRef.current
    const c = caret.current
    if (!el || !c) return
    if (c.focused) {
      el.focus({ preventScroll: true })
      if (c.start !== null && c.end !== null) el.setSelectionRange(c.start, c.end)
    }
    caret.current = null
  }, [visible])

  return (
    <div className="relative">
      <input
        {...rest}
        ref={inputRef}
        type={visible ? 'text' : 'password'}
        className={`${className} !pr-12`}
        autoCapitalize="none"
        autoCorrect="off"
        spellCheck={false}
      />
      <button
        type="button"
        onMouseDown={(e) => e.preventDefault()} // no quitar el foco al campo
        onClick={toggle}
        aria-label={visible ? 'Ocultar contraseña' : 'Mostrar contraseña'}
        aria-pressed={visible}
        className="absolute inset-y-0 right-0 flex min-h-[44px] w-11 items-center justify-center rounded-r text-board-cream/60 hover:text-board-cream focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-board-amber"
      >
        {visible ? <IconEyeOff className="h-5 w-5" /> : <IconEye className="h-5 w-5" />}
      </button>
    </div>
  )
})

export default PasswordInput
