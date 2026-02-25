'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Plus, Pencil, Trash2, Search, X } from 'lucide-react'
import { toast } from 'sonner'

interface ArchboldPart {
  id: number
  item_code: string
  width: number | null
  length: number | null
  used_for: string | null
}

interface ArchboldPartsManagerProps {
  parts: ArchboldPart[]
  onPartsChanged: () => void
}

interface PartFormData {
  item_code: string
  width: string
  length: string
  used_for: string
}

const emptyForm: PartFormData = { item_code: '', width: '', length: '', used_for: '' }

export function ArchboldPartsManager({ parts, onPartsChanged }: ArchboldPartsManagerProps) {
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingPart, setEditingPart] = useState<ArchboldPart | null>(null)
  const [formData, setFormData] = useState<PartFormData>(emptyForm)
  const [isSaving, setIsSaving] = useState(false)
  const [search, setSearch] = useState('')

  const filteredParts = parts.filter(p => {
    const term = search.toLowerCase()
    return (
      p.item_code.toLowerCase().includes(term) ||
      (p.used_for && p.used_for.toLowerCase().includes(term))
    )
  })

  function handleOpenCreate() {
    setEditingPart(null)
    setFormData(emptyForm)
    setIsDialogOpen(true)
  }

  function handleOpenEdit(part: ArchboldPart) {
    setEditingPart(part)
    setFormData({
      item_code: part.item_code,
      width: part.width?.toString() || '',
      length: part.length?.toString() || '',
      used_for: part.used_for || '',
    })
    setIsDialogOpen(true)
  }

  async function handleSave() {
    if (!formData.item_code.trim()) {
      toast.error('Item code is required')
      return
    }

    setIsSaving(true)
    try {
      const payload = {
        item_code: formData.item_code.trim(),
        width: formData.width ? parseFloat(formData.width) : null,
        length: formData.length ? parseFloat(formData.length) : null,
        used_for: formData.used_for.trim() || null,
      }

      const url = editingPart ? `/api/archbold-parts/${editingPart.id}` : '/api/archbold-parts'
      const method = editingPart ? 'PUT' : 'POST'

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Failed to save')
      }

      toast.success(editingPart ? 'Part updated' : 'Part created')
      setIsDialogOpen(false)
      setEditingPart(null)
      setFormData(emptyForm)
      onPartsChanged()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save part')
    } finally {
      setIsSaving(false)
    }
  }

  async function handleDelete(part: ArchboldPart) {
    if (!confirm(`Delete "${part.item_code}"? This cannot be undone.`)) return

    try {
      const res = await fetch(`/api/archbold-parts/${part.id}`, { method: 'DELETE' })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Failed to delete')
      }
      toast.success('Part deleted')
      onPartsChanged()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete part')
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
          <Input
            placeholder="Search parts..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8 h-8 text-sm"
          />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
        <Button size="sm" onClick={handleOpenCreate} className="ml-3 gap-1.5 h-8">
          <Plus className="h-3.5 w-3.5" /> Add Part
        </Button>
      </div>

      <div className="border rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b">
              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Item Code</th>
              <th className="px-3 py-2 text-right text-xs font-medium text-gray-500">Width</th>
              <th className="px-3 py-2 text-right text-xs font-medium text-gray-500">Length</th>
              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Used For</th>
              <th className="px-3 py-2 w-20" />
            </tr>
          </thead>
          <tbody>
            {filteredParts.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-3 py-8 text-center text-gray-400 text-sm">
                  {search ? 'No parts match your search' : 'No parts yet. Click "Add Part" to create one.'}
                </td>
              </tr>
            ) : (
              filteredParts.map(part => (
                <tr key={part.id} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                  <td className="px-3 py-2 font-medium">{part.item_code}</td>
                  <td className="px-3 py-2 text-right text-gray-600">{part.width ?? '—'}</td>
                  <td className="px-3 py-2 text-right text-gray-600">{part.length ?? '—'}</td>
                  <td className="px-3 py-2 text-gray-600">{part.used_for || '—'}</td>
                  <td className="px-3 py-2">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => handleOpenEdit(part)}
                        className="p-1 text-gray-400 hover:text-blue-600 transition-colors"
                        title="Edit"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => handleDelete(part)}
                        className="p-1 text-gray-400 hover:text-red-600 transition-colors"
                        title="Delete"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingPart ? 'Edit Archbold Part' : 'New Archbold Part'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 pt-2">
            <div>
              <Label className="text-sm">Item Code *</Label>
              <Input
                value={formData.item_code}
                onChange={(e) => setFormData(prev => ({ ...prev, item_code: e.target.value }))}
                placeholder="e.g. ABC-1234"
                className="mt-1"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-sm">Width</Label>
                <Input
                  type="number"
                  step="0.0001"
                  value={formData.width}
                  onChange={(e) => setFormData(prev => ({ ...prev, width: e.target.value }))}
                  placeholder="0.0000"
                  className="mt-1"
                />
              </div>
              <div>
                <Label className="text-sm">Length</Label>
                <Input
                  type="number"
                  step="0.0001"
                  value={formData.length}
                  onChange={(e) => setFormData(prev => ({ ...prev, length: e.target.value }))}
                  placeholder="0.0000"
                  className="mt-1"
                />
              </div>
            </div>
            <div>
              <Label className="text-sm">Used For</Label>
              <Input
                value={formData.used_for}
                onChange={(e) => setFormData(prev => ({ ...prev, used_for: e.target.value }))}
                placeholder="e.g. Cabinet door panel"
                className="mt-1"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setIsDialogOpen(false)} disabled={isSaving}>
                Cancel
              </Button>
              <Button onClick={handleSave} disabled={isSaving}>
                {isSaving ? 'Saving...' : editingPart ? 'Update' : 'Create'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
