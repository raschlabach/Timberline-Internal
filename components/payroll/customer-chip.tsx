'use client'

import React, { useState } from 'react'
import {
  Phone,
  MapPin,
  StickyNote,
  ArrowRight,
  ArrowLeft,
  DollarSign,
  Info,
} from 'lucide-react'
import { toast } from 'sonner'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import type { CustomerInfo, PayrollAdjustment } from '@/lib/driver-pay/types'
import { AdjustmentEditor, SaveAdjustmentInput } from './adjustment-editor'

interface CustomerChipProps {
  role: 'pickup' | 'delivery' | 'paying'
  customer: CustomerInfo | null
  // When provided, clicking the name opens the adjustment editor pre-filled
  // for this order + customer. Without these props, name is non-clickable.
  truckloadId?: number
  orderId?: number
  onAdjustmentAdded?: (adjustment: PayrollAdjustment) => void
}

function formatPhone(raw: string | null): string | null {
  if (!raw) return null
  const cleaned = raw.replace(/\D/g, '')
  if (cleaned.length === 10) {
    return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`
  }
  return raw
}

function formatAddress(c: CustomerInfo): string | null {
  const parts: string[] = []
  if (c.address) parts.push(c.address)
  const cityState = [c.city, c.state].filter(Boolean).join(', ')
  if (cityState) parts.push(cityState)
  if (c.zip) parts.push(c.zip)
  return parts.length > 0 ? parts.join(', ') : null
}

const roleConfig: Record<
  CustomerChipProps['role'],
  { label: string; text: string; icon: React.ReactNode }
> = {
  pickup: {
    label: 'Pickup',
    text: 'text-red-700 hover:text-red-900',
    icon: <ArrowLeft className="h-3.5 w-3.5" />,
  },
  delivery: {
    label: 'Delivery',
    text: 'text-gray-900 hover:text-black',
    icon: <ArrowRight className="h-3.5 w-3.5" />,
  },
  paying: {
    label: 'Paying',
    text: 'text-blue-700 hover:text-blue-900',
    icon: <DollarSign className="h-3.5 w-3.5" />,
  },
}

export function CustomerChip({
  role,
  customer,
  truckloadId,
  orderId,
  onAdjustmentAdded,
}: CustomerChipProps) {
  const config = roleConfig[role]
  const [editorOpen, setEditorOpen] = useState(false)

  const isMissing = !customer || !customer.name
  const name = customer?.name || `(no ${config.label.toLowerCase()})`

  const canAddAdjustment =
    !isMissing &&
    truckloadId !== undefined &&
    orderId !== undefined &&
    onAdjustmentAdded !== undefined

  async function handleSaveAdjustment(input: SaveAdjustmentInput) {
    if (!canAddAdjustment || !customer || !truckloadId || !orderId || !onAdjustmentAdded) return
    try {
      const response = await fetch(`/api/truckloads/${truckloadId}/adjustments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          orderId,
          ...input,
        }),
      })
      const data = await response.json()
      if (!data.success) throw new Error(data.error || 'Failed to add')

      const created: PayrollAdjustment = {
        id: data.adjustment.id,
        orderId: data.adjustment.orderId ?? null,
        splitLoadId: null,
        driverName: null,
        date: data.adjustment.date,
        action: data.adjustment.action ?? null,
        footage: 0,
        dimensions: null,
        amount: data.adjustment.amount,
        isManual: true,
        isAddition: data.adjustment.isAddition,
        appliesTo: data.adjustment.appliesTo,
        comment: data.adjustment.comment,
        customerName: data.adjustment.customerName ?? customer.name,
        excludedFromQb: data.adjustment.excludedFromQb ?? false,
        otherAssignmentInfo: null,
      }
      onAdjustmentAdded(created)
      toast.success('Adjustment added')
    } catch (error) {
      console.error('Error adding adjustment from customer click:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to add')
      throw error
    }
  }

  // Reusable info popover (the small `i` icon).
  const infoPopover =
    !isMissing && customer ? (
      <CustomerInfoPopover
        customer={customer}
        roleLabel={config.label}
        roleIcon={config.icon}
      />
    ) : null

  // Missing customer — show greyed-out, no actions.
  if (isMissing) {
    return (
      <span
        className="inline-flex items-center gap-1 text-sm text-gray-400 italic max-w-[180px]"
        title={`No ${config.label.toLowerCase()} customer`}
      >
        {config.icon}
        <span className="truncate">{name}</span>
      </span>
    )
  }

  // Customer name — opens the adjustment editor when clicked (matches the
  // legacy invoice page behavior).
  if (canAddAdjustment) {
    return (
      <span className="inline-flex items-center gap-1 max-w-[260px]">
        <AdjustmentEditor
          open={editorOpen}
          onOpenChange={setEditorOpen}
          attachedTo={`${config.label} — ${name}`}
          defaultCommentBuilder={(isAddition) =>
            isAddition ? `${name} extra charge` : `${name} volume discount`
          }
          onSave={handleSaveAdjustment}
        >
          <button
            type="button"
            onClick={(e) => e.stopPropagation()}
            title={`Add adjustment for ${config.label.toLowerCase()}: ${name}`}
            className={`inline-flex items-center gap-1 text-base font-bold ${config.text} hover:underline underline-offset-2 transition-colors min-w-0`}
          >
            {config.icon}
            <span className="truncate">{name}</span>
          </button>
        </AdjustmentEditor>
        {infoPopover}
      </span>
    )
  }

  // Read-only view (no truckload/order/handler provided): name is plain text.
  return (
    <span className="inline-flex items-center gap-1 max-w-[260px]">
      <span
        className={`inline-flex items-center gap-1 text-base font-bold ${config.text} min-w-0`}
        title={`${config.label}: ${name}`}
      >
        {config.icon}
        <span className="truncate">{name}</span>
      </span>
      {infoPopover}
    </span>
  )
}

// ---- Internal: customer info popover (the `i` icon) -------------------------

interface CustomerInfoPopoverProps {
  customer: CustomerInfo
  roleLabel: string
  roleIcon: React.ReactNode
}

function CustomerInfoPopover({ customer, roleLabel, roleIcon }: CustomerInfoPopoverProps) {
  const address = formatAddress(customer)
  const phone1 = formatPhone(customer.phone1)
  const phone2 = formatPhone(customer.phone2)
  const hasInfo = address || phone1 || phone2 || customer.notes

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          onClick={(e) => e.stopPropagation()}
          className="inline-flex items-center justify-center h-4 w-4 rounded text-gray-400 hover:text-gray-700 hover:bg-gray-100 flex-shrink-0"
          title={`${roleLabel} info`}
          aria-label={`${roleLabel} customer info`}
        >
          <Info className="h-3.5 w-3.5" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        className="w-72 p-3"
        align="start"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="space-y-2">
          <div className="flex items-center gap-1.5 pb-2 border-b">
            {roleIcon}
            <div className="text-[10px] font-semibold uppercase tracking-wide text-gray-500">
              {roleLabel} Customer
            </div>
          </div>
          <div className="font-semibold text-sm text-gray-900">{customer.name}</div>

          {!hasInfo && (
            <p className="text-xs text-gray-400 italic">No additional info on file.</p>
          )}

          {address && (
            <div className="flex items-start gap-2 text-xs">
              <MapPin className="h-3.5 w-3.5 text-gray-400 flex-shrink-0 mt-0.5" />
              <span className="text-gray-700">{address}</span>
            </div>
          )}

          {phone1 && (
            <div className="flex items-center gap-2 text-xs">
              <Phone className="h-3.5 w-3.5 text-gray-400 flex-shrink-0" />
              <a
                href={`tel:${customer.phone1}`}
                className="text-blue-700 hover:underline"
              >
                {phone1}
              </a>
            </div>
          )}
          {phone2 && (
            <div className="flex items-center gap-2 text-xs pl-5">
              <a
                href={`tel:${customer.phone2}`}
                className="text-blue-700 hover:underline"
              >
                {phone2}
              </a>
            </div>
          )}

          {customer.notes && (
            <div className="flex items-start gap-2 text-xs pt-1 border-t">
              <StickyNote className="h-3.5 w-3.5 text-gray-400 flex-shrink-0 mt-0.5" />
              <span className="text-gray-700 whitespace-pre-wrap">
                {customer.notes}
              </span>
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}
