import { useState } from 'react'
import { getDaysForConfig, buildRows, isBusyAt } from '../lib/timeSlots'

// Los colores salen de variables CSS (--heat-0 … --heat-4, definidas por tema en
// index.css y theme-rosa.css), así el mapa de calor cambia solo con el tema.
const INTENSITY_STEPS = [
  { max: 0, color: 'rgb(var(--heat-0))' },
  { max: 0.34, color: 'rgb(var(--heat-1))' },
  { max: 0.66, color: 'rgb(var(--heat-2))' },
  { max: 0.99, color: 'rgb(var(--heat-3))' },
  { max: 1.01, color: 'rgb(var(--heat-4))' },
]

function colorForRatio(ratio) {
  return INTENSITY_STEPS.find((step) => ratio <= step.max)?.color ?? 'rgb(var(--heat-0))'
}

export default function GroupHeatmap({ config, members, myUserId }) {
  const [hovered, setHovered] = useState(null)

  const days = getDaysForConfig(config)
  const rows = buildRows(config)
  const total = members.length || 1

  function freeMembersAt(day, start, end) {
    return members.filter((m) => !isBusyAt(m.schedule, day, start, end))
  }

  const hoveredFree = hovered ? freeMembersAt(hovered.day, hovered.start, hovered.end) : null
  const myMember = members.find((m) => m.userId === myUserId)

  return (
    <div>
      <div className="overflow-x-auto">
        <div className="min-w-[560px]">
          <div
            className="grid gap-px bg-board-line grid-board"
            style={{ gridTemplateColumns: `90px repeat(${days.length}, 1fr)` }}
          >
            <div className="bg-board-bg grid-corner" />
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
                    const freeCount = freeMembersAt(day.key, row.start, row.end).length
                    const ratio = freeCount / total
                    const imFree = myMember ? !isBusyAt(myMember.schedule, day.key, row.start, row.end) : false
                    return (
                      <button
                        key={day.key + row.start}
                        onMouseEnter={() => setHovered({ day: day.key, start: row.start, end: row.end })}
                        onFocus={() => setHovered({ day: day.key, start: row.start, end: row.end })}
                        style={{ backgroundColor: colorForRatio(ratio) }}
                        className="relative h-10 border-0 transition-colors grid-cell"
                        aria-label={`${day.label} ${row.start}: ${freeCount} de ${total} libres`}
                      >
                        {imFree && (
                          <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-board-teal ring-1 ring-board-bg heat-dot" />
                        )}
                      </button>
                    )
                  })}
                </RowLabel>
              )
            )}
          </div>
        </div>
      </div>

      <div className="mt-3 h-6 text-sm text-board-cream/80 font-mono">
        {hovered
          ? hoveredFree.length > 0
            ? `Libres: ${hoveredFree.map((m) => m.name).join(', ')}`
            : 'Nadie libre en esta franja'
          : 'Pasa el ratón por una casilla para ver quién está libre'}
      </div>

      <div className="flex flex-wrap items-center gap-4 mt-2 text-xs text-board-cream/50">
        <span className="inline-flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-board-teal heat-dot" /> libre para ti
        </span>
        <span>cuanto más intenso el color, más gente libre</span>
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
        className="break-row h-8 bg-board-amber/10 border-y border-dashed border-board-amber/40 flex items-center justify-center text-[11px] font-mono text-board-amber/80"
        style={{ gridColumn: `span ${totalDays}` }}
      >
        descanso · libre para todos
      </div>
    </>
  )
}