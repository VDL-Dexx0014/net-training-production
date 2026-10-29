// src/components/management/TrainerPerformanceReport.tsx
// Report showing trainer performance metrics and utilization

'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { createClient } from '@/lib/supabase/client'
import { Users, Calendar, TrendingUp, Clock } from 'lucide-react'
import { formatName } from '@/lib/utils/name-formatter'

interface TrainerMetrics {
  id: string
  name: string
  email: string
  activeClients: number
  totalSessions: number
  completedSessions: number
  scheduledSessions: number
  completionRate: number
  averageSessionsPerWeek: number
  locations: string[]
}

interface TrainerPerformanceReportProps {
  dateRange?: {
    start: Date
    end: Date
  }
  locationId?: string
}

export function TrainerPerformanceReport({ dateRange, locationId }: TrainerPerformanceReportProps) {
  const [metrics, setMetrics] = useState<TrainerMetrics[]>([])
  const [loading, setLoading] = useState(true)
  const [sortBy, setSortBy] = useState<'sessions' | 'clients' | 'completion'>('sessions')

  useEffect(() => {
    loadTrainerMetrics()
  }, [dateRange, locationId])

  const loadTrainerMetrics = async () => {
    setLoading(true)
    const supabase = createClient()

    try {
      // Get all trainers
      const { data: trainers, error: trainersError } = await supabase
        .from('profiles')
        .select('id, first_name, last_name, email')
        .contains('roles', ['trainer'])
        .eq('is_active', true)

      if (trainersError) throw trainersError

      const trainerMetrics: TrainerMetrics[] = []

      for (const trainer of (trainers || []) as any[]) {
        // Get active clients for this trainer
        const { count: activeClientsCount } = await supabase
          .from('trainer_clients')
          .select('*', { count: 'exact', head: true })
          .eq('trainer_id', trainer.id)
          .eq('is_active', true)

        // Build sessions query
        let sessionsQuery = supabase
          .from('sessions')
          .select('*, locations(name)')
          .eq('trainer_id', trainer.id)
          .neq('status', 'cancelled') // Exclude cancelled sessions

        // Apply date range filter if provided
        if (dateRange) {
          sessionsQuery = sessionsQuery
            .gte('scheduled_start', dateRange.start.toISOString())
            .lte('scheduled_start', dateRange.end.toISOString())
        }

        // Apply location filter if provided
        if (locationId) {
          sessionsQuery = sessionsQuery.eq('location_id', locationId)
        }

        const { data: sessions, error: sessionsError } = await sessionsQuery

        if (sessionsError) throw sessionsError

        const totalSessions = sessions?.length || 0
        const completedSessions = sessions?.filter((s: any) => s.status === 'completed').length || 0
        const scheduledSessions = sessions?.filter((s: any) => s.status === 'scheduled').length || 0

        // Get trainer locations
        const { data: trainerLocations } = await supabase
          .from('trainer_locations')
          .select('locations(name)')
          .eq('trainer_id', trainer.id)

        const locations = trainerLocations?.map((tl: any) => tl.locations?.name).filter(Boolean) || []

        // Calculate completion rate (completed sessions / total sessions)
        const completionRate = totalSessions > 0 ? (completedSessions / totalSessions) * 100 : 0

        // Calculate average sessions per week (if date range provided)
        let averageSessionsPerWeek = 0
        if (dateRange) {
          const weeks = Math.max(1, Math.ceil((dateRange.end.getTime() - dateRange.start.getTime()) / (7 * 24 * 60 * 60 * 1000)))
          averageSessionsPerWeek = totalSessions / weeks
        }

        trainerMetrics.push({
          id: trainer.id,
          name: formatName(trainer.first_name, trainer.last_name, 'management'),
          email: trainer.email,
          activeClients: activeClientsCount || 0,
          totalSessions,
          completedSessions,
          scheduledSessions,
          completionRate,
          averageSessionsPerWeek,
          locations
        })
      }

      // Sort metrics
      const sorted = trainerMetrics.sort((a, b) => {
        if (sortBy === 'sessions') return b.totalSessions - a.totalSessions
        if (sortBy === 'clients') return b.activeClients - a.activeClients
        if (sortBy === 'completion') return b.completionRate - a.completionRate
        return 0
      })

      setMetrics(sorted)
    } catch (error) {
      console.error('Error loading trainer metrics:', error)
    } finally {
      setLoading(false)
    }
  }

  const getCompletionRateColor = (rate: number) => {
    if (rate >= 80) return 'bg-green-100 text-green-800 border-green-300'
    if (rate >= 60) return 'bg-blue-100 text-blue-800 border-blue-300'
    if (rate >= 40) return 'bg-yellow-100 text-yellow-800 border-yellow-300'
    return 'bg-red-100 text-red-800 border-red-300'
  }

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Instructor Performance</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-slate-500">Loading metrics...</div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Instructor Performance</CardTitle>
            <CardDescription>
              Performance metrics and utilization rates for all instructors
            </CardDescription>
          </div>
          <div className="flex gap-2">
            <Button
              variant={sortBy === 'sessions' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setSortBy('sessions')}
            >
              Sort by Sessions
            </Button>
            <Button
              variant={sortBy === 'clients' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setSortBy('clients')}
            >
              Sort by Clients
            </Button>
            <Button
              variant={sortBy === 'completion' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setSortBy('completion')}
            >
              Sort by Completion
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {metrics.length === 0 ? (
          <div className="text-center py-8 text-slate-500">No instructor data available</div>
        ) : (
          <div className="space-y-4">
            {metrics.map((trainer) => (
              <div
                key={trainer.id}
                className="border rounded-lg p-4 hover:bg-slate-50 transition-colors"
              >
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="font-semibold text-lg">{trainer.name}</h3>
                    <p className="text-sm text-slate-600">{trainer.email}</p>
                    {trainer.locations.length > 0 && (
                      <div className="flex gap-1 mt-1">
                        {trainer.locations.map((loc, idx) => (
                          <Badge key={idx} variant="outline" className="text-xs">
                            {loc}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                  <Badge variant="outline" className={getCompletionRateColor(trainer.completionRate)}>
                    {trainer.completionRate.toFixed(0)}% Completion
                  </Badge>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4 text-slate-500" />
                    <div>
                      <p className="text-2xl font-bold">{trainer.activeClients}</p>
                      <p className="text-xs text-slate-600">Active Clients</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-slate-500" />
                    <div>
                      <p className="text-2xl font-bold">{trainer.totalSessions}</p>
                      <p className="text-xs text-slate-600">Total Sessions</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-green-500" />
                    <div>
                      <p className="text-2xl font-bold">{trainer.completedSessions}</p>
                      <p className="text-xs text-slate-600">Completed</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-blue-500" />
                    <div>
                      <p className="text-2xl font-bold">{trainer.scheduledSessions}</p>
                      <p className="text-xs text-slate-600">Scheduled</p>
                    </div>
                  </div>
                </div>

                {dateRange && trainer.averageSessionsPerWeek > 0 && (
                  <div className="mt-3 pt-3 border-t">
                    <p className="text-sm text-slate-600">
                      Average: <span className="font-semibold">{trainer.averageSessionsPerWeek.toFixed(1)}</span> sessions/week
                    </p>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
