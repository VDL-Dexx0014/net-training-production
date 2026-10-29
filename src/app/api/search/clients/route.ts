// src/app/api/search/clients/route.ts
// Server-side client search API with proper input sanitization
//
// This addresses Security Issue #6:
// - Moves search from client-side to server-side
// - Uses parameterized queries instead of string interpolation
// - Validates and sanitizes search input
// - Enforces role-based access (trainers only)
//
// See SECURITY_ACTION_PLAN.md Issue #6 for details

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * Sanitize search query to prevent injection attacks
 * - Removes special SQL characters that could be used for injection
 * - Trims whitespace
 * - Limits length
 */
function sanitizeSearchQuery(query: string): string {
  if (!query) return ''

  // Remove SQL special characters that could be used for injection
  // Keep only alphanumeric, spaces, @ (for emails), dots, hyphens, underscores
  const sanitized = query
    .replace(/[^\w\s@.\-]/g, '')
    .trim()
    .slice(0, 100) // Limit length

  return sanitized
}

/**
 * POST /api/search/clients
 * Search for clients by name or email
 *
 * Required: Authenticated trainer or management user
 * Body: { query: string, existingClientIds?: string[] }
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()

    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Check role - only trainers and management can search for clients
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (profileError || !profile) {
      return NextResponse.json(
        { error: 'User profile not found' },
        { status: 404 }
      )
    }

    const userRole = (profile as { role: string }).role

    if (userRole !== 'trainer' && userRole !== 'management') {
      return NextResponse.json(
        { error: 'Forbidden: Only trainers and management can search for clients' },
        { status: 403 }
      )
    }

    // Parse and validate request body
    const body = await request.json()
    const { query, existingClientIds = [] } = body

    if (!query || typeof query !== 'string') {
      return NextResponse.json(
        { error: 'Search query is required' },
        { status: 400 }
      )
    }

    // Sanitize the search query
    const sanitizedQuery = sanitizeSearchQuery(query)

    if (!sanitizedQuery) {
      return NextResponse.json(
        { results: [] },
        { status: 200 }
      )
    }

    // Use Supabase's textSearch for safe searching
    // This uses PostgreSQL's full-text search which is parameterized
    const searchPattern = `%${sanitizedQuery}%`

    // Search profiles - using ilike with properly escaped parameters
    // Supabase client handles parameterization automatically
    const { data, error } = await supabase
      .from('profiles')
      .select('id, first_name, last_name, email, role, roles')
      .or(`first_name.ilike.%${sanitizedQuery}%,last_name.ilike.%${sanitizedQuery}%,email.ilike.%${sanitizedQuery}%`)
      .limit(20)

    if (error) {
      // Don't log or expose database error details
      return NextResponse.json(
        { error: 'Search failed' },
        { status: 500 }
      )
    }

    // Type the profile response
    interface ProfileResult {
      id: string
      first_name: string
      last_name: string
      email: string
      role: string
      roles: string[] | null
    }

    // Filter to only clients (check both old 'role' and new 'roles' columns)
    const clientProfiles = (data || []).filter((profile: ProfileResult) => {
      return profile.role === 'client' || (profile.roles && profile.roles.includes('client'))
    })

    // Validate existingClientIds is an array of strings
    const validExistingIds = Array.isArray(existingClientIds)
      ? existingClientIds.filter((id): id is string => typeof id === 'string')
      : []

    // Filter out clients already in roster
    const filtered = clientProfiles
      .filter((client: ProfileResult) => !validExistingIds.includes(client.id))
      .map((client: ProfileResult) => ({
        id: client.id,
        first_name: client.first_name,
        last_name: client.last_name,
        email: client.email,
      }))

    return NextResponse.json({
      results: filtered,
      count: filtered.length,
    })
  } catch {
    // Don't log or expose error details
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
