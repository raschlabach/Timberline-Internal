'use client'

import React, { useEffect, useMemo, useState } from 'react'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

interface EditTruckloadDialogProps {
  isOpen: boolean
  onOpenChange: (open: boolean) => void
  truckloadId: string | null
}

interface DriverOption {
  id: string
  full_name: string
}

interface TruckloadDetailsResponse {
  success: boolean
  truckload: {
    id: string
    driverId: string | null
    startDate: string
    endDate: string | null
    trailerNumber: string | null
    billOfLadingNumber: string | null
    description: string | null
  }
}

export default function EditTruckloadDialog({ isOpen, onOpenChange, truckloadId }: EditTruckloadDialogProps) {
  const [drivers, setDrivers] = useState<DriverOption[]>([])
  const [isLoading, setIsLoading] = useState<boolean>(false)
  const [hasError, setHasError] = useState<boolean>(false)

  const [driverId, setDriverId] = useState<string>('')
  const [startDate, setStartDate] = useState<string>('')
  const [endDate, setEndDate] = useState<string>('')
  const [trailerNumber, setTrailerNumber] = useState<string>('')
  const [billOfLadingNumber, setBillOfLadingNumber] = useState<string>('')
  const [description, setDescription] = useState<string>('')
  const [isSaving, setIsSaving] = useState<boolean>(false)

  useEffect(function loadData() {
    let isCancelled = false
    async function run(): Promise<void> {
      if (!isOpen || !truckloadId) return
      try {
        setIsLoading(true)
        setHasError(false)
        const [driversRes, truckloadRes] = await Promise.all([
          fetch('/api/drivers', { credentials: 'same-origin' }),
          fetch(`/api/truckloads/${truckloadId}`, { credentials: 'same-origin' }),
        ])
        if (!driversRes.ok || !truckloadRes.ok) throw new Error('Failed to load dialog data')
        const driversJson = await driversRes.json()
        const tlJson = (await truckloadRes.json()) as TruckloadDetailsResponse
        const driverOptions: DriverOption[] = (driversJson.drivers || []).map((d: any) => ({ id: d.id, full_name: d.full_name }))
        if (!isCancelled) setDrivers(driverOptions)
        if (tlJson.success) {
          const t = tlJson.truckload
          if (!isCancelled) {
            setDriverId(t.driverId || '')
            setStartDate(t.startDate?.slice(0, 10) || '')
            setEndDate(t.endDate?.slice(0, 10) || '')
            setTrailerNumber(t.trailerNumber || '')
            setBillOfLadingNumber(t.billOfLadingNumber || '')
            setDescription(t.description || '')
          }
        }
      } catch (_e) {
        if (!isCancelled) setHasError(true)
      } finally {
        if (!isCancelled) setIsLoading(false)
      }
    }
    run()
    return () => { isCancelled = true }
  }, [isOpen, truckloadId])

  async function handleSave(): Promise<void> {
    if (!truckloadId) return
    try {
      setIsSaving(true)
      const res = await fetch(`/api/truckloads/${truckloadId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({
          driverId: driverId || null,
          startDate: startDate || null,
          endDate: endDate || null,
          trailer_number: trailerNumber || null,
          bill_of_lading_number: billOfLadingNumber || null,
          description: description || null,
        }),
      })
      if (!res.ok) throw new Error('Failed to save truckload')
      onOpenChange(false)
    } catch (_e) {
      setHasError(true)
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[560px]">
        <DialogHeader>
          <DialogTitle>Edit Truckload</DialogTitle>
        </DialogHeader>
        {hasError && (
          <div className="text-sm text-red-600">There was a problem loading or saving.</div>
        )}
        <div className="grid grid-cols-1 gap-3">
          <div className="grid gap-1">
            <Label htmlFor="driver">Driver</Label>
            <Select value={driverId} onValueChange={setDriverId}>
              <SelectTrigger id="driver">
                <SelectValue placeholder="Select driver" />
              </SelectTrigger>
              <SelectContent>
                {drivers.map(d => (
                  <SelectItem key={d.id} value={d.id}>{d.full_name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1">
              <Label htmlFor="startDate">Start Date</Label>
              <Input id="startDate" type="date" value={startDate} onChange={e => setStartDate(e.target.value)} />
            </div>
            <div className="grid gap-1">
              <Label htmlFor="endDate">End Date</Label>
              <Input id="endDate" type="date" value={endDate} onChange={e => setEndDate(e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1">
              <Label htmlFor="trailerNumber">Trailer #</Label>
              <Input id="trailerNumber" value={trailerNumber} onChange={e => setTrailerNumber(e.target.value)} />
            </div>
            <div className="grid gap-1">
              <Label htmlFor="bol">BOL #</Label>
              <Input id="bol" value={billOfLadingNumber} onChange={e => setBillOfLadingNumber(e.target.value)} />
            </div>
          </div>
          <div className="grid gap-1">
            <Label htmlFor="description">Description</Label>
            <Input id="description" value={description} onChange={e => setDescription(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSaving}>Cancel</Button>
          <Button onClick={handleSave} disabled={isSaving || isLoading}>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}


