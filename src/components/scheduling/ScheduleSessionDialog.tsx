// src/components/scheduling/ScheduleSessionDialog.tsx
// Dialog for scheduling a new training session

'use client'

import { useState } from 'react'
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
import { TimeSlot } from '@/lib/scheduling/availability'
import { MapPin, Clock, Calendar, Repeat, CalendarIcon } from 'lucide-react'
import { format } from 'date-fns'
import { cn } from '@/lib/utils'
import { formatName } from '@/lib/utils/name-formatter'
import { useAuthStore } from '@/store/auth-store'

type Location = Database['public']['Tables']['locations']['Row']
type Client = {
  id: string
  first_name: string
  last_name: string
  email: string
}
type Program = Database['public']['Tables']['programs']['Row']

interface ScheduleSessionDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  slot: TimeSlot
  location: Location
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

export function ScheduleSessionDialog({
  open,
  onOpenChange,
  slot,
  location,
  clients,
  programs,
  onSchedule,
}: ScheduleSessionDialogProps) {
  const { profile } = useAuthStore()
  const [selectedClientId, setSelectedClientId] = useState<string>('')
  const [selectedProgramId, setSelectedProgramId] = useState<string>('')
  const [notes, setNotes] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isRecurring, setIsRecurring] = useState(false)
  const [recurrenceFrequency, setRecurrenceFrequency] = useState<'weekly' | 'biweekly' | 'monthly'>('weekly')
  const [recurrenceEndDate, setRecurrenceEndDate] = useState<Date | undefined>(undefined)

  // Filter programs for selected client
  const clientPrograms = programs.filter((p) => p.client_id === selectedClientId)

  // Find selected client details
  const selectedClient = clients.find((c) => c.id === selectedClientId)

  // Debug logging
  console.log('ScheduleSessionDialog - Debug Info:', {
    totalPrograms: programs.length,
    selectedClientId,
    selectedClientName: selectedClient ? `${selectedClient.first_name} ${selectedClient.last_name}` : 'None',
    clientPrograms: clientPrograms.length,
    programsBreakdown: programs.map(p => ({
      id: p.id,
      name: p.name,
      client_id: p.client_id,
      trainer_id: p.trainer_id,
      status: p.status,
      matchesClient: p.client_id === selectedClientId,
    })),
    allPrograms: programs,
    filteredPrograms: clientPrograms,
  })

  const handleSubmit = async () => {
    if (!selectedClientId) {
      return
    }

    // Validate recurring session fields
    if (isRecurring && !recurrenceEndDate) {
      return
    }

    setIsSubmitting(true)
    try {
      await onSchedule({
        clientId: selectedClientId,
        programId: selectedProgramId || null,
        locationId: location.id,
        scheduledStart: slot.start,
        scheduledEnd: slot.end,
        notes: notes || undefined,
        isRecurring,
        recurrenceFrequency: isRecurring ? recurrenceFrequency : undefined,
        recurrenceEndDate: isRecurring ? recurrenceEndDate : undefined,
      })

      // Reset form
      setSelectedClientId('')
      setSelectedProgramId('')
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

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
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
          <DialogTitle>Schedule Training Session</DialogTitle>
          <DialogDescription>
            Create a new training session for a client
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Session Details (Read-only) */}
          <div className="space-y-3 rounded-lg bg-slate-50 p-4">
            <div className="flex items-center gap-2 text-sm">
              <Calendar className="h-4 w-4 text-slate-500" />
              <span className="font-medium">{formatDate(slot.start)}</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <Clock className="h-4 w-4 text-slate-500" />
              <span>
                {formatTime(slot.start)} - {formatTime(slot.end)}
              </span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <MapPin className="h-4 w-4 text-slate-500" />
              <span>{location.name}</span>
            </div>
          </div>

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
                    {programs.length > 0
                      ? `No routines for this client (${programs.length} total routines available)`
                      : 'No active routines available'}
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
                        disabled={(date) => date < slot.start}
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
            disabled={!selectedClientId || isSubmitting || (isRecurring && !recurrenceEndDate)}
            className="font-bold"
          >
            {isSubmitting ? 'Scheduling...' : isRecurring ? 'Schedule Recurring Sessions' : 'Schedule Session'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
