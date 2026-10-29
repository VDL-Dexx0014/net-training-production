// src/components/dashboard/UnifiedDashboard.tsx
// Unified tabbed dashboard for trainers and management

'use client'

import { useEffect, useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useAuthStore } from '@/store/auth-store'
import { signOut } from '@/lib/auth/auth-helpers'
import { toast } from 'sonner'
import { Header } from '@/components/layout/Header'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { LocationsTab } from './LocationsTab'
import { ClientsTab } from './ClientsTab'
import { AdminTab } from './AdminTab'

interface SelectedLocation {
  id: string
  name: string
}

function UnifiedDashboardContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { profile, loading, hasRole } = useAuthStore()
  const [activeTab, setActiveTab] = useState<string>('locations')
  const [selectedLocation, setSelectedLocation] = useState<SelectedLocation | null>(null)

  const isTrainer = hasRole('trainer')
  const isManagement = hasRole('management')

  // Handle tab query parameter (for returning from client profile)
  useEffect(() => {
    const tabParam = searchParams?.get('tab')
    if (tabParam && ['locations', 'clients', 'admin'].includes(tabParam)) {
      setActiveTab(tabParam)
    }
  }, [searchParams])

  // Rehydrate selected location from localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('selectedLocation')
      if (stored) {
        try {
          setSelectedLocation(JSON.parse(stored))
        } catch {}
      }
    }
  }, [])

  // Auth guard
  useEffect(() => {
    if (!loading && (!profile || (!isTrainer && !isManagement))) {
      router.push('/login')
    }
  }, [profile, loading, router, isTrainer, isManagement])

  const handleLocationSelect = (location: SelectedLocation) => {
    setSelectedLocation(location)
    if (typeof window !== 'undefined') {
      localStorage.setItem('selectedLocation', JSON.stringify(location))
    }
    setActiveTab('clients')
    router.replace('?tab=clients', { scroll: false })
  }

  const handleTabChange = (value: string) => {
    // Gating: trainers must select a location before accessing Clients tab
    if (value === 'clients' && !selectedLocation && isTrainer && !isManagement) {
      toast.info('Please select a location first')
      return
    }
    setActiveTab(value)
    router.replace(`?tab=${value}`, { scroll: false })
  }

  const handleSignOut = () => {
    // Clear local state and navigate immediately — don't wait for network
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
      <Header
        showSignOut
        onSignOut={handleSignOut}
        showRoleSwitcher
        selectedLocation={selectedLocation}
      />

      <main className="container mx-auto px-3 pt-1 pb-3">
        <Tabs value={activeTab} onValueChange={handleTabChange}>
          <div className="sticky top-[45px] z-30 bg-slate-50 pb-1 pt-1">
          <TabsList className="w-full justify-start rounded-xl bg-slate-100 p-1 h-auto flex-wrap gap-[1mm]">
            <TabsTrigger
              value="locations"
              className="px-4 py-1.5 rounded-lg font-bold text-sm !bg-blue-600 !text-white data-[state=active]:!opacity-100 data-[state=active]:!shadow-md data-[state=inactive]:!opacity-50 transition-all"
            >
              Locations
            </TabsTrigger>
            <TabsTrigger
              value="clients"
              className="px-4 py-1.5 rounded-lg font-bold text-sm !bg-emerald-600 !text-white data-[state=active]:!opacity-100 data-[state=active]:!shadow-md data-[state=inactive]:!opacity-50 transition-all"
              disabled={!selectedLocation && isTrainer && !isManagement}
            >
              Clients
            </TabsTrigger>
            {isManagement && (
              <TabsTrigger
                value="admin"
                className="px-4 py-1.5 rounded-lg font-bold text-sm !bg-amber-600 !text-white data-[state=active]:!opacity-100 data-[state=active]:!shadow-md data-[state=inactive]:!opacity-50 transition-all"
              >
                Admin
              </TabsTrigger>
            )}
          </TabsList>
          </div>

          <TabsContent value="locations">
            <LocationsTab
              selectedLocationId={selectedLocation?.id || null}
              onLocationSelect={handleLocationSelect}
            />
          </TabsContent>

          <TabsContent value="clients">
            <ClientsTab selectedLocationId={selectedLocation?.id || null} />
          </TabsContent>

          {isManagement && (
            <TabsContent value="admin">
              <AdminTab />
            </TabsContent>
          )}
        </Tabs>
      </main>
    </div>
  )
}

export function UnifiedDashboard() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-lg">Loading...</div>
      </div>
    }>
      <UnifiedDashboardContent />
    </Suspense>
  )
}
