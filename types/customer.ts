/**
 * Standard Customer interface for use across the application
 */
export interface Customer {
  id: number
  customer_name: string
  address: string
  city: string
  state: string
  zip: string  // Used in frontend components
  zip_code?: string  // Used in API responses
  county: string
  phone_number_1: string | null
  phone_number_2: string | null
  price_category: number
  notes: string | null
  quotes?: string | null
  // Location data
  latitude?: number | null
  longitude?: number | null
} 