// src/components/providers/auth-provider.tsx
'use client'

import { useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuthStore } from '@/store/auth-store'

const PROFILE_FETCH_TIMEOUT_MS = 5000

async function fetchProfileWithTimeout(supabase: ReturnType<typeof createClient>, userId: string) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), PROFILE_FETCH_TIMEOUT_MS)
  try {
    const { data } = await supabase
      .from('profiles')
      .select('id, role, roles, first_name, last_name, is_active')
      .eq('id', userId)
      .abortSignal(controller.signal)
      .single()
    return data
  } catch {
    return null
  } finally {
    clearTimeout(timer)
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { setUser, setProfile, setLoading } = useAuthStore()
  const authSeqRef = useRef<number>(0)

  useEffect(() => {
    let mounted = true
    const supabase = createClient()

    const initAuth = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        const user = session?.user ?? null
        if (!mounted) return

        if (user) {
          const profile = await fetchProfileWithTimeout(supabase, user.id)
          if (mounted) {
            setUser(user)
            setProfile(profile)
          }
        } else {
          setUser(null)
          setProfile(null)
        }
      } catch {
        // Auth init failed — setLoading(false) in finally unblocks the UI
      } finally {
        if (mounted) setLoading(false)
      }
    }

    let subscription: { unsubscribe: () => void } | undefined

    initAuth().then(() => {
      const { data } = supabase.auth.onAuthStateChange(async (event, session) => {
        if (!mounted) return

        // SIGNED_OUT: clear immediately — don't wait for an async profile fetch
        if (event === 'SIGNED_OUT') {
          setUser(null)
          setProfile(null)
          return
        }

        // TOKEN_REFRESHED: user identity unchanged, skip profile re-fetch to
        // avoid a network call that can stall when the project has been idle.
        if (event === 'TOKEN_REFRESHED' && session?.user) {
          setUser(session.user)
          return
        }

        if (session?.user) {
          const seq = Date.now()
          const profile = await fetchProfileWithTimeout(supabase, session.user.id)
          // Discard result if a newer event has already updated state
          if (mounted && seq > (authSeqRef.current ?? 0)) {
            authSeqRef.current = seq
            setUser(session.user)
            setProfile(profile)
          }
        } else {
          setUser(null)
          setProfile(null)
        }
      })
      subscription = data.subscription
    })

    return () => {
      mounted = false
      subscription?.unsubscribe()
    }
  }, [setUser, setProfile, setLoading])

  return <>{children}</>
}
