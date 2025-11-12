"use client"

import { useEffect, useState, useRef } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { AlertCircle, FileText, Printer, Download } from "lucide-react"
import { useReactToPrint } from "react-to-print"
import { TruckloadSheetDialog } from "./truckload-sheet-dialog"
import { TruckloadSheetContent } from "./truckload-sheet-content"
import { PickupSheet } from "./pickup-sheet"
import { LoadingSheet } from "./loading-sheet"

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

interface FreightItem {
  packages: number
  description: string
  weight: number
  charges: number
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

interface TruckloadLoadPapersProps {
  truckloadId: number
}

type Html2CanvasWithScaleOptions = Html2Canvas.Html2CanvasOptions & {
  scale?: number
  background?: string
}

export function TruckloadLoadPapers({ truckloadId }: TruckloadLoadPapersProps) {
  const [stops, setStops] = useState<TruckloadStop[]>([])
  const [truckload, setTruckload] = useState<TruckloadData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [expandedSections, setExpandedSections] = useState<{
    truckloadSheet: boolean
    pickupList: boolean
    loadingSheet: boolean
  }>({
    truckloadSheet: false,
    pickupList: false,
    loadingSheet: false
  })

  // Print refs for pickup and loading sheets
  const pickupPrintRef = useRef<HTMLDivElement>(null)
  const loadingPrintRef = useRef<HTMLDivElement>(null)

  // Print ref for truckload sheet
  const printRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    async function fetchData() {
      try {
        setIsLoading(true)
        
        // Fetch stops
        const stopsResponse = await fetch(`/api/truckloads/${truckloadId}/orders`)
        if (!stopsResponse.ok) {
          throw new Error("Failed to fetch stops")
        }
        const stopsData = await stopsResponse.json()
        if (!stopsData.success) {
          throw new Error(stopsData.error || "Failed to fetch stops")
        }
        setStops(stopsData.orders)

        // Fetch truckload data
        const truckloadResponse = await fetch(`/api/truckloads/${truckloadId}`)
        if (!truckloadResponse.ok) {
          throw new Error("Failed to fetch truckload")
        }
        const truckloadData = await truckloadResponse.json()
        if (!truckloadData.success) {
          throw new Error(truckloadData.error || "Failed to fetch truckload")
        }
        setTruckload(truckloadData.truckload)
      } catch (err) {
        setError(err instanceof Error ? err.message : "An error occurred")
        console.error("Error fetching data:", err)
      } finally {
        setIsLoading(false)
      }
    }

    if (truckloadId) {
      fetchData()
    }
  }, [truckloadId])

  const toggleSection = (section: keyof typeof expandedSections) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }))
  }

  // Print functionality for truckload sheet
  const handlePrint = useReactToPrint({
    documentTitle: `Truckload-Sheet-${truckloadId}`,
    pageStyle: `
      @page {
        size: letter;
        margin: 0.1in;
      }
      @media print {
        body {
          print-color-adjust: exact;
          -webkit-print-color-adjust: exact;
          margin: 0;
          padding: 0;
        }
        .print\\:hidden {
          display: none !important;
        }
        * {
          box-sizing: border-box;
          print-color-adjust: exact;
          -webkit-print-color-adjust: exact;
        }
        .bg-gray-200 {
          background-color: #e5e7eb !important;
        }
      }
    `,
    contentRef: printRef,
  })

  // Print functionality for pickup sheet
  const handlePickupPrint = useReactToPrint({
    documentTitle: `Pickup-Sheet-${truckloadId}`,
    pageStyle: `
      @page {
        size: letter;
        margin: 0.1in;
      }
      @media print {
        body {
          print-color-adjust: exact;
          -webkit-print-color-adjust: exact;
          margin: 0;
          padding: 0;
        }
        .print\\:hidden {
          display: none !important;
        }
        * {
          box-sizing: border-box;
          print-color-adjust: exact;
          -webkit-print-color-adjust: exact;
        }
      }
    `,
    contentRef: pickupPrintRef,
  })

  // Print functionality for loading sheet
  const handleLoadingPrint = useReactToPrint({
    documentTitle: `Loading-Sheet-${truckloadId}`,
    pageStyle: `
      @page {
        size: letter;
        margin: 0.1in;
      }
      @media print {
        body {
          print-color-adjust: exact;
          -webkit-print-color-adjust: exact;
          margin: 0;
          padding: 0;
        }
        .print\\:hidden {
          display: none !important;
        }
        * {
          box-sizing: border-box;
          print-color-adjust: exact;
          -webkit-print-color-adjust: exact;
        }
      }
    `,
    contentRef: loadingPrintRef,
  })

  // Export functionality for truckload sheet
  const handleExport = async () => {
    if (!truckload || stops.length === 0) {
      console.error('No truckload data available for export')
      return
    }

    try {
      // Create a temporary element with the truckload sheet content
      const tempDiv = document.createElement('div')
      tempDiv.style.position = 'absolute'
      tempDiv.style.left = '-9999px'
      tempDiv.style.top = '-9999px'
      tempDiv.style.width = '8.5in'
      tempDiv.style.minHeight = '11in'
      tempDiv.style.padding = '0.1in'
      tempDiv.style.margin = '0'
      tempDiv.style.backgroundColor = 'white'
      tempDiv.style.boxSizing = 'border-box'
      
      // Clone the truckload sheet content
      if (printRef.current) {
        const clonedContent = printRef.current.cloneNode(true) as HTMLElement
        tempDiv.appendChild(clonedContent)
        document.body.appendChild(tempDiv)

        // Use html2canvas and jsPDF to create PDF
        const html2canvas = (await import('html2canvas')).default
        const jsPDF = (await import('jspdf')).default
        
        const canvasOptions: Html2CanvasWithScaleOptions = {
          scale: 2,
          useCORS: true,
          allowTaint: true,
          background: '#ffffff'
        }

        const canvas = await html2canvas(tempDiv, canvasOptions)
        
        const imgData = canvas.toDataURL('image/png')
        const pdf = new jsPDF('p', 'in', 'letter')
        
        const imgWidth = 8.5
        const pageHeight = 11
        const imgHeight = (canvas.height * imgWidth) / canvas.width
        let heightLeft = imgHeight
        
        let position = 0
        
        pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight)
        heightLeft -= pageHeight
        
        while (heightLeft >= 0) {
          position = heightLeft - imgHeight
          pdf.addPage()
          pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight)
          heightLeft -= pageHeight
        }
        
        // Clean up
        document.body.removeChild(tempDiv)
        
        // Download the PDF
        pdf.save(`Truckload-Sheet-${truckloadId}.pdf`)
      }
    } catch (error) {
      console.error('Error exporting truckload sheet:', error)
      // Fallback to print functionality if export fails
      handlePrint()
    }
  }

  const transformStopToBOL = (stop: TruckloadStop) => {
    const items: FreightItem[] = [
      ...stop.skids_data.map(skid => ({
        packages: skid.quantity,
        description: `Skid ${skid.width}" × ${skid.length}"`,
        weight: 0,
        charges: 0
      })),
      ...stop.vinyl_data.map(vinyl => ({
        packages: vinyl.quantity,
        description: `Vinyl ${vinyl.width}" × ${vinyl.length}"`,
        weight: 0,
        charges: 0
      })),
      ...(stop.hand_bundles_data || []).map(handBundle => ({
        packages: handBundle.quantity,
        description: handBundle.description || 'Hand Bundle',
        weight: 0,
        charges: 0
      }))
    ]

    return {
      id: stop.id.toString(),
      shipper: {
        name: stop.pickup_customer.name,
        address: stop.pickup_customer.address,
        phone: '',
        phone2: ''
      },
      consignee: {
        name: stop.delivery_customer.name,
        address: stop.delivery_customer.address,
        phone: '',
        phone2: ''
      },
      items
    }
  }

  if (isLoading) {
    return (
      <div className="h-full w-full flex items-center justify-center">
        <Skeleton className="h-[400px] w-full" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="h-full w-full flex flex-col items-center justify-center text-red-500">
        <AlertCircle className="h-8 w-8 mb-2" />
        <p className="text-base">Error loading load papers: {error}</p>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col gap-4">
      {/* Truckload Sheet Section */}
      <Card className="p-4">
        <div 
          className="flex items-center justify-between mb-4 cursor-pointer hover:bg-gray-50 p-2 -m-2 rounded"
          onClick={() => toggleSection('truckloadSheet')}
        >
          <div>
            <h3 className="text-lg font-semibold">Truckload Sheet</h3>
            <p className="text-sm text-gray-600">Complete truckload overview and summary</p>
          </div>
          <div className="flex gap-2">
            <Button 
              variant="outline" 
              size="sm" 
              className="flex items-center gap-2"
              onClick={(e) => {
                e.stopPropagation()
                handlePrint()
              }}
            >
              <Printer className="h-4 w-4" />
              Print
            </Button>
            <Button 
              variant="outline" 
              size="sm" 
              className="flex items-center gap-2"
              onClick={(e) => {
                e.stopPropagation()
                handleExport()
              }}
            >
              <Download className="h-4 w-4" />
              Export
            </Button>
          </div>
        </div>
        
        {/* Expanded Content */}
        {expandedSections.truckloadSheet && truckload && stops.length > 0 && (
          <div className="mt-4 border-t pt-4 -mx-4">
            <div ref={printRef}>
              <TruckloadSheetContent truckload={truckload} stops={stops} isPreview={true} />
            </div>
          </div>
        )}
      </Card>

      {/* Pickup List Section */}
      <Card className="p-4">
        <div 
          className="flex items-center justify-between mb-4 cursor-pointer hover:bg-gray-50 p-2 -m-2 rounded"
          onClick={() => toggleSection('pickupList')}
        >
          <div>
            <h3 className="text-lg font-semibold">Pickup List</h3>
            <p className="text-sm text-gray-600">Detailed pickup locations and items</p>
          </div>
          <div className="flex gap-2">
            <Button 
              variant="outline" 
              size="sm" 
              className="flex items-center gap-2"
              onClick={(e) => {
                e.stopPropagation()
                handlePickupPrint()
              }}
            >
              <Printer className="h-4 w-4" />
              Print
            </Button>
            <Button 
              variant="outline" 
              size="sm" 
              className="flex items-center gap-2"
              onClick={(e) => {
                e.stopPropagation()
                console.log('Export pickup list clicked')
              }}
            >
              <Download className="h-4 w-4" />
              Export
            </Button>
          </div>
        </div>
        
        {/* Expanded Content */}
        {expandedSections.pickupList && truckload && (
          <div className="mt-4 border-t pt-4">
            <div ref={pickupPrintRef}>
              <PickupSheet
                truckloadId={truckloadId}
                driverName={truckload.driverName || "Unknown Driver"}
                startDate={truckload.startDate}
                endDate={truckload.endDate}
                trailerNumber={truckload.trailerNumber || "N/A"}
                description={truckload.description || "N/A"}
                driverColor={truckload.driverColor || "#fbbf24"}
              />
            </div>
          </div>
        )}
      </Card>

      {/* Loading Sheet Section */}
      <Card className="p-4">
        <div 
          className="flex items-center justify-between mb-4 cursor-pointer hover:bg-gray-50 p-2 -m-2 rounded"
          onClick={() => toggleSection('loadingSheet')}
        >
          <div>
            <h3 className="text-lg font-semibold">Loading Sheet</h3>
            <p className="text-sm text-gray-600">Trailer loading instructions and layout</p>
          </div>
          <div className="flex gap-2">
            <Button 
              variant="outline" 
              size="sm" 
              className="flex items-center gap-2"
              onClick={(e) => {
                e.stopPropagation()
                handleLoadingPrint()
              }}
            >
              <Printer className="h-4 w-4" />
              Print
            </Button>
            <Button 
              variant="outline" 
              size="sm" 
              className="flex items-center gap-2"
              onClick={(e) => {
                e.stopPropagation()
                console.log('Export loading sheet clicked')
              }}
            >
              <Download className="h-4 w-4" />
              Export
            </Button>
          </div>
        </div>
        
        {/* Expanded Content */}
        {expandedSections.loadingSheet && truckload && (
          <div className="mt-4 border-t pt-4">
            <div ref={loadingPrintRef}>
              <LoadingSheet
                truckloadId={truckloadId}
                driverName={truckload.driverName || "Unknown Driver"}
                startDate={truckload.startDate}
                endDate={truckload.endDate}
                trailerNumber={truckload.trailerNumber || "N/A"}
                description={truckload.description || "N/A"}
                driverColor={truckload.driverColor || "#fbbf24"}
              />
            </div>
          </div>
        )}
      </Card>

    </div>
  )
} 