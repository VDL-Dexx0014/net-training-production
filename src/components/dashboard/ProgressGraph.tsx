// src/components/dashboard/ProgressGraph.tsx
// Progress graph with dual axes (weight + time), routine and date range filters

'use client'

import { useEffect, useState, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { MachineImage } from '@/components/machine/MachineImage'

interface MachineInfo {
  id: string
  code: string
  name: string
  image_url: string | null
}

interface MachineSessionData {
  session_date: string
  session_program_id: string | null
  machine_id: string
  machine_code: string
  machine_name: string
  weight_lbs: number | null
  total_time_seconds: number | null
}

interface ChartDataPoint {
  date: string
  displayDate: string
  weight: number | null
  time: number | null
}

interface ProgramInfo {
  id: string
  name: string
  machine_ids: string[]
}

interface ProgressGraphProps {
  clientId: string
}

type DateRange = 'last_month' | 'last_3_months' | 'last_6_months' | 'ytd' | 'all'

const DATE_RANGE_OPTIONS: { value: DateRange; label: string }[] = [
  { value: 'last_month',   label: 'Last month' },
  { value: 'last_3_months', label: 'Last 3 months' },
  { value: 'last_6_months', label: 'Last 6 months' },
  { value: 'ytd',          label: 'Year to date' },
  { value: 'all',          label: 'All time' },
]

function getDateRangeCutoff(range: DateRange): Date | null {
  const now = new Date()
  if (range === 'last_month')   { const d = new Date(now); d.setMonth(d.getMonth() - 1); return d }
  if (range === 'last_3_months'){ const d = new Date(now); d.setMonth(d.getMonth() - 3); return d }
  if (range === 'last_6_months'){ const d = new Date(now); d.setMonth(d.getMonth() - 6); return d }
  if (range === 'ytd')          { return new Date(now.getFullYear(), 0, 1) }
  return null
}

export default function ProgressGraph({ clientId }: ProgressGraphProps) {
  const [machineData, setMachineData] = useState<MachineSessionData[]>([])
  const [allMachines, setAllMachines] = useState<MachineInfo[]>([])
  const [programs, setPrograms] = useState<ProgramInfo[]>([])
  const [loading, setLoading] = useState(true)

  const [routineFilter, setRoutineFilter] = useState<string>('all')
  const [dateRange, setDateRange] = useState<DateRange>('last_6_months')

  useEffect(() => {
    loadData()
  }, [clientId])

  const loadData = async () => {
    setLoading(true)
    const supabase = createClient()

    const [sessionsRes, programsRes] = await Promise.all([
      supabase
        .from('sessions')
        .select(`
          id,
          actual_start,
          program_id,
          machine_sessions (
            weight_lbs,
            total_time_seconds,
            machine:machines (
              id,
              machine_code,
              machine_name,
              image_url
            )
          )
        `)
        .eq('client_id', clientId)
        .eq('status', 'completed')
        .order('actual_start', { ascending: true }),
      supabase
        .from('programs')
        .select('id, name, program_machines ( machine_id )')
        .eq('client_id', clientId)
        .order('name'),
    ])

    if (!sessionsRes.data || sessionsRes.data.length === 0) {
      setLoading(false)
      return
    }

    const flattenedData: MachineSessionData[] = []
    const machinesMap = new Map<string, MachineInfo>()

    for (const session of sessionsRes.data as any[]) {
      for (const ms of session.machine_sessions || []) {
        const machine = ms.machine
        if (!machine) continue
        flattenedData.push({
          session_date: session.actual_start,
          session_program_id: session.program_id || null,
          machine_id: machine.id,
          machine_code: machine.machine_code,
          machine_name: machine.machine_name,
          weight_lbs: ms.weight_lbs,
          total_time_seconds: ms.total_time_seconds,
        })
        if (!machinesMap.has(machine.id)) {
          machinesMap.set(machine.id, {
            id: machine.id,
            code: machine.machine_code,
            name: machine.machine_name,
            image_url: machine.image_url,
          })
        }
      }
    }

    setMachineData(flattenedData)
    setAllMachines(Array.from(machinesMap.values()).sort((a, b) => a.code.localeCompare(b.code)))

    const programList: ProgramInfo[] = (programsRes.data || []).map((p: any) => ({
      id: p.id,
      name: p.name,
      machine_ids: (p.program_machines || []).map((pm: any) => pm.machine_id),
    }))
    setPrograms(programList)

    setLoading(false)
  }

  const cutoff = useMemo(() => getDateRangeCutoff(dateRange), [dateRange])

  const visibleMachineIds = useMemo(() => {
    if (routineFilter === 'all') return new Set(allMachines.map(m => m.id))
    const program = programs.find(p => p.id === routineFilter)
    return new Set(program?.machine_ids ?? [])
  }, [routineFilter, programs, allMachines])

  const filteredData = useMemo(() => {
    return machineData.filter(d => {
      if (!visibleMachineIds.has(d.machine_id)) return false
      if (cutoff && new Date(d.session_date) < cutoff) return false
      return true
    })
  }, [machineData, visibleMachineIds, cutoff])

  // Only show machines that have data in the current filter window
  const visibleMachines = useMemo(() => {
    const ids = new Set(filteredData.map(d => d.machine_id))
    return allMachines.filter(m => ids.has(m.id))
  }, [allMachines, filteredData])

  const prepareChartData = (machineId: string): ChartDataPoint[] => {
    const rows = filteredData.filter(d => d.machine_id === machineId)
    const byDate: Record<string, { date: string; weights: number[]; times: number[] }> = {}
    for (const d of rows) {
      const key = d.session_date.split('T')[0]
      if (!byDate[key]) byDate[key] = { date: d.session_date, weights: [], times: [] }
      if (d.weight_lbs !== null) byDate[key].weights.push(d.weight_lbs)
      if (d.total_time_seconds !== null) byDate[key].times.push(d.total_time_seconds)
    }
    return Object.values(byDate)
      .map(g => ({
        date: g.date,
        displayDate: new Date(g.date).toLocaleDateString('en-CA', { month: 'short', day: 'numeric' }),
        weight: g.weights.length > 0 ? Math.max(...g.weights) : null,
        time: g.times.length > 0 ? g.times.reduce((a, b) => a + b, 0) : null,
      }))
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
  }

  const formatTime = (seconds: number | null) => {
    if (seconds === null) return '0s'
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return mins > 0 ? `${mins}m ${secs}s` : `${secs}s`
  }

  const CustomTooltip = ({ active, payload }: any) => {
    if (!active || !payload?.length) return null
    return (
      <div className="bg-white p-3 border rounded-lg shadow-lg">
        <p className="font-medium mb-2">{payload[0].payload.displayDate}</p>
        {payload.map((entry: any, i: number) => (
          <p key={i} style={{ color: entry.color }} className="text-sm">
            {entry.name}: {entry.name === 'Weight' ? `${entry.value} lbs` : formatTime(entry.value)}
          </p>
        ))}
      </div>
    )
  }

  const getSummaryStats = (chartData: ChartDataPoint[]) => {
    const firstWeight = chartData.find(d => d.weight !== null)?.weight ?? null
    let lastWeight: number | null = null
    for (let i = chartData.length - 1; i >= 0; i--) {
      if (chartData[i].weight !== null) { lastWeight = chartData[i].weight; break }
    }
    const diff = firstWeight != null && lastWeight != null ? lastWeight - firstWeight : null
    return { sessions: chartData.length, firstWeight, lastWeight, diff }
  }

  if (loading) {
    return (
      <Card>
        <CardHeader><CardTitle>Progress Tracking</CardTitle></CardHeader>
        <CardContent>
          <div className="text-center py-8 text-slate-500">Loading progress data...</div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Progress Tracking</CardTitle>
        <CardDescription>Track your weight and time progress by machine</CardDescription>
      </CardHeader>
      <CardContent>
        {/* Filters */}
        <div className="flex flex-wrap gap-3 mb-6">
          {programs.length > 0 && (
            <div>
              <p className="text-xs font-medium text-slate-600 mb-1">Routine</p>
              <Select value={routineFilter} onValueChange={setRoutineFilter}>
                <SelectTrigger className="h-8 text-xs w-44">
                  <SelectValue placeholder="All routines" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All routines</SelectItem>
                  {programs.map(p => (
                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <div>
            <p className="text-xs font-medium text-slate-600 mb-1">Period</p>
            <Select value={dateRange} onValueChange={v => setDateRange(v as DateRange)}>
              <SelectTrigger className="h-8 text-xs w-44">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DATE_RANGE_OPTIONS.map(o => (
                  <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Machine Graphs */}
        {allMachines.length === 0 ? (
          <div className="text-center py-12 text-slate-500">
            No machine data available yet. Start training to see your progress!
          </div>
        ) : visibleMachines.length === 0 ? (
          <div className="text-center py-12 text-slate-500">
            No data for the selected routine and period.
          </div>
        ) : (
          <div className="space-y-8">
            {visibleMachines.map(machine => {
              const chartData = prepareChartData(machine.id)
              if (chartData.length === 0) return null
              const stats = getSummaryStats(chartData)

              return (
                <div key={machine.id} className="border rounded-lg p-4">
                  <div className="flex items-center gap-3 mb-4">
                    <MachineImage src={machine.image_url} alt={machine.name} size="sm" />
                    <div>
                      <h3 className="font-semibold text-sm">{machine.code} – {machine.name}</h3>
                    </div>
                    <div className="ml-auto flex gap-4 text-xs text-slate-500">
                      <span>{stats.sessions} sessions</span>
                      {stats.lastWeight != null && <span>{stats.lastWeight} lbs</span>}
                      {stats.diff != null && (
                        <span className={stats.diff >= 0 ? 'text-green-600' : 'text-red-600'}>
                          {stats.diff >= 0 ? '+' : ''}{stats.diff} lbs
                        </span>
                      )}
                    </div>
                  </div>

                  <ResponsiveContainer width="100%" height={220}>
                    <LineChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="displayDate" tick={{ fontSize: 11 }} />
                      <YAxis yAxisId="left" label={{ value: 'lbs', angle: -90, position: 'insideLeft', style: { fontSize: 11 } }} domain={['auto', 'auto']} tick={{ fontSize: 11 }} />
                      <YAxis yAxisId="right" orientation="right" label={{ value: 'sec', angle: 90, position: 'insideRight', style: { fontSize: 11 } }} domain={['auto', 'auto']} tick={{ fontSize: 11 }} />
                      <Tooltip content={<CustomTooltip />} />
                      <Legend wrapperStyle={{ fontSize: 11 }} />
                      <Line yAxisId="left" type="monotone" dataKey="weight" stroke="#3b82f6" strokeWidth={2} name="Weight" dot={{ r: 3 }} connectNulls />
                      <Line yAxisId="right" type="monotone" dataKey="time" stroke="#10b981" strokeWidth={2} name="Time" dot={{ r: 3 }} connectNulls />
                    </LineChart>
                  </ResponsiveContainer>

                  <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-3">
                    <div className="bg-slate-50 p-3 rounded-lg">
                      <p className="text-xs text-slate-600">Sessions</p>
                      <p className="text-xl font-bold">{stats.sessions}</p>
                    </div>
                    <div className="bg-slate-50 p-3 rounded-lg">
                      <p className="text-xs text-slate-600">Current Weight</p>
                      <p className="text-xl font-bold">{stats.lastWeight != null ? `${stats.lastWeight} lbs` : '–'}</p>
                    </div>
                    <div className="bg-slate-50 p-3 rounded-lg">
                      <p className="text-xs text-slate-600">Starting Weight</p>
                      <p className="text-xl font-bold">{stats.firstWeight != null ? `${stats.firstWeight} lbs` : '–'}</p>
                    </div>
                    <div className="bg-slate-50 p-3 rounded-lg">
                      <p className="text-xs text-slate-600">Progress</p>
                      <p className={`text-xl font-bold ${stats.diff != null && stats.diff >= 0 ? 'text-green-600' : stats.diff != null ? 'text-red-600' : ''}`}>
                        {stats.diff != null ? `${stats.diff >= 0 ? '+' : ''}${stats.diff} lbs` : '–'}
                      </p>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
