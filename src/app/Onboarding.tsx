import { useState } from 'react'
import Button from '../ui/Button'
import { IconCalendar, IconUsers, IconSpark } from '../ui/icons'

export const TUTORIAL_KEY = 'opf-tutorial-v1'

const SLIDES = [
  { icon: IconSpark, title: 'Bienvenido a «Orden, por favor»', text: 'Tu horario y el de tus amigos en un solo sitio, para saber cuándo coincidís libres sin mil mensajes.' },
  { icon: IconCalendar, title: 'Crea tu horario', text: 'En «Horario» toca un hueco para añadir una clase o un turno. Organízalo por capas (clases, prácticas, trabajo…) y elige cada cuánto se repite cada una: todas las semanas, cada 2, cada 3…' },
  { icon: IconUsers, title: 'Únete a un grupo', text: 'Pídele el código de invitación a quien administra el grupo y pégalo en «Mis grupos». También puedes crear uno nuevo e invitar a tu gente.' },
  { icon: IconSpark, title: 'Mira cuándo coincidís', text: 'En «Grupo» verás quién está libre y los mejores momentos para quedar. Con un toque creas el plan.' },
]

export function tutorialSeen(): boolean {
  try {
    return localStorage.getItem(TUTORIAL_KEY) === '1'
  } catch {
    return true
  }
}

export default function Onboarding({ onClose }: { onClose: () => void }) {
  const [i, setI] = useState(0)
  const slide = SLIDES[i]
  const last = i === SLIDES.length - 1
  const Icon = slide.icon

  function finish() {
    try {
      localStorage.setItem(TUTORIAL_KEY, '1')
    } catch {
      /* sin almacenamiento: se volverá a mostrar */
    }
    onClose()
  }

  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-board-bg px-6 pt-safe" role="dialog" aria-modal="true" aria-label="Tutorial de inicio">
      <div className="flex justify-end pt-4">
        <Button variant="ghost" small onClick={finish}>Saltar</Button>
      </div>
      <div className="flex flex-1 flex-col items-center justify-center text-center">
        <div className="mb-8 flex h-28 w-28 items-center justify-center rounded-3xl bg-board-amber/15 text-board-amber">
          <Icon className="h-14 w-14" />
        </div>
        <h2 className="mb-3 text-2xl font-semibold">{slide.title}</h2>
        <p className="max-w-sm text-board-cream/70">{slide.text}</p>
      </div>
      <div className="pb-safe pb-6">
        <div className="mb-5 flex justify-center gap-2" aria-hidden="true">
          {SLIDES.map((_, n) => (
            <span key={n} className={`h-2 rounded-full transition-all ${n === i ? 'w-6 bg-board-amber' : 'w-2 bg-board-line'}`} />
          ))}
        </div>
        <Button block onClick={() => (last ? finish() : setI(i + 1))}>{last ? 'Empezar' : 'Siguiente'}</Button>
        {i > 0 && <Button variant="ghost" block className="mt-1" onClick={() => setI(i - 1)}>Atrás</Button>}
      </div>
    </div>
  )
}
