// Records login attempts (success and failure) server-side so we capture the
// real IP address and persist across Vercel function instances.
// Uses service role so it always writes regardless of auth state.

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getClientIp } from '@/lib/utils/get-client-ip'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { email, success, failureReason } = body

    if (!email || typeof email !== 'string' || typeof success !== 'boolean') {
      return NextResponse.json({ error: 'Invalid payload' }, { status: 400 })
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!supabaseUrl || !serviceRoleKey) {
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 })
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false },
    })

    const { error } = await adminClient.from('login_attempts').insert({
      email: email.toLowerCase().trim(),
      ip_address: getClientIp(request),
      user_agent: request.headers.get('user-agent') ?? null,
      success,
      failure_reason: failureReason ?? null,
    })

    if (error) {
      // Don't expose DB errors — fail silently so login UX is unaffected
      console.error('log-attempt insert error:', error.message)
    }

    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
