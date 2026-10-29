// src/components/locations/ManageLocationsCard.tsx
// Card for trainers to manage their gym locations

'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { AddLocationDialog } from './AddLocationDialog'
import { toast } from 'sonner'
import { MapPin, Plus, X, Star } from 'lucide-react'
import { Database } from '@/types/database.types'
import { getLocationColor } from '@/lib/utils/location-colors'

type Location = Database['public']['Tables']['locations']['Row']

interface LocationWithPrimary {
  location: Location
  isPrimary: boolean
  trainerLocationId: string
}

interface ManageLocationsCardProps {
  trainerId: string
  locations: LocationWithPrimary[]
  onLocationsChange: () => void
}

export function ManageLocationsCard({
  trainerId,
  locations,
  onLocationsChange,
}: ManageLocationsCardProps) {
  const [addDialogOpen, setAddDialogOpen] = useState(false)
  const [removing, setRemoving] = useState<string | null>(null)

  const handleRemove = async (trainerLocationId: string, locationName: string) => {
    if (locations.length === 1) {
      toast.error('You must have at least one location')
      return
    }

    if (!confirm(`Remove ${locationName} from your locations?`)) {
      return
    }

    setRemoving(trainerLocationId)
    const supabase = createClient()

    try {
      const { error } = await supabase
        .from('trainer_locations')
        .delete()
        .eq('id', trainerLocationId)

      if (error) throw error

      toast.success('Location removed successfully!')
      onLocationsChange()
    } catch (error) {
      console.error('Error removing location:', error)
      toast.error('Failed to remove location')
    } finally {
      setRemoving(null)
    }
  }

  const handleSetPrimary = async (trainerLocationId: string, locationName: string) => {
    const supabase = createClient()

    try {
      // Unset all primaries first
      await (supabase
        .from('trainer_locations') as any)
        .update({ is_primary: false })
        .eq('trainer_id', trainerId)

      // Set this one as primary
      const { error } = await (supabase
        .from('trainer_locations') as any)
        .update({ is_primary: true })
        .eq('id', trainerLocationId)

      if (error) throw error

      toast.success(`${locationName} set as primary location`)
      onLocationsChange()
    } catch (error) {
      console.error('Error setting primary location:', error)
      toast.error('Failed to set primary location')
    }
  }

  const existingLocationIds = locations.map((loc) => loc.location.id)

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-2">
              <MapPin className="h-5 w-5 text-slate-500" />
              <div>
                <CardTitle>My Locations</CardTitle>
                <CardDescription>
                  Manage the gym locations where you train clients. Colors match your availability calendar.
                </CardDescription>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setAddDialogOpen(true)}
              className="font-bold"
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Location
            </Button>
          </div>
        </CardHeader>

        <CardContent>
          {locations.length === 0 ? (
            <div className="text-center py-8 text-slate-500">
              <MapPin className="h-12 w-12 mx-auto mb-3 text-slate-300" />
              <p>No locations added yet</p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setAddDialogOpen(true)}
                className="mt-4 font-bold"
              >
                Add Your First Location
              </Button>
            </div>
          ) : (
            <div className="grid gap-3 md:grid-cols-2">
              {locations.map(({ location, isPrimary, trainerLocationId }) => {
                const locationColors = getLocationColor(location.name)
                return (
                <div
                  key={trainerLocationId}
                  className={`
                    relative p-4 rounded-lg border transition-all
                    ${locationColors.bg} ${locationColors.border}
                  `}
                >
                  {/* Remove Button */}
                  {locations.length > 1 && (
                    <button
                      onClick={() => handleRemove(trainerLocationId, location.name)}
                      disabled={removing === trainerLocationId}
                      className="absolute top-2 right-2 p-1 rounded hover:bg-white/50 transition-colors"
                      title="Remove location"
                    >
                      <X className="h-4 w-4 text-slate-400 hover:text-red-500" />
                    </button>
                  )}

                  {/* Location Info */}
                  <div className="pr-8">
                    <div className="flex items-center gap-2 mb-2">
                      <h3 className="font-semibold">{location.name}</h3>
                      {isPrimary && (
                        <Badge variant="default" className="text-xs">
                          <Star className="h-3 w-3 mr-1" />
                          Primary
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm text-slate-600 mb-1">{location.address}</p>
                    {location.city && (
                      <p className="text-sm text-slate-500">
                        {location.city}
                        {location.province && `, ${location.province}`}
                      </p>
                    )}

                    {/* Set Primary Button */}
                    {!isPrimary && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleSetPrimary(trainerLocationId, location.name)}
                        className="mt-2 h-7 text-xs"
                      >
                        <Star className="h-3 w-3 mr-1" />
                        Set as Primary
                      </Button>
                    )}
                  </div>
                </div>
              )})}
            </div>
          )}
        </CardContent>
      </Card>

      <AddLocationDialog
        open={addDialogOpen}
        onOpenChange={setAddDialogOpen}
        trainerId={trainerId}
        existingLocationIds={existingLocationIds}
        onLocationAdded={onLocationsChange}
      />
    </>
  )
}
