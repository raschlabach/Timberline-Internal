// Customer types
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

// Skid/Vinyl types
export interface SkidData {
  id: string;
  number: number;
  width: number;
  length: number;
  footage: number;
  type: 'skid' | 'vinyl';
}

// Hand bundle types
export interface HandBundleData {
  id: string;
  quantity: number;
  description: string;
}

// Order link types
export interface OrderLink {
  id: string;
  url: string;
  description: string;
}

// Component prop types
export interface FilterToggleProps {
  label: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
}

export interface SkidsVinylEntryProps {
  skidsVinyl: SkidData[];
  onUpdate: (skidsVinyl: SkidData[]) => void;
}

export interface FootageEntryProps {
  footage: number;
  onUpdate: (footage: number) => void;
}

export interface HandBundleEntryProps {
  handBundles: HandBundleData[];
  onUpdate: (handBundles: HandBundleData[]) => void;
}

export interface DatePickerProps {
  date: Date | null;
  onSelect: (date: Date | null) => void;
}

export interface StatusFlagsProps {
  rushOrder: boolean;
  needsAttention: boolean;
  onRushOrderChange: (checked: boolean) => void;
  onNeedsAttentionChange: (checked: boolean) => void;
}

export interface SkidEntryRowProps {
  skid: SkidData;
  onUpdate: (skid: SkidData) => void;
  onDelete: (id: string) => void;
  onDuplicate: (skid: SkidData) => void;
}

export interface CustomerSelectorProps {
  label: string;
  required?: boolean;
  selectedCustomer: Customer | null;
  onSelectCustomer: (customer: Customer | null) => void;
}

// Form state type
export interface OrderFormState {
  pickupCustomer: Customer | null;
  deliveryCustomer: Customer | null;
  payingCustomer: Customer | null;
  filters: {
    ohioToIndiana: boolean;
    backhaul: boolean;
    localFlatbed: boolean;
    rrOrder: boolean;
    localSemi: boolean;
    middlefield: boolean;
    paNy: boolean;
  };
  freightType: 'skidsVinyl' | 'footage';
  skidsVinyl: SkidData[];
  footage: number;
  handBundles: HandBundleData[];
  pickupDate: Date | null;
  comments: string;
  freightQuote: string;
  statusFlags: {
    rushOrder: boolean;
    needsAttention: boolean;
  };
  links: OrderLink[];
} 