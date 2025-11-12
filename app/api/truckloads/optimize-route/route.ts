import { NextRequest, NextResponse } from 'next/server'

interface WaypointData {
  id: string // Changed to string to handle composite IDs like "22-pickup", "22-delivery"
  assignment_type: 'pickup' | 'delivery'
  address: string
  sequence_number: number
}

// Fallback optimization function using nearest neighbor algorithm
async function applyNearestNeighborOptimization(waypoints: WaypointData[]): Promise<WaypointData[] | null> {
  if (waypoints.length <= 2) {
    // No optimization needed for 2 or fewer waypoints
    return null
  }
  
  try {
    // For now, return null to avoid complexity
    // In a real implementation, you could use a geocoding service to get coordinates
    // and apply nearest neighbor algorithm
    console.log('🔄 Fallback optimization not yet implemented - returning original order')
    return null
  } catch (error) {
    console.error('❌ Fallback optimization error:', error)
    return null
  }
}

interface OptimizeRouteRequest {
  origin: string
  destination: string
  waypoints: WaypointData[]
}

export async function POST(request: NextRequest) {
  try {
    const body: OptimizeRouteRequest = await request.json()
    const { origin, destination, waypoints } = body

    if (!origin || !destination || !waypoints || waypoints.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Missing required parameters' },
        { status: 400 }
      )
    }

    // Get API key
    const googleMapsApiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
    
    if (!googleMapsApiKey) {
      return NextResponse.json(
        { success: false, error: 'Google Maps API key not configured' },
        { status: 500 }
      )
    }

    console.log('🚀 Using Routes API for optimization:', {
      origin,
      destination,
      waypointsCount: waypoints.length,
      firstWaypoint: waypoints[0]?.address
    })

    // Step 1: Get current route using Routes API
    console.log('📍 Step 1: Getting current route with Routes API...')
    console.log('📍 Waypoints for current route:', waypoints.map(wp => ({ id: wp.id, address: wp.address, type: wp.assignment_type })))
    
    const currentRouteResponse = await fetch(
      `https://routes.googleapis.com/directions/v2:computeRoutes?key=${googleMapsApiKey}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-Api-Key': googleMapsApiKey,
          'X-Goog-FieldMask': 'routes.duration,routes.distanceMeters,routes.legs.duration,routes.legs.distanceMeters'
        },
        body: JSON.stringify({
          origin: { address: origin },
          destination: { address: destination },
          intermediates: waypoints.map(wp => ({ address: wp.address })),
          travelMode: 'DRIVE',
          routingPreference: 'TRAFFIC_AWARE',
          computeAlternativeRoutes: false,
          routeModifiers: {
            avoidTolls: false,
            avoidHighways: false
          }
        })
      }
    )

    const currentRouteData = await currentRouteResponse.json()
    console.log('📡 Current route response:', {
      status: currentRouteResponse.status,
      data: currentRouteData
    })

    // Step 2: Get optimized route using Routes API with waypoint optimization
    console.log('🎯 Step 2: Getting optimized route with Routes API...')
    console.log('🎯 Waypoints for optimized route:', waypoints.map(wp => ({ id: wp.id, address: wp.address, type: wp.assignment_type })))
    
    const optimizedRouteResponse = await fetch(
      `https://routes.googleapis.com/directions/v2:computeRoutes?key=${googleMapsApiKey}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-Api-Key': googleMapsApiKey,
          'X-Goog-FieldMask': 'routes.duration,routes.distanceMeters,routes.legs.duration,routes.legs.distanceMeters,routes.optimizedIntermediateWaypointIndex'
        },
        body: JSON.stringify({
          origin: { address: origin },
          destination: { address: destination },
          intermediates: waypoints.map(wp => ({ address: wp.address })),
          travelMode: 'DRIVE',
          routingPreference: 'TRAFFIC_AWARE',
          computeAlternativeRoutes: false,
          routeModifiers: {
            avoidTolls: false,
            avoidHighways: false
          },
          optimizeWaypointOrder: true
        })
      }
    )

    const optimizedRouteData = await optimizedRouteResponse.json()
    console.log('📡 Optimized route response:', {
      status: optimizedRouteResponse.status,
      data: optimizedRouteData
    })

    // Process current route results with better duration handling
    const currentRouteInfo = currentRouteData.routes?.[0] ? {
      totalDistance: `${Math.round(currentRouteData.routes[0].distanceMeters / 1609.34 * 10) / 10} mi`,
      totalDuration: (() => {
        const duration = currentRouteData.routes[0].duration
        console.log('🔍 Current route duration field:', duration)
        if (duration && typeof duration === 'string') {
          // Duration might be in seconds as a string
          const seconds = parseInt(duration)
          return isNaN(seconds) ? 'Unknown' : `${Math.round(seconds / 60)} mins`
        } else if (duration && typeof duration === 'number') {
          // Duration might be in seconds as a number
          return `${Math.round(duration / 60)} mins`
        }
        return 'Unknown'
      })()
    } : { totalDistance: 'Unknown', totalDuration: 'Unknown' }

    // Process optimized route results with better duration handling
    const optimizedRouteInfo = optimizedRouteData.routes?.[0] ? {
      totalDistance: `${Math.round(optimizedRouteData.routes[0].distanceMeters / 1609.34 * 10) / 10} mi`,
      totalDuration: (() => {
        const duration = optimizedRouteData.routes[0].duration
        console.log('🔍 Optimized route duration field:', duration)
        if (duration && typeof duration === 'string') {
          // Duration might be in seconds as a string
          const seconds = parseInt(duration)
          return isNaN(seconds) ? 'Unknown' : `${Math.round(seconds / 60)} mins`
        } else if (duration && typeof duration === 'number') {
          // Duration might be in seconds as a number
          return `${Math.round(duration / 60)} mins`
        }
        return 'Unknown'
      })()
    } : { totalDistance: 'Unknown', totalDuration: 'Unknown' }

    // Create optimized order based on Routes API optimization
    let optimizedOrder = waypoints
    let optimizationApplied = false
    
    console.log('🔍 Checking for optimization results...')
    console.log('🔍 Optimized route data:', {
      hasRoutes: !!optimizedRouteData.routes,
      routeCount: optimizedRouteData.routes?.length || 0,
      firstRoute: optimizedRouteData.routes?.[0] || null,
      hasOptimizedIndices: !!optimizedRouteData.routes?.[0]?.optimizedIntermediateWaypointIndex
    })
    
    if (optimizedRouteData.routes?.[0]?.optimizedIntermediateWaypointIndex) {
      const optimizedIndices = optimizedRouteData.routes[0].optimizedIntermediateWaypointIndex
      console.log('🔍 Optimized waypoint indices:', optimizedIndices)
      console.log('🔍 Original waypoints:', waypoints.map(wp => ({ id: wp.id, address: wp.address, type: wp.assignment_type })))
      
      // Verify the optimization actually changed the order
      const originalOrder = waypoints.map((_, index) => index)
      const isOrderChanged = JSON.stringify(originalOrder) !== JSON.stringify(optimizedIndices)
      
      console.log('🔍 Order comparison:', {
        originalOrder,
        optimizedIndices,
        isOrderChanged,
        originalOrderString: JSON.stringify(originalOrder),
        optimizedIndicesString: JSON.stringify(optimizedIndices)
      })
      
      if (isOrderChanged) {
        // Create optimized order by mapping the optimized indices to original waypoints
        optimizedOrder = optimizedIndices.map((waypointIndex: number, sequenceIndex: number) => {
          const originalWaypoint = waypoints[waypointIndex]
          console.log(`🔍 Mapping index ${waypointIndex} to sequence ${sequenceIndex + 1}:`, {
            id: originalWaypoint.id,
            address: originalWaypoint.address,
            type: originalWaypoint.assignment_type
          })
          return {
            ...originalWaypoint,
            sequence_number: sequenceIndex + 1
          }
        })
        optimizationApplied = true
        
        console.log('🔍 Final optimized order:', optimizedOrder.map(o => ({ 
          id: o.id, 
          address: o.address, 
          type: o.assignment_type, 
          sequence: o.sequence_number 
        })))
      } else {
        console.log('⚠️ Optimization returned same order - no changes made')
        // If no optimization was applied, return the original order
        optimizedOrder = waypoints.map((wp, index) => ({
          ...wp,
          sequence_number: index + 1
        }))
      }
    } else {
      console.log('⚠️ No optimization indices found in API response')
      console.log('🔍 Full optimized route response for debugging:', JSON.stringify(optimizedRouteData, null, 2))
      
      // Fallback: Try to apply a simple nearest neighbor optimization
      console.log('🔄 Attempting fallback nearest neighbor optimization...')
      try {
        const fallbackOptimized = await applyNearestNeighborOptimization(waypoints)
        if (fallbackOptimized) {
          optimizedOrder = fallbackOptimized
          optimizationApplied = true
          console.log('✅ Fallback optimization applied successfully')
        } else {
          // If no optimization data, return the original order
          optimizedOrder = waypoints.map((wp, index) => ({
            ...wp,
            sequence_number: index + 1
          }))
        }
      } catch (error) {
        console.warn('⚠️ Fallback optimization failed:', error)
        // If no optimization data, return the original order
        optimizedOrder = waypoints.map((wp, index) => ({
          ...wp,
          sequence_number: index + 1
        }))
      }
    }

    console.log('✅ Routes API optimization successful:', {
      currentRoute: currentRouteInfo,
      optimizedRoute: optimizedRouteInfo,
      optimizationApplied,
      optimizedOrder: optimizedOrder.map((o: WaypointData) => ({ id: o.id, address: o.address, sequence: o.sequence_number }))
    })

    // Compare route metrics to verify optimization actually improved the route
    if (optimizationApplied && currentRouteInfo.totalDistance !== 'Unknown' && optimizedRouteInfo.totalDistance !== 'Unknown') {
      const currentDistance = parseFloat(currentRouteInfo.totalDistance.replace(' mi', ''))
      const optimizedDistance = parseFloat(optimizedRouteInfo.totalDistance.replace(' mi', ''))
      
      console.log('🔍 Route comparison:', {
        currentDistance: `${currentDistance} mi`,
        optimizedDistance: `${optimizedDistance} mi`,
        distanceDifference: `${(optimizedDistance - currentDistance).toFixed(1)} mi`,
        isOptimized: optimizedDistance < currentDistance
      })
      
      if (optimizedDistance >= currentDistance) {
        console.warn('⚠️ Optimization did not improve route distance!')
      }
    }

    return NextResponse.json({
      success: true,
      optimizedOrder,
      routeInfo: optimizedRouteInfo,
      currentRouteInfo,
      optimizationApplied,
      source: 'routes-api'
    })

  } catch (error) {
    console.error('❌ Routes API optimization error:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error occurred',
        suggestion: 'Check that Routes API is enabled'
      },
      { status: 500 }
    )
  }
}
