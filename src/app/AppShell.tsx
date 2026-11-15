import { Suspense, useEffect, useState } from 'react'
import { Outlet, NavLink, useMatch, useNavigate, useLocation } from 'react-router-dom'
import { useAuth, ACTIVE_GROUP_KEY } from '../context/AuthContext'
import { useMyGroups } from '../hooks/useGroups'
import SettingsSheet from './SettingsSheet'
import Onboarding, { tutorialSeen } from './Onboarding'
import { IconCalendar, IconChevron, IconGear, IconSpark, IconUser, IconUsers } from '../ui/icons'

function readActive(): string | null {
  try {
    return localStorage.getItem(ACTIVE_GROUP_KEY)
  } catch {
    return null
  }
}

export default function AppShell() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const match = useMatch('/g/:codigo/*')
  const fromUrl = match?.params.codigo ? decodeURIComponent(match.params.codigo) : null
  const groups = useMyGroups(user.id).data ?? []
  const code = fromUrl ?? readActive()
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [tutorial, setTutorial] = useState(() => !tutorialSeen())

  useEffect(() => {
    if (fromUrl) {
      try {
        localStorage.setItem(ACTIVE_GROUP_KEY, fromUrl)
      } catch {
        /* no pasa nada */
      }
    }
  }, [fromUrl])

  const nav = [
    { to: code ? `/g/${encodeURIComponent(code)}` : '/grupos', label: 'Horario', icon: IconCalendar, active: Boolean(code) && pathname === `/g/${encodeURIComponent(code)}` },
    { to: code ? `/g/${encodeURIComponent(code)}/grupo` : '/grupos', label: 'Grupo', icon: IconUsers, active: pathname.endsWith('/grupo') || pathname === '/grupos' },
    { to: '/planes', label: 'Planes', icon: IconSpark, active: pathname === '/planes' },
    { to: '/perfil', label: 'Perfil', icon: IconUser, active: pathname === '/perfil' },
  ]

  return (
    <div className="min-h-[100dvh] md:flex">
      <nav aria-label="Principal" className="pb-safe fixed inset-x-0 bottom-0 z-30 flex border-t border-board-line bg-board-bg/95 backdrop-blur md:sticky md:top-0 md:h-[100dvh] md:w-44 md:flex-col md:justify-start md:gap-1 md:border-r md:border-t-0 md:px-2 md:pt-20">
        {nav.map((n) => (
          <NavLink
            key={n.label}
            to={n.to}
            aria-current={n.active ? 'page' : undefined}
            className={`flex min-h-[56px] flex-1 flex-col items-center justify-center gap-0.5 text-[11px] font-medium transition md:min-h-[44px] md:flex-none md:flex-row md:justify-start md:gap-3 md:rounded-lg md:px-3 md:text-sm ${n.active ? 'text-board-amber md:bg-board-amber/10' : 'text-board-cream/60 hover:text-board-cream'}`}
          >
            <n.icon className="h-6 w-6 md:h-5 md:w-5" />
            {n.label}
          </NavLink>
        ))}
      </nav>

      <div className="min-w-0 flex-1">
        <header className="pt-safe sticky top-0 z-20 border-b border-board-line bg-board-bg/95 backdrop-blur">
          <div className="mx-auto flex h-14 max-w-3xl items-center justify-between px-4">
            <div className="relative">
              <button onClick={() => setMenuOpen((o) => !o)} className="flex min-h-[44px] items-center gap-1.5 text-left" aria-haspopup="listbox" aria-expanded={menuOpen}>
                <span>
                  <span className="block font-mono text-[10px] uppercase leading-none tracking-wide text-board-amber">Orden, por favor</span>
                  <span className="block text-base font-semibold leading-tight">{code ?? 'Mis grupos'}</span>
                </span>
                <IconChevron className="h-4 w-4 text-board-cream/60" />
              </button>
              {menuOpen && (
                <>
                  <div className="fixed inset-0 z-30" onClick={() => setMenuOpen(false)} aria-hidden="true" />
                  <ul role="listbox" className="absolute left-0 top-12 z-40 w-60 overflow-hidden rounded-xl border border-board-line bg-board-panel shadow-xl">
                    {groups.map((g) => (
                      <li key={g}>
                        <button role="option" aria-selected={g === code} onClick={() => { setMenuOpen(false); navigate(`/g/${encodeURIComponent(g)}`) }} className={`block min-h-[44px] w-full px-4 text-left text-sm hover:bg-board-line/40 ${g === code ? 'font-semibold text-board-amber' : ''}`}>
                          {g}
                        </button>
                      </li>
                    ))}
                    <li className="border-t border-board-line">
                      <button onClick={() => { setMenuOpen(false); navigate('/grupos') }} className="block min-h-[44px] w-full px-4 text-left text-sm text-board-sky hover:bg-board-line/40">
                        Unirme / crear / gestionar…
                      </button>
                    </li>
                  </ul>
                </>
              )}
            </div>
            <button onClick={() => setSettingsOpen(true)} className="btn-ghost !px-3" aria-label="Ajustes">
              <IconGear className="h-6 w-6" />
            </button>
          </div>
        </header>

        <main className="mx-auto max-w-3xl px-4 pb-28 pt-5 md:pb-10">
          <Suspense fallback={<p className="text-sm text-board-cream/50">Cargando…</p>}>
            <Outlet />
          </Suspense>
        </main>
      </div>

      <SettingsSheet open={settingsOpen} onClose={() => setSettingsOpen(false)} groupCode={code} onShowTutorial={() => setTutorial(true)} />
      {tutorial && <Onboarding onClose={() => setTutorial(false)} />}
    </div>
  )
}
