import { useQuery, useQueryClient } from '@tanstack/react-query'
import { loadFriendData } from '../lib/friends'
import { loadMyEvents } from '../lib/events'

// Las funciones de lib/ devuelven { data } o { error }; aquí se convierten a promesas
// normales para TanStack Query.
export function useFriendData(userId) {
  return useQuery({
    queryKey: ['friends', userId],
    enabled: Boolean(userId),
    queryFn: async () => {
      const result = await loadFriendData(userId)
      if (result.error) throw new Error(result.error)
      return result.data
    },
  })
}

export function useMyEvents(userId) {
  return useQuery({
    queryKey: ['events', userId],
    enabled: Boolean(userId),
    queryFn: async () => {
      const result = await loadMyEvents(userId)
      if (result.error) throw new Error(result.error)
      return result.data
    },
  })
}

// Devuelve una función que refresca amigos y planes (los planes dependen de las amistades).
export function useRefreshSocial(userId) {
  const qc = useQueryClient()
  return () =>
    Promise.all([
      qc.invalidateQueries({ queryKey: ['friends', userId] }),
      qc.invalidateQueries({ queryKey: ['events', userId] }),
    ])
}
