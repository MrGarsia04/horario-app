import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabaseClient'
import { DEFAULT_CONFIG } from '../lib/timeSlots'

// Todas las claves de un grupo cuelgan de ['group', codigo, ...] para poder invalidarlas juntas.

export function useGroupConfig(groupCode) {
  return useQuery({
    queryKey: ['group', groupCode, 'config'],
    enabled: Boolean(groupCode),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('group_settings')
        .select('config')
        .eq('group_code', groupCode)
        .maybeSingle()
      if (error) throw error
      return data?.config ?? DEFAULT_CONFIG
    },
  })
}

export function useSaveGroupConfig(groupCode) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (config) => {
      const { error } = await supabase
        .from('group_settings')
        .upsert({ group_code: groupCode, config }, { onConflict: 'group_code' })
      if (error) throw error
      return config
    },
    onMutate: async (config) => {
      qc.setQueryData(['group', groupCode, 'config'], config)
    },
    onError: (err) => {
      console.error(err)
      qc.invalidateQueries({ queryKey: ['group', groupCode, 'config'] })
    },
  })
}

// Miembros del grupo + horario habitual + overrides de cada uno, en una sola carga.
// El horario del propio usuario se deduce de aquí (antes se pedía aparte y duplicado).
export function useGroupMembers(groupCode) {
  return useQuery({
    queryKey: ['group', groupCode, 'members'],
    enabled: Boolean(groupCode),
    queryFn: async () => {
      const { data: memberships, error } = await supabase
        .from('group_memberships')
        .select('user_id')
        .eq('group_code', groupCode)
      if (error) throw error

      const userIds = memberships.map((m) => m.user_id)
      if (userIds.length === 0) return { members: [], overridesByUser: {} }

      const [{ data: profileRows }, { data: scheduleRows }, { data: overrideRows }] =
        await Promise.all([
          supabase.from('profiles').select('id, username').in('id', userIds),
          supabase.from('schedules').select('user_id, busy_slots').eq('group_code', groupCode),
          supabase
            .from('schedule_overrides')
            .select('user_id, week_start, busy_slots')
            .eq('group_code', groupCode)
            .in('user_id', userIds),
        ])

      const usernames = Object.fromEntries((profileRows ?? []).map((p) => [p.id, p.username]))
      const baseByUser = Object.fromEntries(
        (scheduleRows ?? []).map((s) => [s.user_id, s.busy_slots ?? []])
      )
      const overridesByUser = {}
      for (const row of overrideRows ?? []) {
        if (!overridesByUser[row.user_id]) overridesByUser[row.user_id] = []
        overridesByUser[row.user_id].push({ week_start: row.week_start, busy_slots: row.busy_slots })
      }

      return {
        overridesByUser,
        members: userIds.map((id) => ({
          userId: id,
          name: usernames[id] ?? '(desconocido)',
          baseSchedule: baseByUser[id] ?? [],
        })),
      }
    },
  })
}

export function useSaveOverride(groupCode, userId) {
  const qc = useQueryClient()
  const key = ['group', groupCode, 'members']
  return useMutation({
    mutationFn: async ({ weekStart, busySlots }) => {
      const { error } = await supabase.from('schedule_overrides').upsert(
        { group_code: groupCode, user_id: userId, week_start: weekStart, busy_slots: busySlots },
        { onConflict: 'group_code,user_id,week_start' }
      )
      if (error) throw error
    },
    onSuccess: (_d, { weekStart, busySlots }) => {
      qc.setQueryData(key, (prev) => {
        if (!prev) return prev
        const mine = (prev.overridesByUser[userId] ?? []).filter((o) => o.week_start !== weekStart)
        return {
          ...prev,
          overridesByUser: {
            ...prev.overridesByUser,
            [userId]: [...mine, { week_start: weekStart, busy_slots: busySlots }],
          },
        }
      })
    },
    onError: (err) => console.error(err),
  })
}
