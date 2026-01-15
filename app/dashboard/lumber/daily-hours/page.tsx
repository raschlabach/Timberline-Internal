'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Clock, Plus, Edit, Trash2, Calendar } from 'lucide-react'
import { toast } from 'sonner'

interface WorkSession {
  id: number
  operator_id: number
  operator_name: string
  work_date: string
  start_time: string
  end_time: string
  total_hours: string
  notes: string | null
}

interface Operator {
  id: number
  name: string
}

export default function DailyHoursPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  
  const [workSessions, setWorkSessions] = useState<WorkSession[]>([])
  const [operators, setOperators] = useState<Operator[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1)
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear())
  
  // Dialog state
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingSession, setEditingSession] = useState<WorkSession | null>(null)
  const [formData, setFormData] = useState({
    operator_id: '',
    work_date: new Date().toISOString().split('T')[0],
    start_time: '07:00',
    end_time: '15:30',
    notes: ''
  })

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/login?callbackUrl=/dashboard/lumber/daily-hours')
    }
  }, [status, router])

  async function fetchData() {
    try {
      const [sessionsRes, operatorsRes] = await Promise.all([
        fetch(`/api/lumber/work-sessions?month=${selectedMonth}&year=${selectedYear}`),
        fetch('/api/lumber/operators')
      ])

      if (sessionsRes.ok) {
        setWorkSessions(await sessionsRes.json())
      }
      if (operatorsRes.ok) {
        setOperators(await operatorsRes.json())
      }
    } catch (error) {
      console.error('Error fetching data:', error)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    if (status === 'authenticated') {
      fetchData()
    }
  }, [status, selectedMonth, selectedYear])

  function openAddDialog() {
    setEditingSession(null)
    setFormData({
      operator_id: '',
      work_date: new Date().toISOString().split('T')[0],
      start_time: '07:00',
      end_time: '15:30',
      notes: ''
    })
    setIsDialogOpen(true)
  }

  function openEditDialog(session: WorkSession) {
    setEditingSession(session)
    setFormData({
      operator_id: session.operator_id.toString(),
      work_date: session.work_date.split('T')[0],
      start_time: session.start_time.substring(0, 5),
      end_time: session.end_time.substring(0, 5),
      notes: session.notes || ''
    })
    setIsDialogOpen(true)
  }

  async function handleSave() {
    if (!formData.operator_id || !formData.work_date || !formData.start_time || !formData.end_time) {
      toast.error('Please fill in all required fields')
      return
    }

    try {
      const url = editingSession 
        ? `/api/lumber/work-sessions/${editingSession.id}`
        : '/api/lumber/work-sessions'
      
      const method = editingSession ? 'PATCH' : 'POST'
      
      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          operator_id: parseInt(formData.operator_id),
          work_date: formData.work_date,
          start_time: formData.start_time,
          end_time: formData.end_time,
          notes: formData.notes || null
        })
      })

      if (response.ok) {
        toast.success(editingSession ? 'Hours updated' : 'Hours logged')
        setIsDialogOpen(false)
        fetchData()
      } else {
        const error = await response.json()
        toast.error(error.error || 'Failed to save')
      }
    } catch (error) {
      console.error('Error saving:', error)
      toast.error('Failed to save')
    }
  }

  async function handleDelete(id: number) {
    if (!confirm('Are you sure you want to delete this entry?')) return

    try {
      const response = await fetch(`/api/lumber/work-sessions/${id}`, {
        method: 'DELETE'
      })

      if (response.ok) {
        toast.success('Entry deleted')
        fetchData()
      } else {
        toast.error('Failed to delete')
      }
    } catch (error) {
      console.error('Error deleting:', error)
      toast.error('Failed to delete')
    }
  }

  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ]
  const years = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i)

  // Calculate total hours for the month
  const totalHours = workSessions.reduce((sum, s) => sum + Number(s.total_hours || 0), 0)

  // Group sessions by date
  const sessionsByDate = workSessions.reduce((acc: Record<string, WorkSession[]>, session) => {
    const date = session.work_date.split('T')[0]
    if (!acc[date]) acc[date] = []
    acc[date].push(session)
    return acc
  }, {})

  if (status === 'loading' || isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Daily Hours</h1>
          <p className="text-gray-600 mt-1">Log daily work hours for rip bonus calculations</p>
        </div>
        <div className="flex items-center gap-3">
          <Calendar className="h-5 w-5 text-gray-400" />
          <Select 
            value={selectedMonth.toString()} 
            onValueChange={(val) => setSelectedMonth(parseInt(val))}
          >
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {months.map((month, idx) => (
                <SelectItem key={idx} value={(idx + 1).toString()}>
                  {month}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select 
            value={selectedYear.toString()} 
            onValueChange={(val) => setSelectedYear(parseInt(val))}
          >
            <SelectTrigger className="w-24">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {years.map(year => (
                <SelectItem key={year} value={year.toString()}>
                  {year}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button onClick={openAddDialog}>
            <Plus className="h-4 w-4 mr-2" />
            Log Hours
          </Button>
        </div>
      </div>

      {/* Summary Card */}
      <div className="bg-blue-50 rounded-lg p-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Clock className="h-8 w-8 text-blue-600" />
          <div>
            <div className="text-sm text-blue-600 font-medium">
              {months[selectedMonth - 1]} {selectedYear} Total
            </div>
            <div className="text-2xl font-bold text-blue-900">
              {totalHours.toFixed(1)} Hours
            </div>
          </div>
        </div>
        <div className="text-sm text-blue-700">
          {workSessions.length} entries logged
        </div>
      </div>

      {/* Sessions List */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="px-4 py-2 bg-gray-800 text-white">
          <h2 className="text-sm font-semibold">Work Sessions</h2>
        </div>
        
        {Object.keys(sessionsByDate).length === 0 ? (
          <div className="p-12 text-center text-gray-500">
            <Clock className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>No hours logged for {months[selectedMonth - 1]} {selectedYear}</p>
            <Button variant="outline" className="mt-4" onClick={openAddDialog}>
              <Plus className="h-4 w-4 mr-2" />
              Log Your First Entry
            </Button>
          </div>
        ) : (
          <div className="divide-y">
            {Object.entries(sessionsByDate)
              .sort(([a], [b]) => b.localeCompare(a))
              .map(([date, sessions]) => (
                <div key={date}>
                  {/* Date Header */}
                  <div className="bg-gray-100 px-4 py-2 flex items-center justify-between">
                    <div className="font-semibold text-sm text-gray-700">
                      {new Date(date + 'T12:00:00').toLocaleDateString('en-US', { 
                        weekday: 'long', 
                        month: 'short', 
                        day: 'numeric' 
                      })}
                    </div>
                    <div className="text-sm text-gray-500">
                      {sessions.reduce((sum, s) => sum + Number(s.total_hours || 0), 0).toFixed(1)} hrs total
                    </div>
                  </div>
                  
                  {/* Sessions for this date */}
                  {sessions.map(session => (
                    <div 
                      key={session.id} 
                      className="px-4 py-3 flex items-center justify-between hover:bg-gray-50"
                    >
                      <div className="flex items-center gap-6">
                        <div className="w-32">
                          <div className="font-medium text-sm">{session.operator_name}</div>
                        </div>
                        <div className="flex items-center gap-2 text-sm">
                          <span className="text-gray-500">Start:</span>
                          <span className="font-mono bg-gray-100 px-2 py-0.5 rounded">
                            {session.start_time.substring(0, 5)}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 text-sm">
                          <span className="text-gray-500">End:</span>
                          <span className="font-mono bg-gray-100 px-2 py-0.5 rounded">
                            {session.end_time.substring(0, 5)}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 text-sm">
                          <span className="text-gray-500">Total:</span>
                          <span className="font-semibold text-blue-600">
                            {Number(session.total_hours || 0).toFixed(1)} hrs
                          </span>
                        </div>
                        {session.notes && (
                          <div className="text-xs text-gray-500 italic max-w-[200px] truncate">
                            {session.notes}
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-1">
                        <Button 
                          variant="ghost" 
                          size="sm"
                          className="h-8 w-8 p-0"
                          onClick={() => openEditDialog(session)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="sm"
                          className="h-8 w-8 p-0 text-red-600 hover:text-red-700"
                          onClick={() => handleDelete(session.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              ))}
          </div>
        )}
      </div>

      {/* Add/Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingSession ? 'Edit Work Hours' : 'Log Work Hours'}
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div>
              <Label>Operator *</Label>
              <Select 
                value={formData.operator_id} 
                onValueChange={(val) => setFormData({ ...formData, operator_id: val })}
                disabled={!!editingSession}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Select operator" />
                </SelectTrigger>
                <SelectContent>
                  {operators.map(op => (
                    <SelectItem key={op.id} value={op.id.toString()}>
                      {op.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <Label>Work Date *</Label>
              <Input
                type="date"
                value={formData.work_date}
                onChange={(e) => setFormData({ ...formData, work_date: e.target.value })}
                className="mt-1"
                disabled={!!editingSession}
              />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Start Time *</Label>
                <Input
                  type="time"
                  value={formData.start_time}
                  onChange={(e) => setFormData({ ...formData, start_time: e.target.value })}
                  className="mt-1"
                />
              </div>
              <div>
                <Label>End Time *</Label>
                <Input
                  type="time"
                  value={formData.end_time}
                  onChange={(e) => setFormData({ ...formData, end_time: e.target.value })}
                  className="mt-1"
                />
              </div>
            </div>
            
            <div>
              <Label>Notes</Label>
              <Textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="Optional notes..."
                className="mt-1"
                rows={2}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave}>
              {editingSession ? 'Save Changes' : 'Log Hours'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
