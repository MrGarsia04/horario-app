import { useGoBack } from '../hooks/useGoBack'
import { useAuth } from '../context/AuthContext'
import ProfileScreen from '../components/ProfileScreen'

export default function ProfilePage() {
  const goBack = useGoBack()
  const { user, usernameChanged, signOut } = useAuth()
  return (
    <ProfileScreen
      userId={user.id}
      username={user.username}
      onUsernameChanged={usernameChanged}
      onBack={() => goBack()}
      onSignOut={signOut}
    />
  )
}
