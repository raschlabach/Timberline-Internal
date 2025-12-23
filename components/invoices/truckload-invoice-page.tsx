'use client'

import React, { useEffect, useMemo, useState, useCallback, useRef } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { Card } from '@/components/ui/card'
import { Printer, Edit3, Search, MessageSquare, ChevronDown, ChevronRight, Check, CheckCircle, Timer, Plus, Trash2, Gift, AlertTriangle, DollarSign, ArrowLeft, GripVertical, Info, FileText, Minus, Settings, Split } from 'lucide-react'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import EditTruckloadDialog from '@/components/invoices/edit-truckload-dialog'
import { OrderInfoDialog } from '@/components/orders/order-info-dialog'
import { BillOfLadingDialog } from '@/app/components/BillOfLadingDialog'
import { toast } from 'sonner'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

interface TruckloadInvoicePageProps {}

interface DriverGroup {
  driverId: string
  driverName: string
  driverColor: string | null
}

interface TruckloadListItem {
  id: string
  startDate: string
  endDate: string | null
  driver: DriverGroup
  displayLabel: string
  description: string | null
  billOfLadingNumber: string | null
  isCompleted: boolean
  allQuotesFilled?: boolean
}

interface TruckloadsApiResponse {
  success: boolean
  truckloads: Array<{
    id: string
    driverId: string | null
    driverName: string | null
    driverColor: string | null
    startDate: string
    endDate: string | null
    billOfLadingNumber: string | null
    description: string | null
    isCompleted: boolean
    allQuotesFilled?: boolean
  }>
}

interface TruckloadOrdersApiResponse {
  success: boolean
  orders: Array<{
    id: string
    assignment_type: 'pickup' | 'delivery'
    sequence_number: number
    pickup_customer: { id: string | null; name: string | null; address: string | null; phone_number_1: string | null; phone_number_2: string | null; notes: string | null }
    delivery_customer: { id: string | null; name: string | null; address: string | null; phone_number_1: string | null; phone_number_2: string | null; notes: string | null }
    freight_quote: string | null
    footage: number | null
    skids: number
    vinyl: number
    skids_data: Array<{ width: number; length: number; quantity: number }>
    vinyl_data: Array<{ width: number; length: number; quantity: number }>
    comments: string | null
    is_rush: boolean
    needs_attention: boolean
    is_transfer_order: boolean
    pickup_driver_name: string | null
    pickup_assignment_date: string | null
    delivery_driver_name: string | null
    delivery_assignment_date: string | null
  }>
}

interface AssignedOrderRow {
  orderId: string
  assignmentType: 'pickup' | 'delivery'
  sequenceNumber: number
  sequenceNumbers?: string // For transfer orders to show both sequence numbers
  pickupName: string
  deliveryName: string
  pickupAddress: string | null
  deliveryAddress: string | null
  pickupPhone1: string | null
  pickupPhone2: string | null
  pickupNotes: string | null
  deliveryPhone1: string | null
  deliveryPhone2: string | null
  deliveryNotes: string | null
  payingCustomerName: string | null
  freightQuote: string | null
  splitQuote: number | null
  assignmentQuote: number | null
  middlefield: boolean
  backhaul: boolean
  ohioToIndiana: boolean
  footage: number
  skidsData: Array<{ width: number; length: number; quantity: number }>
  vinylData: Array<{ width: number; length: number; quantity: number }>
  comments: string | null
  isRush: boolean
  needsAttention: boolean
  pickupDriverName: string | null
  pickupAssignmentDate: string | null
  deliveryDriverName: string | null
  deliveryAssignmentDate: string | null
  isTransferOrder: boolean
}

interface CrossDriverDeduction {
  id: string
  orderId: string | null
  driverName: string
  date: string
  action: 'Picked up' | 'Delivered'
  customerName: string
  amount: number
  appliesTo: 'load_value' | 'driver_pay'
  comment?: string
  isAddition?: boolean
}

// Legacy interface - keeping for now during migration
interface CrossDriverFreightItem {
  id: string
  driverName: string
  date: string
  action: 'Picked up' | 'Delivered'
  footage: number
  dimensions: string
  deduction: number
  isManual: boolean // Track if this is a manually added item
  comment?: string // For manual items
  isAddition?: boolean // Track if this is an addition (true) or deduction (false). Only applies to manual items.
  appliesTo?: 'load_value' | 'driver_pay' // For manual items: whether it applies to load value or driver pay. Defaults to 'driver_pay'
  customerName?: string // Customer name for pickup/delivery (for automatic items)
  orderId?: string // Order ID to differentiate between separate orders with same attributes
}

// Customer info tooltip component
function CustomerInfoTooltip({ 
  name, 
  address, 
  phone1, 
  phone2, 
  notes, 
  children 
}: { 
  name: string
  address: string | null
  phone1: string | null
  phone2: string | null
  notes: string | null
  children: React.ReactNode
}) {
  const formatPhone = (phone: string | null): string => {
    if (!phone) return ''
    // Remove all non-digits
    const cleaned = phone.replace(/\D/g, '')
    // Format as (XXX) XXX-XXXX
    if (cleaned.length === 10) {
      return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`
    }
    return phone
  }

  const hasInfo = address || phone1 || phone2 || notes

  if (!hasInfo) {
    return <>{children}</>
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          {children}
        </TooltipTrigger>
        <TooltipContent className="max-w-xs p-3 bg-white border shadow-lg">
          <div className="space-y-2 text-sm">
            {address && (
              <div>
                <div className="font-semibold text-gray-700 mb-1">Address:</div>
                <div className="text-gray-600">{address}</div>
              </div>
            )}
            {(phone1 || phone2) && (
              <div>
                <div className="font-semibold text-gray-700 mb-1">Phone:</div>
                <div className="text-gray-600 space-y-1">
                  {phone1 && <div>{formatPhone(phone1)}</div>}
                  {phone2 && <div>{formatPhone(phone2)}</div>}
                </div>
              </div>
            )}
            {notes && (
              <div>
                <div className="font-semibold text-gray-700 mb-1">Notes:</div>
                <div className="text-gray-600 whitespace-pre-wrap">{notes}</div>
              </div>
            )}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

// Sortable row component for drag-and-drop
function SortableTableRow({
  id,
  row,
  isTransfer,
  selectedTruckload,
  dimensionGroups,
  allDimensions,
  freeItems,
  debouncedUpdateQuote,
  updatingQuotes,
  formatDateShort,
  onInfoClick,
  onAddDeduction,
  selectedTruckloadId,
  onOpenSplitLoadDialog,
  onSaveCrossDriverDeduction,
  crossDriverDeductionInputs,
  setCrossDriverDeductionInput,
  crossDriverDeductionToggles,
  setCrossDriverDeductionToggle,
  crossDriverDeductions,
  onDeleteCrossDriverDeduction,
  onOpenStopDeductionDialog,
}: {
  id: string
  row: AssignedOrderRow & { isCombined?: boolean; sequenceNumbers?: string }
  isTransfer: boolean
  selectedTruckload: TruckloadListItem | null
  dimensionGroups: { [key: string]: number }
  allDimensions: string
  freeItems: number
  debouncedUpdateQuote: (orderId: string, value: string) => void
  updatingQuotes: Set<string>
  formatDateShort: (date: string | null) => string
  onInfoClick: () => void
  onAddDeduction: (orderId: string) => void
  selectedTruckloadId: string | null
  onOpenSplitLoadDialog: (orderId: string) => Promise<void>
  onSaveCrossDriverDeduction: (orderId: string, action: 'Picked up' | 'Delivered', driverName: string, date: string, customerName: string) => Promise<void>
  crossDriverDeductionInputs: Map<string, string>
  setCrossDriverDeductionInput: (key: string, value: string) => void
  crossDriverDeductionToggles: Map<string, 'load_value' | 'driver_pay'>
  setCrossDriverDeductionToggle: (key: string, value: 'load_value' | 'driver_pay') => void
  crossDriverDeductions: CrossDriverDeduction[]
  onDeleteCrossDriverDeduction: (deductionId: string) => Promise<void>
  onOpenStopDeductionDialog: (orderId: string) => void
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  return (
    <TableRow
      ref={setNodeRef}
      style={style}
      className={`${isTransfer ? 'bg-blue-50' : (row.assignmentType === 'pickup' ? 'bg-red-50' : 'bg-gray-50')} hover:bg-gray-300 transition-colors cursor-pointer hover:shadow-sm`}
    >
      <TableCell className="text-sm text-center">
        <div className="flex items-center gap-2">
          <div
            {...attributes}
            {...listeners}
            className="cursor-grab active:cursor-grabbing text-gray-400 hover:text-gray-600"
          >
            <GripVertical className="h-4 w-4" />
          </div>
          {isTransfer && (row as any).sequenceNumbers ? (row as any).sequenceNumbers : row.sequenceNumber}
          {row.middlefield && row.backhaul && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <AlertTriangle 
                    className="h-4 w-4 text-amber-500 flex-shrink-0 cursor-help" 
                  />
                </TooltipTrigger>
                <TooltipContent>
                  <p>Middlefield & Backhaul Order</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </div>
      </TableCell>
      <TableCell className="text-sm">
        <CustomerInfoTooltip
          name={row.pickupName}
          address={row.pickupAddress}
          phone1={row.pickupPhone1}
          phone2={row.pickupPhone2}
          notes={row.pickupNotes}
        >
          {isTransfer ? (
            <span className="font-bold cursor-help">{row.pickupName}</span>
          ) : (
            row.assignmentType === 'pickup' ? <span className="font-bold cursor-help">{row.pickupName}</span> : <span className="cursor-help">{row.pickupName}</span>
          )}
        </CustomerInfoTooltip>
      </TableCell>
      <TableCell className="text-sm">
        <CustomerInfoTooltip
          name={row.deliveryName}
          address={row.deliveryAddress}
          phone1={row.deliveryPhone1}
          phone2={row.deliveryPhone2}
          notes={row.deliveryNotes}
        >
          {isTransfer ? (
            <span className="font-bold cursor-help">{row.deliveryName}</span>
          ) : (
            row.assignmentType === 'delivery' ? <span className="font-bold cursor-help">{row.deliveryName}</span> : <span className="cursor-help">{row.deliveryName}</span>
          )}
        </CustomerInfoTooltip>
      </TableCell>
      <TableCell className="text-sm">
        {row.payingCustomerName ? (
          <CustomerInfoTooltip
            name={row.payingCustomerName}
            address={null}
            phone1={null}
            phone2={null}
            notes={null}
          >
            <span className="cursor-help">{row.payingCustomerName}</span>
          </CustomerInfoTooltip>
        ) : (
          '—'
        )}
      </TableCell>
      <TableCell className="text-sm" style={{ width: '90px' }}>
        <div className="flex flex-col gap-0.5">
          <div className="flex items-center gap-1">
            <Input
              type="text"
              value={row.freightQuote || ''}
              onChange={(e) => {
                // For split load orders, we don't allow editing here
                // They must be set via the split loads dialog
                // Only check assignment_quote, ignore old split_quote
                const hasConfirmedSplitLoad = (row.assignmentQuote !== null && row.assignmentQuote !== undefined)
                if (hasConfirmedSplitLoad) {
                  return // Read-only for confirmed split load quotes
                }
                debouncedUpdateQuote(row.orderId, e.target.value)
              }}
              placeholder="—"
              className="h-7 text-xs px-1.5 py-0.5 border-gray-300 bg-transparent hover:bg-gray-50 focus:bg-white focus:border-blue-400 transition-colors w-full"
              disabled={updatingQuotes.has(row.orderId) || (row.assignmentQuote !== null && row.assignmentQuote !== undefined)}
            />
            {(() => {
              // Check if this order has an active split load (only use assignment_quote, ignore old split_quote)
              const hasActiveSplitLoad = (row.assignmentQuote !== null && row.assignmentQuote !== undefined)
              
              // Check if this order should be a split load (warning conditions)
              const shouldBeSplitLoad = 
                // Middlefield orders should be split loads
                (row.middlefield) ||
                // Orders with 424 footage that are NOT transfers
                (row.footage === 424 && !row.isTransferOrder) ||
                // Transfer orders (pickup and delivery in same truckload) should be split loads
                (row.isTransferOrder)
              
              // Only show warning if it should be split load but isn't already
              const showWarning = shouldBeSplitLoad && !hasActiveSplitLoad
              
              if (hasActiveSplitLoad) {
                return (
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <AlertTriangle 
                          className="h-4 w-4 text-amber-500 flex-shrink-0 cursor-help" 
                        />
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Split load - managed via split icon</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                )
              } else if (showWarning) {
                return (
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <AlertTriangle 
                          className="h-4 w-4 text-orange-600 flex-shrink-0 cursor-help" 
                        />
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>
                          {row.middlefield 
                            ? 'Middlefield order - should be a split load'
                            : row.isTransferOrder
                            ? 'Transfer order (pickup and delivery in same truckload) - should be a split load'
                            : '424 footage order - should be a split load'}
                        </p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                )
              }
              return null
            })()}
          </div>
          {/* Show deduction amount for confirmed split loads only */}
          {(() => {
            // Only show deduction if there's a confirmed split load (only use assignment_quote, ignore old split_quote)
            const hasConfirmedSplitLoad = (row.assignmentQuote !== null && row.assignmentQuote !== undefined)
            
            if (!hasConfirmedSplitLoad) {
              return null
            }
            
            const fullQuote = parseFloat(row.freightQuote || '0') || 0
            const assignmentQuote = row.assignmentQuote
            
            if (assignmentQuote === null) {
              return null
            }
            
            const deduction = fullQuote - assignmentQuote
            return deduction > 0 ? (
              <span className="text-[10px] text-red-600 font-medium leading-tight">
                -${deduction.toFixed(2)}
              </span>
            ) : null
          })()}
        </div>
      </TableCell>
      <TableCell className="text-sm text-right">{row.footage}</TableCell>
      <TableCell className="text-sm">
        <div className="flex items-center gap-1.5 flex-wrap">
          {allDimensions ? (
            <>
              {Object.entries(dimensionGroups).map(([dimension, quantity], idx) => (
                <span key={idx} className="inline-block bg-gray-100 border border-gray-300 px-1.5 py-0.5 rounded text-xs font-mono">
                  {quantity} {dimension}
                </span>
              ))}
              {freeItems > 0 && (
                <span className="inline-flex items-center gap-0.5 bg-green-100 text-green-700 px-1.5 py-0.5 rounded text-xs font-semibold animate-[pulse_2s_ease-in-out_infinite]">
                  <Gift className="h-3 w-3" />
                  {freeItems}
                </span>
              )}
            </>
          ) : (
            <span>—</span>
          )}
        </div>
      </TableCell>
      <TableCell className="text-sm text-center">
        <div className="flex items-center justify-center gap-1">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={async (e) => {
                    e.stopPropagation()
                    await onOpenSplitLoadDialog(row.orderId)
                  }}
                  className={`h-7 w-7 p-0 ${
                    (row.assignmentQuote !== null && row.assignmentQuote !== undefined)
                      ? 'text-blue-600 hover:text-blue-700 hover:bg-blue-50'
                      : 'text-gray-400 hover:text-gray-600 hover:bg-gray-50'
                  }`}
                  title="Manage split load"
                >
                  <Split className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>{(row.assignmentQuote !== null && row.assignmentQuote !== undefined) ? 'In split loads' : 'Add to split loads'}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
          {/* Old deduction button removed - deductions are now entered via table input fields */}
        </div>
      </TableCell>
      <TableCell className="text-sm">
        {isTransfer ? (
          <div className="text-xs text-blue-700 font-medium">Transfer</div>
        ) : row.assignmentType === 'delivery' && row.pickupDriverName && row.pickupAssignmentDate ? (
          <div className="text-xs flex items-center gap-1.5">
            <div className="w-4 h-4 flex items-center justify-center flex-shrink-0">
              {row.pickupDriverName !== selectedTruckload?.driver.driverName && (
                <AlertTriangle className="h-4 w-4 text-red-500 animate-[pulse_1s_ease-in-out_infinite]" />
              )}
            </div>
            <div>
              <div>{row.pickupDriverName}</div>
              <div className="text-gray-500">{formatDateShort(row.pickupAssignmentDate)}</div>
            </div>
          </div>
        ) : row.assignmentType === 'pickup' && row.deliveryDriverName && row.deliveryAssignmentDate ? (
          <div className="text-xs flex items-center gap-1.5">
            <div className="w-4 h-4 flex items-center justify-center flex-shrink-0">
              {row.deliveryDriverName !== selectedTruckload?.driver.driverName && (
                <AlertTriangle className="h-4 w-4 text-red-500 animate-[pulse_1s_ease-in-out_infinite]" />
              )}
            </div>
            <div>
              <div>{row.deliveryDriverName}</div>
              <div className="text-gray-500">{formatDateShort(row.deliveryAssignmentDate)}</div>
            </div>
          </div>
        ) : '—'}
      </TableCell>
      {/* Cross-Driver Deduction Input Column - Only show for cross-driver situations */}
      <TableCell className="text-sm">
        {(() => {
          // Check if this is a cross-driver situation
          const isCrossDriverPickup = row.assignmentType === 'delivery' && row.pickupDriverName && row.pickupDriverName !== selectedTruckload?.driver.driverName
          const isCrossDriverDelivery = row.assignmentType === 'pickup' && row.deliveryDriverName && row.deliveryDriverName !== selectedTruckload?.driver.driverName
          
          if (!isCrossDriverPickup && !isCrossDriverDelivery) {
            return '—'
          }
          
          const action: 'Picked up' | 'Delivered' = isCrossDriverPickup ? 'Picked up' : 'Delivered'
          const otherDriverName = isCrossDriverPickup ? row.pickupDriverName! : row.deliveryDriverName!
          const otherDate = isCrossDriverPickup ? row.pickupAssignmentDate! : row.deliveryAssignmentDate!
          const customerName = isCrossDriverPickup ? row.pickupName : row.deliveryName
          const deductionKey = `${row.orderId}-${action}`
          
          // Check if a deduction already exists for this order/action
          const existingDeduction = crossDriverDeductions.find(
            d => d.orderId === row.orderId && d.action === action
          )
          
          // If deduction exists, show it in disabled input with delete button
          if (existingDeduction) {
            return (
              <div className="flex items-center gap-1">
                <Input
                  type="number"
                  step="0.01"
                  value={existingDeduction.amount.toFixed(2)}
                  disabled
                  className="h-7 text-xs w-20 px-1.5 border-2 border-black bg-gray-50 cursor-not-allowed"
                  onClick={(e) => e.stopPropagation()}
                />
                <div className="flex items-center gap-1">
                  <Button
                    size="sm"
                    variant={existingDeduction.appliesTo === 'driver_pay' ? 'default' : 'outline'}
                    disabled
                    className="h-7 px-2 text-xs opacity-60"
                  >
                    Driver Pay
                  </Button>
                  <Button
                    size="sm"
                    variant={existingDeduction.appliesTo === 'load_value' ? 'default' : 'outline'}
                    disabled
                    className="h-7 px-2 text-xs opacity-60"
                  >
                    Load Value
                  </Button>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={async (e) => {
                    e.stopPropagation()
                    if (confirm('Are you sure you want to delete this deduction?')) {
                      await onDeleteCrossDriverDeduction(existingDeduction.id)
                    }
                  }}
                  className="h-7 w-7 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
                  title="Delete deduction"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            )
          }
          
          // If no deduction exists, show input/toggle/save buttons
          const inputValue = crossDriverDeductionInputs.get(deductionKey) || ''
          const toggleValue = crossDriverDeductionToggles.get(deductionKey) || 'driver_pay'
          
          return (
            <div className="flex items-center gap-1">
              <Input
                type="number"
                step="0.01"
                placeholder="$0.00"
                value={inputValue}
                onChange={(e) => setCrossDriverDeductionInput(deductionKey, e.target.value)}
                className="h-7 text-xs w-20 px-1.5"
                onClick={(e) => e.stopPropagation()}
              />
              <div className="flex items-center gap-1">
                <Button
                  size="sm"
                  variant={toggleValue === 'driver_pay' ? 'default' : 'outline'}
                  onClick={(e) => {
                    e.stopPropagation()
                    setCrossDriverDeductionToggle(deductionKey, 'driver_pay')
                  }}
                  className="h-7 px-2 text-xs"
                >
                  Driver Pay
                </Button>
                <Button
                  size="sm"
                  variant={toggleValue === 'load_value' ? 'default' : 'outline'}
                  onClick={(e) => {
                    e.stopPropagation()
                    setCrossDriverDeductionToggle(deductionKey, 'load_value')
                  }}
                  className="h-7 px-2 text-xs"
                >
                  Load Value
                </Button>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={async (e) => {
                  e.stopPropagation()
                  const amount = parseFloat(inputValue)
                  if (isNaN(amount) || amount <= 0) {
                    toast.error('Please enter a valid deduction amount')
                    return
                  }
                  await onSaveCrossDriverDeduction(row.orderId, action, otherDriverName, otherDate, customerName)
                }}
                className="h-7 px-2 text-xs"
                disabled={!inputValue || parseFloat(inputValue) <= 0}
              >
                Save
              </Button>
            </div>
          )
        })()}
      </TableCell>
      <TableCell>
        <div className="flex items-center gap-1">
          <Button
            size="sm"
            variant="outline"
            onClick={(e) => {
              e.stopPropagation()
              onOpenStopDeductionDialog(row.orderId)
            }}
            className="p-1 h-7 w-7"
            title="Add deduction/addition for this stop"
          >
            <Minus className="h-3 w-3" />
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              if (row.comments) {
                alert(row.comments)
              }
            }}
            className={row.comments ? "p-1 h-7 w-7 border-yellow-500 bg-yellow-50 hover:bg-yellow-100" : "p-1 h-7 w-7 invisible"}
            disabled={!row.comments}
          >
            <MessageSquare className="h-3 w-3 text-yellow-700" />
          </Button>
          <BillOfLadingDialog
            order={{
              id: row.orderId,
              shipper: {
                name: row.pickupName,
                address: row.pickupAddress || '',
                phone: '',
                phone2: ''
              },
              consignee: {
                name: row.deliveryName,
                address: row.deliveryAddress || '',
                phone: '',
                phone2: ''
              },
              items: [
                ...(row.skidsData?.map(skid => ({
                  packages: skid.quantity,
                  description: `Skid ${skid.width}x${skid.length}`,
                  weight: 0,
                  charges: 0
                })) || []),
                ...(row.vinylData?.map(vinyl => ({
                  packages: vinyl.quantity,
                  description: `Vinyl ${vinyl.width}x${vinyl.length}`,
                  weight: 0,
                  charges: 0
                })) || [])
              ]
            }}
          >
            <Button
              size="sm"
              variant="ghost"
              className="h-7 px-2 text-xs font-medium text-gray-600 hover:bg-gray-100 hover:text-gray-900"
            >
              BOL
            </Button>
          </BillOfLadingDialog>
          <Button
            size="sm"
            variant="outline"
            onClick={onInfoClick}
            className="h-7 px-2 text-xs"
          >
            Info
          </Button>
        </div>
      </TableCell>
    </TableRow>
  )
}

export default function TruckloadInvoicePage({}: TruckloadInvoicePageProps) {
  const searchParams = useSearchParams()
  const router = useRouter()
  
  // Read URL parameters
  const urlTruckloadId = searchParams?.get('truckloadId')
  const urlDriverId = searchParams?.get('driverId')
  const urlStartDate = searchParams?.get('startDate')
  const urlEndDate = searchParams?.get('endDate')
  const fromDriverPay = searchParams?.get('from') === 'driver-pay'
  
  const [searchValue, setSearchValue] = useState<string>('')
  const [selectedTruckloadId, setSelectedTruckloadId] = useState<string | null>(null)
  const [truckloads, setTruckloads] = useState<TruckloadListItem[]>([])
  const [isLoading, setIsLoading] = useState<boolean>(false)
  const [hasError, setHasError] = useState<boolean>(false)
  const [errorMessage, setErrorMessage] = useState<string>('')
  const [orders, setOrders] = useState<AssignedOrderRow[]>([])
  const [isLoadingOrders, setIsLoadingOrders] = useState<boolean>(false)
  const [hasOrdersError, setHasOrdersError] = useState<boolean>(false)
  const [ordersErrorMessage, setOrdersErrorMessage] = useState<string>('')
  const [isEditDialogOpen, setIsEditDialogOpen] = useState<boolean>(false)
  const [isOrderInfoDialogOpen, setIsOrderInfoDialogOpen] = useState<boolean>(false)
  const [selectedOrderIdForInfo, setSelectedOrderIdForInfo] = useState<number | null>(null)
  const [selectedDriverId, setSelectedDriverId] = useState<string>('default')
  const [collapsedDrivers, setCollapsedDrivers] = useState<Set<string>>(new Set())
  const [editableCrossDriverFreight, setEditableCrossDriverFreight] = useState<CrossDriverFreightItem[]>([])
  const [crossDriverDeductions, setCrossDriverDeductions] = useState<CrossDriverDeduction[]>([])
  const [splitLoadDeductions, setSplitLoadDeductions] = useState<CrossDriverDeduction[]>([])
  const [manualDeductions, setManualDeductions] = useState<CrossDriverDeduction[]>([])
  const [crossDriverDeductionInputs, setCrossDriverDeductionInputsState] = useState<Map<string, string>>(new Map())
  const [crossDriverDeductionToggles, setCrossDriverDeductionTogglesState] = useState<Map<string, 'load_value' | 'driver_pay'>>(new Map())
  const [showCompleted, setShowCompleted] = useState<boolean>(true)
  
  // Helper functions for managing deduction inputs and toggles
  const setCrossDriverDeductionInput = useCallback((key: string, value: string) => {
    setCrossDriverDeductionInputsState(prev => {
      const newMap = new Map(prev)
      if (value) {
        newMap.set(key, value)
      } else {
        newMap.delete(key)
      }
      return newMap
    })
  }, [])
  
  const setCrossDriverDeductionToggle = useCallback((key: string, value: 'load_value' | 'driver_pay') => {
    setCrossDriverDeductionTogglesState(prev => {
      const newMap = new Map(prev)
      newMap.set(key, value)
      return newMap
    })
  }, [])
  const [deductByFootage, setDeductByFootage] = useState<boolean>(false)
  const [footageDeductionRate, setFootageDeductionRate] = useState<number>(0)
  const [updatingQuotes, setUpdatingQuotes] = useState<Set<string>>(new Set())
  const [driverLoadPercentage, setDriverLoadPercentage] = useState<number>(30.00) // Default 30%
  const [isReordering, setIsReordering] = useState<boolean>(false)
  const [deductionDialogOpen, setDeductionDialogOpen] = useState<boolean>(false)
  const [deductionDialogOrderId, setDeductionDialogOrderId] = useState<string | null>(null)
  const [deductionDialogComment, setDeductionDialogComment] = useState<string>('')
  const [deductionDialogAmount, setDeductionDialogAmount] = useState<string>('')
  const [deductionDialogAppliesTo, setDeductionDialogAppliesTo] = useState<'load_value' | 'driver_pay'>('driver_pay')
  // Per-row stop deduction/addition dialog
  const [stopDeductionDialogOpen, setStopDeductionDialogOpen] = useState<boolean>(false)
  const [stopDeductionDialogOrderId, setStopDeductionDialogOrderId] = useState<string | null>(null)
  const [stopDeductionDialogCommentType, setStopDeductionDialogCommentType] = useState<'pickup' | 'delivery' | 'manual'>('manual')
  const [stopDeductionDialogComment, setStopDeductionDialogComment] = useState<string>('')
  const [stopDeductionDialogAmount, setStopDeductionDialogAmount] = useState<string>('')
  const [stopDeductionDialogAppliesTo, setStopDeductionDialogAppliesTo] = useState<'load_value' | 'driver_pay'>('driver_pay')
  const [stopDeductionDialogIsAddition, setStopDeductionDialogIsAddition] = useState<boolean>(false)
  // Single-order split load dialog
  const [splitLoadDialogOpen, setSplitLoadDialogOpen] = useState(false)
  const [splitLoadOrderId, setSplitLoadOrderId] = useState<number | null>(null)
  const [splitLoadData, setSplitLoadData] = useState<{
    orderId: number
    fullQuote: number | null
    deliveryCustomerName: string | null
    pickupCustomerName: string | null
    pickupAssignment: { assignmentId: number; truckloadId: number; assignmentQuote: number | null; driverName: string | null } | null
    deliveryAssignment: { assignmentId: number; truckloadId: number; assignmentQuote: number | null; driverName: string | null } | null
    hasSplitLoad: boolean
    pendingSplit?: {
      miscValue: number
      fullQuoteAssignment: 'pickup' | 'delivery'
      fullQuoteAppliesTo: 'load_value' | 'driver_pay'
      miscAppliesTo: 'load_value' | 'driver_pay'
      existingAssignmentType: 'pickup' | 'delivery'
    } | null
  } | null>(null)
  const [splitLoadMiscValue, setSplitLoadMiscValue] = useState<string>('')
  const [splitLoadFullQuoteAssignment, setSplitLoadFullQuoteAssignment] = useState<'pickup' | 'delivery'>('delivery')
  const [splitLoadFullQuoteAppliesTo, setSplitLoadFullQuoteAppliesTo] = useState<'load_value' | 'driver_pay'>('driver_pay')
  const [splitLoadMiscAppliesTo, setSplitLoadMiscAppliesTo] = useState<'load_value' | 'driver_pay'>('driver_pay')
  const [isLoadingSplitLoad, setIsLoadingSplitLoad] = useState(false)
  const selectedTruckload = useMemo(() => truckloads.find(t => t.id === selectedTruckloadId) || null, [truckloads, selectedTruckloadId])
  const crossDriverFreightSaveTimeout = useRef<NodeJS.Timeout | null>(null)
  const editableCrossDriverFreightRef = useRef<CrossDriverFreightItem[]>([])
  const calculatedValuesSaveTimeout = useRef<NodeJS.Timeout | null>(null)
  const justGeneratedAutoDeductions = useRef<boolean>(false)
  const isReloadingAfterSave = useRef<boolean>(false)
  
  // Drag and drop sensors
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )
  
  // Keep ref in sync with state
  useEffect(() => {
    editableCrossDriverFreightRef.current = editableCrossDriverFreight
  }, [editableCrossDriverFreight])
  
  // Auto-select truckload from URL parameter when from driver pay
  // This effect should run whenever URL params change
  useEffect(() => {
    // Re-read params inside effect to ensure we get latest values
    const currentTruckloadId = searchParams?.get('truckloadId')
    const currentFromDriverPay = searchParams?.get('from') === 'driver-pay'
    
    if (currentFromDriverPay && currentTruckloadId && truckloads.length > 0) {
      // Find truckload by ID (handle both string and number comparisons)
      const matchingTruckload = truckloads.find(t => 
        String(t.id) === String(currentTruckloadId) || 
        Number(t.id) === Number(currentTruckloadId)
      )
      if (matchingTruckload) {
        const matchingId = String(matchingTruckload.id)
        // Always update if URL param differs from current selection
        if (selectedTruckloadId !== matchingId) {
          console.log('Setting truckload from URL:', currentTruckloadId, 'matched to:', matchingId)
          setSelectedTruckloadId(matchingId)
        }
      } else {
        console.log('No matching truckload found for ID:', currentTruckloadId, 'Available IDs:', truckloads.map(t => t.id))
      }
    }
  }, [searchParams, truckloads, selectedTruckloadId])

  // Fetch driver's load percentage when truckload is selected
  useEffect(() => {
    if (selectedTruckload?.driver.driverId) {
      const driverId = selectedTruckload.driver.driverId
      fetch(`/api/drivers/pay-settings/${driverId}`, {
        credentials: 'include'
      })
        .then(res => res.json())
        .then(data => {
          if (data.success && data.settings) {
            setDriverLoadPercentage(data.settings.loadPercentage || 30.00)
          } else {
            // If no settings found, use default
            setDriverLoadPercentage(30.00)
          }
        })
        .catch(err => {
          console.error('Error fetching driver pay settings:', err)
          // Keep default 30%
          setDriverLoadPercentage(30.00)
        })
    } else {
      // Reset to default if no truckload selected
      setDriverLoadPercentage(30.00)
    }
  }, [selectedTruckload?.driver.driverId])

  // Group orders by orderId to combine transfer orders
  const groupedOrders = useMemo(() => {
    const groups = new Map<string, AssignedOrderRow[]>()
    
    orders.forEach(order => {
      const existing = groups.get(order.orderId) || []
      existing.push(order)
      groups.set(order.orderId, existing)
    })
    
    // Convert to array of combined rows
    const combined: Array<AssignedOrderRow & { isCombined?: boolean }> = []
    const processedOrderIds = new Set<string>()
    
    groups.forEach((groupOrders, orderId) => {
      // Check if this is a transfer order (has both pickup and delivery in same truckload)
      const hasPickup = groupOrders.some(o => o.assignmentType === 'pickup')
      const hasDelivery = groupOrders.some(o => o.assignmentType === 'delivery')
      const isTransfer = hasPickup && hasDelivery
      
      if (isTransfer && !processedOrderIds.has(orderId)) {
        // Combine into single row - prefer delivery order for transfer orders
        const pickupOrder = groupOrders.find(o => o.assignmentType === 'pickup')
        const deliveryOrder = groupOrders.find(o => o.assignmentType === 'delivery')
        // For transfers, use delivery order (or pickup if delivery doesn't exist)
        const transferOrder = deliveryOrder || pickupOrder!
        
        // Get both sequence numbers for display
        const pickupSeq = pickupOrder?.sequenceNumber || 0
        const deliverySeq = deliveryOrder?.sequenceNumber || 0
        const sequenceNumbers = pickupSeq !== deliverySeq 
          ? `${Math.min(pickupSeq, deliverySeq)}, ${Math.max(pickupSeq, deliverySeq)}`
          : pickupSeq.toString()
        
        combined.push({
          ...transferOrder,
          assignmentType: 'delivery', // Use delivery as primary for transfer orders
          sequenceNumber: Math.min(...groupOrders.map(o => o.sequenceNumber)), // Use lowest for sorting
          sequenceNumbers: sequenceNumbers, // Store both for display
          isCombined: true
        })
        processedOrderIds.add(orderId)
      } else if (!isTransfer) {
        // Non-transfer orders, add each one
        groupOrders.forEach(order => {
          const uniqueKey = `${orderId}-${order.assignmentType}`
          if (!processedOrderIds.has(uniqueKey)) {
            combined.push(order)
            processedOrderIds.add(uniqueKey)
          }
        })
      }
    })
    
    return combined.sort((a, b) => a.sequenceNumber - b.sequenceNumber)
  }, [orders])

  // Calculate totals for payroll using groupedOrders to avoid double-counting transfers
  const totals = useMemo(() => {
    // Count based on grouped orders (transfers are already combined)
    const pickupCount = groupedOrders.filter(o => o.assignmentType === 'pickup' && !(o as any).isCombined).length
    const deliveryCount = groupedOrders.filter(o => o.assignmentType === 'delivery' && !(o as any).isCombined).length
    const transferCount = groupedOrders.filter(o => (o as any).isCombined).length
    
    // Calculate total quotes from grouped orders (each order counted once)
    // Exclude orders where assignment_quote is the misc value (the smaller portion)
    const totalQuotes = groupedOrders.reduce((sum, order) => {
      if (order.freightQuote) {
        // Parse quote string (could be "$123.45" or "123.45")
        const cleaned = order.freightQuote.replace(/[^0-9.-]/g, '')
        const fullQuote = parseFloat(cleaned)
        if (isNaN(fullQuote)) return sum
        
        // If assignment_quote exists, check if it's the misc value
        // The misc value is the smaller portion, so if assignment_quote is significantly
        // less than the full quote, it's likely the misc value and should be excluded
        if (order.assignmentQuote !== null && order.assignmentQuote !== undefined) {
          const assignmentQuote = typeof order.assignmentQuote === 'number' 
            ? order.assignmentQuote 
            : parseFloat(String(order.assignmentQuote)) || 0
          
          // If assignment_quote is less than 50% of full quote, it's likely the misc value
          // Also check if it's close to (fullQuote - assignmentQuote), which would indicate
          // this is the "full quote - misc" assignment, so we should include the full quote
          const otherPortion = fullQuote - assignmentQuote
          
          // If assignment_quote is the smaller value (misc), exclude it from load value
          // If assignment_quote is the larger value (full - misc), include full quote
          if (assignmentQuote < otherPortion) {
            // This is the misc assignment - exclude from load value
            return sum
          } else {
            // This is the "full quote - misc" assignment - include full quote in load value
            return sum + fullQuote
          }
        }
        
        // No split load - include the quote normally
        return sum + fullQuote
      }
      return sum
    }, 0)
    return { pickupCount, deliveryCount, transferCount, totalQuotes }
  }, [groupedOrders])

  // Helper function to format dates for date input (YYYY-MM-DD)
  function formatDateForInput(dateStr: string | null): string {
    if (!dateStr) return new Date().toISOString().split('T')[0]
    // Convert to YYYY-MM-DD format for date input
    const date = new Date(dateStr)
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  }

  function normalizeDateString(dateStr: string | null | undefined): string {
    if (!dateStr) return ''
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return dateStr
    try {
      return new Date(dateStr).toISOString().split('T')[0]
    } catch {
      return String(dateStr)
    }
  }

  function buildFreightKey(item: Partial<CrossDriverFreightItem> & {
    driverName?: string | null
    date?: string | null
    action?: string | null
    dimensions?: string | null
    footage?: number | null
    customerName?: string | null
    orderId?: string | number | null
  }): string {
    if (item.isManual && item.id) {
      return `manual:${item.id}`
    }
    const normalizedDate = normalizeDateString(item.date)
    const footageValue = typeof item.footage === 'number'
      ? item.footage
      : parseFloat(String(item.footage || 0)) || 0
    // Normalize orderId to string for consistent key generation (handles both string and number from DB)
    const normalizedOrderId = item.orderId ? String(item.orderId) : ''
    // Include orderId in the key to ensure each order gets its own deduction line
    // This prevents multiple orders with the same driver/date/dimensions/footage/customer from being collapsed
    return [
      'auto',
      item.driverName || '',
      normalizedDate,
      item.action || '',
      item.dimensions || '',
      footageValue.toFixed(2),
      item.customerName || '',
      normalizedOrderId // Include order ID to differentiate separate orders
    ].join('|')
  }

  function dedupeFreightItems(items: CrossDriverFreightItem[]): CrossDriverFreightItem[] {
    // Group items by their freight key
    const itemsByKey = new Map<string, CrossDriverFreightItem[]>()
    items.forEach(item => {
      const key = buildFreightKey(item)
      if (!itemsByKey.has(key)) {
        itemsByKey.set(key, [])
      }
      itemsByKey.get(key)!.push(item)
    })
    
    // For each key, keep only the item with the smallest database ID (the original)
    // Items from database have IDs like "db-123", items from auto-detection have IDs like "auto-timestamp-idx"
    const deduped: CrossDriverFreightItem[] = []
    itemsByKey.forEach((duplicateItems, key) => {
      if (duplicateItems.length === 1) {
        // No duplicates, keep it
        deduped.push(duplicateItems[0])
      } else {
        // Multiple items with same key - keep the one with the smallest database ID (original)
        // Database items have IDs like "db-123", auto items have IDs like "auto-..."
        // Extract numeric ID from database items for comparison
        const getDbId = (id: string): number => {
          if (id.startsWith('db-')) {
            const numId = parseInt(id.replace('db-', ''), 10)
            return isNaN(numId) ? Infinity : numId
          }
          // Auto-detected items get a high number so database items are preferred
          return Infinity
        }
        
        // Sort by database ID (smallest first) and keep the first one (original)
        duplicateItems.sort((a, b) => getDbId(a.id) - getDbId(b.id))
        deduped.push(duplicateItems[0])
        
        console.log(`[Dedupe] Found ${duplicateItems.length} duplicates for key "${key.substring(0, 50)}...", keeping original (ID: ${duplicateItems[0].id}), removing ${duplicateItems.length - 1} duplicate(s)`)
      }
    })
    
    return deduped
  }

  // Auto-detection logic removed - deductions are now manually entered via table inputs

  // Clear cross-driver freight immediately when truckload changes
  useEffect(() => {
    setEditableCrossDriverFreight([])
    setCrossDriverDeductions([])
    setSplitLoadDeductions([])
    setCrossDriverDeductionInputsState(new Map())
    setCrossDriverDeductionTogglesState(new Map())
  }, [selectedTruckloadId])

  // Load cross-driver deductions when truckload changes
  useEffect(() => {
    if (!selectedTruckloadId) {
      setCrossDriverDeductions([])
      setSplitLoadDeductions([])
      return
    }

    async function loadDeductions() {
      try {
        const res = await fetch(`/api/truckloads/${selectedTruckloadId}/cross-driver-deductions`, {
          method: 'GET',
          credentials: 'include'
        })
        
        if (!res.ok) {
          throw new Error('Failed to load cross-driver deductions')
        }
        
        const data = await res.json()
        if (data.success && data.deductions) {
          setCrossDriverDeductions(data.deductions)
        }
      } catch (error) {
        console.error('Error loading cross-driver deductions:', error)
      }
    }

    async function loadSplitLoadDeductions() {
      try {
        const res = await fetch(`/api/truckloads/${selectedTruckloadId}/split-load-deductions`, {
          method: 'GET',
          credentials: 'include'
        })
        
        if (!res.ok) {
          throw new Error('Failed to load split load deductions')
        }
        
        const data = await res.json()
        if (data.success && data.deductions) {
          setSplitLoadDeductions(data.deductions)
        }
      } catch (error) {
        console.error('Error loading split load deductions:', error)
      }
    }

    async function loadManualDeductions() {
      if (!selectedTruckloadId) return
      
      try {
        const res = await fetch(`/api/truckloads/${selectedTruckloadId}/manual-deductions`, {
          method: 'GET',
          credentials: 'include'
        })
        
        if (!res.ok) {
          throw new Error('Failed to load manual deductions')
        }
        
        const data = await res.json()
        if (data.success && data.deductions) {
          setManualDeductions(data.deductions)
        }
      } catch (error) {
        console.error('Error loading manual deductions:', error)
      }
    }

    loadDeductions()
    loadSplitLoadDeductions()
    loadManualDeductions()
  }, [selectedTruckloadId])

  // Old cross-driver freight loading removed - using new table-based deduction system

  // Calculate detailed breakdown of deductions, additions, and driver pay
  const payrollCalculations = useMemo(() => {
    const totalQuotes = totals.totalQuotes || 0
    
    // Pickup/delivery deductions from load value (from table input)
    const pickupDeliveryDeductionsFromLoadValue = crossDriverDeductions.reduce((sum, deduction) => {
      if (deduction.appliesTo === 'load_value') {
        return sum + deduction.amount
      }
      return sum
    }, 0)
    
    // Manual deductions/additions from load value (with comments)
    const manualDeductionsFromLoadValue = manualDeductions.reduce((sum, deduction) => {
      if (!deduction.isAddition && deduction.appliesTo === 'load_value') {
        return sum + deduction.amount
      }
      return sum
    }, 0)
    
    const manualAdditionsToLoadValue = manualDeductions.reduce((sum, deduction) => {
      if (deduction.isAddition && deduction.appliesTo === 'load_value') {
        return sum + deduction.amount
      }
      return sum
    }, 0)
    
    // Split load deductions/additions from load value
    const splitLoadDeductionsFromLoadValue = splitLoadDeductions.reduce((sum, deduction) => {
      if (!deduction.isAddition && deduction.appliesTo === 'load_value') {
        return sum + deduction.amount
      }
      return sum
    }, 0)
    
    const splitLoadAdditionsToLoadValue = splitLoadDeductions.reduce((sum, deduction) => {
      if (deduction.isAddition && deduction.appliesTo === 'load_value') {
        return sum + deduction.amount
      }
      return sum
    }, 0)
    
    // Automatic deductions removed - no longer used
    const automaticDeductions = 0
    
    // Pickup/delivery deductions from driver pay (from table input)
    const pickupDeliveryDeductionsFromDriverPay = crossDriverDeductions.reduce((sum, deduction) => {
      if (deduction.appliesTo === 'driver_pay') {
        return sum + deduction.amount
      }
      return sum
    }, 0)
    
    // Manual deductions/additions from driver pay (with comments)
    const manualDeductionsFromDriverPay = manualDeductions.reduce((sum, deduction) => {
      if (!deduction.isAddition && deduction.appliesTo === 'driver_pay') {
        return sum + deduction.amount
      }
      return sum
    }, 0)
    
    const manualAdditionsToDriverPay = manualDeductions.reduce((sum, deduction) => {
      if (deduction.isAddition && deduction.appliesTo === 'driver_pay') {
        return sum + deduction.amount
      }
      return sum
    }, 0)
    
    // Split load deductions/additions from driver pay
    const splitLoadDeductionsFromDriverPay = splitLoadDeductions.reduce((sum, deduction) => {
      if (!deduction.isAddition && deduction.appliesTo === 'driver_pay') {
        return sum + deduction.amount
      }
      return sum
    }, 0)
    
    const splitLoadAdditionsToDriverPay = splitLoadDeductions.reduce((sum, deduction) => {
      if (deduction.isAddition && deduction.appliesTo === 'driver_pay') {
        return sum + deduction.amount
      }
      return sum
    }, 0)
    
    // Calculate load value (quotes - pickup/delivery deductions from load value - manual deductions from load value - split load deductions from load value + manual additions to load value + split load additions to load value)
    const loadValue = totalQuotes - pickupDeliveryDeductionsFromLoadValue - manualDeductionsFromLoadValue - splitLoadDeductionsFromLoadValue + manualAdditionsToLoadValue + splitLoadAdditionsToLoadValue
    
    // Calculate base driver pay (load value × percentage)
    const baseDriverPay = loadValue * (driverLoadPercentage / 100)
    
    // Calculate final driver pay (base driver pay - automatic deductions - pickup/delivery deductions from driver pay - manual deductions from driver pay - split load deductions from driver pay + manual additions to driver pay + split load additions to driver pay)
    const finalDriverPay = baseDriverPay - automaticDeductions - pickupDeliveryDeductionsFromDriverPay - manualDeductionsFromDriverPay - splitLoadDeductionsFromDriverPay + manualAdditionsToDriverPay + splitLoadAdditionsToDriverPay
    
    return { 
      totalQuotes: Number(totalQuotes),
      pickupDeliveryDeductionsFromLoadValue: Number(pickupDeliveryDeductionsFromLoadValue),
      manualDeductionsFromLoadValue: Number(manualDeductionsFromLoadValue),
      splitLoadDeductionsFromLoadValue: Number(splitLoadDeductionsFromLoadValue),
      splitLoadAdditionsToLoadValue: Number(splitLoadAdditionsToLoadValue),
      manualAdditionsToLoadValue: Number(manualAdditionsToLoadValue),
      loadValue: Number(loadValue),
      baseDriverPay: Number(baseDriverPay),
      automaticDeductions: Number(automaticDeductions),
      pickupDeliveryDeductionsFromDriverPay: Number(pickupDeliveryDeductionsFromDriverPay),
      manualDeductionsFromDriverPay: Number(manualDeductionsFromDriverPay),
      splitLoadDeductionsFromDriverPay: Number(splitLoadDeductionsFromDriverPay),
      splitLoadAdditionsToDriverPay: Number(splitLoadAdditionsToDriverPay),
      manualAdditionsToDriverPay: Number(manualAdditionsToDriverPay),
      finalDriverPay: Number(finalDriverPay),
      driverLoadPercentage: Number(driverLoadPercentage)
    }
  }, [crossDriverDeductions, splitLoadDeductions, manualDeductions, totals.totalQuotes, driverLoadPercentage])

  // Save calculated values to database when they change
  const saveCalculatedValues = useCallback(async (loadValue: number, driverPay: number) => {
    if (!selectedTruckloadId) return

    try {
      console.log(`[Invoice] Saving calculated values for truckload ${selectedTruckloadId}: loadValue=${loadValue}, driverPay=${driverPay}`)
      const response = await fetch(`/api/truckloads/${selectedTruckloadId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          calculatedLoadValue: loadValue,
          calculatedDriverPay: driverPay
        })
      })

      if (!response.ok) {
        throw new Error('Failed to save calculated values')
      }
      const result = await response.json()
      console.log(`[Invoice] Successfully saved calculated values:`, result)
    } catch (error) {
      console.error('Error saving calculated values:', error)
      // Don't show error toast - this is a background save
    }
  }, [selectedTruckloadId])

  // Auto-save calculated values when payrollCalculations change (debounced)
  useEffect(() => {
    if (!selectedTruckloadId || !payrollCalculations) return

    // Clear existing timeout
    if (calculatedValuesSaveTimeout.current) {
      clearTimeout(calculatedValuesSaveTimeout.current)
    }

    // Debounce the save by 2 seconds
    calculatedValuesSaveTimeout.current = setTimeout(() => {
      saveCalculatedValues(payrollCalculations.loadValue, payrollCalculations.finalDriverPay)
    }, 2000)

    return () => {
      if (calculatedValuesSaveTimeout.current) {
        clearTimeout(calculatedValuesSaveTimeout.current)
      }
    }
  }, [payrollCalculations.loadValue, payrollCalculations.finalDriverPay, selectedTruckloadId, saveCalculatedValues])

  // Ref to store debounce timeouts
  const quoteUpdateTimeouts = useRef<{ [key: string]: NodeJS.Timeout }>({})

  // Function to update order quote with auto-save
  const updateOrderQuote = useCallback(async (orderId: string, newQuote: string): Promise<void> => {
    setUpdatingQuotes(prev => new Set(prev).add(orderId))
    try {
      const response = await fetch(`/api/orders/${orderId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          freightQuote: newQuote
        })
      })
      
      if (!response.ok) {
        throw new Error('Failed to update quote')
      }
      
      // Update local state
      setOrders(prev => prev.map(order => 
        order.orderId === orderId 
          ? { ...order, freightQuote: newQuote || null }
          : order
      ))
    } catch (error) {
      console.error('Error updating quote:', error)
      toast.error('Failed to update quote')
      // Revert the change on error - reload orders
      if (selectedTruckloadId) {
        const id = selectedTruckloadId
        setSelectedTruckloadId(null)
        setTimeout(() => setSelectedTruckloadId(id), 0)
      }
    } finally {
      setUpdatingQuotes(prev => {
        const next = new Set(prev)
        next.delete(orderId)
        return next
      })
    }
  }, [selectedTruckloadId])

  // Debounced quote update function
  const debouncedUpdateQuote = useCallback((orderId: string, newQuote: string) => {
    // Clear existing timeout for this order
    if (quoteUpdateTimeouts.current[orderId]) {
      clearTimeout(quoteUpdateTimeouts.current[orderId])
    }
    
    // Update local state immediately for responsive UI
    setOrders(prev => prev.map(order => 
      order.orderId === orderId 
        ? { ...order, freightQuote: newQuote || null }
        : order
    ))
    
    // Debounce the API call
    quoteUpdateTimeouts.current[orderId] = setTimeout(() => {
      updateOrderQuote(orderId, newQuote)
      delete quoteUpdateTimeouts.current[orderId]
    }, 1000) // Wait 1 second after user stops typing
  }, [updateOrderQuote])

  // Handle drag end for reordering stops
  const handleDragEnd = useCallback(async (event: DragEndEvent) => {
    const { active, over } = event
    
    if (!over || active.id === over.id || !selectedTruckloadId) {
      return
    }

    setIsReordering(true)

    try {
      const oldIndex = groupedOrders.findIndex(
        row => `${row.orderId}${(row as any).isCombined ? '-transfer' : `-${row.assignmentType}`}` === String(active.id)
      )
      const newIndex = groupedOrders.findIndex(
        row => `${row.orderId}${(row as any).isCombined ? '-transfer' : `-${row.assignmentType}`}` === String(over.id)
      )

      if (oldIndex === -1 || newIndex === -1) {
        return
      }

      // Reorder the grouped orders
      const reordered = arrayMove(groupedOrders, oldIndex, newIndex)

      // Build update array - need to handle transfer orders specially
      const updates: Array<{ id: string; assignment_type: 'pickup' | 'delivery'; sequence_number: number }> = []
      
      reordered.forEach((row, index) => {
        const newSequence = index + 1
        const isTransfer = (row as any).isCombined || false

        if (isTransfer) {
          // For transfer orders, update both pickup and delivery sequence numbers
          const pickupOrder = orders.find(o => o.orderId === row.orderId && o.assignmentType === 'pickup')
          const deliveryOrder = orders.find(o => o.orderId === row.orderId && o.assignmentType === 'delivery')
          
          if (pickupOrder) {
            updates.push({
              id: pickupOrder.orderId,
              assignment_type: 'pickup',
              sequence_number: newSequence
            })
          }
          if (deliveryOrder) {
            updates.push({
              id: deliveryOrder.orderId,
              assignment_type: 'delivery',
              sequence_number: newSequence
            })
          }
        } else {
          // For regular orders, update the single assignment
          updates.push({
            id: row.orderId,
            assignment_type: row.assignmentType,
            sequence_number: newSequence
          })
        }
      })

      // Call API to update sequence numbers
      const response = await fetch(`/api/truckloads/${selectedTruckloadId}/reorder`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          orders: updates
        })
      })

      if (!response.ok) {
        throw new Error('Failed to reorder stops')
      }

      const data = await response.json()
      if (!data.success) {
        throw new Error(data.error || 'Failed to reorder stops')
      }

      // Update local orders state with new sequence numbers
      setOrders(prev => prev.map(order => {
        const update = updates.find(u => u.id === order.orderId && u.assignment_type === order.assignmentType)
        if (update) {
          return { ...order, sequenceNumber: update.sequence_number }
        }
        return order
      }))

      toast.success('Order sequence updated')
    } catch (error) {
      console.error('Error reordering stops:', error)
      toast.error('Failed to reorder stops')
    } finally {
      setIsReordering(false)
    }
  }, [groupedOrders, orders, selectedTruckloadId])

  // Save cross-driver deduction from table row
  const handleSaveCrossDriverDeduction = useCallback(async (
    orderId: string,
    action: 'Picked up' | 'Delivered',
    driverName: string,
    date: string,
    customerName: string
  ) => {
    if (!selectedTruckloadId) return
    
    const deductionKey = `${orderId}-${action}`
    const amount = parseFloat(crossDriverDeductionInputs.get(deductionKey) || '0')
    const appliesTo = crossDriverDeductionToggles.get(deductionKey) || 'driver_pay'
    
    if (isNaN(amount) || amount <= 0) {
      toast.error('Please enter a valid deduction amount')
      return
    }
    
    try {
      const response = await fetch(`/api/truckloads/${selectedTruckloadId}/cross-driver-deductions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          orderId,
          driverName,
          date,
          action,
          customerName,
          amount,
          appliesTo
        })
      })
      
      const data = await response.json()
      if (data.success) {
        // Reload deductions from database instead of adding to state (prevents duplicates)
        const reloadRes = await fetch(`/api/truckloads/${selectedTruckloadId}/cross-driver-deductions`, {
          method: 'GET',
          credentials: 'include'
        })
        if (reloadRes.ok) {
          const reloadData = await reloadRes.json()
          if (reloadData.success && reloadData.deductions) {
            setCrossDriverDeductions(reloadData.deductions)
          }
        }
        
        // Clear input
        setCrossDriverDeductionInput(deductionKey, '')
        
        toast.success('Deduction saved successfully')
      } else {
        toast.error(data.error || 'Failed to save deduction')
      }
    } catch (error) {
      console.error('Error saving cross-driver deduction:', error)
      toast.error('Failed to save deduction')
    }
  }, [selectedTruckloadId, crossDriverDeductionInputs, crossDriverDeductionToggles, setCrossDriverDeductionInput])

  // OLD FUNCTIONS DISABLED - These were creating auto deductions
  // All deductions must now be entered via the table input fields and saved individually
  
  // DISABLED: addCrossDriverFreightItem - was creating auto deductions
  function addCrossDriverFreightItem(isAddition: boolean = false, comment?: string, deduction?: number, appliesTo?: 'load_value' | 'driver_pay'): void {
    console.warn('addCrossDriverFreightItem is disabled - use table input fields instead')
    return
  }

  // Re-enabled: handleSaveDeduction - saves manual deductions (with comments)
  const handleSaveDeduction = useCallback(async () => {
    if (!selectedTruckloadId) {
      toast.error('No truckload selected')
      return
    }

    const amount = parseFloat(deductionDialogAmount)
    if (isNaN(amount) || amount <= 0) {
      toast.error('Please enter a valid amount')
      return
    }

    try {
      // Always use manual type - use the comment as entered
      const comment = deductionDialogComment
      if (!comment || comment.trim() === '') {
        toast.error('Please enter a description for the manual deduction')
        return
      }

      // Manual deductions don't need action or customer name
      const action: 'Picked up' | 'Delivered' | null = null
      const customerName: string | null = null

      const response = await fetch(`/api/truckloads/${selectedTruckloadId}/cross-driver-deductions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          orderId: deductionDialogOrderId || null,
          driverName: selectedTruckload?.driver.driverName || null,
          date: selectedTruckload?.startDate || null,
          action: action,
          customerName: customerName,
          amount: amount,
          appliesTo: deductionDialogAppliesTo,
          comment: comment,
          isAddition: false
        })
      })

      const data = await response.json()
      if (data.success) {
        // Reload manual deductions
        const reloadRes = await fetch(`/api/truckloads/${selectedTruckloadId}/manual-deductions`, {
          method: 'GET',
          credentials: 'include'
        })
        if (reloadRes.ok) {
          const reloadData = await reloadRes.json()
          if (reloadData.success && reloadData.deductions) {
            setManualDeductions(reloadData.deductions)
          }
        }

        // Close dialog and reset
        setDeductionDialogOpen(false)
        setDeductionDialogOrderId(null)
        setDeductionDialogComment('')
        setDeductionDialogAmount('')
        setDeductionDialogAppliesTo('driver_pay')

        toast.success('Manual deduction saved successfully')
      } else {
        toast.error(data.error || 'Failed to save manual deduction')
      }
    } catch (error) {
      console.error('Error saving manual deduction:', error)
      toast.error('Failed to save manual deduction')
    }
  }, [selectedTruckloadId, deductionDialogAmount, deductionDialogComment, deductionDialogAppliesTo, selectedTruckload])

  // Save stop-specific deduction/addition
  const handleSaveStopDeduction = useCallback(async () => {
    if (!selectedTruckloadId || !stopDeductionDialogOrderId) {
      toast.error('No truckload or order selected')
      return
    }

    const amount = parseFloat(stopDeductionDialogAmount)
    if (isNaN(amount) || amount <= 0) {
      toast.error('Please enter a valid amount')
      return
    }

    try {
      const order = orders.find(o => o.orderId === stopDeductionDialogOrderId)
      if (!order) {
        toast.error('Order not found')
        return
      }

      // Determine comment based on type
      let comment = stopDeductionDialogComment
      let action: 'Picked up' | 'Delivered' | null = null
      let customerName: string | null = null

      if (stopDeductionDialogCommentType === 'pickup') {
        comment = `${order.pickupName} discount`
        action = 'Picked up'
        customerName = order.pickupName
      } else if (stopDeductionDialogCommentType === 'delivery') {
        comment = `${order.deliveryName} discount`
        action = 'Delivered'
        customerName = order.deliveryName
      } else {
        // Manual type - use the comment as entered
        if (!comment || comment.trim() === '') {
          toast.error('Please enter a description for the manual deduction')
          return
        }
      }

      const response = await fetch(`/api/truckloads/${selectedTruckloadId}/cross-driver-deductions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          orderId: stopDeductionDialogOrderId,
          driverName: selectedTruckload?.driver.driverName || null,
          date: selectedTruckload?.startDate || null,
          action: action,
          customerName: customerName,
          amount: amount,
          appliesTo: stopDeductionDialogAppliesTo,
          comment: comment,
          isAddition: stopDeductionDialogIsAddition
        })
      })

      const data = await response.json()
      if (data.success) {
        // Reload manual deductions
        const reloadRes = await fetch(`/api/truckloads/${selectedTruckloadId}/manual-deductions`, {
          method: 'GET',
          credentials: 'include'
        })
        if (reloadRes.ok) {
          const reloadData = await reloadRes.json()
          if (reloadData.success && reloadData.deductions) {
            setManualDeductions(reloadData.deductions)
          }
        }

        // Close dialog and reset
        setStopDeductionDialogOpen(false)
        setStopDeductionDialogOrderId(null)
        setStopDeductionDialogCommentType('manual')
        setStopDeductionDialogComment('')
        setStopDeductionDialogAmount('')
        setStopDeductionDialogAppliesTo('driver_pay')
        setStopDeductionDialogIsAddition(false)

        toast.success(stopDeductionDialogIsAddition ? 'Addition saved successfully' : 'Deduction saved successfully')
      } else {
        toast.error(data.error || 'Failed to save deduction')
      }
    } catch (error) {
      console.error('Error saving stop deduction:', error)
      toast.error('Failed to save deduction')
    }
  }, [selectedTruckloadId, stopDeductionDialogOrderId, stopDeductionDialogAmount, stopDeductionDialogComment, stopDeductionDialogCommentType, stopDeductionDialogAppliesTo, stopDeductionDialogIsAddition, orders, selectedTruckload])

  // DISABLED: updateCrossDriverFreightItem - was creating auto deductions
  function updateCrossDriverFreightItem(id: string, updates: Partial<CrossDriverFreightItem>): void {
    console.warn('updateCrossDriverFreightItem is disabled - use table input fields instead')
    return
  }

  // DISABLED: updateCrossDriverFreightItem - removed duplicate, use table input fields instead

  // OLD FUNCTION DISABLED - This was creating duplicate deductions
  // All deductions must now be entered via table input fields and saved individually
  const saveCrossDriverFreight = useCallback(async (_skipMerge: boolean = false): Promise<void> => {
    // DISABLED - Do nothing
    console.warn('saveCrossDriverFreight is disabled - use individual save buttons instead')
    return Promise.resolve()
  }, [])
  
  /* DISABLED CODE - Old implementation that was creating duplicates:
    if (!selectedTruckloadId) return

    // Use ref to get latest state
    const currentItems = editableCrossDriverFreightRef.current

    try {
      let itemsToSave: CrossDriverFreightItem[] = []

      if (skipMerge) {
        // When generating, just save what we have (no merge with database)
        console.log(`[Save] Skipping merge - saving ${currentItems.length} items directly`)
        itemsToSave = dedupeFreightItems(currentItems)
      } else {
        // Normal save: fetch existing saved items and merge
        const existingRes = await fetch(`/api/truckloads/${selectedTruckloadId}/cross-driver-freight`, {
          method: 'GET',
          credentials: 'include'
        })
        
        let existingSavedItems: CrossDriverFreightItem[] = []
        if (existingRes.ok) {
          const existingData = await existingRes.json()
          if (existingData.success && existingData.items) {
            existingSavedItems = existingData.items.map((item: any) => ({
              id: `db-${item.id}`,
              driverName: item.driverName || '',
              date: formatDateForInput(item.date || ''),
              action: item.action || 'Picked up',
              footage: typeof item.footage === 'number' ? item.footage : parseFloat(String(item.footage || 0)) || 0,
              dimensions: item.dimensions || '',
              deduction: typeof item.deduction === 'number' ? item.deduction : parseFloat(String(item.deduction || 0)) || 0,
              isManual: item.isManual || false,
              comment: item.comment || '',
              isAddition: item.isAddition || false,
              appliesTo: item.appliesTo || (item.isManual ? 'driver_pay' : undefined),
              customerName: item.customerName || undefined,
              orderId: item.orderId ? String(item.orderId) : undefined
            }))
          }
        }

        // Auto-detection removed - just save current items
        // Merge strategy:
        // 1. Keep all items from currentItems (what user sees/edits - these take priority)
        // 2. Keep all existing saved items that aren't in currentItems (preserve old saved items)
        
        // Create a set of keys for current items (to check for matches)
        const currentKeys = new Set(
          currentItems.map(item => buildFreightKey(item))
        )

        // Keep existing saved items that aren't in current items (preserve old saved items)
        const preservedSavedItems = existingSavedItems.filter(savedItem => {
          const savedKey = buildFreightKey(savedItem)
          return !currentKeys.has(savedKey)
        })

        // Combine: current items (user's view) + preserved saved items
        const mergedItems = [
          ...currentItems,
          ...preservedSavedItems
        ]

        // Deduplicate the merged list
        itemsToSave = dedupeFreightItems(mergedItems)
        
        console.log(`[Save] Merged items: ${currentItems.length} current + ${preservedSavedItems.length} preserved saved = ${mergedItems.length} total, ${itemsToSave.length} after dedupe`)
      }

      const deduplicated = itemsToSave

      const res = await fetch(`/api/truckloads/${selectedTruckloadId}/cross-driver-freight`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          items: deduplicated.map(item => ({
            driverName: item.driverName || null,
            date: item.date || null,
            action: item.action || null,
            footage: typeof item.footage === 'number' ? item.footage : parseFloat(String(item.footage || 0)) || 0,
            dimensions: item.dimensions || null,
            deduction: typeof item.deduction === 'number' ? item.deduction : parseFloat(String(item.deduction || 0)) || 0,
            isManual: item.isManual || false,
            comment: item.comment || null,
            isAddition: item.isAddition || false,
            appliesTo: item.appliesTo || (item.isManual ? 'driver_pay' : undefined),
            customerName: item.customerName || null,
            orderId: item.orderId || null
          }))
        })
      })

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}))
        const errorMessage = errorData.error || `HTTP ${res.status}: Failed to save cross-driver freight`
        console.error('Error saving cross-driver freight:', errorMessage, errorData)
        throw new Error(errorMessage)
      }
      
      const responseData = await res.json()
      console.log('Save response:', responseData)
      
      // Reload the data to ensure we have the latest from database
      if (responseData.success && responseData.verifiedCount > 0) {
        // Set flag to prevent useEffect from running during reload (prevents infinite loops)
        isReloadingAfterSave.current = true
        
        // Trigger a reload of cross-driver freight
        const reloadRes = await fetch(`/api/truckloads/${selectedTruckloadId}/cross-driver-freight`, {
          method: 'GET',
          credentials: 'include'
        })
        if (reloadRes.ok) {
          const reloadData = await reloadRes.json()
          if (reloadData.success && reloadData.items) {
            // Helper to normalize dates for comparison (YYYY-MM-DD format)
            const normalizeDate = (dateStr: string | null | undefined): string => {
              if (!dateStr) return ''
              // If already in YYYY-MM-DD format, return as-is
              if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return dateStr
              // Try to parse and format
              try {
                return new Date(dateStr).toISOString().split('T')[0]
              } catch {
                return String(dateStr)
              }
            }
            
            const reloadedItems = reloadData.items.map((item: any) => ({
              id: `db-${item.id}`,
              driverName: item.driverName || '',
              date: formatDateForInput(item.date || ''),
              action: item.action || 'Picked up',
              footage: typeof item.footage === 'number' ? item.footage : parseFloat(String(item.footage || 0)) || 0,
              dimensions: item.dimensions || '',
              deduction: typeof item.deduction === 'number' ? item.deduction : parseFloat(String(item.deduction || 0)) || 0,
              isManual: item.isManual || false,
              comment: item.comment || '',
              isAddition: item.isAddition || false,
              appliesTo: item.appliesTo || (item.isManual ? 'driver_pay' : undefined),
              customerName: item.customerName || undefined,
              orderId: item.orderId ? String(item.orderId) : undefined
            }))
            
            console.log('Reloaded items from DB:', reloadedItems)
            
            const dedupedReloadedItems = dedupeFreightItems(reloadedItems)
            
            if (dedupedReloadedItems.length > 0) {
              setEditableCrossDriverFreight(dedupedReloadedItems)
              editableCrossDriverFreightRef.current = dedupedReloadedItems
              console.log('Merged items (from DB):', dedupedReloadedItems)
            } else {
              setEditableCrossDriverFreight([])
              editableCrossDriverFreightRef.current = []
            }
          }
        }
        
        // Clear flag after a short delay to allow useEffect to run normally again
        setTimeout(() => {
          isReloadingAfterSave.current = false
        }, 1000)
      }
      
  }, [selectedTruckloadId])
  */

  function deleteCrossDriverFreightItem(id: string): void {
    setEditableCrossDriverFreight(items => items.filter(item => item.id !== id))
    // Removed auto-save - user must manually save
  }

  useEffect(function loadTruckloads() {
    let isCancelled = false
    async function run(): Promise<void> {
      try {
        setIsLoading(true)
        setHasError(false)
        setErrorMessage('')
        const res = await fetch('/api/truckloads', { method: 'GET', credentials: 'include' })
        if (!res.ok) {
          const body = await res.text().catch(() => '')
          throw new Error(`HTTP ${res.status}: ${body || 'Failed to fetch truckloads'}`)
        }
        const data = (await res.json()) as TruckloadsApiResponse
        if (!data.success) throw new Error('API returned success=false')
        const items: TruckloadListItem[] = data.truckloads.map(t => {
          const idStr = String(t.id)
          const driverIdStr = t.driverId ? String(t.driverId) : 'unassigned'
          return {
            id: idStr,
            startDate: t.startDate,
            endDate: t.endDate,
            driver: {
              driverId: driverIdStr,
              driverName: t.driverName || 'Unassigned',
              driverColor: t.driverColor || null,
            },
            displayLabel: `${t.billOfLadingNumber ? `BOL ${t.billOfLadingNumber}` : `TL ${idStr.slice(0, 6)}`}`,
            description: t.description,
            billOfLadingNumber: t.billOfLadingNumber,
            isCompleted: t.isCompleted || false,
            allQuotesFilled: t.allQuotesFilled || false,
          }
        })
        if (!isCancelled) {
          setTruckloads(items)
          // Only auto-select first truckload if not coming from driver pay
          // (the useEffect will handle selection from URL params)
          if (items.length > 0 && !fromDriverPay) {
            setSelectedTruckloadId(items[0].id)
          }
        }
      } catch (e) {
        if (!isCancelled) {
          setHasError(true)
          setErrorMessage(e instanceof Error ? e.message : 'Unknown error')
        }
      } finally {
        if (!isCancelled) setIsLoading(false)
      }
    }
    run()
    return () => {
      isCancelled = true
    }
  }, [fromDriverPay])

  useEffect(function loadOrdersForTruckload() {
    let isCancelled = false
    async function fetchPayingCustomerName(orderId: string): Promise<string | null> {
      try {
        const res = await fetch(`/api/orders/${orderId}`, { method: 'GET', credentials: 'same-origin' })
        if (!res.ok) return null
        const data = await res.json()
        return data.payingCustomer?.name ?? null
      } catch (_e) {
        return null
      }
    }

    async function run(): Promise<void> {
      if (!selectedTruckloadId) {
        setOrders([])
        return
      }
      try {
        setIsLoadingOrders(true)
        setHasOrdersError(false)
        setOrdersErrorMessage('')
        const res = await fetch(`/api/truckloads/${selectedTruckloadId}/orders`, { method: 'GET', credentials: 'include' })
        if (!res.ok) {
          const body = await res.text().catch(() => '')
          throw new Error(`HTTP ${res.status}: ${body || 'Failed to fetch truckload orders'}`)
        }
        const data = (await res.json()) as TruckloadOrdersApiResponse
        if (!data.success) throw new Error('API returned success=false')
        
        const rowsBase = data.orders.map(o => ({
          orderId: o.id,
          assignmentType: o.assignment_type,
          sequenceNumber: o.sequence_number,
          pickupName: o.pickup_customer?.name || 'Unknown',
          deliveryName: o.delivery_customer?.name || 'Unknown',
          pickupAddress: o.pickup_customer?.address || null,
          deliveryAddress: o.delivery_customer?.address || null,
          pickupPhone1: o.pickup_customer?.phone_number_1 || null,
          pickupPhone2: o.pickup_customer?.phone_number_2 || null,
          pickupNotes: o.pickup_customer?.notes || null,
          deliveryPhone1: o.delivery_customer?.phone_number_1 || null,
          deliveryPhone2: o.delivery_customer?.phone_number_2 || null,
          deliveryNotes: o.delivery_customer?.notes || null,
          payingCustomerName: null as string | null,
          freightQuote: o.freight_quote,
          splitQuote: (o as any).split_quote !== null && (o as any).split_quote !== undefined
            ? parseFloat((o as any).split_quote) 
            : null,
          assignmentQuote: (o as any).assignment_quote !== null && (o as any).assignment_quote !== undefined
            ? parseFloat((o as any).assignment_quote) 
            : null,
          middlefield: (o as any).middlefield || false,
          backhaul: (o as any).backhaul || false,
          ohioToIndiana: (o as any).oh_to_in || false,
          footage: typeof o.footage === 'number' ? o.footage : (typeof o.footage === 'string' ? parseFloat(o.footage) || 0 : 0),
          skidsData: o.skids_data || [],
          vinylData: o.vinyl_data || [],
          comments: o.comments || null,
          isRush: o.is_rush,
          needsAttention: o.needs_attention,
          pickupDriverName: o.pickup_driver_name || null,
          pickupAssignmentDate: o.pickup_assignment_date || null,
          deliveryDriverName: o.delivery_driver_name || null,
          deliveryAssignmentDate: o.delivery_assignment_date || null,
          isTransferOrder: o.is_transfer_order || false,
        }))
        // Fetch paying customer names in parallel
        const payingNames = await Promise.all(rowsBase.map(r => fetchPayingCustomerName(r.orderId)))
        const rows: AssignedOrderRow[] = rowsBase.map((r, idx) => ({ ...r, payingCustomerName: payingNames[idx] }))
        if (!isCancelled) setOrders(rows)
      } catch (e) {
        if (!isCancelled) {
          setHasOrdersError(true)
          setOrdersErrorMessage(e instanceof Error ? e.message : 'Unknown error')
        }
      } finally {
        if (!isCancelled) setIsLoadingOrders(false)
      }
    }

    run()
    return () => {
      isCancelled = true
    }
  }, [selectedTruckloadId])

  const groupedTruckloads = useMemo(() => {
    const items: TruckloadListItem[] = truckloads
    const groups: Record<string, { group: DriverGroup; items: TruckloadListItem[] }> = {}

    let filteredItems = items
      .filter(i => {
        // Apply driver filter
        if (selectedDriverId !== 'default' && i.driver.driverId !== selectedDriverId) {
          return false
        }
        // Apply search filter
        const matchesSearch = i.displayLabel.toLowerCase().includes(searchValue.toLowerCase()) ||
          i.driver.driverName.toLowerCase().includes(searchValue.toLowerCase())
        if (!matchesSearch) {
          return false
        }
        // Apply completed filter based on toggle
        if (showCompleted) {
          // Show completed truckloads (regardless of quotes filled status)
          return i.isCompleted === true
        } else {
          // Show only incomplete truckloads (not completed)
          return i.isCompleted !== true
        }
      })
      .sort((a, b) => b.startDate.localeCompare(a.startDate)) // Sort descending for most recent first

    // If showing incomplete, limit to 5 newest
    if (!showCompleted) {
      filteredItems = filteredItems.slice(0, 5)
    }

    filteredItems.forEach(i => {
      const key = i.driver.driverId
      if (!groups[key]) {
        groups[key] = { group: i.driver, items: [] }
      }
      groups[key].items.push(i)
    })

    return Object.values(groups)
  }, [searchValue, truckloads, selectedDriverId, showCompleted])

  // Auto-select first truckload when filter changes and current selection doesn't match
  useEffect(() => {
    const allFilteredTruckloads = groupedTruckloads.flatMap(g => g.items)
    const currentTruckload = allFilteredTruckloads.find(t => t.id === selectedTruckloadId)
    
    if (!currentTruckload && allFilteredTruckloads.length > 0) {
      setSelectedTruckloadId(allFilteredTruckloads[0].id)
    } else if (allFilteredTruckloads.length === 0) {
      setSelectedTruckloadId(null)
    }
  }, [groupedTruckloads, selectedTruckloadId])

  // Get unique drivers for dropdown
  const uniqueDrivers = useMemo(() => {
    const driverMap = new Map<string, DriverGroup>()
    truckloads.forEach(t => {
      if (!driverMap.has(t.driver.driverId)) {
        driverMap.set(t.driver.driverId, t.driver)
      }
    })
    return Array.from(driverMap.values())
  }, [truckloads])

  function toggleDriverCollapse(driverId: string): void {
    setCollapsedDrivers(prev => {
      const newSet = new Set(prev)
      if (newSet.has(driverId)) {
        newSet.delete(driverId)
      } else {
        newSet.add(driverId)
      }
      return newSet
    })
  }

  // Check if truckload has split load orders (only check assignment_quote, ignore old split_quote)
  const hasMiddlefieldOrders = useMemo(() => {
    if (!orders.length) return false
    return orders.some(order => 
      // Manually added: has an assignment_quote set
      (order.assignmentQuote !== null && order.assignmentQuote !== undefined)
    )
  }, [orders])

  // Open middlefield management dialog (DEPRECATED - kept for compatibility)
  const openMiddlefieldDialog = async (truckloadId: number) => {
    // This function is no longer used - split loads are now managed per-order
    console.warn('openMiddlefieldDialog is deprecated - use openSplitLoadDialog instead')
    return
  }

  // Open single-order split load dialog
  const openSplitLoadDialog = async (orderId: string) => {
    const orderIdNum = parseInt(orderId, 10)
    if (isNaN(orderIdNum)) {
      toast.error('Invalid order ID')
      return
    }

    setSplitLoadOrderId(orderIdNum)
    setSplitLoadDialogOpen(true)
    setIsLoadingSplitLoad(true)

    try {
      const response = await fetch(`/api/orders/${orderIdNum}/split-load`, {
        credentials: 'include'
      })
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }
      
      const data = await response.json()
      
      if (data.success) {
        setSplitLoadData(data.order)
        // If split load exists or is pending, populate the form
        if (data.order.hasSplitLoad) {
          // Check if there's a pending split load (only one assignment exists)
          if (data.order.pendingSplit) {
            const pending = data.order.pendingSplit
            setSplitLoadMiscValue(String(pending.miscValue))
            setSplitLoadFullQuoteAssignment(pending.fullQuoteAssignment)
            setSplitLoadFullQuoteAppliesTo(pending.fullQuoteAppliesTo)
            setSplitLoadMiscAppliesTo(pending.miscAppliesTo)
          } else {
            // Both assignments exist - use existing logic
            const pickupQuote = data.order.pickupAssignment?.assignmentQuote
            const deliveryQuote = data.order.deliveryAssignment?.assignmentQuote
            const fullQuote = typeof data.order.fullQuote === 'number' 
              ? data.order.fullQuote 
              : parseFloat(String(data.order.fullQuote || 0)) || 0
            
            // Determine which assignment has the smaller quote (misc value)
            if (pickupQuote !== null && deliveryQuote !== null) {
              const miscValue = Math.min(pickupQuote, deliveryQuote)
              const fullQuoteAssignment = pickupQuote > deliveryQuote ? 'pickup' : 'delivery'
              setSplitLoadMiscValue(String(miscValue))
              setSplitLoadFullQuoteAssignment(fullQuoteAssignment)
              // Use saved applies_to values if they exist, otherwise default to driver_pay
              if (data.order.existingSplitLoadAppliesTo) {
                setSplitLoadFullQuoteAppliesTo(data.order.existingSplitLoadAppliesTo.fullQuoteAppliesTo)
                setSplitLoadMiscAppliesTo(data.order.existingSplitLoadAppliesTo.miscAppliesTo)
              } else {
                setSplitLoadFullQuoteAppliesTo('driver_pay')
                setSplitLoadMiscAppliesTo('driver_pay')
              }
            } else if (pickupQuote !== null) {
              setSplitLoadMiscValue(String(pickupQuote))
              setSplitLoadFullQuoteAssignment('pickup')
              if (data.order.existingSplitLoadAppliesTo) {
                setSplitLoadFullQuoteAppliesTo(data.order.existingSplitLoadAppliesTo.fullQuoteAppliesTo)
                setSplitLoadMiscAppliesTo(data.order.existingSplitLoadAppliesTo.miscAppliesTo)
              } else {
                setSplitLoadFullQuoteAppliesTo('driver_pay')
                setSplitLoadMiscAppliesTo('driver_pay')
              }
            } else if (deliveryQuote !== null) {
              setSplitLoadMiscValue(String(deliveryQuote))
              setSplitLoadFullQuoteAssignment('delivery')
              if (data.order.existingSplitLoadAppliesTo) {
                setSplitLoadFullQuoteAppliesTo(data.order.existingSplitLoadAppliesTo.fullQuoteAppliesTo)
                setSplitLoadMiscAppliesTo(data.order.existingSplitLoadAppliesTo.miscAppliesTo)
              } else {
                setSplitLoadFullQuoteAppliesTo('driver_pay')
                setSplitLoadMiscAppliesTo('driver_pay')
              }
            }
          }
        } else {
          // Reset form for new split load
          setSplitLoadMiscValue('')
          setSplitLoadFullQuoteAssignment('delivery')
          setSplitLoadFullQuoteAppliesTo('driver_pay')
          setSplitLoadMiscAppliesTo('driver_pay')
        }
      } else {
        toast.error('Failed to load split load info')
        setSplitLoadData(null)
      }
    } catch (error) {
      console.error('Error loading split load info:', error)
      toast.error('Failed to load split load info')
      setSplitLoadData(null)
    } finally {
      setIsLoadingSplitLoad(false)
    }
  }

  // Save split load
  const saveSplitLoad = async () => {
    if (!splitLoadOrderId || !splitLoadData) return

    const miscValue = parseFloat(splitLoadMiscValue)
    if (isNaN(miscValue) || miscValue <= 0) {
      toast.error('Please enter a valid misc value')
      return
    }

    const fullQuote = typeof splitLoadData.fullQuote === 'number' 
      ? splitLoadData.fullQuote 
      : parseFloat(String(splitLoadData.fullQuote || 0)) || 0
    if (miscValue > fullQuote) {
      // Show warning but allow it
      if (!confirm(`Warning: Misc value ($${miscValue.toFixed(2)}) is greater than full quote ($${fullQuote.toFixed(2)}). Continue anyway?`)) {
        return
      }
    }

    setIsLoadingSplitLoad(true)
    try {
      const response = await fetch(`/api/orders/${splitLoadOrderId}/split-load`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          miscValue,
          fullQuoteAssignment: splitLoadFullQuoteAssignment,
          fullQuoteAppliesTo: splitLoadFullQuoteAppliesTo,
          miscAppliesTo: splitLoadMiscAppliesTo
        })
      })

      const data = await response.json()
      if (data.success) {
        toast.success(data.message || 'Split load updated successfully')
        setSplitLoadDialogOpen(false)
        // Refresh orders to show updated quotes and reload split load deductions
        if (selectedTruckloadId) {
          const id = selectedTruckloadId
          setSelectedTruckloadId(null)
          setTimeout(async () => {
            setSelectedTruckloadId(id)
            // Reload split load deductions
            const reloadRes = await fetch(`/api/truckloads/${id}/split-load-deductions`, {
              method: 'GET',
              credentials: 'include'
            })
            if (reloadRes.ok) {
              const reloadData = await reloadRes.json()
              if (reloadData.success && reloadData.deductions) {
                setSplitLoadDeductions(reloadData.deductions)
              } else {
                setSplitLoadDeductions([])
              }
            }
          }, 0)
        }
      } else {
        toast.error(data.error || 'Failed to update split load')
      }
    } catch (error) {
      console.error('Error saving split load:', error)
      toast.error('Failed to save split load')
    } finally {
      setIsLoadingSplitLoad(false)
    }
  }

  // Clear split load
  const clearSplitLoad = async () => {
    if (!splitLoadOrderId) return

    if (!confirm('Are you sure you want to clear the split load for this order?')) {
      return
    }

    setIsLoadingSplitLoad(true)
    try {
      const response = await fetch(`/api/orders/${splitLoadOrderId}/split-load`, {
        method: 'DELETE',
        credentials: 'include'
      })

      const data = await response.json()
      if (data.success) {
        toast.success(data.message || 'Split load cleared successfully')
        setSplitLoadDialogOpen(false)
        // Refresh orders and cross-driver freight
        if (selectedTruckloadId) {
          const id = selectedTruckloadId
          setSelectedTruckloadId(null)
          setTimeout(async () => {
            setSelectedTruckloadId(id)
            // Also clear and reload cross-driver freight to remove deleted split load items
            setEditableCrossDriverFreight([])
            editableCrossDriverFreightRef.current = []
            // Reload split load deductions
            const reloadRes = await fetch(`/api/truckloads/${id}/split-load-deductions`, {
              method: 'GET',
              credentials: 'include'
            })
            if (reloadRes.ok) {
              const reloadData = await reloadRes.json()
              if (reloadData.success && reloadData.deductions) {
                setSplitLoadDeductions(reloadData.deductions)
              } else {
                setSplitLoadDeductions([])
              }
            }
          }, 0)
        }
      } else {
        toast.error(data.error || 'Failed to clear split load')
      }
    } catch (error) {
      console.error('Error clearing split load:', error)
      toast.error('Failed to clear split load')
    } finally {
      setIsLoadingSplitLoad(false)
    }
  }


  function handlePrint(): void {
    window.print()
  }

  function formatDateShort(dateStr: string | null): string {
    if (!dateStr) return ''
    // Parse date string manually to avoid timezone shifts
    // Date strings from API are in YYYY-MM-DD format
    if (dateStr.match(/^\d{4}-\d{2}-\d{2}/)) {
      const parts = dateStr.split('-')
      const year = parseInt(parts[0], 10)
      const month = parseInt(parts[1], 10)
      const day = parseInt(parts[2], 10)
      return `${String(month).padStart(2, '0')}/${String(day).padStart(2, '0')}/${String(year).slice(-2)}`
    }
    // Fallback for other date formats
    const date = new Date(dateStr)
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    const year = String(date.getFullYear()).slice(-2)
    return `${month}/${day}/${year}`
  }

  // Handle back button navigation
  const handleBackToDriverPay = () => {
    if (urlDriverId && urlStartDate && urlEndDate) {
      const params = new URLSearchParams({
        driverId: urlDriverId,
        startDate: urlStartDate,
        endDate: urlEndDate
      })
      router.push(`/dashboard/driver-pay?${params.toString()}`)
    } else {
      router.push('/dashboard/driver-pay')
    }
  }

  return (
    <div className="flex h-full w-full gap-4">
      {!fromDriverPay && (
      <div className="w-[280px] flex-shrink-0 border rounded-md bg-white p-3 flex flex-col print:hidden">
        <div className="flex items-center gap-2 mb-2">
          <Search className="h-4 w-4 text-gray-500" />
          <Input
            value={searchValue}
            onChange={(e) => setSearchValue(e.target.value)}
            placeholder="Search driver, truckload…"
          />
        </div>
        <div className="mb-2">
          <Select value={selectedDriverId} onValueChange={setSelectedDriverId}>
            <SelectTrigger>
              <SelectValue placeholder="Filter by driver" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="default">Default</SelectItem>
              {uniqueDrivers.map(driver => (
                <SelectItem key={driver.driverId} value={driver.driverId}>
                  {driver.driverName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="mb-2 flex items-center justify-between gap-2 border border-gray-300 rounded-md px-3 py-2">
          <Label htmlFor="completed-toggle" className="text-xs cursor-pointer flex-1">
            {showCompleted ? 'Completed' : 'Incomplete (5 newest)'}
          </Label>
          <Switch
            id="completed-toggle"
            checked={showCompleted}
            onCheckedChange={setShowCompleted}
          />
        </div>
        <Separator className="my-2" />
        <ScrollArea className="flex-1">
          {isLoading ? (
            <div className="text-sm text-gray-500 p-2">Loading…</div>
          ) : hasError ? (
            <div className="text-sm text-red-600 p-2">Failed to load truckloads. {errorMessage && (<span className="break-all">{errorMessage}</span>)}</div>
          ) : groupedTruckloads.length === 0 ? (
            <div className="text-sm text-gray-500 p-2">No truckloads yet.</div>
          ) : (
            <div className="space-y-4">
              {groupedTruckloads.map(({ group, items }) => {
                const isCollapsed = collapsedDrivers.has(group.driverId)
                const displayItems = selectedDriverId === 'default' ? items.slice(0, 5) : items
                
                return (
                  <div key={group.driverId}>
                    <Collapsible open={!isCollapsed} onOpenChange={() => toggleDriverCollapse(group.driverId)}>
                      <CollapsibleTrigger className="w-full flex items-center gap-1 text-xs font-semibold text-gray-600 mb-2 hover:text-gray-900 transition-colors">
                        {isCollapsed ? <ChevronRight className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                        {group.driverName}
                      </CollapsibleTrigger>
                      <CollapsibleContent>
                        <div className="space-y-1">
                          {displayItems.map(item => {
                            const isCompleted = item.isCompleted
                            
                            // Convert hex color to RGB for opacity
                            const hexToRgb = (hex: string | null): { r: number; g: number; b: number } | null => {
                              if (!hex) return null
                              const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
                              return result ? {
                                r: parseInt(result[1], 16),
                                g: parseInt(result[2], 16),
                                b: parseInt(result[3], 16)
                              } : null
                            }
                            
                            const rgb = hexToRgb(item.driver.driverColor)
                            const bgColorStyle = rgb 
                              ? `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.15)` 
                              : 'rgba(128, 128, 128, 0.15)'
                            
                            const formatDateShort = (dateStr: string | null): string => {
                              if (!dateStr) return ''
                              // Parse date string manually to avoid timezone shifts
                              // Date strings from API are in YYYY-MM-DD format
                              if (dateStr.match(/^\d{4}-\d{2}-\d{2}/)) {
                                const parts = dateStr.split('-')
                                const year = parseInt(parts[0], 10)
                                const month = parseInt(parts[1], 10)
                                const day = parseInt(parts[2], 10)
                                return `${String(month).padStart(2, '0')}/${String(day).padStart(2, '0')}/${String(year).slice(-2)}`
                              }
                              // Fallback for other date formats
                              const date = new Date(dateStr)
                              const month = String(date.getMonth() + 1).padStart(2, '0')
                              const day = String(date.getDate()).padStart(2, '0')
                              const year = String(date.getFullYear()).slice(-2)
                              return `${month}/${day}/${year}`
                            }
                            
                            return (
                              <button
                                key={item.id}
                                onClick={() => setSelectedTruckloadId(item.id)}
                                className={`w-full text-left px-2 py-1.5 rounded-md border-2 transition-colors flex items-start gap-2 ${
                                  selectedTruckloadId === item.id
                                    ? 'border-blue-500'
                                    : 'border-gray-200'
                                }`}
                                style={{ backgroundColor: bgColorStyle }}
                              >
                                <div className="flex items-center gap-1 flex-shrink-0">
                                  {isCompleted ? (
                                    item.allQuotesFilled ? (
                                      <DollarSign className="h-4 w-4 text-green-600 mt-0.5" />
                                  ) : (
                                      <CheckCircle className="h-4 w-4 text-orange-600 mt-0.5" />
                                    )
                                  ) : (
                                    <Timer className="h-4 w-4 text-red-600 mt-0.5" />
                                  )}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="text-xs font-medium">{formatDateShort(item.startDate)} - {formatDateShort(item.endDate)}</div>
                                  {item.description && (
                                    <div className="text-xs text-gray-600 mt-0.5 truncate">{item.description}</div>
                                  )}
                                </div>
                              </button>
                            )
                          })}
                        </div>
                      </CollapsibleContent>
                    </Collapsible>
                  </div>
                )
              })}
            </div>
          )}
        </ScrollArea>
      </div>
      )}

      <div className={`flex-1 flex flex-col ${fromDriverPay ? 'w-full' : ''}`}>
        <div className="flex items-center justify-between mb-3 print:hidden">
          <div className="flex items-center gap-3">
            {fromDriverPay && (
              <Button variant="outline" onClick={handleBackToDriverPay} className="flex items-center gap-2">
                <ArrowLeft className="h-4 w-4" /> Back to Driver Pay
              </Button>
            )}
            <div>
              <h2 className="text-xl font-semibold">Invoice Page</h2>
              {!fromDriverPay && (
                <p className="text-sm text-gray-500">Select a truckload to view assigned orders.</p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" disabled={!selectedTruckloadId} onClick={() => setIsEditDialogOpen(true)}>
              <Edit3 className="h-4 w-4 mr-2" /> Edit Truckload
            </Button>
            <Button onClick={handlePrint} variant="default">
              <Printer className="h-4 w-4 mr-2" /> Print
            </Button>
          </div>
        </div>

        <Card className="flex-1 p-4">
          {selectedTruckload && (
            <div className="mb-4 pb-3 border-b">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3 text-lg">
                  {selectedTruckload.driver.driverColor && (
                    <div 
                      className="w-4 h-4 rounded-full flex-shrink-0"
                      style={{ backgroundColor: selectedTruckload.driver.driverColor }}
                    />
                  )}
                  <span className="font-semibold">{selectedTruckload.driver.driverName}</span>
                  <span className="text-base text-gray-600">
                    {formatDateShort(selectedTruckload.startDate)} - {formatDateShort(selectedTruckload.endDate)}
                  </span>
                  {selectedTruckload.description && (
                    <span className="text-sm text-gray-600">{selectedTruckload.description}</span>
                  )}
                  {selectedTruckload.billOfLadingNumber && (
                    <span className="text-base font-medium">BOL {selectedTruckload.billOfLadingNumber}</span>
                  )}
                </div>
              </div>
            </div>
          )}
          {!selectedTruckloadId ? (
            <div className="text-sm text-gray-500">No truckload selected.</div>
          ) : isLoadingOrders ? (
            <div className="text-sm text-gray-500">Loading orders…</div>
          ) : hasOrdersError ? (
            <div className="text-sm text-red-600">Failed to load assigned orders. {ordersErrorMessage && (<span className="break-all">{ordersErrorMessage}</span>)}</div>
          ) : orders.length === 0 ? (
            <div className="text-sm text-gray-500">No assigned orders.</div>
          ) : (
            <>
              {/* Screen view with table */}
              <div className="print:hidden">
                <DndContext
                  sensors={sensors}
                  collisionDetection={closestCenter}
                  onDragEnd={handleDragEnd}
                >
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-auto">#</TableHead>
                        <TableHead className="w-auto">Pickup</TableHead>
                        <TableHead className="w-auto">Delivery</TableHead>
                        <TableHead className="w-auto">Paying Customer</TableHead>
                        <TableHead style={{ width: '90px' }}>Quote</TableHead>
                        <TableHead className="w-auto">Footage</TableHead>
                        <TableHead className="w-auto">Dimensions</TableHead>
                        <TableHead className="w-auto text-center" style={{ width: '40px' }}></TableHead>
                        <TableHead className="w-auto">Handled By</TableHead>
                        <TableHead className="w-auto">Deduction</TableHead>
                        <TableHead className="w-auto">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <SortableContext
                      items={groupedOrders.map(row => `${row.orderId}${(row as any).isCombined ? '-transfer' : `-${row.assignmentType}`}`)}
                      strategy={verticalListSortingStrategy}
                    >
                      <TableBody>
                        {groupedOrders.map((row) => {
                      // Calculate total quantity of skids and vinyl combined
                      const totalSkidsQuantity = row.skidsData.reduce((sum, skid) => sum + skid.quantity, 0)
                      const totalVinylQuantity = row.vinylData.reduce((sum, vinyl) => sum + vinyl.quantity, 0)
                      const totalQuantity = totalSkidsQuantity + totalVinylQuantity
                      const freeItems = Math.floor(totalQuantity / 4)
                      
                      // Build dimensions string - combine skids and vinyl by dimension
                      const dimensionGroups: { [key: string]: number } = {}
                      row.skidsData.forEach(skid => {
                        const dimension = `${skid.width}x${skid.length}`
                        dimensionGroups[dimension] = (dimensionGroups[dimension] || 0) + skid.quantity
                      })
                      row.vinylData.forEach(vinyl => {
                        const dimension = `${vinyl.width}x${vinyl.length}`
                        dimensionGroups[dimension] = (dimensionGroups[dimension] || 0) + vinyl.quantity
                      })
                      
                      const allDimensions = Object.entries(dimensionGroups)
                        .map(([dimension, quantity]) => `${quantity} ${dimension}`)
                        .join(', ')
                      
                      const isTransfer = (row as any).isCombined || false
                      const rowId = `${row.orderId}${isTransfer ? '-transfer' : `-${row.assignmentType}`}`
                      
                      return (
                        <SortableTableRow
                          key={rowId}
                          id={rowId}
                          row={row}
                          isTransfer={isTransfer}
                          selectedTruckload={selectedTruckload}
                          dimensionGroups={dimensionGroups}
                          allDimensions={allDimensions}
                          freeItems={freeItems}
                          debouncedUpdateQuote={debouncedUpdateQuote}
                          updatingQuotes={updatingQuotes}
                          formatDateShort={formatDateShort}
                          onInfoClick={() => {
                            setSelectedOrderIdForInfo(parseInt(row.orderId))
                            setIsOrderInfoDialogOpen(true)
                          }}
                          onAddDeduction={(orderId) => {
                            setDeductionDialogOrderId(null)
                            setDeductionDialogComment('')
                            setDeductionDialogAmount('')
                            setDeductionDialogAppliesTo('driver_pay')
                            setDeductionDialogOpen(true)
                          }}
                          selectedTruckloadId={selectedTruckloadId}
                          onOpenSplitLoadDialog={openSplitLoadDialog}
                          onSaveCrossDriverDeduction={handleSaveCrossDriverDeduction}
                          crossDriverDeductionInputs={crossDriverDeductionInputs}
                          setCrossDriverDeductionInput={setCrossDriverDeductionInput}
                          crossDriverDeductionToggles={crossDriverDeductionToggles}
                          setCrossDriverDeductionToggle={setCrossDriverDeductionToggle}
                          crossDriverDeductions={crossDriverDeductions}
                          onOpenStopDeductionDialog={(orderId: string) => {
                            setStopDeductionDialogOrderId(orderId)
                            setStopDeductionDialogCommentType('manual')
                            setStopDeductionDialogComment('')
                            setStopDeductionDialogAmount('')
                            setStopDeductionDialogAppliesTo('driver_pay')
                            setStopDeductionDialogIsAddition(false)
                            setStopDeductionDialogOpen(true)
                          }}
                          onDeleteCrossDriverDeduction={async (deductionId: string) => {
                            try {
                              const response = await fetch(`/api/truckloads/${selectedTruckloadId}/cross-driver-deductions`, {
                                method: 'DELETE',
                                headers: { 'Content-Type': 'application/json' },
                                credentials: 'include',
                                body: JSON.stringify({ deductionId })
                              })
                              
                              const data = await response.json()
                              if (data.success) {
                                // Reload deductions from database
                                const reloadRes = await fetch(`/api/truckloads/${selectedTruckloadId}/cross-driver-deductions`, {
                                  method: 'GET',
                                  credentials: 'include'
                                })
                                if (reloadRes.ok) {
                                  const reloadData = await reloadRes.json()
                                  if (reloadData.success && reloadData.deductions) {
                                    setCrossDriverDeductions(reloadData.deductions)
                                  }
                                }
                                toast.success('Deduction deleted')
                              } else {
                                toast.error(data.error || 'Failed to delete deduction')
                              }
                            } catch (error) {
                              console.error('Error deleting deduction:', error)
                              toast.error('Failed to delete deduction')
                            }
                          }}
                        />
                      )
                    })}
                  </TableBody>
                </SortableContext>
              </Table>
            </DndContext>
                
                {/* Totals Section */}
                {orders.length > 0 && (
                  <div className="mt-4 space-y-3 border-t-2 border-gray-300 pt-3">
                    {/* Summary Totals */}
                    <div className="grid grid-cols-2 gap-4 px-2">
                      <div className="border border-gray-300 rounded-lg p-2">
                        <div className="text-xs font-medium text-gray-600 mb-0.5">Total Pickups</div>
                        <div className="text-xl font-bold">{totals.pickupCount}</div>
                      </div>
                      <div className="border border-gray-300 rounded-lg p-2">
                        <div className="text-xs font-medium text-gray-600 mb-0.5">Total Deliveries</div>
                        <div className="text-xl font-bold">{totals.deliveryCount}</div>
                      </div>
                    </div>

                    {/* Cross-Driver Sections - Side by Side */}
                    <div className="px-2 grid grid-cols-2 gap-4">
                      {/* Left: Manual Deductions/Additions */}
                      <div className="px-2">
                        <div className="flex items-center justify-between mb-2 gap-2">
                          <div className="text-sm font-semibold text-gray-700">
                            Manual Deductions/Additions
                          </div>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setDeductionDialogOpen(true)
                              setDeductionDialogOrderId(null)
                              setDeductionDialogComment('')
                              setDeductionDialogAmount('')
                              setDeductionDialogAppliesTo('driver_pay')
                            }}
                            className="h-7 text-xs"
                          >
                            + Add
                          </Button>
                        </div>
                        {manualDeductions.length === 0 ? (
                          <div className="text-sm text-gray-600 border border-gray-300 rounded p-2">
                            No manual deductions or additions
                          </div>
                        ) : (
                          <div className="space-y-1.5 max-h-96 overflow-y-auto">
                            {manualDeductions.map((deduction) => (
                              <div
                                key={deduction.id}
                                className={`border rounded-lg p-2 text-xs ${
                                  deduction.isAddition 
                                    ? 'border-green-300 bg-green-50' 
                                    : 'border-red-300 bg-red-50'
                                }`}
                              >
                                <div className="flex items-center justify-between gap-2">
                                  <div className={`flex-1 ${
                                    deduction.isAddition 
                                      ? 'text-green-700' 
                                      : 'text-red-700'
                                  }`}>
                                    <div className="font-medium">
                                      {deduction.isAddition ? '+' : '-'} ${deduction.amount.toFixed(2)} - {deduction.comment || 'No description'}
                                    </div>
                                    {deduction.action && deduction.customerName && (
                                      <div className="text-gray-600 mt-0.5">
                                        {deduction.action} {deduction.action === 'Picked up' ? 'from' : 'to'} {deduction.customerName}
                                      </div>
                                    )}
                                    <div className="text-gray-600 mt-0.5">
                                      Applies to: {deduction.appliesTo === 'driver_pay' ? 'Driver Pay' : 'Load Value'}
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-1">
                                    <Button
                                      size="sm"
                                      variant={deduction.appliesTo === 'driver_pay' ? 'default' : 'outline'}
                                      onClick={async () => {
                                        // Update appliesTo
                                        const newAppliesTo = deduction.appliesTo === 'driver_pay' ? 'load_value' : 'driver_pay'
                                        
                                        try {
                                          const response = await fetch(`/api/truckloads/${selectedTruckloadId}/cross-driver-deductions`, {
                                            method: 'PATCH',
                                            headers: { 'Content-Type': 'application/json' },
                                            credentials: 'include',
                                            body: JSON.stringify({
                                              deductionId: deduction.id,
                                              appliesTo: newAppliesTo
                                            })
                                          })
                                          
                                          const data = await response.json()
                                          if (data.success) {
                                            // Reload from database
                                            const reloadRes = await fetch(`/api/truckloads/${selectedTruckloadId}/manual-deductions`, {
                                              method: 'GET',
                                              credentials: 'include'
                                            })
                                            if (reloadRes.ok) {
                                              const reloadData = await reloadRes.json()
                                              if (reloadData.success && reloadData.deductions) {
                                                setManualDeductions(reloadData.deductions)
                                              }
                                            }
                                            toast.success('Deduction updated')
                                          } else {
                                            toast.error(data.error || 'Failed to update deduction')
                                          }
                                        } catch (error) {
                                          console.error('Error updating deduction:', error)
                                          toast.error('Failed to update deduction')
                                        }
                                      }}
                                      className="h-6 px-2 text-xs"
                                    >
                                      {deduction.appliesTo === 'driver_pay' ? 'Driver Pay' : 'Load Value'}
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      onClick={async () => {
                                        if (!confirm('Are you sure you want to delete this deduction?')) {
                                          return
                                        }
                                        
                                        try {
                                          const response = await fetch(`/api/truckloads/${selectedTruckloadId}/cross-driver-deductions`, {
                                            method: 'DELETE',
                                            headers: { 'Content-Type': 'application/json' },
                                            credentials: 'include',
                                            body: JSON.stringify({
                                              deductionId: deduction.id
                                            })
                                          })
                                          
                                          const data = await response.json()
                                          if (data.success) {
                                            // Reload from database
                                            const reloadRes = await fetch(`/api/truckloads/${selectedTruckloadId}/manual-deductions`, {
                                              method: 'GET',
                                              credentials: 'include'
                                            })
                                            if (reloadRes.ok) {
                                              const reloadData = await reloadRes.json()
                                              if (reloadData.success && reloadData.deductions) {
                                                setManualDeductions(reloadData.deductions)
                                              }
                                            }
                                            toast.success('Deduction deleted')
                                          } else {
                                            toast.error(data.error || 'Failed to delete deduction')
                                          }
                                        } catch (error) {
                                          console.error('Error deleting deduction:', error)
                                          toast.error('Failed to delete deduction')
                                        }
                                      }}
                                      className="h-6 px-2 text-xs text-red-600 hover:text-red-700"
                                    >
                                      ×
                                    </Button>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                      
                      {/* Right: Pickup/Delivery & Split Load Deductions List */}
                      <div className="px-2">
                        <div className="flex items-center justify-between mb-2 gap-2">
                          <div className="text-sm font-semibold text-gray-700">
                            Pickup/Delivery Deductions
                          </div>
                        </div>
                        {crossDriverDeductions.length === 0 && splitLoadDeductions.length === 0 ? (
                          <div className="text-sm text-gray-600 border border-gray-300 rounded p-2">
                            No deductions added
                          </div>
                        ) : (
                          <div className="space-y-1.5 max-h-96 overflow-y-auto">
                            {/* Pickup/Delivery Deductions */}
                            {crossDriverDeductions.map((deduction) => (
                              <div
                                key={deduction.id}
                                className={`border rounded-lg p-2 text-xs ${
                                  deduction.action === 'Picked up' ? 'border-red-300 bg-red-50' : 'border-black bg-gray-50'
                                }`}
                              >
                                <div className="flex items-center justify-between gap-2">
                                  <div className={`flex-1 ${deduction.action === 'Picked up' ? 'text-red-700' : 'text-black'}`}>
                                    <div className="font-medium">
                                      {deduction.driverName} {deduction.action.toLowerCase()} {deduction.action === 'Picked up' ? 'from' : 'to'} {deduction.customerName} on {formatDateShort(deduction.date)}
                                    </div>
                                    <div className="text-gray-600 mt-0.5">
                                      ${deduction.amount.toFixed(2)}
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-1">
                                    <Button
                                      size="sm"
                                      variant={deduction.appliesTo === 'driver_pay' ? 'default' : 'outline'}
                                      onClick={async () => {
                                        // Update appliesTo
                                        const newAppliesTo = deduction.appliesTo === 'driver_pay' ? 'load_value' : 'driver_pay'
                                        
                                        try {
                                          const response = await fetch(`/api/truckloads/${selectedTruckloadId}/cross-driver-deductions`, {
                                            method: 'PATCH',
                                            headers: { 'Content-Type': 'application/json' },
                                            credentials: 'include',
                                            body: JSON.stringify({
                                              deductionId: deduction.id,
                                              appliesTo: newAppliesTo
                                            })
                                          })
                                          
                                          const data = await response.json()
                                          if (data.success) {
                                            // Reload from database instead of updating state directly
                                            const reloadRes = await fetch(`/api/truckloads/${selectedTruckloadId}/cross-driver-deductions`, {
                                              method: 'GET',
                                              credentials: 'include'
                                            })
                                            if (reloadRes.ok) {
                                              const reloadData = await reloadRes.json()
                                              if (reloadData.success && reloadData.deductions) {
                                                setCrossDriverDeductions(reloadData.deductions)
                                              }
                                            }
                                            toast.success('Deduction updated')
                                          } else {
                                            toast.error(data.error || 'Failed to update deduction')
                                          }
                                        } catch (error) {
                                          console.error('Error updating deduction:', error)
                                          toast.error('Failed to update deduction')
                                        }
                                      }}
                                      className="h-6 px-2 text-xs"
                                    >
                                      {deduction.appliesTo === 'driver_pay' ? 'Driver Pay' : 'Load Value'}
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      onClick={async () => {
                                        if (!confirm('Are you sure you want to delete this deduction?')) {
                                          return
                                        }
                                        
                                        try {
                                          const response = await fetch(`/api/truckloads/${selectedTruckloadId}/cross-driver-deductions`, {
                                            method: 'DELETE',
                                            headers: { 'Content-Type': 'application/json' },
                                            credentials: 'include',
                                            body: JSON.stringify({
                                              deductionId: deduction.id
                                            })
                                          })
                                          
                                          const data = await response.json()
                                          if (data.success) {
                                            // Reload from database instead of filtering state
                                            const reloadRes = await fetch(`/api/truckloads/${selectedTruckloadId}/cross-driver-deductions`, {
                                              method: 'GET',
                                              credentials: 'include'
                                            })
                                            if (reloadRes.ok) {
                                              const reloadData = await reloadRes.json()
                                              if (reloadData.success && reloadData.deductions) {
                                                setCrossDriverDeductions(reloadData.deductions)
                                              }
                                            }
                                            toast.success('Deduction deleted')
                                          } else {
                                            toast.error(data.error || 'Failed to delete deduction')
                                          }
                                        } catch (error) {
                                          console.error('Error deleting deduction:', error)
                                          toast.error('Failed to delete deduction')
                                        }
                                      }}
                                      className="h-6 w-6 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
                                    >
                                      <Trash2 className="h-3 w-3" />
                                    </Button>
                                  </div>
                                </div>
                              </div>
                            ))}
                            
                            {/* Split Load Deductions - Read Only (combined in same list) */}
                            {splitLoadDeductions.map((deduction) => (
                              <div
                                key={deduction.id}
                                className={`border-2 border-blue-300 rounded-lg p-2 text-xs bg-blue-50 ${
                                  deduction.isAddition 
                                    ? 'border-green-300 bg-green-50' 
                                    : deduction.action === 'Picked up' 
                                      ? 'border-red-300 bg-red-50' 
                                      : 'border-gray-300 bg-gray-50'
                                }`}
                              >
                                <div className="flex items-center justify-between gap-2">
                                  <div className={`flex-1 ${
                                    deduction.isAddition 
                                      ? 'text-green-700' 
                                      : deduction.action === 'Picked up' 
                                        ? 'text-red-700' 
                                        : 'text-gray-700'
                                  }`}>
                                    <div className="flex items-center gap-1">
                                      <span className="font-medium">
                                        {deduction.isAddition ? '+' : '-'} ${deduction.amount.toFixed(2)} - {deduction.comment || 'Split load'}
                                      </span>
                                      <span className="text-[10px] text-blue-600 italic bg-blue-100 px-1 rounded">
                                        Split Load
                                      </span>
                                    </div>
                                    {deduction.driverName && (
                                      <div className="text-gray-600 mt-0.5 text-xs">
                                        {deduction.driverName} {deduction.action.toLowerCase()} {deduction.action === 'Picked up' ? 'from' : 'to'} {deduction.customerName} on {formatDateShort(deduction.date)}
                                      </div>
                                    )}
                                    <div className="text-gray-500 mt-0.5 text-xs">
                                      Applies to: {deduction.appliesTo === 'driver_pay' ? 'Driver Pay' : 'Load Value'} • Edit via split load popup in order
                                    </div>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Payroll Summary */}
                    <div className="px-2 mt-3">
                      <div className="border-2 border-gray-400 rounded-lg p-4 bg-gray-50">
                        <h3 className="text-sm font-semibold text-gray-700 mb-4">Payroll Calculation</h3>
                        
                        {/* Step 1: Calculate Load Value */}
                        <div className="mb-4 pb-4 border-b-2 border-gray-300">
                          <div className="text-xs font-semibold text-gray-500 uppercase mb-2">Step 1: Calculate Load Value</div>
                          <div className="space-y-2">
                            <div className="flex items-center justify-between bg-white rounded px-3 py-2">
                              <span className="text-sm font-medium text-gray-700">Total Quotes</span>
                              <span className="text-base font-bold">${payrollCalculations.totalQuotes.toFixed(2)}</span>
                            </div>
                            
                            {/* Manual Deductions from Load Value - Subtotal Only */}
                            {payrollCalculations.manualDeductionsFromLoadValue > 0 && (
                              <div className="flex items-center justify-between bg-red-50 rounded px-3 py-2">
                                <span className="text-sm font-medium text-red-700">Manual Deductions (from Load Value)</span>
                                <span className="text-base font-bold text-red-600">-${payrollCalculations.manualDeductionsFromLoadValue.toFixed(2)}</span>
                              </div>
                            )}
                            
                            {/* Split Load Deductions from Load Value - Subtotal Only */}
                            {payrollCalculations.splitLoadDeductionsFromLoadValue > 0 && (
                              <div className="flex items-center justify-between bg-red-50 rounded px-3 py-2">
                                <span className="text-sm font-medium text-red-700">Split Load Deductions (from Load Value)</span>
                                <span className="text-base font-bold text-red-600">-${payrollCalculations.splitLoadDeductionsFromLoadValue.toFixed(2)}</span>
                              </div>
                            )}
                            
                            {/* Split Load Additions to Load Value - Subtotal Only */}
                            {payrollCalculations.splitLoadAdditionsToLoadValue > 0 && (
                              <div className="flex items-center justify-between bg-green-50 rounded px-3 py-2">
                                <span className="text-sm font-medium text-green-700">Split Load Additions (to Load Value)</span>
                                <span className="text-base font-bold text-green-600">+${payrollCalculations.splitLoadAdditionsToLoadValue.toFixed(2)}</span>
                              </div>
                            )}
                            
                            {/* Manual Additions to Load Value - Subtotal Only */}
                            {payrollCalculations.manualAdditionsToLoadValue > 0 && (
                              <div className="flex items-center justify-between bg-green-50 rounded px-3 py-2">
                                <span className="text-sm font-medium text-green-700">Manual Additions (to Load Value)</span>
                                <span className="text-base font-bold text-green-600">+${payrollCalculations.manualAdditionsToLoadValue.toFixed(2)}</span>
                              </div>
                            )}
                            
                            <div className="flex items-center justify-between bg-blue-100 rounded px-3 py-2 border-2 border-blue-300">
                              <span className="text-sm font-semibold text-blue-900">Load Value</span>
                              <span className="text-lg font-bold text-blue-900">${payrollCalculations.loadValue.toFixed(2)}</span>
                            </div>
                          </div>
                        </div>

                        {/* Step 2: Calculate Base Driver Pay */}
                        <div className="mb-4 pb-4 border-b-2 border-gray-300">
                          <div className="text-xs font-semibold text-gray-500 uppercase mb-2">Step 2: Calculate Base Driver Pay</div>
                          <div className="flex items-center justify-between bg-blue-50 rounded px-3 py-2">
                            <span className="text-sm font-medium text-blue-700">
                              Load Value × {payrollCalculations.driverLoadPercentage.toFixed(0)}%
                            </span>
                            <span className="text-base font-bold text-blue-600">${payrollCalculations.baseDriverPay.toFixed(2)}</span>
                          </div>
                        </div>

                        {/* Step 3: Apply Deductions & Additions to Driver Pay */}
                        <div className="mb-4">
                          <div className="text-xs font-semibold text-gray-500 uppercase mb-2">Step 3: Apply Deductions & Additions</div>
                          <div className="space-y-2">
                            {/* Automatic Deductions - Subtotal Only */}
                            {payrollCalculations.automaticDeductions > 0 && (
                              <div className="flex items-center justify-between bg-red-50 rounded px-3 py-2">
                                <span className="text-sm font-medium text-red-700">Automatic Deductions</span>
                                <span className="text-base font-bold text-red-600">-${payrollCalculations.automaticDeductions.toFixed(2)}</span>
                              </div>
                            )}
                            
                            {/* Manual Deductions from Driver Pay - Subtotal Only */}
                            {payrollCalculations.manualDeductionsFromDriverPay > 0 && (
                              <div className="flex items-center justify-between bg-red-50 rounded px-3 py-2">
                                <span className="text-sm font-medium text-red-700">Manual Deductions (from Driver Pay)</span>
                                <span className="text-base font-bold text-red-600">-${payrollCalculations.manualDeductionsFromDriverPay.toFixed(2)}</span>
                              </div>
                            )}
                            
                            {/* Split Load Deductions from Driver Pay - Subtotal Only */}
                            {payrollCalculations.splitLoadDeductionsFromDriverPay > 0 && (
                              <div className="flex items-center justify-between bg-red-50 rounded px-3 py-2">
                                <span className="text-sm font-medium text-red-700">Split Load Deductions (from Driver Pay)</span>
                                <span className="text-base font-bold text-red-600">-${payrollCalculations.splitLoadDeductionsFromDriverPay.toFixed(2)}</span>
                              </div>
                            )}
                            
                            {/* Split Load Additions to Driver Pay - Subtotal Only */}
                            {payrollCalculations.splitLoadAdditionsToDriverPay > 0 && (
                              <div className="flex items-center justify-between bg-green-50 rounded px-3 py-2">
                                <span className="text-sm font-medium text-green-700">Split Load Additions (to Driver Pay)</span>
                                <span className="text-base font-bold text-green-600">+${payrollCalculations.splitLoadAdditionsToDriverPay.toFixed(2)}</span>
                              </div>
                            )}
                            
                            {/* Manual Additions to Driver Pay - Subtotal Only */}
                            {payrollCalculations.manualAdditionsToDriverPay > 0 && (
                              <div className="flex items-center justify-between bg-green-50 rounded px-3 py-2">
                                <span className="text-sm font-medium text-green-700">Manual Additions (to Driver Pay)</span>
                                <span className="text-base font-bold text-green-600">+${payrollCalculations.manualAdditionsToDriverPay.toFixed(2)}</span>
                              </div>
                            )}
                            
                            {(payrollCalculations.automaticDeductions === 0 && 
                              payrollCalculations.manualDeductionsFromDriverPay === 0 && 
                              payrollCalculations.splitLoadDeductionsFromDriverPay === 0 &&
                              payrollCalculations.manualAdditionsToDriverPay === 0 &&
                              payrollCalculations.splitLoadAdditionsToDriverPay === 0) && (
                              <div className="text-xs text-gray-500 italic text-center py-2">No deductions or additions applied</div>
                            )}
                          </div>
                        </div>

                        {/* Final Result */}
                        <div className="bg-gradient-to-r from-blue-100 to-blue-200 rounded-lg px-4 py-3 border-2 border-blue-400">
                          <div className="flex items-center justify-between">
                            <span className="text-base font-semibold text-blue-900">Final Driver Pay</span>
                            <span className="text-2xl font-bold text-blue-900">${payrollCalculations.finalDriverPay.toFixed(2)}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
              
              {/* Print view with table - First page: Stops list */}
              <div className="hidden print:block print-invoice-content">
                <div className="print-page-break-after">
                  <Table className="print-table">
                  <TableHeader className="print-table-header">
                    <TableRow>
                      <TableHead className="w-auto">#</TableHead>
                      <TableHead className="w-auto">Pickup</TableHead>
                      <TableHead className="w-auto">Delivery</TableHead>
                      <TableHead className="w-auto">Paying Customer</TableHead>
                      <TableHead style={{ width: '90px' }}>Quote</TableHead>
                      <TableHead className="w-auto">Footage</TableHead>
                      <TableHead className="w-auto">Dimensions</TableHead>
                      <TableHead className="w-auto">Handled By</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {groupedOrders.map((row) => {
                      // Calculate total quantity of skids and vinyl combined
                      const totalSkidsQuantity = row.skidsData.reduce((sum, skid) => sum + skid.quantity, 0)
                      const totalVinylQuantity = row.vinylData.reduce((sum, vinyl) => sum + vinyl.quantity, 0)
                      const totalQuantity = totalSkidsQuantity + totalVinylQuantity
                      const freeItems = Math.floor(totalQuantity / 4)
                      
                      // Build dimensions string - combine skids and vinyl by dimension
                      const dimensionGroups: { [key: string]: number } = {}
                      row.skidsData.forEach(skid => {
                        const dimension = `${skid.width}x${skid.length}`
                        dimensionGroups[dimension] = (dimensionGroups[dimension] || 0) + skid.quantity
                      })
                      row.vinylData.forEach(vinyl => {
                        const dimension = `${vinyl.width}x${vinyl.length}`
                        dimensionGroups[dimension] = (dimensionGroups[dimension] || 0) + vinyl.quantity
                      })
                      
                      const allDimensions = Object.entries(dimensionGroups)
                        .map(([dimension, quantity]) => `${quantity} ${dimension}`)
                        .join(', ')
                      
                      const isTransfer = (row as any).isCombined || false
                      
                      return (
                        <TableRow key={`${row.orderId}${isTransfer ? '-transfer' : `-${row.assignmentType}`}`} className="print-item-group">
                          <TableCell className="text-xs">
                            {isTransfer && row.sequenceNumbers ? row.sequenceNumbers : row.sequenceNumber}
                          </TableCell>
                          <TableCell className="text-xs">
                            <CustomerInfoTooltip
                              name={row.pickupName}
                              address={row.pickupAddress}
                              phone1={row.pickupPhone1}
                              phone2={row.pickupPhone2}
                              notes={row.pickupNotes}
                            >
                              {isTransfer ? (
                                <span className="font-bold cursor-help">{row.pickupName}</span>
                              ) : (
                                row.assignmentType === 'pickup' ? <span className="font-bold cursor-help">{row.pickupName}</span> : <span className="cursor-help">{row.pickupName}</span>
                              )}
                            </CustomerInfoTooltip>
                          </TableCell>
                          <TableCell className="text-xs">
                            <CustomerInfoTooltip
                              name={row.deliveryName}
                              address={row.deliveryAddress}
                              phone1={row.deliveryPhone1}
                              phone2={row.deliveryPhone2}
                              notes={row.deliveryNotes}
                            >
                              {isTransfer ? (
                                <span className="font-bold cursor-help">{row.deliveryName}</span>
                              ) : (
                                row.assignmentType === 'delivery' ? <span className="font-bold cursor-help">{row.deliveryName}</span> : <span className="cursor-help">{row.deliveryName}</span>
                              )}
                            </CustomerInfoTooltip>
                          </TableCell>
                          <TableCell className="text-xs">
                            {row.payingCustomerName ? (
                              <CustomerInfoTooltip
                                name={row.payingCustomerName}
                                address={null}
                                phone1={null}
                                phone2={null}
                                notes={null}
                              >
                                <span className="cursor-help">{row.payingCustomerName}</span>
                              </CustomerInfoTooltip>
                            ) : (
                              '—'
                            )}
                          </TableCell>
                          <TableCell className="text-xs" style={{ width: '90px' }}>{row.freightQuote || '—'}</TableCell>
                          <TableCell className="text-xs text-right">{row.footage}</TableCell>
                          <TableCell className="text-xs">
                            <div className="flex items-center gap-1 flex-wrap">
                              {allDimensions ? (
                                <>
                                  {Object.entries(dimensionGroups).map(([dimension, quantity], idx) => (
                                    <span key={idx} className="inline-block bg-gray-100 border border-gray-300 px-1 py-0.5 rounded text-xs font-mono">
                                      {quantity} {dimension}
                                    </span>
                                  ))}
                                  {freeItems > 0 && (
                                    <span className="inline-flex items-center gap-0.5 bg-green-100 text-green-700 px-1 py-0.5 rounded text-xs font-semibold">
                                      <Gift className="h-2.5 w-2.5" />
                                      {freeItems}
                                    </span>
                                  )}
                                </>
                              ) : (
                                <span>—</span>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-xs">
                            {isTransfer ? (
                              <div className="text-xs text-blue-700 font-medium">Transfer</div>
                            ) : row.assignmentType === 'delivery' && row.pickupDriverName && row.pickupAssignmentDate ? (
                              <div className="flex items-center gap-1.5">
                                <div className="w-3 h-3 flex items-center justify-center flex-shrink-0">
                                  {row.pickupDriverName !== selectedTruckload?.driver.driverName && (
                                    <AlertTriangle className="h-3 w-3 text-red-500 animate-[pulse_1s_ease-in-out_infinite]" />
                                  )}
                                </div>
                                <div>
                                  <div className="truncate">{row.pickupDriverName}</div>
                                  <div className="text-gray-500">{formatDateShort(row.pickupAssignmentDate)}</div>
                                </div>
                              </div>
                            ) : row.assignmentType === 'pickup' && row.deliveryDriverName && row.deliveryAssignmentDate ? (
                              <div className="flex items-center gap-1.5">
                                <div className="w-3 h-3 flex items-center justify-center flex-shrink-0">
                                  {row.deliveryDriverName !== selectedTruckload?.driver.driverName && (
                                    <AlertTriangle className="h-3 w-3 text-red-500 animate-[pulse_1s_ease-in-out_infinite]" />
                                  )}
                                </div>
                                <div>
                                  <div className="truncate">{row.deliveryDriverName}</div>
                                  <div className="text-gray-500">{formatDateShort(row.deliveryAssignmentDate)}</div>
                                </div>
                              </div>
                            ) : '—'}
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
                </div>
                
                {/* Print View Totals Section - Second page: Freight and Totals */}
                {orders.length > 0 && (
                  <div className="mt-6 space-y-4 border-t-2 border-gray-400 pt-4 print-section print-page-break-before">
                    {/* Summary Totals */}
                    <div className="grid grid-cols-2 gap-4 mb-3 print-item-group">
                      <div className="border border-gray-300 rounded p-2">
                        <div className="text-xs font-medium text-gray-600 mb-0.5">Total Pickups</div>
                        <div className="text-xl font-bold">{totals.pickupCount}</div>
                      </div>
                      <div className="border border-gray-300 rounded p-2">
                        <div className="text-xs font-medium text-gray-600 mb-0.5">Total Deliveries</div>
                        <div className="text-xl font-bold">{totals.deliveryCount}</div>
                      </div>
                    </div>

                    {/* Cross-Driver Freight Section */}
                    <div className="print-allow-break">
                      <div className="text-sm font-semibold text-gray-700 mb-2">
                        Freight Handled by Other Drivers
                      </div>
                      {editableCrossDriverFreight.length === 0 ? (
                        <div className="text-sm text-gray-600 border border-gray-300 rounded p-2 print-item-group">
                          All freight handled by {selectedTruckload?.driver.driverName || 'selected driver'}
                        </div>
                      ) : (
                        <div className="space-y-1">
                          {editableCrossDriverFreight.map((item) => {
                            if (item.isManual) {
                              const amount = typeof item.deduction === 'number' ? item.deduction : parseFloat(String(item.deduction || 0)) || 0
                              const isAddition = item.isAddition || false
                              return (
                                <div key={item.id} className="border border-gray-300 rounded p-2 text-xs print-item-group">
                                  <div className="font-medium mb-1">{item.comment || 'Comment...'}</div>
                                  <div>
                                    {isAddition ? 'Addition' : 'Deduction'}: ${amount.toFixed(2        )}
      </div>

    </div>
  )
} else {
                              return (
                                <div key={item.id} className="border border-gray-300 rounded p-2 text-xs print-item-group">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span className="font-medium">{item.driverName}</span>
                                    <span className="text-gray-500">-</span>
                                    <span>{formatDateShort(item.date)}</span>
                                    <span className="text-gray-500">-</span>
                                    <span className="font-medium">{item.action}</span>
                                    <span className="text-gray-500">-</span>
                                    <span>{item.footage} sqft</span>
                                    <span className="text-gray-500">-</span>
                                    <span>{item.dimensions}</span>
                                    <span className="text-gray-500">-</span>
                                    <span>Deduction: ${(typeof item.deduction === 'number' ? item.deduction : parseFloat(String(item.deduction || 0)) || 0).toFixed(2)}</span>
                                  </div>
                                </div>
                              )
                            }
                          })}
                        </div>
                      )}
                    </div>

                    {/* Payroll Summary - Print View */}
                    <div className="mt-4 border-t-2 border-gray-400 pt-4 print-keep-together">
                      <div className="border-2 border-gray-400 rounded p-3">
                        <div className="grid grid-cols-3 gap-4">
                          <div>
                            <div className="text-xs font-medium text-gray-600 mb-1">Total Quotes</div>
                            <div className="text-lg font-bold">
                              ${totals.totalQuotes.toFixed(2)}
                            </div>
                          </div>
                          <div>
                            <div className="text-xs font-medium text-gray-600 mb-1">Total Quotes</div>
                            <div className="text-lg font-bold">
                              ${payrollCalculations.totalQuotes.toFixed(2)}
                            </div>
                          </div>
                          <div>
                            <div className="text-xs font-medium text-gray-600 mb-1">Manual Deductions (Load Value)</div>
                            <div className="text-lg font-bold text-red-600">
                              -${payrollCalculations.manualDeductionsFromLoadValue.toFixed(2)}
                            </div>
                          </div>
                          <div>
                            <div className="text-xs font-medium text-gray-600 mb-1">Manual Additions (Load Value)</div>
                            <div className="text-lg font-bold text-green-600">
                              +${payrollCalculations.manualAdditionsToLoadValue.toFixed(2)}
                            </div>
                          </div>
                          <div>
                            <div className="text-xs font-medium text-gray-600 mb-1">Load Value</div>
                            <div className="text-xl font-bold">
                              ${payrollCalculations.loadValue.toFixed(2)}
                            </div>
                          </div>
                          <div>
                            <div className="text-xs font-medium text-gray-600 mb-1">
                              Base Driver Pay ({payrollCalculations.driverLoadPercentage.toFixed(0)}%)
                            </div>
                            <div className="text-lg font-bold text-blue-600">
                              ${payrollCalculations.baseDriverPay.toFixed(2)}
                            </div>
                          </div>
                          <div>
                            <div className="text-xs font-medium text-gray-600 mb-1">Automatic Deductions</div>
                            <div className="text-lg font-bold text-red-600">
                              -${payrollCalculations.automaticDeductions.toFixed(2)}
                            </div>
                          </div>
                          <div>
                            <div className="text-xs font-medium text-gray-600 mb-1">Manual Deductions (Driver Pay)</div>
                            <div className="text-lg font-bold text-red-600">
                              -${payrollCalculations.manualDeductionsFromDriverPay.toFixed(2)}
                            </div>
                          </div>
                          <div>
                            <div className="text-xs font-medium text-gray-600 mb-1">Manual Additions (Driver Pay)</div>
                            <div className="text-lg font-bold text-green-600">
                              +${payrollCalculations.manualAdditionsToDriverPay.toFixed(2)}
                            </div>
                          </div>
                          <div>
                            <div className="text-xs font-medium text-gray-600 mb-1">
                              Final Driver Pay
                            </div>
                            <div className="text-xl font-bold text-blue-600">
                              ${payrollCalculations.finalDriverPay.toFixed(2)}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </Card>
        <EditTruckloadDialog
          isOpen={isEditDialogOpen}
          onOpenChange={setIsEditDialogOpen}
          truckloadId={selectedTruckloadId}
        />
        {selectedOrderIdForInfo !== null && (
          <OrderInfoDialog
            isOpen={isOrderInfoDialogOpen}
            onClose={() => setIsOrderInfoDialogOpen(false)}
            orderId={selectedOrderIdForInfo}
            onOrderUpdate={() => {
              // Refresh orders after saving
              if (selectedTruckloadId) {
                // trigger effect by resetting selection
                const id = selectedTruckloadId
                setSelectedTruckloadId(null)
                setTimeout(() => setSelectedTruckloadId(id), 0)
              }
            }}
          />
        )}
        <Dialog open={deductionDialogOpen} onOpenChange={setDeductionDialogOpen}>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>Add Manual Deduction</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="deduction-comment">Description</Label>
                <Textarea
                  id="deduction-comment"
                  placeholder="Enter description..."
                  value={deductionDialogComment}
                  onChange={(e) => setDeductionDialogComment(e.target.value)}
                  className="min-h-[80px]"
                  rows={3}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="deduction-applies-to">Applies To</Label>
                <Select
                  value={deductionDialogAppliesTo}
                  onValueChange={(value) => setDeductionDialogAppliesTo(value as 'load_value' | 'driver_pay')}
                >
                  <SelectTrigger id="deduction-applies-to">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="load_value">Load Value</SelectItem>
                    <SelectItem value="driver_pay">Driver Pay</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="deduction-amount">Amount ($)</Label>
                <Input
                  id="deduction-amount"
                  type="number"
                  placeholder="0.00"
                  value={deductionDialogAmount}
                  onChange={(e) => setDeductionDialogAmount(e.target.value)}
                  min="0"
                  step="0.01"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => {
                setDeductionDialogOpen(false)
                setDeductionDialogComment('')
                setDeductionDialogAmount('')
              }}>
                Cancel
              </Button>
              <Button onClick={handleSaveDeduction} className="bg-red-600 hover:bg-red-700">
                Add Deduction
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Single-Order Split Load Dialog */}
        <Dialog open={splitLoadDialogOpen} onOpenChange={setSplitLoadDialogOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Manage Split Load</DialogTitle>
              <DialogDescription>
                Set how the quote for this order is split between pickup and delivery assignments.
              </DialogDescription>
            </DialogHeader>
            
            {isLoadingSplitLoad ? (
              <div className="text-center py-8">Loading order information...</div>
            ) : !splitLoadData ? (
              <div className="text-center py-8 text-gray-500">Failed to load order information</div>
            ) : (
              <div className="space-y-4">
                <div className="border rounded-lg p-4 bg-gray-50">
                  <div className="space-y-2">
                    <div className="font-semibold">Order #{splitLoadData.orderId}</div>
                    <div className="text-sm text-gray-600">
                      <div>Pickup: {splitLoadData.pickupCustomerName || 'Unknown'}</div>
                      <div>Delivery: {splitLoadData.deliveryCustomerName || 'Unknown'}</div>
                      <div className="mt-2 font-medium">Full Quote: ${(typeof splitLoadData.fullQuote === 'number' ? splitLoadData.fullQuote : parseFloat(String(splitLoadData.fullQuote || 0)) || 0).toFixed(2)}</div>
                    </div>
                  </div>
                </div>

                {splitLoadData.pendingSplit && (
                  <div className="border rounded-lg p-4 bg-amber-50 border-amber-200">
                    <div className="flex items-start gap-2">
                      <AlertTriangle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
                      <div className="flex-1">
                        <div className="font-semibold text-amber-900 mb-1">Pending Split Load</div>
                        <div className="text-sm text-amber-800">
                          This split load is configured but waiting for the {splitLoadData.pendingSplit.existingAssignmentType === 'pickup' ? 'delivery' : 'pickup'} assignment to be created. 
                          It will be automatically applied when the missing assignment is added to a truckload.
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="misc-value">Misc Value ($)</Label>
                    <Input
                      id="misc-value"
                      type="number"
                      step="0.01"
                      min="0"
                      value={splitLoadMiscValue}
                      onChange={(e) => setSplitLoadMiscValue(e.target.value)}
                      placeholder="Enter misc amount"
                    />
                    {splitLoadData.fullQuote && parseFloat(splitLoadMiscValue) > (splitLoadData.fullQuote || 0) && (
                      <div className="text-sm text-amber-600 bg-amber-50 p-2 rounded">
                        ⚠️ Warning: Misc value is greater than full quote
                      </div>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label>Which assignment gets full quote - misc?</Label>
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        variant={splitLoadFullQuoteAssignment === 'pickup' ? 'default' : 'outline'}
                        className="flex-1"
                        onClick={() => setSplitLoadFullQuoteAssignment('pickup')}
                      >
                        Pickup
                        {splitLoadData.pickupAssignment?.driverName && (
                          <span className="ml-2 text-xs opacity-75">
                            ({splitLoadData.pickupAssignment.driverName})
                          </span>
                        )}
                      </Button>
                      <Button
                        type="button"
                        variant={splitLoadFullQuoteAssignment === 'delivery' ? 'default' : 'outline'}
                        className="flex-1"
                        onClick={() => setSplitLoadFullQuoteAssignment('delivery')}
                      >
                        Delivery
                        {splitLoadData.deliveryAssignment?.driverName && (
                          <span className="ml-2 text-xs opacity-75">
                            ({splitLoadData.deliveryAssignment.driverName})
                          </span>
                        )}
                      </Button>
                    </div>
                  </div>

                  <div className="space-y-4 border-t pt-4">
                    <div className="space-y-2">
                      <Label>Full Quote Assignment Applies To</Label>
                      <Select
                        value={splitLoadFullQuoteAppliesTo}
                        onValueChange={(value) => setSplitLoadFullQuoteAppliesTo(value as 'load_value' | 'driver_pay')}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="load_value">Load Value</SelectItem>
                          <SelectItem value="driver_pay">Driver Pay</SelectItem>
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-gray-500">
                        The deduction for the misc portion will apply to {splitLoadFullQuoteAppliesTo === 'load_value' ? 'load value' : 'driver pay'} for the {splitLoadFullQuoteAssignment === 'pickup' ? 'pickup' : 'delivery'} truckload.
                      </p>
                    </div>

                    <div className="space-y-2">
                      <Label>Misc Assignment Applies To</Label>
                      <Select
                        value={splitLoadMiscAppliesTo}
                        onValueChange={(value) => setSplitLoadMiscAppliesTo(value as 'load_value' | 'driver_pay')}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="load_value">Load Value</SelectItem>
                          <SelectItem value="driver_pay">Driver Pay</SelectItem>
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-gray-500">
                        The addition for the misc portion will apply to {splitLoadMiscAppliesTo === 'load_value' ? 'load value' : 'driver pay'} for the {splitLoadFullQuoteAssignment === 'pickup' ? 'delivery' : 'pickup'} truckload.
                      </p>
                    </div>
                  </div>

                  {splitLoadData.fullQuote && splitLoadMiscValue && (
                    <div className="border rounded-lg p-4 bg-blue-50">
                      <div className="text-sm font-semibold mb-2">Preview:</div>
                      <div className="space-y-1 text-sm">
                        <div>
                          {splitLoadFullQuoteAssignment === 'pickup' ? 'Pickup' : 'Delivery'}: 
                          <span className="font-medium ml-2">
                            ${((typeof splitLoadData.fullQuote === 'number' ? splitLoadData.fullQuote : parseFloat(String(splitLoadData.fullQuote || 0)) || 0) - parseFloat(splitLoadMiscValue || '0')).toFixed(2)}
                          </span>
                          <span className="text-xs text-gray-600 ml-2">
                            (deduction: ${parseFloat(splitLoadMiscValue || '0').toFixed(2)} to {splitLoadFullQuoteAppliesTo === 'load_value' ? 'load value' : 'driver pay'})
                          </span>
                        </div>
                        <div>
                          {splitLoadFullQuoteAssignment === 'pickup' ? 'Delivery' : 'Pickup'}: 
                          <span className="font-medium ml-2">
                            ${parseFloat(splitLoadMiscValue || '0').toFixed(2)}
                          </span>
                          <span className="text-xs text-gray-600 ml-2">
                            (addition: ${parseFloat(splitLoadMiscValue || '0').toFixed(2)} to {splitLoadMiscAppliesTo === 'load_value' ? 'load value' : 'driver pay'})
                          </span>
                        </div>
                        <div className="pt-2 border-t text-xs text-gray-600">
                          Both truckloads will show the full quote (${(typeof splitLoadData.fullQuote === 'number' ? splitLoadData.fullQuote : parseFloat(String(splitLoadData.fullQuote || 0)) || 0).toFixed(2)}) with manual deductions/additions applied.
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
            
            <DialogFooter>
              {splitLoadData?.hasSplitLoad && (
                <Button
                  variant="destructive"
                  onClick={clearSplitLoad}
                  disabled={isLoadingSplitLoad}
                >
                  Clear Split Load
                </Button>
              )}
              <Button variant="outline" onClick={() => setSplitLoadDialogOpen(false)}>
                Cancel
              </Button>
              <Button 
                onClick={saveSplitLoad} 
                disabled={isLoadingSplitLoad || !splitLoadMiscValue || parseFloat(splitLoadMiscValue || '0') <= 0}
              >
                Save
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  )
}


