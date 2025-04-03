"use client"

import { useState } from "react"
import { PlusCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { CustomerEditModal } from "./customer-edit-modal"

// Use the same Customer interface as other components
interface Customer {
  id: number
  customer_name: string
  address: string
  city: string
  state: string
  zip: string
  county: string
  phone_number_1: string | null
  phone_number_2: string | null
  price_category: number
  notes: string | null
  quotes?: string | null
}

export function CustomerAddButton() {
  const [isModalOpen, setIsModalOpen] = useState(false)
  
  const handleCustomerAdded = (customer: Customer) => {
    // Refresh the customer list
    window.location.reload()
  }
  
  return (
    <>
      <Button
        variant="default"
        className="flex items-center gap-2"
        onClick={() => setIsModalOpen(true)}
        data-testid="add-customer-button"
      >
        <PlusCircle className="h-4 w-4" />
        <span>Add Customer</span>
      </Button>
      
      <CustomerEditModal
        customer={null}
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSave={handleCustomerAdded}
      />
    </>
  )
} 