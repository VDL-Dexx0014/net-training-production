// src/components/dashboard/ClientsTab.tsx
// Tab 2: Search-first client list with enriched data and Create Client functionality

'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Search, Plus, X } from 'lucide-react'
import { toast } from 'sonner'
import { ClientRow, EnrichedClient } from './ClientRow'
import { CreateClientDialog } from '@/components/management/CreateClientDialog'

const SEARCH_STORAGE_KEY = 'clientSearchState'

interface ClientsTabProps {
  selectedLocationId: string | null
}

export function ClientsTab({ selectedLocationId }: ClientsTabProps) {
  const router = useRouter()
  const [searchQuery, setSearchQuery] = useState('')
  const [includeArchived, setIncludeArchived] = useState(false)
  const [results, setResults] = useState<EnrichedClient[]>([])
  const [searching, setSearching] = useState(false)
  const [hasSearched, setHasSearched] = useState(false)
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const lastSearchRef = useRef<string>('')
  const initialLoadRef = useRef(true)

  // Restore search state from localStorage on mount
  useEffect(() => {
    if (typeof window !== 'undefined' && initialLoadRef.current) {
      initialLoadRef.current = false
      const stored = localStorage.getItem(SEARCH_STORAGE_KEY)
      if (stored) {
        try {
          const state = JSON.parse(stored)
          if (state.query) {
            setSearchQuery(state.query)
            setIncludeArchived(state.includeArchived || false)
            // Perform search immediately with restored state
            performSearch(state.query, state.includeArchived || false)
          }
        } catch {}
      }
    }
  }, [])

  // Save search state to localStorage when it changes
  useEffect(() => {
    if (typeof window !== 'undefined' && !initialLoadRef.current) {
      if (searchQuery.trim()) {
        localStorage.setItem(SEARCH_STORAGE_KEY, JSON.stringify({
          query: searchQuery,
          includeArchived,
        }))
      } else {
        localStorage.removeItem(SEARCH_STORAGE_KEY)
      }
    }
  }, [searchQuery, includeArchived])

  // Debounced search - re-search when query or includeArchived changes
  useEffect(() => {
    if (initialLoadRef.current) return

    if (!searchQuery.trim()) {
      setResults([])
      setHasSearched(false)
      return
    }

    const timer = setTimeout(() => {
      performSearch(searchQuery.trim(), includeArchived)
    }, 300)

    return () => clearTimeout(timer)
  }, [searchQuery, includeArchived])

  const performSearch = async (query: string, archived: boolean = includeArchived) => {
    setSearching(true)
    setHasSearched(true)
    lastSearchRef.current = query
    const supabase = createClient()

    try {
      // 1. Search client profiles with wildcard - include phone and high_risk
      let clientQuery = supabase
        .from('profiles')
        .select('id, first_name, last_name, email, phone, is_active, high_risk, intensity')
        .contains('roles', ['client'])
        .or(`first_name.ilike.%${query}%,last_name.ilike.%${query}%,email.ilike.%${query}%`)
        .order('first_name')
        .limit(50)

      if (!archived) {
        clientQuery = clientQuery.eq('is_active', true)
      }

      const { data: clients, error } = await clientQuery

      if (error) {
        console.error('Error searching clients:', error)
        toast.error('Search failed: ' + error.message)
        setResults([])
        setSearching(false)
        return
      }

      if (!clients || clients.length === 0) {
        setResults([])
        setSearching(false)
        return
      }

      const clientIds = clients.map((c: any) => c.id)

      // 2. Fetch enrichment data in parallel - include routine count
      const [programsRes, sessionsRes, settingsRes, routineCountRes] = await Promise.all([
        supabase
          .from('programs')
          .select('client_id, name')
          .eq('status', 'active')
          .in('client_id', clientIds),
        supabase
          .from('sessions')
          .select('client_id, actual_start')
          .eq('status', 'completed')
          .in('client_id', clientIds)
          .order('actual_start', { ascending: false })
          .limit(500),
        supabase
          .from('user_machine_attribute_values')
          .select('user_id')
          .in('user_id', clientIds)
          .then((res) => {
            // Fallback to old table if new one doesn't exist yet
            if (res.error) {
              return supabase
                .from('user_machine_settings')
                .select('user_id')
                .in('user_id', clientIds)
            }
            return res
          }),
        // Count all routines (programs) per client
        supabase
          .from('programs')
          .select('client_id')
          .in('client_id', clientIds)
          .eq('is_default', false),
      ])

      // Build program map
      const programMap = new Map<string, string>()
      if (programsRes.data) {
        programsRes.data.forEach((p: any) => {
          if (!programMap.has(p.client_id)) {
            programMap.set(p.client_id, p.name)
          }
        })
      }

      // Build last session map (take first per client since ordered desc)
      const lastSessionMap = new Map<string, string>()
      if (sessionsRes.data) {
        sessionsRes.data.forEach((s: any) => {
          if (!lastSessionMap.has(s.client_id)) {
            lastSessionMap.set(s.client_id, s.actual_start)
          }
        })
      }

      // Build settings set
      const settingsSet = new Set<string>()
      if (settingsRes.data) {
        settingsRes.data.forEach((s: any) => settingsSet.add(s.user_id))
      }

      // Build routine count map
      const routineCountMap = new Map<string, number>()
      if (routineCountRes.data) {
        routineCountRes.data.forEach((r: any) => {
          routineCountMap.set(r.client_id, (routineCountMap.get(r.client_id) || 0) + 1)
        })
      }

      // Merge into enriched clients
      const enriched: EnrichedClient[] = clients.map((c: any) => ({
        id: c.id,
        first_name: c.first_name,
        last_name: c.last_name,
        email: c.email,
        phone: c.phone || null,
        profile_photo_url: null, // Not fetched yet - column may not exist in DB
        is_active: c.is_active,
        high_risk: c.high_risk || false,
        intensity: c.intensity || null,
        activeProgramName: programMap.get(c.id) || null,
        lastSessionDate: lastSessionMap.get(c.id) || null,
        machineSettingsConfigured: settingsSet.has(c.id),
        routineCount: routineCountMap.get(c.id) || 0,
      }))

      setResults(enriched)
    } catch (err) {
      console.error('Error searching clients:', err)
      toast.error('Failed to search clients')
    } finally {
      setSearching(false)
    }
  }

  const handleViewProfile = (clientId: string) => {
    router.push(`/trainer/client/${clientId}?returnTab=clients`)
  }

  const handleClearSearch = () => {
    setSearchQuery('')
    setResults([])
    setHasSearched(false)
  }

  const handleClientCreated = () => {
    // If there's a search query, refresh results
    if (searchQuery.trim()) {
      performSearch(searchQuery.trim())
    }
  }

  return (
    <div className="py-2">
      {/* Search bar and Create Client button - sticky while scrolling */}
      <div className="sticky top-[90px] z-10 bg-slate-50 pt-1 pb-2 -mx-3 px-3">
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex gap-3 flex-1">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4" />
            <Input
              placeholder="Name or email..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 pr-10"
              autoComplete="off"
            />
            {searchQuery && (
              <button
                onClick={handleClearSearch}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 h-5 w-5 rounded-full bg-slate-200 hover:bg-slate-300 flex items-center justify-center transition-colors"
                title="Clear search"
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </div>
          <label className="flex items-center gap-2 cursor-pointer whitespace-nowrap">
            <Checkbox
              checked={includeArchived}
              onCheckedChange={(checked) => setIncludeArchived(checked === true)}
            />
            <span className="text-sm">Archived</span>
          </label>
        </div>
        <div className="sm:ml-auto">
          <Button onClick={() => setCreateDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Create Client
          </Button>
        </div>
      </div>
      </div>

      {/* Results */}
      {searching && (
        <div className="py-8 text-center">Searching...</div>
      )}

      {!searching && !hasSearched && (
        <div className="py-12 text-center">
          <Search className="h-8 w-8 mx-auto mb-3 opacity-30" />
          <p>Search for a client by name or email</p>
        </div>
      )}

      {!searching && hasSearched && results.length === 0 && (
        <div className="py-8 text-center">
          No clients found matching "{searchQuery}"
          {!includeArchived && (
            <p className="text-sm text-slate-500 mt-1">
              Try checking "Archived" to search archived clients
            </p>
          )}
        </div>
      )}

      {!searching && results.length > 0 && (
        <div>
          <p className="text-sm mb-2">
            {results.length} result{results.length !== 1 ? 's' : ''}
          </p>
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-2">
            {results.map((client) => (
              <ClientRow
                key={client.id}
                client={client}
                onViewProfile={handleViewProfile}
              />
            ))}
          </div>
        </div>
      )}

      <CreateClientDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        onClientCreated={handleClientCreated}
      />
    </div>
  )
}
