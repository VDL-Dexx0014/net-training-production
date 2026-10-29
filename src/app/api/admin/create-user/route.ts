// src/app/api/admin/create-user/route.ts
// Server-side API to create users without affecting the current session
// Uses service role key to create users via Supabase Admin API

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createClient as createServerClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  try {
    // Verify the requesting user is management
    const supabase = await createServerClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if user is management or trainer
    const { data: profile } = await supabase
      .from('profiles')
      .select('roles')
      .eq('id', user.id)
      .single()

    const userRoles = (profile as { roles: string[] } | null)?.roles
    const isManagement = userRoles?.includes('management')
    const isTrainer = userRoles?.includes('trainer')

    if (!isManagement && !isTrainer) {
      return NextResponse.json({ error: 'Forbidden - management or trainer only' }, { status: 403 })
    }

    // Parse request body
    const body = await request.json()
    const { email, firstName, lastName, phone, role, locationIds, preferredLocationId, intensity, highRisk, notes, emailOptIn, password } = body

    // Validate required fields exist and are strings
    if (!email || typeof email !== 'string' ||
        !firstName || typeof firstName !== 'string' ||
        !lastName || typeof lastName !== 'string' ||
        !role || typeof role !== 'string') {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      return NextResponse.json({ error: 'Invalid email format' }, { status: 400 })
    }

    // Validate field lengths to prevent abuse
    if (firstName.length > 100 || lastName.length > 100 || email.length > 255) {
      return NextResponse.json({ error: 'Field length exceeded' }, { status: 400 })
    }

    // Validate phone if provided
    if (phone && typeof phone !== 'string') {
      return NextResponse.json({ error: 'Invalid phone format' }, { status: 400 })
    }

    // Validate notes length if provided
    if (notes && (typeof notes !== 'string' || notes.length > 5000)) {
      return NextResponse.json({ error: 'Notes too long' }, { status: 400 })
    }

    // Validate locationIds if provided
    if (locationIds && (!Array.isArray(locationIds) || !locationIds.every((id: unknown) => typeof id === 'string'))) {
      return NextResponse.json({ error: 'Invalid location IDs' }, { status: 400 })
    }

    if (!['client', 'trainer', 'management'].includes(role)) {
      return NextResponse.json({ error: 'Invalid role' }, { status: 400 })
    }

    // Trainers can only create clients
    if (isTrainer && !isManagement && role !== 'client') {
      return NextResponse.json({ error: 'Trainers can only create client accounts' }, { status: 403 })
    }

    // Duplicate check: email already exists
    const { data: existingEmailProfile } = await supabase
      .from('profiles')
      .select('id, email')
      .eq('email', email.toLowerCase().trim())
      .limit(1)

    if (existingEmailProfile && existingEmailProfile.length > 0) {
      return NextResponse.json({ error: 'An account with this email already exists' }, { status: 409 })
    }

    // Duplicate check: phone number (if provided)
    if (phone && phone.trim()) {
      const normalizedPhone = phone.replace(/\D/g, '')
      if (normalizedPhone.length >= 10) {
        // Use last-10-digit suffix for the targeted query — handles with/without country code
        const phoneSuffix = normalizedPhone.slice(-10)
        const { data: existingPhoneProfile } = await supabase
          .from('profiles')
          .select('id')
          .like('phone', `%${phoneSuffix}`)
          .limit(1)

        if (existingPhoneProfile && existingPhoneProfile.length > 0) {
          return NextResponse.json({ error: 'An account with this phone number already exists' }, { status: 409 })
        }
      }
    }

    // Create admin client with service role
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseUrl || !serviceRoleKey) {
      // Don't expose configuration details
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 })
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
      db: {
        schema: 'public',
      },
      global: {
        headers: {
          'x-supabase-role': 'service_role',
        },
      },
    })

    // Validate provided password length
    if (password !== undefined && (typeof password !== 'string' || password.length < 8)) {
      return NextResponse.json({ error: 'Password must be at least 8 characters' }, { status: 400 })
    }

    // Use provided password or generate a throwaway one (user must reset via forgot password)
    const effectivePassword = (password && typeof password === 'string' && password.length >= 8)
      ? password
      : `Temp${Date.now()}!${Math.random().toString(36).slice(2, 8)}`

    // Create user with admin API
    const { data: newUser, error: createError } = await adminClient.auth.admin.createUser({
      email,
      password: effectivePassword,
      email_confirm: true,
      user_metadata: {
        first_name: firstName,
        last_name: lastName,
        role,
      },
    })

    if (createError) {
      if (createError.message.includes('already been registered')) {
        return NextResponse.json({ error: 'An account with this email already exists' }, { status: 409 })
      }
      // Don't expose internal error details
      return NextResponse.json({ error: 'Failed to create account' }, { status: 400 })
    }

    if (!newUser.user) {
      return NextResponse.json({ error: 'Failed to create user' }, { status: 500 })
    }

    const newUserId = newUser.user.id

    // Explicitly create profile (trigger may not fire for admin-created users)
    const { error: profileError } = await adminClient
      .from('profiles')
      .upsert({
        id: newUserId,
        email,
        first_name: firstName,
        last_name: lastName,
        phone: phone || null,
        role,
        roles: [role],
        is_active: true,
        high_risk: highRisk || false,
        intensity: intensity || null,
        notes: notes || null,
        email_opt_in: emailOptIn === true,
      }, { onConflict: 'id' })

    if (profileError) {
      // Delete the auth user since profile creation failed
      await adminClient.auth.admin.deleteUser(newUserId)
      // Don't expose internal error details
      return NextResponse.json({ error: 'Failed to create user profile' }, { status: 500 })
    }

    // For trainers, assign locations
    if (role === 'trainer' && locationIds && locationIds.length > 0) {
      const locationInserts = locationIds.map((locationId: string) => ({
        trainer_id: newUserId,
        location_id: locationId,
      }))

      const { error: locationError } = await adminClient
        .from('trainer_locations')
        .insert(locationInserts)

      if (locationError) {
        // Don't fail - user was created, location assignment is secondary
      }
    }

    // For clients, set preferred location
    if (role === 'client' && preferredLocationId && typeof preferredLocationId === 'string') {
      const { error: prefLocError } = await adminClient
        .from('profiles')
        .update({ preferred_location_id: preferredLocationId })
        .eq('id', newUserId)

      if (prefLocError) {
        // Don't fail - user was created, location is secondary
      }
    }

    return NextResponse.json({
      success: true,
      userId: newUserId,
      message: `${role.charAt(0).toUpperCase() + role.slice(1)} account created successfully`,
    })
  } catch {
    // Don't log or expose error details
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
