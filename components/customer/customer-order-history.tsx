"use client"

import { useState, useEffect } from "react"
import { Package, AlertTriangle, Zap, MessageSquare, Truck } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { format, parseISO } from "date-fns"

interface OrderAssignment {
  driverName: string
  driverColor: string
  truckloadId: number
  startDate: string | null
  endDate: string | null
}

interface LoadFilters {
  ohioToIndiana: boolean
  backhaul: boolean
  localFlatbed: boolean
  rrOrder: boolean
  localSemi: boolean
  middlefield: boolean
  paNy: boolean
}

interface OrderHistoryItem {
  id: number
  status: string
  pickup_date: string | null
  comments: string | null
  is_rush: boolean
  needs_attention: boolean
  freight_quote: string | null
  created_at: string
  updated_at: string
  creator: string
  filters: LoadFilters
  customer_role: "pickup" | "delivery" | "paying" | "both"
  pickup_customer: { id: number; name: string }
  delivery_customer: { id: number; name: string }
  skids: number
  vinyl: number
  footage: number
  pickup_assignment: OrderAssignment | null
  delivery_assignment: OrderAssignment | null
}

interface CustomerOrderHistoryProps {
  customerId: number
}

const FILTER_LABELS: Record<keyof LoadFilters, string> = {
  ohioToIndiana: "OH→IN",
  backhaul: "Backhaul",
  localFlatbed: "Flatbed",
  rrOrder: "RNR",
  localSemi: "Semi",
  middlefield: "Middlefield",
  paNy: "PA/NY",
}

function getStatusBadge(status: string) {
  switch (status) {
    case "unassigned":
      return <Badge variant="secondary" className="text-[10px] px-1.5 py-0">Unassigned</Badge>
    case "completed":
      return <Badge className="text-[10px] px-1.5 py-0 bg-green-100 text-green-800 hover:bg-green-100">Completed</Badge>
    default:
      return <Badge variant="outline" className="text-[10px] px-1.5 py-0">{status}</Badge>
  }
}

function formatDateShort(dateString: string | null): string {
  if (!dateString) return "—"
  try {
    return format(parseISO(dateString), "M/d/yy")
  } catch {
    return dateString
  }
}

function formatDateFull(dateString: string | null): string {
  if (!dateString) return "—"
  try {
    return format(parseISO(dateString), "MMM d, yyyy h:mm a")
  } catch {
    return dateString
  }
}

function buildFreightParts(order: OrderHistoryItem): string[] {
  const parts: string[] = []
  if (order.skids > 0) parts.push(`${order.skids}S`)
  if (order.vinyl > 0) parts.push(`${order.vinyl}V`)
  if (order.footage > 0) parts.push(`${Number(order.footage).toLocaleString()}ft²`)
  return parts
}

function getActiveFilters(filters: LoadFilters): string[] {
  return (Object.entries(filters) as [keyof LoadFilters, boolean][])
    .filter(([, active]) => active)
    .map(([key]) => FILTER_LABELS[key])
}

function TruckAssignmentIcon({ assignment, type }: { assignment: OrderAssignment | null; type: "pickup" | "delivery" }) {
  if (!assignment) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="inline-flex">
            <Truck className={`h-3.5 w-3.5 ${type === "pickup" ? "text-red-200" : "text-gray-200"}`} />
          </span>
        </TooltipTrigger>
        <TooltipContent side="top" className="text-xs">
          <p>No {type} assignment</p>
        </TooltipContent>
      </Tooltip>
    )
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="inline-flex">
          <Truck
            className={`h-3.5 w-3.5 ${type === "pickup" ? "text-red-600" : "text-gray-800"}`}
            style={{ filter: `drop-shadow(0 0 1px ${assignment.driverColor || "#808080"})` }}
          />
        </span>
      </TooltipTrigger>
      <TooltipContent side="top" className="text-xs space-y-1 max-w-[200px]">
        <p className="font-semibold capitalize">{type} Assignment</p>
        <div className="flex items-center gap-1.5">
          <div
            className="w-2 h-2 rounded-full flex-shrink-0"
            style={{ backgroundColor: assignment.driverColor || "#808080" }}
          />
          <span>{assignment.driverName}</span>
        </div>
        <p className="text-muted-foreground">Load #{assignment.truckloadId}</p>
        {assignment.startDate && assignment.endDate && (
          <p className="text-muted-foreground">
            {formatDateShort(assignment.startDate)} – {formatDateShort(assignment.endDate)}
          </p>
        )}
      </TooltipContent>
    </Tooltip>
  )
}

export function CustomerOrderHistory({ customerId }: CustomerOrderHistoryProps) {
  const [orders, setOrders] = useState<OrderHistoryItem[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [hasError, setHasError] = useState(false)

  useEffect(() => {
    async function fetchOrders() {
      try {
        setIsLoading(true)
        setHasError(false)
        const response = await fetch(`/api/customers/${customerId}/orders`)
        if (!response.ok) throw new Error("Failed to fetch orders")
        const data = await response.json()
        setOrders(data)
      } catch (error) {
        console.error("Error fetching customer orders:", error)
        setHasError(true)
      } finally {
        setIsLoading(false)
      }
    }

    if (customerId) {
      fetchOrders()
    }
  }, [customerId])

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-6 text-muted-foreground">
        <Package className="h-4 w-4 animate-pulse mr-2" />
        <span className="text-sm">Loading order history...</span>
      </div>
    )
  }

  if (hasError) {
    return (
      <div className="text-center p-6 text-red-600">
        <AlertTriangle className="mx-auto mb-1 h-5 w-5" />
        <p className="text-sm">Failed to load order history.</p>
      </div>
    )
  }

  if (orders.length === 0) {
    return (
      <div className="text-center p-6 text-muted-foreground">
        <Package className="mx-auto mb-1 h-6 w-6" />
        <p className="text-sm">No orders found for this customer.</p>
      </div>
    )
  }

  const activeOrders = orders.filter((o) => o.status !== "completed")
  const completedOrders = orders.filter((o) => o.status === "completed")

  return (
    <TooltipProvider delayDuration={200}>
      <div className="space-y-3">
        <div className="flex items-center justify-between px-1">
          <p className="text-xs text-muted-foreground">
            {orders.length} order{orders.length !== 1 ? "s" : ""}
            {activeOrders.length > 0 && <span className="text-foreground font-medium"> · {activeOrders.length} active</span>}
            {completedOrders.length > 0 && ` · ${completedOrders.length} completed`}
          </p>
        </div>

        <div className="rounded-md border overflow-auto">
          <Table>
            <TableHeader>
              <TableRow className="[&>th]:py-1.5 [&>th]:text-[11px] [&>th]:font-semibold">
                <TableHead className="w-[70px]">Created</TableHead>
                <TableHead className="w-[42px]">#</TableHead>
                <TableHead>Pickup Customer</TableHead>
                <TableHead>Delivery Customer</TableHead>
                <TableHead className="w-[72px]">Status</TableHead>
                <TableHead className="w-[62px]">Pickup</TableHead>
                <TableHead className="w-[68px]">Freight</TableHead>
                <TableHead className="w-[34px] text-center px-1">
                  <Tooltip>
                    <TooltipTrigger asChild><span className="cursor-default text-red-600">P</span></TooltipTrigger>
                    <TooltipContent side="top" className="text-xs">Pickup Truck</TooltipContent>
                  </Tooltip>
                </TableHead>
                <TableHead className="w-[34px] text-center px-1">
                  <Tooltip>
                    <TooltipTrigger asChild><span className="cursor-default">D</span></TooltipTrigger>
                    <TooltipContent side="top" className="text-xs">Delivery Truck</TooltipContent>
                  </Tooltip>
                </TableHead>
                <TableHead>Load Type</TableHead>
                <TableHead className="w-[30px] text-center px-0"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {orders.map((order) => {
                const freightParts = buildFreightParts(order)
                const activeFilters = getActiveFilters(order.filters)
                const isCompleted = order.status === "completed"

                return (
                  <TableRow
                    key={order.id}
                    className={`[&>td]:py-1.5 [&>td]:text-xs ${isCompleted ? "opacity-50" : ""}`}
                  >
                    {/* Created Date */}
                    <TableCell>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="text-muted-foreground cursor-default tabular-nums">
                            {formatDateShort(order.created_at)}
                          </span>
                        </TooltipTrigger>
                        <TooltipContent side="top" className="text-xs space-y-1">
                          <p><span className="font-medium">Created:</span> {formatDateFull(order.created_at)}</p>
                          <p><span className="font-medium">By:</span> {order.creator}</p>
                          {isCompleted && (
                            <p><span className="font-medium">Completed:</span> {formatDateFull(order.updated_at)}</p>
                          )}
                        </TooltipContent>
                      </Tooltip>
                    </TableCell>

                    {/* Order # */}
                    <TableCell className="font-medium tabular-nums">{order.id}</TableCell>

                    {/* Pickup Customer */}
                    <TableCell className="truncate max-w-[120px] text-red-700">
                      {order.pickup_customer?.name || "—"}
                    </TableCell>

                    {/* Delivery Customer */}
                    <TableCell className="truncate max-w-[120px]">
                      {order.delivery_customer?.name || "—"}
                    </TableCell>

                    {/* Status */}
                    <TableCell>{getStatusBadge(order.status)}</TableCell>

                    {/* Pickup Date */}
                    <TableCell className="tabular-nums">
                      {formatDateShort(order.pickup_date)}
                    </TableCell>

                    {/* Freight */}
                    <TableCell>
                      {freightParts.length > 0 ? (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className="text-muted-foreground cursor-default truncate block max-w-[65px]">
                              {freightParts.join(" · ")}
                            </span>
                          </TooltipTrigger>
                          <TooltipContent side="top" className="text-xs">
                            {order.skids > 0 && <p>{order.skids} skid{order.skids !== 1 ? "s" : ""}</p>}
                            {order.vinyl > 0 && <p>{order.vinyl} vinyl</p>}
                            {order.footage > 0 && <p>{Number(order.footage).toLocaleString()} sq ft</p>}
                            {order.freight_quote && <p className="mt-1 text-muted-foreground">Quote: {order.freight_quote}</p>}
                          </TooltipContent>
                        </Tooltip>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>

                    {/* Pickup Truck */}
                    <TableCell className="text-center px-1">
                      <TruckAssignmentIcon assignment={order.pickup_assignment} type="pickup" />
                    </TableCell>

                    {/* Delivery Truck */}
                    <TableCell className="text-center px-1">
                      <TruckAssignmentIcon assignment={order.delivery_assignment} type="delivery" />
                    </TableCell>

                    {/* Load Types */}
                    <TableCell>
                      {activeFilters.length > 0 ? (
                        <div className="flex flex-wrap gap-0.5">
                          {activeFilters.map((label) => (
                            <Badge
                              key={label}
                              variant="outline"
                              className="text-[9px] px-1 py-0 leading-tight font-normal"
                            >
                              {label}
                            </Badge>
                          ))}
                        </div>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>

                    {/* Flags */}
                    <TableCell className="px-0">
                      <div className="flex items-center justify-center gap-0.5">
                        {order.is_rush && <span title="Rush"><Zap className="h-3 w-3 text-red-500" /></span>}
                        {order.needs_attention && <span title="Attention"><AlertTriangle className="h-3 w-3 text-amber-500" /></span>}
                        {order.comments && <span title="Comments"><MessageSquare className="h-3 w-3 text-blue-500" /></span>}
                      </div>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
      </div>
    </TooltipProvider>
  )
}
