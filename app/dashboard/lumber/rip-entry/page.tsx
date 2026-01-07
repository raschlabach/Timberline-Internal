'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { LumberLoadWithDetails, LumberPackWithDetails } from '@/types/lumber'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { RefreshCcw, Save } from 'lucide-react'
import { useToast } from '@/components/ui/use-toast'

interface User {
  id: number
  full_name: string
}

export default function RipEntryPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const { toast } = useToast()
  
  const [loads, setLoads] = useState<LumberLoadWithDetails[]>([])
  const [users, setUsers] = useState<User[]>([])
  const [selectedLoad, setSelectedLoad] = useState<LumberLoadWithDetails | null>(null)
  const [packs, setPacks] = useState<LumberPackWithDetails[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  
  // Pack editing state
  const [packEdits, setPackEdits] = useState<{ [packId: number]: { 
    actual_board_feet: number | null,
    rip_yield: number | null,
    rip_comments: string | null
  } }>({})
  
  // Load-level operator/stacker assignment
  const [operatorId, setOperatorId] = useState<string>('')
  const [stacker1Id, setStacker1Id] = useState<string>('')
  const [stacker2Id, setStacker2Id] = useState<string>('')
  const [stacker3Id, setStacker3Id] = useState<string>('')
  const [stacker4Id, setStacker4Id] = useState<string>('')
  const [loadQuality, setLoadQuality] = useState<string>('')

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/login?callbackUrl=/dashboard/lumber/rip-entry')
    }
  }, [status, router])

  async function fetchLoads() {
    try {
      const [loadsRes, usersRes] = await Promise.all([
        fetch('/api/lumber/loads/for-rip'),
        fetch('/api/users')
      ])
      
      if (loadsRes.ok) setLoads(await loadsRes.json())
      if (usersRes.ok) setUsers(await usersRes.json())
    } catch (error) {
      console.error('Error fetching rip entry data:', error)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    if (status === 'authenticated') {
      fetchLoads()
    }
  }, [status])

  async function handleSelectLoad(loadId: number) {
    const load = loads.find(l => l.id === loadId)
    if (!load) return

    setSelectedLoad(load)
    
    // Fetch packs for this load
    try {
      const response = await fetch(`/api/lumber/packs/by-load/${loadId}`)
      if (response.ok) {
        const data = await response.json()
        setPacks(data)
        
        // Initialize pack edits
        const edits: typeof packEdits = {}
        data.forEach((pack: LumberPackWithDetails) => {
          edits[pack.id] = {
            actual_board_feet: pack.actual_board_feet,
            rip_yield: pack.rip_yield,
            rip_comments: pack.rip_comments
          }
        })
        setPackEdits(edits)
      }
    } catch (error) {
      console.error('Error fetching packs:', error)
    }
    
    // Reset operators/stackers
    setOperatorId('')
    setStacker1Id('')
    setStacker2Id('')
    setStacker3Id('')
    setStacker4Id('')
    setLoadQuality(load.load_quality?.toString() || '')
  }

  function handlePackEdit(packId: number, field: string, value: any) {
    setPackEdits({
      ...packEdits,
      [packId]: {
        ...packEdits[packId],
        [field]: value
      }
    })
  }

  async function handleSavePack(packId: number) {
    const edits = packEdits[packId]
    if (!edits) return

    try {
      const response = await fetch(`/api/lumber/packs/${packId}/rip-data`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(edits)
      })

      if (response.ok) {
        toast({
          title: 'Pack saved',
          description: 'Rip data has been saved'
        })
        
        // Refresh packs
        if (selectedLoad) {
          handleSelectLoad(selectedLoad.id)
        }
      }
    } catch (error) {
      console.error('Error saving pack:', error)
      toast({
        title: 'Error',
        description: 'Failed to save pack data',
        variant: 'destructive'
      })
    }
  }

  async function handleFinishPack(packId: number) {
    if (!operatorId) {
      toast({
        title: 'Missing Operator',
        description: 'Please select an operator before finishing packs',
        variant: 'destructive'
      })
      return
    }

    try {
      const response = await fetch(`/api/lumber/packs/${packId}/finish`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          operator_id: parseInt(operatorId),
          stacker_1_id: stacker1Id ? parseInt(stacker1Id) : null,
          stacker_2_id: stacker2Id ? parseInt(stacker2Id) : null,
          stacker_3_id: stacker3Id ? parseInt(stacker3Id) : null,
          stacker_4_id: stacker4Id ? parseInt(stacker4Id) : null
        })
      })

      if (response.ok) {
        toast({
          title: 'Pack finished',
          description: 'Pack has been marked as complete'
        })
        
        // Refresh
        if (selectedLoad) {
          handleSelectLoad(selectedLoad.id)
        }
      }
    } catch (error) {
      console.error('Error finishing pack:', error)
      toast({
        title: 'Error',
        description: 'Failed to finish pack',
        variant: 'destructive'
      })
    }
  }

  async function handleSaveLoadQuality() {
    if (!selectedLoad) return

    try {
      const response = await fetch(`/api/lumber/loads/${selectedLoad.id}/quality`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          load_quality: loadQuality ? parseInt(loadQuality) : null
        })
      })

      if (response.ok) {
        toast({
          title: 'Load quality saved',
          description: 'Quality rating has been updated'
        })
      }
    } catch (error) {
      console.error('Error saving load quality:', error)
    }
  }

  if (status === 'loading' || isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
      </div>
    )
  }

  const filteredLoads = loads.filter(load =>
    searchTerm === '' ||
    load.load_id.toLowerCase().includes(searchTerm.toLowerCase()) ||
    load.supplier_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    load.items.some(item =>
      item.species.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.grade.toLowerCase().includes(searchTerm.toLowerCase())
    )
  )

  const totalPacks = packs.length
  const finishedPacks = packs.filter(p => p.is_finished).length
  const totalBF = packs.reduce((sum, p) => sum + p.tally_board_feet, 0)
  const finishedBF = packs.filter(p => p.is_finished).reduce((sum, p) => sum + (p.actual_board_feet || 0), 0)
  const remainingBF = totalBF - finishedBF
  const avgLength = packs.length > 0 ? packs.reduce((sum, p) => sum + p.length, 0) / packs.length : 0

  // Group packs by length for the remaining display
  const remainingByLength = packs.filter(p => !p.is_finished).reduce((acc, pack) => {
    const len = pack.length
    acc[len] = (acc[len] || 0) + pack.tally_board_feet
    return acc
  }, {} as { [key: number]: number })

  return (
    <div className="p-3 space-y-4 max-w-7xl mx-auto">
      {/* Compact Header */}
      <div className="bg-white rounded shadow p-3">
        <h1 className="text-xl font-bold">Rip Entry</h1>
      </div>

      <div className="grid grid-cols-5 gap-4">
        {/* Load Selector - Compact */}
        <div className="col-span-2 bg-white rounded shadow p-3">
          <h2 className="font-semibold mb-2 text-sm">Inventory Loads</h2>
          <p className="text-xs text-gray-600 mb-2">Select a load from inventory to rip</p>
          <Input
            type="text"
            placeholder="Search Loads..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="mb-2 text-sm h-8"
          />
          <div className="border rounded overflow-auto" style={{ maxHeight: '400px' }}>
            <table className="w-full text-xs">
              <thead className="bg-gray-50 sticky top-0">
                <tr>
                  <th className="px-2 py-1 text-left">Load ID</th>
                  <th className="px-2 py-1 text-left">Species</th>
                  <th className="px-2 py-1 text-left">Grade</th>
                </tr>
              </thead>
              <tbody>
                {filteredLoads.map(load => (
                  <tr
                    key={load.id}
                    className={`cursor-pointer hover:bg-blue-50 ${
                      selectedLoad?.id === load.id ? 'bg-blue-100' : ''
                    }`}
                    onClick={() => handleSelectLoad(load.id)}
                  >
                    <td className="px-2 py-1 border-t">{load.load_id}</td>
                    <td className="px-2 py-1 border-t">
                      {load.items.map(i => i.species).join(', ')}
                    </td>
                    <td className="px-2 py-1 border-t">
                      {load.items.map(i => i.grade).join(', ')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Edit Pack Data - Compact */}
        <div className="col-span-3 bg-white rounded shadow p-3 space-y-3">
          {selectedLoad ? (
            <>
              <div>
                <h2 className="font-semibold text-sm mb-2">
                  Edit {selectedLoad.load_id} Data
                </h2>
                <div className="text-xs text-gray-700 flex gap-3 items-center flex-wrap mb-2">
                  <span className="font-semibold">{selectedLoad.load_id}</span>
                  <span>{selectedLoad.supplier_name}</span>
                  {selectedLoad.items.map((item, idx) => (
                    <span key={idx}>{item.species} - {item.grade}</span>
                  ))}
                  <span>{totalBF.toLocaleString()} ft</span>
                  <span>{selectedLoad.actual_arrival_date && new Date(selectedLoad.actual_arrival_date).toLocaleDateString()}</span>
                </div>
              </div>

              {/* Operator/Stacker Selection - Compact Row */}
              <div className="grid grid-cols-7 gap-2">
                <div>
                  <Label className="text-xs">Operator</Label>
                  <Select value={operatorId} onValueChange={setOperatorId}>
                    <SelectTrigger className="h-7 text-xs">
                      <SelectValue placeholder="Select" />
                    </SelectTrigger>
                    <SelectContent>
                      {users.map(user => (
                        <SelectItem key={user.id} value={user.id.toString()}>
                          {user.full_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">Stacker 1</Label>
                  <Select value={stacker1Id} onValueChange={setStacker1Id}>
                    <SelectTrigger className="h-7 text-xs">
                      <SelectValue placeholder="Select" />
                    </SelectTrigger>
                    <SelectContent>
                      {users.map(user => (
                        <SelectItem key={user.id} value={user.id.toString()}>
                          {user.full_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">Stacker 2</Label>
                  <Select value={stacker2Id} onValueChange={setStacker2Id}>
                    <SelectTrigger className="h-7 text-xs">
                      <SelectValue placeholder="Select" />
                    </SelectTrigger>
                    <SelectContent>
                      {users.map(user => (
                        <SelectItem key={user.id} value={user.id.toString()}>
                          {user.full_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">Stacker 3</Label>
                  <Select value={stacker3Id} onValueChange={setStacker3Id}>
                    <SelectTrigger className="h-7 text-xs">
                      <SelectValue placeholder="Select" />
                    </SelectTrigger>
                    <SelectContent>
                      {users.map(user => (
                        <SelectItem key={user.id} value={user.id.toString()}>
                          {user.full_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">Stacker 4</Label>
                  <Select value={stacker4Id} onValueChange={setStacker4Id}>
                    <SelectTrigger className="h-7 text-xs">
                      <SelectValue placeholder="Select" />
                    </SelectTrigger>
                    <SelectContent>
                      {users.map(user => (
                        <SelectItem key={user.id} value={user.id.toString()}>
                          {user.full_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">Load Quality</Label>
                  <Input
                    type="number"
                    min="0"
                    max="100"
                    value={loadQuality}
                    onChange={(e) => setLoadQuality(e.target.value)}
                    onBlur={handleSaveLoadQuality}
                    className="h-7 text-xs"
                    placeholder="0-100"
                  />
                </div>
              </div>

              {/* Current Load Status */}
              <div className="text-xs text-gray-700 flex gap-3 py-1 border-t border-b">
                <span>{remainingBF.toLocaleString()} Ft Left</span>
                {selectedLoad.items.map((item, idx) => (
                  <span key={idx}>{item.species} - {item.grade}</span>
                ))}
                <span>{totalBF.toLocaleString()} ft</span>
              </div>

              {/* Pack Tables - Side by Side, Compact */}
              <div className="grid grid-cols-2 gap-3">
                {/* Pack Info */}
                <div>
                  <h3 className="text-xs font-semibold mb-1">Pack Information</h3>
                  <div className="border rounded overflow-auto" style={{ maxHeight: '350px' }}>
                    <table className="w-full text-xs">
                      <thead className="bg-gray-50 sticky top-0">
                        <tr>
                          <th className="px-2 py-1 text-left">Pack ID</th>
                          <th className="px-2 py-1 text-left">Lth</th>
                          <th className="px-2 py-1 text-left">Brd Ft</th>
                        </tr>
                      </thead>
                      <tbody>
                        {packs.map(pack => (
                          <tr key={pack.id} className={pack.is_finished ? 'bg-green-50' : ''}>
                            <td className="px-2 py-1 border-t">{pack.pack_id}</td>
                            <td className="px-2 py-1 border-t">{pack.length}</td>
                            <td className="px-2 py-1 border-t">{pack.tally_board_feet}</td>
                          </tr>
                        ))}
                        <tr className="bg-gray-100 font-semibold">
                          <td className="px-2 py-1">{totalPacks} Packs</td>
                          <td className="px-2 py-1">{avgLength.toFixed(2)}</td>
                          <td className="px-2 py-1">{totalBF.toLocaleString()} BF</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Rip Yield & Comments */}
                <div>
                  <h3 className="text-xs font-semibold mb-1">Rip Yield & Comments</h3>
                  <div className="border rounded overflow-auto" style={{ maxHeight: '350px' }}>
                    <table className="w-full text-xs">
                      <thead className="bg-gray-50 sticky top-0">
                        <tr>
                          <th className="px-2 py-1 text-left">Act Brd Ft</th>
                          <th className="px-2 py-1 text-left">Rip Yield</th>
                          <th className="px-2 py-1 text-left">Comments</th>
                          <th className="px-2 py-1"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {packs.map(pack => (
                          <tr key={pack.id} className={pack.is_finished ? 'bg-green-50' : ''}>
                            <td className="px-1 py-1 border-t">
                              {pack.is_finished ? (
                                <span className="text-xs">{pack.actual_board_feet}</span>
                              ) : (
                                <Input
                                  type="number"
                                  step="0.01"
                                  value={packEdits[pack.id]?.actual_board_feet || ''}
                                  onChange={(e) => handlePackEdit(pack.id, 'actual_board_feet', parseFloat(e.target.value) || null)}
                                  onBlur={() => handleSavePack(pack.id)}
                                  className="h-6 text-xs px-1"
                                />
                              )}
                            </td>
                            <td className="px-1 py-1 border-t">
                              {pack.is_finished ? (
                                <span className="text-xs">{pack.rip_yield}</span>
                              ) : (
                                <Input
                                  type="number"
                                  step="0.01"
                                  value={packEdits[pack.id]?.rip_yield || ''}
                                  onChange={(e) => handlePackEdit(pack.id, 'rip_yield', parseFloat(e.target.value) || null)}
                                  onBlur={() => handleSavePack(pack.id)}
                                  className="h-6 text-xs px-1"
                                />
                              )}
                            </td>
                            <td className="px-1 py-1 border-t">
                              {pack.is_finished ? (
                                <span className="text-xs">{pack.rip_comments || '-'}</span>
                              ) : (
                                <Input
                                  value={packEdits[pack.id]?.rip_comments || ''}
                                  onChange={(e) => handlePackEdit(pack.id, 'rip_comments', e.target.value)}
                                  onBlur={() => handleSavePack(pack.id)}
                                  className="h-6 text-xs px-1"
                                />
                              )}
                            </td>
                            <td className="px-1 py-1 border-t">
                              {!pack.is_finished && (
                                <Button
                                  size="sm"
                                  onClick={() => handleFinishPack(pack.id)}
                                  className="h-6 px-2 text-xs"
                                  disabled={!packEdits[pack.id]?.actual_board_feet || !packEdits[pack.id]?.rip_yield}
                                >
                                  <RefreshCcw className="h-3 w-3" />
                                </Button>
                              )}
                            </td>
                          </tr>
                        ))}
                        <tr className="bg-gray-100 font-semibold">
                          <td className="px-2 py-1">{finishedBF.toLocaleString()} BF</td>
                          <td className="px-2 py-1">
                            {packs.length > 0 
                              ? (packs.filter(p => p.rip_yield).reduce((sum, p) => sum + (p.rip_yield || 0), 0) / packs.filter(p => p.rip_yield).length).toFixed(2)
                              : '0.00'} Avg
                          </td>
                          <td colSpan={2}></td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

              {/* Remaining Board Feet by Length */}
              <div className="border-t pt-2">
                <h3 className="text-xs font-semibold mb-1">Board Feet Remaining</h3>
                <div className="flex gap-4">
                  {Object.entries(remainingByLength).map(([length, bf]) => (
                    <div key={length} className="text-xs">
                      <span className="font-semibold">{length} ft:</span>{' '}
                      <span>{Number(bf).toLocaleString()} brd ft</span>
                    </div>
                  ))}
                </div>
              </div>
            </>
          ) : (
            <div className="text-center text-gray-500 py-12">
              Select a load to begin rip entry
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
