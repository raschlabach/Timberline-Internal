/**
 * Types for the flexible pricing notes system
 */

export interface PricingCategory {
  id: number;
  name: string;
  description: string | null;
  color: string;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface PricingNote {
  id: number;
  title: string;
  category_id: number;
  content: string;
  tags: string[];
  is_active: boolean;
  created_by: number;
  created_at: string;
  updated_at: string;
  // Joined data
  category?: PricingCategory;
  created_by_user?: {
    id: number;
    full_name: string;
  };
  linked_customers?: Array<{
    id: number;
    customer_name: string;
  }>;
}

export interface PricingTemplate {
  id: number;
  name: string;
  description: string | null;
  template_data: Record<string, any>; // Flexible JSON structure
  category_id: number;
  is_active: boolean;
  created_by: number;
  created_at: string;
  updated_at: string;
  // Joined data
  category?: PricingCategory;
  created_by_user?: {
    id: number;
    full_name: string;
  };
  linked_customers?: Array<{
    id: number;
    customer_name: string;
  }>;
}

export interface PricingNoteCustomer {
  id: number;
  pricing_note_id: number;
  customer_id: number;
  created_at: string;
}

export interface PricingTemplateCustomer {
  id: number;
  pricing_template_id: number;
  customer_id: number;
  created_at: string;
}

// Form interfaces for creating/editing
export interface PricingNoteFormData {
  title: string;
  category_id: number;
  content: string;
  tags: string[];
  is_active: boolean;
  linked_customer_ids: number[];
}

export interface PricingTemplateFormData {
  name: string;
  description: string;
  template_data: Record<string, any>;
  category_id: number;
  is_active: boolean;
  linked_customer_ids: number[];
}

// API response interfaces
export interface PricingNotesResponse {
  notes: PricingNote[];
  categories: PricingCategory[];
  total: number;
}

export interface PricingTemplatesResponse {
  templates: PricingTemplate[];
  categories: PricingCategory[];
  total: number;
}

// Search and filter interfaces
export interface PricingNotesFilters {
  search?: string;
  category_id?: number;
  tags?: string[];
  is_active?: boolean;
  customer_id?: number;
}

export interface PricingTemplatesFilters {
  search?: string;
  category_id?: number;
  is_active?: boolean;
  customer_id?: number;
}

// Component prop interfaces
export interface PricingNotesListProps {
  notes: PricingNote[];
  categories: PricingCategory[];
  onEdit: (note: PricingNote) => void;
  onDelete: (noteId: number) => void;
  onToggleActive: (noteId: number, isActive: boolean) => void;
  filters: PricingNotesFilters;
  onFiltersChange: (filters: PricingNotesFilters) => void;
}

export interface PricingNoteFormProps {
  note?: PricingNote;
  categories: PricingCategory[];
  customers: Array<{ id: number; customer_name: string }>;
  onSubmit: (data: PricingNoteFormData) => void;
  onCancel: () => void;
  isLoading?: boolean;
}

export interface PricingTemplateFormProps {
  template?: PricingTemplate;
  categories: PricingCategory[];
  customers: Array<{ id: number; customer_name: string }>;
  onSubmit: (data: PricingTemplateFormData) => void;
  onCancel: () => void;
  isLoading?: boolean;
}

export interface PricingNotesSearchProps {
  filters: PricingNotesFilters;
  categories: PricingCategory[];
  onFiltersChange: (filters: PricingNotesFilters) => void;
}

export interface PricingCategorySelectorProps {
  categories: PricingCategory[];
  selectedCategoryId?: number;
  onSelect: (categoryId: number | undefined) => void;
}

export interface CustomerTagSelectorProps {
  customers: Array<{ id: number; customer_name: string }>;
  selectedCustomerIds: number[];
  onSelectionChange: (customerIds: number[]) => void;
}
