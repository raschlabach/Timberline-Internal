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
      freightType: order.footage > 0 ? 'footage' : 'skidsVinyl',
      skidsVinyl: [], // This will be populated from the API
      footage: order.footage,
      comments: order.comments,
      freightQuote: order.freightQuote || '',
      statusFlags: {
        rushOrder: order.isRushOrder,
        needsAttention: order.needsAttention,
      },
      links: order.links,
    };

    onSelectOrder(formState);
  };

  if (isLoading) {
    return <div className="text-sm text-muted-foreground p-4">Loading recent orders...</div>;
  }

  if (error) {
    return <div className="text-sm text-red-500 p-4">{error}</div>;
  }

  return (
    <ScrollArea className="h-[600px]">
      <div className="divide-y divide-slate-200">
        {orders.map((order) => (
          <button
            key={order.id}
            onClick={() => handleOrderClick(order)}
            className="w-full text-left px-3 py-1.5 hover:bg-slate-100 transition-colors group border-l-2 border-l-transparent hover:border-l-primary"
          >
            <div className="flex items-center justify-between gap-2">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1 text-sm">
                  <span className="font-medium truncate">{order.pickupCustomer.name}</span>
                  <span className="text-slate-400 shrink-0">→</span>
                  <span className="font-medium truncate">{order.deliveryCustomer.name}</span>
                </div>
                <div className="flex items-center gap-2 text-xs text-slate-500">
                  <span>{format(new Date(order.pickupDate), 'MM/dd/yy')}</span>
                  <span className="text-slate-300">•</span>
                  {order.footage > 0 ? (
                    <span>{order.footage} ft²</span>
                  ) : (
                    <>
                      {order.skids > 0 && (
                        <span>{order.skids} skids</span>
                      )}
                      {order.skids > 0 && order.vinyl > 0 && (
                        <span className="text-slate-300">•</span>
                      )}
                      {order.vinyl > 0 && (
                        <span>{order.vinyl} vinyl</span>
                      )}
                    </>
                  )}
                  {order.isRushOrder && (
                    <>
                      <span className="text-slate-300">•</span>
                      <span className="text-red-500 font-medium">RUSH</span>
                    </>
                  )}
                  {order.needsAttention && (
                    <>
                      <span className="text-slate-300">•</span>
                      <span className="text-amber-500 font-medium">ATTENTION</span>
                    </>
                  )}
                </div>
              </div>
              <div className="opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                <span className="text-[10px] text-primary uppercase tracking-wider font-medium">Load</span>
              </div>
            </div>
          </button>
        ))}
      </div>
    </ScrollArea>
  );
} 