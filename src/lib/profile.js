import { supabase } from './supabaseClient'

export async function updateProfileInfo(userId, { birthday, bio }) {
  const { error } = await supabase
    .from('profiles')
    .update({ birthday: birthday || null, bio: bio || null })
    .eq('id', userId)

  if (error) return { error: error.message }
  return { data: true }
}

export async function fetchPublicProfile(userId) {
  const { data, error } = await supabase
    .from('profiles')
    .select('username, birthday, bio')
    .eq('id', userId)
    .maybeSingle()

  if (error || !data) return { error: 'No se pudo cargar este perfil.' }
  return { data }
}