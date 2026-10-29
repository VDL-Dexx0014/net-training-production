// src/components/dashboard/admin/MeasurementTypesAdminSection.tsx
// Admin section for managing measurement types (workout data classification)

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
import { Checkbox } from '@/components/ui/checkbox'
import { Plus, Pencil, Trash2, GripVertical } from 'lucide-react'
import { toast } from 'sonner'
import { Database } from '@/types/database.types'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

type MeasurementType = Database['public']['Tables']['measurement_types']['Row']

const BASE_UNITS = ['weight', 'time', 'reps', 'percentage', 'date']

// Sortable row component for drag-and-drop
interface SortableRowProps {
  type: MeasurementType
  formatUnits: (units: string[]) => string
  openEdit: (type: MeasurementType) => void
  handleDelete: (type: MeasurementType) => void
}

function SortableRow({ type, formatUnits, openEdit, handleDelete }: SortableRowProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: type.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 50 : undefined,
  }

  return (
    <tr ref={setNodeRef} style={style} className="hover:bg-slate-50 bg-white">
      <td className="px-4 py-3 w-8">
        <button
          type="button"
          className="touch-none cursor-grab active:cursor-grabbing"
          {...attributes}
          {...listeners}
        >
          <GripVertical className="h-4 w-4 text-slate-400" />
        </button>
      </td>
      <td className="px-4 py-3">
        <p className="font-medium">{type.name}</p>
      </td>
      <td className="px-4 py-3">
        <Badge variant="outline" className="font-mono">
          {type.abbreviation}
        </Badge>
      </td>
      <td className="px-4 py-3 text-sm">{formatUnits(type.units)}</td>
      <td className="px-4 py-3">
        {type.is_active ? (
          <Badge variant="outline" className="bg-green-50 text-green-700">
            Active
          </Badge>
        ) : (
          <Badge variant="outline" className="bg-slate-50">
            Inactive
          </Badge>
        )}
      </td>
      <td className="px-4 py-3 text-right">
        <Button variant="ghost" size="sm" onClick={() => openEdit(type)}>
          <Pencil className="h-4 w-4 mr-1" />
          Edit
        </Button>
        {type.is_custom && (
          <Button
            variant="ghost"
            size="sm"
            className="text-red-600 hover:text-red-700 hover:bg-red-50"
            onClick={() => handleDelete(type)}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        )}
      </td>
    </tr>
  )
}

export function MeasurementTypesAdminSection() {
  const [measurementTypes, setMeasurementTypes] = useState<MeasurementType[]>([])
  const [loading, setLoading] = useState(true)
  const [createOpen, setCreateOpen] = useState(false)
  const [editType, setEditType] = useState<MeasurementType | null>(null)
  const [editOpen, setEditOpen] = useState(false)

  // Form state
  const [formName, setFormName] = useState('')
  const [formAbbreviation, setFormAbbreviation] = useState('')
  const [formUnits, setFormUnits] = useState<string[]>([])
  const [formIsActive, setFormIsActive] = useState(true)
  const [saving, setSaving] = useState(false)
  const [availableUnits, setAvailableUnits] = useState<string[]>(BASE_UNITS)
  const [newUnitInput, setNewUnitInput] = useState('')

  // DnD sensors
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  useEffect(() => {
    loadMeasurementTypes()
  }, [])

  const loadMeasurementTypes = async () => {
    setLoading(true)
    const supabase = createClient()

    // Try with sort_order first, fall back to name-only ordering if column doesn't exist
    let { data, error } = await supabase
      .from('measurement_types')
      .select('*')
      .order('sort_order', { ascending: true, nullsFirst: false })
      .order('name')

    // If sort_order column doesn't exist, try without it
    if (error && error.message?.includes('sort_order')) {
      const fallback = await supabase
        .from('measurement_types')
        .select('*')
        .order('name')
      data = fallback.data
      error = fallback.error
    }

    if (error) {
      toast.error('Failed to load measurement types')
    } else {
      setMeasurementTypes((data || []) as MeasurementType[])
    }

    setLoading(false)
  }

  const resetForm = () => {
    setFormName('')
    setFormAbbreviation('')
    setFormUnits([])
    setFormIsActive(true)
  }

  const openCreate = () => {
    resetForm()
    setNewUnitInput('')
    setCreateOpen(true)
  }

  const openEdit = (type: MeasurementType) => {
    setEditType(type)
    setFormName(type.name)
    setFormAbbreviation(type.abbreviation)
    const units = type.units || []
    setFormUnits(units)
    // ensure any existing custom units on this type appear in the picker
    const extra = units.filter(u => !BASE_UNITS.includes(u))
    if (extra.length > 0) setAvailableUnits(prev => [...new Set([...prev, ...extra])])
    setFormIsActive(type.is_active)
    setNewUnitInput('')
    setEditOpen(true)
  }

  const addCustomUnit = () => {
    const unit = newUnitInput.trim().toLowerCase()
    if (!unit) return
    if (!availableUnits.includes(unit)) {
      setAvailableUnits(prev => [...prev, unit])
    }
    if (!formUnits.includes(unit)) {
      setFormUnits(prev => [...prev, unit])
    }
    setNewUnitInput('')
  }

  const handleCreate = async () => {
    if (!formName.trim() || !formAbbreviation.trim()) {
      toast.error('Name and abbreviation are required')
      return
    }

    if (formUnits.length === 0) {
      toast.error('At least one unit is required')
      return
    }

    setSaving(true)
    const supabase = createClient()

    const { error } = await supabase.from('measurement_types').insert({
      name: formName.trim(),
      abbreviation: formAbbreviation.trim().toUpperCase(),
      units: formUnits,
      is_active: formIsActive,
      is_custom: true,
    } as any)

    if (error) {
      if (error.message.includes('duplicate')) {
        toast.error('A measurement type with this abbreviation already exists')
      } else {
        toast.error('Failed to create measurement type')
      }
    } else {
      toast.success('Measurement type created')
      setCreateOpen(false)
      loadMeasurementTypes()
    }

    setSaving(false)
  }

  const handleUpdate = async () => {
    if (!editType) return

    if (!formName.trim() || !formAbbreviation.trim()) {
      toast.error('Name and abbreviation are required')
      return
    }

    if (formUnits.length === 0) {
      toast.error('At least one unit is required')
      return
    }

    setSaving(true)
    const supabase = createClient()

    const { error } = await (supabase
      .from('measurement_types') as any)
      .update({
        name: formName.trim(),
        abbreviation: formAbbreviation.trim().toUpperCase(),
        units: formUnits,
        is_active: formIsActive,
        updated_at: new Date().toISOString(),
      })
      .eq('id', editType.id)

    if (error) {
      toast.error('Failed to update measurement type')
    } else {
      toast.success('Measurement type updated')
      setEditOpen(false)
      loadMeasurementTypes()
    }

    setSaving(false)
  }

  const handleDelete = async (type: MeasurementType) => {
    if (!type.is_custom) {
      toast.error('Cannot delete built-in measurement types')
      return
    }

    if (!confirm(`Are you sure you want to delete "${type.name}"? This cannot be undone.`)) {
      return
    }

    const supabase = createClient()

    const { error } = await supabase.from('measurement_types').delete().eq('id', type.id)

    if (error) {
      toast.error('Failed to delete measurement type')
    } else {
      toast.success('Measurement type deleted')
      loadMeasurementTypes()
    }
  }

  const toggleUnit = (unit: string) => {
    setFormUnits((prev) =>
      prev.includes(unit) ? prev.filter((u) => u !== unit) : [...prev, unit]
    )
  }

  const formatUnits = (units: string[]) => {
    return units.map((u) => u.charAt(0).toUpperCase() + u.slice(1)).join(', ')
  }

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event
    if (over && active.id !== over.id) {
      const oldIndex = measurementTypes.findIndex((t) => t.id === active.id)
      const newIndex = measurementTypes.findIndex((t) => t.id === over.id)
      if (oldIndex !== -1 && newIndex !== -1) {
        const reordered = arrayMove(measurementTypes, oldIndex, newIndex)
        setMeasurementTypes(reordered)

        // Save new sort order to database (if sort_order column exists)
        const supabase = createClient()
        try {
          for (let i = 0; i < reordered.length; i++) {
            await (supabase.from('measurement_types') as any)
              .update({ sort_order: i })
              .eq('id', reordered[i].id)
          }
        } catch {
          // sort_order column may not exist yet - that's OK, order is preserved in UI
        }
      }
    }
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h3 className="font-semibold text-lg">
          Measurement Types{' '}
          <span className="font-normal text-sm">({measurementTypes.length} total)</span>
        </h3>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4 mr-2" />
          Add Measurement Type
        </Button>
      </div>

      {loading ? (
        <div className="py-8 text-center">Loading measurement types...</div>
      ) : measurementTypes.length === 0 ? (
        <div className="py-8 text-center">No measurement types configured</div>
      ) : (
        <div className="border rounded-lg overflow-hidden overflow-y-auto max-h-[60vh]">
          <table className="w-full">
            <thead className="bg-slate-50 sticky top-0 z-10">
              <tr>
                <th className="w-8 px-4 py-3 bg-slate-50"></th>
                <th className="text-left px-4 py-3 text-sm font-medium bg-slate-50">Name</th>
                <th className="text-left px-4 py-3 text-sm font-medium bg-slate-50">Abbreviation</th>
                <th className="text-left px-4 py-3 text-sm font-medium bg-slate-50">Units</th>
                <th className="text-left px-4 py-3 text-sm font-medium bg-slate-50">Status</th>
                <th className="text-right px-4 py-3 text-sm font-medium bg-slate-50">Actions</th>
              </tr>
            </thead>
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <SortableContext
                items={measurementTypes.map((t) => t.id)}
                strategy={verticalListSortingStrategy}
              >
                <tbody className="divide-y">
                  {measurementTypes.map((type) => (
                    <SortableRow
                      key={type.id}
                      type={type}
                      formatUnits={formatUnits}
                      openEdit={openEdit}
                      handleDelete={handleDelete}
                    />
                  ))}
                </tbody>
              </SortableContext>
            </DndContext>
          </table>
        </div>
      )}

      {/* Create Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Create Measurement Type</DialogTitle>
            <DialogDescription>
              Add a new way to classify workout data.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="createName">Name *</Label>
                <Input
                  id="createName"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="e.g., Time Under Load"
                  disabled={saving}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="createAbbr">Abbreviation *</Label>
                <Input
                  id="createAbbr"
                  value={formAbbreviation}
                  onChange={(e) => setFormAbbreviation(e.target.value)}
                  placeholder="e.g., TUL"
                  disabled={saving}
                  className="uppercase"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Units *</Label>
              <div className="flex flex-wrap gap-3 mb-2">
                {availableUnits.map((unit) => (
                  <label key={unit} className="flex items-center gap-2 cursor-pointer">
                    <Checkbox
                      checked={formUnits.includes(unit)}
                      onCheckedChange={() => toggleUnit(unit)}
                      disabled={saving}
                    />
                    <span className="text-sm capitalize">{unit}</span>
                  </label>
                ))}
              </div>
              <div className="flex gap-2">
                <Input
                  value={newUnitInput}
                  onChange={(e) => setNewUnitInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addCustomUnit() } }}
                  placeholder="New unit name..."
                  className="h-8 text-sm flex-1"
                  disabled={saving}
                />
                <Button type="button" size="sm" variant="outline" onClick={addCustomUnit} disabled={saving || !newUnitInput.trim()}>
                  <Plus className="h-3.5 w-3.5 mr-1" />Add
                </Button>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Checkbox
                id="createActive"
                checked={formIsActive}
                onCheckedChange={(checked) => setFormIsActive(checked === true)}
                disabled={saving}
              />
              <label htmlFor="createActive" className="text-sm cursor-pointer">
                Active (available for use)
              </label>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={handleCreate} disabled={saving}>
              {saving ? 'Creating...' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Edit Measurement Type</DialogTitle>
            <DialogDescription>
              Update the measurement type settings.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="editName">Name *</Label>
                <Input
                  id="editName"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="e.g., Time Under Load"
                  disabled={saving}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="editAbbr">Abbreviation *</Label>
                <Input
                  id="editAbbr"
                  value={formAbbreviation}
                  onChange={(e) => setFormAbbreviation(e.target.value)}
                  placeholder="e.g., TUL"
                  disabled={saving}
                  className="uppercase"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Units *</Label>
              <div className="flex flex-wrap gap-3 mb-2">
                {availableUnits.map((unit) => (
                  <label key={unit} className="flex items-center gap-2 cursor-pointer">
                    <Checkbox
                      checked={formUnits.includes(unit)}
                      onCheckedChange={() => toggleUnit(unit)}
                      disabled={saving}
                    />
                    <span className="text-sm capitalize">{unit}</span>
                  </label>
                ))}
              </div>
              <div className="flex gap-2">
                <Input
                  value={newUnitInput}
                  onChange={(e) => setNewUnitInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addCustomUnit() } }}
                  placeholder="New unit name..."
                  className="h-8 text-sm flex-1"
                  disabled={saving}
                />
                <Button type="button" size="sm" variant="outline" onClick={addCustomUnit} disabled={saving || !newUnitInput.trim()}>
                  <Plus className="h-3.5 w-3.5 mr-1" />Add
                </Button>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Checkbox
                id="editActive"
                checked={formIsActive}
                onCheckedChange={(checked) => setFormIsActive(checked === true)}
                disabled={saving}
              />
              <label htmlFor="editActive" className="text-sm cursor-pointer">
                Active (available for use)
              </label>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={handleUpdate} disabled={saving}>
              {saving ? 'Saving...' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
