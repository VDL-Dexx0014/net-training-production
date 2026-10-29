// src/components/dashboard/admin/ReportsAdminSection.tsx
// Admin section for reports with date range filter

'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Calendar as CalendarComponent } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Calendar, X } from 'lucide-react'
import { DateRange } from 'react-day-picker'
import { format } from 'date-fns'
import { TrainerPerformanceReport } from '@/components/management/TrainerPerformanceReport'
import { GymUtilizationReport } from '@/components/management/GymUtilizationReport'
import { ClientEngagementReport } from '@/components/management/ClientEngagementReport'

export function ReportsAdminSection() {
  const [dateRange, setDateRange] = useState<{ start: Date; end: Date } | undefined>(undefined)
  const [calendarDate, setCalendarDate] = useState<DateRange | undefined>(undefined)

  useEffect(() => {
    // Default to current month
    const now = new Date()
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59)
    setDateRange({ start: startOfMonth, end: endOfMonth })
    setCalendarDate({ from: startOfMonth, to: endOfMonth })
  }, [])

  const handleDateRangeChange = (range: DateRange | undefined) => {
    setCalendarDate(range)
    if (range?.from && range?.to) {
      const start = new Date(range.from)
      start.setHours(0, 0, 0, 0)
      const end = new Date(range.to)
      end.setHours(23, 59, 59, 999)
      setDateRange({ start, end })
    } else if (range?.from) {
      const start = new Date(range.from)
      start.setHours(0, 0, 0, 0)
      const end = new Date(range.from)
      end.setHours(23, 59, 59, 999)
      setDateRange({ start, end })
    } else {
      setDateRange(undefined)
    }
  }

  const handlePresetPeriod = (period: 'month' | 'week') => {
    const now = new Date()
    if (period === 'month') {
      const start = new Date(now.getFullYear(), now.getMonth(), 1)
      const end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59)
      setDateRange({ start, end })
      setCalendarDate({ from: start, to: end })
    } else {
      const start = new Date(now)
      start.setDate(now.getDate() - now.getDay())
      start.setHours(0, 0, 0, 0)
      const end = new Date(start)
      end.setDate(start.getDate() + 6)
      end.setHours(23, 59, 59, 999)
      setDateRange({ start, end })
      setCalendarDate({ from: start, to: end })
    }
  }

  return (
    <div>
      {/* Date range controls */}
      <div className="flex items-center justify-between flex-wrap gap-3 mb-6">
        <div className="flex items-center gap-2">
          <Calendar className="h-5 w-5" />
          <h3 className="font-semibold text-lg">Reports</h3>
          {dateRange && (
            <Badge variant="outline" className="bg-blue-50 ml-2">
              {format(dateRange.start, 'MMM d, yyyy')} - {format(dateRange.end, 'MMM d, yyyy')}
            </Badge>
          )}
          {!dateRange && (
            <Badge variant="outline" className="bg-slate-50 ml-2">All Time</Badge>
          )}
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" size="sm" onClick={() => handlePresetPeriod('week')}>
            This Week
          </Button>
          <Button variant="outline" size="sm" onClick={() => handlePresetPeriod('month')}>
            This Month
          </Button>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm">
                <Calendar className="h-4 w-4 mr-2" />
                Custom Range
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="end">
              <CalendarComponent
                mode="range"
                selected={calendarDate}
                onSelect={handleDateRangeChange}
                numberOfMonths={2}
                initialFocus
              />
            </PopoverContent>
          </Popover>
          {dateRange && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => { setCalendarDate(undefined); setDateRange(undefined) }}
            >
              <X className="h-4 w-4 mr-1" />
              Clear
            </Button>
          )}
        </div>
      </div>

      {/* Reports */}
      <div className="space-y-6">
        <TrainerPerformanceReport dateRange={dateRange} />
        <GymUtilizationReport dateRange={dateRange} />
        <ClientEngagementReport dateRange={dateRange} />
      </div>
    </div>
  )
}
