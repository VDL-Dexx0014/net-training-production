// src/components/dashboard/LocationMachinesModal.tsx
// Modal to display machines at a location with enlargeable images

'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { X } from 'lucide-react'

interface Machine {
  id: string
  machine_code: string
  machine_name: string
  machine_type: string | null
  image_url: string | null
}

interface LocationMachinesModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  locationId: string
  locationName: string
}

export function LocationMachinesModal({
  open,
  onOpenChange,
  locationId,
  locationName,
}: LocationMachinesModalProps) {
  const [machines, setMachines] = useState<Machine[]>([])
  const [loading, setLoading] = useState(true)
  const [enlargedImage, setEnlargedImage] = useState<string | null>(null)

  useEffect(() => {
    if (open && locationId) {
      loadMachines()
    }
  }, [open, locationId])

  const loadMachines = async () => {
    setLoading(true)
    const supabase = createClient()

    // Try junction table first
    const { data: machineLocLinks } = await supabase
      .from('machine_locations')
      .select('machine_id')
      .eq('location_id', locationId)

    let machineIds: string[] = []

    if (machineLocLinks && machineLocLinks.length > 0) {
      machineIds = machineLocLinks.map((link: any) => link.machine_id)
    }

    let query = supabase
      .from('machines')
      .select('id, machine_code, machine_name, machine_type, image_url')
      .eq('is_active', true)
      .order('machine_code')

    if (machineIds.length > 0) {
      query = query.in('id', machineIds)
    } else {
      // Fallback: use legacy location_id on machines table
      query = query.eq('location_id', locationId)
    }

    const { data } = await query

    setMachines((data as Machine[]) || [])
    setLoading(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto" showCloseButton={true}>
        <DialogHeader>
          <DialogTitle>Machines at {locationName}</DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="py-8 text-center">Loading machines...</div>
        ) : machines.length === 0 ? (
          <div className="py-8 text-center text-muted-foreground">
            No machines found at this location
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 mt-4">
            {machines.map((machine) => (
              <div
                key={machine.id}
                className="border-2 border-slate-200 rounded-lg p-3 hover:border-slate-300 transition-colors"
              >
                {machine.image_url ? (
                  <div
                    className="aspect-square bg-slate-100 rounded-md mb-2 overflow-hidden cursor-pointer hover:opacity-90 transition-opacity"
                    onClick={() => setEnlargedImage(machine.image_url)}
                  >
                    <img
                      src={machine.image_url}
                      alt={machine.machine_name}
                      className="w-full h-full object-cover"
                    />
                  </div>
                ) : (
                  <div className="aspect-square bg-slate-100 rounded-md mb-2 flex items-center justify-center text-slate-400 text-xs">
                    No image
                  </div>
                )}
                <div className="text-center">
                  <div className="font-bold text-sm">{machine.machine_code}</div>
                  <div className="text-xs text-muted-foreground truncate">
                    {machine.machine_name}
                  </div>
                  {machine.machine_type && (
                    <div className="text-xs text-muted-foreground mt-0.5">
                      {machine.machine_type}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Enlarged image overlay — inside DialogContent so Radix doesn't treat clicks as outside */}
        {enlargedImage && (
          <div
            className="absolute inset-0 z-10 bg-black/80 flex items-center justify-center p-4 rounded-lg"
            onClick={() => setEnlargedImage(null)}
          >
            <button
              className="absolute top-4 right-4 text-white hover:text-slate-300 transition-colors"
              onClick={() => setEnlargedImage(null)}
            >
              <X className="h-8 w-8" />
            </button>
            <img
              src={enlargedImage}
              alt="Enlarged machine"
              className="max-w-full max-h-full object-contain rounded-lg"
              onClick={(e) => e.stopPropagation()}
            />
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
