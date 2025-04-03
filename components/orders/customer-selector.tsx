"use client";

import { useState, useEffect, useCallback } from 'react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Search, Check, ChevronsUpDown, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Customer } from '@/types/shared';

interface CustomerSelectorProps {
  label: string;
  required?: boolean;
  selectedCustomer: Customer | null;
  onSelectCustomer: (customer: Customer | null) => void;
}

export function CustomerSelector({
  label,
  required = false,
  selectedCustomer,
  onSelectCustomer,
}: CustomerSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Fetch customers on first render
  const fetchCustomers = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      const response = await fetch('/api/customers');
      
      if (!response.ok) {
        throw new Error(`Failed to fetch customers: ${response.status}`);
      }
      
      const data = await response.json();
      console.log("Fetched customers:", data.length);
      setCustomers(data);
    } catch (error) {
      console.error('Error fetching customers:', error);
      setError(typeof error === 'object' && error !== null && 'message' in error 
        ? (error as Error).message 
        : 'Failed to load customers');
    } finally {
      setIsLoading(false);
    }
  }, []);
  
  useEffect(() => {
    fetchCustomers();
  }, [fetchCustomers]);

  // Filter customers based on search query
  const filteredCustomers = searchQuery === ''
    ? customers
    : customers.filter((customer) => {
        const searchLower = searchQuery.toLowerCase();
        return (
          (customer.customer_name && customer.customer_name.toLowerCase().includes(searchLower)) ||
          (customer.city && customer.city.toLowerCase().includes(searchLower)) ||
          (customer.state && customer.state.toLowerCase().includes(searchLower)) ||
          (customer.address && customer.address.toLowerCase().includes(searchLower))
        );
      });

  // Direct selection function - bypasses the CommandItem onSelect  
  const selectCustomer = useCallback((customer: Customer) => {
    console.log("Directly selecting customer:", customer);
    onSelectCustomer(customer);
    setIsOpen(false);
    setSearchQuery('');
  }, [onSelectCustomer]);

  // Handle selection of a customer from the dropdown
  const handleSelect = useCallback((value: string) => {
    console.log("Selected value:", value);
    const foundCustomer = customers.find(c => c.id.toString() === value);
    
    console.log("Found customer:", foundCustomer);
    
    if (foundCustomer) {
      onSelectCustomer(foundCustomer);
      setIsOpen(false);
      setSearchQuery('');
    }
  }, [customers, onSelectCustomer]);
  
  const handleClear = useCallback((e?: React.MouseEvent) => {
    if (e) {
      e.stopPropagation();
    }
    onSelectCustomer(null);
    setSearchQuery('');
  }, [onSelectCustomer]);

  return (
    <div className="flex flex-col space-y-1.5">
      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={isOpen}
            className={cn(
              "justify-between w-full", 
              selectedCustomer ? "text-foreground" : "text-muted-foreground"
            )}
          >
            {selectedCustomer 
              ? selectedCustomer.customer_name
              : `Select ${label}...`}
            <div className="flex items-center">
              {selectedCustomer && (
                <X 
                  className="mr-1 h-4 w-4 hover:text-destructive" 
                  onClick={handleClear}
                />
              )}
              <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
            </div>
          </Button>
        </PopoverTrigger>
        <PopoverContent className="p-0 w-[400px]" align="start">
          <Command shouldFilter={false}>
            <CommandInput 
              placeholder={`Search ${label.toLowerCase()} by name, city, or address...`}
              className="h-9"
              value={searchQuery}
              onValueChange={setSearchQuery}
            />
            <CommandList>
              <CommandEmpty>
                {isLoading ? (
                  <div className="py-6 text-center">
                    <div className="animate-spin h-5 w-5 border-2 border-gray-300 rounded-full border-t-blue-600 mx-auto"></div>
                    <p className="text-sm text-gray-500 mt-2">Loading customers...</p>
                  </div>
                ) : error ? (
                  <div className="py-6 text-center text-red-500">
                    <p className="text-sm">{error}</p>
                    <button
                      className="text-xs text-blue-500 mt-2 hover:underline"
                      onClick={() => fetchCustomers()}
                    >
                      Retry
                    </button>
                  </div>
                ) : (
                  <div className="py-6 text-center">
                    <p className="text-sm text-gray-500">No customers found</p>
                    <p className="text-xs text-gray-400 mt-1">Try a different search term</p>
                  </div>
                )}
              </CommandEmpty>
              {!isLoading && filteredCustomers.length > 0 && (
                <CommandGroup heading="Customers">
                  {filteredCustomers.slice(0, 100).map((customer) => (
                    <div 
                      key={customer.id}
                      onClick={() => selectCustomer(customer)}
                      className="flex items-center justify-between py-2 px-2 cursor-pointer hover:bg-accent rounded-sm"
                    >
                      <div>
                        <p className="font-medium">{customer.customer_name}</p>
                        <p className="text-xs text-muted-foreground">
                          {[customer.address, customer.city, customer.state].filter(Boolean).join(', ')}
                        </p>
                      </div>
                      {selectedCustomer?.id === customer.id && <Check className="h-4 w-4 text-primary" />}
                    </div>
                  ))}
                  {filteredCustomers.length > 100 && (
                    <div className="py-2 px-2 text-xs text-gray-500 text-center border-t">
                      Showing first 100 results. Refine your search to see more.
                    </div>
                  )}
                </CommandGroup>
              )}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
} 