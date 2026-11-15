// Modelo de horarios por bloques (migración 0005). Todos los instantes son MINUTOS desde las 00:00
// y las fechas son 'YYYY-MM-DD' (días de calendario, sin zona horaria).

export type DayKey = 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun'
export type Repeat = 'weekly' | 'biweekly_a' | 'biweekly_b'
export type Visibility = 'busy' | 'full'

export interface Interval {
  start: number // minuto de inicio (incluido)
  end: number // minuto de fin (excluido)
}

export interface Block {
  id: string
  template_id: string
  user_id: string
  /** null = horario personal, vale para todos mis grupos; con valor, solo para ese grupo */
  group_code: string | null
  title: string | null
  color: string | null
  location: string | null
  day: DayKey
  start_min: number
  end_min: number
  repeat: Repeat
  valid_from: string | null
  valid_to: string | null
}

/** Una CAPA del horario (en la base: schedule_templates). */
export interface Template {
  id: string
  user_id: string
  name: string
  /** interruptor: una capa desactivada no cuenta para nada */
  is_active: boolean
  /** fechas opcionales entre las que cuenta la capa */
  active_from: string | null
  active_to: string | null
  /** color base: los bloques lo heredan salvo que tengan el suyo */
  color?: string | null
  /** 1 = todas las semanas, 2 = una sí y otra no, 3, 4… */
  every_n_weeks?: number
  /** lunes de una semana en la que la capa «toca»; con every_n_weeks > 1 las demás se cuentan desde ahí */
  anchor_week?: string | null
  sort_order?: number
}

/** Excepción puntual: 'free' libera el rango (o el día entero si no hay rango); 'busy' lo ocupa. */
export interface Exception {
  id: string
  user_id: string
  /** null = afecta a todo; con valor, solo a los bloques de esa capa */
  template_id?: string | null
  group_code: string | null
  date: string
  kind: 'free' | 'busy'
  start_min: number | null
  end_min: number | null
  title: string | null
}

/** Pareja {day,start,end} del modelo antiguo ('HH:MM'). */
export interface LegacyInterval {
  day: DayKey
  start: string
  end: string
}

export interface LegacyOverride {
  week_start: string
  busy_slots: LegacyInterval[]
}

export interface MemberSchedule {
  userId: string
  name: string
  /** 'blocks' = modelo nuevo; 'legacy' = aún sin migrar (se usan schedules/schedule_overrides) */
  mode: 'blocks' | 'legacy'
  visibility: Visibility
  blocks: Block[]
  templates: Template[]
  exceptions: Exception[]
  legacyBase: LegacyInterval[]
  legacyOverrides: LegacyOverride[]
}

export interface ViewWindow {
  days: DayKey[]
  startMin: number
  endMin: number
}

export interface Candidate {
  date: string
  day: DayKey
  startMin: number
  endMin: number
  freeUserIds: string[]
  total: number
}
