'use client'

import React, { useState } from 'react'
import { useSession } from 'next-auth/react'
import { Fuel, Pencil } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'

interface FuelSurchargePillProps {
  fuelSurchargePercentage: number
  isUpdating: boolean
  onSave: (next: number) => Promise<boolean>
}

// Compact pill rendered next to the date range. Shows the active fuel
// surcharge percentage; clicking it opens an admin-only editor that
// patches /api/payroll/settings. Non-admins see a read-only pill.
export function FuelSurchargePill({
  fuelSurchargePercentage,
  isUpdating,
  onSave,
}: FuelSurchargePillProps) {
  const { data: session } = useSession()
  const isAdmin = session?.user?.role === 'admin'
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState<string>(fuelSurchargePercentage.toFixed(2))

  function handleOpenChange(next: boolean) {
    if (next) setDraft(fuelSurchargePercentage.toFixed(2))
    setOpen(next)
  }

  async function handleSave() {
    const parsed = parseFloat(draft)
    if (!Number.isFinite(parsed)) return
    const ok = await onSave(parsed)
    if (ok) setOpen(false)
  }

  const formatted = `${fuelSurchargePercentage.toFixed(fuelSurchargePercentage % 1 === 0 ? 0 : 2)}%`

  if (!isAdmin) {
    return (
      <div
        className="inline-flex items-center gap-1.5 px-2.5 h-9 rounded-md border border-amber-200 bg-amber-50 text-amber-800 text-xs"
        title="Fuel surcharge applied to QuickBooks invoice totals"
      >
        <Fuel className="w-3.5 h-3.5" />
        <span className="font-medium">QB Surcharge:</span>
        <span className="font-bold">{formatted}</span>
      </div>
    )
  }

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="inline-flex items-center gap-1.5 px-2.5 h-9 rounded-md border border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-100 text-xs transition-colors"
          title="Click to edit (admin only)"
        >
          <Fuel className="w-3.5 h-3.5" />
          <span className="font-medium">QB Surcharge:</span>
          <span className="font-bold">{formatted}</span>
          <Pencil className="w-3 h-3 ml-0.5 opacity-60" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72">
        <div className="space-y-3">
          <div>
            <h4 className="text-sm font-semibold">Fuel surcharge</h4>
            <p className="text-xs text-gray-500 mt-0.5">
              Added to every billable freight quote on the QuickBooks invoice
              total. Does NOT affect driver pay.
            </p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="surcharge-input" className="text-xs">
              Percentage
            </Label>
            <div className="relative">
              <Input
                id="surcharge-input"
                type="number"
                min={0}
                max={100}
                step={0.25}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                className="pr-7"
                autoFocus
              />
              <span className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 text-sm pointer-events-none">
                %
              </span>
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setOpen(false)}
              disabled={isUpdating}
            >
              Cancel
            </Button>
            <Button size="sm" onClick={handleSave} disabled={isUpdating}>
              {isUpdating ? 'Saving...' : 'Save'}
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}
