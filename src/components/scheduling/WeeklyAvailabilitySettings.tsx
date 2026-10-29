// src/components/scheduling/WeeklyAvailabilitySettings.tsx
// Component for trainers to set their weekly availability

'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import {
  DAYS_OF_WEEK,
  WeeklyAvailability,
  createDefaultWeeklyAvailability,
  generateTimeOptions,
  DayOfWeek,
} from '@/lib/scheduling/weekly-availability'
import { Clock, Save, Calendar, MapPin } from 'lucide-react'
import { toast } from 'sonner'
import { Database } from '@/types/database.types'

type Location = Database['public']['Tables']['locations']['Row']

interface WeeklyAvailabilitySettingsProps {
  initialAvailability?: WeeklyAvailability
  locations: Location[]
  selectedLocationId?: string
  onLocationChange?: (locationId: string) => void
  onSave: (availability: WeeklyAvailability, locationId: string) => Promise<void>
}

export function WeeklyAvailabilitySettings({
  initialAvailability,
  locations,
  selectedLocationId,
  onLocationChange,
  onSave,
}: WeeklyAvailabilitySettingsProps) {
  const [availability, setAvailability] = useState<WeeklyAvailability>(
    initialAvailability || createDefaultWeeklyAvailability()
  )
  const [isSaving, setIsSaving] = useState(false)
  const [hasChanges, setHasChanges] = useState(false)
  const [currentLocationId, setCurrentLocationId] = useState<string>(
    selectedLocationId || locations[0]?.id || ''
  )

  const timeOptions = generateTimeOptions()

  const toggleDay = (dayOfWeek: DayOfWeek) => {
    setAvailability((prev) => ({
      ...prev,
      [dayOfWeek]: {
        ...prev[dayOfWeek],
        isAvailable: !prev[dayOfWeek].isAvailable,
      },
    }))
    setHasChanges(true)
  }

  const updateStartTime = (dayOfWeek: DayOfWeek, startTime: string) => {
    setAvailability((prev) => ({
      ...prev,
      [dayOfWeek]: {
        ...prev[dayOfWeek],
        startTime,
      },
    }))
    setHasChanges(true)
  }

  const updateEndTime = (dayOfWeek: DayOfWeek, endTime: string) => {
    setAvailability((prev) => ({
      ...prev,
      [dayOfWeek]: {
        ...prev[dayOfWeek],
        endTime,
      },
    }))
    setHasChanges(true)
  }

  const handleLocationChange = (newLocationId: string) => {
    setCurrentLocationId(newLocationId)
    if (onLocationChange) {
      onLocationChange(newLocationId)
    }
  }

  const handleSave = async () => {
    if (!currentLocationId) {
      toast.error('Please select a location first')
      return
    }

    setIsSaving(true)
    try {
      await onSave(availability, currentLocationId)
      setHasChanges(false)
      toast.success('Availability settings saved!')
    } catch (error) {
      console.error('Error saving availability:', error)
      toast.error('Failed to save availability settings')
    } finally {
      setIsSaving(false)
    }
  }

  const setFullDayForAll = () => {
    const updated = { ...availability }
    DAYS_OF_WEEK.forEach((day) => {
      if (updated[day.value].isAvailable) {
        updated[day.value].startTime = '06:00'
        updated[day.value].endTime = '22:00'
      }
    })
    setAvailability(updated)
    setHasChanges(true)
  }

  const setBusinessHoursForAll = () => {
    const updated = { ...availability }
    DAYS_OF_WEEK.forEach((day) => {
      if (updated[day.value].isAvailable) {
        updated[day.value].startTime = '09:00'
        updated[day.value].endTime = '17:00'
      }
    })
    setAvailability(updated)
    setHasChanges(true)
  }

  const availableDaysCount = DAYS_OF_WEEK.filter(
    (day) => availability[day.value].isAvailable
  ).length

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-slate-500" />
            <div>
              <CardTitle>Weekly Availability</CardTitle>
              <CardDescription>
                Set which days you work and your hours for each day
              </CardDescription>
            </div>
          </div>
          <Badge variant="outline">
            {availableDaysCount} day{availableDaysCount !== 1 ? 's' : ''} available
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Location Selector */}
        <div className="pb-4 border-b">
          <Label className="text-sm font-medium mb-2 flex items-center gap-2">
            <MapPin className="h-4 w-4" />
            Location
          </Label>
          <Select value={currentLocationId} onValueChange={handleLocationChange}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select a location" />
            </SelectTrigger>
            <SelectContent>
              {locations.map((location) => (
                <SelectItem key={location.id} value={location.id}>
                  {location.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-slate-500 mt-2">
            Templates are location-specific. Set your availability for each location separately.
          </p>
        </div>

        {/* Quick Actions */}
        <div className="flex gap-2 pb-4 border-b">
          <Button variant="outline" size="sm" onClick={setBusinessHoursForAll}>
            Set All to Business Hours (9 AM - 5 PM)
          </Button>
          <Button variant="outline" size="sm" onClick={setFullDayForAll}>
            Set All to Full Day (6 AM - 10 PM)
          </Button>
        </div>

        {/* Day-by-Day Settings */}
        <div className="space-y-4">
          {DAYS_OF_WEEK.map((day) => {
            const dayAvailability = availability[day.value]
            const isAvailable = dayAvailability.isAvailable

            return (
              <div
                key={day.value}
                className={`
                  p-4 rounded-lg border transition-all
                  ${
                    isAvailable
                      ? 'bg-green-50 border-green-200'
                      : 'bg-slate-50 border-slate-200 opacity-60'
                  }
                `}
              >
                <div className="flex items-center justify-between gap-4">
                  {/* Day Name and Toggle */}
                  <div className="flex items-center gap-3 min-w-[140px]">
                    <button
                      onClick={() => toggleDay(day.value)}
                      className={`
                        w-5 h-5 rounded border-2 flex items-center justify-center transition-all
                        ${
                          isAvailable
                            ? 'bg-green-500 border-green-500'
                            : 'bg-white border-slate-300'
                        }
                      `}
                    >
                      {isAvailable && (
                        <svg
                          className="w-3 h-3 text-white"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={3}
                            d="M5 13l4 4L19 7"
                          />
                        </svg>
                      )}
                    </button>
                    <span className="font-medium">{day.label}</span>
                  </div>

                  {/* Time Settings */}
                  {isAvailable ? (
                    <div className="flex items-center gap-3 flex-1">
                      <div className="flex items-center gap-2">
                        <Clock className="h-4 w-4 text-slate-500" />
                        <Label className="text-xs text-slate-600">Start</Label>
                        <Select
                          value={dayAvailability.startTime}
                          onValueChange={(value) => updateStartTime(day.value, value)}
                        >
                          <SelectTrigger className="w-[110px] h-8">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {timeOptions.map((time) => (
                              <SelectItem key={time} value={time}>
                                {time}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <span className="text-slate-400">-</span>

                      <div className="flex items-center gap-2">
                        <Label className="text-xs text-slate-600">End</Label>
                        <Select
                          value={dayAvailability.endTime}
                          onValueChange={(value) => updateEndTime(day.value, value)}
                        >
                          <SelectTrigger className="w-[110px] h-8">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {timeOptions.map((time) => (
                              <SelectItem key={time} value={time}>
                                {time}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  ) : (
                    <div className="flex-1 text-sm text-slate-500 italic">
                      Not available
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>

        {/* Save Button */}
        <div className="flex justify-end pt-4 border-t">
          <Button onClick={handleSave} disabled={!hasChanges || isSaving} className="font-bold">
            <Save className="h-4 w-4 mr-2" />
            {isSaving ? 'Saving...' : hasChanges ? 'Save Changes' : 'No Changes'}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
