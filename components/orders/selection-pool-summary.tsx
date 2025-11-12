"use client"

import { useState, useEffect } from 'react'
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { X, Truck } from "lucide-react"
import { ScrollArea } from "@/components/ui/scroll-area"

interface PoolItem {
  orderId: number
  assignmentTypes: ('pickup' | 'delivery')[]
  pickupCustomer: {
    id: number
    name: string
  }
  deliveryCustomer: {
    id: number
    name: string
  }
  footage: number
  skidsData?: Array<{
    id: number
    type: 'skid'
    width: number
    length: number
    footage: number
    quantity: number
  }>
  vinylData?: Array<{
    id: number
    type: 'vinyl'
    width: number
    length: number
    footage: number
    quantity: number
  }>
}

interface SelectionPoolSummaryProps {
  poolItems: PoolItem[]
  onRemoveFromPool: (orderId: number, assignmentType: 'pickup' | 'delivery') => void
  onClearAll: () => void
  onBulkAssign: () => void
}

export function SelectionPoolSummary({ 
  poolItems, 
  onRemoveFromPool, 
  onClearAll, 
  onBulkAssign 
}: SelectionPoolSummaryProps) {
  const [totalFootage, setTotalFootage] = useState(0)
  const [skidSummary, setSkidSummary] = useState<Record<string, number>>({})
  const [vinylSummary, setVinylSummary] = useState<Record<string, number>>({})

  useEffect(() => {
    // Calculate totals - add footage for each assignment (not deduplicating)
    let total = 0
    const skids: Record<string, number> = {}
    const vinyl: Record<string, number> = {}

    poolItems.forEach(item => {
      // Add footage for each assignment (ensure it's a number)
      total += Number(item.footage) || 0

      // Add skids for each assignment
      if (item.skidsData) {
        item.skidsData.forEach(skid => {
          const key = `${skid.width}x${skid.length}`
          skids[key] = (skids[key] || 0) + skid.quantity
        })
      }

      // Add vinyl for each assignment
      if (item.vinylData) {
        item.vinylData.forEach(vinylItem => {
          const key = `${vinylItem.width}x${vinylItem.length}`
          vinyl[key] = (vinyl[key] || 0) + vinylItem.quantity
        })
      }
    })

    setTotalFootage(total)
    setSkidSummary(skids)
    setVinylSummary(vinyl)
  }, [poolItems])

  if (poolItems.length === 0) {
    return null
  }

  return (
    <Card className="mb-4">
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <h3 className="text-lg font-semibold">Assignment Pool</h3>
            <Badge variant="secondary">{poolItems.length} items</Badge>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={onClearAll}
              className="text-gray-600 hover:text-gray-800"
            >
              <X className="h-4 w-4 mr-1" />
              Clear All
            </Button>
            <Button
              onClick={onBulkAssign}
              className="bg-blue-600 hover:bg-blue-700"
            >
              <Truck className="h-4 w-4 mr-2" />
              Assign All
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-3">
          {/* Total Footage */}
          <div className="bg-gray-50 p-3 rounded-lg">
            <div className="text-sm text-gray-600">Total Footage</div>
            <div className="text-xl font-semibold">{totalFootage.toLocaleString()} ft²</div>
          </div>

          {/* Skids Summary */}
          <div className="bg-gray-50 p-3 rounded-lg">
            <div className="text-sm text-gray-600 mb-2">Skids</div>
            <div className="space-y-1">
              {Object.entries(skidSummary).length > 0 ? (
                Object.entries(skidSummary).map(([dimensions, quantity]) => (
                  <div key={dimensions} className="text-sm">
                    {quantity} - {dimensions} skids
                  </div>
                ))
              ) : (
                <div className="text-sm text-gray-500">No skids</div>
              )}
            </div>
          </div>

          {/* Vinyl Summary */}
          <div className="bg-gray-50 p-3 rounded-lg">
            <div className="text-sm text-gray-600 mb-2">Vinyl</div>
            <div className="space-y-1">
              {Object.entries(vinylSummary).length > 0 ? (
                Object.entries(vinylSummary).map(([dimensions, quantity]) => (
                  <div key={dimensions} className="text-sm">
                    {quantity} - {dimensions} vinyl
                  </div>
                ))
              ) : (
                <div className="text-sm text-gray-500">No vinyl</div>
              )}
            </div>
          </div>
        </div>

      </CardContent>
    </Card>
  )
}
