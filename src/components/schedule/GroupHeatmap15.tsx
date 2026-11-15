import { useMemo, useState } from 'react'
import { groupAvailability, toLabel, toMinutes } from '../../lib/schedule/availability'
import type { DayKey, MemberSchedule } from '../../lib/schedule/types'
import { DAYS } from './constants'

// Colores del tema (variables CSS --heat-0 … --heat-4, también en el tema rosa).
const STEPS = ['rgb(var(--heat-0))', 'rgb(var(--heat-1))', 'rgb(var(--heat-2))', 'rgb(var(--heat-3))', 'rgb(var(--heat-4))']
const colorFor = (ratio: number) => STEPS[ratio <= 0 ? 0 : ratio < 0.34 ? 1 : ratio < 0.67 ? 2 : ratio < 1 ? 3 : 4]

interface GroupConfig {
  days: DayKey[]
  startTime: string
  endTime: string
}

interface Props {
  config: GroupConfig
  members: MemberSchedule[]
  weekStart: string
  groupCode: string
  myUserId: string
  highlightDayKey?: DayKey | null
  /** Con un solo miembro (ver el horario de una persona) se pinta ocupado/libre en vez de intensidad. */
  single?: boolean
}

const ROW_PX = 14 // alto de cada franja de 15 min

export default function GroupHeatmap15({ config, members, weekStart, groupCode, myUserId, highlightDayKey, single = false }: Props) {
  const [hover, setHover] = useState<{ day: DayKey; startMin: number } | null>(null)
  const win = useMemo(
    () => ({ days: config.days, startMin: toMinutes(config.startTime), endMin: toMinutes(config.endTime) }),
    [config.days, config.startTime, config.endTime]
  )
  const grid = useMemo(() => groupAvailability(members, weekStart, groupCode, win), [members, weekStart, groupCode, win])
  const nameById = useMemo(() => Object.fromEntries(members.map((m) => [m.userId, m.name])), [members])
  const total = members.length || 1
  const rows = grid[0]?.slots ?? []
  const dayLabel = (k: DayKey) => DAYS.find((d) => d.key === k)!

  const hovered = hover ? grid.find((g) => g.day === hover.day)?.slots.find((s) => s.startMin === hover.startMin) : null
  const free = hovered?.freeUserIds ?? []
  const busyNames = hovered ? members.filter((m) => !free.includes(m.userId)).map((m) => m.name) : []

  return (
    <div>
      <div className="overflow-x-auto">
        <div className="min-w-[560px]">
          <div className="grid gap-px bg-board-line grid-board" style={{ gridTemplateColumns: `52px repeat(${grid.length}, 1fr)` }}>
            <div className="bg-board-bg grid-corner" />
            {grid.map((g) => (
              <div key={g.day} className="bg-board-bg text-center font-mono text-xs tracking-wide text-board-cream/70 py-2">
                {dayLabel(g.day).label}
                {g.day === highlightDayKey && <span className="ml-1">🎂</span>}
              </div>
            ))}

            {rows.map((row, i) => (
              <Row key={row.startMin}>
                <div className="bg-board-bg text-right pr-2 font-mono text-[11px] text-board-cream/50 flex items-start justify-end" style={{ height: ROW_PX }}>
                  {row.startMin % 60 === 0 ? toLabel(row.startMin) : ''}
                </div>
                {grid.map((g) => {
                  const slot = g.slots[i]
                  const ratio = slot.freeUserIds.length / total
                  const imFree = slot.freeUserIds.includes(myUserId)
                  const busy = single && slot.freeUserIds.length === 0
                  return (
                    <button
                      key={g.day + row.startMin}
                      onMouseEnter={() => setHover({ day: g.day, startMin: row.startMin })}
                      onFocus={() => setHover({ day: g.day, startMin: row.startMin })}
                      onClick={() => setHover({ day: g.day, startMin: row.startMin })}
                      style={{ height: ROW_PX, backgroundColor: single ? (busy ? undefined : 'rgb(var(--board-panel))') : colorFor(ratio) }}
                      className={`relative border-0 transition-colors ${single && busy ? 'bg-board-teal cell-busy' : ''}`}
                      aria-label={`${dayLabel(g.day).label} ${toLabel(slot.startMin)}: ${slot.freeUserIds.length} de ${total} libres`}
                    >
                      {!single && imFree && slot.startMin % 60 === 0 && (
                        <span className="absolute top-0.5 right-1 w-1.5 h-1.5 rounded-full bg-board-teal ring-1 ring-board-bg heat-dot" />
                      )}
                    </button>
                  )
                })}
              </Row>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-3 min-h-[2.5rem] text-sm text-board-cream/80 font-mono">
        {hovered ? (
          <>
            <span className="text-board-cream/50">
              {dayLabel(hover!.day).label} {toLabel(hovered.startMin)}–{toLabel(hovered.endMin)} ·{' '}
            </span>
            {single
              ? free.length > 0 ? 'Libre' : 'Ocupado'
              : free.length > 0 ? `Libres: ${free.map((id) => nameById[id]).join(', ')}` : 'Nadie libre'}
            {!single && busyNames.length > 0 && free.length > 0 && <span className="block text-board-cream/40">Ocupados: {busyNames.join(', ')}</span>}
          </>
        ) : (
          'Pasa el ratón (o toca) una franja para ver quién está libre'
        )}
      </div>

      {!single && (
        <div className="flex flex-wrap items-center gap-4 mt-2 text-xs text-board-cream/50">
          <span className="inline-flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-board-teal heat-dot" /> libre para ti (marca cada hora)</span>
          <span>cuanto más intenso el color, más gente libre · cada fila son 15 min</span>
        </div>
      )}
    </div>
  )
}

function Row({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
