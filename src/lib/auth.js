import { supabase } from './supabaseClient'

// Autenticación con Supabase Auth (email + contraseña). La sesión la gestiona supabase-js
// (persistente y con refresco automático); aquí solo hay envoltorios que devuelven
// { data } o { error } con mensajes en español.

export const MIN_PASSWORD = 6

function translateAuthError(error) {
  const msg = (error?.message ?? '').toLowerCase()
  if (msg.includes('username_taken')) return 'Ese nombre de usuario ya está en uso, prueba con otro.'
  if (msg.includes('invalid login credentials')) return 'Email o contraseña incorrectos.'
  if (msg.includes('email not confirmed')) return 'Confirma tu email antes de entrar (revisa tu bandeja).'
  if (msg.includes('already registered') || msg.includes('already been registered'))
    return 'Ya existe una cuenta con ese email.'
  if (msg.includes('password should be at least')) return `La contraseña debe tener al menos ${MIN_PASSWORD} caracteres.`
  if (msg.includes('rate limit') || error?.status === 429) return 'Demasiados intentos. Espera un poco y vuelve a probar.'
  if (msg.includes('same password')) return 'La contraseña nueva debe ser distinta de la actual.'
  if (msg.includes('database error saving new user')) return 'No se pudo crear la cuenta (¿nombre de usuario ya en uso?).'
  return error?.message || 'Ha ocurrido un error. Inténtalo de nuevo.'
}

// Cada cuenta de Supabase Auth necesita un email: usamos uno INTERNO inventado que el
// usuario nunca ve (se entra con nombre de usuario). Se resuelve por RPC login_alias.
// Requiere "Confirm email" desactivado en Supabase: no se envía ningún correo.
export const INTERNAL_EMAIL_DOMAIN = 'usuarios.horario-app.com'
export const newInternalEmail = () => `${crypto.randomUUID()}@${INTERNAL_EMAIL_DOMAIN}`
const BAD_CREDENTIALS = 'Usuario o contraseña incorrectos.'

export async function signUp(username, password) {
  const name = username.trim()
  if (!name || !password) return { error: 'Rellena usuario y contraseña.' }
  if (name.length < 2 || name.length > 30) return { error: 'El nombre de usuario debe tener entre 2 y 30 caracteres.' }
  if (password.length < MIN_PASSWORD) return { error: `La contraseña debe tener al menos ${MIN_PASSWORD} caracteres.` }

  const { data: available, error: availErr } = await supabase.rpc('username_available', { p_username: name })
  if (!availErr && available === false) return { error: 'Ese nombre de usuario ya está en uso, prueba con otro.' }

  const { data, error } = await supabase.auth.signUp({
    email: newInternalEmail(),
    password,
    options: { data: { username: name } },
  })
  if (error) return { error: translateAuthError(error) }
  if (!data.session) return { error: 'La cuenta se creó pero requiere confirmación por email; desactiva «Confirm email» en Supabase.' }
  return { data: true }
}

// Inicio de sesión con usuario + contraseña. Si es una cuenta ANTIGUA aún sin migrar y la
// contraseña es la de siempre, se migra aquí mismo, sin pasos extra para la persona.
// Si esa contraseña antigua es más corta que el mínimo de Supabase, devuelve
// { needNewPassword: true } y hay que volver a llamar con newPassword.
export async function signIn(username, password, newPassword) {
  const name = username.trim()
  if (!name || !password) return { error: 'Rellena usuario y contraseña.' }

  const { data: alias } = await supabase.rpc('login_alias', { p_username: name })
  if (alias) {
    const { error } = await supabase.auth.signInWithPassword({ email: alias, password })
    if (error) {
      const msg = (error.message ?? '').toLowerCase()
      return { error: msg.includes('invalid login') ? BAD_CREDENTIALS : translateAuthError(error) }
    }
    return { data: true }
  }

  const hash = await legacyHash(password)
  const { data: valid } = await supabase.rpc('legacy_claim_valid', { p_username: name, p_hash: hash })
  if (!valid) return { error: BAD_CREDENTIALS }

  const nextPassword = newPassword || password
  if (nextPassword.length < MIN_PASSWORD) return { needNewPassword: true }
  if (newPassword && newPassword === password) return { needNewPassword: true }

  // La reclamación ocurre dentro del trigger del signUp (atómica: si falla, no se crea nada).
  const { data, error } = await supabase.auth.signUp({
    email: newInternalEmail(),
    password: nextPassword,
    options: { data: { legacy_username: name, legacy_hash: hash } },
  })
  if (error) return { error: translateAuthError(error) }
  if (!data.session) return { error: 'No se pudo iniciar sesión: desactiva «Confirm email» en Supabase.' }
  return { data: true }
}

// SOLO para migrar cuentas antiguas: sus contraseñas eran SHA-256 y la base las compara con
// este hash. Se puede borrar cuando todos hayan entrado una vez.
async function legacyHash(password) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(password))
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('')
}

// Email de contacto (opcional). Va a profile_private, visible solo para su dueño.
// No se usa auth.updateUser({ email }) porque enviaría correos de confirmación.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

export async function getContactEmail(profileId) {
  const { data } = await supabase.from('profile_private').select('contact_email').eq('profile_id', profileId).maybeSingle()
  return data?.contact_email ?? null
}

export async function saveContactEmail(profileId, email) {
  const mail = email.trim()
  if (mail && !EMAIL_RE.test(mail)) return { error: 'Ese email no parece válido.' }
  const { error } = await supabase
    .from('profile_private')
    .upsert({ profile_id: profileId, contact_email: mail || null, updated_at: new Date().toISOString() })
  if (error) return { error: error.message }
  return { data: mail || null }
}

export async function signOut() {
  await supabase.auth.signOut()
}

// Para el flujo de recuperación (ya hay sesión temporal tras abrir el enlace del email).
export async function setNewPassword(newPassword) {
  if (newPassword.length < MIN_PASSWORD) return { error: `La contraseña nueva debe tener al menos ${MIN_PASSWORD} caracteres.` }
  const { error } = await supabase.auth.updateUser({ password: newPassword })
  if (error) return { error: translateAuthError(error) }
  return { data: true }
}

export async function changePassword(currentPassword, newPassword) {
  if (newPassword.length < MIN_PASSWORD) return { error: `La contraseña nueva debe tener al menos ${MIN_PASSWORD} caracteres.` }
  const { data: { user } } = await supabase.auth.getUser()
  if (!user?.email) return { error: 'No se pudo verificar tu cuenta.' }

  const { error: checkErr } = await supabase.auth.signInWithPassword({ email: user.email, password: currentPassword })
  if (checkErr) return { error: 'La contraseña actual no es correcta.' }

  return setNewPassword(newPassword)
}

export async function updateUsername(userId, newUsername) {
  const trimmed = newUsername.trim()
  if (trimmed.length < 2 || trimmed.length > 30) return { error: 'El nombre debe tener entre 2 y 30 caracteres.' }

  const { error } = await supabase.from('profiles').update({ username: trimmed }).eq('id', userId)
  if (error) {
    return { error: error.code === '23505' ? 'Ese nombre de usuario ya está en uso.' : error.message }
  }
  return { data: { username: trimmed } }
}
