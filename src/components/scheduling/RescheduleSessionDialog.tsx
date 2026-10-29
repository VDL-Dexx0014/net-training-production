// src/components/scheduling/RescheduleSessionDialog.tsx
// Dialog for rescheduling an existing training session

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
import { Calendar as CalendarComponent } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { MapPin, Clock, Calendar, CalendarIcon } from 'lucide-react'
import { format } from 'date-fns'
import { cn } from '@/lib/utils'
import { generateTimeSlotOptions } from '@/lib/scheduling/three-week-availability'

interface RescheduleSessionDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  sessionId: string
  clientName: string
  currentDate: Date
  currentStartTime: string
  currentEndTime: string
  currentLocationName: string
  onReschedule: (rescheduleData: {
    sessionId: string
    newDate: Date
    newStartTime: string
    newEndTime: string
    notes?: string
  }) => Promise<void>
}

export function RescheduleSessionDialog({
  open,
  onOpenChange,
  sessionId,
  clientName,
  currentDate,
  currentStartTime,
  currentEndTime,
  currentLocationName,
  onReschedule,
}: RescheduleSessionDialogProps) {
  const [newDate, setNewDate] = useState<Date | undefined>(currentDate)
  const [newStartTime, setNewStartTime] = useState<string>(currentStartTime)
  const [newEndTime, setNewEndTime] = useState<string>(currentEndTime)
  const [notes, setNotes] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const timeSlots = generateTimeSlotOptions()

  // Calculate duration from current session
  const calculateDuration = (start: string, end: string): number => {
    const [startHour, startMin] = start.split(':').map(Number)
    const [endHour, endMin] = end.split(':').map(Number)
    return (endHour * 60 + endMin) - (startHour * 60 + startMin)
  }

  const sessionDuration = calculateDuration(currentStartTime, currentEndTime)

  // When start time changes, automatically update end time to maintain duration
  useEffect(() => {
    if (newStartTime) {
      const [hour, min] = newStartTime.split(':').map(Number)
      const totalMinutes = hour * 60 + min + sessionDuration
      const endHour = Math.floor(totalMinutes / 60)
      const endMin = totalMinutes % 60
      setNewEndTime(`${endHour.toString().padStart(2, '0')}:${endMin.toString().padStart(2, '0')}`)
    }
  }, [newStartTime, sessionDuration])

  const handleSubmit = async () => {
    if (!newDate || !newStartTime || !newEndTime) {
      return
    }

    setIsSubmitting(true)
    try {
      await onReschedule({
        sessionId,
        newDate,
        newStartTime,
        newEndTime,
        notes: notes || undefined,
      })

      onOpenChange(false)
    } catch (error) {
      console.error('Error rescheduling session:', error)
    } finally {
      setIsSubmitting(false)
    }
  }

  const formatDate = (date: Date) => {
    return date.toLocaleDateString([], {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Reschedule Session</DialogTitle>
          <DialogDescription>
            Change the date and time for this training session
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Current Session Details */}
          <div className="space-y-3 rounded-lg bg-slate-50 p-4 border">
            <div className="font-medium text-sm text-slate-700 mb-2">Current Session:</div>
            <div className="flex items-center gap-2 text-sm">
              <Calendar className="h-4 w-4 text-slate-500" />
              <span>{formatDate(currentDate)}</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <Clock className="h-4 w-4 text-slate-500" />
              <span>{currentStartTime} - {currentEndTime}</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <MapPin className="h-4 w-4 text-slate-500" />
              <span>{currentLocationName}</span>
            </div>
            <div className="text-sm font-medium text-blue-700">
              Client: {clientName}
            </div>
          </div>

          {/* New Date Selection */}
          <div className="space-y-2">
            <Label>New Date *</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    'w-full justify-start text-left font-normal',
                    !newDate && 'text-muted-foreground'
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {newDate ? format(newDate, 'PPP') : <span>Pick a date</span>}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <CalendarComponent
                  mode="single"
                  selected={newDate}
                  onSelect={setNewDate}
                  disabled={(date) => date < new Date()}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>

          {/* New Start Time */}
          <div className="space-y-2">
            <Label htmlFor="start-time">New Start Time *</Label>
            <Select value={newStartTime} onValueChange={setNewStartTime}>
              <SelectTrigger id="start-time">
                <SelectValue placeholder="Select start time" />
              </SelectTrigger>
              <SelectContent>
                {timeSlots.map((time) => (
                  <SelectItem key={time} value={time}>
                    {time}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* New End Time (auto-calculated, read-only display) */}
          <div className="space-y-2">
            <Label>New End Time</Label>
            <div className="px-3 py-2 rounded-md border bg-slate-50 text-sm">
              {newEndTime} <span className="text-slate-500">({sessionDuration} minutes)</span>
            </div>
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label htmlFor="notes">Reschedule Notes (optional)</Label>
            <Textarea
              id="notes"
              placeholder="Add any notes about why this session was rescheduled..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
            />
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
            disabled={!newDate || !newStartTime || isSubmitting}
            className="font-bold"
          >
            {isSubmitting ? 'Rescheduling...' : 'Reschedule Session'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
