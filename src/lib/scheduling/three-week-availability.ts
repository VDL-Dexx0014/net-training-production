// src/lib/scheduling/three-week-availability.ts
// Utilities for managing 3-week trainer availability

import { createClient } from '@/lib/supabase/client'
import { WeeklyAvailability } from './weekly-availability'

export interface TimeSlot {
  startTime: string // HH:MM format
  endTime: string // HH:MM format
  isAvailable: boolean
  isBooked?: boolean // Session is booked by a client
  sessionId?: string // ID of the booked session
  clientName?: string // Name of the client who booked
  locationName?: string // Name of the location where session is booked
}

export interface DayAvailability {
  date: string // YYYY-MM-DD
  locationId: string
  timeSlots: TimeSlot[]
  notes?: string
}

export interface ThreeWeekDate {
  date: Date
  dateString: string // YYYY-MM-DD
  dayOfWeek: number // 0-6
  dayName: string
  isToday: boolean
  isPast: boolean
}

/**
 * Generate array of dates for the next 3 weeks (21 days)
 */
export function generateThreeWeekDates(): ThreeWeekDate[] {
  const dates: ThreeWeekDate[] = []
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

  for (let i = 0; i < 21; i++) {
    const date = new Date(today)
    date.setDate(today.getDate() + i)

    // Use local date string to avoid timezone conversion issues
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    const dateString = `${year}-${month}-${day}`
    const dayOfWeek = date.getDay()

    dates.push({
      date,
      dateString,
      dayOfWeek,
      dayName: dayNames[dayOfWeek],
      isToday: i === 0,
      isPast: false // All future dates in 3-week view
    })
  }

  return dates
}

/**
 * Generate 30-minute time slot options from 6am to 10pm
 */
export function generateTimeSlotOptions(): string[] {
  const slots: string[] = []
  for (let hour = 6; hour <= 22; hour++) {
    for (let minute = 0; minute < 60; minute += 30) {
      const timeString = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`
      slots.push(timeString)

      // Don't add 22:30 and beyond
      if (hour === 22 && minute === 0) break
    }
  }
  return slots
}

/**
 * Create default time slots for a day (all unavailable)
 */
export function createDefaultTimeSlots(): TimeSlot[] {
  const slots = generateTimeSlotOptions()
  const timeSlots: TimeSlot[] = []

  for (let i = 0; i < slots.length - 1; i++) {
    timeSlots.push({
      startTime: slots[i],
      endTime: slots[i + 1],
      isAvailable: false
    })
  }

  return timeSlots
}

/**
 * Set all time slots to a specific availability status
 * Preserves booked slots and all their metadata
 */
export function setAllTimeSlotsAvailability(timeSlots: TimeSlot[], isAvailable: boolean): TimeSlot[] {
  return timeSlots.map(slot => {
    // Don't modify booked slots
    if (slot.isBooked) {
      return slot
    }
    return {
      ...slot,
      isAvailable
    }
  })
}

/**
 * Set time slots for business hours (9am-5pm)
 * Preserves booked slots and all their metadata
 */
export function setBusinessHoursAvailability(timeSlots: TimeSlot[]): TimeSlot[] {
  return timeSlots.map(slot => {
    // Don't modify booked slots
    if (slot.isBooked) {
      return slot
    }
    const hour = parseInt(slot.startTime.split(':')[0])
    const isAvailable = hour >= 9 && hour < 17
    return {
      ...slot,
      isAvailable
    }
  })
}

/**
 * Set time slots for full day (6am-10pm)
 * Preserves booked slots and all their metadata
 */
export function setFullDayAvailability(timeSlots: TimeSlot[]): TimeSlot[] {
  return timeSlots.map(slot => {
    // Don't modify booked slots
    if (slot.isBooked) {
      return slot
    }
    return {
      ...slot,
      isAvailable: true
    }
  })
}

/**
 * Set time slots based on a time range
 * Preserves booked slots and all their metadata
 */
export function setTimeRangeAvailability(
  timeSlots: TimeSlot[],
  startTime: string,
  endTime: string,
  isAvailable: boolean
): TimeSlot[] {
  return timeSlots.map(slot => {
    // Don't modify booked slots
    if (slot.isBooked) {
      return slot
    }
    const slotStart = slot.startTime
    const shouldUpdate = slotStart >= startTime && slotStart < endTime
    return {
      ...slot,
      isAvailable: shouldUpdate ? isAvailable : slot.isAvailable
    }
  })
}

/**
 * Load availability for a specific date and location
 * Now includes checking for booked sessions across ALL locations
 */
export async function loadDayAvailability(
  trainerId: string,
  locationId: string,
  date: string
): Promise<DayAvailability> {
  const supabase = createClient()

  // Query trainer_availability table for this date
  // IMPORTANT: Parse date carefully to avoid timezone issues
  // Use ISO format to ensure consistent timezone handling
  const startOfDay = `${date}T00:00:00.000Z`
  const endOfDay = `${date}T23:59:59.999Z`

  const { data, error } = await supabase
    .from('trainer_availability')
    .select('*')
    .eq('trainer_id', trainerId)
    .eq('location_id', locationId)
    .eq('is_recurring', false)
    .gte('start_time', startOfDay)
    .lte('start_time', endOfDay)
    .order('start_time')

  if (error) {
    console.error('Error loading day availability:', error)
    return {
      date,
      locationId,
      timeSlots: createDefaultTimeSlots(),
      notes: undefined
    }
  }

  // Query booked sessions for this trainer on this date (across ALL locations)
  const { data: sessionsData, error: sessionsError } = await supabase
    .from('sessions')
    .select(`
      id,
      scheduled_start,
      scheduled_end,
      location_id,
      profiles!sessions_client_id_fkey (
        first_name,
        last_name
      ),
      locations (
        name
      )
    `)
    .eq('trainer_id', trainerId)
    .gte('scheduled_start', startOfDay)
    .lt('scheduled_start', endOfDay)
    .neq('status', 'cancelled')
    .order('scheduled_start')

  if (sessionsError) {
    console.error('Error loading sessions:', sessionsError)
  }

  // DEBUG: Log sessions for this date to help identify ghost bookings
  if (sessionsData && sessionsData.length > 0) {
    console.log(`[loadDayAvailability] Date: ${date}, Found ${sessionsData.length} session(s):`)
    sessionsData.forEach((session: any) => {
      const clientProfile = session.profiles as any
      const locationData = session.locations as any
      console.log(`  - ${clientProfile?.first_name} ${clientProfile?.last_name} at ${locationData?.name || 'Unknown'}`)
      console.log(`    Start: ${session.scheduled_start}, End: ${session.scheduled_end}`)
      console.log(`    Session ID: ${session.id}`)
    })
  }

  // Convert database records to time slots
  const timeSlots = createDefaultTimeSlots()

  if (data && data.length > 0) {
    // Mark slots as available based on database records
    data.forEach((record: any) => {
      // Extract time from ISO string directly to avoid timezone conversion
      // Format: "2025-12-05T09:00:00.000Z" → "09:00"
      const startTimeStr = record.start_time.substring(11, 16) // Gets "HH:MM"
      const endTimeStr = record.end_time.substring(11, 16) // Gets "HH:MM"

      timeSlots.forEach(slot => {
        if (slot.startTime >= startTimeStr && slot.startTime < endTimeStr) {
          slot.isAvailable = true
        }
      })
    })
  }

  // Mark slots as booked if there are sessions (checking across ALL locations)
  if (sessionsData && sessionsData.length > 0) {
    sessionsData.forEach((session: any) => {
      // Extract time from ISO string directly to avoid timezone conversion
      // Format: "2025-12-05T09:00:00.000Z" → "09:00"
      const sessionStartStr = session.scheduled_start.substring(11, 16) // Gets "HH:MM"
      const sessionEndStr = session.scheduled_end.substring(11, 16) // Gets "HH:MM"

      const clientProfile = session.profiles as any
      const clientName = clientProfile
        ? `${clientProfile.first_name} ${clientProfile.last_name}`
        : 'Unknown Client'

      const locationData = session.locations as any
      const locationName = locationData?.name

      timeSlots.forEach(slot => {
        // Check if this slot overlaps with the session
        if (slot.startTime >= sessionStartStr && slot.startTime < sessionEndStr) {
          slot.isAvailable = false // Booked slots are not available
          slot.isBooked = true
          slot.sessionId = session.id
          slot.clientName = clientName
          slot.locationName = locationName
        }
      })
    })
  }

  return {
    date,
    locationId,
    timeSlots,
    notes: data && data.length > 0 ? (data as any)[0].notes || undefined : undefined
  }
}

/**
 * Save availability for a specific day
 */
export async function saveDayAvailability(
  trainerId: string,
  dayAvailability: DayAvailability
): Promise<{ success: boolean; error?: string }> {
  const supabase = createClient()

  try {
    // Delete existing availability for this date
    // Use consistent ISO format to match how we query
    const startOfDay = `${dayAvailability.date}T00:00:00.000Z`
    const endOfDay = `${dayAvailability.date}T23:59:59.999Z`

    const { error: deleteError } = await supabase
      .from('trainer_availability')
      .delete()
      .eq('trainer_id', trainerId)
      .eq('location_id', dayAvailability.locationId)
      .eq('is_recurring', false)
      .gte('start_time', startOfDay)
      .lte('start_time', endOfDay)

    if (deleteError) throw deleteError

    // Group consecutive available slots
    const availableRanges: { startTime: string; endTime: string }[] = []
    let currentRange: { startTime: string; endTime: string } | null = null

    dayAvailability.timeSlots.forEach((slot, index) => {
      if (slot.isAvailable) {
        if (!currentRange) {
          currentRange = { startTime: slot.startTime, endTime: slot.endTime }
        } else {
          currentRange.endTime = slot.endTime
        }
      } else {
        if (currentRange) {
          availableRanges.push(currentRange)
          currentRange = null
        }
      }
    })

    // Don't forget the last range
    if (currentRange) {
      availableRanges.push(currentRange)
    }

    // Insert new availability records
    if (availableRanges.length > 0) {
      const records = availableRanges.map(range => {
        // Create UTC datetime strings directly to avoid timezone issues
        const [startHour, startMinute] = range.startTime.split(':').map(Number)
        const [endHour, endMinute] = range.endTime.split(':').map(Number)

        const startDateTime = `${dayAvailability.date}T${String(startHour).padStart(2, '0')}:${String(startMinute).padStart(2, '0')}:00.000Z`
        const endDateTime = `${dayAvailability.date}T${String(endHour).padStart(2, '0')}:${String(endMinute).padStart(2, '0')}:00.000Z`

        return {
          trainer_id: trainerId,
          location_id: dayAvailability.locationId,
          start_time: startDateTime,
          end_time: endDateTime,
          is_recurring: false,
          notes: dayAvailability.notes || null
        }
      })

      const { error: insertError } = await supabase
        .from('trainer_availability')
        .insert(records as any)

      if (insertError) throw insertError
    }

    return { success: true }
  } catch (error) {
    console.error('Error saving day availability:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to save availability'
    }
  }
}

/**
 * Check if there are any sessions scheduled for a specific time range
 */
export async function checkSessionConflicts(
  trainerId: string,
  date: string,
  timeSlots: TimeSlot[]
): Promise<{ hasConflicts: boolean; conflictingSessions: any[] }> {
  const supabase = createClient()

  // Find the earliest and latest times we're checking
  const blockedSlots = timeSlots.filter(slot => !slot.isAvailable)
  if (blockedSlots.length === 0) {
    return { hasConflicts: false, conflictingSessions: [] }
  }

  const earliestTime = blockedSlots[0].startTime
  const latestTime = blockedSlots[blockedSlots.length - 1].endTime

  // Create UTC datetime strings directly
  const [startHour, startMinute] = earliestTime.split(':').map(Number)
  const [endHour, endMinute] = latestTime.split(':').map(Number)

  const startDateTime = `${date}T${String(startHour).padStart(2, '0')}:${String(startMinute).padStart(2, '0')}:00.000Z`
  const endDateTime = `${date}T${String(endHour).padStart(2, '0')}:${String(endMinute).padStart(2, '0')}:00.000Z`

  // Query for overlapping sessions
  const { data, error } = await supabase
    .from('sessions')
    .select('*')
    .eq('trainer_id', trainerId)
    .gte('scheduled_start', startDateTime)
    .lte('scheduled_end', endDateTime)
    .in('status', ['scheduled', 'completed'])

  if (error) {
    console.error('Error checking session conflicts:', error)
    return { hasConflicts: false, conflictingSessions: [] }
  }

  return {
    hasConflicts: data && data.length > 0,
    conflictingSessions: data || []
  }
}

/**
 * Check for cross-location conflicts (trainer can't be in two places at once)
 */
export async function checkCrossLocationConflicts(
  trainerId: string,
  locationId: string,
  date: string,
  timeSlots: TimeSlot[]
): Promise<{ hasConflicts: boolean; conflictingAvailability: any[] }> {
  const supabase = createClient()

  // Find available slots
  const availableSlots = timeSlots.filter(slot => slot.isAvailable)
  if (availableSlots.length === 0) {
    return { hasConflicts: false, conflictingAvailability: [] }
  }

  const earliestTime = availableSlots[0].startTime
  const latestTime = availableSlots[availableSlots.length - 1].endTime

  // Create UTC datetime strings directly
  const [startHour, startMinute] = earliestTime.split(':').map(Number)
  const [endHour, endMinute] = latestTime.split(':').map(Number)

  const startDateTime = `${date}T${String(startHour).padStart(2, '0')}:${String(startMinute).padStart(2, '0')}:00.000Z`
  const endDateTime = `${date}T${String(endHour).padStart(2, '0')}:${String(endMinute).padStart(2, '0')}:00.000Z`

  // Query for overlapping availability at OTHER locations
  const { data, error } = await supabase
    .from('trainer_availability')
    .select('*')
    .eq('trainer_id', trainerId)
    .neq('location_id', locationId)
    .gte('start_time', startDateTime)
    .lte('end_time', endDateTime)

  if (error) {
    console.error('Error checking cross-location conflicts:', error)
    return { hasConflicts: false, conflictingAvailability: [] }
  }

  return {
    hasConflicts: data && data.length > 0,
    conflictingAvailability: data || []
  }
}

/**
 * Copy availability from one day to multiple other days
 */
export async function copyDayAvailability(
  trainerId: string,
  sourceDate: string,
  targetDates: string[],
  locationId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    // Load source day availability
    const sourceAvailability = await loadDayAvailability(trainerId, locationId, sourceDate)

    // Save to each target date
    for (const targetDate of targetDates) {
      const result = await saveDayAvailability(trainerId, {
        ...sourceAvailability,
        date: targetDate
      })

      if (!result.success) {
        return result
      }
    }

    return { success: true }
  } catch (error) {
    console.error('Error copying day availability:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to copy availability'
    }
  }
}

/**
 * Apply weekly availability template to the next 3 weeks
 */
export async function applyWeeklyTemplateToThreeWeeks(
  trainerId: string,
  locationId: string,
  weeklyAvailability: WeeklyAvailability,
  overrideExisting: boolean = false
): Promise<{ success: boolean; daysApplied: number; daysSkipped: number; error?: string }> {
  try {
    const supabase = createClient()
    const threeWeekDates = generateThreeWeekDates()

    let daysApplied = 0
    let daysSkipped = 0

    for (const threeWeekDate of threeWeekDates) {
      const { date, dateString, dayOfWeek, isPast } = threeWeekDate

      // Skip past dates
      if (isPast) {
        daysSkipped++
        continue
      }

      // Get the weekly template for this day of week
      const dayTemplate = weeklyAvailability[dayOfWeek]

      if (!dayTemplate) {
        daysSkipped++
        continue
      }

      // Check if custom availability already exists for this day (non-recurring entries)
      if (!overrideExisting) {
        const { data: existingData } = await supabase
          .from('trainer_availability')
          .select('id')
          .eq('trainer_id', trainerId)
          .eq('location_id', locationId)
          .eq('is_recurring', false)
          .gte('start_time', `${dateString}T00:00:00.000Z`)
          .lt('start_time', `${dateString}T23:59:59.999Z`)
          .limit(1)

        if (existingData && existingData.length > 0) {
          // Custom availability exists, skip this day
          daysSkipped++
          continue
        }
      }

      // Convert weekly template to time slots
      const timeSlots = createDefaultTimeSlots()

      if (dayTemplate.isAvailable) {
        // Mark slots as available based on the template's start and end time
        const templateStart = dayTemplate.startTime
        const templateEnd = dayTemplate.endTime

        timeSlots.forEach(slot => {
          if (slot.startTime >= templateStart && slot.startTime < templateEnd) {
            slot.isAvailable = true
          }
        })
      }
      // If not available, all slots remain false (default)

      // Save the availability for this day
      const result = await saveDayAvailability(trainerId, {
        date: dateString,
        locationId,
        timeSlots,
        notes: `Applied from weekly template`
      })

      if (result.success) {
        daysApplied++
      } else {
        console.error(`Failed to apply template for ${dateString}:`, result.error)
      }
    }

    return {
      success: true,
      daysApplied,
      daysSkipped
    }
  } catch (error) {
    console.error('Error applying weekly template:', error)
    return {
      success: false,
      daysApplied: 0,
      daysSkipped: 0,
      error: error instanceof Error ? error.message : 'Failed to apply template'
    }
  }
}
