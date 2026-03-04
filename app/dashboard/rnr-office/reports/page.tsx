'use client'

import { FileBarChart } from 'lucide-react'

export default function ReportsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
          <FileBarChart className="h-7 w-7 text-amber-600" />
          Reports
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          Reporting and analytics coming soon.
        </p>
      </div>
      <div className="bg-white rounded-xl border border-gray-200 p-12 shadow-sm text-center">
        <FileBarChart className="h-12 w-12 text-gray-300 mx-auto" />
        <p className="text-gray-400 mt-4">Order reports, production estimates, customer profitability, and margin analysis will be built in Phase 7</p>
      </div>
    </div>
  )
}
