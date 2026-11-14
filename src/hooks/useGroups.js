import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabaseClient'

export function useMyGroups(userId) {
  return useQuery({
    queryKey: ['groups', userId],
    enabled: Boolean(userId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('group_memberships')
        .select('group_code')
        .eq('user_id', userId)
        .order('joined_at', { ascending: true })
      if (error) throw error
      return (data ?? []).map((r) => r.group_code)
    },
  })
}

export function useJoinGroup(userId) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (code) => {
      const { error } = await supabase
        .from('group_memberships')
        .insert({ user_id: userId, group_code: code })
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['groups', userId] }),
  })
}

export function useLeaveGroup(userId) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (code) => {
      const { error } = await supabase
        .from('group_memberships')
        .delete()
        .eq('user_id', userId)
        .eq('group_code', code)
      if (error) throw error
    },
    onSuccess: (_d, code) => {
      qc.invalidateQueries({ queryKey: ['groups', userId] })
      qc.removeQueries({ queryKey: ['group', code] })
    },
  })
}
