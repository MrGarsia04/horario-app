import { useAuth } from '../context/AuthContext'
import ProfileScreen from '../components/ProfileScreen'

export default function ProfilePage() {
  const { user, usernameChanged, signOut } = useAuth()
  return <ProfileScreen userId={user.id} username={user.username} onUsernameChanged={usernameChanged} onSignOut={signOut} />
}
