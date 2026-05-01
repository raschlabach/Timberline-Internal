'use client'

import { useState, useEffect } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'

interface GroupDialogProps {
  isOpen: boolean
  onOpenChange: (open: boolean) => void
  group: any | null
  allPolygons: any[]
}

export function GroupDialog({ isOpen, onOpenChange, group, allPolygons }: GroupDialogProps) {
  const queryClient = useQueryClient()
  const isEditing = !!group

  const [name, setName] = useState('')
  const [maxFootage, setMaxFootage] = useState('')
  const [maxStops, setMaxStops] = useState('')
  const [selectedPolygonIds, setSelectedPolygonIds] = useState<number[]>([])

  useEffect(() => {
    if (group) {
      setName(group.name || '')
      setMaxFootage(group.maxFootage?.toString() || '')
      setMaxStops(group.maxStops?.toString() || '')
      setSelectedPolygonIds(group.polygons?.map((p: any) => p.id) || [])
    } else {
      setName('')
      setMaxFootage('')
      setMaxStops('')
      setSelectedPolygonIds([])
    }
  }, [group, isOpen])

  const createMutation = useMutation({
    mutationFn: async (body: any) => {
      const res = await fetch('/api/suggested-loads/groups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['suggested-load-groups'] })
      onOpenChange(false)
    },
  })

  const updateMutation = useMutation({
    mutationFn: async (body: any) => {
      const res = await fetch(`/api/suggested-loads/groups/${group.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['suggested-load-groups'] })
      onOpenChange(false)
    },
  })

  const deleteMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/suggested-loads/groups/${group.id}`, { method: 'DELETE' })
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['suggested-load-groups'] })
      onOpenChange(false)
    },
  })

  function handleSave() {
    if (!name.trim()) return
    const body = {
      name: name.trim(),
      maxFootage: maxFootage ? parseInt(maxFootage) : null,
      maxStops: maxStops ? parseInt(maxStops) : null,
      polygonIds: selectedPolygonIds,
    }

    if (isEditing) {
      updateMutation.mutate(body)
    } else {
      createMutation.mutate(body)
    }
  }

  function handleTogglePolygon(polygonId: number) {
    setSelectedPolygonIds((prev) =>
      prev.includes(polygonId) ? prev.filter((id) => id !== polygonId) : [...prev, polygonId]
    )
  }

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEditing ? `Edit: ${group.name}` : 'New Truckload Group'}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <div>
            <Label htmlFor="group-name">Group Name</Label>
            <Input
              id="group-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Indiana Semi"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="group-max-footage">Max Footage</Label>
              <Input
                id="group-max-footage"
                type="number"
                value={maxFootage}
                onChange={(e) => setMaxFootage(e.target.value)}
                placeholder="No limit"
              />
            </div>
            <div>
              <Label htmlFor="group-max-stops">Max Stops</Label>
              <Input
                id="group-max-stops"
                type="number"
                value={maxStops}
                onChange={(e) => setMaxStops(e.target.value)}
                placeholder="No limit"
              />
            </div>
          </div>

          <div>
            <Label>Assigned Polygons</Label>
            {allPolygons.length === 0 ? (
              <p className="text-sm text-muted-foreground mt-1">
                No polygons created yet. Draw polygons on the Map tab first.
              </p>
            ) : (
              <div className="space-y-2 mt-2 max-h-48 overflow-y-auto">
                {allPolygons.map((p) => (
                  <label
                    key={p.id}
                    className="flex items-center gap-2 px-3 py-2 rounded-md border cursor-pointer hover:bg-muted/50 transition-colors"
                  >
                    <Checkbox
                      checked={selectedPolygonIds.includes(p.id)}
                      onCheckedChange={() => handleTogglePolygon(p.id)}
                    />
                    <div
                      className="w-3 h-3 rounded-full flex-shrink-0"
                      style={{ backgroundColor: p.color }}
                    />
                    <span className="text-sm">{p.name}</span>
                    <span className="text-xs text-muted-foreground ml-auto">
                      {p.matchOn === 'pickup' ? 'Pickup' : 'Delivery'}
                    </span>
                  </label>
                ))}
              </div>
            )}
          </div>

          <div className="flex justify-between pt-2">
            {isEditing ? (
              <Button
                variant="destructive"
                size="sm"
                onClick={() => deleteMutation.mutate()}
                disabled={deleteMutation.isPending}
              >
                Delete Group
              </Button>
            ) : (
              <div />
            )}
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button
                onClick={handleSave}
                disabled={!name.trim() || createMutation.isPending || updateMutation.isPending}
              >
                {isEditing ? 'Save Changes' : 'Create Group'}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
