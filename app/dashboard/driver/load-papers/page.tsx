'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/modal'
import {
  FolderOpen,
  Truck,
  FileText,
  ChevronRight,
  ChevronDown,
  Download,
  Eye,
  Loader2,
  Calendar,
  Hash,
  Package,
  MapPin,
  Image as ImageIcon,
} from 'lucide-react'

interface TruckloadOrder {
  id: number
  assignmentType: string
  sequenceNumber: number
  pickupCustomerName: string
  deliveryCustomerName: string
  footage: number
  skids: number
  vinyl: number
  comments: string | null
  isRush: boolean
  documents: OrderDocument[]
}

interface OrderDocument {
  id: string
  fileName: string
  filePath: string
  fileType: string
  fileSize: number
  uploadedBy: string
  createdAt: string
  source: string
}

interface DriverTruckload {
  id: number
  startDate: string
  endDate: string
  trailerNumber: string | null
  billOfLadingNumber: string | null
  description: string | null
  isCompleted: boolean
  status: string
  totalMileage: number | null
  orders: TruckloadOrder[]
}

export default function DriverLoadPapers() {
  const { data: session } = useSession()
  const [truckloads, setTruckloads] = useState<DriverTruckload[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [hasError, setHasError] = useState(false)
  const [expandedTruckload, setExpandedTruckload] = useState<number | null>(null)
  const [viewingDocument, setViewingDocument] = useState<OrderDocument | null>(null)
  const [isDocViewOpen, setIsDocViewOpen] = useState(false)

  // Load driver's truckloads
  useEffect(() => {
    async function loadTruckloads() {
      try {
        setIsLoading(true)
        const response = await fetch('/api/driver/truckloads')
        if (!response.ok) throw new Error('Failed to load truckloads')
        const data = await response.json()
        setTruckloads(data.truckloads || [])
        // Auto-expand the first non-completed truckload
        const firstActive = (data.truckloads || []).find((t: DriverTruckload) => !t.isCompleted && t.status !== 'completed')
        if (firstActive) setExpandedTruckload(firstActive.id)
      } catch (error) {
        console.error('Error loading truckloads:', error)
        setHasError(true)
      } finally {
        setIsLoading(false)
      }
    }

    loadTruckloads()
  }, [])

  function toggleExpand(truckloadId: number) {
    setExpandedTruckload((prev) => (prev === truckloadId ? null : truckloadId))
  }

  function handleViewDocument(doc: OrderDocument) {
    setViewingDocument(doc)
    setIsDocViewOpen(true)
  }

  function getStatusBadge(truckload: DriverTruckload) {
    if (truckload.isCompleted || truckload.status === 'completed') {
      return <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 text-[10px]">Completed</Badge>
    }
    if (truckload.status === 'draft') {
      return <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 text-[10px]">Draft</Badge>
    }
    return <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 text-[10px]">Active</Badge>
  }

  function formatDate(dateStr: string): string {
    const date = new Date(dateStr + 'T12:00:00')
    return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
  }

  function getTotalDocCount(truckload: DriverTruckload): number {
    return truckload.orders.reduce((sum, order) => sum + order.documents.length, 0)
  }

  function getFileIcon(fileType: string) {
    if (fileType?.startsWith('image/')) return <ImageIcon className="h-4 w-4 text-purple-500" />
    return <FileText className="h-4 w-4 text-blue-500" />
  }

  function formatFileSize(bytes: number): string {
    if (!bytes) return ''
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  if (isLoading) {
    return (
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-violet-100 rounded-lg">
            <FolderOpen className="h-5 w-5 text-violet-600" />
          </div>
          <h1 className="text-xl md:text-2xl font-bold text-gray-900">Load Papers</h1>
        </div>
        <div className="space-y-3">
          <Skeleton className="h-20 w-full rounded-lg" />
          <Skeleton className="h-20 w-full rounded-lg" />
          <Skeleton className="h-20 w-full rounded-lg" />
        </div>
      </div>
    )
  }

  if (hasError) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] gap-4">
        <p className="text-red-500">Failed to load truckloads</p>
        <Button onClick={() => window.location.reload()}>Retry</Button>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="p-2 bg-violet-100 rounded-lg">
          <FolderOpen className="h-5 w-5 text-violet-600" />
        </div>
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-gray-900">Load Papers</h1>
          <p className="text-xs text-gray-500">{truckloads.length} truckload{truckloads.length !== 1 ? 's' : ''}</p>
        </div>
      </div>

      {/* Truckload list */}
      {truckloads.length > 0 ? (
        <div className="space-y-3">
          {truckloads.map((truckload) => {
            const isExpanded = expandedTruckload === truckload.id
            const docCount = getTotalDocCount(truckload)
            const isCompleted = truckload.isCompleted || truckload.status === 'completed'

            return (
              <div key={truckload.id} className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                {/* Truckload header */}
                <button
                  onClick={() => toggleExpand(truckload.id)}
                  className="w-full text-left p-3 md:p-4 flex items-center justify-between hover:bg-gray-50 active:bg-gray-100 transition-colors"
                >
                  <div className="flex items-start gap-3 min-w-0 flex-1">
                    <div className={`p-1.5 rounded-lg flex-shrink-0 ${isCompleted ? 'bg-green-100' : 'bg-blue-100'}`}>
                      <Truck className={`h-4 w-4 ${isCompleted ? 'text-green-600' : 'text-blue-600'}`} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-sm text-gray-900">
                          {truckload.description || `Truckload #${truckload.id}`}
                        </span>
                        {getStatusBadge(truckload)}
                      </div>
                      <div className="flex items-center gap-3 mt-1 text-xs text-gray-500 flex-wrap">
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {formatDate(truckload.startDate)}
                          {truckload.startDate !== truckload.endDate && ` → ${formatDate(truckload.endDate)}`}
                        </span>
                        {truckload.trailerNumber && (
                          <span className="flex items-center gap-1">
                            <Hash className="h-3 w-3" />
                            Trailer {truckload.trailerNumber}
                          </span>
                        )}
                        {truckload.billOfLadingNumber && (
                          <span className="flex items-center gap-1">
                            <FileText className="h-3 w-3" />
                            BOL {truckload.billOfLadingNumber}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 mt-1 text-xs text-gray-400">
                        <span>{truckload.orders.length} stop{truckload.orders.length !== 1 ? 's' : ''}</span>
                        {docCount > 0 && (
                          <span className="text-violet-600 font-medium">
                            {docCount} document{docCount !== 1 ? 's' : ''}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  {isExpanded ? (
                    <ChevronDown className="h-4 w-4 text-gray-400 flex-shrink-0" />
                  ) : (
                    <ChevronRight className="h-4 w-4 text-gray-400 flex-shrink-0" />
                  )}
                </button>

                {/* Expanded content - Orders & Documents */}
                {isExpanded && (
                  <div className="border-t border-gray-100">
                    {truckload.orders.length > 0 ? (
                      <div className="divide-y divide-gray-100">
                        {truckload.orders.map((order) => (
                          <div key={`${order.id}-${order.assignmentType}`} className="p-3 md:p-4">
                            {/* Order info */}
                            <div className="flex items-start gap-2 mb-2">
                              <div className={`w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0 ${
                                order.assignmentType === 'pickup' ? 'bg-red-500' : 'bg-gray-900'
                              }`} />
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <Badge
                                    variant="outline"
                                    className={`text-[10px] ${
                                      order.assignmentType === 'pickup'
                                        ? 'bg-red-50 text-red-700 border-red-200'
                                        : 'bg-gray-100 text-gray-700 border-gray-300'
                                    }`}
                                  >
                                    {order.assignmentType === 'pickup' ? 'Pickup' : 'Delivery'}
                                  </Badge>
                                  <span className="text-xs text-gray-400">Order #{order.id}</span>
                                  {order.isRush && (
                                    <Badge variant="outline" className="bg-orange-50 text-orange-600 border-orange-200 text-[10px]">
                                      Rush
                                    </Badge>
                                  )}
                                </div>
                                <div className="mt-1 space-y-0.5">
                                  <div className="flex items-center gap-1.5">
                                    <MapPin className="h-3 w-3 text-red-400 flex-shrink-0" />
                                    <span className="text-sm font-medium text-gray-700 truncate">
                                      {order.pickupCustomerName}
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-1.5">
                                    <MapPin className="h-3 w-3 text-gray-500 flex-shrink-0" />
                                    <span className="text-sm font-medium text-gray-700 truncate">
                                      {order.deliveryCustomerName}
                                    </span>
                                  </div>
                                </div>
                                {(order.footage > 0 || order.skids > 0 || order.vinyl > 0) && (
                                  <div className="flex items-center gap-2 mt-1 text-xs text-gray-400">
                                    {order.footage > 0 && <span>{order.footage.toLocaleString()} sq ft</span>}
                                    {order.skids > 0 && <span>{order.skids} skid{order.skids !== 1 ? 's' : ''}</span>}
                                    {order.vinyl > 0 && <span>{order.vinyl} vinyl</span>}
                                  </div>
                                )}
                                {order.comments && (
                                  <p className="text-xs text-gray-500 mt-1 bg-gray-50 rounded px-2 py-1">
                                    {order.comments}
                                  </p>
                                )}
                              </div>
                            </div>

                            {/* Documents for this order */}
                            {order.documents.length > 0 && (
                              <div className="ml-3.5 mt-2 space-y-1.5">
                                <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">
                                  Documents ({order.documents.length})
                                </p>
                                {order.documents.map((doc) => (
                                  <button
                                    key={`${doc.source}-${doc.id}`}
                                    onClick={() => handleViewDocument(doc)}
                                    className="w-full text-left flex items-center gap-2 bg-violet-50 hover:bg-violet-100 rounded-lg px-3 py-2 transition-colors active:bg-violet-200"
                                  >
                                    {getFileIcon(doc.fileType)}
                                    <div className="min-w-0 flex-1">
                                      <p className="text-xs font-medium text-gray-900 truncate">{doc.fileName}</p>
                                      <p className="text-[10px] text-gray-400">
                                        {formatFileSize(doc.fileSize)}
                                        {doc.uploadedBy && ` · ${doc.uploadedBy}`}
                                      </p>
                                    </div>
                                    <Eye className="h-3.5 w-3.5 text-violet-500 flex-shrink-0" />
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="p-6 text-center text-gray-400">
                        <Package className="h-6 w-6 mx-auto mb-1" />
                        <p className="text-xs">No orders assigned to this truckload</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      ) : (
        <div className="flex flex-col items-center py-16 text-gray-400">
          <FolderOpen className="h-10 w-10 mb-2" />
          <p className="text-sm font-medium">No truckloads found</p>
          <p className="text-xs">Your assigned loads will appear here</p>
        </div>
      )}

      {/* Document Viewer Dialog */}
      {viewingDocument && (
        <Dialog open={isDocViewOpen} onOpenChange={setIsDocViewOpen}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-base truncate">{viewingDocument.fileName}</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              {/* Document preview */}
              {viewingDocument.fileType?.startsWith('image/') ? (
                <div className="bg-gray-100 rounded-lg p-2 flex items-center justify-center">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={viewingDocument.filePath}
                    alt={viewingDocument.fileName}
                    className="max-w-full max-h-[60vh] object-contain rounded"
                  />
                </div>
              ) : viewingDocument.fileType === 'application/pdf' ? (
                <div className="bg-gray-100 rounded-lg overflow-hidden" style={{ height: '60vh' }}>
                  <iframe
                    src={viewingDocument.filePath}
                    className="w-full h-full"
                    title={viewingDocument.fileName}
                  />
                </div>
              ) : (
                <div className="bg-gray-50 rounded-lg p-8 text-center">
                  <FileText className="h-12 w-12 text-gray-300 mx-auto mb-2" />
                  <p className="text-sm text-gray-500">Preview not available for this file type</p>
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-2">
                <a
                  href={viewingDocument.filePath}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1"
                >
                  <Button variant="outline" className="w-full gap-2">
                    <Eye className="h-4 w-4" />
                    Open Full Size
                  </Button>
                </a>
                <a
                  href={viewingDocument.filePath}
                  download={viewingDocument.fileName}
                  className="flex-1"
                >
                  <Button className="w-full gap-2">
                    <Download className="h-4 w-4" />
                    Download
                  </Button>
                </a>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}
