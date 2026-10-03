/** @type {import('tailwindcss').Config} */

// Los colores NO están escritos aquí: apuntan a variables CSS (ver src/index.css
// para el tema "panel" y src/theme-rosa.css para el "rosa"). Así, cambiar de tema
// es cambiar el atributo data-theme de <html>, sin tocar ningún componente.
// El formato "R G B" + <alpha-value> mantiene funcionando clases como text-board-cream/50.
const token = (name) => `rgb(var(--board-${name}) / <alpha-value>)`

export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        board: {
          bg: token('bg'), // fondo de la página
          panel: token('panel'), // tarjetas y casillas libres
          line: token('line'), // bordes y separadores
          cream: token('cream'), // color del texto
          amber: token('amber'), // acento principal (botones, enlaces, foco)
          teal: token('teal'), // acento secundario (ocupado, "éxito")
          onaccent: token('onaccent'), // texto sobre un fondo de acento
          danger: token('danger'), // errores
        },
      },
      fontFamily: {
        mono: 'var(--font-mono)',
        sans: 'var(--font-sans)',
        display: 'var(--font-display)',
      },
      borderRadius: {
        DEFAULT: 'var(--radius-sm)',
        md: 'var(--radius-md)',
      },
    },
  },
  plugins: [],
}
