"use client"

import { useRef, useState } from "react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Trash2, Link as LinkIcon, Plus, UploadCloud, Loader2 } from "lucide-react"
import { Label } from "@/components/ui/label"
import { v4 as uuidv4 } from "uuid"
import { OrderLink } from "@/types/orders"
import { toast } from "sonner"

interface OrderLinksProps {
  links: OrderLink[]
  onUpdate: (links: OrderLink[]) => void
}

const ACCEPTED_FILE_TYPES = ".pdf,.jpg,.jpeg,.png,.gif,.webp"

export function OrderLinks({ links, onUpdate }: OrderLinksProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [isUploading, setIsUploading] = useState(false)

  function handleAddLink() {
    const newLink: OrderLink = {
      id: uuidv4(),
      url: "",
      description: "",
    }
    onUpdate([...links, newLink])
  }

  function handleRemoveLink(id: string) {
    onUpdate(links.filter(link => link.id !== id))
  }

  function handleUpdateLink(id: string, field: keyof OrderLink, value: string) {
    const updatedLinks = links.map(link => {
      if (link.id === id) {
        return { ...link, [field]: value }
      }
      return link
    })
    onUpdate(updatedLinks)
  }

  function handleDragOver(event: React.DragEvent<HTMLDivElement>) {
    event.preventDefault()
    setIsDragging(true)
  }

  function handleDragLeave(event: React.DragEvent<HTMLDivElement>) {
    event.preventDefault()
    setIsDragging(false)
  }

  function handleDrop(event: React.DragEvent<HTMLDivElement>) {
    event.preventDefault()
    setIsDragging(false)
    const files = Array.from(event.dataTransfer.files || [])
    if (files.length > 0) {
      uploadFiles(files)
    }
  }

  function handleFileSelect(event: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files || [])
    if (files.length > 0) {
      uploadFiles(files)
    }
  }

  async function uploadFiles(files: File[]) {
    if (files.length === 0) {
      return
    }

    setIsUploading(true)
    try {
      for (const file of files) {
        console.log('Uploading file:', { name: file.name, type: file.type, size: file.size })
        
        const formData = new FormData()
        formData.append("file", file)

        const response = await fetch("/api/uploads/order-links", {
          method: "POST",
          body: formData,
        })
        
        console.log('Upload response status:', response.status, response.statusText)
        
        let result
        try {
          result = await response.json()
          console.log('Upload response data:', result)
        } catch (jsonError) {
          console.error('Failed to parse JSON response:', jsonError)
          const text = await response.text()
          console.error('Response text:', text)
          throw new Error(`Server error: ${response.status} ${response.statusText}`)
        }

        if (!response.ok) {
          throw new Error(result?.error || `Failed to upload ${file.name} (${response.status})`)
        }

        if (!result.url) {
          console.error('Response missing url field:', result)
          throw new Error('Server response missing file URL')
        }

        const newLink: OrderLink = {
          id: uuidv4(),
          url: result.url,
          description: result.fileName || file.name,
        }
        onUpdate([...links, newLink])
        toast.success(`Uploaded ${file.name}`)
      }
    } catch (error) {
      console.error("Order link upload failed:", error)
      const message = error instanceof Error ? error.message : "Failed to upload file"
      toast.error(message)
    } finally {
      setIsUploading(false)
      if (fileInputRef.current) {
        fileInputRef.current.value = ""
      }
    }
  }

  function handleBrowseClick() {
    fileInputRef.current?.click()
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Label className="text-sm font-medium">Links & Paperwork</Label>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleAddLink}
          className="flex items-center gap-1"
        >
          <Plus className="h-4 w-4" />
          Add Manual Link
        </Button>
      </div>

      <div
        className={`border-2 border-dashed rounded-lg p-4 text-center transition-colors cursor-pointer ${
          isDragging ? "border-blue-500 bg-blue-50" : "border-slate-200 hover:border-slate-300"
        }`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={handleBrowseClick}
      >
        <div className="flex flex-col items-center gap-2">
          {isUploading ? (
            <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
          ) : (
            <UploadCloud className="h-6 w-6 text-blue-600" />
          )}
          <div>
            <p className="text-sm font-medium text-gray-900">
              {isUploading ? "Uploading files..." : "Drag & drop paperwork here"}
            </p>
            <p className="text-xs text-gray-500">
              or click to browse • Supports PDF and images up to 10MB
            </p>
          </div>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          multiple
          onChange={handleFileSelect}
          accept={ACCEPTED_FILE_TYPES}
        />
      </div>

      {links.length === 0 && (
        <div className="text-sm text-gray-500 italic">
          No links added yet. Upload paperwork or add a manual URL.
        </div>
      )}

      {links.map((link) => (
        <div key={link.id} className="flex flex-col gap-2 p-3 border rounded-md">
          <div className="flex items-center gap-2">
            <LinkIcon className="h-4 w-4 text-gray-500 flex-shrink-0" />
            <Input
              type="text"
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
  )
}