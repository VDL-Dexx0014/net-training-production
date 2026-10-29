// src/components/dashboard/admin/EditMachineDialog.tsx
// Dialog for editing an existing machine with image upload and attribute management

'use client'

import { useState, useEffect, useRef } from 'react'
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
import {
  MachineAttributeLinkManager,
  type MachineAttributeLinkManagerRef,
} from '@/components/machine/MachineAttributeLinkManager'

interface Machine {
  id: string
  location_id: string | null
  machine_code: string
  machine_type: string
  machine_name: string
  description: string | null
  body_zone: string | null
  is_active: boolean
  notes: string | null
  image_url: string | null
  manufacturer: string | null
}

interface EditMachineDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  machine: Machine | null
  locations: Array<{ id: string; name: string }>
  onMachineUpdated: () => void
}

export function EditMachineDialog({
  open,
  onOpenChange,
  machine,
  locations,
  onMachineUpdated,
}: EditMachineDialogProps) {
  const [formData, setFormData] = useState({
    machine_code: '',
    machine_name: '',
    machine_type: '',
    manufacturer: '',
    description: '',
    notes: '',
    is_active: true,
    image_url: null as string | null,
  })
  const [selectedLocationIds, setSelectedLocationIds] = useState<string[]>([])
  const [saving, setSaving] = useState(false)
  const attrLinkRef = useRef<MachineAttributeLinkManagerRef>(null)

  useEffect(() => {
    if (machine && open) {
      setFormData({
        machine_code: machine.machine_code,
        machine_name: machine.machine_name,
        machine_type: machine.machine_type,
        manufacturer: machine.manufacturer || '',
        description: machine.description || '',
        notes: machine.notes || '',
        is_active: machine.is_active,
        image_url: machine.image_url,
      })

      // Load machine locations from junction table
      loadMachineLocations(machine.id)
    }
  }, [machine, open])

  const loadMachineLocations = async (machineId: string) => {
    const supabase = createClient()
    const { data, error } = await supabase
      .from('machine_locations')
      .select('location_id')
      .eq('machine_id', machineId)

    if (error) {
      console.error('Error loading machine locations:', error)
      // Fallback: use the legacy location_id field
      if (machine?.location_id) {
        setSelectedLocationIds([machine.location_id])
      } else {
        setSelectedLocationIds([])
      }
      return
    }

    const ids = (data || []).map((row: { location_id: string }) => row.location_id)
    // If junction table is empty but legacy location_id exists, use that
    if (ids.length === 0 && machine?.location_id) {
      setSelectedLocationIds([machine.location_id])
    } else {
      setSelectedLocationIds(ids)
    }
  }

  const toggleLocation = (locationId: string) => {
    setSelectedLocationIds((prev) =>
      prev.includes(locationId)
        ? prev.filter((id) => id !== locationId)
        : [...prev, locationId]
    )
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!machine) return

    if (!formData.machine_code.trim() || !formData.machine_name.trim()) {
      toast.error('Code and name are required')
      return
    }

    setSaving(true)

    try {
      const supabase = createClient()

      // Keep legacy location_id in sync (first selected location, or null)
      const primaryLocationId = selectedLocationIds.length > 0 ? selectedLocationIds[0] : null

      const { error } = await (supabase.from('machines') as any)
        .update({
          location_id: primaryLocationId,
          machine_code: formData.machine_code.trim(),
          machine_name: formData.machine_name.trim(),
          machine_type: formData.machine_type.trim(),
          manufacturer: formData.manufacturer.trim() || null,
          description: formData.description.trim() || null,
          notes: formData.notes.trim() || null,
          is_active: formData.is_active,
          image_url: formData.image_url || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', machine.id)

      if (error) {
        console.error('Error updating machine:', error)
        toast.error('Failed to update machine')
        return
      }

      // Sync machine_locations junction table
      const { error: deleteError } = await supabase
        .from('machine_locations')
        .delete()
        .eq('machine_id', machine.id)

      if (deleteError) {
        console.error('Error clearing machine locations:', deleteError)
      }

      if (selectedLocationIds.length > 0) {
        const rows = selectedLocationIds.map((locId) => ({
          machine_id: machine.id,
          location_id: locId,
        }))
        const { error: insertError } = await supabase
          .from('machine_locations')
          .insert(rows as any)

        if (insertError) {
          console.error('Error saving machine locations:', insertError)
          toast.error('Machine saved but location assignments failed')
        }
      }

      // Save attribute links
      if (attrLinkRef.current) {
        const { error: attrError } = await attrLinkRef.current.save()
        if (attrError) {
          console.error('Error saving attribute links:', attrError)
          toast.error('Machine saved but attribute links failed to save')
        }
      }

      toast.success('Machine updated')
      onOpenChange(false)
      onMachineUpdated()
    } catch (err) {
      console.error('Error updating machine:', err)
      toast.error('An error occurred')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Machine</DialogTitle>
          <DialogDescription>Update machine details, image, and attributes.</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSave}>
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
                  disabled={saving}
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
                      required
                      disabled={saving}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Machine Name *</Label>
                    <Input
                      value={formData.machine_name}
                      onChange={(e) => setFormData({ ...formData, machine_name: e.target.value })}
                      required
                      disabled={saving}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Machine Type</Label>
                  <Input
                    value={formData.machine_type}
                    onChange={(e) => setFormData({ ...formData, machine_type: e.target.value })}
                    disabled={saving}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Manufacturer</Label>
                  <Input
                    value={formData.manufacturer}
                    onChange={(e) => setFormData({ ...formData, manufacturer: e.target.value })}
                    placeholder="e.g. Technogym"
                    disabled={saving}
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
                        id={`loc-edit-${loc.id}`}
                        checked={selectedLocationIds.includes(loc.id)}
                        onCheckedChange={() => toggleLocation(loc.id)}
                        disabled={saving}
                      />
                      <Label
                        htmlFor={`loc-edit-${loc.id}`}
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
                disabled={saving}
                rows={2}
              />
            </div>

            <div className="space-y-2">
              <Label>Notes</Label>
              <Textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                disabled={saving}
                rows={2}
              />
            </div>

            <div className="flex items-center gap-2 p-3 bg-slate-50 rounded-lg">
              <input
                type="checkbox"
                id="is_active"
                checked={formData.is_active}
                onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                disabled={saving}
                className="rounded"
              />
              <Label htmlFor="is_active" className="cursor-pointer">
                Machine is active
              </Label>
            </div>

            {/* Attribute link management */}
            {machine && (
              <div className="border-t pt-4">
                <MachineAttributeLinkManager
                  ref={attrLinkRef}
                  machineId={machine.id}
                  disabled={saving}
                />
              </div>
            )}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? 'Saving...' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
