// src/components/dashboard/admin/MachineAttributesAdminSection.tsx
// Admin section for managing machine attribute definitions (seat height, resistance, etc.)

'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Plus, Pencil, Trash2 } from 'lucide-react'
import { toast } from 'sonner'

interface AttributeDefinition {
  id: string
  attribute_name: string
  value_type: string
  allowed_values: string[]
  default_value: string | null
  display_order: number
}

export function MachineAttributesAdminSection() {
  const [definitions, setDefinitions] = useState<AttributeDefinition[]>([])
  const [loading, setLoading] = useState(true)
  const [createOpen, setCreateOpen] = useState(false)
  const [editDef, setEditDef] = useState<AttributeDefinition | null>(null)
  const [editOpen, setEditOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  // Form state
  const [formName, setFormName] = useState('')
  const [formType, setFormType] = useState<'numeric' | 'text'>('numeric')
  const [formAllowedValues, setFormAllowedValues] = useState('')
  const [formDefaultValue, setFormDefaultValue] = useState('')

  useEffect(() => {
    loadDefinitions()
  }, [])

  const loadDefinitions = async () => {
    setLoading(true)
    const supabase = createClient()
    const { data, error } = await supabase
      .from('machine_attribute_definitions')
      .select('id, attribute_name, value_type, allowed_values, default_value, display_order')
      .order('display_order')
      .order('attribute_name')
    if (error) {
      toast.error('Failed to load machine attributes')
    } else {
      setDefinitions((data || []) as AttributeDefinition[])
    }
    setLoading(false)
  }

  const resetForm = () => {
    setFormName('')
    setFormType('numeric')
    setFormAllowedValues('')
    setFormDefaultValue('')
  }

  const openCreate = () => {
    resetForm()
    setCreateOpen(true)
  }

  const openEdit = (def: AttributeDefinition) => {
    setEditDef(def)
    setFormName(def.attribute_name)
    setFormType(def.value_type as 'numeric' | 'text')
    setFormAllowedValues(def.allowed_values.join(', '))
    setFormDefaultValue(def.default_value || '')
    setEditOpen(true)
  }

  const parseAllowedValues = (raw: string) =>
    raw.split(',').map(v => v.trim()).filter(Boolean)

  const handleCreate = async () => {
    if (!formName.trim()) {
      toast.error('Attribute name is required')
      return
    }
    setSaving(true)
    const supabase = createClient()
    const maxOrder = definitions.reduce((m, d) => Math.max(m, d.display_order), 0)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase.from('machine_attribute_definitions') as any).insert({
      attribute_name: formName.trim(),
      value_type: formType,
      allowed_values: parseAllowedValues(formAllowedValues),
      default_value: formDefaultValue.trim() || null,
      display_order: maxOrder + 1,
    })
    if (error) {
      toast.error('Failed to create attribute')
    } else {
      toast.success('Attribute created')
      setCreateOpen(false)
      loadDefinitions()
    }
    setSaving(false)
  }

  const handleUpdate = async () => {
    if (!editDef || !formName.trim()) {
      toast.error('Attribute name is required')
      return
    }
    setSaving(true)
    const supabase = createClient()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase.from('machine_attribute_definitions') as any)
      .update({
        attribute_name: formName.trim(),
        value_type: formType,
        allowed_values: parseAllowedValues(formAllowedValues),
        default_value: formDefaultValue.trim() || null,
      })
      .eq('id', editDef.id)
    if (error) {
      toast.error('Failed to update attribute')
    } else {
      toast.success('Attribute updated')
      setEditOpen(false)
      loadDefinitions()
    }
    setSaving(false)
  }

  const handleDelete = async (def: AttributeDefinition) => {
    setDeletingId(def.id)
    const supabase = createClient()

    // Check if any user_machine_attribute_values exist for this definition
    const { count, error: countError } = await supabase
      .from('user_machine_attribute_values')
      .select('id', { count: 'exact', head: true })
      .eq('attribute_definition_id', def.id)

    if (countError) {
      toast.error('Could not check usage')
      setDeletingId(null)
      return
    }

    if ((count ?? 0) > 0) {
      toast.error(`Cannot delete — ${count} saved value${count === 1 ? '' : 's'} exist for this attribute`)
      setDeletingId(null)
      return
    }

    if (!confirm(`Delete attribute "${def.attribute_name}"? This cannot be undone.`)) {
      setDeletingId(null)
      return
    }

    // Also unlink from all machines first
    await supabase.from('machine_attribute_links').delete().eq('attribute_definition_id', def.id)

    const { error } = await supabase.from('machine_attribute_definitions').delete().eq('id', def.id)
    if (error) {
      toast.error('Failed to delete attribute')
    } else {
      toast.success('Attribute deleted')
      loadDefinitions()
    }
    setDeletingId(null)
  }

  const formatAllowedValues = (vals: string[]) => {
    if (vals.length === 0) return <span className="text-slate-400 italic text-xs">Free input</span>
    return <span className="text-xs">{vals.join(', ')}</span>
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h3 className="font-semibold text-lg">
          Machine Attributes{' '}
          <span className="font-normal text-sm">({definitions.length} total)</span>
        </h3>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4 mr-2" />
          Add Attribute
        </Button>
      </div>

      <p className="text-sm text-slate-500 mb-4">
        Attribute definitions used across all machines (e.g. Seat Height, Pin Setting). Link them to specific machines in the Machines tab.
      </p>

      {loading ? (
        <div className="py-8 text-center">Loading attributes...</div>
      ) : definitions.length === 0 ? (
        <div className="py-8 text-center text-slate-500">No machine attributes defined</div>
      ) : (
        <div className="border rounded-lg overflow-hidden overflow-y-auto max-h-[60vh]">
          <table className="w-full">
            <thead className="bg-slate-50 sticky top-0 z-10">
              <tr>
                <th className="text-left px-4 py-3 text-sm font-medium bg-slate-50">Name</th>
                <th className="text-left px-4 py-3 text-sm font-medium bg-slate-50">Type</th>
                <th className="text-left px-4 py-3 text-sm font-medium bg-slate-50">Allowed Values</th>
                <th className="text-left px-4 py-3 text-sm font-medium bg-slate-50">Default</th>
                <th className="text-right px-4 py-3 text-sm font-medium bg-slate-50">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {definitions.map(def => (
                <tr key={def.id} className="hover:bg-slate-50 bg-white">
                  <td className="px-4 py-3 font-medium">{def.attribute_name}</td>
                  <td className="px-4 py-3">
                    <Badge variant="outline" className="capitalize text-xs">{def.value_type}</Badge>
                  </td>
                  <td className="px-4 py-3 max-w-[220px]">
                    {formatAllowedValues(def.allowed_values)}
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-500">
                    {def.default_value ?? <span className="italic text-slate-300">—</span>}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Button variant="ghost" size="sm" onClick={() => openEdit(def)}>
                      <Pencil className="h-4 w-4 mr-1" />
                      Edit
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-red-600 hover:text-red-700 hover:bg-red-50"
                      onClick={() => handleDelete(def)}
                      disabled={deletingId === def.id}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Create Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle>Create Machine Attribute</DialogTitle>
            <DialogDescription>
              Define a new attribute that can be linked to machines (e.g. Seat Height, Pin Setting).
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Name *</Label>
              <Input
                value={formName}
                onChange={e => setFormName(e.target.value)}
                placeholder="e.g. Seat Height"
                disabled={saving}
              />
            </div>
            <div className="space-y-2">
              <Label>Value Type</Label>
              <Select value={formType} onValueChange={v => setFormType(v as 'numeric' | 'text')} disabled={saving}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="numeric">Numeric</SelectItem>
                  <SelectItem value="text">Text</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Allowed Values <span className="text-slate-400 font-normal">(comma-separated — leave blank for free input)</span></Label>
              <Input
                value={formAllowedValues}
                onChange={e => setFormAllowedValues(e.target.value)}
                placeholder="e.g. 1, 2, 3, 4, 5"
                disabled={saving}
              />
            </div>
            <div className="space-y-2">
              <Label>Default Value <span className="text-slate-400 font-normal">(optional)</span></Label>
              <Input
                value={formDefaultValue}
                onChange={e => setFormDefaultValue(e.target.value)}
                placeholder="Optional"
                disabled={saving}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)} disabled={saving}>Cancel</Button>
            <Button onClick={handleCreate} disabled={saving}>{saving ? 'Creating...' : 'Create'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle>Edit Machine Attribute</DialogTitle>
            <DialogDescription>
              Update this attribute definition. Changes apply to all machines it is linked to.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Name *</Label>
              <Input
                value={formName}
                onChange={e => setFormName(e.target.value)}
                disabled={saving}
              />
            </div>
            <div className="space-y-2">
              <Label>Value Type</Label>
              <Select value={formType} onValueChange={v => setFormType(v as 'numeric' | 'text')} disabled={saving}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="numeric">Numeric</SelectItem>
                  <SelectItem value="text">Text</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Allowed Values <span className="text-slate-400 font-normal">(comma-separated — leave blank for free input)</span></Label>
              <Input
                value={formAllowedValues}
                onChange={e => setFormAllowedValues(e.target.value)}
                placeholder="e.g. 1, 2, 3, 4, 5"
                disabled={saving}
              />
            </div>
            <div className="space-y-2">
              <Label>Default Value <span className="text-slate-400 font-normal">(optional)</span></Label>
              <Input
                value={formDefaultValue}
                onChange={e => setFormDefaultValue(e.target.value)}
                disabled={saving}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)} disabled={saving}>Cancel</Button>
            <Button onClick={handleUpdate} disabled={saving}>{saving ? 'Saving...' : 'Save Changes'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
