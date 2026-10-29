// src/components/history/MachineHistoryView.tsx
// Machine view: pick a machine from a grid, then show a session table for that machine
// grouped by measurement type, with location/trainer filters and sortable date.

'use client'

import React, { useEffect, useState, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { formatDate } from '@/lib/utils/date-formatter'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { ArrowDown, ArrowUp } from 'lucide-react'

interface MachineOption {
  id: string
  code: string
  name: string
  image_url: string | null
}

interface MachineTypeValue {
  weight_lbs?: number | null
  total_time_seconds?: number | null
  reps?: number | null
}

interface SessionRow {
  sessionId: string
  date: string
  actualStart: string
  routineName: string
  locationId: string | null
  locationName: string | null
  trainerId: string | null
  trainerName: string | null
  // measurement_type_abbrev -> values
  typeValues: Record<string, MachineTypeValue>
}

interface MachineHistoryViewProps {
  clientId: string
  programs: Array<{
    id: string
    name: string
    status?: string
    program_machines: Array<{
      machine_id: string
      machines: { id: string; machine_code: string; machine_name: string }
    }>
  }>
}

export function MachineHistoryView({ clientId, programs }: MachineHistoryViewProps) {
  const [selectedMachine, setSelectedMachine] = useState<MachineOption | null>(null)
  const [machineOptions, setMachineOptions] = useState<MachineOption[]>([])
  const [machinesWithData, setMachinesWithData] = useState<Set<string>>(new Set())

  // Machine IDs that are in an active program (shown green)
  const activeProgramMachineIds = useMemo(() => {
    const ids = new Set<string>()
    programs.forEach(p => {
      if (p.status === 'active') p.program_machines.forEach(pm => ids.add(pm.machine_id))
    })
    return ids
  }, [programs])
  const [loadingMachines, setLoadingMachines] = useState(true)

  type SubCol = 'lbs' | 'time' | 'reps' | 'done'
  interface MachineTypeCol { abbrev: string; subs: SubCol[] }

  const [sessions, setSessions] = useState<SessionRow[]>([])
  const [measurementTypeCols, setMeasurementTypeCols] = useState<MachineTypeCol[]>([])
  const [loadingSessions, setLoadingSessionsState] = useState(false)

  const [dateSort, setDateSort] = useState<'desc' | 'asc'>('desc')

  const displayedSessions = useMemo(() => {
    return [...sessions].sort((a, b) => {
      const diff = new Date(a.actualStart).getTime() - new Date(b.actualStart).getTime()
      return dateSort === 'desc' ? -diff : diff
    })
  }, [sessions, dateSort])

  // Load all unique machines this client has trained on
  useEffect(() => {
    loadMachineOptions()
  }, [clientId, programs])

  const loadMachineOptions = async () => {
    setLoadingMachines(true)
    const supabase = createClient()

    try {
      // Collect machine IDs from all programs
      const programMachineIds = new Set<string>()
      programs.forEach((p) =>
        p.program_machines.forEach((pm) => programMachineIds.add(pm.machine_id))
      )

      // Also get machines used in actual sessions (may differ from current programs)
      const { data: sessionMachineRows } = await supabase
        .from('machine_sessions')
        .select('machine_id, sessions!inner(client_id)')
        .eq('sessions.client_id', clientId)

      const machinesWithSessionData = new Set<string>()
      sessionMachineRows?.forEach((r: any) => machinesWithSessionData.add(r.machine_id))

      const allMachineIds = new Set(programMachineIds)
      machinesWithSessionData.forEach((id) => allMachineIds.add(id))

      if (allMachineIds.size === 0) {
        setMachineOptions([])
        setLoadingMachines(false)
        return
      }

      const { data: machinesData } = await supabase
        .from('machines')
        .select('id, machine_code, machine_name, image_url')
        .in('id', Array.from(allMachineIds))
        .order('machine_code')

      setMachinesWithData(machinesWithSessionData)
      setMachineOptions(
        (machinesData || []).map((m: any) => ({
          id: m.id,
          code: m.machine_code,
          name: m.machine_name,
          image_url: m.image_url || null,
        }))
      )
    } catch (err) {
      console.error('MachineHistoryView loadMachineOptions error:', err)
    } finally {
      setLoadingMachines(false)
    }
  }

  // Load sessions for selected machine
  useEffect(() => {
    if (!selectedMachine) return
    loadMachineSessions(selectedMachine.id)
  }, [selectedMachine])

  const loadMachineSessions = async (machineId: string) => {
    setLoadingSessionsState(true)
    setSessions([])
    const supabase = createClient()

    try {
      // Build program name map
      const programNameMap = new Map<string, string>()
      programs.forEach((p) => programNameMap.set(p.id, p.name))

      // Get machine sessions for this machine + client
      const { data: msd } = await supabase
        .from('machine_sessions')
        .select(`
          id,
          session_id,
          weight_lbs,
          total_time_seconds,
          reps,
          measurement_type_id,
          measurement_types ( abbreviation, units ),
          sessions!inner (
            id,
            actual_start,
            location_id,
            trainer_id,
            program_id,
            client_id,
            status
          )
        `)
        .eq('machine_id', machineId)
        .eq('sessions.client_id', clientId)
        .eq('sessions.status', 'completed')
        .not('sessions.actual_start', 'is', null)
        .order('sessions(actual_start)', { ascending: false })
        .limit(100)

      if (!msd || msd.length === 0) {
        setSessions([])
        setMeasurementTypeCols([])
        setLoadingSessionsState(false)
        return
      }

      // Collect unique session data
      const sessionMap = new Map<string, any>()
      msd.forEach((ms: any) => {
        const s = ms.sessions
        if (!sessionMap.has(s.id)) {
          sessionMap.set(s.id, { ...s })
        }
      })

      const sessionsArr = Array.from(sessionMap.values())

      // Resolve locations and trainers
      const uniqueLocationIds = [...new Set(sessionsArr.map((s: any) => s.location_id).filter(Boolean))]
      const uniqueTrainerIds = [...new Set(sessionsArr.map((s: any) => s.trainer_id).filter(Boolean))]

      const [locationsRes, trainersRes] = await Promise.all([
        uniqueLocationIds.length > 0
          ? supabase.from('locations').select('id, name').in('id', uniqueLocationIds)
          : Promise.resolve({ data: [] }),
        uniqueTrainerIds.length > 0
          ? supabase.from('profiles').select('id, first_name, last_name').in('id', uniqueTrainerIds)
          : Promise.resolve({ data: [] }),
      ])

      const locationMap = new Map<string, string>()
      locationsRes.data?.forEach((loc: any) => locationMap.set(loc.id, loc.name))

      const trainerMap = new Map<string, string>()
      trainersRes.data?.forEach((t: any) => {
        const name = [t.first_name, t.last_name?.charAt(0)].filter(Boolean).join(' ')
        trainerMap.set(t.id, name ? `${name}.` : '')
      })

      // Collect sub-columns per type: use declared units when available, else fall back to observed data
      const typeUnitsMap = new Map<string, string[]>()
      const typeObservedCols = new Map<string, Set<SubCol>>()
      const sessionTypeValues = new Map<string, Record<string, MachineTypeValue>>()
      msd.forEach((ms: any) => {
        const abbrev = (ms.measurement_types as any)?.abbreviation || 'N/A'
        const units: string[] = (ms.measurement_types as any)?.units ?? []
        if (!typeUnitsMap.has(abbrev)) typeUnitsMap.set(abbrev, units)
        if (!typeObservedCols.has(abbrev)) typeObservedCols.set(abbrev, new Set())
        const obs = typeObservedCols.get(abbrev)!
        if (ms.weight_lbs != null) obs.add('lbs')
        if (ms.total_time_seconds != null) obs.add('time')
        if (ms.reps != null) obs.add('reps')
        const sid = ms.session_id
        if (!sessionTypeValues.has(sid)) sessionTypeValues.set(sid, {})
        const tv = sessionTypeValues.get(sid)!
        if (!tv[abbrev]) {
          tv[abbrev] = { weight_lbs: ms.weight_lbs, total_time_seconds: ms.total_time_seconds, reps: ms.reps }
        }
      })

      const subColOrder: SubCol[] = ['lbs', 'time', 'reps', 'done']
      const typeCols: MachineTypeCol[] = Array.from(typeUnitsMap.entries())
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([abbrev, units]) => {
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
          const obs = typeObservedCols.get(abbrev) || new Set<SubCol>()
          const subs = subColOrder.filter((s) => obs.has(s))
          return { abbrev, subs: subs.length ? subs : ['lbs' as SubCol] }
        })

      const rows: SessionRow[] = sessionsArr.map((session: any) => ({
        sessionId: session.id,
        date: formatDate(session.actual_start),
        actualStart: session.actual_start,
        routineName: session.program_id ? (programNameMap.get(session.program_id) || 'Unknown') : '—',
        locationId: session.location_id || null,
        locationName: session.location_id ? locationMap.get(session.location_id) || null : null,
        trainerId: session.trainer_id || null,
        trainerName: session.trainer_id ? trainerMap.get(session.trainer_id) || null : null,
        typeValues: sessionTypeValues.get(session.id) || {},
      }))

      rows.sort((a, b) => new Date(b.actualStart).getTime() - new Date(a.actualStart).getTime())

      setMeasurementTypeCols(typeCols)
      setSessions(rows)
    } catch (err) {
      console.error('MachineHistoryView loadMachineSessions error:', err)
    } finally {
      setLoadingSessionsState(false)
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

  if (loadingMachines) {
    return <Card><CardContent className="pt-6"><Skeleton className="h-40 w-full" /></CardContent></Card>
  }

  if (machineOptions.length === 0) {
    return (
      <Card>
        <CardContent>
          <p className="text-sm text-slate-500 text-center py-8">No machines found for this client</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardContent className="pt-4">
        {/* Machine picker — always visible */}
        <div className="flex flex-wrap gap-2 mb-4">
          {machineOptions.map((m) => {
            const hasData = machinesWithData.has(m.id)
            const isActive = activeProgramMachineIds.has(m.id)
            const isSelected = selectedMachine?.id === m.id
            return (
              <button
                key={m.id}
                onClick={() => {
                  if (isSelected) {
                    setSelectedMachine(null)
                    setSessions([])
                  } else {
                    setSelectedMachine(m)
                  }
                }}
                className={`px-3 py-2 rounded-lg border-2 transition-all font-bold text-base ${
                  isSelected
                    ? 'border-blue-500 bg-blue-600 text-white'
                    : hasData
                    ? 'border-green-500 bg-green-50 text-green-800 hover:bg-blue-50 hover:border-blue-400 hover:text-blue-700'
                    : isActive
                    ? 'border-slate-400 bg-slate-50 text-slate-800 hover:bg-blue-50 hover:border-blue-400 hover:text-blue-700'
                    : 'border-slate-200 bg-white text-slate-400 hover:bg-blue-50 hover:border-blue-400 hover:text-blue-700'
                }`}
              >
                {m.code}
              </button>
            )
          })}
        </div>

        {/* Inline history table — shown below buttons when a machine is selected */}
        {selectedMachine && (
          <div className="border-t pt-4">
            <div className="flex items-center gap-3 mb-3">
              <span className="font-bold text-base">{selectedMachine.code}</span>
              <span className="text-slate-400">|</span>
              <span className="text-slate-600 text-sm truncate">{selectedMachine.name}</span>
              {!loadingSessions && (
                <>
                  <span className="text-slate-400">|</span>
                  <span className="text-xs text-slate-500 shrink-0">{displayedSessions.length} records</span>
                </>
              )}
            </div>

            {loadingSessions ? (
              <Skeleton className="h-48 w-full" />
            ) : sessions.length === 0 ? (
              <p className="text-sm text-slate-500 text-center py-8">No sessions recorded for this machine</p>
            ) : (
              <>
                <div className="overflow-x-auto overflow-y-auto max-h-[60vh]">
                  <table className="w-full border-separate border-spacing-0 text-xs">
                    <thead>
                      <tr className="bg-slate-100 sticky top-0 z-20">
                        <th
                          className="text-left px-3 py-1.5 font-semibold sticky left-0 bg-slate-100 z-30 border-r border-b cursor-pointer select-none whitespace-nowrap align-bottom"
                          rowSpan={2}
                          onClick={() => setDateSort(dateSort === 'desc' ? 'asc' : 'desc')}
                        >
                          <div className="flex items-center gap-1">
                            Date
                            {dateSort === 'desc' ? <ArrowDown className="h-3 w-3 text-slate-500" /> : <ArrowUp className="h-3 w-3 text-slate-500" />}
                          </div>
                        </th>
                        <th className="text-center px-1 py-1.5 font-semibold border-r border-b align-bottom" rowSpan={2}>R</th>
                        {measurementTypeCols.map((t) => (
                          <th key={t.abbrev} colSpan={t.subs.length || 1} className="text-center px-1 pt-1.5 pb-0.5 font-semibold text-slate-700 border-l border-slate-200 border-b">
                            {t.abbrev}
                          </th>
                        ))}
                        <th className="text-left px-2 py-1.5 font-semibold border-l border-slate-200 border-b align-bottom" rowSpan={2}>Location</th>
                        <th className="text-left px-2 py-1.5 font-semibold border-l border-slate-200 border-b align-bottom" rowSpan={2}>Instr.</th>
                      </tr>
                      <tr className="bg-slate-100 sticky top-[30px] z-20">
                        {measurementTypeCols.flatMap((t) =>
                          t.subs.length === 0
                            ? [<th key={`${t.abbrev}-tick`} className="text-center px-1 pb-1 font-medium text-slate-500 border-l border-b border-slate-200 text-xs bg-slate-100">✓</th>]
                            : t.subs.map((sub) => (
                              <th key={`${t.abbrev}-${sub}`} className="text-center px-1 pb-1 font-medium text-slate-500 border-l border-b border-slate-200 text-xs bg-slate-100">
                                {sub === 'done' ? '✓' : sub === 'time' ? 'sec' : sub}
                              </th>
                            ))
                        )}
                      </tr>
                    </thead>
                    <tbody>
                      {displayedSessions.map((session, idx) => {
                        const isEven = idx % 2 === 0
                        const rowBg = isEven ? 'bg-white' : 'bg-slate-50/60'
                        const stickyBg = isEven ? 'bg-white' : 'bg-slate-50/60'
                        return (
                          <tr key={session.sessionId} className={rowBg}>
                            <td className={`px-3 py-1.5 sticky left-0 ${stickyBg} border-r border-b border-slate-100 whitespace-nowrap`}>
                              <div className="font-semibold text-xs">{session.date}</div>
                            </td>
                            <td className={`px-2 py-1.5 border-r border-b border-slate-100 text-slate-600 text-center text-xs truncate max-w-[80px] ${rowBg}`}>
                              {session.routineName === '—' ? '—' : session.routineName.slice(0, 4)}
                            </td>
                            {measurementTypeCols.flatMap((t) => {
                              if (t.subs.length === 0) {
                                const hasEntry = !!session.typeValues[t.abbrev]
                                return [
                                  <td key={`${t.abbrev}-tick`} className={`px-1 py-1.5 text-center font-mono border-l border-b border-slate-100 ${rowBg} ${hasEntry ? 'text-green-600 font-bold' : 'text-slate-200'}`}>
                                    {hasEntry ? '✓' : '–'}
                                  </td>
                                ]
                              }
                              return t.subs.map((sub) => {
                                const cell = renderSubCell(session.typeValues[t.abbrev], sub)
                                return (
                                  <td key={`${t.abbrev}-${sub}`} className={`px-1 py-1.5 text-center font-mono border-l border-b border-slate-100 tabular-nums ${rowBg} ${cell === '–' ? 'text-slate-200' : 'text-slate-800'}`}>
                                    {cell}
                                  </td>
                                )
                              })
                            })}
                            <td className={`px-2 py-1.5 border-l border-b border-slate-100 text-slate-600 truncate max-w-[90px] text-xs ${rowBg}`}>{session.locationName || '–'}</td>
                            <td className={`px-2 py-1.5 border-l border-b border-slate-100 text-slate-600 truncate max-w-[80px] text-xs ${rowBg}`}>{session.trainerName || '–'}</td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
