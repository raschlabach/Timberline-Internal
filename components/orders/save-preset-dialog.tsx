"use client";

import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { OrderFormState } from "@/types/orders";
import { CreatePresetRequest } from "@/types/presets";
import { cn } from "@/lib/utils";
import { toast } from "sonner";


interface SavePresetDialogProps {
  isOpen: boolean;
  onClose: () => void;
  formState: OrderFormState;
}

export function SavePresetDialog({ isOpen, onClose, formState }: SavePresetDialogProps) {
  const [name, setName] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  // Reset form state when dialog opens
  useEffect(() => {
    if (isOpen) {
      setName("");
      setIsSaving(false);
    }
  }, [isOpen]);

  const handleSave = async () => {
    if (!name.trim()) {
      toast.error("Please enter a name for the preset");
      return;
    }

    setIsSaving(true);

    try {
      const presetData: CreatePresetRequest = {
        name: name.trim(),
        color: '#808080', // Default gray color
        pickupCustomer: formState.pickupCustomer,
        deliveryCustomer: formState.deliveryCustomer,
        payingCustomer: formState.payingCustomer,
        filters: formState.filters,
        freightType: formState.freightType,
        skidsVinyl: formState.skidsVinyl,
        footage: formState.footage,
        handBundles: formState.handBundles,
        comments: formState.comments,
        freightQuote: formState.freightQuote,
        statusFlags: formState.statusFlags,
        links: formState.links
      };

      console.log('Sending preset data:', presetData);
      
      const response = await fetch("/api/presets", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(presetData),
      });

      console.log('Response status:', response.status);
      console.log('Response ok:', response.ok);

      if (!response.ok) {
        let errorMessage = "Failed to save preset";
        try {
          const errorData = await response.json();
          errorMessage = errorData.message || errorData.error || errorMessage;
        } catch (e) {
          errorMessage = `HTTP ${response.status}: ${response.statusText}`;
        }
        throw new Error(errorMessage);
      }

      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.message || "Failed to save preset");
      }
      
      // Dispatch event to notify of new preset
      window.dispatchEvent(new CustomEvent('presetCreated', { 
        detail: { presetId: result.preset?.id }
      }));

      toast.success("Preset saved successfully!");

      // Reset form and close dialog
      setName("");
      onClose();

    } catch (error) {
      console.error("Error saving preset:", error);
      const errorMessage = error instanceof Error ? error.message : "Failed to save preset. Please try again.";
      toast.error(errorMessage);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Save as Preset</DialogTitle>
          <DialogDescription>
            Save the current order form data as a reusable preset for faster order entry.
          </DialogDescription>
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