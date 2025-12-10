"use client";

import { FilterToggle } from "./filter-toggle";
import { StatusFlagsProps } from "@/types/orders";

export function StatusFlags({
  rushOrder,
  needsAttention,
  unloadEnRoute,
  onRushOrderChange,
  onNeedsAttentionChange,
  onUnloadEnRouteChange,
}: StatusFlagsProps) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <FilterToggle
          label="Rush Order"
          checked={rushOrder}
          onCheckedChange={onRushOrderChange}
        />
        <FilterToggle
          label="Needs Attention"
          checked={needsAttention}
          onCheckedChange={onNeedsAttentionChange}
        />
        <FilterToggle
          label="En Route Unload"
          checked={unloadEnRoute}
          onCheckedChange={onUnloadEnRouteChange}
        />
      </div>
      <div className="text-sm text-muted-foreground">
        <p>
          <strong>Rush Order</strong>: Mark this order as urgent for priority handling
        </p>
        <p>
          <strong>Needs Attention</strong>: Flag this order as requiring special attention
        </p>
        <p>
          <strong>En Route Unload</strong>: Unload this order while en route
        </p>
      </div>
    </div>
  );
} 