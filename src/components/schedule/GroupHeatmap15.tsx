import { useMemo, useState } from 'react'
import { groupAvailability, toLabel, toMinutes } from '../../lib/schedule/availability'
import type { DayKey, MemberSchedule } from '../../lib/schedule/types'
import { DAYS } from './constants'
import Sheet from '../../ui/Sheet'

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
        <div>
          <div className="grid gap-px bg-board-line grid-board" style={{ gridTemplateColumns: `40px repeat(${grid.length}, 1fr)` }}>
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
                      onClick={() => setHover({ day: g.day, startMin: row.startMin })}
                      style={{ height: ROW_PX, backgroundColor: single ? (busy ? undefined : 'rgb(var(--board-panel))') : colorFor(ratio) }}
                      className={`relative border-0 transition-colors ${single && busy ? 'bg-board-teal cell-busy' : ''}`}
                      aria-label={`${dayLabel(g.day).label} ${toLabel(slot.startMin)}: ${slot.freeUserIds.length} de ${total} libres`}
                    >
                      {!single && imFree && slot.startMin % 60 === 0 && (
                        <span className="absolute right-0.5 top-0.5 h-1.5 w-1.5 rounded-full bg-board-free ring-1 ring-board-bg" />
                      )}
                    </button>
                  )
                })}
              </Row>
            ))}
          </div>
        </div>
      </div>

      <Sheet open={Boolean(hovered)} onClose={() => setHover(null)} title={hovered ? `${dayLabel(hover!.day).label} · ${toLabel(hovered.startMin)}–${toLabel(hovered.endMin)}` : ''}>
        {hovered && (single ? (
          <p className="pb-4 text-lg font-semibold">{free.length > 0 ? <span className="text-board-free">● Libre</span> : <span className="text-board-teal">● Ocupado</span>}</p>
        ) : (
          <div className="space-y-4 pb-4">
            <div>
              <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-board-free">Libres ({free.length})</p>
              <p className="text-sm">{free.length > 0 ? free.map((id) => nameById[id]).join(', ') : 'Nadie'}</p>
            </div>
            {busyNames.length > 0 && (
              <div>
                <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-board-teal">Ocupados ({busyNames.length})</p>
                <p className="text-sm text-board-cream/80">{busyNames.join(', ')}</p>
              </div>
            )}
          </div>
        ))}
      </Sheet>

      {!single && (
        <div className="flex flex-wrap items-center gap-4 mt-2 text-xs text-board-cream/50">
          <span>Más intenso = más gente libre · toca una franja para ver quién · cada fila son 15 min</span>
        </div>
      )}
    </div>
  )
}

function Row({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
