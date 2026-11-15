// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import PasswordInput from './PasswordInput'

afterEach(cleanup)

const field = () => screen.getByPlaceholderText('Contraseña') as HTMLInputElement
const eye = () => screen.getByRole('button', { name: /contraseña/i })

describe('PasswordInput', () => {
  it('por defecto la contraseña va oculta y el botón ofrece mostrarla', () => {
    render(<PasswordInput placeholder="Contraseña" />)
    expect(field().type).toBe('password')
    expect(eye().getAttribute('aria-label')).toBe('Mostrar contraseña')
    expect(eye().getAttribute('aria-pressed')).toBe('false')
  })

  it('pulsar el ojo muestra lo escrito, y volver a pulsar lo oculta', () => {
    render(<PasswordInput placeholder="Contraseña" defaultValue="secreta123" />)
    fireEvent.click(eye())
    expect(field().type).toBe('text')
    expect(field().value).toBe('secreta123')
    expect(eye().getAttribute('aria-label')).toBe('Ocultar contraseña')
    expect(eye().getAttribute('aria-pressed')).toBe('true')
    fireEvent.click(eye())
    expect(field().type).toBe('password')
    expect(eye().getAttribute('aria-label')).toBe('Mostrar contraseña')
  })

  it('no pierde el foco ni la posición del cursor al alternar', () => {
    render(<PasswordInput placeholder="Contraseña" defaultValue="abcdef" />)
    const input = field()
    input.focus()
    input.setSelectionRange(2, 4)
    // el botón evita el cambio de foco al pulsar con el ratón
    expect(fireEvent.mouseDown(eye())).toBe(false) // preventDefault llamado
    fireEvent.click(eye())
    expect(document.activeElement).toBe(input)
    expect([input.selectionStart, input.selectionEnd]).toEqual([2, 4])
  })

  it('el botón no envía el formulario', () => {
    const onSubmit = vi.fn((e: React.FormEvent) => e.preventDefault())
    render(<form onSubmit={onSubmit}><PasswordInput placeholder="Contraseña" /></form>)
    fireEvent.click(eye())
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('conserva autoComplete y el resto de atributos para los gestores de contraseñas', () => {
    render(<PasswordInput placeholder="Contraseña" autoComplete="current-password" name="password" required />)
    expect(field().getAttribute('autocomplete')).toBe('current-password')
    expect(field().name).toBe('password')
    expect(field().required).toBe(true)
    fireEvent.click(eye())
    expect(field().getAttribute('autocomplete')).toBe('current-password')
  })

  it('es un campo controlado normal: onChange recibe lo que se escribe', () => {
    const onChange = vi.fn()
    render(<PasswordInput placeholder="Contraseña" value="" onChange={onChange} />)
    fireEvent.change(field(), { target: { value: 'hola1' } })
    expect(onChange).toHaveBeenCalledTimes(1)
  })

  it('el botón es táctil (44 px) y se coloca dentro del campo a la derecha', () => {
    render(<PasswordInput placeholder="Contraseña" />)
    expect(eye().className).toMatch(/min-h-\[44px\]/)
    expect(eye().className).toMatch(/w-11/)
    expect(eye().className).toMatch(/right-0/)
    expect(field().className).toMatch(/pr-12/) // hueco para que el texto no quede debajo del botón
  })
})
