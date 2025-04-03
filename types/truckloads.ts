export interface TruckloadSummary {
  id: number;
  driverId: string;
  startDate: string;
  endDate: string;
  trailerNumber: string;
  billOfLadingNumber: string;
  description: string;
  isCompleted: boolean;
  totalMileage: number;
  estimatedDuration: number;
  driverName: string;
  driverColor: string;
  pickupFootage: number;
  deliveryFootage: number;
  transferFootage: number;
}

export interface Driver {
  id: string;
  fullName: string;
  username: string;
  color: string;
}

export interface TruckloadKanbanColumn {
  date: Date;
  truckloads: TruckloadSummary[];
}

export interface TruckloadKanbanRow {
  driver: Driver;
  columns: TruckloadKanbanColumn[];
}

export interface TruckloadKanbanProps {
  drivers: Driver[];
  truckloads: TruckloadSummary[];
  showDays?: number;
  onMoveTruckload: (truckloadId: number, driverId: string, date: string) => void;
  onChangeShowDays: (days: number) => void;
} 