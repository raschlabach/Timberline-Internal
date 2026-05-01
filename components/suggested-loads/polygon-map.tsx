'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { GoogleMap, useJsApiLoader } from '@react-google-maps/api'
import { Button } from '@/components/ui/button'
import { Pentagon, Trash2, MousePointer } from 'lucide-react'

const LIBRARIES: ('drawing')[] = ['drawing']

const MAP_CENTER = { lat: 40.51, lng: -81.63 }
const MAP_ZOOM = 7

const containerStyle = {
  width: '100%',
  height: '100%',
}

interface PolygonData {
  id: number
  name: string
  coordinates: Array<{ lat: number; lng: number }>
  color: string
  matchOn: 'pickup' | 'delivery'
  maxFootage: number | null
  maxStops: number | null
  onlyUnassignedType: string | null
  loadTypeFilter: Record<string, boolean> | null
  isActive: boolean
}

interface OrderDot {
  id: number
  lat: number
  lng: number
  type: 'pickup' | 'delivery'
  customerName: string
  matchedPolygonId: number | null
}

interface PolygonMapProps {
  polygons: PolygonData[]
  orders: OrderDot[]
  selectedPolygonId: number | null
  onPolygonCreated: (coordinates: Array<{ lat: number; lng: number }>) => void
  onPolygonUpdated: (polygonId: number, coordinates: Array<{ lat: number; lng: number }>) => void
  onPolygonSelected: (polygonId: number | null) => void
  onPolygonDeleted: (polygonId: number) => void
}

function extractPath(poly: google.maps.Polygon): Array<{ lat: number; lng: number }> {
  const path = poly.getPath()
  const coords: Array<{ lat: number; lng: number }> = []
  for (let i = 0; i < path.getLength(); i++) {
    const point = path.getAt(i)
    coords.push({ lat: point.lat(), lng: point.lng() })
  }
  return coords
}

export function PolygonMap({
  polygons,
  orders,
  selectedPolygonId,
  onPolygonCreated,
  onPolygonUpdated,
  onPolygonSelected,
  onPolygonDeleted,
}: PolygonMapProps) {
  const { isLoaded } = useJsApiLoader({
    googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || '',
    libraries: LIBRARIES,
  })

  const mapRef = useRef<google.maps.Map | null>(null)
  const polygonRefs = useRef<Map<number, google.maps.Polygon>>(new Map())
  const markerRefs = useRef<google.maps.Circle[]>([])
  const drawingManagerRef = useRef<google.maps.drawing.DrawingManager | null>(null)
  const [isDrawing, setIsDrawing] = useState(false)

  const onMapLoad = useCallback((map: google.maps.Map) => {
    mapRef.current = map
  }, [])

  // Manage polygon overlays
  useEffect(() => {
    if (!mapRef.current || !isLoaded) return

    const map = mapRef.current
    const existing = polygonRefs.current

    const currentIds = new Set(polygons.map((p) => p.id))
    existing.forEach((poly, id) => {
      if (!currentIds.has(id)) {
        poly.setMap(null)
        existing.delete(id)
      }
    })

    for (const p of polygons) {
      const isSelected = p.id === selectedPolygonId
      const path = p.coordinates.map((c) => ({ lat: c.lat, lng: c.lng }))

      if (existing.has(p.id)) {
        const poly = existing.get(p.id)!
        poly.setOptions({
          fillColor: p.color,
          fillOpacity: isSelected ? 0.35 : 0.2,
          strokeColor: p.color,
          strokeOpacity: 1,
          strokeWeight: isSelected ? 3 : 2,
          editable: isSelected,
          draggable: false,
        })
        const currentPath = poly.getPath()
        if (currentPath.getLength() !== path.length) {
          poly.setPath(path)
        }
      } else {
        const poly = new google.maps.Polygon({
          paths: path,
          fillColor: p.color,
          fillOpacity: isSelected ? 0.35 : 0.2,
          strokeColor: p.color,
          strokeOpacity: 1,
          strokeWeight: isSelected ? 3 : 2,
          editable: isSelected,
          draggable: false,
          map,
        })

        poly.addListener('click', () => {
          onPolygonSelected(p.id)
        })

        if (isSelected) {
          const path = poly.getPath()
          google.maps.event.addListener(path, 'set_at', () => {
            onPolygonUpdated(p.id, extractPath(poly))
          })
          google.maps.event.addListener(path, 'insert_at', () => {
            onPolygonUpdated(p.id, extractPath(poly))
          })
        }

        existing.set(p.id, poly)
      }
    }

    // Add polygon name labels
    for (const p of polygons) {
      const poly = existing.get(p.id)
      if (!poly) continue
    }
  }, [polygons, selectedPolygonId, isLoaded, onPolygonSelected, onPolygonUpdated])

  // Manage order dot markers
  useEffect(() => {
    if (!mapRef.current || !isLoaded) return

    markerRefs.current.forEach((m) => m.setMap(null))
    markerRefs.current = []

    const map = mapRef.current
    for (const order of orders) {
      const circle = new google.maps.Circle({
        center: { lat: order.lat, lng: order.lng },
        radius: 2500,
        fillColor: order.type === 'pickup' ? '#EF4444' : '#1F2937',
        fillOpacity: 0.7,
        strokeColor: order.type === 'pickup' ? '#EF4444' : '#1F2937',
        strokeWeight: 1,
        map,
        clickable: false,
      })
      markerRefs.current.push(circle)
    }
  }, [orders, isLoaded])

  // Manage drawing manager
  useEffect(() => {
    if (!mapRef.current || !isLoaded) return

    if (isDrawing && !drawingManagerRef.current) {
      const dm = new google.maps.drawing.DrawingManager({
        drawingMode: google.maps.drawing.OverlayType.POLYGON,
        drawingControl: false,
        polygonOptions: {
          fillColor: '#3B82F6',
          fillOpacity: 0.3,
          strokeColor: '#3B82F6',
          strokeWeight: 2,
          editable: false,
        },
      })

      dm.setMap(mapRef.current)

      google.maps.event.addListener(dm, 'polygoncomplete', (polygon: google.maps.Polygon) => {
        const coords = extractPath(polygon)
        polygon.setMap(null)
        dm.setMap(null)
        drawingManagerRef.current = null
        setIsDrawing(false)
        onPolygonCreated(coords)
      })

      drawingManagerRef.current = dm
    } else if (!isDrawing && drawingManagerRef.current) {
      drawingManagerRef.current.setMap(null)
      drawingManagerRef.current = null
    }

    return () => {
      if (drawingManagerRef.current) {
        drawingManagerRef.current.setMap(null)
        drawingManagerRef.current = null
      }
    }
  }, [isDrawing, isLoaded, onPolygonCreated])

  // Click on map (deselect polygon)
  useEffect(() => {
    if (!mapRef.current || !isLoaded) return

    const listener = mapRef.current.addListener('click', () => {
      if (!isDrawing) {
        onPolygonSelected(null)
      }
    })

    return () => {
      google.maps.event.removeListener(listener)
    }
  }, [isDrawing, isLoaded, onPolygonSelected])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      polygonRefs.current.forEach((poly) => poly.setMap(null))
      polygonRefs.current.clear()
      markerRefs.current.forEach((m) => m.setMap(null))
      markerRefs.current = []
    }
  }, [])

  if (!isLoaded) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-muted">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900" />
      </div>
    )
  }

  return (
    <div className="relative w-full h-full">
      <div className="absolute top-4 left-4 z-10 flex items-center gap-2">
        <Button
          size="sm"
          variant={isDrawing ? 'default' : 'outline'}
          onClick={() => {
            setIsDrawing(!isDrawing)
            if (!isDrawing) onPolygonSelected(null)
          }}
          className="shadow-md bg-white hover:bg-gray-50 text-gray-800"
          style={isDrawing ? { backgroundColor: '#1F2937', color: 'white' } : {}}
        >
          {isDrawing ? (
            <>
              <MousePointer className="h-4 w-4 mr-1" />
              Cancel Drawing
            </>
          ) : (
            <>
              <Pentagon className="h-4 w-4 mr-1" />
              Draw Polygon
            </>
          )}
        </Button>
        {selectedPolygonId && (
          <Button
            size="sm"
            variant="destructive"
            onClick={() => onPolygonDeleted(selectedPolygonId)}
            className="shadow-md"
          >
            <Trash2 className="h-4 w-4 mr-1" />
            Delete Selected
          </Button>
        )}
      </div>

      {polygons.length > 0 && (
        <div className="absolute bottom-4 left-4 z-10 bg-white rounded-lg shadow-md p-3 max-w-xs">
          <p className="text-xs font-medium text-muted-foreground mb-2">Polygon Zones</p>
          <div className="space-y-1">
            {polygons.map((p) => (
              <button
                key={p.id}
                onClick={() => onPolygonSelected(p.id)}
                className={`flex items-center gap-2 w-full text-left px-2 py-1 rounded text-xs transition-colors ${
                  p.id === selectedPolygonId ? 'bg-muted font-medium' : 'hover:bg-muted/50'
                }`}
              >
                <div
                  className="w-3 h-3 rounded-sm flex-shrink-0"
                  style={{ backgroundColor: p.color }}
                />
                <span className="truncate">{p.name}</span>
                <span className="text-muted-foreground ml-auto flex-shrink-0">
                  {p.matchOn === 'pickup' ? 'P' : p.matchOn === 'both' ? 'B' : 'D'}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      <GoogleMap
        mapContainerStyle={containerStyle}
        center={MAP_CENTER}
        zoom={MAP_ZOOM}
        onLoad={onMapLoad}
        options={{
          mapTypeControl: true,
          streetViewControl: false,
          fullscreenControl: false,
        }}
      />
    </div>
  )
}
