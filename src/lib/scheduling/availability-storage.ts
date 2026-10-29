// src/lib/scheduling/availability-storage.ts
// Functions to load and save weekly availability to Supabase

import { SupabaseClient } from '@supabase/supabase-js'
import { Database } from '@/types/database.types'
import {
  WeeklyAvailability,
  createDefaultWeeklyAvailability,
  DayOfWeek,
} from './weekly-availability'

type TrainerAvailability = Database['public']['Tables']['trainer_availability']['Row']

/**
 * Load weekly availability from trainer_availability table
 * Returns default availability if none found
 */
export async function loadWeeklyAvailability(
  supabase: SupabaseClient,
  trainerId: string,
  locationId?: string
): Promise<WeeklyAvailability> {
  try {
    // Fetch recurring availability records for this trainer (and optionally location)
    let query = supabase
      .from('trainer_availability')
      .select('*')
      .eq('trainer_id', trainerId)
      .eq('is_recurring', true)

    // If locationId is provided, filter by location
    if (locationId) {
      query = query.eq('location_id', locationId)
    }

    const { data, error } = await query

    if (error) {
      console.error('Error loading weekly availability:', error)
      return createDefaultWeeklyAvailability()
    }

    if (!data || data.length === 0) {
      return createDefaultWeeklyAvailability()
    }

    // Convert database records to WeeklyAvailability format
    const weeklyAvailability = createDefaultWeeklyAvailability()

    // Mark all days as unavailable by default
    Object.keys(weeklyAvailability).forEach((key) => {
      weeklyAvailability[parseInt(key)].isAvailable = false
    })

    // Update with saved availability
    data.forEach((record) => {
      // Extract day of week from the recurrence pattern
      const pattern = record.recurrence_pattern as any
      if (pattern && pattern.dayOfWeek !== undefined) {
        const dayOfWeek = pattern.dayOfWeek as DayOfWeek

        // Extract time directly from UTC ISO string to avoid timezone conversion
        // Format: "2024-01-01T09:00:00.000Z" → "09:00"
        const startTime = record.start_time.substring(11, 16)
        const endTime = record.end_time.substring(11, 16)

        weeklyAvailability[dayOfWeek] = {
          dayOfWeek,
          isAvailable: true,
          startTime,
          endTime,
        }
      }
    })

    return weeklyAvailability
  } catch (error) {
    console.error('Error in loadWeeklyAvailability:', error)
    return createDefaultWeeklyAvailability()
  }
}

/**
 * Save weekly availability to trainer_availability table
 */
export async function saveWeeklyAvailability(
  supabase: SupabaseClient,
  trainerId: string,
  locationId: string,
  weeklyAvailability: WeeklyAvailability
): Promise<void> {
  try {
    // Delete existing recurring availability for this trainer/location
    const { error: deleteError } = await supabase
      .from('trainer_availability')
      .delete()
      .eq('trainer_id', trainerId)
      .eq('location_id', locationId)
      .eq('is_recurring', true)

    if (deleteError) {
      console.error('Error deleting old availability:', deleteError)
      throw deleteError
    }

    // Create new availability records for each available day
    const records = Object.values(weeklyAvailability)
      .filter((day) => day.isAvailable)
      .map((day) => {
        // Create a base date in UTC (any date will do, we only care about time)
        const [startHour, startMinute] = day.startTime.split(':').map(Number)
        const [endHour, endMinute] = day.endTime.split(':').map(Number)

        // Use consistent UTC format
        const startDateTime = `2024-01-01T${String(startHour).padStart(2, '0')}:${String(startMinute).padStart(2, '0')}:00.000Z`
        const endDateTime = `2024-01-01T${String(endHour).padStart(2, '0')}:${String(endMinute).padStart(2, '0')}:00.000Z`

        return {
          trainer_id: trainerId,
          location_id: locationId,
          start_time: startDateTime,
          end_time: endDateTime,
          is_recurring: true,
          recurrence_pattern: {
            dayOfWeek: day.dayOfWeek,
            type: 'weekly',
          },
        }
      })

    if (records.length > 0) {
      const { error: insertError } = await supabase
        .from('trainer_availability')
        .insert(records)

      if (insertError) {
        console.error('Error inserting new availability:', insertError)
        throw insertError
      }
    }
  } catch (error) {
    console.error('Error in saveWeeklyAvailability:', error)
    throw error
  }
}
