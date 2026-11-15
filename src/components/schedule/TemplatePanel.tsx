import { useState } from 'react'
import type { Template } from '../../lib/schedule/types'

interface Props {
  templates: Template[]
  selectedId: string | null
  onSelect: (id: string) => void
  onCreate: (name: string) => Promise<void>
  onUpdate: (id: string, patch: Partial<Template>) => Promise<void>
  onDelete: (id: string) => Promise<void>
  onDuplicate: (id: string) => Promise<void>
}

const field = 'bg-board-bg border border-board-line rounded px-2 py-1 text-sm outline-none focus:border-board-amber'

export default function TemplatePanel({ templates, selectedId, onSelect, onCreate, onUpdate, onDelete, onDuplicate }: Props) {
  const [open, setOpen] = useState(false)
  const [newName, setNewName] = useState('')
  const [error, setError] = useState('')
  const selected = templates.find((t) => t.id === selectedId) ?? null

  async function guard(fn: () => Promise<void>) {
    setError('')
    try {
      await fn()
    } catch (e) {
      setError((e as Error).message)
    }
  }

  return (
    <div className="mb-4">
      <div className="flex flex-wrap items-center gap-2">
        <label className="text-xs text-board-cream/60" htmlFor="plantilla">Plantilla</label>
        <select id="plantilla" value={selectedId ?? ''} onChange={(e) => onSelect(e.target.value)} className={field}>
          {templates.map((t) => (
            <option key={t.id} value={t.id}>{t.name}{t.is_active ? '' : ' (desactivada)'}</option>
          ))}
        </select>
        <button onClick={() => setOpen((o) => !o)} className="text-xs text-board-amber hover:brightness-110">
          {open ? 'Cerrar opciones' : 'Plantillas y fechas'}
        </button>
      </div>

      {open && (
        <div className="mt-3 bg-board-panel border border-board-line rounded-md p-4 space-y-4">
          <p className="text-xs text-board-cream/50">
            Una plantilla es un conjunto de bloques (p. ej. «Clases», «Exámenes», «Verano»). Solo cuentan las plantillas
            activas y dentro de sus fechas: así puedes preparar el horario de exámenes y que se active solo.
          </p>

          {selected && (
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <input
                  defaultValue={selected.name}
                  key={selected.id + selected.name}
                  onBlur={(e) => e.target.value.trim() && e.target.value !== selected.name && guard(() => onUpdate(selected.id, { name: e.target.value.trim() }))}
                  className={`${field} flex-1 min-w-[8rem]`}
                  aria-label="Nombre de la plantilla"
                />
                <label className="text-xs flex items-center gap-1">
                  <input type="checkbox" checked={selected.is_active} onChange={(e) => guard(() => onUpdate(selected.id, { is_active: e.target.checked }))} />
                  Activa
                </label>
              </div>
              <div className="flex flex-wrap items-center gap-2 text-xs text-board-cream/60">
                <label>Desde <input type="date" value={selected.active_from ?? ''} onChange={(e) => guard(() => onUpdate(selected.id, { active_from: e.target.value || null }))} className={field} /></label>
                <label>Hasta <input type="date" value={selected.active_to ?? ''} onChange={(e) => guard(() => onUpdate(selected.id, { active_to: e.target.value || null }))} className={field} /></label>
              </div>
              <div className="flex gap-4 text-xs">
                <button onClick={() => guard(() => onDuplicate(selected.id))} className="text-board-amber">Duplicar plantilla</button>
                {templates.length > 1 && (
                  <button
                    onClick={() => window.confirm(`¿Borrar la plantilla «${selected.name}» y todos sus bloques?`) && guard(() => onDelete(selected.id))}
                    className="text-board-danger/80 hover:text-board-danger"
                  >
                    Borrar plantilla
                  </button>
                )}
              </div>
            </div>
          )}

          <form
            onSubmit={(e) => {
              e.preventDefault()
              if (!newName.trim()) return
              guard(async () => {
                await onCreate(newName.trim())
                setNewName('')
              })
            }}
            className="flex gap-2"
          >
            <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Nueva plantilla (p. ej. Exámenes)" className={`${field} flex-1`} />
            <button type="submit" className="text-sm text-board-amber">Crear</button>
          </form>
          {error && <p className="text-sm text-board-danger">{error}</p>}
        </div>
      )}
    </div>
  )
}
