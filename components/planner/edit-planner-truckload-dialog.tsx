"use client"

import { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog"
import { Badge } from "@/components/ui/badge"
import { toast } from 'sonner'
import { Rocket, Trash2 } from 'lucide-react'
import type { PlannerTruckload, PlannerDriver } from '@/types/truckloads'

interface EditPlannerTruckloadDialogProps {
  isOpen: boolean
  onClose: () => void
  onUpdated: () => void
  truckload: PlannerTruckload | null
  drivers: PlannerDriver[]
}

export function EditPlannerTruckloadDialog({
  isOpen,
  onClose,
  onUpdated,
  truckload,
  drivers,
}: EditPlannerTruckloadDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [formData, setFormData] = useState({
    driverId: '',
    startDate: '',
    endDate: '',
    trailerNumber: '',
    billOfLadingNumber: '',
    description: '',
  })

  useEffect(() => {
    if (truckload) {
      setFormData({
        driverId: truckload.driverId?.toString() || '',
        startDate: truckload.startDate?.substring(0, 10) || '',
        endDate: truckload.endDate?.substring(0, 10) || '',
        trailerNumber: truckload.trailerNumber || '',
        billOfLadingNumber: truckload.billOfLadingNumber || '',
        description: truckload.description || '',
      })
    }
  }, [truckload])

  if (!truckload) return null

  const isDraft = truckload.status === 'draft'

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!truckload) return
    setIsSubmitting(true)

    try {
      const response = await fetch(`/api/truckloads/${truckload.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          driverId: parseInt(formData.driverId),
          startDate: formData.startDate,
          endDate: formData.endDate,
          trailerNumber: formData.trailerNumber || null,
          description: formData.description || null,
          bill_of_lading_number: formData.billOfLadingNumber || null,
        })
      })

      const result = await response.json()
      if (result.success) {
        toast.success('Truckload updated')
        onUpdated()
        onClose()
      } else {
        throw new Error(result.error || 'Failed to update')
      }
    } catch (error) {
      console.error('Error updating truckload:', error)
      toast.error('Failed to update truckload')
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handlePromote() {
    if (!truckload) return
    setIsSubmitting(true)

    try {
      const response = await fetch(`/api/truckloads/${truckload.id}/promote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      })

      const result = await response.json()
      if (result.success) {
        toast.success('Truckload promoted to active!')
        onUpdated()
        onClose()
      } else {
        throw new Error(result.error || 'Failed to promote')
      }
    } catch (error) {
      console.error('Error promoting truckload:', error)
      toast.error('Failed to promote truckload')
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleDelete() {
    if (!truckload) return

    try {
      const response = await fetch('/api/truckloads', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: truckload.id })
      })

      const result = await response.json()
      if (result.success) {
        toast.success('Truckload deleted')
        onUpdated()
        onClose()
      } else {
        throw new Error(result.error || 'Failed to delete')
      }
    } catch (error) {
      console.error('Error deleting truckload:', error)
      toast.error('Failed to delete truckload')
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Edit Truckload
            {isDraft ? (
              <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">Draft</Badge>
            ) : truckload.isCompleted ? (
              <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">Completed</Badge>
            ) : (
              <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">Active</Badge>
            )}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 mt-2">
          <div className="space-y-2">
            <Label>Driver</Label>
            <Select
              value={formData.driverId}
              onValueChange={(value) => setFormData({ ...formData, driverId: value })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select a driver" />
              </SelectTrigger>
              <SelectContent>
                {drivers.map((driver) => (
                  <SelectItem key={driver.id} value={driver.id.toString()}>
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: driver.color }} />
                      <span>{driver.full_name}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Start Date</Label>
              <Input
                type="date"
                value={formData.startDate}
                onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label>End Date</Label>
              <Input
                type="date"
                value={formData.endDate}
                onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Trailer Number</Label>
              <Input
                type="text"
                value={formData.trailerNumber}
                onChange={(e) => setFormData({ ...formData, trailerNumber: e.target.value })}
                placeholder="Trailer #"
              />
            </div>
            <div className="space-y-2">
              <Label>BOL Number</Label>
              <Input
                type="text"
                value={formData.billOfLadingNumber}
                onChange={(e) => setFormData({ ...formData, billOfLadingNumber: e.target.value })}
                placeholder={isDraft ? "Generated on promote" : "BOL #"}
                className={isDraft && !formData.billOfLadingNumber ? "text-gray-400" : ""}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Description</Label>
            <Textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Truckload description"
              rows={3}
            />
          </div>

          <div className="flex items-center justify-between pt-2">
            <div className="flex gap-2">
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button type="button" variant="destructive" size="sm">
                    <Trash2 className="h-3.5 w-3.5 mr-1" />
                    Delete
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete this truckload?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This action cannot be undone. This will permanently delete the truckload
                      {isDraft ? '' : ' and all its assignments'}.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={handleDelete}>Delete</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>

            <div className="flex gap-2">
              {isDraft && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={handlePromote}
                  disabled={isSubmitting || !formData.driverId}
                  className="border-green-300 text-green-700 hover:bg-green-50 hover:border-green-400"
                >
                  <Rocket className="h-3.5 w-3.5 mr-1" />
                  Make Active
                </Button>
              )}
              <Button type="submit" disabled={isSubmitting || !formData.driverId}>
                {isSubmitting ? 'Saving...' : 'Save Changes'}
              </Button>
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
