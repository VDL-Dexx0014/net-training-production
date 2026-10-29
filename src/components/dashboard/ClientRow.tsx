// src/components/dashboard/ClientRow.tsx
// Client row for the Clients tab - enhanced display with profile image and additional info

'use client'

import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { User, Calendar, ClipboardList, AlertTriangle } from 'lucide-react'
import { formatName } from '@/lib/utils/name-formatter'
import { formatPhoneNumber } from '@/lib/utils/phone-formatter'
import { useAuthStore } from '@/store/auth-store'
import { formatDate } from '@/lib/utils/date-formatter'

export interface EnrichedClient {
  id: string
  first_name: string
  last_name: string
  email: string
  phone: string | null
  profile_photo_url: string | null
  activeProgramName: string | null
  lastSessionDate: string | null
  machineSettingsConfigured: boolean
  routineCount: number
  is_active?: boolean
  high_risk?: boolean
  intensity?: string | null
}

interface ClientRowProps {
  client: EnrichedClient
  onViewProfile: (clientId: string) => void
}

const INTENSITY_STYLES: Record<string, string> = {
  extra_low: 'bg-red-100 text-red-700 border-red-200',
  low: 'bg-orange-100 text-orange-700 border-orange-200',
  medium: 'bg-yellow-100 text-yellow-700 border-yellow-200',
  high: 'bg-green-100 text-green-700 border-green-200',
  extra_high: 'bg-emerald-100 text-emerald-700 border-emerald-200',
}

const INTENSITY_LABELS: Record<string, string> = {
  extra_low: 'Extra Low',
  low: 'Low',
  medium: 'Medium',
  high: 'High',
  extra_high: 'Extra High',
}


export function ClientRow({ client, onViewProfile }: ClientRowProps) {
  const { profile } = useAuthStore()
  const isArchived = client.is_active === false

  return (
    <div
      className={`border-2 rounded-lg hover:shadow-sm transition-all cursor-pointer ${
        isArchived ? 'bg-slate-50 opacity-75' : ''
      }`}
      onClick={() => onViewProfile(client.id)}
    >
      <div className="flex items-center justify-between p-3">
        <div className="flex items-center gap-4 flex-1 min-w-0">
          {/* Profile Image */}
          <div className={`w-12 h-12 rounded-full flex items-center justify-center shrink-0 overflow-hidden ${
            isArchived ? 'bg-slate-300' : 'bg-slate-200'
          }`}>
            {client.profile_photo_url ? (
              <img
                src={client.profile_photo_url}
                alt={`${client.first_name} ${client.last_name}`}
                className="w-full h-full object-cover"
              />
            ) : (
              <User className="h-5 w-5" />
            )}
          </div>

          {/* Name, badges, email */}
          <div className="flex-1 min-w-0">
            {/* Row 1: name + intensity inline */}
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-lg font-bold">{formatName(client.first_name, client.last_name, 'management')}</span>
              {client.intensity && (
                <Badge variant="outline" className={`text-xs ${INTENSITY_STYLES[client.intensity] || ''}`}>
                  {INTENSITY_LABELS[client.intensity] || client.intensity}
                </Badge>
              )}
              {isArchived && (
                <Badge variant="outline" className="text-xs bg-amber-50 text-amber-700 border-amber-200">
                  Archived
                </Badge>
              )}
            </div>
            {/* Row 2: high risk below intensity */}
            {client.high_risk && (
              <div className="mt-0.5">
                <Badge variant="destructive" className="text-xs flex items-center gap-1 w-fit">
                  <AlertTriangle className="h-3 w-3" />
                  High Risk
                </Badge>
              </div>
            )}
            {/* Row 3: email directly under name */}
            <div className="text-sm text-slate-600 truncate">{client.email}</div>
            {client.phone && (
              <div className="text-sm text-slate-500 truncate">{formatPhoneNumber(client.phone)}</div>
            )}
          </div>

          {/* Last Session */}
          <div className="flex flex-col items-center min-w-[100px] shrink-0">
            <div className="flex items-center gap-1 text-xs text-slate-500">
              <Calendar className="h-3 w-3" />
              <span>Last Session</span>
            </div>
            <div className="text-sm font-medium">
              {formatDate(client.lastSessionDate)}
            </div>
          </div>

          {/* Routine Count */}
          <div className="flex flex-col items-center min-w-[70px] shrink-0">
            <div className="flex items-center gap-1 text-xs text-slate-500">
              <ClipboardList className="h-3 w-3" />
              <span>Routines</span>
            </div>
            <div className="text-sm font-medium">
              {client.routineCount}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 ml-2">
          <Button
            size="sm"
            variant="outline"
            onClick={(e) => { e.stopPropagation(); onViewProfile(client.id) }}
          >
            View
          </Button>
        </div>
      </div>
    </div>
  )
}
