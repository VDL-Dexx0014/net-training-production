// src/components/dashboard/admin/EditDefaultRoutineDialog.tsx
// Dialog for editing an existing default/template routine

'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Trash2, GripVertical, Plus } from 'lucide-react'
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

type Program = Database['public']['Tables']['programs']['Row']

interface DefaultRoutine extends Program {
  program_machines: Array<{
    id: string
    machine_id: string
    order_index: number
    machines: {
      id: string
      machine_code: string
      machine_name: string
    }
  }>
}

interface Machine {
  id: string
  machine_code: string
  machine_name: string
}

interface SelectedMachine {
  key: string
  machine_id: string
  machine_code: string
}

interface SortableMachineItemProps {
  item: SelectedMachine
  onRemove: (key: string) => void
}

function SortableMachineItem({ item, onRemove }: SortableMachineItemProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: item.key,
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  return (
    <div ref={setNodeRef} style={style} className="flex items-center gap-2 p-2 border rounded bg-white">
      <button type="button" className="touch-none cursor-grab" {...attributes} {...listeners}>
        <GripVertical className="h-4 w-4 text-slate-400" />
      </button>
      <span className="flex-1 font-mono font-bold text-sm">{item.machine_code}</span>
      <Button type="button" variant="ghost" size="sm" onClick={() => onRemove(item.key)}>
        <Trash2 className="h-4 w-4 text-red-500" />
      </Button>
    </div>
  )
}

interface EditDefaultRoutineDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  routine: DefaultRoutine | null
  onRoutineUpdated: () => void
}

export function EditDefaultRoutineDialog({
  open,
  onOpenChange,
  routine,
  onRoutineUpdated,
}: EditDefaultRoutineDialogProps) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [goals, setGoals] = useState('')
  const [selectedMachines, setSelectedMachines] = useState<SelectedMachine[]>([])
  const [availableMachines, setAvailableMachines] = useState<Machine[]>([])
  const [machinePickerOpen, setMachinePickerOpen] = useState(false)
  const [saving, setSaving] = useState(false)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  useEffect(() => {
    if (open && routine) {
      setName(routine.name)
      setDescription(routine.description || '')
      setGoals(routine.goals || '')

      const machines = (routine.program_machines || [])
        .sort((a, b) => a.order_index - b.order_index)
        .map((pm) => ({
          key: pm.id || crypto.randomUUID(),
          machine_id: pm.machine_id,
          machine_code: pm.machines.machine_code,
        }))
      setSelectedMachines(machines)

      loadMachines()
    }
  }, [open, routine])

  const loadMachines = async () => {
    const supabase = createClient()
    const { data } = await supabase
      .from('machines')
      .select('id, machine_code, machine_name')
      .eq('is_active', true)
      .order('machine_code')

    setAvailableMachines((data || []) as Machine[])
  }

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (over && active.id !== over.id) {
      setSelectedMachines((items) => {
        const oldIndex = items.findIndex((i) => i.key === active.id)
        const newIndex = items.findIndex((i) => i.key === over.id)
        return arrayMove(items, oldIndex, newIndex)
      })
    }
  }

  const addMachineById = (machine: Machine) => {
    setSelectedMachines((prev) => [
      ...prev,
      { key: crypto.randomUUID(), machine_id: machine.id, machine_code: machine.machine_code },
    ])
    setMachinePickerOpen(false)
  }

  const removeMachine = (key: string) => {
    setSelectedMachines((prev) => prev.filter((m) => m.key !== key))
  }

  const handleSave = async () => {
    if (!routine) return

    if (!name.trim()) {
      toast.error('Routine name is required')
      return
    }

    setSaving(true)
    const supabase = createClient()

    try {
      const { error: programError } = await (supabase
        .from('programs') as any)
        .update({
          name: name.trim(),
          description: description.trim() || null,
          goals: goals.trim() || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', routine.id)

      if (programError) {
        console.error('Error updating routine:', programError)
        toast.error('Failed to update routine')
        return
      }

      await supabase.from('program_machines').delete().eq('program_id', routine.id)

      if (selectedMachines.length > 0) {
        const machineInserts = selectedMachines.map((m, index) => ({
          program_id: routine.id,
          machine_id: m.machine_id,
          order_index: index,
        }))

        const { error: machinesError } = await supabase
          .from('program_machines')
          .insert(machineInserts as any)

        if (machinesError) {
          console.error('Error updating machines:', machinesError)
          toast.error('Routine updated but failed to save machines')
        }
      }

      toast.success('Default routine updated')
      onOpenChange(false)
      onRoutineUpdated()
    } catch (error) {
      console.error('Error:', error)
      toast.error('An error occurred')
    } finally {
      setSaving(false)
    }
  }

  const addedMachineIds = new Set(selectedMachines.map((m) => m.machine_id))

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Default Routine</DialogTitle>
            <DialogDescription>
              Update this template routine. Changes won&apos;t affect routines already assigned to clients.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="editRoutineName">Routine Name *</Label>
              <Input
                id="editRoutineName"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., Beginner Full Body, Advanced Strength"
                disabled={saving}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="editRoutineDescription">Description</Label>
              <Textarea
                id="editRoutineDescription"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe this routine..."
                rows={2}
                disabled={saving}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="editRoutineGoals">Goals</Label>
              <Textarea
                id="editRoutineGoals"
                value={goals}
                onChange={(e) => setGoals(e.target.value)}
                placeholder="What are the goals of this routine?"
                rows={2}
                disabled={saving}
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Machines</Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setMachinePickerOpen(true)}
                  disabled={saving}
                >
                  <Plus className="h-4 w-4 mr-1" />
                  Add Machine
                </Button>
              </div>

              {selectedMachines.length === 0 ? (
                <p className="text-sm text-slate-500 py-4 text-center">
                  No machines added. Click &quot;Add Machine&quot; to start.
                </p>
              ) : (
                <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                  <SortableContext
                    items={selectedMachines.map((m) => m.key)}
                    strategy={verticalListSortingStrategy}
                  >
                    <div className="space-y-2">
                      {selectedMachines.map((item) => (
                        <SortableMachineItem
                          key={item.key}
                          item={item}
                          onRemove={removeMachine}
                        />
                      ))}
                    </div>
                  </SortableContext>
                </DndContext>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? 'Saving...' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Machine picker modal */}
      <Dialog open={machinePickerOpen} onOpenChange={setMachinePickerOpen}>
        <DialogContent className="sm:max-w-[500px]" showCloseButton>
          <DialogHeader>
            <DialogTitle>Select Machine</DialogTitle>
          </DialogHeader>
          <div className="flex flex-wrap gap-2 py-2 max-h-[60vh] overflow-y-auto">
            {availableMachines.map((m) => {
              const alreadyAdded = addedMachineIds.has(m.id)
              return (
                <button
                  key={m.id}
                  onClick={() => !alreadyAdded && addMachineById(m)}
                  disabled={alreadyAdded}
                  className={`px-3 py-2 rounded border-2 font-mono font-bold text-base transition-all ${
                    alreadyAdded
                      ? 'border-slate-200 bg-slate-100 text-slate-400 cursor-not-allowed'
                      : 'border-slate-400 bg-white text-slate-800 hover:bg-blue-50 hover:border-blue-400 hover:text-blue-700 cursor-pointer'
                  }`}
                >
                  {m.machine_code}
                </button>
              )
            })}
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
