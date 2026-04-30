'use client'

import React, { useState } from 'react'
import { Edit2, Check, X } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import type { PayCalculationMethod, PayrollTruckload } from '@/lib/driver-pay/types'
import { formatCurrency } from '@/lib/driver-pay/calculations'

interface PayMethodControlProps {
  truckload: PayrollTruckload
  onSaved: (updates: {
    payCalculationMethod: PayCalculationMethod
    payHours: number | null
    payManualAmount: number | null
  }) => void
}

interface MethodLabelProps {
  method: PayCalculationMethod
  hours: number | null
  amount: number | null
}

function methodColorClasses(method: PayCalculationMethod): string {
  if (method === 'hourly') return 'bg-amber-100 text-amber-800 border-amber-200'
  if (method === 'manual') return 'bg-purple-100 text-purple-800 border-purple-200'
  return 'bg-blue-100 text-blue-800 border-blue-200'
}

function MethodLabel({ method, hours, amount }: MethodLabelProps) {
  if (method === 'hourly') {
    return (
      <>
        <span>Hourly</span>
        {hours !== null && <span className="ml-1 font-normal">· {hours} hr</span>}
      </>
    )
  }
  if (method === 'manual') {
    return (
      <>
        <span>Manual</span>
        {amount !== null && (
          <span className="ml-1 font-normal">· {formatCurrency(amount)}</span>
        )}
      </>
    )
  }
  return <span>Auto</span>
}

export function PayMethodControl({ truckload, onSaved }: PayMethodControlProps) {
  const [open, setOpen] = useState(false)
  const [method, setMethod] = useState<PayCalculationMethod>(
    truckload.payCalculationMethod
  )
  const [hoursInput, setHoursInput] = useState<string>(
    truckload.payHours !== null ? String(truckload.payHours) : ''
  )
  const [amountInput, setAmountInput] = useState<string>(
    truckload.payManualAmount !== null ? String(truckload.payManualAmount) : ''
  )
  const [isSaving, setIsSaving] = useState(false)

  function handleOpenChange(next: boolean) {
    if (next) {
      // Reset form to current truckload values when opening.
      setMethod(truckload.payCalculationMethod)
      setHoursInput(truckload.payHours !== null ? String(truckload.payHours) : '')
      setAmountInput(
        truckload.payManualAmount !== null ? String(truckload.payManualAmount) : ''
      )
    }
    setOpen(next)
  }

  async function handleSave() {
    let payHours: number | null = null
    let payManualAmount: number | null = null

    if (method === 'hourly') {
      const parsed = parseFloat(hoursInput)
      if (!Number.isFinite(parsed) || parsed < 0) {
        toast.error('Hours must be a positive number')
        return
      }
      payHours = parsed
    } else if (method === 'manual') {
      if (amountInput.trim() === '') {
        payManualAmount = null
      } else {
        const parsed = parseFloat(amountInput)
        if (!Number.isFinite(parsed)) {
          toast.error('Amount must be a number')
          return
        }
        payManualAmount = parsed
      }
    }

    setIsSaving(true)
    try {
      const response = await fetch(`/api/truckloads/${truckload.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          payCalculationMethod: method,
          payHours,
          payManualAmount,
        }),
      })
      const data = await response.json()
      if (!data.success) throw new Error(data.error || 'Failed to update pay method')
      onSaved({ payCalculationMethod: method, payHours, payManualAmount })
      setOpen(false)
      toast.success('Pay method updated')
    } catch (error) {
      console.error('Error updating pay method:', error)
      toast.error('Failed to update pay method')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild onClick={(e) => e.stopPropagation()}>
        <button
          type="button"
          className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs font-semibold rounded border ${methodColorClasses(
            truckload.payCalculationMethod
          )} hover:opacity-80 transition-opacity`}
        >
          <MethodLabel
            method={truckload.payCalculationMethod}
            hours={truckload.payHours}
            amount={truckload.payManualAmount}
          />
          <Edit2 className="h-3 w-3 ml-0.5 opacity-60" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        className="w-72 p-3"
        align="start"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="space-y-2">
          <div className="text-xs font-semibold text-gray-500 uppercase">Pay Method</div>
          <div className="grid grid-cols-3 gap-1">
            <Button
              type="button"
              variant={method === 'automatic' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setMethod('automatic')}
              className="h-7 text-xs"
            >
              Auto
            </Button>
            <Button
              type="button"
              variant={method === 'hourly' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setMethod('hourly')}
              className="h-7 text-xs"
            >
              Hourly
            </Button>
            <Button
              type="button"
              variant={method === 'manual' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setMethod('manual')}
              className="h-7 text-xs"
            >
              Manual
            </Button>
          </div>

          {method === 'hourly' && (
            <div className="space-y-1">
              <label className="text-xs text-gray-600">Hours</label>
              <Input
                type="number"
                step="0.25"
                min="0"
                value={hoursInput}
                onChange={(e) => setHoursInput(e.target.value)}
                className="h-8 text-sm"
                placeholder="e.g. 8"
              />
            </div>
          )}

          {method === 'manual' && (
            <div className="space-y-1">
              <label className="text-xs text-gray-600">Amount</label>
              <Input
                type="number"
                step="0.01"
                value={amountInput}
                onChange={(e) => setAmountInput(e.target.value)}
                className="h-8 text-sm"
                placeholder="Leave blank to exclude from pay"
              />
              <p className="text-[10px] text-gray-400 leading-tight">
                Enter 0 for $0 pay; leave blank to exclude entirely.
              </p>
            </div>
          )}

          <div className="flex justify-end gap-1 pt-1">
            <Button
              size="sm"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={isSaving}
              className="h-7"
            >
              <X className="h-3.5 w-3.5 mr-1" />
              Cancel
            </Button>
            <Button size="sm" onClick={handleSave} disabled={isSaving} className="h-7">
              <Check className="h-3.5 w-3.5 mr-1" />
              Save
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}
