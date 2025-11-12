"use client"

import { useState, useEffect } from "react"
import { AlertTriangle, X, MapPin } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useRouter } from "next/navigation"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/modal"

interface CustomerWithoutAddress {
  id: number
  name: string
  orderId: number
  type: 'pickup' | 'delivery'
}

export function MissingAddressWarning() {
  const [isOpen, setIsOpen] = useState(false)
  const [customers, setCustomers] = useState<CustomerWithoutAddress[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const router = useRouter()

  useEffect(() => {
    async function fetchCustomersWithoutAddress() {
      try {
        setIsLoading(true)
        const response = await fetch('/api/truckloads/customers-without-address')
        if (!response.ok) {
          throw new Error('Failed to fetch customers without addresses')
        }
        const data = await response.json()
        setCustomers(data.customers)
      } catch (error) {
        console.error('Error fetching customers without addresses:', error)
      } finally {
        setIsLoading(false)
      }
    }

    fetchCustomersWithoutAddress()
  }, [])

  const handleEditCustomer = (customerId: number) => {
    router.push(`/dashboard/customers/${customerId}`)
  }

  if (customers.length === 0) {
    return null
  }

  return (
    <>
      <Button
        variant="destructive"
        size="sm"
        className="absolute top-4 right-4 z-10 flex items-center gap-2"
        onClick={() => setIsOpen(true)}
      >
        <AlertTriangle className="h-4 w-4" />
        <span>{customers.length} Missing Address{customers.length > 1 ? 'es' : ''}</span>
      </Button>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-red-500" />
              <span>Customers Without Addresses</span>
            </DialogTitle>
          </DialogHeader>

          {isLoading ? (
            <div className="flex justify-center py-4">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-gray-900"></div>
            </div>
          ) : (
            <div className="space-y-4 py-2">
              <p className="text-sm text-gray-600">
                The following customers have orders but are missing addresses:
              </p>
              
              <div className="max-h-[300px] overflow-y-auto">
                {customers.map((customer) => (
                  <div 
                    key={`${customer.id}-${customer.orderId}-${customer.type}`}
                    className="flex items-center justify-between p-3 border rounded-md mb-2"
                  >
                    <div className="flex items-center gap-2">
                      <MapPin className={`h-4 w-4 ${customer.type === 'pickup' ? 'text-red-500' : 'text-black'}`} />
                      <div>
                        <p className="font-medium">{customer.name}</p>
                        <p className="text-xs text-gray-500">
                          {customer.type === 'pickup' ? 'Pickup' : 'Delivery'} - Order #{customer.orderId}
                        </p>
                      </div>
                    </div>
                    <Button 
                      size="sm" 
                      onClick={() => handleEditCustomer(customer.id)}
                    >
                      Edit
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
} 