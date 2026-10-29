// src/app/trainer/session/[id]/page.tsx

'use client'

import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { useAuthStore } from '@/store/auth-store'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { toast } from 'sonner'
import { Database } from '@/types/database.types'
import Image from 'next/image'
import {
  Play, Pause, RotateCcw, Check, Edit3,
  Plus, Minus, ArrowLeft, CheckCircle2, X, SkipForward, SlidersHorizontal,
} from 'lucide-react'
import { formatDate } from '@/lib/utils/date-formatter'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  getMachineAttributesBatch,
  getUserMachineAttributeValuesBatch,
  saveUserMachineAttributeValues,
  attrValueKey,
  type MachineAttributeWithDefinition,
  type AttributeValuesMap,
} from '@/lib/queries/machine-attributes'
import { useIdleTimeout } from '@/components/providers/idle-timeout-provider'

type Session = Database['public']['Tables']['sessions']['Row']
type Program = Database['public']['Tables']['programs']['Row']
type ProgramMachine = Database['public']['Tables']['program_machines']['Row']
type Machine = Database['public']['Tables']['machines']['Row']
type MachineSession = Database['public']['Tables']['machine_sessions']['Row']
type MeasurementType = Database['public']['Tables']['measurement_types']['Row']

interface ProgramMachineWithMachine extends ProgramMachine {
  machine: Machine
  machineAttributes?: MachineAttributeWithDefinition[]
  last_weight?: number | null
  machine_sessions?: MachineSession[]
  status: 'not_started' | 'in_progress' | 'completed'
}

interface MachineHistoryEntry {
  id: string
  date: string
  weight_lbs: number | null
  total_time_seconds: number | null
  reps: number | null
  locationName: string | null
  trainerName: string | null
  measurementType: string | null
  routineName: string | null
}

interface SessionWithClient extends Session {
  client: { id: string; first_name: string; last_name: string; high_risk: boolean; intensity: string | null } | null
}

interface MachineSessionHistoryItem {
  id: string
  weight_lbs: number | null
  total_time_seconds: number | null
  reps: number | null
  start_time: string
  measurement_type_id: string | null
  session: { id: string; client_id: string; location_id: string | null; trainer_id: string | null; program_id: string | null; status: string | null } | null
}

interface CurrentMachineSessionData {
  id: string
  weight_lbs: number | null
  total_time_seconds: number | null
  reps: number | null
  start_time: string
  end_time: string | null
  measurement_type_id: string | null
}

interface LocationRecord { id: string; name: string }
interface TrainerRecord { id: string; first_name: string; last_name: string }
interface ProgramRecord { id: string; name: string }
type ProgramMachineResponse = ProgramMachine & { machine: Machine }
interface PrevMachineSession { machine_id: string; weight_lbs: number | null; start_time: string }

const COUNTDOWN_DURATION = 30

// ── MachineChip ────────────────────────────────────────────────────────────
// Extracted as React.memo so the chip list doesn't re-render on every
// stopwatch/countdown tick — only when this chip's own props change.
interface MachineChipProps {
  pm: ProgramMachineWithMachine
  isSelected: boolean
  isCompleted: boolean
  isSkipped: boolean
  showMachineSettings: boolean
  attributeValues: AttributeValuesMap
  onSelect: (pm: ProgramMachineWithMachine) => void
  onSkipDialog: (pm: ProgramMachineWithMachine) => void
  onUnskip: (machineId: string) => void
  onAttributeChange: (programMachineId: string, machineId: string, attrDefId: string, value: string) => void
}

const MachineChip = memo(function MachineChip({
  pm, isSelected, isCompleted, isSkipped, showMachineSettings,
  attributeValues, onSelect, onSkipDialog, onUnskip, onAttributeChange,
}: MachineChipProps) {
  const stateColor = isSkipped
    ? { outer: 'border-red-500', fill: 'bg-red-500', innerBorder: 'border-red-500' }
    : isCompleted
      ? { outer: 'border-green-500', fill: 'bg-green-500', innerBorder: 'border-green-500' }
      : isSelected
        ? { outer: 'border-blue-500', fill: 'bg-blue-500', innerBorder: 'border-blue-500' }
        : { outer: 'border-slate-300', fill: 'bg-white', innerBorder: 'border-slate-400' }

  const hasState = isSkipped || isCompleted || isSelected
  const outerPad = 'p-[3px]'
  const chipW = 'w-24'
  const borderW = hasState ? 'border-[3px]' : 'border-2'
  const attrs = pm.machineAttributes || []

  return (
    <div key={pm.id} className="flex-shrink-0 flex flex-col items-center">
      <div className="flex justify-center mb-2" onClick={e => e.stopPropagation()}>
        <button
          onClick={() => onSkipDialog(pm)}
          className="flex items-center justify-center w-9 h-9 rounded bg-red-100 text-red-500 hover:bg-red-200 hover:text-red-700 transition-colors"
          tabIndex={-1}
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div
        onClick={() => onSelect(pm)}
        className={`rounded-lg transition-all ${outerPad} ${chipW} cursor-pointer ${borderW} ${stateColor.outer} ${stateColor.fill}`}
      >
        <div className="rounded-md bg-white flex flex-col items-center py-2 px-1 min-h-[3rem] justify-center">
          <span className={`font-bold leading-none whitespace-nowrap text-center text-slate-900 text-lg px-2 py-4 ${borderW} ${stateColor.innerBorder} rounded-md w-full block`}>
            {pm.machine.machine_code}
          </span>

          {showMachineSettings && (
            <div className="mt-1.5 w-full">
              {attrs.length > 0 ? (
                <div onClick={e => e.stopPropagation()} className="space-y-1.5">
                  {attrs.map(attr => {
                    const key = attrValueKey(pm.id, attr.definition.id)
                    const val = attributeValues.get(key) || ''
                    const hasOptions = attr.definition.allowed_values.length > 0
                    return (
                      <div key={attr.definition.id}>
                        <p className="text-[11px] text-slate-500 leading-none mb-0.5 truncate">{attr.definition.attribute_name}</p>
                        {hasOptions ? (
                          <Select value={val || undefined} onValueChange={v => onAttributeChange(pm.id, pm.machine_id, attr.definition.id, v)} disabled={isSkipped}>
                            <SelectTrigger className="h-7 text-[13px] px-1.5 w-full">
                              <SelectValue placeholder="–" />
                            </SelectTrigger>
                            <SelectContent>
                              {attr.definition.allowed_values.map(opt => (
                                <SelectItem key={opt} value={opt} className="text-sm">{opt}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        ) : (
                          <Input
                            value={val}
                            onChange={e => onAttributeChange(pm.id, pm.machine_id, attr.definition.id, e.target.value)}
                            placeholder="–"
                            className="h-7 text-[13px] px-1.5 w-full"
                            disabled={isSkipped}
                          />
                        )}
                      </div>
                    )
                  })}
                </div>
              ) : (
                <div className="text-[9px] italic text-slate-400 text-center">No settings</div>
              )}
            </div>
          )}

          {isSkipped && (
            <div onClick={e => e.stopPropagation()} className="mt-1 pt-1 border-t border-red-200 w-full">
              <button
                onClick={() => onUnskip(pm.machine_id)}
                className="w-full flex items-center justify-center gap-0.5 text-[10px] font-bold text-red-600 hover:text-red-800 rounded px-1 py-0.5 transition-colors"
              >
                <SkipForward className="h-2.5 w-2.5" />Unskip
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
})

// ── WorkoutCard ────────────────────────────────────────────────────────────
// Extracted as React.memo so only this card re-renders on timer ticks,
// not the full page (chip list, history table, dialogs, etc.).
interface WorkoutCardProps {
  selectedMachine: ProgramMachineWithMachine
  measurementTypes: MeasurementType[]
  selectedMeasurementType: MeasurementType | null
  selectedTileOccurrenceIdx: number
  recentMeasurementTypes: MeasurementType[]
  tileWeights: Map<string, string>
  tileReps: Map<string, string>
  tileTimes: Map<string, string>
  completedMachineIds: Set<string>
  skippedMachineIds: Set<string>
  pendingTileKeys: Set<string>
  hasPendingTile: boolean
  editingMachineSessionId: string | null
  pendingDeleteId: string | null
  pendingRemoveTile: { mt: MeasurementType; occurrenceIdx: number; tileKey: string } | null
  stopwatchRunning: boolean
  stopwatchElapsedSeconds: number
  isManualMode: boolean
  manualTotalSeconds: string
  countdownRunning: boolean
  countdownRemaining: number
  countdownDone: boolean
  weight: string
  reps: string
  isSaving: boolean
  canComplete: boolean
  is30Type: boolean
  isDateType: boolean
  isCheckboxOnly: boolean
  needsTime: boolean
  needsWeight: boolean
  needsReps: boolean
  overlayTimerRef: React.MutableRefObject<ReturnType<typeof setTimeout> | null>
  handleSave: (override?: { mt?: MeasurementType; weightVal?: string; repsVal?: string; totalSecondsVal?: number }) => Promise<void>
  handleStartStopwatch: () => void
  handlePauseStopwatch: () => void
  handleResetStopwatch: () => void
  markTilePending: (tileKey: string) => void
  stopwatchBaseSecondsRef: React.MutableRefObject<number>
  stopwatchStartedAtRef: React.MutableRefObject<Date | null>
  setSelectedMeasurementType: (mt: MeasurementType | null) => void
  setSelectedTileOccurrenceIdx: (i: number) => void
  setEditingMachineSessionId: (id: string | null) => void
  setTileWeights: React.Dispatch<React.SetStateAction<Map<string, string>>>
  setTileReps: React.Dispatch<React.SetStateAction<Map<string, string>>>
  setTileTimes: React.Dispatch<React.SetStateAction<Map<string, string>>>
  setRecentMeasurementTypes: React.Dispatch<React.SetStateAction<MeasurementType[]>>
  setStopwatchBaseSeconds: (n: number) => void
  setStopwatchElapsedSeconds: (n: number) => void
  setStopwatchStartedAt: (d: Date | null) => void
  setStopwatchRunning: (b: boolean) => void
  setIsManualMode: React.Dispatch<React.SetStateAction<boolean>>
  setCountdownRunning: (b: boolean) => void
  setCountdownRemaining: (n: number) => void
  setCountdownDone: (b: boolean) => void
  setLbsPopupOpen: (b: boolean) => void
  setLbsPopupValue: (s: string) => void
  setRepsPopupOpen: (b: boolean) => void
  setRepsPopupValue: (s: string) => void
  setSecondsPopupOpen: (b: boolean) => void
  setSecondsPopupValue: (s: string) => void
  setDiscardDialogOpen: (b: boolean) => void
  setPendingDeleteId: (id: string | null) => void
  setPendingRemoveTile: (v: { mt: MeasurementType; occurrenceIdx: number; tileKey: string } | null) => void
  setCompletedMachineIds: React.Dispatch<React.SetStateAction<Set<string>>>
  setMachineFinishedOverlay: (b: boolean) => void
}

const WorkoutCard = memo(function WorkoutCard({
  selectedMachine, measurementTypes, selectedMeasurementType, selectedTileOccurrenceIdx,
  recentMeasurementTypes, tileWeights, tileReps, tileTimes,
  completedMachineIds, skippedMachineIds, pendingTileKeys, hasPendingTile,
  editingMachineSessionId, pendingDeleteId, pendingRemoveTile,
  stopwatchRunning, stopwatchElapsedSeconds, isManualMode, manualTotalSeconds,
  countdownRunning, countdownRemaining, countdownDone,
  weight, reps, isSaving, canComplete,
  is30Type, isDateType, isCheckboxOnly, needsTime, needsWeight, needsReps,
  overlayTimerRef,
  handleSave, handleStartStopwatch, handlePauseStopwatch, handleResetStopwatch, markTilePending,
  stopwatchBaseSecondsRef, stopwatchStartedAtRef,
  setSelectedMeasurementType, setSelectedTileOccurrenceIdx, setEditingMachineSessionId,
  setTileWeights, setTileReps, setTileTimes, setRecentMeasurementTypes,
  setStopwatchBaseSeconds, setStopwatchElapsedSeconds, setStopwatchStartedAt, setStopwatchRunning,
  setIsManualMode,
  setCountdownRunning, setCountdownRemaining, setCountdownDone,
  setLbsPopupOpen, setLbsPopupValue, setRepsPopupOpen, setRepsPopupValue,
  setSecondsPopupOpen, setSecondsPopupValue,
  setDiscardDialogOpen, setPendingDeleteId, setPendingRemoveTile,
  setCompletedMachineIds, setMachineFinishedOverlay,
}: WorkoutCardProps) {
  return (
    <Card>
      <CardContent className="p-3 space-y-2">

        {/* Measurement type tiles + active inputs */}
        <div className="flex flex-col gap-2 pt-1">

          <span className="text-xl font-bold text-slate-800 uppercase tracking-wide text-center w-full flex items-center justify-center">Measurements</span>

          {/* MT tiles from last session — always expanded, one line each */}
          {recentMeasurementTypes.length > 0 && (
            <div className="flex flex-col gap-1.5">
              {(() => {
                const mtOccurrenceCounts = new Map<string, number>()
                return recentMeasurementTypes.map((mt) => {
                  const occurrenceIdx = mtOccurrenceCounts.get(mt.id) ?? 0
                  mtOccurrenceCounts.set(mt.id, occurrenceIdx + 1)

                  const allSavedEntriesForMt = (selectedMachine.machine_sessions || []).filter(ms => ms.measurement_type_id === mt.id)
                  const ownSavedEntry = allSavedEntriesForMt[occurrenceIdx] ?? null
                  const isDone = ownSavedEntry !== null
                  const tileIs30 = mt.abbreviation === '30'
                  const tileIsDate = (mt.units?.includes('date') ?? false) && !tileIs30
                  const tileNeedsWeight = !tileIsDate && (mt.units?.includes('weight') ?? false)
                  const tileNeedsTime = !tileIsDate && !tileIs30 && (mt.units?.includes('time') ?? false)
                  const tileNeedsReps = !tileIsDate && !tileIs30 && (mt.units?.includes('reps') ?? false)
                  const tileKey = `${selectedMachine.machine_id}:${mt.id}:${occurrenceIdx}`
                  const tw = tileWeights.get(tileKey) ?? ''
                  const tr = tileReps.get(tileKey) ?? ''
                  const tt = tileTimes.get(tileKey) ?? ''
                  const isActiveTile = selectedMeasurementType?.id === mt.id && selectedTileOccurrenceIdx === occurrenceIdx

                  const handleTileSave = async () => {
                    setSelectedMeasurementType(mt)
                    setSelectedTileOccurrenceIdx(occurrenceIdx)
                    setEditingMachineSessionId(ownSavedEntry?.id ?? null)
                    const tileTimeStr = tileTimes.get(tileKey) ?? ''
                    const tileTotalSeconds = tileTimeStr ? parseInt(tileTimeStr) : undefined
                    await handleSave({
                      mt,
                      weightVal: tileWeights.get(tileKey) ?? '',
                      repsVal: tileReps.get(tileKey) ?? '',
                      totalSecondsVal: tileTotalSeconds,
                    })
                  }

                  const tileRepsValid = !!tr && parseInt(tr) > 0
                  const tileTimeValid = (!!tt && parseInt(tt) > 0)
                    || (isActiveTile && (stopwatchElapsedSeconds > 0 || parseInt(manualTotalSeconds || '0') > 0))
                  const tile30Ready = tileIs30 && isActiveTile && (countdownDone || !countdownRunning && countdownRemaining < COUNTDOWN_DURATION)
                  const tileCanComplete = tileIsDate || tile30Ready
                    || (
                      (!tileNeedsWeight || !!tw)
                      && (!tileNeedsReps || tileRepsValid)
                      && (!tileNeedsTime || tileTimeValid)
                      && (tileNeedsWeight || tileNeedsReps || tileNeedsTime)
                    )

                  return (
                    <div key={`${mt.id}-${occurrenceIdx}`} className="flex items-center gap-1.5">

                      <button
                        onClick={() => {
                          if (stopwatchRunning || countdownRunning) { toast.error('Pause the timer first'); return }
                          if (hasPendingTile && !pendingTileKeys.has(tileKey)) { toast.error('Finish the current measurement before continuing'); return }
                          if (ownSavedEntry) {
                            setPendingDeleteId(ownSavedEntry.id)
                          } else {
                            setPendingRemoveTile({ mt, occurrenceIdx, tileKey })
                          }
                        }}
                        className="shrink-0 flex items-center justify-center w-7 h-7 rounded bg-red-100 text-red-500 hover:bg-red-200 hover:text-red-700 transition-colors"
                        aria-label="Remove MT"
                      >
                        <X className="h-4 w-4" />
                      </button>

                      <div className={`flex-1 rounded-md bg-slate-100 px-3 py-2 flex items-center gap-4 overflow-x-auto border-[3px] border-solid ${isDone ? 'border-green-500' : pendingTileKeys.has(tileKey) ? 'border-red-500' : 'border-black'}`}>

                        <span className="text-base font-bold text-slate-800 shrink-0 w-20 text-left whitespace-nowrap">{mt.abbreviation}</span>

                        {tileNeedsWeight && (
                          <div className="flex flex-col items-center shrink-0">
                            <span className="text-[10px] text-slate-500 leading-none mb-0.5 text-center">lbs</span>
                            <button
                              disabled={isDone}
                              onClick={() => {
                                if (!isActiveTile && (stopwatchRunning || countdownRunning)) { toast.error('Pause the timer first'); return }
                                setSelectedMeasurementType(mt)
                                setSelectedTileOccurrenceIdx(occurrenceIdx)
                                setLbsPopupValue(tw)
                                setLbsPopupOpen(true)
                              }}
                              className="text-lg font-bold h-8 w-20 text-center rounded border border-slate-400 bg-white hover:border-blue-400 transition-colors tabular-nums disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              {tw || <span className="text-slate-300">0</span>}
                            </button>
                          </div>
                        )}

                        {tileNeedsTime && (
                          <div className="flex flex-col items-center shrink-0">
                            <div className="flex items-center gap-1">
                              <div className="flex flex-col items-center">
                                <span className="text-[10px] text-slate-300 leading-none mb-0.5 select-none">_</span>
                                {!isActiveTile
                                  ? <Button disabled={stopwatchRunning || isDone} onClick={() => {
                                      if (tileNeedsWeight && !tw) { toast.error('Enter weight before starting the timer'); return }
                                      const base = tt ? parseInt(tt) : 0
                                      setSelectedMeasurementType(mt)
                                      setSelectedTileOccurrenceIdx(occurrenceIdx)
                                      setIsManualMode(false)
                                      stopwatchBaseSecondsRef.current = base
                                      setStopwatchBaseSeconds(base)
                                      setStopwatchElapsedSeconds(base)
                                      const now = new Date()
                                      stopwatchStartedAtRef.current = now
                                      setStopwatchStartedAt(now)
                                      setStopwatchRunning(true)
                                      markTilePending(tileKey)
                                    }} size="sm" className="font-bold px-2 h-8"><Play className="h-3.5 w-3.5" /></Button>
                                  : !stopwatchRunning
                                    ? <Button onClick={handleStartStopwatch} size="sm" className="font-bold px-2 h-8"><Play className="h-3.5 w-3.5" /></Button>
                                    : <Button onClick={handlePauseStopwatch} size="sm" variant="outline" className="h-8 px-2"><Pause className="h-3.5 w-3.5" /></Button>
                                }
                              </div>
                              <div className="flex flex-col items-center">
                                <span className="text-[10px] text-slate-500 leading-none mb-0.5 w-16 text-center block">sec</span>
                                <button
                                  onClick={() => {
                                    if (stopwatchRunning) return
                                    setSelectedMeasurementType(mt)
                                    setSelectedTileOccurrenceIdx(occurrenceIdx)
                                    const cur = tt || (isActiveTile && stopwatchElapsedSeconds > 0 ? stopwatchElapsedSeconds.toString() : '')
                                    setSecondsPopupValue(cur)
                                    setSecondsPopupOpen(true)
                                  }}
                                  className="text-base font-bold h-8 w-16 text-center rounded border border-slate-400 bg-white hover:border-blue-400 transition-colors tabular-nums"
                                >
                                  {tt || (isActiveTile ? stopwatchElapsedSeconds : <span className="text-slate-300">—</span>)}
                                </button>
                              </div>
                              <div className="flex flex-col items-center">
                                <span className="text-[10px] text-slate-300 leading-none mb-0.5 select-none">_</span>
                                <Button
                                  onClick={() => {
                                    if (isActiveTile) handleResetStopwatch()
                                    setTileTimes(prev => { const next = new Map(prev); next.delete(tileKey); return next })
                                  }}
                                  size="sm" variant="outline" className="h-8 px-2"
                                ><RotateCcw className="h-3.5 w-3.5" /></Button>
                              </div>
                            </div>
                          </div>
                        )}

                        {tileNeedsReps && (
                          <div className="flex flex-col items-center shrink-0">
                            <span className="text-[10px] text-slate-500 leading-none mb-0.5 text-center">reps</span>
                            <button
                              disabled={isDone}
                              onClick={() => {
                                if (!isActiveTile && (stopwatchRunning || countdownRunning)) { toast.error('Pause the timer first'); return }
                                setSelectedMeasurementType(mt)
                                setSelectedTileOccurrenceIdx(occurrenceIdx)
                                setRepsPopupValue(tr)
                                setRepsPopupOpen(true)
                              }}
                              className="text-lg font-bold h-8 w-20 text-center rounded border border-slate-400 bg-white hover:border-blue-400 transition-colors tabular-nums disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              {tr || <span className="text-slate-300">0</span>}
                            </button>
                          </div>
                        )}

                        {tileIsDate && (
                          <div className="flex flex-col items-center shrink-0">
                            <span className="text-[10px] text-slate-500 leading-none mb-0.5 text-center">Done</span>
                            <div className="h-8 w-12 flex items-center justify-center">
                              <input type="checkbox" checked readOnly className="h-5 w-5 accent-green-600 cursor-default rounded" />
                            </div>
                          </div>
                        )}

                        {tileIs30 && (() => {
                          const pct = (isActiveTile ? countdownRemaining : COUNTDOWN_DURATION) / COUNTDOWN_DURATION
                          const r = 20; const circ = 2 * Math.PI * r; const dash = circ * pct
                          return (
                            <div className="flex items-center gap-1.5 shrink-0">
                              <div className="relative w-9 h-9 flex-shrink-0">
                                <svg className="w-full h-full -rotate-90" viewBox="0 0 48 48">
                                  <circle cx="24" cy="24" r={r} fill="none" stroke="#e2e8f0" strokeWidth="4" />
                                  <circle cx="24" cy="24" r={r} fill="none"
                                    stroke={isActiveTile && countdownDone ? '#16a34a' : isActiveTile && countdownRunning ? '#2563eb' : '#94a3b8'}
                                    strokeWidth="4" strokeDasharray={`${dash} ${circ}`} strokeLinecap="round"
                                    style={{ transition: 'stroke-dasharray 0.9s linear, stroke 0.3s' }}
                                  />
                                </svg>
                                <span className="absolute inset-0 flex items-center justify-center text-xs font-bold tabular-nums text-slate-800">
                                  {isActiveTile && countdownDone ? <Check className="h-3.5 w-3.5 text-green-600" /> : isActiveTile ? countdownRemaining : COUNTDOWN_DURATION}
                                </span>
                              </div>
                              {isActiveTile && !countdownDone ? (
                                <>
                                  {!countdownRunning
                                    ? <Button size="sm" onClick={() => {
                                        if (tileNeedsWeight && !tw) { toast.error('Enter weight before starting the countdown'); return }
                                        setCountdownRunning(true)
                                        markTilePending(tileKey)
                                      }} className="h-8 px-2"><Play className="h-3.5 w-3.5" /></Button>
                                    : <Button size="sm" variant="outline" onClick={() => setCountdownRunning(false)} className="h-8 px-2"><Pause className="h-3.5 w-3.5" /></Button>
                                  }
                                  <Button size="sm" variant="outline" onClick={() => { setCountdownRunning(false); setCountdownRemaining(COUNTDOWN_DURATION); setCountdownDone(false) }} className="h-8 px-2"><RotateCcw className="h-3.5 w-3.5" /></Button>
                                </>
                              ) : isActiveTile && countdownDone ? (
                                <span className="text-sm font-semibold text-green-700">Done!</span>
                              ) : (
                                <Button size="sm" onClick={() => {
                                  if (tileNeedsWeight && !tw) { toast.error('Enter weight before starting the countdown'); return }
                                  setSelectedMeasurementType(mt)
                                  setSelectedTileOccurrenceIdx(occurrenceIdx)
                                  setCountdownRunning(true)
                                  markTilePending(tileKey)
                                }} className="h-8 px-2"><Play className="h-3.5 w-3.5" /></Button>
                              )}
                            </div>
                          )
                        })()}

                        <Button
                          size="sm"
                          onClick={handleTileSave}
                          disabled={isSaving || stopwatchRunning || (!tileCanComplete && !isDone)}
                          className={`font-bold px-4 h-8 text-white ml-auto shrink-0 ${(tileCanComplete || isDone) && !stopwatchRunning ? 'bg-green-600 hover:bg-green-700' : 'bg-slate-300 hover:bg-slate-300 cursor-not-allowed'}`}
                        >
                          <Check className="h-3.5 w-3.5 mr-1" />{isSaving && isActiveTile ? 'Saving...' : 'Finish'}
                        </Button>
                      </div>
                    </div>
                  )
                })
              })()}
            </div>
          )}

          {/* Fallback inputs when no tiles (no last-session history) or MT selected via Add Measurement dropdown */}
          {!recentMeasurementTypes.length && selectedMeasurementType && (
            <div className="flex items-end gap-3 flex-nowrap overflow-x-auto">
              <div className="flex items-center gap-1 h-8 px-2 rounded border border-indigo-200 bg-indigo-50">
                <span className="font-bold text-indigo-700 text-sm">{selectedMeasurementType.abbreviation}</span>
                <button onClick={() => setSelectedMeasurementType(null)} className="text-slate-400 hover:text-indigo-600 ml-0.5">
                  <Edit3 className="h-3 w-3" />
                </button>
              </div>
              {needsWeight && (
                <div className="flex flex-col items-center">
                  <span className="text-[10px] text-slate-500 leading-none mb-0.5 text-center w-20 block">lbs</span>
                  <button onClick={() => { setLbsPopupValue(weight); setLbsPopupOpen(true) }} className="text-lg font-bold h-8 w-20 text-center rounded border border-slate-400 bg-white hover:border-blue-400 transition-colors tabular-nums">
                    {weight || <span className="text-slate-300">0</span>}
                  </button>
                </div>
              )}
              {needsTime && (
                <div className="flex flex-col items-center">
                  <span className="text-[10px] text-slate-500 leading-none mb-0.5 text-center w-20 block">sec</span>
                  <div className="flex items-center gap-1">
                    {!stopwatchRunning
                      ? <Button onClick={handleStartStopwatch} size="sm" className="font-bold px-2 h-8"><Play className="h-3.5 w-3.5" /></Button>
                      : <Button onClick={handlePauseStopwatch} size="sm" variant="outline" className="h-8 px-2"><Pause className="h-3.5 w-3.5" /></Button>
                    }
                    <button onClick={() => { if (stopwatchRunning) return; setSecondsPopupValue(stopwatchElapsedSeconds > 0 ? stopwatchElapsedSeconds.toString() : ''); setSecondsPopupOpen(true) }} className="text-base font-bold h-8 w-16 text-center rounded border border-slate-400 bg-white hover:border-blue-400 transition-colors tabular-nums">{stopwatchElapsedSeconds}</button>
                    <Button onClick={handleResetStopwatch} size="sm" variant="outline" className="h-8 px-2"><RotateCcw className="h-3.5 w-3.5" /></Button>
                  </div>
                </div>
              )}
              {needsReps && !isDateType && (
                <div className="flex flex-col items-center">
                  <span className="text-[10px] text-slate-500 leading-none mb-0.5 text-center w-20 block">reps</span>
                  <button onClick={() => { setRepsPopupValue(reps); setRepsPopupOpen(true) }} className="text-lg font-bold h-8 w-20 text-center rounded border border-slate-400 bg-white hover:border-blue-400 transition-colors tabular-nums">{reps || <span className="text-slate-300">0</span>}</button>
                </div>
              )}
              {isCheckboxOnly && (
                <div className="flex flex-col items-center">
                  <span className="text-[10px] text-slate-500 leading-none mb-0.5 text-center w-20 block">Done</span>
                  <div className="h-8 w-20 flex items-center justify-center"><input type="checkbox" checked readOnly className="h-5 w-5 accent-green-600 cursor-default rounded" /></div>
                </div>
              )}
              {is30Type && (() => {
                const pct = countdownRemaining / COUNTDOWN_DURATION; const r = 20; const circ = 2 * Math.PI * r; const dash = circ * pct
                return (
                  <div className="flex flex-col items-center">
                    <span className="text-[10px] text-slate-500 leading-none mb-0.5 text-center w-20 block">30s</span>
                    <div className="flex items-center gap-1.5">
                      <div className="relative w-9 h-9 flex-shrink-0">
                        <svg className="w-full h-full -rotate-90" viewBox="0 0 48 48">
                          <circle cx="24" cy="24" r={r} fill="none" stroke="#e2e8f0" strokeWidth="4" />
                          <circle cx="24" cy="24" r={r} fill="none" stroke={countdownDone ? '#16a34a' : countdownRunning ? '#2563eb' : '#94a3b8'} strokeWidth="4" strokeDasharray={`${dash} ${circ}`} strokeLinecap="round" style={{ transition: 'stroke-dasharray 0.9s linear, stroke 0.3s' }} />
                        </svg>
                        <span className="absolute inset-0 flex items-center justify-center text-xs font-bold tabular-nums text-slate-800">{countdownDone ? <Check className="h-3.5 w-3.5 text-green-600" /> : countdownRemaining}</span>
                      </div>
                      {!countdownDone ? (<>{!countdownRunning ? <Button size="sm" onClick={() => { if (needsWeight && !weight) { toast.error('Enter weight before starting the countdown'); return } setCountdownRunning(true) }} className="h-8 px-2"><Play className="h-3.5 w-3.5" /></Button> : <Button size="sm" variant="outline" onClick={() => setCountdownRunning(false)} className="h-8 px-2"><Pause className="h-3.5 w-3.5" /></Button>}<Button size="sm" variant="outline" onClick={() => { setCountdownRunning(false); setCountdownRemaining(COUNTDOWN_DURATION); setCountdownDone(false) }} className="h-8 px-2"><RotateCcw className="h-3.5 w-3.5" /></Button></>) : <span className="text-sm font-semibold text-green-700">Done!</span>}
                    </div>
                  </div>
                )
              })()}
              <div className="flex flex-col items-center ml-auto">
                <span className="text-[10px] text-transparent leading-none mb-0.5 select-none">_</span>
                <Button size="sm" onClick={() => handleSave()} disabled={isSaving || (!editingMachineSessionId && !canComplete)} className="font-bold px-4 h-8 bg-green-600 hover:bg-green-700 text-white">
                  <Check className="h-3.5 w-3.5 mr-1" />{isSaving ? 'Saving...' : 'Finish'}
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Bottom action row — Add Measurement · Clear · Finish Machine */}
        <div className="mt-4 flex gap-3">
          <Select
            value=""
            onValueChange={val => {
              if (stopwatchRunning || countdownRunning) { toast.error('Pause the timer before adding a measurement'); return }
              if (hasPendingTile) { toast.error('Finish the current measurement before adding another'); return }
              const mt = measurementTypes.find(t => t.id === val)
              if (!mt) return
              setSelectedMeasurementType(mt)
              setRecentMeasurementTypes(prev => {
                const newOccurrenceIdx = prev.filter(m => m.id === mt.id).length
                const newTileKey = `${selectedMachine.machine_id}:${mt.id}:${newOccurrenceIdx}`
                setSelectedTileOccurrenceIdx(newOccurrenceIdx)
                setTileWeights(pw => new Map(pw).set(newTileKey, ''))
                return [...prev, mt]
              })
              if (mt.abbreviation === '30') {
                setCountdownRunning(false)
                setCountdownRemaining(COUNTDOWN_DURATION)
                setCountdownDone(false)
              }
            }}
          >
            <SelectTrigger style={{ height: '56px' }} className="flex-1 border-blue-600 bg-blue-600 font-semibold text-sm !text-white hover:bg-blue-700 hover:border-blue-700 [&>svg]:hidden [&_span]:!text-white">
              <div className="flex items-center justify-center w-full">
                <span className="text-center leading-snug whitespace-pre-line">{'Add\nMeasurement'}</span>
              </div>
            </SelectTrigger>
            <SelectContent>
              {measurementTypes.map(t => (
                <SelectItem key={t.id} value={t.id}>
                  <span className="font-semibold">{t.abbreviation}</span>
                  <span className="ml-1.5 text-slate-500 text-xs">{t.name}</span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <button
            onClick={() => { if (stopwatchRunning || countdownRunning) { toast.error('Pause the timer first'); return } if (hasPendingTile) { toast.error('Finish the current measurement before continuing'); return } setDiscardDialogOpen(true) }}
            className="flex-1 h-14 flex items-center justify-center rounded-md border border-red-600 bg-red-600 text-white text-sm font-semibold hover:bg-red-700 hover:border-red-700 transition-colors px-2"
          >
            <span className="text-center leading-snug whitespace-pre-line">{`Clear ${selectedMachine.machine.machine_code}\nMeasurements`}</span>
          </button>

          {(() => {
            const alreadyDone = completedMachineIds.has(selectedMachine.machine_id)
            const isSkipped = skippedMachineIds.has(selectedMachine.machine_id)
            const savedSessions = selectedMachine.machine_sessions || []
            const allTilesGreen = recentMeasurementTypes.length > 0 && (() => {
              const savedCountByMt = new Map<string, number>()
              for (const ms of savedSessions) {
                if (ms.measurement_type_id) savedCountByMt.set(ms.measurement_type_id, (savedCountByMt.get(ms.measurement_type_id) ?? 0) + 1)
              }
              const neededCountByMt = new Map<string, number>()
              for (const mt of recentMeasurementTypes) {
                neededCountByMt.set(mt.id, (neededCountByMt.get(mt.id) ?? 0) + 1)
              }
              for (const [mtId, needed] of neededCountByMt) {
                if ((savedCountByMt.get(mtId) ?? 0) < needed) return false
              }
              return true
            })()
            const canFinish = !alreadyDone && !stopwatchRunning && !hasPendingTile && (allTilesGreen || isSkipped)
            return (
              <button
                onClick={() => {
                  if (!canFinish) {
                    if (stopwatchRunning) toast.error('Pause the timer before finishing the machine')
                    else if (hasPendingTile) toast.error('Finish the current measurement before finishing the machine')
                    else if (!allTilesGreen && !isSkipped) toast.error('All measurements must be finished before completing the machine')
                    return
                  }
                  setCompletedMachineIds(prev => new Set([...prev, selectedMachine.machine_id]))
                  setMachineFinishedOverlay(true)
                  overlayTimerRef.current = setTimeout(() => setMachineFinishedOverlay(false), 1800)
                }}
                disabled={alreadyDone}
                className={`flex-1 h-14 flex items-center justify-center rounded-md border text-sm font-semibold transition-colors px-2 ${
                  alreadyDone
                    ? 'border-green-500 bg-green-600 text-white opacity-50 cursor-not-allowed'
                    : canFinish
                    ? 'border-green-500 bg-green-600 text-white hover:bg-green-700'
                    : 'border-slate-300 bg-slate-100 text-slate-400 cursor-not-allowed'
                }`}
              >
                <span className="text-center leading-snug whitespace-pre-line">{'Finish\nMachine'}</span>
              </button>
            )
          })()}
        </div>
      </CardContent>
    </Card>
  )
})

export default function SessionPage() {
  const router = useRouter()
  const params = useParams()
  const { user, profile, loading } = useAuthStore()
  const sessionId = params.id as string
  const { suppressIdle } = useIdleTimeout()
  const supabase = useMemo(() => createClient(), [])

  // Session / program
  const [session, setSession] = useState<SessionWithClient | null>(null)
  const [program, setProgram] = useState<Program | null>(null)
  const [programMachines, setProgramMachines] = useState<ProgramMachineWithMachine[]>([])
  const [selectedMachine, setSelectedMachine] = useState<ProgramMachineWithMachine | null>(null)
  const [attributeValues, setAttributeValues] = useState<AttributeValuesMap>(new Map())

  const [sessionStarted, setSessionStarted] = useState(false)

  // Measurement types (loaded once)
  const [measurementTypes, setMeasurementTypes] = useState<MeasurementType[]>([])
  const [selectedMeasurementType, setSelectedMeasurementType] = useState<MeasurementType | null>(null)

  // Workout inputs
  const [weight, setWeight] = useState<string>('')
  const [reps, setReps] = useState<string>('')
  const [notes, setNotes] = useState<string>('')
  const [lbsPopupOpen, setLbsPopupOpen] = useState(false)
  const [lbsPopupValue, setLbsPopupValue] = useState<string>('')
  const [repsPopupOpen, setRepsPopupOpen] = useState(false)
  const [repsPopupValue, setRepsPopupValue] = useState<string>('')
  const [secondsPopupOpen, setSecondsPopupOpen] = useState(false)
  const [secondsPopupValue, setSecondsPopupValue] = useState<string>('')

  // Stopwatch
  const [stopwatchRunning, setStopwatchRunning] = useState(false)
  const [stopwatchStartedAt, setStopwatchStartedAt] = useState<Date | null>(null)
  const [stopwatchElapsedSeconds, setStopwatchElapsedSeconds] = useState(0)
  const [stopwatchEverPaused, setStopwatchEverPaused] = useState(false)
  const [stopwatchBaseSeconds, setStopwatchBaseSeconds] = useState(0)
  const [isManualMode, setIsManualMode] = useState(false)
  const [manualTotalSeconds, setManualTotalSeconds] = useState<string>('')

  // Countdown (30-type visual tool — no data saved)
  const [countdownRunning, setCountdownRunning] = useState(false)
  const [countdownRemaining, setCountdownRemaining] = useState(COUNTDOWN_DURATION)
  const [countdownDone, setCountdownDone] = useState(false)

  // Save / weight-update
  const [isSaving, setIsSaving] = useState(false)
  const [showWeightUpdate, setShowWeightUpdate] = useState(false)
  const [editingMachineSessionId, setEditingMachineSessionId] = useState<string | null>(null)
  const [newProgramWeight, setNewProgramWeight] = useState<string>('')

  // History
  const [machineHistory, setMachineHistory] = useState<MachineHistoryEntry[]>([])
  const [loadingHistory, setLoadingHistory] = useState(false)
  const [currentSessionEntries, setCurrentSessionEntries] = useState<MachineHistoryEntry[]>([])
  // Cached session location/trainer — resolved once at load time, reused across machine switches.
  // Stored in refs as well as state so loadMachineHistory can read the latest value synchronously
  // without waiting for a React state flush (avoids null on the first machine load).
  const [sessionLocationName, setSessionLocationName] = useState<string | null>(null)
  const [sessionTrainerName, setSessionTrainerName] = useState<string | null>(null)
  const sessionLocationNameRef = useRef<string | null>(null)
  const sessionTrainerNameRef = useRef<string | null>(null)

  // Refs so handleSelectMachine can read latest values without being in its dep array
  const stopwatchRunningRef = useRef(false)
  const countdownRunningRef = useRef(false)
  const stopwatchStartedAtRef = useRef<Date | null>(null)
  const stopwatchBaseSecondsRef = useRef(0)
  const completedMachineIdsRef = useRef<Set<string>>(new Set())
  const pendingTileKeysRef = useRef<Set<string>>(new Set())

  // Delete confirmation for saved measurement entries (tile has a saved DB record)
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null)
  // Remove confirmation for unsaved MT tiles (no DB record yet — just removes from tile list)
  const [pendingRemoveTile, setPendingRemoveTile] = useState<{ mt: MeasurementType; occurrenceIdx: number; tileKey: string } | null>(null)
  // Pending tile keys — tiles where data entry has started but Finish not yet pressed
  const [pendingTileKeys, setPendingTileKeys] = useState<Set<string>>(new Set())

  // Add machine
  const [availableMachines, setAvailableMachines] = useState<Machine[]>([])
  const [showAddMachine, setShowAddMachine] = useState(false)
  const [addingMachine, setAddingMachine] = useState(false)
  const [selectedAddMachineIds, setSelectedAddMachineIds] = useState<Set<string>>(new Set())
  const [pendingAddMachineIds, setPendingAddMachineIds] = useState<string[]>([])

  // Skip / remove
  const [skippedMachineIds, setSkippedMachineIds] = useState<Set<string>>(new Set())
  const [skipDialogMachine, setSkipDialogMachine] = useState<ProgramMachineWithMachine | null>(null)

  // MT tiles from last session for selected machine
  const [recentMeasurementTypes, setRecentMeasurementTypes] = useState<MeasurementType[]>([])
  // Per-tile weight/reps — tileWeights keyed by mt.id; tileReps/tileTimes keyed by machineId:mtId:occurrenceIdx
  const [tileWeights, setTileWeights] = useState<Map<string, string>>(new Map())
  const [tileReps, setTileReps] = useState<Map<string, string>>(new Map())
  const [tileTimes, setTileTimes] = useState<Map<string, string>>(new Map())
  // Which tile occurrence index is currently being edited in a popup (so popup Set writes back to the right key)
  const [selectedTileOccurrenceIdx, setSelectedTileOccurrenceIdx] = useState<number>(0)

  // Trainer-explicit machine completion (green card) — persisted to sessionStorage so refresh doesn't lose it
  const [completedMachineIds, setCompletedMachineIds] = useState<Set<string>>(new Set())
  const [machineFinishedOverlay, setMachineFinishedOverlay] = useState(false)
  const [sessionCompletedOverlay, setSessionCompletedOverlay] = useState(false)
  // Session complete flow
  const [completeCheckDialogOpen, setCompleteCheckDialogOpen] = useState(false)
  const [unusedMachinesForComplete, setUnusedMachinesForComplete] = useState<ProgramMachineWithMachine[]>([])

  // Remove-from-routine confirmation
  const [removeConfirmMachine, setRemoveConfirmMachine] = useState<ProgramMachineWithMachine | null>(null)

  // Discard all measurements for current machine
  const [discardDialogOpen, setDiscardDialogOpen] = useState(false)

  // Toggle machine attribute settings visibility in chips
  const [showMachineSettings, setShowMachineSettings] = useState(false)

  // Abandon session guard
  const [abandonDialogOpen, setAbandonDialogOpen] = useState(false)

  // Timer refs for cleanup on unmount
  const navTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const overlayTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const weightRef = useRef<string>('')
  useEffect(() => {
    return () => {
      if (navTimerRef.current) clearTimeout(navTimerRef.current)
      if (overlayTimerRef.current) clearTimeout(overlayTimerRef.current)
    }
  }, [])

  // Restore completed + skipped machine IDs from sessionStorage after sessionId is available
  useEffect(() => {
    if (!sessionId) return
    try {
      const rawCompleted = sessionStorage.getItem(`completed_machines_${sessionId}`)
      if (rawCompleted) setCompletedMachineIds(new Set(JSON.parse(rawCompleted) as string[]))
      const rawSkipped = sessionStorage.getItem(`skipped_machines_${sessionId}`)
      if (rawSkipped) setSkippedMachineIds(new Set(JSON.parse(rawSkipped) as string[]))
    } catch {}
  }, [sessionId])

  // Persist completed machine IDs whenever they change
  useEffect(() => {
    if (!sessionId) return
    try {
      sessionStorage.setItem(`completed_machines_${sessionId}`, JSON.stringify([...completedMachineIds]))
    } catch {}
  }, [completedMachineIds, sessionId])

  // Persist skipped machine IDs whenever they change
  useEffect(() => {
    if (!sessionId) return
    try {
      sessionStorage.setItem(`skipped_machines_${sessionId}`, JSON.stringify([...skippedMachineIds]))
    } catch {}
  }, [skippedMachineIds, sessionId])

  const navigateBack = () => {
    router.push(session?.client_id ? `/trainer/client/${session.client_id}?tab=history&returnTab=clients` : '/trainer/dashboard?tab=clients')
  }

  const handleBackPressed = () => {
    if (stopwatchRunning || countdownRunning) {
      toast.error('Pause the timer before leaving')
      return
    }
    if (sessionStarted && (completedMachineIds.size > 0 || skippedMachineIds.size > 0)) {
      setAbandonDialogOpen(true)
    } else {
      navigateBack()
    }
  }

  // ── Auth guard ─────────────────────────────────────────────────────────────
  // Only redirect on genuine session loss (user === null). A null profile is a
  // transient fetch failure — the session is still valid, don't kick the trainer.
  useEffect(() => {
    if (!loading && !user) {
      router.push('/login')
    }
  }, [user, loading, router])

  // ── Android / browser back button intercept ────────────────────────────────
  // Use a ref so the popstate listener always calls the latest handleBackPressed
  // without needing to re-register on every render. Without this, the closure
  // captured at mount always sees sessionStarted=false and skips the guard.
  const handleBackPressedRef = useRef(handleBackPressed)
  useEffect(() => { handleBackPressedRef.current = handleBackPressed })
  useEffect(() => { weightRef.current = weight }, [weight])

  useEffect(() => {
    window.history.pushState({ sessionPage: true }, '')
    const onPopState = () => {
      // Re-push so the next hardware back press is intercepted again
      window.history.pushState({ sessionPage: true }, '')
      handleBackPressedRef.current()
    }
    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  }, [])

  // ── Countdown ticker (30-type) ─────────────────────────────────────────────
  useEffect(() => {
    if (!countdownRunning) return
    const iv = setInterval(() => {
      setCountdownRemaining(r => {
        if (r <= 1) { setCountdownRunning(false); setCountdownDone(true); return 0 }
        return r - 1
      })
    }, 1000)
    return () => clearInterval(iv)
  }, [countdownRunning])

  // ── Stopwatch ticker ───────────────────────────────────────────────────────
  useEffect(() => {
    if (!stopwatchRunning || isManualMode) return
    const iv = setInterval(() => {
      const startedAt = stopwatchStartedAtRef.current
      if (!startedAt) return
      setStopwatchElapsedSeconds(stopwatchBaseSecondsRef.current + Math.floor((Date.now() - startedAt.getTime()) / 1000))
    }, 1000)
    return () => clearInterval(iv)
  }, [stopwatchRunning, isManualMode])

  // ── Suppress idle timeout while a timer is running ────────────────────────
  useEffect(() => {
    suppressIdle(stopwatchRunning || countdownRunning)
  }, [stopwatchRunning, countdownRunning, suppressIdle])

  // Keep refs in sync so handleSelectMachine has stable identity
  useEffect(() => { stopwatchRunningRef.current = stopwatchRunning }, [stopwatchRunning])
  useEffect(() => { countdownRunningRef.current = countdownRunning }, [countdownRunning])
  useEffect(() => { stopwatchStartedAtRef.current = stopwatchStartedAt }, [stopwatchStartedAt])
  useEffect(() => { stopwatchBaseSecondsRef.current = stopwatchBaseSeconds }, [stopwatchBaseSeconds])
  useEffect(() => { completedMachineIdsRef.current = completedMachineIds }, [completedMachineIds])
  useEffect(() => { pendingTileKeysRef.current = pendingTileKeys }, [pendingTileKeys])

  // Derived: any tile has entered a pending (in-progress) state
  const hasPendingTile = pendingTileKeys.size > 0

  const markTilePending = useCallback((tileKey: string) => {
    setPendingTileKeys(prev => { const next = new Set(prev); next.add(tileKey); return next })
  }, [])

  const clearTilePending = useCallback((tileKey: string) => {
    setPendingTileKeys(prev => { const next = new Set(prev); next.delete(tileKey); return next })
  }, [])

  const clearAllPendingTiles = useCallback(() => {
    setPendingTileKeys(new Set())
  }, [])

  // ── Screen wake lock — keep screen on while a timer is running ────────────
  useEffect(() => {
    const timerActive = stopwatchRunning || countdownRunning
    if (!timerActive || !('wakeLock' in navigator)) return
    let lock: WakeLockSentinel | null = null
    navigator.wakeLock.request('screen').then(l => { lock = l }).catch(() => {})
    return () => { lock?.release().catch(() => {}) }
  }, [stopwatchRunning, countdownRunning])

  // ── Measurement types (once) ───────────────────────────────────────────────
  useEffect(() => {
    const load = async () => {
        let { data, error } = await supabase
        .from('measurement_types').select('*')
        .order('sort_order', { ascending: true, nullsFirst: false }).order('name')
      if (error?.message?.includes('sort_order')) {
        const fb = await supabase.from('measurement_types').select('*').order('name')
        data = fb.data; error = fb.error
      }
      if (!error && data?.length) setMeasurementTypes(data as MeasurementType[])
    }
    load()
  }, [])

  // ── Load session on mount ──────────────────────────────────────────────────
  useEffect(() => {
    if (profile && sessionId) loadSessionData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile, sessionId])

  // ── Load history when machine changes ─────────────────────────────────────
  useEffect(() => {
    if (selectedMachine && session?.client_id) {
      // Preserve duplicates — two TUL10 entries → two tile slots
      const existingMtIds = (selectedMachine.machine_sessions || []).map(ms => ms.measurement_type_id).filter(Boolean) as string[]
      loadMachineHistory(selectedMachine.machine_id, session.client_id, existingMtIds)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedMachine?.id])

  // ── Populate form when selected machine changes ────────────────────────────
  useEffect(() => {
    if (!selectedMachine) return
    setShowWeightUpdate(false)
    setEditingMachineSessionId(null)
    setStopwatchRunning(false); setStopwatchStartedAt(null); setStopwatchEverPaused(false)
    setCountdownRunning(false); setCountdownRemaining(COUNTDOWN_DURATION); setCountdownDone(false)

    // Pre-fill weight from last saved session for this machine, or from program default
    const sessions = selectedMachine.machine_sessions || []
    const lastSession = sessions.length > 0 ? sessions[sessions.length - 1] : null
    const recW = lastSession?.weight_lbs ?? selectedMachine.last_weight ?? selectedMachine.current_weight ?? 0
    setWeight(recW > 0 ? recW.toString() : '')
    setReps(selectedMachine.current_reps?.toString() || '')
    setNotes('')
    setStopwatchBaseSeconds(0); setStopwatchElapsedSeconds(0)
    setIsManualMode(false); setManualTotalSeconds('')
    // Always start with no type selected — ready to add the next measurement
    setSelectedMeasurementType(null)
    // Reset quick-pick when switching machines (history load will repopulate and init tile weights)
    setRecentMeasurementTypes([])
    setTileWeights(new Map())
    // tileReps/tileTimes intentionally not reset — keyed by machineId:mtId, persist across navigation
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedMachine?.id])

  // ── Data loaders ───────────────────────────────────────────────────────────
  const loadSessionData = async () => {
    if (!user?.id) return
    let query = supabase
      .from('sessions')
      .select('*, client:profiles!sessions_client_id_fkey(id, first_name, last_name, high_risk, intensity)')
      .eq('id', sessionId)
    const roles: string[] = Array.isArray(profile?.roles) ? profile.roles : profile?.role ? [profile.role] : []
    if (!roles.includes('management')) query = query.eq('trainer_id', user.id)
    const { data, error } = await query.single()
    if (error || !data) { toast.error('Failed to load session'); return }
    const typed = data as SessionWithClient

    setSession(typed)
    if (typed.actual_start) { setSessionStarted(true) }

    // Resolve location + trainer once here so loadMachineHistory can reuse them
    const [locRes, trRes] = await Promise.all([
      typed.location_id ? supabase.from('locations').select('name').eq('id', typed.location_id).single() : Promise.resolve({ data: null }),
      typed.trainer_id ? supabase.from('profiles').select('first_name, last_name').eq('id', typed.trainer_id).single() : Promise.resolve({ data: null }),
    ])
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const resolvedLoc = (locRes.data as any)?.name ?? null
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const td = trRes.data as any
    const resolvedTr = td ? [td.first_name, td.last_name?.charAt(0)].filter(Boolean).join(' ') + '.' : null
    setSessionLocationName(resolvedLoc)
    setSessionTrainerName(resolvedTr)
    sessionLocationNameRef.current = resolvedLoc
    sessionTrainerNameRef.current = resolvedTr

    if (typed.program_id) {
      const { data: prog } = await supabase.from('programs').select('*').eq('id', typed.program_id).single()
      if (prog) { setProgram(prog as Program); await loadProgramMachines(typed.program_id, typed.client_id) }
    }
  }

  const loadProgramMachines = async (programId: string, clientId: string) => {
    const { data, error } = await supabase
      .from('program_machines').select('*, machine:machines(*)')
      .eq('program_id', programId).order('order_index')
    if (error || !data) return

    const typed = data as ProgramMachineResponse[]
    const machineIds = typed.map(pm => pm.machine_id).filter(Boolean)
    const programMachineIds = typed.map(pm => pm.id)
    const [attrsMap, valsMap] = await Promise.all([
      getMachineAttributesBatch(machineIds),
      getUserMachineAttributeValuesBatch(clientId, programMachineIds),
    ])
    // Seed default values for any attribute the user hasn't set yet
    const valsWithDefaults = new Map(valsMap)
    for (const pm of typed) {
      const attrs = attrsMap.get(pm.machine_id) || []
      for (const { definition } of attrs) {
        const key = attrValueKey(pm.id, definition.id)
        if (!valsWithDefaults.has(key) && definition.default_value != null) {
          valsWithDefaults.set(key, definition.default_value)
        }
      }
    }
    setAttributeValues(valsWithDefaults)

    const { data: msd } = await supabase.from('machine_sessions').select('*').eq('session_id', sessionId)

    // Fetch previous session IDs for this client (completed only), then get machine weights.
    // Two queries but the second is filtered to only the relevant machine_ids — avoids a full table scan.
    const lastWeightMap = new Map<string, number>()
    const { data: prevSessionIds } = await supabase
      .from('sessions')
      .select('id')
      .eq('client_id', clientId)
      .eq('status', 'completed')
      .neq('id', sessionId)
      .order('created_at', { ascending: false })
      .limit(100)
    if (prevSessionIds?.length) {
      const ids = (prevSessionIds as { id: string }[]).map(s => s.id)
      const { data: prevMs } = await supabase
        .from('machine_sessions')
        .select('machine_id, weight_lbs, start_time')
        .in('session_id', ids)
        .in('machine_id', machineIds)
        .not('weight_lbs', 'is', null)
        .order('start_time', { ascending: false })
      if (prevMs) for (const ms of prevMs as PrevMachineSession[]) {
        if (ms.weight_lbs !== null && !lastWeightMap.has(ms.machine_id)) lastWeightMap.set(ms.machine_id, ms.weight_lbs)
      }
    }

    const enriched: ProgramMachineWithMachine[] = typed.map(pm => {
      const sessions = (msd as MachineSession[] | null)?.filter(s => s.machine_id === pm.machine_id) || []
      // Status is driven exclusively by trainer clicking "Complete Machine" — not by saved entries
      const status: 'not_started' | 'in_progress' | 'completed' = sessions.length > 0 ? 'in_progress' : 'not_started'
      return { ...pm, machineAttributes: attrsMap.get(pm.machine_id) || [], last_weight: lastWeightMap.get(pm.machine_id) || pm.current_weight, machine_sessions: sessions, status }
    })

    setProgramMachines(enriched)
    if (enriched.length > 0 && !selectedMachine) {
      setSelectedMachine(enriched[0])
    } else if (selectedMachine) {
      const updated = enriched.find(pm => pm.id === selectedMachine.id)
      if (updated) setSelectedMachine(updated)
    }
  }

  const loadMachineHistory = async (machineId: string, clientId: string, currentSessionMtIds: string[] = []) => {
    setLoadingHistory(true); setCurrentSessionEntries([])
    try {
      // Run both queries in parallel — previously sequential, costing 2× RTT per machine tap
      const [{ data: hist }, { data: curRows }] = await Promise.all([
        supabase
          .from('machine_sessions')
          .select('id, weight_lbs, total_time_seconds, reps, start_time, measurement_type_id, session:sessions!inner(id, client_id, location_id, trainer_id, program_id, status)')
          .eq('machine_id', machineId).neq('session_id', sessionId)
          .order('start_time', { ascending: false }).limit(200),
        supabase
          .from('machine_sessions')
          .select('id, weight_lbs, total_time_seconds, reps, start_time, measurement_type_id')
          .eq('machine_id', machineId).eq('session_id', sessionId)
          .order('start_time', { ascending: true }),
      ])

      // currentSessionMtIds from caller may be stale (loaded at page init, before mid-session saves).
      // Use curRows (freshly queried) as the authoritative source for what's saved this session.
      const freshCurMtIds: string[] = (curRows as any[] || []).map((r: any) => r.measurement_type_id).filter(Boolean)
      // Merge with caller's list (covers the case where curRows returns less than expected)
      const mergedCurMtIds: string[] = [...freshCurMtIds]
      for (const id of currentSessionMtIds) {
        // Only add extras not already covered by fresh data
        const freshCount = freshCurMtIds.filter(x => x === id).length
        const callerCount = currentSessionMtIds.filter(x => x === id).length
        for (let i = freshCount; i < callerCount; i++) mergedCurMtIds.push(id)
      }

      if (curRows && (curRows as any[]).length > 0) {
        // Use in-memory measurementTypes (loaded once at startup) — no extra DB query
        const curMtMap = new Map<string, string>()
        for (const mt of measurementTypes) curMtMap.set(mt.id, mt.abbreviation)
        setCurrentSessionEntries((curRows as any[]).map((r: any) => ({
          id: r.id, date: 'Today',
          weight_lbs: r.weight_lbs, total_time_seconds: r.total_time_seconds, reps: r.reps,
          locationName: sessionLocationNameRef.current, trainerName: sessionTrainerNameRef.current,
          measurementType: r.measurement_type_id ? curMtMap.get(r.measurement_type_id) || null : null,
          routineName: program?.name ?? null,
        })))
      }

      const sessions = (hist || []) as MachineSessionHistoryItem[]
      // Only show history from completed sessions — incomplete sessions (in_progress, scheduled)
      // have data mid-entry and should not appear in the historical table.
      const allClientSessions = sessions.filter(ms =>
        ms.session?.client_id === clientId && ms.session?.status === 'completed'
      )
      if (!allClientSessions.length) {
        setMachineHistory([])
        // Machine never used before — still show tiles for any MTs saved this session
        if (mergedCurMtIds.length) {
          // Use in-memory measurementTypes — no extra DB query
          const fetchedMap = new Map<string, MeasurementType>()
          for (const mt of measurementTypes) fetchedMap.set(mt.id, mt)
          // Build tile list with duplicates preserved
          const mts = mergedCurMtIds.map(id => fetchedMap.get(id)).filter((mt): mt is MeasurementType => !!mt)
          setRecentMeasurementTypes(mts)
          const twInit = new Map<string, string>()
          const twOccCtr = new Map<string, number>()
          for (const mt of mts) { const idx = twOccCtr.get(mt.id) ?? 0; twOccCtr.set(mt.id, idx + 1); twInit.set(`${machineId}:${mt.id}:${idx}`, '') }
          setTileWeights(twInit)
          // Restore tileTimes/tileReps from current-session rows
          if (curRows && (curRows as any[]).length > 0) {
            const mtOccCounter = new Map<string, number>()
            const newTimes = new Map<string, string>()
            const newReps = new Map<string, string>()
            for (const row of curRows as any[]) {
              const mtId: string | null = row.measurement_type_id
              if (!mtId) continue
              const idx = mtOccCounter.get(mtId) ?? 0
              mtOccCounter.set(mtId, idx + 1)
              const tKey = `${machineId}:${mtId}:${idx}`
              if (row.total_time_seconds != null) newTimes.set(tKey, row.total_time_seconds.toString())
              if (row.reps != null) newReps.set(tKey, row.reps.toString())
            }
            if (newTimes.size > 0) setTileTimes(prev => new Map([...prev, ...newTimes]))
            if (newReps.size > 0) setTileReps(prev => new Map([...prev, ...newReps]))
          }
        } else {
          setRecentMeasurementTypes([])
        }
        return
      }

      // Derive last-session MTs BEFORE capping — cap only affects history table.
      // Use all sessions that share the same calendar date as the most recent session,
      // because two separate sessions can occur on the same day (different session IDs, same date).
      const mostRecentStartTime = allClientSessions[0]?.start_time
      const mostRecentDate = mostRecentStartTime ? mostRecentStartTime.slice(0, 10) : null
      const lastSessionRowsForMts = mostRecentDate
        ? allClientSessions.filter(ms => ms.start_time?.slice(0, 10) === mostRecentDate)
        : []

      // Cap history display to 5 most recent distinct sessions
      const seenSessionIds = new Set<string>()
      const cappedSessions: MachineSessionHistoryItem[] = []
      for (const ms of allClientSessions) {
        if (ms.session?.id) seenSessionIds.add(ms.session.id)
        if (seenSessionIds.size > 5) break
        cappedSessions.push(ms)
      }
      const clientSessions = cappedSessions

      const locIds = [...new Set(clientSessions.map(ms => ms.session?.location_id).filter(Boolean))] as string[]
      const trIds = [...new Set(clientSessions.map(ms => ms.session?.trainer_id).filter(Boolean))] as string[]
      const progIds = [...new Set(clientSessions.map(ms => ms.session?.program_id).filter(Boolean))] as string[]

      const [locsR, trR, progR] = await Promise.all([
        locIds.length ? supabase.from('locations').select('id, name').in('id', locIds) : Promise.resolve({ data: [] as LocationRecord[] }),
        trIds.length ? supabase.from('profiles').select('id, first_name, last_name').in('id', trIds) : Promise.resolve({ data: [] as TrainerRecord[] }),
        progIds.length ? supabase.from('programs').select('id, name').in('id', progIds) : Promise.resolve({ data: [] as ProgramRecord[] }),
      ])

      const locMap = new Map<string, string>(); (locsR.data as LocationRecord[] || []).forEach(l => locMap.set(l.id, l.name))
      // Seed trMap with the current trainer's own name — available even if RLS blocks
      // reading other trainers' profiles. Own ID from profile; name from the session ref.
      const trMap = new Map<string, string>()
      if (profile?.id && sessionTrainerNameRef.current) trMap.set(profile.id, sessionTrainerNameRef.current)
      ;(trR.data as TrainerRecord[] || []).forEach(t => trMap.set(t.id, [t.first_name, t.last_name?.charAt(0)].filter(Boolean).join(' ') + '.'))
      // Use in-memory measurementTypes — no extra DB query
      const mtMap = new Map<string, string>()
      for (const mt of measurementTypes) mtMap.set(mt.id, mt.abbreviation)
      const progMap = new Map<string, string>(); (progR.data as ProgramRecord[] || []).forEach(p => progMap.set(p.id, p.name))

      if (clientSessions.length) {
        setMachineHistory(clientSessions.map(ms => ({
          id: ms.id, date: formatDate(ms.start_time),
          weight_lbs: ms.weight_lbs, total_time_seconds: ms.total_time_seconds, reps: ms.reps,
          locationName: ms.session?.location_id ? locMap.get(ms.session.location_id) || null : null,
          trainerName: ms.session?.trainer_id ? trMap.get(ms.session.trainer_id) || null : null,
          measurementType: ms.measurement_type_id ? mtMap.get(ms.measurement_type_id) || null : null,
          routineName: ms.session?.program_id ? progMap.get(ms.session.program_id) || null : null,
        })))
      } else {
        setMachineHistory([])
      }

      // Derive MT tiles: union of last completed session's MTs + any MTs already saved this session
      const fetchedMtMap = new Map<string, MeasurementType>()
      for (const mt of measurementTypes) fetchedMtMap.set(mt.id, mt)

      // Build tile list: unique MTs from last completed session as base
      const lastSessionUniqueMtIds: string[] = []
      const seenInLastSession = new Set<string>()
      for (const ms of lastSessionRowsForMts) {
        if (ms.measurement_type_id && !seenInLastSession.has(ms.measurement_type_id)) {
          seenInLastSession.add(ms.measurement_type_id)
          lastSessionUniqueMtIds.push(ms.measurement_type_id)
        }
      }

      // Count how many entries each MT has in the current session (with duplicates)
      const currentCounts = new Map<string, number>()
      for (const mtId of mergedCurMtIds) currentCounts.set(mtId, (currentCounts.get(mtId) ?? 0) + 1)

      // Add extra tiles for MTs with more current-session entries than last-session entries
      const recentMtIds: string[] = [...lastSessionUniqueMtIds]
      for (const [mtId, count] of currentCounts) {
        const baseCount = seenInLastSession.has(mtId) ? 1 : 0
        for (let i = 0; i < count - baseCount; i++) recentMtIds.push(mtId)
      }

      const resolvedMts = recentMtIds.map(id => fetchedMtMap.get(id)).filter((mt): mt is MeasurementType => !!mt)
      setRecentMeasurementTypes(resolvedMts)

      // Per-MT weight from last session rows — different MTs on the same machine can have different weights
      const lastWeightByMt = new Map<string, string>()
      for (const ms of lastSessionRowsForMts) {
        if (ms.measurement_type_id && ms.weight_lbs != null && !lastWeightByMt.has(ms.measurement_type_id)) {
          lastWeightByMt.set(ms.measurement_type_id, ms.weight_lbs.toString())
        }
      }
      // Build tileWeights keyed by tileKey (machineId:mtId:occurrenceIdx) so duplicate
      // MTs each have independent weight values. Seed from current-session saved entries
      // first (most accurate), falling back to last-session weight for that MT type.
      const curWeightByMtOcc = new Map<string, string>()
      const newTileTimes = new Map<string, string>()
      const newTileReps = new Map<string, string>()
      if (curRows && (curRows as any[]).length > 0) {
        const mtOccurrenceCounter = new Map<string, number>()
        for (const row of curRows as any[]) {
          const mtId: string | null = row.measurement_type_id
          if (!mtId) continue
          const idx = mtOccurrenceCounter.get(mtId) ?? 0
          mtOccurrenceCounter.set(mtId, idx + 1)
          const tKey = `${machineId}:${mtId}:${idx}`
          if (row.weight_lbs != null) curWeightByMtOcc.set(tKey, row.weight_lbs.toString())
          if (row.total_time_seconds != null) newTileTimes.set(tKey, row.total_time_seconds.toString())
          if (row.reps != null) newTileReps.set(tKey, row.reps.toString())
        }
      }
      const newTileWeights = new Map<string, string>()
      const twOccCtr = new Map<string, number>()
      for (const mt of resolvedMts) {
        const idx = twOccCtr.get(mt.id) ?? 0
        twOccCtr.set(mt.id, idx + 1)
        const tKey = `${machineId}:${mt.id}:${idx}`
        newTileWeights.set(tKey, curWeightByMtOcc.get(tKey) ?? lastWeightByMt.get(mt.id) ?? '')
      }
      setTileWeights(newTileWeights)
      if (newTileTimes.size > 0) setTileTimes(prev => new Map([...prev, ...newTileTimes]))
      if (newTileReps.size > 0) setTileReps(prev => new Map([...prev, ...newTileReps]))
    } catch { setMachineHistory([]) }
    finally { setLoadingHistory(false) }
  }

  const loadAvailableMachines = async () => {
    const { data } = await supabase.from('machines').select('*').eq('is_active', true).order('machine_code')
    if (data) {
      const existing = new Set(programMachines.map(pm => pm.machine_id))
      setAvailableMachines((data as Machine[]).filter(m => !existing.has(m.id)))
    }
  }

  // ── Session actions ────────────────────────────────────────────────────────
  const handleStartSession = async () => {
    const startTime = new Date()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase.from('sessions') as any).update({ actual_start: startTime.toISOString() }).eq('id', sessionId)
    if (error) { toast.error('Failed to start session'); return }
    setSessionStarted(true); toast.success('Session started!')
  }

  const handleCompleteSessionClick = () => {
    // Find machines that have no data and haven't been explicitly finished or skipped
    const unused = programMachines.filter(pm =>
      !completedMachineIds.has(pm.machine_id) &&
      !skippedMachineIds.has(pm.machine_id)
    )
    if (unused.length > 0) {
      setUnusedMachinesForComplete(unused)
      setCompleteCheckDialogOpen(true)
    } else {
      doCompleteSession()
    }
  }

  const doCompleteSession = async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase.from('sessions') as any).update({ actual_end: new Date().toISOString(), status: 'completed' }).eq('id', sessionId)
    if (error) { toast.error('Failed to complete session'); return }
    setSessionCompletedOverlay(true)
    navTimerRef.current = setTimeout(() => {
      router.push(session?.client_id ? `/trainer/client/${session.client_id}?tab=history&returnTab=clients` : '/trainer/dashboard?tab=clients')
    }, 2000)
  }

  const handleCancelSession = async () => {
    const returnUrl = session?.client_id
      ? `/trainer/client/${session.client_id}?tab=routines&returnTab=clients`
      : '/trainer/dashboard?tab=clients'
    try {
      await fetch('/api/trainer/session', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId }),
      })
    } catch {
      // Navigate regardless — don't block the trainer on a network error
    }
    router.push(returnUrl)
  }

  const handleMarkAllUnusedSkipped = () => {
    unusedMachinesForComplete.forEach(pm => {
      setSkippedMachineIds(prev => new Set([...prev, pm.machine_id]))
    })
    setCompleteCheckDialogOpen(false)
    doCompleteSession()
  }

  const handleAddMachineToRoutine = async (machineIds: string[], permanent: boolean) => {
    if (!session?.program_id || !machineIds.length) return
    setAddingMachine(true)
    if (permanent) {
      const rows = machineIds.map((machineId, i) => ({
        program_id: session.program_id!, machine_id: machineId, order_index: programMachines.length + i,
      }))
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase.from('program_machines') as any).insert(rows)
      if (error) { toast.error('Failed to add machine(s)'); setAddingMachine(false); return }
      toast.success(`${machineIds.length > 1 ? `${machineIds.length} machines` : 'Machine'} added to routine`)
      if (session.client_id) await loadProgramMachines(session.program_id, session.client_id)
    } else {
      // Today only — build ephemeral entries in local state, no DB rows
      const [machinesRes, attrsMap] = await Promise.all([
        supabase.from('machines').select('*').in('id', machineIds),
        getMachineAttributesBatch(machineIds),
      ])
      if (!machinesRes.data?.length) { toast.error('Failed to load machine(s)'); setAddingMachine(false); return }
      const machineMap = new Map((machinesRes.data as Machine[]).map(m => [m.id, m]))
      const ephemerals: ProgramMachineWithMachine[] = machineIds.map((machineId, i) => ({
        id: `ephemeral-${machineId}`,
        program_id: session.program_id!,
        machine_id: machineId,
        machine: machineMap.get(machineId)! as Machine,
        order_index: programMachines.length + i,
        current_weight: null, current_reps: null, current_sets: null,
        machine_sessions: [],
        machineAttributes: attrsMap.get(machineId) || [],
        last_weight: null,
        status: 'not_started' as const,
      } as unknown as ProgramMachineWithMachine))
      // Seed default attribute values for the newly added machines (keyed by ephemeral pm.id)
      setAttributeValues(prev => {
        const next = new Map(prev)
        for (const eph of ephemerals) {
          const attrs = attrsMap.get(eph.machine_id) || []
          for (const { definition } of attrs) {
            const key = attrValueKey(eph.id, definition.id)
            if (!next.has(key) && definition.default_value != null) {
              next.set(key, definition.default_value)
            }
          }
        }
        return next
      })
      setProgramMachines(prev => [...prev, ...ephemerals])
      setSelectedMachine(ephemerals[0])
      toast.success(`${machineIds.length > 1 ? `${machineIds.length} machines` : 'Machine'} added for today only`)
    }
    setPendingAddMachineIds([])
    setSelectedAddMachineIds(new Set())
    setShowAddMachine(false)
    setAddingMachine(false)
  }

  // ── Skip / remove ─────────────────────────────────────────────────────────
  const handleSkipForToday = (pm: ProgramMachineWithMachine) => {
    setSkippedMachineIds(prev => new Set([...prev, pm.machine_id]))
    // Stay on the machine so the trainer can see the orange border and unskip if needed
    setSkipDialogMachine(null)
    toast.success(`${pm.machine.machine_code} skipped for today`)
  }

  const handleRemoveFromRoutine = async (pm: ProgramMachineWithMachine) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase.from('program_machines') as any).delete().eq('id', pm.id)
    if (error) { toast.error('Failed to remove machine'); return }
    toast.success(`${pm.machine.machine_code} removed from routine`)
    setSkipDialogMachine(null)
    setRemoveConfirmMachine(null)
    if (selectedMachine?.id === pm.id) setSelectedMachine(null)
    if (session?.program_id && session?.client_id) await loadProgramMachines(session.program_id, session.client_id)
  }

  // Guard: block remove if data recorded but Finish Machine not pressed; otherwise open confirm dialog
  const requestRemoveFromRoutine = (pm: ProgramMachineWithMachine) => {
    const hasData = (pm.machine_sessions?.length ?? 0) > 0
    const isFinished = completedMachineIds.has(pm.machine_id)
    if (hasData && !isFinished) {
      toast.error(`${pm.machine.machine_code} has recorded data — press Finish Machine before removing`)
      return
    }
    setRemoveConfirmMachine(pm)
  }

  // ── Load a saved entry into the form for editing ──────────────────────────
  const loadEntryForEdit = (ms: MachineSession) => {
    setEditingMachineSessionId(ms.id)
    setWeight(ms.weight_lbs?.toString() || '')
    setReps(ms.reps?.toString() || '')
    setNotes(ms.notes || '')
    if (ms.total_time_seconds) {
      setIsManualMode(true)
      setManualTotalSeconds(ms.total_time_seconds.toString())
      setStopwatchBaseSeconds(ms.total_time_seconds)
      setStopwatchElapsedSeconds(ms.total_time_seconds)
    } else {
      setIsManualMode(false); setManualTotalSeconds('')
      setStopwatchBaseSeconds(0); setStopwatchElapsedSeconds(0)
    }
    setStopwatchRunning(false); setStopwatchStartedAt(null); setStopwatchEverPaused(false)
    setCountdownRunning(false); setCountdownRemaining(COUNTDOWN_DURATION); setCountdownDone(false)
    if (ms.measurement_type_id && measurementTypes.length > 0) {
      const mt = measurementTypes.find(t => t.id === ms.measurement_type_id)
      if (mt) setSelectedMeasurementType(mt)
    }
  }

  const handleDeleteMachineSession = async (msId: string) => {
    const { error } = await supabase.from('machine_sessions').delete().eq('id', msId)
    if (error) { toast.error('Failed to delete measurement'); return }
    setPendingDeleteId(null)
    if (editingMachineSessionId === msId) { setEditingMachineSessionId(null); setSelectedMeasurementType(null) }
    // Find which MT this entry belonged to, so we can remove its tile if no entries remain
    const deletedEntry = selectedMachine?.machine_sessions?.find(s => s.id === msId)
    const deletedMtId = deletedEntry?.measurement_type_id
    // Remove from local state — no full reload needed
    setProgramMachines(prev => prev.map(pm => {
      if (!pm.machine_sessions?.some(s => s.id === msId)) return pm
      const updated = pm.machine_sessions.filter(s => s.id !== msId)
      return { ...pm, machine_sessions: updated, status: updated.length > 0 ? 'in_progress' as const : 'not_started' as const }
    }))
    setSelectedMachine(prev => {
      if (!prev?.machine_sessions?.some(s => s.id === msId)) return prev
      const updated = prev.machine_sessions.filter(s => s.id !== msId)
      // Remove one tile (the last occurrence of this MT) for each deleted entry
      if (deletedMtId) {
        const remainingCount = updated.filter(s => s.measurement_type_id === deletedMtId).length
        setRecentMeasurementTypes(rmt => {
          const tilesForMt = rmt.map((m, i) => ({ m, i })).filter(({ m }) => m.id === deletedMtId)
          if (tilesForMt.length > remainingCount) {
            // Remove the last tile for this MT
            const removeIdx = tilesForMt[tilesForMt.length - 1].i
            return rmt.filter((_, i) => i !== removeIdx)
          }
          return rmt
        })
      }
      return { ...prev, machine_sessions: updated, status: updated.length > 0 ? 'in_progress' as const : 'not_started' as const }
    })
    setCurrentSessionEntries(prev => prev.filter(e => e.id !== msId))
  }

  const resetMeasurementInputs = () => {
    setSelectedMeasurementType(null)
    setWeight(''); setReps('')
    setStopwatchRunning(false); setStopwatchStartedAt(null)
    setStopwatchBaseSeconds(0); setStopwatchElapsedSeconds(0)
    setStopwatchEverPaused(false); setIsManualMode(false); setManualTotalSeconds('')
    setCountdownRunning(false); setCountdownRemaining(COUNTDOWN_DURATION); setCountdownDone(false)
    setEditingMachineSessionId(null)
    setPendingDeleteId(null)
  }

  const handleDiscardMachineMeasurements = async () => {
    if (!selectedMachine) return
    const ids = (selectedMachine.machine_sessions || []).map(s => s.id)
    setDiscardDialogOpen(false)
    resetMeasurementInputs()
    // Clear tile state for this machine
    const machineId = selectedMachine.machine_id
    setTileWeights(new Map())
    setTileReps(prev => { const next = new Map(prev); for (const k of next.keys()) { if (k.startsWith(`${machineId}:`)) next.delete(k) } return next })
    setTileTimes(prev => { const next = new Map(prev); for (const k of next.keys()) { if (k.startsWith(`${machineId}:`)) next.delete(k) } return next })
    if (!ids.length) return
    await supabase.from('machine_sessions').delete().in('id', ids)
    setProgramMachines(prev => prev.map(pm =>
      pm.id === selectedMachine.id ? { ...pm, machine_sessions: [], status: 'not_started' as const } : pm
    ))
    setSelectedMachine(prev => prev && prev.id === selectedMachine.id ? { ...prev, machine_sessions: [], status: 'not_started' as const } : prev)
    setCurrentSessionEntries([])
  }

  // ── Attribute editing (inline in chips) ───────────────────────────────────
  const handleAttributeChange = useCallback((programMachineId: string, machineId: string, attrDefId: string, value: string) => {
    const key = attrValueKey(programMachineId, attrDefId)
    setAttributeValues(prev => { const next = new Map(prev); next.set(key, value); return next })
    if (session?.client_id) {
      saveUserMachineAttributeValues(session.client_id, machineId, [{ attributeDefinitionId: attrDefId, value }], programMachineId)
        .catch(() => {})
    }
  }, [session?.client_id])

  const handleSelectMachine = useCallback((pm: ProgramMachineWithMachine) => {
    setSelectedMachine(prev => {
      if (prev && prev.id !== pm.id) {
        if (stopwatchRunningRef.current || countdownRunningRef.current) {
          toast.error('Pause the timer before switching machines')
          return prev
        }
        if (pendingTileKeysRef.current.size > 0) {
          toast.error('Finish the current measurement before switching machines')
          return prev
        }
        const hasData = (prev.machine_sessions || []).length > 0
        const isFinished = completedMachineIdsRef.current.has(prev.machine_id)
        if (hasData && !isFinished) {
          toast.error(`Finish ${prev.machine.machine_code} before switching machines`)
          return prev
        }
      }
      // Clear pending tile state when switching machines
      setPendingTileKeys(new Set())
      return pm
    })
  }, [])

  const handleUnskipMachine = useCallback((machineId: string) => {
    setSkippedMachineIds(prev => { const next = new Set(prev); next.delete(machineId); return next })
  }, [])

  // ── Stopwatch helpers ──────────────────────────────────────────────────────
  const handleStartStopwatch = () => {
    if (needsWeight && !weight) { toast.error('Enter weight before starting the timer'); return }
    const now = new Date()
    stopwatchStartedAtRef.current = now
    setStopwatchStartedAt(now); setStopwatchRunning(true)
    // Clear the stored tile time so the live counter takes over the display
    if (selectedMachine && selectedMeasurementType) {
      const tileKey = `${selectedMachine.machine_id}:${selectedMeasurementType.id}:${selectedTileOccurrenceIdx}`
      setTileTimes(prev => { const next = new Map(prev); next.delete(tileKey); return next })
    }
  }
  const handlePauseStopwatch = () => {
    const acc = stopwatchBaseSecondsRef.current + Math.floor((Date.now() - (stopwatchStartedAtRef.current?.getTime() ?? Date.now())) / 1000)
    stopwatchStartedAtRef.current = null
    stopwatchBaseSecondsRef.current = acc
    setStopwatchBaseSeconds(acc); setStopwatchElapsedSeconds(acc)
    setStopwatchStartedAt(null); setStopwatchRunning(false); setStopwatchEverPaused(true)
    setTileTimes(prev => {
      const mt = selectedMeasurementType
      if (!mt || !selectedMachine) return prev
      return new Map(prev).set(`${selectedMachine.machine_id}:${mt.id}:${selectedTileOccurrenceIdx}`, acc.toString())
    })
  }
  const handleResetStopwatch = () => {
    setStopwatchRunning(false); setStopwatchStartedAt(null); setStopwatchBaseSeconds(0); setStopwatchElapsedSeconds(0); setStopwatchEverPaused(false)
  }
  const handleToggleManualMode = () => {
    if (!isManualMode) {
      if (stopwatchRunning) handlePauseStopwatch()
      setManualTotalSeconds(stopwatchElapsedSeconds > 0 ? stopwatchElapsedSeconds.toString() : '')
    }
    setIsManualMode(p => !p)
  }
  const getEffectiveTotalSeconds = () => isManualMode
    ? parseInt(manualTotalSeconds || '0')
    : stopwatchElapsedSeconds

  // ── Derived ────────────────────────────────────────────────────────────────
  const is30Type = selectedMeasurementType?.abbreviation === '30'
  const isDateType = (selectedMeasurementType?.units?.includes('date') ?? false) && !is30Type
  const isCheckboxOnly = isDateType  // pure DATE — no timer, no data fields
  const needsTime = !isDateType && !is30Type && (selectedMeasurementType?.units?.includes('time') ?? false)
  const needsWeight = !isDateType && (selectedMeasurementType?.units?.includes('weight') ?? false)
  const needsReps = !isDateType && !is30Type && (selectedMeasurementType?.units?.includes('reps') ?? false)
  const hasManualTimeEntry = isManualMode && parseInt(manualTotalSeconds || '0') > 0
  const canComplete = !!selectedMeasurementType && !stopwatchRunning && (isCheckboxOnly || (is30Type && (countdownDone || (!countdownRunning && countdownRemaining < COUNTDOWN_DURATION))) || stopwatchEverPaused || hasManualTimeEntry || !!weight || !!reps)

  // ── Save ───────────────────────────────────────────────────────────────────
  const handleSave = async (override?: {
    mt?: MeasurementType
    weightVal?: string
    repsVal?: string
    totalSecondsVal?: number
  }) => {
    const effectiveMt = override?.mt ?? selectedMeasurementType
    if (!effectiveMt || !selectedMachine) { toast.error('Please select a measurement type'); return }

    const is30 = effectiveMt.abbreviation === '30'
    const isDate = (effectiveMt.units?.includes('date') ?? false) && !is30
    const effNeedsWeight = !isDate && (effectiveMt.units?.includes('weight') ?? false)
    const effNeedsReps = !isDate && !is30 && (effectiveMt.units?.includes('reps') ?? false)
    const effNeedsTime = !isDate && !is30 && (effectiveMt.units?.includes('time') ?? false)
    const effWeight = override?.weightVal ?? weight
    const effReps = override?.repsVal ?? reps
    const effTotalSeconds = override?.totalSecondsVal ?? getEffectiveTotalSeconds()

    // Validate required fields for the selected measurement type
    if (effNeedsWeight && !effWeight) { toast.error('Enter weight (lbs) before saving'); return }
    if (effNeedsReps && (!effReps || parseInt(effReps) < 1)) { toast.error('Enter reps (minimum 1) before saving'); return }
    if (effNeedsTime && effTotalSeconds <= 0) { toast.error('Record a time before saving'); return }

    setIsSaving(true)
    try {
      const totalTimeSeconds = effNeedsTime ? effTotalSeconds : null
      const startTime = new Date()
      const endTime = totalTimeSeconds && totalTimeSeconds > 0 ? new Date(startTime.getTime() + totalTimeSeconds * 1000) : startTime
      const repsValue = effNeedsReps && effReps ? parseInt(effReps) : null
      const weightValue = effNeedsWeight && effWeight ? Math.round(parseFloat(effWeight) / 2) * 2 : null
      const payload = {
        session_id: sessionId, machine_id: selectedMachine.machine.id,
        measurement_type_id: effectiveMt.id,
        start_time: startTime.toISOString(), end_time: endTime.toISOString(),
        total_time_seconds: totalTimeSeconds,
        weight_lbs: weightValue,
        reps: repsValue,
        sets: null, notes: notes || null,
      }
      let savedId = editingMachineSessionId
      if (editingMachineSessionId) {
        const updatePayload = {
          measurement_type_id: effectiveMt.id,
          total_time_seconds: totalTimeSeconds,
          weight_lbs: weightValue,
          reps: repsValue,
          notes: notes || null,
        }
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { error } = await (supabase.from('machine_sessions') as any).update(updatePayload).eq('id', editingMachineSessionId)
        if (error) throw error
      } else {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: inserted, error } = await (supabase.from('machine_sessions').insert(payload as any) as any).select('id').single()
        if (error) throw error
        savedId = inserted?.id ?? null
      }

      if (selectedMachine.machineAttributes?.length) {
        await saveUserMachineAttributeValues(session!.client_id, selectedMachine.machine.id,
          selectedMachine.machineAttributes.map(attr => ({
            attributeDefinitionId: attr.definition.id,
            value: attributeValues.get(attrValueKey(selectedMachine.id, attr.definition.id)) ?? null,
          })),
          selectedMachine.id
        )
      }
      toast.success(editingMachineSessionId ? 'Updated!' : 'Saved!')

      // If this machine was already marked complete, un-finish it — the trainer
      // must press Finish Machine again after editing to confirm the new data.
      if (completedMachineIds.has(selectedMachine.machine_id)) {
        setCompletedMachineIds(prev => { const next = new Set(prev); next.delete(selectedMachine.machine_id); return next })
        toast('Press Finish Machine to confirm the update', { duration: 3000 })
      }

      // Surgical local update — avoids full reload on every save.
      // Build what a freshly-fetched machine_session record would look like.
      const now = new Date()
      const effectiveTotalSeconds = effNeedsTime ? effTotalSeconds : null
      if (!savedId) throw new Error('No id for saved entry')
      const savedEntry: MachineSession = {
        id: savedId,
        session_id: sessionId,
        machine_id: selectedMachine.machine.id,
        measurement_type_id: effectiveMt.id,
        start_time: now.toISOString(),
        end_time: now.toISOString(),
        total_time_seconds: effectiveTotalSeconds,
        weight_lbs: weightValue,
        weight_kg: null,
        reps: repsValue,
        sets: null,
        setting1: null, setting2: null, setting3: null, setting4: null,
        side: null,
        notes: notes || null,
        created_at: now.toISOString(),
        updated_at: now.toISOString(),
      }

      // Update programMachines local state
      setProgramMachines(prev => prev.map(pm => {
        if (pm.id !== selectedMachine.id) return pm
        const existing = pm.machine_sessions || []
        const updatedSessions = editingMachineSessionId
          ? existing.map(s => s.id === editingMachineSessionId ? savedEntry : s)
          : [...existing, savedEntry]
        return { ...pm, machine_sessions: updatedSessions, status: 'in_progress' as const }
      }))
      setSelectedMachine(prev => {
        if (!prev || prev.id !== selectedMachine.id) return prev
        const existing = prev.machine_sessions || []
        const updatedSessions = editingMachineSessionId
          ? existing.map(s => s.id === editingMachineSessionId ? savedEntry : s)
          : [...existing, savedEntry]
        return { ...prev, machine_sessions: updatedSessions, status: 'in_progress' as const }
      })

      // Update today's history entries
      const histEntry: MachineHistoryEntry = {
        id: savedEntry.id,
        date: 'Today',
        weight_lbs: savedEntry.weight_lbs,
        total_time_seconds: savedEntry.total_time_seconds,
        reps: savedEntry.reps,
        locationName: currentSessionEntries[0]?.locationName ?? null,
        trainerName: currentSessionEntries[0]?.trainerName ?? null,
        measurementType: effectiveMt.abbreviation,
        routineName: program?.name ?? null,
      }
      setCurrentSessionEntries(prev => {
        if (editingMachineSessionId) return prev.map(e => e.id === editingMachineSessionId ? histEntry : e)
        return [...prev, histEntry]
      })

      // Clear pending state for this tile — it's now finished (green)
      const savedTileKey = `${selectedMachine.machine_id}:${effectiveMt.id}:${selectedTileOccurrenceIdx}`
      clearTilePending(savedTileKey)

      setEditingMachineSessionId(null)
      if (effNeedsWeight) {
        setNewProgramWeight(effWeight); setShowWeightUpdate(true)
      } else {
        setSelectedMeasurementType(null)
        setStopwatchRunning(false); setStopwatchStartedAt(null)
        setStopwatchBaseSeconds(0); setStopwatchElapsedSeconds(0)
        setStopwatchEverPaused(false); setIsManualMode(false); setManualTotalSeconds('')
        setCountdownRunning(false); setCountdownRemaining(COUNTDOWN_DURATION); setCountdownDone(false)
        setReps('')
      }
    } catch (err) { console.error(err); toast.error('Failed to save workout data') }
    finally { setIsSaving(false) }
  }

  const handleUpdateProgramWeight = async (skip = false) => {
    if (!selectedMachine || !session?.program_id) return
    if (!skip && newProgramWeight) {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { error } = await (supabase.from('program_machines') as any)
          .update({ current_weight: parseFloat(newProgramWeight) })
          .eq('program_id', session.program_id).eq('machine_id', selectedMachine.machine.id)
        if (error) throw error
        toast.success('Weight updated for next session!')
      } catch { toast.error('Failed to update routine weight') }
    }
    // Update current_weight locally — no full reload needed
    if (!skip && newProgramWeight) {
      const parsedW = parseFloat(newProgramWeight)
      setProgramMachines(prev => prev.map(pm =>
        pm.id === selectedMachine.id ? { ...pm, current_weight: parsedW } : pm
      ))
      setSelectedMachine(prev => prev && prev.id === selectedMachine.id ? { ...prev, current_weight: parsedW } : prev)
    }
    setShowWeightUpdate(false)
    setEditingMachineSessionId(null)
    setSelectedMeasurementType(null)
    setStopwatchRunning(false); setStopwatchStartedAt(null)
    setStopwatchBaseSeconds(0); setStopwatchElapsedSeconds(0)
    setStopwatchEverPaused(false); setIsManualMode(false); setManualTotalSeconds('')
    setCountdownRunning(false); setCountdownRemaining(COUNTDOWN_DURATION); setCountdownDone(false)
    setReps('')
  }

  const handleSaveNotes = async () => {
    if (!selectedMachine || !editingMachineSessionId) return
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase.from('machine_sessions') as any)
      .update({ notes: notes || null })
      .eq('id', editingMachineSessionId)
    if (error) { toast.error('Failed to save notes'); return }
    setProgramMachines(prev => prev.map(pm => {
      if (pm.id !== selectedMachine.id) return pm
      return { ...pm, machine_sessions: (pm.machine_sessions || []).map(s => s.id === editingMachineSessionId ? { ...s, notes: notes || null } : s) }
    }))
    setSelectedMachine(prev => prev && prev.id === selectedMachine.id
      ? { ...prev, machine_sessions: (prev.machine_sessions || []).map(s => s.id === editingMachineSessionId ? { ...s, notes: notes || null } : s) }
      : prev
    )
    toast.success('Notes saved')
  }

  const handleSaveNotesStandalone = async () => {
    if (!selectedMachine) return
    const sessions = selectedMachine.machine_sessions || []
    const lastId = sessions.length ? sessions[sessions.length - 1].id : null
    if (!lastId) { toast.success('Notes saved'); return }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase.from('machine_sessions') as any)
      .update({ notes: notes || null })
      .eq('id', lastId)
    if (error) { toast.error('Failed to save notes'); return }
    const updated = { ...sessions[sessions.length - 1], notes: notes || null }
    const updatedSessions = [...sessions.slice(0, -1), updated]
    setProgramMachines(prev => prev.map(pm => pm.id === selectedMachine.id ? { ...pm, machine_sessions: updatedSessions } : pm))
    setSelectedMachine(prev => prev && prev.id === selectedMachine.id ? { ...prev, machine_sessions: updatedSessions } : prev)
    toast.success('Notes saved')
  }

  const fmtTime = (s: number) => String(s)

  // ── Machine chip ───────────────────────────────────────────────────────────
  const renderMachineChip = (pm: ProgramMachineWithMachine) => (
    <MachineChip
      key={pm.id}
      pm={pm}
      isSelected={selectedMachine?.id === pm.id}
      isCompleted={completedMachineIds.has(pm.machine_id)}
      isSkipped={skippedMachineIds.has(pm.machine_id)}
      showMachineSettings={showMachineSettings}
      attributeValues={attributeValues}
      onSelect={handleSelectMachine}
      onSkipDialog={setSkipDialogMachine}
      onUnskip={handleUnskipMachine}
      onAttributeChange={handleAttributeChange}
    />
  )

  // ── Stable callbacks for WorkoutCard ─────────────────────────────────────
  // These must be useCallback so WorkoutCard's memo boundary holds.

  // ── History table data (memoised — only recomputes when entries change) ────
  const historyTableData = useMemo(() => {
    const machineFinished = selectedMachine ? completedMachineIds.has(selectedMachine.machine_id) : false
    const allEntries = machineFinished ? [...currentSessionEntries, ...machineHistory] : [...machineHistory]
    if (!allEntries.length) return null

    const typeOrder: string[] = []
    const typeSeen = new Set<string>()
    for (const e of allEntries) {
      const t = e.measurementType || '–'
      if (!typeSeen.has(t)) { typeSeen.add(t); typeOrder.push(t) }
    }

    type SubCol = 'lbs' | 'time' | 'reps' | 'tick'
    const typeSubCols: Record<string, SubCol[]> = {}
    for (const t of typeOrder) {
      const mtForType = measurementTypes.find(mt => mt.abbreviation === t)
      const units: string[] = mtForType?.units ?? []
      if (units.includes('date')) { typeSubCols[t] = ['tick']; continue }
      if (units.length > 0) {
        const subs: SubCol[] = []
        if (units.includes('weight')) subs.push('lbs')
        if (units.includes('time')) subs.push('time')
        if (units.includes('reps')) subs.push('reps')
        typeSubCols[t] = subs.length ? subs : ['lbs']
        continue
      }
      const entriesForType = allEntries.filter(e => (e.measurementType || '–') === t)
      const subs: SubCol[] = []
      if (entriesForType.some(e => e.weight_lbs != null)) subs.push('lbs')
      if (entriesForType.some(e => e.total_time_seconds != null)) subs.push('time')
      if (entriesForType.some(e => e.reps != null)) subs.push('reps')
      typeSubCols[t] = subs.length ? subs : ['lbs']
    }

    // Group by date but emit a separate row for each occurrence of the same MT on the same date.
    // Two TUL10 entries on the same day → two rows, each showing one value, not merged.
    // rowKey = `date:rowIdx` where rowIdx increments each time a new MT occurrence would collide.
    const rowOrder: string[] = []
    const byRow = new Map<string, MachineHistoryEntry[]>()
    // Track how many entries for each (date, MT) pair we've seen, to split into rows
    const dateMtCount = new Map<string, number>() // `date:mt` → rows emitted so far
    for (const e of allEntries) {
      const mt = e.measurementType || '–'
      const dateMtKey = `${e.date}::${mt}`
      const rowIdx = dateMtCount.get(dateMtKey) ?? 0
      dateMtCount.set(dateMtKey, rowIdx + 1)
      const rowKey = `${e.date}::${rowIdx}`
      if (!byRow.has(rowKey)) { byRow.set(rowKey, []); rowOrder.push(rowKey) }
      byRow.get(rowKey)!.push(e)
    }

    return { typeOrder, typeSubCols, dateOrder: rowOrder, byDate: byRow }
  }, [machineHistory, currentSessionEntries, selectedMachine, completedMachineIds, measurementTypes])

  // ── Intensity label helper ─────────────────────────────────────────────────
  const intensityLabel = (v: string | null | undefined) => {
    if (!v) return null
    const map: Record<string, { label: string; cls: string }> = {
      extra_low: { label: 'Extra Low', cls: 'bg-red-100 text-red-700' },
      low:       { label: 'Low', cls: 'bg-orange-100 text-orange-700' },
      medium:    { label: 'Medium', cls: 'bg-yellow-100 text-yellow-700' },
      high:      { label: 'High', cls: 'bg-green-100 text-green-700' },
      extra_high:{ label: 'Extra High', cls: 'bg-emerald-100 text-emerald-700' },
    }
    return map[v] ?? null
  }

  // ── Render guards (must be after all hooks) ───────────────────────────────
  if (loading) return <div className="min-h-screen flex items-center justify-center"><div>Loading...</div></div>
  if (!session) return <div className="min-h-screen flex items-center justify-center"><div>Session not found</div></div>

  // ── Main render ────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-slate-50">
      {/* Session header — compact, sticky, replaces global Header on this page */}
      <header className="bg-white border-b sticky top-0 z-40">
        <div className="container mx-auto px-3 py-1.5 flex justify-between items-center gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <Button variant="outline" size="icon" onClick={handleBackPressed} className="h-8 w-8 shrink-0 border-2 border-slate-300 hover:border-slate-500">
              <ArrowLeft className="h-4 w-4 stroke-[2.5]" />
            </Button>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <h1 className="text-base font-bold leading-tight">{session.client?.first_name} {session.client?.last_name}</h1>
                {session.client?.high_risk && (
                  <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-700">High Risk</span>
                )}
                {(() => { const il = intensityLabel(session.client?.intensity); return il ? <span className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-xs font-semibold ${il.cls}`}>{il.label}</span> : null })()}
              </div>
              <div className="flex items-center gap-2 text-xs text-slate-500 leading-tight">
                {program && <span>{program.name}</span>}
              </div>
            </div>
          </div>
          <div className="shrink-0">
            <div style={{ backgroundColor: 'rgb(227, 221, 45)' }} className="flex items-center justify-center h-8 px-3 rounded">
              <Image src="/net_logo_new.png" alt="NET" width={72} height={24} className="object-contain" style={{ width: 'auto', height: '20px' }} priority />
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-3 pt-1 pb-4">
        {!sessionStarted ? (
          <Card>
            <CardHeader><CardTitle>Ready to Start</CardTitle></CardHeader>
            <CardContent>
              <p className="text-slate-600 mb-3">Click &quot;Start Session&quot; to begin.</p>
              {program && <p className="text-sm text-slate-500">{program.name} — {programMachines.length} machines</p>}
            </CardContent>
          </Card>
        ) : !program ? (
          <Card>
            <CardHeader><CardTitle>No Program Selected</CardTitle></CardHeader>
            <CardContent><p className="text-slate-600">This session doesn&apos;t have a program assigned.</p></CardContent>
          </Card>
        ) : (
          <div className="space-y-2">

            {/* ── Machine chip bar — sticky ── */}
            <div className="sticky top-[45px] z-40 bg-white shadow-sm pt-1 pb-1 -mx-3 px-3">

              {/* Control row: Settings · Add Machine · Finish Session */}
              <div className="flex items-center justify-between gap-6 mb-3 w-full">
                {/* Settings toggle */}
                <button
                  onClick={() => setShowMachineSettings(v => !v)}
                  className={`flex items-center gap-1.5 px-4 py-2 rounded-md border text-xs font-medium transition-colors ${
                    showMachineSettings
                      ? 'border-blue-600 bg-blue-600 text-white'
                      : 'border-blue-600 bg-blue-600 text-white hover:bg-blue-700 hover:border-blue-700'
                  }`}
                >
                  <SlidersHorizontal className="h-3.5 w-3.5" />{showMachineSettings ? 'Hide Settings' : 'Show Settings'}
                </button>

                {/* Add Machine — orange; disabled while stopwatch running */}
                <button
                  onClick={() => { if (stopwatchRunning) return; loadAvailableMachines(); setSelectedAddMachineIds(new Set()); setShowAddMachine(true) }}
                  disabled={stopwatchRunning}
                  className={`flex items-center gap-1.5 px-4 py-2 rounded-md border text-xs font-semibold transition-colors ${stopwatchRunning ? 'border-slate-300 bg-slate-200 text-slate-400 cursor-not-allowed' : 'border-orange-400 bg-orange-500 text-white hover:bg-orange-600'}`}
                >
                  <Plus className="h-3.5 w-3.5" />Add Machine
                </button>

                {/* Finish Session / Cancel Session */}
                {!sessionStarted
                  ? <Button onClick={handleStartSession} className="h-10 text-sm font-bold px-4">Start Session</Button>
                  : completedMachineIds.size === 0
                    ? <Button
                        onClick={handleCancelSession}
                        disabled={stopwatchRunning || countdownRunning}
                        className="h-10 text-sm font-bold px-4 bg-red-600 hover:bg-red-700 border border-red-600 text-white disabled:opacity-50"
                      >Cancel Session</Button>
                    : <Button onClick={handleCompleteSessionClick} className="h-10 text-sm font-bold px-4 bg-green-600 hover:bg-green-700 text-white">Finish Session</Button>
                }
              </div>

              {/* Horizontally scrolling chip list */}
              <div className="flex gap-2 overflow-x-auto pb-1">
                {programMachines.map(pm => renderMachineChip(pm))}
              </div>
            </div>

            {/* ── Machine notes — below chip bar, above workout card ── */}
            {selectedMachine && !showWeightUpdate && (
              <div className="space-y-1 relative z-0">
                <Label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                  NOTES: {selectedMachine.machine.machine_code} | {selectedMachine.machine.machine_name}
                </Label>
                <div className="flex gap-2 items-start">
                  <Textarea
                    value={notes}
                    onChange={e => { if (hasPendingTile) { toast.error('Finish the current measurement before updating notes'); return } setNotes(e.target.value) }}
                    rows={1}
                    className="resize-none text-sm flex-1 min-h-[52px] max-h-[52px] border-slate-200"
                  />
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-9 shrink-0 border-slate-300 font-semibold"
                    onClick={editingMachineSessionId ? handleSaveNotes : handleSaveNotesStandalone}
                  >
                    Save
                  </Button>
                </div>
              </div>
            )}

            {/* ── Inline workout card ── */}
            {selectedMachine ? (
              <WorkoutCard
                selectedMachine={selectedMachine}
                measurementTypes={measurementTypes}
                selectedMeasurementType={selectedMeasurementType}
                selectedTileOccurrenceIdx={selectedTileOccurrenceIdx}
                recentMeasurementTypes={recentMeasurementTypes}
                tileWeights={tileWeights}
                tileReps={tileReps}
                tileTimes={tileTimes}
                completedMachineIds={completedMachineIds}
                skippedMachineIds={skippedMachineIds}
                pendingTileKeys={pendingTileKeys}
                hasPendingTile={hasPendingTile}
                editingMachineSessionId={editingMachineSessionId}
                pendingDeleteId={pendingDeleteId}
                pendingRemoveTile={pendingRemoveTile}
                stopwatchRunning={stopwatchRunning}
                stopwatchElapsedSeconds={stopwatchElapsedSeconds}
                isManualMode={isManualMode}
                manualTotalSeconds={manualTotalSeconds}
                countdownRunning={countdownRunning}
                countdownRemaining={countdownRemaining}
                countdownDone={countdownDone}
                weight={weight}
                reps={reps}
                isSaving={isSaving}
                canComplete={canComplete}
                is30Type={is30Type}
                isDateType={isDateType}
                isCheckboxOnly={isCheckboxOnly}
                needsTime={needsTime}
                needsWeight={needsWeight}
                needsReps={needsReps}
                overlayTimerRef={overlayTimerRef}
                handleSave={handleSave}
                handleStartStopwatch={handleStartStopwatch}
                handlePauseStopwatch={handlePauseStopwatch}
                handleResetStopwatch={handleResetStopwatch}
                markTilePending={markTilePending}
                stopwatchBaseSecondsRef={stopwatchBaseSecondsRef}
                stopwatchStartedAtRef={stopwatchStartedAtRef}
                setSelectedMeasurementType={setSelectedMeasurementType}
                setSelectedTileOccurrenceIdx={setSelectedTileOccurrenceIdx}
                setEditingMachineSessionId={setEditingMachineSessionId}
                setTileWeights={setTileWeights}
                setTileReps={setTileReps}
                setTileTimes={setTileTimes}
                setRecentMeasurementTypes={setRecentMeasurementTypes}
                setStopwatchBaseSeconds={setStopwatchBaseSeconds}
                setStopwatchElapsedSeconds={setStopwatchElapsedSeconds}
                setStopwatchStartedAt={setStopwatchStartedAt}
                setStopwatchRunning={setStopwatchRunning}
                setIsManualMode={setIsManualMode}
                setCountdownRunning={setCountdownRunning}
                setCountdownRemaining={setCountdownRemaining}
                setCountdownDone={setCountdownDone}
                setLbsPopupOpen={setLbsPopupOpen}
                setLbsPopupValue={setLbsPopupValue}
                setRepsPopupOpen={setRepsPopupOpen}
                setRepsPopupValue={setRepsPopupValue}
                setSecondsPopupOpen={setSecondsPopupOpen}
                setSecondsPopupValue={setSecondsPopupValue}
                setDiscardDialogOpen={setDiscardDialogOpen}
                setPendingDeleteId={setPendingDeleteId}
                setPendingRemoveTile={setPendingRemoveTile}
                setCompletedMachineIds={setCompletedMachineIds}
                setMachineFinishedOverlay={setMachineFinishedOverlay}
              />
            ) : (
              <Card><CardContent className="py-12 text-center text-slate-500">Select a machine above to begin</CardContent></Card>
            )}

            {/* ── History ── */}
            {selectedMachine && !showWeightUpdate && (
              <Card className="isolate">
                <CardHeader className="py-2 px-3"><CardTitle className="text-sm">Recent History</CardTitle></CardHeader>
                <CardContent className="p-0 pb-2">
                  {loadingHistory ? (
                    <div className="py-4 text-center text-slate-500">Loading...</div>
                  ) : !historyTableData ? (
                    <div className="py-4 text-center text-slate-500">No previous entries for this machine</div>
                  ) : (() => {
                    const { typeOrder, typeSubCols, dateOrder, byDate } = historyTableData
                    return (
                      <div className="overflow-x-auto max-h-[50vh] overflow-y-auto">
                        <table className="w-full text-xs border-collapse">
                          <thead>
                            <tr>
                              <th rowSpan={2} className="text-left py-1.5 px-3 font-semibold text-slate-700 border-b bg-slate-100 sticky top-0 z-10 whitespace-nowrap align-bottom">Date</th>
                              <th rowSpan={2} className="text-center py-1.5 px-2 font-semibold text-slate-700 border-b border-l border-slate-200 bg-slate-100 sticky top-0 z-10 align-bottom">R</th>
                              {typeOrder.map(t => (
                                <th key={t} colSpan={typeSubCols[t].length} className="text-center px-2 pt-1.5 pb-0.5 font-bold text-slate-700 border-l border-b border-slate-200 bg-slate-100 sticky top-0 z-10">{t}</th>
                              ))}
                              <th rowSpan={2} className="text-left py-1.5 px-2 font-semibold text-slate-700 border-b border-l border-slate-200 bg-slate-100 sticky top-0 z-10 align-bottom">Instr.</th>
                              <th rowSpan={2} className="text-left py-1.5 px-2 font-semibold text-slate-700 border-b border-l border-slate-200 bg-slate-100 sticky top-0 z-10 align-bottom">Loc.</th>
                            </tr>
                            <tr className="border-b">
                              {typeOrder.map(t =>
                                typeSubCols[t].map(sub => (
                                  <th key={`${t}-${sub}`} className="text-center px-2 pb-1.5 pt-0.5 font-medium text-slate-500 border-l border-b border-slate-200 bg-slate-100 sticky top-[29px] z-10">{sub === 'tick' ? '✓' : sub}</th>
                                ))
                              )}
                            </tr>
                          </thead>
                          <tbody>
                            {dateOrder.map((rowKey, i) => {
                              const entries = byDate.get(rowKey)!
                              const displayDate = rowKey.split('::')[0]
                              const isToday = displayDate === 'Today'
                              const rowCls = isToday ? 'border-b bg-green-50' : `border-b last:border-0 ${i % 2 === 0 ? 'bg-white' : 'bg-slate-50/60'}`
                              const textCls = isToday ? 'text-green-700' : 'text-slate-600'
                              const first = entries[0]
                              const byType = new Map<string, MachineHistoryEntry>()
                              for (const e of entries) byType.set(e.measurementType || '–', e)
                              return (
                                <tr key={rowKey} className={rowCls}>
                                  <td className={`py-1.5 px-3 whitespace-nowrap font-semibold ${textCls}`}>{displayDate}</td>
                                  <td className={`py-1.5 px-2 truncate max-w-[80px] border-l border-slate-100 ${textCls}`}>{first.routineName || '–'}</td>
                                  {typeOrder.map(col =>
                                    typeSubCols[col].map(sub => {
                                      const match = byType.get(col)
                                      return (
                                        <td key={`${col}-${sub}`} className={`py-1.5 px-2 font-mono text-center border-l border-slate-100 ${textCls}`}>
                                          {match ? (
                                            sub === 'tick' ? <span className="text-green-600 font-bold">✓</span> :
                                            sub === 'lbs' ? (match.weight_lbs ?? '–') :
                                            sub === 'time' ? (match.total_time_seconds != null ? fmtTime(match.total_time_seconds) : '–') :
                                            (match.reps ?? '–')
                                          ) : ''}
                                        </td>
                                      )
                                    })
                                  )}
                                  <td className={`py-1.5 px-2 truncate max-w-[80px] border-l border-slate-100 ${textCls}`}>{first.trainerName || '–'}</td>
                                  <td className={`py-1.5 px-2 truncate max-w-[90px] border-l border-slate-100 ${textCls}`}>{first.locationName || '–'}</td>
                                </tr>
                              )
                            })}
                          </tbody>
                        </table>
                      </div>
                    )
                  })()}
                </CardContent>
              </Card>
            )}
          </div>
        )}
      </main>

      {/* Back-press guard — session must be completed before leaving */}
      <AlertDialog open={abandonDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Session still in progress</AlertDialogTitle>
            <AlertDialogDescription>
              You must complete this session before leaving. Complete it now, or go back and finish recording.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setAbandonDialogOpen(false)}>
              Back to session
            </AlertDialogCancel>
            <AlertDialogAction
              className="bg-green-600 hover:bg-green-700"
              onClick={() => { setAbandonDialogOpen(false); handleCompleteSessionClick() }}
            >
              Finish session
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Unused machines check dialog — shown before completing session */}
      <AlertDialog open={completeCheckDialogOpen}>
        <AlertDialogContent className="sm:max-w-[480px]">
          <AlertDialogHeader>
            <AlertDialogTitle>Some machines weren&apos;t used</AlertDialogTitle>
            <AlertDialogDescription>
              The following machines have no recorded data this session. Would you like to mark them as skipped, or remove them from the routine?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="my-2 space-y-2 max-h-56 overflow-y-auto">
            {unusedMachinesForComplete.map(pm => (
              <div key={pm.id} className="flex items-center justify-between border rounded px-3 py-2 bg-slate-50">
                <span className="font-mono font-bold text-sm">{pm.machine.machine_code}</span>
                <span className="text-xs text-slate-500 flex-1 ml-2 truncate">{pm.machine.machine_name}</span>
                <div className="flex gap-2 shrink-0">
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs"
                    onClick={() => {
                      setSkippedMachineIds(prev => new Set([...prev, pm.machine_id]))
                      setUnusedMachinesForComplete(prev => prev.filter(m => m.id !== pm.id))
                    }}
                  >
                    Skip today
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200"
                    onClick={() => {
                      setCompleteCheckDialogOpen(false)
                      requestRemoveFromRoutine(pm)
                    }}
                  >
                    Remove
                  </Button>
                </div>
              </div>
            ))}
          </div>
          <AlertDialogFooter className="flex-col sm:flex-row gap-2 mt-2">
            <AlertDialogCancel onClick={() => setCompleteCheckDialogOpen(false)}>
              Back to session
            </AlertDialogCancel>
            {unusedMachinesForComplete.length > 0 && (
              <AlertDialogAction
                className="bg-amber-500 hover:bg-amber-600 text-white"
                onClick={handleMarkAllUnusedSkipped}
              >
                <SkipForward className="h-4 w-4 mr-1" />Mark all as skipped
              </AlertDialogAction>
            )}
            {unusedMachinesForComplete.length === 0 && (
              <AlertDialogAction onClick={() => { setCompleteCheckDialogOpen(false); doCompleteSession() }}>
                Finish Session
              </AlertDialogAction>
            )}
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Machine finished overlay */}
      {machineFinishedOverlay && (
        <div className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none">
          <div className="bg-green-600 text-white rounded-2xl shadow-2xl px-10 py-8 flex flex-col items-center gap-3 animate-in fade-in zoom-in duration-200">
            <CheckCircle2 className="h-12 w-12" />
            <p className="text-xl font-bold">Machine finished successfully</p>
          </div>
        </div>
      )}

      {/* Session completed overlay */}
      {sessionCompletedOverlay && (
        <div className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none">
          <div className="bg-green-600 text-white rounded-2xl shadow-2xl px-10 py-8 flex flex-col items-center gap-3 animate-in fade-in zoom-in duration-200">
            <CheckCircle2 className="h-12 w-12" />
            <p className="text-xl font-bold">Session completed successfully</p>
          </div>
        </div>
      )}

      {/* Next session weight popup */}
      <Dialog open={showWeightUpdate} onOpenChange={open => { if (!open) handleUpdateProgramWeight(true) }}>
        <DialogContent className="!top-[15%] !translate-y-0 max-w-xs">
          <DialogHeader>
            <DialogTitle>Set Weight for Next Session</DialogTitle>
          </DialogHeader>
          <div className="flex items-center gap-3 py-2 justify-center">
            <Button variant="outline" size="icon" onClick={() => setNewProgramWeight(w => Math.max(0, parseFloat(w || '0') - 2).toString())}>
              <Minus className="h-4 w-4" />
            </Button>
            <Input
              type="number" step="2" min="0" value={newProgramWeight}
              onChange={e => setNewProgramWeight(e.target.value)}
              onBlur={e => { const v = Math.round(parseFloat(e.target.value || '0') / 2) * 2; setNewProgramWeight(v.toString()) }}
              className="text-2xl font-bold text-center h-14 w-28"
              autoFocus
            />
            <Button variant="outline" size="icon" onClick={() => setNewProgramWeight(w => (parseFloat(w || '0') + 2).toString())}>
              <Plus className="h-4 w-4" />
            </Button>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => handleUpdateProgramWeight(true)}>Skip</Button>
            <Button onClick={() => handleUpdateProgramWeight(false)}>Set</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* lbs entry popup */}
      <Dialog open={lbsPopupOpen} onOpenChange={open => { if (!open) setLbsPopupOpen(false) }}>
        <DialogContent className="!top-[15%] !translate-y-0 max-w-xs">
          <DialogHeader>
            <DialogTitle>Enter weight (lbs)</DialogTitle>
          </DialogHeader>
          <div className="flex items-center gap-3 py-2 justify-center">
            <Button variant="outline" size="icon" onClick={() => setLbsPopupValue(v => Math.max(0, Math.round((parseFloat(v || '0') - 2) / 2) * 2).toString())}>
              <Minus className="h-4 w-4" />
            </Button>
            <Input
              type="number" step="2" min="0"
              value={lbsPopupValue}
              onChange={e => setLbsPopupValue(e.target.value)}
              onBlur={e => { const v = Math.round(parseFloat(e.target.value || '0') / 2) * 2; setLbsPopupValue(v.toString()) }}
              className="text-2xl font-bold text-center h-14 w-28"
              autoFocus
            />
            <Button variant="outline" size="icon" onClick={() => setLbsPopupValue(v => (Math.round(parseFloat(v || '0') / 2) * 2 + 2).toString())}>
              <Plus className="h-4 w-4" />
            </Button>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setLbsPopupOpen(false)}>Cancel</Button>
            <Button onClick={() => {
              const v = Math.round(parseFloat(lbsPopupValue || '0') / 2) * 2
              const vs = v.toString()
              setWeight(vs)
              if (selectedMeasurementType && selectedMachine) {
                const key = `${selectedMachine.machine_id}:${selectedMeasurementType.id}:${selectedTileOccurrenceIdx}`
                setTileWeights(prev => new Map(prev).set(key, vs))
                if (vs) markTilePending(key)
              }
              setLbsPopupOpen(false)
            }}>Set</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reps entry popup */}
      <Dialog open={repsPopupOpen} onOpenChange={open => { if (!open) setRepsPopupOpen(false) }}>
        <DialogContent className="!top-[15%] !translate-y-0 max-w-xs">
          <DialogHeader>
            <DialogTitle>Enter reps</DialogTitle>
          </DialogHeader>
          <div className="flex items-center gap-3 py-2 justify-center">
            <Button variant="outline" size="icon" onClick={() => setRepsPopupValue(v => Math.max(1, parseInt(v || '1') - 1).toString())}>
              <Minus className="h-4 w-4" />
            </Button>
            <Input
              type="number" min="1"
              value={repsPopupValue}
              onChange={e => setRepsPopupValue(e.target.value)}
              className="text-2xl font-bold text-center h-14 w-28"
              autoFocus
            />
            <Button variant="outline" size="icon" onClick={() => setRepsPopupValue(v => (parseInt(v || '0') + 1).toString())}>
              <Plus className="h-4 w-4" />
            </Button>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRepsPopupOpen(false)}>Cancel</Button>
            <Button
              disabled={!repsPopupValue || parseInt(repsPopupValue) < 1}
              onClick={() => {
                const val = parseInt(repsPopupValue)
                if (!val || val < 1) { toast.error('Reps must be at least 1'); return }
                const vs = val.toString()
                setReps(vs)
                if (selectedMeasurementType && selectedMachine) {
                  const key = `${selectedMachine.machine_id}:${selectedMeasurementType.id}:${selectedTileOccurrenceIdx}`
                  setTileReps(prev => new Map(prev).set(key, vs))
                  markTilePending(key)
                }
                setRepsPopupOpen(false)
              }}
            >Set</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Seconds (time) entry popup */}
      <Dialog open={secondsPopupOpen} onOpenChange={open => { if (!open) setSecondsPopupOpen(false) }}>
        <DialogContent className="!top-[15%] !translate-y-0 max-w-xs">
          <DialogHeader>
            <DialogTitle>Enter time (seconds)</DialogTitle>
          </DialogHeader>
          <div className="flex items-center gap-3 py-2 justify-center">
            <Button variant="outline" size="icon" onClick={() => setSecondsPopupValue(v => Math.max(0, parseInt(v || '0') - 5).toString())}>
              <Minus className="h-4 w-4" />
            </Button>
            <Input
              type="number" min="0"
              value={secondsPopupValue}
              onChange={e => setSecondsPopupValue(e.target.value)}
              className="text-2xl font-bold text-center h-14 w-28"
              autoFocus
            />
            <Button variant="outline" size="icon" onClick={() => setSecondsPopupValue(v => (parseInt(v || '0') + 5).toString())}>
              <Plus className="h-4 w-4" />
            </Button>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSecondsPopupOpen(false)}>Cancel</Button>
            <Button onClick={() => {
              const val = parseInt(secondsPopupValue || '0')
              if (val <= 0) { toast.error('Time must be greater than 0'); return }
              setManualTotalSeconds(secondsPopupValue)
              setIsManualMode(true)
              setStopwatchBaseSeconds(val)
              setStopwatchElapsedSeconds(val)
              if (selectedMeasurementType && selectedMachine) {
                const key = `${selectedMachine.machine_id}:${selectedMeasurementType.id}:${selectedTileOccurrenceIdx}`
                setTileTimes(prev => new Map(prev).set(key, secondsPopupValue))
                markTilePending(key)
              }
              setSecondsPopupOpen(false)
            }}>Set</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Discard all measurements for current machine */}
      <AlertDialog open={discardDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Discard measurements?</AlertDialogTitle>
            <AlertDialogDescription>
              Discard all measurements for current machine?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-row justify-center gap-8 sm:gap-12">
            <AlertDialogCancel onClick={() => setDiscardDialogOpen(false)} className="flex-1 max-w-[140px]">Keep</AlertDialogCancel>
            <AlertDialogAction
              className="flex-1 max-w-[140px] bg-red-600 hover:bg-red-700"
              onClick={handleDiscardMachineMeasurements}
            >
              Discard
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete single measurement entry */}
      <AlertDialog open={!!pendingDeleteId} onOpenChange={open => { if (!open) setPendingDeleteId(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete measurement?</AlertDialogTitle>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-row justify-center gap-8 sm:gap-12">
            <AlertDialogCancel onClick={() => setPendingDeleteId(null)} className="flex-1 max-w-[140px]">Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="flex-1 max-w-[140px] bg-red-600 hover:bg-red-700"
              onClick={() => { if (pendingDeleteId) handleDeleteMachineSession(pendingDeleteId) }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Remove unsaved MT tile (no DB record — just removes from tile list) */}
      <AlertDialog open={!!pendingRemoveTile} onOpenChange={open => { if (!open) setPendingRemoveTile(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove {pendingRemoveTile?.mt.abbreviation}?</AlertDialogTitle>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-row justify-center gap-8 sm:gap-12">
            <AlertDialogCancel onClick={() => setPendingRemoveTile(null)} className="flex-1 max-w-[140px]">Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="flex-1 max-w-[140px] bg-red-600 hover:bg-red-700"
              onClick={() => {
                if (!pendingRemoveTile) return
                const { mt, occurrenceIdx, tileKey } = pendingRemoveTile
                clearTilePending(tileKey)
                setTileWeights(prev => { const next = new Map(prev); next.delete(tileKey); return next })
                setTileReps(prev => { const next = new Map(prev); next.delete(tileKey); return next })
                setTileTimes(prev => { const next = new Map(prev); next.delete(tileKey); return next })
                setRecentMeasurementTypes(prev => {
                  const next = [...prev]
                  let seen = 0
                  const removeAt = next.findIndex(m => {
                    if (m.id === mt.id) {
                      if (seen === occurrenceIdx) return true
                      seen++
                    }
                    return false
                  })
                  if (removeAt !== -1) next.splice(removeAt, 1)
                  // If no tiles remain, also clear the selected MT so the fallback
                  // inputs (with the pencil button) don't appear.
                  if (next.length === 0) setSelectedMeasurementType(null)
                  return next
                })
                setPendingRemoveTile(null)
              }}
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* X button dialog — cancel for today or remove from routine */}
      <AlertDialog open={!!skipDialogMachine}>
        <AlertDialogContent className="max-w-sm w-[92vw]">
          <AlertDialogHeader className="text-center">
            <AlertDialogTitle>{skipDialogMachine?.machine.machine_code}</AlertDialogTitle>
            <AlertDialogDescription className="text-center">
              Cancel machine for today only<br />or remove from today&apos;s routine?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="!grid !grid-cols-3 gap-2 mt-2">
            <AlertDialogCancel onClick={() => setSkipDialogMachine(null)} className="text-xs px-2">Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-amber-500 hover:bg-amber-600 text-white text-xs px-2"
              onClick={() => skipDialogMachine && handleSkipForToday(skipDialogMachine)}
            >
              One Time
            </AlertDialogAction>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700 text-white text-xs px-1"
              onClick={() => skipDialogMachine && requestRemoveFromRoutine(skipDialogMachine)}
            >
              Update Routine
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Add Machine — machine picker modal */}
      <Dialog open={showAddMachine} onOpenChange={open => { if (!open) { setShowAddMachine(false); setSelectedAddMachineIds(new Set()) } }}>
        <DialogContent className="max-w-sm w-[92vw] max-h-[80vh] flex flex-col p-0">
          <DialogHeader className="px-4 pt-4 pb-2 shrink-0">
            <DialogTitle className="text-base">Add Machine</DialogTitle>
          </DialogHeader>
          <div className="overflow-y-auto flex-1 px-3 pb-2">
            {availableMachines.length === 0 ? (
              <p className="text-sm text-slate-500 text-center py-6">All machines already in session</p>
            ) : (
              <div className="grid grid-cols-3 gap-2 py-1">
                {availableMachines.map(m => {
                  const selected = selectedAddMachineIds.has(m.id)
                  return (
                    <button
                      key={m.id}
                      onClick={() => setSelectedAddMachineIds(prev => {
                        const next = new Set(prev)
                        selected ? next.delete(m.id) : next.add(m.id)
                        return next
                      })}
                      className={`rounded-lg border-2 px-2 py-3 text-center transition-colors ${
                        selected
                          ? 'border-blue-600 bg-blue-50 text-blue-700'
                          : 'border-slate-200 bg-white text-slate-800 hover:border-slate-400'
                      }`}
                    >
                      <div className="text-base font-bold font-mono leading-tight">{m.machine_code}</div>
                      <div className="text-[10px] text-slate-500 mt-0.5 truncate">{m.machine_name}</div>
                    </button>
                  )
                })}
              </div>
            )}
          </div>
          <DialogFooter className="px-4 py-3 border-t shrink-0 flex flex-row gap-2 justify-end">
            <Button variant="outline" onClick={() => { setShowAddMachine(false); setSelectedAddMachineIds(new Set()) }}>
              Cancel
            </Button>
            <Button
              disabled={selectedAddMachineIds.size === 0 || addingMachine}
              onClick={() => { setPendingAddMachineIds([...selectedAddMachineIds]); setShowAddMachine(false) }}
              className="bg-orange-500 hover:bg-orange-600 text-white"
            >
              {addingMachine ? 'Adding…' : `Add Machine${selectedAddMachineIds.size > 1 ? `s (${selectedAddMachineIds.size})` : ''}`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add machine confirmation — one time (session only) or update routine permanently */}
      <AlertDialog open={pendingAddMachineIds.length > 0}>
        <AlertDialogContent className="max-w-sm w-[92vw]">
          <AlertDialogHeader>
            <AlertDialogTitle>
              {pendingAddMachineIds.length === 1
                ? availableMachines.find(m => m.id === pendingAddMachineIds[0])?.machine_code ?? 'Add Machine'
                : `Add ${pendingAddMachineIds.length} Machines`}
            </AlertDialogTitle>
            <AlertDialogDescription>
              Add {pendingAddMachineIds.length === 1 ? 'machine' : 'machines'} for today only or update today&apos;s routine?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="!grid !grid-cols-3 gap-2">
            <AlertDialogCancel onClick={() => { setPendingAddMachineIds([]); setSelectedAddMachineIds(new Set()) }}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-amber-500 hover:bg-amber-600 text-white text-xs px-2"
              onClick={() => handleAddMachineToRoutine(pendingAddMachineIds, false)}
            >
              One Time
            </AlertDialogAction>
            <AlertDialogAction
              className="bg-blue-600 hover:bg-blue-700 text-white text-xs px-2"
              onClick={() => handleAddMachineToRoutine(pendingAddMachineIds, true)}
            >
              Update Routine
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Update routine — confirmation before permanent removal */}
      <AlertDialog open={!!removeConfirmMachine}>
        <AlertDialogContent className="max-w-sm w-[92vw]">
          <AlertDialogHeader className="text-center">
            <AlertDialogTitle className="text-base leading-snug">Remove {removeConfirmMachine?.machine.machine_code} from Routine?</AlertDialogTitle>
            <AlertDialogDescription className="text-center">{program?.name}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-4">
            <AlertDialogCancel onClick={() => setRemoveConfirmMachine(null)}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700"
              onClick={() => removeConfirmMachine && handleRemoveFromRoutine(removeConfirmMachine)}
            >
              Remove from routine
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
