// Service-role update for client profile fields editable by trainers.
// RLS only allows management to update profiles directly, so trainers go through here.
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createClient as createServerClient } from '@/lib/supabase/server'

const ALLOWED_FIELDS = new Set([
  'first_name', 'last_name', 'phone', 'high_risk', 'intensity', 'notes', 'email_opt_in',
])

export async function POST(request: NextRequest) {
  try {
    const serverSupabase = await createServerClient()
    const { data: { user } } = await serverSupabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: callerProfile } = await serverSupabase
      .from('profiles').select('roles, role').eq('id', user.id).single()
    const callerRoles: string[] = (callerProfile as { roles?: string[]; role?: string } | null)?.roles ?? []
    const callerRole: string = (callerProfile as { roles?: string[]; role?: string } | null)?.role ?? ''
    const allowed = callerRoles.includes('management') || callerRoles.includes('trainer')
      || callerRole === 'management' || callerRole === 'trainer'
    if (!allowed) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const body = await request.json() as { clientId?: string; fields?: Record<string, unknown> }
    const { clientId, fields } = body
    if (!clientId || typeof clientId !== 'string' || !fields || typeof fields !== 'object') {
      return NextResponse.json({ error: 'Missing clientId or fields' }, { status: 400 })
    }

    // Build allowlisted payload — never spread untrusted fields directly
    const safeFields: Record<string, unknown> = {}
    for (const key of Object.keys(fields)) {
      if (ALLOWED_FIELDS.has(key)) safeFields[key] = fields[key]
    }
    if (Object.keys(safeFields).length === 0) {
      return NextResponse.json({ error: 'No valid fields provided' }, { status: 400 })
    }

    const adminSupabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    )

    // Verify the target is a client profile before updating
    const { data: targetProfile } = await adminSupabase
      .from('profiles').select('roles, role').eq('id', clientId).single()
    const targetRoles: string[] = (targetProfile as { roles?: string[]; role?: string } | null)?.roles ?? []
    const targetRole: string = (targetProfile as { roles?: string[]; role?: string } | null)?.role ?? ''
    const isClient = targetRoles.includes('client') || targetRole === 'client'
    if (!isClient) {
      return NextResponse.json({ error: 'Target profile is not a client' }, { status: 403 })
    }

    const { error } = await adminSupabase
      .from('profiles')
      .update({ ...safeFields, updated_at: new Date().toISOString() })
      .eq('id', clientId)

    if (error) return NextResponse.json({ error: 'Failed to update profile' }, { status: 500 })

    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
