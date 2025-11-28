import { TruckloadSummary } from '@/types/truckloads'

export interface ApiTruckload {
  id: number
  driverId: string | null
  startDate: string | null
  endDate: string | null
  trailerNumber: string | null
  billOfLadingNumber: string | null
  description: string | null
  isCompleted: boolean | null
  totalMileage: number | null
  estimatedDuration: number | null
  driverName: string | null
  driverColor: string | null
  pickupFootage: number | null
  deliveryFootage: number | null
  transferFootage: number | null
}

export interface ApiDriver {
  id: string
  full_name: string
  color: string | null
}

export interface DriverOption {
  id: string
  fullName: string
  color: string
}

export type TruckloadView = 'current' | 'completed'

export function mapTruckloadSummary(apiTruckload: ApiTruckload): TruckloadSummary {
  return {
    id: apiTruckload.id,
    driverId: apiTruckload.driverId ?? '',
    startDate: apiTruckload.startDate ?? '',
    endDate: apiTruckload.endDate ?? '',
    trailerNumber: apiTruckload.trailerNumber ?? '',
    billOfLadingNumber: apiTruckload.billOfLadingNumber ?? '',
    description: apiTruckload.description ?? '',
    isCompleted: Boolean(apiTruckload.isCompleted),
    totalMileage: apiTruckload.totalMileage ?? 0,
    estimatedDuration: apiTruckload.estimatedDuration ?? 0,
    driverName: apiTruckload.driverName ?? '',
    driverColor: apiTruckload.driverColor ?? '#808080',
    pickupFootage: apiTruckload.pickupFootage ?? 0,
    deliveryFootage: apiTruckload.deliveryFootage ?? 0,
    transferFootage: apiTruckload.transferFootage ?? 0
  }
}

export function mapDriverOption(apiDriver: ApiDriver): DriverOption {
  return {
    id: apiDriver.id,
    fullName: apiDriver.full_name,
    color: apiDriver.color ?? '#808080'
  }
}

export function filterAndSortTruckloads(
  truckloads: TruckloadSummary[],
  view: TruckloadView
): TruckloadSummary[] {
  const filtered = view === 'current'
    ? truckloads.filter(function filterCurrent(truckload) {
        return !truckload.isCompleted
      })
    : truckloads.filter(function filterCompleted(truckload) {
        return truckload.isCompleted
      })

  return [...filtered].sort(function sortByPickupDate(first, second) {
    return getPickupTimestamp(first.startDate) - getPickupTimestamp(second.startDate)
  })
}

function getPickupTimestamp(dateValue: string): number {
  if (!dateValue) {
    return Number.POSITIVE_INFINITY
  }

  const timestamp = new Date(dateValue).getTime()
  if (Number.isNaN(timestamp)) {
    return Number.POSITIVE_INFINITY
  }

  return timestamp
}


