// src/components/scheduling/ManualScheduleSessionDialog.tsx
// Dialog for manually scheduling a session without calendar slot selection

'use client'

import { useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import { Calendar as CalendarComponent } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Database } from '@/types/database.types'
import { MapPin, Clock, Calendar, CalendarIcon, Repeat } from 'lucide-react'
import { format } from 'date-fns'
import { cn } from '@/lib/utils'
import { formatName } from '@/lib/utils/name-formatter'
import { useAuthStore } from '@/store/auth-store'
import { generateTimeSlotOptions } from '@/lib/scheduling/three-week-availability'
import { createClient } from '@/lib/supabase/client'
import { loadWeeklyAvailability } from '@/lib/scheduling/availability-storage'
import { WeeklyAvailability, isAvailableOnDate } from '@/lib/scheduling/weekly-availability'
import { SpecificDateAvailability } from '@/lib/scheduling/availability'

type Location = Database['public']['Tables']['locations']['Row']
type Client = {
  id: string
  first_name: string
  last_name: string
  email: string
}
type Program = Database['public']['Tables']['programs']['Row']

interface ManualScheduleSessionDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  locations: Location[]
  clients: Client[]
  programs: Program[]
  onSchedule: (sessionData: {
    clientId: string
    programId: string | null
    locationId: string
    scheduledStart: Date
    scheduledEnd: Date
    notes?: string
    isRecurring?: boolean
    recurrenceFrequency?: 'weekly' | 'biweekly' | 'monthly'
    recurrenceEndDate?: Date
  }) => Promise<void>
}

export function ManualScheduleSessionDialog({
  open,
  onOpenChange,
  locations,
  clients,
  programs,
  onSchedule,
}: ManualScheduleSessionDialogProps) {
  const { profile } = useAuthStore()
  const [selectedClientId, setSelectedClientId] = useState<string>('')
  const [selectedProgramId, setSelectedProgramId] = useState<string>('')
  const [selectedLocationId, setSelectedLocationId] = useState<string>('')
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined)
  const [startTime, setStartTime] = useState<string>('')
  const [duration, setDuration] = useState<number>(30) // Default 30 minutes
  const [notes, setNotes] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isRecurring, setIsRecurring] = useState(false)
  const [recurrenceFrequency, setRecurrenceFrequency] = useState<'weekly' | 'biweekly' | 'monthly'>('weekly')
  const [recurrenceEndDate, setRecurrenceEndDate] = useState<Date | undefined>(undefined)

  // Availability state
  const [weeklyAvailability, setWeeklyAvailability] = useState<WeeklyAvailability | undefined>()
  const [specificDateAvailability, setSpecificDateAvailability] = useState<SpecificDateAvailability[]>([])
  const [loadingAvailability, setLoadingAvailability] = useState(false)

  const timeSlots = generateTimeSlotOptions()

  // Load availability when location changes
  useEffect(() => {
    if (open && selectedLocationId && profile?.id) {
      loadAvailability()
    }
  }, [open, selectedLocationId, profile?.id])

  const loadAvailability = async () => {
    if (!profile?.id || !selectedLocationId) return

    setLoadingAvailability(true)
    const supabase = createClient()

    try {
      // Load weekly template
      const weekly = await loadWeeklyAvailability(supabase, profile.id, selectedLocationId)
      setWeeklyAvailability(weekly)

      // Load specific date availability for next 60 days
      const today = new Date()
      const sixtyDaysFromNow = new Date()
      sixtyDaysFromNow.setDate(today.getDate() + 60)

      const todayLocalDate = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
      const endLocalDate = `${sixtyDaysFromNow.getFullYear()}-${String(sixtyDaysFromNow.getMonth() + 1).padStart(2, '0')}-${String(sixtyDaysFromNow.getDate()).padStart(2, '0')}`

      const { data: specificAvailData } = await supabase
        .from('trainer_availability')
        .select('date, location_id, start_time, end_time')
        .eq('trainer_id', profile.id)
        .eq('is_recurring', false)
        .gte('date', todayLocalDate)
        .lte('date', endLocalDate)

      const specificAvail: SpecificDateAvailability[] = (specificAvailData || []).map((record: any) => ({
        date: record.date,
        locationId: record.location_id,
        startTime: record.start_time.substring(11, 16),
        endTime: record.end_time.substring(11, 16)
      }))
      setSpecificDateAvailability(specificAvail)
    } catch (error) {
      console.error('Error loading availability:', error)
    } finally {
      setLoadingAvailability(false)
    }
  }

  // Check if a date has availability
  const isDateAvailable = (date: Date): boolean => {
    if (!selectedLocationId) return false

    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    const dateString = `${year}-${month}-${day}`

    // Check specific date availability first
    const specificAvail = specificDateAvailability.find(
      a => a.date === dateString && a.locationId === selectedLocationId
    )
    if (specificAvail) return true

    // Check weekly template
    if (weeklyAvailability) {
      const dayAvail = isAvailableOnDate(date, weeklyAvailability)
      return dayAvail.isAvailable
    }

    return false
  }

  // Get available time slots for selected date
  const getAvailableTimeSlotsForDate = (): string[] => {
    if (!selectedDate || !selectedLocationId) return []

    const year = selectedDate.getFullYear()
    const month = String(selectedDate.getMonth() + 1).padStart(2, '0')
    const day = String(selectedDate.getDate()).padStart(2, '0')
    const dateString = `${year}-${month}-${day}`

    // Check specific date availability first
    const specificAvail = specificDateAvailability.find(
      a => a.date === dateString && a.locationId === selectedLocationId
    )

    if (specificAvail) {
      // Filter time slots to only those within availability window
      return timeSlots.filter(time => {
        return time >= specificAvail.startTime && time < specificAvail.endTime
      })
    }

    // Check weekly template
    if (weeklyAvailability) {
      const dayAvail = isAvailableOnDate(selectedDate, weeklyAvailability)
      if (dayAvail.isAvailable && dayAvail.startTime && dayAvail.endTime) {
        const startTime = dayAvail.startTime
        const endTime = dayAvail.endTime
        return timeSlots.filter(time => {
          return time >= startTime && time < endTime
        })
      }
    }

    return []
  }

  const availableTimeSlots = getAvailableTimeSlotsForDate()

  // Filter programs for selected client
  const clientPrograms = programs.filter((p) => p.client_id === selectedClientId)

  const calculateEndTime = (start: string, durationMinutes: number): string => {
    const [hour, min] = start.split(':').map(Number)
    const totalMinutes = hour * 60 + min + durationMinutes
    const endHour = Math.floor(totalMinutes / 60)
    const endMin = totalMinutes % 60
    return `${endHour.toString().padStart(2, '0')}:${endMin.toString().padStart(2, '0')}`
  }

  const handleSubmit = async () => {
    if (!selectedClientId || !selectedLocationId || !selectedDate || !startTime) {
      return
    }

    // Validate recurring session fields
    if (isRecurring && !recurrenceEndDate) {
      return
    }

    setIsSubmitting(true)
    try {
      const [startHour, startMin] = startTime.split(':').map(Number)
      const endTime = calculateEndTime(startTime, duration)
      const [endHour, endMin] = endTime.split(':').map(Number)

      const scheduledStart = new Date(selectedDate)
      scheduledStart.setHours(startHour, startMin, 0, 0)

      const scheduledEnd = new Date(selectedDate)
      scheduledEnd.setHours(endHour, endMin, 0, 0)

      await onSchedule({
        clientId: selectedClientId,
        programId: selectedProgramId || null,
        locationId: selectedLocationId,
        scheduledStart,
        scheduledEnd,
        notes: notes || undefined,
        isRecurring,
        recurrenceFrequency: isRecurring ? recurrenceFrequency : undefined,
        recurrenceEndDate: isRecurring ? recurrenceEndDate : undefined,
      })

      // Reset form
      setSelectedClientId('')
      setSelectedProgramId('')
      setSelectedLocationId('')
      setSelectedDate(undefined)
      setStartTime('')
      setDuration(30)
      setNotes('')
      setIsRecurring(false)
      setRecurrenceFrequency('weekly')
      setRecurrenceEndDate(undefined)
      onOpenChange(false)
    } catch (error) {
      console.error('Error scheduling session:', error)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[550px]">
        <DialogHeader>
          <DialogTitle>Schedule Training Session</DialogTitle>
          <DialogDescription>
            Create a new training session during your available times
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Client Selection */}
          <div className="space-y-2">
            <Label htmlFor="client">Client *</Label>
            <Select value={selectedClientId} onValueChange={setSelectedClientId}>
              <SelectTrigger id="client">
                <SelectValue placeholder="Select a client" />
              </SelectTrigger>
              <SelectContent>
                {clients.map((client) => (
                  <SelectItem key={client.id} value={client.id}>
                    {formatName(client.first_name, client.last_name, profile?.role)}
                  </SelectItem>
                ))}
                {clients.length === 0 && (
                  <div className="px-2 py-1.5 text-sm text-slate-500">
                    No clients available
                  </div>
                )}
              </SelectContent>
            </Select>
          </div>

          {/* Location Selection */}
          <div className="space-y-2">
            <Label htmlFor="location">Location *</Label>
            <Select value={selectedLocationId} onValueChange={setSelectedLocationId}>
              <SelectTrigger id="location">
                <SelectValue placeholder="Select a location" />
              </SelectTrigger>
              <SelectContent>
                {locations.map((location) => (
                  <SelectItem key={location.id} value={location.id}>
                    <div className="flex items-center gap-2">
                      <MapPin className="h-3 w-3" />
                      {location.name}
                    </div>
                  </SelectItem>
                ))}
                {locations.length === 0 && (
                  <div className="px-2 py-1.5 text-sm text-slate-500">
                    No locations available
                  </div>
                )}
              </SelectContent>
            </Select>
          </div>

          {/* Date Selection */}
          <div className="space-y-2">
            <Label>Date *</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    'w-full justify-start text-left font-normal',
                    !selectedDate && 'text-muted-foreground'
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {selectedDate ? format(selectedDate, 'PPP') : <span>Pick a date</span>}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <CalendarComponent
                  mode="single"
                  selected={selectedDate}
                  onSelect={setSelectedDate}
                  disabled={(date) => {
                    const today = new Date()
                    today.setHours(0, 0, 0, 0)
                    // Disable past dates and dates without availability
                    return date < today || !isDateAvailable(date)
                  }}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>

          {/* Time Selection */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="start-time">Start Time *</Label>
              <Select
                value={startTime}
                onValueChange={setStartTime}
                disabled={!selectedDate || loadingAvailability}
              >
                <SelectTrigger id="start-time">
                  <SelectValue placeholder={selectedDate ? "Select time" : "Select date first"} />
                </SelectTrigger>
                <SelectContent>
                  {availableTimeSlots.length > 0 ? (
                    availableTimeSlots.map((time) => (
                      <SelectItem key={time} value={time}>
                        <div className="flex items-center gap-2">
                          <Clock className="h-3 w-3" />
                          {time}
                        </div>
                      </SelectItem>
                    ))
                  ) : (
                    <div className="px-2 py-1.5 text-sm text-slate-500">
                      {selectedDate ? 'No available times for this date' : 'Select a date first'}
                    </div>
                  )}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="duration">Duration *</Label>
              <Select value={duration.toString()} onValueChange={(val) => setDuration(Number(val))}>
                <SelectTrigger id="duration">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="30">30 minutes</SelectItem>
                  <SelectItem value="60">1 hour</SelectItem>
                  <SelectItem value="90">1.5 hours</SelectItem>
                  <SelectItem value="120">2 hours</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Program Selection (optional) */}
          <div className="space-y-2">
            <Label htmlFor="program">Routine (optional)</Label>
            <Select
              value={selectedProgramId}
              onValueChange={setSelectedProgramId}
              disabled={!selectedClientId}
            >
              <SelectTrigger id="program">
                <SelectValue placeholder="Select a routine (optional)" />
              </SelectTrigger>
              <SelectContent>
                {clientPrograms.map((program) => (
                  <SelectItem key={program.id} value={program.id}>
                    {program.name}
                  </SelectItem>
                ))}
                {clientPrograms.length === 0 && selectedClientId && (
                  <div className="px-2 py-1.5 text-sm text-slate-500">
                    No routines for this client
                  </div>
                )}
              </SelectContent>
            </Select>
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label htmlFor="notes">Session Notes (optional)</Label>
            <Textarea
              id="notes"
              placeholder="Add any notes about this session..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
            />
          </div>

          {/* Recurring Session */}
          <div className="space-y-4 pt-4 border-t">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="recurring"
                checked={isRecurring}
                onCheckedChange={(checked) => setIsRecurring(checked as boolean)}
              />
              <div className="flex items-center gap-2">
                <Repeat className="h-4 w-4 text-slate-500" />
                <Label
                  htmlFor="recurring"
                  className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                >
                  Make this a recurring session
                </Label>
              </div>
            </div>

            {isRecurring && (
              <div className="space-y-4 pl-6 animate-in slide-in-from-top-2">
                {/* Frequency Selection */}
                <div className="space-y-2">
                  <Label htmlFor="frequency">Repeat Every</Label>
                  <Select
                    value={recurrenceFrequency}
                    onValueChange={(value) => setRecurrenceFrequency(value as 'weekly' | 'biweekly' | 'monthly')}
                  >
                    <SelectTrigger id="frequency">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="weekly">Week</SelectItem>
                      <SelectItem value="biweekly">2 Weeks</SelectItem>
                      <SelectItem value="monthly">Month</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* End Date Selection */}
                <div className="space-y-2">
                  <Label>End Date *</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          'w-full justify-start text-left font-normal',
                          !recurrenceEndDate && 'text-muted-foreground'
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {recurrenceEndDate ? (
                          format(recurrenceEndDate, 'PPP')
                        ) : (
                          <span>Pick an end date</span>
                        )}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                      <CalendarComponent
                        mode="single"
                        selected={recurrenceEndDate}
                        onSelect={setRecurrenceEndDate}
                        disabled={(date) => !selectedDate || date < selectedDate}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                  <p className="text-xs text-slate-500">
                    Sessions will be created at the same time on the selected frequency until this date
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!selectedClientId || !selectedLocationId || !selectedDate || !startTime || isSubmitting || (isRecurring && !recurrenceEndDate)}
            className="font-bold"
          >
            {isSubmitting ? 'Scheduling...' : isRecurring ? 'Schedule Recurring Sessions' : 'Schedule Session'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
