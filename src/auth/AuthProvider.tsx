import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import type { Provider, Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import type { Profile, Slot } from '../lib/types'

interface AuthState {
  /** false until the persisted session has been checked once */
  ready: boolean
  session: Session | null
  me: Profile | null
  friend: Profile | null
  /** Set when the profiles query failed or returned no row for this account — the app can't work without one. */
  profileError: string | null
  /** Fixed color slot per user — the earlier-created profile is u1 everywhere, for both viewers. */
  slotOf: (userId: string) => Slot
  signIn: (email: string, password: string) => Promise<string | null>
  signInWith: (provider: Provider) => Promise<string | null>
  signOut: () => Promise<void>
  /** Change your own avatar emoji; returns an error message or null. */
  setAvatar: (emoji: string) => Promise<string | null>
}

const AuthContext = createContext<AuthState | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false)
  const [session, setSession] = useState<Session | null>(null)
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [profileError, setProfileError] = useState<string | null>(null)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setReady(true)
      // The OAuth redirect lands on ?code=… (PKCE); once exchanged, drop it from the address bar.
      if (window.location.search.includes('code=')) {
        window.history.replaceState(null, '', window.location.pathname + window.location.hash)
      }
    })
    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next)
    })
    return () => sub.subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (!session) {
      setProfiles([])
      return
    }
    let cancelled = false
    supabase
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: true })
      .then(({ data, error }) => {
        if (cancelled) return
        const rows = (data ?? []) as Profile[]
        setProfiles(rows)
        if (error) setProfileError(`Couldn't load profiles: ${error.message}`)
        else if (!rows.some((p) => p.id === session.user.id)) setProfileError(`No profile row for ${session.user.email}`)
        else setProfileError(null)
      })
    return () => {
      cancelled = true
    }
  }, [session])

  const me = useMemo(
    () => profiles.find((p) => p.id === session?.user.id) ?? null,
    [profiles, session],
  )
  const friend = useMemo(
    () => profiles.find((p) => p.id !== session?.user.id) ?? null,
    [profiles, session],
  )
  const slotOf = useCallback(
    (userId: string): Slot => (profiles[0]?.id === userId ? 'u1' : 'u2'),
    [profiles],
  )

  const signIn = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    return error ? error.message : null
  }, [])

  const signInWith = useCallback(async (provider: Provider) => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: window.location.origin + import.meta.env.BASE_URL },
    })
    return error ? error.message : null
  }, [])

  const signOut = useCallback(async () => {
    await supabase.auth.signOut()
  }, [])

  const setAvatar = useCallback(
    async (emoji: string) => {
      const id = session?.user.id
      if (!id) return 'Not signed in'
      const previous = profiles
      setProfiles((ps) => ps.map((p) => (p.id === id ? { ...p, avatar_emoji: emoji } : p)))
      const { error } = await supabase.from('profiles').update({ avatar_emoji: emoji }).eq('id', id)
      if (error) {
        setProfiles(previous)
        return error.message
      }
      return null
    },
    [session, profiles],
  )

  const value = useMemo<AuthState>(
    () => ({ ready, session, me, friend, profileError, slotOf, signIn, signInWith, signOut, setAvatar }),
    [ready, session, me, friend, profileError, slotOf, signIn, signInWith, signOut, setAvatar],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}
