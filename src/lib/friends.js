import { supabase } from './supabaseClient'

function orderPair(a, b) {
  return a < b ? [a, b] : [b, a]
}

export async function sendFriendRequest(myId, targetUsername) {
  const trimmed = targetUsername.trim()
  if (!trimmed) return { error: 'Escribe un nombre de usuario.' }

  const { data: target, error: findErr } = await supabase
    .from('profiles')
    .select('id, username')
    .eq('username', trimmed)
    .maybeSingle()

  if (findErr || !target) return { error: 'No existe ningún usuario con ese nombre.' }
  if (target.id === myId) return { error: 'No puedes enviarte una solicitud a ti mismo.' }

  const [user_a, user_b] = orderPair(myId, target.id)

  const { data: existing } = await supabase
    .from('friendships')
    .select('status')
    .eq('user_a', user_a)
    .eq('user_b', user_b)
    .maybeSingle()

  if (existing) {
    return { error: existing.status === 'accepted' ? 'Ya sois amigos.' : 'Ya hay una solicitud pendiente con ese usuario.' }
  }

  const { error } = await supabase
    .from('friendships')
    .insert({ user_a, user_b, status: 'pending', requested_by: myId })

  if (error) return { error: error.message }
  return { data: true }
}

export async function respondToRequest(myId, otherId, accept) {
  const [user_a, user_b] = orderPair(myId, otherId)

  if (accept) {
    const { error } = await supabase
      .from('friendships')
      .update({ status: 'accepted' })
      .eq('user_a', user_a)
      .eq('user_b', user_b)
    return { error: error?.message }
  }

  const { error } = await supabase.from('friendships').delete().eq('user_a', user_a).eq('user_b', user_b)
  return { error: error?.message }
}

export async function removeFriendOrCancel(myId, otherId) {
  const [user_a, user_b] = orderPair(myId, otherId)
  const { error } = await supabase.from('friendships').delete().eq('user_a', user_a).eq('user_b', user_b)
  return { error: error?.message }
}

export async function loadFriendData(myId) {
  const { data, error } = await supabase
    .from('friendships')
    .select('user_a, user_b, status, requested_by')
    .or(`user_a.eq.${myId},user_b.eq.${myId}`)

  if (error) return { error: error.message }

  const otherIds = data.map((r) => (r.user_a === myId ? r.user_b : r.user_a))
  let usernames = {}
  if (otherIds.length > 0) {
    const { data: profileRows } = await supabase.from('profiles').select('id, username').in('id', otherIds)
    usernames = Object.fromEntries((profileRows ?? []).map((p) => [p.id, p.username]))
  }

  const friends = []
  const incoming = []
  const outgoing = []

  for (const row of data) {
    const otherId = row.user_a === myId ? row.user_b : row.user_a
    const entry = { userId: otherId, name: usernames[otherId] ?? '(desconocido)' }
    if (row.status === 'accepted') friends.push(entry)
    else if (row.requested_by === myId) outgoing.push(entry)
    else incoming.push(entry)
  }

  return { data: { friends, incoming, outgoing } }
}