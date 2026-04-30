'use client'

import React, { useState } from 'react'
import { Check } from 'lucide-react'
import { toast } from 'sonner'
import { useSession } from 'next-auth/react'
import type { PayrollTruckload } from '@/lib/driver-pay/types'

type CheckType = 'dispatch' | 'quickbooks'

interface VerificationTogglesProps {
  truckload: PayrollTruckload
  onSaved: (updates: Partial<PayrollTruckload>) => void
}

interface CheckPillProps {
  label: string
  isChecked: boolean
  checkedBy: string | null
  isLoading: boolean
  onClick: (e: React.MouseEvent) => void
}

function CheckPill({ label, isChecked, checkedBy, isLoading, onClick }: CheckPillProps) {
  const baseClass =
    'inline-flex items-center gap-0.5 px-1.5 h-6 text-[11px] font-medium rounded border transition-colors disabled:opacity-50'
  const stateClass = isChecked
    ? 'bg-green-100 text-green-800 border-green-300 hover:bg-green-200'
    : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-50'

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={isLoading}
      className={`${baseClass} ${stateClass}`}
      title={isChecked && checkedBy ? `Checked by ${checkedBy}` : `Mark ${label} checked`}
    >
      <Check className={`h-3 w-3 ${isChecked ? 'opacity-100' : 'opacity-30'}`} />
      <span>{label}</span>
    </button>
  )
}

export function VerificationToggles({ truckload, onSaved }: VerificationTogglesProps) {
  const { data: session } = useSession()
  const [savingFor, setSavingFor] = useState<CheckType | null>(null)

  async function handleToggle(checkType: CheckType, e: React.MouseEvent) {
    e.stopPropagation()
    const checkedByField = checkType === 'dispatch' ? 'dispatchCheckedBy' : 'quickbooksCheckedBy'
    const checkedAtField = checkType === 'dispatch' ? 'dispatchCheckedAt' : 'quickbooksCheckedAt'
    const isCurrentlyChecked = !!truckload[checkedByField]
    const userName = session?.user?.name || 'Unknown'
    const now = new Date().toISOString()

    const updates = {
      [checkedByField]: isCurrentlyChecked ? null : userName,
      [checkedAtField]: isCurrentlyChecked ? null : now,
    } as Partial<PayrollTruckload>

    // Optimistic update
    onSaved(updates)
    setSavingFor(checkType)

    try {
      const response = await fetch(`/api/truckloads/${truckload.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(updates),
      })
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
    } catch (error) {
      console.error('Error toggling verification check:', error)
      toast.error('Failed to save verification check')
      // Revert
      onSaved({
        [checkedByField]: isCurrentlyChecked ? userName : null,
        [checkedAtField]: isCurrentlyChecked ? now : null,
      } as Partial<PayrollTruckload>)
    } finally {
      setSavingFor(null)
    }
  }

  return (
    <div className="flex items-center gap-1">
      <CheckPill
        label="Disp"
        isChecked={!!truckload.dispatchCheckedBy}
        checkedBy={truckload.dispatchCheckedBy}
        isLoading={savingFor === 'dispatch'}
        onClick={(e) => handleToggle('dispatch', e)}
      />
      <CheckPill
        label="QB"
        isChecked={!!truckload.quickbooksCheckedBy}
        checkedBy={truckload.quickbooksCheckedBy}
        isLoading={savingFor === 'quickbooks'}
        onClick={(e) => handleToggle('quickbooks', e)}
      />
    </div>
  )
}
