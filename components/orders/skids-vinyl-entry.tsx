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
  const initialRenderRef = useRef(true);

  // Update parent component when local state changes, but not on initial render
  useEffect(() => {
    if (initialRenderRef.current) {
      initialRenderRef.current = false;
      return;
    }

    // Only update parent if the items have changed from what was passed in
    if (JSON.stringify(items) !== JSON.stringify(skidsVinyl)) {
      onUpdate(items);
    }
  }, [items, onUpdate, skidsVinyl]);

  // Effect to sync with parent state
  useEffect(() => {
    console.log('SkidsVinylEntry received new props:', { skidsVinyl, currentItems: items });
    
    // Always update local state to match props
    setItems(skidsVinyl);
    
    // If this is a reset (empty array), also reset the initialRenderRef
    if (skidsVinyl.length === 0) {
      console.log('Resetting initialRenderRef due to empty skidsVinyl');
      initialRenderRef.current = true;
    }
  }, [skidsVinyl]);

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

  // Add a new skid
  const addSkid = useCallback(() => {
    const nextNumber = getNextNumber('skid');
    const newSkid: SkidData = {
      id: uuidv4(),
      number: nextNumber,
      width: 0,
      length: 0,
      footage: 0,
      type: 'skid'
    };
    
    console.log(`Adding Skid ${nextNumber}`);
    setItems(prevItems => [...prevItems, newSkid]);
  }, [getNextNumber]);

  // Add a new vinyl
  const addVinyl = useCallback(() => {
    const nextNumber = getNextNumber('vinyl');
    const newVinyl: SkidData = {
      id: uuidv4(),
      number: nextNumber,
      width: 0,
      length: 0,
      footage: 0,
      type: 'vinyl'
    };
    
    console.log(`Adding Vinyl ${nextNumber}`);
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

  // Calculate total footage
  const totalFootage = items.reduce((sum, item) => sum + item.footage, 0);

  return (
    <div className="space-y-4">
      {/* Display all skids and vinyl */}
      <div className="space-y-2">
        {items.length === 0 ? (
          <p className="text-gray-500 text-center py-4">
            No items added yet. Add skids or vinyl using the buttons below.
          </p>
        ) : (
          <>
            {/* Header */}
            <div className="grid grid-cols-12 gap-2 font-medium text-sm text-gray-500 mb-2">
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
            
            {/* Total footage */}
            <div className="border-t pt-2 mt-4 flex justify-between">
              <span className="font-medium">Total Footage:</span>
              <span className="font-medium">{totalFootage.toFixed(2)} ft²</span>
            </div>
          </>
        )}
      </div>
      
      {/* Add buttons */}
      <div className="flex gap-2">
        <Button 
          type="button" 
          variant="outline" 
          onClick={addSkid}
          className="flex-1"
        >
          <Plus className="h-4 w-4 mr-2" />
          Add Skid
        </Button>
        
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