import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabaseClient'
import type { Block, Exception, MemberSchedule, Template, Visibility } from '../lib/schedule/types'

// ¿Existe ya el modelo de bloques en la base? Si la migración 0005 aún no está aplicada, la app
// sigue funcionando con el modelo antiguo (schedules + schedule_overrides).
export function useBlockModelAvailable() {
  return useQuery({
    queryKey: ['schedule', 'model-available'],
    staleTime: Infinity,
    retry: false,
    queryFn: async () => {
      const { error } = await supabase.from('schedule_templates').select('id').limit(1)
      if (!error) return true
      const msg = `${error.code ?? ''} ${error.message ?? ''}`
      if (/42P01|PGRST205|schema cache|does not exist/i.test(msg)) return false
      throw error
    },
  })
}

export interface MyScheduleData {
  templates: Template[]
  blocks: Block[]
  exceptions: Exception[]
}

export function useMySchedule(userId: string, enabled = true) {
  return useQuery<MyScheduleData>({
    queryKey: ['schedule', userId, 'mine'],
    enabled: Boolean(userId) && enabled,
    queryFn: async () => {
      const [t, b, e] = await Promise.all([
        supabase.from('schedule_templates').select('*').eq('user_id', userId).order('created_at'),
        supabase.from('schedule_blocks').select('*').eq('user_id', userId),
        supabase.from('schedule_exceptions').select('*').eq('user_id', userId).order('date'),
      ])
      for (const r of [t, b, e]) if (r.error) throw r.error
      return { templates: t.data as Template[], blocks: b.data as Block[], exceptions: e.data as Exception[] }
    },
  })
}

type BlockInput = Omit<Block, 'id' | 'user_id'>

/** Todas las operaciones de edición del horario propio (se refrescan mi horario y el del grupo). */
export function useScheduleActions(userId: string, groupCode: string | null) {
  const qc = useQueryClient()
  const refresh = () => {
    qc.invalidateQueries({ queryKey: ['schedule', userId] })
    if (groupCode) qc.invalidateQueries({ queryKey: ['group', groupCode, 'schedules'] })
  }
  const run = async (p: PromiseLike<{ error: { message: string } | null; data?: unknown }>) => {
    const { error, data } = await p
    if (error) throw new Error(error.message)
    refresh()
    return data
  }

  const createTemplate = useMutation({
    mutationFn: async (v: Partial<Template> & { name: string }) =>
      (await run(supabase.from('schedule_templates').insert({ user_id: userId, ...v }).select().single())) as Template,
  })
  const updateTemplate = useMutation({
    mutationFn: async ({ id, ...v }: Partial<Template> & { id: string }) =>
      run(supabase.from('schedule_templates').update(v).eq('id', id)),
  })
  const deleteTemplate = useMutation({
    mutationFn: async (id: string) => run(supabase.from('schedule_templates').delete().eq('id', id)),
  })

  const saveBlock = useMutation({
    mutationFn: async (v: Partial<Block> & BlockInput) => {
      const row = { ...v, user_id: userId }
      return v.id
        ? run(supabase.from('schedule_blocks').update(row).eq('id', v.id))
        : run(supabase.from('schedule_blocks').insert(row))
    },
  })
  const insertBlocks = useMutation({
    mutationFn: async (rows: BlockInput[]) =>
      run(supabase.from('schedule_blocks').insert(rows.map((r) => ({ ...r, user_id: userId })))),
  })
  const deleteBlock = useMutation({
    mutationFn: async (id: string) => run(supabase.from('schedule_blocks').delete().eq('id', id)),
  })

  const saveException = useMutation({
    mutationFn: async (v: Omit<Exception, 'id' | 'user_id'>) =>
      run(supabase.from('schedule_exceptions').insert({ ...v, user_id: userId })),
  })
  const deleteException = useMutation({
    mutationFn: async (id: string) => run(supabase.from('schedule_exceptions').delete().eq('id', id)),
  })

  const setVisibility = useMutation({
    mutationFn: async (visibility: Visibility) => {
      if (!groupCode) return
      const { error } = await supabase.rpc('set_schedule_visibility', { p_group: groupCode, p_visibility: visibility })
      if (error) throw new Error(error.message)
      qc.invalidateQueries({ queryKey: ['group', groupCode] })
    },
  })

  return { createTemplate, updateTemplate, deleteTemplate, saveBlock, insertBlocks, deleteBlock, saveException, deleteException, setVisibility }
}

interface GroupSchedulesPayload {
  visibility: Record<string, Visibility>
  templates: Template[]
  blocks: Block[]
  exceptions: Exception[]
}

interface LegacyMember {
  userId: string
  name: string
  baseSchedule: MemberSchedule['legacyBase']
}

/**
 * Horarios de todos los miembros del grupo (la base oculta título/lugar según la visibilidad de
 * cada persona). Quien aún no tiene plantillas se calcula con el modelo antiguo: así nada se rompe.
 */
export function useGroupSchedules(
  groupCode: string,
  members: LegacyMember[],
  overridesByUser: Record<string, MemberSchedule['legacyOverrides']>,
  enabled: boolean
) {
  return useQuery<MemberSchedule[]>({
    queryKey: ['group', groupCode, 'schedules', members.map((m) => m.userId).join(',')],
    enabled: Boolean(groupCode) && enabled && members.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('group_schedules', { p_group: groupCode })
      if (error) throw new Error(error.message)
      const p = data as GroupSchedulesPayload
      return members.map((m) => {
        const templates = p.templates.filter((t) => t.user_id === m.userId)
        return {
          userId: m.userId,
          name: m.name,
          mode: templates.length > 0 ? 'blocks' : 'legacy',
          visibility: p.visibility[m.userId] ?? 'busy',
          templates,
          blocks: p.blocks.filter((b) => b.user_id === m.userId),
          exceptions: p.exceptions.filter((e) => e.user_id === m.userId),
          legacyBase: m.baseSchedule ?? [],
          legacyOverrides: overridesByUser[m.userId] ?? [],
        } as MemberSchedule
      })
    },
  })
}

/** Mi visibilidad en un grupo ('busy' | 'full'). */
export function useMyVisibility(groupCode: string | null, userId: string) {
  return useQuery<Visibility>({
    queryKey: ['group', groupCode, 'my-visibility', userId],
    enabled: Boolean(groupCode),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('group_memberships')
        .select('schedule_visibility')
        .eq('group_code', groupCode)
        .eq('user_id', userId)
        .maybeSingle()
      if (error) return 'busy' // modelo antiguo (sin la columna)
      return (data?.schedule_visibility ?? 'busy') as Visibility
    },
  })
}

// Una sola petición «crear capa por defecto» a la vez, aunque haya varias pantallas o el modo estricto de React
// monte dos veces (antes eso llegó a crear decenas de capas). La base además lo garantiza con un bloqueo.
let ensuring: Promise<unknown> | null = null
export function ensureDefaultLayer(): Promise<unknown> {
  if (!ensuring) {
    ensuring = Promise.resolve(supabase.rpc('ensure_default_layer')).finally(() => {
      ensuring = null
    })
  }
  return ensuring
}
