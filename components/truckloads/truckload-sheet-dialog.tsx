"use client"

import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { useRef } from "react"
import { useReactToPrint } from "react-to-print"
import { formatPhoneNumber } from "@/lib/utils"

interface TruckloadStop {
  id: number
  assignment_type: 'pickup' | 'delivery'
  sequence_number: number
  stop_completed: boolean
  status: string
  pickup_customer: {
    id: number
    name: string
    address: string
    phone_number_1: string | null
    phone_number_2: string | null
  }
  delivery_customer: {
    id: number
    name: string
    address: string
    phone_number_1: string | null
    phone_number_2: string | null
  }
  skids: number
  vinyl: number
  footage: number
  hand_bundles: number
  skids_data: Array<{
    id: number
    type: 'skid'
    width: number
    length: number
    footage: number
    quantity: number
  }>
  vinyl_data: Array<{
    id: number
    type: 'vinyl'
    width: number
    length: number
    footage: number
    quantity: number
  }>
  hand_bundles_data: Array<{
    id: string
    quantity: number
    description: string
  }>
  pickup_date: string
  is_rush: boolean
  needs_attention: boolean
  comments: string
  freight_quote: string
  is_transfer_order: boolean
}

interface TruckloadData {
  id: number
  driverId: number
  startDate: string
  endDate: string
  trailerNumber: string | null
  billOfLadingNumber: string | null
  description: string | null
  isCompleted: boolean
  totalMileage: number | null
  estimatedDuration: number | null
  driverName: string | null
  driverColor: string | null
  pickupFootage: number | null
  deliveryFootage: number | null
  transferFootage: number | null
}

interface TruckloadSheetDialogProps {
  truckload: TruckloadData
  stops: TruckloadStop[]
  children?: React.ReactNode
}

export function TruckloadSheetDialog({ truckload, stops, children }: TruckloadSheetDialogProps) {
  const printRef = useRef<HTMLDivElement>(null)

  const handlePrint = useReactToPrint({
    documentTitle: `Truckload-Sheet-${truckload.id}`,
    pageStyle: `
      @page {
        size: letter;
        margin: 0.5in;
      }
      @media print {
        body {
          print-color-adjust: exact;
          -webkit-print-color-adjust: exact;
        }
        .print\\:hidden {
          display: none !important;
        }
      }
    `,
    contentRef: printRef,
  })

  // Sort stops by sequence number (bottom to top display)
  const sortedStops = [...stops].sort((a, b) => b.sequence_number - a.sequence_number)

  // Calculate totals using the same method as the sidebar
  const pickupFootage = sortedStops
    .filter(s => s.assignment_type === 'pickup' && !s.is_transfer_order)
    .reduce((total, stop) => total + Number(stop.footage || 0), 0)

  const deliveryFootage = sortedStops
    .filter(s => s.assignment_type === 'delivery' && !s.is_transfer_order)
    .reduce((total, stop) => total + Number(stop.footage || 0), 0)

  const transferFootage = sortedStops
    .filter(s => s.is_transfer_order)
    .reduce((acc, stop) => {
      const orderId = stop.id // Using stop.id as the unique identifier
      if (!acc.processedOrders.has(orderId)) {
        acc.processedOrders.add(orderId)
        acc.total += Number(stop.footage || 0)
      }
      return acc
    }, { total: 0, processedOrders: new Set<number>() })
    .total

  const totalFootage = pickupFootage + deliveryFootage + transferFootage

  // Format dates
  // Parse dates manually to avoid timezone issues
  const parseDateString = (dateStr: string): Date => {
    const parts = dateStr.split('-')
    return new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]))
  }
  
  const startDate = parseDateString(truckload.startDate).toLocaleDateString('en-US', {
    month: '2-digit',
    day: '2-digit',
    year: '2-digit'
  })
  const endDate = parseDateString(truckload.endDate).toLocaleDateString('en-US', {
    month: '2-digit',
    day: '2-digit',
    year: '2-digit'
  })

  return (
    <Dialog>
      <DialogTrigger asChild>
        {children || (
          <Button variant="outline" size="sm" className="flex items-center gap-2">
            View Sheet
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-[52rem] w-auto max-h-[90vh] flex flex-col">
        <div 
          ref={printRef} 
          className="bg-white w-full flex flex-col relative z-0 overflow-y-auto flex-1 min-h-0"
          style={{
            width: '8.5in',
            minHeight: '11in',
            padding: '0.4in',
            margin: '0 auto',
            boxSizing: 'border-box'
          }}
        >
          {/* Header Section */}
          <div className="mb-4 flex-shrink-0">
            {/* Top Row - Company Info and Load Details */}
            <div className="flex justify-between items-start mb-3">
              {/* Left - Company Info */}
              <div>
                <h1 className="text-2xl font-bold">Timberline Trucking</h1>
                <p className="text-sm">1350 CR 108 Sugarcreek OH, 44681</p>
              </div>
              
              {/* Right - Load Details */}
              <div className="text-right">
                <div className="text-sm font-semibold">
                  BOL# {truckload.billOfLadingNumber || 'N/A'}
                </div>
                <div className="text-sm font-semibold">
                  Trailer# {truckload.trailerNumber || 'N/A'}
                </div>
              </div>
            </div>

            {/* Second Row - Driver Info and Footage Summary */}
            <div className="flex justify-between items-center">
              {/* Left - Driver Info */}
              <div className="flex items-center gap-3">
                {truckload.driverColor && (
                  <div 
                    className="w-6 h-6 rounded-full border-2 border-gray-300 shadow-sm"
                    style={{ backgroundColor: truckload.driverColor }}
                  />
                )}
                <div className="text-sm">
                  <span className="font-semibold">{truckload.driverName || 'No Driver'}</span>
                  <span className="ml-2">{startDate} - {endDate}</span>
                </div>
              </div>
              
              {/* Center - Load Type */}
              <div className="text-sm text-center">
                {truckload.description || 'Local Truck'}
              </div>
              
              {/* Right - Footage Summary */}
              <div className="text-sm text-right">
                <div className="font-semibold text-red-600">
                  Pickups: {pickupFootage.toLocaleString()} ft²
                </div>
                <div className="font-semibold text-gray-900">
                  Deliveries: {deliveryFootage.toLocaleString()} ft²
                </div>
                {transferFootage > 0 && (
                  <div className="font-semibold text-blue-600">
                    Transfers: {transferFootage.toLocaleString()} ft²
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Stops List */}
          <div className="flex-1 min-h-0">
            <div className="space-y-1">
              {sortedStops.map((stop) => (
                <div key={stop.id} className="border-b border-gray-300 pb-2">
                  <div className={`flex justify-between items-start ${
                    stop.assignment_type === 'pickup' ? 'text-red-600' : 'text-black'
                  }`}>
                    <div className="flex-1">
                      {/* Stop Number and Customer */}
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-semibold text-lg">{stop.sequence_number}.</span>
                        <span className="font-bold text-base">
                          {stop.assignment_type === 'pickup' 
                            ? stop.pickup_customer.name 
                            : stop.delivery_customer.name
                          }
                        </span>
                        {/* Customer in parentheses with appropriate color */}
                        {stop.assignment_type === 'pickup' ? (
                          <span className="font-medium text-xs text-black ml-1">
                            ({stop.delivery_customer.name})
                          </span>
                        ) : (
                          <span className="font-medium text-xs text-red-600 ml-1">
                            ({stop.pickup_customer.name})
                          </span>
                        )}
                      </div>
                      
                      {/* Address and Phone Numbers */}
                      <div className="text-sm ml-6 mb-1">
                        <span>
                          {stop.assignment_type === 'pickup' 
                            ? stop.pickup_customer.address 
                            : stop.delivery_customer.address
                          }
                        </span>
                        <span className="ml-2">
                          {stop.assignment_type === 'pickup' ? (
                            <>
                              {stop.pickup_customer.phone_number_1 && (
                                <span>{formatPhoneNumber(stop.pickup_customer.phone_number_1)}</span>
                              )}
                              {stop.pickup_customer.phone_number_1 && stop.pickup_customer.phone_number_2 && (
                                <span> | </span>
                              )}
                              {stop.pickup_customer.phone_number_2 && (
                                <span>{formatPhoneNumber(stop.pickup_customer.phone_number_2)}</span>
                              )}
                              {!stop.pickup_customer.phone_number_1 && !stop.pickup_customer.phone_number_2 && (
                                <span>No phone</span>
                              )}
                            </>
                          ) : (
                            <>
                              {stop.delivery_customer.phone_number_1 && (
                                <span>{formatPhoneNumber(stop.delivery_customer.phone_number_1)}</span>
                              )}
                              {stop.delivery_customer.phone_number_1 && stop.delivery_customer.phone_number_2 && (
                                <span> | </span>
                              )}
                              {stop.delivery_customer.phone_number_2 && (
                                <span>{formatPhoneNumber(stop.delivery_customer.phone_number_2)}</span>
                              )}
                              {!stop.delivery_customer.phone_number_1 && !stop.delivery_customer.phone_number_2 && (
                                <span>No phone</span>
                              )}
                            </>
                          )}
                        </span>
                      </div>
                    </div>

                    {/* Items Count and Dimensions */}
                    <div className="text-right ml-4">
                      <div className="font-semibold">
                        {(() => {
                          const counts = []
                          const skidsCount = Number(stop.skids)
                          if (skidsCount > 0) {
                            const skidText = skidsCount === 1 ? '1 Skid' : `${skidsCount} Skids`
                            counts.push(skidText)
                          }
                          if (stop.vinyl > 0) {
                            counts.push(`${stop.vinyl} Vinyl`)
                          }
                          return counts.join(' | ')
                        })()}
                      </div>
                      <div className="text-xs text-gray-600 mt-1">
                        {(() => {
                          // Group skids by dimensions and sum quantities
                          const skidGroups = stop.skids_data.reduce((acc, skid) => {
                            const key = `${skid.width}x${skid.length}`
                            acc[key] = (acc[key] || 0) + skid.quantity
                            return acc
                          }, {} as Record<string, number>)
                          
                          // Group vinyl by dimensions and sum quantities
                          const vinylGroups = stop.vinyl_data.reduce((acc, vinyl) => {
                            const key = `${vinyl.width}x${vinyl.length}`
                            acc[key] = (acc[key] || 0) + vinyl.quantity
                            return acc
                          }, {} as Record<string, number>)
                          
                          // Create dimension strings
                          const skidDimensions = Object.entries(skidGroups).map(([dimensions, quantity]) => 
                            `${quantity} ${dimensions}`
                          )
                          const vinylDimensions = Object.entries(vinylGroups).map(([dimensions, quantity]) => 
                            `${quantity} ${dimensions}`
                          )
                          
                          const allDimensions = [...skidDimensions, ...vinylDimensions]
                          return allDimensions.join(' | ')
                        })()}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Print Button */}
          <div className="text-center print:hidden mt-4 flex-shrink-0">
            <Button onClick={() => handlePrint && handlePrint()} className="text-base px-8">
              Print
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
