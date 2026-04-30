// Shared types for the driver pay (payroll) page.
// Keeping these in one place so the page, the math, and any tests
// all agree on the data shape.

export type PayCalculationMethod = 'automatic' | 'hourly' | 'manual'
export type AssignmentType = 'pickup' | 'delivery'
export type DriverHourType = 'misc_driving' | 'maintenance'
export type AdjustmentAppliesTo = 'load_value' | 'driver_pay'

export interface DimensionEntry {
  width: number
  length: number
  quantity: number
}

export interface CustomerInfo {
  name: string | null
  phone1: string | null
  phone2: string | null
  notes: string | null
  address: string | null
  city: string | null
  state: string | null
  zip: string | null
}

export interface OtherHalfInfo {
  // 'pickup' = the other half (the pickup) lives on a different load
  // 'delivery' = same idea, but for delivery
  assignmentType: AssignmentType
  driverName: string | null
  assignmentDate: string | null
}

export interface PayrollOrder {
  orderId: number
  // Identifies the row in truckload_order_assignments. Used by APIs that
  // edit per-assignment fields (exclude_from_load_value, payroll_sequence).
  assignmentId: number | null
  // Original dispatch sequence (route order). Read-only here.
  sequenceNumber: number | null
  // Payroll-page-only display order. When null, falls back to sequenceNumber.
  payrollSequence: number | null
  assignmentType: AssignmentType
  freightQuote: number | null
  fullQuote: number | null
  assignmentQuote: number | null
  excludeFromLoadValue: boolean
  footage: number
  comments: string | null
  isRush: boolean
  needsAttention: boolean
  // Three customers: pickup, delivery, paying (paying may be missing)
  pickupCustomer: CustomerInfo
  deliveryCustomer: CustomerInfo
  payingCustomer: CustomerInfo | null
  // Convenience top-level names (legacy compatibility)
  pickupCustomerName: string | null
  deliveryCustomerName: string | null
  // Skids and vinyl breakdown for "dimensions" display
  skidsData: DimensionEntry[]
  vinylData: DimensionEntry[]
  // Order-level flags
  middlefield: boolean
  backhaul: boolean
  ohioToIndiana: boolean
  rrOrder: boolean
  // Who handles the other half of this order (pickup/delivery on a
  // different truckload). Null when this order has no other half assigned.
  otherHalf: OtherHalfInfo | null
}

export interface PayrollAdjustment {
  id: number
  orderId: number | null
  splitLoadId: number | null
  driverName: string | null
  date: string
  action: string | null
  footage: number
  dimensions: string | null
  amount: number
  isManual: boolean
  isAddition: boolean
  appliesTo: AdjustmentAppliesTo
  comment: string | null
  customerName: string | null
  // When TRUE, this adjustment is hidden from the QuickBooks
  // reconciliation total — it still affects load value and driver pay
  // normally. Used so admins can opt an individual adjustment out of
  // the QB invoice math when a deduction was internal-only.
  excludedFromQb: boolean
  otherAssignmentInfo: {
    assignmentType: AssignmentType
    customerName: string | null
    truckloadDate: string | null
    driverName: string | null
  } | null
}

export interface PayrollDriverHour {
  id: number
  date: string
  description: string | null
  hours: number
  type: DriverHourType
  isDriverSubmitted: boolean
  truckloadId: number | null
}

export interface PayrollTruckload {
  id: number
  startDate: string
  endDate: string
  billOfLadingNumber: string | null
  description: string | null
  orders: PayrollOrder[]
  adjustments: PayrollAdjustment[]
  payCalculationMethod: PayCalculationMethod
  payHours: number | null
  payManualAmount: number | null
  dispatchCheckedBy: string | null
  dispatchCheckedAt: string | null
  quickbooksCheckedBy: string | null
  quickbooksCheckedAt: string | null
}

export interface PayrollDriver {
  driverId: number
  driverName: string
  driverColor: string | null
  loadPercentage: number
  miscDrivingRate: number
  maintenanceRate: number
  defaultPayMethod: PayCalculationMethod
  truckloads: PayrollTruckload[]
  hours: PayrollDriverHour[]
}

export interface DateRange {
  startDate: string
  endDate: string
}
