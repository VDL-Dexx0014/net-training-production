// src/components/layout/RoleSwitcher.tsx
// Component to switch between user roles (trainer/client)

'use client'

import { useAuthStore } from '@/store/auth-store'
import { useRouter } from 'next/navigation'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { User, Dumbbell, Settings } from 'lucide-react'

const roleConfig = {
  trainer: {
    label: 'Instructor',
    icon: Dumbbell,
    dashboard: '/trainer/dashboard',
    color: 'text-blue-600',
  },
  client: {
    label: 'Client',
    icon: User,
    dashboard: '/client/dashboard',
    color: 'text-green-600',
  },
  management: {
    label: 'Management',
    icon: Settings,
    dashboard: '/management/dashboard',
    color: 'text-purple-600',
  },
}

export function RoleSwitcher() {
  const router = useRouter()
  const { activeRole, setActiveRole, getAvailableRoles } = useAuthStore()

  const availableRoles = getAvailableRoles()

  // Don't show switcher if user has only one role
  if (availableRoles.length <= 1) {
    return null
  }

  const handleRoleChange = (newRole: string) => {
    const role = newRole as 'trainer' | 'client' | 'management'
    setActiveRole(role)

    // Navigate to the dashboard for the selected role
    const dashboard = roleConfig[role].dashboard
    router.push(dashboard)
  }

  if (!activeRole) return null

  const ActiveIcon = roleConfig[activeRole].icon

  return (
    <div className="flex items-center gap-2">
      <Select value={activeRole} onValueChange={handleRoleChange}>
        <SelectTrigger className="w-[160px] font-semibold">
          <div className="flex items-center gap-2">
            <ActiveIcon className={`h-4 w-4 ${roleConfig[activeRole].color}`} />
            <SelectValue />
          </div>
        </SelectTrigger>
        <SelectContent>
          {availableRoles.map((role) => {
            const Icon = roleConfig[role].icon
            return (
              <SelectItem key={role} value={role}>
                <div className="flex items-center gap-2">
                  <Icon className={`h-4 w-4 ${roleConfig[role].color}`} />
                  <span>{roleConfig[role].label}</span>
                </div>
              </SelectItem>
            )
          })}
        </SelectContent>
      </Select>
    </div>
  )
}
