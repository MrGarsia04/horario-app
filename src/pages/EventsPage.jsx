import { useGoBack } from '../hooks/useGoBack'
import { useAuth } from '../context/AuthContext'
import EventsScreen from '../components/EventsScreen'

export default function EventsPage() {
  const goBack = useGoBack()
  const { user } = useAuth()
  return <EventsScreen userId={user.id} onBack={() => goBack()} />
}
