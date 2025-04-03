"use client"

import React, { useState, useEffect, useRef } from "react"
import { Edit, Info } from "lucide-react"
import { formatPhoneNumber } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { CustomerDetailsModal } from "./customer-details-modal"
import { CustomerEditModal } from "./customer-edit-modal"

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

export default function CustomerList() {
  // State
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  
  // Refs
  const searchInputRef = useRef<HTMLInputElement>(null);
  const tableRef = useRef<HTMLTableElement>(null);
  
  // Load customers
  useEffect(() => {
    async function loadCustomers() {
      try {
        setIsLoading(true);
        const response = await fetch("/api/customers");
        
        if (!response.ok) {
          throw new Error(`Failed to load customers: ${response.status}`);
        }
        
        const data = await response.json();
        console.log("Loaded customers:", data.length);
        
        const formattedData = data.map((customer: any) => ({
          ...customer,
          zip: customer.zip_code,
          price_category: customer.price_category || 0
        }));
        
        setCustomers(formattedData);
      } catch (error) {
        console.error("Error loading customers:", error);
        setHasError(true);
        setErrorMessage(error instanceof Error ? error.message : "Failed to load customers");
      } finally {
        setIsLoading(false);
      }
    }
    
    loadCustomers();
  }, []);
  
  // Direct DOM manipulation for search with fuzzy matching
  function doSearch() {
    const searchInput = searchInputRef.current?.value.trim();
    if (!searchInput) {
      // Show all rows if no search value
      tableRef.current?.querySelectorAll('tbody tr').forEach(row => {
        (row as HTMLElement).style.display = '';
      });
      
      // Update counter
      const counter = document.getElementById('customerCounter');
      if (counter) {
        const totalRows = tableRef.current?.querySelectorAll('tbody tr').length || 0;
        counter.textContent = `${totalRows} customer${totalRows !== 1 ? 's' : ''} shown`;
      }
      return;
    }
    
    // Normalize the search input by removing special characters and extra spaces
    const normalizedSearch = searchInput.toLowerCase()
      .replace(/[&\/\\#,+()$~%.'":*?<>{}]/g, ' ') // Replace special chars with space
      .replace(/\s+/g, ' ')                       // Replace multiple spaces with single space
      .trim();                                    // Trim spaces
    
    // Split into search terms
    const searchTerms = normalizedSearch.split(' ').filter(term => term.length > 0);
    
    console.log("Normalized search terms:", searchTerms);
    
    // Get all table rows
    const tableRows = tableRef.current?.querySelectorAll('tbody tr');
    let visibleCount = 0;
    
    // For each row, check if it contains the search terms
    tableRows?.forEach(row => {
      const rowElement = row as HTMLElement;
      // Get text content and normalize it the same way
      const text = row.textContent || '';
      const normalizedText = text.toLowerCase()
        .replace(/[&\/\\#,+()$~%.'":*?<>{}]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
      
      // Check if all search terms are in the text content (partial matching)
      const matchesAllTerms = searchTerms.every(term => {
        return normalizedText.includes(term);
      });
      
      if (matchesAllTerms) {
        rowElement.style.display = '';
        visibleCount++;
        console.log("Match found:", rowElement.querySelector('td')?.textContent);
      } else {
        rowElement.style.display = 'none';
      }
    });
    
    // Update the counter
    const counter = document.getElementById('customerCounter');
    if (counter) {
      counter.textContent = `${visibleCount} customer${visibleCount !== 1 ? 's' : ''} shown`;
      if (visibleCount !== tableRows?.length) {
        counter.textContent += ` (matching "${searchInput}")`;
      }
    }
  }
  
  function clearSearch() {
    if (searchInputRef.current) {
      searchInputRef.current.value = '';
    }
    doSearch();
  }
  
  function handleViewDetails(customer: Customer) {
    setSelectedCustomer(customer);
    setIsDetailsModalOpen(true);
  }
  
  function handleEdit(customer: Customer) {
    setSelectedCustomer(customer);
    setIsEditModalOpen(true);
  }
  
  function handleCustomerUpdated(updatedCustomer: Customer) {
    const processedCustomer = {
      ...updatedCustomer,
      zip: updatedCustomer.zip || (updatedCustomer as any).zip_code || ""
    };
    
    setCustomers(prev => 
      prev.map(c => c.id === processedCustomer.id ? processedCustomer : c)
    );
    
    setSelectedCustomer(processedCustomer);
    
    // Force a re-render of the table
    setTimeout(doSearch, 100);
  }
  
  // Loading state
  if (isLoading) {
    return <div className="flex justify-center p-8">Loading customers...</div>;
  }
  
  // Error state
  if (hasError) {
    return (
      <div className="rounded-md border border-red-300 bg-red-50 p-6 text-center">
        <h3 className="text-lg font-medium text-red-700 mb-2">Failed to load customers</h3>
        <p className="text-sm text-red-500 mb-4">{errorMessage}</p>
        <button 
          onClick={() => window.location.reload()} 
          className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600"
        >
          Retry
        </button>
      </div>
    );
  }
  
  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div className="space-y-2">
          <div className="flex gap-2">
            <input
              ref={searchInputRef}
              type="text"
              placeholder="Search..."
              className="border px-3 py-2 rounded"
              onChange={() => doSearch()}
            />
            <button 
              onClick={clearSearch}
              className="px-3 py-2 bg-gray-200 rounded hover:bg-gray-300"
            >
              Clear
            </button>
          </div>
          <p className="text-xs text-gray-500">
            Type to search by any field
          </p>
        </div>
        <div className="text-sm text-gray-500" id="customerCounter">
          {customers.length} customer{customers.length !== 1 ? 's' : ''} shown
        </div>
      </div>

      <div className="rounded-md border overflow-hidden">
        <table ref={tableRef} className="w-full text-sm">
          <thead className="border-b bg-gray-100">
            <tr>
              <th className="py-3 px-4 text-left font-medium">Customer Name</th>
              <th className="py-3 px-4 text-left font-medium">Address</th>
              <th className="py-3 px-4 text-left font-medium">Primary Phone</th>
              <th className="py-3 px-4 text-left font-medium">Secondary Phone</th>
              <th className="py-3 px-4 text-center font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {customers.length > 0 ? (
              customers.map(customer => (
                <tr key={customer.id} className="border-b hover:bg-gray-50">
                  <td className="py-3 px-4">
                    <button
                      onClick={() => handleViewDetails(customer)}
                      className="font-medium text-left hover:underline focus:outline-none"
                    >
                      {customer.customer_name || 'Unnamed Customer'}
                    </button>
                  </td>
                  <td className="py-3 px-4">
                    {customer.city || ''}{customer.city && customer.state ? ', ' : ''}{customer.state || ''}
                  </td>
                  <td className="py-3 px-4">{formatPhoneNumber(customer.phone_number_1) || "-"}</td>
                  <td className="py-3 px-4">{formatPhoneNumber(customer.phone_number_2) || "-"}</td>
                  <td className="py-2 px-4">
                    <div className="flex justify-center space-x-2">
                      <button
                        onClick={() => handleEdit(customer)}
                        className="p-1 text-blue-600 hover:text-blue-800"
                        aria-label={`Edit ${customer.customer_name || 'customer'}`}
                      >
                        <Edit className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleViewDetails(customer)}
                        className="p-1 text-blue-600 hover:text-blue-800"
                        aria-label={`View details for ${customer.customer_name || 'customer'}`}
                      >
                        <Info className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={5} className="py-4 px-4 text-center text-gray-500">
                  No customers found
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Customer Details Modal */}
      {selectedCustomer && (
        <CustomerDetailsModal
          customer={selectedCustomer}
          isOpen={isDetailsModalOpen}
          onClose={() => setIsDetailsModalOpen(false)}
          onEdit={() => {
            setIsDetailsModalOpen(false);
            setIsEditModalOpen(true);
          }}
        />
      )}

      {/* Customer Edit Modal */}
      {selectedCustomer && (
        <CustomerEditModal
          customer={selectedCustomer}
          isOpen={isEditModalOpen}
          onClose={() => setIsEditModalOpen(false)}
          onSave={handleCustomerUpdated}
        />
      )}
    </div>
  );
} 