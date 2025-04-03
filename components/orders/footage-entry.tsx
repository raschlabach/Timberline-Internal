"use client";

import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FootageEntryProps } from "@/types/orders";

export function FootageEntry({ footage, onUpdate }: FootageEntryProps) {
  const [value, setValue] = useState<string>(footage.toString());

  // Update parent component when local state changes
  useEffect(() => {
    const numericValue = parseFloat(value) || 0;
    onUpdate(numericValue);
  }, [value, onUpdate]);

  return (
    <div className="space-y-4">
      <div>
        <Label htmlFor="footage" className="mb-2 block">
          Total Footage
        </Label>
        <div className="flex items-center">
          <Input
            id="footage"
            type="number"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="Enter total footage"
            className="w-full"
            min="0"
            step="0.01"
          />
          <span className="ml-2 text-gray-700">ft²</span>
        </div>
        <p className="text-sm text-muted-foreground mt-1">
          Enter the total footage for this load
        </p>
      </div>
    </div>
  );
} 