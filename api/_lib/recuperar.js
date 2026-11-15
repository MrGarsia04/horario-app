// Lógica de recuperación de contraseña por código al correo de contacto.
// Todo depende de `deps` (store, mail, now, rnd, secret) para poder probarlo sin red.
import { createHmac, createHash, timingSafeEqual } from 'node:crypto'

export const CODE_TTL_MS = 15 * 60 * 1000
export const MAX_ATTEMPTS = 5
export const MAX_PER_PROFILE_HOUR = 3
export const MAX_PER_IP_HOUR = 10
export const MIN_PASSWORD = 6
const HOUR = 60 * 60 * 1000

// Misma respuesta exista o no la cuenta, tenga o no correo (no se revela nada).
export const GENERIC_REQUEST_MESSAGE =
  'Si ese usuario tiene un correo guardado, te hemos enviado un código. Si no recibes nada, pídele ayuda a quien administra la app.'
export const BAD_CODE_MESSAGE = 'El código no es correcto o ha caducado. Pide uno nuevo.'

export function hashCode(secret, profileId, code) {
  return createHmac('sha256', secret).update(`${profileId}:${code}`).digest('hex')
}

export function hashIp(ip) {
  return createHash('sha256').update(String(ip || 'desconocida')).digest('hex').slice(0, 32)
}

function safeEqualHex(a, b) {
  const ba = Buffer.from(a, 'hex')
  const bb = Buffer.from(b, 'hex')
  return ba.length === bb.length && timingSafeEqual(ba, bb)
}

function cleanUsername(u) {
  return typeof u === 'string' ? u.trim().slice(0, 60) : ''
}

export async function solicitar({ usuario, ip }, deps) {
  const { store, mail, now, rnd, secret } = deps
  const name = cleanUsername(usuario)
  const ok = { status: 200, body: { ok: true, message: GENERIC_REQUEST_MESSAGE } }
  if (!name) return { status: 400, body: { ok: false, message: 'Escribe tu nombre de usuario.' } }

  const t = now()
  const since = new Date(t.getTime() - HOUR)
  const ipHash = hashIp(ip)

  // El límite por IP cuenta también peticiones de usuarios inexistentes.
  if ((await store.countRequests({ ipHash, since })) >= MAX_PER_IP_HOUR) return ok

  const profile = await store.findProfileByUsername(name)
  await store.logRequest({ profileId: profile?.id ?? null, ipHash, at: t })
  if (!profile) return ok

  if ((await store.countRequests({ profileId: profile.id, since })) > MAX_PER_PROFILE_HOUR) return ok

  const email = await store.getContactEmail(profile.id)
  if (!email) return ok

  const code = String(rnd(0, 1_000_000)).padStart(6, '0')
  // Guardar (sustituye cualquier código anterior) ANTES de enviar.
  await store.saveCode(profile.id, hashCode(secret, profile.id, code), new Date(t.getTime() + CODE_TTL_MS))
  try {
    await mail({ to: email, code, username: profile.username })
  } catch (err) {
    console.error('Recuperación: fallo al enviar el correo', err?.message)
  }
  return ok
}

export async function confirmar({ usuario, codigo, nueva }, deps) {
  const { store, now, secret } = deps
  const name = cleanUsername(usuario)
  const code = typeof codigo === 'string' ? codigo.trim() : ''
  const fail = { status: 400, body: { ok: false, message: BAD_CODE_MESSAGE } }

  if (typeof nueva !== 'string' || nueva.length < MIN_PASSWORD) {
    return { status: 400, body: { ok: false, message: `La contraseña nueva debe tener al menos ${MIN_PASSWORD} caracteres.` } }
  }
  if (nueva.length > 200) return { status: 400, body: { ok: false, message: 'Contraseña demasiado larga.' } }
  if (!name || !/^\d{6}$/.test(code)) return fail

  const profile = await store.findProfileByUsername(name)
  if (!profile) return fail
  const row = await store.getCode(profile.id)
  if (!row) return fail

  if (new Date(row.expires_at) <= now()) {
    await store.deleteCode(profile.id)
    return fail
  }
  // Cada intento se cuenta ANTES de comparar.
  const attempts = await store.bumpAttempts(profile.id)
  if (attempts > MAX_ATTEMPTS) {
    await store.deleteCode(profile.id)
    return fail
  }
  if (!safeEqualHex(row.code_hash, hashCode(secret, profile.id, code))) {
    if (attempts >= MAX_ATTEMPTS) await store.deleteCode(profile.id)
    return fail
  }

  // Un solo uso: se borra antes de cambiar la contraseña.
  await store.deleteCode(profile.id)
  if (profile.auth_id) {
    await store.setAuthPassword(profile.auth_id, nueva)
    await store.revokeSessions(profile.auth_id)
  } else {
    // Cuenta antigua que aún no ha entrado: la nueva contraseña la migrará en el próximo login.
    await store.setLegacyPassword(profile.id, createHash('sha256').update(nueva, 'utf8').digest('hex'))
  }
  return { status: 200, body: { ok: true, message: 'Contraseña cambiada. Ya puedes iniciar sesión.' } }
}
