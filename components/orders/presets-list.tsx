"use client";

import { useEffect, useState, useRef } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Pencil, Trash2, GripVertical, Check, X, Search, ChevronDown, ChevronRight, Star } from "lucide-react";
import { OrderFormState } from "@/types/orders";
import { OrderPreset, PresetResponse } from "@/types/presets";
import { toast } from "sonner";

interface PresetsListProps {
  onSelectPreset: (formState: Partial<OrderFormState>) => void;
}

export function PresetsList({ onSelectPreset }: PresetsListProps) {
  const [presets, setPresets] = useState<OrderPreset[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editingName, setEditingName] = useState<string>("");
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [isReordering, setIsReordering] = useState(false);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());

  // Filter presets based on search query
  const filteredPresets = presets.filter(preset => {
    if (!searchQuery.trim()) return true;
    
    const query = searchQuery.toLowerCase();
    return (
      preset.name.toLowerCase().includes(query) ||
      preset.pickupCustomer?.customer_name?.toLowerCase().includes(query) ||
      preset.deliveryCustomer?.customer_name?.toLowerCase().includes(query) ||
      preset.payingCustomer?.customer_name?.toLowerCase().includes(query)
    );
  });

  // Group presets by customers (combine pickup and delivery for same customer)
  const groupedPresets = filteredPresets.reduce((groups, preset) => {
    // Add to pickup customer group
    if (preset.pickupCustomer?.customer_name) {
      const customerKey = preset.pickupCustomer.customer_name;
      if (!groups[customerKey]) {
        groups[customerKey] = {
          customerName: preset.pickupCustomer.customer_name,
          presets: []
        };
      }
      // Only add if not already in the group (avoid duplicates)
      if (!groups[customerKey].presets.find(p => p.id === preset.id)) {
        groups[customerKey].presets.push(preset);
      }
    }

    // Add to delivery customer group
    if (preset.deliveryCustomer?.customer_name) {
      const customerKey = preset.deliveryCustomer.customer_name;
      if (!groups[customerKey]) {
        groups[customerKey] = {
          customerName: preset.deliveryCustomer.customer_name,
          presets: []
        };
      }
      // Only add if not already in the group (avoid duplicates)
      if (!groups[customerKey].presets.find(p => p.id === preset.id)) {
        groups[customerKey].presets.push(preset);
      }
    }

    return groups;
  }, {} as Record<string, { customerName: string, presets: OrderPreset[] }>);

  // Create favorites group
  const favoritesPresets = filteredPresets.filter(preset => preset.isFavorite);
  if (favoritesPresets.length > 0) {
    groupedPresets['__FAVORITES__'] = {
      customerName: 'Favorites',
      presets: favoritesPresets
    };
  }

  // Convert to array and sort by customer name (Favorites first)
  const sortedGroups = Object.entries(groupedPresets)
    .sort(([keyA, a], [keyB, b]) => {
      // Favorites group always comes first
      if (keyA === '__FAVORITES__') return -1;
      if (keyB === '__FAVORITES__') return 1;
      // Then sort alphabetically
      return a.customerName.localeCompare(b.customerName);
    });

  // Initialize all groups as collapsed when groups change (except Favorites)
  useEffect(() => {
    if (sortedGroups.length > 0) {
      const allGroupKeys = sortedGroups.map(([key]) => key);
      // Keep Favorites group expanded, collapse all others
      const collapsedKeys = allGroupKeys.filter(key => key !== '__FAVORITES__');
      setCollapsedGroups(new Set(collapsedKeys));
    }
  }, [sortedGroups.length]);

  // Toggle group collapse state
  const toggleGroup = (groupKey: string) => {
    setCollapsedGroups(prev => {
      const newSet = new Set(prev);
      if (newSet.has(groupKey)) {
        newSet.delete(groupKey);
      } else {
        newSet.add(groupKey);
      }
      return newSet;
    });
  };

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
      handBundles: preset.handBundles || [],
      comments: preset.comments || '',
      freightQuote: preset.freightQuote || '',
      statusFlags: preset.statusFlags,
      links: preset.links
    };

    console.log('Setting form state with skids/vinyl:', skidsVinyl);
    console.log('Preset comments value:', preset.comments, 'Type:', typeof preset.comments);
    console.log('Form state comments:', formState.comments);
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

      toast.success('Preset deleted successfully');
      // Refresh the list
      fetchPresets();
    } catch (error) {
      console.error("Error deleting preset:", error);
      toast.error("Failed to delete preset. Please try again.");
    }
  };

  // Handle toggle favorite
  const handleToggleFavorite = async (preset: OrderPreset, e: React.MouseEvent) => {
    e.stopPropagation();
    
    try {
      const response = await fetch('/api/presets/toggle-favorite', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          presetId: preset.id,
          isFavorite: !preset.isFavorite
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to update favorite status');
      }

      const result = await response.json();
      if (result.success) {
        // Update the preset in the local state
        setPresets(prev => prev.map(p => 
          p.id === preset.id ? { ...p, isFavorite: !p.isFavorite } : p
        ));
        toast.success(result.message);
      } else {
        throw new Error(result.message || 'Failed to update favorite status');
      }
    } catch (error) {
      console.error('Error toggling favorite:', error);
      toast.error('Failed to update favorite status. Please try again.');
    }
  };

  // Handle inline editing
  const handleEditStart = (preset: OrderPreset, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingId(preset.id);
    setEditingName(preset.name);
  };

  const handleEditSave = async () => {
    if (!editingId || !editingName.trim()) return;

    try {
      const response = await fetch(`/api/presets/${editingId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: editingName.trim(),
          // Include all other preset data to avoid overwriting
          ...presets.find(p => p.id === editingId)
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to update preset name');
      }

      toast.success('Preset name updated successfully');
      setEditingId(null);
      setEditingName("");
      fetchPresets();
    } catch (error) {
      console.error("Error updating preset:", error);
      toast.error("Failed to update preset name");
    }
  };

  const handleEditCancel = () => {
    setEditingId(null);
    setEditingName("");
  };

  // Handle drag and drop within groups
  const handleDragStart = (e: React.DragEvent, index: number, groupKey: string) => {
    setDraggedIndex(index);
    e.dataTransfer.setData('text/plain', JSON.stringify({ index, groupKey }));
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = async (e: React.DragEvent, dropIndex: number, groupKey: string) => {
    e.preventDefault();
    
    try {
      const dragData = JSON.parse(e.dataTransfer.getData('text/plain'));
      const { index: dragIndex, groupKey: dragGroupKey } = dragData;
      
      // Only allow reordering within the same group
      if (dragGroupKey !== groupKey || dragIndex === dropIndex) {
        setDraggedIndex(null);
        return;
      }

      setIsReordering(true);
      
      // Get the group that contains both the dragged and dropped items
      const targetGroup = groupedPresets[groupKey];
      if (!targetGroup) return;

      // Create new order for this group
      const newGroupPresets = [...targetGroup.presets];
      const draggedPreset = newGroupPresets[dragIndex];
      
      // Remove dragged item from its current position
      newGroupPresets.splice(dragIndex, 1);
      
      // Insert at new position
      newGroupPresets.splice(dropIndex, 0, draggedPreset);
      
      // Update the display_order for all presets in this group
      const presetUpdates = newGroupPresets.map((preset, index) => ({
        id: preset.id,
        display_order: index + 1
      }));
      
      // Send reorder request to server for this group
      const response = await fetch('/api/presets/reorder-group', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          groupKey,
          presetUpdates 
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to reorder presets');
      }

      toast.success('Presets reordered successfully');
      
      // Refresh the presets to get the updated order
      fetchPresets();
      
    } catch (error) {
      console.error('Error reordering presets:', error);
      toast.error('Failed to reorder presets');
    } finally {
      setDraggedIndex(null);
      setIsReordering(false);
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
    <div className="h-full flex flex-col">
      {/* Search Bar */}
      <div className="p-3 border-b border-slate-200 flex-shrink-0">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input
            placeholder="Search presets by name or customer..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 h-8 text-sm"
          />
        </div>
        {searchQuery && (
          <div className="text-xs text-slate-500 mt-1">
            {filteredPresets.length} of {presets.length} presets
          </div>
        )}
      </div>
      
      {/* Presets List */}
      <ScrollArea className="flex-1">
        <div>
          {sortedGroups.length === 0 ? (
            searchQuery ? (
              <div className="p-4 text-center">
                <div className="text-slate-400 mb-2">
                  <Search className="w-8 h-8 mx-auto" />
                </div>
                <p className="text-sm text-muted-foreground">No presets found</p>
                <p className="text-xs text-slate-400 mt-1">Try a different search term</p>
              </div>
            ) : (
              <div className="p-4 text-center">
                <div className="text-slate-400 mb-2">
                  <svg className="w-8 h-8 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
                  </svg>
                </div>
                <p className="text-sm text-muted-foreground">No presets saved yet</p>
                <p className="text-xs text-slate-400 mt-1">Create a preset by clicking "Save as Preset"</p>
              </div>
            )
          ) : (
            sortedGroups.map(([groupKey, group]) => {
              const isCollapsed = collapsedGroups.has(groupKey);
              
              return (
                <div key={groupKey} className="border-b border-slate-200 last:border-b-0">
                  {/* Group Header */}
                  <div 
                    className={`px-3 py-2 cursor-pointer transition-colors flex items-center justify-between ${
                      groupKey === '__FAVORITES__' 
                        ? 'bg-yellow-50 hover:bg-yellow-100 border-l-4 border-yellow-400' 
                        : 'bg-slate-50 hover:bg-slate-100'
                    }`}
                    onClick={() => toggleGroup(groupKey)}
                  >
                    <div className="flex items-center gap-2">
                      {isCollapsed ? (
                        <ChevronRight className={`h-4 w-4 ${
                          groupKey === '__FAVORITES__' ? 'text-yellow-600' : 'text-slate-400'
                        }`} />
                      ) : (
                        <ChevronDown className={`h-4 w-4 ${
                          groupKey === '__FAVORITES__' ? 'text-yellow-600' : 'text-slate-400'
                        }`} />
                      )}
                      <span className={`text-sm font-medium ${
                        groupKey === '__FAVORITES__' ? 'text-yellow-800' : 'text-slate-900'
                      }`}>
                        {group.customerName}
                      </span>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                        groupKey === '__FAVORITES__' 
                          ? 'bg-yellow-200 text-yellow-800' 
                          : 'bg-slate-200 text-slate-600'
                      }`}>
                        {group.presets.length}
                      </span>
                    </div>
                  </div>
                  
                  {/* Group Content */}
                  {!isCollapsed && (
                    <div className="divide-y divide-slate-100">
                      {group.presets.map((preset, index) => (
                        <div
                          key={preset.id}
                          draggable
                          onDragStart={(e) => handleDragStart(e, index, groupKey)}
                          onDragOver={handleDragOver}
                          onDrop={(e) => handleDrop(e, index, groupKey)}
                          onClick={() => handlePresetClick(preset)}
                          className={`w-full px-3 py-2 hover:bg-slate-50 transition-colors group cursor-pointer border-l-2 border-slate-200 ${
                            draggedIndex === index ? 'opacity-50' : ''
                          } ${isReordering ? 'pointer-events-none' : ''}`}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <GripVertical className="h-3 w-3 text-slate-400 flex-shrink-0" />
                                
                                {editingId === preset.id ? (
                                  <div className="flex items-center gap-1">
                                    <Input
                                      value={editingName}
                                      onChange={(e) => setEditingName(e.target.value)}
                                      className="h-6 text-sm px-2 py-1"
                                      onKeyDown={(e) => {
                                        if (e.key === 'Enter') handleEditSave();
                                        if (e.key === 'Escape') handleEditCancel();
                                      }}
                                      autoFocus
                                    />
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-6 w-6"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleEditSave();
                                      }}
                                      title="Save"
                                    >
                                      <Check className="h-3 w-3 text-green-600" />
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-6 w-6"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleEditCancel();
                                      }}
                                      title="Cancel"
                                    >
                                      <X className="h-3 w-3 text-red-600" />
                                    </Button>
                                  </div>
                                ) : (
                                  <h3 className="font-medium text-sm text-slate-900 truncate">
                                    {preset.name}
                                  </h3>
                                )}
                                {preset.statusFlags?.rushOrder && (
                                  <span className="text-[10px] bg-red-100 text-red-600 px-1.5 py-0.5 rounded-full font-medium">RUSH</span>
                                )}
                                {preset.statusFlags?.needsAttention && (
                                  <span className="text-[10px] bg-amber-100 text-amber-600 px-1.5 py-0.5 rounded-full font-medium">ATTENTION</span>
                                )}
                                <div className="flex items-center gap-2 text-xs text-slate-500">
                                  {preset.freightType === 'skidsVinyl' ? (
                                    <>
                                      {preset.skidsVinyl.filter(item => item.type === 'skid').length > 0 && (
                                        <span>{preset.skidsVinyl.filter(item => item.type === 'skid').length} skids</span>
                                      )}
                                      {preset.skidsVinyl.filter(item => item.type === 'vinyl').length > 0 && (
                                        <span>{preset.skidsVinyl.filter(item => item.type === 'vinyl').length} vinyl</span>
                                      )}
                                      {preset.skidsVinyl.length > 0 && (
                                        <span>{preset.skidsVinyl.reduce((sum, item) => sum + item.footage, 0).toFixed(0)} ft²</span>
                                      )}
                                    </>
                                  ) : (
                                    preset.footage > 0 && <span>{preset.footage} ft²</span>
                                  )}
                                </div>
                              </div>
                              
                              <div className="flex items-center gap-3 text-xs text-slate-600">
                                {preset.pickupCustomer?.customer_name && (
                                  <span className="flex items-center gap-1">
                                    <span className="text-red-500">●</span>
                                    <span className="truncate">{preset.pickupCustomer.customer_name}</span>
                                  </span>
                                )}
                                {preset.deliveryCustomer?.customer_name && (
                                  <span className="flex items-center gap-1">
                                    <span className="text-slate-900">●</span>
                                    <span className="truncate">{preset.deliveryCustomer.customer_name}</span>
                                  </span>
                                )}
                                {preset.payingCustomer?.customer_name && (
                                  <span className="flex items-center gap-1">
                                    <span className="text-blue-500">●</span>
                                    <span className="truncate">{preset.payingCustomer.customer_name}</span>
                                  </span>
                                )}
                              </div>
                            </div>
                            
                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity ml-2">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6"
                                onClick={(e) => handleToggleFavorite(preset, e)}
                                title={preset.isFavorite ? "Remove from favorites" : "Add to favorites"}
                              >
                                <Star 
                                  className={`h-3 w-3 ${
                                    preset.isFavorite 
                                      ? 'text-yellow-500 fill-yellow-500' 
                                      : 'text-gray-400 hover:text-yellow-500'
                                  }`} 
                                />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleEditStart(preset, e);
                                }}
                                title="Edit preset name"
                              >
                                <Pencil className="h-3 w-3 text-blue-500" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDelete(preset.id, e);
                                }}
                                title="Delete preset"
                              >
                                <Trash2 className="h-3 w-3 text-red-500" />
                              </Button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })
        )}
      </div>
    </ScrollArea>
    </div>
  );
} 