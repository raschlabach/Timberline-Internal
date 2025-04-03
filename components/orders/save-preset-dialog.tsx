"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { OrderFormState } from "@/types/orders";
import { CreatePresetRequest } from "@/types/presets";
import { cn } from "@/lib/utils";

// Predefined colors for presets
const PRESET_COLORS = [
  { value: "#EF4444", label: "Red" },
  { value: "#F97316", label: "Orange" },
  { value: "#EAB308", label: "Yellow" },
  { value: "#22C55E", label: "Green" },
  { value: "#3B82F6", label: "Blue" },
  { value: "#6366F1", label: "Indigo" },
  { value: "#A855F7", label: "Purple" },
  { value: "#EC4899", label: "Pink" }
] as const;

type PresetColor = typeof PRESET_COLORS[number]["value"];

interface SavePresetDialogProps {
  isOpen: boolean;
  onClose: () => void;
  formState: OrderFormState;
}

export function SavePresetDialog({ isOpen, onClose, formState }: SavePresetDialogProps) {
  const [name, setName] = useState("");
  const [color, setColor] = useState<PresetColor>(PRESET_COLORS[0].value);
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    if (!name.trim()) {
      alert("Please enter a name for the preset");
      return;
    }

    setIsSaving(true);

    try {
      const presetData: CreatePresetRequest = {
        name: name.trim(),
        color,
        pickupCustomer: formState.pickupCustomer,
        deliveryCustomer: formState.deliveryCustomer,
        payingCustomer: formState.payingCustomer,
        filters: formState.filters,
        freightType: formState.freightType,
        skidsVinyl: formState.skidsVinyl,
        footage: formState.footage,
        comments: formState.comments,
        freightQuote: formState.freightQuote,
        statusFlags: formState.statusFlags,
        links: formState.links
      };

      const response = await fetch("/api/presets", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(presetData),
      });

      if (!response.ok) {
        throw new Error("Failed to save preset");
      }

      const result = await response.json();
      
      // Dispatch event to notify of new preset
      window.dispatchEvent(new CustomEvent('presetCreated', { 
        detail: { presetId: result.id }
      }));

      // Reset form and close dialog
      setName("");
      setColor(PRESET_COLORS[0].value);
      onClose();

    } catch (error) {
      console.error("Error saving preset:", error);
      alert("Failed to save preset. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Save as Preset</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="name">Preset Name</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter a name for this preset"
            />
          </div>

          <div className="space-y-2">
            <Label>Color</Label>
            <div className="grid grid-cols-8 gap-2">
              {PRESET_COLORS.map((presetColor) => (
                <button
                  key={presetColor.value}
                  type="button"
                  className={cn(
                    "w-8 h-8 rounded-full transition-all",
                    "hover:scale-110 focus:outline-none focus:ring-2 focus:ring-offset-2",
                    color === presetColor.value ? "ring-2 ring-offset-2 ring-black" : ""
                  )}
                  style={{ backgroundColor: presetColor.value }}
                  onClick={() => setColor(presetColor.value)}
                  title={presetColor.label}
                />
              ))}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving ? "Saving..." : "Save Preset"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
} 