// src/components/dashboard/admin/CreateMachineDialog.tsx
// Dialog for creating a new machine with optional locations, manufacturer, and image upload

'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { MachineImageUpload } from '@/components/machine/MachineImageUpload'

interface CreateMachineDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  locations: Array<{ id: string; name: string }>
  preselectedLocationId?: string
  onMachineCreated: () => void
}

export function CreateMachineDialog({
  open,
  onOpenChange,
  locations,
  preselectedLocationId,
  onMachineCreated,
}: CreateMachineDialogProps) {
  const [formData, setFormData] = useState({
    machine_code: '',
    machine_name: '',
    machine_type: '',
    manufacturer: '',
    description: '',
    notes: '',
    image_url: null as string | null,
  })
  const [selectedLocationIds, setSelectedLocationIds] = useState<string[]>(
    preselectedLocationId ? [preselectedLocationId] : []
  )
  const [creating, setCreating] = useState(false)

  const toggleLocation = (locationId: string) => {
    setSelectedLocationIds((prev) =>
      prev.includes(locationId)
        ? prev.filter((id) => id !== locationId)
        : [...prev, locationId]
    )
  }

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!formData.machine_code.trim() || !formData.machine_name.trim()) {
      toast.error('Code and name are required')
      return
    }

    setCreating(true)

    try {
      const supabase = createClient()

      // Keep legacy location_id in sync (first selected location, or null)
      const primaryLocationId = selectedLocationIds.length > 0 ? selectedLocationIds[0] : null

      const { data: newMachine, error } = await (supabase.from('machines') as any).insert({
        location_id: primaryLocationId,
        machine_code: formData.machine_code.trim(),
        machine_name: formData.machine_name.trim(),
        machine_type: formData.machine_type.trim(),
        manufacturer: formData.manufacturer.trim() || null,
        description: formData.description.trim() || null,
        notes: formData.notes.trim() || null,
        image_url: formData.image_url || null,
        is_active: true,
      }).select('id').single()

      if (error) {
        console.error('Error creating machine:', error)
        toast.error('Failed to create machine')
        return
      }

      // Insert into machine_locations junction table
      if (newMachine && selectedLocationIds.length > 0) {
        const rows = selectedLocationIds.map((locId) => ({
          machine_id: newMachine.id,
          location_id: locId,
        }))
        const { error: locError } = await supabase
          .from('machine_locations')
          .insert(rows as any)

        if (locError) {
          console.error('Error saving machine locations:', locError)
          toast.error('Machine created but location assignments failed')
        }
      }

      toast.success(`Machine "${formData.machine_name}" created`)
      setFormData({
        machine_code: '',
        machine_name: '',
        machine_type: '',
        manufacturer: '',
        description: '',
        notes: '',
        image_url: null,
      })
      setSelectedLocationIds(preselectedLocationId ? [preselectedLocationId] : [])
      onOpenChange(false)
      onMachineCreated()
    } catch (err) {
      console.error('Error creating machine:', err)
      toast.error('An error occurred')
    } finally {
      setCreating(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add New Machine</DialogTitle>
          <DialogDescription>Add a new machine. You can configure attributes after creation.</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleCreate}>
          <div className="space-y-4 py-4">
            {/* Top section: Image + fields side by side */}
            <div className="flex gap-6">
              {/* Image upload */}
              <div className="flex-shrink-0">
                <Label className="text-sm mb-2 block">Photo</Label>
                <MachineImageUpload
                  machineCode={formData.machine_code || 'new'}
                  currentImageUrl={formData.image_url}
                  onImageUploaded={(url) => setFormData({ ...formData, image_url: url })}
                  onImageRemoved={() => setFormData({ ...formData, image_url: null })}
                  disabled={creating}
                />
              </div>

              {/* Form fields */}
              <div className="flex-1 space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>Machine Code *</Label>
                    <Input
                      value={formData.machine_code}
                      onChange={(e) => setFormData({ ...formData, machine_code: e.target.value })}
                      placeholder="e.g. A1"
                      required
                      disabled={creating}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Machine Name *</Label>
                    <Input
                      value={formData.machine_name}
                      onChange={(e) => setFormData({ ...formData, machine_name: e.target.value })}
                      placeholder="e.g. Chest Press"
                      required
                      disabled={creating}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Machine Type</Label>
                  <Input
                    value={formData.machine_type}
                    onChange={(e) => setFormData({ ...formData, machine_type: e.target.value })}
                    placeholder="e.g. resistance"
                    disabled={creating}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Manufacturer</Label>
                  <Input
                    value={formData.manufacturer}
                    onChange={(e) => setFormData({ ...formData, manufacturer: e.target.value })}
                    placeholder="e.g. Technogym"
                    disabled={creating}
                  />
                </div>
              </div>
            </div>

            {/* Locations multi-select */}
            <div className="space-y-2">
              <Label>Locations</Label>
              <div className="border rounded-lg p-3 space-y-2 max-h-[140px] overflow-y-auto">
                {locations.length === 0 ? (
                  <p className="text-sm text-slate-400 italic">No locations available</p>
                ) : (
                  locations.map((loc) => (
                    <div key={loc.id} className="flex items-center gap-2">
                      <Checkbox
                        id={`loc-create-${loc.id}`}
                        checked={selectedLocationIds.includes(loc.id)}
                        onCheckedChange={() => toggleLocation(loc.id)}
                        disabled={creating}
                      />
                      <Label
                        htmlFor={`loc-create-${loc.id}`}
                        className="text-sm font-normal cursor-pointer"
                      >
                        {loc.name}
                      </Label>
                    </div>
                  ))
                )}
              </div>
              {selectedLocationIds.length === 0 && (
                <p className="text-xs text-slate-400">No locations selected</p>
              )}
            </div>

            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Optional description"
                disabled={creating}
                rows={2}
              />
            </div>

            <div className="space-y-2">
              <Label>Notes</Label>
              <Textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="Optional notes"
                disabled={creating}
                rows={2}
              />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={creating}>
              Cancel
            </Button>
            <Button type="submit" disabled={creating}>
              {creating ? 'Creating...' : 'Add Machine'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
