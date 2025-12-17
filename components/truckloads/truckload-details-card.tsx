"use client"

import { useState } from "react"
import { format } from "date-fns"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Pencil, User, Calendar, FileText, Hash, Truck } from "lucide-react"
import { EditTruckloadDialog } from "./edit-truckload-dialog"

interface TruckloadDetailsCardProps {
  truckload: {
    id: number
    driverId?: number | null
    driverName: string | null
    driverColor: string | null
    startDate: string
    endDate: string
    description: string | null
    billOfLadingNumber: string | null
    trailerNumber: string | null
    isCompleted: boolean
  }
  onTruckloadUpdated?: () => void
}

export function TruckloadDetailsCard({ truckload, onTruckloadUpdated }: TruckloadDetailsCardProps) {
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)

  return (
    <>
      <Card>
        <CardContent className="p-3 space-y-3">
          {/* Header */}
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold">Truckload Details</h3>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsEditDialogOpen(true)}
              className="h-7 px-2 text-xs"
            >
              <Pencil className="h-3 w-3 mr-1" />
              Edit
            </Button>
          </div>

          {/* Driver */}
          <div className="flex items-center gap-2">
            <User className="h-3 w-3 text-gray-500" />
            <span className="text-xs text-gray-600">Driver:</span>
            <div className="flex items-center gap-1">
              {truckload.driverColor && (
                <div 
                  className="w-2 h-2 rounded-full border" 
                  style={{ backgroundColor: truckload.driverColor }}
                />
              )}
              <span className="text-xs font-medium">{truckload.driverName || 'Unassigned'}</span>
            </div>
          </div>

          {/* Date Range */}
          <div className="flex items-center gap-2">
            <Calendar className="h-3 w-3 text-gray-500" />
            <span className="text-xs text-gray-600">Dates:</span>
            <div className="text-xs font-medium">
              {truckload.startDate && truckload.endDate
                ? (() => {
                    // Parse dates as local dates to avoid timezone conversion
                    const startParts = truckload.startDate.split('-')
                    const endParts = truckload.endDate.split('-')
                    const startDate = new Date(parseInt(startParts[0]), parseInt(startParts[1]) - 1, parseInt(startParts[2]))
                    const endDate = new Date(parseInt(endParts[0]), parseInt(endParts[1]) - 1, parseInt(endParts[2]))
                    return `${format(startDate, 'MMM dd')} - ${format(endDate, 'MMM dd')}`
                  })()
                : 'No dates'}
            </div>
          </div>

          {/* Description */}
          <div className="flex items-start gap-2">
            <FileText className="h-3 w-3 text-gray-500 mt-0.5" />
            <span className="text-xs text-gray-600">Desc:</span>
            <div className="text-xs flex-1 truncate">
              {truckload.description || (
                <span className="text-gray-400 italic">No description</span>
              )}
            </div>
          </div>

          {/* BOL and Trailer */}
          <div className="grid grid-cols-2 gap-2">
            <div className="flex items-center gap-1">
              <Hash className="h-3 w-3 text-gray-500" />
              <div className="text-xs">
                <div className="text-gray-600">BOL:</div>
                <div className="font-medium truncate">
                  {truckload.billOfLadingNumber || (
                    <span className="text-gray-400 italic">No BOL</span>
                  )}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <Truck className="h-3 w-3 text-gray-500" />
              <div className="text-xs">
                <div className="text-gray-600">Trailer:</div>
                <div className="font-medium truncate">
                  {truckload.trailerNumber || (
                    <span className="text-gray-400 italic">No trailer</span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Status */}
          <div className="flex items-center justify-between pt-2 border-t">
            <span className="text-xs text-gray-600">Status:</span>
            <Badge variant={truckload.isCompleted ? "default" : "secondary"} className="text-xs px-1.5 py-0.5">
              {truckload.isCompleted ? "Completed" : "In Progress"}
            </Badge>
          </div>
        </CardContent>
      </Card>

      <EditTruckloadDialog
        isOpen={isEditDialogOpen}
        onClose={() => setIsEditDialogOpen(false)}
        truckload={{
          id: truckload.id,
          driverId: truckload.driverId || 0, // Use driverId if available, otherwise 0
          startDate: truckload.startDate,
          endDate: truckload.endDate,
          trailerNumber: truckload.trailerNumber,
          description: truckload.description,
          billOfLadingNumber: truckload.billOfLadingNumber
        }}
        onTruckloadUpdated={() => {
          onTruckloadUpdated?.()
        }}
      />
    </>
  )
}
