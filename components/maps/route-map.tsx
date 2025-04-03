"use client"

import { useEffect, useRef, useState } from "react"
import { Loader } from "@googlemaps/js-api-loader"
import { AlertCircle } from "lucide-react"

interface Location {
  lat: number
  lng: number
  address: string
  name: string
}

interface RouteMapProps {
  stops: {
    id: number
    assignment_type: 'pickup' | 'delivery'
    sequence_number: number
    pickup_customer: {
      name: string
      address: string
    }
    delivery_customer: {
      name: string
      address: string
    }
    is_transfer_order: boolean
  }[]
}

export function RouteMap({ stops }: RouteMapProps) {
  const mapRef = useRef<HTMLDivElement>(null)
  const mapInstanceRef = useRef<google.maps.Map | null>(null)
  const markersRef = useRef<google.maps.Marker[]>([])
  const directionsRendererRef = useRef<google.maps.DirectionsRenderer | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const initMap = async () => {
      const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
      
      if (!apiKey) {
        setError("Google Maps API key is not configured")
        console.error("Google Maps API key is missing")
        return
      }

      console.log("Initializing Google Maps with API key:", apiKey.substring(0, 10) + "...")

      const loader = new Loader({
        apiKey,
        version: "weekly",
        libraries: ["places"]
      })

      try {
        const google = await loader.load()
        console.log("Google Maps loaded successfully")
        
        // Initialize the map
        if (mapRef.current) {
          const map = new google.maps.Map(mapRef.current, {
            center: { lat: 39.8283, lng: -98.5795 }, // Center of USA
            zoom: 4,
            mapTypeControl: false,
            streetViewControl: false,
            fullscreenControl: false
          })

          mapInstanceRef.current = map

          // Initialize directions renderer
          const directionsRenderer = new google.maps.DirectionsRenderer({
            map,
            suppressMarkers: true,
            polylineOptions: {
              strokeColor: "#3b82f6",
              strokeWeight: 4
            }
          })
          directionsRendererRef.current = directionsRenderer

          // Geocode addresses and create markers
          const geocoder = new google.maps.Geocoder()
          const locations: Location[] = []

          for (const stop of stops) {
            const address = stop.assignment_type === 'pickup' 
              ? stop.pickup_customer.address 
              : stop.delivery_customer.address

            try {
              const result = await geocoder.geocode({ address })
              if (result.results[0]) {
                const location = result.results[0].geometry.location
                locations.push({
                  lat: location.lat(),
                  lng: location.lng(),
                  address,
                  name: stop.assignment_type === 'pickup' 
                    ? stop.pickup_customer.name 
                    : stop.delivery_customer.name
                })
              } else {
                console.warn(`No results found for address: ${address}`)
              }
            } catch (error) {
              console.error(`Error geocoding address: ${address}`, error)
            }
          }

          if (locations.length === 0) {
            setError("No valid locations found for the stops")
            return
          }

          // Create markers for each location
          locations.forEach((location, index) => {
            const stop = stops[index]
            const marker = new google.maps.Marker({
              position: { lat: location.lat, lng: location.lng },
              map,
              title: `${stop.sequence_number}. ${location.name}`,
              label: {
                text: stop.sequence_number.toString(),
                color: "#ffffff",
                fontSize: "12px",
                fontWeight: "bold"
              },
              icon: {
                path: google.maps.SymbolPath.CIRCLE,
                scale: 8,
                fillColor: stop.assignment_type === 'pickup' 
                  ? '#ef4444' 
                  : stop.is_transfer_order 
                    ? '#3b82f6' 
                    : '#000000',
                fillOpacity: 1,
                strokeColor: "#ffffff",
                strokeWeight: 2
              }
            })

            // Add info window
            const infoWindow = new google.maps.InfoWindow({
              content: `
                <div class="p-2">
                  <div class="font-medium">${stop.sequence_number}. ${location.name}</div>
                  <div class="text-sm text-gray-600">${location.address}</div>
                  <div class="text-sm mt-1">
                    <span class="inline-block px-2 py-1 rounded-full text-xs ${
                      stop.assignment_type === 'pickup' 
                        ? 'bg-red-100 text-red-800' 
                        : stop.is_transfer_order 
                          ? 'bg-blue-100 text-blue-800' 
                          : 'bg-gray-100 text-gray-800'
                    }">
                      ${stop.assignment_type === 'pickup' ? 'Pickup' : 'Delivery'}
                      ${stop.is_transfer_order ? ' (Transfer)' : ''}
                    </span>
                  </div>
                </div>
              `
            })

            marker.addListener("click", () => {
              infoWindow.open(map, marker)
            })

            markersRef.current.push(marker)
          })

          // Fit map bounds to show all markers
          if (markersRef.current.length > 0) {
            const bounds = new google.maps.LatLngBounds()
            markersRef.current.forEach(marker => bounds.extend(marker.getPosition()!))
            map.fitBounds(bounds)
          }

          // Create route if we have at least 2 locations
          if (locations.length >= 2) {
            const waypoints = locations.slice(1, -1).map(location => ({
              location: { lat: location.lat, lng: location.lng },
              stopover: true
            }))

            const directionsService = new google.maps.DirectionsService()
            directionsService.route(
              {
                origin: { lat: locations[0].lat, lng: locations[0].lng },
                destination: { lat: locations[locations.length - 1].lat, lng: locations[locations.length - 1].lng },
                waypoints,
                optimizeWaypoints: false,
                travelMode: google.maps.TravelMode.DRIVING
              },
              (result, status) => {
                if (status === "OK" && directionsRendererRef.current) {
                  directionsRendererRef.current.setDirections(result)
                } else {
                  console.error("Error getting directions:", status)
                }
              }
            )
          }
        }
      } catch (error) {
        console.error("Error loading Google Maps:", error)
        setError("Failed to load Google Maps")
      }
    }

    initMap()

    // Cleanup
    return () => {
      markersRef.current.forEach(marker => marker.setMap(null))
      markersRef.current = []
      if (directionsRendererRef.current) {
        directionsRendererRef.current.setMap(null)
        directionsRendererRef.current = null
      }
      if (mapInstanceRef.current) {
        mapInstanceRef.current = null
      }
    }
  }, [stops])

  if (error) {
    return (
      <div className="h-full w-full flex flex-col items-center justify-center text-red-500">
        <AlertCircle className="h-8 w-8 mb-2" />
        <p className="text-base">{error}</p>
      </div>
    )
  }

  return (
    <div ref={mapRef} className="w-full h-full rounded-md" />
  )
} 