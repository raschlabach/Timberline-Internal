"use client"

import { useRouter } from "next/navigation"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Badge } from "@/components/ui/badge"
import { format } from "date-fns"
import { TruckloadSummary } from "@/types/truckloads"

interface TruckloadSidebarListProps {
  truckloads: TruckloadSummary[]
  currentTruckloadId?: number
}

export function TruckloadSidebarList({ truckloads, currentTruckloadId }: TruckloadSidebarListProps) {
  const router = useRouter()
  
  // Filter out completed truckloads and sort by start date
  const activeTrackloads = truckloads
    .filter(truckload => !truckload.isCompleted)
    .sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime())

  return (
    <div className="flex flex-col h-full">
      <div className="text-base font-medium py-3 px-4 border-b bg-gray-100">
        Active Truckloads ({activeTrackloads.length})
      </div>
      <ScrollArea className="flex-1">
        <div className="py-3">
          {activeTrackloads.map(truckload => (
            <div
              key={truckload.id}
              className={`px-4 py-4 mb-3 cursor-pointer hover:bg-gray-100 transition-colors border-l-3 ${
                truckload.id === currentTruckloadId 
                  ? 'bg-primary/5 border-primary' 
                  : 'border-transparent'
              }`}
              onClick={() => router.push(`/dashboard/trucking/${truckload.id}`)}
            >
              <div className="flex items-center gap-3">
                <div 
                  className="w-5 h-5 rounded-full flex-shrink-0" 
                  style={{ backgroundColor: truckload.driverColor }}
                />
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-center">
                    <div className="font-medium text-sm truncate">
                      #{truckload.id} {truckload.driverName ? `- ${truckload.driverName.split(' ')[0]}` : ''}
                    </div>
                    <div className="text-sm text-gray-500">
                      {format(new Date(truckload.startDate), 'MM/dd')}
                    </div>
                  </div>
                  
                  {truckload.description && (
                    <div className="text-sm text-gray-500 truncate mt-1.5">
                      {truckload.description}
                    </div>
                  )}
                  
                  <div className="flex gap-2 mt-3">
                    {truckload.pickupFootage > 0 && (
                      <Badge variant="secondary" className="text-xs h-6 px-2 bg-red-100 text-red-800">
                        P: {Math.round(truckload.pickupFootage)}
                      </Badge>
                    )}
                    {truckload.deliveryFootage > 0 && (
                      <Badge variant="secondary" className="text-xs h-6 px-2 bg-gray-100 text-gray-800">
                        D: {Math.round(truckload.deliveryFootage)}
                      </Badge>
                    )}
                    {truckload.transferFootage > 0 && (
                      <Badge variant="secondary" className="text-xs h-6 px-2 bg-blue-100 text-blue-800">
                        T: {Math.round(truckload.transferFootage)}
                      </Badge>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </ScrollArea>
    </div>
  )
} 