'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  Popover, 
  PopoverContent, 
  PopoverTrigger 
} from '@/components/ui/popover';
import { 
  PricingNote, 
  PricingCategory, 
  PricingNoteFormData 
} from '@/types/pricing-notes';
import { toast } from 'sonner';
import { X, Plus, Tag, Users, ChevronsUpDown } from 'lucide-react';

interface PricingNoteFormProps {
  note?: PricingNote | null;
  categories: PricingCategory[];
  customers: Array<{ id: number; customer_name: string }>;
  onSubmit: (data: PricingNoteFormData) => void;
  onCancel: () => void;
  isLoading?: boolean;
}

export function PricingNoteForm({
  note,
  categories,
  customers,
  onSubmit,
  onCancel,
  isLoading = false
}: PricingNoteFormProps) {
  const [formData, setFormData] = useState<PricingNoteFormData>({
    title: '',
    category_id: 0,
    content: '',
    tags: [],
    is_active: true,
    linked_customer_ids: []
  });

  const [tagInput, setTagInput] = useState('');
  const [customerSearchOpen, setCustomerSearchOpen] = useState(false);
  const [customerSearchValue, setCustomerSearchValue] = useState('');

  // Initialize form data when note prop changes
  useEffect(() => {
    if (note) {
      setFormData({
        title: note.title,
        category_id: note.category_id,
        content: note.content,
        tags: note.tags || [],
        is_active: note.is_active,
        linked_customer_ids: note.linked_customers?.map(c => c.id) || []
      });
    } else {
      setFormData({
        title: '',
        category_id: 0,
        content: '',
        tags: [],
        is_active: true,
        linked_customer_ids: []
      });
    }
  }, [note]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    
    if (!formData.title.trim()) {
      toast.error('Title is required');
      return;
    }
    
    if (!formData.category_id) {
      toast.error('Please select a category');
      return;
    }
    
    if (!formData.content.trim()) {
      toast.error('Content is required');
      return;
    }

    onSubmit(formData);
  }

  function handleAddTag() {
    const tag = tagInput.trim();
    if (tag && !formData.tags.includes(tag)) {
      setFormData(prev => ({
        ...prev,
        tags: [...prev.tags, tag]
      }));
      setTagInput('');
    }
  }

  function handleRemoveTag(tagToRemove: string) {
    setFormData(prev => ({
      ...prev,
      tags: prev.tags.filter(tag => tag !== tagToRemove)
    }));
  }

  function handleKeyPress(e: React.KeyboardEvent) {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddTag();
    }
  }

  function handleCustomerSelect(customerId: number) {
    setFormData(prev => ({
      ...prev,
      linked_customer_ids: prev.linked_customer_ids.includes(customerId)
        ? prev.linked_customer_ids.filter(id => id !== customerId)
        : [...prev.linked_customer_ids, customerId]
    }));
  }

  function handleRemoveCustomer(customerId: number) {
    setFormData(prev => ({
      ...prev,
      linked_customer_ids: prev.linked_customer_ids.filter(id => id !== customerId)
    }));
  }

  const selectedCustomers = customers.filter(c => formData.linked_customer_ids.includes(c.id));
  const availableCustomers = customers.filter(c => !formData.linked_customer_ids.includes(c.id));

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="title">Title *</Label>
          <Input
            id="title"
            value={formData.title}
            onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
            placeholder="Enter pricing note title"
            required
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="category">Category *</Label>
          <Select
            key={note?.id || 'new'} // Force re-render when note changes
            value={formData.category_id > 0 ? formData.category_id.toString() : ""}
            onValueChange={(value) => setFormData(prev => ({ ...prev, category_id: value ? parseInt(value) : 0 }))}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select a category" />
            </SelectTrigger>
            <SelectContent>
              {categories.map((category) => (
                <SelectItem key={category.id} value={category.id.toString()}>
                  <div className="flex items-center gap-2">
                    <div 
                      className="w-3 h-3 rounded-full" 
                      style={{ backgroundColor: category.color }}
                    />
                    {category.name}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="content">Content *</Label>
        <Textarea
          id="content"
          value={formData.content}
          onChange={(e) => setFormData(prev => ({ ...prev, content: e.target.value }))}
          placeholder="Enter detailed pricing information, guidelines, or notes..."
          rows={6}
          required
        />
      </div>

      <div className="space-y-2">
        <Label>Tags</Label>
        <div className="space-y-2">
          <div className="flex gap-2">
            <Input
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Add a tag and press Enter"
            />
            <Button type="button" onClick={handleAddTag} size="sm">
              <Plus className="h-4 w-4" />
            </Button>
          </div>
          {formData.tags.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {formData.tags.map((tag) => (
                <Badge key={tag} variant="secondary" className="flex items-center gap-1">
                  <Tag className="h-3 w-3" />
                  {tag}
                  <button
                    type="button"
                    onClick={() => handleRemoveTag(tag)}
                    className="ml-1 hover:bg-destructive/20 rounded-full p-0.5"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="space-y-2">
        <Label>Linked Customers</Label>
        <div className="space-y-2">
          <Popover open={customerSearchOpen} onOpenChange={setCustomerSearchOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                role="combobox"
                aria-expanded={customerSearchOpen}
                className="w-full justify-between"
              >
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  {selectedCustomers.length > 0 
                    ? `${selectedCustomers.length} customer(s) selected`
                    : "Select customers..."
                  }
                </div>
                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-full p-0">
              <div className="p-2">
                <Input
                  placeholder="Search customers..."
                  value={customerSearchValue}
                  onChange={(e) => setCustomerSearchValue(e.target.value)}
                  className="mb-2"
                />
                
                {/* Quick Actions */}
                <div className="flex items-center justify-between mb-2">
                  <div className="text-sm text-muted-foreground">
                    {availableCustomers.filter(customer => 
                      customer.customer_name.toLowerCase().includes(customerSearchValue.toLowerCase())
                    ).length} customers available
                    {customerSearchValue && (
                      <span className="ml-1">
                        (filtered from {availableCustomers.length} total)
                      </span>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        const filteredCustomers = availableCustomers.filter(customer => 
                          customer.customer_name.toLowerCase().includes(customerSearchValue.toLowerCase())
                        );
                        const allIds = filteredCustomers.map(c => c.id);
                        setFormData(prev => ({
                          ...prev,
                          linked_customer_ids: Array.from(new Set([...prev.linked_customer_ids, ...allIds]))
                        }));
                      }}
                    >
                      Select All
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setFormData(prev => ({
                          ...prev,
                          linked_customer_ids: []
                        }));
                      }}
                    >
                      Clear All
                    </Button>
                  </div>
                </div>

                <div className="max-h-60 overflow-y-auto">
                  {availableCustomers
                    .filter(customer => 
                      customer.customer_name.toLowerCase().includes(customerSearchValue.toLowerCase())
                    )
                    .map((customer) => (
                      <div
                        key={customer.id}
                        className="flex items-center space-x-2 p-2 hover:bg-gray-50 rounded cursor-pointer"
                        onClick={() => handleCustomerSelect(customer.id)}
                      >
                        <Checkbox
                          checked={formData.linked_customer_ids.includes(customer.id)}
                          onChange={() => handleCustomerSelect(customer.id)}
                        />
                        <span className="flex-1">{customer.customer_name}</span>
                      </div>
                    ))}
                  {availableCustomers.filter(customer => 
                    customer.customer_name.toLowerCase().includes(customerSearchValue.toLowerCase())
                  ).length === 0 && (
                    <div className="p-4 text-center text-muted-foreground">
                      No customers found
                    </div>
                  )}
                </div>
              </div>
            </PopoverContent>
          </Popover>

          {selectedCustomers.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {selectedCustomers.map((customer) => (
                <Badge key={customer.id} variant="secondary" className="flex items-center gap-1">
                  <Users className="h-3 w-3" />
                  {customer.customer_name}
                  <button
                    type="button"
                    onClick={() => handleRemoveCustomer(customer.id)}
                    className="ml-1 hover:bg-destructive/20 rounded-full p-0.5"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center space-x-2">
        <Checkbox
          id="is_active"
          checked={formData.is_active}
          onCheckedChange={(checked) => setFormData(prev => ({ ...prev, is_active: !!checked }))}
        />
        <Label htmlFor="is_active">Active (visible to users)</Label>
      </div>

      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={isLoading}>
          {isLoading ? 'Saving...' : (note ? 'Update Note' : 'Create Note')}
        </Button>
      </div>
    </form>
  );
}
