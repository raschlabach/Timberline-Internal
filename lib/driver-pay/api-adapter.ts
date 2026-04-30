// Adapts the legacy /api/drivers/pay-data response into our clean types.
// The API has loose, sometimes-missing fields. We normalize once here so
// the rest of the new page can trust the data it receives.

import type {
  AdjustmentAppliesTo,
  AssignmentType,
  CustomerInfo,
  DimensionEntry,
  DriverHourType,
  PayCalculationMethod,
  PayrollAdjustment,
  PayrollDriver,
  PayrollDriverHour,
  PayrollOrder,
  PayrollTruckload,
} from './types'

function toBool(value: unknown): boolean {
  if (value === true || value === 1) return true
  if (typeof value === 'string') return value.toLowerCase() === 'true'
  return false
}

function toNumber(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string') {
    const parsed = parseFloat(value)
    return Number.isFinite(parsed) ? parsed : 0
  }
  return 0
}

function toNullableNumber(value: unknown): number | null {
  if (value === null || value === undefined) return null
  if (typeof value === 'number') return Number.isFinite(value) ? value : null
  if (typeof value === 'string') {
    const parsed = parseFloat(value)
    return Number.isFinite(parsed) ? parsed : null
  }
  return null
}

function toPayMethod(value: unknown): PayCalculationMethod {
  if (value === 'hourly' || value === 'manual') return value
  return 'automatic'
}

function toAssignmentType(value: unknown): AssignmentType {
  return value === 'pickup' ? 'pickup' : 'delivery'
}

function toAppliesTo(value: unknown): AdjustmentAppliesTo {
  return value === 'load_value' ? 'load_value' : 'driver_pay'
}

function toHourType(value: unknown): DriverHourType {
  return value === 'maintenance' ? 'maintenance' : 'misc_driving'
}

function buildCustomerInfo(
  name: unknown,
  phone1: unknown,
  phone2: unknown,
  notes: unknown,
  address: unknown,
  city: unknown,
  state: unknown,
  zip: unknown
): CustomerInfo {
  return {
    name: typeof name === 'string' ? name : null,
    phone1: typeof phone1 === 'string' ? phone1 : null,
    phone2: typeof phone2 === 'string' ? phone2 : null,
    notes: typeof notes === 'string' ? notes : null,
    address: typeof address === 'string' ? address : null,
    city: typeof city === 'string' ? city : null,
    state: typeof state === 'string' ? state : null,
    zip: typeof zip === 'string' ? zip : null,
  }
}

function adaptDimensions(raw: unknown): DimensionEntry[] {
  if (!Array.isArray(raw)) return []
  // Parse all entries first.
  const parsed = raw
    .map((entry: any) => ({
      width: toNumber(entry?.width),
      length: toNumber(entry?.length),
      quantity: toNumber(entry?.quantity),
    }))
    .filter((d) => d.quantity > 0)

  // Combine entries with the same dimensions so "1 - 4×4, 1 - 4×4, 1 - 4×4"
  // becomes "3 - 4×4". Preserves first-seen order of unique sizes.
  const grouped = new Map<string, DimensionEntry>()
  for (const entry of parsed) {
    const key = `${entry.width}x${entry.length}`
    const existing = grouped.get(key)
    if (existing) {
      existing.quantity += entry.quantity
    } else {
      grouped.set(key, { ...entry })
    }
  }
  return Array.from(grouped.values())
}

function adaptOrder(raw: any): PayrollOrder {
  const pickupCustomer = buildCustomerInfo(
    raw.pickupCustomerName,
    raw.pickupPhone1,
    raw.pickupPhone2,
    raw.pickupNotes,
    raw.pickupAddress,
    raw.pickupCity,
    raw.pickupState,
    raw.pickupZip
  )
  const deliveryCustomer = buildCustomerInfo(
    raw.deliveryCustomerName,
    raw.deliveryPhone1,
    raw.deliveryPhone2,
    raw.deliveryNotes,
    raw.deliveryAddress,
    raw.deliveryCity,
    raw.deliveryState,
    raw.deliveryZip
  )
  const payingCustomer: CustomerInfo | null = raw.payingCustomerName
    ? buildCustomerInfo(
        raw.payingCustomerName,
        raw.payingPhone1,
        raw.payingPhone2,
        raw.payingNotes,
        raw.payingAddress,
        raw.payingCity,
        raw.payingState,
        raw.payingZip
      )
    : null

  return {
    orderId: toNumber(raw.orderId),
    assignmentId: toNullableNumber(raw.assignmentId),
    sequenceNumber: toNullableNumber(raw.sequenceNumber),
    payrollSequence: toNullableNumber(raw.payrollSequence),
    assignmentType: toAssignmentType(raw.assignmentType),
    freightQuote: toNullableNumber(raw.freightQuote),
    fullQuote: toNullableNumber(raw.fullQuote),
    assignmentQuote: toNullableNumber(raw.assignmentQuote),
    excludeFromLoadValue: toBool(raw.excludeFromLoadValue),
    footage: toNumber(raw.footage),
    comments: raw.comments ?? null,
    isRush: toBool(raw.isRush),
    needsAttention: toBool(raw.needsAttention),
    pickupCustomer,
    deliveryCustomer,
    payingCustomer,
    pickupCustomerName: pickupCustomer.name,
    deliveryCustomerName: deliveryCustomer.name,
    skidsData: adaptDimensions(raw.skidsData),
    vinylData: adaptDimensions(raw.vinylData),
    middlefield: toBool(raw.middlefield),
    backhaul: toBool(raw.backhaul),
    ohioToIndiana: toBool(raw.ohioToIndiana),
    rrOrder: toBool(raw.rrOrder),
    otherHalf: raw.otherHalf
      ? {
          assignmentType: toAssignmentType(raw.otherHalf.assignmentType),
          driverName:
            typeof raw.otherHalf.driverName === 'string'
              ? raw.otherHalf.driverName
              : null,
          assignmentDate:
            typeof raw.otherHalf.assignmentDate === 'string'
              ? raw.otherHalf.assignmentDate
              : null,
        }
      : null,
  }
}

function adaptAdjustment(raw: any): PayrollAdjustment {
  return {
    id: toNumber(raw.id),
    orderId: raw.orderId !== null && raw.orderId !== undefined ? toNumber(raw.orderId) : null,
    splitLoadId:
      raw.splitLoadId !== null && raw.splitLoadId !== undefined ? toNumber(raw.splitLoadId) : null,
    driverName: raw.driverName ?? null,
    date: String(raw.date ?? ''),
    action: raw.action ?? null,
    footage: toNumber(raw.footage),
    dimensions: raw.dimensions ?? null,
    amount: toNumber(raw.deduction),
    isManual: toBool(raw.isManual),
    isAddition: toBool(raw.isAddition),
    appliesTo: toAppliesTo(raw.appliesTo),
    comment: raw.comment ?? null,
    customerName: raw.customerName ?? null,
    excludedFromQb: toBool(raw.excludedFromQb),
    otherAssignmentInfo: raw.otherAssignmentInfo
      ? {
          assignmentType: toAssignmentType(raw.otherAssignmentInfo.assignmentType),
          customerName: raw.otherAssignmentInfo.customerName ?? null,
          truckloadDate: raw.otherAssignmentInfo.truckloadDate ?? null,
          driverName: raw.otherAssignmentInfo.driverName ?? null,
        }
      : null,
  }
}

function adaptHour(raw: any): PayrollDriverHour {
  return {
    id: toNumber(raw.id),
    date: String(raw.date ?? ''),
    description: raw.description ?? null,
    hours: toNumber(raw.hours),
    type: toHourType(raw.type),
    isDriverSubmitted: toBool(raw.isDriverSubmitted),
    truckloadId:
      raw.truckloadId !== null && raw.truckloadId !== undefined ? toNumber(raw.truckloadId) : null,
  }
}

function adaptTruckload(raw: any): PayrollTruckload {
  return {
    id: toNumber(raw.id),
    startDate: String(raw.startDate ?? ''),
    endDate: String(raw.endDate ?? raw.startDate ?? ''),
    billOfLadingNumber: raw.billOfLadingNumber ?? null,
    description: raw.description ?? null,
    orders: Array.isArray(raw.orders) ? raw.orders.map(adaptOrder) : [],
    adjustments: Array.isArray(raw.deductions) ? raw.deductions.map(adaptAdjustment) : [],
    payCalculationMethod: toPayMethod(raw.payCalculationMethod),
    payHours: toNullableNumber(raw.payHours),
    payManualAmount: toNullableNumber(raw.payManualAmount),
    dispatchCheckedBy: raw.dispatchCheckedBy ?? null,
    dispatchCheckedAt: raw.dispatchCheckedAt ?? null,
    quickbooksCheckedBy: raw.quickbooksCheckedBy ?? null,
    quickbooksCheckedAt: raw.quickbooksCheckedAt ?? null,
  }
}

export function adaptDriversResponse(raw: any): PayrollDriver[] {
  if (!raw || !Array.isArray(raw.drivers)) return []
  return raw.drivers.map((d: any) => ({
    driverId: toNumber(d.driverId),
    driverName: String(d.driverName ?? ''),
    driverColor: d.driverColor ?? null,
    loadPercentage: toNumber(d.loadPercentage),
    miscDrivingRate: toNumber(d.miscDrivingRate),
    maintenanceRate: toNumber(d.maintenanceRate),
    defaultPayMethod: toPayMethod(d.defaultPayMethod),
    truckloads: Array.isArray(d.truckloads) ? d.truckloads.map(adaptTruckload) : [],
    hours: Array.isArray(d.hours) ? d.hours.map(adaptHour) : [],
  }))
}
