import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger'

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  small?: boolean
  block?: boolean
  loading?: boolean
  icon?: ReactNode
}

// Jerarquía: primario = relleno de acento (UNA acción principal por pantalla), secundario = contorno azul,
// ghost = solo texto, danger = rojo (acciones destructivas).
const CLASS: Record<Variant, string> = {
  primary: 'btn-primary',
  secondary: 'btn-secondary',
  ghost: 'btn-ghost',
  danger: 'btn-danger',
}

const Button = forwardRef<HTMLButtonElement, Props>(function Button(
  { variant = 'primary', small, block, loading, icon, className = '', children, disabled, type = 'button', ...rest },
  ref
) {
  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || loading}
      className={`${CLASS[variant]} ${small ? 'btn-sm' : ''} ${block ? 'w-full' : ''} ${className}`}
      {...rest}
    >
      {icon}
      {loading ? 'Un momento…' : children}
    </button>
  )
})

export default Button
