// src/components/dashboard/admin/TrainerManagementSection.tsx
// Admin section for viewing and managing trainers

'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { User, Plus, Pencil } from 'lucide-react'
import { CreateTrainerDialog } from '@/components/management/CreateTrainerDialog'
import { EditTrainerDialog } from '@/components/management/EditTrainerDialog'

interface TrainerInfo {
  id: string
  first_name: string
  last_name: string
  email: string
  is_active: boolean
  sessionCount: number
}

export function TrainerManagementSection() {
  const [trainers, setTrainers] = useState<TrainerInfo[]>([])
  const [loading, setLoading] = useState(true)
  const [createOpen, setCreateOpen] = useState(false)
  const [editTrainer, setEditTrainer] = useState<TrainerInfo | null>(null)
  const [editOpen, setEditOpen] = useState(false)

  useEffect(() => {
    loadTrainers()
  }, [])

  const loadTrainers = async () => {
    setLoading(true)
    const supabase = createClient()

    // Fetch all trainers (not just active)
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, first_name, last_name, email, is_active')
      .contains('roles', ['trainer'])
      .order('is_active', { ascending: false })
      .order('first_name')

    if (!profiles || profiles.length === 0) {
      setTrainers([])
      setLoading(false)
      return
    }

    const trainerIds = profiles.map((p: any) => p.id)

    // Fetch session counts (capped — only used to display a count, not enumerate all)
    const { data: sessionsData } = await supabase
      .from('sessions')
      .select('trainer_id')
      .in('trainer_id', trainerIds)
      .limit(5000)

    // Build session count map
    const sessionCountMap = new Map<string, number>()
    if (sessionsData) {
      sessionsData.forEach((s: any) => {
        sessionCountMap.set(s.trainer_id, (sessionCountMap.get(s.trainer_id) || 0) + 1)
      })
    }

    const enriched: TrainerInfo[] = profiles.map((p: any) => ({
      id: p.id,
      first_name: p.first_name,
      last_name: p.last_name,
      email: p.email,
      is_active: p.is_active ?? true,
      sessionCount: sessionCountMap.get(p.id) || 0,
    }))

    setTrainers(enriched)
    setLoading(false)
  }

  const activeCount = trainers.filter(t => t.is_active).length

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h3 className="font-semibold text-lg">
          Instructors <span className="font-normal text-sm">({activeCount} active)</span>
        </h3>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Create Instructor
        </Button>
      </div>

      {loading ? (
        <div className="py-8 text-center">Loading instructors...</div>
      ) : trainers.length === 0 ? (
        <div className="py-8 text-center">No instructors found</div>
      ) : (
        <div className="space-y-2">
          {trainers.map((trainer) => (
            <div
              key={trainer.id}
              className={`flex items-center justify-between p-3 border rounded-lg transition-colors cursor-pointer ${
                trainer.is_active
                  ? 'hover:bg-slate-50'
                  : 'bg-slate-100 opacity-75 hover:bg-slate-150'
              }`}
              onClick={() => { setEditTrainer(trainer); setEditOpen(true) }}
            >
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-slate-200 flex items-center justify-center">
                  <User className="h-4 w-4" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm">
                      {trainer.first_name} {trainer.last_name}
                    </span>
                    <Badge
                      variant={trainer.is_active ? 'default' : 'secondary'}
                      className={trainer.is_active ? 'bg-green-600' : 'bg-slate-500'}
                    >
                      {trainer.is_active ? 'Active' : 'Archived'}
                    </Badge>
                  </div>
                  <div className="text-xs">{trainer.email}</div>
                </div>
              </div>
              <Pencil className="h-3.5 w-3.5 text-slate-400" />
            </div>
          ))}
        </div>
      )}

      <CreateTrainerDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onTrainerCreated={loadTrainers}
      />

      <EditTrainerDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        trainer={editTrainer}
        onTrainerUpdated={loadTrainers}
      />
    </div>
  )
}
