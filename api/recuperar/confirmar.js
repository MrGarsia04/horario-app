import { makeHandler } from '../_lib/handler.js'
import { confirmar } from '../_lib/recuperar.js'

// POST /api/recuperar/confirmar  { usuario, codigo, nueva }
export default makeHandler((body, _req, deps) =>
  confirmar({ usuario: body.usuario, codigo: body.codigo, nueva: body.nueva }, deps)
)
