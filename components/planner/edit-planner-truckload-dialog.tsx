"use client"

import { useState, useEffect, useRef } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Skeleton } from "@/components/ui/skeleton"
import { toast } from 'sonner'
import { Rocket, Trash2, FileText, Map, Settings, Printer, Download } from 'lucide-react'
import { useReactToPrint } from 'react-to-print'
import { TruckloadSheetContent } from '@/components/truckloads/truckload-sheet-content'
import { PickupSheet } from '@/components/truckloads/pickup-sheet'
import { LoadingSheet } from '@/components/truckloads/loading-sheet'
import { TruckloadMap } from '@/components/truckloads/truckload-map'
import type { PlannerTruckload, PlannerDriver } from '@/types/truckloads'

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

interface EditPlannerTruckloadDialogProps {
  isOpen: boolean
  onClose: () => void
  onUpdated: () => void
  truckload: PlannerTruckload | null
  drivers: PlannerDriver[]
}

function recordPrint(truckloadId: number, sheetType: 'truckload_sheet' | 'pickup_list' | 'loading_sheet') {
  fetch(`/api/truckloads/${truckloadId}/print-tracking`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sheetType }),
  }).catch((err) => console.error('Failed to record print:', err))
}

export function EditPlannerTruckloadDialog({
  isOpen,
  onClose,
  onUpdated,
  truckload,
  drivers,
}: EditPlannerTruckloadDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [activeTab, setActiveTab] = useState('details')
  const [formData, setFormData] = useState({
    driverId: '',
    startDate: '',
    startTime: '',
    endDate: '',
    endTime: '',
    trailerNumber: '',
    billOfLadingNumber: '',
    description: '',
  })

  // Papers tab state
  const [stops, setStops] = useState<TruckloadStop[]>([])
  const [truckloadData, setTruckloadData] = useState<TruckloadData | null>(null)
  const [isPapersLoading, setIsPapersLoading] = useState(false)
  const [papersError, setPapersError] = useState<string | null>(null)
  const [papersLoaded, setPapersLoaded] = useState(false)
  const [activePaper, setActivePaper] = useState<'cover' | 'pickup' | 'loading'>('cover')

  // Print refs
  const coverPrintRef = useRef<HTMLDivElement>(null)
  const pickupPrintRef = useRef<HTMLDivElement>(null)
  const loadingPrintRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (truckload) {
      setFormData({
        driverId: truckload.driverId?.toString() || '',
        startDate: truckload.startDate?.substring(0, 10) || '',
        startTime: truckload.startTime || '',
        endDate: truckload.endDate?.substring(0, 10) || '',
        endTime: truckload.endTime || '',
        trailerNumber: truckload.trailerNumber || '',
        billOfLadingNumber: truckload.billOfLadingNumber || '',
        description: truckload.description || '',
      })
      setPapersLoaded(false)
      setActiveTab('details')
    }
  }, [truckload])

  // Fetch papers data when the Papers tab is opened for non-draft truckloads
  useEffect(() => {
    if (activeTab === 'papers' && truckload && !isDraft && !papersLoaded) {
      fetchPapersData()
    }
  }, [activeTab, truckload])

  async function fetchPapersData() {
    if (!truckload) return
    setIsPapersLoading(true)
    setPapersError(null)

    try {
      const [stopsRes, truckloadRes] = await Promise.all([
        fetch(`/api/truckloads/${truckload.id}/orders`),
        fetch(`/api/truckloads/${truckload.id}`),
      ])

      if (!stopsRes.ok) throw new Error('Failed to fetch stops')
      if (!truckloadRes.ok) throw new Error('Failed to fetch truckload')

      const stopsData = await stopsRes.json()
      const truckloadDataResult = await truckloadRes.json()

      if (!stopsData.success) throw new Error(stopsData.error || 'Failed to fetch stops')
      if (!truckloadDataResult.success) throw new Error(truckloadDataResult.error || 'Failed to fetch truckload')

      setStops(stopsData.orders)
      setTruckloadData(truckloadDataResult.truckload)
      setPapersLoaded(true)
    } catch (err) {
      setPapersError(err instanceof Error ? err.message : 'An error occurred')
      console.error('Error fetching papers data:', err)
    } finally {
      setIsPapersLoading(false)
    }
  }

  const truckloadId = truckload?.id ?? 0

  // Print handlers (hooks must be called unconditionally)
  const handleCoverPrint = useReactToPrint({
    documentTitle: `Truckload-Sheet-${truckloadId}`,
    pageStyle: `
      @page { size: letter; margin: 0.1in; }
      @media print {
        body { print-color-adjust: exact; -webkit-print-color-adjust: exact; margin: 0; padding: 0; }
        .print\\:hidden { display: none !important; }
      }
    `,
    contentRef: coverPrintRef,
    onAfterPrint: () => recordPrint(truckloadId, 'truckload_sheet'),
  })

  const handlePickupPrint = useReactToPrint({
    documentTitle: `Pickup-Sheet-${truckloadId}`,
    pageStyle: `
      @page { size: letter; margin: 0.1in; }
      @media print {
        body { print-color-adjust: exact; -webkit-print-color-adjust: exact; margin: 0; padding: 0; }
        .print\\:hidden { display: none !important; }
      }
    `,
    contentRef: pickupPrintRef,
    onAfterPrint: () => recordPrint(truckloadId, 'pickup_list'),
  })

  const handleLoadingPrint = useReactToPrint({
    documentTitle: `Loading-Sheet-${truckloadId}`,
    pageStyle: `
      @page { size: letter; margin: 0.1in; }
      @media print {
        body { print-color-adjust: exact; -webkit-print-color-adjust: exact; margin: 0; padding: 0; }
        .print\\:hidden { display: none !important; }
      }
    `,
    contentRef: loadingPrintRef,
    onAfterPrint: () => recordPrint(truckloadId, 'loading_sheet'),
  })

  if (!truckload) return null

  const isDraft = truckload.status === 'draft'
  const isNonDraft = !isDraft

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!truckload) return
    setIsSubmitting(true)

    try {
      const response = await fetch(`/api/truckloads/${truckload.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          driverId: parseInt(formData.driverId),
          startDate: formData.startDate,
          endDate: formData.endDate,
          startTime: formData.startTime || null,
          endTime: formData.endTime || null,
          trailerNumber: formData.trailerNumber || null,
          description: formData.description || null,
          bill_of_lading_number: formData.billOfLadingNumber || null,
        })
      })

      const result = await response.json()
      if (result.success) {
        toast.success('Truckload updated')
        onUpdated()
        onClose()
      } else {
        throw new Error(result.error || 'Failed to update')
      }
    } catch (error) {
      console.error('Error updating truckload:', error)
      toast.error('Failed to update truckload')
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handlePromote() {
    if (!truckload) return
    setIsSubmitting(true)

    try {
      const response = await fetch(`/api/truckloads/${truckload.id}/promote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      })

      const result = await response.json()
      if (result.success) {
        toast.success('Truckload promoted to active!')
        onUpdated()
        onClose()
      } else {
        throw new Error(result.error || 'Failed to promote')
      }
    } catch (error) {
      console.error('Error promoting truckload:', error)
      toast.error('Failed to promote truckload')
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleDelete() {
    if (!truckload) return

    try {
      const response = await fetch('/api/truckloads', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify({ id: truckload.id })
      })

      if (!response.ok) {
        const contentType = response.headers.get('content-type')
        if (contentType && contentType.includes('application/json')) {
          const errorData = await response.json()
          throw new Error(errorData.error || errorData.message || `Failed to delete truckload: ${response.status}`)
        } else {
          throw new Error(`Failed to delete truckload: ${response.status}`)
        }
      }

      const result = await response.json()
      if (result.success) {
        toast.success(result.message || 'Truckload deleted')
        onUpdated()
        onClose()
      } else {
        throw new Error(result.error || 'Failed to delete')
      }
    } catch (error) {
      console.error('Error deleting truckload:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to delete truckload')
    }
  }

  // Details form content (shared between draft and non-draft)
  function renderDetailsForm() {
    return (
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label>Driver</Label>
          <Select
            value={formData.driverId}
            onValueChange={(value) => setFormData({ ...formData, driverId: value })}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select a driver" />
            </SelectTrigger>
            <SelectContent>
              {drivers.map((driver) => (
                <SelectItem key={driver.id} value={driver.id.toString()}>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: driver.color }} />
                    <span>{driver.full_name}</span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Start Date</Label>
            <Input
              type="date"
              value={formData.startDate}
              onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
              required
            />
          </div>
          <div className="space-y-2">
            <Label>Start Time</Label>
            <Input
              type="time"
              value={formData.startTime}
              onChange={(e) => setFormData({ ...formData, startTime: e.target.value })}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>End Date</Label>
            <Input
              type="date"
              value={formData.endDate}
              onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
              required
            />
          </div>
          <div className="space-y-2">
            <Label>End Time</Label>
            <Input
              type="time"
              value={formData.endTime}
              onChange={(e) => setFormData({ ...formData, endTime: e.target.value })}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Trailer Number</Label>
            <Input
              type="text"
              value={formData.trailerNumber}
              onChange={(e) => setFormData({ ...formData, trailerNumber: e.target.value })}
              placeholder="Trailer #"
            />
          </div>
          <div className="space-y-2">
            <Label>BOL Number</Label>
            <Input
              type="text"
              value={formData.billOfLadingNumber}
              onChange={(e) => setFormData({ ...formData, billOfLadingNumber: e.target.value })}
              placeholder={isDraft ? "Generated on promote" : "BOL #"}
              className={isDraft && !formData.billOfLadingNumber ? "text-gray-400" : ""}
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label>Description</Label>
          <Textarea
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            placeholder="Truckload description"
            rows={3}
          />
        </div>

        <div className="flex items-center justify-between pt-2">
          <div className="flex gap-2">
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button type="button" variant="destructive" size="sm">
                  <Trash2 className="h-3.5 w-3.5 mr-1" />
                  Delete
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete this truckload?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This action cannot be undone. This will permanently delete the truckload
                    {isDraft ? '' : ' and all its assignments'}.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={handleDelete}>Delete</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>

          <div className="flex gap-2">
            {isDraft && (
              <Button
                type="button"
                variant="outline"
                onClick={handlePromote}
                disabled={isSubmitting || !formData.driverId}
                className="border-green-300 text-green-700 hover:bg-green-50 hover:border-green-400"
              >
                <Rocket className="h-3.5 w-3.5 mr-1" />
                Make Active
              </Button>
            )}
            <Button type="submit" disabled={isSubmitting || !formData.driverId}>
              {isSubmitting ? 'Saving...' : 'Save Changes'}
            </Button>
          </div>
        </div>
      </form>
    )
  }

  // Papers content
  function renderPapersContent() {
    if (!truckload) return null

    if (isPapersLoading) {
      return (
        <div className="space-y-4 py-4">
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-[400px] w-full" />
        </div>
      )
    }

    if (papersError) {
      return (
        <div className="flex flex-col items-center justify-center py-12 text-red-500">
          <p>Error loading papers: {papersError}</p>
          <Button variant="outline" size="sm" className="mt-3" onClick={fetchPapersData}>
            Retry
          </Button>
        </div>
      )
    }

    if (!truckloadData || stops.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center py-12 text-gray-500">
          <FileText className="h-10 w-10 mb-3 text-gray-300" />
          <p className="text-sm">No orders assigned to this truckload yet.</p>
        </div>
      )
    }

    return (
      <div className="flex flex-col gap-3">
        {/* Paper type selector */}
        <div className="flex items-center gap-2 border-b pb-3">
          <Button
            variant={activePaper === 'cover' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setActivePaper('cover')}
            className="text-xs"
          >
            Cover Sheet
          </Button>
          <Button
            variant={activePaper === 'pickup' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setActivePaper('pickup')}
            className="text-xs"
          >
            Pickup Sheet
          </Button>
          <Button
            variant={activePaper === 'loading' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setActivePaper('loading')}
            className="text-xs"
          >
            Loading Sheet
          </Button>

          <div className="ml-auto flex gap-1.5">
            <Button
              variant="outline"
              size="sm"
              className="text-xs gap-1.5"
              onClick={() => {
                if (activePaper === 'cover') handleCoverPrint()
                else if (activePaper === 'pickup') handlePickupPrint()
                else handleLoadingPrint()
              }}
            >
              <Printer className="h-3.5 w-3.5" />
              Print
            </Button>
          </div>
        </div>

        {/* Paper content */}
        <div className="overflow-y-auto max-h-[60vh]">
          {activePaper === 'cover' && (
            <div ref={coverPrintRef}>
              <TruckloadSheetContent truckload={truckloadData} stops={stops} isPreview={true} />
            </div>
          )}

          {activePaper === 'pickup' && (
            <div ref={pickupPrintRef}>
              <PickupSheet
                truckloadId={truckload.id}
                driverName={truckloadData.driverName || "Unknown Driver"}
                startDate={truckloadData.startDate}
                endDate={truckloadData.endDate}
                trailerNumber={truckloadData.trailerNumber || "N/A"}
                description={truckloadData.description || "N/A"}
                driverColor={truckloadData.driverColor || "#fbbf24"}
              />
            </div>
          )}

          {activePaper === 'loading' && (
            <div ref={loadingPrintRef}>
              <LoadingSheet
                truckloadId={truckload.id}
                driverName={truckloadData.driverName || "Unknown Driver"}
                startDate={truckloadData.startDate}
                endDate={truckloadData.endDate}
                trailerNumber={truckloadData.trailerNumber || "N/A"}
                description={truckloadData.description || "N/A"}
                driverColor={truckloadData.driverColor || "#fbbf24"}
              />
            </div>
          )}
        </div>
      </div>
    )
  }

  // Route map content
  function renderMapContent() {
    if (!truckload) return null

    return (
      <div className="h-[65vh] w-full rounded-lg overflow-hidden border">
        <TruckloadMap truckloadId={truckload.id} />
      </div>
    )
  }

  // Draft truckloads: simple small dialog (no tabs)
  if (isDraft) {
    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              Edit Truckload
              <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">Draft</Badge>
            </DialogTitle>
          </DialogHeader>
          <div className="mt-2">
            {renderDetailsForm()}
          </div>
        </DialogContent>
      </Dialog>
    )
  }

  // Active / Completed truckloads: large dialog with tabs
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl w-[95vw] max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Truckload {truckload.description ? `- ${truckload.description}` : `#${truckload.id}`}
            {truckload.isCompleted ? (
              <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">Completed</Badge>
            ) : (
              <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">Active</Badge>
            )}
            {truckload.billOfLadingNumber && (
              <span className="text-sm font-normal text-gray-500 ml-2">BOL# {truckload.billOfLadingNumber}</span>
            )}
          </DialogTitle>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 min-h-0 flex flex-col">
          <TabsList className="w-full justify-start">
            <TabsTrigger value="details" className="gap-1.5">
              <Settings className="h-3.5 w-3.5" />
              Details
            </TabsTrigger>
            <TabsTrigger value="papers" className="gap-1.5">
              <FileText className="h-3.5 w-3.5" />
              Papers
            </TabsTrigger>
            <TabsTrigger value="map" className="gap-1.5">
              <Map className="h-3.5 w-3.5" />
              Route Map
            </TabsTrigger>
          </TabsList>

          <TabsContent value="details" className="mt-4 flex-1 overflow-y-auto">
            {renderDetailsForm()}
          </TabsContent>

          <TabsContent value="papers" className="mt-4 flex-1 overflow-y-auto">
            {renderPapersContent()}
          </TabsContent>

          <TabsContent value="map" className="mt-4 flex-1 min-h-0">
            {renderMapContent()}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  )
}
