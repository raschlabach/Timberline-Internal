'use client'

import { DollarSign } from 'lucide-react'

export default function LumberCostsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
          <DollarSign className="h-7 w-7 text-amber-600" />
          Lumber Costs
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          Species and grade pricing tracker coming soon.
        </p>
      </div>
      <div className="bg-white rounded-xl border border-gray-200 p-12 shadow-sm text-center">
        <DollarSign className="h-12 w-12 text-gray-300 mx-auto" />
        <p className="text-gray-400 mt-4">Lumber cost tracking by species, grade, and thickness will be built in Phase 5</p>
      </div>
    </div>
  )
}
