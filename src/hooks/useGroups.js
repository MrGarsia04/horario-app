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

// Todas las operaciones de grupo pasan por funciones SQL (RPC): la base de datos
// valida permisos y códigos de invitación (ver supabase/migrations/0002_auth_rls.sql).
function rpcError(error) {
  const msg = error.message ?? ''
  if (msg.includes('group_exists')) return new Error('Ya existe un grupo con ese nombre. Elige otro.')
  if (msg.includes('invalid_invite')) return new Error('Código de invitación no válido.')
  if (msg.includes('invalid_code')) return new Error('El nombre del grupo debe tener entre 2 y 40 caracteres.')
  return error
}

export function useCreateGroup(userId) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (code) => {
      const { data, error } = await supabase.rpc('create_group', { p_code: code })
      if (error) throw rpcError(error)
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['groups', userId] }),
  })
}

export function useJoinGroup(userId) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (invite) => {
      const { data, error } = await supabase.rpc('join_group', { p_invite: invite })
      if (error) throw rpcError(error)
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['groups', userId] }),
  })
}

export function useLeaveGroup(userId) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (code) => {
      const { error } = await supabase.rpc('leave_group', { p_code: code })
      if (error) throw error
    },
    onSuccess: (_d, code) => {
      qc.invalidateQueries({ queryKey: ['groups', userId] })
      qc.removeQueries({ queryKey: ['group', code] })
    },
  })
}

export function useInviteCode(groupCode, enabled) {
  return useQuery({
    queryKey: ['group', groupCode, 'invite'],
    enabled: Boolean(groupCode) && enabled,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_invite_code', { p_code: groupCode })
      if (error) throw error
      return data
    },
  })
}

export function useRotateInvite(groupCode) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc('rotate_invite_code', { p_code: groupCode })
      if (error) throw error
      return data
    },
    onSuccess: (data) => qc.setQueryData(['group', groupCode, 'invite'], data),
  })
}
