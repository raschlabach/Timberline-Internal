'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { formatPhoneNumber } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'
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
  Phone,
  ArrowUp,
  ArrowDown,
  Zap,
  AlertCircle,
  MessageSquare,
  Navigation,
  ExternalLink,
  StickyNote,
  Send,
  Copy,
} from 'lucide-react'

interface CustomerInfo {
  id: number
  name: string
  address: string
  phone: string | null
  phone2: string | null
  notes: string | null
}

interface FreightItem {
  id: number | string
  type?: string
  width: number
  length: number
  footage: number
  quantity: number
  description?: string
}

interface TruckloadOrder {
  id: number
  assignmentType: string
  sequenceNumber: number
  pickupCustomer: CustomerInfo
  deliveryCustomer: CustomerInfo
  footage: number
  skids: number
  vinyl: number
  handBundles: number
  skidsData: FreightItem[]
  vinylData: FreightItem[]
  handBundlesData: Array<{ id: string; quantity: number; description: string }>
  comments: string | null
  isRush: boolean
  needsAttention: boolean
  isTransferOrder: boolean
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

  // Customer note state
  const [noteCustomerId, setNoteCustomerId] = useState<number | null>(null)
  const [noteCustomerName, setNoteCustomerName] = useState('')
  const [isNoteDialogOpen, setIsNoteDialogOpen] = useState(false)
  const [newNote, setNewNote] = useState('')
  const [isSavingNote, setIsSavingNote] = useState(false)

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

  function openNoteDialog(customerId: number, customerName: string) {
    setNoteCustomerId(customerId)
    setNoteCustomerName(customerName)
    setNewNote('')
    setIsNoteDialogOpen(true)
  }

  async function handleSaveNote() {
    if (!newNote.trim() || !noteCustomerId) return
    setIsSavingNote(true)
    try {
      const response = await fetch('/api/driver/customer-notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customerId: noteCustomerId, note: newNote.trim() }),
      })
      if (response.ok) {
        setIsNoteDialogOpen(false)
        setNewNote('')
      }
    } catch (error) {
      console.error('Error saving note:', error)
    } finally {
      setIsSavingNote(false)
    }
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

  // Build freight breakdown string like "4 - 4x4, 2 - 4x8"
  function getFreightBreakdown(order: TruckloadOrder): string[] {
    const lines: string[] = []
    if (order.skidsData && order.skidsData.length > 0) {
      // Group skids by dimension
      const grouped = new Map<string, number>()
      for (const skid of order.skidsData) {
        const key = `${skid.width}x${skid.length}`
        grouped.set(key, (grouped.get(key) || 0) + (skid.quantity || 1))
      }
      grouped.forEach((qty, dim) => {
        lines.push(`${qty} - ${dim} skid${qty !== 1 ? 's' : ''}`)
      })
    }
    if (order.vinylData && order.vinylData.length > 0) {
      const grouped = new Map<string, number>()
      for (const v of order.vinylData) {
        const key = `${v.width}x${v.length}`
        grouped.set(key, (grouped.get(key) || 0) + (v.quantity || 1))
      }
      grouped.forEach((qty, dim) => {
        lines.push(`${qty} - ${dim} vinyl`)
      })
    }
    if (order.handBundlesData && order.handBundlesData.length > 0) {
      for (const hb of order.handBundlesData) {
        lines.push(`${hb.quantity} - ${hb.description || 'Hand Bundle'}`)
      }
    }
    return lines
  }

  function getMapLink(address: string): string {
    return `https://maps.google.com/?q=${encodeURIComponent(address.trim())}`
  }

  function getAppleMapsLink(address: string): string {
    return `https://maps.apple.com/?q=${encodeURIComponent(address.trim())}`
  }

  function copyToClipboard(text: string) {
    navigator.clipboard.writeText(text)
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

                {/* Expanded content - Stops styled like trucking page */}
                {isExpanded && (
                  <div className="border-t border-gray-100">
                    {truckload.orders.length > 0 ? (
                      <div className="p-2 md:p-3 space-y-2">
                        {truckload.orders.map((order) => {
                          const isPickup = order.assignmentType === 'pickup'
                          // For pickups: primary customer is pickup (From), secondary is delivery (Dest)
                          // For deliveries: primary customer is delivery (To), secondary is pickup (Origin)
                          const primaryCustomer = isPickup ? order.pickupCustomer : order.deliveryCustomer
                          const secondaryCustomer = isPickup ? order.deliveryCustomer : order.pickupCustomer
                          const primaryLabel = isPickup ? 'From:' : 'To:'
                          const secondaryLabel = isPickup ? 'Dest:' : 'Origin:'
                          const freightBreakdown = getFreightBreakdown(order)

                          return (
                            <div
                              key={`${order.id}-${order.assignmentType}`}
                              className="relative bg-white rounded-lg border border-gray-200 overflow-hidden"
                            >
                              {/* Color bar - red for pickup, black for delivery */}
                              <div
                                className="absolute top-0 left-0 h-full w-1.5"
                                style={{ backgroundColor: isPickup ? '#ef4444' : '#000000' }}
                              />

                              <div className="pl-3.5 pr-3 py-2.5 space-y-2">
                                {/* Top row: sequence, badge, flags */}
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className={`font-medium text-xs ${isPickup ? 'text-red-600' : 'text-gray-700'}`}>
                                    #{order.sequenceNumber}
                                  </span>
                                  {order.isTransferOrder ? (
                                    <Badge variant="outline" className="text-[10px] h-4 px-1 bg-blue-50 text-blue-800 border-blue-200">
                                      Transfer
                                    </Badge>
                                  ) : (
                                    <Badge
                                      variant={isPickup ? 'destructive' : 'default'}
                                      className={`text-[10px] h-4 px-1 ${
                                        !isPickup ? 'bg-black text-white hover:bg-black/90' : ''
                                      }`}
                                    >
                                      {isPickup ? (
                                        <><ArrowUp className="h-2.5 w-2.5 mr-0.5" />Pickup</>
                                      ) : (
                                        <><ArrowDown className="h-2.5 w-2.5 mr-0.5" />Delivery</>
                                      )}
                                    </Badge>
                                  )}
                                  {order.isRush && (
                                    <span className="flex items-center gap-0.5 text-[10px] text-yellow-600 font-medium">
                                      <Zap className="h-3 w-3" />Rush
                                    </span>
                                  )}
                                  {order.needsAttention && (
                                    <span className="flex items-center gap-0.5 text-[10px] text-red-500 font-medium">
                                      <AlertCircle className="h-3 w-3" />Attention
                                    </span>
                                  )}
                                  {order.comments && (
                                    <span className="flex items-center gap-0.5 text-[10px] text-blue-500 font-medium">
                                      <MessageSquare className="h-3 w-3" />Note
                                    </span>
                                  )}
                                </div>

                                {/* Primary customer (the stop location) */}
                                <div className={`${isPickup ? 'text-red-600' : 'text-gray-900'}`}>
                                  <div className={`text-[10px] ${isPickup ? 'text-red-500' : 'text-gray-500'}`}>{primaryLabel}</div>
                                  <div className="font-bold text-sm leading-tight">{primaryCustomer.name}</div>
                                  <div className={`text-xs leading-tight ${isPickup ? 'text-red-500' : 'text-gray-600'}`}>
                                    {primaryCustomer.address}
                                  </div>
                                  {/* Phone numbers */}
                                  {primaryCustomer.phone && (
                                    <div className="flex items-center gap-1.5 mt-1">
                                      <a href={`tel:${primaryCustomer.phone}`} className="flex items-center gap-1">
                                        <Phone className="h-3 w-3 text-gray-400" />
                                        <span className="text-xs text-gray-600">{formatPhoneNumber(primaryCustomer.phone)}</span>
                                      </a>
                                      <button onClick={() => copyToClipboard(primaryCustomer.phone || '')} className="p-0.5">
                                        <Copy className="h-2.5 w-2.5 text-gray-300" />
                                      </button>
                                    </div>
                                  )}
                                  {primaryCustomer.phone2 && (
                                    <div className="flex items-center gap-1.5">
                                      <a href={`tel:${primaryCustomer.phone2}`} className="flex items-center gap-1">
                                        <Phone className="h-3 w-3 text-gray-400" />
                                        <span className="text-xs text-gray-600">{formatPhoneNumber(primaryCustomer.phone2)}</span>
                                      </a>
                                    </div>
                                  )}
                                  {/* Customer notes */}
                                  {primaryCustomer.notes && (
                                    <div className="mt-1.5 bg-amber-50 border border-amber-200 rounded px-2 py-1">
                                      <p className="text-[11px] text-amber-800 whitespace-pre-line">{primaryCustomer.notes}</p>
                                    </div>
                                  )}
                                  {/* Map + Add Note buttons */}
                                  <div className="flex gap-1.5 mt-1.5">
                                    <a href={getMapLink(primaryCustomer.address)} target="_blank" rel="noopener noreferrer">
                                      <Button variant="outline" size="sm" className="h-7 text-[10px] gap-1 px-2">
                                        <Navigation className="h-3 w-3" />Maps
                                      </Button>
                                    </a>
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      className="h-7 text-[10px] gap-1 px-2"
                                      onClick={() => openNoteDialog(primaryCustomer.id, primaryCustomer.name)}
                                    >
                                      <StickyNote className="h-3 w-3" />Add Note
                                    </Button>
                                  </div>
                                </div>

                                {/* Secondary customer (origin/destination) */}
                                <div className={`${isPickup ? 'text-red-500' : 'text-gray-600'}`}>
                                  <div className={`text-[10px] ${isPickup ? 'text-red-400' : 'text-gray-400'}`}>{secondaryLabel}</div>
                                  <div className={`font-medium text-xs leading-tight ${isPickup ? 'text-red-600' : 'text-gray-700'}`}>
                                    {secondaryCustomer.name}
                                  </div>
                                  <div className="text-xs leading-tight opacity-75">{secondaryCustomer.address}</div>
                                  {secondaryCustomer.phone && (
                                    <div className="flex items-center gap-1.5 mt-0.5">
                                      <a href={`tel:${secondaryCustomer.phone}`} className="flex items-center gap-1">
                                        <Phone className="h-3 w-3 text-gray-400" />
                                        <span className="text-xs text-gray-500">{formatPhoneNumber(secondaryCustomer.phone)}</span>
                                      </a>
                                    </div>
                                  )}
                                  {secondaryCustomer.notes && (
                                    <div className="mt-1 bg-amber-50 border border-amber-200 rounded px-2 py-1">
                                      <p className="text-[11px] text-amber-800 whitespace-pre-line">{secondaryCustomer.notes}</p>
                                    </div>
                                  )}
                                  <div className="flex gap-1.5 mt-1">
                                    <a href={getMapLink(secondaryCustomer.address)} target="_blank" rel="noopener noreferrer">
                                      <Button variant="outline" size="sm" className="h-7 text-[10px] gap-1 px-2">
                                        <Navigation className="h-3 w-3" />Maps
                                      </Button>
                                    </a>
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      className="h-7 text-[10px] gap-1 px-2"
                                      onClick={() => openNoteDialog(secondaryCustomer.id, secondaryCustomer.name)}
                                    >
                                      <StickyNote className="h-3 w-3" />Add Note
                                    </Button>
                                  </div>
                                </div>

                                {/* Freight breakdown */}
                                {(order.footage > 0 || freightBreakdown.length > 0) && (
                                  <div className={`border-t pt-2 ${isPickup ? 'border-red-100' : 'border-gray-100'}`}>
                                    <div className={`text-[10px] font-semibold uppercase tracking-wider mb-1 ${isPickup ? 'text-red-400' : 'text-gray-400'}`}>
                                      Freight
                                    </div>
                                    {order.footage > 0 && (
                                      <div className={`text-xs font-bold ${isPickup ? 'text-red-600' : 'text-gray-900'}`}>
                                        {Math.round(order.footage).toLocaleString()} sq ft total
                                      </div>
                                    )}
                                    {freightBreakdown.length > 0 && (
                                      <div className="mt-0.5 space-y-0.5">
                                        {freightBreakdown.map((line, i) => (
                                          <div key={i} className={`text-xs ${isPickup ? 'text-red-500' : 'text-gray-600'}`}>
                                            {line}
                                          </div>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                )}

                                {/* Order comments */}
                                {order.comments && (
                                  <div className="bg-blue-50 border border-blue-200 rounded px-2 py-1.5">
                                    <div className="flex items-center gap-1 mb-0.5">
                                      <MessageSquare className="h-3 w-3 text-blue-500" />
                                      <span className="text-[10px] font-semibold text-blue-600 uppercase">Order Comments</span>
                                    </div>
                                    <p className="text-xs text-blue-800">{order.comments}</p>
                                  </div>
                                )}

                                {/* Documents */}
                                {order.documents.length > 0 && (
                                  <div className="border-t border-gray-100 pt-2">
                                    <div className="text-[10px] font-semibold text-violet-500 uppercase tracking-wider mb-1">
                                      Documents ({order.documents.length})
                                    </div>
                                    <div className="space-y-1">
                                      {order.documents.map((doc) => (
                                        <button
                                          key={`${doc.source}-${doc.id}`}
                                          onClick={() => handleViewDocument(doc)}
                                          className="w-full text-left flex items-center gap-2 bg-violet-50 hover:bg-violet-100 rounded-lg px-2.5 py-1.5 transition-colors active:bg-violet-200"
                                        >
                                          {getFileIcon(doc.fileType)}
                                          <div className="min-w-0 flex-1">
                                            <p className="text-xs font-medium text-gray-900 truncate">{doc.fileName}</p>
                                            <p className="text-[10px] text-gray-400">{formatFileSize(doc.fileSize)}</p>
                                          </div>
                                          <Eye className="h-3.5 w-3.5 text-violet-500 flex-shrink-0" />
                                        </button>
                                      ))}
                                    </div>
                                  </div>
                                )}
                              </div>
                            </div>
                          )
                        })}
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

      {/* Add Note Dialog */}
      <Dialog open={isNoteDialogOpen} onOpenChange={setIsNoteDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-base">Add Note - {noteCustomerName}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Textarea
              placeholder="Type your note here..."
              value={newNote}
              onChange={(e) => setNewNote(e.target.value)}
              className="min-h-[80px] text-sm resize-none"
            />
            <Button
              onClick={handleSaveNote}
              disabled={!newNote.trim() || isSavingNote}
              className="w-full gap-1.5"
            >
              {isSavingNote ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
              Save Note
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Document Viewer Dialog */}
      {viewingDocument && (
        <Dialog open={isDocViewOpen} onOpenChange={setIsDocViewOpen}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-base truncate">{viewingDocument.fileName}</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
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
              <div className="flex gap-2">
                <a href={viewingDocument.filePath} target="_blank" rel="noopener noreferrer" className="flex-1">
                  <Button variant="outline" className="w-full gap-2">
                    <Eye className="h-4 w-4" />Open Full Size
                  </Button>
                </a>
                <a href={viewingDocument.filePath} download={viewingDocument.fileName} className="flex-1">
                  <Button className="w-full gap-2">
                    <Download className="h-4 w-4" />Download
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
