// src/components/management/ClientSetupCard.tsx
// Client setup card for management dashboard - shows all clients with search
// Includes archive/unarchive, delete, and assign default routine functionality

'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import { Badge } from '@/components/ui/badge'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from '@/components/ui/dropdown-menu'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Search, User, Plus, Archive, ArchiveRestore, Trash2, ListPlus, ChevronDown, KeyRound, Eye, EyeOff } from 'lucide-react'
import { useAuthStore } from '@/store/auth-store'
import { formatName } from '@/lib/utils/name-formatter'
import { CreateClientDialog } from './CreateClientDialog'
import { toast } from 'sonner'

interface Client {
  id: string
  first_name: string
  last_name: string
  email: string
  fitness_goals: string | null
  is_active: boolean
}

interface DefaultRoutine {
  id: string
  name: string
  description: string | null
  program_machines: Array<{
    id: string
    machine_id: string
    order_index: number
  }>
}

export function ClientSetupCard() {
  const router = useRouter()
  const { profile } = useAuthStore()
  const [clients, setClients] = useState<Client[]>([])
  const [defaultRoutines, setDefaultRoutines] = useState<DefaultRoutine[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [showArchived, setShowArchived] = useState(false)
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [actionInProgress, setActionInProgress] = useState<string | null>(null)
  const [passwordTarget, setPasswordTarget] = useState<Client | null>(null)
  const [newPassword, setNewPassword] = useState('')
  const [showNewPassword, setShowNewPassword] = useState(false)
  const [settingPassword, setSettingPassword] = useState(false)

  useEffect(() => {
    Promise.all([loadClients(), loadDefaultRoutines()])
  }, [showArchived])

  const loadClients = async () => {
    const supabase = createClient()
    setLoading(true)

    let query = supabase
      .from('profiles')
      .select('id, first_name, last_name, email, fitness_goals, is_active')
      .contains('roles', ['client'])
      .order('first_name')

    if (!showArchived) {
      query = query.eq('is_active', true)
    }

    const { data, error } = await query

    if (error) {
      console.error('Error loading clients:', error)
    } else if (data) {
      setClients(data as Client[])
    }

    setLoading(false)
  }

  const loadDefaultRoutines = async () => {
    const supabase = createClient()

    const { data, error } = await supabase
      .from('programs')
      .select(`
        id,
        name,
        description,
        program_machines (
          id,
          machine_id,
          order_index
        )
      `)
      .eq('is_default', true)
      .eq('status', 'active')
      .order('name')

    if (error) {
      console.error('Error loading default routines:', error)
    } else if (data) {
      setDefaultRoutines(data as DefaultRoutine[])
    }
  }

  const handleArchiveToggle = async (client: Client) => {
    setActionInProgress(client.id)
    const supabase = createClient()

    const newStatus = !client.is_active
    const { error } = await (supabase
      .from('profiles') as any)
      .update({ is_active: newStatus, updated_at: new Date().toISOString() })
      .eq('id', client.id)

    if (error) {
      console.error('Error updating client:', error)
      toast.error(`Failed to ${newStatus ? 'restore' : 'archive'} client`)
    } else {
      toast.success(`Client ${newStatus ? 'restored' : 'archived'}`)
      if (showArchived) {
        // Showing both active + archived: just flip the flag in place
        setClients(prev => prev.map(c => c.id === client.id ? { ...c, is_active: newStatus } : c))
      } else {
        // Showing active only: remove the now-archived client from the list
        setClients(prev => prev.filter(c => c.id !== client.id))
      }
    }

    setActionInProgress(null)
  }

  const handleDelete = async (client: Client) => {
    // First check if client has any sessions
    const supabase = createClient()

    const { count, error: countError } = await supabase
      .from('sessions')
      .select('*', { count: 'exact', head: true })
      .eq('client_id', client.id)

    if (countError) {
      console.error('Error checking sessions:', countError)
      toast.error('Failed to check client sessions')
      return
    }

    if (count && count > 0) {
      toast.error(`Cannot delete ${client.first_name} - they have ${count} session${count !== 1 ? 's' : ''} recorded. Archive instead.`)
      return
    }

    if (!confirm(`Are you sure you want to permanently delete ${client.first_name} ${client.last_name}? This cannot be undone.`)) {
      return
    }

    setActionInProgress(client.id)

    // Delete related data first
    await supabase.from('trainer_clients').delete().eq('client_id', client.id)
    await supabase.from('programs').delete().eq('client_id', client.id)
    await supabase.from('user_machine_attribute_values').delete().eq('user_id', client.id)

    // Delete the profile
    const { error: deleteError } = await supabase
      .from('profiles')
      .delete()
      .eq('id', client.id)

    if (deleteError) {
      console.error('Error deleting client:', deleteError)
      toast.error('Failed to delete client')
    } else {
      toast.success('Client deleted permanently')
      loadClients()
    }

    setActionInProgress(null)
  }

  const handleAssignRoutine = async (client: Client, routine: DefaultRoutine) => {
    setActionInProgress(client.id)
    const supabase = createClient()

    try {
      // Create a copy of the default routine for this client
      const { data: newProgram, error: programError } = await supabase
        .from('programs')
        .insert({
          name: routine.name,
          description: routine.description,
          client_id: client.id,
          status: 'active',
          is_default: false,
        } as any)
        .select()
        .single()

      if (programError || !newProgram) {
        console.error('Error creating program:', programError)
        toast.error('Failed to assign routine')
        return
      }

      // Copy program machines from the default routine
      if (routine.program_machines && routine.program_machines.length > 0) {
        const machineInserts = routine.program_machines.map((pm) => ({
          program_id: (newProgram as any).id,
          machine_id: pm.machine_id,
          order_index: pm.order_index,
        }))

        const { error: machinesError } = await supabase
          .from('program_machines')
          .insert(machineInserts as any)

        if (machinesError) {
          console.error('Error copying machines:', machinesError)
          toast.error('Routine assigned but failed to copy machines')
          return
        }
      }

      toast.success(`"${routine.name}" assigned to ${client.first_name}`)
    } catch (error) {
      console.error('Error assigning routine:', error)
      toast.error('Failed to assign routine')
    } finally {
      setActionInProgress(null)
    }
  }

  const handleSetPassword = async () => {
    if (!passwordTarget) return
    if (newPassword.length < 8) {
      toast.error('Password must be at least 8 characters')
      return
    }
    setSettingPassword(true)
    try {
      const res = await fetch('/api/admin/set-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: passwordTarget.id, password: newPassword }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error || 'Failed to set password')
        return
      }
      toast.success(`Password updated for ${passwordTarget.first_name} — share it with them directly`)
      setPasswordTarget(null)
      setNewPassword('')
      setShowNewPassword(false)
    } catch {
      toast.error('An error occurred')
    } finally {
      setSettingPassword(false)
    }
  }

  const filteredClients = clients.filter((client) => {
    const query = searchQuery.toLowerCase()
    return (
      client.first_name.toLowerCase().includes(query) ||
      client.last_name.toLowerCase().includes(query) ||
      client.email.toLowerCase().includes(query)
    )
  })

  const activeCount = clients.filter(c => c.is_active).length
  const archivedCount = clients.filter(c => !c.is_active).length

  return (
    <Card className="mb-8">
      <CardHeader>
        <div className="flex justify-between items-center">
          <div>
            <CardTitle>Client Setup</CardTitle>
            <CardDescription>
              {activeCount} active client{activeCount !== 1 ? 's' : ''}
              {showArchived && archivedCount > 0 && ` · ${archivedCount} archived`}
            </CardDescription>
          </div>
          <Button onClick={() => setCreateDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Create Client
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {/* Search and Filter */}
        <div className="flex flex-col sm:flex-row gap-3 mb-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input
              placeholder="Search by name or email..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          <label className="flex items-center gap-2 cursor-pointer whitespace-nowrap">
            <Checkbox
              checked={showArchived}
              onCheckedChange={(checked) => setShowArchived(checked === true)}
            />
            <span className="text-sm">Show archived</span>
          </label>
        </div>

        {/* Client List */}
        {loading ? (
          <p className="text-slate-500 text-center py-8">Loading clients...</p>
        ) : filteredClients.length === 0 ? (
          <p className="text-slate-500 text-center py-8">
            {searchQuery ? 'No clients found matching your search' : 'No clients in the system'}
          </p>
        ) : (
          <div className="space-y-2 max-h-[400px] overflow-y-auto">
            {filteredClients.map((client) => (
              <div
                key={client.id}
                className={`flex items-center justify-between p-3 rounded-lg border hover:border-slate-300 transition-colors ${
                  !client.is_active ? 'bg-slate-50 opacity-75' : 'hover:bg-slate-50'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className={`w-9 h-9 rounded-full flex items-center justify-center ${
                    client.is_active ? 'bg-slate-200' : 'bg-slate-300'
                  }`}>
                    <User className="h-4 w-4 text-slate-600" />
                  </div>
                  <div>
                    <div className="font-medium text-sm flex items-center gap-2">
                      {formatName(client.first_name, client.last_name, profile?.role)}
                      {!client.is_active && (
                        <Badge variant="outline" className="text-xs bg-amber-50 text-amber-700 border-amber-200">
                          Archived
                        </Badge>
                      )}
                    </div>
                    <div className="text-xs text-slate-500">{client.email}</div>
                    {client.fitness_goals && (
                      <div className="text-xs text-slate-400 mt-0.5 line-clamp-1">
                        {client.fitness_goals}
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {/* Assign Routine Dropdown - only for active clients */}
                  {client.is_active && defaultRoutines.length > 0 && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={actionInProgress === client.id}
                          className="text-cyan-700 border-cyan-200 hover:bg-cyan-50"
                        >
                          <ListPlus className="h-4 w-4 mr-1" />
                          Assign Routine
                          <ChevronDown className="h-3 w-3 ml-1" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-64">
                        <DropdownMenuLabel>Select a default routine</DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        {defaultRoutines.map((routine) => (
                          <DropdownMenuItem
                            key={routine.id}
                            onClick={() => handleAssignRoutine(client, routine)}
                            className="cursor-pointer"
                          >
                            <div className="flex flex-col">
                              <span className="font-medium">{routine.name}</span>
                              {routine.description && (
                                <span className="text-xs text-slate-500 line-clamp-1">
                                  {routine.description}
                                </span>
                              )}
                              <span className="text-xs text-slate-400">
                                {routine.program_machines?.length || 0} machines
                              </span>
                            </div>
                          </DropdownMenuItem>
                        ))}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => router.push(`/trainer/client/${client.id}`)}
                  >
                    View Profile
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => { setPasswordTarget(client); setNewPassword(''); setShowNewPassword(false) }}
                    disabled={actionInProgress === client.id}
                    title="Set password"
                  >
                    <KeyRound className="h-4 w-4 text-slate-500" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleArchiveToggle(client)}
                    disabled={actionInProgress === client.id}
                    title={client.is_active ? 'Archive client' : 'Restore client'}
                  >
                    {client.is_active ? (
                      <Archive className="h-4 w-4 text-amber-600" />
                    ) : (
                      <ArchiveRestore className="h-4 w-4 text-green-600" />
                    )}
                  </Button>
                  {!client.is_active && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDelete(client)}
                      disabled={actionInProgress === client.id}
                      title="Delete client permanently"
                    >
                      <Trash2 className="h-4 w-4 text-red-500" />
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>

      <CreateClientDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        onClientCreated={loadClients}
      />

      <Dialog
        open={!!passwordTarget}
        onOpenChange={(open) => { if (!open) { setPasswordTarget(null); setNewPassword(''); setShowNewPassword(false) } }}
      >
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <KeyRound className="h-4 w-4" />
              Set Password — {passwordTarget?.first_name} {passwordTarget?.last_name}
            </DialogTitle>
            <DialogDescription>
              Overrides their current password immediately. Share it with them verbally and remind them to change it.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <Label>New Password</Label>
            <div className="relative">
              <Input
                type={showNewPassword ? 'text' : 'password'}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Min. 8 characters"
                disabled={settingPassword}
                autoComplete="new-password"
                className="pr-10"
              />
              <button
                type="button"
                onClick={() => setShowNewPassword(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                tabIndex={-1}
              >
                {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => { setPasswordTarget(null); setNewPassword(''); setShowNewPassword(false) }}
              disabled={settingPassword}
            >
              Cancel
            </Button>
            <Button onClick={handleSetPassword} disabled={!newPassword || settingPassword}>
              {settingPassword ? 'Saving...' : 'Set Password'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  )
}
