// src/components/machine/MachineAttributeLinkManager.tsx
// Manages which attribute definitions are linked to a machine and their sort order
// Also allows creating new attribute definitions inline

'use client'

import { useEffect, useState, useImperativeHandle, forwardRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { ChevronUp, ChevronDown, GripVertical, Trash2, Plus, X } from 'lucide-react'
import { toast } from 'sonner'

interface AttributeDefinition {
  id: string
  attribute_name: string
  value_type: string
  allowed_values: string[]
  default_value: string | null
  display_order: number
}

interface LinkedAttribute {
  definitionId: string
  attributeName: string
}

export interface MachineAttributeLinkManagerRef {
  save: () => Promise<{ error: any }>
  hasChanges: () => boolean
}

interface MachineAttributeLinkManagerProps {
  machineId: string
  disabled?: boolean
}

export const MachineAttributeLinkManager = forwardRef<
  MachineAttributeLinkManagerRef,
  MachineAttributeLinkManagerProps
>(function MachineAttributeLinkManager({ machineId, disabled = false }, ref) {
  const [allDefinitions, setAllDefinitions] = useState<AttributeDefinition[]>([])
  const [linkedAttributes, setLinkedAttributes] = useState<LinkedAttribute[]>([])
  const [initialLinked, setInitialLinked] = useState<string>('')
  const [loading, setLoading] = useState(true)

  // New attribute definition form state
  const [showNewForm, setShowNewForm] = useState(false)
  const [newAttrName, setNewAttrName] = useState('')
  const [newAttrType, setNewAttrType] = useState<'numeric' | 'text'>('numeric')
  const [newAttrAllowedValues, setNewAttrAllowedValues] = useState('')
  const [newAttrDefaultValue, setNewAttrDefaultValue] = useState('')
  const [savingNew, setSavingNew] = useState(false)

  // Edit default value state
  const [editingDefaultId, setEditingDefaultId] = useState<string | null>(null)
  const [editingDefaultValue, setEditingDefaultValue] = useState('')

  useEffect(() => {
    if (machineId) {
      loadData()
    }
  }, [machineId])

  const loadData = async () => {
    setLoading(true)
    const supabase = createClient()

    const [defsRes, linksRes] = await Promise.all([
      supabase
        .from('machine_attribute_definitions')
        .select('id, attribute_name, value_type, allowed_values, default_value, display_order')
        .order('display_order'),
      supabase
        .from('machine_attribute_links')
        .select('attribute_definition_id, sort_order')
        .eq('machine_id', machineId)
        .order('sort_order'),
    ])

    const defs = (defsRes.data || []) as AttributeDefinition[]
    setAllDefinitions(defs)

    const links = (linksRes.data || []) as Array<{
      attribute_definition_id: string
      sort_order: number
    }>

    const linked: LinkedAttribute[] = links
      .map((link) => {
        const def = defs.find((d) => d.id === link.attribute_definition_id)
        if (!def) return null
        return { definitionId: def.id, attributeName: def.attribute_name }
      })
      .filter((x): x is LinkedAttribute => x !== null)

    setLinkedAttributes(linked)
    setInitialLinked(JSON.stringify(linked.map((l) => l.definitionId)))
    setLoading(false)
  }

  useImperativeHandle(ref, () => ({
    save: async () => {
      const supabase = createClient()

      const { error: deleteError } = await supabase
        .from('machine_attribute_links')
        .delete()
        .eq('machine_id', machineId)

      if (deleteError) return { error: deleteError }

      if (linkedAttributes.length > 0) {
        const rows = linkedAttributes.map((attr, index) => ({
          machine_id: machineId,
          attribute_definition_id: attr.definitionId,
          sort_order: index + 1,
        }))

        const { error: insertError } = await supabase
          .from('machine_attribute_links')
          .insert(rows as any)

        if (insertError) return { error: insertError }
      }

      setInitialLinked(JSON.stringify(linkedAttributes.map((l) => l.definitionId)))
      return { error: null }
    },
    hasChanges: () => {
      return JSON.stringify(linkedAttributes.map((l) => l.definitionId)) !== initialLinked
    },
  }))

  const linkedIds = new Set(linkedAttributes.map((a) => a.definitionId))
  const availableDefinitions = allDefinitions.filter((d) => !linkedIds.has(d.id))

  const handleAdd = (definitionId: string) => {
    const def = allDefinitions.find((d) => d.id === definitionId)
    if (!def) return
    setLinkedAttributes((prev) => [
      ...prev,
      { definitionId: def.id, attributeName: def.attribute_name },
    ])
  }

  const handleRemove = (index: number) => {
    setLinkedAttributes((prev) => prev.filter((_, i) => i !== index))
  }

  const handleMoveUp = (index: number) => {
    if (index === 0) return
    setLinkedAttributes((prev) => {
      const next = [...prev]
      ;[next[index - 1], next[index]] = [next[index], next[index - 1]]
      return next
    })
  }

  const handleMoveDown = (index: number) => {
    if (index === linkedAttributes.length - 1) return
    setLinkedAttributes((prev) => {
      const next = [...prev]
      ;[next[index], next[index + 1]] = [next[index + 1], next[index]]
      return next
    })
  }

  const handleCreateNewDefinition = async () => {
    if (!newAttrName.trim()) {
      toast.error('Attribute name is required')
      return
    }

    setSavingNew(true)
    const supabase = createClient()

    // Parse allowed values — comma separated, each trimmed
    const rawValues = newAttrAllowedValues
      .split(',')
      .map((v) => v.trim())
      .filter(Boolean)

    // For pin-type attributes ensure 0 is included
    const isPinAttr = newAttrName.toLowerCase().includes('pin')
    const allowedValues = isPinAttr && !rawValues.includes('0')
      ? ['0', ...rawValues]
      : rawValues

    const maxOrder = allDefinitions.reduce((max, d) => Math.max(max, d.display_order), 0)

    const { data, error } = await (supabase.from('machine_attribute_definitions') as any).insert({
      attribute_name: newAttrName.trim(),
      value_type: newAttrType,
      allowed_values: allowedValues,
      default_value: newAttrDefaultValue.trim() || null,
      display_order: maxOrder + 1,
    }).select().single()

    if (error) {
      console.error('Error creating attribute definition:', error)
      toast.error('Failed to create attribute')
      setSavingNew(false)
      return
    }

    const newDef = data as AttributeDefinition
    setAllDefinitions((prev) => [...prev, newDef])

    // Auto-link to this machine
    setLinkedAttributes((prev) => [
      ...prev,
      { definitionId: newDef.id, attributeName: newDef.attribute_name },
    ])

    // Reset form
    setNewAttrName('')
    setNewAttrType('numeric')
    setNewAttrAllowedValues('')
    setNewAttrDefaultValue('')
    setShowNewForm(false)
    toast.success('Attribute created and linked')
    setSavingNew(false)
  }

  const handleSaveDefaultValue = async (defId: string) => {
    const supabase = createClient()
    const { error } = await (supabase.from('machine_attribute_definitions') as any)
      .update({ default_value: editingDefaultValue.trim() || null })
      .eq('id', defId)

    if (error) {
      toast.error('Failed to update default value')
      return
    }

    setAllDefinitions((prev) =>
      prev.map((d) =>
        d.id === defId ? { ...d, default_value: editingDefaultValue.trim() || null } : d
      )
    )
    setEditingDefaultId(null)
    toast.success('Default value updated')
  }

  if (loading) {
    return <div className="text-sm text-slate-400 py-2">Loading attributes...</div>
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Label className="text-sm font-medium">Machine Attributes</Label>
        {!disabled && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 text-xs"
            onClick={() => setShowNewForm((v) => !v)}
          >
            {showNewForm ? <X className="h-3.5 w-3.5 mr-1" /> : <Plus className="h-3.5 w-3.5 mr-1" />}
            {showNewForm ? 'Cancel' : 'New Attribute'}
          </Button>
        )}
      </div>

      {/* Create new attribute definition form */}
      {showNewForm && (
        <div className="border rounded-lg p-3 bg-slate-50 space-y-3">
          <p className="text-xs font-medium text-slate-600">Create New Attribute</p>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <label className="text-xs text-slate-500">Name *</label>
              <Input
                value={newAttrName}
                onChange={(e) => setNewAttrName(e.target.value)}
                placeholder="e.g. Pin Setting"
                className="h-7 text-xs"
                disabled={savingNew}
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-slate-500">Type</label>
              <Select
                value={newAttrType}
                onValueChange={(v) => setNewAttrType(v as 'numeric' | 'text')}
                disabled={savingNew}
              >
                <SelectTrigger className="h-7 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="numeric">Numeric</SelectItem>
                  <SelectItem value="text">Text</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1">
            <label className="text-xs text-slate-500">Allowed Values (comma-separated, leave blank for free input)</label>
            <Input
              value={newAttrAllowedValues}
              onChange={(e) => setNewAttrAllowedValues(e.target.value)}
              placeholder="e.g. 1, 2, 3, 4, 5"
              className="h-7 text-xs"
              disabled={savingNew}
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs text-slate-500">Default Value</label>
            <Input
              value={newAttrDefaultValue}
              onChange={(e) => setNewAttrDefaultValue(e.target.value)}
              placeholder="Optional default"
              className="h-7 text-xs"
              disabled={savingNew}
            />
          </div>
          <Button
            type="button"
            size="sm"
            className="h-7 text-xs"
            onClick={handleCreateNewDefinition}
            disabled={savingNew}
          >
            {savingNew ? 'Creating...' : 'Create & Link'}
          </Button>
        </div>
      )}

      {/* Linked attributes list */}
      {linkedAttributes.length === 0 ? (
        <div className="text-sm text-slate-400 italic py-2">
          No attributes linked to this machine
        </div>
      ) : (
        <div className="border rounded-lg divide-y">
          {linkedAttributes.map((attr, index) => {
            const def = allDefinitions.find((d) => d.id === attr.definitionId)
            return (
              <div key={attr.definitionId} className="px-3 py-1.5 text-sm">
                <div className="flex items-center gap-2">
                  <GripVertical className="h-3.5 w-3.5 text-slate-300 flex-shrink-0" />
                  <span className="flex-1 truncate">{attr.attributeName}</span>
                  {def && !disabled && (
                    <button
                      type="button"
                      className="text-xs text-slate-400 hover:text-slate-600 truncate max-w-[80px]"
                      onClick={() => {
                        setEditingDefaultId(editingDefaultId === def.id ? null : def.id)
                        setEditingDefaultValue(def.default_value || '')
                      }}
                      title="Edit default value"
                    >
                      {def.default_value ? `default: ${def.default_value}` : 'set default'}
                    </button>
                  )}
                  <Button type="button" variant="ghost" size="sm" className="h-6 w-6 p-0"
                    onClick={() => handleMoveUp(index)} disabled={index === 0 || disabled}>
                    <ChevronUp className="h-3.5 w-3.5" />
                  </Button>
                  <Button type="button" variant="ghost" size="sm" className="h-6 w-6 p-0"
                    onClick={() => handleMoveDown(index)} disabled={index === linkedAttributes.length - 1 || disabled}>
                    <ChevronDown className="h-3.5 w-3.5" />
                  </Button>
                  <Button type="button" variant="ghost" size="sm" className="h-6 w-6 p-0 text-red-400 hover:text-red-600"
                    onClick={() => handleRemove(index)} disabled={disabled}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
                {/* Inline default value editor */}
                {editingDefaultId === attr.definitionId && def && (
                  <div className="flex items-center gap-2 mt-1.5 ml-5">
                    <Input
                      value={editingDefaultValue}
                      onChange={(e) => setEditingDefaultValue(e.target.value)}
                      placeholder="Default value"
                      className="h-6 text-xs flex-1"
                    />
                    <Button type="button" size="sm" className="h-6 text-xs px-2"
                      onClick={() => handleSaveDefaultValue(def.id)}>
                      Save
                    </Button>
                    <Button type="button" variant="ghost" size="sm" className="h-6 text-xs px-2"
                      onClick={() => setEditingDefaultId(null)}>
                      Cancel
                    </Button>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Add existing attribute dropdown */}
      {availableDefinitions.length > 0 && !disabled && (
        <Select onValueChange={handleAdd} value="">
          <SelectTrigger className="text-sm h-8">
            <SelectValue placeholder="Link existing attribute..." />
          </SelectTrigger>
          <SelectContent>
            {availableDefinitions.map((def) => (
              <SelectItem key={def.id} value={def.id}>
                {def.attribute_name}
                {def.default_value ? ` (default: ${def.default_value})` : ''}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
    </div>
  )
})
