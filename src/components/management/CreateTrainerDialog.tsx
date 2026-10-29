// src/components/management/CreateTrainerDialog.tsx
// Dialog for management to create a new trainer account with location assignment

'use client'

import { useState, useEffect } from 'react'
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
import { Eye, EyeOff } from 'lucide-react'

interface Location {
  id: string
  name: string
}

interface CreateTrainerDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onTrainerCreated: () => void
}

export function CreateTrainerDialog({
  open,
  onOpenChange,
  onTrainerCreated,
}: CreateTrainerDialogProps) {
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    notes: '',
  })
  const [selectedLocations, setSelectedLocations] = useState<string[]>([])
  const [locations, setLocations] = useState<Location[]>([])
  const [loadingLocations, setLoadingLocations] = useState(false)
  const [setPasswordNow, setSetPasswordNow] = useState(false)
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [creating, setCreating] = useState(false)

  useEffect(() => {
    if (open) {
      loadLocations()
    }
  }, [open])

  const loadLocations = async () => {
    setLoadingLocations(true)
    const supabase = createClient()
    const { data } = await supabase
      .from('locations')
      .select('id, name')
      .eq('is_active', true)
      .order('name')

    setLocations((data as Location[]) || [])
    setLoadingLocations(false)
  }

  const toggleLocation = (locationId: string) => {
    setSelectedLocations(prev =>
      prev.includes(locationId)
        ? prev.filter(id => id !== locationId)
        : [...prev, locationId]
    )
  }

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!formData.firstName.trim() || !formData.lastName.trim() || !formData.email.trim()) {
      toast.error('First name, last name, and email are required')
      return
    }

    if (selectedLocations.length === 0) {
      toast.error('Please select at least one location')
      return
    }

    if (setPasswordNow && password.length < 8) {
      toast.error('Password must be at least 8 characters')
      return
    }

    setCreating(true)

    try {
      const response = await fetch('/api/admin/create-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: formData.email,
          firstName: formData.firstName,
          lastName: formData.lastName,
          phone: formData.phone || null,
          role: 'trainer',
          locationIds: selectedLocations,
          password: setPasswordNow && password ? password : undefined,
        }),
      })

      const result = await response.json()

      if (!response.ok) {
        toast.error(result.error || 'Failed to create instructor account')
        setCreating(false)
        return
      }

      toast.success(
        setPasswordNow
          ? `Instructor account created for ${formData.firstName} ${formData.lastName}. Password has been set — share it with them directly.`
          : `Instructor account created for ${formData.firstName} ${formData.lastName}. They will need to use "Forgot Password" to set their password.`
      )

      setFormData({ firstName: '', lastName: '', email: '', phone: '', notes: '' })
      setSelectedLocations([])
      setSetPasswordNow(false)
      setPassword('')
      setShowPassword(false)
      onOpenChange(false)
      onTrainerCreated()
    } catch (err) {
      console.error('Error creating trainer:', err)
      toast.error('An error occurred while creating the account')
    } finally {
      setCreating(false)
    }
  }

  const handleClose = () => {
    setFormData({ firstName: '', lastName: '', email: '', phone: '', notes: '' })
    setSelectedLocations([])
    setSetPasswordNow(false)
    setPassword('')
    setShowPassword(false)
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Create New Instructor</DialogTitle>
          <DialogDescription>
            Create a new instructor account. You can set a password now to share verbally, or leave it blank and the instructor uses &quot;Forgot Password&quot; to set their own.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleCreate}>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="trainerFirstName">First Name *</Label>
                <Input
                  id="trainerFirstName"
                  value={formData.firstName}
                  onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                  placeholder="First name"
                  required
                  disabled={creating}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="trainerLastName">Last Name *</Label>
                <Input
                  id="trainerLastName"
                  value={formData.lastName}
                  onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                  placeholder="Last name"
                  required
                  disabled={creating}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="trainerEmail">Email *</Label>
              <Input
                id="trainerEmail"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="instructor@example.com"
                required
                disabled={creating}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="trainerPhone">Phone (Optional)</Label>
              <Input
                id="trainerPhone"
                type="tel"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                placeholder="(416) 555-0123"
                disabled={creating}
              />
            </div>

            <div className="space-y-2">
              <Label>Locations *</Label>
              {loadingLocations ? (
                <p className="text-sm text-slate-500">Loading locations...</p>
              ) : locations.length === 0 ? (
                <p className="text-sm text-slate-500">No locations available</p>
              ) : (
                <div className="border rounded-md p-3 space-y-2 max-h-[150px] overflow-y-auto">
                  {locations.map(location => (
                    <div key={location.id} className="flex items-center gap-2">
                      <Checkbox
                        id={`loc-${location.id}`}
                        checked={selectedLocations.includes(location.id)}
                        onCheckedChange={() => toggleLocation(location.id)}
                        disabled={creating}
                      />
                      <label
                        htmlFor={`loc-${location.id}`}
                        className="text-sm cursor-pointer"
                      >
                        {location.name}
                      </label>
                    </div>
                  ))}
                </div>
              )}
              {selectedLocations.length > 0 && (
                <p className="text-xs text-slate-500">
                  {selectedLocations.length} location{selectedLocations.length !== 1 ? 's' : ''} selected
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="trainerNotes">Notes (Optional)</Label>
              <Textarea
                id="trainerNotes"
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="Any additional notes about this instructor..."
                disabled={creating}
                rows={3}
              />
            </div>

            {/* Password section */}
            <div className="border rounded-md p-3 space-y-3 bg-slate-50">
              <div className="flex items-center gap-2">
                <Checkbox
                  id="trainerSetPasswordNow"
                  checked={setPasswordNow}
                  onCheckedChange={(checked) => {
                    setSetPasswordNow(checked === true)
                    if (!checked) { setPassword(''); setShowPassword(false) }
                  }}
                  disabled={creating}
                />
                <Label htmlFor="trainerSetPasswordNow" className="cursor-pointer text-sm font-medium">
                  Set password now (share verbally with instructor)
                </Label>
              </div>
              {setPasswordNow && (
                <div className="space-y-1">
                  <div className="relative">
                    <Input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Min. 8 characters"
                      disabled={creating}
                      autoComplete="new-password"
                      className="pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(v => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                      tabIndex={-1}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  <p className="text-xs text-slate-500">Remind the instructor to change this after their first login.</p>
                </div>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={handleClose} disabled={creating}>
              Cancel
            </Button>
            <Button type="submit" disabled={creating}>
              {creating ? 'Creating...' : 'Create Instructor'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
