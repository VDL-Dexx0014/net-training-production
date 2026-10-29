'use client'

import { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useAuthStore } from '@/store/auth-store'
import { signOut } from '@/lib/auth/auth-helpers'
import { Button } from '@/components/ui/button'

const IDLE_MS = 5 * 60 * 1000        // 5 minutes
const WARN_MS = 30 * 1000            // warn 30 s before logout
export const RETURN_URL_KEY = 'net_return_url'

const ACTIVITY_EVENTS = ['mousemove', 'keydown', 'touchstart', 'pointerdown', 'scroll'] as const

interface IdleTimeoutContextValue {
  resetIdle: () => void
  suppressIdle: (active: boolean) => void
}

const IdleTimeoutContext = createContext<IdleTimeoutContextValue>({
  resetIdle: () => {},
  suppressIdle: () => {},
})

export function useIdleTimeout() {
  return useContext(IdleTimeoutContext)
}

export function IdleTimeoutProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuthStore()
  const router = useRouter()
  const idleTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const warnTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [countdown, setCountdown] = useState<number | null>(null)
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null)
  // When true, idle timers are suspended (e.g. stopwatch/countdown running)
  const suppressedRef = useRef(false)

  const clearTimers = useCallback(() => {
    if (idleTimer.current) clearTimeout(idleTimer.current)
    if (warnTimer.current) clearTimeout(warnTimer.current)
    if (countdownRef.current) clearInterval(countdownRef.current)
    idleTimer.current = null
    warnTimer.current = null
    countdownRef.current = null
    setCountdown(null)
  }, [])

  const doLogout = useCallback(async () => {
    clearTimers()
    // Save current URL so login can redirect back — only for session pages
    if (typeof window !== 'undefined') {
      const url = window.location.pathname + window.location.search
      if (url.startsWith('/trainer/session/')) {
        sessionStorage.setItem(RETURN_URL_KEY, url)
      }
    }
    await signOut()
    window.location.href = '/login'
  }, [clearTimers])

  const startCountdown = useCallback(() => {
    setCountdown(30)
    countdownRef.current = setInterval(() => {
      setCountdown(prev => {
        if (prev === null || prev <= 1) {
          if (countdownRef.current) clearInterval(countdownRef.current)
          return null
        }
        return prev - 1
      })
    }, 1000)
  }, [])

  const resetIdle = useCallback(() => {
    // If warning is showing, dismiss it and restart
    clearTimers()
    if (!user) return
    if (suppressedRef.current) return

    warnTimer.current = setTimeout(() => {
      startCountdown()
      idleTimer.current = setTimeout(() => {
        doLogout()
      }, WARN_MS)
    }, IDLE_MS - WARN_MS)
  }, [user, clearTimers, startCountdown, doLogout])

  const suppressIdle = useCallback((active: boolean) => {
    suppressedRef.current = active
    if (active) {
      // Clear any pending timers while a timer is running
      clearTimers()
    } else {
      // Resume idle tracking when timer stops
      resetIdle()
    }
  }, [clearTimers, resetIdle])

  // Attach/detach activity listeners when user changes
  useEffect(() => {
    if (!user) {
      clearTimers()
      return
    }

    resetIdle()

    const handler = () => resetIdle()
    ACTIVITY_EVENTS.forEach(e => window.addEventListener(e, handler, { passive: true }))

    return () => {
      clearTimers()
      ACTIVITY_EVENTS.forEach(e => window.removeEventListener(e, handler))
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id])  // only re-run when the logged-in user changes

  return (
    <IdleTimeoutContext.Provider value={{ resetIdle, suppressIdle }}>
      {children}

      {/* Warning overlay */}
      {countdown !== null && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-xl shadow-2xl px-8 py-7 flex flex-col items-center gap-4 max-w-sm w-full mx-4">
            <div className="text-4xl font-bold tabular-nums text-slate-800">{countdown}</div>
            <p className="text-base font-semibold text-slate-700 text-center">
              Session will time out due to inactivity
            </p>
            <p className="text-sm text-slate-500 text-center">
              Tap anywhere or press a key to stay logged in.
            </p>
            <Button className="w-full" onClick={resetIdle}>
              Stay Logged In
            </Button>
          </div>
        </div>
      )}
    </IdleTimeoutContext.Provider>
  )
}
