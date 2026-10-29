// src/components/booking/WeeklyAvailabilityCalendar.tsx
// 7-day calendar view showing trainer availability in table format

'use client'

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ChevronLeft, ChevronRight, Calendar } from 'lucide-react'
import { format, parse } from 'date-fns'
import { cn } from '@/lib/utils'

interface TimeSlot {
  startTime: string // ISO format
  endTime: string // ISO format
  trainerId: string
  trainerName: string
}

interface DayAvailability {
  date: string // YYYY-MM-DD
  dayOfWeek: string
  slots: TimeSlot[]
}

interface Trainer {
  id: string
  name: string
  color: string
}

interface WeeklyAvailabilityCalendarProps {
  availability: DayAvailability[]
  trainers: Trainer[]
  locationName: string
  startDate: string
  onSlotSelect: (slot: TimeSlot, date: string) => void
  onWeekChange?: (direction: 'prev' | 'next') => void
}

export function WeeklyAvailabilityCalendar({
  availability,
  trainers,
  locationName,
  startDate,
  onSlotSelect,
  onWeekChange
}: WeeklyAvailabilityCalendarProps) {
  const [selectedDay, setSelectedDay] = useState<string | null>(null)

  const trainerColorMap = new Map(trainers.map(t => [t.id, t.color]))

  const handleDayClick = (date: string) => {
    setSelectedDay(selectedDay === date ? null : date)
  }

  const formatTime = (isoString: string) => {
    // Extract time directly from UTC ISO string to avoid timezone conversion
    // Format: "2025-12-05T09:00:00.000Z" → "09:00"
    const timeStr = isoString.substring(11, 16) // Gets "HH:MM"
    const [hours, minutes] = timeStr.split(':').map(Number)

    // Convert to 12-hour format
    const period = hours >= 12 ? 'PM' : 'AM'
    const displayHours = hours % 12 || 12
    return `${displayHours}:${minutes.toString().padStart(2, '0')} ${period}`
  }

  const isToday = (dateStr: string) => {
    const today = format(new Date(), 'yyyy-MM-dd')
    return dateStr === today
  }

  const totalSlots = availability.reduce((sum, day) => sum + day.slots.length, 0)

  // Build time slot grid for selected day
  const buildTimeGrid = (dayData: DayAvailability) => {
    // Get all unique time slots across all trainers
    const timeSlotSet = new Set<string>()
    dayData.slots.forEach(slot => {
      timeSlotSet.add(slot.startTime)
    })

    const uniqueTimes = Array.from(timeSlotSet).sort()

    // Build a map of time -> trainer -> slot
    const timeGridMap = new Map<string, Map<string, TimeSlot>>()

    uniqueTimes.forEach(time => {
      const trainersForTime = new Map<string, TimeSlot>()
      dayData.slots.forEach(slot => {
        if (slot.startTime === time) {
          trainersForTime.set(slot.trainerId, slot)
        }
      })
      timeGridMap.set(time, trainersForTime)
    })

    return { uniqueTimes, timeGridMap }
  }

  return (
    <div className="space-y-4">
      {/* Header with week navigation */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Available Times</CardTitle>
              <CardDescription className="mt-1">
                {locationName} • {totalSlots} slot{totalSlots !== 1 ? 's' : ''} available
              </CardDescription>
            </div>
            {onWeekChange && (
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onWeekChange('prev')}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onWeekChange('next')}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {/* 7-day grid */}
          <div className="grid grid-cols-7 gap-2 mb-6">
            {availability.map(day => {
              const dayDate = parse(day.date, 'yyyy-MM-dd', new Date())
              const isExpanded = selectedDay === day.date
              const hasSlots = day.slots.length > 0

              return (
                <div key={day.date} className="flex flex-col">
                  {/* Day header */}
                  <button
                    onClick={() => hasSlots && handleDayClick(day.date)}
                    className={cn(
                      'p-3 rounded-lg border-2 transition-all text-center',
                      isToday(day.date) && 'border-blue-500 bg-blue-50',
                      !isToday(day.date) && hasSlots && 'border-slate-200 hover:border-slate-300 hover:bg-slate-50',
                      !hasSlots && 'border-slate-100 bg-slate-50 opacity-50 cursor-default',
                      isExpanded && 'border-slate-400 bg-slate-100'
                    )}
                  >
                    <div className="text-xs font-medium text-slate-600 uppercase mb-1">
                      {format(dayDate, 'EEE')}
                    </div>
                    <div className="text-lg font-bold">
                      {format(dayDate, 'd')}
                    </div>
                    {hasSlots && (
                      <div className="text-xs text-slate-500 mt-1">
                        {day.slots.length} slot{day.slots.length !== 1 ? 's' : ''}
                      </div>
                    )}
                    {!hasSlots && (
                      <div className="text-xs text-slate-400 mt-1">
                        None
                      </div>
                    )}
                  </button>
                </div>
              )
            })}
          </div>

          {/* Selected day's time slots as a table */}
          {selectedDay && (() => {
            const dayData = availability.find(d => d.date === selectedDay)
            if (!dayData || dayData.slots.length === 0) {
              return (
                <div className="text-center py-8 border-t">
                  <p className="text-sm text-slate-500">
                    No available slots for this day
                  </p>
                </div>
              )
            }

            const { uniqueTimes, timeGridMap } = buildTimeGrid(dayData)

            return (
              <div className="border-t pt-6">
                <div className="flex items-center gap-2 mb-4">
                  <Calendar className="h-4 w-4 text-slate-600" />
                  <h3 className="font-semibold">
                    {format(parse(selectedDay, 'yyyy-MM-dd', new Date()), 'EEEE, MMMM d, yyyy')}
                  </h3>
                </div>

                {/* Table view */}
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse">
                    <thead>
                      <tr className="border-b-2">
                        <th className="text-left p-3 font-semibold text-slate-700 bg-slate-50 sticky left-0 z-10">
                          Time
                        </th>
                        {trainers.map(trainer => (
                          <th
                            key={trainer.id}
                            className="text-center p-3 font-semibold text-slate-700 bg-slate-50 min-w-[120px]"
                          >
                            <div className="flex flex-col items-center gap-1">
                              <div
                                className="w-3 h-3 rounded-full"
                                style={{ backgroundColor: trainer.color }}
                              />
                              <span className="text-sm">{trainer.name}</span>
                            </div>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {uniqueTimes.map((time, index) => {
                        const trainersForTime = timeGridMap.get(time)!

                        return (
                          <tr
                            key={time}
                            className={cn(
                              'border-b hover:bg-slate-50 transition-colors',
                              index % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'
                            )}
                          >
                            <td className="p-3 font-medium text-slate-700 whitespace-nowrap sticky left-0 bg-inherit z-10">
                              {formatTime(time)}
                            </td>
                            {trainers.map(trainer => {
                              const slot = trainersForTime.get(trainer.id)

                              return (
                                <td key={trainer.id} className="p-2 text-center">
                                  {slot ? (
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      className="w-full"
                                      style={{
                                        borderColor: trainer.color,
                                        backgroundColor: `${trainer.color}10`
                                      }}
                                      onClick={() => onSlotSelect(slot, selectedDay)}
                                    >
                                      Available
                                    </Button>
                                  ) : (
                                    <span className="text-slate-300 text-sm">-</span>
                                  )}
                                </td>
                              )
                            })}
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )
          })()}

          {/* Empty state */}
          {totalSlots === 0 && (
            <div className="text-center py-12 border-t">
              <Calendar className="h-12 w-12 mx-auto mb-4 text-slate-300" />
              <p className="text-slate-600 font-medium mb-1">
                No availability this week
              </p>
              <p className="text-sm text-slate-500">
                Try checking a different week or selecting different instructors
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
