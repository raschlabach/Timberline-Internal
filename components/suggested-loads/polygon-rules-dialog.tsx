'use client'

import { useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Trash2 } from 'lucide-react'

const POLYGON_COLORS = [
  { value: '#3B82F6', label: 'Blue' },
  { value: '#EF4444', label: 'Red' },
  { value: '#10B981', label: 'Green' },
  { value: '#F59E0B', label: 'Amber' },
  { value: '#8B5CF6', label: 'Purple' },
  { value: '#EC4899', label: 'Pink' },
  { value: '#06B6D4', label: 'Cyan' },
  { value: '#F97316', label: 'Orange' },
]

const LOAD_TYPE_OPTIONS = [
  { key: 'oh_to_in', label: 'OH → IN' },
  { key: 'backhaul', label: 'Backhaul' },
  { key: 'local_semi', label: 'Local Semi' },
  { key: 'local_flatbed', label: 'Local Flatbed' },
  { key: 'rr_order', label: 'RNR' },
  { key: 'middlefield', label: 'Middlefield' },
  { key: 'pa_ny', label: 'PA/NY' },
]

interface PolygonRulesDialogProps {
  polygon?: any
  isOpen?: boolean
  onOpenChange?: (open: boolean) => void
  onSave: (config: any) => void
  onDelete?: () => void
  mode: 'create' | 'edit'
}

export function PolygonRulesDialog({
  polygon,
  isOpen: controlledIsOpen,
  onOpenChange,
  onSave,
  onDelete,
  mode,
}: PolygonRulesDialogProps) {
  const [internalOpen, setInternalOpen] = useState(false)
  const isOpen = controlledIsOpen !== undefined ? controlledIsOpen : internalOpen
  const setIsOpen = onOpenChange || setInternalOpen

  const [name, setName] = useState('')
  const [color, setColor] = useState('#3B82F6')
  const [matchOn, setMatchOn] = useState<'pickup' | 'delivery' | 'both'>('delivery')
  const [maxFootage, setMaxFootage] = useState('')
  const [maxStops, setMaxStops] = useState('')
  const [onlyUnassignedType, setOnlyUnassignedType] = useState<string>('none')
  const [loadTypeFilter, setLoadTypeFilter] = useState<Record<string, boolean>>({})

  useEffect(() => {
    if (polygon && mode === 'edit') {
      setName(polygon.name || '')
      setColor(polygon.color || '#3B82F6')
      setMatchOn(polygon.matchOn || 'delivery')
      setMaxFootage(polygon.maxFootage?.toString() || '')
      setMaxStops(polygon.maxStops?.toString() || '')
      setOnlyUnassignedType(polygon.onlyUnassignedType || 'none')
      setLoadTypeFilter(polygon.loadTypeFilter || {})
    } else if (mode === 'create') {
      setName('')
      setColor('#3B82F6')
      setMatchOn('delivery')
      setMaxFootage('')
      setMaxStops('')
      setOnlyUnassignedType('none')
      setLoadTypeFilter({})
    }
  }, [polygon, mode, isOpen])

  function handleSave() {
    if (!name.trim()) return

    const hasActiveFilter = Object.values(loadTypeFilter).some(Boolean)

    onSave({
      name: name.trim(),
      color,
      matchOn,
      maxFootage: maxFootage ? parseInt(maxFootage) : null,
      maxStops: maxStops ? parseInt(maxStops) : null,
      onlyUnassignedType: onlyUnassignedType === 'none' ? null : onlyUnassignedType,
      loadTypeFilter: hasActiveFilter ? loadTypeFilter : null,
    })
    setIsOpen(false)
  }

  function handleLoadTypeToggle(key: string) {
    setLoadTypeFilter((prev) => ({ ...prev, [key]: !prev[key] }))
  }

  const dialogContent = (
    <DialogContent className="sm:max-w-md">
      <DialogHeader>
        <DialogTitle>{mode === 'create' ? 'New Polygon Zone' : `Edit: ${polygon?.name || ''}`}</DialogTitle>
      </DialogHeader>
      <div className="space-y-4 pt-2">
        <div>
          <Label htmlFor="poly-name">Name</Label>
          <Input
            id="poly-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Indiana Delivery Zone"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label>Color</Label>
            <div className="flex flex-wrap gap-1.5 mt-1.5">
              {POLYGON_COLORS.map((c) => (
                <button
                  key={c.value}
                  onClick={() => setColor(c.value)}
                  className={`w-7 h-7 rounded-full border-2 transition-all ${
                    color === c.value ? 'border-gray-900 scale-110' : 'border-transparent'
                  }`}
                  style={{ backgroundColor: c.value }}
                  title={c.label}
                />
              ))}
            </div>
          </div>

          <div>
            <Label>Match On</Label>
            <Select value={matchOn} onValueChange={(v) => setMatchOn(v as any)}>
              <SelectTrigger className="mt-1.5">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="delivery">Delivery Location</SelectItem>
                <SelectItem value="pickup">Pickup Location</SelectItem>
                <SelectItem value="both">Both (Pickup &amp; Delivery)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="border-t pt-4">
          <p className="text-sm font-medium text-muted-foreground mb-3">Optional Rules</p>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="max-footage">Max Footage</Label>
              <Input
                id="max-footage"
                type="number"
                value={maxFootage}
                onChange={(e) => setMaxFootage(e.target.value)}
                placeholder="No limit"
              />
            </div>
            <div>
              <Label htmlFor="max-stops">Max Stops</Label>
              <Input
                id="max-stops"
                type="number"
                value={maxStops}
                onChange={(e) => setMaxStops(e.target.value)}
                placeholder="No limit"
              />
            </div>
          </div>

          <div className="mt-3">
            <Label>Only Grab Unassigned</Label>
            <Select value={onlyUnassignedType} onValueChange={setOnlyUnassignedType}>
              <SelectTrigger className="mt-1.5">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No filter (grab all)</SelectItem>
                <SelectItem value="pickup">Only unassigned pickups</SelectItem>
                <SelectItem value="delivery">Only unassigned deliveries</SelectItem>
                <SelectItem value="either">Either unassigned</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="mt-3">
            <Label>Load Type Filter</Label>
            <div className="flex flex-wrap gap-2 mt-1.5">
              {LOAD_TYPE_OPTIONS.map((opt) => (
                <button
                  key={opt.key}
                  onClick={() => handleLoadTypeToggle(opt.key)}
                  className={`px-2.5 py-1 text-xs rounded-full border transition-colors ${
                    loadTypeFilter[opt.key]
                      ? 'bg-gray-900 text-white border-gray-900'
                      : 'bg-white text-gray-600 border-gray-300 hover:border-gray-400'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            {!Object.values(loadTypeFilter).some(Boolean) && (
              <p className="text-xs text-muted-foreground mt-1">No filter - matches all load types</p>
            )}
          </div>
        </div>

        <div className="flex justify-between pt-2">
          {mode === 'edit' && onDelete ? (
            <Button variant="destructive" size="sm" onClick={onDelete}>
              <Trash2 className="h-4 w-4 mr-1" />
              Delete
            </Button>
          ) : (
            <div />
          )}
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setIsOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={!name.trim()}>
              {mode === 'create' ? 'Create Zone' : 'Save Changes'}
            </Button>
          </div>
        </div>
      </div>
    </DialogContent>
  )

  if (controlledIsOpen !== undefined) {
    return (
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        {dialogContent}
      </Dialog>
    )
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <Button variant="outline" size="sm" onClick={() => setIsOpen(true)}>
        Edit Rules
      </Button>
      {dialogContent}
    </Dialog>
  )
}
