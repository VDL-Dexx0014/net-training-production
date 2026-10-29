// src/components/history/EditSessionDialog.tsx

'use client'

import React, { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
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
import { Pencil, SkipForward, X, Plus } from 'lucide-react'

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
  key: string             // stable local key
  machineSessionId: string | null
  machineId: string
  machineCode: string
  machineName: string
  measurementTypeId: string
  weightLbs: string
  totalTimeSeconds: string
  reps: string
  skipped: boolean
}

interface EditSessionDialogProps {
  sessionId: string
  sessionDate: string
  routineId: string | null
  locationId: string | null
  trainerId: string | null
  programs: Array<{
    id: string
    name: string
    program_machines: Array<{
      machine_id: string
      machines: { id: string; machine_code: string; machine_name: string }
    }>
  }>
  onSessionUpdated: () => void
}

export function EditSessionDialog({
  sessionId,
  sessionDate,
  routineId,
  locationId,
  trainerId,
  programs,
  onSessionUpdated,
}: EditSessionDialogProps) {
  const [open, setOpen] = useState(false)

  const [editDate, setEditDate] = useState('')
  const [editLocationId, setEditLocationId] = useState('')
  const [editTrainerId, setEditTrainerId] = useState('')
  const [editRoutineId, setEditRoutineId] = useState('')
  const [machineEntries, setMachineEntries] = useState<MachineEntry[]>([])

  const [locations, setLocations] = useState<{ id: string; name: string }[]>([])
  const [trainers, setTrainers] = useState<{ id: string; name: string }[]>([])
  const [measurementTypes, setMeasurementTypes] = useState<MeasurementType[]>([])
  const [allMachines, setAllMachines] = useState<MachineOption[]>([])
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [invalidMachineKeys, setInvalidMachineKeys] = useState<Set<string>>(new Set())

  useEffect(() => {
    if (!open) return
    loadAll()
  }, [open])

  const loadAll = async () => {
    setLoading(true)
    setError(null)
    const supabase = createClient()

    const d = new Date(sessionDate)
    setEditDate(d.toISOString().split('T')[0])
    setEditLocationId(locationId || '')
    setEditTrainerId(trainerId || '')
    setEditRoutineId(routineId || '')

    const [locRes, trainerRes, mtRes, msRes, machinesRes] = await Promise.all([
      supabase.from('locations').select('id, name').eq('is_active', true).order('name'),
      supabase.from('profiles').select('id, first_name, last_name').eq('role', 'trainer').eq('is_active', true).order('first_name'),
      supabase.from('measurement_types').select('id, name, abbreviation, units, sort_order').eq('is_active', true).order('sort_order').order('name'),
      supabase.from('machine_sessions').select(`
        id, machine_id, measurement_type_id, weight_lbs, total_time_seconds, reps,
        machines ( id, machine_code, machine_name )
      `).eq('session_id', sessionId),
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

    // Build map of existing machine_session rows, keyed by machineId
    const existingRowMap = new Map<string, MachineEntry>()
    for (const ms of (msRes.data || []) as any[]) {
      existingRowMap.set(ms.machine_id, {
        key: ms.machine_id,
        machineSessionId: ms.id,
        machineId: ms.machine_id,
        machineCode: ms.machines?.machine_code || ms.machine_id,
        machineName: ms.machines?.machine_name || '',
        measurementTypeId: ms.measurement_type_id || '',
        weightLbs: ms.weight_lbs != null ? String(ms.weight_lbs) : '',
        totalTimeSeconds: ms.total_time_seconds != null ? String(ms.total_time_seconds) : '',
        reps: ms.reps != null ? String(ms.reps) : '',
        skipped: false,
      })
    }

    const program = programs.find((p) => p.id === (routineId || ''))
    const sortedProgramMachines = program
      ? [...program.program_machines]
          .filter((pm) => pm.machines)
          .sort((a: any, b: any) => (a.order_index ?? 0) - (b.order_index ?? 0))
      : []

    const orderedEntries: MachineEntry[] = sortedProgramMachines.map((pm) => {
      return existingRowMap.get(pm.machines.id) ?? {
        key: pm.machines.id,
        machineSessionId: null,
        machineId: pm.machines.id,
        machineCode: pm.machines.machine_code,
        machineName: pm.machines.machine_name,
        measurementTypeId: '',
        weightLbs: '',
        totalTimeSeconds: '',
        reps: '',
        skipped: false,
      }
    })

    // Append machine_sessions rows not in the routine
    for (const entry of existingRowMap.values()) {
      if (!orderedEntries.some((e) => e.machineId === entry.machineId)) {
        orderedEntries.push(entry)
      }
    }

    setInvalidMachineKeys(new Set())
    setMachineEntries(orderedEntries)
    setLoading(false)
  }

  const updateEntry = (idx: number, field: keyof MachineEntry, value: string | boolean) => {
    setMachineEntries((prev) => {
      const next = [...prev]
      next[idx] = { ...next[idx], [field]: value }
      return next
    })
  }

  const removeEntry = (idx: number) => {
    setMachineEntries((prev) => prev.filter((_, i) => i !== idx))
    setInvalidMachineKeys((prev) => {
      const next = new Set(prev)
      next.delete(machineEntries[idx]?.key)
      return next
    })
  }

  const toggleSkip = (idx: number, key: string) => {
    setMachineEntries((prev) => {
      const next = [...prev]
      next[idx] = { ...next[idx], skipped: !next[idx].skipped }
      return next
    })
    setInvalidMachineKeys((prev) => { const next = new Set(prev); next.delete(key); return next })
  }

  const addMachine = (machineId: string) => {
    const machine = allMachines.find((m) => m.id === machineId)
    if (!machine) return
    setMachineEntries((prev) => [
      ...prev,
      {
        key: `extra-${machineId}-${Date.now()}`,
        machineSessionId: null,
        machineId: machine.id,
        machineCode: machine.code,
        machineName: machine.name,
        measurementTypeId: '',
        weightLbs: '',
        totalTimeSeconds: '',
        reps: '',
        skipped: false,
      },
    ])
  }

  const usedMachineIds = new Set(machineEntries.map((e) => e.machineId))
  const availableToAdd = allMachines.filter((m) => !usedMachineIds.has(m.id))

  const handleSave = async () => {
    if (!editDate || !editLocationId || !editTrainerId) {
      setError('Date, location and trainer are required.')
      return
    }

    const incomplete = machineEntries.filter((e) => {
      if (e.skipped) return false
      return !(e.weightLbs || e.totalTimeSeconds || e.reps || e.measurementTypeId)
    })
    if (incomplete.length > 0) {
      setInvalidMachineKeys(new Set(incomplete.map((e) => e.key)))
      setError(`These machines need data or must be skipped: ${incomplete.map((e) => e.machineCode).join(', ')}`)
      return
    }
    setInvalidMachineKeys(new Set())

    setSaving(true)
    setError(null)
    const supabase = createClient()

    try {
      const sessionStart = `${editDate}T12:00:00.000Z`
      const sessionEnd = `${editDate}T13:00:00.000Z`

      const { error: sessionError } = await (supabase.from('sessions') as any).update({
        location_id: editLocationId,
        trainer_id: editTrainerId,
        program_id: editRoutineId || null,
        scheduled_start: sessionStart,
        scheduled_end: sessionEnd,
        actual_start: sessionStart,
        actual_end: sessionEnd,
      }).eq('id', sessionId)

      if (sessionError) {
        setError('Failed to update session: ' + sessionError.message)
        return
      }

      const toUpdate: { id: string; payload: Record<string, unknown> }[] = []
      const toInsert: Record<string, unknown>[] = []

      for (const entry of machineEntries) {
        if (entry.skipped) continue
        const hasData = entry.weightLbs || entry.totalTimeSeconds || entry.reps || entry.measurementTypeId
        const machineTimeSecs = entry.totalTimeSeconds ? parseInt(entry.totalTimeSeconds, 10) : 0
        const machineEndTime = machineTimeSecs > 0
          ? new Date(new Date(sessionStart).getTime() + machineTimeSecs * 1000).toISOString()
          : sessionStart

        const payload = {
          measurement_type_id: entry.measurementTypeId || null,
          start_time: sessionStart,
          end_time: machineEndTime,
          weight_lbs: entry.weightLbs ? parseFloat(entry.weightLbs) : null,
          total_time_seconds: machineTimeSecs > 0 ? machineTimeSecs : null,
          reps: entry.reps ? parseInt(entry.reps, 10) : null,
        }

        if (entry.machineSessionId) {
          toUpdate.push({ id: entry.machineSessionId, payload })
        } else if (hasData) {
          toInsert.push({ session_id: sessionId, machine_id: entry.machineId, ...payload })
        }
      }

      const results = await Promise.all([
        ...toUpdate.map(({ id, payload }) =>
          (supabase.from('machine_sessions') as any).update(payload).eq('id', id)
        ),
        toInsert.length > 0
          ? supabase.from('machine_sessions').insert(toInsert as any)
          : Promise.resolve({ error: null }),
      ])

      const firstError = results.find((r) => r.error)?.error
      if (firstError) {
        setError('Failed to save machine data: ' + firstError.message)
        return
      }

      setOpen(false)
      onSessionUpdated()
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="text-blue-500 hover:text-blue-700 transition-colors block ml-auto"
        title="Edit session"
      >
        <Pencil className="h-3.5 w-3.5" />
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="!max-w-3xl !w-[90vw] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Session</DialogTitle>
          </DialogHeader>

          {loading ? (
            <div className="py-8 text-center text-sm text-slate-500">Loading session data...</div>
          ) : (
            <div className="space-y-4 pt-2">
              {/* Row 1: Instructor | Location | Routine */}
              <div className="grid grid-cols-3 gap-3">
                <div className="min-w-0">
                  <label className="text-xs font-medium text-slate-600 block mb-1">Instructor *</label>
                  <Select value={editTrainerId} onValueChange={setEditTrainerId}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Select trainer..." /></SelectTrigger>
                    <SelectContent>
                      {trainers.map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="min-w-0">
                  <label className="text-xs font-medium text-slate-600 block mb-1">Location *</label>
                  <Select value={editLocationId} onValueChange={setEditLocationId}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Select location..." /></SelectTrigger>
                    <SelectContent>
                      {locations.map((loc) => <SelectItem key={loc.id} value={loc.id}>{loc.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="min-w-0">
                  <label className="text-xs font-medium text-slate-600 block mb-1">Routine</label>
                  <Select value={editRoutineId} onValueChange={setEditRoutineId}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Select routine..." /></SelectTrigger>
                    <SelectContent>
                      {[...programs].sort((a, b) => a.name.localeCompare(b.name)).map((p) => (
                        <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Row 2: Date */}
              <div className="max-w-xs">
                <label className="text-xs font-medium text-slate-600 block mb-1">Date *</label>
                {(() => {
                  const [y, m, d] = editDate ? editDate.split('-').map(Number) : [new Date().getFullYear(), new Date().getMonth() + 1, new Date().getDate()]
                  const daysInMonth = new Date(y, m, 0).getDate()
                  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
                  const setDatePart = (part: 'y'|'m'|'d', val: number) => {
                    const ny = part === 'y' ? val : y
                    const nm = part === 'm' ? val : m
                    const nd = part === 'd' ? Math.min(val, new Date(ny, nm, 0).getDate()) : Math.min(d, new Date(ny, nm, 0).getDate())
                    setEditDate(`${ny}-${String(nm).padStart(2,'0')}-${String(nd).padStart(2,'0')}`)
                  }
                  return (
                    <div className="flex gap-1">
                      <Select value={String(d)} onValueChange={(v) => setDatePart('d', Number(v))}>
                        <SelectTrigger className="h-8 text-xs flex-1 min-w-0"><SelectValue /></SelectTrigger>
                        <SelectContent>{Array.from({length: daysInMonth}, (_,i) => i+1).map((n) => <SelectItem key={n} value={String(n)}>{n}</SelectItem>)}</SelectContent>
                      </Select>
                      <Select value={String(m)} onValueChange={(v) => setDatePart('m', Number(v))}>
                        <SelectTrigger className="h-8 text-xs flex-1 min-w-0"><SelectValue /></SelectTrigger>
                        <SelectContent>{months.map((mo, i) => <SelectItem key={i+1} value={String(i+1)}>{mo}</SelectItem>)}</SelectContent>
                      </Select>
                      <Select value={String(y)} onValueChange={(v) => setDatePart('y', Number(v))}>
                        <SelectTrigger className="h-8 text-xs flex-1 min-w-0"><SelectValue /></SelectTrigger>
                        <SelectContent>{[2024,2025,2026,2027].map((yr) => <SelectItem key={yr} value={String(yr)}>{yr}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                  )
                })()}
              </div>

              {/* Machine data table */}
              <div>
                <p className="text-xs font-medium text-slate-600 mb-2">
                  Machine Data
                  <span className="text-slate-400 font-normal ml-1">— correct values as needed</span>
                </p>
                <div className="border rounded-md overflow-hidden">
                  <table className="w-full text-xs" style={{ tableLayout: 'fixed' }}>
                    <colgroup>
                      <col style={{ width: '13%' }} />
                      <col style={{ width: '19%' }} />
                      <col style={{ width: '15%' }} />
                      <col style={{ width: '15%' }} />
                      <col style={{ width: '15%' }} />
                      <col style={{ width: '15%' }} />
                      <col style={{ width: '8%' }} />
                    </colgroup>
                    <thead>
                      <tr className="bg-slate-100 border-b">
                        <th className="text-left px-2 py-2 font-semibold">Machine</th>
                        <th className="text-left px-2 py-2 font-semibold">Type</th>
                        <th className="text-center px-2 py-2 font-semibold">lbs</th>
                        <th className="text-center px-2 py-2 font-semibold">sec</th>
                        <th className="text-center px-2 py-2 font-semibold">reps</th>
                        <th className="text-center px-2 py-2 font-semibold">Skip</th>
                        <th />
                      </tr>
                    </thead>
                    <tbody>
                      {machineEntries.map((entry, idx) => {
                        const mt = measurementTypes.find((m) => m.id === entry.measurementTypeId)
                        const units: string[] = mt?.units ?? []
                        const hasUnits = units.length > 0
                        const needsWeight = !hasUnits || units.includes('weight')
                        const needsTime = !hasUnits || units.includes('time')
                        const needsReps = !hasUnits || units.includes('reps')
                        const isInvalid = invalidMachineKeys.has(entry.key)
                        const rowBg = entry.skipped
                          ? 'bg-orange-50'
                          : isInvalid
                          ? 'bg-red-50'
                          : idx % 2 === 0 ? 'bg-white' : 'bg-slate-50'
                        return (
                          <tr key={entry.key} className={`${rowBg} ${isInvalid ? 'border-l-2 border-red-400' : ''}`}>
                            <td className="px-2 py-1.5">
                              <div className="font-bold">{entry.machineCode}</div>
                              {!entry.machineSessionId && !entry.skipped && (
                                <div className="text-[10px] text-blue-400 italic">new</div>
                              )}
                              {isInvalid && (
                                <div className="text-[10px] text-red-600 font-semibold">needs data/skip</div>
                              )}
                            </td>
                            <td className="px-2 py-1.5">
                              <Select
                                value={entry.measurementTypeId || undefined}
                                onValueChange={(v) => updateEntry(idx, 'measurementTypeId', v)}
                                disabled={entry.skipped}
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
                                placeholder="—" disabled={entry.skipped || !needsWeight}
                                className={`h-7 text-xs w-full text-center ${(entry.skipped || !needsWeight) ? 'bg-slate-100 text-slate-300 cursor-not-allowed' : ''}`}
                              />
                            </td>
                            <td className="px-2 py-1.5">
                              <Input type="number" min="0" value={entry.totalTimeSeconds}
                                onChange={(e) => updateEntry(idx, 'totalTimeSeconds', e.target.value)}
                                placeholder="—" disabled={entry.skipped || !needsTime}
                                className={`h-7 text-xs w-full text-center ${(entry.skipped || !needsTime) ? 'bg-slate-100 text-slate-300 cursor-not-allowed' : ''}`}
                              />
                            </td>
                            <td className="px-2 py-1.5">
                              <Input type="number" min="0" value={entry.reps}
                                onChange={(e) => updateEntry(idx, 'reps', e.target.value)}
                                placeholder="—" disabled={entry.skipped || !needsReps}
                                className={`h-7 text-xs w-full text-center ${(entry.skipped || !needsReps) ? 'bg-slate-100 text-slate-300 cursor-not-allowed' : ''}`}
                              />
                            </td>
                            <td className="px-2 py-1.5 text-center">
                              <button
                                onClick={() => toggleSkip(idx, entry.key)}
                                className={`inline-flex items-center gap-1 px-2 py-1 rounded text-[11px] font-semibold border transition-colors ${
                                  entry.skipped
                                    ? 'bg-orange-500 border-orange-500 text-white hover:bg-orange-600'
                                    : 'bg-white border-slate-300 text-slate-500 hover:border-orange-400 hover:text-orange-600'
                                }`}
                                title={entry.skipped ? 'Click to unskip' : 'Skip this machine'}
                              >
                                <SkipForward className="h-3 w-3" />
                                {entry.skipped ? 'Skipped' : 'Skip'}
                              </button>
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
                          <td colSpan={7} className="px-2 py-1.5">
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
                <Button variant="outline" size="sm" onClick={() => setOpen(false)} disabled={saving}>
                  Cancel
                </Button>
                <Button size="sm" onClick={handleSave} disabled={saving}>
                  {saving ? 'Saving...' : 'Save Changes'}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
