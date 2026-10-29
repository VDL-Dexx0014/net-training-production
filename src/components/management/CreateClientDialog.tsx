// src/components/management/CreateClientDialog.tsx
// Dialog for trainers/management to create a new client account

'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import { toast } from 'sonner'
import { formatPhoneInput } from '@/lib/utils/phone-formatter'
import { AlertTriangle, Eye, EyeOff } from 'lucide-react'

const INTENSITY_OPTIONS = [
  { value: 'extra_low', label: 'Extra Low' },
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
  { value: 'extra_high', label: 'Extra High' },
]

interface CreateClientDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onClientCreated: () => void
}

export function CreateClientDialog({
  open,
  onOpenChange,
  onClientCreated,
}: CreateClientDialogProps) {
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    intensity: '',
    highRisk: false,
    notes: '',
    emailOptIn: true,
  })
  const [setPasswordNow, setSetPasswordNow] = useState(false)
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [creating, setCreating] = useState(false)

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!formData.firstName.trim() || !formData.lastName.trim() || !formData.email.trim()) {
      toast.error('First name, last name, and email are required')
      return
    }

    if (!formData.intensity) {
      toast.error('Intensity is required')
      return
    }

    if (formData.highRisk && !formData.notes.trim()) {
      toast.error('Notes are required when High Risk is checked')
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
          role: 'client',
          intensity: formData.intensity || null,
          highRisk: formData.highRisk,
          notes: formData.notes || null,
          emailOptIn: formData.emailOptIn,
          password: setPasswordNow && password ? password : undefined,
        }),
      })

      const result = await response.json()

      if (!response.ok) {
        toast.error(result.error || 'Failed to create client account')
        setCreating(false)
        return
      }

      toast.success(`Client account created for ${formData.firstName} ${formData.lastName}.`)

      resetForm()
      onOpenChange(false)
      onClientCreated()

      if (result.userId) {
        window.location.href = `/trainer/client/${result.userId}?tab=profile`
      }
    } catch (err) {
      console.error('Error creating client:', err)
      toast.error('An error occurred while creating the account')
    } finally {
      setCreating(false)
    }
  }

  const resetForm = () => {
    setFormData({
      firstName: '',
      lastName: '',
      email: '',
      phone: '',
      intensity: '',
      highRisk: false,
      notes: '',
      emailOptIn: true,
    })
    setSetPasswordNow(false)
    setPassword('')
    setShowPassword(false)
  }

  const handleClose = () => {
    resetForm()
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[560px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create New Client</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleCreate}>
          <div className="space-y-4 py-2">

            {/* Row 1: First Name / Last Name */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="firstName">First Name *</Label>
                <Input
                  id="firstName"
                  value={formData.firstName}
                  onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                  required
                  disabled={creating}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="lastName">Last Name *</Label>
                <Input
                  id="lastName"
                  value={formData.lastName}
                  onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                  required
                  disabled={creating}
                />
              </div>
            </div>

            {/* Row 2: Phone / Email */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="phone">Phone (Optional)</Label>
                <Input
                  id="phone"
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: formatPhoneInput(e.target.value) })}
                  disabled={creating}
                />
              </div>
              <div className="space-y-1.5">
                <div className="flex items-center gap-2">
                  <Label htmlFor="email">Email *</Label>
                  <div className="flex items-center gap-1.5">
                    <Checkbox
                      id="emailOptIn"
                      checked={formData.emailOptIn}
                      onCheckedChange={(checked) => setFormData({ ...formData, emailOptIn: checked === true })}
                      disabled={creating}
                    />
                    <Label htmlFor="emailOptIn" className="cursor-pointer font-normal text-sm whitespace-nowrap">Opt In</Label>
                  </div>
                </div>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  required
                  disabled={creating}
                />
              </div>
            </div>

            {/* Row 3: High Risk / Intensity */}
            <div className="grid grid-cols-2 gap-4 items-end">
              <div className="space-y-1.5">
                <Label>High Risk Client?</Label>
                <div className="flex items-center gap-2 h-10">
                  <Checkbox
                    id="highRisk"
                    checked={formData.highRisk}
                    onCheckedChange={(checked) => setFormData({ ...formData, highRisk: checked === true })}
                    disabled={creating}
                  />
                  <Label htmlFor="highRisk" className="flex items-center gap-1.5 cursor-pointer font-normal">
                    <AlertTriangle className="h-4 w-4 text-red-500" />
                    Yes
                  </Label>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Intensity *</Label>
                <Select
                  value={formData.intensity}
                  onValueChange={(value) => setFormData({ ...formData, intensity: value })}
                  disabled={creating}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select level" />
                  </SelectTrigger>
                  <SelectContent>
                    {INTENSITY_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Notes */}
            <div className="space-y-1.5">
              <Label htmlFor="clientNotes">
                Notes {formData.highRisk && <span className="text-red-500">*</span>}
              </Label>
              <Textarea
                id="clientNotes"
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder={formData.highRisk ? 'Required for high risk clients...' : ''}
                disabled={creating}
                rows={3}
                className={formData.highRisk ? 'border-red-300 text-red-700 placeholder:text-red-300' : ''}
              />
              {formData.highRisk && !formData.notes.trim() && (
                <p className="text-xs text-red-500">Notes are required for high risk clients</p>
              )}
            </div>

            {/* Password section */}
            <div className="space-y-1.5">
              <p className="text-xs text-slate-500">
                Leave password unset and the client uses &ldquo;Forgot Password&rdquo; to set their own. Or set one now to share verbally.
              </p>
              <div className="border rounded-md p-3 space-y-3 bg-slate-50">
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="setPasswordNow"
                    checked={setPasswordNow}
                    onCheckedChange={(checked) => {
                      setSetPasswordNow(checked === true)
                      if (!checked) { setPassword(''); setShowPassword(false) }
                    }}
                    disabled={creating}
                  />
                  <Label htmlFor="setPasswordNow" className="cursor-pointer text-sm font-medium">
                    Set password now (share verbally with client)
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
                    <p className="text-xs text-slate-500">Remind the client to change this after their first login.</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="flex gap-3 pt-4">
            <Button type="button" variant="outline" onClick={handleClose} disabled={creating} className="flex-1">
              Cancel
            </Button>
            <Button type="submit" disabled={creating} className="flex-1">
              {creating ? 'Creating...' : 'Create Client'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
