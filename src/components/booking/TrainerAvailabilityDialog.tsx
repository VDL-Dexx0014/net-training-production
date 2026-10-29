// src/components/booking/TrainerAvailabilityDialog.tsx
// Dialog showing trainer's available time slots with booking capability

'use client'

import { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Calendar, Clock, MapPin } from 'lucide-react'
import { toast } from 'sonner'
import { formatName } from '@/lib/utils/name-formatter'

interface TimeSlot {
  startTime: string
  endTime: string
  isAvailable: boolean
}

interface TrainerAvailabilityDialogProps {
  isOpen: boolean
  onClose: () => void
  trainerId: string
  trainerName: string
  locationId: string
  locationName: string
  date: string
  onBookingSuccess: () => void
}

export function TrainerAvailabilityDialog({
  isOpen,
  onClose,
  trainerId,
  trainerName,
  locationId,
  locationName,
  date,
  onBookingSuccess
}: TrainerAvailabilityDialogProps) {
  const [timeSlots, setTimeSlots] = useState<TimeSlot[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedSlot, setSelectedSlot] = useState<TimeSlot | null>(null)
  const [showConfirmation, setShowConfirmation] = useState(false)

  useEffect(() => {
    if (isOpen && trainerId && locationId && date) {
      loadAvailability()
    }
  }, [isOpen, trainerId, locationId, date])

  const loadAvailability = async () => {
    setLoading(true)

    try {
      const params = new URLSearchParams({
        trainerId,
        locationId,
        date
      })

      const response = await fetch(`/api/trainers/availability?${params}`)

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to load availability')
      }

      const data = await response.json()
      setTimeSlots(data.timeSlots || [])

      if (data.availableSlotsCount === 0) {
        toast.info('This instructor has no available slots on this date')
      }
    } catch (error) {
      console.error('Error loading availability:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to load availability')
    } finally {
      setLoading(false)
    }
  }

  const handleSlotClick = (slot: TimeSlot) => {
    if (!slot.isAvailable) return
    setSelectedSlot(slot)
    setShowConfirmation(true)
  }

  const handleBooking = async () => {
    if (!selectedSlot) return

    setLoading(true)

    try {
      const response = await fetch('/api/bookings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          trainerId,
          locationId,
          date,
          startTime: selectedSlot.startTime
        })
      })

      const data = await response.json()

      if (!response.ok) {
        // Check if it requires acknowledgment (3rd session warning)
        if (data.requiresAcknowledgment) {
          setShowConfirmation(false)
          // Show confirmation dialog with warning
          const confirmed = window.confirm(
            `${data.warning}\n\nYou currently have ${data.sessionCount} sessions in the past 7 days.\n\nDo you want to proceed with this booking?`
          )

          if (confirmed) {
            // Retry with acknowledgment
            const retryResponse = await fetch('/api/bookings', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({
                trainerId,
                locationId,
                date,
                startTime: selectedSlot.startTime,
                acknowledged3rdSession: true
              })
            })

            const retryData = await retryResponse.json()

            if (!retryResponse.ok) {
              throw new Error(retryData.error || 'Failed to create booking')
            }

            toast.success('Session booked successfully!')
            if (retryData.warning) {
              toast.warning(retryData.warning)
            }
            onBookingSuccess()
            onClose()
          }
          return
        }

        throw new Error(data.error || 'Failed to create booking')
      }

      toast.success('Session booked successfully!')
      if (data.warning) {
        toast.warning(data.warning)
      }
      onBookingSuccess()
      onClose()
    } catch (error) {
      console.error('Error creating booking:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to create booking')
    } finally {
      setLoading(false)
      setShowConfirmation(false)
      setSelectedSlot(null)
    }
  }

  const formatTime = (time: string) => {
    const [hours, minutes] = time.split(':')
    const hour = parseInt(hours)
    const period = hour >= 12 ? 'PM' : 'AM'
    const displayHour = hour % 12 || 12
    return `${displayHour}:${minutes} ${period}`
  }

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr + 'T00:00:00')
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric'
    })
  }

  const availableSlots = timeSlots.filter(slot => slot.isAvailable)

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Book Session with {trainerName}</DialogTitle>
            <DialogDescription>
              <div className="space-y-2 mt-2">
                <div className="flex items-center gap-2 text-sm">
                  <Calendar className="h-4 w-4" />
                  <span>{formatDate(date)}</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <MapPin className="h-4 w-4" />
                  <span>{locationName}</span>
                </div>
              </div>
            </DialogDescription>
          </DialogHeader>

          {loading ? (
            <div className="py-12 text-center text-slate-500">
              Loading availability...
            </div>
          ) : availableSlots.length === 0 ? (
            <div className="py-12 text-center">
              <Clock className="h-12 w-12 text-slate-300 mx-auto mb-4" />
              <p className="text-slate-600 mb-2">No available time slots</p>
              <p className="text-sm text-slate-500">
                This instructor has no availability on this date. Try selecting a different date.
              </p>
            </div>
          ) : (
            <div className="py-4">
              <h4 className="font-semibold mb-4 text-sm text-slate-700">
                Available Time Slots ({availableSlots.length})
              </h4>
              <div className="grid grid-cols-3 gap-3">
                {timeSlots.map((slot, index) => (
                  <Button
                    key={index}
                    variant={slot.isAvailable ? 'outline' : 'ghost'}
                    className={`h-auto py-3 ${
                      slot.isAvailable
                        ? 'hover:bg-blue-50 hover:border-blue-500 hover:text-blue-700 font-semibold'
                        : 'opacity-40 cursor-not-allowed'
                    }`}
                    onClick={() => handleSlotClick(slot)}
                    disabled={!slot.isAvailable}
                  >
                    <div className="text-center">
                      <div className="text-sm">{formatTime(slot.startTime)}</div>
                      <div className="text-xs text-slate-500">30 min</div>
                    </div>
                  </Button>
                ))}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Booking Confirmation Dialog */}
      {showConfirmation && selectedSlot && (
        <Dialog open={showConfirmation} onOpenChange={() => setShowConfirmation(false)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Confirm Booking</DialogTitle>
              <DialogDescription>
                Please review your booking details
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div className="border rounded-lg p-4 bg-slate-50">
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-sm text-slate-600">Instructor:</span>
                    <span className="font-medium">{trainerName}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-slate-600">Location:</span>
                    <span className="font-medium">{locationName}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-slate-600">Date:</span>
                    <span className="font-medium">{formatDate(date)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-slate-600">Time:</span>
                    <span className="font-medium">
                      {formatTime(selectedSlot.startTime)} - {formatTime(selectedSlot.endTime)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-slate-600">Duration:</span>
                    <span className="font-medium">30 minutes</span>
                  </div>
                </div>
              </div>

              <div className="flex gap-3">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => {
                    setShowConfirmation(false)
                    setSelectedSlot(null)
                  }}
                  disabled={loading}
                >
                  Cancel
                </Button>
                <Button
                  className="flex-1 font-bold"
                  onClick={handleBooking}
                  disabled={loading}
                >
                  {loading ? 'Booking...' : 'Confirm Booking'}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </>
  )
}
