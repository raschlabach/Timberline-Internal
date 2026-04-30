'use client'

import React from 'react'
import { Info, AlertTriangle, Bell, MessageSquare } from 'lucide-react'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import type { DimensionEntry, PayrollOrder } from '@/lib/driver-pay/types'

interface OrderInfoButtonProps {
  order: PayrollOrder
}

function formatDimensions(entries: DimensionEntry[], unit: string): string | null {
  if (entries.length === 0) return null
  return entries
    .map((e) => `${e.quantity}× ${e.width}${unit}×${e.length}${unit}`)
    .join(', ')
}

export function OrderInfoButton({ order }: OrderInfoButtonProps) {
  const skidsLine = formatDimensions(order.skidsData, '')
  const vinylLine = formatDimensions(order.vinylData, '')
  const flags: { label: string; color: string }[] = []
  if (order.middlefield) flags.push({ label: 'Middlefield', color: 'bg-amber-100 text-amber-800 border-amber-200' })
  if (order.backhaul) flags.push({ label: 'Backhaul', color: 'bg-purple-100 text-purple-800 border-purple-200' })
  if (order.ohioToIndiana) flags.push({ label: 'OH → IN', color: 'bg-indigo-100 text-indigo-800 border-indigo-200' })

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          onClick={(e) => e.stopPropagation()}
          className="inline-flex items-center justify-center h-5 w-5 rounded text-gray-400 hover:text-gray-700 hover:bg-gray-100"
          aria-label="Order info"
          title="Order info"
        >
          <Info className="h-3.5 w-3.5" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        className="w-80 p-3"
        align="end"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="space-y-2.5">
          <div className="flex items-center justify-between pb-1 border-b">
            <div className="text-[10px] font-semibold uppercase tracking-wide text-gray-500">
              Order Info
            </div>
            <span className="text-[10px] text-gray-400">#{order.orderId}</span>
          </div>

          {(order.isRush || order.needsAttention || flags.length > 0) && (
            <div className="flex flex-wrap items-center gap-1">
              {order.isRush && (
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-semibold rounded bg-red-100 text-red-800 border border-red-200">
                  <Bell className="h-3 w-3" />
                  Rush
                </span>
              )}
              {order.needsAttention && (
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-semibold rounded bg-yellow-100 text-yellow-800 border border-yellow-200">
                  <AlertTriangle className="h-3 w-3" />
                  Attention
                </span>
              )}
              {flags.map((f) => (
                <span
                  key={f.label}
                  className={`inline-flex items-center px-1.5 py-0.5 text-[10px] font-semibold rounded border ${f.color}`}
                >
                  {f.label}
                </span>
              ))}
            </div>
          )}

          <div className="space-y-1">
            <div className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">
              Freight
            </div>
            <div className="text-xs text-gray-700">
              <span className="font-medium">Total: </span>
              {order.footage.toFixed(0)} ft²
            </div>
            {skidsLine && (
              <div className="text-xs text-gray-700">
                <span className="font-medium">Skids: </span>
                {skidsLine}
              </div>
            )}
            {vinylLine && (
              <div className="text-xs text-gray-700">
                <span className="font-medium">Vinyl: </span>
                {vinylLine}
              </div>
            )}
            {!skidsLine && !vinylLine && (
              <p className="text-[11px] text-gray-400 italic">
                No skids or vinyl detail on file.
              </p>
            )}
          </div>

          {order.comments && (
            <div className="pt-2 border-t">
              <div className="flex items-start gap-2">
                <MessageSquare className="h-3.5 w-3.5 text-gray-400 flex-shrink-0 mt-0.5" />
                <div className="text-xs text-gray-700 whitespace-pre-wrap">
                  {order.comments}
                </div>
              </div>
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}
