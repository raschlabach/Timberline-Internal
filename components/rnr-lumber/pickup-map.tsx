'use client'

import { useMemo, useState, useCallback } from 'react'
import { GoogleMap, useJsApiLoader, MarkerF, InfoWindowF } from '@react-google-maps/api'
import { Badge } from '@/components/ui/badge'
import { format } from 'date-fns'

interface LumberLoadItem {
  id: number
  species: string
  grade: string
  thickness: string
  estimated_footage: number | null
  actual_footage: number | null
}

interface LumberPickupLoad {
  id: number
  load_id: string
  supplier_id: number
  supplier_name: string
  pickup_number: string | null
  comments: string | null
  created_at: string
  timberline_order_id: number | null
  matched_customer_id: number | null
  matched_customer_name: string | null
  customer_lat: number | null
  customer_lng: number | null
  supplier_address: string | null
  supplier_city: string | null
  supplier_state: string | null
  items: LumberLoadItem[]
  total_estimated_footage: number
  total_actual_footage: number
  is_past: boolean
  is_ready: boolean
  customer_matched: boolean
}

interface RnrLumberPickupMapProps {
  loads: LumberPickupLoad[]
  showPast: boolean
}

const mapContainerStyle = {
  width: '100%',
  height: '100%',
}

const center = {
  lat: 40.5008,
  lng: -81.6346,
}

const options: google.maps.MapOptions = {
  disableDefaultUI: false,
  zoomControl: true,
  mapTypeControl: false,
  streetViewControl: false,
  fullscreenControl: true,
}

interface MapPin {
  id: string
  lat: number
  lng: number
  loads: LumberPickupLoad[]
  supplierName: string
}

function getPinColor(loads: LumberPickupLoad[]): string {
  const hasReady = loads.some(l => l.is_ready && !l.is_past)
  const hasPast = loads.every(l => l.is_past)
  const hasUnmatched = loads.some(l => !l.customer_matched)

  if (hasPast) return '#22C55E'
  if (hasReady) return '#F59E0B'
  if (hasUnmatched) return '#EF4444'
  return '#3B82F6'
}

function getPinBorderColor(loads: LumberPickupLoad[]): string {
  const hasReady = loads.some(l => l.is_ready && !l.is_past)
  const hasPast = loads.every(l => l.is_past)

  if (hasPast) return '#16A34A'
  if (hasReady) return '#D97706'
  return '#FFFFFF'
}

export function RnrLumberPickupMap({ loads, showPast }: RnrLumberPickupMapProps) {
  const [selectedPin, setSelectedPin] = useState<MapPin | null>(null)

  const { isLoaded } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || '',
  })

  const pins = useMemo(() => {
    const filteredLoads = showPast ? loads : loads.filter(l => !l.is_past)

    const locationGroups: Record<string, LumberPickupLoad[]> = {}

    for (const load of filteredLoads) {
      if (load.customer_lat && load.customer_lng) {
        const key = `${Math.round(load.customer_lat * 10000)},${Math.round(load.customer_lng * 10000)}`
        if (!locationGroups[key]) {
          locationGroups[key] = []
        }
        locationGroups[key].push(load)
      }
    }

    return Object.entries(locationGroups).map(([key, groupLoads]): MapPin => {
      const avgLat = groupLoads.reduce((sum, l) => sum + Number(l.customer_lat), 0) / groupLoads.length
      const avgLng = groupLoads.reduce((sum, l) => sum + Number(l.customer_lng), 0) / groupLoads.length

      return {
        id: key,
        lat: avgLat,
        lng: avgLng,
        loads: groupLoads,
        supplierName: groupLoads[0].supplier_name,
      }
    })
  }, [loads, showPast])

  const onMapLoad = useCallback((map: google.maps.Map) => {
    if (pins.length > 0) {
      const bounds = new google.maps.LatLngBounds()
      bounds.extend(center)
      for (const pin of pins) {
        bounds.extend({ lat: pin.lat, lng: pin.lng })
      }
      map.fitBounds(bounds, 60)
    }
  }, [pins])

  if (!isLoaded) {
    return (
      <div className="flex items-center justify-center h-full bg-gray-50 rounded-lg">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-gray-400" />
      </div>
    )
  }

  const loadsWithCoords = (showPast ? loads : loads.filter(l => !l.is_past)).filter(
    l => l.customer_lat && l.customer_lng
  ).length
  const loadsWithoutCoords = (showPast ? loads : loads.filter(l => !l.is_past)).filter(
    l => !l.customer_lat || !l.customer_lng
  ).length

  return (
    <div className="relative h-full">
      <GoogleMap
        mapContainerStyle={mapContainerStyle}
        center={center}
        zoom={7}
        onLoad={onMapLoad}
        options={options}
      >
        {/* Timberline Warehouse */}
        <MarkerF
          position={center}
          icon={{
            url: '/warehouse-icon.png',
            scaledSize: new window.google.maps.Size(28, 28),
          }}
          title="Timberline Warehouse"
        />

        {pins.map(pin => {
          const color = getPinColor(pin.loads)
          const borderColor = getPinBorderColor(pin.loads)
          const loadCount = pin.loads.length
          const hasReady = pin.loads.some(l => l.is_ready && !l.is_past)

          return (
            <MarkerF
              key={pin.id}
              position={{ lat: pin.lat, lng: pin.lng }}
              icon={{
                path: window.google.maps.SymbolPath.CIRCLE,
                fillColor: color,
                fillOpacity: 1,
                strokeWeight: hasReady ? 3 : 2,
                strokeColor: borderColor,
                scale: loadCount > 1 ? 10 : 8,
              }}
              label={
                loadCount > 1
                  ? {
                      text: String(loadCount),
                      color: '#FFFFFF',
                      fontSize: '10px',
                      fontWeight: 'bold',
                    }
                  : undefined
              }
              title={`${pin.supplierName} - ${loadCount} load${loadCount !== 1 ? 's' : ''}`}
              onClick={() => setSelectedPin(pin)}
            />
          )
        })}

        {selectedPin && (
          <InfoWindowF
            position={{ lat: selectedPin.lat, lng: selectedPin.lng }}
            onCloseClick={() => setSelectedPin(null)}
            options={{ maxWidth: 320 }}
          >
            <div className="p-1 text-sm space-y-2">
              <div className="font-semibold text-gray-900">
                {selectedPin.supplierName}
              </div>
              {selectedPin.loads[0].supplier_city && (
                <div className="text-xs text-gray-500">
                  {[selectedPin.loads[0].supplier_address, selectedPin.loads[0].supplier_city, selectedPin.loads[0].supplier_state]
                    .filter(Boolean)
                    .join(', ')}
                </div>
              )}
              <div className="space-y-1.5 max-h-[200px] overflow-y-auto">
                {selectedPin.loads.map(load => (
                  <div
                    key={load.id}
                    className={`rounded p-2 border text-xs ${
                      load.is_past
                        ? 'bg-green-50 border-green-200'
                        : load.is_ready
                          ? 'bg-amber-50 border-amber-200'
                          : 'bg-gray-50 border-gray-200'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-mono font-semibold">{load.load_id}</span>
                      {load.is_ready && !load.is_past && (
                        <Badge className="bg-amber-500 text-white text-[9px] px-1 py-0 h-4">
                          PU# {load.pickup_number}
                        </Badge>
                      )}
                      {load.is_past && (
                        <Badge className="bg-green-500 text-white text-[9px] px-1 py-0 h-4">
                          Done
                        </Badge>
                      )}
                    </div>
                    <div className="text-gray-500 mt-0.5">
                      {Number(load.total_estimated_footage) > 0
                        ? `${Number(load.total_estimated_footage).toLocaleString()} ft est.`
                        : 'No footage'}
                      {' · '}
                      {format(new Date(load.created_at), 'M/d/yy')}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </InfoWindowF>
        )}
      </GoogleMap>

      {/* Legend */}
      <div className="absolute bottom-3 left-3 bg-white/95 rounded-lg shadow-md border px-3 py-2 text-xs space-y-1">
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-full bg-amber-500 border-2 border-amber-600 inline-block" />
          <span>Ready for pickup (has PU#)</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-full bg-blue-500 border-2 border-white inline-block" />
          <span>Pending</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-full bg-red-500 border-2 border-white inline-block" />
          <span>Unmatched customer</span>
        </div>
        {showPast && (
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-green-500 border-2 border-green-600 inline-block" />
            <span>Past / completed</span>
          </div>
        )}
      </div>

      {loadsWithoutCoords > 0 && (
        <div className="absolute top-3 left-3 bg-amber-50/95 border border-amber-200 rounded-lg shadow-sm px-3 py-1.5 text-xs text-amber-700">
          {loadsWithoutCoords} load{loadsWithoutCoords !== 1 ? 's' : ''} not shown (unmatched customer)
        </div>
      )}
    </div>
  )
}
