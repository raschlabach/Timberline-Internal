"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Printer } from "lucide-react"
import { PickupSheet } from "./pickup-sheet"
import { LoadingSheet } from "./loading-sheet"

interface TruckloadData {
  id: number
  driverName: string
  startDate: string
  endDate: string
  trailerNumber: string
  description: string
}

interface PickupLoadingSheetsProps {
  truckloadId: number
}

export function PickupLoadingSheets({ truckloadId }: PickupLoadingSheetsProps) {
  const [truckloadData, setTruckloadData] = useState<TruckloadData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function fetchTruckloadData() {
      try {
        setIsLoading(true)
        const response = await fetch(`/api/truckloads/${truckloadId}`)
        if (!response.ok) {
          throw new Error("Failed to fetch truckload data")
        }
        const data = await response.json()
        if (!data.success) {
          throw new Error(data.error || "Failed to fetch truckload data")
        }
        
        setTruckloadData({
          id: data.truckload.id,
          driverName: data.truckload.driverName || "Unknown Driver",
          startDate: data.truckload.startDate || new Date().toISOString(),
          endDate: data.truckload.endDate || new Date().toISOString(),
          trailerNumber: data.truckload.trailerNumber || "N/A",
          description: data.truckload.description || "N/A"
        })
      } catch (err) {
        setError(err instanceof Error ? err.message : "An error occurred")
        console.error("Error fetching truckload data:", err)
      } finally {
        setIsLoading(false)
      }
    }

    if (truckloadId) {
      fetchTruckloadData()
    }
  }, [truckloadId])

  const handlePrintLoadSheet = () => {
    // Print functionality - this will print the current page
    window.print()
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="text-center text-muted-foreground">Loading truckload data...</div>
      </div>
    )
  }

  if (error || !truckloadData) {
    return (
      <div className="space-y-6">
        <div className="text-center text-red-500">Error: {error || "Failed to load truckload data"}</div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Pickup Sheet */}
      <PickupSheet
        truckloadId={truckloadData.id}
        driverName={truckloadData.driverName}
        startDate={truckloadData.startDate}
        endDate={truckloadData.endDate}
        trailerNumber={truckloadData.trailerNumber}
        description={truckloadData.description}
      />
      
      {/* Print Button */}
      <div className="flex justify-center py-4">
        <Button 
          onClick={handlePrintLoadSheet}
          className="bg-gray-600 hover:bg-gray-700 text-white px-8 py-3 text-sm font-medium rounded-md"
        >
          <Printer className="w-4 h-4 mr-2" />
          Print Load Sheet
        </Button>
      </div>
      
      {/* Loading Sheet */}
      <LoadingSheet
        truckloadId={truckloadData.id}
        driverName={truckloadData.driverName}
        startDate={truckloadData.startDate}
        endDate={truckloadData.endDate}
        trailerNumber={truckloadData.trailerNumber}
        description={truckloadData.description}
      />
    </div>
  )
}
