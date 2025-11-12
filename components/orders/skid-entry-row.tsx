"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Trash2, Copy } from "lucide-react";
import { SkidData } from "@/types/shared";

interface SkidEntryRowProps {
  skid: SkidData;
  onUpdate: (skid: SkidData) => void;
  onDelete: (id: string) => void;
  onDuplicate: (skid: SkidData) => void;
}

export function SkidEntryRow({ skid, onUpdate, onDelete, onDuplicate }: SkidEntryRowProps) {
  const [width, setWidth] = useState<string>(skid.width.toString());
  const [length, setLength] = useState<string>(skid.length.toString());
  const [footage, setFootage] = useState<number>(skid.footage);
  
  // Memoize the update function to avoid recreating it on every render
  const updateParent = useCallback((widthVal: number, lengthVal: number, calculatedFootage: number) => {
    onUpdate({
      ...skid,
      width: widthVal,
      length: lengthVal,
      footage: calculatedFootage
    });
  }, [skid, onUpdate]);

  // Calculate footage when width or length changes
  useEffect(() => {
    const widthVal = parseFloat(width) || 0;
    const lengthVal = parseFloat(length) || 0;
    const calculatedFootage = widthVal * lengthVal;
    
    setFootage(calculatedFootage);
    
    // Update parent with a short debounce for better performance
    const timeoutId = setTimeout(() => {
      updateParent(widthVal, lengthVal, calculatedFootage);
    }, 150);
    
    return () => clearTimeout(timeoutId);
  }, [width, length, updateParent]);

  // Handle width change
  const handleWidthChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setWidth(e.target.value);
  };
  
  // Handle length change
  const handleLengthChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setLength(e.target.value);
  };
  
  // Handle focus to clear the field if it contains only a zero
  const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    if (e.target.value === "0") {
      e.target.value = "";
      if (e.target.name === "width") {
        setWidth("");
      } else if (e.target.name === "length") {
        setLength("");
      }
    }
  };

  return (
    <div className="grid grid-cols-12 gap-2 items-center mb-1">
      <div className="col-span-2 flex items-center">
        <span className="font-medium mr-2 text-sm">{skid.type === 'skid' ? 'Skid' : 'Vinyl'} {skid.number}:</span>
      </div>
      
      <div className="col-span-3">
        <Input
          type="number"
          name="width"
          placeholder="Width"
          value={width}
          onChange={handleWidthChange}
          onFocus={handleFocus}
          className="w-full"
          min="0"
          step="0.01"
        />
      </div>
      
      <div className="col-span-1 flex justify-center">
        <span className="text-gray-500">×</span>
      </div>
      
      <div className="col-span-3">
        <Input
          type="number"
          name="length"
          placeholder="Length"
          value={length}
          onChange={handleLengthChange}
          onFocus={handleFocus}
          className="w-full"
          min="0"
          step="0.01"
        />
      </div>
      
      <div className="col-span-2">
        <span className="text-gray-700 text-sm">{footage.toFixed(2)} ft²</span>
      </div>
      
      <div className="col-span-1 flex justify-end space-x-1">
        <Button
          type="button"
          size="icon"
          variant="ghost"
          onClick={() => onDuplicate(skid)}
          className="h-8 w-8"
          title="Duplicate"
        >
          <Copy className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          size="icon"
          variant="ghost"
          onClick={() => onDelete(skid.id)}
          className="h-8 w-8 text-red-500 hover:text-red-700"
          title="Delete"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
} 