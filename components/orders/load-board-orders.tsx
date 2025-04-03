'use client';

import { useEffect, useState, useCallback } from 'react';
import { format, parseISO } from 'date-fns';
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { AlertCircle, MessageSquare, Zap, Search, ChevronDown, ChevronUp, ChevronsUpDown, Truck } from "lucide-react";
import { 
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { AssignOrderDialog } from "@/components/orders/assign-order-dialog";
import { OrderInfoDialog } from "@/components/orders/order-info-dialog";
import { BillOfLadingDialog } from "@/app/components/BillOfLadingDialog";

interface Order {
  id: number;
  pickupCustomer: {
    id: number;
    name: string;
    address: string;
    phone?: string;
    phone2?: string;
  };
  deliveryCustomer: {
    id: number;
    name: string;
    address: string;
    phone?: string;
    phone2?: string;
  };
  payingCustomer?: {
    id: number;
    name: string;
  };
  skids: number;
  vinyl: number;
  footage: number;
  skidsData: Array<{
    id: number;
    type: 'skid';
    width: number;
    length: number;
    footage: number;
    quantity: number;
  }>;
  vinylData: Array<{
    id: number;
    type: 'vinyl';
    width: number;
    length: number;
    footage: number;
    quantity: number;
  }>;
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
  pickupAssignment?: {
    truckloadId: number;
    driverName: string;
    driverColor: string;
    startDate: string;
    endDate: string;
    description: string;
  };
  deliveryAssignment?: {
    truckloadId: number;
    driverName: string;
    driverColor: string;
    startDate: string;
    endDate: string;
  };
  isTransferOrder: boolean;
}

// Add new types for sorting
type SortField = 'pickupDate' | 'createdAt' | 'pickupCustomer' | 'deliveryCustomer';

interface SortConfig {
  field: SortField;
  direction: 'asc' | 'desc';
}

function useLoadBoardOrders() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortConfig, setSortConfig] = useState<SortConfig>({ field: 'pickupDate', direction: 'asc' });
  const [activeFilters, setActiveFilters] = useState<{[key: string]: boolean}>({
    ohioToIndiana: false,
    backhaul: false,
    localFlatbed: false,
    rrOrder: false,
    localSemi: false,
    middlefield: false,
    paNy: false
  });

  const fetchOrders = useCallback(async () => {
    try {
      const response = await fetch('/api/orders/recent');
      if (!response.ok) throw new Error('Failed to fetch orders');
      const data = await response.json();
      setOrders(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load orders');
      console.error('Error fetching orders:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Set up polling interval
  useEffect(() => {
    fetchOrders(); // Initial fetch
    
    const intervalId = setInterval(() => {
      fetchOrders();
    }, 3000); // Poll every 3 seconds

    return () => clearInterval(intervalId);
  }, [fetchOrders]);

  const sortOrders = (ordersToSort: Order[]): Order[] => {
    // First separate rush orders
    const rushOrders = ordersToSort.filter(order => order.isRushOrder);
    const nonRushOrders = ordersToSort.filter(order => !order.isRushOrder);
    
    // Sort function for each field
    const sortFunctions = {
      pickupDate: (a: Order, b: Order) => {
        const dateA = a.pickupDate ? new Date(a.pickupDate).getTime() : 0;
        const dateB = b.pickupDate ? new Date(b.pickupDate).getTime() : 0;
        return sortConfig.direction === 'asc' ? dateA - dateB : dateB - dateA;
      },
      createdAt: (a: Order, b: Order) => {
        const dateA = new Date(a.created_at).getTime();
        const dateB = new Date(b.created_at).getTime();
        return sortConfig.direction === 'asc' ? dateA - dateB : dateB - dateA;
      },
      pickupCustomer: (a: Order, b: Order) => {
        const nameA = a.pickupCustomer.name.toLowerCase();
        const nameB = b.pickupCustomer.name.toLowerCase();
        return sortConfig.direction === 'asc' 
          ? nameA.localeCompare(nameB)
          : nameB.localeCompare(nameA);
      },
      deliveryCustomer: (a: Order, b: Order) => {
        const nameA = a.deliveryCustomer.name.toLowerCase();
        const nameB = b.deliveryCustomer.name.toLowerCase();
        return sortConfig.direction === 'asc' 
          ? nameA.localeCompare(nameB)
          : nameB.localeCompare(nameA);
      }
    };

    // Sort both groups separately using the selected sort function
    const sortedRushOrders = [...rushOrders].sort(sortFunctions[sortConfig.field]);
    const sortedNonRushOrders = [...nonRushOrders].sort(sortFunctions[sortConfig.field]);

    // Combine the sorted groups with rush orders always on top
    return [...sortedRushOrders, ...sortedNonRushOrders];
  };

  const filteredOrders = sortOrders(orders.filter(order => {
    // Search term filter
    const searchLower = searchTerm.toLowerCase();
    const matchesSearch = searchTerm === '' || 
      order.pickupCustomer.name.toLowerCase().includes(searchLower) ||
      order.deliveryCustomer.name.toLowerCase().includes(searchLower);

    // Load type filters
    const hasActiveFilters = Object.values(activeFilters).some(value => value);
    if (!hasActiveFilters) return matchesSearch;

    const matchesFilters = Object.entries(activeFilters).some(([key, isActive]) => 
      isActive && order.filters[key as keyof typeof order.filters]
    );

    return matchesSearch && matchesFilters;
  }));

  return { 
    orders: filteredOrders, 
    isLoading, 
    error, 
    refresh: fetchOrders,
    searchTerm,
    setSearchTerm,
    activeFilters,
    setActiveFilters,
    sortConfig,
    setSortConfig
  };
}

function formatDate(dateString: string): string {
  try {
    return format(parseISO(dateString), 'MM/dd/yy HH:mm');
  } catch (error) {
    console.error('Error formatting date:', error);
    return 'Invalid date';
  }
}

const FILTER_OPTIONS = [
  { id: 'ohioToIndiana', label: 'OH → IN' },
  { id: 'backhaul', label: 'Backhaul' },
  { id: 'localFlatbed', label: 'Local Flatbed' },
  { id: 'rrOrder', label: 'RNR' },
  { id: 'localSemi', label: 'Local Semi' },
  { id: 'middlefield', label: 'Middlefield' },
  { id: 'paNy', label: 'PA/NY' },
];

function SortHeader({ 
  field, 
  label, 
  sortConfig, 
  onSort 
}: { 
  field: SortField; 
  label: string; 
  sortConfig: SortConfig; 
  onSort: (field: SortField) => void;
}) {
  const isCurrent = sortConfig.field === field;
  
  return (
    <button
      onClick={() => onSort(field)}
      className="flex items-center gap-1 hover:text-gray-900 focus:outline-none"
    >
      <span>{label}</span>
      <span className="flex items-center justify-center w-4">
        {isCurrent ? (
          sortConfig.direction === 'asc' ? (
            <ChevronUp className="h-3 w-3" />
          ) : (
            <ChevronDown className="h-3 w-3" />
          )
        ) : (
          <ChevronsUpDown className="h-3 w-3 text-gray-400" />
        )}
      </span>
    </button>
  );
}

export function LoadBoardOrders() {
  const { 
    orders, 
    isLoading, 
    error, 
    searchTerm, 
    setSearchTerm, 
    activeFilters, 
    setActiveFilters,
    sortConfig,
    setSortConfig,
    refresh: fetchOrders
  } = useLoadBoardOrders();

  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [isAssignDialogOpen, setIsAssignDialogOpen] = useState(false);
  const [isInfoDialogOpen, setIsInfoDialogOpen] = useState(false);

  const handleSort = (field: SortField) => {
    setSortConfig(prev => ({
      field,
      direction: prev.field === field && prev.direction === 'asc' ? 'desc' : 'asc'
    }));
  };

  if (isLoading) {
    return (
      <div className="flex gap-2">
        <Card className="w-56 p-4 bg-gray-50/50 border-none shadow-none">
          <div className="animate-pulse space-y-4">
            <div className="h-8 bg-gray-200 rounded"></div>
            <div className="space-y-2">
              {[...Array(7)].map((_, i) => (
                <div key={i} className="h-6 bg-gray-200 rounded"></div>
              ))}
            </div>
          </div>
        </Card>
        <Card className="flex-1 p-4">
          <div className="flex items-center justify-center h-32">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
          </div>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex gap-2">
        <Card className="w-56 p-4">
          <div className="text-sm text-red-500">Error loading filters</div>
        </Card>
        <Card className="flex-1 p-4">
          <div className="text-sm text-red-500">{error}</div>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex gap-2">
      <Card className="w-56 p-4 bg-gray-50/50 border-none shadow-none">
        <div className="space-y-6">
          {/* Search */}
          <div className="space-y-2">
            <Label className="text-xs font-medium text-gray-600">Search Orders</Label>
            <div className="relative">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-gray-500" />
              <Input
                type="text"
                placeholder="Search..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-8 bg-white text-sm"
              />
            </div>
          </div>

          {/* Filters */}
          <div className="space-y-2">
            <Label className="text-xs font-medium text-gray-600">Load Type</Label>
            <div className="space-y-2">
              {FILTER_OPTIONS.map((option) => (
                <div key={option.id} className="flex items-center space-x-2">
                  <Checkbox
                    id={option.id}
                    checked={activeFilters[option.id]}
                    onCheckedChange={(checked) => 
                      setActiveFilters(prev => ({ ...prev, [option.id]: checked === true }))
                    }
                    className="rounded-sm"
                  />
                  <label
                    htmlFor={option.id}
                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                  >
                    {option.label}
                  </label>
                </div>
              ))}
            </div>
          </div>
        </div>
      </Card>

      <Card className="flex-1 bg-gray-50/50 border-none shadow-none">
        <ScrollArea className="h-[calc(100vh-12rem)]">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent border-b border-gray-300">
                <TableHead className="h-8 text-xs font-medium text-gray-600 tracking-wide bg-transparent w-[120px]">
                  <div className="flex items-center justify-between">
                    <SortHeader
                      field="createdAt"
                      label="Created By"
                      sortConfig={sortConfig}
                      onSort={handleSort}
                    />
                  </div>
                </TableHead>
                <TableHead className="h-8 text-xs font-medium text-gray-600 tracking-wide bg-transparent w-[120px]">Status</TableHead>
                <TableHead className="h-8 text-xs font-medium text-gray-600 tracking-wide bg-transparent min-w-[300px]">
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-2">
                      <SortHeader
                        field="pickupCustomer"
                        label="Pickup"
                        sortConfig={sortConfig}
                        onSort={handleSort}
                      />
                      <span className="text-gray-400">→</span>
                      <SortHeader
                        field="deliveryCustomer"
                        label="Delivery"
                        sortConfig={sortConfig}
                        onSort={handleSort}
                      />
                    </div>
                  </div>
                </TableHead>
                <TableHead className="h-8 text-xs font-medium text-gray-600 tracking-wide bg-transparent min-w-[300px]">Freight</TableHead>
                <TableHead className="h-8 text-xs font-medium text-gray-600 tracking-wide bg-transparent min-w-[250px]">
                  <div className="flex items-center justify-between">
                    <SortHeader
                      field="pickupDate"
                      label="Dates"
                      sortConfig={sortConfig}
                      onSort={handleSort}
                    />
                  </div>
                </TableHead>
                <TableHead className="h-8 text-xs font-medium text-gray-600 tracking-wide bg-transparent w-[150px] text-right pr-4">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {orders.map((order, index) => (
                <TableRow 
                  key={order.id}
                  className={`
                    group transition-colors duration-100 border-b border-gray-200
                    ${index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}
                    hover:bg-gray-100/80
                  `}
                >
                  <TableCell className="py-2 px-4 w-[120px]">
                    <div className="text-sm text-gray-700">
                      User
                    </div>
                  </TableCell>
                  <TableCell className="py-2 px-4 w-[120px]">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-gray-300"></div>
                      <TooltipProvider>
                        <div className="flex items-center gap-2">
                          {order.isRushOrder && (
                            <Tooltip delayDuration={100}>
                              <TooltipTrigger>
                                <Zap className="w-[14px] h-[14px] text-red-500" />
                              </TooltipTrigger>
                              <TooltipContent side="top" className="text-xs bg-gray-900 text-white px-2 py-1">
                                Rush Order
                              </TooltipContent>
                            </Tooltip>
                          )}
                          {order.needsAttention && (
                            <Tooltip delayDuration={100}>
                              <TooltipTrigger>
                                <AlertCircle className="w-[14px] h-[14px] text-amber-500" />
                              </TooltipTrigger>
                              <TooltipContent side="top" className="text-xs bg-gray-900 text-white px-2 py-1">
                                Needs Attention
                              </TooltipContent>
                            </Tooltip>
                          )}
                          {order.comments && (
                            <Tooltip delayDuration={100}>
                              <TooltipTrigger>
                                <MessageSquare className="w-[14px] h-[14px] text-blue-500" />
                              </TooltipTrigger>
                              <TooltipContent side="top" className="text-xs bg-gray-900 text-white px-2 py-1">
                                Has Comments
                              </TooltipContent>
                            </Tooltip>
                          )}
                        </div>
                      </TooltipProvider>
                    </div>
                  </TableCell>
                  <TableCell className="py-2 px-4 min-w-[300px]">
                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-2">
                        {order.pickupAssignment && (
                          <TooltipProvider>
                            <Tooltip delayDuration={100}>
                              <TooltipTrigger>
                                <Truck 
                                  className="w-[18px] h-[18px]" 
                                  strokeWidth={2.5}
                                  style={{ color: order.pickupAssignment.driverColor }}
                                />
                              </TooltipTrigger>
                              <TooltipContent 
                                side="top" 
                                className="text-sm bg-gray-900 text-white px-4 py-3 space-y-1.5"
                              >
                                <div className="font-medium">
                                  Assigned to {order.pickupAssignment.driverName}
                                </div>
                                <div>
                                  {format(parseISO(order.pickupAssignment.startDate), 'MM/dd')} - {format(parseISO(order.pickupAssignment.endDate), 'MM/dd')}
                                </div>
                                {order.pickupAssignment.description && (
                                  <div className="text-gray-300">{order.pickupAssignment.description}</div>
                                )}
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        )}
                        <span className="text-red-600 font-medium text-sm">
                          {order.pickupCustomer.name}
                        </span>
                      </div>
                      <span className="text-gray-400">→</span>
                      <div className="flex items-center gap-2">
                        <span className="text-gray-900 font-medium text-sm">
                          {order.deliveryCustomer.name}
                        </span>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="py-2 px-4 min-w-[300px]">
                    <div className="flex items-center gap-4">
                      <div className="text-sm">
                        <span className="text-gray-500">Skids:</span> <span className="font-medium text-gray-900">{order.skids}</span>
                      </div>
                      <div className="text-sm">
                        <span className="text-gray-500">Vinyl:</span> <span className="font-medium text-gray-900">{order.vinyl}</span>
                      </div>
                      <div className="text-sm">
                        <span className="text-gray-500">Footage:</span> <span className="font-medium text-gray-900">{order.footage} ft²</span>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="py-2 px-4 min-w-[250px]">
                    <div className="flex items-center gap-4">
                      {order.pickupDate && (
                        <div className="text-sm">
                          <span className="text-gray-500">Pickup:</span> <span className="font-medium text-gray-900">{formatDate(order.pickupDate)}</span>
                        </div>
                      )}
                      <div className="text-sm">
                        <span className="text-gray-500">Created:</span> <span className="font-medium text-gray-900">{formatDate(order.created_at)}</span>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="py-2 px-4 w-[150px] text-right">
                    <div className="flex items-center justify-end gap-1 transition-opacity">
                      <Button 
                        variant="ghost" 
                        size="sm"
                        className="h-6 px-2 text-xs font-medium text-gray-600 hover:bg-gray-100 hover:text-gray-900"
                        onClick={() => {
                          setSelectedOrder(order);
                          setIsAssignDialogOpen(true);
                        }}
                      >
                        Assign
                      </Button>
                      <BillOfLadingDialog 
                        order={{
                          id: order.id.toString(),
                          shipper: {
                            name: order.pickupCustomer.name,
                            address: order.pickupCustomer.address,
                            phone: order.pickupCustomer.phone || "",
                            phone2: order.pickupCustomer.phone2 || ""
                          },
                          consignee: {
                            name: order.deliveryCustomer.name,
                            address: order.deliveryCustomer.address,
                            phone: order.deliveryCustomer.phone || "",
                            phone2: order.deliveryCustomer.phone2 || ""
                          },
                          items: [
                            ...(order.skidsData?.map(skid => ({
                              packages: skid.quantity,
                              description: `Skid ${skid.width}x${skid.length}`,
                              weight: 0, // Add weight if available
                              charges: 0 // Add charges if available
                            })) || []),
                            ...(order.vinylData?.map(vinyl => ({
                              packages: vinyl.quantity,
                              description: `Vinyl ${vinyl.width}x${vinyl.length}`,
                              weight: 0, // Add weight if available
                              charges: 0 // Add charges if available
                            })) || [])
                          ]
                        }} 
                      />
                      <Button 
                        variant="ghost" 
                        size="sm"
                        className="h-6 px-2 text-xs font-medium text-gray-600 hover:bg-gray-100 hover:text-gray-900"
                        onClick={() => {
                          setSelectedOrder(order);
                          setIsInfoDialogOpen(true);
                        }}
                      >
                        Info
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </ScrollArea>
      </Card>

      {/* Assign Dialog */}
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
          onAssignmentChange={fetchOrders}
        />
      )}

      {/* Info Dialog */}
      {selectedOrder && (
        <OrderInfoDialog
          isOpen={isInfoDialogOpen}
          onClose={() => {
            setIsInfoDialogOpen(false);
            setSelectedOrder(null);
          }}
          orderId={selectedOrder.id}
          onOrderUpdate={fetchOrders}
        />
      )}
    </div>
  );
} 