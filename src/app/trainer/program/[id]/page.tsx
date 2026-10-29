// src/app/trainer/program/[id]/page.tsx
// Program edit page - modify program and add/remove/reorder machines

'use client'

import { useEffect, useState, useRef } from 'react'
import { useRouter, useParams, useSearchParams } from 'next/navigation'
import { useAuthStore } from '@/store/auth-store'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { ArrowLeft, Plus, Trash2, GripVertical } from 'lucide-react'
import Image from 'next/image'
import { toast } from 'sonner'
import { Database } from '@/types/database.types'
import { formatName } from '@/lib/utils/name-formatter'
import { MachineAttributeEditor } from '@/components/machine/MachineAttributeEditor'
import { MachineImage } from '@/components/machine/MachineImage'
import {
  getMachineAttributesBatch,
  getUserMachineAttributeValuesBatch,
  saveUserMachineAttributeValuesBatch,
  attrValueKey,
  type MachineAttributesMap,
  type AttributeValuesMap,
} from '@/lib/queries/machine-attributes'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
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
type Machine = Database['public']['Tables']['machines']['Row']

interface ProgramMachine {
  id?: string
  machine_id: string
  machine?: Machine
  order_index: number
  current_weight?: number
  current_reps?: number
  current_sets?: number
  initial_weight?: number
  initial_reps?: number
  initial_sets?: number
  notes?: string
}

// Sortable machine card component for drag-and-drop
interface SortableMachineCardProps {
  machine: ProgramMachine
  index: number
  id: string
  availableMachines: Machine[]
  usedMachineIds: Set<string>
  machineAttributesMap: MachineAttributesMap
  attributeValues: AttributeValuesMap
  handleMachineSelect: (index: number, machineId: string) => void
  updateAttributeValue: (machineId: string, attrDefId: string, value: string) => void
  updateMachine: (index: number, field: keyof ProgramMachine, value: string | number | undefined) => void
  removeMachine: (index: number) => void
}

function SortableMachineCard({
  machine,
  index,
  id,
  availableMachines,
  usedMachineIds,
  machineAttributesMap,
  attributeValues,
  handleMachineSelect,
  updateAttributeValue,
  updateMachine,
  removeMachine,
}: SortableMachineCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 50 : undefined,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="border rounded-lg p-4 space-y-4 bg-white"
    >
      <div className="flex items-start gap-3">
        <button
          type="button"
          className="touch-none cursor-grab active:cursor-grabbing mt-2"
          {...attributes}
          {...listeners}
        >
          <GripVertical className="h-5 w-5 text-slate-400" />
        </button>
        {machine.machine_id && (() => {
          const selectedMach = availableMachines.find(m => m.id === machine.machine_id)
          return selectedMach ? (
            <MachineImage
              src={selectedMach.image_url}
              alt={selectedMach.machine_name}
              size="sm"
            />
          ) : null
        })()}
        <div className="flex-1">
          <Select
            value={machine.machine_id}
            onValueChange={(value) => handleMachineSelect(index, value)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select machine" />
            </SelectTrigger>
            <SelectContent>
              {availableMachines.map((m) => {
                const isUsedElsewhere = usedMachineIds.has(m.id)
                return (
                  <SelectItem key={m.id} value={m.id} disabled={isUsedElsewhere}>
                    <span className={isUsedElsewhere ? 'text-slate-400' : ''}>
                      {m.machine_code} - {m.machine_name}
                      {isUsedElsewhere ? ' (already added)' : ''}
                    </span>
                  </SelectItem>
                )
              })}
            </SelectContent>
          </Select>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => removeMachine(index)}
          className="text-red-600 hover:text-red-700 hover:bg-red-50"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>

      {/* Machine Attribute Settings */}
      {machine.machine_id && machineAttributesMap.has(machine.machine_id) && (
        <div className="ml-8 mr-8">
          <MachineAttributeEditor
            machineId={machine.machine_id}
            attributes={machineAttributesMap.get(machine.machine_id) || []}
            values={attributeValues}
            onChange={updateAttributeValue}
          />
        </div>
      )}

      {/* Machine Notes */}
      {machine.machine_id && (
        <div className="ml-8 mr-8">
          <label className="text-xs font-medium text-slate-500 block mb-1">Notes</label>
          <Textarea
            value={machine.notes || ''}
            onChange={(e) => updateMachine(index, 'notes', e.target.value || undefined)}
            placeholder="Machine-specific notes for this routine..."
            rows={2}
            className="resize-none text-xs"
          />
        </div>
      )}
    </div>
  )
}

export default function ProgramEditPage() {
  const router = useRouter()
  const params = useParams()
  const searchParams = useSearchParams()
  const { profile, loading: authLoading, hasRole } = useAuthStore()
  const [program, setProgram] = useState<Program | null>(null)
  const [programName, setProgramName] = useState('')
  const [programDescription, setProgramDescription] = useState('')
  const [programGoals, setProgramGoals] = useState('')
  const [programNotes, setProgramNotes] = useState('')
  const [programStatus, setProgramStatus] = useState<'active' | 'completed' | 'archived'>('active')
  const [programMachines, setProgramMachines] = useState<ProgramMachine[]>([])
  const [machineKeys, setMachineKeys] = useState<string[]>([])
  const [availableMachines, setAvailableMachines] = useState<Machine[]>([])
  const [loading, setLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)
  const [machineAttributesMap, setMachineAttributesMap] = useState<MachineAttributesMap>(new Map())
  const [attributeValues, setAttributeValues] = useState<AttributeValuesMap>(new Map())
  const [sessionCount, setSessionCount] = useState(0)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [machinePickerOpen, setMachinePickerOpen] = useState(false)
  const [clientName, setClientName] = useState<{ first_name: string; last_name: string; high_risk?: boolean } | null>(null)
  const [trainerLocationName, setTrainerLocationName] = useState<string | null>(null)
  const [originalData, setOriginalData] = useState<{
    name: string
    description: string
    goals: string
    notes: string
    status: string
    machines: ProgramMachine[]
    attributeValues: string // JSON stringified for comparison
  } | null>(null)

  const programId = params?.id as string
  const isNewProgram = programId === 'new'
  const clientId = searchParams?.get('clientId')

  // DnD sensors — PointerSensor for mouse, TouchSensor with delay for tablet
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 200, tolerance: 8 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (over && active.id !== over.id) {
      const oldIndex = machineKeys.indexOf(active.id as string)
      const newIndex = machineKeys.indexOf(over.id as string)
      if (oldIndex !== -1 && newIndex !== -1) {
        setProgramMachines((items) => {
          const reordered = arrayMove(items, oldIndex, newIndex)
          reordered.forEach((m, i) => {
            m.order_index = i
          })
          return reordered
        })
        setMachineKeys((keys) => arrayMove(keys, oldIndex, newIndex))
      }
    }
  }

  useEffect(() => {
    if (!authLoading && (!profile || (!hasRole('trainer') && !hasRole('management')))) {
      router.push('/login')
      return
    }

    if (profile) {
      loadData()
    }
  }, [profile, authLoading, programId, router, hasRole])

  // Track unsaved changes
  useEffect(() => {
    if (loading || !originalData) {
      setHasUnsavedChanges(false)
      return
    }

    const currentAttrJson = JSON.stringify(Array.from(attributeValues.entries()).sort())
    const hasChanges =
      programName !== originalData.name ||
      programDescription !== originalData.description ||
      programGoals !== originalData.goals ||
      programNotes !== originalData.notes ||
      programStatus !== originalData.status ||
      JSON.stringify(programMachines) !== JSON.stringify(originalData.machines) ||
      currentAttrJson !== originalData.attributeValues

    setHasUnsavedChanges(hasChanges)
  }, [programName, programDescription, programGoals, programNotes, programStatus, programMachines, attributeValues, originalData, loading])

  // Warn before closing tab/window
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasUnsavedChanges) {
        e.preventDefault()
        e.returnValue = ''
      }
    }

    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [hasUnsavedChanges])

  // Android/browser back button: intercept popstate and use our handleNavigateBack logic
  useEffect(() => {
    window.history.pushState({ programEdit: true }, '')
    const onPopState = () => {
      handleNavigateBack()
    }
    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const loadData = async () => {
    const supabase = createClient()
    setLoading(true)

    // Load location name from localStorage
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('selectedLocation')
      if (stored) {
        try { setTrainerLocationName(JSON.parse(stored).name) } catch {}
      }
    }

    try {
      // Load available machines (you may want to filter by location)
      const { data: machinesData, error: machinesError } = await supabase
        .from('machines')
        .select('*')
        .eq('is_active', true)
        .order('machine_code')

      if (machinesError) {
        console.error('Error loading machines:', machinesError)
      } else if (machinesData) {
        setAvailableMachines(machinesData)
      }

      // For new programs, load client name from clientId query param
      if (isNewProgram && clientId) {
        const { data: clientData } = await supabase
          .from('profiles')
          .select('first_name, last_name, high_risk')
          .eq('id', clientId)
          .single()
        if (clientData) setClientName(clientData)
      }

      if (!isNewProgram) {
        // Load existing program and session count
        // Note: Programs are client-specific, RLS handles access control
        const [programRes, sessionCountRes] = await Promise.all([
          supabase
            .from('programs')
            .select('*')
            .eq('id', programId)
            .single(),
          supabase
            .from('sessions')
            .select('*', { count: 'exact', head: true })
            .eq('program_id', programId),
        ])

        const { data: programData, error: programError } = programRes
        setSessionCount(sessionCountRes.count || 0)

        if (programError || !programData) {
          toast.error('Failed to load routine')
          return
        }

        const typedProgram = programData as Program
        setProgram(typedProgram)

        // Load client name
        if (typedProgram.client_id) {
          const { data: clientData } = await supabase
            .from('profiles')
            .select('first_name, last_name, high_risk')
            .eq('id', typedProgram.client_id)
            .single()
          if (clientData) setClientName(clientData)
        }

        setProgramName(typedProgram.name)
        setProgramDescription(typedProgram.description || '')
        setProgramGoals(typedProgram.goals || '')
        setProgramNotes(typedProgram.notes || '')
        setProgramStatus(typedProgram.status as 'active' | 'completed' | 'archived')

        // Load program machines
        const { data: programMachinesData, error: programMachinesError } = await supabase
          .from('program_machines')
          .select(`
            *,
            machine:machines (*)
          `)
          .eq('program_id', programId)
          .order('order_index')

        if (programMachinesError) {
          // Failed to load program machines, continue with empty list
        } else if (programMachinesData) {
          setProgramMachines(programMachinesData as ProgramMachine[])
          setMachineKeys((programMachinesData as ProgramMachine[]).map((m) => m.id || crypto.randomUUID()))
        }

        // Load machine attribute definitions + user values
        const targetClientId = typedProgram.client_id
        if (programMachinesData && programMachinesData.length > 0) {
          const machineIds = (programMachinesData as ProgramMachine[]).map((pm) => pm.machine_id).filter(Boolean)
          if (machineIds.length > 0) {
            const [attrsMap, valsMap] = await Promise.all([
              getMachineAttributesBatch(machineIds),
              targetClientId
                ? getUserMachineAttributeValuesBatch(targetClientId, machineIds)
                : Promise.resolve(new Map() as AttributeValuesMap),
            ])
            setMachineAttributesMap(attrsMap)
            setAttributeValues(valsMap)

            // Store original data for comparison
            setOriginalData({
              name: typedProgram.name,
              description: typedProgram.description || '',
              goals: typedProgram.goals || '',
              notes: typedProgram.notes || '',
              status: typedProgram.status,
              machines: (programMachinesData as ProgramMachine[]) || [],
              attributeValues: JSON.stringify(Array.from(valsMap.entries()).sort()),
            })
          } else {
            setOriginalData({
              name: typedProgram.name,
              description: typedProgram.description || '',
              goals: typedProgram.goals || '',
              notes: typedProgram.notes || '',
              status: typedProgram.status,
              machines: (programMachinesData as ProgramMachine[]) || [],
              attributeValues: '[]',
            })
          }
        } else {
          setOriginalData({
            name: typedProgram.name,
            description: typedProgram.description || '',
            goals: typedProgram.goals || '',
            notes: typedProgram.notes || '',
            status: typedProgram.status,
            machines: [],
            attributeValues: '[]',
          })
        }
      }
    } catch {
      // Error loading data
    } finally {
      setLoading(false)
    }
  }

  const addMachine = () => {
    const newMachine: ProgramMachine = {
      machine_id: '',
      order_index: programMachines.length,
      current_weight: undefined,
      current_reps: undefined,
      current_sets: undefined,
      initial_weight: undefined,
      initial_reps: undefined,
      initial_sets: undefined,
    }
    setProgramMachines([...programMachines, newMachine])
    setMachineKeys((prev) => [...prev, crypto.randomUUID()])
  }

  const addMachineById = async (machineId: string) => {
    const newMachine: ProgramMachine = {
      machine_id: machineId,
      order_index: programMachines.length,
    }
    const newKey = crypto.randomUUID()
    setProgramMachines((prev) => [...prev, newMachine])
    setMachineKeys((prev) => [...prev, newKey])
    setMachinePickerOpen(false)
    // Load attributes for the newly added machine
    await handleMachineSelect(programMachines.length, machineId)
  }

  const removeMachine = (index: number) => {
    const updated = programMachines.filter((_, i) => i !== index)
    // Update order indices
    updated.forEach((machine, i) => {
      machine.order_index = i
    })
    setProgramMachines(updated)
    setMachineKeys((prev) => prev.filter((_, i) => i !== index))
  }

  const updateMachine = (index: number, field: keyof ProgramMachine, value: string | number | undefined) => {
    const updated = [...programMachines]
    updated[index] = { ...updated[index], [field]: value }
    setProgramMachines(updated)
  }

  const updateAttributeValue = (machineId: string, attrDefId: string, value: string) => {
    setAttributeValues(prev => {
      const next = new Map(prev)
      next.set(attrValueKey(machineId, attrDefId), value)
      return next
    })
  }

  // When a new machine is selected, load its attributes if not already loaded
  const handleMachineSelect = async (index: number, machineId: string) => {
    updateMachine(index, 'machine_id', machineId)

    // Load attributes for this machine if not already in the map
    if (!machineAttributesMap.has(machineId)) {
      const newAttrs = await getMachineAttributesBatch([machineId])
      if (newAttrs.size > 0) {
        setMachineAttributesMap(prev => {
          const next = new Map(prev)
          newAttrs.forEach((val, key) => next.set(key, val))
          return next
        })
      }

      // Also load existing values for this machine if there's a client
      const targetClientId = clientId || program?.client_id
      if (targetClientId) {
        const newVals = await getUserMachineAttributeValuesBatch(targetClientId, [machineId])
        setAttributeValues(prev => {
          const next = new Map(prev)
          // Seed defaults for attrs with no saved value
          const attrs = newAttrs.get(machineId) || []
          for (const { link, definition } of attrs) {
            const key = `${machineId}:${definition.id}`
            if (!next.has(key) && definition.default_value != null) {
              next.set(key, definition.default_value)
            }
          }
          newVals.forEach((val, key) => next.set(key, val))
          return next
        })
      } else {
        // No client — still seed defaults
        setAttributeValues(prev => {
          const next = new Map(prev)
          const attrs = newAttrs.get(machineId) || []
          for (const { definition } of attrs) {
            const key = `${machineId}:${definition.id}`
            if (!next.has(key) && definition.default_value != null) {
              next.set(key, definition.default_value)
            }
          }
          return next
        })
      }
    }
  }

  const handleNavigateBack = () => {
    if (hasUnsavedChanges) {
      const confirmed = window.confirm(
        'You have unsaved changes. Are you sure you want to leave? All changes will be lost.'
      )
      if (!confirmed) return
    }

    // Navigate back to client's routines tab
    if (clientId) {
      router.push(`/trainer/client/${clientId}?tab=routines`)
    } else if (program) {
      router.push(`/trainer/client/${program.client_id}?tab=routines`)
    } else if (hasRole('management') && !hasRole('trainer')) {
      router.push('/management/dashboard')
    } else {
      router.push('/trainer/dashboard')
    }
  }

  const handleSave = async () => {
    if (!programName.trim()) {
      toast.error('Routine name is required')
      return
    }

    if (isNewProgram && !clientId) {
      toast.error('Client ID is required for new routines')
      return
    }

    // Check for duplicate routine name for this client
    const targetClientId = isNewProgram ? clientId : program?.client_id
    if (targetClientId) {
      const supabaseCheck = createClient()
      let nameCheckQuery = supabaseCheck
        .from('programs')
        .select('id')
        .eq('client_id', targetClientId)
        .ilike('name', programName.trim())
        .eq('is_default', false)

      if (!isNewProgram) {
        nameCheckQuery = nameCheckQuery.neq('id', programId)
      }

      const { data: existing } = await nameCheckQuery
      if (existing && existing.length > 0) {
        toast.error(`A routine named "${programName.trim()}" already exists for this client`)
        return
      }
    }

    setIsSaving(true)
    const supabase = createClient()

    try {
      let finalProgramId = programId

      if (isNewProgram) {
        // Create new program
        // Note: Programs are client-specific, trainer_id is not required
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: newProgram, error: programError } = await (supabase.from('programs') as any)
          .insert({
            client_id: clientId as string,
            name: programName,
            description: programDescription || null,
            goals: programGoals || null,
            notes: programNotes || null,
            status: programStatus,
          })
          .select()
          .single()

        if (programError || !newProgram) {
          toast.error('Failed to create routine')
          return
        }

        finalProgramId = (newProgram as { id: string }).id
      } else {
        // Update existing program
        // Note: RLS policies control access, no need to filter by trainer_id
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { error: updateError } = await (supabase.from('programs') as any)
          .update({
            name: programName,
            description: programDescription || null,
            goals: programGoals || null,
            notes: programNotes || null,
            status: programStatus,
            updated_at: new Date().toISOString(),
          })
          .eq('id', programId)

        if (updateError) {
          toast.error('Failed to update routine')
          return
        }
      }

      // Save program machines
      if (programMachines.length > 0) {
        // Get the client ID for historical weight lookup
        const targetClientId = isNewProgram ? clientId : program?.client_id

        // Build insert payload first — before touching the DB
        const validMachines = programMachines.filter((m) => m.machine_id)
        const machinesWithHistoricalWeights = await Promise.all(
          validMachines
            .map(async (m, idx) => {
              let initialWeight = m.initial_weight || null
              let initialReps = m.initial_reps || null
              let initialSets = m.initial_sets || null

              if (!initialWeight && targetClientId) {
                const { data: sessionsData } = await supabase
                  .from('sessions')
                  .select('id')
                  .eq('client_id', targetClientId)
                  .eq('status', 'completed')
                  .order('scheduled_start', { ascending: true })

                if (sessionsData && sessionsData.length > 0) {
                  const sessionIds = (sessionsData as { id: string }[]).map((s) => s.id)

                  const { data: firstMachineSession, error: machineSessionError } = await supabase
                    .from('machine_sessions')
                    .select('weight_lbs, reps, sets, start_time')
                    .in('session_id', sessionIds)
                    .eq('machine_id', m.machine_id)
                    .not('weight_lbs', 'is', null)
                    .order('start_time', { ascending: true })
                    .limit(1)
                    .maybeSingle()

                  interface FirstMachineSessionData {
                    weight_lbs: number | null
                    reps: number | null
                    sets: number | null
                    start_time: string
                  }

                  if (firstMachineSession && !machineSessionError) {
                    const typedSession = firstMachineSession as FirstMachineSessionData
                    initialWeight = typedSession.weight_lbs
                    if (!initialReps && typedSession.reps) initialReps = typedSession.reps
                    if (!initialSets && typedSession.sets) initialSets = typedSession.sets
                  }
                }
              }

              return {
                program_id: finalProgramId,
                machine_id: m.machine_id,
                order_index: m.order_index ?? idx,
                current_weight: m.current_weight || null,
                current_reps: m.current_reps || null,
                current_sets: m.current_sets || null,
                initial_weight: initialWeight || m.current_weight || null,
                initial_reps: initialReps || m.current_reps || null,
                initial_sets: initialSets || m.current_sets || null,
                notes: m.notes || null,
              }
            })
        )

        if (machinesWithHistoricalWeights.length > 0) {
          // Delete only after insert payload is ready — avoids data loss if payload build fails
          if (!isNewProgram) {
            const { error: deleteError } = await supabase
              .from('program_machines')
              .delete()
              .eq('program_id', finalProgramId)

            if (deleteError) {
              console.error('program_machines delete error:', deleteError)
              toast.error(`Failed to clear old machines: ${deleteError.message || deleteError.code || 'unknown error'}`)
              return
            }
          }

          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const { error: insertError } = await (supabase.from('program_machines') as any)
            .insert(machinesWithHistoricalWeights)

          if (insertError) {
            console.error('program_machines insert error:', insertError, 'payload:', machinesWithHistoricalWeights)
            toast.error(`Failed to save machines: ${insertError.message || insertError.code || 'unknown error'}`)
            return
          }
        } else {
          // All machines had empty machine_id — nothing to save
          console.warn('handleSave: no valid machines to insert (all filtered out)', validMachines)
        }
      }

      // Save machine attribute values
      const targetClientIdForSettings = isNewProgram ? clientId : program?.client_id
      if (targetClientIdForSettings && attributeValues.size > 0) {
        const { error: settingsError } = await saveUserMachineAttributeValuesBatch(
          targetClientIdForSettings,
          attributeValues
        )

        if (settingsError) {
          toast.error('Routine saved but failed to save machine settings')
        }
      }

      toast.success(isNewProgram ? 'Routine created successfully!' : 'Routine updated successfully!')

      // Update original data to match current state (mark as saved)
      setOriginalData({
        name: programName,
        description: programDescription,
        goals: programGoals,
        notes: programNotes,
        status: programStatus,
        machines: programMachines,
        attributeValues: JSON.stringify(Array.from(attributeValues.entries()).sort()),
      })
      setHasUnsavedChanges(false)

      // For new programs, redirect to the edit page for the created program
      // For existing programs, stay on the same page
      if (isNewProgram && finalProgramId) {
        router.replace(`/trainer/program/${finalProgramId}`)
      }
      // Otherwise, stay on the current page - no redirect needed
    } catch {
      toast.error('An error occurred while saving')
    } finally {
      setIsSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!program) return

    setIsDeleting(true)
    const supabase = createClient()

    try {
      // Delete program machines first
      await supabase
        .from('program_machines')
        .delete()
        .eq('program_id', program.id)

      // Delete the program
      const { error } = await supabase
        .from('programs')
        .delete()
        .eq('id', program.id)

      if (error) {
        toast.error('Failed to delete routine')
        return
      }

      toast.success('Routine deleted successfully')
      setDeleteDialogOpen(false)

      // Navigate back to client's routines tab
      router.push(`/trainer/client/${program.client_id}?tab=routines`)
    } catch {
      toast.error('Failed to delete routine')
    } finally {
      setIsDeleting(false)
    }
  }

  if (loading || authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-lg">Loading...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Single combined header — back + routine info left, logo right */}
      <header className="bg-white border-b sticky top-0 z-40">
        <div className="container mx-auto px-3 py-1.5 flex justify-between items-center gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <Button
              variant="outline"
              size="icon"
              onClick={handleNavigateBack}
              className="h-8 w-8 shrink-0 border-2 border-slate-300 hover:border-slate-500 hover:bg-slate-100"
            >
              <ArrowLeft className="h-4 w-4 stroke-[2.5]" />
            </Button>
            <div className="min-w-0">
              {clientName ? (
                <div className="flex items-baseline gap-2 flex-wrap">
                  <h1 className="text-base font-bold leading-tight">
                    {formatName(clientName.first_name, clientName.last_name, 'management')}
                  </h1>
                  {clientName.high_risk && (
                    <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-700">High Risk</span>
                  )}
                  <span className="text-xs text-slate-500">
                    {isNewProgram ? 'Create Routine' : 'Edit Routine'}
                    {hasUnsavedChanges && <span className="ml-1 text-orange-600">(Unsaved)</span>}
                  </span>
                </div>
              ) : (
                <h1 className="text-base font-bold leading-tight">
                  {isNewProgram ? 'Create Routine' : 'Edit Routine'}
                  {hasUnsavedChanges && <span className="ml-2 text-xs font-normal text-orange-600">(Unsaved)</span>}
                </h1>
              )}
              {trainerLocationName && (
                <p className="text-xs text-slate-500 leading-tight">{trainerLocationName}</p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {!isNewProgram && sessionCount === 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setDeleteDialogOpen(true)}
                className="h-7 text-xs text-red-600 border-red-300 hover:bg-red-50"
              >
                <Trash2 className="h-3 w-3 mr-1" />Delete
              </Button>
            )}
            <Button size="sm" onClick={handleSave} disabled={isSaving} className="h-7 text-xs font-bold">
              {isSaving ? 'Saving...' : hasUnsavedChanges ? 'Save Changes' : 'Save Routine'}
            </Button>
            <div style={{ backgroundColor: 'rgb(227, 221, 45)' }} className="flex items-center justify-center h-8 px-3 rounded">
              <Image src="/net_logo_new.png" alt="NET" width={72} height={24} className="object-contain" style={{ width: 'auto', height: '20px' }} priority />
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-3 pt-1 pb-3">
        <Card>
          <CardContent className="pt-4 pb-4">
            {/* Routine details + machines in one card */}
            <div className="flex gap-3 items-end mb-3">
              <div className="flex-1 max-w-md space-y-1">
                <Label htmlFor="name" className="text-xs text-red-600 font-semibold">Routine Name *</Label>
                <Input
                  id="name"
                  value={programName}
                  onChange={(e) => setProgramName(e.target.value)}
                  className={`h-8 text-sm border-red-400 focus:border-red-500 ${!programName.trim() ? 'border-red-400' : 'border-red-400'}`}
                />
              </div>

              <div className="w-36 space-y-1">
                <Label htmlFor="status" className="text-xs">Status</Label>
                <Select value={programStatus} onValueChange={(value: 'active' | 'completed' | 'archived') => setProgramStatus(value)}>
                  <SelectTrigger id="status" className="h-8 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                    <SelectItem value="archived">Archived</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex-1 space-y-1">
                <Label htmlFor="notes" className="text-xs text-red-600 font-semibold">Instructor Notes</Label>
                <Textarea
                  id="notes"
                  value={programNotes}
                  onChange={(e) => {
                    setProgramNotes(e.target.value)
                    e.target.style.height = 'auto'
                    e.target.style.height = e.target.scrollHeight + 'px'
                  }}
                  rows={1}
                  className="resize-none overflow-hidden text-sm h-8 py-1.5 border-red-400 text-red-700 placeholder:text-red-300 focus:border-red-500"
                />
              </div>
            </div>

            <div className="border-t pt-3 flex items-center justify-between mb-3">
              <div>
                <p className="text-sm font-medium">Machines</p>
                <p className="text-xs text-slate-500">Add machines and drag to reorder</p>
              </div>
              <Button onClick={() => setMachinePickerOpen(true)} variant="outline" size="sm">
                <Plus className="h-4 w-4 mr-1" />
                Add Machine
              </Button>
            </div>
          </CardContent>
          <CardContent className="pt-0 pb-4">
            {programMachines.length === 0 ? (
              <div className="py-12 text-center text-slate-500">
                <p className="text-lg mb-2">No machines added yet</p>
                <p className="text-sm">
                  Click &quot;Add Machine&quot; to start building this routine
                </p>
              </div>
            ) : (
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd}
              >
                <SortableContext
                  items={machineKeys}
                  strategy={verticalListSortingStrategy}
                >
                  <div className="space-y-4">
                    {programMachines.map((machine, index) => {
                      // Build set of machine IDs used by OTHER slots (exclude current index)
                      const usedMachineIds = new Set(
                        programMachines
                          .filter((_, i) => i !== index)
                          .map((m) => m.machine_id)
                          .filter(Boolean)
                      )
                      return (
                        <SortableMachineCard
                          key={machineKeys[index]}
                          id={machineKeys[index]}
                          machine={machine}
                          index={index}
                          availableMachines={availableMachines}
                          usedMachineIds={usedMachineIds}
                          machineAttributesMap={machineAttributesMap}
                          attributeValues={attributeValues}
                          handleMachineSelect={handleMachineSelect}
                          updateAttributeValue={updateAttributeValue}
                          updateMachine={updateMachine}
                          removeMachine={removeMachine}
                        />
                      )
                    })}
                  </div>
                </SortableContext>
              </DndContext>
            )}
          </CardContent>
        </Card>
      </main>

      {/* Machine Picker Dialog */}
      <Dialog open={machinePickerOpen} onOpenChange={setMachinePickerOpen}>
        <DialogContent className="sm:max-w-[640px] max-h-[80vh] overflow-y-auto" showCloseButton={true}>
          <DialogHeader>
            <DialogTitle>Add Machine</DialogTitle>
          </DialogHeader>
          <div className="pt-2">
            {(() => {
              const usedIds = new Set(programMachines.map((m) => m.machine_id).filter(Boolean))
              const available = availableMachines.filter((m) => !usedIds.has(m.id))
              const added = availableMachines.filter((m) => usedIds.has(m.id))
              return (
                <>
                  {available.length === 0 && (
                    <p className="text-sm text-slate-500 text-center py-8">All machines are already added to this routine.</p>
                  )}
                  {available.length > 0 && (
                    <div className="flex flex-wrap gap-2 mb-4">
                      {available.map((m) => (
                        <button
                          key={m.id}
                          onClick={() => addMachineById(m.id)}
                          className="px-3 py-2 rounded-lg border-2 border-slate-300 bg-white hover:bg-blue-50 hover:border-blue-400 hover:text-blue-700 transition-all font-bold text-base"
                        >
                          {m.machine_code}
                        </button>
                      ))}
                    </div>
                  )}
                  {added.length > 0 && (
                    <div>
                      <p className="text-xs text-slate-400 mb-2">Already in routine</p>
                      <div className="flex flex-wrap gap-2">
                        {added.map((m) => (
                          <span key={m.id} className="px-3 py-2 rounded-lg border border-slate-200 bg-slate-50 text-slate-400 font-bold text-base cursor-default">
                            {m.machine_code}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )
            })()}
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Routine</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to permanently delete "{programName}"?
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isDeleting}
              className="bg-red-600 hover:bg-red-700"
            >
              {isDeleting ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
