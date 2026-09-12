import { supabase } from './supabaseClient'

// Hash simple (SHA-256) para no guardar contraseñas en texto plano.
// Esto es un filtro razonable para un grupo de confianza, no una capa de
// seguridad de nivel bancario.
async function hashPassword(password) {
  const bytes = new TextEncoder().encode(password)
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

export async function signUp(username, password) {
  const trimmed = username.trim()
  if (!trimmed || !password) {
    return { error: 'Rellena usuario y contraseña.' }
  }
  if (password.length < 4) {
    return { error: 'La contraseña debe tener al menos 4 caracteres.' }
  }

  const { data: existing } = await supabase
    .from('profiles')
    .select('id')
    .eq('username', trimmed)
    .maybeSingle()

  if (existing) {
    return { error: 'Ese nombre de usuario ya está en uso, prueba con otro.' }
  }

  const password_hash = await hashPassword(password)
  const { data, error } = await supabase
    .from('profiles')
    .insert({ username: trimmed, password_hash })
    .select('id, username')
    .single()

  if (error) return { error: error.message }
  return { data }
}

export async function signIn(username, password) {
  const trimmed = username.trim()
  const { data, error } = await supabase
    .from('profiles')
    .select('id, username, password_hash')
    .eq('username', trimmed)
    .maybeSingle()

  if (error || !data) {
    return { error: 'Usuario o contraseña incorrectos.' }
  }

  const hash = await hashPassword(password)
  if (hash !== data.password_hash) {
    return { error: 'Usuario o contraseña incorrectos.' }
  }

  return { data: { id: data.id, username: data.username } }
}

export async function updateUsername(userId, newUsername) {
  const trimmed = newUsername.trim()
  if (!trimmed) return { error: 'El nombre de usuario no puede estar vacío.' }

  const { data: existing } = await supabase
    .from('profiles')
    .select('id')
    .eq('username', trimmed)
    .maybeSingle()

  if (existing && existing.id !== userId) {
    return { error: 'Ese nombre de usuario ya está en uso.' }
  }

  const { error } = await supabase.from('profiles').update({ username: trimmed }).eq('id', userId)
  if (error) return { error: error.message }
  return { data: { username: trimmed } }
}