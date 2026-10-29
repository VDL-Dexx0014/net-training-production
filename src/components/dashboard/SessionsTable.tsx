// src/components/dashboard/SessionsTable.tsx
// Sessions table with filtering capabilities

'use client'

import { useEffect, useState, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'

interface SessionData {
  id: string
  scheduled_start: string
  scheduled_end: string
  actual_start: string | null
  actual_end: string | null
  status: string
  trainer: {
    first_name: string
    last_name: string
  } | null
  program: {
    name: string
  } | null
  location: {
    name: string
  } | null
  machine_sessions: Array<{
    machine: {
      machine_code: string
      machine_name: string
    } | null
    weight_lbs: number | null
    total_time_seconds: number | null
  }>
}

interface SessionsTableProps {
  clientId: string
}

// Quick-filter options — how many recent sessions to show
// value: 0 means "All" (no client-side slice); DB_LIMIT caps the fetch for All
const QUICK_FILTERS = [
  { label: 'Last 5',  value: 5 },
  { label: 'Last 10', value: 10 },
  { label: 'Last 20', value: 20 },
  { label: 'All',     value: 0 },
]
const DB_LIMIT = 100

export default function SessionsTable({ clientId }: SessionsTableProps) {
  const [sessions, setSessions] = useState<SessionData[]>([])
  const [loading, setLoading] = useState(true)

  // Quick count filter (default: last 5)
  const [quickCount, setQuickCount] = useState(5)

  // Secondary filters
  const [dateFilter,    setDateFilter]    = useState('all')
  const [trainerFilter, setTrainerFilter] = useState('all')
  const [machineFilter, setMachineFilter] = useState('all')
  const [programFilter, setProgramFilter] = useState('all')

  useEffect(() => { loadSessions() }, [clientId])

  const loadSessions = async () => {
    setLoading(true)
    const supabase = createClient()

    interface SessionResponse {
      id: string
      scheduled_start: string
      scheduled_end: string
      actual_start: string | null
      actual_end: string | null
      status: string
      trainer: { first_name: string; last_name: string } | null
      program: { name: string } | null
      location: { name: string } | null
      machine_sessions: Array<{
        weight_lbs: number | null
        total_time_seconds: number | null
        machine: { machine_code: string; machine_name: string } | null
      }>
    }

    const { data, error } = await supabase
      .from('sessions')
      .select(`
        id,
        scheduled_start,
        scheduled_end,
        actual_start,
        actual_end,
        status,
        trainer:profiles!sessions_trainer_id_fkey (
          first_name,
          last_name
        ),
        program:programs (
          name
        ),
        location:locations (
          name
        ),
        machine_sessions (
          weight_lbs,
          total_time_seconds,
          machine:machines (
            machine_code,
            machine_name
          )
        )
      `)
      .eq('client_id', clientId)
      .eq('status', 'completed')
      .order('actual_start', { ascending: false })
      .limit(DB_LIMIT)

    if (error || !data) { setLoading(false); return }

    setSessions((data as SessionResponse[]).map(s => ({
      id: s.id,
      scheduled_start: s.scheduled_start,
      scheduled_end: s.scheduled_end,
      actual_start: s.actual_start,
      actual_end: s.actual_end,
      status: s.status,
      trainer: s.trainer,
      program: s.program,
      location: s.location,
      machine_sessions: (s.machine_sessions || []).map(ms => ({
        machine: ms.machine ?? null,
        weight_lbs: ms.weight_lbs,
        total_time_seconds: ms.total_time_seconds,
      })),
    })))

    setLoading(false)
  }

  // Unique session dates (YYYY-MM-DD) derived from actual data, most recent first
  const sessionDates = useMemo(() => {
    const seen = new Set<string>()
    sessions.forEach(s => {
      const dateStr = (s.actual_start || s.scheduled_start).slice(0, 10)
      seen.add(dateStr)
    })
    return Array.from(seen).sort((a, b) => b.localeCompare(a))
  }, [sessions])

  // Unique trainers, machines, programs from all sessions
  const trainers = useMemo(() => {
    const map = new Map<string, string>()
    sessions.forEach(s => {
      if (s.trainer) {
        const key = `${s.trainer.first_name} ${s.trainer.last_name}`
        map.set(key, key)
      }
    })
    return Array.from(map.keys())
  }, [sessions])

  const machines = useMemo(() => {
    const map = new Map<string, string>()
    sessions.flatMap(s => s.machine_sessions).forEach(ms => {
      if (ms.machine) map.set(ms.machine.machine_code, ms.machine.machine_name)
    })
    return Array.from(map.entries()).map(([code, name]) => ({ code, name }))
  }, [sessions])

  const programs = useMemo(() => {
    const seen = new Set<string>()
    sessions.forEach(s => { if (s.program) seen.add(s.program.name) })
    return Array.from(seen)
  }, [sessions])

  // Apply secondary filters first, then slice by quickCount
  const filteredSessions = useMemo(() => {
    let result = sessions

    if (dateFilter !== 'all') {
      result = result.filter(s =>
        (s.actual_start || s.scheduled_start).slice(0, 10) === dateFilter
      )
    }
    if (trainerFilter !== 'all') {
      result = result.filter(s =>
        s.trainer && `${s.trainer.first_name} ${s.trainer.last_name}` === trainerFilter
      )
    }
    if (machineFilter !== 'all') {
      result = result.filter(s =>
        s.machine_sessions.some(ms => ms.machine?.machine_code === machineFilter)
      )
    }
    if (programFilter !== 'all') {
      result = result.filter(s => s.program?.name === programFilter)
    }

    // quickCount = 0 means "All"
    return quickCount > 0 ? result.slice(0, quickCount) : result
  }, [sessions, quickCount, dateFilter, trainerFilter, machineFilter, programFilter])

  const formatDate = (dateStr: string) =>
    new Date(dateStr).toLocaleDateString('en-CA', { year: 'numeric', month: 'short', day: 'numeric' })

  const formatTime = (dateStr: string) =>
    new Date(dateStr).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })

  const getMachinesList = (session: SessionData) => {
    const codes = Array.from(new Set(
      session.machine_sessions.map(ms => ms.machine?.machine_code).filter(Boolean)
    ))
    return codes.length ? codes.join(', ') : 'No machines'
  }

  if (loading) {
    return (
      <Card>
        <CardHeader><CardTitle>Session History</CardTitle></CardHeader>
        <CardContent>
          <div className="text-center py-8 text-slate-500">Loading sessions...</div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Session History</CardTitle>
        <CardDescription>Your completed training sessions</CardDescription>
      </CardHeader>
      <CardContent>

        {/* Quick-count pills */}
        <div className="flex items-center gap-2 mb-5">
          <span className="text-sm font-medium text-slate-600 mr-1">Show:</span>
          {QUICK_FILTERS.map(({ label, value }) => (
            <button
              key={value}
              onClick={() => setQuickCount(value)}
              className={[
                'px-3 py-1 rounded-full text-sm font-semibold border transition-colors',
                quickCount === value
                  ? 'bg-slate-900 border-slate-900 text-white'
                  : 'bg-white border-slate-300 text-slate-600 hover:border-slate-500',
              ].join(' ')}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Secondary filters */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
          <div>
            <Label className="text-xs mb-1 block">Date</Label>
            <Select value={dateFilter} onValueChange={setDateFilter}>
              <SelectTrigger>
                <SelectValue placeholder="All dates" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All dates</SelectItem>
                {sessionDates.map(d => (
                  <SelectItem key={d} value={d}>
                    {formatDate(d)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label className="text-xs mb-1 block">Instructor</Label>
            <Select value={trainerFilter} onValueChange={setTrainerFilter}>
              <SelectTrigger>
                <SelectValue placeholder="All instructors" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All instructors</SelectItem>
                {trainers.map(name => (
                  <SelectItem key={name} value={name}>{name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label className="text-xs mb-1 block">Machine</Label>
            <Select value={machineFilter} onValueChange={setMachineFilter}>
              <SelectTrigger>
                <SelectValue placeholder="All machines" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All machines</SelectItem>
                {machines.map(m => (
                  <SelectItem key={m.code} value={m.code}>{m.code} – {m.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label className="text-xs mb-1 block">Routine</Label>
            <Select value={programFilter} onValueChange={setProgramFilter}>
              <SelectTrigger>
                <SelectValue placeholder="All routines" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All routines</SelectItem>
                {programs.map(p => (
                  <SelectItem key={p} value={p}>Routine {p}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Table */}
        {filteredSessions.length === 0 ? (
          <div className="text-center py-8 text-slate-500">
            {sessions.length === 0
              ? 'No sessions yet. Your instructor will log sessions with you.'
              : 'No sessions match your filters.'}
          </div>
        ) : (
          <div className="border rounded-lg overflow-hidden">
            <div className="max-h-[600px] overflow-y-auto">
              <Table>
                <TableHeader className="sticky top-0 bg-white z-10">
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Time</TableHead>
                    <TableHead>Routine</TableHead>
                    <TableHead>Instructor</TableHead>
                    <TableHead>Location</TableHead>
                    <TableHead>Machines</TableHead>
                    <TableHead className="text-right">Entries</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredSessions.map(session => (
                    <TableRow key={session.id}>
                      <TableCell className="font-medium whitespace-nowrap">
                        {formatDate(session.actual_start || session.scheduled_start)}
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        {formatTime(session.actual_start || session.scheduled_start)}
                      </TableCell>
                      <TableCell>{session.program?.name || '–'}</TableCell>
                      <TableCell>
                        {session.trainer
                          ? `${session.trainer.first_name} ${session.trainer.last_name}`
                          : '–'}
                      </TableCell>
                      <TableCell>{session.location?.name || '–'}</TableCell>
                      <TableCell className="text-sm text-slate-600">
                        {getMachinesList(session)}
                      </TableCell>
                      <TableCell className="text-right">
                        {session.machine_sessions.length}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        )}

        <div className="mt-3 text-xs text-slate-500">
          Showing {filteredSessions.length} of {sessions.length} sessions
        </div>
      </CardContent>
    </Card>
  )
}
