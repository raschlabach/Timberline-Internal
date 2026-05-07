'use client'

import React, { useCallback, useEffect, useRef, useState } from 'react'
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
import { FreightEditorDialog } from './freight-editor-dialog'
import { HandledBy } from './handled-by'
import { OrderInfoButton } from './order-info-button'
import { OrderWarnings } from './order-warnings'
import { QbSidebar } from './qb-sidebar'
import { SplitExcludedQuote } from './split-excluded-quote'
import { SplitLoadButton } from './split-load-button'
import {
  calculateTruckloadQb,
  type OrderQbBreakdown,
} from '@/lib/driver-pay/calculations'

const COLUMN_COUNT = 14

interface OrdersListProps {
  truckload: PayrollTruckload
  driverName: string
  fuelSurchargePercentage: number
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
  // Used by the parent to measure this tbody's height so the QB sidebar
  // can mirror it. The parent passes a stable rowKey so it can correlate
  // measurements across renders.
  rowKey: string
  registerTbody: (key: string, el: HTMLTableSectionElement | null) => void
  onToggleExclude: (newValue: boolean) => void
  onAdjustmentsChange: (adjustments: PayrollAdjustment[]) => void
  onQuoteSaved: (newValue: number | null) => void
  onFreightSaved: (result: {
    skidsData: PayrollOrder['skidsData']
    vinylData: PayrollOrder['vinylData']
    footage: number
  }) => void
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
  rowKey,
  registerTbody,
  onToggleExclude,
  onAdjustmentsChange,
  onQuoteSaved,
  onFreightSaved,
  onRefetch,
}: SortableOrderTbodyProps) {
  const sortableId =
    order.assignmentId !== null ? String(order.assignmentId) : `order-${order.orderId}`
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: sortableId })
  const [freightEditorOpen, setFreightEditorOpen] = useState(false)

  // Compose dnd-kit's tbody ref with our measurement registration so the
  // parent can observe this tbody's resize events.
  const composedRef = useCallback(
    (el: HTMLTableSectionElement | null) => {
      setNodeRef(el)
      registerTbody(rowKey, el)
    },
    [setNodeRef, rowKey, registerTbody]
  )

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
    <tbody ref={composedRef} style={style} className={isDragging ? 'shadow-lg' : ''}>
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

        <td className={`${cellPad} ${cellBgClass} ${cellBorderTop} text-right whitespace-nowrap p-0`}>
          <button
            type="button"
            onClick={() => setFreightEditorOpen(true)}
            className="w-full h-full px-2 py-2.5 text-sm font-medium text-gray-700 text-right hover:bg-black/5 rounded transition-colors cursor-pointer"
            title="Click to edit skid / vinyl details"
          >
            {order.footage.toFixed(0)} ft²
          </button>
        </td>

        <td className={`${cellPad} ${cellBgClass} ${cellBorderTop} whitespace-nowrap p-0`}>
          <button
            type="button"
            onClick={() => setFreightEditorOpen(true)}
            className="w-full h-full px-2 py-2.5 text-sm text-gray-700 text-left hover:bg-black/5 rounded transition-colors cursor-pointer"
            title={
              skidsLabel
                ? `Click to edit — current: ${skidsLabel}`
                : 'Click to add skid / vinyl details'
            }
          >
            {skidsLabel ? skidsLabel : <span className="text-gray-300">—</span>}
          </button>
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

      {/* SUB-ROW: warnings on the left (split / middlefield labels),
          adjustments anchored to the right near the quote / deduction columns */}
      <tr>
        <td
          colSpan={COLUMN_COUNT}
          className={`${cellBgClass} border-l-2 border-r-2 border-b-2 ${rowBorder} rounded-b-md px-3 py-1`}
        >
          <div className="flex items-start gap-3">
            <div className="flex-1 min-w-0 flex justify-end pt-0.5">
              <OrderWarnings
                order={order}
                isTransfer={isTransfer}
                allAdjustments={allAdjustments}
              />
            </div>
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
          <FreightEditorDialog
            open={freightEditorOpen}
            onOpenChange={setFreightEditorOpen}
            orderId={order.orderId}
            orderLabel={attachedToLabel}
            initialSkids={order.skidsData}
            initialVinyl={order.vinylData}
            onSaved={onFreightSaved}
          />
        </td>
      </tr>
    </tbody>
  )
}

export function OrdersList({
  truckload,
  driverName,
  fuelSurchargePercentage,
  onOrderUpdate,
  onOrdersReordered,
  onAdjustmentsChange,
  onRefetch,
}: OrdersListProps) {
  // Pre-compute the QB breakdown once per render. It returns one entry per
  // assignment row, keyed by orderId+assignmentId combo via row order.
  const qbBreakdown = calculateTruckloadQb(truckload, fuelSurchargePercentage)
  // Build a quick lookup keyed by `${orderId}-${assignmentId ?? 'none'}` so
  // we can match each rendered order row to its breakdown entry.
  const qbByRowKey = new Map<string, OrderQbBreakdown>()
  truckload.orders.forEach((order, idx) => {
    const breakdown = qbBreakdown.perOrder[idx]
    if (!breakdown) return
    const key = `${order.orderId}-${order.assignmentId ?? 'none'}`
    qbByRowKey.set(key, breakdown)
  })
  const [savingOrder, setSavingOrder] = useState(false)

  // Track the rendered height of each order tbody so the QB sidebar can
  // size its mirror rows to match. ResizeObserver fires on initial paint
  // AND on any layout change (e.g. adjustments added).
  const orderTbodyRefs = useRef<Map<string, HTMLTableSectionElement>>(new Map())
  const observerRef = useRef<ResizeObserver | null>(null)
  const [tbodyHeights, setTbodyHeights] = useState<Record<string, number>>({})

  useEffect(() => {
    if (typeof window === 'undefined') return
    observerRef.current = new ResizeObserver((entries) => {
      setTbodyHeights((prev) => {
        const next = { ...prev }
        let changed = false
        entries.forEach((entry) => {
          const el = entry.target as HTMLElement
          let key: string | undefined
          orderTbodyRefs.current.forEach((v, k) => {
            if (v === el) key = k
          })
          if (!key) return
          // Use the bounding rect height — contentRect doesn't include
          // padding/borders we need.
          const h = el.getBoundingClientRect().height
          if (Math.abs((prev[key] || 0) - h) > 0.5) {
            next[key] = h
            changed = true
          }
        })
        return changed ? next : prev
      })
    })
    orderTbodyRefs.current.forEach((el) => observerRef.current!.observe(el))
    return () => {
      observerRef.current?.disconnect()
      observerRef.current = null
    }
  }, [])

  const registerTbody = useCallback(
    (key: string, el: HTMLTableSectionElement | null) => {
      const previous = orderTbodyRefs.current.get(key)
      if (previous && previous !== el && observerRef.current) {
        observerRef.current.unobserve(previous)
      }
      if (el) {
        orderTbodyRefs.current.set(key, el)
        if (observerRef.current && previous !== el) {
          observerRef.current.observe(el)
        }
        // Seed initial height in case the observer hasn't fired yet.
        const h = el.getBoundingClientRect().height
        setTbodyHeights((prev) =>
          Math.abs((prev[key] || 0) - h) > 0.5 ? { ...prev, [key]: h } : prev
        )
      } else {
        orderTbodyRefs.current.delete(key)
        setTbodyHeights((prev) => {
          if (!(key in prev)) return prev
          const next = { ...prev }
          delete next[key]
          return next
        })
      }
    },
    []
  )

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  // Group assignments by orderId so transfers (same order having both a
  // pickup and a delivery on this load) render as a single row instead of
  // two. The "primary" of each group is the delivery side when both
  // halves are present (matches legacy load-value math, which only counts
  // the delivery for transfers); otherwise it's the only assignment.
  interface OrderGroup {
    orderId: number
    isTransfer: boolean
    primary: PayrollOrder
    pickup: PayrollOrder | null
    delivery: PayrollOrder | null
    members: PayrollOrder[]
  }

  const orderGroupsByOrderId = new Map<number, PayrollOrder[]>()
  truckload.orders.forEach((o) => {
    const list = orderGroupsByOrderId.get(o.orderId) ?? []
    list.push(o)
    orderGroupsByOrderId.set(o.orderId, list)
  })

  const orderGroups: OrderGroup[] = []
  orderGroupsByOrderId.forEach((members, orderId) => {
    const pickup = members.find((m) => m.assignmentType === 'pickup') ?? null
    const delivery = members.find((m) => m.assignmentType === 'delivery') ?? null
    const isTransfer = !!pickup && !!delivery && members.length >= 2
    const primary = isTransfer
      ? delivery ?? pickup ?? members[0]
      : delivery ?? pickup ?? members[0]
    orderGroups.push({
      orderId,
      isTransfer,
      primary: primary!,
      pickup,
      delivery,
      members,
    })
  })

  const sortedGroups = orderGroups.sort((a, b) => {
    const aSeq = a.primary.payrollSequence ?? a.primary.sequenceNumber ?? 0
    const bSeq = b.primary.payrollSequence ?? b.primary.sequenceNumber ?? 0
    return aSeq - bSeq
  })

  // Primary order per group, in display order — what the QB sidebar
  // iterates over. One QB block per visible order row.
  const sortedPrimaries = sortedGroups.map((g) => g.primary)

  async function handleToggleExclude(group: OrderGroup, newValue: boolean) {
    const assignmentIds = group.members
      .map((m) => m.assignmentId)
      .filter((id): id is number => id !== null)
    if (assignmentIds.length === 0) {
      toast.error('Cannot edit this order — no assignment ID')
      return
    }
    onOrderUpdate(group.orderId, { excludeFromLoadValue: newValue })
    try {
      // PATCH every assignment in the group so both halves of a transfer
      // stay in sync. Run in parallel — server treats each as independent.
      const results = await Promise.all(
        assignmentIds.map((assignmentId) =>
          fetch(
            `/api/truckloads/${truckload.id}/assignments/${assignmentId}`,
            {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              credentials: 'include',
              body: JSON.stringify({ excludeFromLoadValue: newValue }),
            }
          ).then((r) => r.json())
        )
      )
      if (results.some((r) => !r?.success)) {
        throw new Error('Failed to update')
      }
    } catch (error) {
      console.error('Error updating exclude flag:', error)
      toast.error('Failed to update order')
      onOrderUpdate(group.orderId, { excludeFromLoadValue: !newValue })
    }
  }

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return

    function groupSortableId(g: OrderGroup) {
      return g.primary.assignmentId !== null
        ? String(g.primary.assignmentId)
        : `order-${g.orderId}`
    }

    const oldIndex = sortedGroups.findIndex((g) => groupSortableId(g) === active.id)
    const newIndex = sortedGroups.findIndex((g) => groupSortableId(g) === over.id)
    if (oldIndex === -1 || newIndex === -1) return

    const reorderedGroups = arrayMove(sortedGroups, oldIndex, newIndex)

    // Flatten groups into individual assignments, keeping each transfer's
    // pickup immediately followed by its delivery so the persisted
    // sequence matches the visible row order. Sequence numbers run 1..N
    // through the flat list.
    const flatOrders: PayrollOrder[] = []
    reorderedGroups.forEach((g) => {
      if (g.isTransfer) {
        if (g.pickup) flatOrders.push(g.pickup)
        if (g.delivery) flatOrders.push(g.delivery)
      } else {
        flatOrders.push(...g.members)
      }
    })

    const reorderedWithSequence: PayrollOrder[] = flatOrders.map((o, i) => ({
      ...o,
      payrollSequence: i + 1,
    }))
    onOrdersReordered(reorderedWithSequence)

    const assignmentIds = flatOrders
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

  if (sortedGroups.length === 0) {
    return (
      <Card className="p-6 text-center text-sm text-gray-400 italic">
        No orders on this load.
      </Card>
    )
  }

  // One sortable entry PER GROUP — transfers track as a single item so
  // dragging moves both halves together.
  const sortableIds = sortedGroups.map((g) =>
    g.primary.assignmentId !== null
      ? String(g.primary.assignmentId)
      : `order-${g.orderId}`
  )

  return (
    <Card className="p-3 overflow-x-auto">
      <div className="flex items-start gap-6">
        <div className="min-w-0">
          <div className="flex items-center justify-between mb-2 gap-2">
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
                {sortedGroups.map((group, idx) => {
                  // One row per ORDER, not per assignment — transfers
                  // (same orderId with both pickup + delivery on this
                  // load) collapse into a single visual row. Adjustments
                  // are tied to orderId so they show once, not twice.
                  const orderAdjustments = truckload.adjustments.filter(
                    (a) =>
                      a.orderId === group.orderId &&
                      ((a.isManual && a.splitLoadId === null) || a.splitLoadId !== null)
                  )
                  const rowKey = `${group.primary.orderId}-${group.primary.assignmentId ?? 'none'}`
                  return (
                    <SortableOrderTbody
                      key={
                        group.primary.assignmentId ??
                        `order-${group.orderId}-${group.primary.assignmentType}`
                      }
                      truckload={truckload}
                      order={group.primary}
                      index={idx}
                      isTransfer={group.isTransfer}
                      driverName={driverName}
                      orderAdjustments={orderAdjustments}
                      allAdjustments={truckload.adjustments}
                      rowKey={rowKey}
                      registerTbody={registerTbody}
                      onToggleExclude={(checked) => handleToggleExclude(group, checked)}
                      onAdjustmentsChange={onAdjustmentsChange}
                      onQuoteSaved={(newValue) =>
                        onOrderUpdate(group.orderId, {
                          fullQuote: newValue,
                          freightQuote: newValue,
                        })
                      }
                      onFreightSaved={(result) =>
                        onOrderUpdate(group.orderId, {
                          skidsData: result.skidsData,
                          vinylData: result.vinylData,
                          footage: result.footage,
                        })
                      }
                      onRefetch={onRefetch}
                    />
                  )
                })}
              </table>
            </SortableContext>
          </DndContext>
        </div>

        <QbSidebar
          truckload={truckload}
          sortedOrders={sortedPrimaries}
          qbByRowKey={qbByRowKey}
          surchargePercentage={fuelSurchargePercentage}
          allAdjustments={truckload.adjustments}
          rowHeights={tbodyHeights}
          onAdjustmentsChange={onAdjustmentsChange}
        />
      </div>
    </Card>
  )
}
