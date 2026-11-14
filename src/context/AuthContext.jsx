import { createContext, useCallback, useContext, useMemo, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'

// Sesión actual. De momento se guarda en localStorage (comportamiento heredado);
// la fase de Supabase Auth sustituirá el interior de este contexto sin tocar a quien lo usa.
const SESSION_KEY = 'horario-app-user'
export const ACTIVE_GROUP_KEY = 'horario-app-active-group'

const AuthContext = createContext(null)

function readStoredUser() {
  try {
    const raw = localStorage.getItem(SESSION_KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

export function AuthProvider({ children }) {
  const queryClient = useQueryClient()
  const [user, setUser] = useState(readStoredUser)

  const signedIn = useCallback((newUser) => {
    localStorage.setItem(SESSION_KEY, JSON.stringify(newUser))
    setUser(newUser)
  }, [])

  const usernameChanged = useCallback((username) => {
    setUser((prev) => {
      const updated = { ...prev, username }
      localStorage.setItem(SESSION_KEY, JSON.stringify(updated))
      return updated
    })
  }, [])

  const signOut = useCallback(() => {
    localStorage.removeItem(SESSION_KEY)
    localStorage.removeItem(ACTIVE_GROUP_KEY)
    setUser(null)
    queryClient.clear()
  }, [queryClient])

  const value = useMemo(
    () => ({ user, signedIn, usernameChanged, signOut }),
    [user, signedIn, usernameChanged, signOut]
  )
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth debe usarse dentro de <AuthProvider>')
  return ctx
}
