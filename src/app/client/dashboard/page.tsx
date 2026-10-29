// src/app/client/dashboard/page.tsx
// Client dashboard - Workout-Only Version (No Booking)

'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuthStore } from '@/store/auth-store'
import { createClient } from '@/lib/supabase/client'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { signOut } from '@/lib/auth/auth-helpers'
import { toast } from 'sonner'
import { SessionsHistoryView } from '@/components/history/SessionsHistoryView'
import { Header } from '@/components/layout/Header'
import { MachineImage } from '@/components/machine/MachineImage'
import { SessionBackfillDialog } from '@/components/import/SessionBackfillDialog'
import { MachineProgressModal } from '@/components/dashboard/MachineProgressModal'
import { ExportButtons } from '@/components/export/ExportButtons'
import { ClipboardList } from 'lucide-react'

interface Machine {
  id: string
  machine_code: string
  machine_name: string
  image_url: string | null
}

interface ProgramMachine {
  machine_id: string
  order_index: number
  machines: Machine | null
}

interface Program {
  id: string
  name: string
  status: string
  description: string | null
  goals: string | null
  program_machines: ProgramMachine[]
}

export default function ClientDashboard() {
  const router = useRouter()
  const { profile, loading, hasRole } = useAuthStore()
  const [programs, setPrograms] = useState<Program[]>([])
  const [backfillOpen, setBackfillOpen] = useState(false)
  const [selectedMachine, setSelectedMachine] = useState<{ id: string; code: string; name: string } | null>(null)
  const [stats, setStats] = useState({
    totalSessions: 0,
    lastSessionDate: null as string | null,
  })

  useEffect(() => {
    if (!loading && (!profile || !hasRole('client'))) {
      router.push('/login')
      return
    }

    if (profile) {
      loadDashboardData()
    }
  }, [profile, loading, router, hasRole])

  const loadDashboardData = async () => {
    if (!profile?.id) return

    const supabase = createClient()
    const clientId = profile.id

    // Fire all independent queries in parallel
    const [programsResult, countResult, lastSessionResult] = await Promise.all([
      supabase
        .from('programs')
        .select(`
          *,
          program_machines (
            machine_id,
            order_index,
            machines (
              id,
              machine_code,
              machine_name,
              image_url
            )
          )
        `)
        .eq('client_id', clientId)
        .eq('status', 'active'),

      supabase
        .from('sessions')
        .select('*', { count: 'exact', head: true })
        .eq('client_id', clientId)
        .eq('status', 'completed'),

      supabase
        .from('sessions')
        .select('actual_start')
        .eq('client_id', clientId)
        .eq('status', 'completed')
        .order('actual_start', { ascending: false })
        .limit(1)
        .maybeSingle(),
    ])

    if (programsResult.data) {
      const sorted = (programsResult.data as Program[]).map((p) => ({
        ...p,
        program_machines: (p.program_machines || []).sort(
          (a, b) => (a.order_index || 0) - (b.order_index || 0)
        ),
      }))
      setPrograms(sorted)
    }

    setStats({
      totalSessions: countResult.count || 0,
      lastSessionDate:
        (lastSessionResult.data as { actual_start: string } | null)?.actual_start || null,
    })
  }

  const handleSignOut = () => {
    useAuthStore.getState().clearAuth()
    router.push('/login')
    signOut().catch(() => {})
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-lg">Loading...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <Header showSignOut onSignOut={handleSignOut} showRoleSwitcher />

      <main className="container mx-auto px-4 py-8">
        {/* Stats — compact strip */}
        <div className="flex gap-4 mb-6">
          <div className="bg-white border rounded-lg px-4 py-2.5 flex items-center gap-3">
            <span className="text-xs text-slate-500">Total Sessions</span>
            <span className="text-xl font-bold text-slate-800">{stats.totalSessions}</span>
          </div>
          <div className="bg-white border rounded-lg px-4 py-2.5 flex items-center gap-3">
            <span className="text-xs text-slate-500">Active Routines</span>
            <span className="text-xl font-bold text-slate-800">{programs.length}</span>
          </div>
          <div className="bg-white border rounded-lg px-4 py-2.5 flex items-center gap-3">
            <span className="text-xs text-slate-500">Last Workout</span>
            <span className="text-sm font-semibold text-slate-800">
              {stats.lastSessionDate
                ? new Date(stats.lastSessionDate).toLocaleDateString()
                : '—'}
            </span>
          </div>
        </div>

        {/* My Routines */}
        <div className="mb-8">
          <div className="mb-3">
            <h2 className="text-lg font-semibold text-slate-800">Training Routines &amp; Progress</h2>
            <p className="text-xs text-slate-500 mt-0.5">Click on any machine to see your progress</p>
          </div>
          {programs.length === 0 ? (
            <p className="text-slate-500 text-sm py-4">No active routines. Your instructor will create a routine for you.</p>
          ) : (
            <div className="space-y-3">
              {[...programs].sort((a, b) => a.name.localeCompare(b.name)).map((program) => (
                <div key={program.id} className="bg-white border rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <h3 className="font-semibold text-slate-800">Routine {program.name}</h3>
                    <Badge variant="outline" className="text-xs">{program.status}</Badge>
                  </div>
                  {program.program_machines && program.program_machines.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {program.program_machines.map((pm) => {
                        const machine = pm.machines
                        if (!machine) return null
                        return (
                          <button
                            key={pm.machine_id}
                            type="button"
                            onClick={() => setSelectedMachine({ id: machine.id, code: machine.machine_code, name: machine.machine_name })}
                            className="flex items-center gap-2 bg-slate-50 border rounded-md px-2 py-1.5 hover:border-slate-400 hover:bg-slate-100 transition-colors text-left"
                          >
                            <MachineImage
                              src={machine.image_url}
                              alt={machine.machine_name}
                              size="sm"
                            />
                            <div className="min-w-0">
                              <p className="text-xs font-mono font-medium">{machine.machine_code}</p>
                              <p className="text-xs text-slate-500 truncate">{machine.machine_name}</p>
                            </div>
                          </button>
                        )
                      })}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Session History */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold text-slate-800">Session History</h2>
            <div className="flex gap-2">
              <ExportButtons clientId={profile?.id || ''} clientName={profile ? `${profile.first_name ?? ''} ${profile.last_name ?? ''}`.trim() || 'Client' : 'Client'} />
              <Button
                variant="outline"
                size="sm"
                onClick={() => setBackfillOpen(true)}
                className="gap-1.5 text-slate-600"
              >
                <ClipboardList className="h-4 w-4" />
                Import past sessions
              </Button>
            </div>
          </div>
          <SessionsHistoryView
            clientId={profile?.id || ''}
            programs={programs.map((p) => ({
              id: p.id,
              name: p.name,
              program_machines: (p.program_machines || []).map((pm) => ({
                machine_id: pm.machine_id,
                machines: pm.machines ? {
                  id: pm.machines.id,
                  machine_code: pm.machines.machine_code,
                  machine_name: pm.machines.machine_name,
                } : { id: pm.machine_id, machine_code: '', machine_name: '' },
              })),
            }))}
            allowAdd={false}
            allowEdit={false}
            allowDelete={false}
          />
        </div>

        <SessionBackfillDialog
          clientId={profile?.id || ''}
          open={backfillOpen}
          onOpenChange={setBackfillOpen}
          onImported={loadDashboardData}
        />
        <MachineProgressModal
          clientId={profile?.id || ''}
          machineId={selectedMachine?.id ?? null}
          machineCode={selectedMachine?.code ?? ''}
          machineName={selectedMachine?.name ?? ''}
          open={selectedMachine !== null}
          onOpenChange={(open) => { if (!open) setSelectedMachine(null) }}
        />
      </main>
    </div>
  )
}
