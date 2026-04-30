'use client'

import React, { useEffect, useRef, useState } from 'react'
import { Plus, Minus, X, Check } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import type {
  AdjustmentAppliesTo,
  PayrollAdjustment,
} from '@/lib/driver-pay/types'

export interface AdjustmentDraft {
  isAddition: boolean
  amount: string
  appliesTo: AdjustmentAppliesTo
  comment: string
}

export interface SaveAdjustmentInput {
  isAddition: boolean
  amount: number
  appliesTo: AdjustmentAppliesTo
  comment: string
}

interface AdjustmentEditorProps {
  // Existing adjustment for edit mode; absent for add mode.
  existing?: PayrollAdjustment
  // Whether the editor is open.
  open: boolean
  onOpenChange: (open: boolean) => void
  // Element that triggers opening (e.g. a button or a row).
  children: React.ReactNode
  // Hint describing what this adjustment is attached to.
  attachedTo: string
  // Save handler — caller does the network call.
  onSave: (input: SaveAdjustmentInput) => Promise<void>
  // Optional delete handler (only shown in edit mode).
  onDelete?: () => Promise<void>
  // Optional smart default for the description. Called whenever the
  // user toggles between Deduction/Addition. The description auto-updates
  // as long as the user hasn't typed their own override.
  defaultCommentBuilder?: (isAddition: boolean) => string
}

export function AdjustmentEditor({
  existing,
  open,
  onOpenChange,
  children,
  attachedTo,
  onSave,
  onDelete,
  defaultCommentBuilder,
}: AdjustmentEditorProps) {
  const isEdit = !!existing

  const [isAddition, setIsAddition] = useState<boolean>(existing?.isAddition ?? false)
  const [amount, setAmount] = useState<string>(
    existing ? String(existing.amount) : ''
  )
  const [appliesTo, setAppliesTo] = useState<AdjustmentAppliesTo>(
    existing?.appliesTo ?? 'driver_pay'
  )
  const [comment, setComment] = useState<string>(existing?.comment ?? '')
  const [isSaving, setIsSaving] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

  // Track whether the user has typed their own description. While false,
  // the description auto-fills via defaultCommentBuilder whenever
  // isAddition flips. Once they type something, we leave it alone.
  const userEditedCommentRef = useRef(false)

  // When the editor opens, reset to the latest existing values (so cancel
  // and reopen behaves correctly).
  function handleOpenChange(next: boolean) {
    if (next) {
      const initialIsAddition = existing?.isAddition ?? false
      setIsAddition(initialIsAddition)
      setAmount(existing ? String(existing.amount) : '')
      setAppliesTo(existing?.appliesTo ?? 'driver_pay')
      userEditedCommentRef.current = false
      if (existing) {
        setComment(existing.comment ?? '')
      } else if (defaultCommentBuilder) {
        setComment(defaultCommentBuilder(initialIsAddition))
      } else {
        setComment('')
      }
    }
    onOpenChange(next)
  }

  // Auto-update the description when the user flips Deduction/Addition,
  // unless they've already typed their own.
  useEffect(() => {
    if (!open) return
    if (existing) return
    if (!defaultCommentBuilder) return
    if (userEditedCommentRef.current) return
    setComment(defaultCommentBuilder(isAddition))
    // We intentionally only watch isAddition + open; the builder is stable
    // for a given trigger element.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAddition, open])

  async function handleSave() {
    const parsed = parseFloat(amount)
    if (!Number.isFinite(parsed) || parsed <= 0) {
      toast.error('Amount must be a positive number')
      return
    }
    if (comment.trim() === '') {
      toast.error('Please add a short description')
      return
    }
    setIsSaving(true)
    try {
      await onSave({
        isAddition,
        amount: parsed,
        appliesTo,
        comment: comment.trim(),
      })
      onOpenChange(false)
    } finally {
      setIsSaving(false)
    }
  }

  async function handleDelete() {
    if (!onDelete) return
    setIsDeleting(true)
    try {
      await onDelete()
      onOpenChange(false)
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent
        className="w-80 p-3"
        align="start"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="space-y-3">
          <div>
            <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
              {isEdit ? 'Edit Adjustment' : 'Add Adjustment'}
            </div>
            <div className="text-[11px] text-gray-400 leading-tight mt-0.5">
              Attached to: <span className="text-gray-600">{attachedTo}</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-1">
            <Button
              type="button"
              size="sm"
              variant={!isAddition ? 'default' : 'outline'}
              onClick={() => setIsAddition(false)}
              className="h-8"
            >
              <Minus className="h-3.5 w-3.5 mr-1" />
              Deduction
            </Button>
            <Button
              type="button"
              size="sm"
              variant={isAddition ? 'default' : 'outline'}
              onClick={() => setIsAddition(true)}
              className="h-8"
            >
              <Plus className="h-3.5 w-3.5 mr-1" />
              Addition
            </Button>
          </div>

          <div className="space-y-1">
            <Label className="text-xs">Amount</Label>
            <Input
              type="number"
              step="0.01"
              min="0"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="h-8"
              placeholder="0.00"
              autoFocus={!isEdit}
            />
          </div>

          <div className="space-y-1">
            <Label className="text-xs">Applies To</Label>
            <div className="grid grid-cols-2 gap-1">
              <Button
                type="button"
                size="sm"
                variant={appliesTo === 'load_value' ? 'default' : 'outline'}
                onClick={() => setAppliesTo('load_value')}
                className="h-8 text-xs"
              >
                Load Value
              </Button>
              <Button
                type="button"
                size="sm"
                variant={appliesTo === 'driver_pay' ? 'default' : 'outline'}
                onClick={() => setAppliesTo('driver_pay')}
                className="h-8 text-xs"
              >
                Driver Pay
              </Button>
            </div>
            <p className="text-[10px] text-gray-400 leading-tight">
              {appliesTo === 'load_value'
                ? 'Affects the load value before the % calculation'
                : 'Applied directly to the driver pay total'}
            </p>
          </div>

          <div className="space-y-1">
            <Label className="text-xs">Description</Label>
            <Input
              type="text"
              value={comment}
              onChange={(e) => {
                setComment(e.target.value)
                userEditedCommentRef.current = true
              }}
              className="h-8"
              placeholder="e.g. Damage claim, Tarp rental, etc."
            />
          </div>

          <div className="flex justify-between items-center gap-1 pt-1">
            <div>
              {isEdit && onDelete && (
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={handleDelete}
                  disabled={isDeleting || isSaving}
                  className="h-7 text-xs text-red-600 hover:text-red-700 hover:bg-red-50"
                >
                  Delete
                </Button>
              )}
            </div>
            <div className="flex gap-1">
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={isSaving || isDeleting}
                className="h-7"
              >
                <X className="h-3.5 w-3.5 mr-1" />
                Cancel
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={handleSave}
                disabled={isSaving || isDeleting}
                className="h-7"
              >
                <Check className="h-3.5 w-3.5 mr-1" />
                Save
              </Button>
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}
