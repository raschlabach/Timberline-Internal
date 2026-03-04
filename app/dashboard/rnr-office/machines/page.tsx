'use client'

import { Wrench } from 'lucide-react'

export default function MachinesPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
          <Wrench className="h-7 w-7 text-amber-600" />
          Machines
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          Machine management and routing templates coming soon.
        </p>
      </div>
      <div className="bg-white rounded-xl border border-gray-200 p-12 shadow-sm text-center">
        <Wrench className="h-12 w-12 text-gray-300 mx-auto" />
        <p className="text-gray-400 mt-4">Machine CRUD, BF/LF rates, and routing template builder will be built in Phase 3</p>
      </div>
    </div>
  )
}
