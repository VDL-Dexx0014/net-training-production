// src/components/clients/ClientsListDialog.tsx
// Dialog to display trainer's clients with search

'use client'

import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Search, User } from 'lucide-react'
import { useAuthStore } from '@/store/auth-store'
import { formatName } from '@/lib/utils/name-formatter'

interface Client {
  id: string
  first_name: string
  last_name: string
  email: string
  fitness_goals: string | null
}

interface ClientsListDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  clients: Client[]
  onClientSelect: (clientId: string) => void
}

export function ClientsListDialog({
  open,
  onOpenChange,
  clients,
  onClientSelect,
}: ClientsListDialogProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const { profile } = useAuthStore()

  // Sort clients alphabetically by first name
  const sortedClients = [...clients].sort((a, b) =>
    a.first_name.localeCompare(b.first_name)
  )

  // Filter clients based on search query
  const filteredClients = sortedClients.filter((client) => {
    const query = searchQuery.toLowerCase()
    return (
      client.first_name.toLowerCase().includes(query) ||
      client.last_name.toLowerCase().includes(query) ||
      client.email.toLowerCase().includes(query)
    )
  })

  const handleClientClick = (clientId: string) => {
    onClientSelect(clientId)
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Your Clients</DialogTitle>
          <DialogDescription>
            {clients.length} client{clients.length !== 1 ? 's' : ''}
          </DialogDescription>
        </DialogHeader>

        {/* Search Box */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input
            placeholder="Search by name or email..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>

        {/* Client List */}
        <div className="flex-1 overflow-y-auto space-y-2">
          {filteredClients.length === 0 ? (
            <div className="py-12 text-center text-slate-500">
              <p>
                {searchQuery
                  ? 'No clients found matching your search'
                  : 'No clients yet'}
              </p>
            </div>
          ) : (
            filteredClients.map((client) => (
              <button
                key={client.id}
                onClick={() => handleClientClick(client.id)}
                className="w-full text-left p-4 rounded-lg border hover:border-slate-300 hover:bg-slate-50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-slate-200 flex items-center justify-center">
                    <User className="h-5 w-5 text-slate-600" />
                  </div>
                  <div className="flex-1">
                    <div className="font-medium">
                      {formatName(client.first_name, client.last_name, profile?.role)}
                    </div>
                    <div className="text-sm text-slate-500">{client.email}</div>
                    {client.fitness_goals && (
                      <div className="text-xs text-slate-400 mt-1 line-clamp-1">
                        {client.fitness_goals}
                      </div>
                    )}
                  </div>
                </div>
              </button>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
