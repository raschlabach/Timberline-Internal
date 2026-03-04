'use client'

import { Calculator } from 'lucide-react'

export default function QuotesPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
          <Calculator className="h-7 w-7 text-amber-600" />
          Quotes
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          Quoting system coming soon. Set up Master Parts and Machines first.
        </p>
      </div>
      <div className="bg-white rounded-xl border border-gray-200 p-12 shadow-sm text-center">
        <Calculator className="h-12 w-12 text-gray-300 mx-auto" />
        <p className="text-gray-400 mt-4">Quote builder with machine routing cost calculator will be built in Phase 5</p>
      </div>
    </div>
  )
}
