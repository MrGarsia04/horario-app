import { useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import EventsScreen from '../components/EventsScreen'
import PlanSuggester from '../components/schedule/PlanSuggester'

export default function EventsPage() {
  const { user } = useAuth()
  const initialPlan = useLocation().state?.newPlan
  return <EventsScreen userId={user.id} initialPlan={initialPlan} renderTop={(openPlan) => <PlanSuggester onCreatePlan={openPlan} />} />
}
