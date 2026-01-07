// Lumber Tracker System Types

// ============================================================================
// SUPPLIERS
// ============================================================================

export interface LumberSupplier {
  id: number
  name: string
  notes: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface LumberSupplierLocation {
  id: number
  supplier_id: number
  location_name: string
  address: string | null
  city: string | null
  state: string | null
  zip_code: string | null
  phone_number_1: string | null
  phone_number_2: string | null
  notes: string | null
  is_primary: boolean
  created_at: string
  updated_at: string
}

export interface LumberSupplierWithLocations extends LumberSupplier {
  locations: LumberSupplierLocation[]
}

// ============================================================================
// DRIVERS
// ============================================================================

export interface LumberDriver {
  id: number
  name: string
  phone: string | null
  notes: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}

// ============================================================================
// LOADS
// ============================================================================

export type LumberType = 'dried' | 'green'
export type PickupOrDelivery = 'pickup' | 'delivery'
export type Thickness = '4/4' | '5/4' | '6/4' | '7/4' | '8/4'

export interface LumberLoad {
  id: number
  load_id: string
  supplier_id: number
  supplier_location_id: number | null
  
  // Type and delivery info
  lumber_type: LumberType | null
  pickup_or_delivery: PickupOrDelivery | null
  
  // Estimated fields
  estimated_delivery_date: string | null
  comments: string | null
  
  // Actual fields
  actual_arrival_date: string | null
  pickup_number: string | null
  plant: string | null
  pickup_date: string | null
  invoice_number: string | null
  invoice_total: number | null
  invoice_date: string | null
  
  // Trucking
  driver_id: number | null
  assigned_pickup_date: string | null
  
  // Invoice tracking
  entered_in_quickbooks: boolean
  is_paid: boolean
  
  // Rip tracking
  load_quality: number | null
  all_packs_tallied: boolean
  all_packs_finished: boolean
  
  // Status tracking
  po_generated: boolean
  po_generated_at: string | null
  
  // Metadata
  created_by: number | null
  created_at: string
  updated_at: string
}

export interface LumberLoadItem {
  id: number
  load_id: number
  species: string
  grade: string
  thickness: Thickness
  estimated_footage: number | null
  actual_footage: number | null
  price: number | null
  created_at: string
  updated_at: string
}

export interface LumberLoadWithDetails extends LumberLoad {
  supplier_name: string
  location_name?: string | null
  phone_number_1?: string | null
  phone_number_2?: string | null
  driver_name?: string | null
  items: LumberLoadItem[]
  documents: LumberLoadDocument[]
}

// ============================================================================
// DOCUMENTS
// ============================================================================

export type DocumentType = 'invoice' | 'po' | 'paperwork' | 'other'

export interface LumberLoadDocument {
  id: number
  load_id: number
  file_name: string
  file_path: string
  file_type: string | null
  document_type: DocumentType | null
  uploaded_by: number | null
  created_at: string
}

// ============================================================================
// PACKS
// ============================================================================

export interface LumberPack {
  id: number
  pack_id: number
  load_id: number
  load_item_id: number
  
  // Pack tally
  length: number
  tally_board_feet: number
  
  // Rip data
  actual_board_feet: number | null
  rip_yield: number | null
  rip_comments: string | null
  is_finished: boolean
  finished_at: string | null
  
  // Operator and stackers
  operator_id: number | null
  stacker_1_id: number | null
  stacker_2_id: number | null
  stacker_3_id: number | null
  stacker_4_id: number | null
  
  created_at: string
  updated_at: string
}

export interface LumberPackWithDetails extends LumberPack {
  species: string
  grade: string
  thickness: Thickness
  load_load_id: string
  operator_name?: string | null
  stacker_1_name?: string | null
  stacker_2_name?: string | null
  stacker_3_name?: string | null
  stacker_4_name?: string | null
}

export interface PackTallyInput {
  pack_id: number
  length: number
  tally_board_feet: number
}

// ============================================================================
// WORK SESSIONS
// ============================================================================

export interface LumberWorkSession {
  id: number
  user_id: number
  work_date: string
  start_time: string
  end_time: string
  total_hours: number
  notes: string | null
  created_at: string
  updated_at: string
}

export interface LumberWorkSessionWithUser extends LumberWorkSession {
  user_name: string
}

// ============================================================================
// BONUS SYSTEM
// ============================================================================

export interface LumberBonusParameter {
  id: number
  bf_min: number
  bf_max: number
  bonus_amount: number
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface DailyRipSummary {
  work_date: string
  total_hours: number
  total_bf: number
  bf_per_hour: number
  bonus_rate: number
  bonus_total: number
  operator_breakdowns: OperatorBreakdown[]
}

export interface OperatorBreakdown {
  user_id: number
  user_name: string
  bf_contributed: number
  percentage: number
  bonus_amount: number
}

export interface MonthlyRipReport {
  month: number
  year: number
  daily_summaries: DailyRipSummary[]
  total_hours: number
  total_rnr: number
  total_misc: number
  total_bf: number
  total_bonus: number
  operator_totals: OperatorTotal[]
}

export interface OperatorTotal {
  user_id: number
  user_name: string
  total_rip_ft: number
  total_bonus: number
}

// ============================================================================
// TRUCKING
// ============================================================================

export interface LumberTruckingNote {
  id: number
  note_text: string
  created_by: number | null
  created_at: string
  updated_at: string
}

// ============================================================================
// INVENTORY
// ============================================================================

export interface InventoryGroup {
  species: string
  grade: string
  thickness: Thickness
  total_actual_footage: number
  total_finished_footage: number
  current_inventory: number
}

export interface InventoryLoad {
  load_id: string
  supplier_name: string
  species: string
  grade: string
  thickness: Thickness
  actual_footage: number
  finished_footage: number
  remaining_footage: number
}

// ============================================================================
// FORM INPUTS
// ============================================================================

export interface CreateLoadFormData {
  load_id: string
  supplier_id: number
  supplier_location_id: number | null
  lumber_type: LumberType | null
  pickup_or_delivery: PickupOrDelivery | null
  estimated_delivery_date: string | null
  comments: string | null
  items: CreateLoadItemInput[]
}

export interface CreateLoadItemInput {
  species: string
  grade: string
  thickness: Thickness
  estimated_footage: number | null
  price: number | null
}

export interface DataEntryFormData {
  actual_arrival_date: string
  invoice_number: string
  invoice_total: number
  invoice_date: string
  items: DataEntryItemInput[]
}

export interface DataEntryItemInput {
  id: number
  actual_footage: number
}

export interface RipEntryData {
  actual_board_feet: number
  rip_yield: number
  rip_comments: string | null
  operator_id: number | null
  stacker_1_id: number | null
  stacker_2_id: number | null
  stacker_3_id: number | null
  stacker_4_id: number | null
}
