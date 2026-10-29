// src/app/api/admin/update-email/route.ts
// Management-only: update a user's auth email via service role

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createClient as createServerClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('roles')
      .eq('id', user.id)
      .single()

    const isManagement = (profile as { roles: string[] } | null)?.roles?.includes('management')
    if (!isManagement) {
      return NextResponse.json({ error: 'Forbidden — management only' }, { status: 403 })
    }

    const body = await request.json()
    const { userId, email } = body

    if (!userId || typeof userId !== 'string') {
      return NextResponse.json({ error: 'Missing userId' }, { status: 400 })
    }

    if (!email || typeof email !== 'string' || !email.includes('@')) {
      return NextResponse.json({ error: 'Invalid email address' }, { status: 400 })
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseUrl || !serviceRoleKey) {
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 })
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    // Update auth email (no confirmation email sent when using admin API)
    const { error: authError } = await adminClient.auth.admin.updateUserById(userId, {
      email: email.trim().toLowerCase(),
    })

    if (authError) {
      return NextResponse.json({ error: authError.message || 'Failed to update email' }, { status: 400 })
    }

    // Sync email column on profiles table — report failure so caller can retry
    const { error: profileError } = await adminClient
      .from('profiles')
      .update({ email: email.trim().toLowerCase() })
      .eq('id', userId)

    if (profileError) {
      return NextResponse.json({
        success: false,
        partialSuccess: true,
        warning: 'Auth email updated but profile email sync failed — retry required',
      }, { status: 207 })
    }

    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
