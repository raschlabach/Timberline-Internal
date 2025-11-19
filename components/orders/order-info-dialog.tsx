'use client';

import { useState, useEffect } from 'react';
import { format, parseISO, isValid } from 'date-fns';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { CustomerSelector } from "@/components/orders/customer-selector";
import { SkidsVinylEntry } from "@/components/orders/skids-vinyl-entry";
import { HandBundleEntry } from "@/components/orders/hand-bundle-entry";
import { toast } from 'sonner';
import { OrderData, OrderCustomer, SkidData, HandBundleData, Customer, convertToOrderCustomer } from '@/types/shared';
import { AssignOrderDialog } from "@/components/orders/assign-order-dialog";
import { CustomerEditModal } from "@/components/customer/customer-edit-modal";
import { Edit, ChevronDown } from "lucide-react";

interface OrderInfoDialogProps {
  isOpen: boolean;
  onClose: () => void;
  orderId: number;
  onOrderUpdate: () => void;
}

export function OrderInfoDialog({
  isOpen,
  onClose,
  orderId,
  onOrderUpdate
}: OrderInfoDialogProps) {
  const [order, setOrder] = useState<OrderData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [formData, setFormData] = useState<OrderData | null>(null);
  const [selectedOrder, setSelectedOrder] = useState<OrderData | null>(null);
  const [isAssignDialogOpen, setIsAssignDialogOpen] = useState(false);
  const [assignmentType, setAssignmentType] = useState<'pickup' | 'delivery'>('pickup');
  const [isCustomerEditModalOpen, setIsCustomerEditModalOpen] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<OrderCustomer | null>(null);
  const [isHandBundlesOpen, setIsHandBundlesOpen] = useState(false);

  // Auto-open hand bundles section when hand bundles are present
  useEffect(() => {
    if (formData?.handBundlesData && formData.handBundlesData.length > 0 && !isHandBundlesOpen) {
      setIsHandBundlesOpen(true);
    }
  }, [formData?.handBundlesData, isHandBundlesOpen]);

  useEffect(() => {
    if (isOpen && orderId) {
      fetchOrderDetails();
    }
  }, [isOpen, orderId]);

  async function fetchOrderDetails() {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/orders/${orderId}`);
      if (!response.ok) throw new Error('Failed to fetch order details');
      const data = await response.json();
      
      // Transform the data to match our interfaces
      const orderData: OrderData = {
        ...data,
        pickupCustomer: {
          id: data.pickupCustomer?.id || 0,
          name: data.pickupCustomer?.name || 'No Customer Selected',
          address: data.pickupCustomer?.address || ''
        },
        deliveryCustomer: {
          id: data.deliveryCustomer?.id || 0,
          name: data.deliveryCustomer?.name || 'No Customer Selected',
          address: data.deliveryCustomer?.address || ''
        },
        payingCustomer: data.payingCustomer ? {
          id: data.payingCustomer.id || 0,
          name: data.payingCustomer.name || 'No Customer Selected',
          address: data.payingCustomer.address || ''
        } : null,
        skids: data.skids || 0,
        vinyl: data.vinyl || 0,
        footage: data.footage || 0,
        skidsData: Array.isArray(data.skidsData) ? data.skidsData.flatMap((skid: any, index: number) => {
          // Expand items with quantity > 1 into multiple individual items
          const quantity = skid.quantity || 1;
          return Array.from({ length: quantity }, (_, i) => ({
            id: `${skid.id || index}-${i}`,
            type: 'skid' as const,
            width: skid.width || 0,
            length: skid.length || 0,
            footage: skid.footage || 0,
            number: i + 1 // Will be renumbered by SkidsVinylEntry
          }));
        }) : [],
        vinylData: Array.isArray(data.vinylData) ? data.vinylData.flatMap((vinyl: any, index: number) => {
          // Expand items with quantity > 1 into multiple individual items
          const quantity = vinyl.quantity || 1;
          return Array.from({ length: quantity }, (_, i) => ({
            id: `${vinyl.id || index}-${i}`,
            type: 'vinyl' as const,
            width: vinyl.width || 0,
            length: vinyl.length || 0,
            footage: vinyl.footage || 0,
            number: i + 1 // Will be renumbered by SkidsVinylEntry
          }));
        }) : [],
        pickupDate: data.pickupDate 
          ? (() => {
              // pickupDate should already be in YYYY-MM-DD format from the API
              // If it's a string, use it directly; if it's a Date, extract the date part
              if (typeof data.pickupDate === 'string') {
                // If it's already YYYY-MM-DD, use it
                if (/^\d{4}-\d{2}-\d{2}$/.test(data.pickupDate)) {
                  return data.pickupDate;
                }
                // If it's an ISO string, extract just the date part
                return data.pickupDate.split('T')[0];
              }
              // If it's a Date object, format it as YYYY-MM-DD in local timezone
              try {
                const date = new Date(data.pickupDate);
                if (!isNaN(date.getTime())) {
                  // Use local date components to avoid timezone conversion
                  const year = date.getFullYear();
                  const month = String(date.getMonth() + 1).padStart(2, '0');
                  const day = String(date.getDate()).padStart(2, '0');
                  return `${year}-${month}-${day}`;
                }
              } catch (e) {
                console.error('Error parsing pickupDate:', e);
              }
              return '';
            })()
          : '',
        isRushOrder: Boolean(data.isRushOrder),
        needsAttention: Boolean(data.needsAttention),
        comments: data.comments || '',
        freightQuote: data.freightQuote || '',
        filters: {
          ohioToIndiana: Boolean(data.filters?.ohioToIndiana),
          backhaul: Boolean(data.filters?.backhaul),
          localFlatbed: Boolean(data.filters?.localFlatbed),
          rrOrder: Boolean(data.filters?.rrOrder),
          localSemi: Boolean(data.filters?.localSemi),
          middlefield: Boolean(data.filters?.middlefield),
          paNy: Boolean(data.filters?.paNy)
        },
        links: data.links || [],
        created_at: data.created_at || new Date().toISOString(),
        created_by: data.created_by,
        pickupAssignment: data.pickupAssignment || null,
        deliveryAssignment: data.deliveryAssignment || null,
        isTransferOrder: Boolean(data.isTransferOrder)
      };
      
      setOrder(orderData);
      setFormData(orderData);
    } catch (error) {
      console.error('Error fetching order details:', error);
      toast.error('Failed to load order details');
    } finally {
      setIsLoading(false);
    }
  }

  async function handleSave() {
    if (!orderId || !formData) return;
    
    setIsSaving(true);
    try {
      // Transform skidsData and vinylData to include quantity field (each item = quantity 1)
      const skidsData = formData.skidsData.map(skid => ({
        id: skid.id,
        width: skid.width,
        length: skid.length,
        footage: skid.footage,
        quantity: 1 // Each SkidData item represents a single skid
      }));
      
      const vinylData = formData.vinylData.map(vinyl => ({
        id: vinyl.id,
        width: vinyl.width,
        length: vinyl.length,
        footage: vinyl.footage,
        quantity: 1 // Each SkidData item represents a single vinyl
      }));
      
      // Convert pickupDate to YYYY-MM-DD string
      // The date input field returns YYYY-MM-DD format, so we use it directly
      let pickupDateValue: string | null = null;
      if (formData.pickupDate) {
        if (typeof formData.pickupDate === 'string') {
          // If it's already a string, use it directly (should be YYYY-MM-DD)
          pickupDateValue = formData.pickupDate;
        } else {
          // If it's somehow a Date object (shouldn't happen but handle it), format it
          const date = new Date(formData.pickupDate as any);
          if (!isNaN(date.getTime())) {
            pickupDateValue = format(date, 'yyyy-MM-dd');
          }
        }
      }
      
      const response = await fetch(`/api/orders/${orderId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pickupCustomer: formData.pickupCustomer,
          deliveryCustomer: formData.deliveryCustomer,
          payingCustomer: formData.payingCustomer,
          pickupDate: pickupDateValue,
          isRushOrder: formData.isRushOrder,
          needsAttention: formData.needsAttention,
          comments: formData.comments,
          freightQuote: formData.freightQuote,
          filters: formData.filters,
          skidsData: skidsData,
          vinylData: vinylData
        })
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to update order');
      }
      
      toast.success('Order updated successfully');
      onOrderUpdate();
      onClose();
    } catch (error) {
      console.error('Error updating order:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to update order');
    } finally {
      setIsSaving(false);
    }
  }

  function handleCustomerSelect(type: 'pickupCustomer' | 'deliveryCustomer' | 'payingCustomer', customer: Customer | null) {
    if (!formData) return;
    const orderCustomer = customer ? convertToOrderCustomer(customer) : null;
    setFormData(prev => {
      if (!prev) return null;
      return {
        ...prev,
        [type]: orderCustomer
      };
    });
  }

  // Helper function to convert OrderCustomer to Customer
  function convertToCustomer(orderCustomer: OrderCustomer): Customer {
    return {
      id: orderCustomer.id,
      customer_name: orderCustomer.name,
      address: orderCustomer.address.split(', ')[0] || '',
      city: orderCustomer.address.split(', ')[1] || '',
      state: orderCustomer.address.split(', ')[2] || '',
      zip_code: '',
      county: '',
      phone_number_1: null,
      phone_number_2: null,
      notes: null
    };
  }

  function handleInputChange(field: keyof OrderData, value: any) {
    if (!formData) return;
    setFormData(prev => {
      if (!prev) return null;
      return {
        ...prev,
        [field]: value
      };
    });
  }

  function handleFilterChange(filterId: keyof OrderData['filters'], checked: boolean) {
    if (!formData) return;
    setFormData(prev => {
      if (!prev) return null;
      return {
        ...prev,
        filters: {
          ...prev.filters,
          [filterId]: checked
        }
      };
    });
  }

  function handleSkidsVinylChange(items: SkidData[]) {
    if (!formData) return;
    setFormData(prev => {
      if (!prev) return null;
      return {
        ...prev,
        skidsData: items.filter((item: SkidData): item is SkidData => item.type === 'skid'),
        vinylData: items.filter((item: SkidData): item is SkidData => item.type === 'vinyl')
      };
    });
  }

  function handleHandBundlesChange(handBundles: HandBundleData[]) {
    if (!formData) return;
    setFormData(prev => {
      if (!prev) return null;
      return {
        ...prev,
        handBundlesData: handBundles
      };
    });
  }

  const handleCustomerEdit = (customer: OrderCustomer) => {
    setSelectedCustomer(customer);
    setIsCustomerEditModalOpen(true);
  };

  const handleCustomerUpdated = (updatedCustomer: any) => {
    if (!formData) return;
    
    // Update the appropriate customer field based on which one was edited
    const customerType = formData.pickupCustomer?.id === updatedCustomer.id ? 'pickupCustomer' :
                        formData.deliveryCustomer?.id === updatedCustomer.id ? 'deliveryCustomer' :
                        formData.payingCustomer?.id === updatedCustomer.id ? 'payingCustomer' : null;
    
    if (customerType) {
      setFormData(prev => {
        if (!prev) return null;
        return {
          ...prev,
          [customerType]: {
            id: updatedCustomer.id,
            name: updatedCustomer.customer_name,
            address: updatedCustomer.address
          }
        };
      });
    }
  };

  if (isLoading || !formData) {
    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="sm:max-w-[800px] h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Loading...</DialogTitle>
          </DialogHeader>
          <div className="flex items-center justify-center flex-1">
            <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full"></div>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[800px] h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Order #{formData.id} Information</DialogTitle>
        </DialogHeader>
        
        <ScrollArea className="flex-1 pr-4">
          <div className="space-y-8">
            {/* General Section */}
            <div className="bg-white p-6 rounded-lg border shadow-sm">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">General Information</h3>
              <div className="space-y-4">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <Label htmlFor="pickupCustomer" className="text-red-600">Pickup Customer</Label>
                    {formData?.pickupCustomer && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0"
                        onClick={() => formData.pickupCustomer && handleCustomerEdit(formData.pickupCustomer)}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                  <CustomerSelector 
                    label="Pickup Customer"
                    required={true}
                    selectedCustomer={formData?.pickupCustomer ? convertToCustomer(formData.pickupCustomer) : null}
                    onSelectCustomer={(customer) => handleCustomerSelect('pickupCustomer', customer)}
                  />
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <Label htmlFor="deliveryCustomer">Delivery Customer</Label>
                    {formData?.deliveryCustomer && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0"
                        onClick={() => formData.deliveryCustomer && handleCustomerEdit(formData.deliveryCustomer)}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                  <CustomerSelector 
                    label="Delivery Customer"
                    required={true}
                    selectedCustomer={formData?.deliveryCustomer ? convertToCustomer(formData.deliveryCustomer) : null}
                    onSelectCustomer={(customer) => handleCustomerSelect('deliveryCustomer', customer)}
                  />
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <Label htmlFor="payingCustomer" className="text-gray-600">Paying Customer</Label>
                    {formData?.payingCustomer && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0"
                        onClick={() => formData.payingCustomer && handleCustomerEdit(formData.payingCustomer)}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                  <CustomerSelector 
                    label="Paying Customer"
                    required={false}
                    selectedCustomer={formData?.payingCustomer ? convertToCustomer(formData.payingCustomer) : null}
                    onSelectCustomer={(customer) => handleCustomerSelect('payingCustomer', customer)}
                  />
                </div>
              </div>
            </div>

            {/* Freight Information */}
            <div className="bg-white p-6 rounded-lg border shadow-sm">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Freight Information</h3>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="freightQuote" className="text-gray-600">Freight Quote</Label>
                  <Input
                    type="text"
                    id="freightQuote"
                    value={formData.freightQuote}
                    onChange={(e) => handleInputChange('freightQuote', e.target.value)}
                    className="w-full"
                  />
                </div>
                <div>
                  <Label htmlFor="pickupDate" className="text-gray-600">Pickup Date</Label>
                  <Input
                    type="date"
                    id="pickupDate"
                    value={formData.pickupDate}
                    onChange={(e) => handleInputChange('pickupDate', e.target.value)}
                  />
                </div>
                <div className="flex items-center space-x-4">
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="isRushOrder"
                      checked={formData.isRushOrder}
                      onCheckedChange={(checked) => handleInputChange('isRushOrder', checked)}
                    />
                    <Label htmlFor="isRushOrder" className="text-red-600">Rush Order</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="needsAttention"
                      checked={formData.needsAttention}
                      onCheckedChange={(checked) => handleInputChange('needsAttention', checked)}
                    />
                    <Label htmlFor="needsAttention" className="text-amber-600">Needs Attention</Label>
                  </div>
                </div>
              </div>
            </div>

            {/* Skids & Vinyl Section */}
            <div className="bg-white p-6 rounded-lg border shadow-sm">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Skids & Vinyl Details</h3>
              <SkidsVinylEntry
                skidsVinyl={[
                  ...formData.skidsData.map(skid => ({
                    ...skid,
                    id: skid.id.toString(),
                    type: 'skid' as const
                  })),
                  ...formData.vinylData.map(vinyl => ({
                    ...vinyl,
                    id: vinyl.id.toString(),
                    type: 'vinyl' as const
                  }))
                ]}
                onUpdate={(items: SkidData[]) => {
                  const skids = items.filter((item: SkidData) => item.type === 'skid');
                  const vinyl = items.filter((item: SkidData) => item.type === 'vinyl');
                  handleSkidsVinylChange([...skids, ...vinyl]);
                }}
              />
            </div>

            {/* Hand Bundles Section */}
            <div className="bg-white rounded-lg border shadow-sm">
              <Collapsible open={isHandBundlesOpen} onOpenChange={setIsHandBundlesOpen}>
                <CollapsibleTrigger asChild>
                  <div className="p-6 pb-4 cursor-pointer hover:bg-gray-50 transition-colors">
                    <h3 className="text-lg font-semibold text-gray-900 flex items-center justify-between">
                      <div className="flex items-center">
                        Hand Bundles
                        {formData.handBundlesData && formData.handBundlesData.length > 0 && (
                          <span className="ml-2 px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full">
                            {formData.handBundlesData.length}
                          </span>
                        )}
                      </div>
                      <ChevronDown className={`h-5 w-5 transition-transform ${isHandBundlesOpen ? 'rotate-180' : ''}`} />
                    </h3>
                  </div>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="px-6 pb-6">
                    <HandBundleEntry
                      handBundles={formData.handBundlesData || []}
                      onUpdate={(handBundles: HandBundleData[]) => {
                        handleHandBundlesChange(handBundles);
                      }}
                    />
                  </div>
                </CollapsibleContent>
              </Collapsible>
            </div>

            {/* Load Filters Section */}
            <div className="bg-white p-6 rounded-lg border shadow-sm">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Load Type Filters</h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="ohioToIndiana"
                    checked={formData.filters.ohioToIndiana}
                    onCheckedChange={(checked) => handleFilterChange('ohioToIndiana', checked as boolean)}
                  />
                  <Label htmlFor="ohioToIndiana">Ohio to Indiana</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="backhaul"
                    checked={formData.filters.backhaul}
                    onCheckedChange={(checked) => handleFilterChange('backhaul', checked as boolean)}
                  />
                  <Label htmlFor="backhaul">Backhaul</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="localFlatbed"
                    checked={formData.filters.localFlatbed}
                    onCheckedChange={(checked) => handleFilterChange('localFlatbed', checked as boolean)}
                  />
                  <Label htmlFor="localFlatbed">Local Flatbed</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="rrOrder"
                    checked={formData.filters.rrOrder}
                    onCheckedChange={(checked) => handleFilterChange('rrOrder', checked as boolean)}
                  />
                  <Label htmlFor="rrOrder">RR Order</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="localSemi"
                    checked={formData.filters.localSemi}
                    onCheckedChange={(checked) => handleFilterChange('localSemi', checked as boolean)}
                  />
                  <Label htmlFor="localSemi">Local Semi</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="middlefield"
                    checked={formData.filters.middlefield}
                    onCheckedChange={(checked) => handleFilterChange('middlefield', checked as boolean)}
                  />
                  <Label htmlFor="middlefield">Middlefield</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="paNy"
                    checked={formData.filters.paNy}
                    onCheckedChange={(checked) => handleFilterChange('paNy', checked as boolean)}
                  />
                  <Label htmlFor="paNy">PA/NY</Label>
                </div>
              </div>
            </div>

            {/* Additional Information Section */}
            <div className="bg-white p-6 rounded-lg border shadow-sm">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Additional Information</h3>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="comments" className="text-gray-600">Comments</Label>
                  <Textarea
                    id="comments"
                    value={formData.comments}
                    onChange={(e) => handleInputChange('comments', e.target.value)}
                    className="min-h-[100px]"
                  />
                </div>
              </div>
            </div>

            {/* Assignment Section */}
            <div className="bg-white p-6 rounded-lg border shadow-sm">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Assignment Information</h3>
              <div className="space-y-6">
                {/* Pickup Assignment */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-red-600 font-medium">Pickup Assignment</Label>
                    {formData.pickupAssignment ? (
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={async () => {
                          try {
                            const response = await fetch('/api/truckloads/assign', {
                              method: 'DELETE',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({
                                orderId: formData.id,
                                assignmentType: 'pickup'
                              })
                            });
                            
                            if (!response.ok) throw new Error('Failed to unassign pickup');
                            
                            toast.success('Pickup unassigned successfully');
                            fetchOrderDetails();
                            onOrderUpdate();
                          } catch (error) {
                            console.error('Error unassigning pickup:', error);
                            toast.error('Failed to unassign pickup');
                          }
                        }}
                      >
                        Unassign
                      </Button>
                    ) : (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setSelectedOrder(formData);
                          setIsAssignDialogOpen(true);
                          setAssignmentType('pickup');
                        }}
                      >
                        Assign
                      </Button>
                    )}
                  </div>
                  {formData.pickupAssignment && (
                    <div className="bg-gray-50 p-3 rounded-md">
                      <div className="flex items-center gap-2">
                        <div 
                          className="w-3 h-3 rounded-full" 
                          style={{ backgroundColor: formData.pickupAssignment.driverColor || '#808080' }}
                        />
                        <span className="font-medium">{formData.pickupAssignment.driverName}</span>
                      </div>
                      <div className="text-sm text-gray-600 mt-1">
                        {formData.pickupAssignment.startDate && formData.pickupAssignment.endDate && (
                          <>
                            {format(parseISO(formData.pickupAssignment.startDate), 'MMM d')} - {format(parseISO(formData.pickupAssignment.endDate), 'MMM d, yyyy')}
                          </>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* Delivery Assignment */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="font-medium">Delivery Assignment</Label>
                    {formData.deliveryAssignment ? (
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={async () => {
                          try {
                            const response = await fetch('/api/truckloads/assign', {
                              method: 'DELETE',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({
                                orderId: formData.id,
                                assignmentType: 'delivery'
                              })
                            });
                            
                            if (!response.ok) throw new Error('Failed to unassign delivery');
                            
                            toast.success('Delivery unassigned successfully');
                            fetchOrderDetails();
                            onOrderUpdate();
                          } catch (error) {
                            console.error('Error unassigning delivery:', error);
                            toast.error('Failed to unassign delivery');
                          }
                        }}
                      >
                        Unassign
                      </Button>
                    ) : (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setSelectedOrder(formData);
                          setIsAssignDialogOpen(true);
                          setAssignmentType('delivery');
                        }}
                      >
                        Assign
                      </Button>
                    )}
                  </div>
                  {formData.deliveryAssignment && (
                    <div className="bg-gray-50 p-3 rounded-md">
                      <div className="flex items-center gap-2">
                        <div 
                          className="w-3 h-3 rounded-full" 
                          style={{ backgroundColor: formData.deliveryAssignment.driverColor || '#808080' }}
                        />
                        <span className="font-medium">{formData.deliveryAssignment.driverName}</span>
                      </div>
                      <div className="text-sm text-gray-600 mt-1">
                        {formData.deliveryAssignment.startDate && formData.deliveryAssignment.endDate && (
                          <>
                            {format(parseISO(formData.deliveryAssignment.startDate), 'MMM d')} - {format(parseISO(formData.deliveryAssignment.endDate), 'MMM d, yyyy')}
                          </>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </ScrollArea>
        
        {/* Assignment Dialog */}
        {selectedOrder && (
          <AssignOrderDialog
            isOpen={isAssignDialogOpen}
            onClose={() => {
              setIsAssignDialogOpen(false);
              setSelectedOrder(null);
            }}
            orderId={selectedOrder.id}
            pickupCustomer={selectedOrder.pickupCustomer}
            deliveryCustomer={selectedOrder.deliveryCustomer}
            pickupAssignment={selectedOrder.pickupAssignment ? {
              truckloadId: selectedOrder.pickupAssignment.truckloadId,
              driverName: selectedOrder.pickupAssignment.driverName,
              truckloadNumber: undefined
            } : undefined}
            deliveryAssignment={selectedOrder.deliveryAssignment ? {
              truckloadId: selectedOrder.deliveryAssignment.truckloadId,
              driverName: selectedOrder.deliveryAssignment.driverName,
              truckloadNumber: undefined
            } : undefined}
            onAssignmentChange={() => {
              fetchOrderDetails();
              onOrderUpdate();
            }}
          />
        )}

        <div className="flex justify-between space-x-2 mt-6 pt-4 border-t">
          <Button 
            variant="destructive" 
            size="sm"
            onClick={async () => {
              if (confirm(`Are you sure you want to permanently delete Order #${orderId}? This action cannot be undone.`)) {
                try {
                  const response = await fetch(`/api/orders/${orderId}`, {
                    method: 'DELETE',
                  });
                  
                  if (!response.ok) {
                    const error = await response.json();
                    throw new Error(error.error || 'Failed to delete order');
                  }
                  
                  toast.success('Order deleted successfully');
                  onOrderUpdate();
                  onClose();
                } catch (error) {
                  console.error('Error deleting order:', error);
                  toast.error(error instanceof Error ? error.message : 'Failed to delete order');
                }
              }
            }}
          >
            Delete Order
          </Button>
          <div className="flex space-x-2">
            <Button variant="outline" onClick={onClose}>Cancel</Button>
            <Button onClick={handleSave} disabled={isSaving}>
              {isSaving ? 'Saving...' : 'Save Changes'}
            </Button>
          </div>
        </div>

        {/* Customer Edit Modal */}
        {selectedCustomer && (
          <CustomerEditModal
            customer={{
              id: selectedCustomer.id,
              customer_name: selectedCustomer.name,
              address: selectedCustomer.address,
              city: '', // These will be populated from the API
              state: '',
              zip: '',
              county: '',
              phone_number_1: null,
              phone_number_1_ext: null,
              phone_number_2: null,
              phone_number_2_ext: null,
              price_category: 0,
              notes: null
            }}
            isOpen={isCustomerEditModalOpen}
            onClose={() => {
              setIsCustomerEditModalOpen(false);
              setSelectedCustomer(null);
            }}
            onSave={handleCustomerUpdated}
          />
        )}
      </DialogContent>
    </Dialog>
  );
} 