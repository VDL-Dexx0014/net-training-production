// src/lib/auth/auth-helpers.ts
// Authentication helper functions

import { createClient } from '@/lib/supabase/client'
import { Database } from '@/types/database.types'

type UserRole = Database['public']['Enums']['user_role']

export interface SignUpData {
  email: string
  password: string
  firstName: string
  lastName: string
  role: UserRole
  phone?: string
  address?: string
  city?: string
  province?: string
  postalCode?: string
}

export interface LoginData {
  email: string
  password: string
}

/**
 * Sign up a new user
 */
export async function signUp(data: SignUpData) {
  const supabase = createClient()

  // 1. Create auth user with metadata
  const { data: authData, error: authError } = await supabase.auth.signUp({
    email: data.email,
    password: data.password,
    options: {
      data: {
        first_name: data.firstName,
        last_name: data.lastName,
        role: data.role,
        phone: data.phone,
        address: data.address,
        city: data.city,
        province: data.province,
        postal_code: data.postalCode,
      },
    },
  })

  if (authError) {
    return { data: null, error: authError }
  }

  if (!authData.user) {
    return { data: null, error: new Error('User creation failed') }
  }

  // Profile will be created automatically by the database trigger
  // Poll for profile creation with timeout
  const maxAttempts = 10
  const delayMs = 200
  let profile = null

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    await new Promise(resolve => setTimeout(resolve, delayMs))

    const { data: profileData, error: profileError } = await supabase
      .from('profiles')
      .select('id')
      .eq('id', authData.user.id)
      .single()

    if (profileData) {
      profile = profileData
      break
    }

    // If we get an error other than "not found", break
    if (profileError && !profileError.message.includes('No rows')) {
      console.error('Profile creation check error:', profileError)
      break
    }
  }

  if (!profile) {
    console.warn('Profile may not have been created yet, but continuing...')
  }

  return { data: authData, error: null }
}

/**
 * Sign in existing user
 */
export async function signIn(data: LoginData) {
  const supabase = createClient()

  const { data: authData, error } = await supabase.auth.signInWithPassword({
    email: data.email,
    password: data.password,
  })

  if (error) {
    return { data: null, error }
  }

  return { data: authData, error: null }
}

/**
 * Sign out current user.
 * Clears local session immediately, then attempts server-side revocation
 * with a 3-second timeout so a stale/paused project never blocks the UI.
 */
export async function signOut() {
  const supabase = createClient()
  // signOut({ scope: 'local' }) clears the local token without a server round-trip,
  // so it's instant even when the Supabase project is paused or the network is slow.
  // The global scope revocation is fire-and-forget with a timeout.
  try {
    const { error } = await supabase.auth.signOut({ scope: 'local' })
    // Best-effort global revocation — don't wait more than 3 s
    Promise.race([
      supabase.auth.signOut({ scope: 'global' }),
      new Promise<void>(resolve => setTimeout(resolve, 3000)),
    ]).catch(() => {})
    return { error }
  } catch (e: any) {
    return { error: e }
  }
}

/**
 * Get current user session
 */
export async function getCurrentUser() {
  const supabase = createClient()

  const { data: { user }, error: userError } = await supabase.auth.getUser()

  if (userError || !user) {
    return { user: null, profile: null, error: userError }
  }

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  if (profileError) {
    return { user, profile: null, error: profileError }
  }

  return { user, profile, error: null }
}

/**
 * Reset password
 */
export async function resetPassword(email: string) {
  const supabase = createClient()
  
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${window.location.origin}/reset-password`,
  })

  return { error }
}

/**
 * Update password
 */
export async function updatePassword(newPassword: string) {
  const supabase = createClient()
  
  const { error } = await supabase.auth.updateUser({
    password: newPassword,
  })

  return { error }
}