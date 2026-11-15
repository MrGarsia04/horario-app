import { useNavigate } from 'react-router-dom'
import { useAuth, ACTIVE_GROUP_KEY } from '../context/AuthContext'
import GroupsScreen from '../components/GroupsScreen'

export default function GroupsPage() {
  const navigate = useNavigate()
  const { user } = useAuth()
  return (
    <GroupsScreen
      userId={user.id}
      onEnterGroup={(code) => {
        localStorage.setItem(ACTIVE_GROUP_KEY, code)
        navigate(`/g/${encodeURIComponent(code)}`)
      }}
    />
  )
}
