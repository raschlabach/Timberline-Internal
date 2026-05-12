export interface CharcoalCustomer {
  id: string
  name: string
  contact_name: string | null
  phone: string | null
  email: string | null
  notes: string | null
  is_walnut_creek: boolean
  created_at: string
  updated_at: string
}

export interface CharcoalSkid {
  id: string
  wrapped_at: string
  wrapped_by_id: string
  wrapped_by_name?: string
  is_walnut_creek: boolean
  notes: string | null
  created_at: string
  updated_at: string
}

export interface CharcoalProjectedSkid {
  id: string
  count: number
  ready_date: string
  is_walnut_creek: boolean
  notes: string | null
  created_by_id: string
  created_at: string
  updated_at: string
}

export interface CharcoalOrder {
  id: string
  customer_id: string
  customer_name: string
  customer_is_walnut_creek: boolean
  quantity: number
  due_date: string | null
  notes: string | null
  priority: number
  status: 'open' | 'completed'
  created_at: string
  updated_at: string
}

export interface CharcoalAllocation {
  greenCount: number
  orangePieces: { count: number; readyDate: string }[]
  unallocated: number
}

export interface CharcoalDashboardData {
  orders: CharcoalOrder[]
  skids: CharcoalSkid[]
  counters: {
    stdInv: number
    wcInv: number
    stdProj: number
    wcProj: number
  }
  projections: CharcoalProjectedSkid[]
  allocation: Record<string, CharcoalAllocation>
}

export interface CharcoalHistoryDay {
  date: string
  bagged_std: number
  bagged_wc: number
  ordered_std: number
  ordered_wc: number
}

export interface CharcoalHistoryData {
  byDay: CharcoalHistoryDay[]
  monthTotals: {
    baggedStd: number
    baggedWc: number
    orderedStd: number
    orderedWc: number
  }
  ytdTotals: {
    bagged: number
    ordered: number
  }
}
