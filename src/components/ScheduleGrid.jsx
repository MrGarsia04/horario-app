import { DAYS, ROWS, slotId } from '../lib/timeSlots'

// mySchedule: objeto { [slotId]: true } con las franjas de clase marcadas como ocupado.
// readOnly: si es true, las casillas se muestran pero no se pueden tocar (para ver el
// horario de otra persona del grupo). onClearAll: opcional, muestra el botón de vaciar.
export default function ScheduleGrid({ mySchedule, onToggle, readOnly = false, onClearAll }) {
  function handleClear() {
    const ok = window.confirm('¿Vaciar todo tu horario? Se desmarcarán todas las casillas.')
    if (ok) onClearAll()
  }

  return (
    <div className="overflow-x-auto">
      <div className="min-w-[560px]">
        <div
          className="grid gap-px bg-board-line"
          style={{ gridTemplateColumns: `90px repeat(${DAYS.length}, 1fr)` }}
        >
          <div className="bg-board-bg" />
          {DAYS.map((day) => (
            <div
              key={day.key}
              className="bg-board-bg text-center font-mono text-xs tracking-wide text-board-cream/70 py-2"
            >
              {day.label}
            </div>
          ))}

          {ROWS.map((row) =>
            row.type === 'break' ? (
              <BreakRow key={row.start} row={row} totalDays={DAYS.length} />
            ) : (
              <RowLabel key={row.start} row={row}>
                {DAYS.map((day) => {
                  const id = slotId(day.key, row.start)
                  const busy = Boolean(mySchedule[id])
                  return (
                    <button
                      key={id}
                      onClick={readOnly ? undefined : () => onToggle(id)}
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
          {!readOnly && <span>Cada casilla es una clase de 1h30. Haz clic para marcarla</span>}
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
        Comida
      </div>
    </>
  )
}