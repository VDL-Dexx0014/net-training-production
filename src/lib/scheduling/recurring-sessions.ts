// src/lib/scheduling/recurring-sessions.ts
// Utilities for generating recurring session dates

import { addWeeks, addMonths, isBefore, isAfter, startOfDay } from 'date-fns'

export type RecurrenceFrequency = 'weekly' | 'biweekly' | 'monthly'

export interface RecurringSessionParams {
  startDate: Date
  endDate: Date
  durationMinutes: number
  frequency: RecurrenceFrequency
  recurrenceEndDate: Date
}

export interface GeneratedSessionDate {
  scheduledStart: Date
  scheduledEnd: Date
}

/**
 * Generate all recurring session dates based on frequency and end date
 */
export function generateRecurringDates(
  params: RecurringSessionParams
): GeneratedSessionDate[] {
  const { startDate, endDate, durationMinutes, frequency, recurrenceEndDate } = params
  const sessions: GeneratedSessionDate[] = []

  // Always include the first session
  sessions.push({
    scheduledStart: new Date(startDate),
    scheduledEnd: new Date(endDate),
  })

  let currentDate = new Date(startDate)

  // Generate subsequent sessions until we reach the recurrence end date
  while (true) {
    // Calculate next occurrence based on frequency
    switch (frequency) {
      case 'weekly':
        currentDate = addWeeks(currentDate, 1)
        break
      case 'biweekly':
        currentDate = addWeeks(currentDate, 2)
        break
      case 'monthly':
        currentDate = addMonths(currentDate, 1)
        break
    }

    // Stop if we've passed the recurrence end date
    const currentDateStart = startOfDay(currentDate)
    const recurrenceEndDateStart = startOfDay(recurrenceEndDate)

    if (isAfter(currentDateStart, recurrenceEndDateStart)) {
      break
    }

    // Calculate end time for this occurrence
    const sessionEnd = new Date(currentDate)
    sessionEnd.setMinutes(sessionEnd.getMinutes() + durationMinutes)

    sessions.push({
      scheduledStart: new Date(currentDate),
      scheduledEnd: sessionEnd,
    })
  }

  return sessions
}

/**
 * Calculate the number of sessions that will be generated
 */
export function calculateSessionCount(params: RecurringSessionParams): number {
  return generateRecurringDates(params).length
}

/**
 * Get a human-readable description of the recurrence pattern
 */
export function getRecurrenceDescription(
  frequency: RecurrenceFrequency,
  startDate: Date,
  endDate: Date
): string {
  const formatTime = (date: Date) => {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }

  const formatDate = (date: Date) => {
    return date.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })
  }

  const frequencyText = {
    weekly: 'every week',
    biweekly: 'every 2 weeks',
    monthly: 'every month',
  }

  return `${frequencyText[frequency]} at ${formatTime(startDate)} until ${formatDate(endDate)}`
}
