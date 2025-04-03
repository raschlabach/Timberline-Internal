'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { CustomerSelector } from '@/components/orders/customer-selector';
import { FilterToggle } from '@/components/orders/filter-toggle';
import { SkidsVinylEntry } from '@/components/orders/skids-vinyl-entry';
import { FootageEntry } from '@/components/orders/footage-entry';
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
  FilterToggleProps,
  SkidsVinylEntryProps,
  FootageEntryProps,
  DatePickerProps,
  StatusFlagsProps,
  SkidEntryRowProps,
  CustomerSelectorProps
} from '@/types/orders';
import { OrderCustomer, convertToOrderCustomer } from "@/types/shared";

export default function OrderEntryPage() {
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

  const handleCustomerSelect = (type: 'pickupCustomer' | 'deliveryCustomer' | 'payingCustomer', customer: Customer | null) => {
    setFormState(prev => ({
      ...prev,
      [type]: customer
    }));
  };

  const handleFilterChange = useCallback((filter: keyof OrderFormState['filters'], checked: boolean): void => {
    setFormState(prev => ({
      ...prev,
      filters: {
        ...prev.filters,
        [filter]: checked
      }
    }));
  }, []);

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
  }, []);

  const handleFootageChange = useCallback((footage: number): void => {
    setFormState(prev => ({
      ...prev,
      footage
    }));
  }, []);

  const handlePickupDateChange = useCallback((date: Date | null): void => {
    setFormState(prev => ({
      ...prev,
      pickupDate: date
    }));
  }, []);

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
  const handleSubmit = async () => {
    // Validate required fields
    if (!formState.pickupCustomer) {
      alert('Pickup Customer is required');
      return;
    }
    
    if (!formState.deliveryCustomer) {
      alert('Delivery Customer is required');
      return;
    }
    
    if (formState.freightType === 'skidsVinyl' && formState.skidsVinyl.length === 0) {
      alert('Please add at least one skid or vinyl item');
      return;
    }
    
    if (formState.freightType === 'footage' && formState.footage <= 0) {
      alert('Please enter a valid footage amount');
      return;
    }
    
    if (!formState.pickupDate) {
      alert('Pickup Date is required');
      return;
    }

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
          pickupDate: formState.pickupDate,
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
      
      // Dispatch event to notify of new order
      window.dispatchEvent(new CustomEvent('orderCreated', { 
        detail: { orderId: result.orderId }
      }));
      
      alert('Order created successfully!');
      
      // Clear the form by resetting to initial state
      setFormState({
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
        pickupDate: null,
        comments: '',
        freightQuote: '',
        statusFlags: {
          rushOrder: false,
          needsAttention: false,
        },
        links: []
      });

      // TODO: Redirect to the order details page
      // router.push(`/dashboard/orders/${result.orderId}`);
      
    } catch (error) {
      console.error('Error creating order:', error);
      alert(error instanceof Error ? error.message : 'Failed to create order');
    }
  };

  // Clear the form
  const handleClear = () => {
    if (confirm('Are you sure you want to clear all fields?')) {
      console.log('Clearing form state...');
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
        pickupDate: null,
        comments: '',
        freightQuote: '',
        statusFlags: {
          rushOrder: false,
          needsAttention: false,
        },
        links: []
      };
      console.log('Setting form state to:', initialState);
      setFormState(initialState);
    }
  };

  // Add this handler function before the return statement
  const handleLoadRecentOrder = (orderState: Partial<OrderFormState>) => {
    setFormState(prev => ({
      ...prev,
      ...orderState,
      pickupDate: null // Reset pickup date as requested
    }));
  };

  // Handle loading a preset
  const handleLoadPreset = (presetState: Partial<OrderFormState>) => {
    setFormState(prev => ({
      ...prev,
      ...presetState,
      pickupDate: null // Reset pickup date as requested
    }));
  };

  return (
    <div className="container mx-auto py-6">
      <h1 className="text-3xl font-bold mb-6">Order Entry</h1>
      
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Main Form Section - Takes up 6/12 of the page on large screens */}
        <div className="lg:col-span-6">
          {/* Form wrapper with visual styling */}
          <div className="border-2 border-slate-200 rounded-xl p-4 bg-slate-50 space-y-6 relative">
            <div className="absolute top-0 right-0 bg-primary text-white px-3 py-1 rounded-bl-lg rounded-tr-lg font-medium text-sm">
              ORDER FORM
            </div>
            
            {/* Section 1: Customer Selection */}
            <Card className="shadow-sm">
              <CardHeader className="bg-slate-100 border-b">
                <CardTitle className="flex items-center">
                  <span className="flex items-center justify-center bg-primary text-white rounded-full w-6 h-6 text-sm mr-2">1</span>
                  Customer Selection
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-4">
                <div className="space-y-4">
                  <div>
                    <Label className="mb-2 block font-medium">
                      Pickup Customer <span className="text-red-500">*</span>
                    </Label>
                    <CustomerSelector 
                      label="Pickup Customer"
                      required={true}
                      selectedCustomer={formState.pickupCustomer}
                      onSelectCustomer={(customer) => handleCustomerSelect('pickupCustomer', customer)}
                    />
                  </div>
                  
                  <div>
                    <Label className="mb-2 block font-medium">
                      Delivery Customer <span className="text-red-500">*</span>
                    </Label>
                    <CustomerSelector 
                      label="Delivery Customer"
                      required={true}
                      selectedCustomer={formState.deliveryCustomer}
                      onSelectCustomer={(customer) => handleCustomerSelect('deliveryCustomer', customer)}
                    />
                  </div>
                  
                  <div>
                    <Label className="mb-2 block font-medium">Paying Customer</Label>
                    <CustomerSelector 
                      label="Paying Customer"
                      required={false}
                      selectedCustomer={formState.payingCustomer}
                      onSelectCustomer={(customer) => handleCustomerSelect('payingCustomer', customer)}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
            
            {/* Section 2: Load Filters */}
            <Card className="shadow-sm">
              <CardHeader className="bg-slate-100 border-b">
                <CardTitle className="flex items-center">
                  <span className="flex items-center justify-center bg-primary text-white rounded-full w-6 h-6 text-sm mr-2">2</span>
                  Load Filters
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-4">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
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
              </CardContent>
            </Card>
            
            {/* Section 3: Freight Entry */}
            <Card className="shadow-sm">
              <CardHeader className="bg-slate-100 border-b">
                <CardTitle className="flex items-center">
                  <span className="flex items-center justify-center bg-primary text-white rounded-full w-6 h-6 text-sm mr-2">3</span>
                  Freight Entry
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-4">
                <Tabs 
                  defaultValue="skidsVinyl" 
                  value={formState.freightType}
                  onValueChange={(value) => handleFreightTypeChange(value as 'skidsVinyl' | 'footage')}
                >
                  <TabsList className="mb-4">
                    <TabsTrigger value="skidsVinyl">Skids / Vinyl</TabsTrigger>
                    <TabsTrigger value="footage">Footage</TabsTrigger>
                  </TabsList>
                  
                  <TabsContent value="skidsVinyl">
                    <SkidsVinylEntry 
                      skidsVinyl={formState.skidsVinyl}
                      onUpdate={handleSkidsVinylChange}
                    />
                  </TabsContent>
                  
                  <TabsContent value="footage">
                    <FootageEntry 
                      footage={formState.footage}
                      onUpdate={handleFootageChange}
                    />
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>
            
            {/* Section 4: Order Details */}
            <Card className="shadow-sm">
              <CardHeader className="bg-slate-100 border-b">
                <CardTitle className="flex items-center">
                  <span className="flex items-center justify-center bg-primary text-white rounded-full w-6 h-6 text-sm mr-2">4</span>
                  Order Details
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-4">
                <div className="space-y-4">
                  <div>
                    <Label className="mb-2 block font-medium">
                      Pickup Date <span className="text-red-500">*</span>
                    </Label>
                    <DatePicker 
                      date={formState.pickupDate}
                      onSelect={handlePickupDateChange}
                    />
                  </div>
                  
                  <div>
                    <Label htmlFor="comments" className="mb-2 block font-medium">Comments</Label>
                    <Textarea
                      id="comments"
                      placeholder="Enter any special instructions or notes about this order"
                      value={formState.comments}
                      onChange={handleCommentsChange}
                      className="min-h-[100px]"
                    />
                  </div>
                  
                  <div>
                    <Label htmlFor="freightQuote" className="mb-2 block font-medium">Freight Quote</Label>
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
                    <Label className="mb-2 block font-medium">Order Status</Label>
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
            
            {/* Section 5: Action Buttons */}
            <div className="flex justify-end space-x-4 pt-2">
              <Button variant="outline" onClick={handleClear}>Clear</Button>
              <Button 
                variant="outline" 
                onClick={() => setIsPresetDialogOpen(true)}
              >
                Save as Preset
              </Button>
              <Button onClick={handleSubmit} className="bg-primary hover:bg-primary/90">
                Create Order
              </Button>
            </div>
            
            <div className="text-xs text-slate-500 pt-2 text-center">
              <span className="text-red-500">*</span> Required fields
            </div>
          </div>
        </div>
        
        {/* Saved Presets Section - Takes up 3/12 of the page */}
        <div className="lg:col-span-3">
          <Card className="shadow-md border border-slate-200">
            <CardHeader className="bg-slate-100 border-b">
              <CardTitle>Saved Presets</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <PresetsList onSelectPreset={handleLoadPreset} />
            </CardContent>
          </Card>
        </div>

        {/* Recent Orders Section - Takes up 3/12 of the page */}
        <div className="lg:col-span-3">
          <Card className="shadow-md border border-slate-200">
            <CardHeader className="bg-slate-100 border-b">
              <CardTitle>Recent Orders</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <RecentOrders onSelectOrder={handleLoadRecentOrder} />
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