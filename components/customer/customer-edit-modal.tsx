"use client"

import React, { useState, useEffect } from "react"
import GooglePlacesAutocomplete, { geocodeByAddress, getLatLng } from "react-google-places-autocomplete"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/modal"
import { Button } from "@/components/ui/button"
import { GooglePlacesWrapper } from "@/components/GooglePlacesWrapper"
import { Trash2 } from "lucide-react"

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

interface CustomerEditModalProps {
  customer: Customer | null
  isOpen: boolean
  onClose: () => void
  onSave: (customer: Customer) => void
}

export function CustomerEditModal({
  customer,
  isOpen,
  onClose,
  onSave,
}: CustomerEditModalProps) {
  const isNewCustomer = !customer?.id
  const [formData, setFormData] = useState<Partial<Customer>>(customer || {})
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [addressSelection, setAddressSelection] = useState(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [isConfirmDeleteOpen, setIsConfirmDeleteOpen] = useState(false)
  
  // Check if Google Maps API key is available
  const googleMapsApiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
  const isGoogleMapsAvailable = !!googleMapsApiKey && googleMapsApiKey.length > 20 // Ensure key is valid length
  
  console.log("Google Maps API Key available:", !!googleMapsApiKey)
  console.log("Google Maps API Key length:", googleMapsApiKey?.length || 0)
  
  // Add error handling for Google Maps script loading
  useEffect(() => {
    // Check if the Google Maps script is loaded
    const checkGoogleMapsLoaded = () => {
      if (window.google && window.google.maps) {
        console.log("Google Maps script is loaded successfully");
      } else {
        console.error("Google Maps script failed to load properly");
      }
    };
    
    // Wait for the component to mount and then check
    const timer = setTimeout(checkGoogleMapsLoaded, 2000);
    
    return () => clearTimeout(timer);
  }, []);

  // Reset form when customer changes
  useEffect(() => {
    if (customer) {
      setFormData(customer)
    } else {
      setFormData({})
    }
    setErrors({})
    setAddressSelection(null)
  }, [customer, isOpen])
  
  // Add a function to validate the Google Maps API key
  const validateGoogleMapsApiKey = () => {
    if (!googleMapsApiKey) {
      console.error("Google Maps API key is missing");
      return false;
    }
    
    if (googleMapsApiKey.length < 20) {
      console.error("Google Maps API key appears to be invalid (too short)");
      return false;
    }
    
    return true;
  }
  
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
    
    // Clear error for this field
    if (errors[name]) {
      setErrors(prev => {
        const newErrors = { ...prev }
        delete newErrors[name]
        return newErrors
      })
    }
  }
  
  const handleAddressSelect = async (selection: any) => {
    setAddressSelection(selection)
    
    try {
      const results = await geocodeByAddress(selection.label)
      const addressComponents = results[0].address_components
      const latLng = await getLatLng(results[0])
      
      // Extract address components
      let streetNumber = ''
      let route = ''
      let city = ''
      let state = ''
      let zipCode = ''
      let county = ''
      
      addressComponents.forEach(component => {
        const types = component.types
        
        if (types.includes('street_number')) {
          streetNumber = component.long_name
        } else if (types.includes('route')) {
          route = component.long_name
        } else if (types.includes('locality')) {
          city = component.long_name
        } else if (types.includes('administrative_area_level_1')) {
          state = component.short_name
        } else if (types.includes('postal_code')) {
          zipCode = component.long_name
        } else if (types.includes('administrative_area_level_2')) {
          county = component.long_name.replace(' County', '')
        }
      })
      
      const fullAddress = `${streetNumber} ${route}`.trim()
      
      setFormData(prev => ({
        ...prev,
        address: fullAddress,
        city,
        state,
        zip: zipCode,
        county,
        latitude: latLng.lat,
        longitude: latLng.lng
      }))
      
    } catch (error) {
      console.error("Error processing address:", error)
    }
  }
  
  const validateForm = () => {
    const newErrors: Record<string, string> = {}
    
    if (!formData.customer_name?.trim()) {
      newErrors.customer_name = "Customer name is required"
    }
    
    // Address is optional but flagged if missing
    if (!formData.address?.trim()) {
      // Don't add error, just flag it in the UI
    }
    
    // Phone numbers are now optional
    if (formData.phone_number_1 && formData.phone_number_1.trim() !== '') {
      const cleaned = formData.phone_number_1.replace(/\D/g, '')
      if (!/^\d{10}$/.test(cleaned)) {
        newErrors.phone_number_1 = "Enter a valid 10-digit phone number"
      }
    }
    
    // Secondary phone is optional but must be valid if provided
    if (formData.phone_number_2 && formData.phone_number_2.trim() !== '') {
      const cleaned = formData.phone_number_2.replace(/\D/g, '')
      if (!/^\d{10}$/.test(cleaned)) {
        newErrors.phone_number_2 = "Enter a valid 10-digit phone number"
      }
    }
    
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!validateForm()) {
      return
    }
    
    setIsSubmitting(true)
    
    try {
      // Format phone numbers to just digits and map fields for API
      const cleanedFormData = {
        ...formData,
        phone_number_1: formData.phone_number_1 ? formData.phone_number_1.replace(/\D/g, '') : null,
        phone_number_2: formData.phone_number_2 ? formData.phone_number_2.replace(/\D/g, '') : null,
        // Map zip to zip_code for API
        zip_code: formData.zip
      }
      
      const url = isNewCustomer 
        ? '/api/customers' 
        : `/api/customers/${customer.id}`
      
      const method = isNewCustomer ? 'POST' : 'PUT'
      
      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(cleanedFormData)
      })
      
      if (!response.ok) {
        throw new Error('Failed to save customer')
      }
      
      const savedCustomer = await response.json()
      
      // Ensure the saved customer has the correct field mapping
      const processedCustomer = {
        ...savedCustomer,
        zip: savedCustomer.zip_code
      }
      
      onSave(processedCustomer)
      onClose()
    } catch (error) {
      console.error('Error saving customer:', error)
      setErrors(prev => ({
        ...prev,
        form: 'Failed to save customer. Please try again.'
      }))
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDeleteCustomer = async () => {
    if (!customer?.id) return
    
    setIsDeleting(true)
    
    try {
      const response = await fetch(`/api/customers/${customer.id}`, {
        method: 'DELETE',
      })
      
      if (!response.ok) {
        // For non-204 responses, parse the error message
        const contentType = response.headers.get("content-type")
        if (contentType && contentType.indexOf("application/json") !== -1) {
          const errorData = await response.json()
          console.log("Delete error response:", errorData)
          throw new Error(errorData.error || 'Failed to delete customer')
        } else {
          throw new Error(`Failed to delete customer: ${response.status} ${response.statusText}`)
        }
      }
      
      // Close modal and refresh customer list
      onClose()
      // Force a page refresh to update the customer list
      window.location.reload()
    } catch (error) {
      console.error('Error deleting customer:', error)
      // Keep the confirmation dialog open to show the error
      setIsConfirmDeleteOpen(false)
      
      // Set the error in the form so it's visible to the user
      setErrors(prev => ({
        ...prev,
        form: error instanceof Error 
          ? error.message 
          : 'Failed to delete customer. Please try again.'
      }))
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isNewCustomer ? 'Add New Customer' : 'Edit Customer'}</DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-6 pt-4">
          {/* General error message */}
          {errors.form && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-md">
              {errors.form}
            </div>
          )}
          
          {/* Customer Name */}
          <div className="space-y-2">
            <label htmlFor="customer_name" className="block text-sm font-medium text-gray-700">
              Customer Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              id="customer_name"
              name="customer_name"
              value={formData.customer_name || ''}
              onChange={handleInputChange}
              className={`block w-full rounded-md border ${
                errors.customer_name ? 'border-red-500' : 'border-gray-300'
              } px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500`}
            />
            {errors.customer_name && (
              <p className="text-red-500 text-xs mt-1">{errors.customer_name}</p>
            )}
          </div>
          
          {/* Address with Google Places or fallback to manual input */}
          <div className="space-y-2">
            <label htmlFor="address" className="block text-sm font-medium text-gray-700">
              Address <span className="text-amber-500">◆</span>
            </label>
            
            {isGoogleMapsAvailable && validateGoogleMapsApiKey() ? (
              <div className="space-y-2">
                <GooglePlacesWrapper apiKey={googleMapsApiKey} isOpen={isOpen}>
                  <GooglePlacesAutocomplete
                    selectProps={{
                      value: addressSelection,
                      onChange: handleAddressSelect,
                      placeholder: "Search for an address...",
                      classNames: {
                        control: (state) => 
                          `block w-full rounded-md ${
                            errors.address ? 'border-red-500' : 'border-gray-300'
                          } px-1 py-1 focus:outline-none`,
                        input: () => "text-sm",
                        option: () => "text-sm",
                        container: () => "relative z-50",
                        menu: () => "absolute z-50 bg-white shadow-lg rounded-md mt-1",
                      },
                      noOptionsMessage: () => "No locations found. Try a different search term.",
                      onInputChange: (inputValue) => {
                        console.log("Input changed:", inputValue);
                      },
                      onMenuOpen: () => {
                        console.log("Menu opened");
                      },
                      onMenuClose: () => {
                        console.log("Menu closed");
                      }
                    }}
                    autocompletionRequest={{
                      componentRestrictions: { country: ['us'] }
                    }}
                  />
                </GooglePlacesWrapper>
                <div className="text-xs text-gray-500 mt-1">
                  Try typing a full address like "123 Main St, City, State"
                </div>
                
                {/* Manual address fields as fallback */}
                <div className="mt-4 space-y-4">
                  <div>
                    <label htmlFor="manual_address" className="block text-sm font-medium text-gray-700">
                      Or enter address manually:
                    </label>
                    <input
                      type="text"
                      id="manual_address"
                      name="address"
                      value={formData.address || ''}
                      onChange={handleInputChange}
                      className="mt-1 block w-full rounded-md border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Street address"
                    />
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <input
                        type="text"
                        id="city"
                        name="city"
                        value={formData.city || ''}
                        onChange={handleInputChange}
                        className="block w-full rounded-md border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="City"
                      />
                    </div>
                    <div>
                      <input
                        type="text"
                        id="state"
                        name="state"
                        value={formData.state || ''}
                        onChange={handleInputChange}
                        className="block w-full rounded-md border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="State"
                      />
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <input
                        type="text"
                        id="zip"
                        name="zip"
                        value={formData.zip || ''}
                        onChange={handleInputChange}
                        className="block w-full rounded-md border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="ZIP Code"
                      />
                    </div>
                    <div>
                      <input
                        type="text"
                        id="county"
                        name="county"
                        value={formData.county || ''}
                        onChange={handleInputChange}
                        className="block w-full rounded-md border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="County"
                      />
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <input
                  type="text"
                  id="address"
                  name="address"
                  value={formData.address || ''}
                  onChange={handleInputChange}
                  className={`block w-full rounded-md ${
                    errors.address ? 'border-red-500' : 'border-gray-300'
                  } px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500`}
                  placeholder="Enter address manually"
                />
                <p className="text-xs text-amber-600">
                  Note: Google Maps address autocomplete is not available. Please enter the address manually.
                </p>
              </div>
            )}
            {errors.address && (
              <p className="text-red-500 text-xs mt-1">{errors.address}</p>
            )}
            {!formData.address?.trim() && (
              <p className="text-amber-500 text-xs mt-1">Address is recommended but not required</p>
            )}
          </div>
            
          {/* Phone Numbers */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label htmlFor="phone_number_1" className="block text-sm font-medium text-gray-700">
                Primary Phone <span className="text-amber-500">◆</span>
              </label>
              <input
                type="tel"
                id="phone_number_1"
                name="phone_number_1"
                value={formData.phone_number_1 || ''}
                onChange={handleInputChange}
                className={`block w-full rounded-md border ${
                  errors.phone_number_1 ? 'border-red-500' : 'border-gray-300'
                } px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500`}
                placeholder="(XXX) XXX-XXXX"
              />
              {errors.phone_number_1 && (
                <p className="text-red-500 text-xs mt-1">{errors.phone_number_1}</p>
              )}
              {!formData.phone_number_1 && (
                <p className="text-amber-500 text-xs mt-1">Phone number is recommended but not required</p>
              )}
            </div>
            
            <div className="space-y-2">
              <label htmlFor="phone_number_2" className="block text-sm font-medium text-gray-700">
                Secondary Phone
              </label>
              <input
                type="tel"
                id="phone_number_2"
                name="phone_number_2"
                value={formData.phone_number_2 || ''}
                onChange={handleInputChange}
                className={`block w-full rounded-md border ${
                  errors.phone_number_2 ? 'border-red-500' : 'border-gray-300'
                } px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500`}
                placeholder="(XXX) XXX-XXXX"
              />
              {errors.phone_number_2 && (
                <p className="text-red-500 text-xs mt-1">{errors.phone_number_2}</p>
              )}
            </div>
          </div>
          
          {/* Quotes field - Only show for existing customers */}
          {!isNewCustomer && (
            <div className="space-y-2">
              <label htmlFor="quotes" className="block text-sm font-medium text-gray-700">
                Quotes
              </label>
              <textarea
                id="quotes"
                name="quotes"
                value={formData.quotes || ''}
                onChange={handleInputChange}
                rows={3}
                className="block w-full rounded-md border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Enter customer quotes or pricing information"
              />
            </div>
          )}
          
          {/* Notes */}
          <div className="space-y-2">
            <label htmlFor="notes" className="block text-sm font-medium text-gray-700">
              Notes
            </label>
            <textarea
              id="notes"
              name="notes"
              value={formData.notes || ''}
              onChange={handleInputChange}
              rows={3}
              className="block w-full rounded-md border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Any additional information about this customer"
            />
          </div>
          
          <div className="text-xs text-gray-500 mt-4">
            <p><span className="text-red-500">*</span> Required field</p>
            <p><span className="text-amber-500">◆</span> Recommended field</p>
          </div>
          
          <DialogFooter className="flex justify-between items-center">
            <div>
              {!isNewCustomer && (
                <Button
                  type="button"
                  variant="destructive"
                  onClick={() => setIsConfirmDeleteOpen(true)}
                  className="mt-4"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete
                </Button>
              )}
            </div>
            <div className="flex space-x-2">
              <Button
                type="button"
                variant="outline"
                onClick={onClose}
                className="mt-4"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isSubmitting}
                className="mt-4"
              >
                {isSubmitting ? 'Saving...' : 'Save Customer'}
              </Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
      
      {/* Confirmation Dialog */}
      {!isNewCustomer && (
        <Dialog open={isConfirmDeleteOpen} onOpenChange={setIsConfirmDeleteOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Delete Customer</DialogTitle>
            </DialogHeader>
            <div className="py-4">
              <p className="text-sm text-gray-700">
                Are you sure you want to delete <span className="font-medium">{customer?.customer_name}</span>?
                This action cannot be undone.
              </p>
              
              {/* Show a warning about possible constraints */}
              <p className="text-sm text-amber-600 mt-4">
                Note: Customers connected to existing orders cannot be deleted.
              </p>
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsConfirmDeleteOpen(false)}
                disabled={isDeleting}
              >
                Cancel
              </Button>
              <Button
                type="button"
                variant="destructive"
                onClick={handleDeleteCustomer}
                disabled={isDeleting}
              >
                {isDeleting ? 'Deleting...' : 'Delete Customer'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </Dialog>
  )
} 