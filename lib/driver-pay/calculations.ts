// Pure pay calculations. No React, no fetch, no DOM.
// Both the new payroll page and any future tests can call these.
//
// Behavior is intentionally a one-to-one port from the legacy
// driver-pay-page calculateTruckloadTotals/calculateDriverTotals
// so existing pay numbers do not change.

import type {
  PayrollAdjustment,
  PayrollDriver,
  PayrollDriverHour,
  PayrollOrder,
  PayrollTruckload,
} from './types'

export interface TruckloadTotals {
  totalQuotes: number
  pickupDeliveryDeductionsFromLoadValue: number
  manualDeductionsFromLoadValue: number
  splitLoadDeductionsFromLoadValue: number
  splitLoadAdditionsToLoadValue: number
  manualAdditionsToLoadValue: number
  loadValue: number
  baseDriverPay: number
  pickupDeliveryDeductionsFromDriverPay: number
  manualDeductionsFromDriverPay: number
  splitLoadDeductionsFromDriverPay: number
  splitLoadAdditionsToDriverPay: number
  manualAdditionsToDriverPay: number
  driverPay: number
  pickupCount: number
  deliveryCount: number
  // Convenience totals across both load-value and driver-pay sides.
  totalDeductions: number
  totalAdditions: number
}

export interface DriverWeeklyTotals {
  totalQuotes: number
  loadValue: number
  miscDrivingHours: number
  miscDrivingTotal: number
  maintenanceHours: number
  maintenanceTotal: number
  truckloadDriverPayTotal: number
  weeklyDriverPay: number
  // Pay broken down by how each load was calculated
  automaticPayTotal: number
  hourlyPayTotal: number
  manualPayTotal: number
  automaticLoadCount: number
  hourlyLoadCount: number
  manualLoadCount: number
}

// Group orders by orderId to combine transfer orders so an order that has
// both a pickup and a delivery on the same truckload is counted once.
function groupOrdersByOrderId(orders: PayrollOrder[]): Map<number, PayrollOrder[]> {
  const groups = new Map<number, PayrollOrder[]>()
  for (const order of orders) {
    const existing = groups.get(order.orderId) || []
    existing.push(order)
    groups.set(order.orderId, existing)
  }
  return groups
}

// Build the flat order list used for quote totalling. Transfers get one
// entry (the delivery side, matching legacy invoice page behavior).
function flattenForQuoteSum(orderGroups: Map<number, PayrollOrder[]>): PayrollOrder[] {
  const flat: PayrollOrder[] = []
  Array.from(orderGroups.values()).forEach((groupOrders: PayrollOrder[]) => {
    const hasPickup = groupOrders.some((o) => o.assignmentType === 'pickup')
    const hasDelivery = groupOrders.some((o) => o.assignmentType === 'delivery')
    const isTransfer = hasPickup && hasDelivery

    if (isTransfer) {
      const deliveryOrder = groupOrders.find((o) => o.assignmentType === 'delivery')
      flat.push(deliveryOrder || groupOrders[0])
    } else {
      flat.push(...groupOrders)
    }
  })
  return flat
}

function sumQuotes(flatOrders: PayrollOrder[]): number {
  return flatOrders.reduce((sum, order) => {
    if (order.excludeFromLoadValue) return sum

    let fullQuote: number
    if (order.fullQuote !== null && order.fullQuote !== undefined) {
      fullQuote = order.fullQuote
    } else if (order.freightQuote !== null && order.freightQuote !== undefined) {
      fullQuote = order.freightQuote
    } else {
      return sum
    }

    if (!Number.isFinite(fullQuote) || fullQuote <= 0) return sum

    // Split load: assignmentQuote represents this assignment's portion of the
    // full quote. The "misc" side (smaller portion) is excluded from load
    // value; the "full quote - misc" side gets the full quote counted.
    if (order.assignmentQuote !== null && order.assignmentQuote !== undefined) {
      const assignmentQuote = order.assignmentQuote
      const otherPortion = fullQuote - assignmentQuote
      if (assignmentQuote < otherPortion) {
        return sum
      }
      return sum + fullQuote
    }

    return sum + fullQuote
  }, 0)
}

function countPickupsAndDeliveries(orderGroups: Map<number, PayrollOrder[]>): {
  pickupCount: number
  deliveryCount: number
} {
  let pickupCount = 0
  let deliveryCount = 0
  Array.from(orderGroups.values()).forEach((groupOrders: PayrollOrder[]) => {
    const hasPickup = groupOrders.some((o) => o.assignmentType === 'pickup')
    const hasDelivery = groupOrders.some((o) => o.assignmentType === 'delivery')
    const isTransfer = hasPickup && hasDelivery

    if (isTransfer) {
      pickupCount += 1
      deliveryCount += 1
    } else {
      pickupCount += groupOrders.filter((o) => o.assignmentType === 'pickup').length
      deliveryCount += groupOrders.filter((o) => o.assignmentType === 'delivery').length
    }
  })
  return { pickupCount, deliveryCount }
}

interface AdjustmentMatcher {
  isManual?: boolean
  isAddition?: boolean
  appliesTo: 'load_value' | 'driver_pay'
  hasOrderId?: boolean
  isSplitLoad?: boolean
  orderIdInTruckload?: Set<string>
}

// Sum adjustments matching every supplied predicate. Treats unspecified
// predicates as "don't care."
function sumAdjustments(
  adjustments: PayrollAdjustment[],
  match: AdjustmentMatcher
): number {
  return adjustments.reduce((sum, adj) => {
    if (match.isManual !== undefined && adj.isManual !== match.isManual) return sum
    if (match.isAddition !== undefined && adj.isAddition !== match.isAddition) return sum
    if (adj.appliesTo !== match.appliesTo) {
      // Special case: legacy driver-pay-only entries may have a missing
      // appliesTo. Treat missing as 'driver_pay'.
      const effective = adj.appliesTo || 'driver_pay'
      if (effective !== match.appliesTo) return sum
    }
    if (match.hasOrderId !== undefined) {
      const hasOrderId = adj.orderId !== null && adj.orderId !== undefined
      if (hasOrderId !== match.hasOrderId) return sum
    }
    if (match.isSplitLoad !== undefined) {
      const isSplitLoad = adj.splitLoadId !== null && adj.splitLoadId !== undefined
      if (isSplitLoad !== match.isSplitLoad) return sum
    }
    if (match.orderIdInTruckload && adj.orderId !== null && adj.orderId !== undefined) {
      if (!match.orderIdInTruckload.has(String(adj.orderId))) return sum
    }
    return sum + adj.amount
  }, 0)
}

export function calculateTruckloadTotals(
  truckload: PayrollTruckload,
  driverLoadPercentage: number,
  driverMiscDrivingRate: number
): TruckloadTotals {
  const orderGroups = groupOrdersByOrderId(truckload.orders)
  const flatOrders = flattenForQuoteSum(orderGroups)
  const totalQuotes = sumQuotes(flatOrders)
  const { pickupCount, deliveryCount } = countPickupsAndDeliveries(orderGroups)

  const currentOrderIds = new Set(truckload.orders.map((o) => String(o.orderId)))

  // Load-value-side adjustments
  const pickupDeliveryDeductionsFromLoadValue = sumAdjustments(truckload.adjustments, {
    isManual: true,
    isAddition: false,
    appliesTo: 'load_value',
    isSplitLoad: false,
    hasOrderId: true,
  })

  const manualDeductionsFromLoadValue = sumAdjustments(truckload.adjustments, {
    isManual: true,
    isAddition: false,
    appliesTo: 'load_value',
    isSplitLoad: false,
    hasOrderId: false,
  })

  const manualAdditionsToLoadValue = sumAdjustments(truckload.adjustments, {
    isManual: true,
    isAddition: true,
    appliesTo: 'load_value',
    isSplitLoad: false,
    hasOrderId: false,
  })

  const splitLoadDeductionsFromLoadValue = sumAdjustments(truckload.adjustments, {
    isAddition: false,
    appliesTo: 'load_value',
    isSplitLoad: true,
    hasOrderId: true,
    orderIdInTruckload: currentOrderIds,
  })

  const splitLoadAdditionsToLoadValue = sumAdjustments(truckload.adjustments, {
    isAddition: true,
    appliesTo: 'load_value',
    isSplitLoad: true,
    hasOrderId: true,
    orderIdInTruckload: currentOrderIds,
  })

  // Driver-pay-side adjustments
  const pickupDeliveryDeductionsFromDriverPay = sumAdjustments(truckload.adjustments, {
    isManual: true,
    isAddition: false,
    appliesTo: 'driver_pay',
    isSplitLoad: false,
    hasOrderId: true,
  })

  const manualDeductionsFromDriverPay = sumAdjustments(truckload.adjustments, {
    isManual: true,
    isAddition: false,
    appliesTo: 'driver_pay',
    isSplitLoad: false,
    hasOrderId: false,
  })

  const manualAdditionsToDriverPay = sumAdjustments(truckload.adjustments, {
    isManual: true,
    isAddition: true,
    appliesTo: 'driver_pay',
    isSplitLoad: false,
    hasOrderId: false,
  })

  const splitLoadDeductionsFromDriverPay = sumAdjustments(truckload.adjustments, {
    isAddition: false,
    appliesTo: 'driver_pay',
    isSplitLoad: true,
    hasOrderId: true,
    orderIdInTruckload: currentOrderIds,
  })

  const splitLoadAdditionsToDriverPay = sumAdjustments(truckload.adjustments, {
    isAddition: true,
    appliesTo: 'driver_pay',
    isSplitLoad: true,
    hasOrderId: true,
    orderIdInTruckload: currentOrderIds,
  })

  const loadValue =
    totalQuotes -
    pickupDeliveryDeductionsFromLoadValue -
    manualDeductionsFromLoadValue -
    splitLoadDeductionsFromLoadValue +
    manualAdditionsToLoadValue +
    splitLoadAdditionsToLoadValue

  const baseDriverPay = (loadValue * driverLoadPercentage) / 100

  let driverPay: number
  if (truckload.payCalculationMethod === 'hourly' && truckload.payHours !== null) {
    driverPay = truckload.payHours * driverMiscDrivingRate
  } else if (truckload.payCalculationMethod === 'manual') {
    driverPay = truckload.payManualAmount !== null ? truckload.payManualAmount : 0
  } else {
    driverPay =
      baseDriverPay -
      pickupDeliveryDeductionsFromDriverPay -
      manualDeductionsFromDriverPay -
      splitLoadDeductionsFromDriverPay +
      manualAdditionsToDriverPay +
      splitLoadAdditionsToDriverPay
  }

  const totalDeductions =
    pickupDeliveryDeductionsFromLoadValue +
    manualDeductionsFromLoadValue +
    splitLoadDeductionsFromLoadValue +
    pickupDeliveryDeductionsFromDriverPay +
    manualDeductionsFromDriverPay +
    splitLoadDeductionsFromDriverPay

  const totalAdditions =
    manualAdditionsToLoadValue +
    splitLoadAdditionsToLoadValue +
    manualAdditionsToDriverPay +
    splitLoadAdditionsToDriverPay

  return {
    totalQuotes,
    pickupDeliveryDeductionsFromLoadValue,
    manualDeductionsFromLoadValue,
    splitLoadDeductionsFromLoadValue,
    splitLoadAdditionsToLoadValue,
    manualAdditionsToLoadValue,
    loadValue,
    baseDriverPay,
    pickupDeliveryDeductionsFromDriverPay,
    manualDeductionsFromDriverPay,
    splitLoadDeductionsFromDriverPay,
    splitLoadAdditionsToDriverPay,
    manualAdditionsToDriverPay,
    driverPay,
    pickupCount,
    deliveryCount,
    totalDeductions,
    totalAdditions,
  }
}

function sumHours(hours: PayrollDriverHour[], type: PayrollDriverHour['type']): number {
  return hours
    .filter((h) => h.type === type)
    .reduce((sum, h) => sum + (Number.isFinite(h.hours) ? h.hours : 0), 0)
}

export function calculateDriverWeeklyTotals(driver: PayrollDriver): DriverWeeklyTotals {
  let totalQuotes = 0
  let loadValue = 0
  let truckloadDriverPayTotal = 0
  let automaticPayTotal = 0
  let hourlyPayTotal = 0
  let manualPayTotal = 0
  let automaticLoadCount = 0
  let hourlyLoadCount = 0
  let manualLoadCount = 0

  for (const truckload of driver.truckloads) {
    const tl = calculateTruckloadTotals(
      truckload,
      driver.loadPercentage,
      driver.miscDrivingRate
    )
    totalQuotes += tl.totalQuotes
    loadValue += tl.loadValue
    truckloadDriverPayTotal += tl.driverPay

    if (truckload.payCalculationMethod === 'hourly') {
      hourlyPayTotal += tl.driverPay
      hourlyLoadCount += 1
    } else if (truckload.payCalculationMethod === 'manual') {
      manualPayTotal += tl.driverPay
      manualLoadCount += 1
    } else {
      automaticPayTotal += tl.driverPay
      automaticLoadCount += 1
    }
  }

  const miscDrivingHours = sumHours(driver.hours, 'misc_driving')
  const maintenanceHours = sumHours(driver.hours, 'maintenance')
  const miscDrivingTotal = miscDrivingHours * driver.miscDrivingRate
  const maintenanceTotal = maintenanceHours * driver.maintenanceRate

  const weeklyDriverPay = truckloadDriverPayTotal + miscDrivingTotal + maintenanceTotal

  return {
    totalQuotes,
    loadValue,
    miscDrivingHours,
    miscDrivingTotal,
    maintenanceHours,
    maintenanceTotal,
    truckloadDriverPayTotal,
    weeklyDriverPay,
    automaticPayTotal,
    hourlyPayTotal,
    manualPayTotal,
    automaticLoadCount,
    hourlyLoadCount,
    manualLoadCount,
  }
}

export function formatCurrency(value: number): string {
  return `$${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}
