// src/components/clients/AddClientDialog.tsx
// Dialog for trainers to search and add clients to their roster

'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { Search, UserPlus } from 'lucide-react'
import { formatName } from '@/lib/utils/name-formatter'
import { useAuthStore } from '@/store/auth-store'

interface AddClientDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  trainerId: string
  existingClientIds: string[]
  onClientAdded: () => void
}

interface ClientProfile {
  id: string
  first_name: string
  last_name: string
  email: string
}

export function AddClientDialog({
  open,
  onOpenChange,
  trainerId,
  existingClientIds,
  onClientAdded,
}: AddClientDialogProps) {
  const { profile } = useAuthStore()
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<ClientProfile[]>([])
  const [searching, setSearching] = useState(false)
  const [adding, setAdding] = useState<string | null>(null)

  // Search for clients using server-side API
  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      setSearchResults([])
      return
    }

    setSearching(true)

    try {
      // Use server-side search API for security
      const response = await fetch('/api/search/clients', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query: searchQuery,
          existingClientIds,
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Search failed')
      }

      const data = await response.json()
      setSearchResults(data.results || [])
    } catch (error) {
      console.error('Error searching clients:', error)
      toast.error('Failed to search for clients')
      setSearchResults([])
    } finally {
      setSearching(false)
    }
  }

  // Debounced search on query change
  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchQuery) {
        handleSearch()
      } else {
        setSearchResults([])
      }
    }, 300)

    return () => clearTimeout(timer)
  }, [searchQuery])

  const handleAddClient = async (clientId: string, clientName: string) => {
    setAdding(clientId)
    const supabase = createClient()

    try {
      const { error } = await supabase
        .from('trainer_clients')
        .insert({
          trainer_id: trainerId,
          client_id: clientId,
          is_active: true,
        } as any)

      if (error) throw error

      toast.success(`${clientName} added to your roster`)

      // Remove from search results
      setSearchResults((prev) => prev.filter((c) => c.id !== clientId))

      // Notify parent
      onClientAdded()
    } catch (error) {
      console.error('Error adding client:', error)
      toast.error('Failed to add client to roster')
    } finally {
      setAdding(null)
    }
  }

  const handleClose = () => {
    setSearchQuery('')
    setSearchResults([])
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Add Client to Roster</DialogTitle>
          <DialogDescription>
            Search for clients by name or email to add them to your roster
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Search Input */}
          <div className="space-y-2">
            <Label htmlFor="search">Search Clients</Label>
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
              <Input
                id="search"
                type="text"
                placeholder="Search by name or email..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
                autoComplete="off"
              />
            </div>
          </div>

          {/* Search Results */}
          <div className="space-y-2 max-h-[400px] overflow-y-auto">
            {searching && (
              <div className="text-center py-8 text-slate-500">
                Searching...
              </div>
            )}

            {!searching && searchQuery && searchResults.length === 0 && (
              <div className="text-center py-8 text-slate-500">
                No clients found matching "{searchQuery}"
              </div>
            )}

            {!searching && searchResults.length > 0 && (
              <div className="space-y-2">
                <p className="text-sm text-slate-500 mb-2">
                  Found {searchResults.length} client{searchResults.length !== 1 ? 's' : ''}
                </p>
                {searchResults.map((client) => (
                  <div
                    key={client.id}
                    className="flex items-center justify-between p-3 border rounded-lg hover:bg-slate-50 transition-colors"
                  >
                    <div>
                      <div className="font-medium">
                        {formatName(client.first_name, client.last_name, profile?.role)}
                      </div>
                      <div className="text-sm text-slate-500">{client.email}</div>
                    </div>
                    <Button
                      size="sm"
                      onClick={() =>
                        handleAddClient(client.id, formatName(client.first_name, client.last_name, profile?.role))
                      }
                      disabled={adding === client.id}
                      className="font-bold"
                    >
                      {adding === client.id ? (
                        'Adding...'
                      ) : (
                        <>
                          <UserPlus className="h-4 w-4 mr-2" />
                          Add
                        </>
                      )}
                    </Button>
                  </div>
                ))}
              </div>
            )}

            {!searchQuery && (
              <div className="text-center py-8 text-slate-400">
                Start typing to search for clients
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
