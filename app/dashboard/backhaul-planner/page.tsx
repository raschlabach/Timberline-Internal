'use client';

import React from 'react';
import { Card } from "@/components/ui/card"
import { LoadBoardOrders } from "@/components/orders/load-board-orders"

export default function BackhaulPlannerPage() {
  const initialFilters = {
    ohioToIndiana: false,
    backhaul: true, // Pre-select backhaul filter
    localFlatbed: false,
    rrOrder: false,
    localSemi: false,
    middlefield: false,
    paNy: false
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-gray-900">Backhaul Planner</h1>
      </div>

      {/* Available Backhauls */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Available Backhauls</h2>
        </div>
        <LoadBoardOrders 
          initialFilters={{
            ohioToIndiana: false,
            backhaul: true,
            localFlatbed: false,
            rrOrder: false,
            localSemi: false,
            middlefield: false,
            paNy: false,
          }}
          showFilters={false}
          showSortDropdown={true}
          prioritizeRushOrders={false}
          hideOnAnyAssignment={true}
          storageKeyPrefix="backhaul-planner"
        />
      </div>
    </div>
  )
} 