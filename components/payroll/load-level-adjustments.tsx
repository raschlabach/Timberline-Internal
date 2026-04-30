'use client'

import React from 'react'
import { Card } from '@/components/ui/card'
import { AdjustmentRow } from './adjustment-row'
import { AddAdjustmentButton } from './add-adjustment-button'
import type {
  PayrollAdjustment,
  PayrollTruckload,
} from '@/lib/driver-pay/types'

interface LoadLevelAdjustmentsProps {
  truckload: PayrollTruckload
  onAdjustmentsChange: (adjustments: PayrollAdjustment[]) => void
}

export function LoadLevelAdjustments({
  truckload,
  onAdjustmentsChange,
}: LoadLevelAdjustmentsProps) {
  // Manual, no orderId, no splitLoadId — these are general truckload-level
  // adjustments (e.g. tarp rental, fuel surcharge).
  const manualLoadLevel = truckload.adjustments.filter(
    (a) => a.isManual && a.orderId === null && a.splitLoadId === null
  )

  // Split-load entries (auto-generated; read-only here). Show separately
  // so the user knows where they came from.
  const splitLoad = truckload.adjustments.filter((a) => a.splitLoadId !== null)

  const hasAny = manualLoadLevel.length > 0 || splitLoad.length > 0

  return (
    <Card className="p-3">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-semibold text-gray-900">Load-Level Adjustments</h3>
        <AddAdjustmentButton
          truckloadId={truckload.id}
          orderId={null}
          attachedTo="Whole load"
          variant="standalone"
          onAdded={(created) =>
            onAdjustmentsChange([...truckload.adjustments, created])
          }
        />
      </div>

      {!hasAny && (
        <p className="text-xs text-gray-400 italic py-1">
          No load-level adjustments. Adjustments tied to a specific order live with that order above.
        </p>
      )}

      {manualLoadLevel.length > 0 && (
        <table className="border-separate" style={{ borderSpacing: 0 }}>
          <tbody>
            {manualLoadLevel.map((adj) => (
              <AdjustmentRow
                key={adj.id}
                truckloadId={truckload.id}
                adjustment={adj}
                attachedTo="Whole load"
                indented={false}
                onUpdated={(updated) =>
                  onAdjustmentsChange(
                    truckload.adjustments.map((a) => (a.id === updated.id ? updated : a))
                  )
                }
                onDeleted={(adjustmentId) =>
                  onAdjustmentsChange(
                    truckload.adjustments.filter((a) => a.id !== adjustmentId)
                  )
                }
              />
            ))}
          </tbody>
        </table>
      )}

      {splitLoad.length > 0 && (
        <div className="mt-3 pt-3 border-t border-gray-100">
          <div className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-1">
            Split Load Entries
          </div>
          <table className="border-separate" style={{ borderSpacing: 0 }}>
            <tbody>
              {splitLoad.map((adj) => {
                const order = truckload.orders.find((o) => o.orderId === adj.orderId)
                const customer =
                  order?.assignmentType === 'pickup'
                    ? order?.pickupCustomerName
                    : order?.deliveryCustomerName
                const attachedTo = customer
                  ? `Split for ${customer}`
                  : 'Split load'
                return (
                  <AdjustmentRow
                    key={adj.id}
                    truckloadId={truckload.id}
                    adjustment={adj}
                    attachedTo={attachedTo}
                    indented={false}
                    onUpdated={(updated) =>
                      onAdjustmentsChange(
                        truckload.adjustments.map((a) => (a.id === updated.id ? updated : a))
                      )
                    }
                    onDeleted={(adjustmentId) =>
                      onAdjustmentsChange(
                        truckload.adjustments.filter((a) => a.id !== adjustmentId)
                      )
                    }
                  />
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  )
}
