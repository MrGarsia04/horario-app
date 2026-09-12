import { useState } from 'react'
import { DAYS, ROWS, slotId } from '../lib/timeSlots'

// members: [{ name, schedule: { [slotId]: true si ocupado } }]
export default function GroupHeatmap({ members }) {
  const [hovered, setHovered] = useState(null)

  const total = members.length || 1

  function freeMembersAt(id) {
    return members.filter((m) => !m.schedule[id])
  }

  function intensityClass(freeCount) {
    const ratio = freeCount / total
    if (ratio === 1) return 'bg-board-amber'
    if (ratio >= 0.66) return 'bg-board-amber/70'
    if (ratio >= 0.33) return 'bg-board-amber/35'
    if (ratio > 0) return 'bg-board-amber/15'
    return 'bg-board-panel'
  }

  const hoveredFree = hovered ? freeMembersAt(hovered) : null

  return (
    <div>
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
                    const freeCount = freeMembersAt(id).length
                    return (
                      <button
                        key={id}
                        onMouseEnter={() => setHovered(id)}
                        onFocus={() => setHovered(id)}
                        className={`h-10 border-0 transition-colors ${intensityClass(freeCount)}`}
                        aria-label={`${day.label} ${row.start}: ${freeCount} de ${total} libres`}
                      />
                    )
                  })}
                </RowLabel>
              )
            )}
          </div>
        </div>
      </div>

      <div className="mt-3 h-6 text-sm text-board-cream/80 font-mono">
        {hovered && hoveredFree
          ? hoveredFree.length > 0
            ? `Libres: ${hoveredFree.map((m) => m.name).join(', ')}`
            : 'Nadie libre en esta franja'
          : 'Pasa el ratón por una casilla para ver quién está libre'}
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