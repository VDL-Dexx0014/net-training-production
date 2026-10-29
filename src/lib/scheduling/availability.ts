// src/lib/scheduling/availability.ts
// Utilities for calculating trainer availability and managing scheduling

import { Database } from '@/types/database.types'
import { WeeklyAvailability, isAvailableOnDate, parseTime } from './weekly-availability'

type Session = Database['public']['Tables']['sessions']['Row']
type TrainerLocation = Database['public']['Tables']['trainer_locations']['Row']
type Location = Database['public']['Tables']['locations']['Row']

export interface TimeSlot {
  start: Date
  end: Date
  isAvailable: boolean
  existingSessionId?: string
}

export interface DaySchedule {
  date: Date
  location: Location
  slots: TimeSlot[]
}

export interface TrainerSchedule {
  trainerId: string
  schedules: DaySchedule[]
}

export interface SpecificDateAvailability {
  date: string // YYYY-MM-DD
  locationId: string
  startTime: string // HH:MM from ISO string
  endTime: string // HH:MM from ISO string
}

/**
 * Check if two time ranges overlap
 */
export function doTimesOverlap(
  start1: Date,
  end1: Date,
  start2: Date,
  end2: Date
): boolean {
  return start1 < end2 && start2 < end1
}

/**
 * Check if a trainer has any overlapping sessions at any location
 * This ensures a trainer can't be double-booked across different locations
 */
export function hasOverlappingSession(
  proposedStart: Date,
  proposedEnd: Date,
  existingSessions: Session[],
  excludeSessionId?: string
): { hasOverlap: boolean; conflictingSession?: Session } {
  const conflict = existingSessions.find((session) => {
    // Skip if it's the same session (for updates)
    if (excludeSessionId && session.id === excludeSessionId) {
      return false
    }

    // Only check non-cancelled sessions
    if (session.status === 'cancelled') {
      return false
    }

    const sessionStart = new Date(session.scheduled_start)
    const sessionEnd = new Date(session.scheduled_end)

    return doTimesOverlap(proposedStart, proposedEnd, sessionStart, sessionEnd)
  })

  return {
    hasOverlap: !!conflict,
    conflictingSession: conflict,
  }
}

/**
 * Generate 30-minute time slots for a given date range
 */
export function generateTimeSlots(
  startDate: Date,
  endDate: Date,
  intervalMinutes: number = 30
): Date[] {
  const slots: Date[] = []
  const current = new Date(startDate)

  while (current < endDate) {
    slots.push(new Date(current))
    current.setMinutes(current.getMinutes() + intervalMinutes)
  }

  return slots
}

/**
 * Get available time slots for a specific day and location
 *
 * Priority order:
 * 1. Specific date availability (from 3-week calendar) - highest priority
 * 2. Weekly availability template (recurring schedule)
 * 3. Default hours (6am-10pm)
 */
export function getAvailableSlots(
  date: Date,
  location: Location,
  sessions: Session[],
  intervalMinutes: number = 30,
  weeklyAvailability?: WeeklyAvailability,
  defaultStartHour: number = 6, // 6 AM
  defaultEndHour: number = 22, // 10 PM
  specificDateAvailability?: SpecificDateAvailability[]
): TimeSlot[] {
  // Use local date string to avoid timezone conversion issues
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  const dateString = `${year}-${month}-${day}` // YYYY-MM-DD in local timezone

  // Check if trainer is available on this day based on weekly availability
  let startHour = defaultStartHour
  let endHour = defaultEndHour
  let hasAvailability = false

  // PRIORITY 1: Check for specific date availability (overrides weekly template)
  if (specificDateAvailability) {
    const specificAvail = specificDateAvailability.find(
      a => a.date === dateString && a.locationId === location.id
    )

    if (specificAvail) {
      // Has specific availability for this date - use it
      const start = parseTime(specificAvail.startTime)
      const end = parseTime(specificAvail.endTime)
      startHour = start.hours
      endHour = end.hours
      hasAvailability = true
    }
  }

  // PRIORITY 2: If no specific date availability, check weekly template
  if (!hasAvailability && weeklyAvailability) {
    const dayAvailability = isAvailableOnDate(date, weeklyAvailability)

    // If not available on this day per weekly template, return empty array
    if (!dayAvailability.isAvailable) {
      return []
    }

    // Use custom hours if set in weekly template
    if (dayAvailability.startTime && dayAvailability.endTime) {
      const start = parseTime(dayAvailability.startTime)
      const end = parseTime(dayAvailability.endTime)
      startHour = start.hours
      endHour = end.hours
    }
    hasAvailability = true
  }

  // If neither specific nor weekly availability exists, return empty
  if (!hasAvailability && weeklyAvailability) {
    return []
  }

  // Create start and end times for the day
  const dayStart = new Date(date)
  dayStart.setHours(startHour, 0, 0, 0)

  const dayEnd = new Date(date)
  dayEnd.setHours(endHour, 0, 0, 0)

  // Generate all possible time slots
  const slotStarts = generateTimeSlots(dayStart, dayEnd, intervalMinutes)

  // Map each slot to check if it's available
  const timeSlots: TimeSlot[] = slotStarts.map((slotStart) => {
    const slotEnd = new Date(slotStart)
    slotEnd.setMinutes(slotEnd.getMinutes() + intervalMinutes)

    // Check if this slot overlaps with any existing session
    const conflict = sessions.find((session) => {
      if (session.status === 'cancelled') return false

      const sessionStart = new Date(session.scheduled_start)
      const sessionEnd = new Date(session.scheduled_end)

      return doTimesOverlap(slotStart, slotEnd, sessionStart, sessionEnd)
    })

    return {
      start: slotStart,
      end: slotEnd,
      isAvailable: !conflict,
      existingSessionId: conflict?.id,
    }
  })

  return timeSlots
}

/**
 * Get the schedule for a trainer across all their locations for a date range
 */
export function getTrainerSchedule(
  trainerId: string,
  startDate: Date,
  endDate: Date,
  locations: (Location & { sessions: Session[] })[],
  intervalMinutes: number = 30
): DaySchedule[] {
  const schedules: DaySchedule[] = []

  // For each day in the range
  const currentDate = new Date(startDate)
  currentDate.setHours(0, 0, 0, 0)

  while (currentDate <= endDate) {
    // For each location
    locations.forEach((location) => {
      const slots = getAvailableSlots(
        new Date(currentDate),
        location,
        location.sessions,
        intervalMinutes
      )

      schedules.push({
        date: new Date(currentDate),
        location,
        slots,
      })
    })

    // Move to next day
    currentDate.setDate(currentDate.getDate() + 1)
  }

  return schedules
}

/**
 * Find the next available slot for a trainer at a specific location
 */
export function findNextAvailableSlot(
  location: Location,
  sessions: Session[],
  durationMinutes: number = 30,
  startSearchFrom: Date = new Date(),
  maxDaysAhead: number = 30
): TimeSlot | null {
  const searchEnd = new Date(startSearchFrom)
  searchEnd.setDate(searchEnd.getDate() + maxDaysAhead)

  let currentDate = new Date(startSearchFrom)
  currentDate.setHours(6, 0, 0, 0) // Start searching from 6 AM

  while (currentDate < searchEnd) {
    const slots = getAvailableSlots(currentDate, location, sessions, durationMinutes)

    // Find first available slot
    const availableSlot = slots.find((slot) => slot.isAvailable)
    if (availableSlot) {
      return availableSlot
    }

    // Move to next day
    currentDate.setDate(currentDate.getDate() + 1)
    currentDate.setHours(6, 0, 0, 0)
  }

  return null
}

/**
 * Get summary statistics for a trainer's schedule
 */
export function getScheduleStats(sessions: Session[], date: Date) {
  const today = new Date(date)
  today.setHours(0, 0, 0, 0)

  const tomorrow = new Date(today)
  tomorrow.setDate(tomorrow.getDate() + 1)

  const weekEnd = new Date(today)
  weekEnd.setDate(weekEnd.getDate() + 7)

  const sessionsToday = sessions.filter((session) => {
    const sessionDate = new Date(session.scheduled_start)
    return sessionDate >= today && sessionDate < tomorrow && session.status !== 'cancelled'
  })

  const sessionsThisWeek = sessions.filter((session) => {
    const sessionDate = new Date(session.scheduled_start)
    return sessionDate >= today && sessionDate < weekEnd && session.status !== 'cancelled'
  })

  return {
    sessionsToday: sessionsToday.length,
    sessionsThisWeek: sessionsThisWeek.length,
  }
}
