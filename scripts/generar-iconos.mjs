// Genera los iconos de la app a partir de scripts/icono.svg (reproducible: `npm run iconos`).
// Usa @resvg/resvg-js (sin navegador). Salida: public/icon-192.png, icon-512.png, icon-maskable-512.png,
// apple-touch-icon.png, favicon-32.png y favicon.svg.
import { readFileSync, writeFileSync } from 'node:fs'
import { Resvg } from '@resvg/resvg-js'

const svg = readFileSync(new URL('./icono.svg', import.meta.url), 'utf8')
const out = (name) => new URL(`../public/${name}`, import.meta.url)
const png = (source, size) => new Resvg(source, { fitTo: { mode: 'width', value: size } }).render().asPng()

// Icono normal: el SVG tal cual (esquinas redondeadas).
for (const [name, size] of [['icon-192.png', 192], ['icon-512.png', 512], ['apple-touch-icon.png', 180], ['favicon-32.png', 32]]) {
  writeFileSync(out(name), png(svg, size))
}

// Maskable: fondo a sangre (sin esquinas) y contenido al 78 % para que el recorte del sistema no corte nada.
const maskable = svg
  .replace('<rect width="512" height="512" rx="112" fill="#1B2430"/>', '<rect width="512" height="512" fill="#1B2430"/>')
  .replace('<g id="contenido">', '<g id="contenido" transform="translate(56.3 56.3) scale(0.78)">')
writeFileSync(out('icon-maskable-512.png'), png(maskable, 512))

writeFileSync(out('favicon.svg'), svg)
console.log('Iconos generados en public/')
