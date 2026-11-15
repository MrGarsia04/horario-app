import { useMemo, useState } from 'react'
import { cellAvailability, toLabel, toMinutes, type Cell } from '../../lib/schedule/availability'
import type { DayKey, MemberSchedule } from '../../lib/schedule/types'
import { DAYS } from './constants'
import Sheet from '../../ui/Sheet'
import { Chip } from '../../ui/misc'

// Colores del tema (variables CSS --heat-0 … --heat-4, también en el tema rosa).
const STEPS = ['rgb(var(--heat-0))', 'rgb(var(--heat-1))', 'rgb(var(--heat-2))', 'rgb(var(--heat-3))', 'rgb(var(--heat-4))']
const colorFor = (ratio: number) => STEPS[ratio <= 0 ? 0 : ratio < 0.34 ? 1 : ratio < 0.67 ? 2 : ratio < 1 ? 3 : 4]

interface Props {
  config: { days: DayKey[]; startTime: string; endTime: string }
  members: MemberSchedule[]
  weekStart: string
  groupCode: string
  myUserId: string
  highlightDayKey?: DayKey | null
  /** Con un solo miembro (ver el horario de una persona) se pinta ocupado/libre en vez de intensidad. */
  single?: boolean
}

const ROW_PX: Record<number, number> = { 60: 48, 30: 44 } // ≥ 44 px: se acierta con el dedo
const dayName = (k: DayKey) => DAYS.find((d) => d.key === k)!

function ranges(c: { freeRanges: { start: number; end: number }[] }) {
  return c.freeRanges.map((r) => `${toLabel(r.start)}–${toLabel(r.end)}`).join(', ')
}

export default function AvailabilityMap({ config, members, weekStart, groupCode, myUserId, highlightDayKey, single = false }: Props) {
  const [step, setStep] = useState<60 | 30>(60)
  const [onlyMine, setOnlyMine] = useState(false)
  const [sel, setSel] = useState<{ day: DayKey; startMin: number } | null>(null)
  const win = useMemo(() => ({ days: config.days, startMin: toMinutes(config.startTime), endMin: toMinutes(config.endTime) }), [config.days, config.startTime, config.endTime])
  const grid = useMemo(() => cellAvailability(members, weekStart, groupCode, win, step), [members, weekStart, groupCode, win, step])
  const nameById = useMemo(() => Object.fromEntries(members.map((m) => [m.userId, m.name])), [members])
  const total = members.length || 1
  const rows = grid[0]?.cells ?? []
  const rowPx = ROW_PX[step]

  const selCell: Cell | undefined = sel ? grid.find((g) => g.day === sel.day)?.cells.find((c) => c.startMin === sel.startMin) : undefined
  const nm = (id: string) => `${nameById[id]}${id === myUserId ? ' (tú)' : ''}`

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-2" role="group" aria-label="Opciones del mapa">
        <Chip active={step === 60} onClick={() => setStep(60)}>1 hora</Chip>
        <Chip active={step === 30} onClick={() => setStep(30)}>30 min</Chip>
        {!single && <Chip active={onlyMine} onClick={() => setOnlyMine((o) => !o)}>Solo cuando yo estoy libre</Chip>}
      </div>

      <div className="card !p-0 overflow-hidden">
        <div className="grid" style={{ gridTemplateColumns: `44px repeat(${grid.length}, minmax(0, 1fr))` }}>
          <div className="h-10 border-b border-board-line" />
          {grid.map((g) => (
            <div key={g.day} className="flex h-10 items-center justify-center border-b border-l border-board-line text-xs font-semibold">
              {dayName(g.day).short}{g.day === highlightDayKey && <span className="ml-1">🎂</span>}
            </div>
          ))}

          {rows.map((row, i) => (
            <Row key={row.startMin}>
              <div className="flex items-start justify-end pr-1.5 pt-1 font-mono text-[10px] text-board-cream/50" style={{ height: rowPx }}>
                {row.startMin % 60 === 0 ? toLabel(row.startMin) : ''}
              </div>
              {grid.map((g) => {
                const c = g.cells[i]
                const mineFull = c.full.includes(myUserId)
                const n = c.full.length
                const bg = single
                  ? c.busy.length > 0 ? 'rgb(var(--board-teal))' : c.partial.length > 0 ? 'rgb(var(--board-teal) / 0.45)' : 'rgb(var(--board-panel))'
                  : n > 0 ? colorFor(n / total) : c.partial.length > 0 ? 'rgb(var(--heat-1) / 0.55)' : colorFor(0)
                return (
                  <button
                    key={g.day + row.startMin}
                    onClick={() => setSel({ day: g.day, startMin: row.startMin })}
                    style={{ height: rowPx, backgroundColor: bg, opacity: onlyMine && !mineFull ? 0.22 : 1, boxShadow: !single && mineFull ? 'inset 0 0 0 2px rgb(var(--board-free))' : undefined }}
                    className="relative flex items-center justify-center border-b border-l border-board-line/70 font-mono text-[11px] font-semibold text-board-onaccent transition-opacity"
                    aria-label={`${dayName(g.day).label} ${toLabel(c.startMin)}: ${n} de ${total} libres${mineFull ? ', tú también' : ''}`}
                  >
                    {!single && n > 0 && <span className="pointer-events-none">{n}</span>}
                  </button>
                )
              })}
            </Row>
          ))}
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-board-cream/60">
        {single ? (
          <>
            <span><span className="mr-1 inline-block h-3 w-3 rounded-sm bg-board-teal align-middle" />ocupado</span>
            <span><span className="mr-1 inline-block h-3 w-3 rounded-sm border border-board-line bg-board-panel align-middle" />libre</span>
          </>
        ) : (
          <>
            <span>El número = personas libres toda la franja</span>
            <span><span className="mr-1 inline-block h-3 w-3 rounded-sm align-middle" style={{ backgroundColor: 'rgb(var(--heat-1) / 0.55)' }} />libres solo parte</span>
            <span><span className="mr-1 inline-block h-3 w-3 rounded-sm align-middle ring-2 ring-board-free" />tú libre</span>
          </>
        )}
      </div>

      <Sheet open={Boolean(selCell)} onClose={() => setSel(null)} title={selCell ? `${dayName(sel!.day).label} · ${toLabel(selCell.startMin)}–${toLabel(selCell.endMin)}` : ''}>
        {selCell && (
          <div className="space-y-4 pb-4">
            {single ? (
              <p className="text-lg font-semibold">
                {selCell.full.length > 0 ? <span className="text-board-free">● Libre toda la franja</span> : selCell.partial.length > 0 ? <span>● Libre solo parte: {ranges(selCell.partial[0])}</span> : <span className="text-board-teal">● Ocupado</span>}
              </p>
            ) : (
              <>
                <section>
                  <h3 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-board-free">Libres toda la franja ({selCell.full.length})</h3>
                  <p className="text-sm">{selCell.full.length > 0 ? selCell.full.map(nm).join(', ') : 'Nadie'}</p>
                </section>
                {selCell.partial.length > 0 && (
                  <section>
                    <h3 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-board-cream/70">Libres solo parte ({selCell.partial.length})</h3>
                    <ul className="space-y-1 text-sm">
                      {selCell.partial.map((p) => <li key={p.userId}>{nm(p.userId)} <span className="text-board-cream/60">· libre {ranges(p)} ({p.freeMin} min)</span></li>)}
                    </ul>
                  </section>
                )}
                {selCell.busy.length > 0 && (
                  <section>
                    <h3 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-board-teal">Ocupados ({selCell.busy.length})</h3>
                    <p className="text-sm text-board-cream/80">{selCell.busy.map(nm).join(', ')}</p>
                  </section>
                )}
              </>
            )}
            {step === 60 && <p className="text-xs text-board-cream/50">Con «30 min» ves el mapa más fino.</p>}
          </div>
        )}
      </Sheet>
    </div>
  )
}

function Row({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
