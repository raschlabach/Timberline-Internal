'use client'

import { ClipboardList } from 'lucide-react'

export default function OrdersPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
          <ClipboardList className="h-7 w-7 text-amber-600" />
          Orders
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          Order management coming soon. Set up Master Parts first.
        </p>
      </div>
      <div className="bg-white rounded-xl border border-gray-200 p-12 shadow-sm text-center">
        <ClipboardList className="h-12 w-12 text-gray-300 mx-auto" />
        <p className="text-gray-400 mt-4">Order entry, calendar view, and status tracking will be built in Phase 4</p>
      </div>
    </div>
  )
}
