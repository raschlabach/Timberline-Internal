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
import { ChevronDown } from "lucide-react";
import { format } from "date-fns";

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
    
    if (formState.freightType === 'skidsVinyl' && formState.skidsVinyl.length === 0) {
      errors.freight = 'Please add at least one skid or vinyl item';
    }
    
    if (formState.freightType === 'footage' && formState.footage <= 0) {
      errors.footage = 'Please enter a valid footage amount';
    }
    
    if (!formState.pickupDate) {
      errors.pickupDate = 'Pickup Date is required';
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

  // Handle form submission
  const handleSubmit = async (clearForm: boolean = true) => {
    // Clear previous validation errors
    setValidationErrors({});
    
    // Validate form
    if (!validateForm()) {
      toast.error('Please fix the validation errors before submitting');
      return;
    }

    setIsSubmitting(true);
    
    try {
      const response = await fetch('/api/orders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          pickupCustomer: formState.pickupCustomer,
          deliveryCustomer: formState.deliveryCustomer,
          payingCustomer: formState.payingCustomer,
          filters: formState.filters,
          freightType: formState.freightType,
          skidsVinyl: formState.skidsVinyl,
          footage: formState.footage,
          handBundles: formState.handBundles,
          // Convert Date object to YYYY-MM-DD string to avoid timezone issues
          pickupDate: formState.pickupDate 
            ? format(formState.pickupDate, 'yyyy-MM-dd')
            : null,
          comments: formState.comments,
          freightQuote: formState.freightQuote ? parseFloat(formState.freightQuote) : null,
          statusFlags: formState.statusFlags,
          links: formState.links
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to create order');
      }

      const result = await response.json();
      
      // Dispatch event to notify of new order (works if load board is on same page)
      window.dispatchEvent(new CustomEvent('orderCreated', { 
        detail: { orderId: result.orderId }
      }));
      
      // Store timestamp in localStorage (works across page navigations)
      localStorage.setItem('lastOrderCreated', Date.now().toString());
      console.log('Order created, timestamp stored in localStorage');
      
      toast.success('Order created successfully!');
      
      // Clear the form only if clearForm is true
      if (clearForm) {
      resetForm();
      }

      // Stay on the order entry page for continued order creation
      
    } catch (error) {
      console.error('Error creating order:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to create order';
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
                    label="RR Order" 
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
                    <Label htmlFor="pickup-date" className="mb-1 block font-medium text-sm">
                      Pickup Date <span className="text-red-500" aria-label="required">*</span>
                    </Label>
                    <div id="pickup-date">
                      <DatePicker 
                        date={formState.pickupDate}
                        onSelect={handlePickupDateChange}
                      />
                    </div>
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
                {isSubmitting ? 'Creating Order...' : 'Submit and Clear'}
              </Button>
              <Button 
                type="button"
                onClick={() => handleSubmit(false)} 
                variant="outline"
                className="border-primary text-primary hover:bg-primary/10"
                disabled={isSubmitting}
              >
                {isSubmitting ? 'Creating Order...' : 'Submit and Keep Data'}
              </Button>
            </div>
            
            <div className="text-xs text-slate-500 pt-1 text-center">
              <span className="text-red-500" aria-label="required">*</span> Required fields
            </div>
          </form>
        </div>
        
        {/* Presets & Recent Orders Section - Takes up 6/12 of the page */}
        <div className="lg:col-span-6">
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