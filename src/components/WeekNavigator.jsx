import { addWeeks, formatWeekLabel, getWeekStart } from '../lib/weeks'

export default function WeekNavigator({ weekStart, onChange, statusText }) {
  const isCurrentWeek = weekStart === getWeekStart(new Date())

  return (
    <div className="flex items-center justify-between mb-4">
      <button
        onClick={() => onChange(addWeeks(weekStart, -1))}
        className="w-8 h-8 flex items-center justify-center text-board-cream/60 hover:text-board-amber"
        aria-label="Semana anterior"
      >
        ‹
      </button>

      <div className="text-center">
        <div className="font-mono text-sm">{formatWeekLabel(weekStart)}</div>
        <div className="flex items-center justify-center gap-2 mt-0.5">
          {!isCurrentWeek && (
            <button
              onClick={() => onChange(getWeekStart(new Date()))}
              className="text-xs text-board-amber hover:brightness-110"
            >
              Ir a hoy
            </button>
          )}
          {statusText && <span className="text-xs text-board-cream/40">{statusText}</span>}
        </div>
      </div>

      <button
        onClick={() => onChange(addWeeks(weekStart, 1))}
        className="w-8 h-8 flex items-center justify-center text-board-cream/60 hover:text-board-amber"
        aria-label="Semana siguiente"
      >
        ›
      </button>
    </div>
  )
}