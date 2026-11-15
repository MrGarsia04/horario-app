import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useGroupMembers } from '../hooks/useGroupData'
import { useBlockModelAvailable, useMyVisibility, useScheduleActions } from '../hooks/useSchedules'
import Sheet from '../ui/Sheet'
import Button from '../ui/Button'
import { Chip } from '../ui/misc'
import { ThemePicker } from '../components/ThemeToggle'
import InstallButton from '../components/InstallButton'
import ContactEmailCard from '../components/ContactEmailCard'
import InviteBox from '../components/InviteBox'

interface Props {
  open: boolean
  onClose: () => void
  groupCode: string | null
  onShowTutorial: () => void
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-6">
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-board-cream/50">{title}</h3>
      {children}
    </section>
  )
}

export default function SettingsSheet({ open, onClose, groupCode, onShowTutorial }: Props) {
  const { user, signOut } = useAuth()
  const navigate = useNavigate()
  const model = useBlockModelAvailable()
  const members = useGroupMembers(groupCode ?? '')
  const visibility = useMyVisibility(groupCode, user.id)
  const actions = useScheduleActions(user.id, groupCode)
  const me = members.data?.members.find((m: { userId: string }) => m.userId === user.id)
  const isAdmin = me?.role === 'owner' || me?.role === 'admin'

  return (
    <Sheet open={open} onClose={onClose} title="Ajustes" tall>
      <Section title="Apariencia"><ThemePicker /></Section>

      {groupCode && model.data === true && (
        <Section title={`Privacidad en «${groupCode}»`}>
          <p className="mb-2 text-sm text-board-cream/70">Qué ven los demás de mi horario:</p>
          <div className="flex flex-wrap gap-2">
            <Chip active={(visibility.data ?? 'busy') === 'busy'} onClick={() => actions.setVisibility.mutate('busy')}>Solo ocupado / libre</Chip>
            <Chip active={visibility.data === 'full'} onClick={() => actions.setVisibility.mutate('full')}>Nombres y lugares</Chip>
          </div>
        </Section>
      )}

      {groupCode && isAdmin && (
        <Section title="Administrar el grupo">
          <InviteBox groupCode={groupCode} />
          <Button variant="secondary" block onClick={() => { onClose(); navigate(`/g/${groupCode}/config`) }}>Ventana visible del grupo</Button>
        </Section>
      )}

      <Section title="Correo de contacto"><ContactEmailCard title="Tu correo" /></Section>

      <Section title="Ayuda y app">
        <div className="flex flex-col gap-2">
          <Button variant="secondary" block onClick={() => { onClose(); onShowTutorial() }}>Ver el tutorial otra vez</Button>
          <div className="flex justify-center"><InstallButton /></div>
        </div>
      </Section>

      <Button variant="danger" block className="mb-4" onClick={() => { onClose(); signOut() }}>Cerrar sesión</Button>
    </Sheet>
  )
}
