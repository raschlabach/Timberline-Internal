"use client";

import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Trash2, Link, Plus } from "lucide-react";
import { Label } from "@/components/ui/label";
import { v4 as uuidv4 } from "uuid";
import { OrderLink } from "@/types/orders";

interface OrderLinksProps {
  links: OrderLink[];
  onUpdate: (links: OrderLink[]) => void;
}

export function OrderLinks({ links, onUpdate }: OrderLinksProps) {
  // Add a new empty link
  const handleAddLink = () => {
    const newLink: OrderLink = {
      id: uuidv4(),
      url: "",
      description: "",
    };
    onUpdate([...links, newLink]);
  };

  // Remove a link by id
  const handleRemoveLink = (id: string) => {
    onUpdate(links.filter(link => link.id !== id));
  };

  // Update a link field (url or description)
  const handleUpdateLink = (id: string, field: keyof OrderLink, value: string) => {
    const updatedLinks = links.map(link => {
      if (link.id === id) {
        return { ...link, [field]: value };
      }
      return link;
    });
    onUpdate(updatedLinks);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Label className="text-sm font-medium">Links</Label>
        <Button 
          type="button" 
          variant="outline" 
          size="sm" 
          onClick={handleAddLink}
          className="flex items-center gap-1"
        >
          <Plus className="h-4 w-4" />
          Add Link
        </Button>
      </div>

      {links.length === 0 && (
        <div className="text-sm text-gray-500 italic">
          No links added. Click "Add Link" to add a reference URL.
        </div>
      )}

      {links.map((link) => (
        <div key={link.id} className="flex flex-col gap-2 p-3 border rounded-md">
          <div className="flex items-center gap-2">
            <Link className="h-4 w-4 text-gray-500 flex-shrink-0" />
            <Input
              type="url"
              placeholder="https://example.com"
              value={link.url}
              onChange={(e) => handleUpdateLink(link.id, "url", e.target.value)}
              className="flex-1"
            />
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => handleRemoveLink(link.id)}
              className="text-gray-500 hover:text-red-500"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
          <Input
            type="text"
            placeholder="Description (optional)"
            value={link.description}
            onChange={(e) => handleUpdateLink(link.id, "description", e.target.value)}
          />
        </div>
      ))}
    </div>
  );
} 