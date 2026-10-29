// src/components/locations/AddLocationDialog.tsx
// Dialog for trainers to add a new location to their profile

'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { toast } from 'sonner'
import { MapPin, Search } from 'lucide-react'
import { Database } from '@/types/database.types'

type Location = Database['public']['Tables']['locations']['Row']

interface AddLocationDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  trainerId: string
  existingLocationIds: string[]
  onLocationAdded: () => void
}

export function AddLocationDialog({
  open,
  onOpenChange,
  trainerId,
  existingLocationIds,
  onLocationAdded,
}: AddLocationDialogProps) {
  const [allLocations, setAllLocations] = useState<Location[]>([])
  const [filteredLocations, setFilteredLocations] = useState<Location[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedLocationId, setSelectedLocationId] = useState<string | null>(null)
  const [setPrimary, setSetPrimary] = useState(false)
  const [loading, setLoading] = useState(false)
  const [adding, setAdding] = useState(false)

  useEffect(() => {
    if (open) {
      loadLocations()
      setSearchQuery('')
      setSelectedLocationId(null)
      setSetPrimary(false)
    }
  }, [open])

  useEffect(() => {
    filterLocations()
  }, [searchQuery, allLocations])

  const loadLocations = async () => {
    setLoading(true)
    const supabase = createClient()

    const { data, error } = await supabase
      .from('locations')
      .select('*')
      .eq('is_active', true)
      .order('name')

    if (error) {
      console.error('Error loading locations:', error)
      toast.error('Failed to load locations')
    } else {
      // Filter out locations the trainer already has
      const available = (data || []).filter(
        (loc: Location) => !existingLocationIds.includes(loc.id)
      )
      setAllLocations(available)
    }

    setLoading(false)
  }

  const filterLocations = () => {
    if (!searchQuery.trim()) {
      setFilteredLocations(allLocations)
      return
    }

    const query = searchQuery.toLowerCase()
    const filtered = allLocations.filter(
      (loc) =>
        loc.name.toLowerCase().includes(query) ||
        loc.city?.toLowerCase().includes(query) ||
        loc.address.toLowerCase().includes(query)
    )
    setFilteredLocations(filtered)
  }

  const handleAdd = async () => {
    if (!selectedLocationId) {
      toast.error('Please select a location')
      return
    }

    setAdding(true)
    const supabase = createClient()

    try {
      // If setting as primary, first unset all other primaries
      if (setPrimary) {
        await (supabase
          .from('trainer_locations') as any)
          .update({ is_primary: false })
          .eq('trainer_id', trainerId)
      }

      // Add the new location
      const { error } = await supabase
        .from('trainer_locations')
        .insert({
          trainer_id: trainerId,
          location_id: selectedLocationId,
          is_primary: setPrimary
        } as any)

      if (error) throw error

      toast.success('Location added successfully!')
      onLocationAdded()
      onOpenChange(false)
    } catch (error) {
      console.error('Error adding location:', error)
      toast.error('Failed to add location')
    } finally {
      setAdding(false)
    }
  }

  const selectedLocation = allLocations.find((loc) => loc.id === selectedLocationId)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Add Location</DialogTitle>
          <DialogDescription>
            Select a gym location to add to your profile
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Search */}
          <div className="space-y-2">
            <Label htmlFor="search">Search Locations</Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                id="search"
                placeholder="Search by name, city, or address..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>

          {/* Locations List */}
          <div className="space-y-2">
            <Label>Available Locations</Label>
            <div className="border rounded-lg max-h-[300px] overflow-y-auto">
              {loading ? (
                <div className="p-8 text-center text-slate-500">
                  Loading locations...
                </div>
              ) : filteredLocations.length === 0 ? (
                <div className="p-8 text-center text-slate-500">
                  {searchQuery ? 'No locations match your search' : 'No available locations'}
                </div>
              ) : (
                filteredLocations.map((location) => (
                  <button
                    key={location.id}
                    onClick={() => setSelectedLocationId(location.id)}
                    className={`
                      w-full p-4 text-left border-b last:border-b-0 transition-colors
                      ${
                        selectedLocationId === location.id
                          ? 'bg-blue-50 border-l-4 border-l-blue-500'
                          : 'hover:bg-slate-50'
                      }
                    `}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <MapPin className="h-4 w-4 text-slate-400" />
                          <h4 className="font-semibold">{location.name}</h4>
                        </div>
                        <p className="text-sm text-slate-600">{location.address}</p>
                        {location.city && (
                          <p className="text-sm text-slate-500">
                            {location.city}
                            {location.province && `, ${location.province}`}
                          </p>
                        )}
                      </div>
                      {selectedLocationId === location.id && (
                        <Badge variant="default">Selected</Badge>
                      )}
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>

          {/* Primary Location Checkbox */}
          {selectedLocation && (
            <div className="flex items-center space-x-2 p-4 bg-slate-50 rounded-lg">
              <Checkbox
                id="set-primary"
                checked={setPrimary}
                onCheckedChange={(checked) => setSetPrimary(checked === true)}
              />
              <Label
                htmlFor="set-primary"
                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
              >
                Set as primary location
              </Label>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleAdd}
            disabled={!selectedLocationId || adding}
            className="font-bold"
          >
            {adding ? 'Adding...' : 'Add Location'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
