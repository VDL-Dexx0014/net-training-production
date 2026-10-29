// src/components/management/EditAdminDialog.tsx
// Dialog for viewing and editing admin (management) user details

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

interface AdminInfo {
  id: string
  first_name: string
  last_name: string
  email: string
  phone?: string | null
  is_active?: boolean
}

interface EditAdminDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  admin: AdminInfo | null
  onAdminUpdated: () => void
}

export function EditAdminDialog({
  open,
  onOpenChange,
  admin,
  onAdminUpdated,
}: EditAdminDialogProps) {
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
  })
  const [saving, setSaving] = useState(false)
  const [archiveDialogOpen, setArchiveDialogOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [actionLoading, setActionLoading] = useState(false)

  useEffect(() => {
    if (admin && open) {
      setFormData({
        firstName: admin.first_name || '',
        lastName: admin.last_name || '',
        email: admin.email || '',
        phone: admin.phone || '',
      })
    }
  }, [admin, open])

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!admin) return

    if (!formData.firstName.trim() || !formData.lastName.trim()) {
      toast.error('First name and last name are required')
      return
    }

    setSaving(true)

    try {
      const supabase = createClient()

      const { error } = await (supabase.from('profiles') as any)
        .update({
          first_name: formData.firstName.trim(),
          last_name: formData.lastName.trim(),
          phone: formData.phone.trim() || null,
        })
        .eq('id', admin.id)

      if (error) {
        console.error('Error updating admin:', error)
        toast.error('Failed to update admin')
        return
      }

      toast.success('Admin updated')
      onOpenChange(false)
      onAdminUpdated()
    } catch (err) {
      console.error('Error updating admin:', err)
      toast.error('An error occurred')
    } finally {
      setSaving(false)
    }
  }

  const handleArchive = async () => {
    if (!admin) return

    setActionLoading(true)
    const supabase = createClient()

    try {
      const { error } = await (supabase.from('profiles') as any)
        .update({
          is_active: false,
          updated_at: new Date().toISOString(),
        })
        .eq('id', admin.id)

      if (error) {
        console.error('Error archiving admin:', error)
        toast.error('Failed to archive admin')
        return
      }

      toast.success('Admin archived successfully')
      setArchiveDialogOpen(false)
      onOpenChange(false)
      onAdminUpdated()
    } catch (error) {
      console.error('Error archiving admin:', error)
      toast.error('Failed to archive admin')
    } finally {
      setActionLoading(false)
    }
  }

  const handleReactivate = async () => {
    if (!admin) return

    setSaving(true)
    const supabase = createClient()

    try {
      const { error } = await (supabase.from('profiles') as any)
        .update({
          is_active: true,
          updated_at: new Date().toISOString(),
        })
        .eq('id', admin.id)

      if (error) {
        console.error('Error reactivating admin:', error)
        toast.error('Failed to reactivate admin')
        return
      }

      toast.success('Admin reactivated successfully')
      onOpenChange(false)
      onAdminUpdated()
    } catch (error) {
      console.error('Error reactivating admin:', error)
      toast.error('Failed to reactivate admin')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!admin) return

    setActionLoading(true)
    const supabase = createClient()

    try {
      // Delete the profile
      const { error } = await supabase
        .from('profiles')
        .delete()
        .eq('id', admin.id)

      if (error) {
        console.error('Error deleting admin:', error)
        toast.error('Failed to delete admin')
        return
      }

      toast.success('Admin deleted permanently')
      setDeleteDialogOpen(false)
      onOpenChange(false)
      onAdminUpdated()
    } catch (error) {
      console.error('Error deleting admin:', error)
      toast.error('Failed to delete admin')
    } finally {
      setActionLoading(false)
    }
  }

  const isActive = admin?.is_active !== false

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[560px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              Edit Admin
              {admin && (
                <Badge
                  variant={isActive ? 'default' : 'secondary'}
                  className={isActive ? 'bg-green-600' : 'bg-slate-500'}
                >
                  {isActive ? 'Active' : 'Archived'}
                </Badge>
              )}
            </DialogTitle>
            <DialogDescription>
              Update admin user details.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSave}>
            <div className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="editAdminFirstName">First Name *</Label>
                  <Input
                    id="editAdminFirstName"
                    value={formData.firstName}
                    onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                    required
                    disabled={saving}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="editAdminLastName">Last Name *</Label>
                  <Input
                    id="editAdminLastName"
                    value={formData.lastName}
                    onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                    required
                    disabled={saving}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="editAdminEmail">Email</Label>
                <Input
                  id="editAdminEmail"
                  type="email"
                  value={formData.email}
                  disabled
                  className="bg-slate-50"
                />
                <p className="text-xs text-slate-400">Email cannot be changed here</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="editAdminPhone">Phone</Label>
                <Input
                  id="editAdminPhone"
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  placeholder="(416) 555-0123"
                  disabled={saving}
                />
              </div>
            </div>

            <DialogFooter className="flex-col sm:flex-row gap-2 pt-2">
              <div className="flex gap-2 mr-auto">
                {isActive ? (
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
            <AlertDialogTitle>Archive Admin</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to archive {admin?.first_name} {admin?.last_name}?
              They will no longer be able to access admin features but data will be preserved.
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
            <AlertDialogTitle>Delete Admin</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to permanently delete {admin?.first_name} {admin?.last_name}?
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
