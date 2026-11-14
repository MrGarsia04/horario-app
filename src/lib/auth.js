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

export async function signUp(username, email, password) {
  const name = username.trim()
  const mail = email.trim()
  if (!name || !mail || !password) return { error: 'Rellena nombre de usuario, email y contraseña.' }
  if (name.length < 2 || name.length > 30) return { error: 'El nombre de usuario debe tener entre 2 y 30 caracteres.' }
  if (password.length < MIN_PASSWORD) return { error: `La contraseña debe tener al menos ${MIN_PASSWORD} caracteres.` }

  const { data: available, error: availErr } = await supabase.rpc('username_available', { p_username: name })
  if (!availErr && available === false) return { error: 'Ese nombre de usuario ya está en uso, prueba con otro.' }

  const { data, error } = await supabase.auth.signUp({
    email: mail,
    password,
    options: { data: { username: name }, emailRedirectTo: window.location.origin },
  })
  if (error) return { error: translateAuthError(error) }
  // Con "Confirm email" activado en Supabase no hay sesión hasta confirmar.
  return { data: { needsConfirmation: !data.session } }
}

export async function signIn(email, password) {
  if (!email.trim() || !password) return { error: 'Rellena email y contraseña.' }
  const { data, error } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
  if (error) return { error: translateAuthError(error) }
  return { data: data.user }
}

export async function signOut() {
  await supabase.auth.signOut()
}

export async function requestPasswordReset(email) {
  if (!email.trim()) return { error: 'Escribe tu email.' }
  const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
    redirectTo: `${window.location.origin}/restablecer`,
  })
  if (error) return { error: translateAuthError(error) }
  return { data: true }
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
