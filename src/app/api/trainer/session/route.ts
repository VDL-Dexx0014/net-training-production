// src/app/api/trainer/session/route.ts
// Server-side session creation — uses service role to bypass RLS on sessions table.
// Called from AddSessionDialog (management users can't insert sessions directly via RLS).

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createClient as createServerClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  try {
    const serverSupabase = await createServerClient()
    const { data: { user } } = await serverSupabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: profile } = await serverSupabase.from('profiles').select('roles, role').eq('id', user.id).single()
    const roles: string[] = (profile as any)?.roles ?? []
    const role: string = (profile as any)?.role ?? ''
    const allowed = roles.includes('management') || roles.includes('trainer') || role === 'management' || role === 'trainer'
    if (!allowed) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const body = await request.json()
    const { session, machineRows } = body as {
      session: Record<string, unknown>
      machineRows: Record<string, unknown>[]
    }

    const adminSupabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    const { data: sessionData, error: sessionError } = await adminSupabase
      .from('sessions')
      .insert(session)
      .select('id')
      .single()

    if (sessionError || !sessionData) {
      return NextResponse.json({ error: sessionError?.message || 'Failed to create session' }, { status: 500 })
    }

    const sessionId = (sessionData as any).id

    if (machineRows.length > 0) {
      const rows = machineRows.map(r => ({ ...r, session_id: sessionId }))
      const { error: msError } = await adminSupabase.from('machine_sessions').insert(rows)
      if (msError) {
        return NextResponse.json({ error: 'Session created but machine data failed: ' + msError.message }, { status: 500 })
      }
    }

    return NextResponse.json({ sessionId })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Unexpected error' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const serverSupabase = await createServerClient()
    const { data: { user } } = await serverSupabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: profile } = await serverSupabase.from('profiles').select('roles, role').eq('id', user.id).single()
    const roles: string[] = (profile as any)?.roles ?? []
    const role: string = (profile as any)?.role ?? ''
    const allowed = roles.includes('management') || roles.includes('trainer') || role === 'management' || role === 'trainer'
    if (!allowed) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const { sessionId } = await request.json() as { sessionId: string }
    if (!sessionId) return NextResponse.json({ error: 'sessionId required' }, { status: 400 })

    const adminSupabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    await adminSupabase.from('machine_sessions').delete().eq('session_id', sessionId)
    const { error } = await adminSupabase.from('sessions').delete().eq('id', sessionId)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ ok: true })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Unexpected error' }, { status: 500 })
  }
}
