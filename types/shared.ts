// Simplified customer type used in order-related components
export interface OrderCustomer {
  id: number;
  name: string;
  address: string;
}

// Full customer type with all details
export interface Customer {
  id: number;
  customer_name: string;
  city: string;
  state: string;
  address: string;
  zip_code: string;
  county: string;
  phone_number_1: string | null;
  phone_number_2: string | null;
  notes: string | null;
  quotes?: string | null;
}

// Helper function to convert full customer to order customer
export function convertToOrderCustomer(customer: Customer): OrderCustomer {
  return {
    id: customer.id,
    name: customer.customer_name,
    address: [customer.address, customer.city, customer.state].filter(Boolean).join(', ')
  };
}

// Skid/Vinyl data type
export interface SkidData {
  id: string;
  number: number;
  width: number;
  length: number;
  footage: number;
  type: 'skid' | 'vinyl';
  isPickedUp?: boolean;
  isDelivered?: boolean;
}

// Hand bundle data type
export interface HandBundleData {
  id: string;
  quantity: number;
  description: string;
}

// Order data type
export interface OrderData {
  id: number;
  pickupCustomer: OrderCustomer;
  deliveryCustomer: OrderCustomer;
  payingCustomer: OrderCustomer | null;
  skids: number;
  vinyl: number;
  footage: number;
  handBundles: number;
  skidsData: SkidData[];
  vinylData: SkidData[];
  handBundlesData: HandBundleData[];
  pickupDate: string;
  isRushOrder: boolean;
  needsAttention: boolean;
  comments: string;
  freightQuote: string;
  filters: {
    ohioToIndiana: boolean;
    backhaul: boolean;
    localFlatbed: boolean;
    rrOrder: boolean;
    localSemi: boolean;
    middlefield: boolean;
    paNy: boolean;
  };
  links: Array<{
    id: string;
    url: string;
    description: string;
  }>;
  created_at: string;
  created_by?: number;
  pickupAssignment: {
    truckloadId: number;
    driverName: string;
    driverColor: string;
    startDate: string;
    endDate: string;
  } | null;
  deliveryAssignment: {
    truckloadId: number;
    driverName: string;
    driverColor: string;
    startDate: string;
    endDate: string;
  } | null;
  isTransferOrder: boolean;
} 