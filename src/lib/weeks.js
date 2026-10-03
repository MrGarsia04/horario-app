// Utilidades para trabajar con "semanas" del calendario. Una semana se identifica
// siempre por la fecha (YYYY-MM-DD) de su lunes.
//
// IMPORTANTE: todo el cálculo se hace en UTC de forma consistente (aunque las fechas
// en sí no representan ninguna hora concreta, solo un día del calendario). Mezclar
// horas locales con toISOString() (que es UTC) desplaza la fecha un día en zonas
// horarias como la española — por eso aquí SIEMPRE se usan los métodos UTC*.

function parseISODate(str) {
  const [y, m, d] = str.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d))
}

function toISODate(date) {
  return date.toISOString().slice(0, 10)
}

export function getWeekStart(input) {
  const d =
    input instanceof Date
      ? new Date(Date.UTC(input.getFullYear(), input.getMonth(), input.getDate()))
      : parseISODate(input)

  const day = d.getUTCDay()
  const diff = (day === 0 ? -6 : 1) - day
  d.setUTCDate(d.getUTCDate() + diff)
  return toISODate(d)
}

export function addWeeks(weekStart, n) {
  const d = parseISODate(weekStart)
  d.setUTCDate(d.getUTCDate() + n * 7)
  return toISODate(d)
}

const DAY_OFFSETS = { mon: 0, tue: 1, wed: 2, thu: 3, fri: 4, sat: 5, sun: 6 }

export function getDateForDay(weekStart, dayKey) {
  const d = parseISODate(weekStart)
  d.setUTCDate(d.getUTCDate() + (DAY_OFFSETS[dayKey] ?? 0))
  return toISODate(d)
}

export function formatWeekLabel(weekStart) {
  const start = parseISODate(weekStart)
  const end = new Date(start)
  end.setUTCDate(end.getUTCDate() + 6)
  const fmt = (d) => d.toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })
  return `${fmt(start)} – ${fmt(end)}`
}

export function resolveScheduleForWeek(baseSchedule, overrides, weekStart) {
  const applicable = (overrides || []).filter((o) => o.week_start <= weekStart)
  if (applicable.length === 0) {
    return { schedule: baseSchedule ?? [], isCustomThisWeek: false, effectiveFrom: null }
  }
  const latest = applicable.reduce((a, b) => (a.week_start > b.week_start ? a : b))
  return {
    schedule: latest.busy_slots,
    isCustomThisWeek: latest.week_start === weekStart,
    effectiveFrom: latest.week_start,
  }
}