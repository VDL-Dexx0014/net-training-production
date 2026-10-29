// src/components/management/EditTrainerDialog.tsx
// Dialog for viewing and editing instructor details

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
import { Archive, Trash2, KeyRound, Eye, EyeOff } from 'lucide-react'

interface TrainerInfo {
  id: string
  first_name: string
  last_name: string
  email: string
  phone?: string | null
  is_active?: boolean
  sessionCount?: number
}

interface EditTrainerDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  trainer: TrainerInfo | null
  onTrainerUpdated: () => void
}

export function EditTrainerDialog({
  open,
  onOpenChange,
  trainer,
  onTrainerUpdated,
}: EditTrainerDialogProps) {
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
  const [newPassword, setNewPassword] = useState('')
  const [showNewPassword, setShowNewPassword] = useState(false)
  const [settingPassword, setSettingPassword] = useState(false)
  const [updatingEmail, setUpdatingEmail] = useState(false)

  useEffect(() => {
    if (trainer && open) {
      setFormData({
        firstName: trainer.first_name || '',
        lastName: trainer.last_name || '',
        email: trainer.email || '',
        phone: trainer.phone || '',
      })
    }
  }, [trainer, open])

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!trainer) return

    if (!formData.firstName.trim() || !formData.lastName.trim()) {
      toast.error('First name and last name are required')
      return
    }

    setSaving(true)

    try {
      const supabase = createClient()

      const newEmail = formData.email.trim().toLowerCase()
      const emailChanged = newEmail !== (trainer.email || '').toLowerCase()

      // Update profile fields
      const { error } = await (supabase.from('profiles') as any)
        .update({
          first_name: formData.firstName.trim(),
          last_name: formData.lastName.trim(),
          phone: formData.phone.trim() || null,
          ...(emailChanged ? { email: newEmail } : {}),
        })
        .eq('id', trainer.id)

      if (error) {
        console.error('Error updating instructor:', error)
        toast.error('Failed to update instructor')
        return
      }

      // If email changed, also update auth record via service-role API
      if (emailChanged) {
        const res = await fetch('/api/admin/update-email', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId: trainer.id, email: newEmail }),
        })
        const data = await res.json()
        if (!res.ok) {
          toast.error(data.error || 'Profile saved but failed to update login email')
          onTrainerUpdated()
          return
        }
      }

      toast.success('Instructor updated')
      onOpenChange(false)
      onTrainerUpdated()
    } catch (err) {
      console.error('Error updating instructor:', err)
      toast.error('An error occurred')
    } finally {
      setSaving(false)
    }
  }

  const handleArchive = async () => {
    if (!trainer) return

    setActionLoading(true)
    const supabase = createClient()

    try {
      const { error } = await (supabase.from('profiles') as any)
        .update({
          is_active: false,
          updated_at: new Date().toISOString(),
        })
        .eq('id', trainer.id)

      if (error) {
        console.error('Error archiving instructor:', error)
        toast.error('Failed to archive instructor')
        return
      }

      toast.success('Instructor archived successfully')
      setArchiveDialogOpen(false)
      onOpenChange(false)
      onTrainerUpdated()
    } catch (error) {
      console.error('Error archiving instructor:', error)
      toast.error('Failed to archive instructor')
    } finally {
      setActionLoading(false)
    }
  }

  const handleReactivate = async () => {
    if (!trainer) return

    setSaving(true)
    const supabase = createClient()

    try {
      const { error } = await (supabase.from('profiles') as any)
        .update({
          is_active: true,
          updated_at: new Date().toISOString(),
        })
        .eq('id', trainer.id)

      if (error) {
        console.error('Error reactivating instructor:', error)
        toast.error('Failed to reactivate instructor')
        return
      }

      toast.success('Instructor reactivated successfully')
      onOpenChange(false)
      onTrainerUpdated()
    } catch (error) {
      console.error('Error reactivating instructor:', error)
      toast.error('Failed to reactivate instructor')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!trainer) return

    setActionLoading(true)
    const supabase = createClient()

    try {
      // Delete related data
      await supabase.from('trainer_locations').delete().eq('trainer_id', trainer.id)
      await supabase.from('trainer_clients').delete().eq('trainer_id', trainer.id)

      // Delete the profile
      const { error } = await supabase
        .from('profiles')
        .delete()
        .eq('id', trainer.id)

      if (error) {
        console.error('Error deleting instructor:', error)
        toast.error('Failed to delete instructor')
        return
      }

      toast.success('Instructor deleted permanently')
      setDeleteDialogOpen(false)
      onOpenChange(false)
      onTrainerUpdated()
    } catch (error) {
      console.error('Error deleting instructor:', error)
      toast.error('Failed to delete instructor')
    } finally {
      setActionLoading(false)
    }
  }

  const handleSetPassword = async () => {
    if (!trainer) return
    if (newPassword.length < 8) {
      toast.error('Password must be at least 8 characters')
      return
    }
    setSettingPassword(true)
    try {
      const res = await fetch('/api/admin/set-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: trainer.id, password: newPassword }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error || 'Failed to set password')
        return
      }
      toast.success('Password updated — share it with the instructor directly')
      setNewPassword('')
      setShowNewPassword(false)
    } catch {
      toast.error('An error occurred')
    } finally {
      setSettingPassword(false)
    }
  }

  const isActive = trainer?.is_active !== false
  const canDelete = (trainer?.sessionCount || 0) === 0

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              Edit Instructor
              {trainer && (
                <Badge
                  variant={isActive ? 'default' : 'secondary'}
                  className={isActive ? 'bg-green-600' : 'bg-slate-500'}
                >
                  {isActive ? 'Active' : 'Archived'}
                </Badge>
              )}
            </DialogTitle>
            <DialogDescription>
              Update instructor details.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSave}>
            <div className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="editFirstName">First Name *</Label>
                  <Input
                    id="editFirstName"
                    value={formData.firstName}
                    onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                    required
                    disabled={saving}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="editLastName">Last Name *</Label>
                  <Input
                    id="editLastName"
                    value={formData.lastName}
                    onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                    required
                    disabled={saving}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="editEmail">Email</Label>
                <Input
                  id="editEmail"
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  disabled={saving || updatingEmail}
                  required
                />
                <p className="text-xs text-slate-400">Changing email updates their login immediately — no confirmation email sent.</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="editPhone">Phone</Label>
                <Input
                  id="editPhone"
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  placeholder="(416) 555-0123"
                  disabled={saving}
                />
              </div>

              {/* Force password reset */}
              <div className="border rounded-md p-3 space-y-2 bg-slate-50">
                <Label className="flex items-center gap-2 text-sm font-medium">
                  <KeyRound className="h-4 w-4 text-slate-500" />
                  Set New Password
                </Label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Input
                      type={showNewPassword ? 'text' : 'password'}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="Min. 8 characters"
                      disabled={settingPassword || saving}
                      autoComplete="new-password"
                      className="pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPassword(v => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                      tabIndex={-1}
                    >
                      {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleSetPassword}
                    disabled={!newPassword || settingPassword || saving}
                  >
                    {settingPassword ? 'Saving...' : 'Set'}
                  </Button>
                </div>
                <p className="text-xs text-slate-500">Overrides their current password immediately.</p>
              </div>
            </div>

            <DialogFooter className="flex-col sm:flex-row gap-2">
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
                {canDelete && (
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
            <AlertDialogTitle>Archive Instructor</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to archive {trainer?.first_name} {trainer?.last_name}?
              They will no longer appear in the active instructors list but data will be preserved.
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
            <AlertDialogTitle>Delete Instructor</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to permanently delete {trainer?.first_name} {trainer?.last_name}?
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
