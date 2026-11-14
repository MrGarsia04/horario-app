import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabaseClient'
import { signOut as authSignOut } from '../lib/auth'

// Sesión real de Supabase Auth: supabase-js la guarda y la refresca; aquí solo la reflejamos.
export const ACTIVE_GROUP_KEY = 'horario-app-active-group'
// La app antigua guardaba el usuario así; se limpia por si queda de versiones anteriores.
const LEGACY_SESSION_KEY = 'horario-app-user'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const queryClient = useQueryClient()
  const [session, setSession] = useState(null)
  const [username, setUsername] = useState(null)
  const [loading, setLoading] = useState(true)
  const [recovering, setRecovering] = useState(false)

  useEffect(() => {
    try {
      localStorage.removeItem(LEGACY_SESSION_KEY)
    } catch {
      /* sin acceso a localStorage: nada que limpiar */
    }
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setLoading(false)
    })
    const { data: sub } = supabase.auth.onAuthStateChange((event, next) => {
      setSession(next)
      if (event === 'PASSWORD_RECOVERY') setRecovering(true)
      if (event === 'SIGNED_OUT') {
        setUsername(null)
        setRecovering(false)
        queryClient.clear()
      }
    })
    return () => sub.subscription.unsubscribe()
  }, [queryClient])

  const userId = session?.user?.id
  useEffect(() => {
    if (!userId) return
    let cancelled = false
    supabase
      .from('profiles')
      .select('username')
      .eq('id', userId)
      .maybeSingle()
      .then(({ data }) => {
        if (!cancelled && data) setUsername(data.username)
      })
    return () => {
      cancelled = true
    }
  }, [userId])

  const signOut = useCallback(async () => {
    localStorage.removeItem(ACTIVE_GROUP_KEY)
    await authSignOut()
  }, [])

  const user = useMemo(
    () =>
      session?.user
        ? {
            id: session.user.id,
            email: session.user.email,
            username: username ?? session.user.user_metadata?.username ?? '',
          }
        : null,
    [session, username]
  )

  const value = useMemo(
    () => ({
      user,
      loading,
      recovering,
      finishRecovery: () => setRecovering(false),
      usernameChanged: setUsername,
      signOut,
    }),
    [user, loading, recovering, signOut]
  )
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth debe usarse dentro de <AuthProvider>')
  return ctx
}
