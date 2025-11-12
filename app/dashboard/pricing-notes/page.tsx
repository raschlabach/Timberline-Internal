'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger 
} from '@/components/ui/dialog';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from '@/components/ui/dropdown-menu';
import { 
  Plus, 
  Search, 
  Filter, 
  MoreHorizontal, 
  Edit, 
  Trash2, 
  Eye, 
  EyeOff,
  Tag,
  Users,
  FileText,
  Settings
} from 'lucide-react';
import { toast } from 'sonner';
import { 
  PricingNote, 
  PricingCategory, 
  PricingNotesFilters,
  PricingNoteFormData
} from '@/types/pricing-notes';
import { PricingNoteForm } from '@/components/pricing-notes/pricing-note-form';
import { CategoryManager } from '@/components/pricing-notes/category-manager';

export default function PricingNotesPage() {
  const [notes, setNotes] = useState<PricingNote[]>([]);
  const [categories, setCategories] = useState<PricingCategory[]>([]);
  const [customers, setCustomers] = useState<Array<{ id: number; customer_name: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('notes');
  
  // Filters
  const [notesFilters, setNotesFilters] = useState<PricingNotesFilters>({
    search: '',
    category_id: undefined,
    is_active: undefined
  });

  // Dialog states
  const [isNoteDialogOpen, setIsNoteDialogOpen] = useState(false);
  const [editingNote, setEditingNote] = useState<PricingNote | null>(null);

  // Load initial data
  useEffect(() => {
    loadData();
  }, []);

  // Load filtered data when filters change
  useEffect(() => {
    if (activeTab === 'notes') {
      loadNotes();
    }
  }, [notesFilters, activeTab]);

  async function loadData() {
    try {
      setLoading(true);
      await Promise.all([
        loadCategories(),
        loadCustomers(),
        loadNotes()
      ]);
    } catch (error) {
      console.error('Error loading data:', error);
      toast.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  }

  async function loadCategories() {
    try {
      const response = await fetch('/api/pricing-categories');
      if (response.ok) {
        const data = await response.json();
        setCategories(data);
      }
    } catch (error) {
      console.error('Error loading categories:', error);
    }
  }

  async function loadCustomers() {
    try {
      const response = await fetch('/api/customers');
      if (response.ok) {
        const data = await response.json();
        setCustomers(data);
      }
    } catch (error) {
      console.error('Error loading customers:', error);
    }
  }

  async function loadNotes() {
    try {
      const params = new URLSearchParams();
      if (notesFilters.search) params.append('search', notesFilters.search);
      if (notesFilters.category_id) params.append('category_id', notesFilters.category_id.toString());
      if (notesFilters.is_active !== undefined) params.append('is_active', notesFilters.is_active.toString());

      const response = await fetch(`/api/pricing-notes?${params}`);
      if (response.ok) {
        const data = await response.json();
        setNotes(data);
      }
    } catch (error) {
      console.error('Error loading notes:', error);
    }
  }


  async function handleDeleteNote(noteId: number) {
    if (!confirm('Are you sure you want to delete this pricing note?')) return;

    try {
      const response = await fetch(`/api/pricing-notes/${noteId}`, {
        method: 'DELETE'
      });

      if (response.ok) {
        toast.success('Pricing note deleted successfully');
        loadNotes();
      } else {
        toast.error('Failed to delete pricing note');
      }
    } catch (error) {
      console.error('Error deleting note:', error);
      toast.error('Failed to delete pricing note');
    }
  }


  async function handleToggleNoteActive(noteId: number, isActive: boolean) {
    try {
      const note = notes.find(n => n.id === noteId);
      if (!note) return;

      const response = await fetch(`/api/pricing-notes/${noteId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...note,
          is_active: !isActive
        })
      });

      if (response.ok) {
        toast.success(`Pricing note ${!isActive ? 'activated' : 'deactivated'}`);
        loadNotes();
      } else {
        toast.error('Failed to update pricing note');
      }
    } catch (error) {
      console.error('Error toggling note active status:', error);
      toast.error('Failed to update pricing note');
    }
  }


  function handleEditNote(note: PricingNote) {
    setEditingNote(note);
    setIsNoteDialogOpen(true);
  }

  function handleCreateNote() {
    setEditingNote(null);
    setIsNoteDialogOpen(true);
  }

  function handleNoteDialogClose() {
    setIsNoteDialogOpen(false);
    setEditingNote(null);
    loadNotes();
  }


  async function handleNoteSubmit(data: PricingNoteFormData) {
    try {
      const url = editingNote ? `/api/pricing-notes/${editingNote.id}` : '/api/pricing-notes';
      const method = editingNote ? 'PUT' : 'POST';
      
      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });

      if (response.ok) {
        toast.success(editingNote ? 'Pricing note updated successfully' : 'Pricing note created successfully');
        handleNoteDialogClose();
      } else {
        const error = await response.json();
        toast.error(error.error || 'Failed to save pricing note');
      }
    } catch (error) {
      console.error('Error saving note:', error);
      toast.error('Failed to save pricing note');
    }
  }


  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-lg">Loading pricing notes...</div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Pricing Notes</h1>
          <p className="text-muted-foreground">
            Organize and manage your pricing information for different scenarios
          </p>
        </div>
        <Button onClick={handleCreateNote} className="flex items-center gap-2">
          <Plus className="h-4 w-4" />
          New Note
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList>
          <TabsTrigger value="notes" className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Notes ({notes.length})
          </TabsTrigger>
          <TabsTrigger value="categories" className="flex items-center gap-2">
            <Settings className="h-4 w-4" />
            Categories ({categories.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="notes" className="space-y-4">
          {/* Notes Filters */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Filter className="h-5 w-5" />
                Filter Notes
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex gap-4">
                <div className="flex-1">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search notes..."
                      value={notesFilters.search || ''}
                      onChange={(e) => setNotesFilters(prev => ({ ...prev, search: e.target.value }))}
                      className="pl-10"
                    />
                  </div>
                </div>
                <Select
                  value={notesFilters.category_id?.toString() || 'all'}
                  onValueChange={(value) => setNotesFilters(prev => ({ 
                    ...prev, 
                    category_id: value === 'all' ? undefined : parseInt(value)
                  }))}
                >
                  <SelectTrigger className="w-48">
                    <SelectValue placeholder="All Categories" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Categories</SelectItem>
                    {categories.map((category) => (
                      <SelectItem key={category.id} value={category.id.toString()}>
                        {category.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select
                  value={notesFilters.is_active?.toString() || 'all'}
                  onValueChange={(value) => setNotesFilters(prev => ({ 
                    ...prev, 
                    is_active: value === 'all' ? undefined : value === 'true' 
                  }))}
                >
                  <SelectTrigger className="w-32">
                    <SelectValue placeholder="All Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="true">Active</SelectItem>
                    <SelectItem value="false">Inactive</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Notes Grid */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {notes.map((note) => (
              <Card key={note.id} className={`${!note.is_active ? 'opacity-60' : ''}`}>
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <CardTitle className="text-lg">{note.title}</CardTitle>
                      <div className="flex items-center gap-2">
                        <Badge 
                          variant="secondary" 
                          style={{ backgroundColor: note.category?.color + '20', color: note.category?.color }}
                        >
                          {note.category?.name}
                        </Badge>
                        {!note.is_active && (
                          <Badge variant="outline">Inactive</Badge>
                        )}
                      </div>
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => handleEditNote(note)}>
                          <Edit className="h-4 w-4 mr-2" />
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem 
                          onClick={() => handleToggleNoteActive(note.id, note.is_active)}
                        >
                          {note.is_active ? (
                            <>
                              <EyeOff className="h-4 w-4 mr-2" />
                              Deactivate
                            </>
                          ) : (
                            <>
                              <Eye className="h-4 w-4 mr-2" />
                              Activate
                            </>
                          )}
                        </DropdownMenuItem>
                        <DropdownMenuItem 
                          onClick={() => handleDeleteNote(note.id)}
                          className="text-destructive"
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground line-clamp-3 mb-3">
                    {note.content}
                  </p>
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <div className="flex items-center gap-4">
                      {note.tags.length > 0 && (
                        <div className="flex items-center gap-1">
                          <Tag className="h-3 w-3" />
                          {note.tags.slice(0, 2).join(', ')}
                          {note.tags.length > 2 && ` +${note.tags.length - 2}`}
                        </div>
                      )}
                      {note.linked_customers && note.linked_customers.length > 0 && (
                        <div className="flex items-center gap-1">
                          <Users className="h-3 w-3" />
                          {note.linked_customers.length} customer(s)
                        </div>
                      )}
                    </div>
                    <div>
                      {new Date(note.updated_at).toLocaleDateString()}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {notes.length === 0 && (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <FileText className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">No pricing notes found</h3>
                <p className="text-muted-foreground text-center mb-4">
                  Create your first pricing note to get started with organizing your pricing information.
                </p>
                <Button onClick={handleCreateNote}>
                  <Plus className="h-4 w-4 mr-2" />
                  Create Note
                </Button>
              </CardContent>
            </Card>
          )}
        </TabsContent>


        <TabsContent value="categories" className="space-y-4">
          <CategoryManager 
            categories={categories} 
            onCategoriesChange={loadCategories}
          />
        </TabsContent>
      </Tabs>

      {/* Note Dialog */}
      <Dialog open={isNoteDialogOpen} onOpenChange={setIsNoteDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {editingNote ? 'Edit Pricing Note' : 'Create New Pricing Note'}
            </DialogTitle>
            <DialogDescription>
              {editingNote 
                ? 'Update the pricing note information below.' 
                : 'Create a new pricing note to organize your pricing information.'
              }
            </DialogDescription>
          </DialogHeader>
          <PricingNoteForm
            note={editingNote}
            categories={categories}
            customers={customers}
            onSubmit={handleNoteSubmit}
            onCancel={handleNoteDialogClose}
          />
        </DialogContent>
      </Dialog>

    </div>
  );
}
