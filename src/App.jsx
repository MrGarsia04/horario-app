import { lazy } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider, useAuth, ACTIVE_GROUP_KEY } from './context/AuthContext'
import AuthScreen from './components/AuthScreen'
import EmailPromptScreen from './components/EmailPromptScreen'
import AppShell from './app/AppShell'

// Cada pantalla se descarga solo cuando se visita (carga inicial más ligera).
const GroupsPage = lazy(() => import('./pages/GroupsPage'))
const HorarioPage = lazy(() => import('./pages/HorarioPage'))
const GrupoPage = lazy(() => import('./pages/GrupoPage'))
const GroupConfigPage = lazy(() => import('./pages/GroupConfigPage'))
const ProfilePage = lazy(() => import('./pages/ProfilePage'))
const EventsPage = lazy(() => import('./pages/EventsPage'))

// Sin sesión se muestra el login en la misma URL (así los enlaces profundos
// /g/abc siguen funcionando después de iniciar sesión).
function RequireAuth({ children }) {
  const { user, loading, needsEmail, skipEmail } = useAuth()
  if (loading) return <p className="min-h-screen flex items-center justify-center text-sm text-board-cream/50">Cargando…</p>
  if (!user) return <AuthScreen />
  // Tras iniciar sesión, si no hay email de contacto se ofrece añadirlo («Más tarde» lo pospone).
  if (needsEmail) return <EmailPromptScreen onSkip={skipEmail} />
  return children
}

// "/" reabre el último grupo usado (como hacía la app antes de tener rutas).
function Home() {
  let saved = null
  try {
    saved = localStorage.getItem(ACTIVE_GROUP_KEY)
  } catch {
    /* sin almacenamiento */
  }
  return <Navigate to={saved ? `/g/${encodeURIComponent(saved)}` : '/grupos'} replace />
}

export default function App() {
  return (
    <AuthProvider>
      <RequireAuth>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route element={<AppShell />}>
            <Route path="/grupos" element={<GroupsPage />} />
            <Route path="/g/:codigo" element={<HorarioPage />} />
            <Route path="/g/:codigo/grupo" element={<GrupoPage />} />
            <Route path="/g/:codigo/config" element={<GroupConfigPage />} />
            <Route path="/perfil" element={<ProfilePage />} />
            <Route path="/planes" element={<EventsPage />} />
          </Route>
          <Route path="*" element={<Navigate to="/grupos" replace />} />
        </Routes>
      </RequireAuth>
    </AuthProvider>
  )
}
