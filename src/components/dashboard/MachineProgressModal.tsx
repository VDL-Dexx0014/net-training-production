// src/components/dashboard/MachineProgressModal.tsx
// Modal chart showing weight + time progress over time for a single machine.

'use client'

import { useEffect, useState, useMemo } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { createClient } from '@/lib/supabase/client'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'

interface ChartDataPoint {
  date: string
  displayDate: string
  weight: number | null
  time: number | null
}

type DateRange = 'last_month' | 'last_3_months' | 'last_6_months' | 'ytd' | 'all'

const DATE_RANGE_OPTIONS: { value: DateRange; label: string }[] = [
  { value: 'last_month',    label: 'Last month' },
  { value: 'last_3_months', label: 'Last 3 months' },
  { value: 'last_6_months', label: 'Last 6 months' },
  { value: 'ytd',           label: 'Year to date' },
  { value: 'all',           label: 'All time' },
]

function getDateRangeCutoff(range: DateRange): Date | null {
  const now = new Date()
  if (range === 'last_month')    { const d = new Date(now); d.setMonth(d.getMonth() - 1); return d }
  if (range === 'last_3_months') { const d = new Date(now); d.setMonth(d.getMonth() - 3); return d }
  if (range === 'last_6_months') { const d = new Date(now); d.setMonth(d.getMonth() - 6); return d }
  if (range === 'ytd')           { return new Date(now.getFullYear(), 0, 1) }
  return null
}

function formatTime(seconds: number | null) {
  if (seconds === null) return '0s'
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  return mins > 0 ? `${mins}m ${secs}s` : `${secs}s`
}

const CustomTooltip = ({ active, payload }: any) => {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-white p-3 border rounded-lg shadow-lg text-sm">
      <p className="font-medium mb-1">{payload[0].payload.displayDate}</p>
      {payload.map((entry: any, i: number) => (
        <p key={i} style={{ color: entry.color }}>
          {entry.name}: {entry.name === 'Weight' ? `${entry.value} lbs` : formatTime(entry.value)}
        </p>
      ))}
    </div>
  )
}

interface MachineProgressModalProps {
  clientId: string
  machineId: string | null
  machineCode: string
  machineName: string
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function MachineProgressModal({
  clientId,
  machineId,
  machineCode,
  machineName,
  open,
  onOpenChange,
}: MachineProgressModalProps) {
  const [rawData, setRawData] = useState<{ date: string; weight: number | null; time: number | null }[]>([])
  const [loading, setLoading] = useState(false)
  const [dateRange, setDateRange] = useState<DateRange>('last_6_months')

  useEffect(() => {
    if (!open || !machineId) return
    loadData()
  }, [open, machineId])

  const loadData = async () => {
    if (!machineId) return
    setLoading(true)
    const supabase = createClient()

    const { data } = await supabase
      .from('sessions')
      .select(`
        actual_start,
        machine_sessions!inner (
          weight_lbs,
          total_time_seconds,
          machine_id
        )
      `)
      .eq('client_id', clientId)
      .eq('status', 'completed')
      .eq('machine_sessions.machine_id', machineId)
      .order('actual_start', { ascending: true })

    if (data) {
      const rows: { date: string; weight: number | null; time: number | null }[] = []
      for (const session of data as any[]) {
        for (const ms of session.machine_sessions || []) {
          rows.push({
            date: session.actual_start,
            weight: ms.weight_lbs,
            time: ms.total_time_seconds,
          })
        }
      }
      setRawData(rows)
    }
    setLoading(false)
  }

  const cutoff = useMemo(() => getDateRangeCutoff(dateRange), [dateRange])

  const chartData = useMemo((): ChartDataPoint[] => {
    const filtered = cutoff
      ? rawData.filter(d => new Date(d.date) >= cutoff)
      : rawData

    const byDate: Record<string, { date: string; weights: number[]; times: number[] }> = {}
    for (const d of filtered) {
      const key = d.date.split('T')[0]
      if (!byDate[key]) byDate[key] = { date: d.date, weights: [], times: [] }
      if (d.weight !== null) byDate[key].weights.push(d.weight)
      if (d.time !== null) byDate[key].times.push(d.time)
    }
    return Object.values(byDate)
      .map(g => ({
        date: g.date,
        displayDate: new Date(g.date).toLocaleDateString('en-CA', { month: 'short', day: 'numeric' }),
        weight: g.weights.length > 0 ? Math.max(...g.weights) : null,
        time: g.times.length > 0 ? g.times.reduce((a, b) => a + b, 0) : null,
      }))
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
  }, [rawData, cutoff])

  const stats = useMemo(() => {
    const firstWeight = chartData.find(d => d.weight !== null)?.weight ?? null
    let lastWeight: number | null = null
    for (let i = chartData.length - 1; i >= 0; i--) {
      if (chartData[i].weight !== null) { lastWeight = chartData[i].weight; break }
    }
    const diff = firstWeight != null && lastWeight != null ? lastWeight - firstWeight : null
    return { sessions: chartData.length, firstWeight, lastWeight, diff }
  }, [chartData])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="!max-w-3xl w-full" showCloseButton>
        <DialogHeader>
          <DialogTitle className="font-mono text-base">
            {machineCode} <span className="font-sans font-normal text-slate-500 text-sm">— {machineName}</span>
          </DialogTitle>
        </DialogHeader>

        <div className="flex items-center justify-between mb-4">
          <div className="flex gap-4 text-sm text-slate-600">
            <span><span className="font-medium">{stats.sessions}</span> sessions</span>
            {stats.lastWeight != null && <span>Current: <span className="font-medium">{stats.lastWeight} lbs</span></span>}
            {stats.diff != null && (
              <span className={stats.diff >= 0 ? 'text-green-600 font-medium' : 'text-red-600 font-medium'}>
                {stats.diff >= 0 ? '+' : ''}{stats.diff} lbs
              </span>
            )}
          </div>
          <Select value={dateRange} onValueChange={v => setDateRange(v as DateRange)}>
            <SelectTrigger className="h-7 text-xs w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {DATE_RANGE_OPTIONS.map(o => (
                <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {loading ? (
          <div className="h-64 flex items-center justify-center text-slate-400 text-sm">Loading…</div>
        ) : chartData.length === 0 ? (
          <div className="h-64 flex items-center justify-center text-slate-400 text-sm">No data for this period.</div>
        ) : (
          <ResponsiveContainer width="100%" height={280}>
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
        )}
      </DialogContent>
    </Dialog>
  )
}
