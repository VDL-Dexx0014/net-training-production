// src/components/scheduling/MultiLocationCalendar.tsx
// Shows multiple location calendars for a trainer

'use client'

import { useState, useEffect } from 'react'
import { LocationCalendar } from './LocationCalendar'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon } from 'lucide-react'
import { Database } from '@/types/database.types'
import { DaySchedule, TimeSlot } from '@/lib/scheduling/availability'
import { getDateLabel } from '@/lib/utils/canadian-holidays'

type Location = Database['public']['Tables']['locations']['Row']

interface MultiLocationCalendarProps {
  schedules: DaySchedule[]
  onSlotClick?: (slot: TimeSlot, location: Location) => void
  initialDate?: Date
}

export function MultiLocationCalendar({
  schedules,
  onSlotClick,
  initialDate = new Date(),
}: MultiLocationCalendarProps) {
  const [currentDate, setCurrentDate] = useState(() => {
    const date = new Date(initialDate)
    date.setHours(0, 0, 0, 0)
    return date
  })

  // Group schedules by location
  const schedulesByLocation = schedules.reduce(
    (acc, schedule) => {
      const locationId = schedule.location.id
      if (!acc[locationId]) {
        acc[locationId] = {
          location: schedule.location,
          schedules: [],
        }
      }
      acc[locationId].schedules.push(schedule)
      return acc
    },
    {} as Record<
      string,
      {
        location: Location
        schedules: DaySchedule[]
      }
    >
  )

  // Get schedule for current date
  const currentSchedules = schedules.filter((s) => {
    const scheduleDate = new Date(s.date)
    scheduleDate.setHours(0, 0, 0, 0)
    return scheduleDate.getTime() === currentDate.getTime()
  })

  const handlePreviousDay = () => {
    const newDate = new Date(currentDate)
    newDate.setDate(newDate.getDate() - 1)
    setCurrentDate(newDate)
  }

  const handleNextDay = () => {
    const newDate = new Date(currentDate)
    newDate.setDate(newDate.getDate() + 1)
    setCurrentDate(newDate)
  }

  const handleToday = () => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    setCurrentDate(today)
  }

  const totalAvailable = currentSchedules.reduce(
    (sum, schedule) => sum + schedule.slots.filter((s) => s.isAvailable).length,
    0
  )

  const totalBooked = currentSchedules.reduce(
    (sum, schedule) => sum + schedule.slots.filter((s) => !s.isAvailable).length,
    0
  )

  const dateLabel = getDateLabel(currentDate, 'ON') // Using Ontario as default province

  return (
    <div className="space-y-6">
      {/* Global Date Controls */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <CalendarIcon className="h-5 w-5 text-slate-500" />
              <div>
                <CardTitle>Your Schedule</CardTitle>
                <CardDescription>
                  {currentSchedules.length} location(s) • {totalAvailable} open slots •{' '}
                  {totalBooked} blocked
                </CardDescription>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={handlePreviousDay}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <div className="min-w-[200px] text-center">
                <div className="flex flex-col items-center gap-1">
                  <span className="font-medium">
                    {currentDate.toLocaleDateString([], {
                      weekday: 'long',
                      month: 'long',
                      day: 'numeric',
                      year: 'numeric',
                    })}
                  </span>
                  {/* Weekend/Holiday Badge */}
                  {dateLabel.holiday && (
                    <Badge variant="outline" className="bg-red-100 text-red-700 border-red-300 text-xs">
                      {dateLabel.holiday.name}
                    </Badge>
                  )}
                  {dateLabel.isWeekend && !dateLabel.holiday && (
                    <Badge variant="outline" className="bg-blue-100 text-blue-700 border-blue-300 text-xs">
                      Weekend
                    </Badge>
                  )}
                </div>
              </div>
              <Button variant="outline" size="sm" onClick={handleNextDay}>
                <ChevronRight className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="sm" onClick={handleToday}>
                Today
              </Button>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Location Calendars */}
      <div className="grid md:grid-cols-2 gap-6">
        {currentSchedules.length === 0 ? (
          <Card className="md:col-span-2">
            <CardContent className="py-12">
              <div className="text-center text-slate-500">
                No locations configured for this date
              </div>
            </CardContent>
          </Card>
        ) : (
          currentSchedules.map((schedule) => (
            <LocationCalendar
              key={`${schedule.location.id}-${schedule.date.toISOString()}`}
              location={schedule.location}
              date={schedule.date}
              slots={schedule.slots}
              onSlotClick={
                onSlotClick
                  ? (slot) => onSlotClick(slot, schedule.location)
                  : undefined
              }
              showControls={false}
            />
          ))
        )}
      </div>
    </div>
  )
}
