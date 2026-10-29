// src/components/history/SessionsHistoryView.tsx
// Sessions view: all routines combined into one table, columns = machines sorted by code,
// grouped by measurement type. Filters for routine/location/trainer. Sortable date column.

'use client'

import React, { useEffect, useState, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { formatDate } from '@/lib/utils/date-formatter'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ArrowDown, ArrowUp, Trash2 } from 'lucide-react'
import { AddSessionDialog } from './AddSessionDialog'
import { EditSessionDialog } from './EditSessionDialog'

interface MachineTypeValue {
  weight_lbs?: number | null
  total_time_seconds?: number | null
  reps?: number | null
}

interface SessionRow {
  sessionId: string
  date: string
  actualStart: string
  routineId: string | null
  routineName: string
  locationId: string | null
  locationName: string | null
  trainerId: string | null
  trainerName: string | null
  machineTypeValues: Record<string, Record<string, MachineTypeValue>>
  completedMachineCount: number
}

type SubCol = 'lbs' | 'time' | 'reps' | 'done'

interface MachineTypeCol {
  abbrev: string
  subs: SubCol[]
}

interface MachineCol {
  id: string
  code: string
  name: string
  types: MachineTypeCol[]
}

interface SessionsHistoryViewProps {
  clientId: string
  programs: Array<{
    id: string
    name: string
    program_machines: Array<{
      machine_id: string
      machines: { id: string; machine_code: string; machine_name: string }
    }>
  }>
  allowDelete?: boolean
  allowAdd?: boolean
  allowEdit?: boolean
}

export function SessionsHistoryView({ clientId, programs, allowDelete = false, allowAdd = true, allowEdit = true }: SessionsHistoryViewProps) {
  const [sessions, setSessions] = useState<SessionRow[]>([])
  const [machineOrder, setMachineOrder] = useState<MachineCol[]>([])
  const [loading, setLoading] = useState(true)

  const [filterRoutine, setFilterRoutine] = useState('all')
  const [filterLocation, setFilterLocation] = useState('all')
  const [filterTrainer, setFilterTrainer] = useState('all')
  const [dateSort, setDateSort] = useState<'desc' | 'asc'>('desc')
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const allRoutines = useMemo(() => {
    const map = new Map<string, string>()
    sessions.forEach((s) => { if (s.routineId && s.routineName) map.set(s.routineId, s.routineName) })
    return Array.from(map.entries()).sort((a, b) => a[1].localeCompare(b[1]))
  }, [sessions])

  const allLocations = useMemo(() => {
    const map = new Map<string, string>()
    sessions.forEach((s) => { if (s.locationId && s.locationName) map.set(s.locationId, s.locationName) })
    return Array.from(map.entries()).sort((a, b) => a[1].localeCompare(b[1]))
  }, [sessions])

  const allTrainers = useMemo(() => {
    const map = new Map<string, string>()
    sessions.forEach((s) => { if (s.trainerId && s.trainerName) map.set(s.trainerId, s.trainerName) })
    return Array.from(map.entries()).sort((a, b) => a[1].localeCompare(b[1]))
  }, [sessions])

  const displayedSessions = useMemo(() => {
    let result = sessions.filter((s) => {
      if (filterRoutine !== 'all' && s.routineId !== filterRoutine) return false
      if (filterLocation !== 'all' && s.locationId !== filterLocation) return false
      if (filterTrainer !== 'all' && s.trainerId !== filterTrainer) return false
      return true
    })
    result = [...result].sort((a, b) => {
      const diff = new Date(a.actualStart).getTime() - new Date(b.actualStart).getTime()
      return dateSort === 'desc' ? -diff : diff
    })
    return result
  }, [sessions, filterRoutine, filterLocation, filterTrainer, dateSort])

  useEffect(() => {
    loadData()
  }, [clientId, programs])

  const loadData = async () => {
    setLoading(true)
    const supabase = createClient()

    try {
      const programNameMap = new Map<string, string>()
      const machineMap = new Map<string, { id: string; code: string; name: string }>()

      programs.forEach((p) => {
        programNameMap.set(p.id, p.name)
        p.program_machines.forEach((pm) => {
          if (pm.machines && !machineMap.has(pm.machine_id)) {
            machineMap.set(pm.machine_id, {
              id: pm.machines.id,
              code: pm.machines.machine_code,
              name: pm.machines.machine_name,
            })
          }
        })
      })

      const { data: sessionsData, error: sessionsError } = await supabase
        .from('sessions')
        .select('id, actual_start, location_id, trainer_id, program_id')
        .eq('client_id', clientId)
        .eq('status', 'completed')
        .not('actual_start', 'is', null)
        .order('actual_start', { ascending: false })
        .limit(100)

      if (sessionsError || !sessionsData || sessionsData.length === 0) {
        setSessions([])
        setMachineOrder([])
        setLoading(false)
        return
      }

      const uniqueLocationIds = [...new Set(sessionsData.map((s: any) => s.location_id).filter(Boolean))]
      const uniqueTrainerIds = [...new Set(sessionsData.map((s: any) => s.trainer_id).filter(Boolean))]
      // Only fetch program names not already covered by the prop
      const uniqueProgramIds = [...new Set(sessionsData.map((s: any) => s.program_id).filter(Boolean))]
        .filter((id) => !programNameMap.has(id))

      const [locationsRes, trainersRes, programsRes] = await Promise.all([
        uniqueLocationIds.length > 0
          ? supabase.from('locations').select('id, name').in('id', uniqueLocationIds)
          : Promise.resolve({ data: [] }),
        uniqueTrainerIds.length > 0
          ? supabase.from('profiles').select('id, first_name, last_name').in('id', uniqueTrainerIds)
          : Promise.resolve({ data: [] }),
        uniqueProgramIds.length > 0
          ? supabase.from('programs').select('id, name').in('id', uniqueProgramIds)
          : Promise.resolve({ data: [] }),
      ])

      const locationMap = new Map<string, string>()
      locationsRes.data?.forEach((loc: any) => locationMap.set(loc.id, loc.name))

      const trainerMap = new Map<string, string>()
      trainersRes.data?.forEach((t: any) => {
        const name = [t.first_name, t.last_name?.charAt(0)].filter(Boolean).join(' ')
        trainerMap.set(t.id, name ? `${name}.` : '')
      })

      programsRes.data?.forEach((p: any) => programNameMap.set(p.id, p.name))

      const sessionIds = sessionsData.map((s: any) => s.id)
      const { data: machineSessionsData } = await supabase
        .from('machine_sessions')
        .select(`
          session_id,
          machine_id,
          weight_lbs,
          total_time_seconds,
          reps,
          measurement_type_id,
          measurement_types ( abbreviation, units )
        `)
        .in('session_id', sessionIds)

      // Collect measurement types per machine
      const machineMeasurementTypes = new Map<string, Set<string>>()
      ;(machineSessionsData || []).forEach((ms: any) => {
        const abbrev = (ms.measurement_types as any)?.abbreviation || 'N/A'
        if (!machineMeasurementTypes.has(ms.machine_id)) {
          machineMeasurementTypes.set(ms.machine_id, new Set())
        }
        machineMeasurementTypes.get(ms.machine_id)!.add(abbrev)
        if (!machineMap.has(ms.machine_id)) {
          // placeholder — will resolve below
        }
      })

      // Resolve unknown machine names
      const unknownIds = Array.from(machineMeasurementTypes.keys()).filter((id) => !machineMap.has(id))
      if (unknownIds.length > 0) {
        const { data: extra } = await supabase
          .from('machines')
          .select('id, machine_code, machine_name')
          .in('id', unknownIds)
        extra?.forEach((m: any) => machineMap.set(m.id, { id: m.id, code: m.machine_code, name: m.machine_name }))
      }

      // Build sub-column list per machine+type: use declared units when available, else fall back to observed data
      const machineTypeUnitsMap = new Map<string, Map<string, string[]>>()
      const machineTypeObservedCols = new Map<string, Map<string, Set<SubCol>>>()
      ;(machineSessionsData || []).forEach((ms: any) => {
        const abbrev = (ms.measurement_types as any)?.abbreviation || 'N/A'
        const units: string[] = (ms.measurement_types as any)?.units ?? []
        if (!machineTypeUnitsMap.has(ms.machine_id)) machineTypeUnitsMap.set(ms.machine_id, new Map())
        const typeMap = machineTypeUnitsMap.get(ms.machine_id)!
        if (!typeMap.has(abbrev)) typeMap.set(abbrev, units)
        if (!machineTypeObservedCols.has(ms.machine_id)) machineTypeObservedCols.set(ms.machine_id, new Map())
        const obsMap = machineTypeObservedCols.get(ms.machine_id)!
        if (!obsMap.has(abbrev)) obsMap.set(abbrev, new Set())
        const obs = obsMap.get(abbrev)!
        if (ms.weight_lbs != null) obs.add('lbs')
        if (ms.total_time_seconds != null) obs.add('time')
        if (ms.reps != null) obs.add('reps')
      })

      const subColOrder: SubCol[] = ['lbs', 'time', 'reps', 'done']
      const cols: MachineCol[] = Array.from(machineMeasurementTypes.entries())
        .map(([id, types]) => {
          const m = machineMap.get(id) || { id, code: id, name: id }
          const typeMap = machineTypeUnitsMap.get(id) || new Map()
          const obsMap = machineTypeObservedCols.get(id) || new Map()
          const machineTypes: MachineTypeCol[] = Array.from(types).sort().map((abbrev) => {
            const units = typeMap.get(abbrev) ?? []
            if (units.includes('date')) return { abbrev, subs: [] }
            if (units.length > 0) {
              const subs: SubCol[] = subColOrder.filter((s) => {
                if (s === 'lbs') return units.includes('weight')
                if (s === 'time') return units.includes('time')
                if (s === 'reps') return units.includes('reps')
                return false
              })
              return { abbrev, subs: subs.length ? subs : ['lbs' as SubCol] }
            }
            // No declared units (N/A / unlinked) — use observed data
            const obs = obsMap.get(abbrev) || new Set<SubCol>()
            const subs = subColOrder.filter((s) => obs.has(s))
            return { abbrev, subs: subs.length ? subs : ['lbs' as SubCol] }
          })
          return { id, code: m.code, name: m.name, types: machineTypes }
        })
        .sort((a, b) => a.code.localeCompare(b.code))

      const rows: SessionRow[] = sessionsData.map((session: any) => {
        const sessionMs = (machineSessionsData || []).filter((ms: any) => ms.session_id === session.id)
        const machineTypeValues: Record<string, Record<string, MachineTypeValue>> = {}
        sessionMs.forEach((ms: any) => {
          const abbrev = (ms.measurement_types as any)?.abbreviation || 'N/A'
          if (!machineTypeValues[ms.machine_id]) machineTypeValues[ms.machine_id] = {}
          if (!machineTypeValues[ms.machine_id][abbrev]) {
            machineTypeValues[ms.machine_id][abbrev] = {
              weight_lbs: ms.weight_lbs,
              total_time_seconds: ms.total_time_seconds,
              reps: ms.reps,
            }
          }
        })

        return {
          sessionId: session.id,
          date: formatDate(session.actual_start),
          actualStart: session.actual_start,
          routineId: session.program_id || null,
          routineName: session.program_id ? (programNameMap.get(session.program_id) || 'Unknown') : '—',
          locationId: session.location_id || null,
          locationName: session.location_id ? locationMap.get(session.location_id) || null : null,
          trainerId: session.trainer_id || null,
          trainerName: session.trainer_id ? trainerMap.get(session.trainer_id) || null : null,
          machineTypeValues,
          completedMachineCount: Object.keys(machineTypeValues).length,
        }
      })

      rows.sort((a, b) => {
        const dateDiff = new Date(b.actualStart).getTime() - new Date(a.actualStart).getTime()
        if (dateDiff !== 0) return dateDiff
        return b.completedMachineCount - a.completedMachineCount
      })

      setMachineOrder(cols)
      setSessions(rows)
    } catch (err) {
      console.error('SessionsHistoryView error:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleDeleteSession = async (sessionId: string) => {
    if (!window.confirm('Delete this session and all its machine data? This cannot be undone.')) return
    setDeletingId(sessionId)
    try {
      const res = await fetch('/api/trainer/session', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId }),
      })
      if (!res.ok) {
        const json = await res.json()
        alert('Failed to delete session: ' + (json.error || 'Unknown error'))
      }
    } finally {
      setDeletingId(null)
      await loadData()
    }
  }

  const renderSubCell = (v: MachineTypeValue | undefined, sub: SubCol) => {
    if (!v) return '–'
    if (sub === 'done') return v.reps === 1 ? '✓' : '–'
    if (sub === 'lbs') return v.weight_lbs != null ? `${v.weight_lbs}` : '–'
    if (sub === 'time') return v.total_time_seconds != null ? `${v.total_time_seconds}` : '–'
    if (sub === 'reps') return v.reps != null ? `${v.reps}` : '–'
    return '–'
  }

  if (loading) {
    return <Card><CardContent className="pt-6"><Skeleton className="h-64 w-full" /></CardContent></Card>
  }

  if (sessions.length === 0) {
    return (
      <Card>
        <CardContent className="pt-4">
          {allowAdd && (
            <div className="flex justify-end mb-3">
              <AddSessionDialog clientId={clientId} programs={programs} onSessionAdded={loadData} />
            </div>
          )}
          <p className="text-sm text-slate-500 text-center py-8">No completed sessions found</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardContent className="pt-4">
        {/* Filters + Add Session — all on one line */}
        <div className="flex flex-wrap gap-2 mb-4 items-center">
          {allRoutines.length > 1 && (
            <Select value={filterRoutine} onValueChange={setFilterRoutine}>
              <SelectTrigger className="w-36 h-8 text-xs">
                <SelectValue placeholder="All Routines" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Routines</SelectItem>
                {allRoutines.map(([id, name]) => (
                  <SelectItem key={id} value={id}>{name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          {allLocations.length > 1 && (
            <Select value={filterLocation} onValueChange={setFilterLocation}>
              <SelectTrigger className="w-36 h-8 text-xs">
                <SelectValue placeholder="All locations" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All locations</SelectItem>
                {allLocations.map(([id, name]) => (
                  <SelectItem key={id} value={id}>{name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          {allTrainers.length > 1 && (
            <Select value={filterTrainer} onValueChange={setFilterTrainer}>
              <SelectTrigger className="w-36 h-8 text-xs">
                <SelectValue placeholder="All instructors" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All instructors</SelectItem>
                {allTrainers.map(([id, name]) => (
                  <SelectItem key={id} value={id}>{name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <span className="text-xs text-slate-500 ml-auto">
            {displayedSessions.length} records
          </span>
          {allowAdd && <AddSessionDialog clientId={clientId} programs={programs} onSessionAdded={loadData} />}
        </div>

        <div className="overflow-x-auto overflow-y-auto max-h-[60vh]">
          <table className="border-collapse text-xs" style={{ tableLayout: 'fixed', width: 'max-content' }}>
            <colgroup>
              <col style={{ width: '44px' }} />
              <col style={{ width: '44px' }} />
              {machineOrder.flatMap((m) =>
                m.types.flatMap((t) =>
                  t.subs.length === 0
                    ? [<col key={`col-${m.id}-${t.abbrev}-tick`} style={{ width: '44px' }} />]
                    : t.subs.map((sub) => (
                        <col key={`col-${m.id}-${t.abbrev}-${sub}`} style={{ width: '44px' }} />
                      ))
                )
              )}
              <col style={{ width: '44px' }} />
              <col style={{ width: '44px' }} />
              {allowEdit && <col style={{ width: '44px' }} />}
              {allowDelete && <col style={{ width: '44px' }} />}
            </colgroup>
            <thead>
              {/* Row 1: machine code spanning its types */}
              <tr>
                <th
                  className="text-left px-1 py-1.5 font-semibold sticky top-0 left-0 bg-slate-100 z-40 border-r border-b cursor-pointer select-none align-bottom"
                  rowSpan={3}
                  onClick={() => setDateSort(dateSort === 'desc' ? 'asc' : 'desc')}
                >
                  <div className="flex items-center gap-1">
                    Date
                    {dateSort === 'desc' ? <ArrowDown className="h-3 w-3 text-slate-500" /> : <ArrowUp className="h-3 w-3 text-slate-500" />}
                  </div>
                </th>
                <th className="text-center px-1 py-1.5 text-xs font-semibold border-r border-b bg-slate-100 sticky top-0 z-20 align-bottom" rowSpan={3}>R</th>
                {machineOrder.map((m) => (
                  <th key={m.id} colSpan={m.types.reduce((n, t) => n + (t.subs.length || 1), 0)} className="text-center px-1 pt-1.5 pb-0.5 font-bold border-l border-b text-slate-700 bg-slate-100 sticky top-0 z-20">
                    {m.code}
                  </th>
                ))}
                <th className="text-left px-2 py-1.5 font-semibold border-l border-b bg-slate-100 sticky top-0 z-20 align-bottom" rowSpan={3}>Location</th>
                <th className="text-left px-2 py-1.5 font-semibold border-l border-b bg-slate-100 sticky top-0 z-20 align-bottom" rowSpan={3}>Instr.</th>
                {allowEdit && <th rowSpan={3} className="border-b bg-slate-100 sticky top-0 z-20 text-right px-1" />}
                {allowDelete && <th rowSpan={3} className="border-b bg-slate-100 sticky top-0 z-20" />}
              </tr>
              {/* Row 2: type abbreviation spanning its sub-columns */}
              <tr>
                {machineOrder.map((m) =>
                  m.types.map((t) => (
                    <th key={`${m.id}-${t.abbrev}`} colSpan={t.subs.length || 1} className="text-center px-1 pt-1 pb-0.5 font-semibold text-slate-600 border-l bg-slate-100 sticky top-[30px] z-20 text-xs">
                      {t.abbrev}
                    </th>
                  ))
                )}
              </tr>
              {/* Row 3: sub-column labels (time → sec); date-type shows tick */}
              <tr className="border-b">
                {machineOrder.map((m) =>
                  m.types.flatMap((t) =>
                    t.subs.length === 0
                      ? [<th key={`${m.id}-${t.abbrev}-tick`} className="text-center px-1 pb-1 font-medium text-slate-400 border-l bg-slate-100 sticky top-[54px] z-20 text-xs">✓</th>]
                      : t.subs.map((sub) => (
                          <th key={`${m.id}-${t.abbrev}-${sub}`} className="text-center px-1 pb-1 font-medium text-slate-400 border-l bg-slate-100 sticky top-[54px] z-20 text-xs">
                            {sub === 'done' ? '✓' : sub === 'time' ? 'sec' : sub}
                          </th>
                        ))
                  )
                )}
              </tr>
            </thead>
            <tbody>
              {displayedSessions.map((session, idx) => {
                const isEven = idx % 2 === 0
                const rowBg = isEven ? 'bg-white' : 'bg-slate-100'
                const stickyBg = isEven ? 'bg-white' : 'bg-slate-100'
                return (
                  <tr key={session.sessionId} className={rowBg}>
                    <td className={`px-1 py-1.5 sticky left-0 z-10 ${stickyBg} border-r whitespace-nowrap`}>
                      <div className="font-medium text-xs">{session.date}</div>
                    </td>
                    <td className={`px-1 py-1.5 border-r text-slate-600 text-center text-xs truncate ${rowBg}`}>
                      {session.routineName === '—' ? '—' : session.routineName.slice(0, 4)}
                    </td>
                    {machineOrder.flatMap((m) =>
                      m.types.flatMap((t) => {
                        if (t.subs.length === 0) {
                          const hasEntry = !!session.machineTypeValues[m.id]?.[t.abbrev]
                          return [
                            <td key={`${m.id}-${t.abbrev}-tick`} className={`px-1 py-1.5 text-center font-mono border-l text-xs ${rowBg} ${hasEntry ? 'text-green-600 font-bold' : 'text-slate-200'}`}>
                              {hasEntry ? '✓' : '–'}
                            </td>
                          ]
                        }
                        return t.subs.map((sub) => {
                          const val = session.machineTypeValues[m.id]?.[t.abbrev]
                          const cell = renderSubCell(val, sub)
                          return (
                            <td key={`${m.id}-${t.abbrev}-${sub}`} className={`px-1 py-1.5 text-center font-mono border-l text-xs tabular-nums ${rowBg} ${cell === '–' ? 'text-slate-200' : 'text-slate-800'}`}>
                              {cell}
                            </td>
                          )
                        })
                      })
                    )}
                    <td className={`px-2 py-1.5 border-l text-slate-600 truncate text-xs ${rowBg}`}>{session.locationName || '–'}</td>
                    <td className={`px-2 py-1.5 border-l text-slate-600 truncate text-xs ${rowBg}`}>{session.trainerName || '–'}</td>
                    {allowEdit && (
                      <td className="px-1 py-1.5 text-right">
                        <EditSessionDialog
                          sessionId={session.sessionId}
                          sessionDate={session.actualStart}
                          routineId={session.routineId}
                          locationId={session.locationId}
                          trainerId={session.trainerId}
                          programs={programs}
                          onSessionUpdated={loadData}
                        />
                      </td>
                    )}
                    {allowDelete && (
                      <td className="px-1 py-1.5 text-center">
                        <button
                          onClick={() => handleDeleteSession(session.sessionId)}
                          disabled={deletingId === session.sessionId}
                          className="text-slate-400 hover:text-red-500 transition-colors disabled:opacity-40"
                          title="Delete session"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </td>
                    )}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  )
}
