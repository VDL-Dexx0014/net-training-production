// src/app/api/trainers/route.ts
// API endpoint for searching and browsing trainers

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

interface TrainerLocation {
  trainer_id: string
}

interface TrainerProfile {
  id: string
  first_name: string
  last_name: string
  email: string
}

interface FavoriteTrainer {
  trainer_id: string
}

interface AvailabilityRecord {
  trainer_id: string
  start_time: string
  end_time: string
}

interface SessionRecord {
  trainer_id: string
  scheduled_start: string
  scheduled_end: string
}

/**
 * GET /api/trainers
 * Search/browse trainers with filters
 *
 * Query params:
 * - locationId: Filter by location (required)
 * - date: Filter by availability date (YYYY-MM-DD) (optional)
 * - favoritesOnly: Show only favorited trainers (optional)
 *
 * Returns array of trainer profiles with availability status
 */
export async function GET(request: NextRequest) {
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

    // Get user profile to verify they're a client
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('role, roles')
      .eq('id', user.id)
      .single()

    if (profileError || !profile) {
      return NextResponse.json(
        { error: 'Profile not found' },
        { status: 404 }
      )
    }

    const profileData = profile as { role?: string; roles?: string[] }
    const isClient = profileData.role === 'client' ||
                     (profileData.roles && profileData.roles.includes('client'))

    if (!isClient) {
      return NextResponse.json(
        { error: 'Forbidden: Only clients can browse trainers' },
        { status: 403 }
      )
    }

    // Parse query parameters
    const searchParams = request.nextUrl.searchParams
    const locationId = searchParams.get('locationId')
    const date = searchParams.get('date') // YYYY-MM-DD format
    const favoritesOnly = searchParams.get('favoritesOnly') === 'true'

    if (!locationId) {
      return NextResponse.json(
        { error: 'Location ID is required' },
        { status: 400 }
      )
    }

    // Verify location exists
    const { data: location, error: locationError } = await supabase
      .from('locations')
      .select('id, name')
      .eq('id', locationId)
      .eq('is_active', true)
      .single()

    if (locationError || !location) {
      return NextResponse.json(
        { error: 'Location not found' },
        { status: 404 }
      )
    }

    // Get trainers who work at this location
    // First get all trainer-location relationships
    const { data: trainerLocations, error: trainerLocError } = await supabase
      .from('trainer_locations')
      .select('trainer_id')
      .eq('location_id', locationId)

    if (trainerLocError) {
      return NextResponse.json(
        { error: 'Failed to fetch trainers' },
        { status: 500 }
      )
    }

    const trainerIds = ((trainerLocations || []) as TrainerLocation[]).map((tl) => tl.trainer_id)

    if (trainerIds.length === 0) {
      return NextResponse.json({
        trainers: [],
        count: 0,
        location: (location as { name: string }).name
      })
    }

    // Get trainer profiles
    const trainersQuery = supabase
      .from('profiles')
      .select('id, first_name, last_name, email')
      .in('id', trainerIds)
      .eq('is_active', true)

    const { data: trainers, error: trainersError } = await trainersQuery

    if (trainersError) {
      return NextResponse.json(
        { error: 'Failed to fetch trainers' },
        { status: 500 }
      )
    }

    let filteredTrainers = (trainers || []) as TrainerProfile[]

    // Apply favorites filter if requested
    if (favoritesOnly) {
      const { data: favorites } = await supabase
        .from('favorite_trainers')
        .select('trainer_id')
        .eq('client_id', user.id)

      const favoriteIds = ((favorites || []) as FavoriteTrainer[]).map((f) => f.trainer_id)
      filteredTrainers = filteredTrainers.filter((t) => favoriteIds.includes(t.id))
    }

    // Get favorite status for all trainers
    const { data: allFavorites } = await supabase
      .from('favorite_trainers')
      .select('trainer_id')
      .eq('client_id', user.id)

    const favoriteTrainerIds = new Set(
      ((allFavorites || []) as FavoriteTrainer[]).map((f) => f.trainer_id)
    )

    // Apply date filter if provided (check availability)
    if (date) {
      try {
        const availableTrainerIds = await getAvailableTrainerIds(
          supabase,
          locationId,
          date,
          filteredTrainers.map((t) => t.id)
        )
        filteredTrainers = filteredTrainers.filter((t) => availableTrainerIds.includes(t.id))
      } catch {
        // Continue without date filter if there's an error
      }
    }

    // Add favorite status and format response
    const trainersWithStatus = filteredTrainers.map((trainer) => ({
      id: trainer.id,
      firstName: trainer.first_name,
      lastName: trainer.last_name,
      email: trainer.email,
      isFavorite: favoriteTrainerIds.has(trainer.id)
    }))

    return NextResponse.json({
      trainers: trainersWithStatus,
      count: trainersWithStatus.length,
      location: (location as { name: string }).name
    })
  } catch {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * Helper function to get trainer IDs who have availability on a specific date
 */
async function getAvailableTrainerIds(
  supabase: Awaited<ReturnType<typeof createClient>>,
  locationId: string,
  date: string,
  trainerIds: string[]
): Promise<string[]> {
  const startOfDay = new Date(date + 'T00:00:00')
  const endOfDay = new Date(date + 'T23:59:59.999')

  // Get all availability records for these trainers on this date
  const { data: availabilityData, error: availError } = await supabase
    .from('trainer_availability')
    .select('trainer_id, start_time, end_time')
    .eq('location_id', locationId)
    .in('trainer_id', trainerIds)
    .eq('is_recurring', false)
    .gte('start_time', startOfDay.toISOString())
    .lte('start_time', endOfDay.toISOString())

  if (availError) {
    return []
  }

  // Get booked sessions for these trainers on this date
  const { data: sessionsData } = await supabase
    .from('sessions')
    .select('trainer_id, scheduled_start, scheduled_end')
    .in('trainer_id', trainerIds)
    .gte('scheduled_start', startOfDay.toISOString())
    .lt('scheduled_start', endOfDay.toISOString())
    .neq('status', 'cancelled')

  // Build a map of trainer availability (subtract booked sessions)
  const trainerAvailableSlots: Record<string, Set<string>> = {}

  // Add available slots
  const availRecords = (availabilityData || []) as AvailabilityRecord[]
  for (const avail of availRecords) {
    const trainerId = avail.trainer_id
    if (!trainerAvailableSlots[trainerId]) {
      trainerAvailableSlots[trainerId] = new Set()
    }

    // Generate 30-minute slots for this availability period
    const start = new Date(avail.start_time)
    const end = new Date(avail.end_time)

    let currentSlot = new Date(start)
    while (currentSlot < end) {
      const slotKey = currentSlot.toISOString()
      trainerAvailableSlots[trainerId].add(slotKey)
      currentSlot = new Date(currentSlot.getTime() + 30 * 60 * 1000)
    }
  }

  // Remove booked slots
  const sessionRecords = (sessionsData || []) as SessionRecord[]
  for (const session of sessionRecords) {
    const trainerId = session.trainer_id
    if (!trainerAvailableSlots[trainerId]) continue

    const start = new Date(session.scheduled_start)
    const end = new Date(session.scheduled_end)

    let currentSlot = new Date(start)
    while (currentSlot < end) {
      const slotKey = currentSlot.toISOString()
      trainerAvailableSlots[trainerId].delete(slotKey)
      currentSlot = new Date(currentSlot.getTime() + 30 * 60 * 1000)
    }
  }

  // Return trainer IDs who have at least one available slot
  return Object.entries(trainerAvailableSlots)
    .filter(([, slots]) => slots.size > 0)
    .map(([trainerId]) => trainerId)
}
