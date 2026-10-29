// src/components/scheduling/LocationCalendar.tsx
// Calendar view for a specific location showing available/blocked time slots

'use client'

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ChevronLeft, ChevronRight, MapPin } from 'lucide-react'
import { Database } from '@/types/database.types'
import { TimeSlot } from '@/lib/scheduling/availability'
import { getDateLabel } from '@/lib/utils/canadian-holidays'

type Location = Database['public']['Tables']['locations']['Row']

interface LocationCalendarProps {
  location: Location
  date: Date
  slots: TimeSlot[]
  onSlotClick?: (slot: TimeSlot) => void
  onDateChange?: (date: Date) => void
  showControls?: boolean
}

export function LocationCalendar({
  location,
  date,
  slots,
  onSlotClick,
  onDateChange,
  showControls = true,
}: LocationCalendarProps) {
  const [selectedDate, setSelectedDate] = useState(date)

  const handlePreviousDay = () => {
    const newDate = new Date(selectedDate)
    newDate.setDate(newDate.getDate() - 1)
    setSelectedDate(newDate)
    onDateChange?.(newDate)
  }

  const handleNextDay = () => {
    const newDate = new Date(selectedDate)
    newDate.setDate(newDate.getDate() + 1)
    setSelectedDate(newDate)
    onDateChange?.(newDate)
  }

  const handleToday = () => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    setSelectedDate(today)
    onDateChange?.(today)
  }

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }

  const availableSlots = slots.filter((slot) => slot.isAvailable)
  const bookedSlots = slots.filter((slot) => !slot.isAvailable)
  const dateLabel = getDateLabel(selectedDate, 'ON') // Using Ontario as default province

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            <MapPin className="h-5 w-5 text-slate-500" />
            <div>
              <CardTitle>{location.name}</CardTitle>
              <CardDescription className="text-xs mt-1">
                {location.address}
              </CardDescription>
            </div>
          </div>
          <div className="flex gap-2">
            <Badge variant="outline" className="bg-green-50">
              {availableSlots.length} open
            </Badge>
            <Badge variant="outline" className="bg-red-50">
              {bookedSlots.length} blocked
            </Badge>
          </div>
        </div>

        {showControls && (
          <div className="flex items-center justify-between mt-4 pt-4 border-t">
            <Button variant="outline" size="sm" onClick={handlePreviousDay}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <div className="flex flex-col items-center gap-1">
              <div className="flex items-center gap-2">
                <span className="font-medium">
                  {selectedDate.toLocaleDateString([], {
                    weekday: 'short',
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                  })}
                </span>
                <Button variant="ghost" size="sm" onClick={handleToday}>
                  Today
                </Button>
              </div>
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
            <Button variant="outline" size="sm" onClick={handleNextDay}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        )}
      </CardHeader>

      <CardContent>
        <div className="grid grid-cols-4 gap-2 max-h-96 overflow-y-auto">
          {slots.map((slot, index) => {
            const isClickable = onSlotClick && slot.isAvailable
            return (
              <button
                key={index}
                onClick={() => isClickable && onSlotClick(slot)}
                disabled={!isClickable}
                className={`
                  p-2 rounded-md text-sm font-medium transition-all
                  ${
                    slot.isAvailable
                      ? 'bg-green-50 text-green-700 hover:bg-green-100 border border-green-200 cursor-pointer'
                      : 'bg-red-50 text-red-700 border border-red-200 cursor-not-allowed opacity-60'
                  }
                  ${isClickable ? 'hover:scale-105' : ''}
                `}
              >
                <div className="flex flex-col items-center">
                  <span className="text-xs">{formatTime(slot.start)}</span>
                  <span className="text-[10px] text-slate-500">
                    {slot.isAvailable ? 'Open' : 'Blocked'}
                  </span>
                </div>
              </button>
            )
          })}
        </div>

        {slots.length === 0 && (
          <div className="text-center py-8 text-slate-500">
            No time slots available for this day
          </div>
        )}
      </CardContent>
    </Card>
  )
}
