import { useEffect, useState } from 'react'
import { loadMyEvents, respondToEvent, deleteEvent } from '../lib/events'
import CreateEventForm from './CreateEventForm'

function formatEventDate(dateStr) {
  const d = new Date(dateStr + 'T00:00:00Z')
  return d.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' })
}

export default function EventsScreen({ userId, onBack }) {
  const [events, setEvents] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingEvent, setEditingEvent] = useState(null)

  useEffect(() => {
    load()
  }, [])

  async function load() {
    setLoading(true)
    const result = await loadMyEvents(userId)
    if (result.data) setEvents(result.data)
    setLoading(false)
  }

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
    setShowForm(false)
    setEditingEvent(null)
  }

  const isFormOpen = showForm || Boolean(editingEvent)

  return (
    <div className="min-h-screen max-w-md mx-auto px-4 py-10">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-semibold">Planes</h1>
        <button onClick={onBack} className="text-sm text-board-cream/50 hover:text-board-cream">
          Volver
        </button>
      </div>

      {isFormOpen ? (
        <CreateEventForm
          userId={userId}
          event={editingEvent}
          existingInviteeIds={editingEvent ? editingEvent.invitees.map((i) => i.userId) : []}
          onCreated={() => {
            closeForm()
            load()
          }}
          onCancel={closeForm}
        />
      ) : (
        <button
          onClick={() => setShowForm(true)}
          className="w-full bg-board-amber text-board-bg font-semibold py-2 rounded hover:brightness-110 transition mb-6"
        >
          + Nuevo plan
        </button>
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
                          className="text-xs text-board-cream/40 hover:text-red-400"
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
                            ? 'text-red-400'
                            : 'text-board-cream/50 hover:text-red-400'
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