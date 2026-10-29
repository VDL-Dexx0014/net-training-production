// src/components/management/GymUtilizationReport.tsx
// Report showing gym capacity utilization and peak hours analysis

'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { createClient } from '@/lib/supabase/client'
import { MapPin, Users, TrendingUp, Clock } from 'lucide-react'

interface LocationMetrics {
  id: string
  name: string
  address: string
  maxTrainers: number
  totalSessions: number
  activeTrainers: number
  peakCapacityUsage: number
  averageCapacityUsage: number
  peakHours: { hour: number; sessions: number }[]
  peakDays: { day: string; sessions: number }[]
}

interface GymUtilizationReportProps {
  dateRange?: {
    start: Date
    end: Date
  }
}

export function GymUtilizationReport({ dateRange }: GymUtilizationReportProps) {
  const [metrics, setMetrics] = useState<LocationMetrics[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadUtilizationMetrics()
  }, [dateRange])

  const loadUtilizationMetrics = async () => {
    setLoading(true)
    const supabase = createClient()

    try {
      // Get all active locations
      const { data: locations, error: locationsError } = await supabase
        .from('locations')
        .select('id, name, address, max_trainers')
        .eq('is_active', true)

      if (locationsError) throw locationsError

      const locationMetrics: LocationMetrics[] = []

      for (const location of (locations || []) as any[]) {
        // Build sessions query
        let sessionsQuery = supabase
          .from('sessions')
          .select('scheduled_start, scheduled_end, trainer_id')
          .eq('location_id', location.id)
          .neq('status', 'cancelled') // Exclude cancelled sessions

        // Apply date range filter if provided
        if (dateRange) {
          sessionsQuery = sessionsQuery
            .gte('scheduled_start', dateRange.start.toISOString())
            .lte('scheduled_start', dateRange.end.toISOString())
        }

        const { data: sessions, error: sessionsError } = await sessionsQuery

        if (sessionsError) throw sessionsError

        const totalSessions = sessions?.length || 0

        // Get unique trainers who worked at this location
        const uniqueTrainers = new Set(sessions?.map((s: any) => s.trainer_id) || [])
        const activeTrainers = uniqueTrainers.size

        // Analyze capacity usage with precise 30-minute time-slot overlap checking
        const timeSlotUtilization: { [timeSlot: string]: Set<string> } = {}
        const dailyUtilization: { [day: string]: number } = {}

        sessions?.forEach((session: any) => {
          const sessionStart = new Date(session.scheduled_start)
          const sessionEnd = new Date(session.scheduled_end)
          const dayOfWeek = sessionStart.toLocaleDateString('en-US', { weekday: 'long' })

          // Count sessions per day of week
          dailyUtilization[dayOfWeek] = (dailyUtilization[dayOfWeek] || 0) + 1

          // Generate all 30-minute time slots this session overlaps
          let currentSlot = new Date(sessionStart)
          while (currentSlot < sessionEnd) {
            const slotKey = currentSlot.toISOString()

            if (!timeSlotUtilization[slotKey]) {
              timeSlotUtilization[slotKey] = new Set()
            }
            timeSlotUtilization[slotKey].add(session.trainer_id)

            // Move to next 30-minute slot
            currentSlot = new Date(currentSlot.getTime() + 30 * 60 * 1000)
          }
        })

        // Calculate peak capacity usage (maximum concurrent trainers at any time)
        let peakCapacityUsage = 0
        const hourlyPeakData: { [hour: number]: number } = {}

        Object.entries(timeSlotUtilization).forEach(([timeSlot, trainers]) => {
          const trainerCount = trainers.size
          const capacityUsage = (trainerCount / location.max_trainers) * 100
          peakCapacityUsage = Math.max(peakCapacityUsage, capacityUsage)

          // Track peak by hour for display purposes
          const slotTime = new Date(timeSlot)
          const hour = slotTime.getHours()
          hourlyPeakData[hour] = Math.max(hourlyPeakData[hour] || 0, trainerCount)
        })

        // Convert hourly peaks to array and sort
        const peakHoursData = Object.entries(hourlyPeakData)
          .map(([hour, trainers]) => ({
            hour: parseInt(hour),
            sessions: trainers
          }))
          .sort((a, b) => b.sessions - a.sessions)
          .slice(0, 5)

        // Calculate average capacity usage across all active time slots
        const totalCapacityPoints = Object.values(timeSlotUtilization).reduce((sum, trainers) => sum + trainers.size, 0)
        const averageCapacityUsage = Object.keys(timeSlotUtilization).length > 0
          ? (totalCapacityPoints / (Object.keys(timeSlotUtilization).length * location.max_trainers)) * 100
          : 0

        // Get peak days
        const peakDaysData = Object.entries(dailyUtilization)
          .map(([day, sessions]) => ({ day, sessions }))
          .sort((a, b) => b.sessions - a.sessions)
          .slice(0, 3)

        locationMetrics.push({
          id: location.id,
          name: location.name,
          address: location.address,
          maxTrainers: location.max_trainers,
          totalSessions,
          activeTrainers,
          peakCapacityUsage,
          averageCapacityUsage,
          peakHours: peakHoursData,
          peakDays: peakDaysData
        })
      }

      setMetrics(locationMetrics)
    } catch (error) {
      console.error('Error loading utilization metrics:', error)
    } finally {
      setLoading(false)
    }
  }

  const getCapacityColor = (usage: number) => {
    if (usage >= 90) return 'bg-red-100 text-red-800 border-red-300'
    if (usage >= 70) return 'bg-yellow-100 text-yellow-800 border-yellow-300'
    if (usage >= 50) return 'bg-blue-100 text-blue-800 border-blue-300'
    return 'bg-green-100 text-green-800 border-green-300'
  }

  const formatHour = (hour: number) => {
    const period = hour >= 12 ? 'PM' : 'AM'
    const displayHour = hour % 12 || 12
    return `${displayHour}:00 ${period}`
  }

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Gym Utilization</CardTitle>
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
        <CardTitle>Gym Utilization</CardTitle>
        <CardDescription>
          Capacity usage and peak hours analysis across all locations
        </CardDescription>
      </CardHeader>
      <CardContent>
        {metrics.length === 0 ? (
          <div className="text-center py-8 text-slate-500">No utilization data available</div>
        ) : (
          <div className="space-y-6">
            {metrics.map((location) => (
              <div
                key={location.id}
                className="border rounded-lg p-4 hover:bg-slate-50 transition-colors"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-start gap-3">
                    <MapPin className="h-5 w-5 text-slate-500 mt-1" />
                    <div>
                      <h3 className="font-semibold text-lg">{location.name}</h3>
                      <p className="text-sm text-slate-600">{location.address}</p>
                      <p className="text-sm text-slate-500 mt-1">
                        Max capacity: {location.maxTrainers} instructors at once
                      </p>
                    </div>
                  </div>
                  <Badge variant="outline" className={getCapacityColor(location.peakCapacityUsage)}>
                    {location.peakCapacityUsage.toFixed(0)}% Peak Capacity
                  </Badge>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                  <div className="flex items-center gap-2 p-3 bg-slate-50 rounded-lg">
                    <Users className="h-5 w-5 text-blue-500" />
                    <div>
                      <p className="text-2xl font-bold">{location.totalSessions}</p>
                      <p className="text-xs text-slate-600">Total Sessions</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 p-3 bg-slate-50 rounded-lg">
                    <TrendingUp className="h-5 w-5 text-green-500" />
                    <div>
                      <p className="text-2xl font-bold">{location.activeTrainers}</p>
                      <p className="text-xs text-slate-600">Active Instructors</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 p-3 bg-slate-50 rounded-lg">
                    <Clock className="h-5 w-5 text-purple-500" />
                    <div>
                      <p className="text-2xl font-bold">{location.averageCapacityUsage.toFixed(0)}%</p>
                      <p className="text-xs text-slate-600">Avg Capacity</p>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Peak Hours */}
                  <div className="border rounded-lg p-3">
                    <h4 className="font-semibold text-sm mb-3">Peak Hours</h4>
                    {location.peakHours.length === 0 ? (
                      <p className="text-sm text-slate-500">No data</p>
                    ) : (
                      <div className="space-y-2">
                        {location.peakHours.map((peak, idx) => (
                          <div key={idx} className="flex items-center justify-between text-sm">
                            <span className="text-slate-700">{formatHour(peak.hour)}</span>
                            <div className="flex items-center gap-2">
                              <div className="w-24 bg-slate-200 rounded-full h-2">
                                <div
                                  className="bg-blue-500 h-2 rounded-full"
                                  style={{ width: `${(peak.sessions / location.maxTrainers) * 100}%` }}
                                />
                              </div>
                              <span className="text-xs text-slate-600 w-12 text-right">
                                {peak.sessions}/{location.maxTrainers}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Peak Days */}
                  <div className="border rounded-lg p-3">
                    <h4 className="font-semibold text-sm mb-3">Busiest Days</h4>
                    {location.peakDays.length === 0 ? (
                      <p className="text-sm text-slate-500">No data</p>
                    ) : (
                      <div className="space-y-2">
                        {location.peakDays.map((peak, idx) => (
                          <div key={idx} className="flex items-center justify-between text-sm">
                            <span className="text-slate-700">{peak.day}</span>
                            <Badge variant="outline">{peak.sessions} sessions</Badge>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
