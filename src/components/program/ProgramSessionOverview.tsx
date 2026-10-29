// src/components/program/ProgramSessionOverview.tsx
// Overview table showing sessions with machine values per column

'use client'

import React, { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { formatDate } from '@/lib/utils/date-formatter'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'

interface MachineValue {
  weight_lbs?: number | null
  total_time_seconds?: number | null
}

interface SessionRow {
  sessionId: string
  date: string
  actualStart: string
  locationName: string | null
  trainerName: string | null
  machineValues: Record<string, MachineValue>
}

interface MachineColumn {
  id: string
  code: string
  name: string
}

interface ProgramSessionOverviewProps {
  programId: string
  clientId: string
}

export function ProgramSessionOverview({ programId, clientId }: ProgramSessionOverviewProps) {
  const [sessions, setSessions] = useState<SessionRow[]>([])
  const [machineOrder, setMachineOrder] = useState<MachineColumn[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadSessionData()
  }, [programId, clientId])

  const loadSessionData = async () => {
    const supabase = createClient()
    setLoading(true)

    try {
      // 1. Get program machines to establish column order
      const { data: programMachines, error: pmError } = await supabase
        .from('program_machines')
        .select(`
          machine_id,
          order_index,
          machines (
            id,
            machine_code,
            machine_name
          )
        `)
        .eq('program_id', programId)
        .order('order_index')

      if (pmError) {
        console.error('Error loading program machines:', pmError)
        return
      }

      // Build machine order for columns
      const machineList: MachineColumn[] = (programMachines || [])
        .filter((pm: any) => pm.machines)
        .map((pm: any) => ({
          id: pm.machines.id,
          code: pm.machines.machine_code,
          name: pm.machines.machine_name,
        }))

      setMachineOrder(machineList)

      // 2. Get completed sessions for this program (include location_id and trainer_id)
      const { data: sessionsData, error: sessionsError } = await supabase
        .from('sessions')
        .select('id, actual_start, actual_end, location_id, trainer_id')
        .eq('program_id', programId)
        .eq('client_id', clientId)
        .eq('status', 'completed')
        .not('actual_start', 'is', null)
        .order('actual_start', { ascending: false })
        .limit(20)

      if (sessionsError) {
        console.error('Error loading sessions:', sessionsError)
        return
      }

      if (!sessionsData || sessionsData.length === 0) {
        setSessions([])
        return
      }

      // 4. Resolve location and trainer names
      const uniqueLocationIds = [...new Set(sessionsData.map((s: any) => s.location_id).filter(Boolean))]
      const uniqueTrainerIds = [...new Set(sessionsData.map((s: any) => s.trainer_id).filter(Boolean))]

      const [locationsRes, trainersRes] = await Promise.all([
        uniqueLocationIds.length > 0
          ? supabase.from('locations').select('id, name').in('id', uniqueLocationIds)
          : Promise.resolve({ data: [] }),
        uniqueTrainerIds.length > 0
          ? supabase.from('profiles').select('id, first_name, last_name').in('id', uniqueTrainerIds)
          : Promise.resolve({ data: [] }),
      ])

      const locationMap = new Map<string, string>()
      if (locationsRes.data) {
        locationsRes.data.forEach((loc: any) => locationMap.set(loc.id, loc.name))
      }

      const trainerMap = new Map<string, string>()
      if (trainersRes.data) {
        trainersRes.data.forEach((t: any) => {
          const name = [t.first_name, t.last_name?.charAt(0)].filter(Boolean).join(' ')
          trainerMap.set(t.id, name ? `${name}.` : '')
        })
      }

      // 5. Get machine sessions for all these sessions
      const sessionIds = sessionsData.map((s: any) => s.id)
      const { data: machineSessionsData, error: msError } = await supabase
        .from('machine_sessions')
        .select('session_id, machine_id, weight_lbs, total_time_seconds')
        .in('session_id', sessionIds)

      if (msError) {
        console.error('Error loading machine sessions:', msError)
        return
      }

      // 6. Build session rows with machine values — skip sessions with no machine data
      const sessionRows: SessionRow[] = sessionsData
        .map((session: any) => {
          const machineValues: Record<string, MachineValue> = {}

          const sessionMachineSessions = (machineSessionsData || []).filter(
            (ms: any) => ms.session_id === session.id
          )

          sessionMachineSessions.forEach((ms: any) => {
            if (!machineValues[ms.machine_id]) {
              machineValues[ms.machine_id] = {
                weight_lbs: ms.weight_lbs,
                total_time_seconds: ms.total_time_seconds,
              }
            }
          })

          return {
            sessionId: session.id,
            date: formatDate(session.actual_start),
            actualStart: session.actual_start,
            locationName: session.location_id ? locationMap.get(session.location_id) || null : null,
            trainerName: session.trainer_id ? trainerMap.get(session.trainer_id) || null : null,
            machineValues,
          }
        })
        .filter((row) => Object.keys(row.machineValues).length > 0)

      setSessions(sessionRows)
    } catch (error) {
      console.error('Error in loadSessionData:', error)
    } finally {
      setLoading(false)
    }
  }

  const formatWeight = (value: MachineValue | undefined) => {
    if (!value || !value.weight_lbs) return '-'
    return `${value.weight_lbs}`
  }

  const formatTime = (value: MachineValue | undefined) => {
    if (!value || !value.total_time_seconds) return '-'
    return `${value.total_time_seconds}`
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="pt-6">
          <Skeleton className="h-64 w-full" />
        </CardContent>
      </Card>
    )
  }

  if (sessions.length === 0) {
    return (
      <Card>
        <CardContent>
          <p className="text-sm text-slate-500 text-center py-8">
            No completed sessions yet for this routine
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardContent className="pt-4">
        <div className="overflow-x-auto overflow-y-auto max-h-[60vh]">
          <table className="w-full border-collapse">
            <thead>
              {/* Machine code + name row */}
              <tr className="bg-slate-50 sticky top-0 z-20">
                <th
                  rowSpan={2}
                  className="text-left p-3 font-semibold text-sm sticky left-0 bg-slate-50 z-30 border-r border-b"
                >
                  Date
                </th>
                {machineOrder.map((machine) => (
                  <th
                    key={machine.id}
                    colSpan={2}
                    className="text-center px-2 pt-2 pb-1 font-semibold text-sm border-l"
                  >
                    <div className="font-bold">{machine.code}</div>
                    <div className="text-xs font-normal text-slate-500">{machine.name}</div>
                  </th>
                ))}
              </tr>
              {/* Sub-header row for lbs / time */}
              <tr className="border-b bg-slate-50 sticky top-[50px] z-20">
                {machineOrder.map((machine) => (
                  <React.Fragment key={machine.id}>
                    <th className="text-center px-2 pb-2 text-xs font-medium text-slate-500 border-l">
                      lbs
                    </th>
                    <th className="text-center px-2 pb-2 text-xs font-medium text-slate-500">
                      time
                    </th>
                  </React.Fragment>
                ))}
              </tr>
            </thead>
            <tbody>
              {sessions.map((session) => (
                <tr key={session.sessionId} className="border-b hover:bg-slate-50">
                  <td className="p-3 text-sm sticky left-0 bg-white border-r">
                    <div className="font-medium">{session.date}</div>
                    {(session.locationName || session.trainerName) && (
                      <div className="text-xs text-slate-400 mt-0.5">
                        {[session.locationName, session.trainerName].filter(Boolean).join(' · ')}
                      </div>
                    )}
                  </td>
                  {machineOrder.map((machine) => (
                    <React.Fragment key={machine.id}>
                      <td className="px-2 py-3 text-sm text-center font-mono border-l">
                        {formatWeight(session.machineValues[machine.id])}
                      </td>
                      <td className="px-2 py-3 text-sm text-center font-mono">
                        {formatTime(session.machineValues[machine.id])}
                      </td>
                    </React.Fragment>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  )
}
