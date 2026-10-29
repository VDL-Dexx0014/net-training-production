// src/app/api/trainer/schedule/route.ts
// Server-side schedule aggregation API
//
// This addresses Security Issue #7:
// - Moves massive data processing from client to server
// - Implements pagination and date range limits
// - Reduces data transfer and browser memory usage
// - Prevents browser freezes with large datasets
//
// See SECURITY_ACTION_PLAN.md Issue #7 for details

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const MAX_SESSIONS_PER_REQUEST = 500 // Hard limit for safety
const DEFAULT_DATE_RANGE_DAYS = 30 // Default to 30 days instead of 18+ months

/**
 * GET /api/trainer/schedule
 * Fetch and aggregate trainer schedule data
 *
 * Query parameters:
 * - start: ISO date string (default: today)
 * - end: ISO date string (default: today + 30 days)
 * - location_id: UUID (optional - filter by location)
 * - client_id: UUID (optional - filter by client)
 *
 * Returns:
 * - sessions: Array of sessions with client and location info
 * - count: Total number of sessions in range
 * - stats: Aggregated statistics
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()

    // Authenticate user
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Verify user is a trainer or management
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

    const userRole = (profile as any).role

    if (userRole !== 'trainer' && userRole !== 'management') {
      return NextResponse.json(
        { error: 'Forbidden: Only trainers and management can access schedules' },
        { status: 403 }
      )
    }

    // Parse query parameters
    const searchParams = request.nextUrl.searchParams
    const startParam = searchParams.get('start')
    const endParam = searchParams.get('end')
    const locationId = searchParams.get('location_id')
    const clientId = searchParams.get('client_id')

    // Set date range with defaults (30 days instead of 18+ months)
    const startDate = startParam
      ? new Date(startParam)
      : new Date()

    const endDate = endParam
      ? new Date(endParam)
      : new Date(Date.now() + DEFAULT_DATE_RANGE_DAYS * 24 * 60 * 60 * 1000)

    // Validate date range is reasonable (max 90 days)
    const daysDiff = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24))
    if (daysDiff > 90) {
      return NextResponse.json(
        { error: 'Date range too large. Maximum 90 days allowed.' },
        { status: 400 }
      )
    }

    // Build query
    let query = supabase
      .from('sessions')
      .select(`
        id,
        scheduled_start,
        scheduled_end,
        status,
        location_id,
        client_id,
        trainer_id,
        client:profiles!sessions_client_id_fkey (
          id,
          first_name,
          last_name,
          email
        ),
        location:locations (
          id,
          name,
          address
        )
      `, { count: 'exact' })

    // Filter by trainer (trainers see only their sessions, management sees all)
    if (userRole === 'trainer') {
      query = query.eq('trainer_id', user.id)
    }

    // Date range filter
    query = query
      .gte('scheduled_start', startDate.toISOString())
      .lte('scheduled_start', endDate.toISOString())

    // Optional filters
    if (locationId) {
      query = query.eq('location_id', locationId)
    }
    if (clientId) {
      query = query.eq('client_id', clientId)
    }

    // Execute query with limit
    const { data: sessions, error, count } = await query
      .order('scheduled_start', { ascending: true })
      .limit(MAX_SESSIONS_PER_REQUEST)

    if (error) {
      console.error('Schedule fetch error:', error)
      return NextResponse.json(
        { error: 'Failed to fetch schedule' },
        { status: 500 }
      )
    }

    // Calculate statistics server-side
    const stats = calculateScheduleStats(sessions || [])

    // Group sessions by date for easier client-side rendering
    const sessionsByDate = groupSessionsByDate(sessions || [])

    return NextResponse.json({
      sessions: sessions || [],
      count: count || 0,
      stats,
      sessionsByDate,
      dateRange: {
        start: startDate.toISOString(),
        end: endDate.toISOString(),
      },
    })
  } catch (error) {
    console.error('Schedule API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * Calculate schedule statistics
 */
function calculateScheduleStats(sessions: any[]) {
  const now = new Date()

  const completed = sessions.filter(s => s.status === 'completed').length
  const scheduled = sessions.filter(s => {
    return s.status === 'scheduled' && new Date(s.scheduled_start) > now
  }).length
  const cancelled = sessions.filter(s => s.status === 'cancelled').length

  // Get unique clients
  const uniqueClients = new Set(sessions.map(s => s.client_id)).size

  // Get unique locations
  const uniqueLocations = new Set(sessions.map(s => s.location_id)).size

  return {
    total: sessions.length,
    completed,
    scheduled,
    cancelled,
    uniqueClients,
    uniqueLocations,
  }
}

/**
 * Group sessions by date (YYYY-MM-DD)
 */
function groupSessionsByDate(sessions: any[]) {
  const grouped: Record<string, any[]> = {}

  sessions.forEach(session => {
    const date = new Date(session.scheduled_start).toISOString().split('T')[0]

    if (!grouped[date]) {
      grouped[date] = []
    }

    grouped[date].push(session)
  })

  return grouped
}
