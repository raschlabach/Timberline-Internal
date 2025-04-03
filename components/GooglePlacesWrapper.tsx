"use client"

import React, { useState, useEffect, ReactNode } from "react"
import Script from 'next/script'

interface GooglePlacesWrapperProps {
  children: ReactNode
  apiKey: string
  isOpen?: boolean // Add this to track modal open state
}

export function GooglePlacesWrapper({ children, apiKey, isOpen = true }: GooglePlacesWrapperProps) {
  const [scriptLoaded, setScriptLoaded] = useState(false)
  const [scriptError, setScriptError] = useState<string | null>(null)
  
  const handleScriptLoad = () => {
    console.log("Google Maps script loaded successfully")
    setScriptLoaded(true)
  }
  
  const handleScriptError = () => {
    console.error("Failed to load Google Maps script")
    setScriptError("Failed to load Google Maps script")
  }
  
  // Reset state when modal reopens
  useEffect(() => {
    if (isOpen) {
      // Check if the script is already loaded in the window
      if (window.google?.maps) {
        setScriptLoaded(true)
        setScriptError(null)
      } else {
        setScriptLoaded(false)
      }
    }
  }, [isOpen]);
  
  // Fallback mechanism for Next.js Script component
  useEffect(() => {
    // Only add this fallback if the Script component hasn't already loaded it
    if (!window.google?.maps && !scriptLoaded && !scriptError) {
      // Check after a delay to see if the script has loaded
      const timer = setTimeout(() => {
        if (!window.google?.maps) {
          console.log("Fallback: Loading Google Maps script manually")
          const script = document.createElement('script')
          script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places`
          script.async = true
          script.defer = true
          script.onload = handleScriptLoad
          script.onerror = handleScriptError
          document.head.appendChild(script)
        } else {
          setScriptLoaded(true)
        }
      }, 1000)
      
      return () => clearTimeout(timer)
    }
  }, [apiKey, scriptError, scriptLoaded])
  
  if (scriptError) {
    return (
      <div className="p-4 border border-red-300 bg-red-50 rounded-md text-red-700">
        <p className="font-medium">Error loading Google Maps</p>
        <p className="text-sm mt-1">{scriptError}</p>
        <p className="text-xs mt-2">Please check your API key and make sure the Places API is enabled in your Google Cloud Console.</p>
      </div>
    )
  }
  
  return (
    <>
      <Script
        src={`https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places`}
        onLoad={handleScriptLoad}
        onError={handleScriptError}
        strategy="beforeInteractive"
      />
      
      {scriptLoaded ? (
        children
      ) : (
        <div className="p-4 border border-gray-300 bg-gray-50 rounded-md animate-pulse">
          <div className="h-10 bg-gray-200 rounded w-full"></div>
          <p className="text-xs text-gray-500 mt-2">Loading Google Places...</p>
        </div>
      )}
    </>
  )
} 