import { getDaysForConfig, buildRows, isBusyAt } from '../lib/timeSlots'

export default function ScheduleGrid({ config, mySchedule, onToggle, readOnly = false, onClearAll }) {
  const days = getDaysForConfig(config)
  const rows = buildRows(config)

  function handleClear() {
    const ok = window.confirm('¿Vaciar todo tu horario? Se desmarcarán todas las casillas.')
    if (ok) onClearAll()
  }

  return (
    <div className="overflow-x-auto">
      <div className="min-w-[560px]">
        <div
          className="grid gap-px bg-board-line"
          style={{ gridTemplateColumns: `90px repeat(${days.length}, 1fr)` }}
        >
          <div className="bg-board-bg" />
          {days.map((day) => (
            <div
              key={day.key}
              className="bg-board-bg text-center font-mono text-xs tracking-wide text-board-cream/70 py-2"
            >
              {day.label}
            </div>
          ))}

          {rows.map((row) =>
            row.type === 'break' ? (
              <BreakRow key={row.start} row={row} totalDays={days.length} />
            ) : (
              <RowLabel key={row.start} row={row}>
                {days.map((day) => {
                  const busy = isBusyAt(mySchedule, day.key, row.start, row.end)
                  return (
                    <button
                      key={day.key + row.start}
                      onClick={readOnly ? undefined : () => onToggle(day.key, row.start, row.end)}
                      disabled={readOnly}
                      className={`h-10 border-0 transition-colors ${
                        busy ? 'bg-board-teal' : 'bg-board-panel'
                      } ${readOnly ? 'cursor-default' : 'hover:bg-board-line'}`}
                      aria-label={`${day.label} ${row.start}-${row.end}`}
                    />
                  )
                })}
              </RowLabel>
            )
          )}
        </div>
      </div>
      <div className="flex items-center justify-between mt-3">
        <div className="flex items-center gap-4 text-xs text-board-cream/60">
          <span className="inline-flex items-center gap-1">
            <span className="w-3 h-3 inline-block bg-board-teal" /> ocupado
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="w-3 h-3 inline-block bg-board-panel border border-board-line" /> libre
          </span>
          {!readOnly && <span>Haz clic en una casilla para marcarla</span>}
        </div>
        {!readOnly && onClearAll && (
          <button onClick={handleClear} className="text-xs text-board-cream/40 hover:text-red-400">
            Vaciar mi horario
          </button>
        )}
      </div>
    </div>
  )
}

function RowLabel({ row, children }) {
  return (
    <>
      <div className="bg-board-bg text-right pr-2 font-mono text-[11px] text-board-cream/50 flex items-center justify-end">
        {row.start}
      </div>
      {children}
    </>
  )
}

function BreakRow({ row, totalDays }) {
  return (
    <>
      <div className="bg-board-bg text-right pr-2 font-mono text-[11px] text-board-cream/50 flex items-center justify-end">
        {row.start}
      </div>
      <div
        className="h-8 bg-board-amber/10 border-y border-dashed border-board-amber/40 flex items-center justify-center text-[11px] font-mono text-board-amber/80"
        style={{ gridColumn: `span ${totalDays}` }}
      >
        descanso · libre para todos
      </div>
    </>
  )
}