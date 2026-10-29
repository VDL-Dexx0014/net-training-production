// src/components/management/CreateLocationDialog.tsx
// Dialog for management to create a new gym location

'use client'

import { useState, useCallback } from 'react'
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
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'

interface CreateLocationDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onLocationCreated: () => void
}

export function CreateLocationDialog({
  open,
  onOpenChange,
  onLocationCreated,
}: CreateLocationDialogProps) {
  const [formData, setFormData] = useState({
    name: '',
    address: '',
    city: '',
    province: '',
    postal_code: '',
  })
  const [creating, setCreating] = useState(false)

  const hasUnsavedChanges = formData.name.trim() !== '' ||
    formData.address.trim() !== '' ||
    formData.city.trim() !== '' ||
    formData.province.trim() !== '' ||
    formData.postal_code.trim() !== ''

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!formData.name.trim() || !formData.address.trim()) {
      toast.error('Name and address are required')
      return
    }

    setCreating(true)

    try {
      const supabase = createClient()

      const { error } = await supabase.from('locations').insert({
        name: formData.name.trim(),
        address: formData.address.trim(),
        city: formData.city.trim() || null,
        province: formData.province.trim() || null,
        postal_code: formData.postal_code.trim() || null,
        max_trainers: 10, // Default value
        is_active: true,
      } as any)

      if (error) {
        console.error('Error creating location:', error)
        toast.error('Failed to create location')
        return
      }

      toast.success(`Location "${formData.name}" created successfully`)
      setFormData({ name: '', address: '', city: '', province: '', postal_code: '' })
      onOpenChange(false)
      onLocationCreated()
    } catch (err) {
      console.error('Error creating location:', err)
      toast.error('An error occurred while creating the location')
    } finally {
      setCreating(false)
    }
  }

  const handleClose = useCallback(() => {
    if (hasUnsavedChanges) {
      const confirmed = window.confirm(
        'You have unsaved changes. Are you sure you want to close? All changes will be lost.'
      )
      if (!confirmed) return
    }
    setFormData({ name: '', address: '', city: '', province: '', postal_code: '' })
    onOpenChange(false)
  }, [hasUnsavedChanges, onOpenChange])

  const handleDialogChange = (newOpen: boolean) => {
    if (!newOpen && hasUnsavedChanges) {
      const confirmed = window.confirm(
        'You have unsaved changes. Are you sure you want to close? All changes will be lost.'
      )
      if (!confirmed) return
    }
    if (!newOpen) {
      setFormData({ name: '', address: '', city: '', province: '', postal_code: '' })
    }
    onOpenChange(newOpen)
  }

  return (
    <Dialog open={open} onOpenChange={handleDialogChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Add New Location</DialogTitle>
          <DialogDescription>
            Add a new gym location to the system.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleCreate}>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">Location Name *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g. Downtown Fitness"
                required
                disabled={creating}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="address">Address *</Label>
              <Input
                id="address"
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                placeholder="123 Main Street"
                required
                disabled={creating}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="city">City</Label>
                <Input
                  id="city"
                  value={formData.city}
                  onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                  placeholder="Toronto"
                  disabled={creating}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="province">Province</Label>
                <Input
                  id="province"
                  value={formData.province}
                  onChange={(e) => setFormData({ ...formData, province: e.target.value })}
                  placeholder="Ontario"
                  disabled={creating}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="postal_code">Postal Code</Label>
              <Input
                id="postal_code"
                value={formData.postal_code}
                onChange={(e) => setFormData({ ...formData, postal_code: e.target.value })}
                placeholder="M5V 1A1"
                disabled={creating}
              />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={handleClose} disabled={creating}>
              Cancel
            </Button>
            <Button type="submit" disabled={creating}>
              {creating ? 'Creating...' : 'Add Location'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
