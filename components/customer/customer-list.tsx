"use client"

import React, { useState, useEffect, useRef, useMemo } from "react"
import { Edit, Info, Search, X, Users, MapPin, Phone, Filter, RotateCcw, Package, Package2 } from "lucide-react"
import { formatPhoneNumber } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table"
import { CustomerDetailsModal } from "./customer-details-modal"
import { CustomerEditModal } from "./customer-edit-modal"
import { InactiveCustomersList } from "./inactive-customers-list"
import { AlertTriangle } from "lucide-react"

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
  current_orders: number
  total_orders: number
}

type UpdatableCustomer = Omit<Customer, "current_orders" | "total_orders"> & {
  current_orders?: number
  total_orders?: number
}

function getPriceCategoryBadge(category: number) {
  const categories = {
    0: { label: "Standard", variant: "secondary" as const },
    1: { label: "Premium", variant: "default" as const },
    2: { label: "VIP", variant: "default" as const },
    3: { label: "Wholesale", variant: "outline" as const }
  }
  
  return categories[category as keyof typeof categories] || categories[0]
}

interface FilterState {
  state: string
  county: string
  phonePrefix: string
  zipcode: string
}

const ALL_FILTER_VALUE = "all"

function getPhonePrefix(phoneNumber: string | null): string {
  if (!phoneNumber) return ""
  const cleaned = phoneNumber.replace(/\D/g, "")
  return cleaned.substring(0, 3)
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
  const [showInactiveCustomers, setShowInactiveCustomers] = useState(false);
  
  // Filter state
  const [filters, setFilters] = useState<FilterState>({
    state: ALL_FILTER_VALUE,
    county: ALL_FILTER_VALUE,
    phonePrefix: ALL_FILTER_VALUE,
    zipcode: ALL_FILTER_VALUE
  });
  
  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  
  // Refs
  const tableRef = useRef<HTMLTableElement>(null);
  
  // Computed filter options
  const filterOptions = useMemo(() => {
    const states = Array.from(new Set(customers.map(c => c.state).filter((value): value is string => Boolean(value)))).sort();
    const counties = Array.from(new Set(customers.map(c => c.county).filter((value): value is string => Boolean(value)))).sort();
    const phonePrefixes = Array.from(new Set(
      customers
        .map(c => getPhonePrefix(c.phone_number_1))
        .filter((prefix): prefix is string => !!prefix && prefix.length > 0)
    )).sort();
    const zipcodes = Array.from(new Set(customers.map(c => c.zip).filter((value): value is string => Boolean(value)))).sort();
    
    return { states, counties, phonePrefixes, zipcodes };
  }, [customers]);
  
  // Helper function to calculate match score for sorting
  function getCustomerMatchScore(customer: Customer, searchQuery: string): number {
    if (!searchQuery.trim()) return 0;
    
    const searchLower = searchQuery.toLowerCase().trim();
    const nameLower = customer.customer_name?.toLowerCase() || '';
    const cityLower = customer.city?.toLowerCase() || '';
    const stateLower = customer.state?.toLowerCase() || '';
    const addressLower = customer.address?.toLowerCase() || '';
    const countyLower = customer.county?.toLowerCase() || '';
    const zipLower = customer.zip?.toLowerCase() || '';
    
    // Normalize search query (same as the old DOM manipulation logic)
    const normalizedSearch = searchLower
      .replace(/[&\/\\#,+()$~%.'":*?<>{}]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    
    // Split into search terms
    const searchTerms = normalizedSearch.split(' ').filter(term => term.length > 0);
    
    let score = 0;
    
    // Check each search term
    for (const term of searchTerms) {
      // Exact match on customer name (highest priority - 1000 points)
      if (nameLower === term) {
        score += 1000;
      }
      // Customer name starts with search term (high priority - 500 points)
      else if (nameLower.startsWith(term)) {
        score += 500;
      }
      // Customer name contains search term at word boundary (medium-high priority - 300 points)
      else if (nameLower.includes(` ${term}`) || nameLower.startsWith(term)) {
        score += 300;
      }
      // Customer name contains search term anywhere (medium priority - 200 points)
      else if (nameLower.includes(term)) {
        score += 200;
      }
      // Other fields match (lower priority - 50 points each)
      else {
        if (cityLower.includes(term)) score += 50;
        if (stateLower.includes(term)) score += 50;
        if (addressLower.includes(term)) score += 50;
        if (countyLower.includes(term)) score += 50;
        if (zipLower.includes(term)) score += 50;
      }
    }
    
    // Bonus: if the full search query matches the customer name exactly
    if (nameLower === normalizedSearch) {
      score += 2000;
    }
    // Bonus: if the full search query starts with customer name
    else if (nameLower.startsWith(normalizedSearch)) {
      score += 1000;
    }
    
    return score;
  }

  // Filtered and sorted customers
  const filteredCustomers = useMemo(() => {
    // First apply filters
    let filtered = customers.filter(customer => {
      // State filter
      if (filters.state !== ALL_FILTER_VALUE && customer.state !== filters.state) return false;
      
      // County filter
      if (filters.county !== ALL_FILTER_VALUE && customer.county !== filters.county) return false;
      
      // Phone prefix filter
      if (filters.phonePrefix !== ALL_FILTER_VALUE) {
        const primaryPrefix = getPhonePrefix(customer.phone_number_1);
        const secondaryPrefix = getPhonePrefix(customer.phone_number_2);
        if (primaryPrefix !== filters.phonePrefix && secondaryPrefix !== filters.phonePrefix) return false;
      }
      
      // Zipcode filter
      if (filters.zipcode !== ALL_FILTER_VALUE && customer.zip !== filters.zipcode) return false;
      
      return true;
    });
    
    // Then apply search filter if there's a search query
    if (searchQuery.trim()) {
      const searchLower = searchQuery.toLowerCase().trim();
      const normalizedSearch = searchLower
        .replace(/[&\/\\#,+()$~%.'":*?<>{}]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
      const searchTerms = normalizedSearch.split(' ').filter(term => term.length > 0);
      
      filtered = filtered.filter(customer => {
        const text = [
          customer.customer_name,
          customer.city,
          customer.state,
          customer.address,
          customer.county,
          customer.zip
        ].filter(Boolean).join(' ').toLowerCase();
        
        const normalizedText = text
          .replace(/[&\/\\#,+()$~%.'":*?<>{}]/g, ' ')
          .replace(/\s+/g, ' ')
          .trim();
        
        // Check if all search terms are in the text content
        return searchTerms.every(term => normalizedText.includes(term));
      });
      
      // Sort by match score (highest first)
      filtered.sort((a, b) => {
        const scoreA = getCustomerMatchScore(a, searchQuery);
        const scoreB = getCustomerMatchScore(b, searchQuery);
        return scoreB - scoreA;
      });
    }
    
    return filtered;
  }, [customers, filters, searchQuery]);
  
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
          price_category: customer.price_category || 0,
          current_orders: customer.current_orders || 0,
          total_orders: customer.total_orders || 0
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
  
  function clearSearch() {
    setSearchQuery('');
  }
  
  function handleFilterChange(filterType: keyof FilterState, value: string) {
    setFilters(prev => ({
      ...prev,
      [filterType]: value
    }));
  }
  
  function clearAllFilters() {
    setFilters({
      state: ALL_FILTER_VALUE,
      county: ALL_FILTER_VALUE,
      phonePrefix: ALL_FILTER_VALUE,
      zipcode: ALL_FILTER_VALUE
    });
  }
  
  function hasActiveFilters(): boolean {
    return Object.values(filters).some(filter => filter !== ALL_FILTER_VALUE);
  }
  
  function handleViewDetails(customer: Customer) {
    setSelectedCustomer(customer);
    setIsDetailsModalOpen(true);
  }
  
  function handleEdit(customer: Customer) {
    setSelectedCustomer(customer);
    setIsEditModalOpen(true);
  }
  
  function handleCustomerUpdated(updatedCustomer: UpdatableCustomer) {
    const existingCustomer = customers.find(c => c.id === updatedCustomer.id)
    
    const processedCustomer: Customer = {
      ...(existingCustomer ?? {
        current_orders: 0,
        total_orders: 0,
      }),
      ...updatedCustomer,
      zip: updatedCustomer.zip || (updatedCustomer as any).zip_code || "",
      current_orders: updatedCustomer.current_orders ?? existingCustomer?.current_orders ?? 0,
      total_orders: updatedCustomer.total_orders ?? existingCustomer?.total_orders ?? 0,
    }
    
    setCustomers(prev => 
      prev.map(c => c.id === processedCustomer.id ? processedCustomer : c)
    );
    
    setSelectedCustomer(processedCustomer);
    
    // Table will re-render automatically when filteredCustomers changes
  }
  
  // Loading state
  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center p-12">
          <div className="flex items-center space-x-2 text-muted-foreground">
            <Users className="h-5 w-5 animate-pulse" />
            <span>Loading customers...</span>
          </div>
        </CardContent>
      </Card>
    );
  }
  
  // Error state
  if (hasError) {
    return (
      <Card className="border-destructive">
        <CardContent className="p-6 text-center">
          <div className="space-y-4">
            <div className="flex items-center justify-center space-x-2 text-destructive">
              <Users className="h-5 w-5" />
              <h3 className="text-lg font-medium">Failed to load customers</h3>
            </div>
            <p className="text-sm text-muted-foreground">{errorMessage}</p>
            <Button 
              onClick={() => window.location.reload()} 
              variant="destructive"
            >
              Retry
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }
  
  // If showing inactive customers, render that component instead
  if (showInactiveCustomers) {
    return <InactiveCustomersList onBack={() => setShowInactiveCustomers(false)} />
  }
  
  return (
    <div className="space-y-6">
      {/* Search and Stats Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
          <CardTitle className="flex items-center space-x-2">
            <Users className="h-5 w-5" />
            <span>Customer Directory</span>
          </CardTitle>
            <Button
              variant="outline"
              onClick={() => setShowInactiveCustomers(true)}
              className="flex items-center gap-2"
            >
              <AlertTriangle className="h-4 w-4 text-amber-500" />
              View Inactive Customers
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
            <div className="flex-1 space-y-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  type="text"
                  placeholder="Search customers by name, location, or phone..."
                  className="pl-10 pr-10"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
                {searchQuery && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="absolute right-1 top-1/2 transform -translate-y-1/2 h-7 w-7 p-0"
                    onClick={clearSearch}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                Search across all customer fields including name, address, city, state, and phone numbers
              </p>
            </div>
            <div className="flex items-center space-x-2 text-sm text-muted-foreground">
              <Users className="h-4 w-4" />
              <span id="customerCounter">
                {filteredCustomers.length} customer{filteredCustomers.length !== 1 ? 's' : ''} shown
                {hasActiveFilters() && ' (filtered)'}
                {searchQuery && ` (matching "${searchQuery}")`}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Filter Controls Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Filter className="h-5 w-5" />
              <span>Filters</span>
            </div>
            {hasActiveFilters() && (
              <Button
                variant="outline"
                size="sm"
                onClick={clearAllFilters}
                className="flex items-center space-x-1"
              >
                <RotateCcw className="h-4 w-4" />
                <span>Clear All</span>
              </Button>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* State Filter */}
            <div className="space-y-2">
              <label className="text-sm font-medium">State</label>
              <Select
                value={filters.state}
                onValueChange={(value) => handleFilterChange('state', value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="All States" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL_FILTER_VALUE}>All States</SelectItem>
                  {filterOptions.states.map(state => (
                    <SelectItem key={state} value={state}>{state}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* County Filter */}
            <div className="space-y-2">
              <label className="text-sm font-medium">County</label>
              <Select
                value={filters.county}
                onValueChange={(value) => handleFilterChange('county', value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="All Counties" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL_FILTER_VALUE}>All Counties</SelectItem>
                  {filterOptions.counties.map(county => (
                    <SelectItem key={county} value={county}>{county}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Phone Prefix Filter */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Phone Area</label>
              <Select
                value={filters.phonePrefix}
                onValueChange={(value) => handleFilterChange('phonePrefix', value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="All Areas" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL_FILTER_VALUE}>All Areas</SelectItem>
                  {filterOptions.phonePrefixes.map(prefix => (
                    <SelectItem key={prefix} value={prefix}>({prefix})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Zipcode Filter */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Zipcode</label>
              <Select
                value={filters.zipcode}
                onValueChange={(value) => handleFilterChange('zipcode', value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="All Zipcodes" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL_FILTER_VALUE}>All Zipcodes</SelectItem>
                  {filterOptions.zipcodes.map(zipcode => (
                    <SelectItem key={zipcode} value={zipcode}>{zipcode}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

          </div>
        </CardContent>
      </Card>

      {/* Customer Table Card */}
      <Card>
        <CardContent className="p-0">
          <Table ref={tableRef}>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[25%]">Customer</TableHead>
                <TableHead className="w-[20%]">Location</TableHead>
                <TableHead className="w-[15%]">Primary Phone</TableHead>
                <TableHead className="w-[15%]">Secondary Phone</TableHead>
                <TableHead className="w-[10%]">Orders</TableHead>
                <TableHead className="w-[15%] text-center">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredCustomers.length > 0 ? (
                filteredCustomers.map(customer => {
                  const priceCategory = getPriceCategoryBadge(customer.price_category);
                  return (
                    <TableRow key={customer.id} className="hover:bg-muted/50">
                      <TableCell>
                        <div className="space-y-1">
                          <button
                            onClick={() => handleViewDetails(customer)}
                            className="font-medium text-left hover:underline focus:outline-none focus:underline"
                          >
                            {customer.customer_name || 'Unnamed Customer'}
                          </button>
                          {customer.notes && (
                            <p className="text-xs text-muted-foreground truncate max-w-[200px]">
                              {customer.notes}
                            </p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center space-x-1 text-sm">
                          <MapPin className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                          <span className="truncate">
                            {customer.city || ''}{customer.city && customer.state ? ', ' : ''}{customer.state || ''}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        {customer.phone_number_1 ? (
                          <div className="flex items-center space-x-1 text-sm">
                            <Phone className="h-3 w-3 text-muted-foreground" />
                            <span>{formatPhoneNumber(customer.phone_number_1)}</span>
                          </div>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {customer.phone_number_2 ? (
                          <div className="flex items-center space-x-1 text-sm">
                            <Phone className="h-3 w-3 text-muted-foreground" />
                            <span>{formatPhoneNumber(customer.phone_number_2)}</span>
                          </div>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          <div className="flex items-center space-x-1 text-sm">
                            <Package className="h-3 w-3 text-green-600" />
                            <span className="font-medium text-green-600">
                              {customer.current_orders}
                            </span>
                            <span className="text-muted-foreground">current</span>
                          </div>
                          <div className="flex items-center space-x-1 text-xs text-muted-foreground">
                            <Package2 className="h-3 w-3" />
                            <span>{customer.total_orders}</span>
                            <span>total</span>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex justify-center space-x-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEdit(customer)}
                            className="h-8 w-8 p-0"
                            aria-label={`Edit ${customer.customer_name || 'customer'}`}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleViewDetails(customer)}
                            className="h-8 w-8 p-0"
                            aria-label={`View details for ${customer.customer_name || 'customer'}`}
                          >
                            <Info className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              ) : (
                <TableRow>
                  <TableCell colSpan={6} className="py-12 text-center">
                    <div className="flex flex-col items-center space-y-2 text-muted-foreground">
                      <Users className="h-8 w-8" />
                      <p className="text-sm">No customers found</p>
                      <p className="text-xs">Try adjusting your search criteria</p>
                    </div>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

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