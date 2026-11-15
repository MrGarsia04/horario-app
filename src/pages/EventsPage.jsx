import { useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import EventsScreen from '../components/EventsScreen'

export default function EventsPage() {
  const { user } = useAuth()
  // «Crear plan» desde el mejor momento del grupo llega con los datos en location.state.newPlan
  const initialPlan = useLocation().state?.newPlan
  return <EventsScreen userId={user.id} initialPlan={initialPlan} />
}
