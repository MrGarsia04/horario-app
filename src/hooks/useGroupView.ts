import { useAuth } from '../context/AuthContext'
import { useGroupConfig, useGroupMembers } from '../hooks/useGroupData'
import { useMyBirthday } from '../hooks/useMyBirthday'
import { useBlockModelAvailable, useGroupSchedules } from '../hooks/useSchedules'
import { DEFAULT_CONFIG, ALL_DAYS } from '../lib/timeSlots'
import { resolveScheduleForWeek, getDateForDay } from '../lib/weeks'
import type { DayKey } from '../lib/schedule/types'

/** Todo lo que necesitan las pantallas de un grupo (configuración, miembros, modelo de horarios…). */
export function useGroupView(codigo: string, selectedWeek: string) {
  const { user } = useAuth()
  const configQuery = useGroupConfig(codigo)
  const membersQuery = useGroupMembers(codigo)
  const birthdayQuery = useMyBirthday(user.id)
  const modelQuery = useBlockModelAvailable()
  const blockModel = modelQuery.data === true

  const groupConfig = configQuery.data ?? DEFAULT_CONFIG
  const members: any[] = membersQuery.data?.members ?? []
  const overridesByUser = membersQuery.data?.overridesByUser ?? {}
  const scheduleQuery = useGroupSchedules(codigo, members, overridesByUser, blockModel)
  const me = members.find((m) => m.userId === user.id)
  const isAdmin = me?.role === 'owner' || me?.role === 'admin'

  // Modelo antiguo (rejilla común), solo mientras la migración 0005 no esté aplicada
  const resolvedMembers = members.map((m) => ({
    userId: m.userId,
    name: m.name,
    schedule: resolveScheduleForWeek(m.baseSchedule, overridesByUser[m.userId] ?? [], selectedWeek).schedule,
  }))

  const birthday = birthdayQuery.data as string | null | undefined
  const birthdayDayKey: DayKey | null = birthday
    ? ((ALL_DAYS.find((d) => getDateForDay(selectedWeek, d.key).slice(5) === birthday.slice(5))?.key as DayKey) ?? null)
    : null

  return {
    user, groupConfig, members, overridesByUser, me, isAdmin, blockModel, modelLoading: modelQuery.isLoading,
    scheduleMembers: scheduleQuery.data ?? [], scheduleLoading: scheduleQuery.isLoading,
    resolvedMembers, birthdayDayKey, membersLoading: membersQuery.isLoading,
  }
}
