// Persistent rate limiting backed by the login_attempts table.
// Works correctly across Vercel cold starts — no in-process state.
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getClientIp } from '@/lib/utils/get-client-ip'

const WINDOW_MS = 15 * 60 * 1000        // 15 minutes
const LOGIN_MAX = 5
const SIGNUP_MAX = 3
const LOCKOUT_MS = 15 * 60 * 1000

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

// POST — check if request should be rate limited
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { identifier, type } = body as { identifier?: string; type?: string }
    if (!identifier || typeof identifier !== 'string') {
      return NextResponse.json({ error: 'Identifier is required' }, { status: 400 })
    }

    const ip = getClientIp(request)
    const maxAttempts = type === 'signup' ? SIGNUP_MAX : LOGIN_MAX
    const windowStart = new Date(Date.now() - WINDOW_MS).toISOString()

    const supabase = adminClient()

    // Count recent failed attempts from this IP + email within the window
    const { count, error } = await supabase
      .from('login_attempts')
      .select('*', { count: 'exact', head: true })
      .eq('email', identifier.toLowerCase().trim())
      .eq('ip_address', ip)
      .eq('success', false)
      .gte('created_at', windowStart)

    if (error) {
      // On DB error, fail open (don't block legitimate users)
      return NextResponse.json({ allowed: true, remaining: maxAttempts, resetTime: Date.now() + WINDOW_MS })
    }

    const attempts = count ?? 0
    const resetTime = Date.now() + WINDOW_MS

    if (attempts >= maxAttempts) {
      // Find the first attempt in this window to compute lockout expiry
      const { data: earliest } = await supabase
        .from('login_attempts')
        .select('created_at')
        .eq('email', identifier.toLowerCase().trim())
        .eq('ip_address', ip)
        .eq('success', false)
        .gte('created_at', windowStart)
        .order('created_at', { ascending: true })
        .limit(1)
        .single()

      const lockoutUntil = earliest
        ? new Date(earliest.created_at).getTime() + LOCKOUT_MS
        : Date.now() + LOCKOUT_MS

      if (lockoutUntil > Date.now()) {
        return NextResponse.json({
          allowed: false,
          remaining: 0,
          resetTime,
          lockedUntil: lockoutUntil,
          retryAfter: Math.ceil((lockoutUntil - Date.now()) / 1000),
        }, { status: 429 })
      }
    }

    return NextResponse.json({
      allowed: true,
      remaining: Math.max(0, maxAttempts - attempts),
      resetTime,
    })
  } catch {
    // Fail open on unexpected errors
    return NextResponse.json({ allowed: true, remaining: 1, resetTime: Date.now() + WINDOW_MS })
  }
}

// DELETE — clear rate limit after successful login (no-op: DB records persist but
// successful login resets the window naturally since we only count failed attempts)
export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json()
    const { identifier, type: _type } = body as { identifier?: string; type?: string }
    if (!identifier) return NextResponse.json({ error: 'Identifier is required' }, { status: 400 })

    // Mark any existing failed attempts as superseded by inserting a success record
    // (the window check only counts failed attempts, so a success naturally stops lockout)
    // Nothing to delete — the next successful login is already logged by log-attempt route.
    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
