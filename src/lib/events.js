import { supabase } from './supabaseClient'

export async function createEvent(creatorId, { title, description, eventDate, startTime, endTime }, inviteeIds) {
  if (!title.trim()) return { error: 'Ponle un nombre al plan.' }
  if (!eventDate) return { error: 'Elige una fecha.' }
  if (startTime && endTime && startTime >= endTime) {
    return { error: 'La hora de inicio debe ser anterior a la hora de fin.' }
  }

  const { data: event, error } = await supabase
    .from('events')
    .insert({
      creator_id: creatorId,
      title: title.trim(),
      description: description?.trim() || null,
      event_date: eventDate,
      start_time: startTime || null,
      end_time: endTime || null,
    })
    .select()
    .single()

  if (error) return { error: error.message }

  if (inviteeIds.length > 0) {
    const rows = inviteeIds.map((id) => ({ event_id: event.id, invitee_id: id, status: 'pending' }))
    const { error: inviteError } = await supabase.from('event_invitations').insert(rows)
    if (inviteError) return { error: inviteError.message }
  }

  return { data: event }
}

export async function respondToEvent(eventId, userId, status) {
  const { error } = await supabase
    .from('event_invitations')
    .update({ status })
    .eq('event_id', eventId)
    .eq('invitee_id', userId)
  return { error: error?.message }
}

export async function deleteEvent(eventId) {
  const { error } = await supabase.from('events').delete().eq('id', eventId)
  return { error: error?.message }
}

export async function loadMyEvents(userId) {
  const { data: createdEvents, error: createdErr } = await supabase
    .from('events')
    .select('*')
    .eq('creator_id', userId)

  if (createdErr) return { error: createdErr.message }

  const { data: myInvites, error: inviteErr } = await supabase
    .from('event_invitations')
    .select('event_id, status')
    .eq('invitee_id', userId)

  if (inviteErr) return { error: inviteErr.message }

  const invitedEventIds = (myInvites ?? []).map((i) => i.event_id)
  let invitedEvents = []
  if (invitedEventIds.length > 0) {
    const { data, error } = await supabase.from('events').select('*').in('id', invitedEventIds)
    if (error) return { error: error.message }
    invitedEvents = data ?? []
  }

  const myStatusByEvent = Object.fromEntries((myInvites ?? []).map((i) => [i.event_id, i.status]))

  const eventsMap = new Map()
  for (const e of createdEvents ?? []) {
    eventsMap.set(e.id, { ...e, myRole: 'creator', myStatus: 'accepted' })
  }
  for (const e of invitedEvents) {
    if (!eventsMap.has(e.id)) {
      eventsMap.set(e.id, { ...e, myRole: 'invitee', myStatus: myStatusByEvent[e.id] })
    }
  }

  const events = Array.from(eventsMap.values())
  if (events.length === 0) return { data: [] }

  const eventIds = events.map((e) => e.id)
  const creatorIds = [...new Set(events.map((e) => e.creator_id))]

  const [{ data: creatorProfiles }, { data: allInvitations }] = await Promise.all([
    supabase.from('profiles').select('id, username').in('id', creatorIds),
    supabase.from('event_invitations').select('event_id, invitee_id, status').in('event_id', eventIds),
  ])

  const creatorNames = Object.fromEntries((creatorProfiles ?? []).map((p) => [p.id, p.username]))

  const inviteeIds = [...new Set((allInvitations ?? []).map((i) => i.invitee_id))]
  let inviteeNames = {}
  if (inviteeIds.length > 0) {
    const { data: inviteeProfiles } = await supabase
      .from('profiles')
      .select('id, username')
      .in('id', inviteeIds)
    inviteeNames = Object.fromEntries((inviteeProfiles ?? []).map((p) => [p.id, p.username]))
  }

  const invitationsByEvent = {}
  for (const inv of allInvitations ?? []) {
    if (!invitationsByEvent[inv.event_id]) invitationsByEvent[inv.event_id] = []
    invitationsByEvent[inv.event_id].push({
      userId: inv.invitee_id,
      name: inviteeNames[inv.invitee_id] ?? '(desconocido)',
      status: inv.status,
    })
  }

  const enriched = events
    .map((e) => ({
      ...e,
      creatorName: creatorNames[e.creator_id] ?? '(desconocido)',
      invitees: invitationsByEvent[e.id] ?? [],
    }))
    .sort((a, b) => (a.event_date < b.event_date ? -1 : a.event_date > b.event_date ? 1 : 0))

  return { data: enriched }
}

export async function updateEvent(eventId, { title, description, eventDate, startTime, endTime }, inviteeIds) {
  if (!title.trim()) return { error: 'Ponle un nombre al plan.' }
  if (!eventDate) return { error: 'Elige una fecha.' }
  if (startTime && endTime && startTime >= endTime) {
    return { error: 'La hora de inicio debe ser anterior a la hora de fin.' }
  }

  const { error } = await supabase
    .from('events')
    .update({
      title: title.trim(),
      description: description?.trim() || null,
      event_date: eventDate,
      start_time: startTime || null,
      end_time: endTime || null,
    })
    .eq('id', eventId)

  if (error) return { error: error.message }

  const { data: existing } = await supabase
    .from('event_invitations')
    .select('invitee_id')
    .eq('event_id', eventId)

  const existingIds = (existing ?? []).map((r) => r.invitee_id)
  const toAdd = inviteeIds.filter((id) => !existingIds.includes(id))
  const toRemove = existingIds.filter((id) => !inviteeIds.includes(id))

  if (toAdd.length > 0) {
    await supabase
      .from('event_invitations')
      .insert(toAdd.map((id) => ({ event_id: eventId, invitee_id: id, status: 'pending' })))
  }
  if (toRemove.length > 0) {
    await supabase.from('event_invitations').delete().eq('event_id', eventId).in('invitee_id', toRemove)
  }

  return { data: true }
}