// src/components/dashboard/admin/CreateDefaultRoutineDialog.tsx
// Dialog for creating a new default/template routine

'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Plus, Loader2, GripVertical, X } from 'lucide-react'
import { toast } from 'sonner'
import { MachineImage } from '@/components/machine/MachineImage'
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

interface Machine {
  id: string
  machine_code: string
  machine_name: string
  image_url: string | null
}

interface SelectedMachine {
  id: string
  machine: Machine
  order: number
}

function SortableSelectedMachine({
  item,
  onRemove,
}: {
  item: SelectedMachine
  onRemove: () => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: item.id,
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  return (
    <div ref={setNodeRef} style={style} className="flex items-center gap-2 p-2 bg-white border rounded-lg">
      <button type="button" className="touch-none cursor-grab active:cursor-grabbing" {...attributes} {...listeners}>
        <GripVertical className="h-4 w-4 text-slate-400" />
      </button>
      <Badge variant="secondary" className="w-6 h-6 p-0 flex items-center justify-center text-xs">
        {item.order}
      </Badge>
      <MachineImage src={item.machine.image_url} alt={item.machine.machine_name} size="sm" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium">{item.machine.machine_code}</p>
        <p className="text-xs text-slate-500 truncate">{item.machine.machine_name}</p>
      </div>
      <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onRemove}>
        <X className="h-3 w-3" />
      </Button>
    </div>
  )
}

interface CreateDefaultRoutineDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onRoutineCreated: () => void
}

export function CreateDefaultRoutineDialog({
  open,
  onOpenChange,
  onRoutineCreated,
}: CreateDefaultRoutineDialogProps) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [goals, setGoals] = useState('')
  const [allMachines, setAllMachines] = useState<Machine[]>([])
  const [selectedMachines, setSelectedMachines] = useState<SelectedMachine[]>([])
  const [loadingMachines, setLoadingMachines] = useState(false)
  const [creating, setCreating] = useState(false)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  useEffect(() => {
    if (open) {
      loadMachines()
      setName('')
      setDescription('')
      setGoals('')
      setSelectedMachines([])
    }
  }, [open])

  const loadMachines = async () => {
    setLoadingMachines(true)
    const supabase = createClient()
    const { data } = await supabase
      .from('machines')
      .select('id, machine_code, machine_name, image_url')
      .eq('is_active', true)
      .order('machine_code')
    setAllMachines((data || []) as Machine[])
    setLoadingMachines(false)
  }

  const handleMachineToggle = (machine: Machine) => {
    const existingIndex = selectedMachines.findIndex((sm) => sm.machine.id === machine.id)
    if (existingIndex >= 0) {
      const updated = selectedMachines
        .filter((sm) => sm.machine.id !== machine.id)
        .map((sm, idx) => ({ ...sm, order: idx + 1 }))
      setSelectedMachines(updated)
    } else {
      setSelectedMachines([...selectedMachines, { id: machine.id, machine, order: selectedMachines.length + 1 }])
    }
  }

  const handleRemoveMachine = (machineId: string) => {
    const updated = selectedMachines
      .filter((sm) => sm.machine.id !== machineId)
      .map((sm, idx) => ({ ...sm, order: idx + 1 }))
    setSelectedMachines(updated)
  }

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (over && active.id !== over.id) {
      const oldIndex = selectedMachines.findIndex((sm) => sm.id === active.id)
      const newIndex = selectedMachines.findIndex((sm) => sm.id === over.id)
      if (oldIndex !== -1 && newIndex !== -1) {
        const reordered = arrayMove(selectedMachines, oldIndex, newIndex).map((sm, idx) => ({
          ...sm,
          order: idx + 1,
        }))
        setSelectedMachines(reordered)
      }
    }
  }

  const getSelectionNumber = (machineId: string): number | null => {
    const found = selectedMachines.find((sm) => sm.machine.id === machineId)
    return found ? found.order : null
  }

  const handleCreate = async () => {
    if (!name.trim()) {
      toast.error('Routine name is required')
      return
    }
    if (selectedMachines.length === 0) {
      toast.error('Please select at least one machine')
      return
    }

    setCreating(true)
    const supabase = createClient()

    try {
      const { data: program, error: programError } = await supabase
        .from('programs')
        .insert({
          name: name.trim(),
          description: description.trim() || null,
          goals: goals.trim() || null,
          status: 'active',
          is_default: true,
          client_id: null,
        } as any)
        .select()
        .single()

      if (programError || !program) {
        toast.error('Failed to create routine')
        return
      }

      const machineInserts = selectedMachines.map((sm) => ({
        program_id: (program as any).id,
        machine_id: sm.machine.id,
        order_index: sm.order - 1,
      }))

      const { error: machinesError } = await supabase
        .from('program_machines')
        .insert(machineInserts as any)

      if (machinesError) {
        toast.error('Routine created but failed to add machines')
      } else {
        toast.success('Default routine created')
        onOpenChange(false)
        onRoutineCreated()
      }
    } catch {
      toast.error('An error occurred')
    } finally {
      setCreating(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[900px] max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Create Default Routine</DialogTitle>
          <DialogDescription>
            Create a template routine that can be assigned to new clients.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-hidden flex flex-col gap-4 py-4">
          {/* Name / description / goals row */}
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1">
              <Label htmlFor="routineName">Name *</Label>
              <Input
                id="routineName"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., Beginner Full Body"
                disabled={creating}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="routineDescription">Description</Label>
              <Input
                id="routineDescription"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Optional description"
                disabled={creating}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="routineGoals">Goals</Label>
              <Input
                id="routineGoals"
                value={goals}
                onChange={(e) => setGoals(e.target.value)}
                placeholder="Optional goals"
                disabled={creating}
              />
            </div>
          </div>

          {/* Two-panel machine selection */}
          <div className="flex-1 overflow-hidden flex gap-4">
            {/* Machine grid */}
            <div className="flex-1 overflow-hidden flex flex-col">
              <p className="text-sm font-medium text-slate-600 mb-2">
                Available Machines ({allMachines.length})
              </p>
              <div className="flex-1 overflow-y-auto border rounded-lg p-3">
                {loadingMachines ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
                  </div>
                ) : (
                  <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 gap-2">
                    {allMachines.map((machine) => {
                      const selectionNumber = getSelectionNumber(machine.id)
                      const isSelected = selectionNumber !== null
                      return (
                        <button
                          key={machine.id}
                          onClick={() => handleMachineToggle(machine)}
                          className={`relative p-2 rounded-lg border-2 transition-all hover:shadow-md ${
                            isSelected
                              ? 'border-blue-500 bg-blue-50'
                              : 'border-slate-200 hover:border-slate-300'
                          }`}
                        >
                          {isSelected && (
                            <Badge className="absolute -top-2 -right-2 w-6 h-6 p-0 flex items-center justify-center text-xs bg-blue-600">
                              {selectionNumber}
                            </Badge>
                          )}
                          <MachineImage
                            src={machine.image_url}
                            alt={machine.machine_name}
                            size="sm"
                            className="mx-auto"
                          />
                          <p className="text-xs font-medium text-center mt-1 truncate">
                            {machine.machine_code}
                          </p>
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* Selected machines list */}
            <div className="w-72 flex flex-col">
              <p className="text-sm font-medium text-slate-600 mb-2">
                Selected ({selectedMachines.length})
              </p>
              <div className="flex-1 overflow-y-auto border rounded-lg p-2 bg-slate-50">
                {selectedMachines.length === 0 ? (
                  <div className="flex items-center justify-center h-full text-sm text-slate-400">
                    Click machines to add them
                  </div>
                ) : (
                  <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                    <SortableContext
                      items={selectedMachines.map((sm) => sm.id)}
                      strategy={verticalListSortingStrategy}
                    >
                      <div className="space-y-2">
                        {selectedMachines.map((item) => (
                          <SortableSelectedMachine
                            key={item.id}
                            item={item}
                            onRemove={() => handleRemoveMachine(item.machine.id)}
                          />
                        ))}
                      </div>
                    </SortableContext>
                  </DndContext>
                )}
              </div>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={creating}>
            Cancel
          </Button>
          <Button onClick={handleCreate} disabled={creating || !name.trim() || selectedMachines.length === 0}>
            {creating ? (
              <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Creating...</>
            ) : (
              `Create Routine${selectedMachines.length > 0 ? ` (${selectedMachines.length} machines)` : ''}`
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
