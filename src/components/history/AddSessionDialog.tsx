// src/components/history/AddSessionDialog.tsx
'use client'

import React, { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuthStore } from '@/store/auth-store'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { X, Plus } from 'lucide-react'

interface MeasurementType {
  id: string
  name: string
  abbreviation: string
  units: string[]
}

interface MachineOption {
  id: string
  code: string
  name: string
}

interface MachineEntry {
  key: string           // stable local key (machineId or generated for extras)
  machineId: string
  machineCode: string
  machineName: string
  measurementTypeId: string
  weightLbs: string
  totalTimeSeconds: string
  reps: string
}

interface AddSessionDialogProps {
  clientId: string
  programs: Array<{
    id: string
    name: string
    program_machines: Array<{
      machine_id: string
      machines: { id: string; machine_code: string; machine_name: string }
    }>
  }>
  onSessionAdded: () => void
}

export function AddSessionDialog({ clientId, programs, onSessionAdded }: AddSessionDialogProps) {
  const { profile } = useAuthStore()
  const [open, setOpen] = useState(false)

  const [selectedProgramId, setSelectedProgramId] = useState('')
  const [sessionDate, setSessionDate] = useState(new Date().toISOString().split('T')[0])
  const [selectedLocationId, setSelectedLocationId] = useState('')
  const [selectedTrainerId, setSelectedTrainerId] = useState('')
  const [machineEntries, setMachineEntries] = useState<MachineEntry[]>([])

  const [locations, setLocations] = useState<{ id: string; name: string }[]>([])
  const [trainers, setTrainers] = useState<{ id: string; name: string }[]>([])
  const [measurementTypes, setMeasurementTypes] = useState<MeasurementType[]>([])
  const [allMachines, setAllMachines] = useState<MachineOption[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    const supabase = createClient()
    async function loadLookups() {
      const [locRes, trainerRes, mtRes, machinesRes] = await Promise.all([
        supabase.from('locations').select('id, name').eq('is_active', true).order('name'),
        supabase.from('profiles').select('id, first_name, last_name').eq('role', 'trainer').eq('is_active', true).order('first_name'),
        supabase.from('measurement_types').select('id, name, abbreviation, units, sort_order').eq('is_active', true).order('sort_order').order('name'),
        supabase.from('machines').select('id, machine_code, machine_name').eq('is_active', true).order('machine_code'),
      ])
      setLocations(locRes.data || [])
      setTrainers(
        (trainerRes.data || []).map((t: any) => ({
          id: t.id,
          name: `${t.first_name}${t.last_name ? ' ' + t.last_name.charAt(0).toUpperCase() : ''}`.trim(),
        }))
      )
      setMeasurementTypes(mtRes.data || [])
      setAllMachines((machinesRes.data || []).map((m: any) => ({ id: m.id, code: m.machine_code, name: m.machine_name })))
    }
    loadLookups()
    if (profile && (profile.role === 'trainer' || profile.roles?.includes('trainer'))) {
      setSelectedTrainerId(profile.id)
    }
  }, [open, profile])

  useEffect(() => {
    if (!selectedProgramId) { setMachineEntries([]); return }
    const program = programs.find((p) => p.id === selectedProgramId)
    if (!program) { setMachineEntries([]); return }
    const sorted = [...program.program_machines]
      .filter((pm) => pm.machines)
      .sort((a: any, b: any) => (a.order_index ?? 0) - (b.order_index ?? 0))
    setMachineEntries(
      sorted.map((pm) => ({
        key: pm.machines.id,
        machineId: pm.machines.id,
        machineCode: pm.machines.machine_code,
        machineName: pm.machines.machine_name,
        measurementTypeId: '',
        weightLbs: '',
        totalTimeSeconds: '',
        reps: '',
      }))
    )
  }, [selectedProgramId, programs])

  const updateEntry = (idx: number, field: keyof MachineEntry, value: string) => {
    setMachineEntries((prev) => {
      const next = [...prev]
      next[idx] = { ...next[idx], [field]: value }
      return next
    })
  }

  const removeEntry = (idx: number) => {
    setMachineEntries((prev) => prev.filter((_, i) => i !== idx))
  }

  const addMachine = (machineId: string) => {
    const machine = allMachines.find((m) => m.id === machineId)
    if (!machine) return
    setMachineEntries((prev) => [
      ...prev,
      {
        key: `extra-${machineId}-${Date.now()}`,
        machineId: machine.id,
        machineCode: machine.code,
        machineName: machine.name,
        measurementTypeId: '',
        weightLbs: '',
        totalTimeSeconds: '',
        reps: '',
      },
    ])
  }

  // Machines already in the table (may appear multiple times if added twice)
  const usedMachineIds = new Set(machineEntries.map((e) => e.machineId))
  const availableToAdd = allMachines.filter((m) => !usedMachineIds.has(m.id))

  const handleSave = async () => {
    if (!selectedProgramId || !sessionDate || !selectedLocationId || !selectedTrainerId) {
      setError('Please fill in all required fields (routine, date, location, trainer).')
      return
    }
    setSaving(true)
    setError(null)
    try {
      const sessionStart = `${sessionDate}T12:00:00.000Z`
      const sessionEnd = `${sessionDate}T13:00:00.000Z`

      const machineRows = machineEntries
        .filter((e) => e.weightLbs || e.totalTimeSeconds || e.reps)
        .map((e) => {
          const machineTimeSecs = e.totalTimeSeconds ? parseInt(e.totalTimeSeconds, 10) : 0
          const machineEndTime = machineTimeSecs > 0
            ? new Date(new Date(sessionStart).getTime() + machineTimeSecs * 1000).toISOString()
            : sessionStart
          return {
            machine_id: e.machineId,
            measurement_type_id: e.measurementTypeId || null,
            start_time: sessionStart,
            end_time: machineEndTime,
            weight_lbs: e.weightLbs ? parseFloat(e.weightLbs) : null,
            total_time_seconds: machineTimeSecs > 0 ? machineTimeSecs : null,
            reps: e.reps ? parseInt(e.reps, 10) : null,
          }
        })

      const res = await fetch('/api/trainer/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session: {
            client_id: clientId,
            trainer_id: selectedTrainerId,
            location_id: selectedLocationId,
            program_id: selectedProgramId,
            scheduled_start: sessionStart,
            scheduled_end: sessionEnd,
            actual_start: sessionStart,
            actual_end: sessionEnd,
            status: 'completed',
          },
          machineRows,
        }),
      })

      const json = await res.json()
      if (!res.ok) {
        setError(json.error || 'Failed to save session.')
        return
      }

      setOpen(false)
      resetForm()
      onSessionAdded()
    } catch (e: any) {
      setError(e?.message || 'Unexpected error saving session.')
    } finally {
      setSaving(false)
    }
  }

  const resetForm = () => {
    setSelectedProgramId('')
    setSessionDate(new Date().toISOString().split('T')[0])
    setSelectedLocationId('')
    setSelectedTrainerId(
      profile && (profile.role === 'trainer' || profile.roles?.includes('trainer')) ? profile.id : ''
    )
    setMachineEntries([])
    setError(null)
  }

  const canSave = !!selectedProgramId && !!sessionDate && !!selectedLocationId && !!selectedTrainerId

  return (
    <>
      <Button size="sm" className="h-8 text-xs bg-blue-600 hover:bg-blue-700 text-white" onClick={() => setOpen(true)}>
        Add Session
      </Button>

      <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) resetForm() }}>
        <DialogContent className="!max-w-3xl !w-[90vw] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add Completed Session</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 pt-2">
            {/* Row 1: Trainer | Location | Routine */}
            <div className="grid grid-cols-3 gap-3">
              <div className="min-w-0">
                <label className="text-xs font-medium text-slate-600 block mb-1">Instructor *</label>
                <Select value={selectedTrainerId} onValueChange={setSelectedTrainerId}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Select trainer..." /></SelectTrigger>
                  <SelectContent>{trainers.map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="min-w-0">
                <label className="text-xs font-medium text-slate-600 block mb-1">Location *</label>
                <Select value={selectedLocationId} onValueChange={setSelectedLocationId}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Select location..." /></SelectTrigger>
                  <SelectContent>{locations.map((loc) => <SelectItem key={loc.id} value={loc.id}>{loc.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="min-w-0">
                <label className="text-xs font-medium text-slate-600 block mb-1">Routine *</label>
                <Select value={selectedProgramId} onValueChange={setSelectedProgramId}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Select routine..." /></SelectTrigger>
                  <SelectContent>{[...programs].sort((a, b) => a.name.localeCompare(b.name)).map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>

            {/* Row 2: Date */}
            <div className="max-w-xs">
              <label className="text-xs font-medium text-slate-600 block mb-1">Date *</label>
              {(() => {
                const [y, m, d] = sessionDate.split('-').map(Number)
                const daysInMonth = new Date(y, m, 0).getDate()
                const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
                const setDatePart = (part: 'y'|'m'|'d', val: number) => {
                  const ny = part === 'y' ? val : y
                  const nm = part === 'm' ? val : m
                  const nd = part === 'd' ? Math.min(val, new Date(ny, nm, 0).getDate()) : Math.min(d, new Date(ny, nm, 0).getDate())
                  setSessionDate(`${ny}-${String(nm).padStart(2,'0')}-${String(nd).padStart(2,'0')}`)
                }
                return (
                  <div className="flex gap-1">
                    <Select value={String(d)} onValueChange={v => setDatePart('d', Number(v))}>
                      <SelectTrigger className="h-8 text-xs flex-1 min-w-0"><SelectValue /></SelectTrigger>
                      <SelectContent>{Array.from({length: daysInMonth}, (_,i) => i+1).map(n => <SelectItem key={n} value={String(n)}>{n}</SelectItem>)}</SelectContent>
                    </Select>
                    <Select value={String(m)} onValueChange={v => setDatePart('m', Number(v))}>
                      <SelectTrigger className="h-8 text-xs flex-1 min-w-0"><SelectValue /></SelectTrigger>
                      <SelectContent>{months.map((mo,i) => <SelectItem key={i+1} value={String(i+1)}>{mo}</SelectItem>)}</SelectContent>
                    </Select>
                    <Select value={String(y)} onValueChange={v => setDatePart('y', Number(v))}>
                      <SelectTrigger className="h-8 text-xs flex-1 min-w-0"><SelectValue /></SelectTrigger>
                      <SelectContent>{[2024,2025,2026,2027].map(yr => <SelectItem key={yr} value={String(yr)}>{yr}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                )
              })()}
            </div>

            {/* Machine data table */}
            <div>
              <p className="text-xs font-medium text-slate-600 mb-2">
                Machine Data <span className="text-slate-400 font-normal">(leave blank to skip)</span>
              </p>
              <div className="border rounded-md overflow-hidden">
                <table className="w-full text-xs" style={{ tableLayout: 'fixed' }}>
                  <colgroup>
                    <col style={{ width: '13%' }} />
                    <col style={{ width: '20%' }} />
                    <col style={{ width: '18%' }} />
                    <col style={{ width: '18%' }} />
                    <col style={{ width: '18%' }} />
                    <col style={{ width: '13%' }} />
                  </colgroup>
                  <thead>
                    <tr className="bg-slate-100 border-b">
                      <th className="text-left px-2 py-2 font-semibold">Machine</th>
                      <th className="text-left px-2 py-2 font-semibold">Type</th>
                      <th className="text-center px-2 py-2 font-semibold">lbs</th>
                      <th className="text-center px-2 py-2 font-semibold">sec</th>
                      <th className="text-center px-2 py-2 font-semibold">reps</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {machineEntries.map((entry, idx) => {
                      const mt = measurementTypes.find(m => m.id === entry.measurementTypeId)
                      const units: string[] = mt?.units ?? []
                      const hasUnits = units.length > 0
                      const needsWeight = !hasUnits || units.includes('weight')
                      const needsTime = !hasUnits || units.includes('time')
                      const needsReps = !hasUnits || units.includes('reps')
                      return (
                        <tr key={entry.key} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                          <td className="px-2 py-1.5">
                            <div className="font-bold">{entry.machineCode}</div>
                            <div className="text-[10px] text-slate-400 truncate">{entry.machineName}</div>
                          </td>
                          <td className="px-2 py-1.5">
                            <Select
                              value={entry.measurementTypeId || undefined}
                              onValueChange={(v) => updateEntry(idx, 'measurementTypeId', v)}
                            >
                              <SelectTrigger className="h-7 text-xs w-full"><SelectValue placeholder="–" /></SelectTrigger>
                              <SelectContent>
                                {measurementTypes.map((mtype) => (
                                  <SelectItem key={mtype.id} value={mtype.id}>{mtype.abbreviation}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </td>
                          <td className="px-2 py-1.5">
                            <Input type="number" min="0" step="2" value={entry.weightLbs}
                              onChange={(e) => updateEntry(idx, 'weightLbs', e.target.value)}
                              onBlur={(e) => { const v = Math.round(parseFloat(e.target.value || '0') / 2) * 2; updateEntry(idx, 'weightLbs', v > 0 ? v.toString() : '') }}
                              placeholder="—" disabled={!needsWeight}
                              className={`h-7 text-xs w-full text-center ${!needsWeight ? 'bg-slate-100 text-slate-300 cursor-not-allowed' : ''}`}
                            />
                          </td>
                          <td className="px-2 py-1.5">
                            <Input type="number" min="0" value={entry.totalTimeSeconds}
                              onChange={(e) => updateEntry(idx, 'totalTimeSeconds', e.target.value)}
                              placeholder="—" disabled={!needsTime}
                              className={`h-7 text-xs w-full text-center ${!needsTime ? 'bg-slate-100 text-slate-300 cursor-not-allowed' : ''}`}
                            />
                          </td>
                          <td className="px-2 py-1.5">
                            <Input type="number" min="0" value={entry.reps}
                              onChange={(e) => updateEntry(idx, 'reps', e.target.value)}
                              placeholder="—" disabled={!needsReps}
                              className={`h-7 text-xs w-full text-center ${!needsReps ? 'bg-slate-100 text-slate-300 cursor-not-allowed' : ''}`}
                            />
                          </td>
                          <td className="px-2 py-1.5 text-center">
                            <button
                              onClick={() => removeEntry(idx)}
                              className="text-slate-300 hover:text-red-500 transition-colors"
                              title="Remove row"
                            >
                              <X className="h-3.5 w-3.5" />
                            </button>
                          </td>
                        </tr>
                      )
                    })}
                    {/* Add machine row */}
                    {availableToAdd.length > 0 && (
                      <tr className="bg-slate-50 border-t">
                        <td colSpan={6} className="px-2 py-1.5">
                          <div className="flex items-center gap-2">
                            <Plus className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                            <Select onValueChange={addMachine}>
                              <SelectTrigger className="h-7 text-xs w-48 border-dashed">
                                <SelectValue placeholder="Add machine..." />
                              </SelectTrigger>
                              <SelectContent>
                                {availableToAdd.map((m) => (
                                  <SelectItem key={m.id} value={m.id}>
                                    <span className="font-mono font-bold mr-2">{m.code}</span>
                                    <span className="text-slate-500">{m.name}</span>
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {error && (
              <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">{error}</p>
            )}

            <div className="flex justify-end gap-2 pt-1">
              <Button variant="outline" size="sm" onClick={() => { setOpen(false); resetForm() }} disabled={saving}>
                Cancel
              </Button>
              <Button size="sm" onClick={handleSave} disabled={saving || !canSave}>
                {saving ? 'Saving...' : 'Save Session'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
