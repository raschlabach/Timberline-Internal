import { Customer, OrderLink, HandBundleData } from './orders';
import { SkidData } from './shared';

// Simplified Customer type for presets
export interface PresetCustomer {
  id: number;
  customer_name: string;
  address?: string;
}

export interface OrderPreset {
  id: number;
  name: string;
  color: string;
  pickupCustomer: PresetCustomer | null;
  deliveryCustomer: PresetCustomer | null;
  payingCustomer: PresetCustomer | null;
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
  comments: string;
  freightQuote: string;
  statusFlags: {
    rushOrder: boolean;
    needsAttention: boolean;
  };
  links: OrderLink[];
  isFavorite: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreatePresetRequest {
  name: string;
  color: string;
  pickupCustomer: PresetCustomer | null;
  deliveryCustomer: PresetCustomer | null;
  payingCustomer: PresetCustomer | null;
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
  comments: string;
  freightQuote: string;
  statusFlags: {
    rushOrder: boolean;
    needsAttention: boolean;
  };
  links: OrderLink[];
}

export interface UpdatePresetRequest extends CreatePresetRequest {
  id: number;
}

export interface PresetResponse {
  success: boolean;
  message: string;
  preset?: OrderPreset;
  presets?: OrderPreset[];
  error?: string;
} 