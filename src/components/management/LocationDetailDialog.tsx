// src/components/management/LocationDetailDialog.tsx
// Dialog for management to view and edit a gym location

'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { Archive, Trash2 } from 'lucide-react'

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

interface LocationDetailDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  location: Location | null
  onLocationUpdated: () => void
}

export function LocationDetailDialog({
  open,
  onOpenChange,
  location,
  onLocationUpdated,
}: LocationDetailDialogProps) {
  const [formData, setFormData] = useState({
    name: '',
    address: '',
    city: '',
    province: '',
    postal_code: '',
  })
  const [saving, setSaving] = useState(false)
  const [sessionCount, setSessionCount] = useState(0)
  const [archiveDialogOpen, setArchiveDialogOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [actionLoading, setActionLoading] = useState(false)

  useEffect(() => {
    if (location && open) {
      setFormData({
        name: location.name,
        address: location.address,
        city: location.city || '',
        province: location.province || '',
        postal_code: location.postal_code || '',
      })
      loadSessionCount(location.id)
    }
  }, [location, open])

  const loadSessionCount = async (locationId: string) => {
    const supabase = createClient()
    const { count } = await supabase
      .from('sessions')
      .select('*', { count: 'exact', head: true })
      .eq('location_id', locationId)

    setSessionCount(count || 0)
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!location) return

    if (!formData.name.trim() || !formData.address.trim()) {
      toast.error('Name and address are required')
      return
    }

    setSaving(true)

    try {
      const supabase = createClient()

      const { error } = await (supabase.from('locations') as any)
        .update({
          name: formData.name.trim(),
          address: formData.address.trim(),
          city: formData.city.trim() || null,
          province: formData.province.trim() || null,
          postal_code: formData.postal_code.trim() || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', location.id)

      if (error) {
        console.error('Error updating location:', error)
        toast.error('Failed to update location')
        return
      }

      toast.success('Location updated successfully')
      onOpenChange(false)
      onLocationUpdated()
    } catch (err) {
      console.error('Error updating location:', err)
      toast.error('An error occurred while updating the location')
    } finally {
      setSaving(false)
    }
  }

  const handleArchive = async () => {
    if (!location) return

    setActionLoading(true)
    const supabase = createClient()

    try {
      const { error } = await (supabase.from('locations') as any)
        .update({
          is_active: false,
          updated_at: new Date().toISOString(),
        })
        .eq('id', location.id)

      if (error) {
        console.error('Error archiving location:', error)
        toast.error('Failed to archive location')
        return
      }

      toast.success('Location archived successfully')
      setArchiveDialogOpen(false)
      onOpenChange(false)
      onLocationUpdated()
    } catch (error) {
      console.error('Error archiving location:', error)
      toast.error('Failed to archive location')
    } finally {
      setActionLoading(false)
    }
  }

  const handleReactivate = async () => {
    if (!location) return

    setSaving(true)
    const supabase = createClient()

    try {
      const { error } = await (supabase.from('locations') as any)
        .update({
          is_active: true,
          updated_at: new Date().toISOString(),
        })
        .eq('id', location.id)

      if (error) {
        console.error('Error reactivating location:', error)
        toast.error('Failed to reactivate location')
        return
      }

      toast.success('Location reactivated successfully')
      onOpenChange(false)
      onLocationUpdated()
    } catch (error) {
      console.error('Error reactivating location:', error)
      toast.error('Failed to reactivate location')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!location) return

    setActionLoading(true)
    const supabase = createClient()

    try {
      // Delete related data
      await supabase.from('trainer_locations').delete().eq('location_id', location.id)
      await supabase.from('machine_locations').delete().eq('location_id', location.id)

      // Delete the location
      const { error } = await supabase
        .from('locations')
        .delete()
        .eq('id', location.id)

      if (error) {
        console.error('Error deleting location:', error)
        toast.error('Failed to delete location')
        return
      }

      toast.success('Location deleted permanently')
      setDeleteDialogOpen(false)
      onOpenChange(false)
      onLocationUpdated()
    } catch (error) {
      console.error('Error deleting location:', error)
      toast.error('Failed to delete location')
    } finally {
      setActionLoading(false)
    }
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              Location Details
              {location && (
                <Badge
                  variant={location.is_active ? 'default' : 'secondary'}
                  className={location.is_active ? 'bg-green-600' : 'bg-slate-500'}
                >
                  {location.is_active ? 'Active' : 'Archived'}
                </Badge>
              )}
            </DialogTitle>
            <DialogDescription>
              View and edit location information.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSave}>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="detail-name">Location Name *</Label>
                <Input
                  id="detail-name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                  disabled={saving}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="detail-address">Address *</Label>
                <Input
                  id="detail-address"
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  required
                  disabled={saving}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="detail-city">City</Label>
                  <Input
                    id="detail-city"
                    value={formData.city}
                    onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                    disabled={saving}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="detail-province">Province</Label>
                  <Input
                    id="detail-province"
                    value={formData.province}
                    onChange={(e) => setFormData({ ...formData, province: e.target.value })}
                    disabled={saving}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="detail-postal">Postal Code</Label>
                <Input
                  id="detail-postal"
                  value={formData.postal_code}
                  onChange={(e) => setFormData({ ...formData, postal_code: e.target.value })}
                  disabled={saving}
                />
              </div>
            </div>

            <DialogFooter className="flex-col sm:flex-row gap-2">
              <div className="flex gap-2 mr-auto">
                {location?.is_active ? (
                  sessionCount === 0 ? (
                    <Button
                      type="button"
                      variant="outline"
                      className="text-amber-600 border-amber-300 hover:bg-amber-50"
                      onClick={() => setArchiveDialogOpen(true)}
                      disabled={saving}
                    >
                      <Archive className="h-4 w-4 mr-2" />
                      Archive
                    </Button>
                  ) : (
                    <p className="text-xs text-slate-500 self-center">
                      Cannot archive: {sessionCount} session{sessionCount !== 1 ? 's' : ''} associated
                    </p>
                  )
                ) : (
                  <Button
                    type="button"
                    variant="outline"
                    className="text-green-600 border-green-300 hover:bg-green-50"
                    onClick={handleReactivate}
                    disabled={saving}
                  >
                    Reactivate
                  </Button>
                )}
                {sessionCount === 0 && (
                  <Button
                    type="button"
                    variant="outline"
                    className="text-red-600 border-red-300 hover:bg-red-50"
                    onClick={() => setDeleteDialogOpen(true)}
                    disabled={saving}
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete
                  </Button>
                )}
              </div>
              <div className="flex gap-2">
                <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
                  Cancel
                </Button>
                <Button type="submit" disabled={saving}>
                  {saving ? 'Saving...' : 'Save Changes'}
                </Button>
              </div>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Archive Confirmation Dialog */}
      <AlertDialog open={archiveDialogOpen} onOpenChange={setArchiveDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Archive Location</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to archive "{location?.name}"?
              It will no longer appear in the active locations list but data will be preserved.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={actionLoading}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleArchive}
              disabled={actionLoading}
              className="bg-amber-600 hover:bg-amber-700"
            >
              {actionLoading ? 'Archiving...' : 'Archive'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Location</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to permanently delete "{location?.name}"?
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={actionLoading}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={actionLoading}
              className="bg-red-600 hover:bg-red-700"
            >
              {actionLoading ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
