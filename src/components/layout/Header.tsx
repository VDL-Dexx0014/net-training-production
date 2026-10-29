// src/components/layout/Header.tsx
// Reusable header component with logo

'use client'

import Image from 'next/image'
import { RoleSwitcher } from './RoleSwitcher'
import { useAuthStore } from '@/store/auth-store'
import { Badge } from '@/components/ui/badge'
import { MapPin } from 'lucide-react'

interface HeaderProps {
  showSignOut?: boolean
  onSignOut?: () => void
  showRoleSwitcher?: boolean
  selectedLocation?: { id: string; name: string } | null
  showWelcome?: boolean
  sticky?: boolean
}

export function Header({ showSignOut = false, onSignOut, showRoleSwitcher = false, selectedLocation, showWelcome = true, sticky = true }: HeaderProps) {
  const { profile, loading } = useAuthStore()

  return (
    <header className={`${sticky ? 'sticky top-0 z-40' : 'relative'} bg-white border-b shadow-sm`}>
      <div className="container mx-auto px-3 py-1.5">
        <div className="flex justify-between items-center gap-2">
          {/* Left side: Welcome message + location badge */}
          <div className="flex flex-col gap-0.5">
            {showWelcome && !loading && profile && (
              <>
                <h1 className="text-base font-semibold text-slate-800">
                  Welcome, {profile.first_name || 'User'}!
                </h1>
                {selectedLocation && (
                  <Badge variant="outline" className="bg-blue-50 text-xs w-fit">
                    <MapPin className="h-3 w-3 mr-1" />
                    {selectedLocation.name}
                  </Badge>
                )}
              </>
            )}
          </div>

          {/* Right side: Controls + Logo */}
          <div className="flex items-center gap-3">
            {showRoleSwitcher && <RoleSwitcher />}
            {showSignOut && onSignOut && (
              <button
                onClick={onSignOut}
                className="px-3 py-1 bg-slate-100 rounded-lg shadow hover:bg-slate-200 transition-colors font-medium text-sm"
              >
                Sign Out
              </button>
            )}
            <div
              style={{ backgroundColor: 'rgb(227, 221, 45)' }}
              className="flex items-center justify-center h-8 px-3 rounded"
            >
              <Image
                src="/net_logo_new.png"
                alt="NET Personal Training Logo"
                width={72}
                height={24}
                style={{ width: 'auto', height: '20px' }}
                className="object-contain"
                priority
              />
            </div>
          </div>
        </div>
      </div>
    </header>
  )
}
