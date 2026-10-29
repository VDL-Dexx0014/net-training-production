// src/components/program/CreateRoutineDialog.tsx
// Dialog to create a routine - from template, custom, or with machine grid selection

'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import { Plus, FileText, Loader2, Grid3X3, GripVertical, X, Check } from 'lucide-react'
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

interface DefaultRoutine {
  id: string
  name: string
  description: string | null
  goals: string | null
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

interface SelectedMachine {
  id: string
  machine: Machine
  order: number
}

interface CreateRoutineDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  clientId: string
  onRoutineCreated?: (programId?: string) => void
}

// Sortable item for the selected machines list
function SortableSelectedMachine({
  item,
  onRemove,
}: {
  item: SelectedMachine
  onRemove: () => void
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-2 p-2 bg-white border rounded-lg"
    >
      <button
        type="button"
        className="touch-none cursor-grab active:cursor-grabbing"
        {...attributes}
        {...listeners}
      >
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

export function CreateRoutineDialog({
  open,
  onOpenChange,
  clientId,
  onRoutineCreated,
}: CreateRoutineDialogProps) {
  const router = useRouter()
  const [defaultRoutines, setDefaultRoutines] = useState<DefaultRoutine[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [selectedRoutineId, setSelectedRoutineId] = useState<string | null>(null)

  // Machine grid selection state
  const [showMachineGrid, setShowMachineGrid] = useState(false)
  const [allMachines, setAllMachines] = useState<Machine[]>([])
  const [selectedMachines, setSelectedMachines] = useState<SelectedMachine[]>([])
  const [routineName, setRoutineName] = useState('')
  const [loadingMachines, setLoadingMachines] = useState(false)

  // Confirmation state
  const [showConfirmation, setShowConfirmation] = useState(false)
  const [createdProgramId, setCreatedProgramId] = useState<string | null>(null)
  const [createdProgramName, setCreatedProgramName] = useState<string>('')

  // DnD sensors
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  const hasUnsavedChanges = showMachineGrid && (selectedMachines.length > 0 || routineName.trim() !== '')

  useEffect(() => {
    if (open) {
      loadDefaultRoutines()
      // Reset state when opening
      setShowMachineGrid(false)
      setSelectedMachines([])
      setRoutineName('')
      setShowConfirmation(false)
      setCreatedProgramId(null)
    }
  }, [open])

  const loadDefaultRoutines = async () => {
    setLoading(true)
    const supabase = createClient()

    const { data, error } = await supabase
      .from('programs')
      .select(`
        id,
        name,
        description,
        goals,
        program_machines (
          id,
          machine_id,
          order_index,
          machines (
            id,
            machine_code,
            machine_name
          )
        )
      `)
      .eq('is_default', true)
      .eq('status', 'active')
      .order('name')

    if (error) {
      console.error('Error loading default routines:', error)
    } else {
      setDefaultRoutines((data || []) as DefaultRoutine[])
    }

    setLoading(false)
  }

  const loadAllMachines = async () => {
    setLoadingMachines(true)
    const supabase = createClient()

    const { data, error } = await supabase
      .from('machines')
      .select('id, machine_code, machine_name, image_url')
      .eq('is_active', true)
      .order('machine_code')

    if (error) {
      console.error('Error loading machines:', error)
    } else {
      setAllMachines((data || []) as Machine[])
    }

    setLoadingMachines(false)
  }

  const handleOpenMachineGrid = () => {
    setShowMachineGrid(true)
    if (allMachines.length === 0) {
      loadAllMachines()
    }
  }

  const handleCloseMachineGrid = useCallback(() => {
    if (hasUnsavedChanges) {
      const confirmed = window.confirm(
        'You have unsaved changes. Are you sure you want to go back? All selections will be lost.'
      )
      if (!confirmed) return
    }
    setShowMachineGrid(false)
    setSelectedMachines([])
    setRoutineName('')
  }, [hasUnsavedChanges])

  const handleMachineToggle = (machine: Machine) => {
    const existingIndex = selectedMachines.findIndex((sm) => sm.machine.id === machine.id)

    if (existingIndex >= 0) {
      // Remove machine and update order numbers
      const updated = selectedMachines
        .filter((sm) => sm.machine.id !== machine.id)
        .map((sm, idx) => ({ ...sm, order: idx + 1 }))
      setSelectedMachines(updated)
    } else {
      // Add machine with next order number
      const newItem: SelectedMachine = {
        id: machine.id,
        machine,
        order: selectedMachines.length + 1,
      }
      setSelectedMachines([...selectedMachines, newItem])
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

  const getMachineSelectionNumber = (machineId: string): number | null => {
    const selected = selectedMachines.find((sm) => sm.machine.id === machineId)
    return selected ? selected.order : null
  }

  const handleCreateCustom = () => {
    onOpenChange(false)
    router.push(`/trainer/program/new?clientId=${clientId}`)
  }

  const handleCreateFromTemplate = async (template: DefaultRoutine) => {
    // Check for duplicate name
    const supabaseNameCheck = createClient()
    const { data: existing } = await supabaseNameCheck
      .from('programs')
      .select('id')
      .eq('client_id', clientId)
      .ilike('name', template.name)
      .eq('is_default', false)
    if (existing && existing.length > 0) {
      toast.error(`A routine named "${template.name}" already exists for this client`)
      return
    }

    setCreating(true)
    setSelectedRoutineId(template.id)
    const supabase = createClient()

    try {
      const { data: newProgram, error: programError } = await supabase
        .from('programs')
        .insert({
          client_id: clientId,
          name: template.name,
          description: template.description,
          goals: template.goals,
          status: 'active',
          is_default: false,
        } as any)
        .select()
        .single()

      if (programError || !newProgram) {
        console.error('Error creating program:', programError)
        toast.error('Failed to create routine')
        return
      }

      if (template.program_machines && template.program_machines.length > 0) {
        const machineInserts = template.program_machines.map((pm) => ({
          program_id: (newProgram as any).id,
          machine_id: pm.machine_id,
          order_index: pm.order_index,
        }))

        const { error: machinesError } = await supabase
          .from('program_machines')
          .insert(machineInserts as any)

        if (machinesError) {
          console.error('Error copying machines:', machinesError)
          toast.error('Routine created but failed to copy machines')
        }
      }

      // Show confirmation
      setCreatedProgramId((newProgram as any).id)
      setCreatedProgramName(template.name)
      setShowConfirmation(true)
    } catch (error) {
      console.error('Error creating routine from template:', error)
      toast.error('Failed to create routine')
    } finally {
      setCreating(false)
      setSelectedRoutineId(null)
    }
  }

  const handleCreateWithMachines = async () => {
    if (!routineName.trim()) {
      toast.error('Please enter a routine name')
      return
    }

    if (selectedMachines.length === 0) {
      toast.error('Please select at least one machine')
      return
    }

    // Check for duplicate name
    const supabaseNameCheck = createClient()
    const { data: existing } = await supabaseNameCheck
      .from('programs')
      .select('id')
      .eq('client_id', clientId)
      .ilike('name', routineName.trim())
      .eq('is_default', false)
    if (existing && existing.length > 0) {
      toast.error(`A routine named "${routineName.trim()}" already exists for this client`)
      return
    }

    setCreating(true)
    const supabase = createClient()

    try {
      const { data: newProgram, error: programError } = await supabase
        .from('programs')
        .insert({
          client_id: clientId,
          name: routineName.trim(),
          status: 'active',
          is_default: false,
        } as any)
        .select()
        .single()

      if (programError || !newProgram) {
        console.error('Error creating program:', programError)
        toast.error('Failed to create routine')
        return
      }

      // Insert machines in order
      const machineInserts = selectedMachines.map((sm) => ({
        program_id: (newProgram as any).id,
        machine_id: sm.machine.id,
        order_index: sm.order - 1, // 0-indexed in DB
      }))

      const { error: machinesError } = await supabase
        .from('program_machines')
        .insert(machineInserts as any)

      if (machinesError) {
        console.error('Error adding machines:', machinesError)
        toast.error('Routine created but failed to add machines')
      }

      // Show confirmation
      setCreatedProgramId((newProgram as any).id)
      setCreatedProgramName(routineName.trim())
      setShowMachineGrid(false)
      setShowConfirmation(true)
    } catch (error) {
      console.error('Error creating routine:', error)
      toast.error('Failed to create routine')
    } finally {
      setCreating(false)
    }
  }

  const handleConfirmationClose = () => {
    setShowConfirmation(false)
    onOpenChange(false)
    onRoutineCreated?.(createdProgramId || undefined)
  }

  const handleEditRoutine = () => {
    if (createdProgramId) {
      onOpenChange(false)
      router.push(`/trainer/program/${createdProgramId}`)
    }
  }

  const handleDialogClose = (newOpen: boolean) => {
    if (!newOpen && hasUnsavedChanges) {
      const confirmed = window.confirm(
        'You have unsaved changes. Are you sure you want to close? All selections will be lost.'
      )
      if (!confirmed) return
    }
    onOpenChange(newOpen)
  }

  // Confirmation view
  if (showConfirmation) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Check className="h-5 w-5 text-emerald-600" />
              Routine Created
            </DialogTitle>
            <DialogDescription>
              "{createdProgramName}" has been created successfully.
            </DialogDescription>
          </DialogHeader>

          <div className="py-4 text-center">
            <p className="text-sm text-slate-600">
              Would you like to configure machine settings for this routine?
            </p>
          </div>

          <DialogFooter className="flex gap-2">
            <Button variant="outline" onClick={handleConfirmationClose}>
              Done
            </Button>
            <Button onClick={handleEditRoutine}>
              Edit Routine
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    )
  }

  // Machine grid selection view
  if (showMachineGrid) {
    return (
      <Dialog open={open} onOpenChange={handleDialogClose}>
        <DialogContent className="sm:max-w-[900px] max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>Create Routine with Machine Selection</DialogTitle>
            <DialogDescription>
              Select machines in order. Click to select, drag to reorder in the list below.
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-hidden flex flex-col gap-4 py-4">
            {/* Routine Name */}
            <div className="space-y-2">
              <Label htmlFor="routineName" className="text-red-600 font-semibold">Routine Name *</Label>
              <Input
                id="routineName"
                value={routineName}
                onChange={(e) => setRoutineName(e.target.value)}
                className="max-w-md border-red-400 text-red-700 placeholder:text-red-300 focus:border-red-500"
              />
            </div>

            <div className="flex-1 overflow-hidden flex gap-4">
              {/* Machine Grid */}
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
                        const selectionNumber = getMachineSelectionNumber(machine.id)
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
                              <Badge
                                className="absolute -top-2 -right-2 w-6 h-6 p-0 flex items-center justify-center text-xs bg-blue-600"
                              >
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

              {/* Selected Machines List */}
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
                    <DndContext
                      sensors={sensors}
                      collisionDetection={closestCenter}
                      onDragEnd={handleDragEnd}
                    >
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
            <Button variant="outline" onClick={handleCloseMachineGrid} disabled={creating}>
              Back
            </Button>
            <Button onClick={handleCreateWithMachines} disabled={creating || !routineName.trim() || selectedMachines.length === 0}>
              {creating ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Creating...
                </>
              ) : (
                `Create Routine (${selectedMachines.length} machines)`
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    )
  }

  // Main menu view
  return (
    <Dialog open={open} onOpenChange={handleDialogClose}>
      <DialogContent className="sm:max-w-[600px] max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create New Routine</DialogTitle>
          <DialogDescription>
            Choose how you want to create a new routine for this client.
          </DialogDescription>
        </DialogHeader>

        <div className="py-4 space-y-4">
          {/* Machine Grid Selection Option */}
          <Card
            className="cursor-pointer hover:border-blue-500 hover:bg-blue-50 transition-all"
            onClick={handleOpenMachineGrid}
          >
            <CardHeader className="pb-2">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <Grid3X3 className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <CardTitle className="text-base">Select Machines from Grid</CardTitle>
                  <CardDescription>Choose machines visually and set the order</CardDescription>
                </div>
              </div>
            </CardHeader>
          </Card>

          {/* Custom Routine Option */}
          <Card
            className="cursor-pointer hover:border-slate-400 hover:bg-slate-50 transition-all"
            onClick={handleCreateCustom}
          >
            <CardHeader className="pb-2">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-slate-100 rounded-lg">
                  <Plus className="h-5 w-5 text-slate-600" />
                </div>
                <div>
                  <CardTitle className="text-base">Create Custom Routine</CardTitle>
                  <CardDescription>Full editor with all options</CardDescription>
                </div>
              </div>
            </CardHeader>
          </Card>

          {/* Divider */}
          {defaultRoutines.length > 0 && (
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t" />
              </div>
              <div className="relative flex justify-center">
                <span className="bg-white px-3 text-lg font-extrabold text-slate-800 uppercase tracking-wide">Use a Template</span>
              </div>
            </div>
          )}

          {/* Default Routines */}
          {loading ? (
            <div className="py-8 text-center text-slate-500">
              <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2" />
              Loading templates...
            </div>
          ) : defaultRoutines.length === 0 ? (
            <div className="py-4 text-center text-slate-500 text-sm">
              No default templates available.
            </div>
          ) : (
            <div className="space-y-2">
              {defaultRoutines.map((routine) => (
                <Card
                  key={routine.id}
                  className={`cursor-pointer transition-all ${
                    creating && selectedRoutineId === routine.id
                      ? 'border-emerald-500 bg-emerald-50'
                      : 'hover:border-emerald-500 hover:bg-emerald-50'
                  } ${creating && selectedRoutineId !== routine.id ? 'opacity-50' : ''}`}
                  onClick={() => !creating && handleCreateFromTemplate(routine)}
                >
                  <CardHeader className="pb-2">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-emerald-100 rounded-lg">
                        {creating && selectedRoutineId === routine.id ? (
                          <Loader2 className="h-5 w-5 text-emerald-600 animate-spin" />
                        ) : (
                          <FileText className="h-5 w-5 text-emerald-600" />
                        )}
                      </div>
                      <div className="flex-1">
                        <CardTitle className="text-base">{routine.name}</CardTitle>
                        {routine.description && (
                          <CardDescription>{routine.description}</CardDescription>
                        )}
                      </div>
                      {creating && selectedRoutineId === routine.id && (
                        <Badge className="bg-emerald-600">Creating...</Badge>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent className="pt-0">
                    {routine.program_machines && routine.program_machines.length > 0 ? (
                      <div className="flex flex-wrap gap-1">
                        {routine.program_machines
                          .sort((a, b) => a.order_index - b.order_index)
                          .map((pm) => (
                            <Badge key={pm.id} variant="outline" className="text-xs">
                              {pm.machines.machine_code}
                            </Badge>
                          ))}
                      </div>
                    ) : (
                      <p className="text-xs text-slate-400">No machines</p>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={creating}>
            Cancel
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
