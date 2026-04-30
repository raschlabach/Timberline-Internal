'use client'

import React, { useEffect, useRef, useState } from 'react'
import { Pencil, Check, X } from 'lucide-react'
import { toast } from 'sonner'
import { formatCurrency } from '@/lib/driver-pay/calculations'

interface EditableQuoteProps {
  orderId: number
  // The full freight quote (the unmodified order quote). Null when missing.
  value: number | null
  onSaved: (newValue: number | null) => void
}

export function EditableQuote({ orderId, value, onSaved }: EditableQuoteProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [draft, setDraft] = useState<string>(value !== null ? String(value) : '')
  const [isSaving, setIsSaving] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (isEditing) {
      setDraft(value !== null ? String(value) : '')
      // Wait for render so the input exists.
      requestAnimationFrame(() => {
        inputRef.current?.focus()
        inputRef.current?.select()
      })
    }
  }, [isEditing, value])

  function startEdit(e: React.MouseEvent) {
    e.stopPropagation()
    setIsEditing(true)
  }

  function cancel() {
    setIsEditing(false)
    setDraft(value !== null ? String(value) : '')
  }

  async function save() {
    let parsed: number | null = null
    if (draft.trim() !== '') {
      const n = parseFloat(draft)
      if (!Number.isFinite(n) || n < 0) {
        toast.error('Quote must be a non-negative number')
        return
      }
      parsed = n
    }
    if (parsed === value) {
      setIsEditing(false)
      return
    }
    setIsSaving(true)
    try {
      const response = await fetch(`/api/orders/${orderId}/freight-quote`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ freightQuote: parsed }),
      })
      const data = await response.json()
      if (!data.success) throw new Error(data.error || 'Failed to update quote')
      onSaved(parsed)
      setIsEditing(false)
      toast.success('Quote updated')
    } catch (error) {
      console.error('Error updating freight quote:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to update quote')
    } finally {
      setIsSaving(false)
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      e.preventDefault()
      save()
    } else if (e.key === 'Escape') {
      e.preventDefault()
      cancel()
    }
  }

  if (isEditing) {
    return (
      <div
        className="flex items-center gap-1 min-w-0"
        onClick={(e) => e.stopPropagation()}
      >
        <input
          ref={inputRef}
          type="number"
          step="0.01"
          min="0"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={handleKeyDown}
          className="w-24 h-7 text-sm font-semibold text-right border border-gray-300 rounded px-1.5"
          disabled={isSaving}
        />
        <button
          type="button"
          onClick={save}
          disabled={isSaving}
          className="text-green-600 hover:text-green-800 disabled:opacity-50"
          aria-label="Save"
        >
          <Check className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={cancel}
          disabled={isSaving}
          className="text-gray-400 hover:text-gray-600 disabled:opacity-50"
          aria-label="Cancel"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    )
  }

  return (
    <button
      type="button"
      onClick={startEdit}
      className="group inline-flex items-center gap-1 hover:bg-gray-100 rounded px-1 -mx-1"
      title="Click to edit quote"
    >
      <span className="text-sm font-semibold text-gray-900">
        {value !== null ? formatCurrency(value) : '—'}
      </span>
      <Pencil className="h-3 w-3 text-gray-300 group-hover:text-gray-500" />
    </button>
  )
}
