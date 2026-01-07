'use client'

import { useEffect, useState, useRef, KeyboardEvent } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { LumberLoadWithDetails, PackTallyInput } from '@/types/lumber'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Plus, Trash2, Save, Check } from 'lucide-react'
import { useToast } from '@/components/ui/use-toast'

export default function TallyEntryPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const { toast } = useToast()
  
  const [loads, setLoads] = useState<LumberLoadWithDetails[]>([])
  const [selectedLoad, setSelectedLoad] = useState<LumberLoadWithDetails | null>(null)
  const [selectedItemId, setSelectedItemId] = useState<number | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  
  const [tallies, setTallies] = useState<PackTallyInput[]>([
    { pack_id: 0, length: 8, tally_board_feet: 0 }
  ])
  
  const inputRefs = useRef<{ [key: string]: HTMLInputElement | null }>({})

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/login?callbackUrl=/dashboard/lumber/tally-entry')
    }
  }, [status, router])

  async function fetchLoads() {
    try {
      const response = await fetch('/api/lumber/loads/needs-tally')
      if (response.ok) {
        const data = await response.json()
        setLoads(data)
      }
    } catch (error) {
      console.error('Error fetching loads needing tally:', error)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    if (status === 'authenticated') {
      fetchLoads()
    }
  }, [status])

  function handleOpenTallyDialog(load: LumberLoadWithDetails, itemId: number) {
    setSelectedLoad(load)
    setSelectedItemId(itemId)
    setTallies([{ pack_id: 0, length: 8, tally_board_feet: 0 }])
    setIsDialogOpen(true)
    
    // Focus first input after dialog opens
    setTimeout(() => {
      const firstInput = inputRefs.current['0-pack_id']
      if (firstInput) firstInput.focus()
    }, 100)
  }

  function handleAddRow() {
    setTallies([...tallies, { pack_id: 0, length: 8, tally_board_feet: 0 }])
  }

  function handleRemoveRow(index: number) {
    if (tallies.length > 1) {
      setTallies(tallies.filter((_, i) => i !== index))
    }
  }

  function handleTallyChange(index: number, field: keyof PackTallyInput, value: number) {
    const newTallies = [...tallies]
    newTallies[index] = { ...newTallies[index], [field]: value }
    setTallies(newTallies)
  }

  // Handle Tab and Enter key navigation like Excel
  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>, rowIndex: number, field: keyof PackTallyInput) {
    if (e.key === 'Enter' || e.key === 'Tab') {
      e.preventDefault()
      
      const fields: (keyof PackTallyInput)[] = ['pack_id', 'length', 'tally_board_feet']
      const currentFieldIndex = fields.indexOf(field)
      
      // If we're at the last field of the last row, add a new row
      if (field === 'tally_board_feet' && rowIndex === tallies.length - 1) {
        handleAddRow()
        setTimeout(() => {
          const nextInput = inputRefs.current[`${rowIndex + 1}-pack_id`]
          if (nextInput) nextInput.focus()
        }, 10)
      } else if (currentFieldIndex < fields.length - 1) {
        // Move to next field in same row
        const nextField = fields[currentFieldIndex + 1]
        const nextInput = inputRefs.current[`${rowIndex}-${nextField}`]
        if (nextInput) nextInput.focus()
      } else {
        // Move to first field of next row
        const nextInput = inputRefs.current[`${rowIndex + 1}-pack_id`]
        if (nextInput) nextInput.focus()
      }
    }
  }

  async function handleSaveTallies() {
    if (!selectedLoad || !selectedItemId) return

    const item = selectedLoad.items.find(i => i.id === selectedItemId)
    if (!item || !item.actual_footage) {
      toast({
        title: 'Error',
        description: 'Load item not found or missing actual footage',
        variant: 'destructive'
      })
      return
    }

    // Validate that tallies sum to actual footage
    const totalTallied = tallies.reduce((sum, t) => sum + t.tally_board_feet, 0)
    if (Math.abs(totalTallied - item.actual_footage) > 0.01) {
      toast({
        title: 'Tally Mismatch',
        description: `Pack tallies (${totalTallied.toLocaleString()} BF) must equal actual footage (${item.actual_footage.toLocaleString()} BF)`,
        variant: 'destructive'
      })
      return
    }

    // Validate pack IDs are unique and non-zero
    const packIds = tallies.map(t => t.pack_id)
    const uniqueIds = new Set(packIds)
    if (uniqueIds.size !== packIds.length || packIds.some(id => id === 0)) {
      toast({
        title: 'Invalid Pack IDs',
        description: 'All pack IDs must be unique and non-zero',
        variant: 'destructive'
      })
      return
    }

    try {
      const response = await fetch(`/api/lumber/packs/create-tallies`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          load_item_id: selectedItemId,
          tallies
        })
      })

      if (response.ok) {
        toast({
          title: 'Tallies saved',
          description: `${tallies.length} pack tallies have been created`
        })
        setIsDialogOpen(false)
        fetchLoads()
      } else {
        const error = await response.json()
        toast({
          title: 'Error saving tallies',
          description: error.message || 'An error occurred',
          variant: 'destructive'
        })
      }
    } catch (error) {
      console.error('Error saving tallies:', error)
      toast({
        title: 'Error',
        description: 'Failed to save tallies',
        variant: 'destructive'
      })
    }
  }

  if (status === 'loading' || isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
      </div>
    )
  }

  const totalTallied = tallies.reduce((sum, t) => sum + t.tally_board_feet, 0)
  const selectedItem = selectedLoad?.items.find(i => i.id === selectedItemId)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Tally Entry</h1>
        <p className="text-gray-600 mt-1">
          Enter pack tallies for arrived loads
        </p>
      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Load ID
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Supplier
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Items to Tally
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Arrival Date
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {loads.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-6 py-12 text-center text-gray-500">
                  No loads needing tally entry
                </td>
              </tr>
            ) : (
              loads.map((load) => (
                <tr key={load.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <div className="text-sm font-medium text-gray-900">{load.load_id}</div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-sm text-gray-900">{load.supplier_name}</div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="space-y-2">
                      {load.items.map((item) => (
                        <div key={item.id} className="flex items-center justify-between">
                          <div className="text-sm text-gray-900">
                            {item.species} - {item.grade} ({item.thickness}) - {item.actual_footage?.toLocaleString()} BF
                          </div>
                          <Button
                            size="sm"
                            onClick={() => handleOpenTallyDialog(load, item.id)}
                          >
                            Enter Tallies
                          </Button>
                        </div>
                      ))}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-sm text-gray-900">
                      {load.actual_arrival_date 
                        ? new Date(load.actual_arrival_date).toLocaleDateString()
                        : '-'}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Tally Entry Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              Enter Pack Tallies - {selectedLoad?.load_id}
              {selectedItem && (
                <div className="text-sm font-normal text-gray-600 mt-1">
                  {selectedItem.species} - {selectedItem.grade} ({selectedItem.thickness}) 
                  - {selectedItem.actual_footage?.toLocaleString()} BF
                </div>
              )}
            </DialogTitle>
          </DialogHeader>
          
          <div className="py-4 space-y-4">
            <div className="flex items-center justify-between">
              <Label>Pack Tallies (use Tab or Enter to navigate)</Label>
              <Button
                type="button"
                size="sm"
                onClick={handleAddRow}
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Row
              </Button>
            </div>

            {/* Excel-like Grid */}
            <div className="border rounded-lg overflow-hidden">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-100">
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-700 uppercase w-16">#</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-700 uppercase">Pack ID</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-700 uppercase">Length (ft)</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-700 uppercase">Board Feet</th>
                    <th className="px-4 py-2 w-12"></th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {tallies.map((tally, index) => (
                    <tr key={index}>
                      <td className="px-4 py-2 text-sm text-gray-500">{index + 1}</td>
                      <td className="px-4 py-2">
                        <Input
                          ref={(el) => { inputRefs.current[`${index}-pack_id`] = el }}
                          type="number"
                          value={tally.pack_id || ''}
                          onChange={(e) => handleTallyChange(index, 'pack_id', parseInt(e.target.value) || 0)}
                          onKeyDown={(e) => handleKeyDown(e, index, 'pack_id')}
                          className="text-sm h-8"
                        />
                      </td>
                      <td className="px-4 py-2">
                        <Input
                          ref={(el) => { inputRefs.current[`${index}-length`] = el }}
                          type="number"
                          value={tally.length || ''}
                          onChange={(e) => handleTallyChange(index, 'length', parseInt(e.target.value) || 0)}
                          onKeyDown={(e) => handleKeyDown(e, index, 'length')}
                          className="text-sm h-8"
                        />
                      </td>
                      <td className="px-4 py-2">
                        <Input
                          ref={(el) => { inputRefs.current[`${index}-tally_board_feet`] = el }}
                          type="number"
                          step="0.01"
                          value={tally.tally_board_feet || ''}
                          onChange={(e) => handleTallyChange(index, 'tally_board_feet', parseFloat(e.target.value) || 0)}
                          onKeyDown={(e) => handleKeyDown(e, index, 'tally_board_feet')}
                          className="text-sm h-8"
                        />
                      </td>
                      <td className="px-4 py-2">
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          onClick={() => handleRemoveRow(index)}
                          disabled={tallies.length === 1}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                  <tr className="bg-gray-50 font-semibold">
                    <td colSpan={3} className="px-4 py-2 text-right text-sm">
                      Total: {tallies.length} packs
                    </td>
                    <td className="px-4 py-2 text-sm">
                      {totalTallied.toLocaleString()} BF
                      {selectedItem && (
                        <div className={`text-xs ${
                          Math.abs(totalTallied - (selectedItem.actual_footage || 0)) < 0.01
                            ? 'text-green-600'
                            : 'text-red-600'
                        }`}>
                          {Math.abs(totalTallied - (selectedItem.actual_footage || 0)) < 0.01 ? (
                            <span className="flex items-center gap-1">
                              <Check className="h-3 w-3" /> Matches
                            </span>
                          ) : (
                            `Diff: ${(totalTallied - (selectedItem.actual_footage || 0)).toFixed(2)} BF`
                          )}
                        </div>
                      )}
                    </td>
                    <td></td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveTallies}>
              <Save className="h-4 w-4 mr-2" />
              Save Tallies
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
