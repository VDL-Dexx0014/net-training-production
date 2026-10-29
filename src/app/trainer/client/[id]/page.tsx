// src/app/trainer/client/[id]/page.tsx
// Client detail view with 3 tabs: Client Info, Routines, Session History

'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter, useParams, useSearchParams } from 'next/navigation'
import { useAuthStore } from '@/store/auth-store'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
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
import { ArrowLeft, User, Calendar, Plus, PlayCircle, Clock, Mail, Phone, Edit, Archive, Trash2, AlertTriangle, ClipboardList, Activity, Info } from 'lucide-react'
import Image from 'next/image'
import { Database } from '@/types/database.types'
import { formatName } from '@/lib/utils/name-formatter'
import { formatDate } from '@/lib/utils/date-formatter'
import { formatPhoneNumber, formatPhoneInput } from '@/lib/utils/phone-formatter'
import { ProgramSessionOverview } from '@/components/program/ProgramSessionOverview'
import { CreateRoutineDialog } from '@/components/program/CreateRoutineDialog'
import { SessionsHistoryView } from '@/components/history/SessionsHistoryView'
import { MachineHistoryView } from '@/components/history/MachineHistoryView'
import { toast } from 'sonner'

type Program = Database['public']['Tables']['programs']['Row']
type Profile = {
  id: string
  first_name: string
  last_name: string
  email: string
  fitness_goals: string | null
  phone: string | null
  high_risk: boolean
  intensity: 'extra_low' | 'low' | 'medium' | 'high' | 'extra_high' | null
  notes: string | null
  email_opt_in: boolean
  is_active: boolean
}

type ProgramWithMachines = Program & {
  program_machines: Array<{
    id: string
    machine_id: string
    order_index: number
    current_weight: number | null
    current_reps: number | null
    current_sets: number | null
    machines: {
      id: string
      machine_name: string
      machine_code: string
    }
  }>
  lastCompletedDate?: string | null
  lastSessionId?: string | null
}

interface LastSessionInfo {
  date: string
  routineName: string | null
  trainerName: string | null
  locationName: string | null
}

const INTENSITY_OPTIONS = [
  { value: 'extra_low', label: 'Extra Low' },
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
  { value: 'extra_high', label: 'Extra High' },
]

export default function ClientDetailPage() {
  const router = useRouter()
  const params = useParams()
  const searchParams = useSearchParams()
  const { user, profile: trainerProfile, loading: authLoading, hasRole } = useAuthStore()
  const [client, setClient] = useState<Profile | null>(null)
  const [programs, setPrograms] = useState<ProgramWithMachines[]>([])
  const [completedSessionsCount, setCompletedSessionsCount] = useState(0)
  const [lastSession, setLastSession] = useState<LastSessionInfo | null>(null)
  const [trainerLocationId, setTrainerLocationId] = useState<string | null>(null)
  const [trainerLocationName, setTrainerLocationName] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [startingProgramId, setStartingProgramId] = useState<string | null>(null)

  // Edit mode state
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [editForm, setEditForm] = useState({
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
    high_risk: false,
    intensity: '' as string,
    notes: '',
    email_opt_in: false,
  })
  const [saving, setSaving] = useState(false)

  // Archive/Delete dialogs
  const [archiveDialogOpen, setArchiveDialogOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [actionLoading, setActionLoading] = useState(false)
  const [sessionCount, setSessionCount] = useState(0)

  // Create routine dialog
  const [createRoutineDialogOpen, setCreateRoutineDialogOpen] = useState(false)

  // Active tab state
  const [activeTab, setActiveTab] = useState<string>('routines')
  const [historyView, setHistoryView] = useState<'sessions' | 'machine'>('sessions')

  // Machine stats dialog
  const [machineStatsOpen, setMachineStatsOpen] = useState(false)
  const [selectedMachineId, setSelectedMachineId] = useState<string | null>(null)
  const [selectedMachineName, setSelectedMachineName] = useState<string>('')
  const [selectedMachineCode, setSelectedMachineCode] = useState<string>('')
  const [machineStats, setMachineStats] = useState<any[]>([])
  const [loadingMachineStats, setLoadingMachineStats] = useState(false)

  // Session details dialog
  const [sessionDetailsOpen, setSessionDetailsOpen] = useState(false)
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null)
  const [sessionDetails, setSessionDetails] = useState<any>(null)
  const [sessionMachineData, setSessionMachineData] = useState<any[]>([])
  const [loadingSessionDetails, setLoadingSessionDetails] = useState(false)

  const clientId = params?.id as string
  const returnTab = searchParams?.get('returnTab') || 'locations'
  const initialTab = searchParams?.get('tab') || 'routines'

  // Set initial tab from URL parameter
  useEffect(() => {
    if (initialTab) {
      setActiveTab(initialTab)
    }
  }, [initialTab])

  // Ref so the popstate listener always calls the latest handleBack without stale closure
  const handleBackRef = useRef<() => void>(() => {})

  // Android/browser back button: intercept popstate and use our handleBack logic
  useEffect(() => {
    // Push a dummy entry so there's a state to pop back from
    window.history.pushState({ clientDetail: true }, '')
    const onPopState = () => handleBackRef.current()
    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  }, [])

  // Read selected location from localStorage (set by dashboard location picker)
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('selectedLocation')
      if (stored) {
        try {
          const parsed = JSON.parse(stored)
          if (parsed?.id) {
            setTrainerLocationId(parsed.id)
            setTrainerLocationName(parsed.name || null)
          }
        } catch {
          // Ignore parse errors
        }
      }
    }
  }, [])

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login')
      return
    }

    if (trainerProfile && clientId) {
      loadClientData()
    }
  }, [user, trainerProfile, authLoading, clientId, router])

  const loadClientData = async () => {
    if (!trainerProfile?.id) return

    const supabase = createClient()
    setLoading(true)

    try {
      // Fetch client profile, programs, last session, and trainer location in parallel
      const [clientRes, programsRes, lastSessionRes, locationRes, totalSessionsRes] = await Promise.all([
        // Client profile with new fields
        supabase
          .from('profiles')
          .select('id, first_name, last_name, email, fitness_goals, phone, high_risk, intensity, notes, email_opt_in, is_active')
          .eq('id', clientId)
          .single(),
        // Programs with machines
        supabase
          .from('programs')
          .select(`
            *,
            program_machines (
              id,
              machine_id,
              order_index,
              current_weight,
              current_reps,
              current_sets,
              machines (
                id,
                machine_name,
                machine_code
              )
            )
          `)
          .eq('client_id', clientId)
          .order('created_at', { ascending: false }),
        // Last completed session — join program/trainer/location in one query
        supabase
          .from('sessions')
          .select('actual_start, program:programs(name), trainer:profiles!sessions_trainer_id_fkey(first_name, last_name), location:locations(name)')
          .eq('client_id', clientId)
          .eq('status', 'completed')
          .order('actual_start', { ascending: false })
          .limit(1),
        // Trainer's location(s)
        supabase
          .from('trainer_locations')
          .select('location_id')
          .eq('trainer_id', trainerProfile.id)
          .limit(1),
        // Total sessions count for this client (for delete check)
        supabase
          .from('sessions')
          .select('*', { count: 'exact', head: true })
          .eq('client_id', clientId),
      ])

      if (clientRes.error) {
        console.error('Error fetching client:', clientRes.error)
        return
      }

      const data = clientRes.data as any
      const clientData: Profile = {
        id: data.id,
        first_name: data.first_name,
        last_name: data.last_name,
        email: data.email,
        fitness_goals: data.fitness_goals,
        phone: data.phone,
        high_risk: data.high_risk ?? false,
        intensity: data.intensity ?? null,
        notes: data.notes ?? null,
        email_opt_in: data.email_opt_in ?? false,
        is_active: data.is_active ?? true,
      }

      setClient(clientData)
      setSessionCount(totalSessionsRes.count || 0)

      if (!programsRes.error && programsRes.data) {
        // Batch-fetch the last completed session for every program in one query
        const programIds = (programsRes.data as any[]).map(p => p.id)
        const { data: allLastSessions } = programIds.length > 0
          ? await supabase
              .from('sessions')
              .select('id, actual_start, program_id')
              .in('program_id', programIds)
              .eq('client_id', clientId)
              .eq('status', 'completed')
              .order('actual_start', { ascending: false })
          : { data: [] }

        // Keep only the most-recent session per program
        const lastSessionByProgram = new Map<string, { id: string; actual_start: string }>()
        for (const s of (allLastSessions as any[] | null) ?? []) {
          if (!lastSessionByProgram.has(s.program_id)) {
            lastSessionByProgram.set(s.program_id, s)
          }
        }

        const programsWithDates = (programsRes.data as any[]).map(program => {
          const lastSession = lastSessionByProgram.get(program.id)
          return {
            ...program,
            lastCompletedDate: lastSession?.actual_start || null,
            lastSessionId: lastSession?.id || null,
          }
        })
        const sortedPrograms = [...programsWithDates].sort((a: any, b: any) => {
          const aActive = a.status === 'active' ? 0 : 1
          const bActive = b.status === 'active' ? 0 : 1
          if (aActive !== bActive) return aActive - bActive
          const dateA = a.lastCompletedDate ? new Date(a.lastCompletedDate).getTime() : -1
          const dateB = b.lastCompletedDate ? new Date(b.lastCompletedDate).getTime() : -1
          if (dateA === -1 && dateB === -1) return 0
          if (dateA === -1) return 1
          if (dateB === -1) return -1
          return dateB - dateA
        })
        setPrograms(sortedPrograms as any)
      }

      // Last session enrichment — already joined in the query above
      if (lastSessionRes.data && lastSessionRes.data.length > 0) {
        const lastSess = lastSessionRes.data[0] as any
        const td = lastSess.trainer
        const trainerName = td ? [td.first_name, td.last_name?.charAt(0)].filter(Boolean).join(' ') + '.' : null
        setLastSession({
          date: lastSess.actual_start,
          routineName: lastSess.program?.name ?? null,
          trainerName,
          locationName: lastSess.location?.name ?? null,
        })
      }

      // Trainer location fallback - only set if not already set from localStorage
      // Use a callback to check current state without needing it in dependencies
      setTrainerLocationId((prevLocationId) => {
        // If already set from localStorage, don't override
        if (prevLocationId) return prevLocationId
        // Otherwise use the first trainer location as fallback
        if (locationRes.data && locationRes.data.length > 0) {
          return (locationRes.data[0] as any).location_id
        }
        return prevLocationId
      })

      // Count completed sessions for this trainer
      let sessionsQuery = supabase
        .from('sessions')
        .select('*', { count: 'exact', head: true })
        .eq('client_id', clientId)
        .eq('status', 'completed')

      if (hasRole('trainer')) {
        sessionsQuery = sessionsQuery.eq('trainer_id', trainerProfile.id)
      }

      const { count, error: countError } = await sessionsQuery

      if (!countError) {
        setCompletedSessionsCount(count || 0)
      }
    } catch (error) {
      console.error('Error loading client data:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleBack = () => {
    // Return to the clients tab with search preserved
    if (returnTab === 'clients') {
      router.push('/trainer/dashboard?tab=clients')
    } else {
      router.push(hasRole('management') && !hasRole('trainer') ? '/management/dashboard' : '/trainer/dashboard')
    }
  }
  // Keep popstate ref current so it always calls the latest version of handleBack
  handleBackRef.current = handleBack

  const handleStartSession = async (programId: string) => {
    if (!trainerProfile?.id || !clientId) return

    if (!trainerLocationId) {
      toast.error('No location selected. Go back to the dashboard and select a location first.')
      return
    }

    setStartingProgramId(programId)

    try {
      const supabase = createClient()
      const now = new Date()
      const endTime = new Date(now.getTime() + 60 * 60 * 1000) // +1 hour

      const { data, error } = await supabase.from('sessions').insert({
        trainer_id: trainerProfile.id,
        client_id: clientId,
        program_id: programId,
        location_id: trainerLocationId,
        scheduled_start: now.toISOString(),
        scheduled_end: endTime.toISOString(),
        actual_start: now.toISOString(),
        status: 'scheduled' as const,
      } as any).select().single()

      if (error) {
        console.error('Error creating session:', error)
        toast.error('Failed to start session')
        return
      }

      toast.success('Session started!')
      router.push(`/trainer/session/${(data as any).id}`)
    } catch (error) {
      console.error('Error starting session:', error)
      toast.error('Failed to start session')
    } finally {
      setStartingProgramId(null)
    }
  }

  const openEditDialog = () => {
    if (!client) return
    setEditForm({
      first_name: client.first_name,
      last_name: client.last_name,
      email: client.email,
      phone: client.phone || '',
      high_risk: client.high_risk,
      intensity: client.intensity || '',
      notes: client.notes || '',
      email_opt_in: client.email_opt_in,
    })
    setEditDialogOpen(true)
  }

  const handleSaveEdit = async () => {
    if (!client) return

    // Validation: if high_risk is checked, notes must be populated
    if (editForm.high_risk && !editForm.notes.trim()) {
      toast.error('Notes are required when High Risk is checked')
      return
    }

    setSaving(true)

    try {
      const res = await fetch('/api/trainer/update-client-profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientId: client.id,
          fields: {
            first_name: editForm.first_name,
            last_name: editForm.last_name,
            email: editForm.email,
            phone: editForm.phone || null,
            high_risk: editForm.high_risk,
            intensity: editForm.intensity || null,
            notes: editForm.notes || null,
            email_opt_in: editForm.email_opt_in,
          },
        }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        console.error('Error updating client:', body)
        toast.error('Failed to update client')
        return
      }

      toast.success('Client updated successfully')
      setEditDialogOpen(false)
      setClient(prev => prev ? {
        ...prev,
        first_name: editForm.first_name,
        last_name: editForm.last_name,
        email: editForm.email,
        phone: editForm.phone || null,
        high_risk: editForm.high_risk,
        intensity: (editForm.intensity || null) as any,
        notes: editForm.notes || null,
        email_opt_in: editForm.email_opt_in,
      } : prev)
    } catch (error) {
      console.error('Error updating client:', error)
      toast.error('Failed to update client')
    } finally {
      setSaving(false)
    }
  }

  const handleArchive = async () => {
    if (!client) return

    setActionLoading(true)
    const supabase = createClient()

    try {
      const { error } = await (supabase.from('profiles') as any)
        .update({
          is_active: false,
          updated_at: new Date().toISOString(),
        })
        .eq('id', client.id)

      if (error) {
        console.error('Error archiving client:', error)
        toast.error('Failed to archive client')
        return
      }

      toast.success('Client archived successfully')
      setArchiveDialogOpen(false)
      handleBack()
    } catch (error) {
      console.error('Error archiving client:', error)
      toast.error('Failed to archive client')
    } finally {
      setActionLoading(false)
    }
  }

  const handleDelete = async () => {
    if (!client) return

    setActionLoading(true)
    const supabase = createClient()

    try {
      // Delete related data in parallel, then the profile
      await Promise.all([
        supabase.from('trainer_clients').delete().eq('client_id', client.id),
        supabase.from('programs').delete().eq('client_id', client.id),
        supabase.from('user_machine_attribute_values').delete().eq('user_id', client.id),
      ])

      // Delete the profile
      const { error } = await supabase.from('profiles').delete().eq('id', client.id)

      if (error) {
        console.error('Error deleting client:', error)
        toast.error('Failed to delete client')
        return
      }

      toast.success('Client deleted permanently')
      setDeleteDialogOpen(false)
      handleBack()
    } catch (error) {
      console.error('Error deleting client:', error)
      toast.error('Failed to delete client')
    } finally {
      setActionLoading(false)
    }
  }

  const handleMachineClick = async (machineId: string, machineName: string, machineCode: string = '') => {
    setSelectedMachineId(machineId)
    setSelectedMachineName(machineName)
    setSelectedMachineCode(machineCode)
    setMachineStatsOpen(true)
    setLoadingMachineStats(true)

    const supabase = createClient()

    try {
      // Get all sessions for this client
      const { data: sessions } = await supabase
        .from('sessions')
        .select('id, actual_start, location_id, trainer_id')
        .eq('client_id', clientId)
        .eq('status', 'completed')
        .order('actual_start', { ascending: false })

      if (!sessions || sessions.length === 0) {
        setMachineStats([])
        return
      }

      // Get machine sessions for this machine
      const sessionIds = sessions.map((s: any) => s.id)
      const { data: machineSessions } = await supabase
        .from('machine_sessions')
        .select('id, session_id, weight_lbs, total_time_seconds, reps, start_time, measurement_type_id')
        .in('session_id', sessionIds)
        .eq('machine_id', machineId)
        .order('start_time', { ascending: false })
        .limit(10)

      if (!machineSessions || machineSessions.length === 0) {
        setMachineStats([])
        return
      }

      // Get unique location, trainer, and measurement type IDs
      const locationIds = [...new Set(sessions.map((s: any) => s.location_id).filter(Boolean))]
      const trainerIds = [...new Set(sessions.map((s: any) => s.trainer_id).filter(Boolean))]
      const measurementTypeIds = [...new Set(machineSessions.map((ms: any) => ms.measurement_type_id).filter(Boolean))]

      // Fetch names in parallel
      const [locationsRes, trainersRes, measurementTypesRes] = await Promise.all([
        locationIds.length > 0
          ? supabase.from('locations').select('id, name').in('id', locationIds)
          : Promise.resolve({ data: [] }),
        trainerIds.length > 0
          ? supabase.from('profiles').select('id, first_name, last_name').in('id', trainerIds)
          : Promise.resolve({ data: [] }),
        measurementTypeIds.length > 0
          ? supabase.from('measurement_types').select('id, abbreviation').in('id', measurementTypeIds)
          : Promise.resolve({ data: [] }),
      ])

      // Build lookup maps
      const locationMap = new Map<string, string>()
      if (locationsRes.data) {
        locationsRes.data.forEach((loc: any) => locationMap.set(loc.id, loc.name))
      }

      const trainerMap = new Map<string, string>()
      if (trainersRes.data) {
        trainersRes.data.forEach((t: any) => {
          const name = [t.first_name, t.last_name?.charAt(0)].filter(Boolean).join(' ')
          trainerMap.set(t.id, name ? `${name}.` : '')
        })
      }

      const measurementTypeMap = new Map<string, string>()
      if (measurementTypesRes.data) {
        measurementTypesRes.data.forEach((mt: any) => measurementTypeMap.set(mt.id, mt.abbreviation))
      }

      // Build session lookup
      const sessionMap = new Map<string, any>()
      sessions.forEach((s: any) => sessionMap.set(s.id, s))

      // Build stats entries
      const stats = machineSessions.map((ms: any) => {
        const session = sessionMap.get(ms.session_id)
        return {
          id: ms.id,
          date: formatDate(ms.start_time),
          weight_lbs: ms.weight_lbs,
          total_time_seconds: ms.total_time_seconds,
          reps: ms.reps,
          locationName: session?.location_id ? locationMap.get(session.location_id) || null : null,
          trainerName: session?.trainer_id ? trainerMap.get(session.trainer_id) || null : null,
          measurementType: ms.measurement_type_id ? measurementTypeMap.get(ms.measurement_type_id) || null : null,
        }
      })

      setMachineStats(stats)
    } catch (error) {
      console.error('Error loading machine stats:', error)
      setMachineStats([])
    } finally {
      setLoadingMachineStats(false)
    }
  }

  const formatTime = (seconds: number): string => `${seconds}`

  const handleViewSessionDetails = async (sessionId: string) => {
    setSelectedSessionId(sessionId)
    setSessionDetailsOpen(true)
    setLoadingSessionDetails(true)

    const supabase = createClient()

    try {
      // Fetch session row and its machine entries in parallel
      const [{ data: sessionData }, { data: machineSessionsData }] = await Promise.all([
        supabase
          .from('sessions')
          .select('id, actual_start, actual_end, location_id, trainer_id, program_id')
          .eq('id', sessionId)
          .single(),
        supabase
          .from('machine_sessions')
          .select('id, machine_id, weight_lbs, total_time_seconds, reps, start_time, measurement_type_id')
          .eq('session_id', sessionId)
          .order('start_time'),
      ])

      if (!sessionData) {
        setSessionDetails(null)
        setSessionMachineData([])
        return
      }

      const session = sessionData as any
      const machineIds = [...new Set((machineSessionsData || []).map((ms: any) => ms.machine_id))]
      const measurementTypeIds = [...new Set((machineSessionsData || []).map((ms: any) => ms.measurement_type_id).filter(Boolean))]

      // Fetch all lookup data in parallel
      const [locationRes, trainerRes, programRes, machinesRes, measurementTypesRes] = await Promise.all([
        session.location_id
          ? supabase.from('locations').select('name').eq('id', session.location_id).single()
          : Promise.resolve({ data: null as any }),
        session.trainer_id
          ? supabase.from('profiles').select('first_name, last_name').eq('id', session.trainer_id).single()
          : Promise.resolve({ data: null as any }),
        session.program_id
          ? supabase.from('programs').select('name').eq('id', session.program_id).single()
          : Promise.resolve({ data: null as any }),
        machineIds.length > 0
          ? supabase.from('machines').select('id, machine_code, machine_name').in('id', machineIds)
          : Promise.resolve({ data: [] as any[] }),
        measurementTypeIds.length > 0
          ? supabase.from('measurement_types').select('id, abbreviation').in('id', measurementTypeIds)
          : Promise.resolve({ data: [] as any[] }),
      ])

      const locationName: string | null = (locationRes.data as any)?.name || null

      let trainerName: string | null = null
      if (trainerRes.data) {
        const t = trainerRes.data as any
        trainerName = [t.first_name, t.last_name?.charAt(0)].filter(Boolean).join(' ')
        if (trainerName) trainerName += '.'
      }

      const routineName: string | null = (programRes.data as any)?.name || null

      const machineMap = new Map<string, any>()
      ;(machinesRes.data as any[] | null)?.forEach((m: any) => machineMap.set(m.id, m))

      const measurementTypeMap = new Map<string, string>()
      ;(measurementTypesRes.data as any[] | null)?.forEach((mt: any) => measurementTypeMap.set(mt.id, mt.abbreviation))

      // Set session details
      setSessionDetails({
        date: session.actual_start ? formatDate(session.actual_start) : 'Unknown',
        startTime: session.actual_start ? new Date(session.actual_start).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : null,
        endTime: session.actual_end ? new Date(session.actual_end).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : null,
        locationName,
        trainerName,
        routineName,
      })

      // Format machine session data
      const formattedMachineData = (machineSessionsData || []).map((ms: any) => {
        const machine = machineMap.get(ms.machine_id)
        return {
          id: ms.id,
          machineCode: machine?.machine_code || 'Unknown',
          machineName: machine?.machine_name || 'Unknown',
          weight_lbs: ms.weight_lbs,
          total_time_seconds: ms.total_time_seconds,
          reps: ms.reps,
          measurementType: ms.measurement_type_id ? measurementTypeMap.get(ms.measurement_type_id) || null : null,
        }
      })

      setSessionMachineData(formattedMachineData)
    } catch (error) {
      console.error('Error loading session details:', error)
      setSessionDetails(null)
      setSessionMachineData([])
    } finally {
      setLoadingSessionDetails(false)
    }
  }

  const getRoutineBorderColor = (lastCompletedDate: string | null | undefined) => {
    if (!lastCompletedDate) return 'border-slate-200' // Never completed - gray

    const now = new Date()
    const lastDate = new Date(lastCompletedDate)
    const daysDiff = Math.floor((now.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24))

    if (daysDiff <= 7) return 'border-green-500' // Within 1 week - green
    if (daysDiff <= 14) return 'border-yellow-500' // Within 2 weeks - yellow
    if (daysDiff <= 30) return 'border-orange-500' // Within 1 month - orange
    return 'border-red-500' // Over 1 month - red
  }

  const getStatusBadgeVariant = (status: Program['status']) => {
    switch (status) {
      case 'active':
        return 'default'
      case 'completed':
        return 'secondary'
      case 'archived':
        return 'outline'
      default:
        return 'default'
    }
  }

  const getIntensityLabel = (intensity: string | null) => {
    if (!intensity) return 'Not set'
    const option = INTENSITY_OPTIONS.find(o => o.value === intensity)
    return option?.label || intensity
  }

  const INTENSITY_STYLE: Record<string, string> = {
    extra_low: 'bg-red-100 text-red-700 border-red-200',
    low:       'bg-orange-100 text-orange-700 border-orange-200',
    medium:    'bg-yellow-100 text-yellow-700 border-yellow-200',
    high:      'bg-green-100 text-green-700 border-green-200',
    extra_high:'bg-emerald-100 text-emerald-700 border-emerald-200',
  }

  const activeRoutinesCount = programs.filter(p => p.status === 'active').length
  const isManagement = hasRole('management')

  if (loading || authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-lg">Loading client...</div>
      </div>
    )
  }

  if (!client) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-lg">Client not found</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Single combined header — back + client info left, logo right */}
      <header className="bg-white border-b sticky top-0 z-40">
        <div className="container mx-auto px-3 py-1.5 flex justify-between items-center gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <Button
              variant="outline"
              size="icon"
              onClick={handleBack}
              className="h-8 w-8 shrink-0 border-2 border-slate-400 hover:border-slate-600 hover:bg-slate-100"
            >
              <ArrowLeft className="h-4 w-4 stroke-[2.5]" />
            </Button>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-base font-bold leading-tight">
                  {client.first_name} {client.last_name}
                </h1>
                {client.intensity && (
                  <Badge variant="outline" className={`text-xs ${INTENSITY_STYLE[client.intensity] || ''}`}>
                    {getIntensityLabel(client.intensity)}
                  </Badge>
                )}
                {client.high_risk && (
                  <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-700">High Risk</span>
                )}
                {!client.is_active && (
                  <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 text-xs">
                    Archived
                  </Badge>
                )}
                {isManagement && sessionCount === 0 && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs text-red-600 border-red-300 hover:bg-red-50"
                    onClick={() => setDeleteDialogOpen(true)}
                  >
                    <Trash2 className="h-3 w-3 mr-1" />Delete
                  </Button>
                )}
              </div>
              {trainerLocationName && (
                <p className="text-xs text-slate-500 leading-tight">{trainerLocationName}</p>
              )}
            </div>
          </div>
          <div className="shrink-0">
            <div style={{ backgroundColor: 'rgb(227, 221, 45)' }} className="flex items-center justify-center h-8 px-3 rounded">
              <Image src="/net_logo_new.png" alt="NET" width={72} height={24} className="object-contain" style={{ width: 'auto', height: '20px' }} priority />
            </div>
          </div>
        </div>
      </header>

      {/* Main Content with Tabs */}
      <main className="container mx-auto px-3 pt-1 pb-3">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <div className="sticky top-[45px] z-30 bg-slate-50 pb-1 pt-1">
          <TabsList className="w-full justify-start rounded-xl bg-slate-100 p-1 h-auto gap-[1mm]">
            <TabsTrigger
              value="routines"
              className="px-4 py-1.5 rounded-lg font-bold text-sm !bg-emerald-600 !text-white data-[state=active]:!opacity-100 data-[state=active]:!shadow-md data-[state=inactive]:!opacity-50 transition-all"
            >
              Routines
            </TabsTrigger>
            <TabsTrigger
              value="history"
              className="px-4 py-1.5 rounded-lg font-bold text-sm !bg-violet-600 !text-white data-[state=active]:!opacity-100 data-[state=active]:!shadow-md data-[state=inactive]:!opacity-50 transition-all"
            >
              History
            </TabsTrigger>
            <TabsTrigger
              value="info"
              className="px-4 py-1.5 rounded-lg font-bold text-sm !bg-blue-600 !text-white data-[state=active]:!opacity-100 data-[state=active]:!shadow-md data-[state=inactive]:!opacity-50 transition-all"
            >
              Client Info
            </TabsTrigger>
          </TabsList>
          </div>

          {/* Tab 1: Client Info */}
          <TabsContent value="info">
            <Card>
              <CardContent className="pt-3 pb-3">
                {/* Edit + Archive buttons — top right inside card */}
                <div className="flex justify-end gap-2 mb-2">
                  {isManagement && client.is_active && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 text-xs text-amber-600 border-amber-300 hover:bg-amber-50"
                      onClick={() => setArchiveDialogOpen(true)}
                    >
                      <Archive className="h-3.5 w-3.5 mr-1" />Archive
                    </Button>
                  )}
                  <Button variant="outline" size="sm" onClick={openEditDialog} className="h-8 text-xs">
                    <Edit className="h-3.5 w-3.5 mr-1" />Edit
                  </Button>
                </div>

                {/* Two-column grid */}
                <div className="grid grid-cols-2 gap-x-4">

                  {/* Row 1 */}
                  <div className="flex items-start gap-2 py-1.5 border-b border-slate-100">
                    <User className="h-3.5 w-3.5 text-slate-400 mt-0.5 shrink-0" />
                    <div><p className="text-xs text-slate-500">First Name</p><p className="font-medium text-sm">{client.first_name}</p></div>
                  </div>
                  <div className="flex items-start gap-2 py-1.5 border-b border-slate-100">
                    <User className="h-3.5 w-3.5 text-slate-400 mt-0.5 shrink-0" />
                    <div><p className="text-xs text-slate-500">Last Name</p><p className="font-medium text-sm">{client.last_name}</p></div>
                  </div>

                  {/* Row 2 */}
                  <div className="flex items-start gap-2 py-1.5 border-b border-slate-100">
                    <Phone className="h-3.5 w-3.5 text-slate-400 mt-0.5 shrink-0" />
                    <div><p className="text-xs text-slate-500">Phone</p><p className="font-medium text-sm">{formatPhoneNumber(client.phone)}</p></div>
                  </div>
                  <div className="flex items-start gap-2 py-1.5 border-b border-slate-100">
                    <Mail className="h-3.5 w-3.5 text-slate-400 mt-0.5 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-slate-500">Email</p>
                      <p className="font-medium text-sm break-all">{client.email}</p>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0 ml-2">
                      <span className="text-xs text-slate-500 whitespace-nowrap">Opt In</span>
                      <input
                        type="checkbox"
                        checked={client.email_opt_in}
                        readOnly
                        className="h-4 w-4 accent-blue-600 cursor-default rounded"
                      />
                    </div>
                  </div>

                  {/* Row 3 */}
                  <div className="flex items-start gap-2 py-1.5 border-b border-slate-100">
                    <Activity className="h-3.5 w-3.5 text-slate-400 mt-0.5 shrink-0" />
                    <div><p className="text-xs text-slate-500">Intensity</p><p className="font-medium text-sm">{getIntensityLabel(client.intensity)}</p></div>
                  </div>
                  <div className="flex items-start gap-2 py-1.5 border-b border-slate-100">
                    <Clock className="h-3.5 w-3.5 text-slate-400 mt-0.5 shrink-0" />
                    <div>
                      <p className="text-xs text-slate-500">Last Session</p>
                      {lastSession ? (
                        <p className="font-medium text-sm">
                          {[
                            formatDate(lastSession.date),
                            lastSession.routineName,
                            lastSession.trainerName,
                            lastSession.locationName,
                          ].filter(Boolean).join(' | ')}
                        </p>
                      ) : <p className="font-medium text-sm">Never</p>}
                    </div>
                  </div>

                  {/* Row 4 */}
                  <div className={`flex items-start gap-2 py-1.5 border-b ${client.high_risk ? 'border-red-200 bg-red-50' : 'border-slate-100'}`}>
                    <AlertTriangle className={`h-3.5 w-3.5 mt-0.5 shrink-0 ${client.high_risk ? 'text-red-500' : 'text-slate-400'}`} />
                    <div>
                      <p className="text-xs text-slate-500">Risk Profile</p>
                      {client.high_risk ? (
                        <a href="#notes-section" className="font-medium text-sm text-red-600 hover:underline"
                          onClick={e => { e.preventDefault(); document.getElementById('notes-section')?.scrollIntoView({ behavior: 'smooth' }) }}>
                          High Risk — View Notes
                        </a>
                      ) : <p className="font-medium text-sm">—</p>}
                    </div>
                  </div>
                  <div className={`flex items-start gap-2 py-1.5 border-b ${client.high_risk ? 'border-red-200 bg-red-50' : 'border-slate-100'}`}>
                    <ClipboardList className={`h-3.5 w-3.5 mt-0.5 shrink-0 ${client.high_risk ? 'text-red-500' : 'text-slate-400'}`} />
                    <div><p className="text-xs text-slate-500">Notes</p>
                      <div id="notes-section" className="scroll-mt-4">
                        <p className={`font-medium text-sm whitespace-pre-wrap ${client.high_risk ? 'text-red-700' : ''}`}>{client.notes || 'No notes'}</p>
                      </div>
                    </div>
                  </div>

                  {/* Row 5 */}
                  <div className="flex items-start gap-2 py-1.5">
                    <ClipboardList className="h-3.5 w-3.5 text-slate-400 mt-0.5 shrink-0" />
                    <div><p className="text-xs text-slate-500">Active Routines</p><p className="font-medium text-xl">{activeRoutinesCount}</p></div>
                  </div>
                  <div className="flex items-start gap-2 py-1.5">
                    <Calendar className="h-3.5 w-3.5 text-slate-400 mt-0.5 shrink-0" />
                    <div><p className="text-xs text-slate-500">Completed Sessions</p><p className="font-medium text-xl">{completedSessionsCount}</p></div>
                  </div>

                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Tab 2: Routines */}
          <TabsContent value="routines">
            <div className="sticky top-[83px] z-10 bg-slate-50 py-1 mb-1 flex items-center justify-end">
              <Button size="sm" onClick={() => setCreateRoutineDialogOpen(true)}>
                <Plus className="h-4 w-4 mr-1" />
                Create Routine
              </Button>
            </div>

            {programs.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center text-slate-500">
                  <p className="text-lg mb-2">No routines yet</p>
                  <p className="text-sm">
                    Create a routine to get started with this client
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {programs.map((program) => (
                  <Card
                    key={program.id}
                    className="border border-slate-200 transition-all hover:shadow-md"
                  >
                    <CardHeader className="pb-1 px-4 pt-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-4 mb-0.5">
                            <CardTitle className="text-2xl">{program.name}</CardTitle>
                            <Badge variant={getStatusBadgeVariant(program.status)} className="text-xs">
                              {program.status}
                            </Badge>
                          </div>
                          {program.lastSessionId ? (
                            <button
                              onClick={() => handleViewSessionDetails(program.lastSessionId!)}
                              className="text-xs text-blue-600 hover:text-blue-800 hover:underline flex items-center gap-1"
                            >
                              <Info className="h-3 w-3" />
                              Last session details
                              {program.lastCompletedDate && (
                                <span className="text-slate-400 ml-1">
                                  {(() => {
                                    const d = new Date(program.lastCompletedDate)
                                    return `${String(d.getFullYear()).slice(2)}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
                                  })()}
                                </span>
                              )}
                            </button>
                          ) : (
                            <p className="text-xs text-slate-400">Never completed</p>
                          )}
                        </div>
                        {program.status === 'active' && (
                          <Button
                            size="sm"
                            onClick={() => handleStartSession(program.id)}
                            disabled={startingProgramId === program.id}
                            className="font-bold shrink-0"
                          >
                            <PlayCircle className="h-4 w-4 mr-1" />
                            {startingProgramId === program.id ? 'Starting...' : 'Start Session'}
                          </Button>
                        )}
                      </div>
                    </CardHeader>
                    <CardContent className="pt-1 px-4">
                      {(program as any).notes && (
                        <div className="bg-amber-50 border border-amber-200 rounded p-2 mb-2">
                          <p className="text-xs font-medium text-amber-800">Instructor Notes</p>
                          <p className="text-xs text-amber-700 mt-0.5">{(program as any).notes}</p>
                        </div>
                      )}

                      {/* Program Machines */}
                      {program.program_machines && program.program_machines.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mb-4">
                          {program.program_machines
                            .sort((a, b) => a.order_index - b.order_index)
                            .map((pm) => (
                              <button
                                key={pm.id}
                                onClick={() => handleMachineClick(pm.machine_id, pm.machines.machine_name, pm.machines.machine_code)}
                                className="px-2 py-0.5 rounded border border-slate-300 bg-white hover:bg-blue-50 hover:border-blue-400 hover:text-blue-700 transition-colors font-bold text-sm"
                              >
                                {pm.machines.machine_code}
                              </button>
                            ))}
                        </div>
                      )}

                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => router.push(`/trainer/program/${program.id}`)}
                        className="w-full"
                      >
                        Edit Routine
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          {/* Tab 3: History */}
          <TabsContent value="history">
            <div className="flex items-center justify-between mb-2 gap-2 flex-wrap">
              {/* View toggle */}
              <div className="flex gap-2 text-sm font-medium">
                {(['sessions', 'machine'] as const).map((view) => (
                  <button
                    key={view}
                    onClick={() => setHistoryView(view)}
                    className={`px-3 py-1.5 rounded-lg border transition-colors capitalize ${
                      historyView === view
                        ? 'bg-slate-800 text-white border-slate-800'
                        : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    {view === 'sessions' ? 'Sessions' : 'Machine'}
                  </button>
                ))}
              </div>
            </div>

            {historyView === 'sessions' && (
              <SessionsHistoryView
                clientId={clientId}
                programs={programs.map((p) => ({
                  id: p.id,
                  name: p.name,
                  program_machines: p.program_machines,
                }))}
                allowDelete={isManagement}
              />
            )}

            {historyView === 'machine' && (
              <MachineHistoryView
                clientId={clientId}
                programs={programs.map((p) => ({
                  id: p.id,
                  name: p.name,
                  status: p.status,
                  program_machines: p.program_machines,
                }))}
              />
            )}
          </TabsContent>
        </Tabs>
      </main>

      {/* Edit Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="sm:max-w-[560px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Client</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">

            {/* Row 1: First Name / Last Name */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="edit-first-name">First Name *</Label>
                <Input
                  id="edit-first-name"
                  value={editForm.first_name}
                  onChange={(e) => setEditForm({ ...editForm, first_name: e.target.value })}
                  disabled={saving}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="edit-last-name">Last Name *</Label>
                <Input
                  id="edit-last-name"
                  value={editForm.last_name}
                  onChange={(e) => setEditForm({ ...editForm, last_name: e.target.value })}
                  disabled={saving}
                />
              </div>
            </div>

            {/* Row 2: Phone / Email + Opt In */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="edit-phone">Phone (Optional)</Label>
                <Input
                  id="edit-phone"
                  type="tel"
                  value={editForm.phone}
                  onChange={(e) => setEditForm({ ...editForm, phone: formatPhoneInput(e.target.value) })}
                  disabled={saving}
                />
              </div>
              <div className="space-y-1.5">
                <div className="flex items-center gap-2">
                  <Label htmlFor="edit-email">Email *</Label>
                  <div className="flex items-center gap-1.5">
                    <Checkbox
                      id="edit-email-opt-in"
                      checked={editForm.email_opt_in}
                      onCheckedChange={(checked) => setEditForm({ ...editForm, email_opt_in: checked === true })}
                      disabled={saving}
                    />
                    <Label htmlFor="edit-email-opt-in" className="text-sm cursor-pointer whitespace-nowrap">Opt In</Label>
                  </div>
                </div>
                <Input
                  id="edit-email"
                  type="email"
                  value={editForm.email}
                  onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                  disabled={saving}
                />
              </div>
            </div>

            {/* Row 3: High Risk / Intensity */}
            <div className="grid grid-cols-2 gap-4 items-end">
              <div className="space-y-1.5">
                <Label>High Risk Client?</Label>
                <div className="flex items-center gap-2 h-10">
                  <Checkbox
                    id="edit-high-risk"
                    checked={editForm.high_risk}
                    onCheckedChange={(checked) => setEditForm({ ...editForm, high_risk: checked === true })}
                    disabled={saving}
                  />
                  <Label htmlFor="edit-high-risk" className="flex items-center gap-1.5 cursor-pointer font-normal">
                    <AlertTriangle className="h-4 w-4 text-red-500" />
                    Yes
                  </Label>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Intensity *</Label>
                <Select
                  value={editForm.intensity}
                  onValueChange={(value) => setEditForm({ ...editForm, intensity: value })}
                  disabled={saving}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select intensity level" />
                  </SelectTrigger>
                  <SelectContent>
                    {INTENSITY_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Notes */}
            <div className="space-y-1.5">
              <Label htmlFor="edit-notes">
                Notes {editForm.high_risk && <span className="text-red-500">*</span>}
              </Label>
              <Textarea
                id="edit-notes"
                value={editForm.notes}
                onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
                placeholder={editForm.high_risk ? 'Required for high risk clients...' : ''}
                disabled={saving}
                rows={3}
                className={editForm.high_risk ? 'border-red-300 text-red-700 placeholder:text-red-300' : ''}
              />
              {editForm.high_risk && !editForm.notes.trim() && (
                <p className="text-xs text-red-500">Notes are required for high risk clients</p>
              )}
            </div>
          </div>

          <div className="flex gap-3 pt-4">
            <Button variant="outline" onClick={() => setEditDialogOpen(false)} disabled={saving} className="flex-1">
              Cancel
            </Button>
            <Button onClick={handleSaveEdit} disabled={saving} className="flex-1">
              {saving ? 'Saving...' : 'Save Changes'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Archive Confirmation Dialog */}
      <AlertDialog open={archiveDialogOpen} onOpenChange={setArchiveDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Archive Client</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to archive {client.first_name} {client.last_name}?
              They will no longer appear in active client searches but their data will be preserved.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={actionLoading}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleArchive}
              disabled={actionLoading}
              className="bg-amber-600 hover:bg-amber-700"
            >
              {actionLoading ? 'Archiving...' : 'Archive'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Client</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to permanently delete {client.first_name} {client.last_name}?
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={actionLoading}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={actionLoading}
              className="bg-red-600 hover:bg-red-700"
            >
              {actionLoading ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Create Routine Dialog */}
      <CreateRoutineDialog
        open={createRoutineDialogOpen}
        onOpenChange={setCreateRoutineDialogOpen}
        clientId={clientId}
        onRoutineCreated={() => {
          loadClientData()
          setActiveTab('routines')
        }}
      />

      {/* Machine Stats Dialog */}
      <Dialog open={machineStatsOpen} onOpenChange={setMachineStatsOpen}>
        <DialogContent className="sm:max-w-[600px]" showCloseButton={true}>
          <DialogHeader>
            <DialogTitle>{selectedMachineCode && <span className="text-slate-500 mr-1">{selectedMachineCode} –</span>}{selectedMachineName}</DialogTitle>
            <DialogDescription>
              Recent session history for this machine
            </DialogDescription>
          </DialogHeader>

          <div className="py-4">
            {loadingMachineStats ? (
              <div className="py-8 text-center text-slate-500">Loading history...</div>
            ) : machineStats.length === 0 ? (
              <div className="py-8 text-center text-slate-500">
                No session history for this machine
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left">
                      <th className="pb-2 font-medium text-slate-600">Date</th>
                      <th className="pb-2 font-medium text-slate-600">Type</th>
                      <th className="pb-2 font-medium text-slate-600">Weight</th>
                      <th className="pb-2 font-medium text-slate-600">Time</th>
                      <th className="pb-2 font-medium text-slate-600">Reps</th>
                      <th className="pb-2 font-medium text-slate-600">Location</th>
                      <th className="pb-2 font-medium text-slate-600">Instructor</th>
                    </tr>
                  </thead>
                  <tbody>
                    {machineStats.map((entry) => {
                      const isDate = entry.measurementType === 'DATE'
                      return (
                        <tr key={entry.id} className="border-b last:border-0">
                          <td className="py-2">{entry.date}</td>
                          <td className="py-2 font-mono">{entry.measurementType || '–'}</td>
                          <td className="py-2 font-mono text-center">
                            {isDate ? '' : (entry.weight_lbs != null ? `${entry.weight_lbs}` : '–')}
                          </td>
                          <td className="py-2 font-mono text-center">
                            {isDate ? '✓' : (entry.total_time_seconds != null ? formatTime(entry.total_time_seconds) : '–')}
                          </td>
                          <td className="py-2 font-mono text-center">
                            {isDate ? '' : (entry.reps != null ? `${entry.reps}` : '–')}
                          </td>
                          <td className="py-2 text-slate-600">{entry.locationName || '–'}</td>
                          <td className="py-2 text-slate-600">{entry.trainerName || '–'}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Session Details Dialog */}
      <Dialog open={sessionDetailsOpen} onOpenChange={setSessionDetailsOpen}>
        <DialogContent className="sm:max-w-[600px] max-h-[85vh] flex flex-col" showCloseButton={true}>
          <DialogHeader className="shrink-0">
            <DialogTitle>Session Details</DialogTitle>
            <DialogDescription>
              {sessionDetails?.routineName ? `Routine: ${sessionDetails.routineName}` : 'Session information'}
            </DialogDescription>
          </DialogHeader>

          <div className="overflow-y-auto flex-1 py-4">
            {loadingSessionDetails ? (
              <div className="py-8 text-center text-slate-500">Loading session details...</div>
            ) : !sessionDetails ? (
              <div className="py-8 text-center text-slate-500">
                Session not found
              </div>
            ) : (
              <div className="space-y-4">
                {/* Session Info */}
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-slate-500">Date</p>
                    <p className="font-medium">{sessionDetails.date}</p>
                  </div>
                  <div>
                    <p className="text-slate-500">Time</p>
                    <p className="font-medium">
                      {sessionDetails.startTime || '-'}
                      {sessionDetails.endTime && ` - ${sessionDetails.endTime}`}
                    </p>
                  </div>
                  {sessionDetails.locationName && (
                    <div>
                      <p className="text-slate-500">Location</p>
                      <p className="font-medium">{sessionDetails.locationName}</p>
                    </div>
                  )}
                  {sessionDetails.trainerName && (
                    <div>
                      <p className="text-slate-500">Instructor</p>
                      <p className="font-medium">{sessionDetails.trainerName}</p>
                    </div>
                  )}
                </div>

                {/* Machine Data Table */}
                {sessionMachineData.length > 0 && (
                  <div className="mt-4">
                    <p className="text-sm font-medium text-slate-600 mb-2">Machine Results</p>
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs border-collapse">
                        <thead>
                          <tr className="bg-slate-50 border-b text-left">
                            <th className="px-2 py-2 font-semibold text-slate-600">Machine</th>
                            <th className="px-2 py-2 font-semibold text-slate-600 border-l">Type</th>
                            <th className="px-2 py-2 font-semibold text-slate-600 border-l text-center">lbs</th>
                            <th className="px-2 py-2 font-semibold text-slate-600 border-l text-center">time</th>
                            <th className="px-2 py-2 font-semibold text-slate-600 border-l text-center">reps</th>
                          </tr>
                        </thead>
                        <tbody>
                          {sessionMachineData.map((entry: any) => {
                            const isDate = entry.measurementType === 'DATE'
                            return (
                              <tr key={entry.id} className="border-b last:border-0">
                                <td className="px-2 py-1.5 font-bold">{entry.machineCode}</td>
                                <td className="px-2 py-1.5 font-mono border-l">{entry.measurementType || '–'}</td>
                                <td className="px-2 py-1.5 font-mono border-l text-center">
                                  {isDate ? '' : (entry.weight_lbs != null ? `${entry.weight_lbs}` : '–')}
                                </td>
                                <td className="px-2 py-1.5 font-mono border-l text-center">
                                  {isDate ? '✓' : (entry.total_time_seconds != null ? formatTime(entry.total_time_seconds) : '–')}
                                </td>
                                <td className="px-2 py-1.5 font-mono border-l text-center">
                                  {isDate ? '' : (entry.reps != null ? `${entry.reps}` : '–')}
                                </td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {sessionMachineData.length === 0 && (
                  <div className="py-4 text-center text-slate-500 text-sm">
                    No machine data recorded for this session
                  </div>
                )}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
