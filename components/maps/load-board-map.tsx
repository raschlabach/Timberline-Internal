import dynamic from 'next/dynamic'
import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { GoogleMap, useJsApiLoader, MarkerF, InfoWindowF, DirectionsRenderer } from '@react-google-maps/api';
import { MissingAddressWarning } from "./missing-address-warning"
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { X, Truck, Search } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { format, parseISO } from "date-fns";
import { Input } from "@/components/ui/input";

// Use dynamic import for AssignStopsDialog
const AssignStopsDialog = dynamic(() => import('./assign-stops-dialog'), {
  loading: () => <div>Loading...</div>
})

interface OrderFilters {
  ohioToIndiana: boolean;
  backhaul: boolean;
  localFlatbed: boolean;
  rrOrder: boolean;
  localSemi: boolean;
  middlefield: boolean;
  paNy: boolean;
}

interface LoadLocation {
  id: number;
  lat: number;
  lng: number;
  type: 'pickup' | 'delivery';
  customerName: string;
  pickupDate: string;
  footage: number;
  filters: OrderFilters;
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
  pickupCustomer?: {
    id: number;
    name: string;
    address: string;
    lat: number;
    lng: number;
  };
  deliveryCustomer?: {
    id: number;
    name: string;
    address: string;
    lat: number;
    lng: number;
  };
  source?: 'truckload';
  truckloadId?: number;
  driverColor?: string;
}

interface ClusteredLocation extends LoadLocation {
  adjustedLat: number;
  adjustedLng: number;
  clusterSize: number;
  clusterItems: LoadLocation[];
  hasPickup: boolean;
  hasDelivery: boolean;
  isCluster: boolean;
}

interface TruckloadSummary {
  id: number;
  driverId: number;
  startDate: string;
  endDate: string;
  trailerNumber: string | null;
  billOfLadingNumber: string | null;
  description: string | null;
  isCompleted: boolean;
  totalMileage: number;
  estimatedDuration: number;
  driverName: string | null;
  driverColor: string | null;
  pickupFootage: number;
  deliveryFootage: number;
  transferFootage: number;
}

interface TruckloadStop {
  id: number;
  lat: number;
  lng: number;
  assignment_type: 'pickup' | 'delivery';
  customer_name: string;
  pickupDate: string;
  filters: OrderFilters;
}

interface Truckload {
  id: number;
  driverColor: string;
  stops: LoadLocation[];
}

interface TruckloadOrder {
  id: number;
  assignment_type: 'pickup' | 'delivery';
  pickup_date?: string;
  footage?: number;
  filters?: OrderFilters;
  pickup_customer?: {
    id: number;
    name: string;
    address: string;
  };
  delivery_customer?: {
    id: number;
    name: string;
    address: string;
  };
}

interface TruckloadStopsResponse {
  success: boolean;
  orders: Array<{
    id: number;
    assignment_type: 'pickup' | 'delivery';
    pickup_date?: string;
    footage?: number;
    filters?: OrderFilters;
    pickup_customer?: {
      id: number;
      name: string;
      address: string;
    };
    delivery_customer?: {
      id: number;
      name: string;
      address: string;
    };
  }>;
}

interface ViewToggles {
  unassigned: boolean;
  pickup: boolean;
  delivery: boolean;
  assigned: boolean;
  completed: boolean;
}

const DEFAULT_FILTERS: Record<string, boolean> = {
  ohioToIndiana: false,
  backhaul: false,
  localFlatbed: false,
  rrOrder: false,
  localSemi: false,
  middlefield: false,
  paNy: false,
};

const EMPTY_FILTERS: OrderFilters = {
  ohioToIndiana: false,
  backhaul: false,
  localFlatbed: false,
  rrOrder: false,
  localSemi: false,
  middlefield: false,
  paNy: false,
};

const FILTER_OPTIONS = [
  { id: 'ohioToIndiana', label: 'OH → IN' },
  { id: 'backhaul', label: 'Backhaul' },
  { id: 'localFlatbed', label: 'Local Flatbed' },
  { id: 'rrOrder', label: 'RNR' },
  { id: 'localSemi', label: 'Local Semi' },
  { id: 'middlefield', label: 'Middlefield' },
  { id: 'paNy', label: 'PA/NY' },
];

const LOAD_TYPE_CONFIG = {
  ohioToIndiana: { label: 'OH-IN', color: '#BFDBFE', textColor: '#1E40AF' },
  backhaul: { label: 'B', color: '#FDE68A', textColor: '#92400E' },
  localFlatbed: { label: 'LF', color: '#C7D2FE', textColor: '#3730A3' },
  rrOrder: { label: 'RNR', color: '#FBCFE8', textColor: '#9F1239' },
  localSemi: { label: 'LS', color: '#A7F3D0', textColor: '#065F46' },
  middlefield: { label: 'M', color: '#FCD34D', textColor: '#78350F' },
  paNy: { label: 'PA-NY', color: '#DDD6FE', textColor: '#5B21B6' },
} as const;

const MAP_STORAGE_KEYS = {
  filters: 'load-board-map-active-filters',
  viewToggles: 'load-board-map-view-toggles',
};

const center = {
  lat: 40.5008, // Timberline Warehouse latitude
  lng: -81.6346 // Timberline Warehouse longitude
};

const mapContainerStyle = {
  width: '100%',
  height: '100%'
};

const options = {
  disableDefaultUI: false,
  zoomControl: true,
  mapTypeControl: true,
  streetViewControl: false,
  fullscreenControl: true,
};

// Function to cluster overlapping markers
function clusterMarkers(loads: LoadLocation[]): ClusteredLocation[] {
  const CLUSTER_DISTANCE = 0.0001; // Approximately 11 meters
  const clusters: Record<string, LoadLocation[]> = {};
  
  // Group markers by their approximate location
  loads.forEach(load => {
    const key = `${Math.round(load.lat / CLUSTER_DISTANCE)},${Math.round(load.lng / CLUSTER_DISTANCE)}`;
    if (!clusters[key]) {
      clusters[key] = [];
    }
    clusters[key].push(load);
  });

  // Process each cluster
  return Object.values(clusters).map(cluster => {
    const representative = cluster[0];

    // Calculate center coordinates
    const centerLat = cluster.reduce((sum, load) => sum + load.lat, 0) / cluster.length;
    const centerLng = cluster.reduce((sum, load) => sum + load.lng, 0) / cluster.length;
    
    // Determine what types of stops are at this location
    const hasPickup = cluster.some(load => load.type === 'pickup');
    const hasDelivery = cluster.some(load => load.type === 'delivery');
    
    // Create a single consolidated marker for this location
    return {
      ...representative,
      id: representative.id,
      lat: centerLat,
      lng: centerLng,
      adjustedLat: centerLat,
      adjustedLng: centerLng,
      clusterSize: cluster.length,
      clusterItems: cluster,
      isCluster: true,
      // Consolidated type information
      hasPickup,
      hasDelivery,
      // Use any available customer info for display
      pickupCustomer: cluster.find(load => load.pickupCustomer)?.pickupCustomer ?? representative.pickupCustomer,
      deliveryCustomer: cluster.find(load => load.deliveryCustomer)?.deliveryCustomer ?? representative.deliveryCustomer
    };
  });
}

// Truckloads Dialog Component
function TruckloadsDialog() {
  const [truckloads, setTruckloads] = useState<TruckloadSummary[]>([]);
  const [drivers, setDrivers] = useState<{ id: string; fullName: string; color: string; }[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isOpen, setIsOpen] = useState(false);

  const fetchData = async () => {
    try {
      setIsLoading(true);
      // Add timestamp to prevent caching
      const timestamp = new Date().getTime();
      
      // Fetch both truckloads and drivers in parallel
      const [truckloadsResponse, driversResponse] = await Promise.all([
        fetch(`/api/truckloads?t=${timestamp}`),
        fetch(`/api/drivers?t=${timestamp}`)
      ]);

      if (!truckloadsResponse.ok) throw new Error('Failed to fetch truckloads');
      if (!driversResponse.ok) throw new Error('Failed to fetch drivers');

      const [truckloadsData, driversData] = await Promise.all([
        truckloadsResponse.json(),
        driversResponse.json()
      ]);
      
      if (!truckloadsData.success) {
        throw new Error(truckloadsData.error || 'Failed to fetch truckloads');
      }
      if (!driversData.success) {
        throw new Error(driversData.error || 'Failed to fetch drivers');
      }
      
      // Set drivers
      setDrivers(driversData.drivers);
      
      // Filter out completed truckloads and sort by driver name, then date
      const activeTruckloads = truckloadsData.truckloads
        .filter((t: any) => !t.isCompleted)
        .map((t: any) => ({
          id: t.id,
          driverId: t.driverId,
          startDate: t.startDate,
          endDate: t.endDate,
          trailerNumber: t.trailerNumber || null,
          billOfLadingNumber: t.billOfLadingNumber || null,
          description: t.description || null,
          isCompleted: t.isCompleted || false,
          totalMileage: t.totalMileage || 0,
          estimatedDuration: t.estimatedDuration || 0,
          driverName: t.driverName || null,
          driverColor: t.driverColor || null,
          pickupFootage: t.pickupFootage || 0,
          deliveryFootage: t.deliveryFootage || 0,
          transferFootage: t.transferFootage || 0
        }))
        .sort((a: TruckloadSummary, b: TruckloadSummary) => {
          // First sort by driver name
          const driverNameCompare = (a.driverName || '').localeCompare(b.driverName || '');
          if (driverNameCompare !== 0) return driverNameCompare;
          
          // Then sort by start date (soonest first)
          return new Date(a.startDate).getTime() - new Date(b.startDate).getTime();
        });
      
      setTruckloads(activeTruckloads);
      setError(null);
    } catch (err) {
      console.error('Error fetching data:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch data');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchData();
    }
  }, [isOpen]);

  // Group truckloads by driver
  const truckloadsByDriver = drivers.reduce((acc, driver) => {
    acc[driver.fullName] = {
      driverName: driver.fullName,
      driverColor: driver.color,
      truckloads: truckloads.filter(t => t.driverName === driver.fullName)
    };
    return acc;
  }, {} as Record<string, { driverName: string; driverColor: string; truckloads: TruckloadSummary[] }>);

  // Convert to array and sort by driver name
  const driverColumns = Object.values(truckloadsByDriver).sort((a, b) => 
    a.driverName.localeCompare(b.driverName)
  );

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="w-full mt-2">
          <Truck className="h-4 w-4 mr-2" />
          View Active Truckloads
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-[95vw] max-h-[80vh] overflow-y-auto">
        <DialogHeader className="flex flex-row items-center justify-between">
          <DialogTitle>Active Truckloads</DialogTitle>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={fetchData}
            disabled={isLoading}
            className="h-8 w-8 p-0"
          >
            <svg 
              xmlns="http://www.w3.org/2000/svg" 
              width="16" 
              height="16" 
              viewBox="0 0 24 24" 
              fill="none" 
              stroke="currentColor" 
              strokeWidth="2" 
              strokeLinecap="round" 
              strokeLinejoin="round"
              className={isLoading ? "animate-spin" : ""}
            >
              <path d="M21 2v6h-6"></path>
              <path d="M3 12a9 9 0 0 1 15-6.7L21 8"></path>
              <path d="M3 22v-6h6"></path>
              <path d="M21 12a9 9 0 0 1-15 6.7L3 16"></path>
            </svg>
          </Button>
        </DialogHeader>
        
        {isLoading ? (
          <div className="flex items-center justify-center h-32">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
          </div>
        ) : error ? (
          <div className="text-red-500 p-4">{error}</div>
        ) : truckloads.length === 0 ? (
          <div className="text-gray-500 p-4">No active truckloads found.</div>
        ) : (
          <div className="grid grid-flow-col auto-cols-[300px] gap-4 overflow-x-auto pb-4">
            {driverColumns.map((driver) => (
              <div key={driver.driverName} className="flex flex-col min-w-[300px]">
                <div className="flex items-center gap-2 mb-2 pb-2 border-b sticky top-0 bg-white">
                  <div 
                    className="w-3 h-3 rounded-full" 
                    style={{ backgroundColor: driver.driverColor }}
                  />
                  <h3 className="font-medium">{driver.driverName}</h3>
                </div>
                <div className="space-y-3">
                  {driver.truckloads.map((truckload) => (
                    <Card key={truckload.id} className="p-3">
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="text-sm text-gray-500">
                            {format(parseISO(truckload.startDate), 'MM/dd/yy')} - {format(parseISO(truckload.endDate), 'MM/dd/yy')}
                          </div>
                          {truckload.description && (
                            <div className="text-sm mt-1">{truckload.description}</div>
                          )}
                        </div>
                        <Badge variant="outline" className="text-xs">
                          #{truckload.id}
                        </Badge>
                      </div>
                      
                      <div className="mt-2 grid grid-cols-2 gap-1 text-xs">
                        <div>
                          <span className="text-gray-500">Trailer:</span> {truckload.trailerNumber || 'N/A'}
                        </div>
                        <div>
                          <span className="text-gray-500">BOL:</span> {truckload.billOfLadingNumber || 'N/A'}
                        </div>
                        <div>
                          <span className="text-gray-500">Mileage:</span> {truckload.totalMileage || 0}
                        </div>
                        <div>
                          <span className="text-gray-500">Duration:</span> {truckload.estimatedDuration || 0} hrs
                        </div>
                      </div>
                      
                      <div className="mt-2 flex flex-wrap gap-1">
                        <Badge variant="destructive" className="text-xs">
                          Pickup: {Math.round(truckload.pickupFootage)} ft²
                        </Badge>
                        <Badge variant="default" className="text-xs">
                          Delivery: {Math.round(truckload.deliveryFootage)} ft²
                        </Badge>
                        {truckload.transferFootage > 0 && (
                          <Badge variant="secondary" className="text-xs">
                            Transfer: {Math.round(truckload.transferFootage)} ft²
                          </Badge>
                        )}
                      </div>
                    </Card>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

// Function to process orders into load locations
function processOrders(orders: any[]): LoadLocation[] {
  return orders.flatMap(order => {
    const locations: LoadLocation[] = [];
    const baseFields = {
      id: order.id,
      pickupDate: order.pickupDate,
      footage: order.footage || 0,
      filters: order.filters || EMPTY_FILTERS,
      pickupCustomer: order.pickupCustomer,
      deliveryCustomer: order.deliveryCustomer,
      pickupAssignment: order.pickupAssignment || undefined,
      deliveryAssignment: order.deliveryAssignment || undefined,
    };
    
    if (order.pickupCustomer?.lat && order.pickupCustomer?.lng) {
      locations.push({
        ...baseFields,
        lat: order.pickupCustomer.lat,
        lng: order.pickupCustomer.lng,
        type: 'pickup',
        customerName: order.pickupCustomer.name,
      });
    }
    
    if (order.deliveryCustomer?.lat && order.deliveryCustomer?.lng) {
      locations.push({
        ...baseFields,
        lat: order.deliveryCustomer.lat,
        lng: order.deliveryCustomer.lng,
        type: 'delivery',
        customerName: order.deliveryCustomer.name,
      });
    }
    
    return locations;
  });
}

export default function LoadBoardMap() {
  const [map, setMap] = useState<google.maps.Map | null>(null);
  const [loadLocations, setLoadLocations] = useState<LoadLocation[]>([]);
  const [completedLocations, setCompletedLocations] = useState<LoadLocation[]>([]);
  const [clusteredLoads, setClusteredLoads] = useState<ClusteredLocation[]>([]);
  const [selectedLocations, setSelectedLocations] = useState<ClusteredLocation[]>([]);
  const [isAssignDialogOpen, setIsAssignDialogOpen] = useState(false);
  const [drivers, setDrivers] = useState<{ id: string; fullName: string; color: string; }[]>([]);
  const [expandedDrivers, setExpandedDrivers] = useState<Set<string>>(new Set());
  const [allTruckloads, setAllTruckloads] = useState<TruckloadSummary[]>([]);
  const [driverTruckloads, setDriverTruckloads] = useState<Record<string, TruckloadSummary[]>>({});
  const [selectedTruckloads, setSelectedTruckloads] = useState<Set<number>>(new Set());
  const [truckloadStops, setTruckloadStops] = useState<Record<number, Truckload>>({});
  const [truckloadRoutes, setTruckloadRoutes] = useState<Record<number, google.maps.DirectionsResult>>({});
  const [selectedMarkerInfo, setSelectedMarkerInfo] = useState<{ id: number; type: 'load' | 'truckload'; data: any } | null>(null);
  const [locationTruckloadStops, setLocationTruckloadStops] = useState<LoadLocation[]>([]);
  const [viewToggles, setViewToggles] = useState<ViewToggles>({
    unassigned: true,
    pickup: true,
    delivery: false,
    assigned: false,
    completed: false,
  });
  const [activeFilters, setActiveFilters] = useState<Record<string, boolean>>({ ...DEFAULT_FILTERS });
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const hasInitialized = useRef(false);

  const { isLoaded } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || ''
  });

  // Load saved state from localStorage on mount
  useEffect(() => {
    if (hasInitialized.current) return;
    hasInitialized.current = true;
    try {
      const savedFilters = localStorage.getItem(MAP_STORAGE_KEYS.filters);
      if (savedFilters) {
        const parsed = JSON.parse(savedFilters);
        if (parsed && typeof parsed === 'object') {
          setActiveFilters({ ...DEFAULT_FILTERS, ...parsed });
        }
      }
      const savedToggles = localStorage.getItem(MAP_STORAGE_KEYS.viewToggles);
      if (savedToggles) {
        const parsed = JSON.parse(savedToggles) as ViewToggles;
        if (parsed && typeof parsed === 'object') {
          setViewToggles(parsed);
        }
      }
    } catch (e) {
      console.error('Error loading map preferences:', e);
    }
  }, []);

  // Persist filter state
  useEffect(() => {
    if (!hasInitialized.current) return;
    try { localStorage.setItem(MAP_STORAGE_KEYS.filters, JSON.stringify(activeFilters)); } catch {}
  }, [activeFilters]);

  useEffect(() => {
    if (!hasInitialized.current) return;
    try { localStorage.setItem(MAP_STORAGE_KEYS.viewToggles, JSON.stringify(viewToggles)); } catch {}
  }, [viewToggles]);

  // Debounce search term
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearchTerm(searchTerm), 300);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  // Build view param from toggles (excluding completed which uses its own endpoint)
  const getViewParam = useCallback((toggles: ViewToggles): string => {
    const views: string[] = [];
    if (toggles.unassigned) views.push('unassigned');
    if (toggles.pickup) views.push('pickup');
    if (toggles.delivery) views.push('delivery');
    if (toggles.assigned) views.push('assigned');
    return views.join(',');
  }, []);

  const fetchOrders = useCallback(async () => {
    try {
      setIsLoading(true);
      const timestamp = new Date().getTime();
      const viewParam = getViewParam(viewToggles);

      if (!viewParam) {
        setLoadLocations([]);
        setIsLoading(false);
        return;
      }

      const searchParam = debouncedSearchTerm ? `&search=${encodeURIComponent(debouncedSearchTerm)}` : '';
      const response = await fetch(`/api/orders/recent?t=${timestamp}&view=${viewParam}${searchParam}`, {
        cache: 'no-store',
        headers: { 'Cache-Control': 'no-cache' }
      });
      if (!response.ok) throw new Error('Failed to fetch orders');
      const data = await response.json();
      const processedLocations = processOrders(data.orders || []);
      setLoadLocations(processedLocations);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsLoading(false);
    }
  }, [viewToggles, debouncedSearchTerm, getViewParam]);

  const fetchCompletedOrders = useCallback(async () => {
    try {
      const searchParam = debouncedSearchTerm ? `&search=${encodeURIComponent(debouncedSearchTerm)}` : '';
      const response = await fetch(`/api/orders/completed?limit=200&offset=0${searchParam}`, {
        cache: 'no-store',
        headers: { 'Cache-Control': 'no-cache' }
      });
      if (!response.ok) throw new Error('Failed to fetch completed orders');
      const data = await response.json();
      const processedLocations = processOrders(data.orders || []);
      setCompletedLocations(processedLocations);
    } catch (err) {
      console.error('Error fetching completed orders:', err);
    }
  }, [debouncedSearchTerm]);

  // Fetch orders when view toggles or search changes
  useEffect(() => {
    fetchOrders();
    const intervalId = setInterval(fetchOrders, 30000);
    return () => clearInterval(intervalId);
  }, [fetchOrders]);

  // Fetch completed orders when completed toggle is enabled
  useEffect(() => {
    if (viewToggles.completed) {
      fetchCompletedOrders();
    } else {
      setCompletedLocations([]);
    }
  }, [viewToggles.completed, fetchCompletedOrders]);

  // Fetch drivers and truckloads on mount
  useEffect(() => {
    fetchDrivers();
    fetchAllTruckloads();
  }, []);

  // Check for new orders using localStorage (works across page navigations)
  useEffect(() => {
    const checkForNewOrders = () => {
      const lastOrderTimestamp = localStorage.getItem('lastOrderCreated');
      const lastCheckTimestamp = localStorage.getItem('lastOrdersCheckMap');
      if (lastOrderTimestamp && lastCheckTimestamp) {
        const orderTime = parseInt(lastOrderTimestamp, 10);
        const checkTime = parseInt(lastCheckTimestamp, 10);
        if (orderTime > checkTime) {
          fetchOrders();
          localStorage.setItem('lastOrdersCheckMap', Date.now().toString());
        }
      } else if (lastOrderTimestamp) {
        localStorage.setItem('lastOrdersCheckMap', Date.now().toString());
      }
    };
    checkForNewOrders();
    const checkInterval = setInterval(checkForNewOrders, 2000);
    return () => clearInterval(checkInterval);
  }, [fetchOrders]);

  // Listen for orderCreated event to refresh immediately
  useEffect(() => {
    const handleOrderCreated = () => {
      fetchOrders();
      localStorage.setItem('lastOrderCreated', Date.now().toString());
    };
    window.addEventListener('orderCreated', handleOrderCreated);
    return () => window.removeEventListener('orderCreated', handleOrderCreated);
  }, [fetchOrders]);

  async function fetchDrivers() {
    try {
      const response = await fetch('/api/drivers');
      if (!response.ok) throw new Error('Failed to fetch drivers');
      const data = await response.json();
      if (data.success) {
        // Map to use camelCase property names consistently
        const mappedDrivers = data.drivers.map((driver: any) => ({
          id: driver.id,
          fullName: driver.full_name,
          color: driver.color
        }));
        setDrivers(mappedDrivers);
      }
    } catch (error) {
      console.error('Error fetching drivers:', error);
    }
  }

  async function fetchAllTruckloads() {
    try {
      const timestamp = new Date().getTime();
      const response = await fetch(`/api/truckloads?t=${timestamp}`);
      if (!response.ok) throw new Error('Failed to fetch truckloads');
      const data = await response.json();
      if (data.success) {
        const active = (data.truckloads || []).filter((t: any) => !t.isCompleted);
        setAllTruckloads(active);
      }
    } catch (error) {
      console.error('Error fetching truckloads:', error);
    }
  }

  function getDriverTruckloads(driverId: string): TruckloadSummary[] {
    return allTruckloads.filter(t => String(t.driverId) === String(driverId));
  }

  async function fetchAllTruckloadStopsForLocation(lat: number, lng: number) {
    try {
      // Fetch all active truckloads
      const truckloadsResponse = await fetch('/api/truckloads');
      if (!truckloadsResponse.ok) throw new Error('Failed to fetch truckloads');
      const truckloadsData = await truckloadsResponse.json();
      
      // Filter to only active (non-completed) truckloads
      const activeTruckloads = truckloadsData.truckloads.filter((t: any) => !t.isCompleted);
      
      // Fetch stops for each active truckload
      const allStops: LoadLocation[] = [];
      
      for (const truckload of activeTruckloads) {
        try {
          const response = await fetch(`/api/truckloads/${truckload.id}/orders`);
          if (!response.ok) continue;
          const data = await response.json();
          
          if (!data.success || !data.orders) continue;

          // Process each stop in this truckload
          for (const order of data.orders) {
            const customer = order.assignment_type === 'pickup' 
              ? order.pickup_customer 
              : order.delivery_customer;
            
            if (!customer?.address) continue;

            try {
              const geocoder = new window.google.maps.Geocoder();
              const result = await new Promise((resolve, reject) => {
                geocoder.geocode({ address: customer.address }, (results, status) => {
                  if (status === 'OK' && results?.[0]) {
                    resolve(results[0]);
                  } else {
                    reject(new Error(`Geocoding failed: ${status}`));
                  }
                });
              });

              const location = (result as google.maps.GeocoderResult).geometry.location;
              
              // Check if this stop is at the same location (within a small radius)
              const distance = Math.sqrt(
                Math.pow(location.lat() - lat, 2) + Math.pow(location.lng() - lng, 2)
              );
              
              // If within 0.0001 degrees (approximately 11 meters)
              if (distance < 0.0001) {
                const assignmentDetails = {
                  truckloadId: truckload.id,
                  driverName: truckload.driverName || '',
                  driverColor: truckload.driverColor || '',
                  startDate: truckload.startDate,
                  endDate: truckload.endDate,
                  description: truckload.description || ''
                };

                allStops.push({
                  id: order.id,
                  lat: location.lat(),
                  lng: location.lng(),
                  type: order.assignment_type,
                  customerName: customer.name,
                  pickupDate: order.pickup_date || new Date().toISOString(),
                  footage: order.footage || 0,
                  filters: { ...EMPTY_FILTERS },
                  pickupCustomer: order.pickup_customer,
                  deliveryCustomer: order.delivery_customer,
                  source: 'truckload',
                  truckloadId: truckload.id,
                  driverColor: truckload.driverColor,
                  pickupAssignment: order.assignment_type === 'pickup'
                    ? assignmentDetails
                    : undefined,
                  deliveryAssignment: order.assignment_type === 'delivery'
                    ? {
                        truckloadId: truckload.id,
                        driverName: truckload.driverName || '',
                        driverColor: truckload.driverColor || '',
                        startDate: truckload.startDate,
                        endDate: truckload.endDate,
                      }
                    : undefined
                });
              }
            } catch (error) {
              console.error('Error geocoding address:', error);
            }
          }
        } catch (error) {
          console.error(`Error fetching stops for truckload ${truckload.id}:`, error);
        }
      }
      
      setLocationTruckloadStops(allStops);
    } catch (error) {
      console.error('Error fetching truckload stops for location:', error);
      setLocationTruckloadStops([]);
    }
  }

  async function fetchTruckloadStops(truckloadId: number) {
    try {
      const response = await fetch(`/api/truckloads/${truckloadId}/orders`);
      if (!response.ok) throw new Error('Failed to fetch truckload stops');
      const data = await response.json();
      
      if (!data.success || !data.orders) {
        console.error('Invalid truckload stops data:', data);
        return;
      }

      // Find the driver color from the cached truckloads
      const truckload = allTruckloads.find(t => t.id === truckloadId);

      // Format the stops data
      const stops = await Promise.all(data.orders.map(async (order: TruckloadOrder) => {
        const customer = order.assignment_type === 'pickup' 
          ? order.pickup_customer 
          : order.delivery_customer;
        
        if (!customer?.address) {
          console.warn('Missing address for customer:', customer?.name);
          return {
            id: order.id,
            lat: 0,
            lng: 0,
            type: order.assignment_type,
            customerName: customer?.name || 'Unknown Customer',
            pickupDate: order.pickup_date || new Date().toISOString(),
            footage: order.footage || 0,
                  filters: { ...EMPTY_FILTERS },
                  pickupCustomer: order.pickup_customer,
                  deliveryCustomer: order.delivery_customer
                };
              }

              try {
                const geocoder = new window.google.maps.Geocoder();
                const result = await new Promise((resolve, reject) => {
                  geocoder.geocode({ address: customer.address }, (results, status) => {
                    if (status === 'OK' && results?.[0]) {
                      resolve(results[0]);
                    } else {
                      reject(new Error(`Geocoding failed: ${status}`));
                    }
                  });
                });

                const location = (result as google.maps.GeocoderResult).geometry.location;
                
                return {
                  id: order.id,
                  lat: location.lat(),
                  lng: location.lng(),
                  type: order.assignment_type,
                  customerName: customer.name,
                  pickupDate: order.pickup_date || new Date().toISOString(),
                  footage: order.footage || 0,
                  filters: { ...EMPTY_FILTERS },
                  pickupCustomer: order.pickup_customer,
                  deliveryCustomer: order.delivery_customer
                };
              } catch (error) {
                console.error('Error geocoding address:', error);
                return {
                  id: order.id,
                  lat: 0,
                  lng: 0,
                  type: order.assignment_type,
                  customerName: customer.name,
                  pickupDate: order.pickup_date || new Date().toISOString(),
                  footage: order.footage || 0,
                  filters: { ...EMPTY_FILTERS },
                  pickupCustomer: order.pickup_customer,
                  deliveryCustomer: order.delivery_customer
                };
              }
      }));

      setTruckloadStops(prev => ({
        ...prev,
        [truckloadId]: {
          id: truckloadId,
          driverColor: truckload?.driverColor || '#808080',
          stops
        }
      }));

      // Calculate driving route for this truckload
      calculateTruckloadRoute(truckloadId, data.orders);
    } catch (error) {
      console.error('Error fetching truckload stops:', error);
    }
  }

  const TIMBERLINE_ADDRESS = '1361 County Road 108, Sugar Creek, OH 44681';

  function calculateTruckloadRoute(truckloadId: number, orders: TruckloadOrder[]) {
    if (!window.google?.maps) return;

    const directionsService = new google.maps.DirectionsService();
    const waypoints: google.maps.DirectionsWaypoint[] = [];

    for (const order of orders) {
      const customer = order.assignment_type === 'pickup'
        ? order.pickup_customer
        : order.delivery_customer;
      if (!customer?.address) continue;
      waypoints.push({ location: customer.address, stopover: true });
    }

    if (waypoints.length === 0) return;

    const request: google.maps.DirectionsRequest = {
      origin: TIMBERLINE_ADDRESS,
      destination: TIMBERLINE_ADDRESS,
      waypoints,
      optimizeWaypoints: false,
      travelMode: google.maps.TravelMode.DRIVING,
    };

    directionsService.route(request, (result, status) => {
      if (status === google.maps.DirectionsStatus.OK && result) {
        setTruckloadRoutes(prev => ({ ...prev, [truckloadId]: result }));
      }
    });
  }

  const onLoad = (map: google.maps.Map) => {
    setMap(map);
    fetchOrders();
  };

  const onUnmount = () => {
    setMap(null);
  };

  const toggleLocationSelection = (location: ClusteredLocation) => {
    setSelectedLocations(prev => {
      const isSelected = prev.some(loc => loc.id === location.id && loc.type === location.type);
      
      if (isSelected) {
        // Remove from selection
        return prev.filter(loc => !(loc.id === location.id && loc.type === location.type));
      } else {
        // Add to selection
        return [...prev, location];
      }
    });
  };

  const clearSelection = () => {
    setSelectedLocations([]);
  };

  const handleAssignmentComplete = () => {
    // Clear selected locations
    setSelectedLocations([]);
    // Refresh the orders data
    fetchOrders();
  };

  const toggleDriverExpansion = (driverId: string) => {
    setExpandedDrivers(prev => {
      const newSet = new Set(prev);
      if (newSet.has(driverId)) {
        newSet.delete(driverId);
      } else {
        newSet.add(driverId);
      }
      return newSet;
    });
  };

  const toggleTruckloadSelection = (truckloadId: number, driverColor: string) => {
    setSelectedTruckloads(prev => {
      const newSet = new Set(prev);
      if (newSet.has(truckloadId)) {
        newSet.delete(truckloadId);
        setTruckloadRoutes(r => {
          const next = { ...r };
          delete next[truckloadId];
          return next;
        });
      } else {
        newSet.add(truckloadId);
        if (!truckloadStops[truckloadId]) {
          fetchTruckloadStops(truckloadId);
        }
      }
      return newSet;
    });
  };

  // Combine all locations and apply client-side load type filters, then cluster
  const filteredLocations = useMemo(() => {
    const allOrders = [...loadLocations, ...(viewToggles.completed ? completedLocations : [])];
    const hasActiveFilters = Object.values(activeFilters).some(v => v);
    if (!hasActiveFilters) return allOrders;
    return allOrders.filter(loc =>
      Object.entries(activeFilters).some(([key, isActive]) =>
        isActive && loc.filters[key as keyof OrderFilters]
      )
    );
  }, [loadLocations, completedLocations, viewToggles.completed, activeFilters]);

  // Calculate filter counts for the current set of locations
  const filterCounts = useMemo(() => {
    const allOrders = [...loadLocations, ...(viewToggles.completed ? completedLocations : [])];
    const counts: Record<string, number> = {};
    FILTER_OPTIONS.forEach(option => {
      counts[option.id] = allOrders.filter(loc =>
        loc.filters[option.id as keyof OrderFilters]
      ).length;
    });
    return counts;
  }, [loadLocations, completedLocations, viewToggles.completed]);

  // Update clustering
  useEffect(() => {
    const allLocations = [
      ...filteredLocations,
      ...Array.from(selectedTruckloads).flatMap(truckloadId => {
        const truckload = truckloadStops[truckloadId];
        if (!truckload) return [];
        return truckload.stops.map(stop => ({
          ...stop,
          source: 'truckload' as const,
          truckloadId,
          driverColor: truckload.driverColor
        }));
      })
    ];
    const clusteredLocations = clusterMarkers(allLocations);
    setClusteredLoads(clusteredLocations);
  }, [filteredLocations, selectedTruckloads, truckloadStops]);

  if (!isLoaded) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  return (
    <div className="relative w-full h-full flex">
      {/* Driver List */}
      <div className="w-64 bg-white border-r border-gray-200 p-4 overflow-y-auto">
        <h2 className="text-lg font-semibold mb-4">Drivers</h2>
        <div className="space-y-2">
          {drivers.map((driver) => (
            <div key={driver.id} className="space-y-1">
              <div
                className="flex items-center space-x-3 p-2 rounded-lg hover:bg-gray-50 cursor-pointer"
                onClick={() => toggleDriverExpansion(driver.id)}
              >
                <div
                  className="w-4 h-4 rounded-full"
                  style={{ backgroundColor: driver.color }}
                />
                <span className="text-sm font-medium">{driver.fullName}</span>
                <span className="ml-auto text-xs text-gray-500">
                  {expandedDrivers.has(driver.id) ? '▼' : '▶'}
                </span>
              </div>
              
              {expandedDrivers.has(driver.id) && (() => {
                const truckloadsForDriver = getDriverTruckloads(driver.id);
                return (
                  <div className="pl-8 space-y-2">
                    {truckloadsForDriver.map((truckload) => (
                      <div
                        key={truckload.id}
                        className={`
                          p-2 text-xs rounded cursor-pointer transition-colors
                          ${selectedTruckloads.has(truckload.id) 
                            ? 'bg-gray-100 border border-gray-300' 
                            : 'bg-gray-50 hover:bg-gray-100'
                          }
                        `}
                        onClick={() => toggleTruckloadSelection(truckload.id, driver.color)}
                      >
                        <div className="font-medium">
                          #{truckload.id} - {truckload.description || 'No description'}
                        </div>
                        <div className="text-gray-600">
                          {format(parseISO(truckload.startDate), 'MM/dd')} - {format(parseISO(truckload.endDate), 'MM/dd')}
                        </div>
                        <div className="flex gap-2 mt-1">
                          <span className="text-red-500">
                            Pickup: {truckload.pickupFootage} ft²
                          </span>
                          <span className="text-gray-900">
                            Delivery: {truckload.deliveryFootage} ft²
                          </span>
                        </div>
                      </div>
                    ))}
                    {truckloadsForDriver.length === 0 && (
                      <div className="text-xs text-gray-500 italic p-2">
                        No active truckloads
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>
          ))}
        </div>
      </div>

      {/* Map + Filter Bar Container */}
      <div className="flex-1 flex flex-col">
        {/* Filter Bar */}
        <Card className="m-2 mb-0 p-2 bg-gradient-to-r from-gray-50 to-white border border-gray-200 shadow-sm flex-shrink-0">
          <div className="flex items-center gap-2 flex-wrap">
            {/* Search */}
            <div className="flex items-center gap-1.5 bg-white rounded-md px-2 py-1 border border-gray-200">
              <Search className="h-3.5 w-3.5 text-gray-500" />
              <Input
                type="text"
                placeholder="Search..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="border-0 bg-transparent text-xs h-7 w-40 focus:ring-0 focus:outline-none p-0"
              />
            </div>

            {/* View Toggles */}
            <div className="flex items-center gap-1.5 bg-white rounded-md px-2 py-1 border border-gray-200">
              <span className="text-xs font-medium text-gray-600">View:</span>
              <div className="flex items-center gap-0.5">
                <Button
                  variant={viewToggles.unassigned ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setViewToggles(prev => ({ ...prev, unassigned: !prev.unassigned }))}
                  className={`text-[10px] h-6 px-2 transition-all duration-200 ${
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
                  className={`text-[10px] h-6 px-2 transition-all duration-200 ${
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
                  className={`text-[10px] h-6 px-2 transition-all duration-200 ${
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
                  className={`text-[10px] h-6 px-2 transition-all duration-200 ${
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
                  className={`text-[10px] h-6 px-2 transition-all duration-200 ${
                    viewToggles.completed
                      ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-sm'
                      : 'bg-white hover:bg-gray-50 text-gray-700 border-gray-300'
                  }`}
                >
                  Completed
                </Button>
              </div>
            </div>

            {/* Load Type Filters */}
            <div className="flex items-center gap-1.5 bg-white rounded-md px-2 py-1 border border-gray-200">
              <span className="text-xs font-medium text-gray-600">Load Type:</span>
              <div className="flex items-center gap-1">
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
                      className={`text-[10px] h-6 px-2 transition-all duration-200 ${
                        isActive ? 'shadow-sm border-2' : 'border'
                      }`}
                      style={config ? {
                        backgroundColor: config.color,
                        color: config.textColor,
                        borderColor: isActive ? config.textColor : config.color,
                      } : {}}
                    >
                      <span className="flex items-center gap-0.5">
                        <span>{option.label}</span>
                        {count > 0 && (
                          <span
                            className={`inline-flex items-center justify-center w-3.5 h-3.5 text-[9px] rounded-full ${
                              isActive && config ? 'bg-white' : config ? 'bg-white/80' : 'bg-blue-600 text-white'
                            }`}
                            style={config ? { color: config.textColor } : {}}
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

            {/* Point Count */}
            <div className="ml-auto bg-blue-50 rounded-md px-2 py-1 border border-blue-200">
              <span className="text-xs font-medium text-blue-700">
                {filteredLocations.length} point{filteredLocations.length !== 1 ? 's' : ''}
              </span>
            </div>
          </div>
        </Card>

        {/* Map */}
        <div className="flex-1 relative m-2 mt-1">
          <MissingAddressWarning />
          <GoogleMap
            mapContainerStyle={mapContainerStyle}
            center={center}
            zoom={7}
            onLoad={onLoad}
            onUnmount={onUnmount}
            options={options}
          >
          {/* Timberline Warehouse Marker */}
          <MarkerF
            position={center}
            icon={{
              url: '/warehouse-icon.png',
              scaledSize: new window.google.maps.Size(32, 32)
            }}
            title="Timberline Warehouse"
          />

          {/* Load Markers */}
          {clusteredLoads.map((load) => {
            const isPickupUnassigned = !load.pickupAssignment?.truckloadId;
            const isDeliveryUnassigned = !load.deliveryAssignment?.truckloadId;
            const isTruckloadStop = 'source' in load && load.source === 'truckload';

            return (
              <>
                {/* Consolidated Location Marker */}
                {!isTruckloadStop && (
                  <MarkerF
                    key={`${load.id}-consolidated`}
                    position={{ lat: load.adjustedLat, lng: load.adjustedLng }}
                    icon={{
                      path: window.google.maps.SymbolPath.CIRCLE,
                      fillColor: load.hasPickup && load.hasDelivery ? '#8B0000' : load.hasPickup ? '#FF0000' : '#000000',
                      fillOpacity: 1,
                      strokeWeight: 2,
                      strokeColor: '#FFFFFF',
                      scale: 8,
                    }}
                    title={`${load.hasPickup ? 'Pickup' : ''}${load.hasPickup && load.hasDelivery ? ' & ' : ''}${load.hasDelivery ? 'Delivery' : ''} - ${load.clusterSize} stops`}
                    onClick={async () => {
                      map?.panTo({ lat: load.adjustedLat, lng: load.adjustedLng });
                      setSelectedMarkerInfo({ 
                        id: load.id, 
                        type: 'load', 
                        data: { 
                          ...load, 
                          isCluster: true,
                          clusterSize: load.clusterSize,
                          clusterItems: load.clusterItems
                        } 
                      });
                      // Fetch all truckload stops for this location
                      await fetchAllTruckloadStopsForLocation(load.adjustedLat, load.adjustedLng);
                    }}
                  />
                )}

                {/* Truckload Stop Marker */}
                {isTruckloadStop && (
                  <MarkerF
                    key={`${load.truckloadId}-${load.id}-${load.type}`}
                    position={{ lat: load.adjustedLat, lng: load.adjustedLng }}
                    icon={{
                      path: 'M -2,-2 L 2,-2 L 2,2 L -2,2 Z',
                      fillColor: load.driverColor || '#808080',
                      fillOpacity: 0.9,
                      strokeWeight: 1,
                      strokeColor: '#FFFFFF',
                      scale: 4,
                      anchor: new window.google.maps.Point(0, 0)
                    }}
                    title={`${load.type === 'pickup' ? 'Pickup' : 'Delivery'} - ${load.customerName}`}
                    onClick={async () => {
                      map?.panTo({ lat: load.adjustedLat, lng: load.adjustedLng });
                      setSelectedMarkerInfo({ 
                        id: load.id, 
                        type: 'load', 
                        data: { 
                          ...load, 
                          isCluster: true,
                          clusterSize: load.clusterSize,
                          clusterItems: load.clusterItems
                        } 
                      });
                      // Fetch all truckload stops for this location
                      await fetchAllTruckloadStopsForLocation(load.adjustedLat, load.adjustedLng);
                    }}
                  />
                )}
              </>
            );
          })}

          {/* Truckload Route Lines */}
          {Array.from(selectedTruckloads).map(truckloadId => {
            const route = truckloadRoutes[truckloadId];
            const truckload = truckloadStops[truckloadId];
            if (!route || !truckload) return null;
            return (
              <DirectionsRenderer
                key={`route-${truckloadId}`}
                directions={route}
                options={{
                  suppressMarkers: true,
                  polylineOptions: {
                    strokeColor: truckload.driverColor || '#808080',
                    strokeWeight: 3,
                    strokeOpacity: 0.7,
                    zIndex: 1,
                  },
                  markerOptions: { opacity: 0 },
                }}
              />
            );
          })}

          {/* Selected Marker InfoWindow - Dynamically rendered based on type */}
          {selectedMarkerInfo && (
            <InfoWindowF
              position={{
                lat: selectedMarkerInfo.type === 'load' 
                  ? selectedMarkerInfo.data.adjustedLat 
                  : selectedMarkerInfo.data.lat,
                lng: selectedMarkerInfo.type === 'load' 
                  ? selectedMarkerInfo.data.adjustedLng 
                  : selectedMarkerInfo.data.lng
              }}
              onCloseClick={() => {
                setSelectedMarkerInfo(null);
                setLocationTruckloadStops([]);
              }}
              options={{
                pixelOffset: new window.google.maps.Size(0, -5),
                maxWidth: 850
              }}
            >
              <div className="p-3 text-sm w-[800px]">
                {/* CASE 1: Load Cluster */}
                {selectedMarkerInfo.type === 'load' && selectedMarkerInfo.data.isCluster && (
                  <div className="space-y-3">
                    {/* Summary Header */}
                    <div className="bg-gray-50 p-2 rounded-lg border">
                      <div className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-3">
                          <div className="flex items-center gap-1">
                            <span className="w-2 h-2 rounded-full bg-red-500"></span>
                            <span className="font-medium">
                              {selectedMarkerInfo.data.clusterItems.filter((item: any) => !item.source && 
                                item.type === 'pickup' && !item.pickupAssignment).length} Pickups
                            </span>
                          </div>
                          <div className="flex items-center gap-1">
                            <span className="w-2 h-2 rounded-full bg-black"></span>
                            <span className="font-medium">
                              {selectedMarkerInfo.data.clusterItems.filter((item: any) => !item.source && 
                                item.type === 'delivery' && !item.deliveryAssignment).length} Deliveries
                            </span>
                          </div>
                          <div className="text-gray-500">
                            {locationTruckloadStops.length} Assigned
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="font-medium text-gray-900 truncate max-w-[200px]" title={
                            selectedMarkerInfo.data.clusterItems[0]?.pickupCustomer?.name || 
                            selectedMarkerInfo.data.clusterItems[0]?.deliveryCustomer?.name || 
                            'Unknown Customer'
                          }>
                            {selectedMarkerInfo.data.clusterItems[0]?.pickupCustomer?.name || 
                             selectedMarkerInfo.data.clusterItems[0]?.deliveryCustomer?.name || 
                             'Unknown Customer'}
                          </div>
                          <div className="text-gray-600 truncate max-w-[200px]" title={
                            selectedMarkerInfo.data.clusterItems[0]?.pickupCustomer?.address || 
                            selectedMarkerInfo.data.clusterItems[0]?.deliveryCustomer?.address || 
                            'Address not available'
                          }>
                            {selectedMarkerInfo.data.clusterItems[0]?.pickupCustomer?.address || 
                             selectedMarkerInfo.data.clusterItems[0]?.deliveryCustomer?.address || 
                             'Address not available'}
                          </div>
                        </div>
                      </div>
                    </div>
                    
                                         {/* Unassigned stops section */}
                     <div className="mb-3">
                       <div className="text-sm font-medium text-gray-600 mb-2">Unassigned Stops</div>
                       <div>
                        {selectedMarkerInfo.data.clusterItems.filter((item: any) => !item.source && 
                          ((item.type === 'pickup' && !item.pickupAssignment) || 
                           (item.type === 'delivery' && !item.deliveryAssignment))).length > 0 ? (
                          <div className="space-y-1">
                            {selectedMarkerInfo.data.clusterItems
                              .filter((item: any) => !item.source && 
                                ((item.type === 'pickup' && !item.pickupAssignment) || 
                                 (item.type === 'delivery' && !item.deliveryAssignment)))
                              .sort((a: any, b: any) => {
                                const dateA = a.pickupDate ? new Date(a.pickupDate) : new Date(0);
                                const dateB = b.pickupDate ? new Date(b.pickupDate) : new Date(0);
                                return dateA.getTime() - dateB.getTime(); // Oldest first
                              })
                              .map((item: any, index: number) => {
                                const isSelected = selectedLocations.some(
                                  loc => loc.id === item.id && loc.type === item.type
                                );
                                
                                // Get order details from the item
                                const pickupCustomer = item.pickupCustomer?.name || 'N/A';
                                const deliveryCustomer = item.deliveryCustomer?.name || 'N/A';
                                const pickupDate = item.pickupDate ? format(parseISO(item.pickupDate), 'MM/dd/yy') : 'N/A';
                                const totalFootage = item.footage || 0;
                                
                                return (
                                  <div 
                                    key={`${item.id}-${item.type}-${index}`} 
                                    className={`rounded-md p-2 border ${
                                      item.type === 'pickup' 
                                        ? 'bg-red-50 border-red-200' 
                                        : 'bg-gray-50 border-gray-200'
                                    }`}
                                  >
                                    <div className="flex items-center justify-between">
                                      <div className="flex items-center gap-3 flex-1">
                                        <div className="flex items-center gap-2 min-w-[80px]">
                                          <span 
                                            className="w-2 h-2 rounded-full inline-block" 
                                            style={{ 
                                              backgroundColor: item.type === 'pickup' ? '#FF0000' : '#000000'
                                            }}
                                          />
                                          <span className="font-medium text-xs">
                                            {item.type === 'pickup' ? 'Pickup' : 'Delivery'}
                                          </span>
                                        </div>
                                        
                                        <div className="flex items-center gap-6 flex-1">
                                          <div className="flex items-center gap-2 min-w-[120px]">
                                            <span className="text-gray-600 text-xs">Pickup:</span>
                                            <span className="font-medium text-xs truncate max-w-[100px]" title={pickupCustomer}>{pickupCustomer}</span>
                                          </div>
                                          <div className="flex items-center gap-2 min-w-[120px]">
                                            <span className="text-gray-600 text-xs">Delivery:</span>
                                            <span className="font-medium text-xs truncate max-w-[100px]" title={deliveryCustomer}>{deliveryCustomer}</span>
                                          </div>
                                          <div className="flex items-center gap-2 min-w-[80px]">
                                            <span className="text-gray-600 text-xs">Date:</span>
                                            <span className="font-medium text-xs">{pickupDate}</span>
                                          </div>
                                          <div className="flex items-center gap-2 min-w-[80px]">
                                            <span className="text-gray-600 text-xs">Footage:</span>
                                            <span className="font-medium text-xs">{totalFootage} ft²</span>
                                          </div>
                                        </div>
                                      </div>
                                      
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          toggleLocationSelection({ ...item, type: item.type });
                                        }}
                                        className={`text-xs px-2 py-1 rounded ml-2 flex-shrink-0 ${
                                          isSelected 
                                            ? 'bg-blue-500 text-white hover:bg-blue-600' 
                                            : 'bg-gray-200 hover:bg-gray-300 text-gray-800'
                                        }`}
                                      >
                                        {isSelected ? 'Selected' : 'Select'}
                                      </button>
                                    </div>
                                  </div>
                                );
                              })}
                          </div>
                        ) : (
                          <div className="text-sm text-gray-500 italic">No unassigned stops at this location</div>
                        )}
                      </div>
                    </div>

                                         {/* Assigned truckload stops section */}
                     <div>
                       <div className="text-sm font-medium text-gray-600 mb-2">Assigned to Truckloads</div>
                       <div>
                        {locationTruckloadStops.length > 0 ? (
                          <div className="space-y-1">
                            {locationTruckloadStops
                              .sort((a: any, b: any) => {
                                const dateA = a.pickupDate ? new Date(a.pickupDate) : new Date(0);
                                const dateB = b.pickupDate ? new Date(b.pickupDate) : new Date(0);
                                return dateA.getTime() - dateB.getTime(); // Oldest first
                              })
                              .map((item: any, index: number) => {
                                // Convert hex color to RGB for opacity
                                const hexToRgb = (hex: string) => {
                                  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
                                  return result ? {
                                    r: parseInt(result[1], 16),
                                    g: parseInt(result[2], 16),
                                    b: parseInt(result[3], 16)
                                  } : null;
                                };

                                const rgb = hexToRgb(item.driverColor || '#808080');
                                const bgColor = rgb 
                                  ? `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.15)` 
                                  : 'rgba(128, 128, 128, 0.15)';
                                const borderColor = rgb 
                                  ? `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.3)` 
                                  : 'rgba(128, 128, 128, 0.3)';

                                // Get order details from the item
                                const pickupCustomer = item.pickupCustomer?.name || 'N/A';
                                const deliveryCustomer = item.deliveryCustomer?.name || 'N/A';
                                const pickupDate = item.pickupDate ? format(parseISO(item.pickupDate), 'MM/dd/yy') : 'N/A';
                                const totalFootage = item.footage || 0;
                                
                                return (
                                  <div 
                                    key={`${item.id}-${item.type}-${index}`} 
                                    className={`rounded-md p-2 border ${
                                      item.type === 'pickup' 
                                        ? 'bg-red-50 border-red-200' 
                                        : 'bg-gray-50 border-gray-200'
                                    }`}
                                  >
                                    <div className="flex items-center justify-between">
                                      <div className="flex items-center gap-3 flex-1">
                                        <div className="flex items-center gap-2 min-w-[140px]">
                                          <span 
                                            className="w-2 h-2 rounded-full inline-block" 
                                            style={{ backgroundColor: item.driverColor }}
                                          />
                                          <span 
                                            className="font-medium text-xs"
                                            style={{ color: item.driverColor }}
                                          >
                                            {item.driverName || 'Unknown Driver'} {item.startDate && item.endDate 
                                              ? `${format(parseISO(item.startDate), 'MM/dd')} - ${format(parseISO(item.endDate), 'MM/dd')}`
                                              : ''
                                            }
                                          </span>
                                        </div>
                                        
                                        <div className="flex items-center gap-6 flex-1">
                                          <div className="flex items-center gap-2 min-w-[120px]">
                                            <span className="text-gray-600 text-xs">Pickup:</span>
                                            <span className="font-medium text-xs truncate max-w-[100px]" title={pickupCustomer}>{pickupCustomer}</span>
                                          </div>
                                          <div className="flex items-center gap-2 min-w-[120px]">
                                            <span className="text-gray-600 text-xs">Delivery:</span>
                                            <span className="font-medium text-xs truncate max-w-[100px]" title={deliveryCustomer}>{deliveryCustomer}</span>
                                          </div>
                                          <div className="flex items-center gap-2 min-w-[80px]">
                                            <span className="text-gray-600 text-xs">Date:</span>
                                            <span className="font-medium text-xs">{pickupDate}</span>
                                          </div>
                                          <div className="flex items-center gap-2 min-w-[80px]">
                                            <span className="text-gray-600 text-xs">Footage:</span>
                                            <span className="font-medium text-xs">{totalFootage} ft²</span>
                                          </div>
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                );
                              })}
                          </div>
                        ) : (
                          <div className="text-sm text-gray-500 italic">No assigned stops at this location</div>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* CASE 2: Single Load Location */}
                {selectedMarkerInfo.type === 'load' && !selectedMarkerInfo.data.isCluster && (
                  <div className="space-y-3">
                    <div>
                      <div className="flex items-center justify-between">
                        <div className="font-medium text-base">{selectedMarkerInfo.data.type === 'pickup' ? 'Pickup' : 'Delivery'}</div>
                        {/* Check if already selected and show appropriate button */}
                        {(() => {
                          const isSelected = selectedLocations.some(
                            loc => loc.id === selectedMarkerInfo.data.id && loc.type === selectedMarkerInfo.data.type
                          );
                          
                          return (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleLocationSelection(selectedMarkerInfo.data);
                              }}
                              className={`text-xs px-2 py-1 rounded ${
                                isSelected 
                                  ? 'bg-blue-500 text-white hover:bg-blue-600' 
                                  : 'bg-gray-200 hover:bg-gray-300 text-gray-800'
                              }`}
                            >
                              {isSelected ? 'Selected' : 'Select'}
                            </button>
                          );
                        })()}
                      </div>
                      <div className="text-gray-700 font-medium mt-1">{selectedMarkerInfo.data.customerName}</div>
                      <div className="mt-2">
                        <span className="text-gray-600 font-medium">Status:</span> 
                        <span className={selectedMarkerInfo.data.type === 'pickup' 
                          ? (selectedMarkerInfo.data.pickupAssignment ? 'text-green-600' : 'text-red-600')
                          : (selectedMarkerInfo.data.deliveryAssignment ? 'text-green-600' : 'text-red-600')
                        }>
                          {selectedMarkerInfo.data.type === 'pickup' 
                            ? (selectedMarkerInfo.data.pickupAssignment 
                                ? ` Assigned to ${selectedMarkerInfo.data.pickupAssignment.driverName}` 
                                : ' Unassigned') 
                            : (selectedMarkerInfo.data.deliveryAssignment 
                                ? ` Assigned to ${selectedMarkerInfo.data.deliveryAssignment.driverName}` 
                                : ' Unassigned')
                          }
                        </span>
                      </div>
                      {selectedMarkerInfo.data.pickupDate && (
                        <div className="mt-1">
                          <span className="text-gray-600 font-medium">Pickup:</span> {format(parseISO(selectedMarkerInfo.data.pickupDate), 'MM/dd/yy')}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* CASE 3: Truckload Cluster */}
                {selectedMarkerInfo.type === 'truckload' && selectedMarkerInfo.data.isCluster && (
                  <div className="space-y-3">
                    <div className="font-medium border-b pb-2 text-base">
                      {selectedMarkerInfo.data.clusterSize} Truckload Stops
                    </div>
                    <div className="max-h-52 overflow-y-auto">
                      {selectedMarkerInfo.data.clusterItems.map((item: any, index: number) => (
                        <div key={`${item.id}-${item.type}-${index}`} className="border-b border-gray-100 py-2 last:border-0">
                          <div className="font-medium">
                            Truckload #{selectedMarkerInfo.data.truckloadId}
                          </div>
                          <div className="text-sm flex items-center gap-1 mt-1">
                            <span 
                              className="w-2 h-2 rounded-full inline-block" 
                              style={{ backgroundColor: selectedMarkerInfo.data.driverColor }}
                            />
                            {item.type === 'pickup' ? 'Pickup' : 'Delivery'}: {item.customerName}
                          </div>
                          {item.pickupDate && (
                            <div className="text-xs text-gray-500 mt-1">
                              Pickup Date: {format(parseISO(item.pickupDate), 'MM/dd/yy')}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* CASE 4: Single Truckload Stop */}
                {selectedMarkerInfo.type === 'truckload' && !selectedMarkerInfo.data.isCluster && (
                  <div className="space-y-3">
                    <div>
                      <div className="font-medium text-base">
                        Truckload #{selectedMarkerInfo.data.truckloadId}
                      </div>
                      <div className="text-gray-700 font-medium mt-1">{selectedMarkerInfo.data.customerName}</div>
                      <div className="mt-2">
                        <span className="text-gray-600 font-medium">Type:</span> {selectedMarkerInfo.data.assignmentType}
                      </div>
                      <div className="mt-1">
                        <span className="text-gray-600 font-medium">Footage:</span> {selectedMarkerInfo.data.footage} ft²
                      </div>
                      {selectedMarkerInfo.data.pickupDate && (
                        <div className="mt-1">
                          <span className="text-gray-600 font-medium">Pickup:</span> {format(parseISO(selectedMarkerInfo.data.pickupDate), 'MM/dd/yy')}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </InfoWindowF>
          )}
        </GoogleMap>

          {/* Selected Locations Overlay */}
          {selectedLocations.length > 0 && (
            <Card className="absolute top-4 right-4 w-96 max-h-[calc(100vh-14rem)] overflow-y-auto bg-white/95 shadow-lg p-3 z-10">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-medium">Selected ({selectedLocations.length})</h3>
                <button 
                  onClick={clearSelection}
                  className="text-gray-500 hover:text-gray-700"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="space-y-2">
                {selectedLocations.map((location) => (
                  <div 
                    key={`${location.id}-${location.type}`} 
                    className="flex items-center justify-between p-2 rounded-md bg-gray-50"
                  >
                    <div className="flex items-center gap-2">
                      <Badge 
                        variant={location.type === 'pickup' ? 'destructive' : 'default'}
                        className="text-xs"
                      >
                        {location.type === 'pickup' ? 'Pickup' : 'Delivery'}
                      </Badge>
                      <span className="text-sm font-medium truncate max-w-[240px]">{location.customerName}</span>
                    </div>
                    <button 
                      onClick={() => toggleLocationSelection(location)}
                      className="text-gray-500 hover:text-gray-700 flex-shrink-0"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
              
              <Button 
                className="w-full mt-2"
                onClick={() => setIsAssignDialogOpen(true)}
              >
                <Truck className="h-4 w-4 mr-2" />
                Assign to Truckload
              </Button>
            </Card>
          )}

          {/* Assignment Dialog */}
          <AssignStopsDialog
            isOpen={isAssignDialogOpen}
            onClose={() => setIsAssignDialogOpen(false)}
            selectedLocations={selectedLocations}
            onAssignmentComplete={handleAssignmentComplete}
          />
        </div>
      </div>
    </div>
  );
}