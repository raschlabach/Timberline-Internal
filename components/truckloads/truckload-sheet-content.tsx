"use client"

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

interface TruckloadSheetContentProps {
  truckload: TruckloadData
  stops: TruckloadStop[]
  isPreview?: boolean
}

// Function to group stops by customer ID and assignment type (same as in truckload-stops-list)
function groupStopsByCustomer(stops: TruckloadStop[]) {
  const groups = new Map<string, {
    groupKey: string
    customerId: number
    assignmentType: 'pickup' | 'delivery'
    customerName: string
    customerAddress: string
    phone1: string | null
    phone2: string | null
    sequenceNumber: number
    stops: TruckloadStop[]
  }>()
  
  stops.forEach(stop => {
    const customerId = stop.assignment_type === 'pickup' 
      ? stop.pickup_customer.id 
      : stop.delivery_customer.id
    
    const groupKey = `${customerId}-${stop.assignment_type}`
    
    if (groups.has(groupKey)) {
      // Add to existing group
      const existingGroup = groups.get(groupKey)!
      existingGroup.stops.push(stop)
    } else {
      // Create new group
      const customer = stop.assignment_type === 'pickup' 
        ? stop.pickup_customer 
        : stop.delivery_customer
      
      groups.set(groupKey, {
        groupKey,
        customerId,
        assignmentType: stop.assignment_type,
        customerName: customer.name,
        customerAddress: customer.address,
        phone1: customer.phone_number_1,
        phone2: customer.phone_number_2,
        sequenceNumber: stop.sequence_number,
        stops: [stop]
      })
    }
  })
  
  // Convert to array and sort by sequence number (descending)
  return Array.from(groups.values()).sort((a, b) => b.sequenceNumber - a.sequenceNumber)
}

export function TruckloadSheetContent({ truckload, stops, isPreview = false }: TruckloadSheetContentProps) {
  // Group stops by customer
  const groupedStops = groupStopsByCustomer(stops)
  
  // Sort groups by sequence number (bottom to top display)
  const sortedGroups = [...groupedStops].sort((a, b) => {
    if (b.sequenceNumber !== a.sequenceNumber) {
      return b.sequenceNumber - a.sequenceNumber
    }
    return a.customerId - b.customerId // Secondary sort by customer ID for duplicates
  })

  // Debug: Check for duplicate sequence numbers
  const sequenceNumbers = groupedStops.map(group => group.sequenceNumber)
  const duplicates = sequenceNumbers.filter((num, index) => sequenceNumbers.indexOf(num) !== index)
  if (duplicates.length > 0) {
    console.log('Duplicate sequence numbers found:', duplicates)
    console.log('Groups with duplicates:', groupedStops.filter(group => duplicates.includes(group.sequenceNumber)))
  }

  // Calculate totals using all stops (not grouped)
  const pickupFootage = stops
    .filter(s => s.assignment_type === 'pickup' && !s.is_transfer_order)
    .reduce((total, stop) => total + Number(stop.footage || 0), 0)

  const deliveryFootage = stops
    .filter(s => s.assignment_type === 'delivery' && !s.is_transfer_order)
    .reduce((total, stop) => total + Number(stop.footage || 0), 0)

  const transferFootage = stops
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
  const startDate = new Date(truckload.startDate).toLocaleDateString('en-US', {
    month: '2-digit',
    day: '2-digit',
    year: '2-digit'
  })
  const endDate = new Date(truckload.endDate).toLocaleDateString('en-US', {
    month: '2-digit',
    day: '2-digit',
    year: '2-digit'
  })

  return (
    <div className="bg-white w-full flex flex-col print:bg-white print:text-black" style={isPreview ? {
      padding: '15px',
      boxSizing: 'border-box'
    } : {
      width: '8.5in',
      minHeight: '11in',
      padding: '0.1in',
      margin: '0',
      boxSizing: 'border-box'
    }}>
      {/* Header Section */}
      <div className="bg-gray-200 p-1 rounded print:rounded-none" style={{ marginBottom: '3px' }}>
        {/* Top Row - Driver, Company, and Load Details */}
        <div className="flex justify-between items-center" style={{ marginBottom: '3px' }}>
          {/* Left - Driver Info */}
          <div className="flex-1">
            <div className="flex items-center gap-2" style={{ marginBottom: '2px' }}>
              {truckload.driverColor && (
                <div 
                  className="w-5 h-5 rounded-full border-2 border-gray-300 shadow-sm"
                  style={{ backgroundColor: truckload.driverColor }}
                />
              )}
              <div className="text-xs font-semibold">
                {truckload.driverName || 'No Driver'}
              </div>
            </div>
            <div className="text-xs text-gray-600">
              {startDate} - {endDate}
            </div>
            <div className="text-xs font-medium">
              {truckload.description || 'Local Truck'}
            </div>
          </div>
          
          {/* Center - Company Info */}
          <div className="flex-1 text-center">
            <h1 className="text-lg font-bold leading-tight">Timberline Trucking</h1>
            <p className="text-xs leading-tight">1350 CR 108 Sugarcreek OH, 44681</p>
          </div>
          
          {/* Right - Load Details */}
          <div className="flex-1 text-right">
            <div className="text-xs font-semibold mb-1">
              BOL# {truckload.billOfLadingNumber || 'N/A'}
            </div>
            <div className="text-xs font-semibold mb-1">
              Trailer# {truckload.trailerNumber || 'N/A'}
            </div>
            <div className="text-xs flex gap-2 justify-end">
              <div className="font-semibold text-red-600 print:text-red-600">
                P: {pickupFootage.toLocaleString()} ft²
              </div>
              <div className="font-semibold text-gray-900 print:text-black">
                D: {deliveryFootage.toLocaleString()} ft²
              </div>
              {transferFootage > 0 && (
                <div className="font-semibold text-blue-600 print:text-blue-600">
                  T: {transferFootage.toLocaleString()} ft²
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Stops List */}
      <div className="flex-1">
        <div className="space-y-0">
          {sortedGroups.map((group) => {
            // Combine all skids and vinyl data from all stops in the group
            const combinedSkidsData = group.stops.reduce((acc, stop) => {
              stop.skids_data.forEach(skid => {
                const key = `${skid.width}x${skid.length}`
                acc[key] = (acc[key] || 0) + skid.quantity
              })
              return acc
            }, {} as Record<string, number>)
            
            const combinedVinylData = group.stops.reduce((acc, stop) => {
              stop.vinyl_data.forEach(vinyl => {
                const key = `${vinyl.width}x${vinyl.length}`
                acc[key] = (acc[key] || 0) + vinyl.quantity
              })
              return acc
            }, {} as Record<string, number>)
            
            // Calculate combined totals
            const totalSkids = group.stops.reduce((sum, stop) => sum + Number(stop.skids), 0)
            const totalVinyl = group.stops.reduce((sum, stop) => sum + Number(stop.vinyl), 0)
            
            // Get all the other customers (delivery customers for pickups, pickup customers for deliveries)
            const otherCustomers = group.stops.map(stop => 
              group.assignmentType === 'pickup' 
                ? stop.delivery_customer.name 
                : stop.pickup_customer.name
            )
            
            // Remove duplicates and join
            const uniqueOtherCustomers = Array.from(new Set(otherCustomers))
            const otherCustomersText = uniqueOtherCustomers.length > 1 
              ? `(${uniqueOtherCustomers.join(', ')})` 
              : `(${uniqueOtherCustomers[0]})`
            
            return (
              <div key={group.groupKey} className="border-b border-gray-300 pb-0.5">
                <div className={`flex justify-between items-start ${
                  group.assignmentType === 'pickup' ? 'text-red-600 print:text-red-600' : 'text-black print:text-black'
                }`}>
                  <div className="flex-1">
                    {/* Stop Number and Customer */}
                    <div className="flex items-center gap-2 mb-0">
                      <span className="font-semibold text-sm">{group.sequenceNumber}.</span>
                      <span className="font-bold text-sm">
                        {group.customerName}
                      </span>
                      {/* Other customers in parentheses with appropriate color */}
                      <span className={`font-medium text-xs ml-1 ${
                        group.assignmentType === 'pickup' 
                          ? 'text-black print:text-black' 
                          : 'text-red-600 print:text-red-600'
                      }`}>
                        {otherCustomersText}
                      </span>
                      {/* Warning message after customer list */}
                      {group.stops.length > 1 && (
                        <span className="ml-2 font-bold text-red-600 print:text-red-600 text-xs">
                          ⚠️ {group.stops.length} {group.assignmentType.toUpperCase()}S
                        </span>
                      )}
                    </div>
                    
                    {/* Address and Phone Numbers */}
                    <div className="text-xs ml-6 mb-0">
                      <span>{group.customerAddress}</span>
                      <span className="ml-2">
                        {group.phone1 && (
                          <span>{group.phone1}</span>
                        )}
                        {group.phone1 && group.phone2 && (
                          <span> | </span>
                        )}
                        {group.phone2 && (
                          <span>{group.phone2}</span>
                        )}
                        {!group.phone1 && !group.phone2 && (
                          <span>No phone</span>
                        )}
                      </span>
                    </div>
                  </div>

                  {/* Items Count and Dimensions */}
                  <div className="text-right ml-4">
                    <div className="font-semibold text-xs">
                      {(() => {
                        const counts = []
                        if (totalSkids > 0) {
                          const skidText = totalSkids === 1 ? '1 Skid' : `${totalSkids} Skids`
                          counts.push(skidText)
                        }
                        if (totalVinyl > 0) {
                          counts.push(`${totalVinyl} Vinyl`)
                        }
                        return counts.join(' | ')
                      })()}
                    </div>
                    <div className="text-xs text-gray-600 mt-0">
                      {(() => {
                        // Create dimension strings from combined data
                        const skidDimensions = Object.entries(combinedSkidsData).map(([dimensions, quantity]) => 
                          `${quantity} ${dimensions}`
                        )
                        const vinylDimensions = Object.entries(combinedVinylData).map(([dimensions, quantity]) => 
                          `${quantity} ${dimensions}`
                        )
                        
                        const allDimensions = [...skidDimensions, ...vinylDimensions]
                        return allDimensions.join(' | ')
                      })()}
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
