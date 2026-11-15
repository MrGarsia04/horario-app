import { useState } from 'react'
import { daysLabel, hoursLabel, type MapViewPref } from '../../lib/schedule/mapView'
import type { DayKey, ViewWindow } from '../../lib/schedule/types'
import Sheet from '../../ui/Sheet'
import Button from '../../ui/Button'
import { Chip, Tabs } from '../../ui/misc'
import { DAYS } from './constants'

interface Props {
  /** rango automático actual (lo que se vería sin vista propia) */
  auto: ViewWindow
  value: MapViewPref | null
  onChange: (v: MapViewPref | null) => void
}

const ALL: DayKey[] = DAYS.map((d) => d.key)
// Opciones de hora cada 30 min: «8:00», «8:30»…
const TIMES = Array.from({ length: 49 }, (_, i) => i * 30)
const fmt = (m: number) => `${Math.floor(m / 60)}:${String(m % 60).padStart(2, '0')}`

/** Chip «Ver: 8:00–20:00 · Lun–Vie ▾» + hoja para elegir tu vista (automática o personalizada). Solo cambia lo que TÚ ves. */
export default function MapViewControl({ auto, value, onChange }: Props) {
  const [open, setOpen] = useState(false)
  const shown = value ?? auto
  const base: MapViewPref = value ?? { days: [...auto.days], startMin: auto.startMin, endMin: auto.endMin }
  const [mode, setMode] = useState<'auto' | 'custom'>(value ? 'custom' : 'auto')
  const [days, setDays] = useState<DayKey[]>(base.days)
  const [start, setStart] = useState(base.startMin)
  const [end, setEnd] = useState(base.endMin)
  const valid = days.length > 0 && end > start

  function openSheet() {
    setMode(value ? 'custom' : 'auto')
    setDays(base.days)
    setStart(base.startMin)
    setEnd(base.endMin)
    setOpen(true)
  }
  const toggleDay = (k: DayKey) => setDays((p) => (p.includes(k) ? p.filter((x) => x !== k) : ALL.filter((d) => d === k || p.includes(d))))

  return (
    <>
      <Chip active={Boolean(value)} onClick={openSheet} aria-haspopup="dialog" data-tour="map-view">
        Ver: {hoursLabel(shown.startMin, shown.endMin)} · {daysLabel(shown.days)} ▾
      </Chip>

      <Sheet
        open={open}
        onClose={() => setOpen(false)}
        title="Qué ves en el mapa"
        footer={
          <div className="flex gap-2 pb-2">
            {value && <Button variant="ghost" onClick={() => { onChange(null); setOpen(false) }}>Restablecer a automático</Button>}
            <Button
              className="flex-1"
              disabled={mode === 'custom' && !valid}
              onClick={() => { onChange(mode === 'auto' ? null : { days, startMin: start, endMin: end }); setOpen(false) }}
            >
              Aplicar
            </Button>
          </div>
        }
      >
        <div className="space-y-5 pb-4">
          <Tabs<'auto' | 'custom'> label="Modo de la vista" value={mode} onChange={setMode} items={[{ id: 'auto', label: 'Automático' }, { id: 'custom', label: 'Personalizado' }]} />

          {mode === 'auto' ? (
            <p className="text-sm text-board-cream/70">
              Ahora: <strong>{hoursLabel(auto.startMin, auto.endMin)} · {daysLabel(auto.days)}</strong>. El mapa se ajusta solo a los horarios del grupo (como mínimo de 8:00 a 20:00, con 1 h de margen) y muestra sábado y domingo solo si alguien los usa.
            </p>
          ) : (
            <>
              <div>
                <div className="mb-2 flex items-center justify-between">
                  <p className="text-sm font-medium">Días</p>
                  <div className="flex gap-1.5">
                    <Chip onClick={() => setDays(ALL.slice(0, 5))}>Lun–Vie</Chip>
                    <Chip onClick={() => setDays(ALL)}>Toda la semana</Chip>
                  </div>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {DAYS.map((d) => <Chip key={d.key} active={days.includes(d.key)} onClick={() => toggleDay(d.key)}>{d.short}</Chip>)}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <label className="text-xs text-board-cream/60">Desde las
                  <select value={start} onChange={(e) => setStart(Number(e.target.value))} className="field mt-1">
                    {TIMES.slice(0, 48).map((m) => <option key={m} value={m}>{fmt(m)}</option>)}
                  </select>
                </label>
                <label className="text-xs text-board-cream/60">Hasta las
                  <select value={end} onChange={(e) => setEnd(Number(e.target.value))} className="field mt-1">
                    {TIMES.slice(1).map((m) => <option key={m} value={m}>{fmt(m)}</option>)}
                  </select>
                </label>
              </div>
              {!valid && <p className="text-sm text-board-danger">{days.length === 0 ? 'Elige al menos un día.' : 'La hora de fin debe ser posterior a la de inicio.'}</p>}
              <p className="text-xs text-board-cream/50">Solo cambia lo que ves tú, en este dispositivo y para este grupo. Los horarios de nadie se tocan.</p>
            </>
          )}
        </div>
      </Sheet>
    </>
  )
}
