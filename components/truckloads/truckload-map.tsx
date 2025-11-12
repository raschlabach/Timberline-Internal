"use client"

import { useEffect, useState } from "react"
import { GoogleMap, useJsApiLoader, MarkerF, InfoWindow, DirectionsService, DirectionsRenderer } from "@react-google-maps/api"
import { useQueryClient } from "@tanstack/react-query"

interface TruckloadMapProps {
  truckloadId: number
}

interface TruckloadStop {
  id: number
  sequence_number: number
  assignment_type: 'pickup' | 'delivery'
  pickup_customer?: {
    id: number
    name: string
    address: string
    city: string
    state: string
    zip_code: string
  }
  delivery_customer?: {
    id: number
    name: string
    address: string
    city: string
    state: string
    zip_code: string
  }
  coordinates?: {
    lat: number
    lng: number
  }
}

interface RouteInfo {
  totalDistance: string
  totalDuration: string
}

const mapContainerStyle = {
  width: "100%",
  height: "100%",
  minHeight: "1000px"
}

const center = {
  lat: 40.475397346834676, // Exact coordinates for 1350 Co Rd 108, Sugarcreek, OH 44681
  lng: -81.67421790265688
}

const options = {
  disableDefaultUI: true,
  zoomControl: true,
  styles: [
    {
      featureType: "poi",
      elementType: "labels",
      stylers: [{ visibility: "off" }]
    }
  ]
}

const TIMBERLINE_ADDRESS = "1350 County Road 108, Sugarcreek, OH 44681"

export function TruckloadMap({ truckloadId }: TruckloadMapProps) {
  const { isLoaded, loadError } = useJsApiLoader({
    id: "google-map-script",
    googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || ""
  })

  const queryClient = useQueryClient()

  const [map, setMap] = useState<google.maps.Map | null>(null)
  const [stops, setStops] = useState<TruckloadStop[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedStop, setSelectedStop] = useState<TruckloadStop | null>(null)
  const [clickedStop, setClickedStop] = useState<TruckloadStop | null>(null)
  const [routeInfo, setRouteInfo] = useState<RouteInfo | null>(null)
  const [editingSequence, setEditingSequence] = useState<number | null>(null)
  const [optimizeRoute, setOptimizeRoute] = useState(false)
  const [optimizedRouteInfo, setOptimizedRouteInfo] = useState<RouteInfo | null>(null)
  const [currentRouteDirections, setCurrentRouteDirections] = useState<google.maps.DirectionsResult | null>(null)
  const [optimizedRouteDirections, setOptimizedRouteDirections] = useState<google.maps.DirectionsResult | null>(null)

  // Fetch stops for the truckload
  useEffect(() => {
    async function fetchStops() {
      try {
        setIsLoading(true)
        console.log('Fetching stops for truckload:', truckloadId)
        const response = await fetch(`/api/truckloads/${truckloadId}/orders`)
        if (!response.ok) throw new Error("Failed to fetch stops")
        const data = await response.json()
        if (!data.success) throw new Error(data.error || "Failed to fetch stops")
        
        console.log('Raw API response:', data)
        
        // Geocode addresses for each stop
        const geocoder = new google.maps.Geocoder()
        const stopsWithCoordinates = await Promise.all(
          data.orders.map(async (stop: TruckloadStop) => {
            const customer = stop.assignment_type === 'pickup' 
              ? stop.pickup_customer 
              : stop.delivery_customer
            
            if (!customer) {
              console.warn('No customer found for stop:', stop)
              return stop
            }

            // Log the raw customer data
            console.log('Customer data:', {
              name: customer.name,
              address: customer.address,
              city: customer.city,
              state: customer.state,
              zip_code: customer.zip_code
            })

            // Construct full address
            const fullAddress = [
              customer.address,
              customer.city,
              customer.state,
              customer.zip_code
            ].filter(Boolean).join(', ')

            if (!fullAddress) {
              console.warn('No address found for customer:', customer)
              return stop
            }

            try {
              console.log('Attempting to geocode address:', fullAddress)
              const result = await new Promise<google.maps.GeocoderResult>((resolve, reject) => {
                geocoder.geocode({ address: fullAddress }, (results, status) => {
                  console.log('Geocoding response:', {
                    status,
                    results: results?.[0] ? {
                      formatted_address: results[0].formatted_address,
                      location: results[0].geometry.location.toJSON()
                    } : null
                  })
                  
                  if (status === 'OK' && results?.[0]) {
                    resolve(results[0])
                  } else {
                    reject(new Error(`Geocoding failed: ${status}`))
                  }
                })
              })

              const coordinates = {
                lat: result.geometry.location.lat(),
                lng: result.geometry.location.lng()
              }
              
              console.log('Geocoding successful:', {
                original_address: fullAddress,
                formatted_address: result.formatted_address,
                coordinates
              })

              return {
                ...stop,
                coordinates
              }
            } catch (error) {
              console.error(`Error geocoding address: ${fullAddress}`, error)
              return stop
            }
          })
        )

        console.log('Final stops with coordinates:', stopsWithCoordinates)
        console.log('📍 Setting stops state with', stopsWithCoordinates.length, 'stops')
        console.log('📍 Sample stop data:', stopsWithCoordinates[0])
        setStops(stopsWithCoordinates)
      } catch (err) {
        setError(err instanceof Error ? err.message : "An error occurred")
        console.error("Error fetching stops:", err)
      } finally {
        setIsLoading(false)
      }
    }

    if (truckloadId && isLoaded) {
      fetchStops()
    }
  }, [truckloadId, isLoaded])

  // Calculate both current and optimized routes when stops change
  useEffect(() => {
    console.log('🔍 Route calculation effect triggered:', { 
      map: !!map, 
      stopsCount: stops.length,
      mapLoaded: isLoaded,
      hasGoogleMaps: typeof google !== 'undefined' && google.maps
    })
    
    if (!map || stops.length === 0) {
      console.log('❌ Skipping route calculation - no map or stops')
      return
    }

    if (typeof google === 'undefined' || !google.maps) {
      console.log('❌ Google Maps not available')
      return
    }

    // Simple test route first
    console.log('🧪 Testing simple route calculation...')
    
    const directionsService = new google.maps.DirectionsService()
    
    // Test with just one stop first
    if (stops.length === 1) {
      const stop = stops[0]
      const customer = stop.assignment_type === 'pickup' 
        ? stop.pickup_customer 
        : stop.delivery_customer
      
      if (customer) {
        const testAddress = [
          customer.address,
          customer.city,
          customer.state,
          customer.zip_code
        ].filter(Boolean).join(', ')
        
        console.log('🧪 Testing single stop route to:', testAddress)
        
        const testRequest: google.maps.DirectionsRequest = {
          origin: TIMBERLINE_ADDRESS,
          destination: testAddress,
          travelMode: google.maps.TravelMode.DRIVING
        }
        
        directionsService.route(testRequest, (result, status) => {
          console.log('🧪 Test route result:', { status, hasResult: !!result })
          if (status === google.maps.DirectionsStatus.OK && result) {
            console.log('✅ Test route successful!')
            setCurrentRouteDirections(result)
          }
        })
      }
      return
    }
    
    // Sort stops by sequence number for current route
    const sortedStops = [...stops].sort((a, b) => a.sequence_number - b.sequence_number)
    
    // Create waypoints from all stops using addresses
    const waypoints: google.maps.DirectionsWaypoint[] = []
    
    for (const stop of sortedStops) {
      const customer = stop.assignment_type === 'pickup' 
        ? stop.pickup_customer 
        : stop.delivery_customer
      
      if (!customer) {
        console.warn('⚠️ No customer data for stop:', stop)
        continue
      }
      
      // Construct full address
      const fullAddress = [
        customer.address,
        customer.city,
        customer.state,
        customer.zip_code
      ].filter(Boolean).join(', ')
      
      if (!fullAddress) {
        console.warn('⚠️ No address found for customer:', customer)
        continue
      }
      
      console.log('📍 Creating waypoint for:', fullAddress)
      waypoints.push({
        location: fullAddress,
        stopover: true
      })
    }
    
    console.log('🗺️ Waypoints created:', waypoints.length)
    console.log('🗺️ First waypoint:', waypoints[0])
    console.log('🗺️ Warehouse address:', TIMBERLINE_ADDRESS)
    
    if (waypoints.length === 0) {
      console.log('❌ No valid waypoints created, skipping route calculation')
      return
    }

    // Calculate current route (manual sequence)
    const currentRequest: google.maps.DirectionsRequest = {
      origin: TIMBERLINE_ADDRESS, // Timberline Warehouse
      destination: TIMBERLINE_ADDRESS, // Timberline Warehouse
      waypoints: waypoints,
      optimizeWaypoints: false, // Keep manual sequence
      travelMode: google.maps.TravelMode.DRIVING
    }

    // Calculate optimized route
    const optimizedRequest: google.maps.DirectionsRequest = {
      origin: TIMBERLINE_ADDRESS, // Timberline Warehouse
      destination: TIMBERLINE_ADDRESS, // Timberline Warehouse
      waypoints: waypoints,
      optimizeWaypoints: true, // Optimize for efficiency
      travelMode: google.maps.TravelMode.DRIVING
    }

    console.log('🚗 Current route request:', currentRequest)
    console.log('🚗 Optimized route request:', optimizedRequest)

    // Get current route
    console.log('🔄 Requesting current route...')
    directionsService.route(currentRequest, (result, status) => {
      console.log('📡 Current route response:', { status, hasResult: !!result })
      
      if (status === google.maps.DirectionsStatus.OK && result) {
        console.log('✅ Current route calculated successfully:', result)
        console.log('✅ Route has', result.routes.length, 'routes')
        console.log('✅ First route has', result.routes[0]?.legs?.length, 'legs')
        
        setCurrentRouteDirections(result)
        console.log('✅ Current route directions state updated')
        
        // Calculate total distance and duration for current route
        let totalDistance = 0
        let totalDuration = 0
        
        result.routes[0].legs.forEach(leg => {
          if (leg.distance) totalDistance += leg.distance.value
          if (leg.duration) totalDuration += leg.duration.value
        })

        const routeInfo = {
          totalDistance: `${(totalDistance / 1609.34).toFixed(1)} miles`,
          totalDuration: `${Math.round(totalDuration / 60)} minutes`
        }
        
        console.log('📏 Current route metrics:', routeInfo)
        setRouteInfo(routeInfo)
      } else {
        console.error('❌ Current route request failed:', status)
        console.error('❌ Status details:', google.maps.DirectionsStatus[status])
      }
    })

    // Get optimized route
    console.log('🔄 Requesting optimized route...')
    directionsService.route(optimizedRequest, (result, status) => {
      console.log('📡 Optimized route response:', { status, hasResult: !!result })
      
      if (status === google.maps.DirectionsStatus.OK && result) {
        console.log('✅ Optimized route calculated successfully:', result)
        console.log('✅ Route has', result.routes.length, 'routes')
        console.log('✅ First route has', result.routes[0]?.legs?.length, 'legs')
        
        setOptimizedRouteDirections(result)
        console.log('✅ Optimized route directions state updated')
        
        // Calculate total distance and duration for optimized route
        let totalDistance = 0
        let totalDuration = 0
        
        result.routes[0].legs.forEach(leg => {
          if (leg.distance) totalDistance += leg.distance.value
          if (leg.duration) totalDuration += leg.duration.value
        })

        const optimizedRouteInfo = {
          totalDistance: `${(totalDistance / 1609.34).toFixed(1)} miles`,
          totalDuration: `${Math.round(totalDuration / 60)} minutes`
        }
        
        console.log('📏 Optimized route metrics:', optimizedRouteInfo)
        setOptimizedRouteInfo(optimizedRouteInfo)
      } else {
        console.error('❌ Optimized route request failed:', status)
        console.error('❌ Status details:', google.maps.DirectionsStatus[status])
      }
    })
  }, [map, stops])

  // Handle sequence number update
  const handleSequenceUpdate = async (stopId: number, newSequence: number) => {
    try {
      // Create a new array with the updated sequence
      const newStops = [...stops]
      const oldIndex = newStops.findIndex(s => s.id === stopId)
      const newIndex = newStops.findIndex(s => s.sequence_number === newSequence)
      
      // Move the stop to its new position
      const [movedStop] = newStops.splice(oldIndex, 1)
      newStops.splice(newIndex, 0, movedStop)

      // Update sequence numbers for all stops
      const updatedStops = newStops.map((stop, index) => ({
        ...stop,
        sequence_number: index + 1
      }))

      const response = await fetch(`/api/truckloads/${truckloadId}/reorder`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          orders: updatedStops.map(stop => ({
            id: stop.id,
            assignment_type: stop.assignment_type,
            sequence_number: stop.sequence_number
          }))
        }),
      })

      if (!response.ok) throw new Error('Failed to update sequence')
      const data = await response.json()
      if (!data.success) throw new Error(data.error || 'Failed to update sequence')

      // Update local state
      setStops(updatedStops)
      setEditingSequence(null)
      
      // Invalidate the stops query to refresh the sidebar
      queryClient.invalidateQueries({ queryKey: ["truckload-stops", truckloadId] })
    } catch (error) {
      console.error('Failed to update sequence:', error)
    }
  }

  const onLoad = (map: google.maps.Map) => {
    console.log('🗺️ Map loaded successfully:', map)
    setMap(map)
  }

  const onUnmount = () => {
    setMap(null)
  }

  if (loadError) {
    return (
      <div className="h-full w-full flex items-center justify-center bg-red-50">
        <div className="text-red-500">Error loading map: {loadError.message}</div>
      </div>
    )
  }

  if (!isLoaded) {
    return (
      <div className="h-full w-full flex items-center justify-center bg-gray-50">
        <div className="text-gray-500">Loading map...</div>
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="h-full w-full flex items-center justify-center bg-gray-50">
        <div className="text-gray-500">Loading stops...</div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="h-full w-full flex items-center justify-center bg-red-50">
        <div className="text-red-500">Error: {error}</div>
      </div>
    )
  }

    // Debug: Log current state values
  console.log('🔍 Render state:', {
    hasMap: !!map,
    stopsCount: stops.length,
    hasCurrentRoute: !!currentRouteDirections,
    hasOptimizedRoute: !!optimizedRouteDirections,
    hasRouteInfo: !!routeInfo,
    hasOptimizedRouteInfo: !!optimizedRouteInfo
  })

  return (
    <div className="h-full w-full bg-gray-100 relative">
      {/* Debug Info */}
      <div className="absolute top-4 left-4 z-10 bg-white/90 backdrop-blur-sm p-4 rounded-lg shadow-lg border border-gray-200 text-xs">
        <div className="space-y-1">
          <p><strong>Map Loaded:</strong> {isLoaded ? 'Yes' : 'No'}</p>
          <p><strong>Google Maps:</strong> {typeof google !== 'undefined' && google.maps ? 'Yes' : 'No'}</p>
          <p><strong>Stops Count:</strong> {stops.length}</p>
          <p><strong>Current Route:</strong> {currentRouteDirections ? 'Yes' : 'No'}</p>
          <p><strong>Optimized Route:</strong> {optimizedRouteDirections ? 'Yes' : 'No'}</p>
          <p><strong>Route Info:</strong> {routeInfo ? 'Yes' : 'No'}</p>
        </div>
      </div>
      
      <GoogleMap
        mapContainerStyle={mapContainerStyle}
        center={center}
        zoom={7}
        onLoad={onLoad}
        onUnmount={onUnmount}
        options={options}
      >
        {/* Timberline Warehouse Marker */}
        <MarkerF
          position={center}
          icon={{
            url: '/warehouse-icon.png',
            scaledSize: new window.google.maps.Size(32, 32)
          }}
          title="Timberline Warehouse"
          onClick={() => setSelectedStop(null)}
        />

        {/* Stop Markers */}
        {stops.map((stop) => {
          if (!stop.coordinates) {
            console.warn('No coordinates for stop:', stop)
            return null
          }

          const customer = stop.assignment_type === 'pickup' 
            ? stop.pickup_customer 
            : stop.delivery_customer

          return (
            <MarkerF
              key={stop.id}
              position={stop.coordinates}
              icon={{
                path: window.google.maps.SymbolPath.CIRCLE,
                fillColor: stop.assignment_type === 'pickup' ? '#FF0000' : '#000000',
                fillOpacity: 1,
                strokeWeight: 1,
                strokeColor: '#FFFFFF',
                scale: 8,
              }}
              title={`${stop.assignment_type === 'pickup' ? 'Pickup' : 'Delivery'} - ${customer?.name}`}
              onMouseOver={() => {
                if (!clickedStop || clickedStop.id !== stop.id) {
                  setSelectedStop(stop)
                }
              }}
              onMouseOut={() => {
                if (!clickedStop || clickedStop.id !== stop.id) {
                  setSelectedStop(null)
                }
              }}
              onClick={() => {
                if (clickedStop && clickedStop.id === stop.id) {
                  setClickedStop(null)
                  setSelectedStop(null)
                } else {
                  setClickedStop(stop)
                  setSelectedStop(stop)
                }
              }}
            />
          )
        })}

        {/* Info Window */}
        {selectedStop && selectedStop.coordinates && (
          <InfoWindow
            position={selectedStop.coordinates}
            onCloseClick={() => {
              setSelectedStop(null)
              setClickedStop(null)
              setEditingSequence(null)
            }}
          >
            <div className="p-2 min-w-[200px]">
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-semibold text-lg">
                  {selectedStop.assignment_type === 'pickup' ? 'Pickup' : 'Delivery'} #{selectedStop.sequence_number}
                </h3>
                <div className="flex items-center gap-1">
                  <input
                    type="number"
                    value={editingSequence !== null ? editingSequence : selectedStop.sequence_number}
                    onChange={(e) => {
                      const value = parseInt(e.target.value)
                      setEditingSequence(value)
                    }}
                    className="w-12 h-6 text-sm border border-gray-300 rounded px-1 text-center"
                    min={1}
                    max={stops.length}
                  />
                  {editingSequence !== null && editingSequence !== selectedStop.sequence_number && (
                    <button
                      onClick={() => handleSequenceUpdate(selectedStop.id, editingSequence)}
                      className="px-2 py-1 text-xs bg-blue-500 text-white rounded hover:bg-blue-600"
                    >
                      ✓
                    </button>
                  )}
                </div>
              </div>
              <p className="text-sm font-medium mb-1">
                {selectedStop.assignment_type === 'pickup' 
                  ? selectedStop.pickup_customer?.name 
                  : selectedStop.delivery_customer?.name}
              </p>
              <p className="text-sm text-gray-600">
                {selectedStop.assignment_type === 'pickup' 
                  ? [
                      selectedStop.pickup_customer?.address,
                      selectedStop.pickup_customer?.city,
                      selectedStop.pickup_customer?.state,
                      selectedStop.pickup_customer?.zip_code
                    ].filter(Boolean).join(', ')
                  : [
                      selectedStop.delivery_customer?.address,
                      selectedStop.delivery_customer?.city,
                      selectedStop.delivery_customer?.state,
                      selectedStop.delivery_customer?.zip_code
                    ].filter(Boolean).join(', ')}
              </p>
            </div>
          </InfoWindow>
        )}

        {/* Test Route - Always visible for debugging */}
        <DirectionsRenderer
          directions={{
            routes: [{
              legs: [{
                distance: { text: '1.2 mi', value: 1931 },
                duration: { text: '3 min', value: 180 },
                start_address: TIMBERLINE_ADDRESS,
                end_address: TIMBERLINE_ADDRESS,
                start_location: new google.maps.LatLng(center.lat, center.lng),
                end_location: new google.maps.LatLng(center.lat, center.lng)
              }],
              overview_path: [
                new google.maps.LatLng(center.lat, center.lng),
                new google.maps.LatLng(center.lat + 0.01, center.lng + 0.01)
              ]
            }]
          } as any}
          options={{
            suppressMarkers: true,
            polylineOptions: {
              strokeColor: '#FF0000', // Red for test route
              strokeWeight: 10,
              strokeOpacity: 1,
              zIndex: 1000
            }
          }}
        />

        {/* Current Route (Driver Color) */}
        {currentRouteDirections ? (
          <DirectionsRenderer
            directions={currentRouteDirections}
            options={{
              suppressMarkers: true,
              polylineOptions: {
                strokeColor: '#3B82F6', // Blue for current route
                strokeWeight: 6,
                strokeOpacity: 0.8,
                zIndex: 1
              },
              markerOptions: {
                opacity: 0
              }
            }}
          />
        ) : null}

        {/* Optimized Route (Gold) */}
        {optimizedRouteDirections ? (
          <DirectionsRenderer
            directions={optimizedRouteDirections}
            options={{
              suppressMarkers: true,
              polylineOptions: {
                strokeColor: '#FFEB3B', // Gold for optimized route
                strokeWeight: 8,
                strokeOpacity: 0.9,
                zIndex: 2
              },
              markerOptions: {
                opacity: 0
              }
            }}
          />
        ) : null}
      </GoogleMap>
      
      {/* Route Metrics Below Map */}
      {(routeInfo || optimizedRouteInfo) && (
        <div className="absolute bottom-0 left-0 right-0 bg-white/95 backdrop-blur-sm p-4 border-t border-gray-200">
          <div className="grid grid-cols-2 gap-6">
            {/* Current Route Metrics */}
            {routeInfo && (
              <div className="space-y-2">
                <h3 className="font-semibold text-gray-800 text-sm">Current Route</h3>
                <div className="space-y-1 text-xs text-gray-600">
                  <p>Distance: <span className="font-medium text-gray-800">{routeInfo.totalDistance}</span></p>
                  <p>Duration: <span className="font-medium text-gray-800">{routeInfo.totalDuration}</span></p>
                </div>
              </div>
            )}
            
            {/* Optimized Route Metrics */}
            {optimizedRouteInfo && (
              <div className="space-y-2">
                <h3 className="font-semibold text-gray-800 text-sm">Optimized Route</h3>
                <div className="space-y-1 text-xs text-gray-600">
                  <p>Distance: <span className="font-medium text-gray-800">{optimizedRouteInfo.totalDistance}</span></p>
                  <p>Duration: <span className="font-medium text-gray-800">{optimizedRouteInfo.totalDuration}</span></p>
                </div>
              </div>
            )}
          </div>
          
          {/* Route Legend */}
          <div className="mt-4 pt-3 border-t border-gray-200">
            <div className="flex items-center justify-center gap-6 text-xs text-gray-600">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                <span>Current Route (Manual Order)</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-yellow-400 rounded-full"></div>
                <span>Optimized Route</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
} 