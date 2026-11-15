import { makeHandler, clientIp } from '../_lib/handler.js'
import { solicitar } from '../_lib/recuperar.js'

// POST /api/recuperar/solicitar  { usuario }
export default makeHandler((body, req, deps) => solicitar({ usuario: body.usuario, ip: clientIp(req) }, deps))
