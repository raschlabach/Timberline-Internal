"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Plus } from "lucide-react";
import { SkidEntryRow } from "./skid-entry-row";
import { v4 as uuidv4 } from "uuid";
import { SkidData } from "@/types/shared";

interface SkidsVinylEntryProps {
  skidsVinyl: SkidData[];
  onUpdate: (skidsVinyl: SkidData[]) => void;
}

export function SkidsVinylEntry({ skidsVinyl, onUpdate }: SkidsVinylEntryProps) {
  const [items, setItems] = useState<SkidData[]>(skidsVinyl);
  const isInitialMount = useRef(true);

  // Sync local state with props when they change
  useEffect(() => {
    // Skip the first render to avoid unnecessary updates
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }
    
    setItems(skidsVinyl);
  }, [skidsVinyl]);

  // Update parent when local state changes (debounced)
  useEffect(() => {
    // Skip the first render to avoid unnecessary updates
    if (isInitialMount.current) {
      return;
    }

    const timeoutId = setTimeout(() => {
      onUpdate(items);
    }, 100); // Reduced debounce time for better responsiveness

    return () => clearTimeout(timeoutId);
  }, [items, onUpdate]);

  // Calculate the next number for a type
  const getNextNumber = useCallback((type: 'skid' | 'vinyl'): number => {
    const existingItems = items.filter(item => item.type === type);
    if (existingItems.length === 0) return 1;
    
    // Find the highest number and add 1
    const maxNumber = Math.max(...existingItems.map(item => item.number));
    return maxNumber + 1;
  }, [items]);

  // Renumber items of a specific type to be sequential
  const renumberItems = useCallback((itemsToRenumber: SkidData[], type: 'skid' | 'vinyl'): SkidData[] => {
    // Filter items of the specified type
    const typeItems = itemsToRenumber.filter(item => item.type === type);
    const otherItems = itemsToRenumber.filter(item => item.type !== type);
    
    // Sort by current number
    typeItems.sort((a, b) => a.number - b.number);
    
    // Renumber sequentially
    const renumbered = typeItems.map((item, index) => ({
      ...item,
      number: index + 1 // Start from 1
    }));
    
    // Return the combined array
    return [...renumbered, ...otherItems];
  }, []);

  // Add a new skid with specified dimensions
  const addSkid = useCallback((width: number, length: number) => {
    const nextNumber = getNextNumber('skid');
    const footage = width * length;
    
    const newSkid: SkidData = {
      id: uuidv4(),
      number: nextNumber,
      width: width,
      length: length,
      footage: footage,
      type: 'skid'
    };
    
    console.log(`Adding Skid ${nextNumber} with dimensions ${width}x${length}`);
    setItems(prevItems => [...prevItems, newSkid]);
  }, [getNextNumber]);

  // Add a 4x4 skid
  const addSkid4x4 = useCallback(() => {
    addSkid(4, 4);
  }, [addSkid]);

  // Add a 4x3 skid
  const addSkid4x3 = useCallback(() => {
    addSkid(4, 3);
  }, [addSkid]);

  // Add a full load (8x53 skid)
  const addFullLoad = useCallback(() => {
    addSkid(8, 53);
  }, [addSkid]);

  // Add a new vinyl
  const addVinyl = useCallback(() => {
    const nextNumber = getNextNumber('vinyl');
    
    // Set default dimensions for vinyl (4x12 for all customers)
    const defaultWidth = 4;
    const defaultLength = 12;
    const defaultFootage = defaultWidth * defaultLength;
    
    const newVinyl: SkidData = {
      id: uuidv4(),
      number: nextNumber,
      width: defaultWidth,
      length: defaultLength,
      footage: defaultFootage,
      type: 'vinyl'
    };
    
    console.log(`Adding Vinyl ${nextNumber} with default dimensions ${defaultWidth}x${defaultLength}`);
    setItems(prevItems => [...prevItems, newVinyl]);
  }, [getNextNumber]);

  // Update a specific skid
  const updateItem = useCallback((updatedItem: SkidData) => {
    setItems(prev => 
      prev.map(item => 
        item.id === updatedItem.id ? updatedItem : item
      )
    );
  }, []);

  // Delete a skid and renumber remaining items
  const deleteItem = useCallback((id: string) => {
    setItems(prev => {
      // First, identify the type of the item being deleted
      const itemToDelete = prev.find(item => item.id === id);
      if (!itemToDelete) return prev;
      
      const itemType = itemToDelete.type;
      
      // Filter out the deleted item
      const filteredItems = prev.filter(item => item.id !== id);
      
      // Renumber all items of the same type
      return renumberItems(filteredItems, itemType);
    });
  }, [renumberItems]);

  // Duplicate a skid
  const duplicateItem = useCallback((item: SkidData) => {
    const nextNumber = getNextNumber(item.type);
    const newItem: SkidData = {
      ...item,
      id: uuidv4(),
      number: nextNumber,
    };
    
    console.log(`Duplicating ${item.type} as #${nextNumber}`);
    setItems(prevItems => [...prevItems, newItem]);
  }, [getNextNumber]);

  // Calculate totals and group by dimensions
  const totalFootage = items.reduce((sum, item) => sum + item.footage, 0);
  const totalSkids = items.filter(item => item.type === 'skid').length;
  const totalVinyl = items.filter(item => item.type === 'vinyl').length;

  // Group items by type and dimensions
  const groupByDimensions = useCallback((items: SkidData[]) => {
    const groups: { [key: string]: { count: number; type: 'skid' | 'vinyl'; width: number; length: number } } = {};
    
    items.forEach(item => {
      const key = `${item.type}-${item.width}-${item.length}`;
      if (groups[key]) {
        groups[key].count++;
      } else {
        groups[key] = {
          count: 1,
          type: item.type,
          width: item.width,
          length: item.length
        };
      }
    });
    
    return Object.values(groups);
  }, []);

  const groupedItems = groupByDimensions(items);
  const skidGroups = groupedItems.filter(g => g.type === 'skid');
  const vinylGroups = groupedItems.filter(g => g.type === 'vinyl');

  return (
    <div className="space-y-3">
      {/* Display all skids and vinyl */}
      <div className="space-y-1">
        {items.length === 0 ? (
          <p className="text-gray-500 text-center py-4">
            No items added yet. Add skids or vinyl using the buttons below.
          </p>
        ) : (
          <>
            {/* Header */}
            <div className="grid grid-cols-12 gap-2 font-medium text-xs text-gray-500 mb-1">
              <div className="col-span-2">Item</div>
              <div className="col-span-3">Width</div>
              <div className="col-span-1"></div>
              <div className="col-span-3">Length</div>
              <div className="col-span-2">Footage</div>
              <div className="col-span-1"></div>
            </div>
            
            {/* Items */}
            {items.map(item => (
              <SkidEntryRow
                key={item.id}
                skid={item}
                onUpdate={updateItem}
                onDelete={deleteItem}
                onDuplicate={duplicateItem}
              />
            ))}
            
            {/* Totals row with grouped display */}
            <div className="grid grid-cols-12 gap-2 border-t-2 pt-2 mt-2 font-semibold text-sm bg-gray-50 px-2 py-1 rounded">
              <div className="col-span-2 text-gray-900">Totals:</div>
              <div className="col-span-8 text-gray-700 text-sm font-normal">
                <div className="flex flex-wrap gap-x-4 gap-y-1">
                  {skidGroups.length > 0 && (
                    <span>
                      <span className="font-semibold">Skids:</span>{' '}
                      {skidGroups.map((g, idx) => (
                        <span key={idx}>
                          {g.count}-{g.width}x{g.length}
                          {idx < skidGroups.length - 1 ? ', ' : ''}
                        </span>
                      ))}
                    </span>
                  )}
                  {vinylGroups.length > 0 && (
                    <span>
                      <span className="font-semibold">Vinyl:</span>{' '}
                      {vinylGroups.map((g, idx) => (
                        <span key={idx}>
                          {g.count}-{g.width}x{g.length}
                          {idx < vinylGroups.length - 1 ? ', ' : ''}
                        </span>
                      ))}
                    </span>
                  )}
                </div>
              </div>
              <div className="col-span-2 text-gray-900 text-right">{totalFootage.toFixed(2)} ft²</div>
            </div>
          </>
        )}
      </div>
      
      {/* Add buttons */}
      <div className="flex gap-2 mt-2">
        <div className="flex gap-1 flex-1">
          <Button 
            type="button" 
            variant="outline" 
            onClick={addSkid4x4}
            className="flex-1"
          >
            <Plus className="h-4 w-4 mr-2" />
            Add 4×4 Skid
          </Button>
          
          <Button 
            type="button" 
            variant="outline" 
            onClick={addSkid4x3}
            className="flex-1"
          >
            <Plus className="h-4 w-4 mr-2" />
            Add 4×3 Skid
          </Button>
          
          <Button 
            type="button" 
            variant="outline" 
            onClick={addFullLoad}
            className="flex-1"
          >
            <Plus className="h-4 w-4 mr-2" />
            Full Load
          </Button>
        </div>
        
        <Button 
          type="button" 
          variant="outline" 
          onClick={addVinyl}
          className="flex-1"
        >
          <Plus className="h-4 w-4 mr-2" />
          Add Vinyl
        </Button>
      </div>
    </div>
  );
} 