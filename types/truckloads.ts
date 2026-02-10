export type TruckloadStatus = 'draft' | 'active' | 'completed';

export interface TruckloadSummary {
  id: number;
  driverId: string;
  startDate: string;
  endDate: string;
  trailerNumber: string;
  billOfLadingNumber: string;
  description: string;
  isCompleted: boolean;
  status?: TruckloadStatus;
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

// Planner types
export type ScheduleEventType = 'vacation' | 'sick' | 'unavailable' | 'other';

export interface DriverScheduleEvent {
  id: number;
  driverId: number;
  eventType: ScheduleEventType;
  startDate: string;
  endDate: string;
  description: string | null;
  driverName: string;
  driverColor?: string;
}

export type PlannerNoteType = 'daily' | 'weekly';

export interface PlannerNote {
  id: number;
  noteType: PlannerNoteType;
  noteDate: string;
  content: string;
  createdBy?: number;
  createdByName?: string;
}

export interface PlannerTruckload {
  id: number;
  driverId: number;
  startDate: string;
  endDate: string;
  trailerNumber: string | null;
  billOfLadingNumber: string | null;
  description: string | null;
  isCompleted: boolean;
  status: TruckloadStatus;
  driverName: string;
  driverColor: string;
}

export interface PlannerDriver {
  id: number;
  full_name: string;
  color: string;
} 