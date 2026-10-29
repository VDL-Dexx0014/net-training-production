// src/app/dashboard/page.tsx
// Redirects to role-specific dashboard

'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuthStore } from '@/store/auth-store'

export default function DashboardRedirect() {
  const router = useRouter()
  const { profile, loading } = useAuthStore()
  const [redirected, setRedirected] = useState(false)

  useEffect(() => {
    if (loading || redirected) return

    if (!profile) {
      router.push('/login')
      setRedirected(true)
      return
    }

    // Resolve role from either the roles array or the singular role field
    const roles: string[] = Array.isArray(profile.roles) && profile.roles.length > 0
      ? profile.roles
      : profile.role ? [profile.role] : []

    let destination = '/login'
    if (roles.includes('management')) destination = '/management/dashboard'
    else if (roles.includes('trainer')) destination = '/trainer/dashboard'
    else if (roles.includes('client')) destination = '/client/dashboard'

    setRedirected(true)
    window.location.href = destination
  }, [profile, loading, redirected, router])

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <div className="text-center">
        <div className="text-lg mb-2">Redirecting to your dashboard...</div>
        {profile && <div className="text-sm text-slate-600">Role: {(profile.roles ?? [profile.role]).join(', ')}</div>}
      </div>
    </div>
  )
}
