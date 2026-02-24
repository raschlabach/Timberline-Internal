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
import { format, parseISO } from "date-fns"

interface OrderAssignment {
  driverName: string
  driverColor: string
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

function getRoleBadge(role: string) {
  switch (role) {
    case "pickup":
      return <Badge variant="outline" className="border-red-300 text-red-700 bg-red-50">Pickup</Badge>
    case "delivery":
      return <Badge variant="outline" className="border-gray-400 text-gray-800 bg-gray-50">Delivery</Badge>
    case "paying":
      return <Badge variant="outline" className="border-blue-300 text-blue-700 bg-blue-50">Paying</Badge>
    case "both":
      return (
        <div className="flex gap-1">
          <Badge variant="outline" className="border-red-300 text-red-700 bg-red-50">Pickup</Badge>
          <Badge variant="outline" className="border-gray-400 text-gray-800 bg-gray-50">Delivery</Badge>
        </div>
      )
    default:
      return <Badge variant="secondary">{role}</Badge>
  }
}

function getStatusBadge(status: string) {
  switch (status) {
    case "unassigned":
      return <Badge variant="secondary">Unassigned</Badge>
    case "completed":
      return <Badge className="bg-green-100 text-green-800 hover:bg-green-100">Completed</Badge>
    default:
      return <Badge variant="outline">{status}</Badge>
  }
}

function formatDate(dateString: string | null): string {
  if (!dateString) return "—"
  try {
    return format(parseISO(dateString), "MM/dd/yyyy")
  } catch {
    return dateString
  }
}

function buildFreightSummary(order: OrderHistoryItem): string {
  const parts: string[] = []
  if (order.skids > 0) parts.push(`${order.skids} skid${order.skids !== 1 ? "s" : ""}`)
  if (order.vinyl > 0) parts.push(`${order.vinyl} vinyl`)
  if (order.footage > 0) parts.push(`${Number(order.footage).toLocaleString()} sqft`)
  return parts.length > 0 ? parts.join(", ") : "—"
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

        if (!response.ok) {
          throw new Error("Failed to fetch orders")
        }

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
      <div className="flex items-center justify-center p-8 text-muted-foreground">
        <Package className="h-5 w-5 animate-pulse mr-2" />
        <span>Loading order history...</span>
      </div>
    )
  }

  if (hasError) {
    return (
      <div className="text-center p-8 text-red-600">
        <AlertTriangle className="mx-auto mb-2 h-6 w-6" />
        <p className="text-sm">Failed to load order history.</p>
      </div>
    )
  }

  if (orders.length === 0) {
    return (
      <div className="text-center p-8 text-muted-foreground">
        <Package className="mx-auto mb-2 h-8 w-8" />
        <p className="text-sm">No orders found for this customer.</p>
      </div>
    )
  }

  const activeOrders = orders.filter((o) => o.status !== "completed")
  const completedOrders = orders.filter((o) => o.status === "completed")

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {orders.length} order{orders.length !== 1 ? "s" : ""} total
          {activeOrders.length > 0 && ` · ${activeOrders.length} active`}
          {completedOrders.length > 0 && ` · ${completedOrders.length} completed`}
        </p>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[70px]">Order</TableHead>
              <TableHead className="w-[100px]">Role</TableHead>
              <TableHead>Other Party</TableHead>
              <TableHead className="w-[100px]">Status</TableHead>
              <TableHead className="w-[100px]">Pickup Date</TableHead>
              <TableHead>Freight</TableHead>
              <TableHead className="w-[60px] text-center">Flags</TableHead>
              <TableHead>Driver</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {orders.map((order) => {
              const otherParty =
                order.customer_role === "pickup"
                  ? order.delivery_customer?.name
                  : order.customer_role === "delivery"
                    ? order.pickup_customer?.name
                    : `${order.pickup_customer?.name} → ${order.delivery_customer?.name}`

              const driverInfo =
                order.pickup_assignment || order.delivery_assignment
              const driverAssignment =
                order.customer_role === "pickup"
                  ? order.pickup_assignment
                  : order.customer_role === "delivery"
                    ? order.delivery_assignment
                    : order.pickup_assignment || order.delivery_assignment

              return (
                <TableRow key={order.id} className={order.status === "completed" ? "opacity-60" : ""}>
                  <TableCell className="font-medium">#{order.id}</TableCell>
                  <TableCell>{getRoleBadge(order.customer_role)}</TableCell>
                  <TableCell className="text-sm truncate max-w-[160px]">
                    {otherParty || "—"}
                  </TableCell>
                  <TableCell>{getStatusBadge(order.status)}</TableCell>
                  <TableCell className="text-sm">
                    {formatDate(order.pickup_date)}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {buildFreightSummary(order)}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center justify-center gap-1">
                      {order.is_rush && (
                        <Zap className="h-4 w-4 text-red-500" title="Rush Order" />
                      )}
                      {order.needs_attention && (
                        <AlertTriangle className="h-4 w-4 text-amber-500" title="Needs Attention" />
                      )}
                      {order.comments && (
                        <MessageSquare className="h-3.5 w-3.5 text-blue-500" title="Has Comments" />
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    {driverAssignment ? (
                      <div className="flex items-center gap-1.5">
                        <div
                          className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                          style={{ backgroundColor: driverAssignment.driverColor || "#808080" }}
                        />
                        <span className="text-sm truncate max-w-[100px]">
                          {driverAssignment.driverName}
                        </span>
                      </div>
                    ) : (
                      <span className="text-muted-foreground text-sm">—</span>
                    )}
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
