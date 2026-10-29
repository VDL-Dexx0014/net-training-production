// src/lib/export/session-export.ts
// Shared export logic: fetch session data, generate CSV / Excel / PDF

import { createClient } from '@/lib/supabase/client'

export interface ExportSession {
  date: string
  actualStart: string
  routine: string
  location: string | null
  trainer: string | null
  machines: { code: string; name: string; lbs: number | null; seconds: number | null; done: boolean | null }[]
}

export interface MachineHistory {
  machineId: string
  machineCode: string
  machineName: string
  points: { date: string; weight: number | null; seconds: number | null }[]
}

export interface ExportData {
  sessions: ExportSession[]
  machineHistoryByRoutine: { routineName: string; machines: MachineHistory[] }[]
  clientName: string
}

function fmtSeconds(s: number | null): string {
  if (s == null) return ''
  const m = Math.floor(s / 60)
  const sec = s % 60
  return m > 0 ? `${m}m ${sec}s` : `${sec}s`
}

export async function fetchExportData(clientId: string, clientName: string): Promise<ExportData> {
  const supabase = createClient()

  const [sessionsRes, programsRes] = await Promise.all([
    supabase
      .from('sessions')
      .select('id, actual_start, program_id, location_id, trainer_id')
      .eq('client_id', clientId)
      .eq('status', 'completed')
      .not('actual_start', 'is', null)
      .order('actual_start', { ascending: false })
      .limit(500),
    supabase
      .from('programs')
      .select('id, name, program_machines ( machine_id, order_index, machines ( id, machine_code, machine_name ) )')
      .eq('client_id', clientId)
      .eq('status', 'active')
      .order('name'),
  ])

  const sessionRows = (sessionsRes.data ?? []) as any[]
  const programRows = (programsRes.data ?? []) as any[]

  if (sessionRows.length === 0) return { sessions: [], machineHistoryByRoutine: [], clientName }

  // Build lookup maps
  const programMap = new Map<string, string>()
  programRows.forEach((p: any) => programMap.set(p.id, p.name))

  const uniqueLocIds = [...new Set(sessionRows.map((s: any) => s.location_id).filter(Boolean))]
  const uniqueTrainerIds = [...new Set(sessionRows.map((s: any) => s.trainer_id).filter(Boolean))]
  const extraProgramIds = [...new Set(sessionRows.map((s: any) => s.program_id).filter(Boolean))].filter(id => !programMap.has(id))

  const [locRes, trainerRes, extraProgramRes] = await Promise.all([
    uniqueLocIds.length > 0 ? supabase.from('locations').select('id, name').in('id', uniqueLocIds) : { data: [] },
    uniqueTrainerIds.length > 0 ? supabase.from('profiles').select('id, first_name, last_name').in('id', uniqueTrainerIds) : { data: [] },
    extraProgramIds.length > 0 ? supabase.from('programs').select('id, name').in('id', extraProgramIds) : { data: [] },
  ])

  const locMap = new Map<string, string>()
  ;(locRes.data ?? []).forEach((l: any) => locMap.set(l.id, l.name))

  const trainerMap = new Map<string, string>()
  ;(trainerRes.data ?? []).forEach((t: any) => trainerMap.set(t.id, [t.first_name, t.last_name].filter(Boolean).join(' ')))

  ;(extraProgramRes.data ?? []).forEach((p: any) => programMap.set(p.id, p.name))

  // Fetch machine sessions
  const sessionIds = sessionRows.map((s: any) => s.id)
  const { data: msData } = await supabase
    .from('machine_sessions')
    .select('session_id, machine_id, weight_lbs, total_time_seconds, measurement_type_id, measurement_types ( abbreviation, units ), machines ( id, machine_code, machine_name )')
    .in('session_id', sessionIds)

  const msRows = (msData ?? []) as any[]

  // Group machine_sessions by session_id
  const msBySession = new Map<string, any[]>()
  msRows.forEach(ms => {
    if (!msBySession.has(ms.session_id)) msBySession.set(ms.session_id, [])
    msBySession.get(ms.session_id)!.push(ms)
  })

  // Build flat session export rows
  const sessions: ExportSession[] = sessionRows.map((s: any) => {
    const mss = msBySession.get(s.id) ?? []
    return {
      date: new Date(s.actual_start).toLocaleDateString('en-CA'),
      actualStart: s.actual_start,
      routine: s.program_id ? (programMap.get(s.program_id) ?? '—') : '—',
      location: s.location_id ? (locMap.get(s.location_id) ?? null) : null,
      trainer: s.trainer_id ? (trainerMap.get(s.trainer_id) ?? null) : null,
      machines: mss.map(ms => {
        const units: string[] = ms.measurement_types?.units ?? []
        const isDone = units.includes('date')
        return {
          code: ms.machines?.machine_code ?? ms.machine_id,
          name: ms.machines?.machine_name ?? '',
          lbs: isDone ? null : ms.weight_lbs,
          seconds: isDone ? null : ms.total_time_seconds,
          done: isDone ? true : null,
        }
      }),
    }
  })

  // Build machine history grouped by routine
  const machineHistoryByRoutine: ExportData['machineHistoryByRoutine'] = programRows.map((p: any) => {
    const pMachines: any[] = (p.program_machines ?? []).sort((a: any, b: any) => (a.order_index ?? 0) - (b.order_index ?? 0))
    const machines: MachineHistory[] = pMachines.map((pm: any) => {
      const mid = pm.machine_id
      const points: MachineHistory['points'] = []
      sessionRows
        .filter((s: any) => s.program_id === p.id)
        .forEach((s: any) => {
          const mss = (msBySession.get(s.id) ?? []).filter(ms => ms.machine_id === mid)
          if (mss.length > 0) {
            points.push({
              date: new Date(s.actual_start).toLocaleDateString('en-CA'),
              weight: mss[0].weight_lbs,
              seconds: mss[0].total_time_seconds,
            })
          }
        })
      points.reverse() // ascending date
      return {
        machineId: mid,
        machineCode: pm.machines?.machine_code ?? mid,
        machineName: pm.machines?.machine_name ?? '',
        points,
      }
    }).filter(m => m.points.length > 0)
    return { routineName: p.name, machines }
  }).filter(r => r.machines.length > 0)

  return { sessions, machineHistoryByRoutine, clientName }
}

// ─── CSV ──────────────────────────────────────────────────────────────────────

export function generateCSV(data: ExportData): string {
  const rows: string[][] = []
  rows.push(['Date', 'Routine', 'Location', 'Trainer', 'Machine Code', 'Machine Name', 'Weight (lbs)', 'Time', 'Done'])

  for (const s of data.sessions) {
    if (s.machines.length === 0) {
      rows.push([s.date, s.routine, s.location ?? '', s.trainer ?? '', '', '', '', '', ''])
    } else {
      for (const m of s.machines) {
        rows.push([
          s.date, s.routine, s.location ?? '', s.trainer ?? '',
          m.code, m.name,
          m.lbs != null ? String(m.lbs) : '',
          m.seconds != null ? String(m.seconds) : '',
          m.done ? 'yes' : '',
        ])
      }
    }
  }

  return rows.map(r => r.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n')
}

export function downloadCSV(data: ExportData, filename = 'net-training-sessions.csv') {
  const csv = generateCSV(data)
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  triggerDownload(blob, filename)
}

// ─── Pivot helpers ────────────────────────────────────────────────────────────
// Build a UI-matching pivot: rows = sessions, columns = machines with lbs/sec/done sub-cols

interface PivotCol {
  code: string
  name: string
  hasLbs: boolean
  hasSec: boolean
  hasDone: boolean
}

function buildPivotCols(sessions: ExportSession[]): PivotCol[] {
  const map = new Map<string, PivotCol>()
  for (const s of sessions) {
    for (const m of s.machines) {
      if (!map.has(m.code)) map.set(m.code, { code: m.code, name: m.name, hasLbs: false, hasSec: false, hasDone: false })
      const col = map.get(m.code)!
      if (m.lbs != null) col.hasLbs = true
      if (m.seconds != null) col.hasSec = true
      if (m.done) col.hasDone = true
    }
  }
  return Array.from(map.values()).sort((a, b) => a.code.localeCompare(b.code))
}

function buildPivotRow(session: ExportSession, cols: PivotCol[]): (string | number)[] {
  const byCode = new Map(session.machines.map(m => [m.code, m]))
  const row: (string | number)[] = [
    session.date,
    session.routine,
    session.location ?? '',
    session.trainer ?? '',
  ]
  for (const col of cols) {
    const m = byCode.get(col.code)
    if (col.hasLbs) row.push(m?.lbs != null ? m.lbs : '')
    if (col.hasSec) row.push(m?.seconds != null ? m.seconds : '')
    if (col.hasDone) row.push(m?.done ? '✓' : '')
  }
  return row
}

// ─── Excel ────────────────────────────────────────────────────────────────────

export async function downloadExcel(data: ExportData, filename = 'net-training-sessions.xlsx') {
  const XLSX = await import('xlsx')

  const cols = buildPivotCols(data.sessions)

  // Header row 1: Date, Routine, Location, Trainer, then machine codes spanning sub-cols
  const header1: string[] = ['Date', 'Routine', 'Location', 'Trainer']
  // Header row 2: sub-column labels
  const header2: string[] = ['', '', '', '']

  for (const col of cols) {
    const subs: string[] = []
    if (col.hasLbs) subs.push('lbs')
    if (col.hasSec) subs.push('sec')
    if (col.hasDone) subs.push('✓')
    // First sub gets the machine code, rest get empty (for merge simulation)
    subs.forEach((sub, i) => {
      header1.push(i === 0 ? col.code : '')
      header2.push(sub)
    })
  }

  const wsData: any[][] = [header1, header2]
  for (const s of data.sessions) wsData.push(buildPivotRow(s, cols))

  const wb = XLSX.utils.book_new()
  const ws = XLSX.utils.aoa_to_sheet(wsData)

  // Column widths: fixed cols + 10px per sub-col
  const colWidths = [{ wch: 12 }, { wch: 10 }, { wch: 18 }, { wch: 18 }]
  for (const col of cols) {
    const n = (col.hasLbs ? 1 : 0) + (col.hasSec ? 1 : 0) + (col.hasDone ? 1 : 0)
    for (let i = 0; i < n; i++) colWidths.push({ wch: 8 })
  }
  ws['!cols'] = colWidths

  XLSX.utils.book_append_sheet(wb, ws, 'Sessions')
  XLSX.writeFile(wb, filename)
}

// ─── PDF: data table ──────────────────────────────────────────────────────────

export async function downloadPDFTable(data: ExportData, filename = 'net-training-sessions.pdf') {
  const { default: jsPDF } = await import('jspdf')
  const { default: autoTable } = await import('jspdf-autotable')

  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })
  await addLogoHeader(doc, data.clientName, 'Session History')

  const cols = buildPivotCols(data.sessions)

  // Two header rows mirroring the UI: machine codes on row 1, sub-labels on row 2
  const fixedHeaders = ['Date', 'R', 'Location', 'Instr.']
  const subHeaders = ['', '', '', '']
  const colStyles: Record<number, any> = {
    0: { cellWidth: 22 },
    1: { cellWidth: 8 },
    2: { cellWidth: 28 },
    3: { cellWidth: 20 },
  }
  let colIdx = 4
  for (const col of cols) {
    const subs: string[] = []
    if (col.hasLbs) subs.push('lbs')
    if (col.hasSec) subs.push('sec')
    if (col.hasDone) subs.push('✓')
    subs.forEach((sub, i) => {
      fixedHeaders.push(i === 0 ? col.code : '')
      subHeaders.push(sub)
      colStyles[colIdx] = { cellWidth: 14, halign: 'center' }
      colIdx++
    })
  }

  const tableRows = data.sessions.map(s => buildPivotRow(s, cols).map(String))

  autoTable(doc, {
    startY: 38,
    head: [fixedHeaders, subHeaders],
    body: tableRows,
    styles: { fontSize: 7, cellPadding: 1.5 },
    headStyles: { fillColor: [30, 41, 59], textColor: 255, fontStyle: 'bold', fontSize: 7 },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    columnStyles: colStyles,
  })

  doc.save(filename)
}

// ─── PDF: full report with charts ─────────────────────────────────────────────

export async function downloadPDFFull(data: ExportData, filename = 'net-training-full-report.pdf') {
  const { default: jsPDF } = await import('jspdf')
  const { default: autoTable } = await import('jspdf-autotable')

  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })
  const pageW = 297
  const pageH = 210
  const marginL = 14
  const marginR = 14
  const contentW = pageW - marginL - marginR

  await addLogoHeader(doc, data.clientName, 'Training Progress Report')
  let y = 42

  for (let ri = 0; ri < data.machineHistoryByRoutine.length; ri++) {
    const routine = data.machineHistoryByRoutine[ri]

    if (ri > 0) {
      doc.addPage()
      await addLogoHeader(doc, data.clientName, 'Training Progress Report')
      y = 42
    }

    // Routine heading
    doc.setFontSize(13)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(30, 41, 59)
    doc.text(`Routine ${routine.routineName}`, marginL, y)
    y += 8

    for (const machine of routine.machines) {
      if (machine.points.length < 2) continue

      const chartH = 48
      const chartW = contentW

      if (y + chartH + 18 > pageH - 14) {
        doc.addPage()
        await addLogoHeader(doc, data.clientName, 'Training Progress Report')
        y = 42
      }

      // Machine label
      doc.setFontSize(9)
      doc.setFont('helvetica', 'bold')
      doc.setTextColor(71, 85, 105)
      doc.text(`${machine.machineCode}  ${machine.machineName}`, marginL, y)
      y += 5

      drawLineChart(doc, machine.points, marginL, y, chartW, chartH)
      y += chartH + 6
    }

    // Summary table for this routine
    const routineSessions = data.sessions.filter(s => s.routine === routine.routineName)
    if (routineSessions.length > 0) {
      if (y + 20 > pageH - 14) {
        doc.addPage()
        await addLogoHeader(doc, data.clientName, 'Training Progress Report')
        y = 42
      }

      doc.setFontSize(9)
      doc.setFont('helvetica', 'bold')
      doc.setTextColor(30, 41, 59)
      doc.text('Session Data', marginL, y)
      y += 4

      const machineCodes = [...new Set(routineSessions.flatMap(s => s.machines.map(m => m.code)))].sort()
      const head = ['Date', 'Trainer', ...machineCodes.map(c => c)]

      const tableRows = routineSessions.map(s => {
        const byCode = new Map(s.machines.map(m => [m.code, m]))
        return [
          s.date,
          s.trainer ?? '',
          ...machineCodes.map(c => {
            const m = byCode.get(c)
            if (!m) return ''
            if (m.done) return '✓'
            const parts = []
            if (m.lbs != null) parts.push(`${m.lbs}`)
            if (m.seconds != null) parts.push(String(m.seconds))
            return parts.join(' / ')
          }),
        ]
      })

      autoTable(doc, {
        startY: y,
        head: [head],
        body: tableRows,
        styles: { fontSize: 7, cellPadding: 1.5 },
        headStyles: { fillColor: [30, 41, 59], textColor: 255, fontStyle: 'bold' },
        alternateRowStyles: { fillColor: [248, 250, 252] },
        margin: { left: marginL, right: marginR },
      })

      y = (doc as any).lastAutoTable.finalY + 8
    }
  }

  doc.save(filename)
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function addLogoHeader(doc: any, clientName: string, title: string) {
  return new Promise<void>((resolve) => {
    const img = new window.Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      // Logo: 887×264 — scale to 32mm wide
      const logoW = 32
      const logoH = (264 / 887) * logoW
      doc.addImage(img, 'PNG', 14, 6, logoW, logoH)

      doc.setFontSize(14)
      doc.setFont('helvetica', 'bold')
      doc.setTextColor(30, 41, 59)
      doc.text(title, 14 + logoW + 6, 12)

      doc.setFontSize(9)
      doc.setFont('helvetica', 'normal')
      doc.setTextColor(100, 116, 139)
      doc.text(clientName, 14 + logoW + 6, 18)

      doc.setFontSize(8)
      doc.text(new Date().toLocaleDateString('en-CA'), 14 + logoW + 6, 23)

      // Divider
      doc.setDrawColor(226, 232, 240)
      doc.setLineWidth(0.4)
      doc.line(14, 30, 283, 30)

      resolve()
    }
    img.onerror = () => {
      // Logo failed — still render header text
      doc.setFontSize(14)
      doc.setFont('helvetica', 'bold')
      doc.setTextColor(30, 41, 59)
      doc.text(title, 14, 14)
      doc.setFontSize(9)
      doc.setFont('helvetica', 'normal')
      doc.setTextColor(100, 116, 139)
      doc.text(clientName, 14, 20)
      doc.setDrawColor(226, 232, 240)
      doc.setLineWidth(0.4)
      doc.line(14, 28, 283, 28)
      resolve()
    }
    img.src = '/net_logo_new.png'
  })
}

function drawLineChart(
  doc: any,
  points: { date: string; weight: number | null; seconds: number | null }[],
  x: number, y: number, w: number, h: number
) {
  const padL = 12, padR = 8, padT = 4, padB = 14
  const plotX = x + padL
  const plotY = y + padT
  const plotW = w - padL - padR
  const plotH = h - padT - padB

  // Background
  doc.setFillColor(248, 250, 252)
  doc.rect(x, y, w, h, 'F')
  doc.setDrawColor(226, 232, 240)
  doc.setLineWidth(0.2)
  doc.rect(x, y, w, h, 'S')

  const n = points.length
  if (n < 2) return

  const weightVals = points.map(p => p.weight).filter((v): v is number => v != null)
  const timeVals = points.map(p => p.seconds).filter((v): v is number => v != null)

  const hasWeight = weightVals.length > 1
  const hasTime = timeVals.length > 1

  function scaleX(i: number) { return plotX + (i / (n - 1)) * plotW }

  function drawSeries(
    vals: (number | null)[],
    minV: number, maxV: number,
    color: [number, number, number]
  ) {
    const range = maxV - minV || 1
    const coords: [number, number][] = vals.map((v, i) => [
      scaleX(i),
      v != null ? plotY + plotH - ((v - minV) / range) * plotH : NaN,
    ])

    doc.setDrawColor(...color)
    doc.setLineWidth(0.5)

    let penDown = false
    for (let i = 0; i < coords.length; i++) {
      const [cx, cy] = coords[i]
      if (isNaN(cy)) { penDown = false; continue }
      if (!penDown) { doc.moveTo(cx, cy); penDown = true }
      else doc.lineTo(cx, cy)
    }
    doc.stroke()

    // Dots
    doc.setFillColor(...color)
    for (const [cx, cy] of coords) {
      if (!isNaN(cy)) doc.circle(cx, cy, 0.8, 'F')
    }
  }

  if (hasWeight) {
    const minW = Math.min(...weightVals) * 0.95
    const maxW = Math.max(...weightVals) * 1.05
    drawSeries(points.map(p => p.weight), minW, maxW, [59, 130, 246])

    // Y-axis label (left)
    doc.setFontSize(5.5)
    doc.setTextColor(100, 116, 139)
    doc.text(`${Math.round(Math.min(...weightVals))}`, x + 1, plotY + plotH, { align: 'left' })
    doc.text(`${Math.round(Math.max(...weightVals))}`, x + 1, plotY + 4, { align: 'left' })
  }

  if (hasTime) {
    const minT = Math.min(...timeVals) * 0.95
    const maxT = Math.max(...timeVals) * 1.05
    drawSeries(points.map(p => p.seconds), minT, maxT, [16, 185, 129])
  }

  // X-axis date labels — show first, middle, last
  doc.setFontSize(5.5)
  doc.setTextColor(100, 116, 139)
  const labelIdxs = [0, Math.floor((n - 1) / 2), n - 1]
  for (const i of labelIdxs) {
    doc.text(points[i].date, scaleX(i), y + h - 2, { align: 'center' })
  }

  // Legend
  doc.setFontSize(6)
  if (hasWeight) {
    doc.setFillColor(59, 130, 246)
    doc.circle(x + w - 28, y + 5, 1.2, 'F')
    doc.setTextColor(71, 85, 105)
    doc.text('Weight', x + w - 25, y + 6)
  }
  if (hasTime) {
    doc.setFillColor(16, 185, 129)
    doc.circle(x + w - 14, y + 5, 1.2, 'F')
    doc.setTextColor(71, 85, 105)
    doc.text('Time', x + w - 11, y + 6)
  }
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
