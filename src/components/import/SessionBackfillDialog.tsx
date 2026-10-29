// src/components/import/SessionBackfillDialog.tsx
// Multi-day grid UI for clients to backfill historical session data from paper sheets.
// Each row = one session date, each column = one machine from the selected program.
// TUL columns have Weight + Time inputs; Tick columns have a checkbox.

'use client'

import { useState, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { ClipboardList, Plus, Trash2, CheckCircle } from 'lucide-react'

interface Location {
  id: string
  name: string
}

interface Trainer {
  id: string
  first_name: string
  last_name: string
}

interface ProgramMachine {
  id: string
  machine_id: string
  order_index: number
  machine_code: string
  machine_name: string
}

interface Program {
  id: string
  name: string
  machines: ProgramMachine[]
}

// Column type toggle: TUL (weight+time) or date-tick (checkbox)
type ColType = 'tul' | 'tick'

interface RowCell {
  weight: string  // lbs, free text
  time: string    // mm:ss or seconds, free text
  tick: boolean
  skip: boolean   // true = blank cell, machine not done
}

interface SessionRow {
  rowId: string
  date: string
  cells: Record<string, RowCell>  // keyed by machine_id
}

function emptyCell(): RowCell {
  return { weight: '', time: '', tick: false, skip: true }
}

function newRow(machineIds: string[]): SessionRow {
  const cells: Record<string, RowCell> = {}
  for (const mid of machineIds) cells[mid] = emptyCell()
  return { rowId: crypto.randomUUID(), date: '', cells }
}

// Parse "mm:ss" or plain seconds string → seconds number or null
function parseTime(s: string): number | null {
  const t = s.trim()
  if (!t) return null
  if (t.includes(':')) {
    const [m, sec] = t.split(':').map(Number)
    if (!isNaN(m) && !isNaN(sec)) return m * 60 + sec
    return null
  }
  const n = parseFloat(t)
  return isNaN(n) ? null : n
}

interface SessionBackfillDialogProps {
  clientId: string
  open: boolean
  onOpenChange: (open: boolean) => void
  onImported?: () => void
}

export function SessionBackfillDialog({
  clientId,
  open,
  onOpenChange,
  onImported,
}: SessionBackfillDialogProps) {
  const supabase = createClient()

  // Setup state
  const [programs, setPrograms] = useState<Program[]>([])
  const [locations, setLocations] = useState<Location[]>([])
  const [trainers, setTrainers] = useState<Trainer[]>([])
  const [selectedProgramId, setSelectedProgramId] = useState('')
  const [selectedLocationId, setSelectedLocationId] = useState('')
  const [selectedTrainerId, setSelectedTrainerId] = useState('')
  const [loadingSetup, setLoadingSetup] = useState(false)

  // MT id lookups
  const [tulMtId, setTulMtId] = useState<string | null>(null)
  const [tickMtId, setTickMtId] = useState<string | null>(null)

  // Grid state
  const [colTypes, setColTypes] = useState<Record<string, ColType>>({})
  const [rows, setRows] = useState<SessionRow[]>([])

  // Submission state
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)

  const selectedProgram = programs.find(p => p.id === selectedProgramId) ?? null
  const machineIds = selectedProgram?.machines.map(m => m.machine_id) ?? []

  // Load setup data when dialog opens
  useEffect(() => {
    if (!open) return
    setDone(false)
    setRows([])
    setColTypes({})
    setSelectedProgramId('')
    setSelectedLocationId('')
    setSelectedTrainerId('')
    loadSetupData()
  }, [open])

  const loadSetupData = async () => {
    setLoadingSetup(true)
    try {
      const [programsRes, locationsRes, trainersRes, mtRes] = await Promise.all([
        supabase
          .from('programs')
          .select(`
            id, name,
            program_machines (
              id, machine_id, order_index,
              machines ( id, machine_code, machine_name )
            )
          `)
          .eq('client_id', clientId)
          .eq('status', 'active')
          .order('name'),

        supabase
          .from('locations')
          .select('id, name')
          .eq('is_active', true)
          .order('name'),

        supabase
          .from('trainer_clients')
          .select('trainer_id, profiles!trainer_id ( id, first_name, last_name )')
          .eq('client_id', clientId)
          .eq('is_active', true),

        supabase
          .from('measurement_types')
          .select('id, abbreviation, units')
          .in('abbreviation', ['TUL', 'Date']),
      ])

      if (programsRes.data) {
        const shaped: Program[] = (programsRes.data as any[]).map(p => ({
          id: p.id,
          name: p.name,
          machines: (p.program_machines as any[] || [])
            .sort((a: any, b: any) => (a.order_index ?? 0) - (b.order_index ?? 0))
            .map((pm: any) => ({
              id: pm.id,
              machine_id: pm.machine_id,
              order_index: pm.order_index,
              machine_code: pm.machines?.machine_code ?? '',
              machine_name: pm.machines?.machine_name ?? '',
            })),
        }))
        setPrograms(shaped)
        if (shaped.length === 1) setSelectedProgramId(shaped[0].id)
      }

      if (locationsRes.data) {
        setLocations(locationsRes.data as Location[])
        if ((locationsRes.data as Location[]).length === 1) {
          setSelectedLocationId((locationsRes.data as Location[])[0].id)
        }
      }

      if (trainersRes.data) {
        const ts: Trainer[] = (trainersRes.data as any[])
          .map((tc: any) => tc.profiles)
          .filter(Boolean)
        setTrainers(ts)
        if (ts.length === 1) setSelectedTrainerId(ts[0].id)
      }

      if (mtRes.data) {
        for (const mt of mtRes.data as any[]) {
          if (mt.abbreviation === 'TUL') setTulMtId(mt.id)
          if ((mt.units as string[]).includes('date')) setTickMtId(mt.id)
        }
      }
    } catch (err) {
      console.error('SessionBackfillDialog setup error:', err)
      toast.error('Failed to load setup data')
    } finally {
      setLoadingSetup(false)
    }
  }

  // When program changes, reset grid with default TUL cols and one empty row
  useEffect(() => {
    if (!selectedProgramId || !selectedProgram) return
    const mids = selectedProgram.machines.map(m => m.machine_id)
    const types: Record<string, ColType> = {}
    for (const mid of mids) types[mid] = 'tul'
    setColTypes(types)
    setRows([newRow(mids)])
  }, [selectedProgramId])

  const addRow = () => {
    setRows(prev => [...prev, newRow(machineIds)])
  }

  const removeRow = (rowId: string) => {
    setRows(prev => prev.filter(r => r.rowId !== rowId))
  }

  const updateDate = (rowId: string, date: string) => {
    setRows(prev => prev.map(r => r.rowId === rowId ? { ...r, date } : r))
  }

  const updateCell = useCallback((rowId: string, machineId: string, patch: Partial<RowCell>) => {
    setRows(prev => prev.map(r => {
      if (r.rowId !== rowId) return r
      const existing = r.cells[machineId]
      const updated = { ...existing, ...patch }
      // If any value is entered, mark as not skipped
      if (patch.weight !== undefined || patch.time !== undefined || patch.tick !== undefined) {
        const hasValue = updated.weight.trim() !== '' || updated.time.trim() !== '' || updated.tick
        updated.skip = !hasValue
      }
      return { ...r, cells: { ...r.cells, [machineId]: updated } }
    }))
  }, [])

  const toggleColType = (machineId: string) => {
    setColTypes(prev => ({ ...prev, [machineId]: prev[machineId] === 'tul' ? 'tick' : 'tul' }))
    // Clear all cells for this machine when switching type
    setRows(prev => prev.map(r => ({
      ...r,
      cells: { ...r.cells, [machineId]: emptyCell() },
    })))
  }

  const handleSubmit = async () => {
    if (!selectedProgramId || !selectedLocationId || !selectedTrainerId) {
      toast.error('Please select program, location, and trainer')
      return
    }

    // Validate rows
    const validRows = rows.filter(r => r.date.trim() !== '')
    if (validRows.length === 0) {
      toast.error('Add at least one row with a date')
      return
    }

    for (const row of validRows) {
      if (!row.date.match(/^\d{4}-\d{2}-\d{2}$/)) {
        toast.error(`Invalid date format: "${row.date}" — use YYYY-MM-DD`)
        return
      }
    }

    setSubmitting(true)

    try {
      let sessionsCreated = 0
      let machineSessionsCreated = 0

      for (const row of validRows) {
        const sessionStart = new Date(`${row.date}T09:00:00`)
        const sessionEnd = new Date(`${row.date}T10:00:00`)

        const { data: newSession, error: sessionError } = await supabase
          .from('sessions')
          .insert({
            client_id: clientId,
            trainer_id: selectedTrainerId,
            location_id: selectedLocationId,
            program_id: selectedProgramId,
            scheduled_start: sessionStart.toISOString(),
            scheduled_end: sessionEnd.toISOString(),
            actual_start: sessionStart.toISOString(),
            actual_end: sessionEnd.toISOString(),
            status: 'completed',
          } as any)
          .select('id')
          .single()

        if (sessionError || !newSession) {
          throw new Error(`Failed to create session for ${row.date}: ${sessionError?.message}`)
        }

        const sessionId = (newSession as any).id
        sessionsCreated++

        // Build machine_sessions for non-skipped cells
        const machinesToInsert: any[] = []
        let offsetMinutes = 0

        if (selectedProgram) {
          for (const pm of selectedProgram.machines) {
            const cell = row.cells[pm.machine_id]
            if (!cell || cell.skip) continue

            const colType = colTypes[pm.machine_id] ?? 'tul'
            const startTime = new Date(sessionStart.getTime() + offsetMinutes * 60 * 1000)
            offsetMinutes += 5

            if (colType === 'tick') {
              if (!cell.tick) continue
              machinesToInsert.push({
                session_id: sessionId,
                machine_id: pm.machine_id,
                measurement_type_id: tickMtId,
                start_time: startTime.toISOString(),
                end_time: null,
                total_time_seconds: null,
                weight_lbs: null,
              })
            } else {
              // TUL
              const weightLbs = cell.weight.trim() ? parseFloat(cell.weight) : null
              const timeSec = parseTime(cell.time)
              const endTime = timeSec ? new Date(startTime.getTime() + timeSec * 1000) : null
              machinesToInsert.push({
                session_id: sessionId,
                machine_id: pm.machine_id,
                measurement_type_id: tulMtId,
                start_time: startTime.toISOString(),
                end_time: endTime?.toISOString() ?? null,
                total_time_seconds: timeSec,
                weight_lbs: weightLbs && !isNaN(weightLbs) ? weightLbs : null,
              })
            }
          }
        }

        if (machinesToInsert.length > 0) {
          const { error: msError } = await (supabase
            .from('machine_sessions') as any)
            .insert(machinesToInsert)
          if (msError) throw new Error(`Failed to insert machine sessions for ${row.date}: ${msError.message}`)
          machineSessionsCreated += machinesToInsert.length
        }
      }

      setDone(true)
      toast.success(`Imported ${sessionsCreated} session${sessionsCreated !== 1 ? 's' : ''} with ${machineSessionsCreated} machine entries`)
      onImported?.()
    } catch (err: any) {
      console.error('SessionBackfillDialog submit error:', err)
      toast.error(err.message || 'Import failed')
    } finally {
      setSubmitting(false)
    }
  }

  const handleClose = () => {
    if (submitting) return
    onOpenChange(false)
  }

  const setupComplete = selectedProgramId && selectedLocationId && selectedTrainerId
  const machines = selectedProgram?.machines ?? []

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="!max-w-[95vw] !w-[95vw] !h-[92vh] !max-h-[92vh] flex flex-col !p-0 !gap-0">
        {/* ── Header ── */}
        <DialogHeader className="px-6 pt-5 pb-3 border-b flex-shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <ClipboardList className="h-5 w-5 text-slate-500" />
            Import Past Sessions
          </DialogTitle>
        </DialogHeader>

        {done ? (
          <div className="flex flex-col items-center justify-center gap-3 flex-1 px-6">
            <CheckCircle className="h-12 w-12 text-green-500" />
            <p className="text-lg font-semibold">Sessions imported successfully</p>
            <p className="text-sm text-slate-500">Your session history has been updated.</p>
            <Button onClick={handleClose} className="mt-2">Done</Button>
          </div>
        ) : (
          <>
            {/* ── Setup row — fixed, never scrolls ── */}
            <div className="px-6 py-4 border-b flex-shrink-0">
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-1.5">
                  <Label>Program *</Label>
                  <Select value={selectedProgramId} onValueChange={setSelectedProgramId} disabled={loadingSetup}>
                    <SelectTrigger>
                      <SelectValue placeholder={loadingSetup ? 'Loading…' : 'Select program'} />
                    </SelectTrigger>
                    <SelectContent>
                      {programs.map(p => (
                        <SelectItem key={p.id} value={p.id}>Routine {p.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Location *</Label>
                  <Select value={selectedLocationId} onValueChange={setSelectedLocationId} disabled={loadingSetup}>
                    <SelectTrigger>
                      <SelectValue placeholder={loadingSetup ? 'Loading…' : 'Select location'} />
                    </SelectTrigger>
                    <SelectContent>
                      {locations.map(l => (
                        <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Trainer *</Label>
                  <Select value={selectedTrainerId} onValueChange={setSelectedTrainerId} disabled={loadingSetup}>
                    <SelectTrigger>
                      <SelectValue placeholder={loadingSetup ? 'Loading…' : 'Select trainer'} />
                    </SelectTrigger>
                    <SelectContent>
                      {trainers.map(t => (
                        <SelectItem key={t.id} value={t.id}>{t.first_name} {t.last_name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            {/* ── Grid — scrollable ── */}
            <div className="flex-1 overflow-auto px-6 py-4">
              {setupComplete && machines.length > 0 && (
                <div className="space-y-3">
                  <div className="overflow-x-auto rounded-lg border border-slate-200">
                    <table className="text-sm border-collapse" style={{ minWidth: 'max-content' }}>
                      <thead>
                        {/* Machine code + type toggle row */}
                        <tr className="bg-slate-50">
                          <th className="px-2 py-2 text-left font-semibold text-slate-700 border-b border-r border-slate-200 whitespace-nowrap w-[120px]">
                            Date
                          </th>
                          {machines.map(m => (
                            <th key={m.machine_id} colSpan={colTypes[m.machine_id] === 'tul' ? 2 : 1}
                              className="px-2 py-2 text-center border-b border-r border-slate-200 last:border-r-0">
                              <div className="font-bold text-slate-800 font-mono text-sm">{m.machine_code}</div>
                              <button
                                type="button"
                                onClick={() => toggleColType(m.machine_id)}
                                className="mt-1 text-xs px-2 py-0.5 rounded bg-slate-200 hover:bg-slate-300 text-slate-600 font-medium transition-colors"
                                title="Toggle TUL / Tick"
                              >
                                {colTypes[m.machine_id] === 'tul' ? 'TUL' : '✓'}
                              </button>
                            </th>
                          ))}
                          <th className="px-2 py-2 border-b border-slate-200 w-8" />
                        </tr>
                        {/* Sub-header: lbs / time labels */}
                        <tr className="bg-slate-50">
                          <th className="border-b border-r border-slate-200" />
                          {machines.map(m => (
                            colTypes[m.machine_id] === 'tul' ? (
                              <>
                                <th key={`${m.machine_id}-w`} className="px-1 py-1.5 text-center text-xs text-slate-500 font-medium border-b border-r border-slate-200 w-[60px]">lbs</th>
                                <th key={`${m.machine_id}-t`} className="px-1 py-1.5 text-center text-xs text-slate-500 font-medium border-b border-r border-slate-200 last:border-r-0 w-[60px]">time</th>
                              </>
                            ) : (
                              <th key={`${m.machine_id}-tick`} className="px-1 py-1.5 text-center border-b border-r border-slate-200 last:border-r-0 w-[40px]" />
                            )
                          ))}
                          <th className="border-b border-slate-200" />
                        </tr>
                      </thead>
                      <tbody>
                        {rows.map((row) => (
                          <tr key={row.rowId} className="hover:bg-slate-50/60">
                            {/* Date cell */}
                            <td className="px-1 py-1.5 border-b border-r border-slate-200">
                              <Input
                                type="date"
                                value={row.date}
                                onChange={e => updateDate(row.rowId, e.target.value)}
                                className="h-8 text-sm w-[118px]"
                                disabled={submitting}
                              />
                            </td>
                            {/* Machine cells */}
                            {machines.map(m => {
                              const cell = row.cells[m.machine_id] ?? emptyCell()
                              const colType = colTypes[m.machine_id] ?? 'tul'
                              if (colType === 'tul') {
                                return (
                                  <>
                                    <td key={`${row.rowId}-${m.machine_id}-w`} className="px-0.5 py-1.5 border-b border-r border-slate-200">
                                      <Input
                                        type="number"
                                        min="0"
                                        step="1"
                                        value={cell.weight}
                                        onChange={e => updateCell(row.rowId, m.machine_id, { weight: e.target.value })}
                                        className="h-8 text-sm w-full text-center px-1"
                                        placeholder="—"
                                        disabled={submitting}
                                      />
                                    </td>
                                    <td key={`${row.rowId}-${m.machine_id}-t`} className="px-0.5 py-1.5 border-b border-r border-slate-200 last:border-r-0">
                                      <Input
                                        type="text"
                                        value={cell.time}
                                        onChange={e => updateCell(row.rowId, m.machine_id, { time: e.target.value })}
                                        className="h-8 text-sm w-full text-center px-1"
                                        placeholder="—"
                                        disabled={submitting}
                                      />
                                    </td>
                                  </>
                                )
                              } else {
                                return (
                                  <td key={`${row.rowId}-${m.machine_id}-tick`} className="px-0.5 py-1.5 border-b border-r border-slate-200 last:border-r-0 text-center">
                                    <Checkbox
                                      checked={cell.tick}
                                      onCheckedChange={checked => updateCell(row.rowId, m.machine_id, { tick: checked === true })}
                                      disabled={submitting}
                                    />
                                  </td>
                                )
                              }
                            })}
                            {/* Remove row */}
                            <td className="px-1 py-1.5 border-b border-slate-200 text-center">
                              {rows.length > 1 && (
                                <button
                                  type="button"
                                  onClick={() => removeRow(row.rowId)}
                                  disabled={submitting}
                                  className="text-slate-300 hover:text-red-400 transition-colors"
                                  title="Remove row"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={addRow}
                    disabled={submitting}
                    className="gap-1.5"
                  >
                    <Plus className="h-4 w-4" />
                    Add row
                  </Button>
                </div>
              )}

              {setupComplete && machines.length === 0 && (
                <p className="text-sm text-slate-500 py-8 text-center">
                  This program has no machines. Add machines to the program first.
                </p>
              )}

              {!setupComplete && !loadingSetup && (
                <p className="text-sm text-slate-400 py-8 text-center">
                  Select a program, location, and trainer above to begin.
                </p>
              )}
            </div>

            {/* ── Footer — fixed at bottom ── */}
            <div className="flex gap-3 px-6 py-4 border-t flex-shrink-0">
              <Button type="button" variant="outline" onClick={handleClose} disabled={submitting} className="flex-1">
                Cancel
              </Button>
              <Button
                type="button"
                onClick={handleSubmit}
                disabled={submitting || !setupComplete || rows.every(r => !r.date.trim())}
                className="flex-1"
              >
                {submitting ? 'Importing…' : `Import ${rows.filter(r => r.date.trim()).length || ''} Session${rows.filter(r => r.date.trim()).length !== 1 ? 's' : ''}`}
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
