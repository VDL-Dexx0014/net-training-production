// src/components/dashboard/AdminTab.tsx
// Tab 3: Admin panel with nested sub-tabs (management role only)

'use client'

import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { LocationsAdminSection } from './admin/LocationsAdminSection'
import { MachinesAdminSection } from './admin/MachinesAdminSection'
import { MachineAttributesAdminSection } from './admin/MachineAttributesAdminSection'
import { TrainerManagementSection } from './admin/TrainerManagementSection'
import { DefaultRoutinesSection } from './admin/DefaultRoutinesSection'
import { MeasurementTypesAdminSection } from './admin/MeasurementTypesAdminSection'
import { AdminManagementSection } from './admin/AdminManagementSection'

export function AdminTab() {
  return (
    <div className="py-4">
      <Tabs defaultValue="trainers">
        <TabsList className="w-fit justify-start rounded-xl border-2 border-slate-200 bg-slate-50 p-1.5 shadow-[inset_1px_1px_2px_rgba(255,255,255,0.8),inset_-1px_-1px_2px_rgba(0,0,0,0.05)] h-auto flex-wrap gap-[1mm]">
          <TabsTrigger
            value="trainers"
            className="px-5 py-2 rounded-lg font-bold text-sm !bg-orange-600 !text-white data-[state=active]:!opacity-100 data-[state=active]:shadow-md data-[state=active]:ring-2 data-[state=active]:ring-black data-[state=inactive]:!opacity-60 transition-all"
          >
            Instructors
          </TabsTrigger>
          <TabsTrigger
            value="locations"
            className="px-5 py-2 rounded-lg font-bold text-sm !bg-indigo-600 !text-white data-[state=active]:!opacity-100 data-[state=active]:shadow-md data-[state=active]:ring-2 data-[state=active]:ring-black data-[state=inactive]:!opacity-60 transition-all"
          >
            Locations
          </TabsTrigger>
          <TabsTrigger
            value="machines"
            className="px-5 py-2 rounded-lg font-bold text-sm !bg-violet-600 !text-white data-[state=active]:!opacity-100 data-[state=active]:shadow-md data-[state=active]:ring-2 data-[state=active]:ring-black data-[state=inactive]:!opacity-60 transition-all"
          >
            Machines
          </TabsTrigger>
          <TabsTrigger
            value="machine-attributes"
            className="px-5 py-2 rounded-lg font-bold text-sm !bg-violet-400 !text-white data-[state=active]:!opacity-100 data-[state=active]:shadow-md data-[state=active]:ring-2 data-[state=active]:ring-black data-[state=inactive]:!opacity-60 transition-all"
          >
            Machine Attributes
          </TabsTrigger>
          <TabsTrigger
            value="routines"
            className="px-5 py-2 rounded-lg font-bold text-sm !bg-cyan-600 !text-white data-[state=active]:!opacity-100 data-[state=active]:shadow-md data-[state=active]:ring-2 data-[state=active]:ring-black data-[state=inactive]:!opacity-60 transition-all"
          >
            Default Routines
          </TabsTrigger>
          <TabsTrigger
            value="measurements"
            className="px-5 py-2 rounded-lg font-bold text-sm !bg-amber-600 !text-white data-[state=active]:!opacity-100 data-[state=active]:shadow-md data-[state=active]:ring-2 data-[state=active]:ring-black data-[state=inactive]:!opacity-60 transition-all"
          >
            Measurement Types
          </TabsTrigger>
          <TabsTrigger
            value="admins"
            className="px-5 py-2 rounded-lg font-bold text-sm !bg-pink-600 !text-white data-[state=active]:!opacity-100 data-[state=active]:shadow-md data-[state=active]:ring-2 data-[state=active]:ring-black data-[state=inactive]:!opacity-60 transition-all"
          >
            Admins
          </TabsTrigger>
        </TabsList>

        <TabsContent value="trainers" className="mt-4">
          <TrainerManagementSection />
        </TabsContent>
        <TabsContent value="locations" className="mt-4">
          <LocationsAdminSection />
        </TabsContent>
        <TabsContent value="machines" className="mt-4">
          <MachinesAdminSection />
        </TabsContent>
        <TabsContent value="machine-attributes" className="mt-4">
          <MachineAttributesAdminSection />
        </TabsContent>
        <TabsContent value="routines" className="mt-4">
          <DefaultRoutinesSection />
        </TabsContent>
        <TabsContent value="measurements" className="mt-4">
          <MeasurementTypesAdminSection />
        </TabsContent>
        <TabsContent value="admins" className="mt-4">
          <AdminManagementSection />
        </TabsContent>
      </Tabs>
    </div>
  )
}
