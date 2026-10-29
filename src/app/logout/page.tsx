// src/app/logout/page.tsx
'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useAuthStore } from '@/store/auth-store'

export default function LogoutPage() {
  const router = useRouter()
  const { clearAuth } = useAuthStore()

  useEffect(() => {
    // Clear local state and navigate immediately — don't block on network
    clearAuth()
    router.push('/login')
    // Best-effort server-side revocation in background
    const supabase = createClient()
    supabase.auth.signOut({ scope: 'local' }).catch(() => {})
  }, [router, clearAuth])

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-lg">Signing out...</div>
    </div>
  )
}
