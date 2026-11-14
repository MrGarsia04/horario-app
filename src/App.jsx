import { Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import { AuthProvider, useAuth, ACTIVE_GROUP_KEY } from './context/AuthContext'
import AuthScreen from './components/AuthScreen'
import ResetPasswordScreen from './components/ResetPasswordScreen'
import GroupsPage from './pages/GroupsPage'
import GroupPage from './pages/GroupPage'
import ProfilePage from './pages/ProfilePage'
import EventsPage from './pages/EventsPage'

// Sin sesión se muestra el login en la misma URL (así los enlaces profundos
// /g/abc siguen funcionando después de iniciar sesión).
function RequireAuth({ children }) {
  const { user, loading, recovering, finishRecovery } = useAuth()
  const navigate = useNavigate()
  if (loading) return <p className="min-h-screen flex items-center justify-center text-sm text-board-cream/50">Cargando…</p>
  if (!user) return <AuthScreen />
  if (recovering) {
    return (
      <ResetPasswordScreen
        onDone={() => {
          finishRecovery()
          navigate('/grupos', { replace: true })
        }}
      />
    )
  }
  return children
}

// "/" reabre el último grupo usado (como hacía la app antes de tener rutas).
function Home() {

  const saved = localStorage.getItem(ACTIVE_GROUP_KEY)
  return <Navigate to={saved ? `/g/${encodeURIComponent(saved)}` : '/grupos'} replace />
}

function NotFound() {
  const location = useLocation()
  return <Navigate to="/grupos" replace state={{ from: location.pathname }} />
}

export default function App() {
  return (
    <AuthProvider>
      <RequireAuth>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/grupos" element={<GroupsPage />} />
          <Route path="/g/:codigo" element={<GroupPage />} />
          <Route path="/g/:codigo/config" element={<GroupPage settings />} />
          <Route path="/perfil" element={<ProfilePage />} />
          <Route path="/planes" element={<EventsPage />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </RequireAuth>
    </AuthProvider>
  )
}
