"use client";

import { useEffect, useState } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Pencil, Trash2 } from "lucide-react";
import { OrderFormState } from "@/types/orders";
import { OrderPreset, PresetResponse } from "@/types/presets";

interface PresetsListProps {
  onSelectPreset: (formState: Partial<OrderFormState>) => void;
}

export function PresetsList({ onSelectPreset }: PresetsListProps) {
  const [presets, setPresets] = useState<OrderPreset[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch presets
  const fetchPresets = async () => {
    try {
      console.log('Fetching presets...');
      const response = await fetch("/api/presets");
      console.log('Response status:', response.status);
      
      const data = await response.json();
      console.log('Raw response data:', data);

      if (!response.ok) {
        throw new Error(data.message || data.error || 'Failed to fetch presets');
      }

      if (!data.success) {
        throw new Error(data.message || data.error || 'Failed to fetch presets');
      }

      if (!Array.isArray(data.presets)) {
        console.error('Invalid presets data:', data);
        throw new Error('Invalid presets data received from server');
      }

      console.log('Setting presets:', data.presets);
      setPresets(data.presets);
      setError(null);
    } catch (err) {
      console.error('Error in fetchPresets:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to load presets';
      console.error('Error details:', errorMessage);
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  // Initial fetch
  useEffect(() => {
    fetchPresets();

    // Listen for preset creation events
    const handlePresetCreated = () => {
      console.log('Preset created, refreshing list...');
      fetchPresets();
    };

    window.addEventListener('presetCreated', handlePresetCreated);

    // Cleanup
    return () => {
      window.removeEventListener('presetCreated', handlePresetCreated);
    };
  }, []);

  // Handle preset selection
  const handlePresetClick = (preset: OrderPreset) => {
    console.log('Selected preset:', preset);
    
    // Ensure skids/vinyl data has all required fields
    const skidsVinyl = preset.skidsVinyl.map(item => ({
      ...item,
      id: item.id || Math.random().toString(36).substr(2, 9),
      isNew: false,
      isEditing: false,
      type: item.type || 'skid',
      width: item.width || 0,
      length: item.length || 0,
      footage: item.footage || 0,
      number: item.number || 1
    }));

    const formState: Partial<OrderFormState> = {
      pickupCustomer: preset.pickupCustomer ? {
        id: preset.pickupCustomer.id,
        customer_name: preset.pickupCustomer.customer_name,
        address: preset.pickupCustomer.address || '',
        city: '',
        state: '',
        zip_code: '',
        county: '',
        phone_number_1: '',
        phone_number_2: '',
        quotes: '',
        notes: ''
      } : null,
      deliveryCustomer: preset.deliveryCustomer ? {
        id: preset.deliveryCustomer.id,
        customer_name: preset.deliveryCustomer.customer_name,
        address: preset.deliveryCustomer.address || '',
        city: '',
        state: '',
        zip_code: '',
        county: '',
        phone_number_1: '',
        phone_number_2: '',
        quotes: '',
        notes: ''
      } : null,
      payingCustomer: preset.payingCustomer ? {
        id: preset.payingCustomer.id,
        customer_name: preset.payingCustomer.customer_name,
        address: '',
        city: '',
        state: '',
        zip_code: '',
        county: '',
        phone_number_1: '',
        phone_number_2: '',
        quotes: '',
        notes: ''
      } : null,
      filters: preset.filters,
      freightType: preset.freightType,
      skidsVinyl,
      footage: preset.footage,
      comments: preset.comments,
      freightQuote: preset.freightQuote,
      statusFlags: preset.statusFlags,
      links: preset.links
    };

    console.log('Setting form state with skids/vinyl:', skidsVinyl);
    onSelectPreset(formState);
  };

  // Handle preset deletion
  const handleDelete = async (id: number, e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent triggering the preset selection

    if (!confirm("Are you sure you want to delete this preset?")) {
      return;
    }

    try {
      console.log('Deleting preset:', id);
      const response = await fetch(`/api/presets/${id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to delete preset');
      }

      // Refresh the list
      fetchPresets();
    } catch (error) {
      console.error("Error deleting preset:", error);
      alert("Failed to delete preset. Please try again.");
    }
  };

  if (isLoading) {
    return <div className="text-sm text-muted-foreground p-4">Loading presets...</div>;
  }

  if (error) {
    return (
      <div className="text-sm text-red-500 p-4">
        <p>{error}</p>
        <Button 
          variant="outline" 
          size="sm" 
          className="mt-2"
          onClick={() => {
            setIsLoading(true);
            setError(null);
            fetchPresets();
          }}
        >
          Try Again
        </Button>
      </div>
    );
  }

  return (
    <ScrollArea className="h-[300px]">
      <div className="divide-y divide-slate-200">
        {presets.length === 0 ? (
          <p className="text-sm text-muted-foreground p-4 text-center">
            No presets saved yet. Create a preset by clicking "Save as Preset" when creating an order.
          </p>
        ) : (
          presets.map((preset) => (
            <button
              key={preset.id}
              onClick={() => handlePresetClick(preset)}
              className="w-full text-left px-3 py-2 hover:bg-slate-100 transition-colors group flex items-center justify-between"
              style={{ borderLeft: `4px solid ${preset.color}` }}
            >
              <div className="flex-1 min-w-0">
                <div className="font-medium text-sm">{preset.name}</div>
                <div className="text-xs text-slate-500 truncate">
                  {preset.pickupCustomer?.customer_name && `From: ${preset.pickupCustomer.customer_name}`}
                  {preset.deliveryCustomer?.customer_name && ` To: ${preset.deliveryCustomer.customer_name}`}
                </div>
              </div>
              
              <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={(e) => handleDelete(preset.id, e)}
                >
                  <Trash2 className="h-4 w-4 text-red-500" />
                </Button>
              </div>
            </button>
          ))
        )}
      </div>
    </ScrollArea>
  );
} 