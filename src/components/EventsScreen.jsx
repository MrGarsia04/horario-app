import { useState } from 'react'
import { useMyEvents, useRefreshSocial } from '../hooks/useSocial'
import { respondToEvent, deleteEvent } from '../lib/events'
import CreateEventForm from './CreateEventForm'

function formatEventDate(dateStr) {
  const d = new Date(dateStr + 'T00:00:00Z')
  return d.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' })
}

// `renderTop(openPlan)`: contenido extra arriba (p. ej. «mejor momento para quedar»); openPlan abre el formulario con datos.
export default function EventsScreen({ userId, onBack = undefined, initialPlan = undefined, renderTop = undefined }) {
  const eventsQuery = useMyEvents(userId)
  const load = useRefreshSocial(userId)
  const events = eventsQuery.data ?? []
  const loading = eventsQuery.isLoading
  const [showForm, setShowForm] = useState(Boolean(initialPlan))
  const [plan, setPlan] = useState(initialPlan)
  const openPlan = (p) => {
    setPlan(p)
    setShowForm(true)
  }
  const [editingEvent, setEditingEvent] = useState(null)

  async function handleRespond(eventId, status) {
    await respondToEvent(eventId, userId, status)
    load()
  }

  async function handleDelete(eventId) {
    const ok = window.confirm('¿Eliminar este plan? Se avisará también a los invitados de que desaparece.')
    if (!ok) return
    await deleteEvent(eventId)
    load()
  }

  function closeForm() {
    setPlan(undefined)
    setShowForm(false)
    setEditingEvent(null)
  }

  const isFormOpen = showForm || Boolean(editingEvent)

  return (
    <div className="max-w-md mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold">Planes</h1>
        {onBack && (
          <button onClick={onBack} className="text-sm text-board-cream/50 hover:text-board-cream">
            Volver
          </button>
        )}
      </div>

      {isFormOpen ? (
        <CreateEventForm
          userId={userId}
          event={editingEvent}
          initial={editingEvent ? undefined : plan}
          existingInviteeIds={editingEvent ? editingEvent.invitees.map((i) => i.userId) : []}
          onCreated={() => {
            closeForm()
            load()
          }}
          onCancel={closeForm}
        />
      ) : (
        <>
        {renderTop?.(openPlan)}
        <button
          onClick={() => setShowForm(true)}
          className="w-full bg-board-amber text-board-onaccent font-semibold py-2 rounded hover:brightness-110 transition mb-6"
        >
          + Nuevo plan
        </button>
        </>
      )}

      {!isFormOpen && (
        <div className="space-y-3 mt-6">
          {loading ? (
            <p className="text-sm text-board-cream/50">Cargando…</p>
          ) : events.length === 0 ? (
            <p className="text-sm text-board-cream/40">Todavía no tienes ningún plan.</p>
          ) : (
            events.map((e) => {
              const accepted = e.invitees.filter((inv) => inv.status === 'accepted')
              return (
                <div key={e.id} className="bg-board-panel border border-board-line rounded-md p-5">
                  <div className="flex items-start justify-between mb-1">
                    <h3 className="text-lg font-semibold">{e.title}</h3>
                    {e.myRole === 'creator' && (
                      <div className="flex gap-3">
                        <button
                          onClick={() => setEditingEvent(e)}
                          className="text-xs text-board-cream/40 hover:text-board-amber"
                        >
                          Editar
                        </button>
                        <button
                          onClick={() => handleDelete(e.id)}
                          className="text-xs text-board-cream/40 hover:text-board-danger"
                        >
                          Eliminar
                        </button>
                      </div>
                    )}
                  </div>
                  <p className="text-xs text-board-amber font-mono mb-1 capitalize">
                    {formatEventDate(e.event_date)}
                    {e.start_time && ` · ${e.start_time}${e.end_time ? `–${e.end_time}` : ''}`}
                  </p>
                  {e.description && <p className="text-sm text-board-cream/70 mb-2">{e.description}</p>}
                  <p className="text-xs text-board-cream/40 mb-3">Organiza: {e.creatorName}</p>

                  {accepted.length > 0 && (
                    <details className="mb-3">
                      <summary className="text-xs text-board-cream/50 cursor-pointer select-none">
                        Van ({accepted.length})
                      </summary>
                      <div className="mt-1 pl-2 space-y-1">
                        {accepted.map((inv) => (
                          <p key={inv.userId} className="text-xs text-board-cream/50">
                            {inv.name}
                          </p>
                        ))}
                      </div>
                    </details>
                  )}

                  {e.myRole === 'invitee' && (
                    <div className="flex gap-3">
                      <button
                        onClick={() => handleRespond(e.id, 'accepted')}
                        className={`text-sm ${
                          e.myStatus === 'accepted'
                            ? 'text-board-teal'
                            : 'text-board-cream/50 hover:text-board-teal'
                        }`}
                      >
                        Voy
                      </button>
                      <button
                        onClick={() => handleRespond(e.id, 'declined')}
                        className={`text-sm ${
                          e.myStatus === 'declined'
                            ? 'text-board-danger'
                            : 'text-board-cream/50 hover:text-board-danger'
                        }`}
                      >
                        No voy
                      </button>
                    </div>
                  )}
                </div>
              )
            })
          )}
        </div>
      )}
    </div>
  )
}