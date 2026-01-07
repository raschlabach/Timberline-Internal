'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { LumberLoadWithDetails, LumberDriver } from '@/types/lumber'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Truck, Plus, Save, Trash2 } from 'lucide-react'
import { useToast } from '@/components/ui/use-toast'

interface TruckingNote {
  id: number
  note_text: string
  created_at: string
}

export default function TruckingPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const { toast } = useToast()
  
  const [loads, setLoads] = useState<LumberLoadWithDetails[]>([])
  const [drivers, setDrivers] = useState<LumberDriver[]>([])
  const [notes, setNotes] = useState<TruckingNote[]>([])
  const [isLoading, setIsLoading] = useState(true)
  
  const [selectedLoad, setSelectedLoad] = useState<LumberLoadWithDetails | null>(null)
  const [selectedDriverId, setSelectedDriverId] = useState<string>('')
  const [assignedPickupDate, setAssignedPickupDate] = useState('')
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  
  const [newNoteText, setNewNoteText] = useState('')

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/login?callbackUrl=/dashboard/lumber/trucking')
    }
  }, [status, router])

  async function fetchData() {
    try {
      const [loadsRes, driversRes, notesRes] = await Promise.all([
        fetch('/api/lumber/loads/for-trucking'),
        fetch('/api/lumber/drivers'),
        fetch('/api/lumber/trucking/notes')
      ])

      if (loadsRes.ok) setLoads(await loadsRes.json())
      if (driversRes.ok) setDrivers(await driversRes.json())
      if (notesRes.ok) setNotes(await notesRes.json())
    } catch (error) {
      console.error('Error fetching trucking data:', error)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    if (status === 'authenticated') {
      fetchData()
    }
  }, [status])

  function handleAssignDriver(load: LumberLoadWithDetails) {
    setSelectedLoad(load)
    setSelectedDriverId(load.driver_id?.toString() || '')
    setAssignedPickupDate(load.assigned_pickup_date || '')
    setIsDialogOpen(true)
  }

  async function handleSaveAssignment() {
    if (!selectedLoad) return

    try {
      const response = await fetch(`/api/lumber/loads/${selectedLoad.id}/assign-driver`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          driver_id: selectedDriverId ? parseInt(selectedDriverId) : null,
          assigned_pickup_date: assignedPickupDate || null
        })
      })

      if (response.ok) {
        toast({
          title: 'Driver assigned',
          description: 'Driver assignment has been saved'
        })
        setIsDialogOpen(false)
        fetchData()
      } else {
        throw new Error('Failed to assign driver')
      }
    } catch (error) {
      console.error('Error assigning driver:', error)
      toast({
        title: 'Error',
        description: 'Failed to assign driver',
        variant: 'destructive'
      })
    }
  }

  async function handleAddNote() {
    if (!newNoteText.trim()) return

    try {
      const response = await fetch('/api/lumber/trucking/notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ note_text: newNoteText })
      })

      if (response.ok) {
        setNewNoteText('')
        const notesRes = await fetch('/api/lumber/trucking/notes')
        if (notesRes.ok) setNotes(await notesRes.json())
        
        toast({
          title: 'Note added',
          description: 'Trucking note has been saved'
        })
      }
    } catch (error) {
      console.error('Error adding note:', error)
      toast({
        title: 'Error',
        description: 'Failed to add note',
        variant: 'destructive'
      })
    }
  }

  async function handleDeleteNote(noteId: number) {
    try {
      const response = await fetch(`/api/lumber/trucking/notes/${noteId}`, {
        method: 'DELETE'
      })

      if (response.ok) {
        setNotes(notes.filter(n => n.id !== noteId))
        toast({
          title: 'Note deleted',
          description: 'Trucking note has been removed'
        })
      }
    } catch (error) {
      console.error('Error deleting note:', error)
    }
  }

  if (status === 'loading' || isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Trucking Dispatch</h1>
        <p className="text-gray-600 mt-1">
          Assign drivers and schedule pickups for loads
        </p>
      </div>

      <div className="grid grid-cols-3 gap-6">
        {/* Loads for Pickup */}
        <div className="col-span-2">
          <h2 className="text-xl font-semibold mb-4">Loads Needing Pickup</h2>
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Load ID
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Supplier
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Driver
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Pickup Date
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Action
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {loads.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-gray-500">
                      No loads needing pickup
                    </td>
                  </tr>
                ) : (
                  loads.map((load) => (
                    <tr key={load.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm font-medium text-gray-900">
                        {load.load_id}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900">
                        {load.supplier_name}
                        {load.location_name && (
                          <div className="text-xs text-gray-500">{load.location_name}</div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900">
                        {load.driver_name || '-'}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900">
                        {load.assigned_pickup_date 
                          ? new Date(load.assigned_pickup_date).toLocaleDateString()
                          : '-'}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleAssignDriver(load)}
                        >
                          <Truck className="h-4 w-4 mr-1" />
                          Assign
                        </Button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Notes Section */}
        <div>
          <h2 className="text-xl font-semibold mb-4">Dispatcher Notes</h2>
          <div className="bg-white rounded-lg shadow p-4 space-y-4">
            <div className="space-y-2">
              <Textarea
                placeholder="Add a note..."
                value={newNoteText}
                onChange={(e) => setNewNoteText(e.target.value)}
                rows={3}
              />
              <Button onClick={handleAddNote} size="sm" className="w-full">
                <Plus className="h-4 w-4 mr-2" />
                Add Note
              </Button>
            </div>

            <div className="space-y-2 max-h-96 overflow-y-auto">
              {notes.map((note) => (
                <div key={note.id} className="border rounded p-3 relative group">
                  <p className="text-sm text-gray-900 pr-6">{note.note_text}</p>
                  <div className="text-xs text-gray-500 mt-1">
                    {new Date(note.created_at).toLocaleString()}
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="absolute top-2 right-2 opacity-0 group-hover:opacity-100"
                    onClick={() => handleDeleteNote(note.id)}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Assignment Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Assign Driver - {selectedLoad?.load_id}</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div>
              <Label>Driver</Label>
              <Select value={selectedDriverId} onValueChange={setSelectedDriverId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select driver" />
                </SelectTrigger>
                <SelectContent>
                  {drivers.map(driver => (
                    <SelectItem key={driver.id} value={driver.id.toString()}>
                      {driver.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Pickup Date</Label>
              <Input
                type="date"
                value={assignedPickupDate}
                onChange={(e) => setAssignedPickupDate(e.target.value)}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveAssignment}>
              <Save className="h-4 w-4 mr-2" />
              Save Assignment
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
