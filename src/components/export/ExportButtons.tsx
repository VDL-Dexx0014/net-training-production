// src/components/export/ExportButtons.tsx
// Two export buttons for the client dashboard:
//   1. "Download data table" — CSV / Excel / PDF of the session history table
//   2. "Download full report" — PDF with per-routine machine charts + data tables

'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Download, FileText, ChevronDown, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import {
  fetchExportData,
  downloadCSV,
  downloadExcel,
  downloadPDFTable,
  downloadPDFFull,
} from '@/lib/export/session-export'

interface ExportButtonsProps {
  clientId: string
  clientName: string
}

export function ExportButtons({ clientId, clientName }: ExportButtonsProps) {
  const [loadingTable, setLoadingTable] = useState<string | null>(null)
  const [loadingFull, setLoadingFull] = useState(false)

  const handleTableExport = async (format: 'csv' | 'excel' | 'pdf') => {
    setLoadingTable(format)
    try {
      const data = await fetchExportData(clientId, clientName)
      if (data.sessions.length === 0) {
        toast.error('No session data to export')
        return
      }
      const date = new Date().toISOString().slice(0, 10)
      if (format === 'csv') downloadCSV(data, `net-sessions-${date}.csv`)
      else if (format === 'excel') await downloadExcel(data, `net-sessions-${date}.xlsx`)
      else await downloadPDFTable(data, `net-sessions-${date}.pdf`)
      toast.success('Download started')
    } catch (err) {
      console.error(err)
      toast.error('Export failed')
    } finally {
      setLoadingTable(null)
    }
  }

  const handleFullReport = async () => {
    setLoadingFull(true)
    try {
      const data = await fetchExportData(clientId, clientName)
      if (data.sessions.length === 0) {
        toast.error('No session data to export')
        return
      }
      const date = new Date().toISOString().slice(0, 10)
      await downloadPDFFull(data, `net-full-report-${date}.pdf`)
      toast.success('Download started')
    } catch (err) {
      console.error(err)
      toast.error('Export failed')
    } finally {
      setLoadingFull(false)
    }
  }

  return (
    <div className="flex gap-2">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" disabled={loadingTable !== null} className="gap-1.5 text-slate-600">
            {loadingTable ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            Download data table
            <ChevronDown className="h-3.5 w-3.5 ml-0.5 text-slate-400" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => handleTableExport('csv')}>
            CSV (.csv)
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => handleTableExport('excel')}>
            Excel (.xlsx)
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => handleTableExport('pdf')}>
            PDF (.pdf)
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Button
        variant="outline"
        size="sm"
        onClick={handleFullReport}
        disabled={loadingFull}
        className="gap-1.5 text-slate-600"
      >
        {loadingFull ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
        Download full report
      </Button>
    </div>
  )
}
