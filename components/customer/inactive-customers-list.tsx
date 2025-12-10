"use client"

import React, { useState, useEffect } from "react"
import { AlertTriangle, Calendar, Package, Trash2, ArrowLeft, RefreshCw } from "lucide-react"
import { formatPhoneNumber } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table"
import { CustomerEditModal } from "./customer-edit-modal"
import { toast } from "sonner"
import { format } from "date-fns"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"

interface InactiveCustomer {
  id: number
  customer_name: string
  address: string
  city: string
  state: string
  county: string
  zip_code: string
  phone_number_1: string | null
  phone_number_1_ext: string | null
  phone_number_2: string | null
  phone_number_2_ext: string | null
  notes: string | null
  quotes: string | null
  last_order_date: string | null
  total_orders: number
}

// Type for CustomerEditModal (matches what it expects)
interface CustomerForEdit {
  id: number
  customer_name: string
  address: string
  city: string
  state: string
  zip: string
  county: string
  phone_number_1: string | null
  phone_number_1_ext: string | null
  phone_number_2: string | null
  phone_number_2_ext: string | null
  price_category: number
  notes: string | null
  quotes?: string | null
}

type UpdatableCustomer = Omit<InactiveCustomer, "last_order_date" | "total_orders">

export function InactiveCustomersList({ onBack }: { onBack: () => void }) {
  const [customers, setCustomers] = useState<InactiveCustomer[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [hasError, setHasError] = useState(false)
  const [errorMessage, setErrorMessage] = useState("")
  const [selectedCustomer, setSelectedCustomer] = useState<InactiveCustomer | null>(null)
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [customerToDelete, setCustomerToDelete] = useState<InactiveCustomer | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  // Load inactive customers
  useEffect(() => {
    loadInactiveCustomers()
  }, [])

  async function loadInactiveCustomers() {
    try {
      setIsLoading(true)
      setHasError(false)
      const response = await fetch("/api/customers/inactive")
      
      if (!response.ok) {
        throw new Error(`Failed to load inactive customers: ${response.status}`)
      }
      
      const data = await response.json()
      console.log("Loaded inactive customers:", data.length)
      
      setCustomers(data)
    } catch (error) {
      console.error("Error loading inactive customers:", error)
      setHasError(true)
      setErrorMessage(error instanceof Error ? error.message : "Failed to load inactive customers")
    } finally {
      setIsLoading(false)
    }
  }

  function handleEdit(customer: InactiveCustomer) {
    setSelectedCustomer(customer)
    setIsEditModalOpen(true)
  }

  function handleCustomerUpdated(updatedCustomer: CustomerForEdit) {
    // Map the updated customer back to InactiveCustomer format
    const mappedCustomer: InactiveCustomer = {
      ...updatedCustomer,
      zip_code: updatedCustomer.zip,
      quotes: updatedCustomer.quotes ?? null,
      // Keep existing last_order_date and total_orders
      last_order_date: selectedCustomer?.last_order_date || null,
      total_orders: selectedCustomer?.total_orders || 0,
    }
    
    setCustomers(prev => 
      prev.map(c => c.id === mappedCustomer.id ? mappedCustomer : c)
    )
    setIsEditModalOpen(false)
    setSelectedCustomer(null)
  }

  async function handleDeleteClick(customer: InactiveCustomer) {
    setCustomerToDelete(customer)
  }

  async function handleConfirmDelete() {
    if (!customerToDelete) return

    setIsDeleting(true)
    try {
      const response = await fetch(`/api/customers/${customerToDelete.id}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to delete customer')
      }

      toast.success(`Customer "${customerToDelete.customer_name}" deleted successfully`)
      setCustomers(prev => prev.filter(c => c.id !== customerToDelete.id))
      setCustomerToDelete(null)
    } catch (error) {
      console.error('Error deleting customer:', error)
      toast.error(
        error instanceof Error 
          ? error.message 
          : 'Failed to delete customer. Please try again.'
      )
    } finally {
      setIsDeleting(false)
    }
  }

  function formatDate(dateString: string | null): string {
    if (!dateString) return "Never"
    try {
      return format(new Date(dateString), "MMM d, yyyy")
    } catch {
      return dateString
    }
  }

  function getDaysSinceLastOrder(dateString: string | null): number | null {
    if (!dateString) return null
    try {
      const lastOrderDate = new Date(dateString)
      const today = new Date()
      const diffTime = today.getTime() - lastOrderDate.getTime()
      const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24))
      return diffDays
    } catch {
      return null
    }
  }

  if (isLoading) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="text-center py-8">Loading inactive customers...</div>
        </CardContent>
      </Card>
    )
  }

  if (hasError) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="text-center py-8 text-red-600">
            <AlertTriangle className="mx-auto mb-2" size={24} />
            <p>Error: {errorMessage}</p>
            <Button onClick={loadInactiveCustomers} className="mt-4" variant="outline">
              <RefreshCw className="mr-2" size={16} />
              Retry
            </Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="text-amber-500" size={20} />
                Inactive Customers
              </CardTitle>
              <CardDescription className="mt-1">
                Customers with no orders in the last year ({customers.length} found)
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Button onClick={loadInactiveCustomers} variant="outline" size="sm">
                <RefreshCw className="mr-2" size={16} />
                Refresh
              </Button>
              <Button onClick={onBack} variant="outline" size="sm">
                <ArrowLeft className="mr-2" size={16} />
                Back to All Customers
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {customers.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <Package className="mx-auto mb-2" size={32} />
              <p>No inactive customers found.</p>
              <p className="text-sm mt-1">All customers have had orders in the last year.</p>
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Customer Name</TableHead>
                    <TableHead>Location</TableHead>
                    <TableHead>Phone</TableHead>
                    <TableHead className="text-center">Total Orders</TableHead>
                    <TableHead>Last Order Date</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {customers.map((customer) => {
                    const daysSince = getDaysSinceLastOrder(customer.last_order_date)
                    return (
                      <TableRow key={customer.id}>
                        <TableCell className="font-medium">
                          {customer.customer_name}
                        </TableCell>
                        <TableCell>
                          <div className="text-sm">
                            <div>{customer.address}</div>
                            <div className="text-gray-500">
                              {customer.city}, {customer.state} {customer.zip_code}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          {customer.phone_number_1 ? (
                            <div className="text-sm">
                              {formatPhoneNumber(customer.phone_number_1)}
                              {customer.phone_number_1_ext && ` ext. ${customer.phone_number_1_ext}`}
                            </div>
                          ) : (
                            <span className="text-gray-400 text-sm">—</span>
                          )}
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge variant={customer.total_orders === 0 ? "secondary" : "outline"}>
                            {customer.total_orders}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Calendar className="text-gray-400" size={14} />
                            <span className="text-sm">
                              {formatDate(customer.last_order_date)}
                            </span>
                            {daysSince !== null && daysSince > 365 && (
                              <Badge variant="outline" className="text-xs">
                                {Math.floor(daysSince / 365)}y {daysSince % 365}d ago
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleEdit(customer)}
                            >
                              Edit
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDeleteClick(customer)}
                              className="text-red-600 hover:text-red-700 hover:bg-red-50"
                            >
                              <Trash2 size={16} />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {selectedCustomer && (
        <CustomerEditModal
          isOpen={isEditModalOpen}
          onClose={() => {
            setIsEditModalOpen(false)
            setSelectedCustomer(null)
          }}
          customer={{
            ...selectedCustomer,
            zip: selectedCustomer.zip_code,
            price_category: 0, // Default value, as inactive customers API doesn't return this
          }}
          onSave={handleCustomerUpdated}
        />
      )}

      <AlertDialog open={!!customerToDelete} onOpenChange={(open) => !open && setCustomerToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Customer</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete <span className="font-medium">{customerToDelete?.customer_name}</span>?
              <br />
              <br />
              This action cannot be undone. The customer and their associated location will be permanently deleted.
              <br />
              <br />
              <span className="text-amber-600 font-medium">
                Note: Customers connected to existing orders cannot be deleted.
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              disabled={isDeleting}
              className="bg-red-600 hover:bg-red-700"
            >
              {isDeleting ? "Deleting..." : "Delete Customer"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

