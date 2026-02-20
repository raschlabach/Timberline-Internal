'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { CustomerSelector } from '@/components/orders/customer-selector';
import { FilterToggle } from '@/components/orders/filter-toggle';
import { SkidsVinylEntry } from '@/components/orders/skids-vinyl-entry';
import { FootageEntry } from '@/components/orders/footage-entry';
import { HandBundleEntry } from '@/components/orders/hand-bundle-entry';
import { DatePicker } from '@/components/orders/date-picker';
import { StatusFlags } from '@/components/orders/status-flags';
import { OrderLinks } from '@/components/orders/order-links';
import { RecentOrders } from '@/components/orders/recent-orders';
import { SavePresetDialog } from '@/components/orders/save-preset-dialog';
import { PresetsList } from '@/components/orders/presets-list';
import { 
  Customer, 
  OrderFormState, 
  OrderLink, 
  SkidData,
  HandBundleData,
  FilterToggleProps,
  SkidsVinylEntryProps,
  FootageEntryProps,
  HandBundleEntryProps,
  DatePickerProps,
  StatusFlagsProps,
  SkidEntryRowProps,
  CustomerSelectorProps
} from '@/types/orders';
import { OrderCustomer, convertToOrderCustomer } from "@/types/shared";
import { PricingNote, PricingCategory, PricingNoteFormData } from "@/types/pricing-notes";
import { ChevronDown, FileText, Loader2, X, CalendarIcon, Repeat, Plus, Pencil, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { PricingNoteForm } from "@/components/pricing-notes/pricing-note-form";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { format, addDays, addWeeks, addMonths } from "date-fns";

export default function OrderEntryPage() {
  const router = useRouter();
  const [formState, setFormState] = useState<OrderFormState>({
    pickupCustomer: null,
    deliveryCustomer: null,
    payingCustomer: null,
    filters: {
      ohioToIndiana: false,
      backhaul: false,
      localFlatbed: false,
      rrOrder: false,
      localSemi: false,
      middlefield: false,
      paNy: false,
    },
    freightType: 'skidsVinyl',
    skidsVinyl: [],
    footage: 0,
    handBundles: [],
    pickupDate: null,
    comments: '',
    freightQuote: '',
    statusFlags: {
      rushOrder: false,
      needsAttention: false,
    },
    links: []
  });

  const [isPresetDialogOpen, setIsPresetDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  const [activeTab, setActiveTab] = useState<'presets' | 'recent'>('presets');
  const [isHandBundlesOpen, setIsHandBundlesOpen] = useState(false);
  const [pricingNotes, setPricingNotes] = useState<PricingNote[]>([]);
  const [isLoadingPricingNotes, setIsLoadingPricingNotes] = useState(false);
  const [isNoteDialogOpen, setIsNoteDialogOpen] = useState(false);
  const [editingNote, setEditingNote] = useState<PricingNote | null>(null);
  const [isSavingNote, setIsSavingNote] = useState(false);
  const [noteCategories, setNoteCategories] = useState<PricingCategory[]>([]);
  const [noteCustomers, setNoteCustomers] = useState<Array<{ id: number; customer_name: string }>>([]);
  const [dateMode, setDateMode] = useState<'single' | 'multiple' | 'recurring'>('single');
  const [multipleDates, setMultipleDates] = useState<Date[]>([]);
  const [recurringInterval, setRecurringInterval] = useState<'daily' | 'weekly' | 'biweekly' | 'monthly'>('weekly');
  const [recurringCount, setRecurringCount] = useState<number>(2);

  // Fetch pricing notes linked to the paying customer
  useEffect(() => {
    if (!formState.payingCustomer) {
      setPricingNotes([]);
      return;
    }

    const customerId = formState.payingCustomer.id;
    setIsLoadingPricingNotes(true);

    fetch(`/api/pricing-notes?customer_id=${customerId}&is_active=true`)
      .then(res => {
        if (!res.ok) throw new Error('Failed to fetch pricing notes');
        return res.json();
      })
      .then((notes: PricingNote[]) => {
        setPricingNotes(notes);
      })
      .catch(err => {
        console.error('Error fetching pricing notes:', err);
        setPricingNotes([]);
      })
      .finally(() => {
        setIsLoadingPricingNotes(false);
      });
  }, [formState.payingCustomer]);

  // Auto-open hand bundles section when hand bundles are added
  useEffect(() => {
    if (formState.handBundles.length > 0 && !isHandBundlesOpen) {
      setIsHandBundlesOpen(true);
    }
  }, [formState.handBundles.length, isHandBundlesOpen]);

  // Validation function
  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};

    if (!formState.pickupCustomer) {
      errors.pickupCustomer = 'Pickup Customer is required';
    }
    
    if (!formState.deliveryCustomer) {
      errors.deliveryCustomer = 'Delivery Customer is required';
    }
    
    // Check if at least one filter is selected
    const hasFilterSelected = Object.values(formState.filters).some(value => value === true);
    if (!hasFilterSelected) {
      errors.filters = 'Please select at least one load type filter';
    }
    
    // Skids/vinyl are optional - no validation needed
    
    if (formState.freightType === 'footage' && formState.footage <= 0) {
      errors.footage = 'Please enter a valid footage amount';
    }
    
    const allDates = getAllPickupDates();
    if (allDates.length === 0) {
      if (dateMode === 'multiple') {
        errors.pickupDate = 'Please select at least one pickup date';
      } else if (dateMode === 'recurring') {
        errors.pickupDate = 'Please select a start date for recurring orders';
      } else {
        errors.pickupDate = 'Pickup Date is required';
      }
    }

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleCustomerSelect = (type: 'pickupCustomer' | 'deliveryCustomer' | 'payingCustomer', customer: Customer | null) => {
    setFormState(prev => ({
      ...prev,
      [type]: customer
    }));
    // Clear validation error for this field
    if (validationErrors[type]) {
      setValidationErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[type];
        return newErrors;
      });
    }
  };

  const handleFilterChange = useCallback((filter: keyof OrderFormState['filters'], checked: boolean): void => {
    setFormState(prev => ({
      ...prev,
      filters: {
        ...prev.filters,
        [filter]: checked
      }
    }));
    // Clear filter validation error when a filter is selected
    if (checked && validationErrors.filters) {
      setValidationErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors.filters;
        return newErrors;
      });
    }
  }, [validationErrors.filters]);

  const handleFreightTypeChange = useCallback((type: OrderFormState['freightType']): void => {
    setFormState(prev => ({
      ...prev,
      freightType: type
    }));
  }, []);

  const handleSkidsVinylChange = useCallback((skids: SkidData[]): void => {
    setFormState(prev => ({
      ...prev,
      skidsVinyl: skids
    }));
    // Clear freight validation error
    if (validationErrors.freight) {
      setValidationErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors.freight;
        return newErrors;
      });
    }
  }, [validationErrors.freight]);

  const handleFootageChange = useCallback((footage: number): void => {
    setFormState(prev => ({
      ...prev,
      footage
    }));
    // Clear footage validation error
    if (validationErrors.footage) {
      setValidationErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors.footage;
        return newErrors;
      });
    }
  }, [validationErrors.footage]);

  const handleHandBundlesChange = useCallback((handBundles: HandBundleData[]): void => {
    setFormState(prev => ({
      ...prev,
      handBundles
    }));
  }, []);

  const handlePickupDateChange = useCallback((date: Date | null): void => {
    setFormState(prev => ({
      ...prev,
      pickupDate: date
    }));
    // Clear pickup date validation error
    if (validationErrors.pickupDate) {
      setValidationErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors.pickupDate;
        return newErrors;
      });
    }
  }, [validationErrors.pickupDate]);

  const handleCommentsChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>): void => {
    setFormState(prev => ({
      ...prev,
      comments: e.target.value
    }));
  }, []);

  const handleFreightQuoteChange = useCallback((e: React.ChangeEvent<HTMLInputElement>): void => {
    setFormState(prev => ({
      ...prev,
      freightQuote: e.target.value
    }));
  }, []);

  const handleStatusFlagChange = useCallback((flag: keyof OrderFormState['statusFlags'], checked: boolean): void => {
    setFormState(prev => ({
      ...prev,
      statusFlags: {
        ...prev.statusFlags,
        [flag]: checked
      }
    }));
  }, []);

  const handleLinksChange = useCallback((links: OrderLink[]): void => {
    setFormState(prev => ({
      ...prev,
      links
    }));
  }, []);

  // Generate recurring dates from a start date, interval, and count
  const generateRecurringDates = useCallback((startDate: Date, interval: typeof recurringInterval, count: number): Date[] => {
    const dates: Date[] = [startDate];
    for (let i = 1; i < count; i++) {
      switch (interval) {
        case 'daily':
          dates.push(addDays(startDate, i));
          break;
        case 'weekly':
          dates.push(addWeeks(startDate, i));
          break;
        case 'biweekly':
          dates.push(addWeeks(startDate, i * 2));
          break;
        case 'monthly':
          dates.push(addMonths(startDate, i));
          break;
      }
    }
    return dates;
  }, []);

  // Compute the final list of all pickup dates based on the current date mode
  const getAllPickupDates = useCallback((): Date[] => {
    switch (dateMode) {
      case 'single':
        return formState.pickupDate ? [formState.pickupDate] : [];
      case 'multiple':
        return [...multipleDates].sort((a, b) => a.getTime() - b.getTime());
      case 'recurring':
        if (!formState.pickupDate || recurringCount < 1) return [];
        return generateRecurringDates(formState.pickupDate, recurringInterval, recurringCount);
      default:
        return [];
    }
  }, [dateMode, formState.pickupDate, multipleDates, recurringInterval, recurringCount, generateRecurringDates]);

  // Effect to handle mutual exclusivity between skids/vinyl and footage
  useEffect(() => {
    if (formState.freightType === 'footage' && formState.skidsVinyl.length > 0) {
      // Clear skids/vinyl when switching to footage
      setFormState(prev => ({
        ...prev,
        skidsVinyl: []
      }));
    }
  }, [formState.freightType]);

  // Handle form submission - creates one order per pickup date
  const handleSubmit = async (clearForm: boolean = true) => {
    setValidationErrors({});
    
    if (!validateForm()) {
      toast.error('Please fix the validation errors before submitting');
      return;
    }

    const allDates = getAllPickupDates();
    if (allDates.length === 0) return;

    setIsSubmitting(true);
    
    try {
      const orderPayload = {
        pickupCustomer: formState.pickupCustomer,
        deliveryCustomer: formState.deliveryCustomer,
        payingCustomer: formState.payingCustomer,
        filters: formState.filters,
        freightType: formState.freightType,
        skidsVinyl: formState.skidsVinyl,
        footage: formState.footage,
        handBundles: formState.handBundles,
        comments: formState.comments,
        freightQuote: formState.freightQuote ? parseFloat(formState.freightQuote) : null,
        statusFlags: formState.statusFlags,
        links: formState.links
      };

      const results = [];
      const errors = [];

      for (const date of allDates) {
        try {
          const response = await fetch('/api/orders', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              ...orderPayload,
              pickupDate: format(date, 'yyyy-MM-dd'),
            })
          });

          if (!response.ok) {
            const err = await response.json();
            errors.push(`${format(date, 'MMM d')}: ${err.error || 'Failed'}`);
          } else {
            const result = await response.json();
            results.push(result);
          }
        } catch (err) {
          errors.push(`${format(date, 'MMM d')}: Network error`);
        }
      }

      if (results.length > 0) {
        window.dispatchEvent(new CustomEvent('orderCreated', { 
          detail: { orderId: results[results.length - 1].orderId }
        }));
        localStorage.setItem('lastOrderCreated', Date.now().toString());
      }

      if (errors.length > 0) {
        toast.error(`${errors.length} order(s) failed to create`);
      }

      if (results.length > 0) {
        const msg = results.length === 1
          ? 'Order created successfully!'
          : `${results.length} orders created successfully!`;
        toast.success(msg);
      }

      if (clearForm && results.length > 0) {
        resetForm();
      }
      
    } catch (error) {
      console.error('Error creating orders:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to create orders';
      toast.error(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Reusable form reset function
  const resetForm = useCallback(() => {
    const initialState: OrderFormState = {
      pickupCustomer: null,
      deliveryCustomer: null,
      payingCustomer: null,
      filters: {
        ohioToIndiana: false,
        backhaul: false,
        localFlatbed: false,
        rrOrder: false,
        localSemi: false,
        middlefield: false,
        paNy: false,
      },
      freightType: 'skidsVinyl' as const,
      skidsVinyl: [],
      footage: 0,
      handBundles: [],
      pickupDate: null,
      comments: '',
      freightQuote: '',
      statusFlags: {
        rushOrder: false,
        needsAttention: false,
      },
      links: []
    };
    setFormState(initialState);
    setValidationErrors({});
    setIsHandBundlesOpen(false);
    setDateMode('single');
    setMultipleDates([]);
    setRecurringInterval('weekly');
    setRecurringCount(2);
  }, []);

  // Clear the form
  const handleClear = () => {
    if (confirm('Are you sure you want to clear all fields?')) {
      console.log('Clearing form state...');
      resetForm();
    }
  };

  // Add this handler function before the return statement
  const handleLoadRecentOrder = (orderState: Partial<OrderFormState>) => {
    // Clear the form and load new data in a single state update
    const initialState: OrderFormState = {
      pickupCustomer: null,
      deliveryCustomer: null,
      payingCustomer: null,
      filters: {
        ohioToIndiana: false,
        backhaul: false,
        localFlatbed: false,
        rrOrder: false,
        localSemi: false,
        middlefield: false,
        paNy: false,
      },
      freightType: 'skidsVinyl' as const,
      skidsVinyl: [],
      footage: 0,
      handBundles: [],
      pickupDate: null,
      comments: '',
      freightQuote: '',
      statusFlags: {
        rushOrder: false,
        needsAttention: false,
      },
      links: []
    };
    
    setFormState({
      ...initialState,
      ...orderState,
      // Explicitly override fields that might be undefined in orderState
      comments: typeof orderState.comments === 'string' ? orderState.comments : '',
      freightQuote: typeof orderState.freightQuote === 'string' ? orderState.freightQuote : '',
      footage: typeof orderState.footage === 'number' ? orderState.footage : 0,
      skidsVinyl: Array.isArray(orderState.skidsVinyl) ? orderState.skidsVinyl : [],
      pickupDate: null // Reset pickup date as requested
    });
    setValidationErrors({});
  };

  // Handle loading a preset
  const handleLoadPreset = (presetState: Partial<OrderFormState>) => {
    console.log('Loading preset with comments:', presetState.comments, 'Type:', typeof presetState.comments);
    // Clear the form and load new data in a single state update
    const initialState: OrderFormState = {
      pickupCustomer: null,
      deliveryCustomer: null,
      payingCustomer: null,
      filters: {
        ohioToIndiana: false,
        backhaul: false,
        localFlatbed: false,
        rrOrder: false,
        localSemi: false,
        middlefield: false,
        paNy: false,
      },
      freightType: 'skidsVinyl' as const,
      skidsVinyl: [],
      footage: 0,
      handBundles: [],
      pickupDate: null,
      comments: '',
      freightQuote: '',
      statusFlags: {
        rushOrder: false,
        needsAttention: false,
      },
      links: []
    };
    
    setFormState({
      ...initialState,
      ...presetState,
      // Explicitly override fields that might be undefined in presetState
      comments: typeof presetState.comments === 'string' ? presetState.comments : '',
      freightQuote: typeof presetState.freightQuote === 'string' ? presetState.freightQuote : '',
      footage: typeof presetState.footage === 'number' ? presetState.footage : 0,
      skidsVinyl: Array.isArray(presetState.skidsVinyl) ? presetState.skidsVinyl : [],
      pickupDate: null // Reset pickup date as requested
    });
    setValidationErrors({});
  };

  // Fetch categories and customers for the pricing note form
  const fetchNoteFormData = useCallback(async () => {
    try {
      const [catRes, custRes] = await Promise.all([
        fetch('/api/pricing-categories'),
        fetch('/api/customers')
      ]);
      if (catRes.ok) {
        const cats = await catRes.json();
        setNoteCategories(Array.isArray(cats) ? cats : cats.categories || []);
      }
      if (custRes.ok) {
        const custs = await custRes.json();
        setNoteCustomers(Array.isArray(custs) ? custs : []);
      }
    } catch (err) {
      console.error('Error fetching note form data:', err);
    }
  }, []);

  // Refresh pricing notes for the current paying customer
  const refreshPricingNotes = useCallback(async () => {
    if (!formState.payingCustomer) return;
    try {
      const res = await fetch(`/api/pricing-notes?customer_id=${formState.payingCustomer.id}&is_active=true`);
      if (res.ok) {
        const notes: PricingNote[] = await res.json();
        setPricingNotes(notes);
      }
    } catch (err) {
      console.error('Error refreshing pricing notes:', err);
    }
  }, [formState.payingCustomer]);

  function handleOpenAddNote() {
    setEditingNote(null);
    fetchNoteFormData();
    setIsNoteDialogOpen(true);
  }

  function handleOpenEditNote(note: PricingNote) {
    setEditingNote(note);
    fetchNoteFormData();
    setIsNoteDialogOpen(true);
  }

  async function handleDeleteNote(noteId: number) {
    if (!confirm('Are you sure you want to delete this pricing note?')) return;
    try {
      const res = await fetch(`/api/pricing-notes/${noteId}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete');
      toast.success('Pricing note deleted');
      await refreshPricingNotes();
    } catch (err) {
      console.error('Error deleting note:', err);
      toast.error('Failed to delete pricing note');
    }
  }

  async function handleSaveNote(data: PricingNoteFormData) {
    setIsSavingNote(true);
    try {
      if (editingNote) {
        const res = await fetch(`/api/pricing-notes/${editingNote.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data)
        });
        if (!res.ok) throw new Error('Failed to update');
        toast.success('Pricing note updated');
      } else {
        // Pre-link the paying customer when creating from this context
        const customerIds = data.linked_customer_ids;
        if (formState.payingCustomer && !customerIds.includes(formState.payingCustomer.id)) {
          customerIds.push(formState.payingCustomer.id);
        }
        const res = await fetch('/api/pricing-notes', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...data, linked_customer_ids: customerIds })
        });
        if (!res.ok) throw new Error('Failed to create');
        toast.success('Pricing note created');
      }
      setIsNoteDialogOpen(false);
      setEditingNote(null);
      await refreshPricingNotes();
    } catch (err) {
      console.error('Error saving note:', err);
      toast.error('Failed to save pricing note');
    } finally {
      setIsSavingNote(false);
    }
  }

  return (
    <div className="container mx-auto py-6">
      <h1 className="text-3xl font-bold mb-6">Order Entry</h1>
      
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Main Form Section - Takes up 6/12 of the page on large screens */}
        <div className="lg:col-span-6">
          {/* Form wrapper with visual styling */}
          <form 
            className="border-2 border-slate-200 rounded-xl p-3 bg-slate-50 space-y-3 relative"
            onSubmit={(e) => {
              e.preventDefault();
              handleSubmit();
            }}
            aria-label="Order Entry Form"
          >
            <div className="absolute top-0 right-0 bg-primary text-white px-3 py-1 rounded-bl-lg rounded-tr-lg font-medium text-sm" aria-hidden="true">
              ORDER FORM
            </div>
            
            {/* Section 1: Customer Selection */}
            <Card className="shadow-sm">
              <CardHeader className="bg-slate-100 border-b py-3">
                <CardTitle className="flex items-center text-sm">
                  <span className="flex items-center justify-center bg-primary text-white rounded-full w-5 h-5 text-xs mr-2" aria-hidden="true">1</span>
                  Customer Selection
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-3">
                <div className="space-y-2">
                  <div>
                    <Label htmlFor="pickup-customer" className="mb-1 block font-medium text-sm">
                      Pickup Customer <span className="text-red-500" aria-label="required">*</span>
                    </Label>
                    <div id="pickup-customer">
                      <CustomerSelector 
                        label="Pickup Customer"
                        required={true}
                        selectedCustomer={formState.pickupCustomer}
                        onSelectCustomer={(customer) => handleCustomerSelect('pickupCustomer', customer)}
                      />
                    </div>
                    {validationErrors.pickupCustomer && (
                      <p className="text-sm text-red-500 mt-1" role="alert" aria-live="polite">{validationErrors.pickupCustomer}</p>
                    )}
                  </div>
                  
                  <div>
                    <Label htmlFor="delivery-customer" className="mb-1 block font-medium text-sm">
                      Delivery Customer <span className="text-red-500" aria-label="required">*</span>
                    </Label>
                    <div id="delivery-customer">
                      <CustomerSelector 
                        label="Delivery Customer"
                        required={true}
                        selectedCustomer={formState.deliveryCustomer}
                        onSelectCustomer={(customer) => handleCustomerSelect('deliveryCustomer', customer)}
                      />
                    </div>
                    {validationErrors.deliveryCustomer && (
                      <p className="text-sm text-red-500 mt-1" role="alert" aria-live="polite">{validationErrors.deliveryCustomer}</p>
                    )}
                  </div>
                  
                  <div>
                    <Label htmlFor="paying-customer" className="mb-1 block font-medium text-sm">Paying Customer</Label>
                    <div className="flex items-center gap-2 mb-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-7 text-xs"
                        onClick={() => {
                          if (formState.pickupCustomer) {
                            handleCustomerSelect('payingCustomer', formState.pickupCustomer)
                          } else {
                            toast.error('Please select a pickup customer first')
                          }
                        }}
                        disabled={!formState.pickupCustomer}
                      >
                        Pickup
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-7 text-xs"
                        onClick={() => {
                          if (formState.deliveryCustomer) {
                            handleCustomerSelect('payingCustomer', formState.deliveryCustomer)
                          } else {
                            toast.error('Please select a delivery customer first')
                          }
                        }}
                        disabled={!formState.deliveryCustomer}
                      >
                        Delivery
                      </Button>
                    </div>
                    <div id="paying-customer">
                      <CustomerSelector 
                        label="Paying Customer"
                        required={false}
                        selectedCustomer={formState.payingCustomer}
                        onSelectCustomer={(customer) => handleCustomerSelect('payingCustomer', customer)}
                      />
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
            
            {/* Section 2: Load Filters */}
            <Card className="shadow-sm">
              <CardHeader className="bg-slate-100 border-b py-3">
                <CardTitle className="flex items-center text-sm">
                  <span className="flex items-center justify-center bg-primary text-white rounded-full w-5 h-5 text-xs mr-2" aria-hidden="true">2</span>
                  Load Filters
                  <span className="text-red-500 ml-1" aria-label="required">*</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-3">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <FilterToggle 
                    label="OH -> In" 
                    checked={formState.filters.ohioToIndiana} 
                    onCheckedChange={(checked: boolean) => handleFilterChange('ohioToIndiana', checked)}
                  />
                  <FilterToggle 
                    label="Backhaul" 
                    checked={formState.filters.backhaul}
                    onCheckedChange={(checked: boolean) => handleFilterChange('backhaul', checked)}
                  />
                  <FilterToggle 
                    label="Local Flatbed" 
                    checked={formState.filters.localFlatbed}
                    onCheckedChange={(checked: boolean) => handleFilterChange('localFlatbed', checked)}
                  />
                  <FilterToggle 
                    label="RNR Order" 
                    checked={formState.filters.rrOrder}
                    onCheckedChange={(checked: boolean) => handleFilterChange('rrOrder', checked)}
                  />
                  <FilterToggle 
                    label="Local Semi" 
                    checked={formState.filters.localSemi}
                    onCheckedChange={(checked: boolean) => handleFilterChange('localSemi', checked)}
                  />
                  <FilterToggle 
                    label="Middlefield" 
                    checked={formState.filters.middlefield}
                    onCheckedChange={(checked: boolean) => handleFilterChange('middlefield', checked)}
                  />
                  <FilterToggle 
                    label="PA/NY" 
                    checked={formState.filters.paNy}
                    onCheckedChange={(checked: boolean) => handleFilterChange('paNy', checked)}
                  />
                </div>
                {validationErrors.filters && (
                  <p className="text-sm text-red-500 mt-2" role="alert" aria-live="polite">{validationErrors.filters}</p>
                )}
              </CardContent>
            </Card>
            
            {/* Section 3: Freight Entry */}
            <Card className="shadow-sm">
              <CardHeader className="bg-slate-100 border-b py-3">
                <CardTitle className="flex items-center text-sm">
                  <span className="flex items-center justify-center bg-primary text-white rounded-full w-5 h-5 text-xs mr-2" aria-hidden="true">3</span>
                  Freight Entry
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-3">
                <Tabs 
                  defaultValue="skidsVinyl" 
                  value={formState.freightType}
                  onValueChange={(value) => handleFreightTypeChange(value as 'skidsVinyl' | 'footage')}
                >
                  <TabsList className="mb-2">
                    <TabsTrigger value="skidsVinyl">Skids / Vinyl</TabsTrigger>
                    <TabsTrigger value="footage">Footage</TabsTrigger>
                  </TabsList>
                  
                  <TabsContent value="skidsVinyl">
                    <SkidsVinylEntry 
                      skidsVinyl={formState.skidsVinyl}
                      onUpdate={handleSkidsVinylChange}
                    />
                    {validationErrors.freight && (
                      <p className="text-sm text-red-500 mt-2" role="alert" aria-live="polite">{validationErrors.freight}</p>
                    )}
                  </TabsContent>
                  
                  <TabsContent value="footage">
                    <FootageEntry 
                      footage={formState.footage}
                      onUpdate={handleFootageChange}
                    />
                    {validationErrors.footage && (
                      <p className="text-sm text-red-500 mt-2" role="alert" aria-live="polite">{validationErrors.footage}</p>
                    )}
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>
            
            {/* Section 4: Hand Bundles */}
            <Card className="shadow-sm">
              <Collapsible open={isHandBundlesOpen} onOpenChange={setIsHandBundlesOpen}>
                <CollapsibleTrigger asChild>
                  <CardHeader className="bg-slate-100 border-b py-3 cursor-pointer hover:bg-slate-200 transition-colors">
                    <CardTitle className="flex items-center justify-between text-sm">
                      <div className="flex items-center">
                        <span className="flex items-center justify-center bg-primary text-white rounded-full w-5 h-5 text-xs mr-2" aria-hidden="true">4</span>
                        Hand Bundles
                        {formState.handBundles.length > 0 && (
                          <span className="ml-2 px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full">
                            {formState.handBundles.length}
                          </span>
                        )}
                      </div>
                      <ChevronDown className={`h-4 w-4 transition-transform ${isHandBundlesOpen ? 'rotate-180' : ''}`} />
                    </CardTitle>
                  </CardHeader>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <CardContent className="pt-3">
                    <p className="text-sm text-gray-600 mb-3">
                      Add small hand bundles that don't count toward footage but need to be remembered.
                    </p>
                    <HandBundleEntry 
                      handBundles={formState.handBundles}
                      onUpdate={handleHandBundlesChange}
                    />
                  </CardContent>
                </CollapsibleContent>
              </Collapsible>
            </Card>
            
            {/* Section 5: Order Details */}
            <Card className="shadow-sm">
              <CardHeader className="bg-slate-100 border-b py-3">
                <CardTitle className="flex items-center text-sm">
                  <span className="flex items-center justify-center bg-primary text-white rounded-full w-5 h-5 text-xs mr-2" aria-hidden="true">5</span>
                  Order Details
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-3">
                <div className="space-y-3">
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <Label htmlFor="pickup-date" className="font-medium text-sm">
                        Pickup Date <span className="text-red-500" aria-label="required">*</span>
                      </Label>
                      <div className="flex bg-slate-200 rounded-lg p-0.5">
                        <button
                          type="button"
                          onClick={() => setDateMode('single')}
                          className={`px-2 py-0.5 text-xs font-medium rounded-md transition-colors ${
                            dateMode === 'single'
                              ? 'bg-white text-slate-900 shadow-sm'
                              : 'text-slate-600 hover:text-slate-900'
                          }`}
                        >
                          Single
                        </button>
                        <button
                          type="button"
                          onClick={() => setDateMode('multiple')}
                          className={`px-2 py-0.5 text-xs font-medium rounded-md transition-colors ${
                            dateMode === 'multiple'
                              ? 'bg-white text-slate-900 shadow-sm'
                              : 'text-slate-600 hover:text-slate-900'
                          }`}
                        >
                          Multiple
                        </button>
                        <button
                          type="button"
                          onClick={() => setDateMode('recurring')}
                          className={`px-2 py-0.5 text-xs font-medium rounded-md transition-colors flex items-center gap-1 ${
                            dateMode === 'recurring'
                              ? 'bg-white text-slate-900 shadow-sm'
                              : 'text-slate-600 hover:text-slate-900'
                          }`}
                        >
                          <Repeat className="h-3 w-3" />
                          Recurring
                        </button>
                      </div>
                    </div>

                    {dateMode === 'single' && (
                      <div id="pickup-date">
                        <DatePicker 
                          date={formState.pickupDate}
                          onSelect={handlePickupDateChange}
                        />
                      </div>
                    )}

                    {dateMode === 'multiple' && (
                      <div className="space-y-2">
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button
                              type="button"
                              variant="outline"
                              className={cn(
                                "w-full justify-start text-left font-normal",
                                multipleDates.length === 0 && "text-muted-foreground"
                              )}
                            >
                              <CalendarIcon className="mr-2 h-4 w-4" />
                              {multipleDates.length > 0
                                ? `${multipleDates.length} date${multipleDates.length > 1 ? 's' : ''} selected`
                                : 'Select dates'}
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0" align="start">
                            <Calendar
                              mode="multiple"
                              selected={multipleDates}
                              onSelect={(dates) => setMultipleDates(dates || [])}
                              initialFocus
                            />
                          </PopoverContent>
                        </Popover>
                        {multipleDates.length > 0 && (
                          <div className="flex flex-wrap gap-1">
                            {[...multipleDates].sort((a, b) => a.getTime() - b.getTime()).map((date, idx) => (
                              <Badge
                                key={idx}
                                variant="secondary"
                                className="text-xs flex items-center gap-1 pr-1"
                              >
                                {format(date, 'MMM d, yyyy')}
                                <button
                                  type="button"
                                  onClick={() => setMultipleDates(prev => prev.filter((_, i) => {
                                    const sorted = [...prev].sort((a, b) => a.getTime() - b.getTime());
                                    return sorted[idx].getTime() !== prev[i].getTime();
                                  }))}
                                  className="ml-0.5 rounded-full hover:bg-slate-300 p-0.5"
                                >
                                  <X className="h-3 w-3" />
                                </button>
                              </Badge>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    {dateMode === 'recurring' && (
                      <div className="space-y-2">
                        <div id="pickup-date">
                          <DatePicker 
                            date={formState.pickupDate}
                            onSelect={handlePickupDateChange}
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <Label className="text-xs text-slate-500 mb-1 block">Interval</Label>
                            <Select
                              value={recurringInterval}
                              onValueChange={(val) => setRecurringInterval(val as typeof recurringInterval)}
                            >
                              <SelectTrigger className="h-9">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="daily">Daily</SelectItem>
                                <SelectItem value="weekly">Weekly</SelectItem>
                                <SelectItem value="biweekly">Bi-Weekly</SelectItem>
                                <SelectItem value="monthly">Monthly</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div>
                            <Label className="text-xs text-slate-500 mb-1 block">Occurrences</Label>
                            <Input
                              type="number"
                              min={2}
                              max={52}
                              value={recurringCount}
                              onChange={(e) => setRecurringCount(Math.max(2, Math.min(52, parseInt(e.target.value) || 2)))}
                              className="h-9"
                            />
                          </div>
                        </div>
                        {formState.pickupDate && recurringCount > 0 && (
                          <div className="flex flex-wrap gap-1">
                            {generateRecurringDates(formState.pickupDate, recurringInterval, recurringCount).map((date, idx) => (
                              <Badge key={idx} variant="secondary" className="text-xs">
                                {format(date, 'MMM d, yyyy')}
                              </Badge>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    {getAllPickupDates().length > 1 && (
                      <p className="text-xs text-blue-600 font-medium mt-1">
                        {getAllPickupDates().length} orders will be created
                      </p>
                    )}

                    {validationErrors.pickupDate && (
                      <p className="text-sm text-red-500 mt-1" role="alert" aria-live="polite">{validationErrors.pickupDate}</p>
                    )}
                  </div>
                  
                  <div>
                    <Label htmlFor="comments" className="mb-1 block font-medium text-sm">Comments</Label>
                    <Textarea
                      id="comments"
                      placeholder="Enter any special instructions or notes about this order"
                      value={formState.comments}
                      onChange={handleCommentsChange}
                      className="min-h-[80px] text-sm"
                    />
                  </div>
                  
                  <div>
                    <Label htmlFor="freightQuote" className="mb-1 block font-medium text-sm">Freight Quote</Label>
                    <div className="flex items-center">
                      <span className="mr-2">$</span>
                      <Input
                        id="freightQuote"
                        type="number"
                        placeholder="Enter quote amount"
                        value={formState.freightQuote}
                        onChange={handleFreightQuoteChange}
                        onWheel={(e) => {
                          // Prevent scroll from changing the input value
                          e.currentTarget.blur();
                        }}
                        min="0"
                        step="0.01"
                      />
                    </div>
                  </div>
                  
                  <div>
                    <OrderLinks
                      links={formState.links}
                      onUpdate={handleLinksChange}
                    />
                  </div>
                  
                  <div>
                    <Label className="mb-1 block font-medium text-sm">Order Status</Label>
                    <StatusFlags
                      rushOrder={formState.statusFlags.rushOrder}
                      needsAttention={formState.statusFlags.needsAttention}
                      onRushOrderChange={(checked: boolean) => handleStatusFlagChange('rushOrder', checked)}
                      onNeedsAttentionChange={(checked: boolean) => handleStatusFlagChange('needsAttention', checked)}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
            
            {/* Section 6: Action Buttons */}
            <div className="flex justify-end space-x-3 pt-1">
              <Button 
                type="button"
                variant="outline" 
                onClick={handleClear}
                disabled={isSubmitting}
              >
                Clear
              </Button>
              <Button 
                type="button"
                variant="outline" 
                onClick={() => setIsPresetDialogOpen(true)}
                disabled={isSubmitting}
              >
                Save as Preset
              </Button>
              <Button 
                type="button"
                onClick={() => handleSubmit(true)} 
                className="bg-primary hover:bg-primary/90"
                disabled={isSubmitting}
              >
                {isSubmitting ? 'Creating...' : getAllPickupDates().length > 1 ? `Submit ${getAllPickupDates().length} Orders & Clear` : 'Submit and Clear'}
              </Button>
              <Button 
                type="button"
                onClick={() => handleSubmit(false)} 
                variant="outline"
                className="border-primary text-primary hover:bg-primary/10"
                disabled={isSubmitting}
              >
                {isSubmitting ? 'Creating...' : getAllPickupDates().length > 1 ? `Submit ${getAllPickupDates().length} Orders & Keep` : 'Submit and Keep Data'}
              </Button>
            </div>
            
            <div className="text-xs text-slate-500 pt-1 text-center">
              <span className="text-red-500" aria-label="required">*</span> Required fields
            </div>
          </form>
        </div>
        
        {/* Right Panel - Quote Information or Presets & Recent Orders */}
        <div className="lg:col-span-6">
          {formState.payingCustomer ? (
            <>
            <Card className="shadow-md border border-slate-200 h-[calc(100vh-8rem)] flex flex-col">
              <CardHeader className="bg-slate-100 border-b flex-shrink-0">
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <FileText className="h-5 w-5" />
                    Quote Information
                  </CardTitle>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-slate-600">
                      {formState.payingCustomer.customer_name}
                    </span>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs"
                      onClick={handleOpenAddNote}
                    >
                      <Plus className="h-3 w-3 mr-1" />
                      Add Note
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-4 flex-1 overflow-y-auto">
                {isLoadingPricingNotes ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
                    <span className="ml-2 text-slate-500">Loading pricing notes...</span>
                  </div>
                ) : pricingNotes.length === 0 ? (
                  <div className="text-center py-12 text-slate-500">
                    <FileText className="h-10 w-10 mx-auto mb-3 text-slate-300" />
                    <p className="font-medium">No pricing notes found</p>
                    <p className="text-sm mt-1">
                      No pricing notes are linked to {formState.payingCustomer.customer_name}.
                    </p>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="mt-3"
                      onClick={handleOpenAddNote}
                    >
                      <Plus className="h-4 w-4 mr-1" />
                      Create First Note
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {pricingNotes.map(note => (
                      <div
                        key={note.id}
                        className="border border-slate-200 rounded-lg p-3 bg-white hover:border-slate-300 transition-colors group"
                      >
                        <div className="flex items-start justify-between gap-2 mb-1">
                          <h3 className="font-semibold text-sm text-slate-900">{note.title}</h3>
                          <div className="flex items-center gap-1 shrink-0">
                            {note.category && (
                              <Badge
                                variant="outline"
                                className="text-xs"
                                style={{
                                  borderColor: note.category.color,
                                  color: note.category.color,
                                }}
                              >
                                {note.category.name}
                              </Badge>
                            )}
                            <Button
                              type="button"
                              size="icon"
                              variant="ghost"
                              className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                              onClick={() => handleOpenEditNote(note)}
                              title="Edit note"
                            >
                              <Pencil className="h-3 w-3" />
                            </Button>
                            <Button
                              type="button"
                              size="icon"
                              variant="ghost"
                              className="h-6 w-6 text-red-500 hover:text-red-700 opacity-0 group-hover:opacity-100 transition-opacity"
                              onClick={() => handleDeleteNote(note.id)}
                              title="Delete note"
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                        <p className="text-sm text-slate-700 whitespace-pre-wrap">{note.content}</p>
                        {note.tags && note.tags.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-2">
                            {note.tags.map(tag => (
                              <Badge key={tag} variant="secondary" className="text-xs">
                                {tag}
                              </Badge>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <Dialog open={isNoteDialogOpen} onOpenChange={setIsNoteDialogOpen}>
              <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>
                    {editingNote ? 'Edit Pricing Note' : 'Add Pricing Note'}
                  </DialogTitle>
                </DialogHeader>
                <PricingNoteForm
                  note={editingNote}
                  categories={noteCategories}
                  customers={noteCustomers}
                  onSubmit={handleSaveNote}
                  onCancel={() => {
                    setIsNoteDialogOpen(false);
                    setEditingNote(null);
                  }}
                  isLoading={isSavingNote}
                />
              </DialogContent>
            </Dialog>
            </>
          ) : (
            <Card className="shadow-md border border-slate-200 h-[calc(100vh-8rem)] flex flex-col">
              <CardHeader className="bg-slate-100 border-b flex-shrink-0">
                <div className="flex items-center justify-between">
                  <CardTitle>
                    {activeTab === 'presets' ? 'Saved Presets' : 'Recent Orders'}
                  </CardTitle>
                  <div className="flex bg-slate-200 rounded-lg p-1">
                    <button
                      onClick={() => setActiveTab('presets')}
                      className={`px-3 py-1 text-sm font-medium rounded-md transition-colors ${
                        activeTab === 'presets'
                          ? 'bg-white text-slate-900 shadow-sm'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      Presets
                    </button>
                    <button
                      onClick={() => setActiveTab('recent')}
                      className={`px-3 py-1 text-sm font-medium rounded-md transition-colors ${
                        activeTab === 'recent'
                          ? 'bg-white text-slate-900 shadow-sm'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      Recent
                    </button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-0 flex-1 overflow-hidden">
                {activeTab === 'presets' ? (
                  <PresetsList onSelectPreset={handleLoadPreset} />
                ) : (
                  <RecentOrders onSelectOrder={handleLoadRecentOrder} />
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Save Preset Dialog */}
      <SavePresetDialog
        isOpen={isPresetDialogOpen}
        onClose={() => setIsPresetDialogOpen(false)}
        formState={formState}
      />
    </div>
  );
} 