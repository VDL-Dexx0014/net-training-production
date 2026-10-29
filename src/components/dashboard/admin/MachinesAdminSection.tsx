// src/components/dashboard/admin/MachinesAdminSection.tsx
// Admin section for managing machines - machines as primary with location checkboxes

'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import { Plus, Search, Pencil, Trash2 } from 'lucide-react'
import { CreateMachineDialog } from './CreateMachineDialog'
import { EditMachineDialog } from './EditMachineDialog'
import { MachineImage } from '@/components/machine/MachineImage'
import { toast } from 'sonner'
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

interface Machine {
  id: string
  location_id: string | null
  machine_code: string
  machine_type: string
  machine_name: string
  description: string | null
  body_zone: string | null
  is_active: boolean
  notes: string | null
  image_url: string | null
  manufacturer: string | null
}

interface Location {
  id: string
  name: string
}

export function MachinesAdminSection() {
  const [machines, setMachines] = useState<Machine[]>([])
  const [locations, setLocations] = useState<Location[]>([])
  const [machineLocationMap, setMachineLocationMap] = useState<Map<string, Set<string>>>(new Map())
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [createOpen, setCreateOpen] = useState(false)
  const [editMachine, setEditMachine] = useState<Machine | null>(null)
  const [editOpen, setEditOpen] = useState(false)
  const [savingLocations, setSavingLocations] = useState<string | null>(null)
  const [machinesWithData, setMachinesWithData] = useState<Set<string>>(new Set())
  const [deleteTarget, setDeleteTarget] = useState<Machine | null>(null)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    setLoading(true)
    const supabase = createClient()

    const [locationsRes, machinesRes, machineLocationsRes, machineSessionsRes] = await Promise.all([
      supabase.from('locations').select('id, name').eq('is_active', true).order('name'),
      supabase.from('machines').select('*').order('machine_code'),
      supabase.from('machine_locations').select('machine_id, location_id'),
      (supabase.from('machine_sessions') as any).select('machine_id'),
    ])

    const locs = (locationsRes.data || []) as Location[]
    const allMachines = (machinesRes.data || []) as Machine[]
    const machineLocationLinks = (machineLocationsRes.data || []) as Array<{
      machine_id: string
      location_id: string
    }>
    const usedMachineIds = new Set<string>(
      ((machineSessionsRes.data || []) as Array<{ machine_id: string }>).map(r => r.machine_id)
    )
    setMachinesWithData(usedMachineIds)

    setLocations(locs)
    setMachines(allMachines)

    // Build machine -> locations map
    const mlMap = new Map<string, Set<string>>()
    for (const link of machineLocationLinks) {
      if (!mlMap.has(link.machine_id)) {
        mlMap.set(link.machine_id, new Set())
      }
      mlMap.get(link.machine_id)!.add(link.location_id)
    }

    // Fallback: if machine has location_id but no junction entry
    for (const machine of allMachines) {
      if (!mlMap.has(machine.id) && machine.location_id) {
        mlMap.set(machine.id, new Set([machine.location_id]))
      }
    }

    setMachineLocationMap(mlMap)
    setLoading(false)
  }

  const toggleMachineLocation = async (machineId: string, locationId: string) => {
    setSavingLocations(machineId)
    const supabase = createClient()
    const currentLocations = machineLocationMap.get(machineId) || new Set()
    const isAdding = !currentLocations.has(locationId)

    try {
      if (isAdding) {
        const { error } = await supabase
          .from('machine_locations')
          .insert({ machine_id: machineId, location_id: locationId } as any)
        if (error) throw error
      } else {
        const { error } = await supabase
          .from('machine_locations')
          .delete()
          .eq('machine_id', machineId)
          .eq('location_id', locationId)
        if (error) throw error
      }

      // Update local state
      setMachineLocationMap(prev => {
        const next = new Map(prev)
        const locs = new Set(next.get(machineId) || [])
        if (isAdding) {
          locs.add(locationId)
        } else {
          locs.delete(locationId)
        }
        next.set(machineId, locs)
        return next
      })

      // Also update legacy location_id
      const updatedLocs = new Set(machineLocationMap.get(machineId) || [])
      if (isAdding) updatedLocs.add(locationId)
      else updatedLocs.delete(locationId)
      const primaryLoc = updatedLocs.size > 0 ? Array.from(updatedLocs)[0] : null
      await (supabase.from('machines') as any).update({ location_id: primaryLoc }).eq('id', machineId)
    } catch (err) {
      console.error('Error updating machine location:', err)
      toast.error('Failed to update location')
    } finally {
      setSavingLocations(null)
    }
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    const supabase = createClient()
    try {
      const { error } = await (supabase.from('machines') as any).delete().eq('id', deleteTarget.id)
      if (error) throw error
      toast.success(`${deleteTarget.machine_name} deleted`)
      setDeleteTarget(null)
      await loadData()
    } catch (err) {
      console.error('Error deleting machine:', err)
      toast.error('Failed to delete machine')
    } finally {
      setDeleting(false)
    }
  }

  // Filter machines by search
  const filteredMachines = searchQuery.trim()
    ? machines.filter((m) => {
        const q = searchQuery.toLowerCase()
        return (
          m.machine_code.toLowerCase().includes(q) ||
          m.machine_name.toLowerCase().includes(q) ||
          m.machine_type.toLowerCase().includes(q) ||
          (m.manufacturer && m.manufacturer.toLowerCase().includes(q))
        )
      })
    : machines

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h3 className="font-semibold text-lg">
          Machines <span className="font-normal text-sm">({machines.length} total)</span>
        </h3>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Add Machine
        </Button>
      </div>

      {/* Search */}
      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4" />
        <Input
          placeholder="Search machines by code, name, type, or manufacturer..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10"
        />
      </div>

      {loading ? (
        <div className="py-8 text-center">Loading machines...</div>
      ) : filteredMachines.length === 0 ? (
        <div className="py-8 text-center">
          {searchQuery ? 'No machines match your search' : 'No machines configured'}
        </div>
      ) : (
        <div className="overflow-x-auto overflow-y-auto max-h-[60vh] rounded-lg border">
          <table className="w-full border-collapse text-sm">
            <thead className="sticky top-0 z-10">
              <tr className="bg-slate-50 border-b">
                <th className="text-left p-2 font-medium bg-slate-50">Machine</th>
                {locations.map(loc => (
                  <th key={loc.id} className="text-center p-2 font-medium text-xs min-w-[60px] bg-slate-50">
                    {loc.name}
                  </th>
                ))}
                <th className="w-16 bg-slate-50"></th>
              </tr>
            </thead>
            <tbody>
              {filteredMachines.map((machine) => {
                const machineLocations = machineLocationMap.get(machine.id) || new Set()
                return (
                  <tr
                    key={machine.id}
                    className={`border-b hover:bg-slate-50 transition-colors ${!machine.is_active ? 'opacity-50' : ''}`}
                  >
                    <td className="p-2">
                      <div className="flex items-center gap-2">
                        <MachineImage
                          src={machine.image_url}
                          alt={machine.machine_name}
                          size="sm"
                        />
                        <div>
                          <div className="font-mono font-medium">{machine.machine_code}</div>
                          <div className="text-xs text-slate-500">{machine.machine_name}</div>
                        </div>
                      </div>
                    </td>
                    {locations.map(loc => (
                      <td key={loc.id} className="p-2 text-center">
                        <Checkbox
                          checked={machineLocations.has(loc.id)}
                          onCheckedChange={() => toggleMachineLocation(machine.id, loc.id)}
                          disabled={savingLocations === machine.id}
                        />
                      </td>
                    ))}
                    <td className="p-2 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0"
                          onClick={() => { setEditMachine(machine); setEditOpen(true) }}
                        >
                          <Pencil className="h-3 w-3" />
                        </Button>
                        {!machinesWithData.has(machine.id) && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0 text-red-500 hover:text-red-700 hover:bg-red-50"
                            onClick={() => setDeleteTarget(machine)}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      <CreateMachineDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        locations={locations}
        onMachineCreated={loadData}
      />

      <EditMachineDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        machine={editMachine}
        locations={locations}
        onMachineUpdated={loadData}
      />

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) setDeleteTarget(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {deleteTarget?.machine_name}?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete <strong>{deleteTarget?.machine_code} — {deleteTarget?.machine_name}</strong> and remove it from all locations and routines. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleting}
              className="bg-red-600 hover:bg-red-700"
            >
              {deleting ? 'Deleting...' : 'Delete Machine'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
