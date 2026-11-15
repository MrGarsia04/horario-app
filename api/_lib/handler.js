// Pegamento entre Vercel (req/res) y la lógica de recuperar.js.
import { randomInt } from 'node:crypto'
import nodemailer from 'nodemailer'
import { createStore } from './supabaseStore.js'

function env(name) {
  return process.env[name]
}

export function buildDeps() {
  const url = env('SUPABASE_URL') || env('VITE_SUPABASE_URL')
  const key = env('SUPABASE_SERVICE_ROLE_KEY')
  if (!url || !key) throw new Error('Faltan SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en el servidor')
  return {
    store: createStore(url, key),
    mail: buildMailer(),
    now: () => new Date(),
    rnd: randomInt,
    secret: env('RECOVERY_SECRET') || key, // clave del HMAC de los códigos; solo servidor
  }
}

function buildMailer() {
  const user = env('GMAIL_USER')
  const pass = env('GMAIL_APP_PASSWORD')
  const text = ({ code, username }) =>
    `Hola ${username},\n\nTu código para restablecer la contraseña es: ${code}\n\nCaduca en 15 minutos. Si no lo has pedido tú, ignora este mensaje.`

  if (!user || !pass) {
    if (env('NODE_ENV') !== 'production') {
      // Modo prueba local: el correo se escribe en la consola del servidor.
      return async (msg) => console.log(`\n[recuperación · modo prueba] para ${msg.to}:\n${text(msg)}\n`)
    }
    return async () => {
      throw new Error('Faltan GMAIL_USER o GMAIL_APP_PASSWORD en producción')
    }
  }
  const transport = nodemailer.createTransport({ service: 'gmail', auth: { user, pass } })
  return (msg) =>
    transport.sendMail({
      from: `"Panel de horarios" <${user}>`,
      to: msg.to,
      subject: 'Código para restablecer tu contraseña',
      text: text(msg),
    })
}

export function clientIp(req) {
  const fwd = req.headers['x-forwarded-for']
  return (Array.isArray(fwd) ? fwd[0] : fwd || '').split(',')[0].trim() || req.socket?.remoteAddress || ''
}

export function makeHandler(fn) {
  return async function handler(req, res) {
    res.setHeader('Cache-Control', 'no-store')
    if (req.method !== 'POST') {
      res.setHeader('Allow', 'POST')
      return res.status(405).json({ ok: false, message: 'Método no permitido.' })
    }
    const body = typeof req.body === 'string' ? safeJson(req.body) : req.body
    if (!body || typeof body !== 'object') return res.status(400).json({ ok: false, message: 'Petición no válida.' })
    try {
      const result = await fn(body, req, buildDeps())
      return res.status(result.status).json(result.body)
    } catch (err) {
      console.error('Recuperación: error interno', err?.message)
      return res.status(500).json({ ok: false, message: 'No se pudo completar la operación. Inténtalo más tarde.' })
    }
  }
}

function safeJson(s) {
  try {
    return JSON.parse(s)
  } catch {
    return null
  }
}
