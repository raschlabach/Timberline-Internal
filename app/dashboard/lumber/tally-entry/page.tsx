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
import { Plus, Trash2, Save, Check, EyeOff, Eye, Undo2 } from 'lucide-react'
import { toast } from 'sonner'

export default function TallyEntryPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  
  const [loads, setLoads] = useState<LumberLoadWithDetails[]>([])
  const [hiddenLoads, setHiddenLoads] = useState<LumberLoadWithDetails[]>([])
  const [isShowingHidden, setIsShowingHidden] = useState(false)
  const [selectedLoad, setSelectedLoad] = useState<LumberLoadWithDetails | null>(null)
  const [selectedItemId, setSelectedItemId] = useState<number | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  
  const [tallies, setTallies] = useState<PackTallyInput[]>(
    Array.from({ length: 12 }, () => ({ pack_id: '', length: 0, tally_board_feet: 0 }))
  )
  const [rowCount, setRowCount] = useState(12)
  
  const inputRefs = useRef<{ [key: string]: HTMLInputElement | null }>({})

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/login?callbackUrl=/dashboard/lumber/tally-entry')
    }
  }, [status, router])

  async function fetchLoads() {
    try {
      const [mainRes, hiddenRes] = await Promise.all([
        fetch('/api/lumber/loads/needs-tally'),
        fetch('/api/lumber/loads/needs-tally?hidden=true'),
      ])
      if (mainRes.ok) setLoads(await mainRes.json())
      if (hiddenRes.ok) setHiddenLoads(await hiddenRes.json())
    } catch (error) {
      console.error('Error fetching loads needing tally:', error)
    } finally {
      setIsLoading(false)
    }
  }

  async function handleToggleHidden(loadId: number, hide: boolean) {
    try {
      const response = await fetch(`/api/lumber/loads/${loadId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tally_entry_hidden: hide }),
      })
      if (response.ok) {
        toast.success(hide ? 'Load moved to hidden list' : 'Load moved back to main list')
        fetchLoads()
      } else {
        toast.error('Failed to update load')
      }
    } catch (error) {
      console.error('Error toggling load visibility:', error)
      toast.error('Failed to update load')
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
    setTallies(Array.from({ length: 12 }, () => ({ pack_id: '', length: 0, tally_board_feet: 0 })))
    setRowCount(12)
    setIsDialogOpen(true)
    
    // Focus first input after dialog opens
    setTimeout(() => {
      const firstInput = inputRefs.current['0-pack_id']
      if (firstInput) firstInput.focus()
    }, 100)
  }

  function handleAddRow() {
    setTallies([...tallies, { pack_id: '', length: 0, tally_board_feet: 0 }])
    setRowCount(tallies.length + 1)
  }

  function handleRemoveRow(index: number) {
    if (tallies.length > 1) {
      setTallies(tallies.filter((_, i) => i !== index))
      setRowCount(tallies.length - 1)
    }
  }

  function handleSetRowCount() {
    const targetCount = rowCount
    if (targetCount < 1) {
      toast.error('Row count must be at least 1')
      return
    }
    
    const currentCount = tallies.length
    if (targetCount > currentCount) {
      // Add rows
      const newRows = Array.from({ length: targetCount - currentCount }, () => ({ 
        pack_id: '', 
        length: 0, 
        tally_board_feet: 0 
      }))
      setTallies([...tallies, ...newRows])
    } else if (targetCount < currentCount) {
      // Remove rows from the end
      setTallies(tallies.slice(0, targetCount))
    }
  }

  function handleTallyChange(index: number, field: keyof PackTallyInput, value: string | number) {
    const newTallies = [...tallies]
    newTallies[index] = { ...newTallies[index], [field]: value }
    setTallies(newTallies)
  }

  // Handle Tab and Enter key navigation - moves DOWN columns instead of across rows
  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>, rowIndex: number, field: keyof PackTallyInput) {
    if (e.key === 'Enter' || e.key === 'Tab') {
      e.preventDefault()
      
      const fields: (keyof PackTallyInput)[] = ['pack_id', 'length', 'tally_board_feet']
      const currentFieldIndex = fields.indexOf(field)
      
      // Check if we're at the last row of current column
      if (rowIndex === tallies.length - 1) {
        // Last row - check if we're on the last column
        if (field === 'tally_board_feet') {
          // Last cell - add new row and go to first column
          handleAddRow()
          setTimeout(() => {
            const nextInput = inputRefs.current[`${rowIndex + 1}-pack_id`]
            if (nextInput) nextInput.focus()
          }, 10)
        } else {
          // Move to first row of next column
          const nextField = fields[currentFieldIndex + 1]
          const nextInput = inputRefs.current[`0-${nextField}`]
          if (nextInput) nextInput.focus()
        }
      } else {
        // Not last row - move down in same column
        const nextInput = inputRefs.current[`${rowIndex + 1}-${field}`]
        if (nextInput) nextInput.focus()
      }
    }
  }

  async function handleSaveTallies() {
    if (!selectedLoad || !selectedItemId) return

    const item = selectedLoad.items.find(i => i.id === selectedItemId)
    if (!item || !item.actual_footage) {
      toast.success('Error')
      return
    }

    // Warn if tallies don't match actual footage, but allow saving
    const totalTallied = tallies.reduce((sum, t) => sum + t.tally_board_feet, 0)
    if (Math.abs(totalTallied - item.actual_footage) > 0.01) {
      const diff = totalTallied - item.actual_footage
      toast.warning(`⚠️ Warning: Pack tallies (${totalTallied.toLocaleString()} BF) don't match actual footage (${item.actual_footage.toLocaleString()} BF). Difference: ${diff.toFixed(2)} BF. Saving anyway...`)
    }

    // Validate pack IDs are unique and non-zero
    const packIds = tallies.map(t => t.pack_id)
    const uniqueIds = new Set(packIds)
    if (uniqueIds.size !== packIds.length || packIds.some(id => id === 0)) {
      toast.success('Invalid Pack IDs')
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
        toast.success(`${tallies.length} pack tallies have been created`)
        setIsDialogOpen(false)
        fetchLoads()
      } else {
        const error = await response.json()
        toast.success('Error saving tallies')
      }
    } catch (error) {
      console.error('Error saving tallies:', error)
      toast.success('Error')
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

  const displayedLoads = isShowingHidden ? hiddenLoads : loads

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Tally Entry</h1>
          <p className="text-gray-600 mt-1">
            Enter pack tallies for arrived loads
          </p>
        </div>
        <Button
          variant={isShowingHidden ? 'default' : 'outline'}
          onClick={() => setIsShowingHidden(!isShowingHidden)}
        >
          {isShowingHidden ? (
            <>
              <Eye className="h-4 w-4 mr-2" />
              Showing Hidden ({hiddenLoads.length})
            </>
          ) : (
            <>
              <EyeOff className="h-4 w-4 mr-2" />
              Hidden Loads ({hiddenLoads.length})
            </>
          )}
        </Button>
      </div>

      {isShowingHidden && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 text-sm text-amber-800">
          Showing hidden loads. These loads were hidden because tallies were not expected. 
          They will automatically leave this list once they are out of inventory.
        </div>
      )}

      <div className="bg-white rounded-lg shadow overflow-hidden w-full">
        <table className="divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-2 text-left text-xs font-medium text-gray-500 uppercase whitespace-nowrap">
                Load ID
              </th>
              <th className="px-6 py-2 text-left text-xs font-medium text-gray-500 uppercase whitespace-nowrap">
                Supplier
              </th>
              <th className="px-6 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                Items to Tally
              </th>
              <th className="px-6 py-2 text-left text-xs font-medium text-gray-500 uppercase whitespace-nowrap">
                Arrival Date
              </th>
              <th className="px-6 py-2"></th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {displayedLoads.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-6 py-12 text-center text-gray-500">
                  {isShowingHidden ? 'No hidden loads' : 'No loads needing tally entry'}
                </td>
              </tr>
            ) : (
              displayedLoads.map((load) => (
                <tr key={load.id} className="hover:bg-gray-50">
                  <td className="px-6 py-3 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">{load.load_id}</div>
                  </td>
                  <td className="px-6 py-3 whitespace-nowrap">
                    <div className="text-sm text-gray-900">{load.supplier_name}</div>
                  </td>
                  <td className="px-6 py-3">
                    <div className="space-y-1">
                      {load.items.map((item) => (
                        <div key={item.id} className="text-sm text-gray-900">
                          {item.species} - {item.grade} ({item.thickness}) - {item.actual_footage?.toLocaleString()} BF
                        </div>
                      ))}
                    </div>
                  </td>
                  <td className="px-6 py-3 whitespace-nowrap">
                    <div className="text-sm text-gray-900">
                      {load.actual_arrival_date 
                        ? new Date(load.actual_arrival_date).toLocaleDateString('en-US', { timeZone: 'UTC' })
                        : '-'}
                    </div>
                  </td>
                  <td className="px-6 py-3 whitespace-nowrap">
                    <div className="flex items-center gap-1">
                      {!isShowingHidden && load.items.map((item) => (
                        <Button
                          key={item.id}
                          size="sm"
                          onClick={() => handleOpenTallyDialog(load, item.id)}
                        >
                          Enter Tallies
                        </Button>
                      ))}
                      {isShowingHidden ? (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleToggleHidden(load.id, false)}
                          title="Move back to main list"
                        >
                          <Undo2 className="h-4 w-4 mr-1" />
                          Unhide
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleToggleHidden(load.id, true)}
                          title="Hide from tally list"
                        >
                          <EyeOff className="h-4 w-4" />
                        </Button>
                      )}
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
              <div className="flex items-center gap-2">
                <Label htmlFor="rowCount" className="text-sm whitespace-nowrap">Rows:</Label>
                <Input
                  id="rowCount"
                  type="number"
                  value={rowCount}
                  onChange={(e) => setRowCount(parseInt(e.target.value) || 1)}
                  className="w-20 h-8 text-sm"
                  min="1"
                />
                <Button
                  type="button"
                  size="sm"
                  onClick={handleSetRowCount}
                  variant="outline"
                >
                  <Check className="h-4 w-4" />
                </Button>
                <Button
                  type="button"
                  size="sm"
                  onClick={handleAddRow}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add Row
                </Button>
              </div>
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
                          type="text"
                          value={tally.pack_id || ''}
                          onChange={(e) => handleTallyChange(index, 'pack_id', e.target.value)}
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
