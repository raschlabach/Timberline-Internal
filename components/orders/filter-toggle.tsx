"use client";

import React from "react";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { FilterToggleProps } from "@/types/orders";

export function FilterToggle({ label, checked, onCheckedChange }: FilterToggleProps) {
  // Create a stable ID for the switch element
  const id = React.useMemo(() => 
    `filter-${label.toLowerCase().replace(/\s+/g, '-')}`, 
    [label]
  );
  
  return (
    <div className="flex items-center space-x-2">
      <Switch 
        id={id}
        checked={checked} 
        onCheckedChange={onCheckedChange}
      />
      <Label 
        htmlFor={id}
        className="cursor-pointer"
      >
        {label}
      </Label>
    </div>
  );
} 