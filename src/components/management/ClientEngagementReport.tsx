// src/components/management/ClientEngagementReport.tsx
// Report showing client engagement metrics and retention

'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { createClient } from '@/lib/supabase/client'
import { Users, Calendar, TrendingUp, AlertCircle } from 'lucide-react'

interface ClientEngagementMetrics {
  totalClients: number
  activeClients: number
  inactiveClients: number
  newClientsThisMonth: number
  averageSessionsPerClient: number
  highEngagement: number
  mediumEngagement: number
  lowEngagement: number
  atRiskClients: number
  clientsByProgram: { programCount: number; clients: number }[]
  highThreshold: number
  mediumThreshold: number
}

interface ClientEngagementReportProps {
  dateRange?: {
    start: Date
    end: Date
  }
  locationId?: string
}

export function ClientEngagementReport({ dateRange, locationId }: ClientEngagementReportProps) {
  const [metrics, setMetrics] = useState<ClientEngagementMetrics | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadEngagementMetrics()
  }, [dateRange, locationId])

  const loadEngagementMetrics = async () => {
    setLoading(true)
    const supabase = createClient()

    try {
      // Get all active clients
      const { data: clients, error: clientsError } = await supabase
        .from('profiles')
        .select('id, created_at')
        .contains('roles', ['client'])
        .eq('is_active', true)

      if (clientsError) throw clientsError

      const totalClients = clients?.length || 0

      // Calculate new clients this month
      const startOfMonth = new Date()
      startOfMonth.setDate(1)
      startOfMonth.setHours(0, 0, 0, 0)

      const newClientsThisMonth = clients?.filter((c: any) =>
        new Date(c.created_at) >= startOfMonth
      ).length || 0

      // Build sessions query
      let sessionsQuery = supabase
        .from('sessions')
        .select('client_id, scheduled_start')

      if (dateRange) {
        sessionsQuery = sessionsQuery
          .gte('scheduled_start', dateRange.start.toISOString())
          .lte('scheduled_start', dateRange.end.toISOString())
      }

      if (locationId) {
        sessionsQuery = sessionsQuery.eq('location_id', locationId)
      }

      const { data: sessions, error: sessionsError } = await sessionsQuery

      if (sessionsError) throw sessionsError

      // Calculate sessions per client
      const clientSessionCounts: { [clientId: string]: number } = {}
      sessions?.forEach((session: any) => {
        clientSessionCounts[session.client_id] = (clientSessionCounts[session.client_id] || 0) + 1
      })

      const clientsWithSessions = Object.keys(clientSessionCounts).length
      const activeClients = clientsWithSessions
      const inactiveClients = totalClients - activeClients

      const totalSessions = sessions?.length || 0
      const averageSessionsPerClient = activeClients > 0 ? totalSessions / activeClients : 0

      // Calculate dynamic engagement thresholds based on date range
      let highThreshold = 8  // Default for monthly
      let mediumThreshold = 4

      if (dateRange) {
        // Calculate days in the selected range
        const daysInRange = Math.ceil((dateRange.end.getTime() - dateRange.start.getTime()) / (1000 * 60 * 60 * 24))

        if (daysInRange <= 7) {
          // Weekly view: 2+ sessions = high, 1 = medium
          highThreshold = 2
          mediumThreshold = 1
        } else if (daysInRange <= 31) {
          // Monthly view: 8+ = high, 4-7 = medium
          highThreshold = 8
          mediumThreshold = 4
        } else if (daysInRange <= 93) {
          // Quarterly view: 24+ = high, 12-23 = medium
          highThreshold = 24
          mediumThreshold = 12
        } else {
          // Yearly view: 96+ = high, 48-95 = medium
          highThreshold = 96
          mediumThreshold = 48
        }
      }

      // Categorize engagement levels using dynamic thresholds
      let highEngagement = 0
      let mediumEngagement = 0
      let lowEngagement = 0

      Object.values(clientSessionCounts).forEach(count => {
        if (count >= highThreshold) highEngagement++
        else if (count >= mediumThreshold) mediumEngagement++
        else lowEngagement++
      })

      // Find at-risk clients (no sessions in last 2 weeks)
      const twoWeeksAgo = new Date()
      twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14)

      const { data: recentSessions } = await supabase
        .from('sessions')
        .select('client_id')
        .gte('scheduled_start', twoWeeksAgo.toISOString())

      const clientsWithRecentSessions = new Set(recentSessions?.map((s: any) => s.client_id) || [])
      const atRiskClients = clients?.filter((c: any) => !clientsWithRecentSessions.has(c.id)).length || 0

      // Get clients by program count
      const { data: programCounts } = await supabase
        .from('programs')
        .select('client_id')
        .eq('status', 'active')

      const clientProgramCounts: { [clientId: string]: number } = {}
      programCounts?.forEach((p: any) => {
        clientProgramCounts[p.client_id] = (clientProgramCounts[p.client_id] || 0) + 1
      })

      const clientsByProgram: { [count: number]: number } = {}
      Object.values(clientProgramCounts).forEach(count => {
        clientsByProgram[count] = (clientsByProgram[count] || 0) + 1
      })

      const clientsByProgramArray = Object.entries(clientsByProgram)
        .map(([count, clients]) => ({ programCount: parseInt(count), clients }))
        .sort((a, b) => a.programCount - b.programCount)

      setMetrics({
        totalClients,
        activeClients,
        inactiveClients,
        newClientsThisMonth,
        averageSessionsPerClient,
        highEngagement,
        mediumEngagement,
        lowEngagement,
        atRiskClients,
        clientsByProgram: clientsByProgramArray,
        highThreshold,
        mediumThreshold
      })
    } catch (error) {
      console.error('Error loading engagement metrics:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Client Engagement</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-slate-500">Loading metrics...</div>
        </CardContent>
      </Card>
    )
  }

  if (!metrics) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Client Engagement</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-slate-500">No data available</div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Client Engagement</CardTitle>
        <CardDescription>
          Client activity metrics and retention indicators
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Overview Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="flex items-center gap-2 p-3 bg-slate-50 rounded-lg">
            <Users className="h-5 w-5 text-blue-500" />
            <div>
              <p className="text-2xl font-bold">{metrics.totalClients}</p>
              <p className="text-xs text-slate-600">Total Clients</p>
            </div>
          </div>

          <div className="flex items-center gap-2 p-3 bg-green-50 rounded-lg">
            <TrendingUp className="h-5 w-5 text-green-500" />
            <div>
              <p className="text-2xl font-bold">{metrics.activeClients}</p>
              <p className="text-xs text-slate-600">Active Clients</p>
            </div>
          </div>

          <div className="flex items-center gap-2 p-3 bg-yellow-50 rounded-lg">
            <Calendar className="h-5 w-5 text-yellow-500" />
            <div>
              <p className="text-2xl font-bold">{metrics.newClientsThisMonth}</p>
              <p className="text-xs text-slate-600">New This Month</p>
            </div>
          </div>

          <div className="flex items-center gap-2 p-3 bg-red-50 rounded-lg">
            <AlertCircle className="h-5 w-5 text-red-500" />
            <div>
              <p className="text-2xl font-bold">{metrics.atRiskClients}</p>
              <p className="text-xs text-slate-600">At Risk</p>
            </div>
          </div>
        </div>

        {/* Average Sessions */}
        <div className="border rounded-lg p-4">
          <h3 className="font-semibold mb-2">Average Sessions per Client</h3>
          <p className="text-3xl font-bold text-blue-600">{metrics.averageSessionsPerClient.toFixed(1)}</p>
          <p className="text-sm text-slate-600 mt-1">sessions per active client</p>
        </div>

        {/* Engagement Levels */}
        <div className="border rounded-lg p-4">
          <h3 className="font-semibold mb-4">Engagement Levels</h3>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="bg-green-100 text-green-800 border-green-300">
                  High
                </Badge>
                <span className="text-sm text-slate-600">{metrics.highThreshold}+ sessions</span>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-32 bg-slate-200 rounded-full h-2">
                  <div
                    className="bg-green-500 h-2 rounded-full"
                    style={{ width: `${(metrics.highEngagement / metrics.activeClients) * 100}%` }}
                  />
                </div>
                <span className="text-sm font-semibold w-12 text-right">{metrics.highEngagement}</span>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="bg-blue-100 text-blue-800 border-blue-300">
                  Medium
                </Badge>
                <span className="text-sm text-slate-600">{metrics.mediumThreshold}-{metrics.highThreshold - 1} sessions</span>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-32 bg-slate-200 rounded-full h-2">
                  <div
                    className="bg-blue-500 h-2 rounded-full"
                    style={{ width: `${(metrics.mediumEngagement / metrics.activeClients) * 100}%` }}
                  />
                </div>
                <span className="text-sm font-semibold w-12 text-right">{metrics.mediumEngagement}</span>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="bg-yellow-100 text-yellow-800 border-yellow-300">
                  Low
                </Badge>
                <span className="text-sm text-slate-600">1-{metrics.mediumThreshold - 1} sessions</span>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-32 bg-slate-200 rounded-full h-2">
                  <div
                    className="bg-yellow-500 h-2 rounded-full"
                    style={{ width: `${(metrics.lowEngagement / metrics.activeClients) * 100}%` }}
                  />
                </div>
                <span className="text-sm font-semibold w-12 text-right">{metrics.lowEngagement}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Programs per Client */}
        <div className="border rounded-lg p-4">
          <h3 className="font-semibold mb-4">Programs per Client</h3>
          {metrics.clientsByProgram.length === 0 ? (
            <p className="text-sm text-slate-500">No program data</p>
          ) : (
            <div className="space-y-2">
              {metrics.clientsByProgram.map((item, idx) => (
                <div key={idx} className="flex items-center justify-between text-sm">
                  <span className="text-slate-700">
                    {item.programCount} {item.programCount === 1 ? 'program' : 'programs'}
                  </span>
                  <Badge variant="outline">{item.clients} clients</Badge>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* At-Risk Alert */}
        {metrics.atRiskClients > 0 && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
              <div>
                <h4 className="font-semibold text-red-900 mb-1">
                  {metrics.atRiskClients} At-Risk Clients
                </h4>
                <p className="text-sm text-red-700">
                  These clients haven't had a session in the last 2 weeks. Consider reaching out to re-engage them.
                </p>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
