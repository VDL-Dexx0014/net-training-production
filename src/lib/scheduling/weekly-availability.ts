// src/lib/scheduling/weekly-availability.ts
// Types and utilities for managing trainer weekly availability

export type DayOfWeek = 0 | 1 | 2 | 3 | 4 | 5 | 6 // 0 = Sunday, 6 = Saturday

export interface DayAvailability {
  dayOfWeek: DayOfWeek
  isAvailable: boolean
  startTime: string // HH:MM format (e.g., "09:00")
  endTime: string // HH:MM format (e.g., "17:00")
}

export interface WeeklyAvailability {
  [key: number]: DayAvailability // keyed by day of week (0-6)
}

export const DEFAULT_START_TIME = '09:00'
export const DEFAULT_END_TIME = '17:00'

export const DAYS_OF_WEEK = [
  { value: 0 as DayOfWeek, label: 'Sunday', shortLabel: 'Sun' },
  { value: 1 as DayOfWeek, label: 'Monday', shortLabel: 'Mon' },
  { value: 2 as DayOfWeek, label: 'Tuesday', shortLabel: 'Tue' },
  { value: 3 as DayOfWeek, label: 'Wednesday', shortLabel: 'Wed' },
  { value: 4 as DayOfWeek, label: 'Thursday', shortLabel: 'Thu' },
  { value: 5 as DayOfWeek, label: 'Friday', shortLabel: 'Fri' },
  { value: 6 as DayOfWeek, label: 'Saturday', shortLabel: 'Sat' },
]

/**
 * Create a default weekly availability (all days available, 9 AM - 5 PM)
 */
export function createDefaultWeeklyAvailability(): WeeklyAvailability {
  const availability: WeeklyAvailability = {}

  DAYS_OF_WEEK.forEach((day) => {
    availability[day.value] = {
      dayOfWeek: day.value,
      isAvailable: true,
      startTime: DEFAULT_START_TIME,
      endTime: DEFAULT_END_TIME,
    }
  })

  return availability
}

/**
 * Check if a trainer is available on a specific date based on weekly availability
 */
export function isAvailableOnDate(
  date: Date,
  weeklyAvailability: WeeklyAvailability
): { isAvailable: boolean; startTime?: string; endTime?: string } {
  const dayOfWeek = date.getDay() as DayOfWeek
  const dayAvailability = weeklyAvailability[dayOfWeek]

  if (!dayAvailability || !dayAvailability.isAvailable) {
    return { isAvailable: false }
  }

  return {
    isAvailable: true,
    startTime: dayAvailability.startTime,
    endTime: dayAvailability.endTime,
  }
}

/**
 * Parse time string (HH:MM) to hours and minutes
 */
export function parseTime(timeStr: string): { hours: number; minutes: number } {
  const [hours, minutes] = timeStr.split(':').map(Number)
  return { hours, minutes }
}

/**
 * Convert time string to Date object for a specific date
 */
export function timeToDate(date: Date, timeStr: string): Date {
  const { hours, minutes } = parseTime(timeStr)
  const result = new Date(date)
  result.setHours(hours, minutes, 0, 0)
  return result
}

/**
 * Format Date to time string (HH:MM)
 */
export function dateToTimeString(date: Date): string {
  const hours = date.getHours().toString().padStart(2, '0')
  const minutes = date.getMinutes().toString().padStart(2, '0')
  return `${hours}:${minutes}`
}

/**
 * Generate time options for select dropdowns (every 30 minutes)
 */
export function generateTimeOptions(startHour: number = 6, endHour: number = 23): string[] {
  const options: string[] = []

  for (let hour = startHour; hour <= endHour; hour++) {
    for (let minute = 0; minute < 60; minute += 30) {
      const timeStr = `${hour.toString().padStart(2, '0')}:${minute
        .toString()
        .padStart(2, '0')}`
      options.push(timeStr)
    }
  }

  return options
}
