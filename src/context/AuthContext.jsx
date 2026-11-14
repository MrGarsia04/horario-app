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
  const [profile, setProfile] = useState(null) // null = sin cargar, false = no existe
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
        setProfile(null)
        setRecovering(false)
        queryClient.clear()
      }
    })
    return () => sub.subscription.unsubscribe()
  }, [queryClient])

  // El perfil de la app (profiles.id) puede diferir del id de Auth en cuentas migradas.
  const authId = session?.user?.id
  useEffect(() => {
    if (!authId) {
      setProfile(null)
      return
    }
    let cancelled = false
    supabase
      .from('profiles')
      .select('id, username')
      .eq('auth_id', authId)
      .maybeSingle()
      .then(({ data }) => {
        if (!cancelled) setProfile(data ?? false)
      })
    return () => {
      cancelled = true
    }
  }, [authId])

  const signOut = useCallback(async () => {
    localStorage.removeItem(ACTIVE_GROUP_KEY)
    await authSignOut()
  }, [])

  const user = useMemo(
    () =>
      session?.user && profile
        ? { id: profile.id, authId: session.user.id, email: session.user.email, username: profile.username }
        : null,
    [session, profile]
  )
  // Con sesión pero sin perfil cargado todavía, seguimos "cargando".
  const stillLoading = loading || (Boolean(session?.user) && profile === null)

  const value = useMemo(
    () => ({
      user,
      loading: stillLoading,
      recovering,
      finishRecovery: () => setRecovering(false),
      usernameChanged: (username) => setProfile((p) => (p ? { ...p, username } : p)),
      signOut,
    }),
    [user, stillLoading, recovering, signOut]
  )
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth debe usarse dentro de <AuthProvider>')
  return ctx
}
