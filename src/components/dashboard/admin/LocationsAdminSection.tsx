// src/components/dashboard/admin/LocationsAdminSection.tsx
// Admin section for managing gym locations

'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Plus } from 'lucide-react'
import { getLocationColor } from '@/lib/utils/location-colors'
import { CreateLocationDialog } from '@/components/management/CreateLocationDialog'
import { LocationDetailDialog } from '@/components/management/LocationDetailDialog'

interface Location {
  id: string
  name: string
  address: string
  city: string | null
  province: string | null
  postal_code: string | null
  max_trainers: number
  is_active: boolean
}

export function LocationsAdminSection() {
  const [locations, setLocations] = useState<Location[]>([])
  const [loading, setLoading] = useState(true)
  const [createOpen, setCreateOpen] = useState(false)
  const [detailLocation, setDetailLocation] = useState<Location | null>(null)
  const [detailOpen, setDetailOpen] = useState(false)

  useEffect(() => {
    loadLocations()
  }, [])

  const loadLocations = async () => {
    setLoading(true)
    const supabase = createClient()
    // Load all locations, not just active ones
    const { data } = await supabase
      .from('locations')
      .select('*')
      .order('is_active', { ascending: false })
      .order('name')

    if (data) setLocations(data as Location[])
    setLoading(false)
  }

  const handleCardClick = (location: Location) => {
    setDetailLocation(location)
    setDetailOpen(true)
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h3 className="font-semibold text-lg">Gym Locations</h3>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Add Location
        </Button>
      </div>

      {loading ? (
        <div className="py-8 text-center">Loading locations...</div>
      ) : locations.length === 0 ? (
        <div className="py-8 text-center">No locations configured</div>
      ) : (
        <div className="space-y-3">
          {locations.map((location) => {
            const colors = getLocationColor(location.name)
            return (
              <div
                key={location.id}
                onClick={() => handleCardClick(location)}
                className={`flex justify-between items-center p-4 border rounded-lg transition-all cursor-pointer hover:shadow-md ${
                  location.is_active
                    ? `${colors.bg} ${colors.border}`
                    : 'bg-slate-100 border-slate-300 opacity-75'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-medium">{location.name}</p>
                      <Badge
                        variant={location.is_active ? 'default' : 'secondary'}
                        className={location.is_active ? 'bg-green-600' : 'bg-slate-500'}
                      >
                        {location.is_active ? 'Active' : 'Archived'}
                      </Badge>
                    </div>
                    <p className="text-sm">
                      {location.address}{location.city && `, ${location.city}`}{location.province && `, ${location.province}`}
                    </p>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      <CreateLocationDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onLocationCreated={loadLocations}
      />

      <LocationDetailDialog
        open={detailOpen}
        onOpenChange={setDetailOpen}
        location={detailLocation}
        onLocationUpdated={loadLocations}
      />
    </div>
  )
}
