'use client'

import React, { useState } from 'react'
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
import { GripVertical, Bell, AlertTriangle } from 'lucide-react'
import { toast } from 'sonner'
import { Card } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import type {
  PayrollAdjustment,
  PayrollOrder,
  PayrollTruckload,
} from '@/lib/driver-pay/types'
import { AdjustmentRow } from './adjustment-row'
import { AddAdjustmentButton } from './add-adjustment-button'
import { CrossDriverDeductionCell } from './cross-driver-deduction-cell'
import { CustomerChip } from './customer-chip'
import { EditableQuote } from './editable-quote'
import { HandledBy } from './handled-by'
import { OrderInfoButton } from './order-info-button'
import { SplitExcludedQuote } from './split-excluded-quote'
import { SplitLoadButton } from './split-load-button'

const COLUMN_COUNT = 14

interface OrdersListProps {
  truckload: PayrollTruckload
  driverName: string
  onOrderUpdate: (orderId: number, updates: Partial<PayrollOrder>) => void
  onOrdersReordered: (orderedOrders: PayrollOrder[]) => void
  onAdjustmentsChange: (adjustments: PayrollAdjustment[]) => void
  // Triggers a full refetch from the server. Used after creating a split
  // load (which may have updated multiple truckloads + an exclude flag).
  onRefetch: () => void
}

interface SortableOrderTbodyProps {
  truckload: PayrollTruckload
  order: PayrollOrder
  index: number
  isTransfer: boolean
  driverName: string
  orderAdjustments: PayrollAdjustment[]
  allAdjustments: PayrollAdjustment[]
  onToggleExclude: (newValue: boolean) => void
  onAdjustmentsChange: (adjustments: PayrollAdjustment[]) => void
  onQuoteSaved: (newValue: number | null) => void
  onRefetch: () => void
}

function SortableOrderTbody({
  truckload,
  order,
  index,
  isTransfer,
  driverName,
  orderAdjustments,
  allAdjustments,
  onToggleExclude,
  onAdjustmentsChange,
  onQuoteSaved,
  onRefetch,
}: SortableOrderTbodyProps) {
  const sortableId =
    order.assignmentId !== null ? String(order.assignmentId) : `order-${order.orderId}`
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: sortableId })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  const customerName =
    order.assignmentType === 'pickup'
      ? order.pickupCustomerName || 'Unknown pickup'
      : order.deliveryCustomerName || 'Unknown delivery'

  const isPickup = order.assignmentType === 'pickup'
  const typeBadge = isTransfer
    ? 'text-blue-700 bg-blue-100 border-blue-300'
    : isPickup
    ? 'text-red-700 bg-red-100 border-red-300'
    : 'text-gray-800 bg-gray-200 border-gray-400'
  const typeLabel = isTransfer ? 'P/D' : isPickup ? 'P' : 'D'
  const typeLabelLong = isTransfer ? 'Transfer' : isPickup ? 'Pickup' : 'Delivery'

  const rowShade = isTransfer
    ? 'bg-blue-50'
    : isPickup
    ? 'bg-red-50'
    : 'bg-gray-50'
  const rowBorder = isTransfer
    ? 'border-blue-200'
    : isPickup
    ? 'border-red-200'
    : 'border-gray-300'

  const isExcluded = order.excludeFromLoadValue
  const attachedToLabel = `${typeLabelLong} — ${customerName}`

  // Detect whether this order's quote is excluded specifically because of
  // a split load (vs. just a manual user toggle). When excluded AND there's
  // a split-load adjustment for this order on this truckload, we know the
  // exclude flag was set by the split flow.
  const splitLoadEntryHere = allAdjustments.find(
    (a) => a.orderId === order.orderId && a.splitLoadId !== null
  )
  const isSplitExcluded = isExcluded && !!splitLoadEntryHere

  // "2 - 4×4, 1 - 4×8" style breakdown — quantity then dimensions per entry.
  const skidsLabel = order.skidsData
    .filter((d) => d.quantity > 0)
    .map((d) => `${d.quantity} - ${d.width}×${d.length}`)
    .join(', ')

  const cellPad = 'px-2 py-2.5'
  const cellBorderTop = `border-t-2 ${rowBorder}`
  const cellBorderBot = `border-b border-gray-200`
  const cellBgClass = `${rowShade} ${isExcluded ? 'opacity-60' : ''}`

  return (
    <tbody ref={setNodeRef} style={style} className={isDragging ? 'shadow-lg' : ''}>
      {/* MAIN ROW: each cell is a column that auto-sizes to its widest content */}
      <tr>
        <td
          className={`${cellPad} ${cellBgClass} ${cellBorderTop} border-l-2 ${rowBorder} rounded-tl-md`}
        >
          <button
            type="button"
            {...attributes}
            {...listeners}
            className="text-gray-400 hover:text-gray-700 cursor-grab active:cursor-grabbing"
            aria-label="Drag to reorder"
          >
            <GripVertical className="h-5 w-5" />
          </button>
        </td>

        <td className={`${cellPad} ${cellBgClass} ${cellBorderTop} text-sm font-bold text-gray-700 text-right`}>
          {index + 1}
        </td>

        <td className={`${cellPad} ${cellBgClass} ${cellBorderTop}`}>
          <span
            className={`inline-flex items-center justify-center h-6 px-1.5 min-w-[28px] text-xs font-bold border rounded ${typeBadge}`}
            title={
              isTransfer
                ? 'This driver does both pickup and delivery (transfer)'
                : `This driver does the ${typeLabelLong.toLowerCase()}`
            }
          >
            {typeLabel}
          </span>
        </td>

        <td className={`${cellPad} ${cellBgClass} ${cellBorderTop} whitespace-nowrap`}>
          <CustomerChip
            role="pickup"
            customer={order.pickupCustomer}
            truckloadId={truckload.id}
            orderId={order.orderId}
            onAdjustmentAdded={(created) =>
              onAdjustmentsChange([...allAdjustments, created])
            }
          />
        </td>

        <td className={`${cellPad} ${cellBgClass} ${cellBorderTop} whitespace-nowrap`}>
          <CustomerChip
            role="delivery"
            customer={order.deliveryCustomer}
            truckloadId={truckload.id}
            orderId={order.orderId}
            onAdjustmentAdded={(created) =>
              onAdjustmentsChange([...allAdjustments, created])
            }
          />
        </td>

        <td className={`${cellPad} ${cellBgClass} ${cellBorderTop} whitespace-nowrap`}>
          <CustomerChip
            role="paying"
            customer={order.payingCustomer}
            truckloadId={truckload.id}
            orderId={order.orderId}
            onAdjustmentAdded={(created) =>
              onAdjustmentsChange([...allAdjustments, created])
            }
          />
        </td>

        <td className={`${cellPad} ${cellBgClass} ${cellBorderTop} whitespace-nowrap`}>
          <div className="flex items-center gap-1">
            {order.isRush && (
              <span
                className="inline-flex items-center gap-1 px-1.5 py-0.5 text-xs font-semibold rounded bg-red-200 text-red-900 border border-red-300"
                title="Rush order"
              >
                <Bell className="h-3 w-3" />
                Rush
              </span>
            )}
            {order.needsAttention && (
              <span
                className="inline-flex items-center gap-1 px-1.5 py-0.5 text-xs font-semibold rounded bg-yellow-200 text-yellow-900 border border-yellow-300"
                title="Needs attention"
              >
                <AlertTriangle className="h-3 w-3" />
                Attention
              </span>
            )}
          </div>
        </td>

        <td className={`${cellPad} ${cellBgClass} ${cellBorderTop} text-sm font-medium text-gray-700 text-right whitespace-nowrap`}>
          {order.footage.toFixed(0)} ft²
        </td>

        <td className={`${cellPad} ${cellBgClass} ${cellBorderTop} text-sm text-gray-700 whitespace-nowrap`}>
          {skidsLabel ? (
            <span title={`Skids: ${skidsLabel}`}>{skidsLabel}</span>
          ) : (
            <span className="text-gray-300">—</span>
          )}
        </td>

        <td className={`${cellPad} ${cellBgClass} ${cellBorderTop}`}>
          <OrderInfoButton order={order} />
        </td>

        <td className={`${cellPad} ${cellBgClass} ${cellBorderTop} whitespace-nowrap border-l border-gray-300`}>
          <HandledBy
            order={order}
            isTransfer={isTransfer}
            currentDriverName={driverName}
          />
        </td>

        <td className={`${cellPad} ${cellBgClass} ${cellBorderTop} whitespace-nowrap`}>
          <CrossDriverDeductionCell
            truckloadId={truckload.id}
            order={order}
            isTransfer={isTransfer}
            currentDriverName={driverName}
            allAdjustments={allAdjustments}
            onAdjustmentsChange={onAdjustmentsChange}
          />
        </td>

        <td className={`${cellPad} ${cellBgClass} ${cellBorderTop} whitespace-nowrap border-l border-gray-300`}>
          {isSplitExcluded ? (
            <SplitExcludedQuote
              originalQuote={order.fullQuote ?? order.freightQuote}
              splitEntry={splitLoadEntryHere ?? null}
            />
          ) : (
            <EditableQuote
              orderId={order.orderId}
              value={order.fullQuote ?? order.freightQuote}
              onSaved={onQuoteSaved}
            />
          )}
        </td>

        <td className={`${cellPad} ${cellBgClass} ${cellBorderTop} border-r-2 ${rowBorder} rounded-tr-md whitespace-nowrap`}>
          <label
            className="flex items-center gap-1 text-xs text-gray-600 cursor-pointer hover:text-gray-900"
            title="Exclude this order's quote from the load value calculation"
          >
            <Checkbox
              checked={isExcluded}
              onCheckedChange={(checked) => onToggleExclude(checked === true)}
              className="h-3.5 w-3.5"
            />
            Exclude
          </label>
        </td>
      </tr>

      {/* SUB-ROW: adjustments anchored to the right side, near the quote / deduction columns */}
      <tr>
        <td
          colSpan={COLUMN_COUNT}
          className={`${cellBgClass} border-l-2 border-r-2 border-b-2 ${rowBorder} rounded-b-md px-3 py-1`}
        >
          <div className="flex justify-end items-start gap-2">
            <table className="border-separate bg-white/60 rounded px-1 py-0.5" style={{ borderSpacing: 0 }}>
              <tbody>
                {orderAdjustments.map((adj) => (
                  <AdjustmentRow
                    key={adj.id}
                    truckloadId={truckload.id}
                    adjustment={adj}
                    attachedTo={attachedToLabel}
                    indented
                    onUpdated={(updated) =>
                      onAdjustmentsChange(
                        allAdjustments.map((a) => (a.id === updated.id ? updated : a))
                      )
                    }
                    onDeleted={(adjustmentId) =>
                      onAdjustmentsChange(
                        allAdjustments.filter((a) => a.id !== adjustmentId)
                      )
                    }
                  />
                ))}
                <tr>
                  <td colSpan={4} className="pl-6 pr-2 py-0.5">
                    <div className="flex items-center gap-2">
                      <AddAdjustmentButton
                        truckloadId={truckload.id}
                        orderId={order.orderId}
                        attachedTo={attachedToLabel}
                        variant="standalone"
                        onAdded={(created) =>
                          onAdjustmentsChange([...allAdjustments, created])
                        }
                      />
                      <SplitLoadButton
                        truckload={truckload}
                        order={order}
                        orderAdjustments={orderAdjustments}
                        currentDriverName={driverName}
                        onChanged={onRefetch}
                      />
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </td>
      </tr>
    </tbody>
  )
}

export function OrdersList({
  truckload,
  driverName,
  onOrderUpdate,
  onOrdersReordered,
  onAdjustmentsChange,
  onRefetch,
}: OrdersListProps) {
  const [savingOrder, setSavingOrder] = useState(false)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  const sortedOrders = [...truckload.orders].sort((a, b) => {
    const aSeq = a.payrollSequence ?? a.sequenceNumber ?? 0
    const bSeq = b.payrollSequence ?? b.sequenceNumber ?? 0
    return aSeq - bSeq
  })

  const orderIdCounts = new Map<number, number>()
  truckload.orders.forEach((o) => {
    orderIdCounts.set(o.orderId, (orderIdCounts.get(o.orderId) ?? 0) + 1)
  })
  const transferOrderIds = new Set<number>()
  orderIdCounts.forEach((count, orderId) => {
    if (count > 1) transferOrderIds.add(orderId)
  })

  async function handleToggleExclude(order: PayrollOrder, newValue: boolean) {
    if (order.assignmentId === null) {
      toast.error('Cannot edit this order — no assignment ID')
      return
    }
    onOrderUpdate(order.orderId, { excludeFromLoadValue: newValue })
    try {
      const response = await fetch(
        `/api/truckloads/${truckload.id}/assignments/${order.assignmentId}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ excludeFromLoadValue: newValue }),
        }
      )
      const data = await response.json()
      if (!data.success) throw new Error(data.error || 'Failed to update')
    } catch (error) {
      console.error('Error updating exclude flag:', error)
      toast.error('Failed to update order')
      onOrderUpdate(order.orderId, { excludeFromLoadValue: !newValue })
    }
  }

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return

    const oldIndex = sortedOrders.findIndex(
      (o) =>
        (o.assignmentId !== null ? String(o.assignmentId) : `order-${o.orderId}`) ===
        active.id
    )
    const newIndex = sortedOrders.findIndex(
      (o) =>
        (o.assignmentId !== null ? String(o.assignmentId) : `order-${o.orderId}`) ===
        over.id
    )
    if (oldIndex === -1 || newIndex === -1) return

    const reordered = arrayMove(sortedOrders, oldIndex, newIndex)
    const reorderedWithSequence: PayrollOrder[] = reordered.map((o, i) => ({
      ...o,
      payrollSequence: i + 1,
    }))
    onOrdersReordered(reorderedWithSequence)

    const assignmentIds = reordered
      .map((o) => o.assignmentId)
      .filter((id): id is number => id !== null)

    if (assignmentIds.length === 0) return

    setSavingOrder(true)
    try {
      const response = await fetch(
        `/api/truckloads/${truckload.id}/payroll-order`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ assignmentIds }),
        }
      )
      const data = await response.json()
      if (!data.success) throw new Error(data.error || 'Failed to save order')
    } catch (error) {
      console.error('Error saving payroll order:', error)
      toast.error('Failed to save order — refresh to see saved state')
    } finally {
      setSavingOrder(false)
    }
  }

  if (sortedOrders.length === 0) {
    return (
      <Card className="p-6 text-center text-sm text-gray-400 italic">
        No orders on this load.
      </Card>
    )
  }

  const sortableIds = sortedOrders.map((o) =>
    o.assignmentId !== null ? String(o.assignmentId) : `order-${o.orderId}`
  )

  return (
    <Card className="p-3 overflow-x-auto">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-semibold text-gray-900">Orders</h3>
        {savingOrder && (
          <span className="text-[11px] text-gray-400 italic">Saving order…</span>
        )}
      </div>
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext items={sortableIds} strategy={verticalListSortingStrategy}>
          <table className="border-separate" style={{ borderSpacing: '0 6px' }}>
            {sortedOrders.map((order, idx) => {
              // Show under each order: manual non-split adjustments AND
              // split-load entries that are tied to this specific order.
              const orderAdjustments = truckload.adjustments.filter(
                (a) =>
                  a.orderId === order.orderId &&
                  ((a.isManual && a.splitLoadId === null) || a.splitLoadId !== null)
              )
              return (
                <SortableOrderTbody
                  key={order.assignmentId ?? `order-${order.orderId}-${order.assignmentType}`}
                  truckload={truckload}
                  order={order}
                  index={idx}
                  isTransfer={transferOrderIds.has(order.orderId)}
                  driverName={driverName}
                  orderAdjustments={orderAdjustments}
                  allAdjustments={truckload.adjustments}
                  onToggleExclude={(checked) => handleToggleExclude(order, checked)}
                  onAdjustmentsChange={onAdjustmentsChange}
                  onQuoteSaved={(newValue) =>
                    onOrderUpdate(order.orderId, {
                      fullQuote: newValue,
                      freightQuote: newValue,
                    })
                  }
                  onRefetch={onRefetch}
                />
              )
            })}
          </table>
        </SortableContext>
      </DndContext>
    </Card>
  )
}
