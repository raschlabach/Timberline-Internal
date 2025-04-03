import { useState, useEffect, Fragment } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
} from '@/components/ui/modal';
import { Trash, Pencil, Plus } from 'lucide-react';
import { format, parseISO } from 'date-fns';

interface Quote {
  id: number;
  description: string;
  price: number;
  quote_date: string;
  created_at: string;
  updated_at: string;
}

interface CustomerQuotesProps {
  customerId: number;
}

export function CustomerQuotes({ customerId }: CustomerQuotesProps) {
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [selectedQuote, setSelectedQuote] = useState<Quote | null>(null);
  
  const [formData, setFormData] = useState({
    description: '',
    price: '',
    quote_date: ''
  });
  
  // Fetch quotes
  const fetchQuotes = async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      const res = await fetch(`/api/customers/${customerId}/quotes`);
      if (!res.ok) {
        throw new Error('Failed to fetch quotes');
      }
      
      const data = await res.json();
      // Ensure price is converted to a number
      const formattedData = data.map((quote: any) => ({
        ...quote,
        price: typeof quote.price === 'string' ? parseFloat(quote.price) : Number(quote.price)
      }));
      setQuotes(formattedData);
    } catch (err: any) {
      console.error('Error fetching quotes:', err);
      setError(err.message || 'An error occurred while fetching quotes');
    } finally {
      setIsLoading(false);
    }
  };
  
  useEffect(() => {
    if (customerId) {
      fetchQuotes();
    }
  }, [customerId]);
  
  // Reset form and close dialog
  const resetForm = () => {
    setFormData({
      description: '',
      price: '',
      quote_date: ''
    });
    setSelectedQuote(null);
    setIsCreateDialogOpen(false);
    setIsEditDialogOpen(false);
  };
  
  // Handle form input change
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };
  
  // Create a new quote
  const handleCreateQuote = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      const res = await fetch(`/api/customers/${customerId}/quotes`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          description: formData.description,
          price: parseFloat(formData.price),
          quote_date: formData.quote_date
        })
      });
      
      if (!res.ok) {
        throw new Error('Failed to create quote');
      }
      
      await fetchQuotes();
      resetForm();
    } catch (err: any) {
      console.error('Error creating quote:', err);
      setError(err.message || 'An error occurred while creating the quote');
    }
  };
  
  // Edit quote
  const handleEditQuote = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedQuote) return;
    
    try {
      const res = await fetch(`/api/customers/${customerId}/quotes/${selectedQuote.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          description: formData.description,
          price: parseFloat(formData.price),
          quote_date: formData.quote_date
        })
      });
      
      if (!res.ok) {
        throw new Error('Failed to update quote');
      }
      
      await fetchQuotes();
      resetForm();
    } catch (err: any) {
      console.error('Error updating quote:', err);
      setError(err.message || 'An error occurred while updating the quote');
    }
  };
  
  // Delete quote
  const handleDeleteQuote = async (quoteId: number) => {
    if (!confirm('Are you sure you want to delete this quote?')) {
      return;
    }
    
    try {
      const res = await fetch(`/api/customers/${customerId}/quotes/${quoteId}`, {
        method: 'DELETE'
      });
      
      if (!res.ok) {
        throw new Error('Failed to delete quote');
      }
      
      await fetchQuotes();
    } catch (err: any) {
      console.error('Error deleting quote:', err);
      setError(err.message || 'An error occurred while deleting the quote');
    }
  };
  
  // Set up edit form
  const handleEditClick = (quote: Quote) => {
    setSelectedQuote(quote);
    setFormData({
      description: quote.description,
      price: quote.price.toString(),
      quote_date: quote.quote_date
    });
    setIsEditDialogOpen(true);
  };

  // Format date for display
  const formatDate = (dateString: string) => {
    try {
      return format(parseISO(dateString), 'MM/dd/yyyy');
    } catch (error) {
      return dateString;
    }
  };
  
  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-medium">Quote History</h3>
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button 
              variant="default" 
              size="sm" 
              className="flex items-center gap-1"
            >
              <Plus size={16} /> Add Quote
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create New Quote</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleCreateQuote} className="space-y-4 mt-4">
              <div className="space-y-2">
                <label htmlFor="quote_date" className="block text-sm font-medium">
                  Date
                </label>
                <input
                  id="quote_date"
                  name="quote_date"
                  type="date"
                  value={formData.quote_date}
                  onChange={handleInputChange}
                  className="block w-full rounded-md border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>
              
              <div className="space-y-2">
                <label htmlFor="description" className="block text-sm font-medium">
                  Description
                </label>
                <input
                  id="description"
                  name="description"
                  value={formData.description}
                  onChange={handleInputChange}
                  className="block w-full rounded-md border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>
              
              <div className="space-y-2">
                <label htmlFor="price" className="block text-sm font-medium">
                  Price ($)
                </label>
                <input
                  id="price"
                  name="price"
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.price}
                  onChange={handleInputChange}
                  className="block w-full rounded-md border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>
              
              <DialogFooter>
                <Button 
                  type="button" 
                  variant="outline"
                  onClick={() => setIsCreateDialogOpen(false)}
                >
                  Cancel
                </Button>
                <Button type="submit">Create Quote</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>
      
      {error && (
        <div className="text-red-500 text-sm p-2 bg-red-50 rounded-md">
          {error}
        </div>
      )}
      
      {isLoading ? (
        <div className="text-center p-4">Loading quotes...</div>
      ) : quotes.length === 0 ? (
        <div className="text-center p-4 border rounded-md text-muted-foreground">
          No quotes found for this customer
        </div>
      ) : (
        <div className="space-y-3">
          {quotes.map(quote => (
            <div key={quote.id} className="p-3 border rounded-md">
              <div className="flex justify-between">
                <div>
                  <div className="flex gap-4 mb-1">
                    <div className="font-medium">{formatDate(quote.quote_date)}</div>
                    <div className="font-bold text-green-600">
                      ${Number.isNaN(parseFloat(String(quote.price))) ? '0.00' : parseFloat(String(quote.price)).toFixed(2)}
                    </div>
                  </div>
                  <div className="text-sm">{quote.description}</div>
                </div>
                <div className="flex gap-2">
                  <Button 
                    variant="ghost" 
                    size="sm"
                    onClick={() => handleEditClick(quote)}
                  >
                    <Pencil size={16} />
                  </Button>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="text-red-500"
                    onClick={() => handleDeleteQuote(quote.id)}
                  >
                    <Trash size={16} />
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
      
      {/* Edit Quote Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Quote</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleEditQuote} className="space-y-4 mt-4">
            <div className="space-y-2">
              <label htmlFor="edit_quote_date" className="block text-sm font-medium">
                Date
              </label>
              <input
                id="edit_quote_date"
                name="quote_date"
                type="date"
                value={formData.quote_date}
                onChange={handleInputChange}
                className="block w-full rounded-md border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>
            
            <div className="space-y-2">
              <label htmlFor="edit_description" className="block text-sm font-medium">
                Description
              </label>
              <input
                id="edit_description"
                name="description"
                value={formData.description}
                onChange={handleInputChange}
                className="block w-full rounded-md border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>
            
            <div className="space-y-2">
              <label htmlFor="edit_price" className="block text-sm font-medium">
                Price ($)
              </label>
              <input
                id="edit_price"
                name="price"
                type="number"
                step="0.01"
                min="0"
                value={formData.price}
                onChange={handleInputChange}
                className="block w-full rounded-md border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>
            
            <DialogFooter>
              <Button 
                type="button" 
                variant="outline"
                onClick={() => setIsEditDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit">Update Quote</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
} 