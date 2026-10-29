// src/components/dashboard/LocationsTab.tsx
// Tab 1: Location selection grid

'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { LocationCard } from './LocationCard'
import { LocationMachinesModal } from './LocationMachinesModal'

interface Location {
  id: string
  name: string
  address: string
  city: string | null
  province: string | null
  max_trainers: number
}

interface LocationsTabProps {
  selectedLocationId: string | null
  onLocationSelect: (location: { id: string; name: string }) => void
}

export function LocationsTab({ selectedLocationId, onLocationSelect }: LocationsTabProps) {
  const [locations, setLocations] = useState<Location[]>([])
  const [machineCounts, setMachineCounts] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(true)
  const [machinesModalOpen, setMachinesModalOpen] = useState(false)
  const [selectedMachinesLocation, setSelectedMachinesLocation] = useState<{ id: string; name: string } | null>(null)

  useEffect(() => {
    loadLocations()
  }, [])

  const loadLocations = async () => {
    const supabase = createClient()
    setLoading(true)

    const { data: locationsData } = await supabase
      .from('locations')
      .select('id, name, address, city, province, max_trainers')
      .eq('is_active', true)
      .order('name')

    if (locationsData) {
      setLocations(locationsData as Location[])

      // Fetch machine counts per location via junction table
      const { data: machineLocLinks } = await supabase
        .from('machine_locations')
        .select('location_id, machine_id')

      if (machineLocLinks && machineLocLinks.length > 0) {
        // Use junction table for counts
        // Only count active machines
        const { data: activeMachines } = await supabase
          .from('machines')
          .select('id')
          .eq('is_active', true)

        const activeIds = new Set((activeMachines || []).map((m: any) => m.id))
        const counts: Record<string, number> = {}
        machineLocLinks.forEach((link: any) => {
          if (activeIds.has(link.machine_id)) {
            counts[link.location_id] = (counts[link.location_id] || 0) + 1
          }
        })
        setMachineCounts(counts)
      } else {
        // Fallback: use legacy location_id on machines table
        const { data: machines } = await supabase
          .from('machines')
          .select('location_id')
          .eq('is_active', true)

        if (machines) {
          const counts: Record<string, number> = {}
          machines.forEach((m: any) => {
            if (m.location_id) {
              counts[m.location_id] = (counts[m.location_id] || 0) + 1
            }
          })
          setMachineCounts(counts)
        }
      }
    }

    setLoading(false)
  }

  if (loading) {
    return (
      <div className="py-12 text-center">Loading locations...</div>
    )
  }

  if (locations.length === 0) {
    return (
      <div className="py-12 text-center">
        <p>No locations configured yet.</p>
      </div>
    )
  }

  const handleMachinesClick = (location: Location) => {
    setSelectedMachinesLocation({ id: location.id, name: location.name })
    setMachinesModalOpen(true)
  }

  return (
    <div className="py-4">
      <p className="text-sm mb-4">Select a location to continue:</p>
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        {locations.map((location) => (
          <LocationCard
            key={location.id}
            location={location}
            isSelected={selectedLocationId === location.id}
            machineCount={machineCounts[location.id] || 0}
            onSelect={() => onLocationSelect({ id: location.id, name: location.name })}
            onMachinesClick={() => handleMachinesClick(location)}
          />
        ))}
      </div>

      {selectedMachinesLocation && (
        <LocationMachinesModal
          open={machinesModalOpen}
          onOpenChange={setMachinesModalOpen}
          locationId={selectedMachinesLocation.id}
          locationName={selectedMachinesLocation.name}
        />
      )}
    </div>
  )
}
