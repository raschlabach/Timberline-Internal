'use client';

import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { format, parseISO } from 'date-fns';
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { AlertCircle, MessageSquare, Zap, Search, ChevronDown, ChevronUp, ChevronsUpDown, ChevronLeft, ChevronRight, Truck, MapPin, ToggleLeft, ToggleRight, Paperclip, ArrowRightLeft } from "lucide-react";
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
  initialViewToggles?: ViewToggles; // Custom default view toggles (overridden by localStorage if saved)
  showFilters?: boolean;
  showSortDropdown?: boolean;
  prioritizeRushOrders?: boolean;
  hideOnAnyAssignment?: boolean;
  storageKeyPrefix?: string; // Prefix for localStorage keys to make state independent per page
}

interface ViewToggles {
  unassigned: boolean;
  pickup: boolean;
  delivery: boolean;
  assigned: boolean;
  completed: boolean;
}

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

// Default filter values
const DEFAULT_FILTERS = {
  ohioToIndiana: false,
  backhaul: false,
  localFlatbed: false,
  rrOrder: false,
  localSemi: false,
  middlefield: false,
  paNy: false,
} as const;

function useLoadBoardOrders(
  initialFilters?: LoadBoardOrdersProps['initialFilters'],
  prioritizeRushOrders: boolean = true,
  hideOnAnyAssignment: boolean = false,
  truckloads: any[] = [],
  storageKeyPrefix: string = 'load-board',
  initialViewToggles?: ViewToggles
) {
  // Memoize LOCAL_STORAGE_KEYS to prevent it from changing on every render
  const LOCAL_STORAGE_KEYS = useMemo(() => getLocalStorageKeys(storageKeyPrefix), [storageKeyPrefix]);
  
  // Default view toggles (used if no initialViewToggles provided and no saved state)
  const defaultViewToggles: ViewToggles = {
    unassigned: true,
    pickup: true,
    delivery: false,
    assigned: false,
    completed: false
  };
  
  const [orders, setOrders] = useState<Order[]>([]);
  const [completedOrders, setCompletedOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortConfig, setSortConfig] = useState<SortConfig>({ field: 'pickupDate', direction: 'asc' });
  const [viewToggles, setViewToggles] = useState<ViewToggles>(
    initialViewToggles || defaultViewToggles
  );
  const [completedPage, setCompletedPage] = useState<number>(1);
  const [completedTotalCount, setCompletedTotalCount] = useState<number>(0);
  
  const [activeFilters, setActiveFilters] = useState<{[key: string]: boolean}>({
    ...DEFAULT_FILTERS,
    ...initialFilters
  });

  // Load from localStorage only once on mount - use ref to track if we've initialized
  const hasInitialized = useRef(false);
  
  useEffect(() => {
    // Only run once on mount
    if (hasInitialized.current) return;
    hasInitialized.current = true;
    
    try {
      const savedFilters = localStorage.getItem(LOCAL_STORAGE_KEYS.filters);
      if (savedFilters) {
        const parsedFilters = JSON.parse(savedFilters);
        if (parsedFilters && typeof parsedFilters === 'object') {
          // Use saved filters, merging with defaults to ensure all keys exist
          setActiveFilters({ ...DEFAULT_FILTERS, ...parsedFilters });
        }
      } else if (initialFilters) {
        // If no saved filters but initialFilters provided, use them
        setActiveFilters({ ...DEFAULT_FILTERS, ...initialFilters });
      }

      const savedSort = localStorage.getItem(LOCAL_STORAGE_KEYS.sort);
      if (savedSort) {
        const parsedSort = JSON.parse(savedSort) as SortConfig;
        if (parsedSort?.field && parsedSort?.direction) {
          setSortConfig(parsedSort);
        }
      }

      const savedToggles = localStorage.getItem(LOCAL_STORAGE_KEYS.viewToggles);
      if (savedToggles) {
        try {
          const parsed = JSON.parse(savedToggles) as ViewToggles;
          if (parsed && typeof parsed === 'object') {
            setViewToggles(parsed);
          }
        } catch (e) {
          // Use default if parsing fails
        }
      } else if (initialViewToggles) {
        // If no saved toggles but initialViewToggles provided, use them
        setViewToggles(initialViewToggles);
      }
    } catch (storageError) {
      console.error('Error loading load board preferences:', storageError);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Empty deps - only run once on mount

  useEffect(() => {
    // Don't save on initial mount - only save when user actually changes filters
    if (!hasInitialized.current) return;
    
    try {
      localStorage.setItem(LOCAL_STORAGE_KEYS.filters, JSON.stringify(activeFilters));
    } catch (storageError) {
      console.error('Error saving load board filters:', storageError);
    }
  }, [activeFilters, LOCAL_STORAGE_KEYS.filters]);

  useEffect(() => {
    // Don't save on initial mount - only save when user actually changes sort
    if (!hasInitialized.current) return;
    
    try {
      localStorage.setItem(LOCAL_STORAGE_KEYS.sort, JSON.stringify(sortConfig));
    } catch (storageError) {
      console.error('Error saving load board sort config:', storageError);
    }
  }, [sortConfig, LOCAL_STORAGE_KEYS.sort]);

  useEffect(() => {
    // Don't save on initial mount - only save when user actually changes toggles
    if (!hasInitialized.current) return;
    
    try {
      localStorage.setItem(LOCAL_STORAGE_KEYS.viewToggles, JSON.stringify(viewToggles));
    } catch (storageError) {
      console.error('Error saving load board view toggles:', storageError);
    }
  }, [viewToggles, LOCAL_STORAGE_KEYS.viewToggles]);

  const fetchOrders = useCallback(async () => {
    try {
      // Add cache-busting timestamp to prevent 304 responses
      const timestamp = new Date().getTime();
      // Always fetch all non-completed orders (we'll filter by toggles on the frontend)
      const response = await fetch(`/api/orders/recent?t=${timestamp}&all=true`, {
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

  const fetchCompletedOrders = useCallback(async (page: number = 1) => {
    try {
      const limit = 100;
      const offset = (page - 1) * limit;
      const response = await fetch(`/api/orders/completed?limit=${limit}&offset=${offset}`, {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache',
        }
      });
      if (!response.ok) throw new Error('Failed to fetch completed orders');
      const data = await response.json();
      setCompletedOrders(data.orders || []);
      setCompletedTotalCount(data.totalCount || 0);
    } catch (err) {
      console.error('Error fetching completed orders:', err);
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

  // Refetch orders when toggles change
  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  // Fetch completed orders when completed toggle is enabled
  useEffect(() => {
    if (viewToggles.completed) {
      fetchCompletedOrders(completedPage);
    } else {
      setCompletedOrders([]);
      setCompletedPage(1);
    }
  }, [viewToggles.completed, completedPage, fetchCompletedOrders]);

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

  // Function to get orders that match current toggles and search (before load type filtering)
  const getBaseOrders = () => {
    const allOrdersToCheck = [...orders];
    if (viewToggles.completed) {
      allOrdersToCheck.push(...completedOrders);
    }
    
    return allOrdersToCheck.filter(order => {
          const hasPickupAssignment = order.pickupAssignment !== null;
          const hasDeliveryAssignment = order.deliveryAssignment !== null;
      const isCompleted = order.status === 'completed';

      // Filter by toggle states
      if (isCompleted) {
        if (!viewToggles.completed) return false;
        } else {
        let matchesAnyToggle = false;
        if (viewToggles.unassigned && !hasPickupAssignment && !hasDeliveryAssignment) {
          matchesAnyToggle = true;
        }
        if (viewToggles.pickup && hasPickupAssignment && !hasDeliveryAssignment) {
          matchesAnyToggle = true;
        }
        if (viewToggles.delivery && hasDeliveryAssignment && !isCompleted) {
          matchesAnyToggle = true;
        }
        if (viewToggles.assigned && hasPickupAssignment && hasDeliveryAssignment && !order.isTransferOrder) {
          matchesAnyToggle = true;
        }
        if (!matchesAnyToggle) return false;
      }

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

  // Helper function to check if an order is completed - uses the same logic as getOrderStage
  // An order is completed when both pickup and delivery truckloads are completed
  const isOrderCompleted = useCallback((order: Order): boolean => {
    const pickupAssignment = order.pickupAssignment;
    const deliveryAssignment = order.deliveryAssignment;
    
    // Check if pickup truckload is completed
    const pickupTruckload = pickupAssignment ? truckloads.find(t => t.id === pickupAssignment.truckloadId) : null;
    const isPickupCompleted = pickupTruckload?.isCompleted || false;
    
    // Check if delivery truckload is completed
    const deliveryTruckload = deliveryAssignment ? truckloads.find(t => t.id === deliveryAssignment.truckloadId) : null;
    const isDeliveryCompleted = deliveryTruckload?.isCompleted || false;
    
    // Order is completed when both pickup and delivery are completed
    // This matches the logic in getOrderStage that shows "Completed" status
    return isPickupCompleted && isDeliveryCompleted;
  }, [truckloads]);

  // Combine regular orders and completed orders based on toggles
  const allOrdersToFilter = useMemo(() => {
    const allOrders: Order[] = [];
    
    // Add non-completed orders if any toggle except completed is enabled
    if (viewToggles.unassigned || viewToggles.pickup || viewToggles.delivery || viewToggles.assigned) {
      allOrders.push(...orders);
    }
    
    // Add completed orders if completed toggle is enabled
    if (viewToggles.completed) {
      allOrders.push(...completedOrders);
    }
    
    return allOrders;
  }, [orders, completedOrders, viewToggles]);

  const filteredOrders = useMemo(() => {
    return sortOrders(allOrdersToFilter.filter(order => {
      const hasPickupAssignment = order.pickupAssignment !== null;
      const hasDeliveryAssignment = order.deliveryAssignment !== null;
      // Use the same completion check logic as getOrderStage (status column)
      const isCompleted = isOrderCompleted(order);

      // CRITICAL FIRST CHECK: Completed orders should ONLY show if completed toggle is enabled
      // They should NEVER show for delivery, pickup, assigned, or unassigned toggles
      // This check happens FIRST before any other toggle logic
      if (isCompleted && !viewToggles.completed) {
        return false; // Immediately exclude completed orders when completed toggle is off
      }

      // Filter by toggle states
      if (isCompleted) {
        // If we get here, completed toggle is ON, so show the completed order
        // Continue to search/filter checks below
      } else {
        // Non-completed orders only - check which toggle they match
        let matchesAnyToggle = false;

        if (viewToggles.unassigned && !hasPickupAssignment && !hasDeliveryAssignment) {
          matchesAnyToggle = true;
        }
        if (viewToggles.pickup && hasPickupAssignment && !hasDeliveryAssignment) {
          matchesAnyToggle = true;
        }
        if (viewToggles.delivery && hasDeliveryAssignment) {
          // Delivery toggle: show orders with delivery assignment that are NOT completed
          // (isCompleted is already false here since we're in the else block)
          matchesAnyToggle = true;
        }
        if (viewToggles.assigned && hasPickupAssignment && hasDeliveryAssignment) {
          // Exclude transfer orders (pickup and delivery in same truckload)
          if (!order.isTransferOrder) {
            matchesAnyToggle = true;
          }
        }

        if (!matchesAnyToggle) return false;
      }

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
  }, [allOrdersToFilter, isOrderCompleted, viewToggles, searchTerm, activeFilters]);

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
    viewToggles,
    setViewToggles,
    completedPage,
    setCompletedPage,
    completedTotalCount,
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

// Helper function to get localStorage keys with prefix
const getLocalStorageKeys = (prefix: string = 'load-board') => ({
  filters: `${prefix}-active-filters`,
  sort: `${prefix}-sort-config`,
  view: `${prefix}-view-mode`,
  viewToggles: `${prefix}-view-toggles`
});

const FILTER_OPTIONS = [
  { id: 'ohioToIndiana', label: 'OH → IN' },
  { id: 'backhaul', label: 'Backhaul' },
  { id: 'localFlatbed', label: 'Local Flatbed' },
  { id: 'rrOrder', label: 'RNR' },
  { id: 'localSemi', label: 'Local Semi' },
  { id: 'middlefield', label: 'Middlefield' },
  { id: 'paNy', label: 'PA/NY' },
];

// Load type configuration with colors and labels
const LOAD_TYPE_CONFIG = {
  ohioToIndiana: {
    label: 'OH-IN',
    color: '#BFDBFE', // light blue-300
    textColor: '#1E40AF', // blue-800
  },
  backhaul: {
    label: 'B',
    color: '#FDE68A', // light amber-200
    textColor: '#92400E', // amber-800
  },
  localFlatbed: {
    label: 'LF',
    color: '#C7D2FE', // light indigo-200
    textColor: '#3730A3', // indigo-800
  },
  rrOrder: {
    label: 'RNR',
    color: '#FBCFE8', // light pink-200
    textColor: '#9F1239', // rose-800
  },
  localSemi: {
    label: 'LS',
    color: '#A7F3D0', // light emerald-200
    textColor: '#065F46', // emerald-800
  },
  middlefield: {
    label: 'M',
    color: '#FCD34D', // light yellow-300
    textColor: '#78350F', // yellow-800
  },
  paNy: {
    label: 'PA-NY',
    color: '#DDD6FE', // light purple-200
    textColor: '#5B21B6', // purple-800
  },
} as const;

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

export function LoadBoardOrders({ initialFilters, initialViewToggles, showFilters = true, showSortDropdown = false, prioritizeRushOrders = true, hideOnAnyAssignment = false, storageKeyPrefix = 'load-board' }: LoadBoardOrdersProps) {
  // Add truckload data for stage determination
  const [truckloads, setTruckloads] = useState<any[]>([]);
  
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
    viewToggles,
    setViewToggles,
    completedPage,
    setCompletedPage,
    completedTotalCount,
    filterCounts,
    refresh: fetchOrders
  } = useLoadBoardOrders(initialFilters, prioritizeRushOrders, hideOnAnyAssignment, truckloads, storageKeyPrefix, initialViewToggles);
  const [isLoadingTruckloads, setIsLoadingTruckloads] = useState(false);
  
  // Track orders with documents
  const [ordersWithDocuments, setOrdersWithDocuments] = useState<Set<number>>(new Set());
  const [isCheckingDocuments, setIsCheckingDocuments] = useState(false);
  
  // Calculate max pickup width for arrow alignment
  const [maxPickupWidth, setMaxPickupWidth] = useState<number>(0);
  const pickupWidthRefs = useRef<Map<number, number>>(new Map());
  
  useEffect(() => {
    if (orders.length > 0) {
      // Calculate max width from all pickup customer names
      const widths = Array.from(pickupWidthRefs.current.values());
      if (widths.length > 0) {
        const maxWidth = Math.max(...widths);
        setMaxPickupWidth(maxWidth);
      }
    }
  }, [orders]);

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

  // Check for documents on orders - batched to prevent too many concurrent requests
  const checkOrdersForDocuments = async () => {
    // Prevent concurrent executions
    if (isCheckingDocuments) {
      return;
    }
    
    setIsCheckingDocuments(true);
    
    try {
      const orderIds = orders.map(order => order.id);
      
      // Only check if we have orders and they're different from what we last checked
      if (orderIds.length === 0) {
        setOrdersWithDocuments(new Set());
        return;
      }
      
      // Process orders in batches to avoid ERR_INSUFFICIENT_RESOURCES
      const BATCH_SIZE = 5; // Process 5 orders at a time
      const DELAY_BETWEEN_BATCHES = 100; // 100ms delay between batches
      const documentChecks: Array<{ orderId: number; hasDocuments: boolean }> = [];
      
      for (let i = 0; i < orderIds.length; i += BATCH_SIZE) {
        const batch = orderIds.slice(i, i + BATCH_SIZE);
        
        // Process this batch with timeout handling
        const batchResults = await Promise.allSettled(
          batch.map(async (orderId) => {
            try {
              // Create abort controller for timeout (AbortSignal.timeout may not be available in all browsers)
              const controller = new AbortController();
              const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout
              
              try {
                const response = await fetch(`/api/orders/${orderId}/documents`, {
                  signal: controller.signal
                });
                clearTimeout(timeoutId);
                
                if (response.ok) {
                  const data = await response.json();
                  return { orderId, hasDocuments: data.documents && data.documents.length > 0 };
                }
              } catch (fetchError) {
                clearTimeout(timeoutId);
                throw fetchError;
              }
            } catch (error) {
              // Silently handle errors - don't log every failure to avoid console spam
              if (error instanceof Error && error.name !== 'AbortError') {
                // Only log non-timeout errors occasionally to avoid spam
                if (Math.random() < 0.05) { // Log ~5% of errors to avoid spam
                  console.error(`Error checking documents for order ${orderId}:`, error);
                }
              }
            }
            return { orderId, hasDocuments: false };
          })
        );
        
        // Collect results from this batch
        batchResults.forEach((result) => {
          if (result.status === 'fulfilled') {
            documentChecks.push(result.value);
          }
        });
        
        // Add delay between batches (except for the last batch)
        if (i + BATCH_SIZE < orderIds.length) {
          await new Promise(resolve => setTimeout(resolve, DELAY_BETWEEN_BATCHES));
        }
      }
      
      const ordersWithDocs = new Set(
        documentChecks
          .filter(check => check.hasDocuments)
          .map(check => check.orderId)
      );
      setOrdersWithDocuments(ordersWithDocs);
    } catch (error) {
      console.error('Error checking orders for documents:', error);
      // Don't break the app if document checking fails
    } finally {
      setIsCheckingDocuments(false);
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
              <div className="flex items-center space-x-1 flex-wrap gap-1">
                <Button
                  variant={viewToggles.unassigned ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setViewToggles(prev => ({ ...prev, unassigned: !prev.unassigned }))}
                  className={`text-xs h-7 px-3 transition-all duration-200 ${
                    viewToggles.unassigned 
                      ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-sm' 
                      : 'bg-white hover:bg-gray-50 text-gray-700 border-gray-300'
                  }`}
                >
                  Unassigned
                </Button>
                <Button
                  variant={viewToggles.pickup ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setViewToggles(prev => ({ ...prev, pickup: !prev.pickup }))}
                  className={`text-xs h-7 px-3 transition-all duration-200 ${
                    viewToggles.pickup 
                      ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-sm' 
                      : 'bg-white hover:bg-gray-50 text-gray-700 border-gray-300'
                  }`}
                >
                  Pickup
                </Button>
                <Button
                  variant={viewToggles.delivery ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setViewToggles(prev => ({ ...prev, delivery: !prev.delivery }))}
                  className={`text-xs h-7 px-3 transition-all duration-200 ${
                    viewToggles.delivery 
                      ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-sm' 
                      : 'bg-white hover:bg-gray-50 text-gray-700 border-gray-300'
                  }`}
                >
                  Delivery
                </Button>
                <Button
                  variant={viewToggles.assigned ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setViewToggles(prev => ({ ...prev, assigned: !prev.assigned }))}
                  className={`text-xs h-7 px-3 transition-all duration-200 ${
                    viewToggles.assigned 
                      ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-sm' 
                      : 'bg-white hover:bg-gray-50 text-gray-700 border-gray-300'
                  }`}
                >
                  Assigned
                </Button>
                <Button
                  variant={viewToggles.completed ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setViewToggles(prev => ({ ...prev, completed: !prev.completed }))}
                  className={`text-xs h-7 px-3 transition-all duration-200 ${
                    viewToggles.completed 
                      ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-sm' 
                      : 'bg-white hover:bg-gray-50 text-gray-700 border-gray-300'
                  }`}
                >
                  Completed
                </Button>
              </div>
            </div>
            
            {/* Completed Orders Pagination */}
            {viewToggles.completed && completedTotalCount > 100 && (
              <div className="flex items-center space-x-2 bg-white rounded-lg px-3 py-2 border border-gray-200 shadow-sm">
                <span className="text-xs text-gray-600">
                  Page {completedPage} of {Math.ceil(completedTotalCount / 100)}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const newPage = completedPage - 1;
                    if (newPage >= 1) {
                      setCompletedPage(newPage);
                    }
                  }}
                  disabled={completedPage === 1}
                  className="h-7 px-2 text-xs"
                >
                  <ChevronLeft className="w-3 h-3" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const newPage = completedPage + 1;
                    if (newPage <= Math.ceil(completedTotalCount / 100)) {
                      setCompletedPage(newPage);
                    }
                  }}
                  disabled={completedPage >= Math.ceil(completedTotalCount / 100)}
                  className="h-7 px-2 text-xs"
                >
                  <ChevronRight className="w-3 h-3" />
                </Button>
              </div>
            )}

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
                      const config = LOAD_TYPE_CONFIG[option.id as keyof typeof LOAD_TYPE_CONFIG];
                      const isActive = activeFilters[option.id];
                      return (
                        <Button
                          key={option.id}
                          variant="outline"
                          size="sm"
                          onClick={() => 
                            setActiveFilters(prev => ({ ...prev, [option.id]: !prev[option.id] }))
                          }
                          className={`text-xs h-7 px-3 transition-all duration-200 relative ${
                            isActive 
                              ? 'shadow-sm border-2' 
                              : 'border'
                          }`}
                          style={config ? {
                            backgroundColor: config.color,
                            color: config.textColor,
                            borderColor: isActive ? config.textColor : config.color,
                          } : {}}
                        >
                          <span className="flex items-center space-x-1">
                            <span>{option.label}</span>
                            {count > 0 && (
                              <span className={`inline-flex items-center justify-center w-4 h-4 text-xs rounded-full ${
                                isActive && config
                                  ? 'bg-white'
                                  : config
                                  ? 'bg-white/80'
                                  : 'bg-blue-600 text-white'
                              }`}
                              style={config ? {
                                color: config.textColor,
                              } : {}}
                              >
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
                  <TableHead className="h-6 text-xs font-medium text-gray-600 tracking-wide bg-transparent w-[140px]">Load Types</TableHead>
                  <TableHead className="h-6 text-xs font-medium text-gray-600 tracking-wide bg-transparent">
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
                      <div className="flex items-center gap-1.5">
                        {(() => {
                          const stage = getOrderStage(order);
                          return (
                            <div className="text-[11px] font-medium" style={{ color: stage.color }}>
                              {stage.text}
                            </div>
                          );
                        })()}
                        {order.isTransferOrder && (
                          <TooltipProvider>
                            <Tooltip delayDuration={100}>
                              <TooltipTrigger>
                                <ArrowRightLeft className="w-[12px] h-[12px] text-blue-600" />
                              </TooltipTrigger>
                              <TooltipContent side="top" className="text-[11px] bg-gray-900 text-white px-2 py-1">
                                Transfer Order
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        )}
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
                                <TooltipContent side="top" className="text-[11px] bg-gray-900 text-white px-2 py-1 max-w-xs">
                                  {order.comments}
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
                    <TableCell className="py-1 px-2 w-[140px] h-[36px]">
                      <div className="flex items-center gap-0.5 flex-nowrap h-full">
                        {Object.entries(order.filters).map(([key, isActive]) => {
                          if (!isActive) return null;
                          const config = LOAD_TYPE_CONFIG[key as keyof typeof LOAD_TYPE_CONFIG];
                          if (!config) return null;
                          const filterOption = FILTER_OPTIONS.find(opt => opt.id === key);
                          const fullName = filterOption?.label || key;
                          return (
                            <TooltipProvider key={key}>
                              <Tooltip delayDuration={100}>
                                <TooltipTrigger asChild>
                                  <span
                                    className="inline-flex items-center justify-center px-1.5 py-0.5 rounded-full text-[9px] font-semibold cursor-help leading-none whitespace-nowrap flex-shrink-0"
                                    style={{
                                      backgroundColor: config.color,
                                      color: config.textColor,
                                      lineHeight: '1',
                                    }}
                                  >
                                    {config.label}
                                  </span>
                                </TooltipTrigger>
                                <TooltipContent side="top" className="text-[11px] bg-gray-900 text-white px-2 py-1">
                                  {fullName}
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          );
                        })}
                      </div>
                    </TableCell>
                    <TableCell className="py-1 px-2">
                      <div className="flex items-center gap-2">
                        {/* Pickup section - fixed width to ensure arrow alignment */}
                        <div 
                          className="flex items-center gap-2 flex-shrink-0"
                          style={{ width: maxPickupWidth > 0 ? `${maxPickupWidth}px` : 'auto', minWidth: '200px' }}
                        >
                          {/* Fixed width container for truck icon */}
                          <div className="w-[18px] flex items-center justify-start flex-shrink-0">
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
                          </div>
                          <TooltipProvider>
                            <Tooltip delayDuration={200}>
                              <TooltipTrigger asChild>
                                <span 
                                  ref={(el) => {
                                    if (el) {
                                      const width = el.offsetWidth + 18; // 18px for truck icon space
                                      pickupWidthRefs.current.set(order.id, width);
                                      // Update max width if this is larger
                                      if (width > maxPickupWidth) {
                                        setMaxPickupWidth(width);
                                      }
                                    }
                                  }}
                                  className="text-red-600 font-extrabold text-[11px] cursor-help hover:underline whitespace-nowrap"
                                >
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
                        </div>
                        {/* Arrow - fixed position for vertical alignment */}
                        <div className="w-[16px] flex items-center justify-center flex-shrink-0">
                          <span className="text-gray-400 text-[11px]">→</span>
                        </div>
                        {/* Delivery section - will align consistently */}
                        <div className="flex items-center gap-2 flex-1">
                          {/* Fixed width container for truck icon */}
                          <div className="w-[18px] flex items-center justify-start flex-shrink-0">
                            {order.deliveryAssignment && (
                              <TooltipProvider>
                                <Tooltip delayDuration={100}>
                                  <TooltipTrigger>
                                    <Truck 
                                      className="w-[14px] h-[14px]" 
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
                          </div>
                          <TooltipProvider>
                            <Tooltip delayDuration={200}>
                              <TooltipTrigger asChild>
                                <span className="text-black font-extrabold text-[11px] cursor-help hover:underline whitespace-nowrap">
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