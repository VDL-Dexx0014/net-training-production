// src/components/dashboard/admin/AdminManagementSection.tsx
// Admin section for viewing and managing admin (management) users

'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Shield, Plus, Pencil } from 'lucide-react'
import { CreateAdminDialog } from '@/components/management/CreateAdminDialog'
import { EditAdminDialog } from '@/components/management/EditAdminDialog'

interface AdminInfo {
  id: string
  first_name: string
  last_name: string
  email: string
  is_active: boolean
}

export function AdminManagementSection() {
  const [admins, setAdmins] = useState<AdminInfo[]>([])
  const [loading, setLoading] = useState(true)
  const [createOpen, setCreateOpen] = useState(false)
  const [editAdmin, setEditAdmin] = useState<AdminInfo | null>(null)
  const [editOpen, setEditOpen] = useState(false)

  useEffect(() => {
    loadAdmins()
  }, [])

  const loadAdmins = async () => {
    setLoading(true)
    const supabase = createClient()

    // Fetch all admins (not just active)
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, first_name, last_name, email, is_active')
      .contains('roles', ['management'])
      .order('is_active', { ascending: false })
      .order('first_name')

    if (!profiles || profiles.length === 0) {
      setAdmins([])
      setLoading(false)
      return
    }

    const enriched: AdminInfo[] = profiles.map((p: any) => ({
      id: p.id,
      first_name: p.first_name,
      last_name: p.last_name,
      email: p.email,
      is_active: p.is_active ?? true,
    }))

    setAdmins(enriched)
    setLoading(false)
  }

  const activeCount = admins.filter(a => a.is_active).length

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h3 className="font-semibold text-lg">
          Admins <span className="font-normal text-sm">({activeCount} active)</span>
        </h3>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Create Admin
        </Button>
      </div>

      {loading ? (
        <div className="py-8 text-center">Loading admins...</div>
      ) : admins.length === 0 ? (
        <div className="py-8 text-center">No admin users found</div>
      ) : (
        <div className="space-y-2">
          {admins.map((admin) => (
            <div
              key={admin.id}
              className={`flex items-center justify-between p-3 border rounded-lg transition-colors cursor-pointer ${
                admin.is_active
                  ? 'hover:bg-slate-50'
                  : 'bg-slate-100 opacity-75 hover:bg-slate-150'
              }`}
              onClick={() => { setEditAdmin(admin); setEditOpen(true) }}
            >
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-indigo-100 flex items-center justify-center">
                  <Shield className="h-4 w-4 text-indigo-600" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm">
                      {admin.first_name} {admin.last_name}
                    </span>
                    <Badge
                      variant={admin.is_active ? 'default' : 'secondary'}
                      className={admin.is_active ? 'bg-green-600' : 'bg-slate-500'}
                    >
                      {admin.is_active ? 'Active' : 'Archived'}
                    </Badge>
                  </div>
                  <div className="text-xs text-slate-500">{admin.email}</div>
                </div>
              </div>
              <Pencil className="h-3.5 w-3.5 text-slate-400" />
            </div>
          ))}
        </div>
      )}

      <CreateAdminDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onAdminCreated={loadAdmins}
      />

      <EditAdminDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        admin={editAdmin}
        onAdminUpdated={loadAdmins}
      />
    </div>
  )
}
