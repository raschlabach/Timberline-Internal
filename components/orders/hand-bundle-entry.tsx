"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Trash2 } from "lucide-react";
import { HandBundleData, HandBundleEntryProps } from "@/types/orders";

export function HandBundleEntry({ handBundles, onUpdate }: HandBundleEntryProps) {
  const [items, setItems] = useState<HandBundleData[]>(handBundles);
  const isInitialMount = useRef(true);

  // Sync local state with props when they change
  useEffect(() => {
    // Skip the first render to avoid unnecessary updates
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }
    
    setItems(handBundles);
  }, [handBundles]);

  // Update parent when local state changes (debounced)
  useEffect(() => {
    // Skip the first render to avoid unnecessary updates
    if (isInitialMount.current) {
      return;
    }

    const timeoutId = setTimeout(() => {
      onUpdate(items);
    }, 100);

    return () => clearTimeout(timeoutId);
  }, [items, onUpdate]);

  // Add a new hand bundle
  const addHandBundle = useCallback(() => {
    const newItem: HandBundleData = {
      id: `hand-bundle-${Date.now()}`,
      quantity: 1,
      description: "Hand Bundle"
    };
    setItems(prevItems => [...prevItems, newItem]);
  }, []);

  // Update an existing hand bundle
  const updateItem = useCallback((updatedItem: HandBundleData) => {
    setItems(prevItems => 
      prevItems.map(item => 
        item.id === updatedItem.id ? updatedItem : item
      )
    );
  }, []);

  // Delete a hand bundle
  const deleteItem = useCallback((id: string) => {
    setItems(prevItems => prevItems.filter(item => item.id !== id));
  }, []);

  return (
    <div className="space-y-3">
      {/* Display all hand bundles */}
      <div className="space-y-2">
        {items.length === 0 ? (
          <p className="text-gray-500 text-center py-4">
            No hand bundles added yet. Add hand bundles using the button below.
          </p>
        ) : (
          <>
            {/* Header */}
            <div className="grid grid-cols-12 gap-2 font-medium text-xs text-gray-500 mb-1">
              <div className="col-span-2">Item</div>
              <div className="col-span-2">Quantity</div>
              <div className="col-span-7">Description</div>
              <div className="col-span-1"></div>
            </div>
            
            {/* Items */}
            {items.map((item, index) => (
              <HandBundleRow
                key={item.id}
                handBundle={item}
                onUpdate={updateItem}
                onDelete={deleteItem}
              />
            ))}
          </>
        )}
      </div>
      
      {/* Add button */}
      <div className="flex gap-2 mt-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={addHandBundle}
          className="flex items-center gap-2"
        >
          <Plus className="h-4 w-4" />
          Add Hand Bundle
        </Button>
      </div>
    </div>
  );
}

interface HandBundleRowProps {
  handBundle: HandBundleData;
  onUpdate: (handBundle: HandBundleData) => void;
  onDelete: (id: string) => void;
}

function HandBundleRow({ handBundle, onUpdate, onDelete }: HandBundleRowProps) {
  const [quantity, setQuantity] = useState<string>(handBundle.quantity.toString());
  const [description, setDescription] = useState<string>(handBundle.description);

  // Update parent when local state changes (debounced)
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      onUpdate({
        ...handBundle,
        quantity: parseInt(quantity) || 1,
        description: description.trim() || "Hand Bundle"
      });
    }, 150);
    
    return () => clearTimeout(timeoutId);
  }, [quantity, description, handBundle, onUpdate]);

  // Handle quantity change
  const handleQuantityChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setQuantity(e.target.value);
  };
  
  // Handle description change
  const handleDescriptionChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setDescription(e.target.value);
  };

  return (
    <div className="grid grid-cols-12 gap-2 items-center mb-1">
      <div className="col-span-2 flex items-center">
        <span className="font-medium text-sm">Hand Bundle:</span>
      </div>
      
      <div className="col-span-2">
        <Input
          type="number"
          placeholder="Qty"
          value={quantity}
          onChange={handleQuantityChange}
          className="w-full"
          min="1"
          step="1"
        />
      </div>
      
      <div className="col-span-7">
        <Input
          type="text"
          placeholder="Description"
          value={description}
          onChange={handleDescriptionChange}
          className="w-full"
        />
      </div>
      
      <div className="col-span-1 flex justify-end">
        <Button
          type="button"
          size="icon"
          variant="ghost"
          onClick={() => onDelete(handBundle.id)}
          className="h-8 w-8 text-red-500 hover:text-red-700"
          title="Delete"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
