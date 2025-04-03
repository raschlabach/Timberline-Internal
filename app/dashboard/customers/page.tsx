import { Metadata } from "next"
import CustomerList from "@/components/customer/customer-list"
import { CustomerAddButton } from "@/components/customer/customer-add-button"

export const metadata: Metadata = {
  title: "Customer Center - Timberline Logistics",
  description: "Manage all customer information for Timberline Trucking",
}

export default async function CustomerCenterPage() {
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold tracking-tight">Customer Center</h1>
        <div className="flex items-center gap-4">
          <CustomerAddButton />
        </div>
      </div>
      
      <CustomerList />
    </div>
  )
} 