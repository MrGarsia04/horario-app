// Configuración del horario: ahora es dinámica y vive por grupo (ver group_settings
// en Supabase), en vez de estar fija en el código.

export const ALL_DAYS = [
  { key: 'mon', label: 'Lunes' },
  { key: 'tue', label: 'Martes' },
  { key: 'wed', label: 'Miércoles' },
  { key: 'thu', label: 'Jueves' },
  { key: 'fri', label: 'Viernes' },
  { key: 'sat', label: 'Sábado' },
  { key: 'sun', label: 'Domingo' },
]

export const DEFAULT_CONFIG = {
  days: ['mon', 'tue', 'wed', 'thu', 'fri'],
  startTime: '09:00',
  endTime: '18:30',
  slotMinutes: 90,
  breaks: [{ start: '13:30', end: '14:00' }],
}

function toMinutes(hhmm) {
  const [h, m] = hhmm.split(':').map(Number)
  return h * 60 + m
}

function toLabel(mins) {
  const h = String(Math.floor(mins / 60)).padStart(2, '0')
  const m = String(mins % 60).padStart(2, '0')
  return `${h}:${m}`
}

export function getDaysForConfig(config) {
  return ALL_DAYS.filter((d) => config.days.includes(d.key))
}

export function buildRows(config) {
  const endMin = toMinutes(config.endTime)
  const breakRanges = (config.breaks || [])
    .map((b) => ({ start: toMinutes(b.start), end: toMinutes(b.end) }))
    .sort((a, b) => a.start - b.start)

  const rows = []
  let cursor = toMinutes(config.startTime)

  while (cursor < endMin) {
    const activeBreak = breakRanges.find((b) => cursor >= b.start && cursor < b.end)
    if (activeBreak) {
      rows.push({ type: 'break', start: toLabel(activeBreak.start), end: toLabel(activeBreak.end) })
      cursor = activeBreak.end
      continue
    }

    const rawEnd = Math.min(cursor + config.slotMinutes, endMin)
    const upcomingBreak = breakRanges.find((b) => b.start > cursor && b.start < rawEnd)
    const actualEnd = upcomingBreak ? upcomingBreak.start : rawEnd

    rows.push({ type: 'class', start: toLabel(cursor), end: toLabel(actualEnd) })
    cursor = actualEnd
  }

  return rows
}

export function intervalsOverlap(aStart, aEnd, bStart, bEnd) {
  return toMinutes(aStart) < toMinutes(bEnd) && toMinutes(bStart) < toMinutes(aEnd)
}

export function isBusyAt(schedule, day, start, end) {
  return (schedule || []).some(
    (iv) => iv.day === day && intervalsOverlap(iv.start, iv.end, start, end)
  )
}