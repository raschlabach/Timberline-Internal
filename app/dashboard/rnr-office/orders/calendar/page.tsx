'use client'

import { CalendarRange } from 'lucide-react'

export default function OrderCalendarPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
          <CalendarRange className="h-7 w-7 text-amber-600" />
          Order Calendar
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          Calendar view of orders by due date coming soon.
        </p>
      </div>
      <div className="bg-white rounded-xl border border-gray-200 p-12 shadow-sm text-center">
        <CalendarRange className="h-12 w-12 text-gray-300 mx-auto" />
        <p className="text-gray-400 mt-4">Monthly/weekly calendar with color-coded order statuses will be built in Phase 4</p>
      </div>
    </div>
  )
}
