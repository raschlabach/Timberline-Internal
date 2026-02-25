"use client"

import { useState } from "react"
import { Edit, Copy, Phone } from "lucide-react"
import { formatPhoneNumber } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle
} from "@/components/ui/modal"
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent
} from "@/components/ui/tabs"
import { CustomerQuotes } from './customer-quotes'
import { CustomerOrderHistory } from './customer-order-history'

interface Customer {
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

interface CustomerDetailsModalProps {
  customer: Customer
  isOpen: boolean
  onClose: () => void
  onEdit: () => void
}

export function CustomerDetailsModal({
  customer,
  isOpen,
  onClose,
  onEdit
}: CustomerDetailsModalProps) {
  const [activeTab, setActiveTab] = useState("details")
  
  const copyToClipboard = (text: string | null) => {
    if (text) {
      navigator.clipboard.writeText(text)
    }
    // You could add a toast notification here
  }

  const fullAddress = `${customer.address || ''}, ${customer.city || ''}, ${customer.state || ''} ${customer.zip || ''}`

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl">{customer.customer_name || 'Unnamed Customer'}</DialogTitle>
        </DialogHeader>
        
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid grid-cols-3 w-full">
            <TabsTrigger value="details">Customer Details</TabsTrigger>
            <TabsTrigger value="quotes">Quotes</TabsTrigger>
            <TabsTrigger value="loads">Order History</TabsTrigger>
          </TabsList>
          
          {/* Customer Details Tab */}
          <TabsContent value="details" className="space-y-6">
            <div className="flex justify-end">
              <Button 
                variant="outline" 
                size="sm" 
                onClick={onEdit}
                className="flex items-center gap-2"
              >
                <Edit className="h-4 w-4" />
                <span>Edit Customer</span>
              </Button>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Address Information */}
              <div className="space-y-4">
                <h3 className="font-medium text-lg">Address Information</h3>
                <div className="space-y-2">
                  <p>{customer.address || '-'}</p>
                  <p>
                    {customer.city || ''}{customer.city && customer.state ? ', ' : ''}
                    {customer.state || ''} {customer.zip || ''}
                  </p>
                  <p className="text-muted-foreground">
                    {customer.county ? `${customer.county} County` : '-'}
                  </p>
                </div>
              </div>
              
              {/* Contact Information */}
              <div className="space-y-4">
                <h3 className="font-medium text-lg">Contact Information</h3>
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Phone className="h-4 w-4" />
                    <span className="font-medium">Primary:</span>
                    <span>
                      {formatPhoneNumber(customer.phone_number_1) || '-'}
                      {customer.phone_number_1_ext && (
                        <span className="text-muted-foreground ml-1">ext. {customer.phone_number_1_ext}</span>
                      )}
                    </span>
                    {customer.phone_number_1 && (
                      <button
                        onClick={() => {
                          const phoneText = customer.phone_number_1 + (customer.phone_number_1_ext ? ` ext. ${customer.phone_number_1_ext}` : '');
                          copyToClipboard(phoneText);
                        }}
                        className="text-muted-foreground hover:text-foreground"
                        aria-label="Copy primary phone number"
                      >
                        <Copy className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                  
                  {customer.phone_number_2 && (
                    <div className="flex items-center gap-2">
                      <Phone className="h-4 w-4" />
                      <span className="font-medium">Secondary:</span>
                      <span>
                        {formatPhoneNumber(customer.phone_number_2) || '-'}
                        {customer.phone_number_2_ext && (
                          <span className="text-muted-foreground ml-1">ext. {customer.phone_number_2_ext}</span>
                        )}
                      </span>
                      <button
                        onClick={() => {
                          const phoneText = customer.phone_number_2 + (customer.phone_number_2_ext ? ` ext. ${customer.phone_number_2_ext}` : '');
                          copyToClipboard(phoneText);
                        }}
                        className="text-primary hover:text-primary/80 focus:outline-none"
                        aria-label="Copy secondary phone number to clipboard"
                      >
                        <Copy className="h-4 w-4" />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
            
            {/* Notes Section */}
            <div className="space-y-4 border-t pt-4">
              <h3 className="font-medium text-lg">Notes</h3>
              <div className="min-h-[100px] p-3 border rounded-md bg-muted/10">
                {customer.notes ? (
                  <p className="whitespace-pre-line">{customer.notes}</p>
                ) : (
                  <p className="text-muted-foreground italic">No notes for this customer.</p>
                )}
              </div>
            </div>
          </TabsContent>
          
          {/* Quotes Tab */}
          <TabsContent value="quotes">
            <CustomerQuotes customerId={customer.id} />
          </TabsContent>
          
          {/* Order History Tab */}
          <TabsContent value="loads">
            <CustomerOrderHistory customerId={customer.id} />
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  )
} 