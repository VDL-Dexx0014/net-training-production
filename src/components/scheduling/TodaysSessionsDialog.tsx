// src/components/scheduling/TodaysSessionsDialog.tsx
// Dialog to display today's scheduled sessions

'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { Clock, MapPin, User } from 'lucide-react'
import { format } from 'date-fns'
import { Database } from '@/types/database.types'
import { useAuthStore } from '@/store/auth-store'
import { formatName } from '@/lib/utils/name-formatter'

type Session = Database['public']['Tables']['sessions']['Row']
type Location = Database['public']['Tables']['locations']['Row']

interface SessionWithDetails extends Session {
  client?: {
    first_name: string
    last_name: string
  }
  location?: Location
}

interface TodaysSessionsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  sessions: SessionWithDetails[]
}

export function TodaysSessionsDialog({
  open,
  onOpenChange,
  sessions,
}: TodaysSessionsDialogProps) {
  const router = useRouter()
  const { profile } = useAuthStore()

  const handleSessionClick = (sessionId: string) => {
    onOpenChange(false)
    router.push(`/trainer/session/${sessionId}`)
  }

  const getStatusColor = (status: Session['status']) => {
    switch (status) {
      case 'scheduled':
        return 'bg-blue-100 text-blue-800'
      case 'completed':
        return 'bg-green-100 text-green-800'
      case 'cancelled':
        return 'bg-red-100 text-red-800'
      case 'no_show':
        return 'bg-orange-100 text-orange-800'
      default:
        return 'bg-slate-100 text-slate-800'
    }
  }

  // Sort sessions by scheduled start time
  const sortedSessions = [...sessions].sort(
    (a, b) =>
      new Date(a.scheduled_start).getTime() -
      new Date(b.scheduled_start).getTime()
  )

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Today's Sessions</DialogTitle>
          <DialogDescription>
            {sessions.length === 0
              ? 'No sessions scheduled for today'
              : `${sessions.length} session${sessions.length !== 1 ? 's' : ''} scheduled`}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          {sortedSessions.length === 0 ? (
            <div className="py-12 text-center text-slate-500">
              <p>No sessions scheduled for today</p>
            </div>
          ) : (
            sortedSessions.map((session) => (
              <button
                key={session.id}
                onClick={() => handleSessionClick(session.id)}
                className="w-full text-left p-4 rounded-lg border hover:border-slate-300 hover:bg-slate-50 transition-colors cursor-pointer"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 space-y-2">
                    {/* Client Name */}
                    <div className="flex items-center gap-2">
                      <User className="h-4 w-4 text-slate-500" />
                      <span className="font-medium">
                        {session.client
                          ? formatName(session.client.first_name, session.client.last_name, profile?.role)
                          : 'Unknown Client'}
                      </span>
                    </div>

                    {/* Time */}
                    <div className="flex items-center gap-2 text-sm text-slate-600">
                      <Clock className="h-4 w-4 text-slate-400" />
                      <span>
                        {format(new Date(session.scheduled_start), 'p')} -{' '}
                        {format(new Date(session.scheduled_end), 'p')}
                      </span>
                    </div>

                    {/* Location */}
                    {session.location && (
                      <div className="flex items-center gap-2 text-sm text-slate-600">
                        <MapPin className="h-4 w-4 text-slate-400" />
                        <span>{session.location.name}</span>
                      </div>
                    )}
                  </div>

                  {/* Status Badge */}
                  <Badge
                    className={getStatusColor(session.status)}
                    variant="secondary"
                  >
                    {session.status.charAt(0).toUpperCase() + session.status.slice(1)}
                  </Badge>
                </div>
              </button>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
