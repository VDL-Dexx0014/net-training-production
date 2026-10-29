// src/store/auth-store.ts
// Zustand store for authentication state

import { create } from 'zustand'
import { User } from '@supabase/supabase-js'
import { Database } from '@/types/database.types'

type Profile = Database['public']['Tables']['profiles']['Row']

type UserRole = 'trainer' | 'client' | 'management'

interface AuthState {
  user: User | null
  profile: Profile | null
  loading: boolean
  activeRole: UserRole | null
  setUser: (user: User | null) => void
  setProfile: (profile: Profile | null) => void
  setLoading: (loading: boolean) => void
  setActiveRole: (role: UserRole) => void
  clearAuth: () => void
  hasRole: (role: UserRole) => boolean
  getAvailableRoles: () => UserRole[]
}

// Keys to wipe on every sign-out / sign-in to prevent cross-trainer data leakage
// on shared tablets. sessionStorage is already scoped to the browser tab, but
// these localStorage keys must be explicitly cleared.
export const PERSISTENT_STORAGE_KEYS = ['activeRole', 'selectedLocation', 'clientSearchState']

export function clearAllUserStorage() {
  if (typeof window === 'undefined') return
  PERSISTENT_STORAGE_KEYS.forEach(k => {
    localStorage.removeItem(k)
    sessionStorage.removeItem(k)
  })
  // Also wipe every Supabase auth key from both storages so the previous
  // trainer's token cannot be picked up by getSession() on the next page load.
  const wipeSupabaseKeys = (storage: Storage) => {
    const keysToRemove: string[] = []
    for (let i = 0; i < storage.length; i++) {
      const k = storage.key(i)
      if (k && (k.startsWith('sb-') || k.includes('supabase'))) keysToRemove.push(k)
    }
    keysToRemove.forEach(k => storage.removeItem(k))
  }
  wipeSupabaseKeys(sessionStorage)
  wipeSupabaseKeys(localStorage)
}

// Create store with SSR-safe initialization
const createAuthStore = () => {
  // activeRole is stored in sessionStorage only — never localStorage — so it
  // cannot leak to the next trainer who picks up the same tablet.
  const initialActiveRole = typeof window !== 'undefined'
    ? sessionStorage.getItem('activeRole') as UserRole | null
    : null

  return create<AuthState>((set, get) => ({
    user: null,
    profile: null,
    loading: true,
    activeRole: initialActiveRole,
    setUser: (user) => set({ user }),
    setProfile: (profile) => {
      // When profile is set, initialize activeRole if not already set
      const state = get()
      const newActiveRole = state.activeRole || profile?.role || null
      set({ profile, activeRole: newActiveRole })
    },
    setLoading: (loading) => set({ loading }),
    setActiveRole: (role) => {
      if (typeof window !== 'undefined') {
        sessionStorage.setItem('activeRole', role)
      }
      set({ activeRole: role })
    },
    clearAuth: () => {
      clearAllUserStorage()
      set({ user: null, profile: null, loading: false, activeRole: null })
    },
    hasRole: (role) => {
      const { profile } = get()
      if (!profile) return false
      // Check both the roles array and the primary role field
      return profile.roles?.includes(role) || profile.role === role
    },
    getAvailableRoles: () => {
      const { profile } = get()
      if (!profile) return []
      // Return roles array if it exists and has items, otherwise return primary role
      if (profile.roles && profile.roles.length > 0) {
        return profile.roles
      }
      return [profile.role]
    },
  }))
}

export const useAuthStore = createAuthStore()