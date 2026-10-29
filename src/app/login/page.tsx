// src/app/login/page.tsx
'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { checkRateLimit, resetRateLimit } from '@/lib/rate-limit-server'
import { clearAllUserStorage, useAuthStore } from '@/store/auth-store'
import { RETURN_URL_KEY } from '@/components/providers/idle-timeout-provider'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { toast } from 'sonner'
import { Header } from '@/components/layout/Header'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)

  // Destroy any session left by the previous trainer on this shared tablet.
  // Runs once on mount — before the new trainer types anything.
  // clearAllUserStorage wipes Supabase token keys immediately so getSession()
  // in AuthProvider cannot race ahead and restore the old session.
  useEffect(() => {
    clearAllUserStorage()
    useAuthStore.getState().clearAuth()
    const supabase = createClient()
    supabase.auth.signOut().catch(() => {})
    // Wipe any stale return URL from a previous session — only a fresh
    // idle-timeout in this tab should set it (via sessionStorage).
    localStorage.removeItem(RETURN_URL_KEY)
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    // Check rate limit (server-side)
    const rateLimitResult = await checkRateLimit(email, 'login')

    if (!rateLimitResult.allowed) {
      const minutesUntilReset = rateLimitResult.retryAfter
        ? Math.ceil(rateLimitResult.retryAfter / 60)
        : 15
      toast.error(`Too many login attempts. Please try again in ${minutesUntilReset} minute(s).`)
      void fetch('/api/auth/log-attempt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, success: false, failureReason: 'rate_limited' }),
      })
      setLoading(false)
      return
    }

    try {
      const supabase = createClient()

      // Add timeout to detect hanging requests
      const loginPromise = supabase.auth.signInWithPassword({
        email,
        password,
      })

      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Login request timed out after 10 seconds')), 10000)
      )

      const { data, error } = await Promise.race([loginPromise, timeoutPromise]) as {
        data: { user: { id: string } | null }
        error: Error | null
      }

      if (error) {
        // Generic error message to prevent email enumeration
        toast.error('Invalid email or password')
        void fetch('/api/auth/log-attempt', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, success: false, failureReason: 'invalid_credentials' }),
        })
        setLoading(false)
        return
      }

      // Successful login - reset rate limit
      await resetRateLimit(email, 'login')
      void fetch('/api/auth/log-attempt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, success: true }),
      })

      if (data.user) {
        // Fetch user profile to determine role
        const { data: profileData } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', data.user.id)
          .single()

        const role = (profileData as { role?: string } | null)?.role || 'client'

        // Check if we need to return to a previous screen (idle timeout re-login)
        const returnUrl = sessionStorage.getItem(RETURN_URL_KEY)
        // Always consume — sessionStorage is tab-scoped so this is already
        // limited, but explicit removal keeps behaviour predictable.
        sessionStorage.removeItem(RETURN_URL_KEY)

        // Clear any state left by the previous user on this shared tablet
        clearAllUserStorage()

        toast.success('Welcome back!')

        // Small delay to ensure toast is shown
        await new Promise(resolve => setTimeout(resolve, 300))

        // If an idle-timeout return URL exists, go back there; else role dashboard
        if (returnUrl) {
          window.location.href = returnUrl
        } else {
          const dashboardUrl = role === 'trainer' ? '/trainer/dashboard'
                             : role === 'management' ? '/management/dashboard'
                             : '/client/dashboard'
          window.location.href = dashboardUrl
        }
      }
    } catch {
      toast.error('An error occurred during login')
      void fetch('/api/auth/log-attempt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, success: false, failureReason: 'timeout' }),
      })
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <Header />
      <div className="flex items-center justify-center px-4 py-6">
        <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl font-bold">Welcome to NET</CardTitle>
          <CardDescription>Sign in to your account to continue</CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="instructor@net.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={loading}
                autoComplete="off"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={loading}
                autoComplete="new-password"
              />
            </div>
          </CardContent>
          <CardFooter className="flex flex-col space-y-6 pt-5">
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? 'Signing in...' : 'Sign In'}
            </Button>
            <div className="text-sm text-center">
              <Link href="/forgot-password" className="text-primary hover:underline block">
                Forgot password?
              </Link>
            </div>
          </CardFooter>
        </form>
      </Card>
      </div>
    </div>
  )
}