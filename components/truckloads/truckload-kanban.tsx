"use client"

import { useState, useMemo, useRef, useEffect } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { ScrollArea } from "@/components/ui/scroll-area"
import { TruckloadKanbanProps, TruckloadSummary } from "@/types/truckloads"
import { format, addDays, differenceInDays, isSameDay, isWithinInterval, startOfWeek } from "date-fns"
import { useRouter } from "next/navigation"
import { ScheduleNotes } from "./schedule-notes"

export function TruckloadKanban({
  drivers,
  truckloads,
  onMoveTruckload,
  showDays = 14,
  onChangeShowDays,
}: TruckloadKanbanProps) {
  const router = useRouter()
  const [draggingTruckload, setDraggingTruckload] = useState<TruckloadSummary | null>(null)
  const [dragPreview, setDragPreview] = useState<{ driverId: string, date: Date } | null>(null)
  const today = new Date()
  const [startDate, setStartDate] = useState(startOfWeek(today, { weekStartsOn: 0 }))
  const [visibleDays, setVisibleDays] = useState(56) // Show 8 weeks by default
  const dragImageRef = useRef<HTMLDivElement>(null)
  const scrollAreaRef = useRef<HTMLDivElement>(null)
  const [isLoadingMore, setIsLoadingMore] = useState(false)

  const dates = useMemo(() => {
    const result = []
    // Get the start of the week for the current date
    const weekStart = startOfWeek(startDate, { weekStartsOn: 0 })
    // Show dates before and after
    for (let i = -(visibleDays/2); i <= (visibleDays/2); i++) {
      result.push(addDays(weekStart, i))
    }
    return result
  }, [startDate, visibleDays])

  // Add effect to scroll to today's date on mount
  useEffect(() => {
    if (scrollAreaRef.current) {
      const scrollableElement = scrollAreaRef.current.querySelector('[data-radix-scroll-area-viewport]')
      if (scrollableElement) {
        // Calculate the scroll position to center today's date
        const todayIndex = dates.findIndex(date => isSameDay(date, today))
        if (todayIndex !== -1) {
          const scrollAmount = (todayIndex - 3) * 100 // Center today's date with 3 days before it
          scrollableElement.scrollTo({
            left: scrollAmount,
            behavior: 'instant'
          })
        }
      }
    }
  }, []) // Only run on mount

  // Add scroll event listener for infinite scrolling
  useEffect(() => {
    const scrollableElement = scrollAreaRef.current?.querySelector('[data-radix-scroll-area-viewport]')
    if (!scrollableElement) return

    const handleScroll = () => {
      if (isLoadingMore) return

      const { scrollLeft, scrollWidth, clientWidth } = scrollableElement
      const scrollPercentage = (scrollLeft + clientWidth) / scrollWidth

      // Load more dates when user scrolls near the edges (20% from either end)
      if (scrollPercentage > 0.8 || scrollPercentage < 0.2) {
        setIsLoadingMore(true)
        
        // Add more days in the direction of scroll
        const direction = scrollPercentage > 0.8 ? 1 : -1
        setVisibleDays(prev => prev + 28)

        // Reset loading state after a short delay
        setTimeout(() => setIsLoadingMore(false), 500)
      }
    }

    scrollableElement.addEventListener('scroll', handleScroll)
    return () => scrollableElement.removeEventListener('scroll', handleScroll)
  }, [isLoadingMore])

  const handleScroll = (direction: 'left' | 'right') => {
    // Move by 7 days (one week) in the specified direction
    setStartDate(prev => {
      const newDate = addDays(prev, direction === 'left' ? -7 : 7)
      return startOfWeek(newDate, { weekStartsOn: 0 })
    })

    // Ensure the scroll position updates to show the new dates
    if (scrollAreaRef.current) {
      const scrollableElement = scrollAreaRef.current.querySelector('[data-radix-scroll-area-viewport]')
      if (scrollableElement) {
        const currentScroll = scrollableElement.scrollLeft
        const scrollAmount = direction === 'left' ? -700 : 700 // 7 days * 100px per day
        scrollableElement.scrollTo({
          left: currentScroll + scrollAmount,
          behavior: 'smooth'
        })
      }
    }
  }

  const handleToday = () => {
    setStartDate(startOfWeek(new Date(), { weekStartsOn: 0 }))
    if (scrollAreaRef.current) {
      const scrollableElement = scrollAreaRef.current.querySelector('[data-radix-scroll-area-viewport]')
      if (scrollableElement) {
        const todayIndex = dates.findIndex(date => isSameDay(date, today))
        if (todayIndex !== -1) {
          const scrollAmount = (todayIndex - 3) * 100
          scrollableElement.scrollTo({
            left: scrollAmount,
            behavior: 'smooth'
          })
        }
      }
    }
  }

  const rows = useMemo(() => {
    return drivers.map(driver => {
      // Get all truckloads for this driver
      const driverTruckloads = truckloads.filter(t => t.driverId === driver.id)
      
      // Group overlapping truckloads into layers
      const layers: TruckloadSummary[][] = []
      
      driverTruckloads.forEach(truckload => {
        const startDate = new Date(truckload.startDate)
        const endDate = new Date(truckload.endDate)
        
        // Find the first layer where this truckload doesn't overlap with any others
        let layerIndex = layers.findIndex(layer => 
          !layer.some(existingLoad => {
            const existingStart = new Date(existingLoad.startDate)
            const existingEnd = new Date(existingLoad.endDate)
            return (
              isWithinInterval(startDate, { start: existingStart, end: existingEnd }) ||
              isWithinInterval(endDate, { start: existingStart, end: existingEnd }) ||
              isWithinInterval(existingStart, { start: startDate, end: endDate })
            )
          })
        )
        
        // If no suitable layer found, create a new one
        if (layerIndex === -1) {
          layerIndex = layers.length
          layers.push([])
        }
        
        layers[layerIndex].push(truckload)
      })

      return {
        driver,
        layers
      }
    })
  }, [drivers, truckloads])

  function handleDragStart(truckload: TruckloadSummary, e: React.DragEvent) {
    setDraggingTruckload(truckload)
    
    // Create a custom drag image
    if (dragImageRef.current) {
      const rect = (e.target as HTMLElement).getBoundingClientRect()
      dragImageRef.current.style.width = `${rect.width}px`
      dragImageRef.current.style.height = `${rect.height}px`
      dragImageRef.current.style.opacity = '0.5'
      e.dataTransfer.setDragImage(dragImageRef.current, 0, 0)
    }
  }

  function handleDragOver(e: React.DragEvent, driverId: string, date: Date) {
    e.preventDefault()
    // Update preview position
    setDragPreview({ driverId, date })
  }

  function handleDragLeave() {
    setDragPreview(null)
  }

  function handleDrop(e: React.DragEvent, driverId: string, date: Date) {
    e.preventDefault()
    if (draggingTruckload) {
      onMoveTruckload(draggingTruckload.id, driverId, format(date, 'yyyy-MM-dd'))
      setDraggingTruckload(null)
      setDragPreview(null)
    }
  }

  function getColumnSpan(startDate: Date, endDate: Date): number {
    const firstVisibleDate = dates[0]
    const lastVisibleDate = dates[dates.length - 1]
    
    // Adjust dates to visible range
    const visibleStartDate = startDate < firstVisibleDate ? firstVisibleDate : startDate
    const visibleEndDate = endDate > lastVisibleDate ? lastVisibleDate : endDate
    
    return differenceInDays(visibleEndDate, visibleStartDate) + 1
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button 
            variant="outline" 
            size="icon"
            onClick={() => handleScroll('left')}
            className="h-10 w-10"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6">
              <path d="m15 18-6-6 6-6"/>
            </svg>
          </Button>
          <span className="text-sm text-muted-foreground">
            {format(dates[0], 'MMM d')} - {format(dates[dates.length - 1], 'MMM d, yyyy')}
          </span>
          <Button 
            variant="outline" 
            size="icon"
            onClick={() => handleScroll('right')}
            className="h-10 w-10"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6">
              <path d="m9 18 6-6-6-6"/>
            </svg>
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleToday}
            className="ml-2"
          >
            Today
          </Button>
        </div>
      </div>
      <div className="relative">
        <ScrollArea className="h-[calc(100vh-12rem)] w-full" ref={scrollAreaRef}>
          <div className="w-full">
            {/* Hidden drag image element */}
            <div 
              ref={dragImageRef} 
              className="fixed -left-[9999px] bg-white/50 border-2 border-dashed border-primary rounded-lg"
            />

            <div className="grid auto-rows-auto" style={{ 
              gridTemplateColumns: `200px repeat(${dates.length}, 100px)`,
              width: `${200 + (dates.length * 100)}px`,
            }}>
              {/* Header */}
              <div className="sticky top-0 left-0 bg-gray-100 z-20 p-2 font-semibold border-b-2 border-r-2 border-gray-300 shadow-sm">
                Schedule
              </div>
              {dates.map((date, index) => (
                <div 
                  key={date.toISOString()} 
                  className={`sticky top-0 bg-background z-10 border-b-2 border-gray-300 shadow-sm ${
                    index % 2 === 0 ? 'bg-gray-100' : ''
                  } ${isSameDay(date, today) ? 'bg-blue-200 shadow-lg relative z-10 border-blue-300' : ''} ${
                    date.getDay() === 0 ? 'border-l-[2px] border-l-gray-400 ml-[3px] rounded-tl-lg border-t-[2px] border-t-gray-400' : ''
                  } ${
                    date.getDay() === 6 ? 'mr-[3px] rounded-tr-lg border-t-[2px] border-t-gray-400' : ''
                  } ${
                    date.getDay() !== 0 && date.getDay() !== 6 ? 'border-t-[2px] border-t-gray-400' : ''
                  }`}
                  style={{
                    borderRight: date.getDay() === 6 ? '2px solid rgb(156 163 175)' : '2px solid rgb(229 231 235)'
                  }}
                >
                  <div className="p-1 font-semibold text-center text-sm">
                    {format(date, 'MMM d')}
                  </div>
                  <div className="text-xs text-gray-500 text-center">
                    {format(date, 'EEE')}
                  </div>
                </div>
              ))}

              {/* Notes Section */}
              <ScheduleNotes 
                dates={dates}
                startDate={dates[0]}
                endDate={dates[dates.length - 1]}
              />

              {/* Drivers Header */}
              <div className="sticky left-0 bg-gray-100 z-20 p-2 font-semibold border-b-2 border-r-2 border-gray-300 shadow-sm">
                Drivers
              </div>
              {dates.map((date, index) => (
                <div 
                  key={date.toISOString()} 
                  className={`sticky top-0 bg-background z-10 border-b-2 border-gray-300 shadow-sm ${
                    index % 2 === 0 ? 'bg-gray-100' : ''
                  } ${isSameDay(date, today) ? 'bg-blue-200 shadow-lg relative z-10 border-blue-300' : ''} ${
                    date.getDay() === 0 ? 'border-l-[2px] border-l-gray-400 ml-[3px] rounded-tl-lg border-t-[2px] border-t-gray-400' : ''
                  } ${
                    date.getDay() === 6 ? 'mr-[3px] rounded-tr-lg border-t-[2px] border-t-gray-400' : ''
                  } ${
                    date.getDay() !== 0 && date.getDay() !== 6 ? 'border-t-[2px] border-t-gray-400' : ''
                  }`}
                  style={{
                    borderRight: date.getDay() === 6 ? '2px solid rgb(156 163 175)' : '2px solid rgb(229 231 235)'
                  }}
                >
                  <div className="p-1 font-semibold text-center text-sm">
                    {format(date, 'MMM d')}
                  </div>
                  <div className="text-xs text-gray-500 text-center">
                    {format(date, 'EEE')}
                  </div>
                </div>
              ))}

              {/* Rows */}
              {rows.map((row, rowIndex) => (
                <div key={row.driver.id} className="contents">
                  {/* Driver name cell */}
                  <div className={`sticky left-0 p-2 border-b-2 border-r-2 border-gray-300 flex items-center gap-2 bg-gray-100 z-10 ${
                    rowIndex % 2 === 0 ? 'bg-gray-100' : ''
                  }`} style={{
                    height: `${Math.max(100, (row.layers.length * 82) + ((row.layers.length - 1) * 2) + 2)}px`
                  }}>
                    <div 
                      className="w-4 h-4 rounded-full" 
                      style={{ backgroundColor: row.driver.color }}
                    />
                    <span className="font-medium">{row.driver.fullName}</span>
                  </div>

                  {/* Date cells */}
                  {dates.map((date, colIndex) => (
                    <div 
                      key={date.toISOString()}
                      className={`border-b-2 border-r-2 border-gray-300 relative ${
                        colIndex % 2 === 0 ? 'bg-gray-100/50' : ''
                      } ${rowIndex % 2 === 0 ? 'bg-gray-50/30' : ''} ${
                        isSameDay(date, today) ? 'bg-blue-200 shadow-lg relative z-0 border-blue-300' : ''
                      } ${
                        dragPreview && 
                        dragPreview.driverId === row.driver.id && 
                        isSameDay(dragPreview.date, date) 
                          ? 'bg-primary/10 border-primary' 
                          : ''
                      } ${
                        date.getDay() === 0 ? 'border-l-[2px] border-l-gray-400 ml-[3px]' : ''
                      } ${
                        date.getDay() === 6 ? 'mr-[3px]' : ''
                      } ${
                        rowIndex === rows.length - 1 && date.getDay() === 0 ? 'rounded-bl-lg border-b-[2px] border-b-gray-400' : ''
                      } ${
                        rowIndex === rows.length - 1 && date.getDay() === 6 ? 'rounded-br-lg border-b-[2px] border-b-gray-400' : ''
                      } ${
                        rowIndex === rows.length - 1 && date.getDay() !== 0 && date.getDay() !== 6 ? 'border-b-[2px] border-b-gray-400' : ''
                      }`}
                      style={{
                        height: `${Math.max(100, (row.layers.length * 82) + ((row.layers.length - 1) * 2) + 2)}px`,
                        borderRight: date.getDay() === 6 ? '2px solid rgb(156 163 175)' : '2px solid rgb(229 231 235)'
                      }}
                      onDragOver={(e) => handleDragOver(e, row.driver.id, date)}
                      onDragLeave={handleDragLeave}
                      onDrop={(e) => handleDrop(e, row.driver.id, date)}
                    >
                      {/* Add vertical time indicator line */}
                      <div className="absolute inset-y-0 left-0 border-l border-gray-300/50" />
                      <div className="absolute inset-y-0 right-0 border-l border-gray-300/50" />

                      {row.layers.map((layer, layerIndex) => (
                        <div 
                          key={layerIndex} 
                          className="absolute w-full px-1"
                          style={{
                            top: `${layerIndex === 0 ? 2 : (layerIndex * 84)}px`,
                            height: '80px'
                          }}
                        >
                          {layer.map(truckload => {
                            const startDate = new Date(truckload.startDate)
                            const endDate = new Date(truckload.endDate)
                            
                            if (!isWithinInterval(date, { start: startDate, end: endDate })) {
                              return null
                            }
                            
                            if (!isSameDay(date, startDate)) {
                              return null
                            }

                            const columnSpan = getColumnSpan(startDate, endDate)
                            
                            return (
                              <Card
                                key={truckload.id}
                                className={`absolute p-2 cursor-pointer shadow-md hover:shadow-lg transition-all ${
                                  draggingTruckload?.id === truckload.id ? 'opacity-50' : ''
                                }`}
                                style={{
                                  width: `calc(${columnSpan * 100}% - 8px)`,
                                  height: '80px',
                                  zIndex: draggingTruckload?.id === truckload.id ? 50 : 1,
                                  backgroundColor: 'white',
                                  borderLeft: `4px solid ${truckload.driverColor}`,
                                  borderTop: `1px solid ${truckload.driverColor}20`,
                                  borderRight: `1px solid ${truckload.driverColor}20`,
                                  borderBottom: `1px solid ${truckload.driverColor}20`
                                }}
                                draggable
                                onDragStart={(e) => handleDragStart(truckload, e)}
                                onClick={() => router.push(`/dashboard/trucking/${truckload.id}`)}
                              >
                                <div className="flex flex-col h-full">
                                  <div className="flex items-center gap-2" style={{
                                    background: `${truckload.driverColor}10`,
                                    margin: '-0.5rem -0.5rem 0.25rem -0.5rem',
                                    padding: '0.25rem 0.5rem',
                                    borderBottom: `1px solid ${truckload.driverColor}20`
                                  }}>
                                    <div 
                                      className="w-3 h-3 rounded-full flex-shrink-0" 
                                      style={{ backgroundColor: truckload.driverColor }}
                                    />
                                    <span className="text-base font-medium truncate">{truckload.driverName}</span>
                                  </div>
                                  <div className="flex-1 min-h-0 flex flex-col">
                                    <div className="text-sm text-gray-600">
                                      {format(startDate, 'MMM d')} - {format(endDate, 'MMM d, yyyy')}
                                    </div>
                                    <div className="text-base truncate">
                                      {truckload.trailerNumber && (
                                        <span className="font-medium">{truckload.trailerNumber} - </span>
                                      )}
                                      {truckload.description}
                                    </div>
                                    <div className="space-y-0.5 mt-auto">
                                      {truckload.pickupFootage > 0 && (
                                        <div>
                                          <div className="text-sm text-red-600">Pickup: {truckload.pickupFootage} ft</div>
                                          <Progress value={100} className="h-1 bg-red-100">
                                            <div className="h-full bg-red-600" style={{ width: '100%' }} />
                                          </Progress>
                                        </div>
                                      )}
                                      {truckload.deliveryFootage > 0 && (
                                        <div>
                                          <div className="text-sm">Delivery: {truckload.deliveryFootage} ft</div>
                                          <Progress value={100} className="h-1">
                                            <div className="h-full bg-black" style={{ width: '100%' }} />
                                          </Progress>
                                        </div>
                                      )}
                                      {truckload.transferFootage > 0 && (
                                        <div>
                                          <div className="text-sm text-blue-600">Transfer: {truckload.transferFootage} ft</div>
                                          <Progress value={100} className="h-1 bg-blue-100">
                                            <div className="h-full bg-blue-600" style={{ width: '100%' }} />
                                          </Progress>
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              </Card>
                            )
                          })}
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>
        </ScrollArea>
      </div>
    </div>
  )
} 