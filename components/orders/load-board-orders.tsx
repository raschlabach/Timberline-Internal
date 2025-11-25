'use client';

import { useEffect, useState, useCallback } from 'react';
import { format, parseISO } from 'date-fns';
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { AlertCircle, MessageSquare, Zap, Search, ChevronDown, ChevronUp, ChevronsUpDown, Truck, MapPin, ToggleLeft, ToggleRight, Paperclip } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
import { AssignmentTypeDialog } from "@/components/orders/assignment-type-dialog";
import { SelectionPoolSummary } from "@/components/orders/selection-pool-summary";
import { BulkAssignmentDialog } from "@/components/orders/bulk-assignment-dialog";
import { DocumentAttachmentDialog } from "@/components/orders/document-attachment-dialog";
import { formatPhoneNumber } from "@/lib/utils";

interface Order {
  id: number;
  pickupCustomer: {
    id: number;
    name: string;
    address: string;
    phone?: string;
    phone2?: string;
    notes?: string;
  };
  deliveryCustomer: {
    id: number;
    name: string;
    address: string;
    phone?: string;
    phone2?: string;
    notes?: string;
  };
  payingCustomer?: {
    id: number;
    name: string;
  };
  skids: number;
  vinyl: number;
  footage: number;
  handBundles: number;
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
  status: string;
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
  creator?: string;
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
  hasDocuments?: boolean;
}

// Add new types for sorting
type SortField = 'pickupDate' | 'createdAt' | 'pickupCustomer' | 'deliveryCustomer';

// Function to generate consistent colors for users
function getUserColor(username: string): string {
  // Special color for System
  if (username === 'System') {
    return '#6B7280'; // Gray-500
  }
  
  // Predefined nice colors for better visual distinction
  const colors = [
    '#3B82F6', // Blue
    '#EF4444', // Red
    '#10B981', // Green
    '#F59E0B', // Yellow
    '#8B5CF6', // Purple
    '#EC4899', // Pink
    '#06B6D4', // Cyan
    '#84CC16', // Lime
    '#F97316', // Orange
    '#6366F1', // Indigo
    '#14B8A6', // Teal
    '#DC2626', // Red-600
    '#059669', // Green-600
    '#D97706', // Yellow-600
    '#7C3AED', // Purple-600
    '#DB2777', // Pink-600
    '#0891B2', // Cyan-600
    '#65A30D', // Lime-600
    '#EA580C', // Orange-600
    '#4F46E5', // Indigo-600
  ];
  
  // Generate a consistent index based on the username
  let hash = 0;
  for (let i = 0; i < username.length; i++) {
    hash = username.charCodeAt(i) + ((hash << 5) - hash);
  }
  
  // Use absolute value and modulo to get a valid index
  const index = Math.abs(hash) % colors.length;
  return colors[index];
}

interface SortConfig {
  field: SortField;
  direction: 'asc' | 'desc';
}

// Add this CSS animation at the top of the file after the imports
const flashAnimation = `
@keyframes flash {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.4; }
}
.flash-icon {
  animation: flash 1.5s infinite;
  color: #ef4444;
}
`;

interface LoadBoardOrdersProps {
  initialFilters?: {
    ohioToIndiana: boolean;
    backhaul: boolean;
    localFlatbed: boolean;
    rrOrder: boolean;
    localSemi: boolean;
    middlefield: boolean;
    paNy: boolean;
  };
  showFilters?: boolean;
  showSortDropdown?: boolean;
  prioritizeRushOrders?: boolean;
  hideOnAnyAssignment?: boolean;
}

type ViewMode = 'unassigned' | 'all';

interface PoolItem {
  orderId: number
  assignmentTypes: ('pickup' | 'delivery')[]
  pickupCustomer: {
    id: number
    name: string
  }
  deliveryCustomer: {
    id: number
    name: string
  }
  footage: number
  skidsData?: Array<{
    id: number
    type: 'skid'
    width: number
    length: number
    footage: number
    quantity: number
  }>
  vinylData?: Array<{
    id: number
    type: 'vinyl'
    width: number
    length: number
    footage: number
    quantity: number
  }>
}

function useLoadBoardOrders(
  initialFilters?: LoadBoardOrdersProps['initialFilters'],
  prioritizeRushOrders: boolean = true,
  hideOnAnyAssignment: boolean = false
) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortConfig, setSortConfig] = useState<SortConfig>({ field: 'pickupDate', direction: 'asc' });
  const [viewMode, setViewMode] = useState<ViewMode>('unassigned');
  const [activeFilters, setActiveFilters] = useState<{[key: string]: boolean}>({
    ohioToIndiana: false,
    backhaul: false,
    localFlatbed: false,
    rrOrder: false,
    localSemi: false,
    middlefield: false,
    paNy: false,
    ...initialFilters
  });

  useEffect(() => {
    try {
      const savedFilters = localStorage.getItem(LOCAL_STORAGE_KEYS.filters);
      if (savedFilters) {
        const parsedFilters = JSON.parse(savedFilters);
        if (parsedFilters && typeof parsedFilters === 'object') {
          setActiveFilters(prev => ({ ...prev, ...parsedFilters }));
        }
      }

      const savedSort = localStorage.getItem(LOCAL_STORAGE_KEYS.sort);
      if (savedSort) {
        const parsedSort = JSON.parse(savedSort) as SortConfig;
        if (parsedSort?.field && parsedSort?.direction) {
          setSortConfig(parsedSort);
        }
      }

      const savedView = localStorage.getItem(LOCAL_STORAGE_KEYS.view);
      if (savedView === 'unassigned' || savedView === 'all') {
        setViewMode(savedView);
      }
    } catch (storageError) {
      console.error('Error loading load board preferences:', storageError);
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(LOCAL_STORAGE_KEYS.filters, JSON.stringify(activeFilters));
    } catch (storageError) {
      console.error('Error saving load board filters:', storageError);
    }
  }, [activeFilters]);

  useEffect(() => {
    try {
      localStorage.setItem(LOCAL_STORAGE_KEYS.sort, JSON.stringify(sortConfig));
    } catch (storageError) {
      console.error('Error saving load board sort config:', storageError);
    }
  }, [sortConfig]);

  useEffect(() => {
    try {
      localStorage.setItem(LOCAL_STORAGE_KEYS.view, viewMode);
    } catch (storageError) {
      console.error('Error saving load board view mode:', storageError);
    }
  }, [viewMode]);

  const fetchOrders = useCallback(async () => {
    try {
      // Add cache-busting timestamp to prevent 304 responses
      const timestamp = new Date().getTime();
      const response = await fetch(`/api/orders/recent?t=${timestamp}`, {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache',
        }
      });
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

  // Check for new orders using localStorage (works across page navigations)
  useEffect(() => {
    const checkForNewOrders = () => {
      const lastOrderTimestamp = localStorage.getItem('lastOrderCreated');
      const lastCheckTimestamp = localStorage.getItem('lastOrdersCheck');
      
      if (lastOrderTimestamp && lastCheckTimestamp) {
        const orderTime = parseInt(lastOrderTimestamp, 10);
        const checkTime = parseInt(lastCheckTimestamp, 10);
        
        // If a new order was created after our last check, refresh
        if (orderTime > checkTime) {
          console.log('New order detected via localStorage, refreshing...');
          fetchOrders();
          localStorage.setItem('lastOrdersCheck', Date.now().toString());
        }
      } else if (lastOrderTimestamp) {
        // First time checking, just update the check timestamp
        localStorage.setItem('lastOrdersCheck', Date.now().toString());
      }
    };

    // Check immediately on mount
    checkForNewOrders();
    
    // Check every 2 seconds for new orders
    const checkInterval = setInterval(checkForNewOrders, 2000);
    
    return () => clearInterval(checkInterval);
  }, [fetchOrders]);

  // Set up polling interval
  useEffect(() => {
    fetchOrders(); // Initial fetch
    
    const intervalId = setInterval(() => {
      fetchOrders();
    }, 30000); // Poll every 30 seconds instead of 3 seconds

    return () => clearInterval(intervalId);
  }, [fetchOrders]);

  // Listen for orderCreated event to refresh immediately (works if on same page)
  useEffect(() => {
    const handleOrderCreated = (event: Event) => {
      const customEvent = event as CustomEvent;
      console.log('Order created event received, refreshing load board...', customEvent.detail);
      // Force refresh by calling fetchOrders
      fetchOrders();
      // Update localStorage timestamp
      localStorage.setItem('lastOrderCreated', Date.now().toString());
    };

    window.addEventListener('orderCreated', handleOrderCreated);
    console.log('Order created event listener registered');
    return () => {
      window.removeEventListener('orderCreated', handleOrderCreated);
    };
  }, [fetchOrders]);

  const sortOrders = (ordersToSort: Order[]): Order[] => {
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

    // If rush orders should be prioritized, separate them first
    if (prioritizeRushOrders) {
      const rushOrders = ordersToSort.filter(order => order.isRushOrder);
      const nonRushOrders = ordersToSort.filter(order => !order.isRushOrder);

    // Sort both groups separately using the selected sort function
    const sortedRushOrders = [...rushOrders].sort(sortFunctions[sortConfig.field]);
    const sortedNonRushOrders = [...nonRushOrders].sort(sortFunctions[sortConfig.field]);

    // Combine the sorted groups with rush orders always on top
    return [...sortedRushOrders, ...sortedNonRushOrders];
    } else {
      // Just sort all orders together without separating rush orders
      return [...ordersToSort].sort(sortFunctions[sortConfig.field]);
    }
  };

  // Function to get orders that match current view mode and search (before load type filtering)
  const getBaseOrders = () => {
    return orders.filter(order => {
      // Always exclude completed orders
      if (order.status === 'completed') return false;

      // View mode filter
      if (viewMode === 'unassigned') {
        if (hideOnAnyAssignment) {
          // Hide orders with ANY assignment (pickup or delivery)
          const hasPickupAssignment = order.pickupAssignment !== null;
          const hasDeliveryAssignment = order.deliveryAssignment !== null;
          if (hasPickupAssignment || hasDeliveryAssignment) return false;
        } else {
          // Only hide orders with delivery assigned (default load board behavior)
        const hasDeliveryAssignment = order.deliveryAssignment !== null;
        if (hasDeliveryAssignment) return false;
        }
      }
      // For 'all' mode, we show all non-completed orders (no additional filtering needed)

      // Search term filter
      const searchLower = searchTerm.toLowerCase();
      const matchesSearch = searchTerm === '' || 
        order.pickupCustomer.name.toLowerCase().includes(searchLower) ||
        order.deliveryCustomer.name.toLowerCase().includes(searchLower);

      return matchesSearch;
    });
  };

  // Calculate counts for each filter type
  const getFilterCounts = () => {
    const baseOrders = getBaseOrders();
    const counts: Record<string, number> = {};
    
    FILTER_OPTIONS.forEach(option => {
      counts[option.id] = baseOrders.filter(order => 
        order.filters[option.id as keyof typeof order.filters]
      ).length;
    });
    
    return counts;
  };

  const filterCounts = getFilterCounts();

  const filteredOrders = sortOrders(orders.filter(order => {
    // Always exclude completed orders
    if (order.status === 'completed') return false;

    // View mode filter
    if (viewMode === 'unassigned') {
      if (hideOnAnyAssignment) {
        // Hide orders with ANY assignment (pickup or delivery)
        const hasPickupAssignment = order.pickupAssignment !== null;
        const hasDeliveryAssignment = order.deliveryAssignment !== null;
        if (hasPickupAssignment || hasDeliveryAssignment) return false;
      } else {
        // Only hide orders with delivery assigned (default load board behavior)
      const hasDeliveryAssignment = order.deliveryAssignment !== null;
      if (hasDeliveryAssignment) return false;
      }
    }
    // For 'all' mode, we show all non-completed orders (no additional filtering needed)

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
    setSortConfig,
    viewMode,
    setViewMode,
    filterCounts
  };
}

function formatDate(dateString: string): string {
  try {
    return format(parseISO(dateString), 'MM/dd');
  } catch (error) {
    console.error('Error formatting date:', error);
    return 'Invalid date';
  }
}

const LOCAL_STORAGE_KEYS = {
  filters: 'load-board-active-filters',
  sort: 'load-board-sort-config',
  view: 'load-board-view-mode'
} as const;

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

export function LoadBoardOrders({ initialFilters, showFilters = true, showSortDropdown = false, prioritizeRushOrders = true, hideOnAnyAssignment = false }: LoadBoardOrdersProps) {
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
    viewMode,
    setViewMode,
    filterCounts,
    refresh: fetchOrders
  } = useLoadBoardOrders(initialFilters, prioritizeRushOrders, hideOnAnyAssignment);

  // Add truckload data for stage determination
  const [truckloads, setTruckloads] = useState<any[]>([]);
  const [isLoadingTruckloads, setIsLoadingTruckloads] = useState(false);
  
  // Track orders with documents
  const [ordersWithDocuments, setOrdersWithDocuments] = useState<Set<number>>(new Set());

  // Fetch truckloads data
  const fetchTruckloads = async () => {
    setIsLoadingTruckloads(true);
    try {
      const response = await fetch('/api/truckloads');
      if (response.ok) {
        const data = await response.json();
        setTruckloads(data.truckloads || []);
      }
    } catch (error) {
      console.error('Error fetching truckloads:', error);
    } finally {
      setIsLoadingTruckloads(false);
    }
  };

  // Fetch truckloads on component mount
  useEffect(() => {
    fetchTruckloads();
  }, []);

  // Check for documents on orders
  const checkOrdersForDocuments = async () => {
    try {
      const orderIds = orders.map(order => order.id);
      
      // Only check if we have orders and they're different from what we last checked
      if (orderIds.length === 0) {
        setOrdersWithDocuments(new Set());
        return;
      }
      
      const documentChecks = await Promise.all(
        orderIds.map(async (orderId) => {
          try {
            const response = await fetch(`/api/orders/${orderId}/documents`);
            if (response.ok) {
              const data = await response.json();
              return { orderId, hasDocuments: data.documents && data.documents.length > 0 };
            }
          } catch (error) {
            console.error(`Error checking documents for order ${orderId}:`, error);
          }
          return { orderId, hasDocuments: false };
        })
      );
      
      const ordersWithDocs = new Set(
        documentChecks
          .filter(check => check.hasDocuments)
          .map(check => check.orderId)
      );
      setOrdersWithDocuments(ordersWithDocs);
    } catch (error) {
      console.error('Error checking orders for documents:', error);
    }
  };

  // Check for documents when orders change (but only if order IDs have changed)
  const [lastOrderIds, setLastOrderIds] = useState<string>('');
  
  useEffect(() => {
    if (orders.length > 0) {
      const currentOrderIds = orders.map(order => order.id).sort().join(',');
      if (currentOrderIds !== lastOrderIds) {
        setLastOrderIds(currentOrderIds);
        checkOrdersForDocuments();
      }
    }
  }, [orders, lastOrderIds]);

  // Function to determine order stage
  const getOrderStage = (order: Order) => {
    const pickupAssignment = order.pickupAssignment;
    const deliveryAssignment = order.deliveryAssignment;
    
    // Check if pickup truckload is completed
    const pickupTruckload = pickupAssignment ? truckloads.find(t => t.id === pickupAssignment.truckloadId) : null;
    const isPickupCompleted = pickupTruckload?.isCompleted || false;
    
    // Check if delivery truckload is completed
    const deliveryTruckload = deliveryAssignment ? truckloads.find(t => t.id === deliveryAssignment.truckloadId) : null;
    const isDeliveryCompleted = deliveryTruckload?.isCompleted || false;
    
    // Determine stage - delivery overrides pickup
    if (deliveryAssignment && !isDeliveryCompleted) {
      // Delivery assigned but not completed (takes priority)
      return {
        text: 'Awaiting Delivery',
        color: deliveryAssignment.driverColor || '#374151'
      };
    } else if (!pickupAssignment) {
      // No pickup assigned - show pickup date
      return {
        text: `Pickup ${formatDate(order.pickupDate)}`,
        color: '#374151' // gray-700
      };
    } else if (pickupAssignment && !isPickupCompleted) {
      // Pickup assigned but not completed
      return {
        text: 'Awaiting Pickup',
        color: pickupAssignment.driverColor || '#374151'
      };
    } else if (isPickupCompleted && !deliveryAssignment) {
      // Pickup completed, no delivery assigned
      return {
        text: '📦 In Warehouse',
        color: '#6B7280' // gray-500
      };
    } else {
      // Both completed (should be filtered out by existing logic)
      return {
        text: 'Completed',
        color: '#059669' // green-600
      };
    }
  };

  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [isAssignDialogOpen, setIsAssignDialogOpen] = useState(false);
  const [isInfoDialogOpen, setIsInfoDialogOpen] = useState(false);
  const [isDocumentDialogOpen, setIsDocumentDialogOpen] = useState(false);
  const [checkedOrders, setCheckedOrders] = useState<Set<number>>(new Set());
  
  // Selection pool state
  const [selectionPool, setSelectionPool] = useState<PoolItem[]>([]);
  const [isAssignmentTypeDialogOpen, setIsAssignmentTypeDialogOpen] = useState(false);
  const [isBulkAssignmentDialogOpen, setIsBulkAssignmentDialogOpen] = useState(false);

  // Load selection pool from localStorage on mount
  useEffect(() => {
    const savedPool = localStorage.getItem('assignment-pool');
    if (savedPool) {
      try {
        setSelectionPool(JSON.parse(savedPool));
      } catch (error) {
        console.error('Error loading selection pool from localStorage:', error);
      }
    }
  }, []);

  // Save selection pool to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem('assignment-pool', JSON.stringify(selectionPool));
  }, [selectionPool]);

  const handleCheckboxChange = (orderId: number) => {
    setCheckedOrders(prev => {
      const newSet = new Set(prev);
      if (newSet.has(orderId)) {
        newSet.delete(orderId);
      } else {
        newSet.add(orderId);
      }
      return newSet;
    });
  };

  const handleSort = (field: SortField) => {
    setSortConfig(prev => ({
      field,
      direction: prev.field === field && prev.direction === 'asc' ? 'desc' : 'asc'
    }));
  };

  // Selection pool helper functions
  const addToPool = (orderId: number, assignmentTypes: ('pickup' | 'delivery')[]) => {
    const order = orders.find(o => o.id === orderId);
    if (!order) return;

    setSelectionPool(prev => {
      // Remove any existing entries for this order
      const filtered = prev.filter(item => item.orderId !== orderId);
      
      // Add new entry
      const newItem: PoolItem = {
        orderId,
        assignmentTypes,
        pickupCustomer: order.pickupCustomer,
        deliveryCustomer: order.deliveryCustomer,
        footage: order.footage,
        skidsData: order.skidsData,
        vinylData: order.vinylData
      };
      
      return [...filtered, newItem];
    });
  };

  const removeFromPool = (orderId: number, assignmentType: 'pickup' | 'delivery') => {
    setSelectionPool(prev => {
      return prev.map(item => {
        if (item.orderId === orderId) {
          const newTypes = item.assignmentTypes.filter(type => type !== assignmentType);
          if (newTypes.length === 0) {
            return null; // Remove entire item if no types left
          }
          return { ...item, assignmentTypes: newTypes };
        }
        return item;
      }).filter(Boolean) as PoolItem[];
    });
  };

  const clearPool = () => {
    setSelectionPool([]);
  };

  const isInPool = (orderId: number, assignmentType?: 'pickup' | 'delivery') => {
    const item = selectionPool.find(item => item.orderId === orderId);
    if (!item) return false;
    if (assignmentType) {
      return item.assignmentTypes.includes(assignmentType);
    }
    return true;
  };

  const getPoolStatus = (orderId: number) => {
    const item = selectionPool.find(item => item.orderId === orderId);
    if (!item) return null;
    
    const hasPickup = item.assignmentTypes.includes('pickup');
    const hasDelivery = item.assignmentTypes.includes('delivery');
    
    if (hasPickup && hasDelivery) return 'both';
    if (hasPickup) return 'pickup';
    if (hasDelivery) return 'delivery';
    return null;
  };

  const handleBulkAssignmentComplete = () => {
    clearPool();
    fetchOrders();
  };

  if (isLoading) {
    return (
      <div className="space-y-2">
        <div className="mb-1">
          <h1 className="text-2xl font-bold">Load Board</h1>
        </div>
        <Card className="p-4">
          <div className="flex items-center justify-center h-32">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
          </div>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-2">
        <div className="mb-1">
          <h1 className="text-2xl font-bold">Load Board</h1>
        </div>
        <Card className="p-4">
          <div className="text-sm text-red-500">{error}</div>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {/* Header Section */}
      <div className="mb-1">
        <h1 className="text-2xl font-bold">Load Board</h1>
      </div>
      
      <div className="flex-1">
        <style>{flashAnimation}</style>
        {/* Selection Pool Summary */}
        <SelectionPoolSummary
          poolItems={selectionPool}
          onRemoveFromPool={removeFromPool}
          onClearAll={clearPool}
          onBulkAssign={() => setIsBulkAssignmentDialogOpen(true)}
        />
        
        {/* View Toggle and Filters */}
        <Card className="mb-2 p-4 bg-gradient-to-r from-gray-50 to-white border border-gray-200 shadow-sm">
          <div className="flex items-center gap-6">
            {showFilters && (
              <>
                {/* Search Section */}
                <div className="flex items-center space-x-3 bg-white rounded-lg px-3 py-2 border border-gray-200 shadow-sm">
                  <Search className="h-4 w-4 text-gray-500" />
                  <Input
                    type="text"
                    placeholder="Search orders..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="border-0 bg-transparent text-sm w-48 focus:ring-0 focus:outline-none"
                  />
                </div>
              </>
            )}
            
            {/* View Toggle Section */}
            <div className="flex items-center space-x-3 bg-white rounded-lg px-3 py-2 border border-gray-200 shadow-sm">
              <span className="text-sm font-semibold text-gray-700">View</span>
              <div className="flex items-center space-x-1">
                <Button
                  variant={viewMode === 'unassigned' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setViewMode('unassigned')}
                  className={`text-xs h-7 px-3 transition-all duration-200 ${
                    viewMode === 'unassigned' 
                      ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-sm' 
                      : 'bg-white hover:bg-gray-50 text-gray-700 border-gray-300'
                  }`}
                >
                  Unassigned
                </Button>
                <Button
                  variant={viewMode === 'all' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setViewMode('all')}
                  className={`text-xs h-7 px-3 transition-all duration-200 ${
                    viewMode === 'all' 
                      ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-sm' 
                      : 'bg-white hover:bg-gray-50 text-gray-700 border-gray-300'
                  }`}
                >
                  All Orders
                </Button>
              </div>
            </div>

            {/* Sort Dropdown Section */}
            {showSortDropdown && (
              <div className="flex items-center space-x-3 bg-white rounded-lg px-3 py-2 border border-gray-200 shadow-sm">
                <span className="text-sm font-semibold text-gray-700">Sort By</span>
                <Select
                  value={sortConfig.field}
                  onValueChange={(value) => {
                    setSortConfig({
                      field: value as SortField,
                      direction: 'asc'
                    });
                  }}
                >
                  <SelectTrigger className="h-7 text-xs w-[160px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pickupDate" className="text-xs">Pickup Date</SelectItem>
                    <SelectItem value="createdAt" className="text-xs">Created Date</SelectItem>
                    <SelectItem value="pickupCustomer" className="text-xs">Pickup Customer</SelectItem>
                    <SelectItem value="deliveryCustomer" className="text-xs">Delivery Customer</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            {showFilters && (
              <>
                {/* Load Type Filters Section */}
                <div className="flex items-center space-x-3 bg-white rounded-lg px-3 py-2 border border-gray-200 shadow-sm">
                  <span className="text-sm font-semibold text-gray-700">Load Type</span>
                  <div className="flex items-center space-x-2">
                    {FILTER_OPTIONS.map((option) => {
                      const count = filterCounts[option.id] || 0;
                      return (
                        <Button
                          key={option.id}
                          variant={activeFilters[option.id] ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => 
                            setActiveFilters(prev => ({ ...prev, [option.id]: !prev[option.id] }))
                          }
                          className={`text-xs h-7 px-3 transition-all duration-200 relative ${
                            activeFilters[option.id] 
                              ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-sm' 
                              : 'bg-white hover:bg-gray-50 text-gray-700 border-gray-300'
                          }`}
                        >
                          <span className="flex items-center space-x-1">
                            <span>{option.label}</span>
                            {count > 0 && (
                              <span className={`inline-flex items-center justify-center w-4 h-4 text-xs rounded-full ${
                                activeFilters[option.id]
                                  ? 'bg-white text-blue-600'
                                  : 'bg-blue-600 text-white'
                              }`}>
                                {count}
                              </span>
                            )}
                          </span>
                        </Button>
                      );
                    })}
                  </div>
                </div>
              </>
            )}
            
            {/* Order Count */}
            <div className="ml-auto bg-blue-50 rounded-lg px-3 py-2 border border-blue-200">
              <span className="text-sm font-semibold text-blue-700">
                {orders.length} order{orders.length !== 1 ? 's' : ''} shown
              </span>
            </div>
          </div>
        </Card>
        
        <Card className="bg-gray-50/50 border-none shadow-none max-w-[1400px]">
          <ScrollArea>
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent border-b border-gray-300">
                  <TableHead className="h-6 text-xs font-medium text-gray-600 tracking-wide bg-transparent w-[50px] p-0">
                    <div className="flex items-center justify-center h-full">
                      <Checkbox 
                        className="h-5 w-5" 
                        checked={checkedOrders.size === orders.length}
                        onCheckedChange={() => {
                          if (checkedOrders.size === orders.length) {
                            setCheckedOrders(new Set());
                          } else {
                            setCheckedOrders(new Set(orders.map(order => order.id)));
                          }
                        }}
                      />
                    </div>
                  </TableHead>
                  <TableHead className="h-6 text-xs font-medium text-gray-600 tracking-wide bg-transparent w-[120px]">
                    <div className="flex items-center justify-between">
                      <span>Order # / Created By</span>
                    </div>
                  </TableHead>
                  <TableHead className="h-6 text-xs font-medium text-gray-600 tracking-wide bg-transparent w-[200px]">
                    <div className="flex items-center justify-between">
                      <span>Stage</span>
                    </div>
                  </TableHead>
                  <TableHead className="h-6 text-xs font-medium text-gray-600 tracking-wide bg-transparent w-[120px]">Status</TableHead>
                  <TableHead className="h-6 text-xs font-medium text-gray-600 tracking-wide bg-transparent min-w-[300px]">
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
                  <TableHead className="h-6 text-xs font-medium text-gray-600 tracking-wide bg-transparent">Freight</TableHead>
                  <TableHead className="h-6 text-xs font-medium text-gray-600 tracking-wide bg-transparent w-[150px] text-right pr-4">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(() => {
                  const rushIndices = orders
                    .map((o, i) => (o.isRushOrder ? i : -1))
                    .filter(i => i !== -1);
                  const firstRushIndex = rushIndices.length > 0 ? rushIndices[0] : -1;
                  const lastRushIndex = rushIndices.length > 0 ? rushIndices[rushIndices.length - 1] : -1;

                  return orders.map((order, index) => (
                  <TableRow 
                    key={order.id}
                    className={`
                      group transition-colors duration-100 border-b border-gray-200
                      ${(() => {
                        const poolStatus = getPoolStatus(order.id);
                        if (checkedOrders.has(order.id)) {
                          return index % 2 === 0 
                            ? 'bg-blue-100 hover:bg-blue-200' 
                            : 'bg-blue-200 hover:bg-blue-300';
                        }
                        if (poolStatus === 'pickup') {
                          return 'bg-red-100 hover:bg-red-200';
                        }
                        if (poolStatus === 'delivery') {
                          return 'bg-gray-200 hover:bg-gray-300';
                        }
                        if (poolStatus === 'both') {
                          return 'bg-red-800/30 hover:bg-red-800/40';
                        }
                        return index % 2 === 0 
                          ? 'bg-white' 
                          : 'bg-gray-50';
                      })()}
                      ${!checkedOrders.has(order.id) && !getPoolStatus(order.id) && 'hover:bg-gray-100/80'}
                      ${(() => {
                        const isWithin = order.isRushOrder && firstRushIndex !== -1 && index >= firstRushIndex && index <= lastRushIndex;
                        const isFirst = isWithin && index === firstRushIndex;
                        const isLast = isWithin && index === lastRushIndex;
                        return isWithin 
                          ? `border-red-300 ${isFirst ? 'border-t-2' : ''} ${isLast ? 'border-b-2' : ''} border-l-2 border-r-2`
                          : '';
                      })()}
                    `}
                  >
                    <TableCell className="p-0 w-[50px]">
                      <div className="flex items-center justify-center h-full min-h-[36px]">
                        <Checkbox 
                          className="h-5 w-5" 
                          checked={checkedOrders.has(order.id)}
                          onCheckedChange={() => handleCheckboxChange(order.id)}
                        />
                      </div>
                    </TableCell>
                    <TableCell className="py-1 px-2 w-[120px]">
                      <div className="flex items-center justify-center gap-2">
                        <span className="text-[11px] font-bold text-gray-900">#{order.id}</span>
                        <TooltipProvider>
                          <Tooltip delayDuration={100}>
                            <TooltipTrigger>
                              <div 
                                className="px-2 py-1 rounded-md text-[11px] font-medium text-gray-700 border"
                                style={{ 
                                  backgroundColor: `${getUserColor(order.creator || 'System')}20`,
                                  borderColor: `${getUserColor(order.creator || 'System')}40`
                                }}
                              >
                                {order.creator || 'System'}
                              </div>
                            </TooltipTrigger>
                            <TooltipContent side="top" className="text-[11px] bg-gray-900 text-white px-2 py-1">
                              Created by {order.creator || 'System'} on {formatDate(order.created_at)}
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </div>
                    </TableCell>
                    <TableCell className="py-1 px-2 w-[200px]">
                      <div className="flex items-center">
                        {(() => {
                          const stage = getOrderStage(order);
                          return (
                            <div className="text-[11px] font-medium" style={{ color: stage.color }}>
                              {stage.text}
                            </div>
                          );
                        })()}
                      </div>
                    </TableCell>
                    <TableCell className="py-1 px-2 w-[120px]">
                      <div className="flex items-center gap-1.5">
                        <div className="w-2 h-2 rounded-full bg-gray-300"></div>
                        <TooltipProvider>
                          <div className="flex items-center gap-1.5">
                            {order.isRushOrder && (
                              <Tooltip delayDuration={100}>
                                <TooltipTrigger>
                                  <Zap className="w-[10px] h-[10px] text-red-500" />
                                </TooltipTrigger>
                                <TooltipContent side="top" className="text-[11px] bg-gray-900 text-white px-2 py-1">
                                  Rush Order
                                </TooltipContent>
                              </Tooltip>
                            )}
                            {order.needsAttention && (
                              <Tooltip delayDuration={100}>
                                <TooltipTrigger>
                                  <AlertCircle className="w-[10px] h-[10px] text-amber-500" />
                                </TooltipTrigger>
                                <TooltipContent side="top" className="text-[11px] bg-gray-900 text-white px-2 py-1">
                                  Needs Attention
                                </TooltipContent>
                              </Tooltip>
                            )}
                            {order.comments && (
                              <Tooltip delayDuration={100}>
                                <TooltipTrigger>
                                  <MessageSquare className="w-[10px] h-[10px] text-blue-500" />
                                </TooltipTrigger>
                                <TooltipContent side="top" className="text-[11px] bg-gray-900 text-white px-2 py-1">
                                  Has Comments
                                </TooltipContent>
                              </Tooltip>
                            )}
                            {ordersWithDocuments.has(order.id) && (
                              <Tooltip delayDuration={100}>
                                <TooltipTrigger>
                                  <Paperclip className="w-[10px] h-[10px] text-red-500" />
                                </TooltipTrigger>
                                <TooltipContent side="top" className="text-[11px] bg-gray-900 text-white px-2 py-1">
                                  Has Paperwork
                                </TooltipContent>
                              </Tooltip>
                            )}
                          </div>
                        </TooltipProvider>
                      </div>
                    </TableCell>
                    <TableCell className="py-1 px-2 min-w-[300px]">
                      <div className="flex items-center gap-2">
                        <div className="flex items-center gap-2">
                          {order.pickupAssignment && (
                            <TooltipProvider>
                              <Tooltip delayDuration={100}>
                                <TooltipTrigger>
                                  <Truck 
                                    className="w-[14px] h-[14px]" 
                                    strokeWidth={2.5}
                                    style={{ color: order.pickupAssignment.driverColor }}
                                  />
                                </TooltipTrigger>
                                <TooltipContent 
                                  side="top" 
                                  className="text-[11px] bg-gray-900 text-white px-2.5 py-1.5 space-y-1"
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
                          <div className="flex items-center gap-2">
                            <TooltipProvider>
                              <Tooltip delayDuration={200}>
                                <TooltipTrigger asChild>
                                  <span className="text-red-600 font-extrabold text-[11px] cursor-help hover:underline">
                                    {order.pickupCustomer.name}
                                  </span>
                                </TooltipTrigger>
                                <TooltipContent 
                                  className="bg-gray-900 text-white text-xs p-3 max-w-xs"
                                  side="top"
                                >
                                  <div className="space-y-2">
                                    <div className="font-semibold text-sm">{order.pickupCustomer.name}</div>
                                    {order.pickupCustomer.address && (
                                      <div>
                                        <div className="text-gray-300 text-[10px] uppercase mb-0.5">Address</div>
                                        <div className="text-white">{order.pickupCustomer.address}</div>
                                      </div>
                                    )}
                                    {(order.pickupCustomer.phone || order.pickupCustomer.phone2) && (
                                      <div>
                                        <div className="text-gray-300 text-[10px] uppercase mb-0.5">Phone</div>
                                        <div className="space-y-0.5">
                                          {order.pickupCustomer.phone && (
                                            <div className="text-white">{formatPhoneNumber(order.pickupCustomer.phone)}</div>
                                          )}
                                          {order.pickupCustomer.phone2 && (
                                            <div className="text-white">{formatPhoneNumber(order.pickupCustomer.phone2)}</div>
                                          )}
                                        </div>
                                      </div>
                                    )}
                                    {order.pickupCustomer.notes && (
                                      <div>
                                        <div className="text-gray-300 text-[10px] uppercase mb-0.5">Notes</div>
                                        <div className="text-white whitespace-pre-wrap">{order.pickupCustomer.notes}</div>
                                      </div>
                                    )}
                                  </div>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                            <span className="text-gray-400 text-[11px]">→</span>
                            <div className="flex items-center">
                              {order.deliveryAssignment && (
                                <TooltipProvider>
                                  <Tooltip delayDuration={100}>
                                    <TooltipTrigger>
                                      <Truck 
                                        className="w-[14px] h-[14px] mr-1" 
                                        strokeWidth={2.5}
                                        style={{ color: order.deliveryAssignment.driverColor }}
                                      />
                                    </TooltipTrigger>
                                    <TooltipContent 
                                      className="bg-gray-900 text-white text-[11px] p-1.5 max-w-xs"
                                      side="top"
                                    >
                                      <div className="space-y-1">
                                        <div className="font-semibold">Delivery Assignment</div>
                                        <div>Driver: {order.deliveryAssignment.driverName}</div>
                                        <div>Start: {formatDate(order.deliveryAssignment.startDate)}</div>
                                        <div>End: {formatDate(order.deliveryAssignment.endDate)}</div>
                                      </div>
                                    </TooltipContent>
                                  </Tooltip>
                                </TooltipProvider>
                              )}
                              <TooltipProvider>
                                <Tooltip delayDuration={200}>
                                  <TooltipTrigger asChild>
                                    <span className="text-gray-900 font-medium text-[11px] cursor-help hover:underline">
                                      {order.deliveryCustomer.name}
                                    </span>
                                  </TooltipTrigger>
                                  <TooltipContent 
                                    className="bg-gray-900 text-white text-xs p-3 max-w-xs"
                                    side="top"
                                  >
                                    <div className="space-y-2">
                                      <div className="font-semibold text-sm">{order.deliveryCustomer.name}</div>
                                      {order.deliveryCustomer.address && (
                                        <div>
                                          <div className="text-gray-300 text-[10px] uppercase mb-0.5">Address</div>
                                          <div className="text-white">{order.deliveryCustomer.address}</div>
                                        </div>
                                      )}
                                      {(order.deliveryCustomer.phone || order.deliveryCustomer.phone2) && (
                                        <div>
                                          <div className="text-gray-300 text-[10px] uppercase mb-0.5">Phone</div>
                                          <div className="space-y-0.5">
                                            {order.deliveryCustomer.phone && (
                                              <div className="text-white">{formatPhoneNumber(order.deliveryCustomer.phone)}</div>
                                            )}
                                            {order.deliveryCustomer.phone2 && (
                                              <div className="text-white">{formatPhoneNumber(order.deliveryCustomer.phone2)}</div>
                                            )}
                                          </div>
                                        </div>
                                      )}
                                      {order.deliveryCustomer.notes && (
                                        <div>
                                          <div className="text-gray-300 text-[10px] uppercase mb-0.5">Notes</div>
                                          <div className="text-white whitespace-pre-wrap">{order.deliveryCustomer.notes}</div>
                                        </div>
                                      )}
                                    </div>
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            </div>
                          </div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="py-1 px-2">
                      <div className="flex items-center gap-3 flex-wrap">
                        {order.skids > 0 && (
                          <div className="text-[11px] whitespace-nowrap">
                            <span className="text-gray-500">Skids:</span> <span className="font-medium text-gray-900">{order.skids}</span>
                          </div>
                        )}
                        {order.vinyl > 0 && (
                          <div className="text-[11px] whitespace-nowrap">
                            <span className="text-gray-500">Vinyl:</span> <span className="font-medium text-gray-900">{order.vinyl}</span>
                          </div>
                        )}
                        {order.footage > 0 && (
                          <div className="text-[11px] whitespace-nowrap">
                            <span className="text-gray-500">Footage:</span> <span className="font-medium text-gray-900">{order.footage} ft²</span>
                          </div>
                        )}
                        {order.handBundles > 0 && (
                          <div className="text-[11px] whitespace-nowrap">
                            <span className="text-gray-500">HB:</span> <span className="font-bold text-blue-600 bg-blue-50 px-1 rounded">{order.handBundles}</span>
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="py-1 px-2 w-[150px] text-right">
                      <div className="flex items-center justify-end gap-1.5 transition-opacity">
                        {(() => {
                          const poolStatus = getPoolStatus(order.id);
                          const isInPool = poolStatus !== null;
                          
                          if (isInPool) {
                            return (
                              <Button 
                                variant="ghost" 
                                size="sm"
                                className="h-5 px-2 text-[11px] font-medium text-red-600 hover:bg-red-100 hover:text-red-700"
                                onClick={() => {
                                  // Remove from pool
                                  if (poolStatus === 'pickup') {
                                    removeFromPool(order.id, 'pickup');
                                  } else if (poolStatus === 'delivery') {
                                    removeFromPool(order.id, 'delivery');
                                  } else if (poolStatus === 'both') {
                                    // Show dialog to choose which to remove
                                    setSelectedOrder(order);
                                    setIsAssignmentTypeDialogOpen(true);
                                  }
                                }}
                              >
                                Remove
                              </Button>
                            );
                          } else {
                            return (
                              <Button 
                                variant="ghost" 
                                size="sm"
                                className="h-5 px-2 text-[11px] font-medium text-gray-600 hover:bg-gray-100 hover:text-gray-900"
                                onClick={() => {
                                  setSelectedOrder(order);
                                  setIsAssignmentTypeDialogOpen(true);
                                }}
                              >
                                Assign
                              </Button>
                            );
                          }
                        })()}
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
                          className={`h-5 px-2 text-[11px] font-medium hover:text-gray-900 ${
                            ordersWithDocuments.has(order.id) 
                              ? 'text-gray-600 hover:bg-red-100 bg-red-50' 
                              : 'text-gray-600 hover:bg-gray-100'
                          }`}
                          onClick={() => {
                            setSelectedOrder(order);
                            setIsDocumentDialogOpen(true);
                          }}
                        >
                          <Paperclip className="w-3 h-3 mr-1" />
                          Docs
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="sm"
                          className="h-5 px-2 text-[11px] font-medium text-gray-600 hover:bg-gray-100 hover:text-gray-900"
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
                  ));
                })()}
              </TableBody>
            </Table>
          </ScrollArea>
        </Card>

        {/* Summary Section */}
        {checkedOrders.size > 0 && (
          <div className="bg-white border-t border-gray-200 p-4 max-w-[1400px]">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-16">
                <div className="flex items-center gap-2 min-w-[300px]">
                  <span className="text-base font-medium text-gray-600">Total Loads:</span>
                  <span className="text-2xl font-bold text-gray-900">{checkedOrders.size}</span>
                </div>
                <div className="flex items-center gap-2 min-w-[200px]">
                  <span className="text-base font-medium text-gray-600">Total Skids:</span>
                  <span className="text-2xl font-bold text-gray-900">
                    {orders
                      .filter(order => checkedOrders.has(order.id))
                      .reduce((total, order) => total + Number(order.skids || 0), 0)}
                  </span>
                </div>
                <div className="flex items-center gap-2 min-w-[200px]">
                  <span className="text-base font-medium text-gray-600">Total Vinyl:</span>
                  <span className="text-2xl font-bold text-gray-900">
                    {orders
                      .filter(order => checkedOrders.has(order.id))
                      .reduce((total, order) => total + Number(order.vinyl || 0), 0)}
                  </span>
                </div>
                <div className="flex items-center gap-2 min-w-[200px]">
                  <span className="text-base font-medium text-gray-600">Total Footage:</span>
                  <span className="text-2xl font-bold text-gray-900">
                    {orders
                      .filter(order => checkedOrders.has(order.id))
                      .reduce((total, order) => total + Number(order.footage || 0), 0)} ft²
                  </span>
                </div>
                <div className="flex items-center gap-2 min-w-[200px]">
                  <span className="text-base font-medium text-gray-600">Total HB:</span>
                  <span className="text-2xl font-bold text-blue-600 bg-blue-50 px-2 py-1 rounded">
                    {orders
                      .filter(order => checkedOrders.has(order.id))
                      .reduce((total, order) => total + Number(order.handBundles || 0), 0)}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

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
          pickupAssignment={selectedOrder.pickupAssignment}
          deliveryAssignment={selectedOrder.deliveryAssignment}
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

      {/* Assignment Type Dialog */}
      {selectedOrder && (
        <AssignmentTypeDialog
          isOpen={isAssignmentTypeDialogOpen}
          onClose={() => {
            setIsAssignmentTypeDialogOpen(false);
            setSelectedOrder(null);
          }}
          orderId={selectedOrder.id}
          pickupCustomer={selectedOrder.pickupCustomer}
          deliveryCustomer={selectedOrder.deliveryCustomer}
          pickupAssignment={selectedOrder.pickupAssignment}
          deliveryAssignment={selectedOrder.deliveryAssignment}
          onAddToPool={addToPool}
        />
      )}

      {/* Bulk Assignment Dialog */}
      <BulkAssignmentDialog
        isOpen={isBulkAssignmentDialogOpen}
        onClose={() => setIsBulkAssignmentDialogOpen(false)}
        poolItems={selectionPool}
        onAssignmentComplete={handleBulkAssignmentComplete}
      />

      {/* Document Attachment Dialog */}
      {selectedOrder && (
        <DocumentAttachmentDialog
          isOpen={isDocumentDialogOpen}
          onClose={() => {
            setIsDocumentDialogOpen(false);
            setSelectedOrder(null);
            // Refresh document status after closing
            checkOrdersForDocuments();
          }}
          orderId={selectedOrder.id}
          orderNumber={selectedOrder.id.toString()}
        />
      )}
    </div>
  );
} 