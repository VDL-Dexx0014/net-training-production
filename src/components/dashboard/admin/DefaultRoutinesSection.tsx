// src/components/dashboard/admin/DefaultRoutinesSection.tsx
// Admin section for managing default/template routines

'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Plus, Search, Pencil, Trash2, Copy, GripVertical } from 'lucide-react'
import { toast } from 'sonner'
import { Database } from '@/types/database.types'
import { CreateDefaultRoutineDialog } from './CreateDefaultRoutineDialog'
import { EditDefaultRoutineDialog } from './EditDefaultRoutineDialog'

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

export function DefaultRoutinesSection() {
  const [routines, setRoutines] = useState<DefaultRoutine[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [createOpen, setCreateOpen] = useState(false)
  const [editRoutine, setEditRoutine] = useState<DefaultRoutine | null>(null)
  const [editOpen, setEditOpen] = useState(false)

  useEffect(() => {
    loadRoutines()
  }, [])

  const loadRoutines = async () => {
    setLoading(true)
    const supabase = createClient()

    const { data, error } = await supabase
      .from('programs')
      .select(`
        *,
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
      .order('name')

    if (error) {
      console.error('Error loading default routines:', error)
      toast.error('Failed to load default routines')
    } else {
      setRoutines((data || []) as DefaultRoutine[])
    }

    setLoading(false)
  }

  const handleDelete = async (routineId: string) => {
    if (!confirm('Are you sure you want to delete this default routine? This cannot be undone.')) {
      return
    }

    const supabase = createClient()

    // First delete program_machines
    await supabase.from('program_machines').delete().eq('program_id', routineId)

    // Then delete the program
    const { error } = await supabase.from('programs').delete().eq('id', routineId)

    if (error) {
      console.error('Error deleting routine:', error)
      toast.error('Failed to delete routine')
    } else {
      toast.success('Default routine deleted')
      loadRoutines()
    }
  }

  const handleDuplicate = async (routine: DefaultRoutine) => {
    const supabase = createClient()

    // Create new program
    const { data: newProgram, error: programError } = await supabase
      .from('programs')
      .insert({
        name: `${routine.name} (Copy)`,
        description: routine.description,
        goals: routine.goals,
        status: 'active',
        is_default: true,
        client_id: null,
      } as any)
      .select()
      .single()

    if (programError || !newProgram) {
      console.error('Error duplicating routine:', programError)
      toast.error('Failed to duplicate routine')
      return
    }

    // Copy program machines
    if (routine.program_machines && routine.program_machines.length > 0) {
      const machineInserts = routine.program_machines.map((pm) => ({
        program_id: (newProgram as any).id,
        machine_id: pm.machine_id,
        order_index: pm.order_index,
      }))

      const { error: machinesError } = await supabase
        .from('program_machines')
        .insert(machineInserts as any)

      if (machinesError) {
        console.error('Error copying machines:', machinesError)
        toast.error('Routine duplicated but failed to copy machines')
      }
    }

    toast.success('Routine duplicated')
    loadRoutines()
  }

  // Filter routines by search
  const filteredRoutines = routines.filter((routine) => {
    if (!searchQuery.trim()) return true
    const q = searchQuery.toLowerCase()
    return (
      routine.name.toLowerCase().includes(q) ||
      (routine.description && routine.description.toLowerCase().includes(q)) ||
      (routine.goals && routine.goals.toLowerCase().includes(q))
    )
  })

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h3 className="font-semibold text-lg">
          Default Routines{' '}
          <span className="font-normal text-sm">({routines.length} total)</span>
        </h3>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Create Default Routine
        </Button>
      </div>

      <p className="text-sm text-slate-500 mb-4">
        Default routines are templates that can be assigned to new clients. They define a standard set of machines and order.
      </p>

      {/* Search */}
      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4" />
        <Input
          placeholder="Search routines by name, description, or goals..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10"
        />
      </div>

      {loading ? (
        <div className="py-8 text-center">Loading default routines...</div>
      ) : filteredRoutines.length === 0 ? (
        <div className="py-8 text-center">
          {searchQuery ? 'No routines match your search' : 'No default routines created yet'}
        </div>
      ) : (
        <div className="space-y-4">
          {filteredRoutines.map((routine) => (
            <Card key={routine.id}>
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-lg">{routine.name}</CardTitle>
                    {routine.description && (
                      <CardDescription className="mt-1">{routine.description}</CardDescription>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDuplicate(routine)}
                      title="Duplicate"
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setEditRoutine(routine)
                        setEditOpen(true)
                      }}
                    >
                      <Pencil className="h-4 w-4 mr-1" />
                      Edit
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-red-600 hover:text-red-700 hover:bg-red-50"
                      onClick={() => handleDelete(routine.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {routine.goals && (
                  <p className="text-xs text-slate-500 mb-3">Goals: {routine.goals}</p>
                )}

                {routine.program_machines && routine.program_machines.length > 0 ? (
                  <div>
                    <p className="text-sm font-medium mb-2">
                      Machines ({routine.program_machines.length})
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {routine.program_machines
                        .sort((a, b) => a.order_index - b.order_index)
                        .map((pm, index) => (
                          <Badge key={pm.id} variant="outline" className="text-xs">
                            <span className="font-mono mr-1">{index + 1}.</span>
                            {pm.machines.machine_code} - {pm.machines.machine_name}
                          </Badge>
                        ))}
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-slate-400">No machines assigned</p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <CreateDefaultRoutineDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onRoutineCreated={loadRoutines}
      />

      <EditDefaultRoutineDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        routine={editRoutine}
        onRoutineUpdated={loadRoutines}
      />
    </div>
  )
}
