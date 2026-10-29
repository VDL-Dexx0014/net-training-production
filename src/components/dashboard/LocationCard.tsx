// src/components/dashboard/LocationCard.tsx
// Selectable location card for the Locations tab

'use client'

import { Card, CardContent } from '@/components/ui/card'
import { MapPin, ChevronRight } from 'lucide-react'
import { getLocationColor } from '@/lib/utils/location-colors'

interface LocationCardProps {
  location: {
    id: string
    name: string
    address: string
    city: string | null
    province: string | null
    max_trainers: number
  }
  isSelected: boolean
  machineCount: number
  onSelect: () => void
  onMachinesClick?: () => void
}

export function LocationCard({ location, isSelected, machineCount, onSelect, onMachinesClick }: LocationCardProps) {
  const colors = getLocationColor(location.name)

  const handleMachinesClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (onMachinesClick) {
      onMachinesClick()
    }
  }

  return (
    <Card
      className={`cursor-pointer transition-all hover:shadow-md border-2 ${
        isSelected
          ? 'ring-2 ring-primary shadow-md border-primary'
          : 'border-slate-300 hover:border-slate-400'
      } ${colors.bg}`}
      onClick={onSelect}
    >
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <MapPin className="h-5 w-5 mt-0.5 shrink-0" />
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-base">{location.name}</h3>
            <p className="text-sm mt-1">{location.address}</p>
            {location.city && (
              <p className="text-sm">
                {location.city}{location.province && `, ${location.province}`}
              </p>
            )}
            <div className="mt-2">
              <button
                onClick={handleMachinesClick}
                className="inline-flex items-center gap-1 text-sm text-primary hover:underline font-medium"
              >
                {machineCount} machine{machineCount !== 1 ? 's' : ''}
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
