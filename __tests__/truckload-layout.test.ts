import { query } from '@/lib/db'
import { NextRequest } from 'next/server'
import { GET, POST } from '@/app/api/truckloads/[id]/layout/route'

// Mock NextAuth session
jest.mock('next-auth', () => ({
  getServerSession: jest.fn(() => Promise.resolve({ user: { id: 1 } }))
}))

// Mock database query
jest.mock('@/lib/db', () => {
  const mockQuery = jest.fn()
  const mockClient = {
    query: mockQuery,
    release: jest.fn(),
    connect: jest.fn()
  }
  return {
    query: mockQuery,
    getClient: jest.fn(() => Promise.resolve(mockClient))
  }
})

describe('Truckload Layout API', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('GET /api/truckloads/[id]/layout', () => {
    it('should retrieve layout with correct stack positions', async () => {
      // Mock database response
      const mockRows = [
        {
          item_id: 1,
          x_position: 0,
          y_position: 0,
          width: 4,
          length: 8,
          item_type: 'vinyl',
          rotation: 0,
          customer_id: 1,
          customer_name: 'Test Customer',
          stack_id: 1,
          stack_position: 1
        },
        {
          item_id: 2,
          x_position: 0,
          y_position: 0,
          width: 4,
          length: 8,
          item_type: 'vinyl',
          rotation: 0,
          customer_id: 1,
          customer_name: 'Test Customer',
          stack_id: 1,
          stack_position: 2
        }
      ]

      ;(query as jest.Mock).mockResolvedValueOnce({ rows: mockRows })

      const request = new NextRequest('http://localhost:3000/api/truckloads/1/layout')
      const response = await GET(request, { params: { id: '1' } })
      const data = await response.json()

      expect(data.success).toBe(true)
      expect(data.layout).toHaveLength(2)
      
      // Verify stack positions are preserved
      const stackItems = data.layout.filter((item: any) => item.stackId === 1)
      expect(stackItems[0].stackPosition).toBe(2) // Top item should have higher position
      expect(stackItems[1].stackPosition).toBe(1) // Bottom item should have position 1
    })
  })

  describe('POST /api/truckloads/[id]/layout', () => {
    it('should save layout with correct stack positions', async () => {
      const mockQuery = jest.fn()
        .mockResolvedValueOnce({ rows: [] }) // SELECT layout
        .mockResolvedValueOnce({ rows: [{ id: 1 }] }) // INSERT INTO trailer_layouts
        .mockResolvedValueOnce({ rows: [] }) // DELETE
        .mockResolvedValueOnce({ rows: [{ id: 1 }] }) // First INSERT
        .mockResolvedValueOnce({ rows: [{ id: 2 }] }) // Second INSERT
        .mockResolvedValueOnce({ rows: [] }) // COMMIT

      // Update the mock implementation
      jest.spyOn(require('@/lib/db'), 'query').mockImplementation(mockQuery)

      const layout = {
        layout: [
          {
            skidId: 1,
            x: 0,
            y: 0,
            width: 4,
            length: 8,
            type: 'vinyl',
            stackId: 1,
            stackPosition: 1,
            customerId: 1,
            customerName: 'Test Customer'
          },
          {
            skidId: 2,
            x: 0,
            y: 0,
            width: 4,
            length: 8,
            type: 'vinyl',
            stackId: 1,
            stackPosition: 2,
            customerId: 1,
            customerName: 'Test Customer'
          }
        ]
      }

      const request = new NextRequest('http://localhost:3000/api/truckloads/1/layout', {
        method: 'POST',
        body: JSON.stringify(layout)
      })

      const response = await POST(request, { params: { id: '1' } })
      const data = await response.json()

      expect(data.success).toBe(true)

      // Verify correct INSERT queries were made
      const insertCalls = mockQuery.mock.calls.filter(
        call => call[0].trim().toUpperCase().startsWith('INSERT')
      )

      expect(insertCalls).toHaveLength(2) // Two item inserts
      
      // Verify stack positions were included in INSERT
      insertCalls.forEach(call => {
        expect(call[0]).toContain('stack_position')
        expect(call[1]).toHaveLength(12) // Should have 12 parameters including stack_position
      })
    })

    it('should handle reordering items within a stack', async () => {
      const mockQuery = jest.fn()
        .mockResolvedValueOnce({ rows: [] }) // SELECT layout
        .mockResolvedValueOnce({ rows: [{ id: 1 }] }) // INSERT INTO trailer_layouts
        .mockResolvedValueOnce({ rows: [] }) // DELETE
        .mockResolvedValueOnce({ rows: [{ id: 1 }] }) // First INSERT
        .mockResolvedValueOnce({ rows: [{ id: 2 }] }) // Second INSERT
        .mockResolvedValueOnce({ rows: [] }) // COMMIT

      // Update the mock implementation
      jest.spyOn(require('@/lib/db'), 'query').mockImplementation(mockQuery)

      const layout = {
        layout: [
          {
            skidId: 1,
            x: 0,
            y: 0,
            width: 4,
            length: 8,
            type: 'vinyl',
            stackId: 1,
            stackPosition: 2, // Swapped positions
            customerId: 1,
            customerName: 'Test Customer'
          },
          {
            skidId: 2,
            x: 0,
            y: 0,
            width: 4,
            length: 8,
            type: 'vinyl',
            stackId: 1,
            stackPosition: 1, // Swapped positions
            customerId: 1,
            customerName: 'Test Customer'
          }
        ]
      }

      const request = new NextRequest('http://localhost:3000/api/truckloads/1/layout', {
        method: 'POST',
        body: JSON.stringify(layout)
      })

      const response = await POST(request, { params: { id: '1' } })
      const data = await response.json()

      expect(data.success).toBe(true)

      // Verify items were inserted with correct positions
      const insertCalls = mockQuery.mock.calls.filter(
        call => call[0].trim().toUpperCase().startsWith('INSERT')
      )

      expect(insertCalls).toHaveLength(2) // Two item inserts
      
      // First item should have position 2
      expect(insertCalls[0][1][11]).toBe(2)
      // Second item should have position 1
      expect(insertCalls[1][1][11]).toBe(1)
    })
  })
}) 