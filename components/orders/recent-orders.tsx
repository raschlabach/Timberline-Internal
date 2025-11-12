import { useEffect, useState, useCallback } from 'react';
import { format } from 'date-fns';
import { ScrollArea } from "@/components/ui/scroll-area";
import { OrderFormState } from '@/types/orders';

interface RecentOrder {
  id: string;
  pickupCustomer: {
    id: number;
    name: string;
    address: string;
  };
  deliveryCustomer: {
    id: number;
    name: string;
    address: string;
  };
  payingCustomer?: {
    id: number;
    name: string;
  } | null;
  skids: number;
  vinyl: number;
  footage: number;
  handBundles: number;
  skidsData: Array<{
    id: number;
    type: string;
    width: number;
    length: number;
    footage: number;
    quantity: number;
  }>;
  vinylData: Array<{
    id: number;
    type: string;
    width: number;
    length: number;
    footage: number;
    quantity: number;
  }>;
  handBundlesData: Array<{
    id: string;
    quantity: number;
    description: string;
  }>;
  pickupDate: string;
  isRushOrder: boolean;
  needsAttention: boolean;
  comments: string;
  freightQuote?: string;
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
}

interface RecentOrdersProps {
  onSelectOrder: (formState: Partial<OrderFormState>) => void;
}

// Custom hook for managing orders with auto-refresh
function useRecentOrders() {
  const [orders, setOrders] = useState<RecentOrder[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<string | null>(null);

  const fetchOrders = useCallback(async () => {
    try {
      const response = await fetch('/api/orders/recent');
      if (!response.ok) throw new Error('Failed to fetch recent orders');
      const data = await response.json();
      
      // Only update if we have new data
      if (JSON.stringify(data) !== JSON.stringify(orders)) {
        setOrders(data);
        setLastUpdate(new Date().toISOString());
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load recent orders');
    } finally {
      setIsLoading(false);
    }
  }, [orders]);

  // Initial fetch
  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  // Set up polling every 30 seconds
  useEffect(() => {
    const intervalId = setInterval(() => {
      fetchOrders();
    }, 30000); // 30 seconds

    return () => clearInterval(intervalId);
  }, [fetchOrders]);

  return { orders, isLoading, error, lastUpdate, refresh: fetchOrders };
}

export function RecentOrders({ onSelectOrder }: RecentOrdersProps) {
  const { orders, isLoading, error, refresh } = useRecentOrders();

  // Set up event listener for order creation
  useEffect(() => {
    const handleOrderCreated = () => {
      refresh();
    };

    window.addEventListener('orderCreated', handleOrderCreated);
    return () => window.removeEventListener('orderCreated', handleOrderCreated);
  }, [refresh]);

  const handleOrderClick = (order: RecentOrder) => {
    // Combine skids and vinyl data into the format expected by the form
    const skidsVinyl = [
      ...order.skidsData.map((skid, index) => ({
        id: String(skid.id),
        type: 'skid' as const,
        number: index + 1,
        width: skid.width,
        length: skid.length,
        footage: skid.footage,
        quantity: skid.quantity,
      })),
      ...order.vinylData.map((vinyl, index) => ({
        id: String(vinyl.id),
        type: 'vinyl' as const,
        number: index + 1,
        width: vinyl.width,
        length: vinyl.length,
        footage: vinyl.footage,
        quantity: vinyl.quantity,
      }))
    ];

    // Convert the order data to form state format
    const formState: Partial<OrderFormState> = {
      pickupCustomer: {
        id: order.pickupCustomer.id,
        customer_name: order.pickupCustomer.name,
        address: order.pickupCustomer.address,
      } as any, // Using any here as we don't have all Customer fields
      deliveryCustomer: {
        id: order.deliveryCustomer.id,
        customer_name: order.deliveryCustomer.name,
        address: order.deliveryCustomer.address,
      } as any,
      payingCustomer: order.payingCustomer ? {
        id: order.payingCustomer.id,
        customer_name: order.payingCustomer.name,
      } as any : null,
      filters: order.filters,
      freightType: skidsVinyl.length > 0 ? 'skidsVinyl' : 'footage',
      skidsVinyl: skidsVinyl,
      footage: order.footage,
      handBundles: order.handBundlesData || [],
      comments: order.comments || '',
      freightQuote: order.freightQuote || '',
      statusFlags: {
        rushOrder: order.isRushOrder,
        needsAttention: order.needsAttention,
      },
      links: order.links,
    };

    console.log('Loading recent order with skids/vinyl:', skidsVinyl);
    onSelectOrder(formState);
  };

  if (isLoading) {
    return <div className="text-sm text-muted-foreground p-4">Loading recent orders...</div>;
  }

  if (error) {
    return <div className="text-sm text-red-500 p-4">{error}</div>;
  }

  return (
    <ScrollArea className="h-full">
      <div className="divide-y divide-slate-200">
        {orders.length === 0 ? (
          <div className="p-4 text-center">
            <div className="text-slate-400 mb-2">
              <svg className="w-8 h-8 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
            </div>
            <p className="text-sm text-muted-foreground">No recent orders found</p>
            <p className="text-xs text-slate-400 mt-1">Recent orders will appear here as you create them</p>
          </div>
        ) : (
          orders.map((order) => (
            <button
              key={order.id}
              onClick={() => handleOrderClick(order)}
              className="w-full text-left px-3 py-2 hover:bg-slate-50 transition-colors group border-l-2 border-l-transparent hover:border-l-primary"
            >
              <div className="flex items-center justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <div className="flex items-center gap-1 text-sm">
                      <span className="font-medium text-slate-900 truncate">{order.pickupCustomer.name}</span>
                      <span className="text-slate-400 shrink-0">→</span>
                      <span className="font-medium text-slate-900 truncate">{order.deliveryCustomer.name}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      {order.isRushOrder && (
                        <span className="text-[10px] bg-red-100 text-red-600 px-1.5 py-0.5 rounded-full font-medium">RUSH</span>
                      )}
                      {order.needsAttention && (
                        <span className="text-[10px] bg-amber-100 text-amber-600 px-1.5 py-0.5 rounded-full font-medium">ATTENTION</span>
                      )}
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-3 text-xs text-slate-600">
                    <span className="flex items-center gap-1">
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      {format(new Date(order.pickupDate), 'MMM dd')}
                    </span>
                    
                    {order.footage > 0 ? (
                      <span>{order.footage} ft²</span>
                    ) : (
                      <>
                        {order.skids > 0 && (
                          <span>{order.skids} skids</span>
                        )}
                        {order.skids > 0 && (order.vinyl > 0 || order.handBundles > 0) && (
                          <span>•</span>
                        )}
                        {order.vinyl > 0 && (
                          <span>{order.vinyl} vinyl</span>
                        )}
                        {order.vinyl > 0 && order.handBundles > 0 && (
                          <span>•</span>
                        )}
                        {order.handBundles > 0 && (
                          <span className="font-bold text-blue-600 bg-blue-50 px-1 rounded text-xs">{order.handBundles} HB</span>
                        )}
                      </>
                    )}
                    
                    {order.freightQuote && (
                      <span className="text-green-600 font-medium">${order.freightQuote}</span>
                    )}
                  </div>
                  
                  {order.payingCustomer && (
                    <div className="mt-1 text-xs text-blue-600">
                      Pays: {order.payingCustomer.name}
                    </div>
                  )}
                  
                  {order.comments && (
                    <div className="mt-1 text-xs text-slate-500 italic truncate">
                      "{order.comments}"
                    </div>
                  )}
                </div>
                
                <div className="opacity-0 group-hover:opacity-100 transition-opacity ml-2 shrink-0">
                  <div className="text-[10px] text-primary uppercase tracking-wider font-medium bg-primary/10 px-2 py-1 rounded">
                    Load
                  </div>
                </div>
              </div>
            </button>
          ))
        )}
      </div>
    </ScrollArea>
  );
} 