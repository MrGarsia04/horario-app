import { useAuth } from '../context/AuthContext'
import ProfileScreen from '../components/ProfileScreen'

export default function ProfilePage() {
  const { user, usernameChanged } = useAuth()
  return <ProfileScreen userId={user.id} username={user.username} onUsernameChanged={usernameChanged} />
}
