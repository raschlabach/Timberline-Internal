"use client"

import { useState, useRef } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card } from "@/components/ui/card"
import { Paperclip, Upload, X, FileText, Image, Download, Trash2, Printer } from "lucide-react"
import { toast } from "sonner"

interface Document {
  id: number
  file_name: string
  file_path: string
  file_size: number
  file_type: string
  created_at: string
  uploaded_by: string
}

interface DocumentAttachmentDialogProps {
  isOpen: boolean
  onClose: () => void
  orderId: number
  orderNumber?: string
}

export function DocumentAttachmentDialog({ 
  isOpen, 
  onClose, 
  orderId, 
  orderNumber 
}: DocumentAttachmentDialogProps) {
  const [documents, setDocuments] = useState<Document[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [fileName, setFileName] = useState("")
  const fileInputRef = useRef<HTMLInputElement>(null)

  const fetchDocuments = async () => {
    setIsLoading(true)
    try {
      const response = await fetch(`/api/orders/${orderId}/documents`)
      if (response.ok) {
        const data = await response.json()
        setDocuments(data.documents || [])
      }
    } catch (error) {
      console.error('Error fetching documents:', error)
      toast.error('Failed to fetch documents')
    } finally {
      setIsLoading(false)
    }
  }

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) {
      setFileName(file.name)
    }
  }

  const handleUpload = async () => {
    const file = fileInputRef.current?.files?.[0]
    if (!file) {
      toast.error('Please select a file')
      return
    }

    if (!fileName.trim()) {
      toast.error('Please enter a file name')
      return
    }

    setIsUploading(true)
    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('fileName', fileName.trim())

      const response = await fetch(`/api/orders/${orderId}/documents`, {
        method: 'POST',
        body: formData
      })

      if (response.ok) {
        toast.success('Document uploaded successfully')
        setFileName("")
        if (fileInputRef.current) {
          fileInputRef.current.value = ""
        }
        fetchDocuments()
        // Trigger notification panel refresh
        window.dispatchEvent(new CustomEvent('notificationUpdate'))
      } else {
        const error = await response.json()
        toast.error(error.error || 'Failed to upload document')
      }
    } catch (error) {
      console.error('Error uploading document:', error)
      toast.error('Failed to upload document')
    } finally {
      setIsUploading(false)
    }
  }

  const handleDelete = async (documentId: number) => {
    if (!confirm('Are you sure you want to delete this document?')) {
      return
    }

    try {
      const response = await fetch(`/api/orders/${orderId}/documents?documentId=${documentId}`, {
        method: 'DELETE'
      })

      if (response.ok) {
        toast.success('Document deleted successfully')
        fetchDocuments()
      } else {
        toast.error('Failed to delete document')
      }
    } catch (error) {
      console.error('Error deleting document:', error)
      toast.error('Failed to delete document')
    }
  }

  const handlePrint = (document: Document) => {
    try {
      // Open the document in a new window for printing
      const printWindow = window.open(document.file_path, '_blank')
      
      if (printWindow) {
        // Wait for the document to load, then trigger print
        printWindow.onload = () => {
          printWindow.print()
        }
        
        // Fallback: if onload doesn't fire, try printing after a short delay
        setTimeout(() => {
          if (!printWindow.closed) {
            printWindow.print()
          }
        }, 1000)
      } else {
        toast.error('Unable to open document for printing. Please check your popup blocker settings.')
      }
    } catch (error) {
      console.error('Error printing document:', error)
      toast.error('Failed to open document for printing')
    }
  }

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  const getFileIcon = (fileType: string) => {
    if (fileType.startsWith('image/')) {
      return <Image className="w-4 h-4" />
    }
    return <FileText className="w-4 h-4" />
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  // Fetch documents when dialog opens
  useState(() => {
    if (isOpen) {
      fetchDocuments()
    }
  })

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Paperclip className="w-5 h-5" />
            Paperwork for Order #{orderNumber || orderId}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Upload Section */}
          <Card className="p-4">
            <div className="space-y-4">
              <div>
                <Label htmlFor="file">Select File</Label>
                <Input
                  id="file"
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileSelect}
                  accept=".pdf,.jpg,.jpeg,.png,.gif,.webp"
                  className="mt-1"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Accepted formats: PDF, JPG, PNG, GIF, WebP (Max 10MB)
                </p>
              </div>

              <div>
                <Label htmlFor="fileName">File Name</Label>
                <Input
                  id="fileName"
                  value={fileName}
                  onChange={(e) => setFileName(e.target.value)}
                  placeholder="Enter a descriptive name for this document"
                  className="mt-1"
                />
              </div>

              <Button 
                onClick={handleUpload} 
                disabled={isUploading || !fileName.trim()}
                className="w-full"
              >
                <Upload className="w-4 h-4 mr-2" />
                {isUploading ? 'Uploading...' : 'Upload Paperwork'}
              </Button>
            </div>
          </Card>

          {/* Documents List */}
          <div>
            <h3 className="text-lg font-medium mb-3">Attached Documents</h3>
            {isLoading ? (
              <div className="text-center py-4">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-gray-900 mx-auto"></div>
              </div>
            ) : documents.length === 0 ? (
              <Card className="p-6 text-center text-gray-500">
                <Paperclip className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p>No documents attached yet</p>
              </Card>
            ) : (
              <div className="space-y-2">
                {documents.map((doc) => (
                  <Card key={doc.id} className="p-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        {getFileIcon(doc.file_type)}
                        <div>
                          <p className="font-medium text-sm">{doc.file_name}</p>
                          <p className="text-xs text-gray-500">
                            {formatFileSize(doc.file_size)} • {formatDate(doc.created_at)} • {doc.uploaded_by}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => window.open(doc.file_path, '_blank')}
                          title="Download document"
                        >
                          <Download className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handlePrint(doc)}
                          title="Print document"
                        >
                          <Printer className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(doc.id)}
                          className="text-red-600 hover:text-red-700"
                          title="Delete document"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
